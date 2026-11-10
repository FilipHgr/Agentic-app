/**
 * Zápisy číslic v podobách z #85: tak, jak se číslice píše, odspodu (opačným
 * směrem, od konce tahu), zrcadlově zleva doprava a zrcadlově i odspodu.
 * Pomocné funkce a pevné tvary pro testy, žádná náhoda.
 */

import type {
  Stroke,
  StrokePoint,
  WritingAreaSize,
} from '../../../src/games/counting/logic/digitRecognition';

/** Plocha na psaní, do které se kreslí pevné tvary (stejná jako u sady UCI). */
export const FORM_AREA: WritingAreaSize = { width: 320, height: 320 };

/** Podoba, ve které dítě číslici napsalo (jen pro popis případů v testech). */
export type WrittenForm = 'normálně' | 'odspodu' | 'zrcadlově' | 'zrcadlově a odspodu';

export const WRITTEN_FORMS: readonly WrittenForm[] = [
  'normálně',
  'odspodu',
  'zrcadlově',
  'zrcadlově a odspodu',
];

/** Opačný směr: tahy i body v nich od konce. */
export function reversedStrokes(strokes: readonly Stroke[]): Stroke[] {
  return [...strokes].reverse().map((stroke) => [...stroke].reverse());
}

/** Zrcadlení zleva doprava v ploše `area`. */
export function mirroredStrokes(strokes: readonly Stroke[], area: WritingAreaSize): Stroke[] {
  return strokes.map((stroke) => stroke.map((point) => ({ x: area.width - point.x, y: point.y })));
}

/** Zápis `strokes` (napsaný normálně) v podobě `form`. */
export function inForm(
  strokes: readonly Stroke[],
  form: WrittenForm,
  area: WritingAreaSize = FORM_AREA,
): Stroke[] {
  switch (form) {
    case 'normálně':
      return strokes.map((stroke) => [...stroke]);
    case 'odspodu':
      return reversedStrokes(strokes);
    case 'zrcadlově':
      return mirroredStrokes(strokes, area);
    case 'zrcadlově a odspodu':
      return reversedStrokes(mirroredStrokes(strokes, area));
  }
}

/** Krok mezi body na čáře a oblouku v pixelech (Phaser posílá body hustě). */
const POINT_STEP = 6;

/** Rovná čára z `from` do `to`, bez bodu `from` (navazuje na předchozí kus). */
function lineTo(from: StrokePoint, to: StrokePoint): StrokePoint[] {
  const steps = Math.max(1, Math.round(Math.hypot(to.x - from.x, to.y - from.y) / POINT_STEP));
  return Array.from({ length: steps }, (_, index) => {
    const t = (index + 1) / steps;
    return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
  });
}

/**
 * Oblouk elipsy se středem `center` od úhlu `from` o `sweep` stupňů.
 * Úhel 0° je vpravo, 90° nahoře; kladný `sweep` jde proti směru hodinových ručiček.
 */
function arc(
  center: StrokePoint,
  radiusX: number,
  radiusY: number,
  from: number,
  sweep: number,
): StrokePoint[] {
  const steps = 36;
  return Array.from({ length: steps + 1 }, (_, index) => {
    const angle = ((from + (sweep * index) / steps) * Math.PI) / 180;
    return { x: center.x + radiusX * Math.cos(angle), y: center.y - radiusY * Math.sin(angle) };
  });
}

/** Lomená čára přes `vertices`. */
function polyline(vertices: readonly StrokePoint[]): StrokePoint[] {
  const [first, ...rest] = vertices;
  if (!first) {
    return [];
  }
  const points: StrokePoint[] = [first];
  for (const vertex of rest) {
    points.push(...lineTo(points[points.length - 1] as StrokePoint, vertex));
  }
  return points;
}

/** Na konec `points` připojí čáru do `to`. */
function continueTo(points: readonly StrokePoint[], to: StrokePoint): StrokePoint[] {
  const last = points[points.length - 1] as StrokePoint;
  return [...points, ...lineTo(last, to)];
}

/** Sedmička jedním tahem: vodorovně zleva doprava, pak šikmo dolů doleva. */
const SEVEN: Stroke = polyline([
  { x: 70, y: 40 },
  { x: 250, y: 40 },
  { x: 130, y: 290 },
]);

/** Dvojka: oblouk nahoře zleva doprava, šikmo dolů doleva a čára dole doprava. */
const TWO: Stroke = continueTo(
  continueTo(arc({ x: 160, y: 110 }, 75, 70, 160, -190), { x: 75, y: 290 }),
  { x: 250, y: 290 },
);

/** Trojka: dva oblouky nad sebou, oba otevřené doleva. */
const THREE: Stroke = [
  ...arc({ x: 160, y: 95 }, 70, 60, 150, -240),
  ...arc({ x: 160, y: 220 }, 80, 70, 90, -240).slice(1),
];

/**
 * Číslice, které vypadají zrcadlově jinak než normálně (jako v zadání
 * otočená 3, 7 nebo 9), napsané jedním tahem tak, jak se píšou. Z nich se dělají obrácené a zrcadlové podoby.
 */
export const ASYMMETRIC_DIGITS: ReadonlyArray<{
  readonly digit: number;
  readonly strokes: Stroke[];
}> = [
  { digit: 2, strokes: [TWO] },
  { digit: 3, strokes: [THREE] },
  { digit: 7, strokes: [SEVEN] },
  { digit: 9, strokes: nineLoop('proti směru') },
];

/** Jednička: svislá čára shora dolů. */
export const ONE: Stroke[] = [
  polyline([
    { x: 160, y: 30 },
    { x: 160, y: 290 },
  ]),
];

type LoopDirection = 'po směru' | 'proti směru';

export const LOOP_DIRECTIONS: readonly LoopDirection[] = ['proti směru', 'po směru'];

function directionSign(direction: LoopDirection): number {
  return direction === 'proti směru' ? 1 : -1;
}

/** Nula: celá smyčka od vršku zpátky na vršek. */
export function zeroLoop(direction: LoopDirection): Stroke[] {
  return [arc({ x: 160, y: 160 }, 90, 130, 90, directionSign(direction) * 360)];
}

/**
 * Devítka jedním tahem: smyčka nahoře začne vpravo, oběhne celá zpátky
 * na pravou stranu a bez zvednutí prstu jde noha dolů. Noha je vpravo,
 * takže to není zrcadlová devítka, ať smyčka jde kterýmkoli směrem.
 */
export function nineLoop(direction: LoopDirection): Stroke[] {
  const loop = arc({ x: 170, y: 95 }, 65, 60, 0, directionSign(direction) * 360);
  return [continueTo(loop, { x: 225, y: 300 })];
}
