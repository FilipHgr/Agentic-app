/**
 * Rozpoznání jedné číslice napsané prstem (#41). Běží jen v zařízení:
 * zápis se porovná se vzory z veřejné sady UCI (`digitTemplates.ts`)
 * a vyhraje číslice nejpodobnějších vzorů. Čistý TypeScript bez Phaseru.
 */

import { DIGIT_TEMPLATES } from './digitTemplates';

/** Bod tahu v pixelech plochy na psaní, osa y míří dolů. */
export interface StrokePoint {
  readonly x: number;
  readonly y: number;
}

/** Jeden tah: body od položení prstu po jeho zvednutí. */
export type Stroke = readonly StrokePoint[];

export interface WritingAreaSize {
  readonly width: number;
  readonly height: number;
}

/** Kolik bodů má zápis po převzorkování, stejně jako vzory v sadě UCI. */
const SAMPLE_POINTS = 8;

/** Rozsah souřadnic vzorů. */
const TEMPLATE_RANGE = 100;

/** Kolik nejpodobnějších vzorů hlasuje o výsledku. */
const NEIGHBOURS = 3;

/**
 * Zápis menší než tato část výšky plochy je tečka nebo čárka, ne číslice.
 * Krátká čárka podle zadání je kratší než desetina výšky.
 */
const MIN_SIZE_SHARE = 0.12;

/**
 * Úzký vysoký zápis (šířka pod touto částí výšky) je jednička. Rovnou
 * svislou čáru by roztažení do čtverce 100 × 100 zkreslilo.
 */
const ONE_WIDTH_SHARE = 0.25;

/**
 * Když je i nejpodobnější vzor dál než tohle (součet čtverců rozdílů
 * souřadnic), zápis nepřipomíná žádnou číslici a hra ho odmítne.
 */
const MAX_TEMPLATE_DISTANCE = 9000;

/**
 * Kolikrát smí zápis obrátit směr (vodorovně nebo svisle). Číslice jich má
 * nejvýš pár, čmáranice cikcak přes celou plochu víc.
 */
const MAX_DIRECTION_TURNS = 5;

/** Malé chvění prstu se jako obrat nepočítá (část velikosti zápisu). */
const TURN_TOLERANCE_SHARE = 0.08;

interface Template {
  readonly digit: number;
  readonly values: readonly number[];
}

let decodedTemplates: Template[] | undefined;

/** Vzory se rozbalí jednou, až při prvním rozpoznání. */
function templates(): Template[] {
  if (!decodedTemplates) {
    decodedTemplates = DIGIT_TEMPLATES.flatMap((list, digit) =>
      list.map((encoded) => ({ digit, values: evenlySpaced(decodeTemplate(encoded)) })),
    );
  }
  return decodedTemplates;
}

/** Vzor je 16 čísel 0–100, každé jako dva šestnáctkové znaky. */
function decodeTemplate(encoded: string): number[] {
  const values: number[] = [];
  for (let index = 0; index < encoded.length; index += 2) {
    values.push(Number.parseInt(encoded.slice(index, index + 2), 16));
  }
  return values;
}

/**
 * Pozná napsanou číslici 0–9. Vrátí `null`, když zápis není číslice
 * (tečka, čárka, čmáranice, prázdný zápis). Vstup nemění.
 */
export function recognizeDigit(strokes: readonly Stroke[], area: WritingAreaSize): number | null {
  const points = usablePoints(strokes);
  if (points.length === 0) {
    return null;
  }

  const bounds = boundsOf(points);
  const size = Math.max(bounds.width, bounds.height);
  if (!(size >= area.height * MIN_SIZE_SHARE)) {
    return null;
  }

  if (directionTurns(points, size) > MAX_DIRECTION_TURNS) {
    return null;
  }

  if (bounds.width < bounds.height * ONE_WIDTH_SHARE) {
    return 1;
  }

  const sample = normalize(resample(points, SAMPLE_POINTS), bounds);
  return closestDigit(sample);
}

/** Všechny body všech tahů za sebou, bez nesmyslných souřadnic. */
function usablePoints(strokes: readonly Stroke[]): StrokePoint[] {
  return strokes.flatMap((stroke) =>
    stroke.filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y)),
  );
}

interface Bounds {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

function boundsOf(points: readonly StrokePoint[]): Bounds {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const left = Math.min(...xs);
  const top = Math.min(...ys);
  return { left, top, width: Math.max(...xs) - left, height: Math.max(...ys) - top };
}

/** Kolikrát zápis obrátí směr, vodorovně nebo svisle (víc z obou). */
function directionTurns(points: readonly StrokePoint[], size: number): number {
  const tolerance = size * TURN_TOLERANCE_SHARE;
  return Math.max(
    turnsAlong(
      points.map((point) => point.x),
      tolerance,
    ),
    turnsAlong(
      points.map((point) => point.y),
      tolerance,
    ),
  );
}

/** Obraty v řadě souřadnic; pohyb menší než `tolerance` se nepočítá. */
function turnsAlong(values: readonly number[], tolerance: number): number {
  let turns = 0;
  let direction = 0;
  let anchor = values[0] ?? 0;
  for (const value of values) {
    const change = value - anchor;
    if (Math.abs(change) < tolerance) {
      continue;
    }
    const nextDirection = Math.sign(change);
    if (direction !== 0 && nextDirection !== direction) {
      turns += 1;
    }
    direction = nextDirection;
    anchor = value;
  }
  return turns;
}

/** Rozmístí `count` bodů rovnoměrně po délce celého zápisu. */
function resample(points: readonly StrokePoint[], count: number): StrokePoint[] {
  const distances = [0];
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1] as StrokePoint;
    const point = points[index] as StrokePoint;
    distances.push(
      (distances[index - 1] ?? 0) + Math.hypot(point.x - previous.x, point.y - previous.y),
    );
  }
  const total = distances[distances.length - 1] ?? 0;

  const result: StrokePoint[] = [];
  let segment = 1;
  for (let step = 0; step < count; step += 1) {
    const target = (total * step) / (count - 1);
    while (segment < points.length - 1 && (distances[segment] ?? 0) < target) {
      segment += 1;
    }
    result.push(pointAtDistance(points, distances, segment, target));
  }
  return result;
}

/** Bod ve vzdálenosti `target` od začátku, na úseku končícím bodem `segment`. */
function pointAtDistance(
  points: readonly StrokePoint[],
  distances: readonly number[],
  segment: number,
  target: number,
): StrokePoint {
  const end = points[Math.min(segment, points.length - 1)] as StrokePoint;
  const start = points[Math.max(segment - 1, 0)] as StrokePoint;
  const startDistance = distances[Math.max(segment - 1, 0)] ?? 0;
  const length = (distances[segment] ?? startDistance) - startDistance;
  const t = length > 0 ? Math.min(Math.max((target - startDistance) / length, 0), 1) : 0;
  return { x: start.x + (end.x - start.x) * t, y: start.y + (end.y - start.y) * t };
}

/**
 * Převede body na souřadnice vzorů: každá osa zvlášť 0–100 jako v sadě UCI,
 * osa y obrácená (ve vzorech míří nahoru).
 */
function normalize(points: readonly StrokePoint[], bounds: Bounds): number[] {
  const scaleX = bounds.width > 0 ? TEMPLATE_RANGE / bounds.width : 0;
  const scaleY = bounds.height > 0 ? TEMPLATE_RANGE / bounds.height : 0;
  return points.flatMap((point) => [
    (point.x - bounds.left) * scaleX,
    TEMPLATE_RANGE - (point.y - bounds.top) * scaleY,
  ]);
}

/**
 * Rozmístí 8 bodů vzoru rovnoměrně po lomené čáře mezi nimi, stejně jako
 * `resample` rozmístí body zápisu po tahu prstem. Zápis a vzory se tak
 * porovnávají ve stejném tvaru.
 */
function evenlySpaced(values: readonly number[]): number[] {
  const points: StrokePoint[] = [];
  for (let index = 0; index + 1 < values.length; index += 2) {
    points.push({ x: values[index] ?? 0, y: values[index + 1] ?? 0 });
  }
  return resample(points, SAMPLE_POINTS).flatMap((point) => [point.x, point.y]);
}

/** Součet čtverců rozdílů dvou zápisů. */
function distance(a: readonly number[], b: readonly number[]): number {
  let sum = 0;
  for (let index = 0; index < a.length; index += 1) {
    const difference = (a[index] ?? 0) - (b[index] ?? 0);
    sum += difference * difference;
  }
  return sum;
}

/** Číslice nejpodobnějších vzorů; při shodě hlasů rozhodne nejbližší vzor. */
function closestDigit(sample: readonly number[]): number | null {
  const nearest: { digit: number; distance: number }[] = [];
  for (const template of templates()) {
    const templateDistance = distance(sample, template.values);
    if (
      nearest.length < NEIGHBOURS ||
      templateDistance < (nearest[NEIGHBOURS - 1]?.distance ?? 0)
    ) {
      nearest.push({ digit: template.digit, distance: templateDistance });
      nearest.sort((a, b) => a.distance - b.distance);
      nearest.length = Math.min(nearest.length, NEIGHBOURS);
    }
  }

  const best = nearest[0];
  if (!best || best.distance > MAX_TEMPLATE_DISTANCE) {
    return null;
  }

  const votes = new Map<number, number>();
  for (const neighbour of nearest) {
    votes.set(neighbour.digit, (votes.get(neighbour.digit) ?? 0) + 1);
  }
  // `nearest` je seřazený od nejbližšího, takže při shodě hlasů vyhraje dřívější.
  let winner = best.digit;
  for (const neighbour of nearest) {
    if ((votes.get(neighbour.digit) ?? 0) > (votes.get(winner) ?? 0)) {
      winner = neighbour.digit;
    }
  }
  return winner;
}
