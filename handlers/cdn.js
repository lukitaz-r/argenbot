import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync, rmSync, statSync } from 'fs';
import { join, dirname, relative } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import { execSync } from 'child_process';
import 'colors';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

// ─── Configuración ───────────────────────────────────────────────────
const GITHUB_USER = 'lukitaz-r';
const GITHUB_REPO = 'assets';
const GITHUB_BRANCH = 'main';
const MANIFEST_PATH = join(rootDir, '.cdn-manifest.json');
const ASSETS_DIR = join(rootDir, 'assets');
const TEMP_DIR = join(rootDir, '.cdn-temp');
const REPO_URL = `https://github.com/${GITHUB_USER}/${GITHUB_REPO}.git`;

// ─── Utilidades ──────────────────────────────────────────────────────

/**
 * Busca recursivamente todos los archivos .png dentro de un directorio
 */
function getAllPngFiles(dir, baseDir = dir) {
  let results = [];
  const items = readdirSync(dir);
  for (const item of items) {
    const fullPath = join(dir, item);
    if (statSync(fullPath).isDirectory()) {
      results = results.concat(getAllPngFiles(fullPath, baseDir));
    } else if (item.toLowerCase().endsWith('.png')) {
      const relativePath = relative(baseDir, fullPath).replace(/\\/g, '/');
      results.push({ fullPath, relativePath });
    }
  }
  return results;
}

/**
 * Calcula el hash MD5 de un archivo
 */
function computeHash(filePath) {
  const content = readFileSync(filePath);
  return createHash('md5').update(content).digest('hex');
}

/**
 * Carga el manifiesto existente o retorna objeto vacío
 */
function loadManifest() {
  if (existsSync(MANIFEST_PATH)) {
    try {
      return JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8'));
    } catch {
      return {};
    }
  }
  return {};
}

/**
 * Guarda el manifiesto actualizado
 */
function saveManifest(manifest) {
  writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
}

/**
 * Ejecuta un comando shell y retorna el output.
 * Timeout alto para soportar push de muchos archivos grandes.
 */
function exec(cmd, cwd = rootDir) {
  return execSync(cmd, { cwd, stdio: 'pipe', encoding: 'utf-8', timeout: 600000 });
}

// ─── Funciones de actualización de datos ─────────────────────────────

/**
 * Actualiza cartas.json usando URLs basadas en hash de commit
 */
function updateCartasJson(cdnBaseUrl) {
  const cartasPath = join(rootDir, 'assets', 'cartas.json');
  if (!existsSync(cartasPath)) return;

  const cartas = JSON.parse(readFileSync(cartasPath, 'utf-8'));
  let modified = false;

  const IS_CDN_REGEX = new RegExp(`^https://cdn\\.jsdelivr\\.net/gh/${GITHUB_USER}/${GITHUB_REPO}@[^/]+/argenbot/(.*)`);

  for (const carta of cartas) {
    if (!carta.ruta) continue;

    if (!carta.ruta.startsWith('http')) {
      let cdnPath = carta.ruta
        .replace(/^assets\//, '')
        .replace(/_b64\.js$/, '.png');

      carta.ruta = `${cdnBaseUrl}/${encodeURI(cdnPath)}`;
      modified = true;
    } else {
      const match = carta.ruta.match(IS_CDN_REGEX);
      if (match) {
        const relPathEncoded = match[1].split('?')[0];
        const newUrl = `${cdnBaseUrl}/${relPathEncoded}`;
        if (carta.ruta !== newUrl) {
          carta.ruta = newUrl;
          modified = true;
        }
      }
    }
  }

  if (modified) {
    writeFileSync(cartasPath, JSON.stringify(cartas, null, 4));
    console.log('  📝 cartas.json actualizado a la versión de revisión actual.'.cyan);
  }
}

/**
 * Genera catalogo.json con la URL con el hash de commit
 */
function generateCatalogoJson(cdnBaseUrl) {
  const catalogoDir = join(ASSETS_DIR, 'catalogo');
  if (!existsSync(catalogoDir)) return;

  const files = readdirSync(catalogoDir).filter(f => f.toLowerCase().endsWith('.png'));
  const mapping = {};

  for (const file of files) {
    mapping[file] = `${cdnBaseUrl}/catalogo/${encodeURI(file)}`;
  }

  writeFileSync(join(ASSETS_DIR, 'catalogo.json'), JSON.stringify(mapping, null, 2));
  console.log('  📝 catalogo.json generado con revisión actual.'.cyan);
}

/**
 * Genera fondo.json con la URL con el hash de commit
 */
function generateFondoJson(cdnBaseUrl) {
  const fondoDir = join(ASSETS_DIR, 'fondo');
  if (!existsSync(fondoDir)) return;

  const files = readdirSync(fondoDir).filter(f => f.toLowerCase().endsWith('.png'));
  const mapping = {};

  for (const file of files) {
    mapping[file] = `${cdnBaseUrl}/fondo/${encodeURI(file)}`;
  }

  writeFileSync(join(ASSETS_DIR, 'fondo.json'), JSON.stringify(mapping, null, 2));
  console.log('  📝 fondo.json generado con revisión actual.'.cyan);
}

// ─── Handler principal ──────────────────────────────────────────────

export default async (_client) => {
  const isProduction = process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'prod' || process.env.PUPPETEER_SKIP_CHROMIUM_DOWNLOAD === 'true';
  if (isProduction) {
    console.log('\n🌐 CDN Handler: Desactivado en entorno de producción.'.gray);
    return;
  }

  console.log('\n🌐 CDN Handler: Verificando assets...'.cyan);

  try {
    // 1. Escanear todos los archivos .png
    const pngFiles = getAllPngFiles(ASSETS_DIR);
    const manifest = loadManifest();

    // 2. Calcular hashes y encontrar cambios
    const currentState = {};
    const changedFiles = [];

    for (const { fullPath, relativePath } of pngFiles) {
      const hash = computeHash(fullPath);
      currentState[relativePath] = hash;

      if (manifest[relativePath] !== hash) {
        changedFiles.push({ fullPath, relativePath });
      }
    }

    // 3. Detectar archivos eliminados
    const deletedFiles = Object.keys(manifest).filter(k => !currentState[k]);

    if (changedFiles.length === 0 && deletedFiles.length === 0) {
      console.log('✅ CDN Handler: No hay cambios en los assets. Todo actualizado.'.green);

      let commitHash = 'main';
      try {
        if (existsSync(join(TEMP_DIR, '.git'))) {
          commitHash = exec('git rev-parse HEAD', TEMP_DIR).trim() || 'main';
        } else {
          const lsRemote = exec(`git ls-remote ${REPO_URL} HEAD`).trim();
          commitHash = lsRemote.split(/\s+/)[0] || 'main';
        }
      } catch (err) { }
      const cdnBaseUrl = `https://cdn.jsdelivr.net/gh/${GITHUB_USER}/${GITHUB_REPO}@${commitHash}/argenbot`;

      updateCartasJson(cdnBaseUrl);
      generateCatalogoJson(cdnBaseUrl);
      generateFondoJson(cdnBaseUrl);
      return;
    }

    console.log(`📦 CDN Handler: ${changedFiles.length} archivos nuevos/modificados, ${deletedFiles.length} eliminados.`.yellow);

    // 4. Preparar el repositorio en un directorio temporal
    let repoIsEmpty = false;
    try {
      const lsRemote = exec(`git ls-remote ${REPO_URL} HEAD`).trim();
      repoIsEmpty = lsRemote.length === 0;
    } catch {
      repoIsEmpty = true;
    }

    if (!existsSync(TEMP_DIR) || !existsSync(join(TEMP_DIR, '.git'))) {
      if (existsSync(TEMP_DIR)) rmSync(TEMP_DIR, { recursive: true, force: true });
      
      if (repoIsEmpty) {
        // Repo vacío: inicializar localmente y vincular el remote
        console.log('  📦 Repositorio vacío detectado. Inicializando...'.yellow);
        mkdirSync(TEMP_DIR, { recursive: true });
        exec('git init', TEMP_DIR);
        exec('git branch -M main', TEMP_DIR);
        exec(`git remote add origin ${REPO_URL}`, TEMP_DIR);
      } else {
        // Repo con contenido: clonar por primera vez
        console.log('  📥 Clonando repositorio de assets por primera vez...'.cyan);
        try {
          exec(`git clone ${REPO_URL} "${TEMP_DIR}"`);
        } catch (cloneErr) {
          console.error('  ❌ Error al clonar el repositorio. Asegurate de tener acceso.'.red);
          console.error(`     Intentá: git clone ${REPO_URL}`.yellow);
          console.error('     Si te pide credenciales, autenticá con: gh auth login'.yellow);
          throw cloneErr;
        }
      }
    } else {
      // El repositorio temporal existe y es un .git
      console.log('  🔄 Sincronizando repositorio temporal con remoto...'.cyan);
      try {
        if (!repoIsEmpty) {
          exec('git fetch origin main', TEMP_DIR);
          exec('git reset --hard origin/main', TEMP_DIR);
          exec('git clean -fd', TEMP_DIR);
        } else {
          // Si el remoto está vacío pero tenemos el repo temporal, nos aseguramos de estar en main limpios
          exec('git reset --hard HEAD', TEMP_DIR);
          exec('git clean -fd', TEMP_DIR);
        }
      } catch (err) {
        console.log('  ⚠️ Falló la sincronización. Se recreará el repositorio.'.yellow);
        rmSync(TEMP_DIR, { recursive: true, force: true });
        if (repoIsEmpty) {
          mkdirSync(TEMP_DIR, { recursive: true });
          exec('git init', TEMP_DIR);
          exec('git branch -M main', TEMP_DIR);
          exec(`git remote add origin ${REPO_URL}`, TEMP_DIR);
        } else {
          exec(`git clone ${REPO_URL} "${TEMP_DIR}"`);
        }
      }
    }

    // 5. Copiar archivos nuevos/modificados al repo clonado (dentro de argenbot/)
    const repoAssetsDir = join(TEMP_DIR, 'argenbot');
    if (!existsSync(repoAssetsDir)) {
      mkdirSync(repoAssetsDir, { recursive: true });
    }

    let copiedCount = 0;
    for (const { fullPath, relativePath } of changedFiles) {
      const destPath = join(repoAssetsDir, relativePath);
      const destDir = dirname(destPath);
      if (!existsSync(destDir)) {
        mkdirSync(destDir, { recursive: true });
      }
      copyFileSync(fullPath, destPath);
      copiedCount++;
      // Mostrar progreso cada 50 archivos
      if (copiedCount % 50 === 0) {
        console.log(`  📋 Copiados ${copiedCount}/${changedFiles.length} archivos...`.gray);
      }
    }

    // 6. Eliminar archivos que ya no existen localmente
    for (const deletedPath of deletedFiles) {
      const destPath = join(repoAssetsDir, deletedPath);
      if (existsSync(destPath)) {
        rmSync(destPath, { force: true });
      }
    }

    // 7. Git add, commit, push
    exec('git add -A', TEMP_DIR);

    let pushed = false;
    try {
      const status = exec('git status --porcelain', TEMP_DIR).trim();
      if (status.length > 0) {
        exec(`git commit -m "Sync ${changedFiles.length} assets [auto]"`, TEMP_DIR);
        console.log(`  📤 Subiendo ${changedFiles.length} archivos a GitHub (esto puede tardar)...`.cyan);
        exec(`git push -u origin ${GITHUB_BRANCH}`, TEMP_DIR);
        pushed = true;
        console.log(`  ✅ ${changedFiles.length} archivos sincronizados a GitHub.`.green);

        // Purgar caché de los archivos alterados/eliminados en jsDelivr
        const filesToPurge = [...changedFiles.map(f => f.relativePath), ...deletedFiles];
        if (filesToPurge.length > 0) {
          console.log(`  🧹 Purgando caché en jsDelivr para ${filesToPurge.length} archivos...`.cyan);
          const purgeBase = `https://purge.jsdelivr.net/gh/${GITHUB_USER}/${GITHUB_REPO}@${GITHUB_BRANCH}/argenbot`;
          let purgedCount = 0;
          for (const relPath of filesToPurge) {
            try {
              await fetch(`${purgeBase}/${encodeURI(relPath)}`);
              purgedCount++;
            } catch (e) { /* ignorar fallos individuales */ }
          }
          if (purgedCount > 0) console.log(`  ✅ Caché de jsDelivr purgada para ${purgedCount} archivos.`.green);
        }
      } else {
        console.log('  ℹ️  El repositorio remoto ya estaba actualizado.'.cyan);
      }
    } catch (pushErr) {
      console.error('  ❌ Error al hacer push. Verificá credenciales de git.'.red);
      console.error('     Opciones para autenticar:'.yellow);
      console.error('       1. gh auth login'.yellow);
      console.error('       2. git config --global credential.helper manager'.yellow);
      // No lanzar error — continuar con la generación de URLs igualmente
    }

    // 8. Limpiar directorio temporal
    // Optimización: ya no limpiamos el TEMP_DIR. Lo mantenemos para agilizar futuros deploys
    // descargando solo el diferencial con git fetch origin main.

    // 9. Actualizar cartas.json y generar JSONs auxiliares
    let commitHash = 'main';
    try {
      commitHash = exec('git rev-parse HEAD', TEMP_DIR).trim() || 'main';
    } catch { }
    const cdnBaseUrl = `https://cdn.jsdelivr.net/gh/${GITHUB_USER}/${GITHUB_REPO}@${commitHash}/argenbot`;

    updateCartasJson(cdnBaseUrl);
    generateCatalogoJson(cdnBaseUrl);
    generateFondoJson(cdnBaseUrl);

    // 10. Guardar manifiesto actualizado
    saveManifest(currentState);

    if (pushed) {
      console.log('🌐 CDN Handler: Sincronización completada exitosamente.'.green);
      console.log(`   Base CDN: ${cdnBaseUrl}`.gray);
    } else {
      console.log('🌐 CDN Handler: URLs CDN generadas (push puede haber fallado, verificar credenciales).'.yellow);
    }

  } catch (error) {
    console.error('❌ CDN Handler: Error en la sincronización:'.red, error.message);
    // No detener el bot por un error de CDN — seguir con los datos locales
    // si cartas.json no fue actualizado, los seeds usarán las rutas locales
  }
};
