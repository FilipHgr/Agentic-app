/**
 * Rozpoznání znaménka napsaného prstem (#188, #191). Běží jen v zařízení
 * a nepotřebuje žádné vzory: zápis se rozloží na tahy a každý tah se
 * změří (jak je rovný, jak je dlouhý a kterým směrem jde). Rozpozná se
 * jen znaménko, které u druhu příkladu dává smysl (#191 AC2):
 *
 * U „a ☐ b = c“ (+ −):
 * - Jeden zhruba vodorovný rovný tah je −.
 * - Dva rovné tahy, jeden zhruba vodorovný a druhý zhruba svislý, které
 *   se kříží někde uprostřed, jsou + (v jakémkoli pořadí a směru).
 *
 * U „a ☐ b“ (< = >) rozpoznává `relationRecognition.ts`.
 *
 * Cokoli jiného (svislá čára, kruh, čmáranice, číslice, ×, T, L, znaménko
 * druhého druhu) se nerozpozná a okénko vyzve psát znovu. Tahy smí být
 * nakloněné, nerovné, s háčkem na konci, krátké i dlouhé. Malé ťuknutí
 * (tečka) se nepočítá jako tah. Čistý TypeScript bez Phaseru.
 */

import type { Stroke, StrokePoint, WritingAreaSize } from '../../../shared/logic/strokes';
import type { ArithmeticSign, CompareSign, ProblemKind } from './compareProblems';
import {
  DOT_SHARE,
  MAX_TILT_DEGREES,
  MIN_LINE_SHARE,
  crossingOf,
  extent,
  straightSegment,
  tiltDegrees,
} from './signGeometry';
import type { Segment } from './signGeometry';
import { isStartedRelationSign, recognizeRelationSign } from './relationRecognition';

/**
 * Čáry plus se musí křížit: místo křížení leží na každé čáře mezi touto
 * částí a zbytkem do 1 od začátku (T nebo L se nekříží).
 */
const CROSS_MARGIN = 0.1;

/** Kratší čára plus má aspoň tuto část delší (jinak to je čára s čárkou). */
const MIN_LENGTH_RATIO = 0.3;

type LineDirection = 'horizontal' | 'vertical';

/** Rovný vodorovný nebo svislý tah zjednodušený na úsečku. */
interface Line extends Segment {
  readonly direction: LineDirection;
}

/**
 * Rozpozná znaménko v zápisu pro druh příkladu `kind` (výchozí „a ☐ b = c“);
 * `null`, když zápis není žádné znaménko, které do příkladu patří.
 */
export function recognizeSign(
  strokes: readonly Stroke[],
  area: WritingAreaSize,
  kind: ProblemKind = 'arithmetic',
): CompareSign | null {
  const side = Math.min(area.width, area.height);
  const marks = strokes.filter((stroke) => extent(stroke) >= DOT_SHARE * side);
  if (kind === 'relation') {
    return recognizeRelationSign(marks, side);
  }
  return recognizeArithmeticSign(marks, side);
}

/**
 * Je zápis jen nedopsané znaménko, které má čekat na další tah (#191)?
 * Jen u „a ☐ b“: jedna rovná vodorovná nebo šikmá čára (začátek „=“ nebo
 * rameno < či > dvěma tahy). U „a ☐ b = c“ nic nečeká jako v #188.
 */
export function isIncompleteSign(
  strokes: readonly Stroke[],
  area: WritingAreaSize,
  kind: ProblemKind = 'arithmetic',
): boolean {
  if (kind !== 'relation') {
    return false;
  }
  const side = Math.min(area.width, area.height);
  const marks = strokes.filter((stroke) => extent(stroke) >= DOT_SHARE * side);
  return isStartedRelationSign(marks, side);
}

/** + nebo − z tahů bez teček. */
function recognizeArithmeticSign(marks: readonly Stroke[], side: number): ArithmeticSign | null {
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

/** Rovný, dost dlouhý vodorovný nebo svislý tah jako úsečka; jinak `null`. */
function lineOf(stroke: Stroke, side: number): Line | null {
  const segment = straightSegment(stroke, MIN_LINE_SHARE * side);
  if (segment === null) {
    return null;
  }
  const direction = directionOf(segment.start, segment.end);
  return direction === null ? null : { ...segment, direction };
}

/** Vodorovně, svisle, nebo šikmo (`null`) podle sklonu spojnice konců. */
function directionOf(start: StrokePoint, end: StrokePoint): LineDirection | null {
  const degrees = tiltDegrees(start, end);
  if (degrees <= MAX_TILT_DEGREES) {
    return 'horizontal';
  }
  if (degrees >= 90 - MAX_TILT_DEGREES) {
    return 'vertical';
  }
  return null;
}
