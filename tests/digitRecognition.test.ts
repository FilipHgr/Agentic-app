import { describe, expect, it } from 'vitest';

import { recognizeDigit } from '../src/logic/digitRecognition';
import type { Stroke } from '../src/logic/digitRecognition';

import { NOT_DIGITS, SCRIBBLES, SHORT_DASHES, TAPS } from './notDigitStrokes';
import { WRITING_AREA, densify, placeStroke, uciTestSamples } from './penDigits';
import type { PenDigitSample } from './penDigits';

/**
 * Testy k #41 (psaní odpovědi prstem): rozpoznání číslice (AC2) a odmítnutí
 * zápisu, který není číslice (AC5). Měří jen výsledek `recognizeDigit`,
 * ne to, jak rozpoznávání uvnitř funguje.
 */

/** AC2: aspoň 90 % všech číslic správně. */
const MIN_TOTAL_ACCURACY = 0.9;

/** AC2: každá číslice zvlášť aspoň 80 %. */
const MIN_DIGIT_ACCURACY = 0.8;

/** AC5: aspoň 90 % zápisů, které nejsou číslice, se odmítne. */
const MIN_REJECTED_SHARE = 0.9;

/** Rozpoznání celé sady trvá déle než běžný test. */
const SLOW_TEST_TIMEOUT_MS = 60_000;

const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

const SIDE = WRITING_AREA.width;

interface Accuracy {
  readonly total: number;
  readonly byDigit: ReadonlyMap<number, number>;
}

/** Podíl správně rozpoznaných číslic; odmítnutí (`null`) je chyba. */
function measureAccuracy(samples: readonly PenDigitSample[], density = 1): Accuracy {
  const correct = new Map<number, number>();
  const count = new Map<number, number>();

  for (const sample of samples) {
    const stroke = density > 1 ? densify(sample.stroke, density) : sample.stroke;
    const recognized = recognizeDigit([stroke], WRITING_AREA);
    count.set(sample.digit, (count.get(sample.digit) ?? 0) + 1);
    if (recognized === sample.digit) {
      correct.set(sample.digit, (correct.get(sample.digit) ?? 0) + 1);
    }
  }

  const byDigit = new Map<number, number>();
  let correctTotal = 0;
  for (const digit of DIGITS) {
    const digitCorrect = correct.get(digit) ?? 0;
    correctTotal += digitCorrect;
    byDigit.set(digit, digitCorrect / (count.get(digit) ?? 1));
  }

  return { total: correctTotal / samples.length, byDigit };
}

/** Číslice, které nedosáhly hranice, i s podílem (pro čitelnou chybu testu). */
function digitsBelow(accuracy: Accuracy, minimum: number): Record<number, number> {
  const below: Record<number, number> = {};
  for (const [digit, share] of accuracy.byDigit) {
    if (share < minimum) {
      below[digit] = Math.round(share * 1000) / 1000;
    }
  }
  return below;
}

function isSingleDigitOrRejected(value: number | null): boolean {
  return value === null || (Number.isInteger(value) && value >= 0 && value <= 9);
}

// ---------------------------------------------------------------------------
// Pevná sada 30 zápisů, které nejsou číslice (AC5), je v `notDigitStrokes.ts`.
// ---------------------------------------------------------------------------

/** Délka tahu (součet úseků). */
function strokeLength(stroke: Stroke): number {
  let length = 0;
  stroke.forEach((point, index) => {
    const next = stroke[index + 1];
    if (next) {
      length += Math.hypot(next.x - point.x, next.y - point.y);
    }
  });
  return length;
}

/** Kolikrát tah obrátí směr vodorovně, nebo svisle (podle toho, čeho je víc). */
function turnCount(stroke: Stroke): number {
  return Math.max(
    turnsAlong(stroke.map((point) => point.x)),
    turnsAlong(stroke.map((point) => point.y)),
  );
}

/** Kolikrát se řada souřadnic obrátí z růstu na pokles nebo naopak. */
function turnsAlong(values: readonly number[]): number {
  let turns = 0;
  let direction = 0;
  values.forEach((value, index) => {
    const next = values[index + 1];
    if (next === undefined || next === value) {
      return;
    }
    const nextDirection = Math.sign(next - value);
    if (direction !== 0 && nextDirection !== direction) {
      turns += 1;
    }
    direction = nextDirection;
  });
  return turns;
}

function rejectedShare(attempts: readonly Stroke[][]): number {
  const rejected = attempts.filter((strokes) => recognizeDigit(strokes, WRITING_AREA) === null);
  return rejected.length / attempts.length;
}

/** Všechny vzorky dané číslice z testovací sady. */
function samplesOf(samples: readonly PenDigitSample[], digit: number): PenDigitSample[] {
  return samples.filter((sample) => sample.digit === digit);
}

describe('testovací data odpovídají zadání', () => {
  it('testovací část sady UCI má 3 498 číslic a každé číslice je přes 300', () => {
    const samples = uciTestSamples();

    expect(samples).toHaveLength(3498);
    for (const digit of DIGITS) {
      expect(samplesOf(samples, digit).length).toBeGreaterThan(300);
    }
  });

  it('číslice ze sady je jeden tah s 8 body uvnitř plochy na psaní, osa y míří dolů', () => {
    const samples = uciTestSamples();

    for (const sample of samples) {
      expect(sample.stroke).toHaveLength(8);
      for (const point of sample.stroke) {
        expect(point.x).toBeGreaterThanOrEqual(0);
        expect(point.x).toBeLessThanOrEqual(SIDE);
        expect(point.y).toBeGreaterThanOrEqual(0);
        expect(point.y).toBeLessThanOrEqual(SIDE);
      }
    }

    // Jednička se píše shora dolů: v UCI y klesá, na ploše musí růst.
    const firstOne = samplesOf(samples, 1)[0];
    expect(firstOne).toBeDefined();
    const start = firstOne?.stroke[0];
    const end = firstOne?.stroke[7];
    expect((end?.y ?? 0) - (start?.y ?? 0)).toBeGreaterThan(0);
  });

  it('pevná sada má 10 teček, 10 krátkých čárek a 10 čmáranic', () => {
    expect(TAPS).toHaveLength(10);
    expect(SHORT_DASHES).toHaveLength(10);
    expect(SCRIBBLES).toHaveLength(10);
  });

  it('krátké čárky jsou kratší než desetina výšky plochy', () => {
    for (const strokes of SHORT_DASHES) {
      for (const stroke of strokes) {
        expect(strokeLength(stroke)).toBeLessThan(WRITING_AREA.height / 10);
        expect(strokeLength(stroke)).toBeGreaterThan(5);
      }
    }
  });

  it('čmáranice jdou přes celou plochu a mají aspoň 6 obratů', () => {
    for (const strokes of SCRIBBLES) {
      const stroke = strokes[0] ?? [];
      const xs = stroke.map((point) => point.x);
      const ys = stroke.map((point) => point.y);

      expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThanOrEqual(SIDE * 0.85);
      expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThanOrEqual(SIDE * 0.85);
      expect(turnCount(stroke)).toBeGreaterThanOrEqual(6);
    }
  });
});

describe('AC2: hra pozná napsanou číslici', () => {
  it(
    'z číslic 14 nových pisatelů pozná aspoň 90 % správně',
    () => {
      const accuracy = measureAccuracy(uciTestSamples());

      expect(accuracy.total).toBeGreaterThanOrEqual(MIN_TOTAL_ACCURACY);
    },
    SLOW_TEST_TIMEOUT_MS,
  );

  it(
    'každou číslici 0–9 pozná zvlášť aspoň v 80 % případů',
    () => {
      const accuracy = measureAccuracy(uciTestSamples());

      expect(digitsBelow(accuracy, MIN_DIGIT_ACCURACY)).toEqual({});
    },
    SLOW_TEST_TIMEOUT_MS,
  );

  it(
    'pozná číslici i z tahu prstem, který má mnohem víc bodů než 8',
    () => {
      // Phaser posílá body hustě; stejné číslice zhuštěné na 57 bodů.
      const accuracy = measureAccuracy(uciTestSamples(), 8);

      expect(accuracy.total).toBeGreaterThanOrEqual(MIN_TOTAL_ACCURACY);
      expect(digitsBelow(accuracy, MIN_DIGIT_ACCURACY)).toEqual({});
    },
    SLOW_TEST_TIMEOUT_MS,
  );

  it('stejný zápis hra pozná pokaždé stejně', () => {
    const samples = uciTestSamples().slice(0, 200);
    const first = samples.map((sample) => recognizeDigit([sample.stroke], WRITING_AREA));
    const second = samples.map((sample) => recognizeDigit([sample.stroke], WRITING_AREA));

    expect(second).toEqual(first);
  });

  it('rozpoznání nezmění zápis, který dítě napsalo', () => {
    const sample = uciTestSamples()[0];
    expect(sample).toBeDefined();
    const strokes: Stroke[] = [sample?.stroke ?? []];
    const before = JSON.stringify(strokes);

    recognizeDigit(strokes, WRITING_AREA);

    expect(JSON.stringify(strokes)).toBe(before);
  });

  it('výsledek je vždy jedna číslice 0–9, nebo odmítnutí', () => {
    for (const sample of uciTestSamples().slice(0, 500)) {
      expect(isSingleDigitOrRejected(recognizeDigit([sample.stroke], WRITING_AREA))).toBe(true);
    }
  });
});

describe('AC5: hra odmítne zápis, který není číslice', () => {
  it('z 30 teček, krátkých čárek a čmáranic odmítne aspoň 90 %', () => {
    expect(NOT_DIGITS).toHaveLength(30);
    expect(rejectedShare(NOT_DIGITS)).toBeGreaterThanOrEqual(MIN_REJECTED_SHARE);
  });

  it('prázdný zápis odmítne a nespadne', () => {
    expect(recognizeDigit([], WRITING_AREA)).toBeNull();
    expect(recognizeDigit([[]], WRITING_AREA)).toBeNull();
    expect(recognizeDigit([[], []], WRITING_AREA)).toBeNull();
  });

  it('nesmyslné body v zápisu hru neshodí, výsledek je číslice nebo odmítnutí', () => {
    const broken: Stroke[][] = [
      [
        [
          { x: Number.NaN, y: 10 },
          { x: 20, y: Number.NaN },
        ],
      ],
      [
        [
          { x: Number.POSITIVE_INFINITY, y: 0 },
          { x: 0, y: 0 },
        ],
      ],
      [
        [
          { x: -50, y: -50 },
          { x: 500, y: 600 },
        ],
      ],
    ];

    for (const strokes of broken) {
      expect(isSingleDigitOrRejected(recognizeDigit(strokes, WRITING_AREA))).toBe(true);
    }
  });

  it('dvě číslice vedle sebe („12“ a další) nikdy nedají dvouciferné číslo', () => {
    const samples = uciTestSamples();
    const pairs: [number, number][] = [
      [1, 2],
      [1, 0],
      [1, 5],
      [2, 3],
      [7, 4],
      [9, 9],
    ];
    const half = SIDE / 2;

    for (const [left, right] of pairs) {
      const lefts = samplesOf(samples, left).slice(0, 10);
      const rights = samplesOf(samples, right).slice(0, 10);
      lefts.forEach((leftSample, index) => {
        const rightSample = rights[index];
        expect(rightSample).toBeDefined();
        const strokes: Stroke[] = [
          placeStroke(leftSample.stroke, 0.5, 0, half / 2),
          placeStroke(rightSample?.stroke ?? [], 0.5, half, half / 2),
        ];

        expect(isSingleDigitOrRejected(recognizeDigit(strokes, WRITING_AREA))).toBe(true);
      });
    }
  });
});
