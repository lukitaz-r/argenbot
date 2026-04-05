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
const CDN_BASE = `https://cdn.jsdelivr.net/gh/${GITHUB_USER}/${GITHUB_REPO}@${GITHUB_BRANCH}/argenbot`;
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
 * Actualiza cartas.json: cambia rutas locales _b64.js por URLs CDN
 */
function updateCartasJson() {
  const cartasPath = join(rootDir, 'assets', 'cartas.json');
  if (!existsSync(cartasPath)) return;

  const cartas = JSON.parse(readFileSync(cartasPath, 'utf-8'));
  let modified = false;

  for (const carta of cartas) {
    if (carta.ruta && !carta.ruta.startsWith('http')) {
      // assets/cartas/normales/Aztro_b64.js → cartas/normales/Aztro.png
      let cdnPath = carta.ruta
        .replace(/^assets\//, '')
        .replace(/_b64\.js$/, '.png');

      carta.ruta = `${CDN_BASE}/${encodeURI(cdnPath)}`;
      modified = true;
    }
  }

  if (modified) {
    writeFileSync(cartasPath, JSON.stringify(cartas, null, 4));
    console.log('  📝 cartas.json actualizado con URLs CDN.'.cyan);
  }
}

/**
 * Genera catalogo.json con el mapeo nombre → URL CDN
 */
function generateCatalogoJson() {
  const catalogoDir = join(ASSETS_DIR, 'catalogo');
  if (!existsSync(catalogoDir)) return;

  const files = readdirSync(catalogoDir).filter(f => f.toLowerCase().endsWith('.png'));
  const mapping = {};

  for (const file of files) {
    mapping[file] = `${CDN_BASE}/catalogo/${encodeURI(file)}`;
  }

  writeFileSync(join(ASSETS_DIR, 'catalogo.json'), JSON.stringify(mapping, null, 2));
  console.log('  📝 catalogo.json generado con URLs CDN.'.cyan);
}

/**
 * Genera fondo.json con el mapeo nombre → URL CDN
 */
function generateFondoJson() {
  const fondoDir = join(ASSETS_DIR, 'fondo');
  if (!existsSync(fondoDir)) return;

  const files = readdirSync(fondoDir).filter(f => f.toLowerCase().endsWith('.png'));
  const mapping = {};

  for (const file of files) {
    mapping[file] = `${CDN_BASE}/fondo/${encodeURI(file)}`;
  }

  writeFileSync(join(ASSETS_DIR, 'fondo.json'), JSON.stringify(mapping, null, 2));
  console.log('  📝 fondo.json generado con URLs CDN.'.cyan);
}

// ─── Handler principal ──────────────────────────────────────────────

export default async (_client) => {
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

      // Aunque no haya cambios en los PNGs, asegurarse de que
      // cartas.json y los JSONs auxiliares estén actualizados
      updateCartasJson();
      generateCatalogoJson();
      generateFondoJson();
      return;
    }

    console.log(`📦 CDN Handler: ${changedFiles.length} archivos nuevos/modificados, ${deletedFiles.length} eliminados.`.yellow);

    // 4. Preparar el repositorio en un directorio temporal
    if (existsSync(TEMP_DIR)) {
      rmSync(TEMP_DIR, { recursive: true, force: true });
    }

    // Detectar si el repo remoto está vacío (sin commits)
    let repoIsEmpty = false;
    try {
      const lsRemote = exec(`git ls-remote ${REPO_URL} HEAD`).trim();
      repoIsEmpty = lsRemote.length === 0;
    } catch {
      repoIsEmpty = true;
    }

    if (repoIsEmpty) {
      // Repo vacío: inicializar localmente y vincular el remote
      console.log('  📦 Repositorio vacío detectado. Inicializando...'.yellow);
      mkdirSync(TEMP_DIR, { recursive: true });
      exec('git init', TEMP_DIR);
      exec('git branch -M main', TEMP_DIR);
      exec(`git remote add origin ${REPO_URL}`, TEMP_DIR);
    } else {
      // Repo con contenido: clonar
      console.log('  📥 Clonando repositorio de assets...'.cyan);
      try {
        exec(`git clone ${REPO_URL} "${TEMP_DIR}"`);
      } catch (cloneErr) {
        console.error('  ❌ Error al clonar el repositorio. Asegurate de tener acceso.'.red);
        console.error(`     Intentá: git clone ${REPO_URL}`.yellow);
        console.error('     Si te pide credenciales, autenticá con: gh auth login'.yellow);
        throw cloneErr;
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
    try {
      rmSync(TEMP_DIR, { recursive: true, force: true });
    } catch { /* no es crítico */ }

    // 9. Actualizar cartas.json y generar JSONs auxiliares
    updateCartasJson();
    generateCatalogoJson();
    generateFondoJson();

    // 10. Guardar manifiesto actualizado
    saveManifest(currentState);

    if (pushed) {
      console.log('🌐 CDN Handler: Sincronización completada exitosamente.'.green);
      console.log(`   Base CDN: ${CDN_BASE}`.gray);
    } else {
      console.log('🌐 CDN Handler: URLs CDN generadas (push puede haber fallado, verificar credenciales).'.yellow);
    }

  } catch (error) {
    console.error('❌ CDN Handler: Error en la sincronización:'.red, error.message);
    // No detener el bot por un error de CDN — seguir con los datos locales
    // si cartas.json no fue actualizado, los seeds usarán las rutas locales
  }
};
