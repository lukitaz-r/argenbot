/**
 * Utilidades de cálculo de media (overall) de plantilla
 */

/**
 * Calcula la media promedio de un equipo.
 * @param {Array} equipo - Array de 4 slots del equipo
 * @returns {number|null} - Promedio de media o null si no hay jugadores
 */
export function calcularMedia(equipo) {
  if (!equipo || !Array.isArray(equipo)) return null;

  const jugadoresConMedia = equipo.filter(
    (slot) => slot && slot.nombre && slot.media != null
  );

  if (jugadoresConMedia.length === 0) return null;

  const sumaMedia = jugadoresConMedia.reduce((acc, j) => acc + j.media, 0);
  return Math.round((sumaMedia / jugadoresConMedia.length) * 10) / 10;
}

/**
 * Verifica si la plantilla está completa (4 jugadores reales en campo).
 * @param {Array} equipo - Array de 4 slots del equipo
 * @returns {boolean}
 */
export function plantillaCompleta(equipo) {
  if (!equipo || !Array.isArray(equipo) || equipo.length < 4) return false;

  return equipo.every(
    (slot) => slot && slot.nombre && slot.media != null
  );
}

/**
 * Calcula las probabilidades de un duelo usando diferencia absoluta amplificada.
 * Pequeñas diferencias de media generan grandes diferencias de probabilidad.
 * 
 * Factor de amplificación: x3
 * - diff 1 punto  → 53% vs 47%
 * - diff 3 puntos → 59% vs 41%
 * - diff 5 puntos → 65% vs 35%
 * - diff 8 puntos → 74% vs 26%
 * - diff 10 puntos → 80% vs 20%
 * - diff 13+ puntos → 89% vs 11% (cap)
 * 
 * @param {number} mediaA - Media del equipo A
 * @param {number} mediaB - Media del equipo B
 * @returns {{ probA: number, probB: number }} - Probabilidades en porcentaje
 */
export function calcularProbabilidades(mediaA, mediaB) {
  const FACTOR = 3;
  const MIN_PROB = 10;
  const MAX_PROB = 90;

  const diff = mediaA - mediaB;
  let probA = 50 + (diff * FACTOR);

  // Clamp entre MIN y MAX
  probA = Math.max(MIN_PROB, Math.min(MAX_PROB, probA));
  const probB = 100 - probA;

  return {
    probA: Math.round(probA * 10) / 10,
    probB: Math.round(probB * 10) / 10
  };
}

/**
 * Calcula la compensación (bonus) para un equipo underdog que gana.
 * Cuanto más underdog sea, mayor el bonus.
 * 
 * @param {number} probGanador - Probabilidad que tenía el ganador (%)
 * @param {number} apuesta - Monto de la apuesta
 * @returns {number} - Bonus adicional (0 si no era underdog)
 */
export function calcularBonus(probGanador, apuesta) {
  if (probGanador >= 50) return 0;

  // Bonus = apuesta * (50 - prob) / 50
  // Ej: prob 35% → bonus = apuesta * 15/50 = 30% de la apuesta
  // Ej: prob 20% → bonus = apuesta * 30/50 = 60% de la apuesta
  const bonusPct = (50 - probGanador) / 50;
  return Math.round(apuesta * bonusPct);
}
