/**
 * Rozpoznání znaménka <, > nebo = napsaného prstem do „a ☐ b“ (#191 AC2).
 * Běží jen v zařízení a nepotřebuje žádné vzory:
 *
 * - < je zobáček se špičkou vlevo, > se špičkou vpravo: jeden tah se
 *   zlomem (v obou směrech), nebo dvě rovné čáry, které se ve špičce
 *   setkají. Obě ramena jsou rovná, podobně dlouhá, svírají ostrý až
 *   mírně tupý úhel a zobáček se otevírá zhruba vodorovně.
 * - = jsou dva zhruba vodorovné, zhruba rovnoběžné rovné tahy nad sebou
 *   (v jakémkoli pořadí a směru), které se nekříží.
 *
 * Jen tyto tři znaménka: + a − se tady neberou. L (otevírá se šikmo),
 * V (otevírá se nahoru), 7, kruh, čmáranice nebo × se nerozpoznají.
 * Čistý TypeScript bez Phaseru.
 */

import type { Stroke, StrokePoint } from '../../../shared/logic/strokes';
import type { RelationSign } from './compareProblems';
import {
  MAX_TILT_DEGREES,
  MIN_LINE_SHARE,
  crossingOf,
  distance,
  distanceFromLine,
  straightSegment,
  tiltDegrees,
} from './signGeometry';
import type { Segment } from './signGeometry';

/** Rameno zobáčku musí být dlouhé aspoň tuto část kratší strany okénka. */
const MIN_ARM_SHARE = MIN_LINE_SHARE;

/** Kratší rameno zobáčku má aspoň tuto část delšího. */
const MIN_ARM_RATIO = 0.4;

/** Úhel mezi rameny zobáčku ve stupních: ne skoro rovná čára, ne skoro přímý úhel. */
const MIN_OPENING_DEGREES = 25;
const MAX_OPENING_DEGREES = 120;

/**
 * Zobáček se otevírá zhruba vodorovně: osa úhlu smí být nakloněná nejvýš
 * o tolik stupňů (L má 45°, V 90°, sedmička asi 30°).
 */
const MAX_OPENING_TILT_DEGREES = 26;

/**
 * Dvě čáry zobáčku se setkají ve špičce: nejbližší konce jsou od sebe
 * nejvýš tuto část kratší čáry.
 */
const MAX_JOIN_SHARE = 0.5;

/** Čáry „=“ jsou zhruba rovnoběžné: rozdíl sklonu nejvýš tolik stupňů. */
const MAX_EQUALS_ANGLE_DIFFERENCE = 20;

/** Kratší čára „=“ má aspoň tuto část delší. */
const MIN_EQUALS_LENGTH_RATIO = 0.4;

/** Čáry „=“ leží nad sebou: vodorovně se překrývají aspoň touto částí kratší čáry. */
const MIN_EQUALS_OVERLAP = 0.5;

/** Mezera mezi čarami „=“ jako část delší čáry: ne jedna čára přes druhou, ne daleko od sebe. */
const MIN_EQUALS_GAP_SHARE = 0.08;
const MAX_EQUALS_GAP_SHARE = 1;

/** Čáry „=“ jsou od sebe aspoň tuto část kratší strany okénka (ne jedna čára obtažená dvakrát). */
const MIN_EQUALS_GAP_SIDE_SHARE = 0.04;

/**
 * Rozpozná <, = nebo > v tazích bez teček (`side` je kratší strana
 * okénka); `null`, když zápis žádné z nich není.
 */
export function recognizeRelationSign(marks: readonly Stroke[], side: number): RelationSign | null {
  if (marks.length === 1) {
    return beakOfOneStroke(marks[0] as Stroke, side);
  }
  if (marks.length !== 2) {
    return null;
  }
  const first = straightSegment(marks[0] as Stroke, MIN_LINE_SHARE * side);
  const second = straightSegment(marks[1] as Stroke, MIN_LINE_SHARE * side);
  if (first === null || second === null) {
    return null;
  }
  if (isEquals(first, second, side)) {
    return '=';
  }
  return beakOfTwoLines(first, second);
}

/** Zobáček jedním tahem: zlom je bod nejdál od spojnice konců, ramena z něj jsou rovná. */
function beakOfOneStroke(stroke: Stroke, side: number): RelationSign | null {
  const start = stroke[0];
  const end = stroke[stroke.length - 1];
  if (start === undefined || end === undefined || stroke.length < 3) {
    return null;
  }
  const cornerIndex = farthestFromChord(stroke, start, end);
  const firstArm = straightSegment(stroke.slice(0, cornerIndex + 1), MIN_ARM_SHARE * side);
  const secondArm = straightSegment(stroke.slice(cornerIndex), MIN_ARM_SHARE * side);
  if (firstArm === null || secondArm === null) {
    return null;
  }
  return beakSign(stroke[cornerIndex] as StrokePoint, start, end);
}

/** Index bodu tahu nejdál od spojnice konců (u uzavřeného tahu nejdál od začátku). */
function farthestFromChord(stroke: Stroke, start: StrokePoint, end: StrokePoint): number {
  const chord = distance(start, end);
  let best = 0;
  let bestDistance = -1;
  for (const [index, point] of stroke.entries()) {
    const away = chord > 0 ? distanceFromLine(point, start, end, chord) : distance(point, start);
    if (away > bestDistance) {
      best = index;
      bestDistance = away;
    }
  }
  return best;
}

/** Zobáček dvěma rovnými čarami, které se ve špičce setkají (v jakémkoli pořadí a směru). */
function beakOfTwoLines(first: Segment, second: Segment): RelationSign | null {
  const pairs: ReadonlyArray<readonly [StrokePoint, StrokePoint, StrokePoint, StrokePoint]> = [
    [first.start, second.start, first.end, second.end],
    [first.start, second.end, first.end, second.start],
    [first.end, second.start, first.start, second.end],
    [first.end, second.end, first.start, second.start],
  ];
  const [joinA, joinB, tipA, tipB] = pairs.reduce((best, pair) =>
    distance(pair[0], pair[1]) < distance(best[0], best[1]) ? pair : best,
  );
  if (distance(joinA, joinB) > MAX_JOIN_SHARE * Math.min(first.length, second.length)) {
    return null;
  }
  const corner = { x: (joinA.x + joinB.x) / 2, y: (joinA.y + joinB.y) / 2 };
  return beakSign(corner, tipA, tipB);
}

/**
 * Znaménko zobáčku se špičkou `corner` a konci ramen `tipA`, `tipB`:
 * < otevřený doprava, > doleva; jiný tvar `null`.
 */
function beakSign(corner: StrokePoint, tipA: StrokePoint, tipB: StrokePoint): RelationSign | null {
  const armA = { x: tipA.x - corner.x, y: tipA.y - corner.y };
  const armB = { x: tipB.x - corner.x, y: tipB.y - corner.y };
  const lengthA = Math.hypot(armA.x, armA.y);
  const lengthB = Math.hypot(armB.x, armB.y);
  if (lengthA === 0 || lengthB === 0) {
    return null;
  }
  if (Math.min(lengthA, lengthB) < MIN_ARM_RATIO * Math.max(lengthA, lengthB)) {
    return null;
  }
  const cosine = (armA.x * armB.x + armA.y * armB.y) / (lengthA * lengthB);
  const opening = (Math.acos(Math.max(-1, Math.min(1, cosine))) * 180) / Math.PI;
  if (opening < MIN_OPENING_DEGREES || opening > MAX_OPENING_DEGREES) {
    return null;
  }
  // Osa úhlu: součet jednotkových směrů obou ramen.
  const axis = { x: armA.x / lengthA + armB.x / lengthB, y: armA.y / lengthA + armB.y / lengthB };
  if (tiltDegrees({ x: 0, y: 0 }, axis) > MAX_OPENING_TILT_DEGREES) {
    return null;
  }
  return axis.x > 0 ? '<' : '>';
}

/** Jsou dvě rovné čáry „=“: vodorovné, rovnoběžné, podobně dlouhé, nad sebou a nekříží se? */
function isEquals(first: Segment, second: Segment, side: number): boolean {
  const firstTilt = signedTilt(first);
  const secondTilt = signedTilt(second);
  if (Math.abs(firstTilt) > MAX_TILT_DEGREES || Math.abs(secondTilt) > MAX_TILT_DEGREES) {
    return false;
  }
  if (Math.abs(firstTilt - secondTilt) > MAX_EQUALS_ANGLE_DIFFERENCE) {
    return false;
  }
  const shorter = Math.min(first.length, second.length);
  const longer = Math.max(first.length, second.length);
  if (shorter < MIN_EQUALS_LENGTH_RATIO * longer) {
    return false;
  }
  if (
    horizontalOverlap(first, second) <
    MIN_EQUALS_OVERLAP * Math.min(width(first), width(second))
  ) {
    return false;
  }
  const gap = Math.abs(middleY(first) - middleY(second));
  if (
    gap < Math.max(MIN_EQUALS_GAP_SHARE * longer, MIN_EQUALS_GAP_SIDE_SHARE * side) ||
    gap > MAX_EQUALS_GAP_SHARE * longer
  ) {
    return false;
  }
  const crossing = crossingOf(first, second);
  const crosses =
    crossing !== null &&
    crossing.alongFirst >= 0 &&
    crossing.alongFirst <= 1 &&
    crossing.alongSecond >= 0 &&
    crossing.alongSecond <= 1;
  return !crosses;
}

/** Sklon čáry ve stupních (−90 až 90) bez ohledu na to, kterým směrem byla napsaná. */
function signedTilt(segment: Segment): number {
  const left = segment.start.x <= segment.end.x ? segment.start : segment.end;
  const right = left === segment.start ? segment.end : segment.start;
  return (Math.atan2(right.y - left.y, right.x - left.x) * 180) / Math.PI;
}

function width(segment: Segment): number {
  return Math.abs(segment.end.x - segment.start.x);
}

function middleY(segment: Segment): number {
  return (segment.start.y + segment.end.y) / 2;
}

/** Jak dlouho se čáry překrývají ve vodorovném směru. */
function horizontalOverlap(first: Segment, second: Segment): number {
  const left = Math.max(
    Math.min(first.start.x, first.end.x),
    Math.min(second.start.x, second.end.x),
  );
  const right = Math.min(
    Math.max(first.start.x, first.end.x),
    Math.max(second.start.x, second.end.x),
  );
  return Math.max(0, right - left);
}

/**
 * Nejvíc takhle nakloněná rovná čára je začátek „=“ nebo jedno rameno
 * zobáčku dvěma tahy; svislejší čára (jako jednička) nic z < = > nezačíná.
 */
const MAX_STARTED_SIGN_TILT_DEGREES = 45;

/**
 * Je zápis jen nedopsané < = > (#191)? Jedna rovná, zhruba vodorovná nebo
 * šikmá čára je první čára „=“ nebo první rameno < či >: v okénku zůstane
 * a čeká na druhý tah, i když dítě mezi tahy dlouho přemýšlí.
 */
export function isStartedRelationSign(marks: readonly Stroke[], side: number): boolean {
  if (marks.length !== 1) {
    return false;
  }
  const line = straightSegment(marks[0] as Stroke, MIN_LINE_SHARE * side);
  return line !== null && tiltDegrees(line.start, line.end) <= MAX_STARTED_SIGN_TILT_DEGREES;
}
