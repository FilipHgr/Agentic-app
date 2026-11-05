import { describe, expect, it } from 'vitest';

import { recognizeDigit } from '../src/logic/digitRecognition';
import type { Stroke, StrokePoint } from '../src/logic/digitRecognition';

/**
 * Pojistka k připomínce vlastníka k #41 (devítka poznaná jako 4): úprava,
 * která devítku pozná, ať dítě začne smyčku kdekoli, nesmí začít za devítku
 * brát číslice s podobnou smyčkou. Čtyřka se zavřeným vrškem, nula a šestka
 * se nikdy nepoznají jako 9. Tvary jsou generované z pevných hodnot,
 * žádná náhoda. Plocha 320 × 320, osa y míří dolů.
 */

const AREA = { width: 320, height: 320 };

/** Krok mezi body oblouků ve stupních (Phaser posílá body hustě). */
const ARC_STEP_DEGREES = 5;

/** Kolik bodů má rovný úsek (hustě jako z Phaseru). */
const LINE_POINTS = 30;

/** Rovná čára z `from` do `to`, `points` bodů včetně konců. */
function line(from: StrokePoint, to: StrokePoint, points = LINE_POINTS): StrokePoint[] {
  return Array.from({ length: points }, (_, index) => {
    const t = index / (points - 1);
    return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
  });
}

/** Lomená čára přes všechny body, bez zdvojených bodů v rozích. */
function polyline(corners: readonly StrokePoint[]): StrokePoint[] {
  const points: StrokePoint[] = [];
  for (let index = 1; index < corners.length; index += 1) {
    const segment = line(corners[index - 1] as StrokePoint, corners[index] as StrokePoint);
    points.push(...(index === 1 ? segment : segment.slice(1)));
  }
  return points;
}

interface Ellipse {
  readonly center: StrokePoint;
  readonly radiusX: number;
  readonly radiusY: number;
}

/** Bod elipsy pro úhel ve stupních. 0° vpravo, 90° nahoře (osa y dolů, proto minus). */
function ellipsePoint(ellipse: Ellipse, angleDegrees: number): StrokePoint {
  const angle = (angleDegrees * Math.PI) / 180;
  return {
    x: ellipse.center.x + ellipse.radiusX * Math.cos(angle),
    y: ellipse.center.y - ellipse.radiusY * Math.sin(angle),
  };
}

/** Oblouk od úhlu `from` o `sweep` stupňů (kladný = proti směru hodinových ručiček). */
function arc(ellipse: Ellipse, from: number, sweep: number): StrokePoint[] {
  const steps = Math.max(1, Math.round(Math.abs(sweep) / ARC_STEP_DEGREES));
  return Array.from({ length: steps + 1 }, (_, index) =>
    ellipsePoint(ellipse, from + (sweep * index) / steps),
  );
}

/** Kvadratická křivka z `from` do `to` přitažená k `control`. */
function curve(from: StrokePoint, control: StrokePoint, to: StrokePoint): StrokePoint[] {
  return Array.from({ length: LINE_POINTS }, (_, index) => {
    const t = index / (LINE_POINTS - 1);
    const a = (1 - t) * (1 - t);
    const b = 2 * (1 - t) * t;
    const c = t * t;
    return {
      x: a * from.x + b * control.x + c * to.x,
      y: a * from.y + b * control.y + c * to.y,
    };
  });
}

interface WrittenDigit {
  readonly description: string;
  readonly strokes: Stroke[];
}

/** Popisy zápisů, které hra poznala jako 9 (ostatní výsledky jsou v pořádku). */
function recognizedAsNine(digits: readonly WrittenDigit[]): string[] {
  return digits
    .filter((digit) => recognizeDigit(digit.strokes, AREA) === 9)
    .map((digit) => digit.description);
}

/** Popisy zápisů, které hra nepoznala jako `expected` (s tím, co poznala). */
function notRecognizedAs(expected: number, digits: readonly WrittenDigit[]): string[] {
  return digits.flatMap((digit) => {
    const recognized = recognizeDigit(digit.strokes, AREA);
    return recognized === expected ? [] : [`${digit.description}: ${String(recognized)}`];
  });
}

function expectInsideArea(digits: readonly WrittenDigit[]): void {
  for (const point of digits.flatMap((digit) => digit.strokes.flat())) {
    expect(point.x).toBeGreaterThanOrEqual(0);
    expect(point.x).toBeLessThanOrEqual(AREA.width);
    expect(point.y).toBeGreaterThanOrEqual(0);
    expect(point.y).toBeLessThanOrEqual(AREA.height);
  }
}

// --- Čtyřka se zavřeným vrškem -------------------------------------------
// Šikmá čára z vršku dlouhé svislice doleva dolů, vodorovná přes svislici
// doprava. Šikmá čára a svislice se nahoře potkají, vršek je zavřený
// trojúhelník, podobně jako smyčka devítky.

const FOUR_TOP: StrokePoint = { x: 205, y: 20 };
const FOUR_BOTTOM: StrokePoint = { x: 205, y: 300 };
const FOUR_LEFT: StrokePoint = { x: 70, y: 195 };
const FOUR_CROSS_END: StrokePoint = { x: 265, y: 195 };
const FOUR_CROSS_AT_STEM: StrokePoint = { x: FOUR_TOP.x, y: FOUR_LEFT.y };

const FOURS_ONE_STROKE: WrittenDigit[] = [
  {
    description: 'zdola nahoru po svislici, šikmo doleva dolů, vodorovně doprava',
    strokes: [polyline([FOUR_BOTTOM, FOUR_TOP, FOUR_LEFT, FOUR_CROSS_END])],
  },
  {
    description: 'šikmo z vršku doleva dolů, vodorovně ke svislici, nahoru a celou svislici dolů',
    strokes: [polyline([FOUR_TOP, FOUR_LEFT, FOUR_CROSS_AT_STEM, FOUR_TOP, FOUR_BOTTOM])],
  },
];

const FOURS_TWO_STROKES: WrittenDigit[] = [
  {
    description: 'nejdřív šikmá a vodorovná, pak svislice shora dolů',
    strokes: [polyline([FOUR_TOP, FOUR_LEFT, FOUR_CROSS_END]), line(FOUR_TOP, FOUR_BOTTOM)],
  },
  {
    description: 'nejdřív svislice shora dolů, pak šikmá a vodorovná',
    strokes: [line(FOUR_TOP, FOUR_BOTTOM), polyline([FOUR_TOP, FOUR_LEFT, FOUR_CROSS_END])],
  },
];

// --- Nula ----------------------------------------------------------------
// Vysoký ovál přes skoro celou plochu, začátek nahoře (90°).

const ZERO_OVAL: Ellipse = { center: { x: 160, y: 160 }, radiusX: 90, radiusY: 135 };
const ZERO_START_ANGLE = 90;

type Direction = 'po směru' | 'proti směru';
const DIRECTIONS: Direction[] = ['po směru', 'proti směru'];

/** Proti směru hodinových ručiček úhel roste, po směru klesá. */
function directionSign(direction: Direction): number {
  return direction === 'proti směru' ? 1 : -1;
}

/** Celý ovál (360°) a ovál s přetahem přes začátek (400°), oběma směry. */
const ZEROS: WrittenDigit[] = DIRECTIONS.flatMap((direction) =>
  [360, 400].map((sweep) => ({
    description: `začátek nahoře, ${direction}, ${sweep}°`,
    strokes: [arc(ZERO_OVAL, ZERO_START_ANGLE, directionSign(direction) * sweep)],
  })),
);

// --- Šestka --------------------------------------------------------------
// Začátek nahoře vpravo, oblouk po levé straně dolů a dole smyčka:
// dolů, doprava, nahoru, zpátky doleva (proti směru hodinových ručiček).

const SIX_LOOP: Ellipse = { center: { x: 165, y: 228 }, radiusX: 75, radiusY: 68 };
const SIX_LOOP_LEFT_ANGLE = 180;

/** Šestka jedním tahem; `loopSweep` říká, jak moc se smyčka dole uzavře. */
function six(start: StrokePoint, control: StrokePoint, loopSweep: number): Stroke[] {
  const loopStart = ellipsePoint(SIX_LOOP, SIX_LOOP_LEFT_ANGLE);
  const descent = curve(start, control, loopStart);
  return [[...descent, ...arc(SIX_LOOP, SIX_LOOP_LEFT_ANGLE, loopSweep).slice(1)]];
}

const SIXES: WrittenDigit[] = [
  {
    description: 'začátek nahoře vpravo, smyčka dole uzavřená',
    strokes: six({ x: 215, y: 20 }, { x: 95, y: 40 }, 360),
  },
  {
    description: 'začátek nahoře vpravo, smyčka dole s přetahem',
    strokes: six({ x: 215, y: 20 }, { x: 95, y: 40 }, 390),
  },
  {
    description: 'začátek nahoře vpravo, smyčka dole skoro uzavřená',
    strokes: six({ x: 215, y: 20 }, { x: 95, y: 40 }, 330),
  },
  {
    description: 'začátek nahoře uprostřed, strmý oblouk, smyčka dole uzavřená',
    strokes: six({ x: 170, y: 15 }, { x: 100, y: 70 }, 360),
  },
];

describe('#41 připomínka: číslice s podobnou smyčkou hra nevezme za devítku', () => {
  it('generované čtyřky, nuly a šestky leží v ploše na psaní', () => {
    expectInsideArea([...FOURS_ONE_STROKE, ...FOURS_TWO_STROKES, ...ZEROS, ...SIXES]);
  });

  it('čtyřku se zavřeným vrškem napsanou jedním tahem hra nikdy nepozná jako 9', () => {
    expect(recognizedAsNine(FOURS_ONE_STROKE)).toEqual([]);
  });

  it('čtyřku se zavřeným vrškem napsanou dvěma tahy hra nikdy nepozná jako 9', () => {
    expect(recognizedAsNine(FOURS_TWO_STROKES)).toEqual([]);
  });

  // Přesná číslice jen u zápisů, které ji na současném rozpoznávání dávají.
  // Ostatní čtyřky smí hra i odmítnout, jen ne vzít za devítku.
  it('čtyřku se zavřeným vrškem začatou šikmou čarou z vršku hra pozná jako 4', () => {
    const startingWithDiagonal = [FOURS_ONE_STROKE[1], FOURS_TWO_STROKES[0]].filter(
      (digit): digit is WrittenDigit => digit !== undefined,
    );
    expect(startingWithDiagonal).toHaveLength(2);
    expect(notRecognizedAs(4, startingWithDiagonal)).toEqual([]);
  });

  it('nulu začatou nahoře hra nikdy nepozná jako 9, oběma směry i s přetahem', () => {
    expect(recognizedAsNine(ZEROS)).toEqual([]);
  });

  it('nulu začatou nahoře hra pozná jako 0, oběma směry i s přetahem', () => {
    expect(ZEROS).toHaveLength(4);
    expect(notRecognizedAs(0, ZEROS)).toEqual([]);
  });

  it('šestku začatou nahoře se smyčkou dole hra nikdy nepozná jako 9', () => {
    expect(recognizedAsNine(SIXES)).toEqual([]);
  });
});

describe('#41: tah přes okraj plochy na psaní', () => {
  /** Výsledek rozpoznání smí být jen číslice 0–9 nebo odmítnutí. */
  function expectDigitOrRejection(strokes: readonly Stroke[]): void {
    const recognized = recognizeDigit(strokes, AREA);
    if (recognized !== null) {
      expect(Number.isInteger(recognized)).toBe(true);
      expect(recognized).toBeGreaterThanOrEqual(0);
      expect(recognized).toBeLessThanOrEqual(9);
    }
  }

  const OVER_EDGE_WRITINGS: WrittenDigit[] = [
    {
      description: 'vodorovná čára přes levý i pravý okraj',
      strokes: [line({ x: -60, y: 160 }, { x: 390, y: 160 })],
    },
    {
      description: 'sedmička, jejíž noha ujede pod spodní okraj',
      strokes: [
        polyline([
          { x: 60, y: 30 },
          { x: 260, y: 30 },
          { x: 150, y: 420 },
        ]),
      ],
    },
    {
      description: 'nula, která přeteče přes horní a levý okraj',
      strokes: [arc({ center: { x: 100, y: 120 }, radiusX: 140, radiusY: 160 }, 90, 360)],
    },
    {
      description: 'druhý tah celý mimo plochu',
      strokes: [
        line({ x: 160, y: 40 }, { x: 160, y: 280 }),
        line({ x: 400, y: -50 }, { x: 500, y: -80 }),
      ],
    },
  ];

  it('tah, který přejede přes okraj plochy, nezpůsobí chybu a výsledek je číslice nebo odmítnutí', () => {
    for (const writing of OVER_EDGE_WRITINGS) {
      expect(() => recognizeDigit(writing.strokes, AREA), writing.description).not.toThrow();
      expectDigitOrRejection(writing.strokes);
    }
  });
});
