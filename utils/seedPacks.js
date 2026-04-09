import Jugador from '../models/Jugador.js';
import Pack from '../models/Pack.js';

export default async function seedPacks() {
  try {
    // Vaciar la colección de packs actual para meter los nuevos
    await Pack.deleteMany({});
    console.log('🗑️ Packs antiguos eliminados. Creando nuevos packs...'.yellow);

    const CDN_BASE = 'https://cdn.jsdelivr.net/gh/lukitaz-r/assets@main/argenbot';

    const packsData = [
      {
        nombre: 'Gordos Comunes',
        tipo: 'normal',
        dir: `${CDN_BASE}/packs/normal.png`,
        valor: 5000,
        desc: 'Pack básico con jugadores normales. Probabilidad: 70% <77, 25% <86, 5% >=86.'
      },
      {
        nombre: 'Gordos Premium',
        tipo: 'normal',
        dir: `${CDN_BASE}/packs/normal.png`,
        valor: 10000,
        desc: 'Mejores jugadores normales. Probabilidades aumentadas (30% +86, 50% +82, 15% +80, 5% -80).'
      },
      {
        nombre: 'Gordos Especiales',
        tipo: 'especial',
        dir: `${CDN_BASE}/packs/especial.png`,
        valor: 40000,
        desc: 'Todos los jugadores especiales. 20% (+85), 80% (+80).'
      },
      {
        nombre: 'Heroes de Argentine',
        tipo: 'heroe',
        dir: `${CDN_BASE}/packs/heroe.png`,
        valor: 50000,
        desc: 'Héroes de Argentine. 30% (+85), 70% (+80).'
      },
      {
        nombre: 'Iconos de Argentine',
        tipo: 'icono',
        dir: `${CDN_BASE}/packs/icono.png`,
        valor: 100000,
        desc: 'Las leyendas más grandes. Misma probabilidad para todos.'
      },
      {
        nombre: 'Pack Malvado',
        tipo: 'scream',
        dir: `${CDN_BASE}/packs/scream.png`,
        valor: 30000,
        desc: 'Cartas terroríficas y oscuras. Misma probabilidad para todos.'
      },
      {
        nombre: 'Pack Olvidado',
        tipo: 'time_warp',
        dir: `${CDN_BASE}/packs/time_warp.png`,
        valor: 20000,
        desc: 'Cartas que el tiempo olvidó. Misma probabilidad para todos.'
      },
      {
        nombre: 'Pack MOTY',
        tipo: 'toty',
        dir: `${CDN_BASE}/packs/toty.png`,
        valor: 150000,
        desc: 'Cartas MOTY 2026. Misma probabilidad para todos.'
      },
      {
        nombre: 'Pack Godeano de Argentine',
        tipo: 'todos',
        dir: `${CDN_BASE}/packs/ultimate_argentine.png`,
        valor: 200000,
        desc: '¡TODAS las cartas posibles! Probabilidades de locos: 60% (+90), 30% (+88), 10% (+86).'
      }
    ];

    // Para evitar errores del modelo "contenido", le metemos un objeto vacío a todos
    const packsAInsertar = packsData.map(p => ({ ...p, contenido: {} }));

    await Pack.insertMany(packsAInsertar);
    console.log(`✅ ¡Se han creado ${packsData.length} packs exitosamente!`.green);
  } catch (error) {
    console.error('❌ Error al hacer seed de packs:'.red, error);
  }
}
