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
 * Zápis menší než tato část kratší strany plochy je tečka nebo čárka, ne
 * číslice. Krátká čárka podle zadání je kratší než desetina strany. Kratší
 * strana proto, aby vysoké okénko na telefonu na výšku (#56) nepřestalo
 * brát číslice, které zabírají stejnou část šířky jako ve čtverci.
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

/**
 * Zápis musí znovu potkat svůj začátek nejdřív po 25 % délky. Smyčka může
 * být i celý zápis (nula).
 */
const LOOP_MIN_SHARE = 0.25;

/** Jak blízko musí zápis znovu projít začátkem, aby šlo o uzavřenou smyčku (část velikosti). */
const LOOP_CLOSE_SHARE = 0.2;

/** Kolik různých začátků smyčky se vyzkouší. */
const LOOP_START_VARIANTS = 8;

/** Na kolik bodů se zápis zhustí, než se v něm hledá smyčka. */
const LOOP_SEARCH_POINTS = 64;

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
 * Podoba, ve které dítě číslici napsalo: normálně, opačným směrem (odspodu,
 * od konce tahu) nebo zrcadlově zleva doprava (#85). Zrcadlový a zároveň
 * obrácený zápis je zrcadlový. Smyčka nuly nebo devítky psaná na druhou
 * stranu je pořád normální zápis.
 */
export type WritingForm = 'normal' | 'reversed' | 'mirrored';

/** Rozpoznaná číslice a podoba zápisu, ve které se poznala. */
export interface RecognizedDigit {
  readonly digit: number;
  readonly form: WritingForm;
}

/**
 * Vzdálenost zrcadlového zápisu od vzorů se násobí tímto číslem. Normální
 * podoba tak má přednost (#85, AC3): zrcadlení vyhraje, jen když je
 * podobnost výrazně lepší, a normálně napsaná 2 se nezmění v 5.
 */
const MIRRORED_DISTANCE_FACTOR = 1.5;

/**
 * Obrácená nebo zrcadlová podoba se bere, jen když je nejbližší vzor
 * blíž než tohle (u zrcadlení po vynásobení `MIRRORED_DISTANCE_FACTOR`),
 * tedy přísněji než `MAX_TEMPLATE_DISTANCE`. Jinak by se
 * číslice, které hra v normální podobě nezná, začaly plést: čtyřka se
 * zavřeným vrškem napsaná od konce vypadá jako devítka
 * (tests/games/counting/notNineRecognition.test.ts).
 */
const MAX_OTHER_FORM_DISTANCE = 3000;

/**
 * Pozná napsanou číslici 0–9. Vrátí `null`, když zápis není číslice
 * (tečka, čárka, čmáranice, prázdný zápis). Vstup nemění.
 */
export function recognizeDigit(strokes: readonly Stroke[], area: WritingAreaSize): number | null {
  return recognizeDigitWithForm(strokes, area)?.digit ?? null;
}

/**
 * Pozná napsanou číslici i podobu, ve které ji dítě napsalo (normálně,
 * odspodu nebo zrcadlově). Vrátí `null`, když zápis není číslice. Vstup nemění.
 */
export function recognizeDigitWithForm(
  strokes: readonly Stroke[],
  area: WritingAreaSize,
): RecognizedDigit | null {
  const points = usablePoints(strokes);
  if (points.length === 0) {
    return null;
  }

  const bounds = boundsOf(points);
  const size = Math.max(bounds.width, bounds.height);
  if (!(size >= Math.min(area.width, area.height) * MIN_SIZE_SHARE)) {
    return null;
  }

  if (directionTurns(points, size) > MAX_DIRECTION_TURNS) {
    return null;
  }

  if (bounds.width < bounds.height * ONE_WIDTH_SHARE) {
    return { digit: 1, form: 'normal' };
  }

  // Vyhraje podoba, jejíž nejbližší vzor je nejpodobnější. Při shodě
  // vyhraje dřívější, proto je normální podoba první.
  const best = writtenForms(points, bounds)
    .map((written) => nearestInForm(written, bounds, size))
    .filter((candidate) => candidate.form === 'normal' || isConvincing(candidate.nearest))
    .reduce((winner, candidate) =>
      closestDistance(candidate.nearest) < closestDistance(winner.nearest) ? candidate : winner,
    );
  const digit = digitByVote(best.nearest);
  return digit === null ? null : { digit, form: best.form };
}

interface FormPoints {
  readonly form: WritingForm;
  readonly points: readonly StrokePoint[];
  /** Kolikrát se vzdálenost od vzorů zvětší (přednost normální podoby). */
  readonly distanceFactor: number;
}

/**
 * Zápis v podobách, které se zkoušejí: tak, jak ho dítě napsalo, obrácený
 * (dítě psalo od konce) a zrcadlený zleva doprava v rámečku zápisu, také
 * obrácený. Obrácení a zrcadlení vrátí zápis do podoby, jak se číslice píše.
 */
function writtenForms(points: readonly StrokePoint[], bounds: Bounds): FormPoints[] {
  const reversed = [...points].reverse();
  return [
    { form: 'normal', points, distanceFactor: 1 },
    { form: 'reversed', points: reversed, distanceFactor: 1 },
    {
      form: 'mirrored',
      points: mirrored(points, bounds),
      distanceFactor: MIRRORED_DISTANCE_FACTOR,
    },
    {
      form: 'mirrored',
      points: mirrored(reversed, bounds),
      distanceFactor: MIRRORED_DISTANCE_FACTOR,
    },
  ];
}

/** Zápis zrcadlený zleva doprava uvnitř svého rámečku. */
function mirrored(points: readonly StrokePoint[], bounds: Bounds): StrokePoint[] {
  const axis = 2 * bounds.left + bounds.width;
  return points.map((point) => ({ x: axis - point.x, y: point.y }));
}

interface FormNeighbours {
  readonly form: WritingForm;
  readonly nearest: Neighbour[];
}

/**
 * Nejpodobnější vzory pro jednu podobu zápisu. Smyčku na začátku zápisu
 * (devítka, nula) jde začít psát kdekoli, zkusí se proto i jiné začátky
 * smyčky a vyhraje nejpodobnější z nich.
 */
function nearestInForm(written: FormPoints, bounds: Bounds, size: number): FormNeighbours {
  const variants = loopStartVariants(resample(written.points, LOOP_SEARCH_POINTS), size).map(
    (variant) =>
      nearestTemplates(normalize(resample(variant, SAMPLE_POINTS), bounds)).map((neighbour) => ({
        digit: neighbour.digit,
        distance: neighbour.distance * written.distanceFactor,
      })),
  );
  const nearest = variants.reduce((winner, candidate) =>
    closestDistance(candidate) < closestDistance(winner) ? candidate : winner,
  );
  return { form: written.form, nearest };
}

/** Obrácená nebo zrcadlová podoba je dost podobná vzoru, aby se vzala. */
function isConvincing(nearest: readonly Neighbour[]): boolean {
  return closestDistance(nearest) <= MAX_OTHER_FORM_DISTANCE;
}

/** Vzdálenost nejbližšího vzoru; bez vzorů nekonečno. */
function closestDistance(nearest: readonly Neighbour[]): number {
  return nearest[0]?.distance ?? Infinity;
}

/**
 * Zápis tak, jak ho dítě napsalo, a když začíná uzavřenou smyčkou, tak
 * i podoby, ve kterých smyčka začíná jinde (zbytek zápisu zůstane stejný).
 */
function loopStartVariants(points: readonly StrokePoint[], size: number): StrokePoint[][] {
  const closing = loopClosingIndex(points, size);
  if (closing === undefined) {
    return [[...points]];
  }

  const loop = points.slice(0, closing);
  // Zbytek zápisu (u devítky noha) zůstává, jak ho dítě napsalo, i když
  // smyčka v nové podobě končí jinde. Vzory devítky to snesou, ověřuje to
  // tests/games/counting/nineRecognition.test.ts.
  const rest = points.slice(closing);
  // Smyčku jde psát i opačným směrem, proto i obrácené podoby.
  const reversed = [...loop].reverse();
  const variants: StrokePoint[][] = [[...points]];
  for (let variant = 0; variant < LOOP_START_VARIANTS; variant += 1) {
    const start = Math.round((loop.length * variant) / LOOP_START_VARIANTS);
    if (variant > 0) {
      variants.push([...loop.slice(start), ...loop.slice(0, start), ...rest]);
    }
    variants.push([...reversed.slice(start), ...reversed.slice(0, start), ...rest]);
  }
  return variants;
}

/** Index bodu, kde se zápis vrátí ke svému začátku; `undefined`, když smyčku nemá. */
function loopClosingIndex(points: readonly StrokePoint[], size: number): number | undefined {
  const lengths = cumulativeLengths(points);
  const total = lengths[lengths.length - 1] ?? 0;
  const start = points[0];
  if (!start || total <= 0) {
    return undefined;
  }

  let closest: number | undefined;
  let closestDistance = size * LOOP_CLOSE_SHARE;
  points.forEach((point, index) => {
    const share = (lengths[index] ?? 0) / total;
    const gap = Math.hypot(point.x - start.x, point.y - start.y);
    if (share >= LOOP_MIN_SHARE && gap < closestDistance) {
      closest = index;
      closestDistance = gap;
    }
  });
  return closest;
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
  const distances = cumulativeLengths(points);
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

/** Délka zápisu od začátku po každý bod. */
function cumulativeLengths(points: readonly StrokePoint[]): number[] {
  const lengths = [0];
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1] as StrokePoint;
    const point = points[index] as StrokePoint;
    lengths.push(
      (lengths[index - 1] ?? 0) + Math.hypot(point.x - previous.x, point.y - previous.y),
    );
  }
  return lengths;
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

/**
 * Součet čtverců rozdílů dvou zápisů. Jakmile součet dosáhne `limit`,
 * počítání skončí (vzor už mezi nejbližší nepatří), takže výsledek je pak
 * aspoň `limit`. Zrychlí to rozpoznávání, které zkouší víc podob zápisu.
 */
function distance(a: readonly number[], b: readonly number[], limit = Infinity): number {
  let sum = 0;
  for (let index = 0; index < a.length && sum < limit; index += 1) {
    const difference = (a[index] ?? 0) - (b[index] ?? 0);
    sum += difference * difference;
  }
  return sum;
}

interface Neighbour {
  readonly digit: number;
  readonly distance: number;
}

/** Nejpodobnější vzory, seřazené od nejbližšího. */
function nearestTemplates(sample: readonly number[]): Neighbour[] {
  const nearest: Neighbour[] = [];
  for (const template of templates()) {
    const limit = nearest.length < NEIGHBOURS ? Infinity : (nearest[NEIGHBOURS - 1]?.distance ?? 0);
    const templateDistance = distance(sample, template.values, limit);
    if (templateDistance < limit) {
      nearest.push({ digit: template.digit, distance: templateDistance });
      nearest.sort((a, b) => a.distance - b.distance);
      nearest.length = Math.min(nearest.length, NEIGHBOURS);
    }
  }
  return nearest;
}

/** Číslice podle hlasů nejbližších vzorů; při shodě hlasů rozhodne nejbližší vzor. */
function digitByVote(nearest: readonly Neighbour[]): number | null {
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
