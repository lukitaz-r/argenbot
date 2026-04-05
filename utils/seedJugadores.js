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
  if (tipo.includes('Usuario del Año')) base *= 4;
  else if (tipo.includes('Icons') || tipo.includes('Iconos')) base *= 3;
  else if (tipo.includes('Heroes')) base *= 2.2;
  else if (tipo.includes('Future Niggas') || tipo.includes('Flashbacks') || tipo.includes('Aniversario')) base *= 2;
  else if (tipo.includes('Personas Malvadas')) base *= 1.8;
  else if (tipo.includes('Personajes Olvidados')) base *= 1.5;
  else if (tipo.includes('Oro Especial')) base *= 1.3;
  else if (tipo.includes('Gordesliga')) base *= 1.1;
  else if (tipo.includes('Plata')) base *= 0.8;

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
