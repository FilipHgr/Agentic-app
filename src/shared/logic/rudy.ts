/**
 * Pohyby pandy Rudyho (#169) bez Phaseru: které pohyby jsou, jak velký je
 * snímek v archu a který snímek je v daném čase vidět. Od #186 Rudy jen
 * slaví po 10 hvězdičkách, pozdrav (mávání) není.
 *
 * Pohyb je arch snímků v mřížce (`RUDY_SHEET`). Všechny pohyby mají
 * společný výřez s místem kolem uší, panda je ve všech na stejném místě.
 */

/** Pohyby pandy Rudyho; klid je první a je vždy v paměti, oslava, pak mluví. */
export const RUDY_MOVES = ['idle', 'celebrate', 'talk'] as const;
export type RudyMove = (typeof RUDY_MOVES)[number];

/** Arch snímků jednoho pohybu: rozměr snímku, mřížka a rychlost. */
export interface MascotSheet {
  /** Šířka a výška jednoho snímku v px archu. */
  readonly frameWidth: number;
  readonly frameHeight: number;
  /** Počet sloupců mřížky snímků. */
  readonly columns: number;
  readonly frameCount: number;
  readonly framesPerSecond: number;
}

/** Arch pohybů pandy Rudyho: 37 snímků 439 × 480 px po 12 snímcích/s v 6 sloupcích. */
export const RUDY_SHEET: MascotSheet = {
  frameWidth: 439,
  frameHeight: 480,
  columns: 6,
  frameCount: 37,
  framesPerSecond: 12,
};

/** Snímek pandy: pohyb a pořadí snímku od 0. */
export interface RudyFrame {
  readonly move: RudyMove;
  readonly frame: number;
}

function frameMs(): number {
  return 1000 / RUDY_SHEET.framesPerSecond;
}

/** Jak dlouho trvá jedno přehrání pohybu (ms), asi 3,1 s. */
export function rudyMoveDurationMs(): number {
  return RUDY_SHEET.frameCount * frameMs();
}

/** Uplynulý čas jako nezáporné konečné číslo (nesmysl je 0). */
function safeElapsed(elapsed: number): number {
  return Number.isFinite(elapsed) && elapsed > 0 ? elapsed : 0;
}

/** Snímek pohybu opakovaného dokola po `elapsed` ms (klid, mluvení). */
export function loopFrameAt(elapsed: number): number {
  return Math.floor(safeElapsed(elapsed) / frameMs()) % RUDY_SHEET.frameCount;
}

/** Snímek jednorázového pohybu po `elapsed` ms; po konci zůstane poslední. */
export function onceFrameAt(elapsed: number): number {
  return Math.min(Math.floor(safeElapsed(elapsed) / frameMs()), RUDY_SHEET.frameCount - 1);
}
