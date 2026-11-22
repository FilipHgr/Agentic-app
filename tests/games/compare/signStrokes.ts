/// <reference types="vite/client" />
/**
 * Vlastní sada tahů pro rozpoznávání + a − (#188 AC3). Tahy jsou ručně
 * popsané tvary (čára, kříž, kruh, číslice) a k nim dětská nepřesnost:
 * náklon, vlnka, chvění prstu, háček na konci, nestejně rychlý tah, různá
 * délka a místo v okénku. Náhoda má pevný seed, takže sada je pokaždé
 * stejná. Jako další záporné vzorky slouží číslice z veřejné sady UCI
 * (`data/pendigits/pendigits.tes`, CC BY 4.0), každá jako jeden tah.
 */

import testSetText from '../../../data/pendigits/pendigits.tes?raw';
import type { Stroke, StrokePoint, WritingAreaSize } from '../../../src/shared/logic/strokes';
import { seededRandom } from './compareFakes';

/** Okénko na psaní, nejmenší podle #188 AC5 (200 × 200 CSS px). */
export const SIGN_AREA: WritingAreaSize = { width: 200, height: 200 };

/** Okénko iPadu, aby sada prošla i ve větším okénku. */
export const LARGE_SIGN_AREA: WritingAreaSize = { width: 320, height: 320 };

export interface StrokeSample {
  readonly name: string;
  readonly strokes: readonly Stroke[];
  readonly area: WritingAreaSize;
}

type Random = () => number;

function between(random: Random, low: number, high: number): number {
  return low + (high - low) * random();
}

/** Bod uprostřed okénka posunutý o náhodnou část jeho strany. */
function nearCenter(random: Random, area: WritingAreaSize, spread: number): StrokePoint {
  return {
    x: area.width / 2 + between(random, -spread, spread) * area.width,
    y: area.height / 2 + between(random, -spread, spread) * area.height,
  };
}

/** Body tahu přitažené do okénka (prst mimo okénko se přitáhne k okraji jako ve hře). */
function clampToArea(points: readonly StrokePoint[], area: WritingAreaSize): StrokePoint[] {
  return points.map((point) => ({
    x: Math.min(area.width, Math.max(0, point.x)),
    y: Math.min(area.height, Math.max(0, point.y)),
  }));
}

interface LineShape {
  readonly center: StrokePoint;
  readonly length: number;
  /** Směr tahu ve stupních: 0 doprava, 90 dolů, 180 doleva, 270 nahoru. */
  readonly degrees: number;
  /** Výška vlnky jako část délky. */
  readonly wave: number;
  /** Chvění prstu v px. */
  readonly jitter: number;
  /** Háček na konci jako část délky (0 = bez háčku). */
  readonly hook: number;
}

/** Nerovná čára: body nestejně daleko od sebe, vlnka, chvění a háček na konci. */
function wobblyLine(random: Random, shape: LineShape): StrokePoint[] {
  const radians = (shape.degrees * Math.PI) / 180;
  const along = { x: Math.cos(radians), y: Math.sin(radians) };
  const across = { x: -along.y, y: along.x };
  const count = Math.round(between(random, 10, 30));
  const phase = between(random, 0, Math.PI * 2);
  const waves = between(random, 0.5, 2);
  const points: StrokePoint[] = [];
  let progress = 0;
  for (let index = 0; index < count; index += 1) {
    // Tah zrychluje a zpomaluje: kroky nejsou stejně dlouhé.
    progress = index === 0 ? 0 : Math.min(1, progress + between(random, 0.3, 1.7) / (count - 1));
    const offset = (progress - 0.5) * shape.length;
    const side =
      Math.sin(phase + progress * waves * Math.PI * 2) * shape.wave * shape.length +
      between(random, -shape.jitter, shape.jitter);
    points.push({
      x: shape.center.x + along.x * offset + across.x * side,
      y: shape.center.y + along.y * offset + across.y * side,
    });
  }
  const last = points[points.length - 1] as StrokePoint;
  if (shape.hook > 0) {
    // Háček: konec tahu se stočí asi o 60–100° na jednu stranu.
    const turn = radians + (random() < 0.5 ? -1 : 1) * between(random, 1, 1.7);
    const hookLength = shape.hook * shape.length;
    for (let step = 1; step <= 3; step += 1) {
      points.push({
        x: last.x + (Math.cos(turn) * hookLength * step) / 3,
        y: last.y + (Math.sin(turn) * hookLength * step) / 3,
      });
    }
  }
  return points;
}

/** Náhodná dětská nepřesnost čáry v okénku `area`. */
function sloppyLine(
  random: Random,
  area: WritingAreaSize,
  center: StrokePoint,
  degrees: number,
  lengthShare: number,
): StrokePoint[] {
  const side = Math.min(area.width, area.height);
  return clampToArea(
    wobblyLine(random, {
      center,
      length: lengthShare * side,
      degrees,
      wave: between(random, 0, 0.06),
      jitter: between(random, 0, 0.012 * side),
      hook: random() < 0.3 ? between(random, 0.04, 0.1) : 0,
    }),
    area,
  );
}

/** Vodorovná čára zleva doprava nebo zprava doleva, nakloněná nejvýš o `tilt` stupňů. */
function horizontalDegrees(random: Random, tilt: number): number {
  const lean = between(random, -tilt, tilt);
  return random() < 0.8 ? lean : 180 + lean;
}

/** Svislá čára shora dolů nebo zdola nahoru, nakloněná nejvýš o `tilt` stupňů. */
function verticalDegrees(random: Random, tilt: number): number {
  const lean = between(random, -tilt, tilt);
  return random() < 0.8 ? 90 + lean : 270 + lean;
}

/** Mínus: jedna vodorovná čára, krátká (25 %) až skoro přes celé okénko (90 %). */
export function minusSamples(count: number, area = SIGN_AREA, seed = 188001): StrokeSample[] {
  const random = seededRandom(seed);
  return Array.from({ length: count }, (_, index) => {
    const length = between(random, 0.25, 0.9);
    const degrees = horizontalDegrees(random, 25);
    return {
      name: `− č. ${index + 1} (délka ${Math.round(length * 100)} %, směr ${Math.round(degrees)}°)`,
      strokes: [sloppyLine(random, area, nearCenter(random, area, 0.12), degrees, length)],
      area,
    };
  });
}

/**
 * Plus: vodorovná a svislá čára, které se kříží mimo přesný střed;
 * napůl nejdřív vodorovná, napůl nejdřív svislá, čáry nestejně dlouhé.
 */
export function plusSamples(count: number, area = SIGN_AREA, seed = 188002): StrokeSample[] {
  const random = seededRandom(seed);
  const side = Math.min(area.width, area.height);
  return Array.from({ length: count }, (_, index) => {
    const center = nearCenter(random, area, 0.1);
    const horizontalLength = between(random, 0.3, 0.85);
    const verticalLength = between(random, 0.3, 0.85);
    // Kříží se mezi čtvrtinou a třemi čtvrtinami každé čáry.
    const horizontalCenter = {
      x: center.x + between(random, -0.25, 0.25) * horizontalLength * side,
      y: center.y,
    };
    const verticalCenter = {
      x: center.x,
      y: center.y + between(random, -0.25, 0.25) * verticalLength * side,
    };
    const horizontal = sloppyLine(
      random,
      area,
      horizontalCenter,
      horizontalDegrees(random, 20),
      horizontalLength,
    );
    const vertical = sloppyLine(
      random,
      area,
      verticalCenter,
      verticalDegrees(random, 20),
      verticalLength,
    );
    const verticalFirst = index % 2 === 1;
    return {
      name: `+ č. ${index + 1} (${verticalFirst ? 'nejdřív svislá' : 'nejdřív vodorovná'})`,
      strokes: verticalFirst ? [vertical, horizontal] : [horizontal, vertical],
      area,
    };
  });
}

/** Svislá čára (jako jednička), i nakloněná. */
function verticalLineSamples(random: Random, count: number, area: WritingAreaSize): StrokeSample[] {
  return Array.from({ length: count }, (_, index) => ({
    name: `svislá čára č. ${index + 1}`,
    strokes: [
      sloppyLine(
        random,
        area,
        nearCenter(random, area, 0.1),
        verticalDegrees(random, 25),
        between(random, 0.3, 0.9),
      ),
    ],
    area,
  }));
}

/** Kruh nebo ovál, celý nebo skoro celý (nula, písmeno O). */
function circleSamples(random: Random, count: number, area: WritingAreaSize): StrokeSample[] {
  const side = Math.min(area.width, area.height);
  return Array.from({ length: count }, (_, index) => {
    const center = nearCenter(random, area, 0.08);
    const radiusX = between(random, 0.15, 0.4) * side;
    const radiusY = between(random, 0.15, 0.4) * side;
    const startAngle = between(random, 0, Math.PI * 2);
    const sweep = between(random, 1.6, 2.1) * Math.PI;
    const points: StrokePoint[] = [];
    for (let step = 0; step <= 24; step += 1) {
      const angle = startAngle + (sweep * step) / 24;
      points.push({
        x: center.x + Math.cos(angle) * radiusX + between(random, -2, 2),
        y: center.y + Math.sin(angle) * radiusY + between(random, -2, 2),
      });
    }
    return { name: `kruh č. ${index + 1}`, strokes: [clampToArea(points, area)], area };
  });
}

/** Čmáranice: cikcak nebo klubko přes okénko, jedním nebo dvěma tahy. */
function scribbleSamples(random: Random, count: number, area: WritingAreaSize): StrokeSample[] {
  return Array.from({ length: count }, (_, index) => {
    const strokeCount = random() < 0.5 ? 1 : 2;
    const strokes = Array.from({ length: strokeCount }, () => {
      const points: StrokePoint[] = [];
      const turns = Math.round(between(random, 4, 9));
      for (let step = 0; step <= turns; step += 1) {
        points.push({
          x: between(random, 0.15, 0.85) * area.width,
          y: between(random, 0.15, 0.85) * area.height,
        });
      }
      return points;
    });
    return { name: `čmáranice č. ${index + 1}`, strokes, area };
  });
}

/** Tvar z lomených čar v jednotkách okénka 0–1. */
type Shape = readonly (readonly (readonly [number, number])[])[];

/** Číslice a další znaky ručně popsané lomenými čarami (jeden tah = jedna lomená čára). */
const HAND_SHAPES: Readonly<Record<string, Shape>> = {
  '0': [
    [
      [0.5, 0.15],
      [0.3, 0.3],
      [0.28, 0.6],
      [0.45, 0.85],
      [0.65, 0.75],
      [0.7, 0.4],
      [0.55, 0.15],
    ],
  ],
  '1': [
    [
      [0.35, 0.3],
      [0.55, 0.15],
      [0.55, 0.85],
    ],
  ],
  '2': [
    [
      [0.3, 0.3],
      [0.5, 0.15],
      [0.7, 0.3],
      [0.3, 0.85],
      [0.75, 0.85],
    ],
  ],
  '3': [
    [
      [0.3, 0.2],
      [0.65, 0.25],
      [0.45, 0.5],
      [0.7, 0.7],
      [0.3, 0.85],
    ],
  ],
  '4': [
    [
      [0.55, 0.15],
      [0.25, 0.6],
      [0.75, 0.6],
    ],
    [
      [0.6, 0.35],
      [0.6, 0.9],
    ],
  ],
  '5': [
    [
      [0.7, 0.15],
      [0.35, 0.15],
      [0.32, 0.45],
      [0.65, 0.5],
      [0.65, 0.8],
      [0.3, 0.85],
    ],
  ],
  '6': [
    [
      [0.65, 0.15],
      [0.35, 0.45],
      [0.35, 0.8],
      [0.65, 0.8],
      [0.62, 0.55],
      [0.35, 0.55],
    ],
  ],
  '7': [
    [
      [0.25, 0.2],
      [0.75, 0.2],
      [0.4, 0.85],
    ],
  ],
  '8': [
    [
      [0.6, 0.2],
      [0.35, 0.3],
      [0.65, 0.65],
      [0.5, 0.85],
      [0.35, 0.65],
      [0.65, 0.3],
      [0.55, 0.18],
    ],
  ],
  '9': [
    [
      [0.65, 0.3],
      [0.4, 0.2],
      [0.35, 0.4],
      [0.65, 0.4],
      [0.6, 0.85],
    ],
  ],
  '×': [
    [
      [0.25, 0.25],
      [0.75, 0.75],
    ],
    [
      [0.75, 0.25],
      [0.25, 0.75],
    ],
  ],
  '=': [
    [
      [0.25, 0.4],
      [0.75, 0.4],
    ],
    [
      [0.25, 0.6],
      [0.75, 0.6],
    ],
  ],
  T: [
    [
      [0.25, 0.2],
      [0.75, 0.2],
    ],
    [
      [0.5, 0.2],
      [0.5, 0.85],
    ],
  ],
  L: [
    [
      [0.3, 0.15],
      [0.3, 0.8],
    ],
    [
      [0.3, 0.8],
      [0.75, 0.8],
    ],
  ],
  '+ a čárka navíc': [
    [
      [0.2, 0.5],
      [0.8, 0.5],
    ],
    [
      [0.5, 0.2],
      [0.5, 0.8],
    ],
    [
      [0.3, 0.3],
      [0.7, 0.3],
    ],
  ],
};

/** Lomená čára v okénku: zhuštěné body, chvění, posun a malé zvětšení. */
function handShapeSample(
  random: Random,
  name: string,
  shape: Shape,
  area: WritingAreaSize,
): StrokeSample {
  const scale = between(random, 0.8, 1.1);
  const shift = { x: between(random, -0.08, 0.08), y: between(random, -0.08, 0.08) };
  const strokes = shape.map((polyline) => {
    const points: StrokePoint[] = [];
    for (let index = 1; index < polyline.length; index += 1) {
      const [fromX, fromY] = polyline[index - 1] as readonly [number, number];
      const [toX, toY] = polyline[index] as readonly [number, number];
      for (let step = index === 1 ? 0 : 1; step <= 6; step += 1) {
        const t = step / 6;
        const x = 0.5 + (fromX + (toX - fromX) * t - 0.5) * scale + shift.x;
        const y = 0.5 + (fromY + (toY - fromY) * t - 0.5) * scale + shift.y;
        points.push({
          x: x * area.width + between(random, -2, 2),
          y: y * area.height + between(random, -2, 2),
        });
      }
    }
    return clampToArea(points, area);
  });
  return { name, strokes, area };
}

/** Číslice UCI, každá jako jeden tah v okénku `area`. */
function uciDigitSamples(area: WritingAreaSize): StrokeSample[] {
  return testSetText
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '')
    .map((line, index) => {
      const values = line.split(',').map((value) => Number(value.trim()));
      const stroke: StrokePoint[] = [];
      for (let point = 0; point < 16; point += 2) {
        stroke.push({
          x: ((values[point] ?? 0) / 100) * area.width,
          y: ((100 - (values[point + 1] ?? 0)) / 100) * area.height,
        });
      }
      return { name: `číslice UCI ${values[16]} (řádek ${index + 1})`, strokes: [stroke], area };
    });
}

/** Ručně popsané záporné vzorky: svislé čáry, kruhy, čmáranice, číslice, ×, =, T, L. */
export function handNegativeSamples(area = SIGN_AREA, seed = 188003): StrokeSample[] {
  const random = seededRandom(seed);
  const shapes = Object.entries(HAND_SHAPES).flatMap(([name, shape]) =>
    Array.from({ length: 12 }, (_, index) =>
      handShapeSample(random, `${name} č. ${index + 1}`, shape, area),
    ),
  );
  return [
    ...verticalLineSamples(random, 60, area),
    ...circleSamples(random, 60, area),
    ...scribbleSamples(random, 60, area),
    ...shapes,
  ];
}

/** Všechny číslice testovací části sady UCI jako záporné vzorky. */
export function uciNegativeSamples(area = SIGN_AREA): StrokeSample[] {
  return uciDigitSamples(area);
}

/** Ukázkový tah: rovná vodorovná čára přes střed okénka. */
export function straightMinus(area = SIGN_AREA): Stroke {
  return [
    { x: area.width * 0.25, y: area.height * 0.5 },
    { x: area.width * 0.5, y: area.height * 0.5 },
    { x: area.width * 0.75, y: area.height * 0.5 },
  ];
}

/** Ukázkový tah: rovná svislá čára přes střed okénka. */
export function straightVertical(area = SIGN_AREA): Stroke {
  return [
    { x: area.width * 0.5, y: area.height * 0.25 },
    { x: area.width * 0.5, y: area.height * 0.5 },
    { x: area.width * 0.5, y: area.height * 0.75 },
  ];
}

/* ---------- #191: znaménka <, > a = ---------- */

/** Znaménko zobáčku: < má špičku vlevo, > vpravo. */
export type BeakSign = '<' | '>';

interface Beak {
  readonly corner: StrokePoint;
  readonly tips: readonly [StrokePoint, StrokePoint];
}

/**
 * Zobáček v okénku: ramena různě dlouhá (i nestejně, poměr až 1,3), úhel
 * 40–95°, celý znak nakloněný až o 15°, špička vlevo (<) nebo vpravo (>)
 * a celý znak různě velký a různě posunutý.
 */
function randomBeak(random: Random, area: WritingAreaSize, sign: BeakSign): Beak {
  const side = Math.min(area.width, area.height);
  const opening = between(random, 40, 95);
  const tilt = between(random, -15, 15);
  const firstLength = between(random, 0.22, 0.42) * side;
  const secondLength = Math.min(0.5 * side, firstLength * between(random, 0.75, 1.3));
  const axis = (sign === '<' ? 0 : 180) + tilt;
  const center = nearCenter(random, area, 0.08);
  const reach = ((firstLength + secondLength) / 2) * Math.cos((opening * Math.PI) / 360);
  const towardsOpening = sign === '<' ? 1 : -1;
  const corner = { x: center.x - (towardsOpening * reach) / 2, y: center.y };
  const tipAt = (degrees: number, length: number): StrokePoint => ({
    x: corner.x + Math.cos((degrees * Math.PI) / 180) * length,
    y: corner.y + Math.sin((degrees * Math.PI) / 180) * length,
  });
  return {
    corner,
    tips: [tipAt(axis - opening / 2, firstLength), tipAt(axis + opening / 2, secondLength)],
  };
}

/** Nerovná čára od `from` do `to` (chvění, vlnka, nestejně rychlý tah, někdy háček). */
function sloppyStroke(
  random: Random,
  area: WritingAreaSize,
  from: StrokePoint,
  to: StrokePoint,
  hook: boolean,
): StrokePoint[] {
  const side = Math.min(area.width, area.height);
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  return wobblyLine(random, {
    center: { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 },
    length,
    degrees: (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI,
    wave: between(random, 0, 0.04),
    jitter: between(random, 0, 0.01 * side),
    hook: hook && random() < 0.3 ? between(random, 0.04, 0.1) : 0,
  });
}

/** Zobáček jedním tahem, od horního nebo od dolního ramena. */
function oneStrokeBeak(random: Random, area: WritingAreaSize, beak: Beak, reversed: boolean) {
  const [first, second] = reversed ? [beak.tips[1], beak.tips[0]] : beak.tips;
  const toCorner = sloppyStroke(random, area, first, beak.corner, false);
  const fromCorner = sloppyStroke(random, area, beak.corner, second, true);
  return clampToArea([...toCorner, ...fromCorner.slice(1)], area);
}

/**
 * Zobáček dvěma tahy: každé rameno zvlášť, od špičky nebo ke špičce,
 * a ve špičce se čáry potkají nepřesně (mezera nebo přetažení).
 */
function twoStrokeBeak(random: Random, area: WritingAreaSize, beak: Beak): StrokePoint[][] {
  const side = Math.min(area.width, area.height);
  const near = (): StrokePoint => ({
    x: beak.corner.x + between(random, -0.04, 0.04) * side,
    y: beak.corner.y + between(random, -0.04, 0.04) * side,
  });
  return beak.tips.map((tip) => {
    const corner = near();
    const outwards = random() < 0.5;
    return clampToArea(
      outwards
        ? sloppyStroke(random, area, corner, tip, true)
        : sloppyStroke(random, area, tip, corner, true),
      area,
    );
  });
}

/**
 * < nebo >: nakloněné, nerovné, různě velké; 3/4 jedním tahem (napůl
 * shora, napůl zdola), 1/4 dvěma tahy.
 */
export function beakSamples(
  sign: BeakSign,
  count: number,
  area = SIGN_AREA,
  seed = sign === '<' ? 191001 : 191002,
): StrokeSample[] {
  const random = seededRandom(seed);
  return Array.from({ length: count }, (_, index) => {
    const beak = randomBeak(random, area, sign);
    if (index % 4 === 3) {
      return {
        name: `${sign} č. ${index + 1} (dvěma tahy)`,
        strokes: twoStrokeBeak(random, area, beak),
        area,
      };
    }
    const fromBottom = index % 2 === 1;
    return {
      name: `${sign} č. ${index + 1} (jedním tahem ${fromBottom ? 'zdola' : 'shora'})`,
      strokes: [oneStrokeBeak(random, area, beak, fromBottom)],
      area,
    };
  });
}

/**
 * =: dvě nerovné vodorovné čáry nad sebou, nestejně dlouhé, posunuté,
 * nakloněné (až 12° a každá ještě trochu jinak), napsané zleva i zprava,
 * napůl nejdřív horní, napůl nejdřív dolní.
 */
export function equalsSamples(count: number, area = SIGN_AREA, seed = 191003): StrokeSample[] {
  const random = seededRandom(seed);
  const side = Math.min(area.width, area.height);
  return Array.from({ length: count }, (_, index) => {
    const center = nearCenter(random, area, 0.08);
    const lean = between(random, -12, 12);
    const gap = between(random, 0.12, 0.3) * side;
    const topLength = between(random, 0.3, 0.75);
    const bottomLength = Math.min(0.85, topLength * between(random, 0.75, 1.3));
    const line = (y: number, length: number, shift: number) => {
      const degrees = lean + between(random, -5, 5) + (random() < 0.8 ? 0 : 180);
      return sloppyLine(random, area, { x: center.x + shift * side, y }, degrees, length);
    };
    const top = line(center.y - gap / 2, topLength, between(random, -0.06, 0.06));
    const bottom = line(center.y + gap / 2, bottomLength, between(random, -0.06, 0.06));
    const bottomFirst = index % 2 === 1;
    return {
      name: `= č. ${index + 1} (${bottomFirst ? 'nejdřív dolní' : 'nejdřív horní'})`,
      strokes: bottomFirst ? [bottom, top] : [top, bottom],
      area,
    };
  });
}

/** Tvary navíc, které < = > připomínají, ale nejsou jimi. */
const RELATION_LOOKALIKE_SHAPES: Readonly<Record<string, Shape>> = {
  V: [
    [
      [0.25, 0.25],
      [0.5, 0.8],
      [0.75, 0.25],
    ],
  ],
  'V dvěma tahy': [
    [
      [0.25, 0.25],
      [0.5, 0.8],
    ],
    [
      [0.75, 0.25],
      [0.5, 0.8],
    ],
  ],
  'obrácené V': [
    [
      [0.25, 0.8],
      [0.5, 0.25],
      [0.75, 0.8],
    ],
  ],
  'L jedním tahem': [
    [
      [0.3, 0.15],
      [0.3, 0.8],
      [0.75, 0.8],
    ],
  ],
  'obrácené L': [
    [
      [0.25, 0.25],
      [0.7, 0.25],
      [0.7, 0.8],
    ],
  ],
};

/** Tvary z `HAND_SHAPES`, které jsou záporné i u < = > (všechny kromě =). */
function relationHandShapes(): Array<[string, Shape]> {
  return [
    ...Object.entries(HAND_SHAPES).filter(([name]) => name !== '='),
    ...Object.entries(RELATION_LOOKALIKE_SHAPES),
  ];
}

/**
 * Záporné vzorky pro „a ☐ b“ (#191 AC3): číslice, kruhy, čmáranice, ×,
 * svislé čáry, L, V, T a k tomu + a −, které do „a ☐ b“ nepatří.
 */
export function relationNegativeSamples(area = SIGN_AREA, seed = 191004): StrokeSample[] {
  const random = seededRandom(seed);
  const shapes = relationHandShapes().flatMap(([name, shape]) =>
    Array.from({ length: 12 }, (_, index) =>
      handShapeSample(random, `${name} č. ${index + 1}`, shape, area),
    ),
  );
  return [
    ...verticalLineSamples(random, 60, area),
    ...circleSamples(random, 60, area),
    ...scribbleSamples(random, 60, area),
    ...shapes,
    ...minusSamples(40, area, seed + 1),
    ...plusSamples(40, area, seed + 2),
  ];
}

/** Ukázkový zápis: rovné < jedním tahem shora. */
export function straightLess(area = SIGN_AREA): Stroke {
  return [
    { x: area.width * 0.7, y: area.height * 0.25 },
    { x: area.width * 0.3, y: area.height * 0.5 },
    { x: area.width * 0.7, y: area.height * 0.75 },
  ];
}

/** Ukázkový zápis: rovné > jedním tahem shora. */
export function straightGreater(area = SIGN_AREA): Stroke {
  return [
    { x: area.width * 0.3, y: area.height * 0.25 },
    { x: area.width * 0.7, y: area.height * 0.5 },
    { x: area.width * 0.3, y: area.height * 0.75 },
  ];
}

/** Ukázkový zápis: rovné = (horní čára, pak dolní). */
export function straightEquals(area = SIGN_AREA): Stroke[] {
  return [
    [
      { x: area.width * 0.25, y: area.height * 0.4 },
      { x: area.width * 0.75, y: area.height * 0.4 },
    ],
    [
      { x: area.width * 0.25, y: area.height * 0.6 },
      { x: area.width * 0.75, y: area.height * 0.6 },
    ],
  ];
}
