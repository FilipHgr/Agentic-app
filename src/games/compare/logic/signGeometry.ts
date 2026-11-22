/**
 * Měření tahů pro rozpoznání znamének (#188, #191): jak je tah velký, jestli
 * je rovný a kde se protnou dvě čáry. Společné pro + − i < = >. Čistý
 * TypeScript bez Phaseru.
 */

import type { Stroke, StrokePoint } from '../../../shared/logic/strokes';

/** Tah menší než tato část kratší strany okénka je ťuknutí, ne čára; nepočítá se. */
export const DOT_SHARE = 0.06;

/** Čára znaménka musí být dlouhá aspoň tuto část kratší strany okénka. */
export const MIN_LINE_SHARE = 0.15;

/** Vodorovná čára smí být nakloněná nejvýš o tolik stupňů, svislá taky. */
export const MAX_TILT_DEGREES = 35;

/**
 * Rovný tah nejde zpátky: pohyb proti směru od začátku ke konci smí dát
 * dohromady nejvýš tuto část délky spojnice (chvění prstu se tak
 * nepočítá, kruh nebo čmáranice tam a zpátky ano).
 */
const MAX_BACKTRACK_SHARE = 0.25;

/** Rovný tah: žádný bod není od spojnice konců dál než tato část její délky. */
const MAX_BEND_SHARE = 0.22;

/** Rovný kus tahu zjednodušený na úsečku od začátku ke konci. */
export interface Segment {
  readonly start: StrokePoint;
  readonly end: StrokePoint;
  readonly length: number;
}

/** Nejdelší strana obdélníku kolem tahu. */
export function extent(stroke: Stroke): number {
  if (stroke.length === 0) {
    return 0;
  }
  const xs = stroke.map((point) => point.x);
  const ys = stroke.map((point) => point.y);
  return Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
}

/**
 * Rovný tah aspoň `minLength` dlouhý (v jakémkoli směru) jako úsečka;
 * zahnutý, vracející se nebo krátký tah dá `null`.
 */
export function straightSegment(stroke: Stroke, minLength: number): Segment | null {
  const start = stroke[0];
  const end = stroke[stroke.length - 1];
  if (start === undefined || end === undefined) {
    return null;
  }
  const length = distance(start, end);
  if (length < minLength || length === 0) {
    return null;
  }
  if (
    backtrack(stroke, start, end, length) > MAX_BACKTRACK_SHARE * length ||
    maxBend(stroke, start, end, length) > MAX_BEND_SHARE * length
  ) {
    return null;
  }
  return { start, end, length };
}

export function distance(first: StrokePoint, second: StrokePoint): number {
  return Math.hypot(second.x - first.x, second.y - first.y);
}

/** Sklon spojnice od vodorovné ve stupních bez ohledu na směr tahu (0 až 90). */
export function tiltDegrees(start: StrokePoint, end: StrokePoint): number {
  return (Math.atan2(Math.abs(end.y - start.y), Math.abs(end.x - start.x)) * 180) / Math.PI;
}

/**
 * Kde se protnou přímky obou úseček, jako část délky každé úsečky od jejího
 * začátku (0 začátek, 1 konec). Rovnoběžné úsečky dají `null`.
 */
export function crossingOf(
  first: Segment,
  second: Segment,
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
  let bend = 0;
  for (const point of stroke) {
    bend = Math.max(bend, distanceFromLine(point, start, end, chord));
  }
  return bend;
}

/** Vzdálenost bodu od přímky přes `start` a `end` (spojnice délky `chord`). */
export function distanceFromLine(
  point: StrokePoint,
  start: StrokePoint,
  end: StrokePoint,
  chord: number,
): number {
  const dx = (end.x - start.x) / chord;
  const dy = (end.y - start.y) / chord;
  return Math.abs((point.x - start.x) * dy - (point.y - start.y) * dx);
}
