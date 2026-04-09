import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import Jugador from '../models/Jugador.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Calcula el valor de un jugador basado en su media y tipo
 */
function calcularValor(media, tipo) {
  let base = media * 100;

  // Bonus por tipo de carta
  if (tipo.includes('Icono')) {
    base *= 4
    if (tipo.includes('Usuario del Año')) base *= 2;
    else if (tipo.includes('Aniversario')) base *= 1.5;
  } else if (tipo.includes('Heroes')) {
    base *= 3
    if (tipo.includes('Argentine Aniversario')) base *= 2;
    else if (tipo.includes('Argentine')) base *= 1.5;
  } else if (tipo.includes('Flashbacks')) {
    base *= 4
  }
  else if (tipo.includes('Usuario del Año')) {
    base *= 6
  }
  else if (tipo.includes('Future Niggas')) {
    base *= 4
  }
  else if (tipo.includes('Nominados')) {
    base *= 2
    if (tipo.includes('Usuario del Año')) base *= 1.5
  }
  else if (tipo.includes('Future Niggas')) {
    base *= 4
  }
  else if (tipo.includes('Argentine Aniversario')) {
    base *= 4
  } else if (tipo.includes('Personajes')) {
    base *= 1.5
    if (tipo.includes('Malvados')) base *= 2;
    else if (tipo.includes('Olvidados')) base *= 1.5;
  } else if (tipo.includes('Gordesliga Revivida')) {
    base *= 2
  } else if (tipo.includes('Oro')) {
    base *= 1.5
    if (tipo.includes('Especial')) base *= 1.5;
    else if (tipo.includes('Común')) base *= 1.25;
  } else if (tipo.includes('Plata')) {
    base *= 1.25
    if (tipo.includes('Especial')) base *= 1.25;
    else if (tipo.includes('Común')) base *= 1.1;
  } else if (tipo.includes('Bronce')) {
    base *= 1.1
    if (tipo.includes('Especial')) base *= 1.1;
    else if (tipo.includes('Común')) base *= 0.9;
  }

  return Math.round(base);
}

export default async function seedJugadores() {
  try {
    await Jugador.deleteMany({});
    // const count = await Jugador.countDocuments();
    // if (count > 0) {
    //   console.log(`⚽ Ya hay ${count} jugadores en la base de datos, saltando seed.`.cyan);
    //   return;
    // }

    const cartasPath = join(__dirname, '..', 'assets', 'cartas.json');
    const cartasRaw = readFileSync(cartasPath, 'utf-8');
    const cartas = JSON.parse(cartasRaw);

    const jugadores = cartas.map(c => ({
      nombre: c.nombre,
      tipo: c.tipo,
      dir: c.ruta,
      media: parseInt(c.media),
      valor: calcularValor(parseInt(c.media), c.tipo)
    }));

    await Jugador.insertMany(jugadores);
    console.log(`⚽ ${jugadores.length} jugadores cargados a la base de datos!`.green);
  } catch (error) {
    console.error('❌ Error al hacer seed de jugadores:'.red, error);
  }
}
