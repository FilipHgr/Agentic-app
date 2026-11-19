/**
 * Pevné sady tvarů k #143 (devítka s otevřeným kolečkem nahoře):
 * ukázka vlastníka (AC1), mřížka devítek (AC2) a mřížka sedmiček
 * a jedniček (AC3). Všechno z pevných hodnot zadání, žádná náhoda.
 *
 * Tyto hodnoty (body ukázky, mezery 0–120°, výšky 0,25–1,0, šířky
 * 0,3–0,7, sklony 0° a 10°, rozměry sedmiček a jedniček) jsou jen
 * zkušební. Vzory rozpoznávání se z nich nesmí dělat, jinak by testy
 * měřily jen zapamatování sady.
 */

import type { Stroke, StrokePoint } from '../../../src/games/counting/logic/digitRecognition';

/** Popsaný zápis číslice: jak vznikl a jeho tahy. */
export interface ShapedDigit {
  readonly description: string;
  readonly strokes: Stroke[];
}

/** Rovná čára z `from` do `to`, `points` bodů včetně konců. */
export function line(from: StrokePoint, to: StrokePoint, points: number): StrokePoint[] {
  return Array.from({ length: points }, (_, index) => {
    const t = points === 1 ? 0 : index / (points - 1);
    return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
  });
}

/** Lomená čára přes vrcholy, každý úsek má `points` bodů, rohy bez zdvojení. */
function polyline(corners: readonly StrokePoint[], points: number): StrokePoint[] {
  const result: StrokePoint[] = [];
  for (let index = 1; index < corners.length; index += 1) {
    const segment = line(corners[index - 1] as StrokePoint, corners[index] as StrokePoint, points);
    result.push(...(index === 1 ? segment : segment.slice(1)));
  }
  return result;
}

function radians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

// --- AC1: ukázka vlastníka -----------------------------------------------

/** Okénko, ve kterém vlastník devítku napsal. */
export const SAMPLE_AREA = { width: 335, height: 335 } as const;

/** Pevné body ukázky; oblouk končí bodem (160,190), odkud jde noha. */
const SAMPLE_POINTS: readonly StrokePoint[] = [
  [225, 135],
  [200, 130],
  [160, 135],
  [120, 150],
  [95, 165],
  [90, 185],
  [105, 197],
  [130, 195],
  [160, 190],
  [163, 200],
  [165, 230],
  [168, 260],
  [165, 290],
].map(([x, y]) => ({ x: x as number, y: y as number }));

/** Index bodu (160,190), kde končí oblouk a začíná noha. */
const SAMPLE_ARC_END = 8;

/** Mezi každé dva sousední body se vloží 8 bodů navíc (úsek má 10 bodů). */
const SAMPLE_POINTS_PER_SEGMENT = 10;

/** Devítka z ukázky jedním tahem. */
export function sampleNineOneStroke(): Stroke[] {
  return [polyline(SAMPLE_POINTS, SAMPLE_POINTS_PER_SEGMENT)];
}

/** Devítka z ukázky dvěma tahy: oblouk do (160,190), pak zvlášť noha z něj. */
export function sampleNineTwoStrokes(): Stroke[] {
  return [
    polyline(SAMPLE_POINTS.slice(0, SAMPLE_ARC_END + 1), SAMPLE_POINTS_PER_SEGMENT),
    polyline(SAMPLE_POINTS.slice(SAMPLE_ARC_END), SAMPLE_POINTS_PER_SEGMENT),
  ];
}

/** Ukázka jedním i dvěma tahy s popisem. */
export function sampleNines(): ShapedDigit[] {
  return [
    { description: 'ukázka jedním tahem', strokes: sampleNineOneStroke() },
    { description: 'ukázka dvěma tahy', strokes: sampleNineTwoStrokes() },
  ];
}

// --- AC2: mřížka devítek -------------------------------------------------

/** Plocha mřížek AC2 a AC3. */
export const GRID_AREA = { width: 320, height: 320 } as const;
const SIDE = GRID_AREA.width;

/** Krok mezi body oblouku ve stupních (Phaser posílá body hustě). */
const ARC_STEP_DEGREES = 5;

/** Bodů rovné čáry (noha, spojnice, čáry sedmičky a jedničky). */
const LINE_POINTS = 30;

/** Bodů spojnice z konce oblouku do středu spodku u jednoho tahu. */
const JOIN_POINTS = 10;

export const NINE_GAPS = [0, 30, 60, 90, 120] as const;
export const NINE_HEIGHT_RATIOS = [0.25, 0.35, 0.5, 1.0] as const;
export const NINE_WIDTH_SHARES = [0.3, 0.5, 0.7] as const;
export const NINE_LEG_TILTS = [0, 10] as const;
export type LegStart = 'z konce oblouku' | 'ze středu spodku';
export const NINE_LEG_STARTS: readonly LegStart[] = ['z konce oblouku', 'ze středu spodku'];
export const NINE_STROKE_COUNTS = [1, 2] as const;

/** Oblouk začíná vpravo nahoře na 20°. */
const ARC_START_DEGREES = 20;

export interface GridNine extends ShapedDigit {
  /** Mezera vpravo u začátku ve stupních; 0 = uzavřené kolečko. */
  readonly gap: number;
}

function gridNine(
  gap: number,
  heightRatio: number,
  widthShare: number,
  tilt: number,
  legStart: LegStart,
  strokeCount: number,
): GridNine {
  const radiusX = (widthShare * SIDE) / 2;
  const radiusY = radiusX * heightRatio;
  const centerX = SIDE / 2;
  const centerY = 0.1 * SIDE + radiusY;

  const arc: StrokePoint[] = [];
  const arcEnd = ARC_START_DEGREES + 360 - gap;
  for (let angle = ARC_START_DEGREES; angle <= arcEnd + 1e-6; angle += ARC_STEP_DEGREES) {
    arc.push({
      x: centerX + radiusX * Math.cos(radians(angle)),
      y: centerY - radiusY * Math.sin(radians(angle)),
    });
  }

  const end = arc[arc.length - 1] as StrokePoint;
  const bottomCenter = { x: centerX, y: centerY + radiusY };
  const legTop = legStart === 'z konce oblouku' ? end : bottomCenter;
  const legLength = 0.9 * SIDE - legTop.y;
  const legBottom = { x: legTop.x - legLength * Math.tan(radians(tilt)), y: 0.9 * SIDE };
  const leg = line(legTop, legBottom, LINE_POINTS);

  let strokes: Stroke[];
  if (strokeCount === 2) {
    strokes = [arc, leg];
  } else {
    const join = legStart === 'z konce oblouku' ? [] : line(end, bottomCenter, JOIN_POINTS);
    strokes = [[...arc, ...join.slice(1, -1), ...leg]];
  }

  return {
    gap,
    description:
      `mezera ${gap}°, výška ${heightRatio}, šířka ${widthShare}, sklon ${tilt}°, ` +
      `noha ${legStart}, ${strokeCount} ${strokeCount === 1 ? 'tah' : 'tahy'}`,
    strokes,
  };
}

/** Celá mřížka AC2 (440 devítek), bez kombinace šířka 0,7 a výška 1,0. */
export function gridNines(): GridNine[] {
  const nines: GridNine[] = [];
  for (const gap of NINE_GAPS) {
    for (const heightRatio of NINE_HEIGHT_RATIOS) {
      for (const widthShare of NINE_WIDTH_SHARES) {
        if (widthShare === 0.7 && heightRatio === 1.0) {
          continue;
        }
        for (const tilt of NINE_LEG_TILTS) {
          for (const legStart of NINE_LEG_STARTS) {
            for (const strokeCount of NINE_STROKE_COUNTS) {
              nines.push(gridNine(gap, heightRatio, widthShare, tilt, legStart, strokeCount));
            }
          }
        }
      }
    }
  }
  return nines;
}

// --- AC3: sedmičky -------------------------------------------------------

type SevenHook = 'žádné' | '1/10 svisle' | '1/10 šikmo' | '1/5 svisle' | '1/5 šikmo';
const SEVEN_HOOKS: readonly { name: SevenHook; length: number; angle: number }[] = [
  { name: 'žádné', length: 0, angle: 0 },
  { name: '1/10 svisle', length: 0.1, angle: 0 },
  { name: '1/10 šikmo', length: 0.1, angle: 45 },
  { name: '1/5 svisle', length: 0.2, angle: 0 },
  { name: '1/5 šikmo', length: 0.2, angle: 45 },
];

/** Zaoblení rohu jako část vodorovné čáry (asi 1/8). */
const SEVEN_CORNER_SHARE = 0.12;

function seven(
  hook: (typeof SEVEN_HOOKS)[number],
  crossed: boolean,
  bottomShare: number,
  rounded: boolean,
): ShapedDigit {
  const left = 0.2 * SIDE;
  const right = 0.8 * SIDE;
  const top = 0.15 * SIDE;
  const topWidth = right - left;
  const bottom = { x: bottomShare * SIDE, y: 0.9 * SIDE };

  const main: StrokePoint[] = [];
  if (hook.length > 0) {
    // Zahnutí jde od svého konce dole nahoru k levému začátku čáry.
    const length = hook.length * topWidth;
    const hookStart = {
      x: left + length * Math.sin(radians(hook.angle)),
      y: top + length * Math.cos(radians(hook.angle)),
    };
    main.push(...line(hookStart, { x: left, y: top }, JOIN_POINTS).slice(0, -1));
  }
  if (rounded) {
    const radius = SEVEN_CORNER_SHARE * topWidth;
    main.push(
      ...polyline(
        [
          { x: left, y: top },
          { x: right - radius, y: top },
          { x: right - radius * 0.3, y: top + radius * 0.3 },
          { x: right - radius * 0.15, y: top + radius },
          bottom,
        ],
        LINE_POINTS,
      ),
    );
  } else {
    main.push(...polyline([{ x: left, y: top }, { x: right, y: top }, bottom], LINE_POINTS));
  }

  const strokes: Stroke[] = [main];
  if (crossed) {
    strokes.push(
      line({ x: 0.3 * SIDE, y: 0.5 * SIDE }, { x: 0.7 * SIDE, y: 0.5 * SIDE }, LINE_POINTS),
    );
  }

  return {
    description:
      `zahnutí ${hook.name}, ${crossed ? 'přeškrtnutá' : 'bez přeškrtnutí'}, ` +
      `konec dole na ${bottomShare}, roh ${rounded ? 'zaoblený' : 'ostrý'}`,
    strokes,
  };
}

/** Celá mřížka sedmiček AC3 (40 sedmiček). */
export function gridSevens(): ShapedDigit[] {
  const sevens: ShapedDigit[] = [];
  for (const hook of SEVEN_HOOKS) {
    for (const crossed of [false, true]) {
      for (const bottomShare of [0.3, 0.45]) {
        for (const rounded of [false, true]) {
          sevens.push(seven(hook, crossed, bottomShare, rounded));
        }
      }
    }
  }
  return sevens;
}

// --- AC3: jedničky -------------------------------------------------------

/** Vršek jedničky (trochu vpravo od středu, aby se vešel sklon doleva). */
const ONE_TOP_X_SHARE = 0.55;

const ONE_LEADS: readonly { name: string; length: number; angle: number }[] = [
  { name: '1/6 pod 30°', length: 1 / 6, angle: 30 },
  { name: '1/6 pod 60°', length: 1 / 6, angle: 60 },
  { name: '1/3 pod 30°', length: 1 / 3, angle: 30 },
  { name: '1/3 pod 60°', length: 1 / 3, angle: 60 },
];

function one(
  lead: (typeof ONE_LEADS)[number] | null,
  tilt: number,
  strokeCount: number,
): ShapedDigit {
  const top = { x: ONE_TOP_X_SHARE * SIDE, y: 0.1 * SIDE };
  const height = 0.8 * SIDE;
  const bottom = { x: top.x - height * Math.tan(radians(tilt)), y: 0.9 * SIDE };
  const stem = line(top, bottom, LINE_POINTS);

  if (lead === null) {
    return { description: `bez náběhové čárky, sklon ${tilt}°`, strokes: [stem] };
  }

  // Náběhová čárka jde zleva zdola nahoru k vršku, odklon od svislice.
  const length = lead.length * height;
  const leadStart = {
    x: top.x - length * Math.sin(radians(lead.angle)),
    y: top.y + length * Math.cos(radians(lead.angle)),
  };
  const leadLine = line(leadStart, top, 15);
  const strokes: Stroke[] =
    strokeCount === 1 ? [[...leadLine, ...stem.slice(1)]] : [leadLine, stem];

  return {
    description: `náběhová čárka ${lead.name}, sklon ${tilt}°, ${strokeCount} ${strokeCount === 1 ? 'tah' : 'tahy'}`,
    strokes,
  };
}

/** Celá mřížka jedniček AC3 (18 jedniček). */
export function gridOnes(): ShapedDigit[] {
  const ones: ShapedDigit[] = [];
  for (const tilt of [0, 10]) {
    ones.push(one(null, tilt, 1));
    for (const lead of ONE_LEADS) {
      for (const strokeCount of [1, 2]) {
        ones.push(one(lead, tilt, strokeCount));
      }
    }
  }
  return ones;
}
