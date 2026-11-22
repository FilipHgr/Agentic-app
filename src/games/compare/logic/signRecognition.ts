/**
 * Rozpoznání znaménka + nebo − napsaného prstem (#188). Běží jen
 * v zařízení a nepotřebuje žádné vzory: zápis se rozloží na tahy a každý
 * tah se změří (jak je rovný, jak je dlouhý a kterým směrem jde).
 *
 * - Jeden zhruba vodorovný rovný tah je −.
 * - Dva rovné tahy, jeden zhruba vodorovný a druhý zhruba svislý, které
 *   se kříží někde uprostřed, jsou + (v jakémkoli pořadí a směru).
 * - Cokoli jiného (svislá čára, kruh, čmáranice, číslice, ×, =, T, L) se
 *   nerozpozná a okénko vyzve psát znovu.
 *
 * Tahy smí být nakloněné, nerovné, s háčkem na konci, krátké i dlouhé.
 * Malé ťuknutí (tečka) se nepočítá jako tah. Čistý TypeScript bez Phaseru.
 */

import type { Stroke, StrokePoint, WritingAreaSize } from '../../../shared/logic/strokes';
import type { CompareSign } from './compareProblems';

/** Tah menší než tato část kratší strany okénka je ťuknutí, ne čára; nepočítá se. */
const DOT_SHARE = 0.06;

/** Čára znaménka musí být dlouhá aspoň tuto část kratší strany okénka. */
const MIN_LINE_SHARE = 0.15;

/**
 * Rovný tah nejde zpátky: pohyb proti směru od začátku ke konci smí dát
 * dohromady nejvýš tuto část délky spojnice (chvění prstu se tak
 * nepočítá, kruh nebo čmáranice tam a zpátky ano).
 */
const MAX_BACKTRACK_SHARE = 0.25;

/** Rovný tah: žádný bod není od spojnice konců dál než tato část její délky. */
const MAX_BEND_SHARE = 0.22;

/** Vodorovná čára smí být nakloněná nejvýš o tolik stupňů, svislá taky. */
const MAX_TILT_DEGREES = 35;

/**
 * Čáry plus se musí křížit: místo křížení leží na každé čáře mezi touto
 * částí a zbytkem do 1 od začátku (T nebo L se nekříží).
 */
const CROSS_MARGIN = 0.1;

/** Kratší čára plus má aspoň tuto část delší (jinak to je čára s čárkou). */
const MIN_LENGTH_RATIO = 0.3;

type LineDirection = 'horizontal' | 'vertical';

/** Rovný tah zjednodušený na úsečku od začátku ke konci. */
interface Line {
  readonly direction: LineDirection;
  readonly start: StrokePoint;
  readonly end: StrokePoint;
  readonly length: number;
}

/** Rozpozná znaménko v zápisu; `null`, když zápis není + ani −. */
export function recognizeSign(
  strokes: readonly Stroke[],
  area: WritingAreaSize,
): CompareSign | null {
  const side = Math.min(area.width, area.height);
  const marks = strokes.filter((stroke) => extent(stroke) >= DOT_SHARE * side);
  const lines = marks.map((stroke) => lineOf(stroke, side));
  if (lines.some((line) => line === null)) {
    return null;
  }
  const straight = lines as Line[];
  if (straight.length === 1) {
    return straight[0]?.direction === 'horizontal' ? '−' : null;
  }
  if (straight.length === 2) {
    return isPlus(straight[0] as Line, straight[1] as Line) ? '+' : null;
  }
  return null;
}

/** Jsou dvě čáry plus: jedna vodorovná, druhá svislá, podobně dlouhé a kříží se? */
function isPlus(first: Line, second: Line): boolean {
  if (first.direction === second.direction) {
    return false;
  }
  const shorter = Math.min(first.length, second.length);
  const longer = Math.max(first.length, second.length);
  if (shorter < MIN_LENGTH_RATIO * longer) {
    return false;
  }
  const crossing = crossingOf(first, second);
  return crossing !== null && isInMiddle(crossing.alongFirst) && isInMiddle(crossing.alongSecond);
}

function isInMiddle(share: number): boolean {
  return share >= CROSS_MARGIN && share <= 1 - CROSS_MARGIN;
}

/**
 * Kde se protnou přímky obou čar, jako část délky každé čáry od jejího
 * začátku (0 začátek, 1 konec). Rovnoběžné čáry dají `null`.
 */
function crossingOf(
  first: Line,
  second: Line,
): { readonly alongFirst: number; readonly alongSecond: number } | null {
  const r = { x: first.end.x - first.start.x, y: first.end.y - first.start.y };
  const s = { x: second.end.x - second.start.x, y: second.end.y - second.start.y };
  const denominator = r.x * s.y - r.y * s.x;
  if (Math.abs(denominator) < 1e-9) {
    return null;
  }
  const q = { x: second.start.x - first.start.x, y: second.start.y - first.start.y };
  return {
    alongFirst: (q.x * s.y - q.y * s.x) / denominator,
    alongSecond: (q.x * r.y - q.y * r.x) / denominator,
  };
}

/** Rovný, dost dlouhý vodorovný nebo svislý tah jako úsečka; jinak `null`. */
function lineOf(stroke: Stroke, side: number): Line | null {
  const start = stroke[0];
  const end = stroke[stroke.length - 1];
  if (start === undefined || end === undefined) {
    return null;
  }
  const chord = Math.hypot(end.x - start.x, end.y - start.y);
  if (chord < MIN_LINE_SHARE * side) {
    return null;
  }
  if (
    backtrack(stroke, start, end, chord) > MAX_BACKTRACK_SHARE * chord ||
    maxBend(stroke, start, end, chord) > MAX_BEND_SHARE * chord
  ) {
    return null;
  }
  const direction = directionOf(start, end);
  return direction === null ? null : { direction, start, end, length: chord };
}

/** Vodorovně, svisle, nebo šikmo (`null`) podle sklonu spojnice konců. */
function directionOf(start: StrokePoint, end: StrokePoint): LineDirection | null {
  const degrees =
    (Math.atan2(Math.abs(end.y - start.y), Math.abs(end.x - start.x)) * 180) / Math.PI;
  if (degrees <= MAX_TILT_DEGREES) {
    return 'horizontal';
  }
  if (degrees >= 90 - MAX_TILT_DEGREES) {
    return 'vertical';
  }
  return null;
}

/** Nejdelší strana obdélníku kolem tahu. */
function extent(stroke: Stroke): number {
  if (stroke.length === 0) {
    return 0;
  }
  const xs = stroke.map((point) => point.x);
  const ys = stroke.map((point) => point.y);
  return Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
}

/** Kolik tah dohromady ušel proti směru od začátku ke konci (návraty, smyčky). */
function backtrack(stroke: Stroke, start: StrokePoint, end: StrokePoint, chord: number): number {
  const dx = (end.x - start.x) / chord;
  const dy = (end.y - start.y) / chord;
  let backwards = 0;
  for (let index = 1; index < stroke.length; index += 1) {
    const previous = stroke[index - 1] as StrokePoint;
    const point = stroke[index] as StrokePoint;
    const step = (point.x - previous.x) * dx + (point.y - previous.y) * dy;
    backwards += Math.max(0, -step);
  }
  return backwards;
}

/** Největší vzdálenost bodu tahu od spojnice jeho konců. */
function maxBend(stroke: Stroke, start: StrokePoint, end: StrokePoint, chord: number): number {
  const dx = (end.x - start.x) / chord;
  const dy = (end.y - start.y) / chord;
  let bend = 0;
  for (const point of stroke) {
    bend = Math.max(bend, Math.abs((point.x - start.x) * dy - (point.y - start.y) * dx));
  }
  return bend;
}
