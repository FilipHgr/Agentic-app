import { describe, expect, it } from 'vitest';

import type { AnswerRound } from '../src/logic/answerRound';
import { recognizeDigit } from '../src/logic/digitRecognition';
import type { Stroke, WritingAreaSize } from '../src/logic/digitRecognition';
import { layoutWritingScreen } from '../src/logic/screenLayout';
import { STARS_PER_SET } from '../src/logic/stars';
import {
  createTwoBoxRound,
  finishBoxStroke,
  shownNumber,
  startBoxStroke,
  updateBoxes,
} from '../src/logic/twoBoxWriting';
import type { TwoBoxRound, WritingBox } from '../src/logic/twoBoxWriting';
import { RECOGNITION_DELAY_MS } from '../src/logic/writingRound';

import { placeStroke, uciTestSamples } from './penDigits';
import type { PenDigitSample } from './penDigits';

/**
 * Testy k #42, AC6 (hra pozná dvouciferné číslo) a AC3 (dvě číslice v jednom
 * okénku nedají dvouciferné číslo). Používá se jen testovací část sady UCI
 * (`pendigits.tes`). Každá číslice se zvětší do okénka stejně velkého jako
 * ve hře a projde celou cestou: tah do okénka, 1 s čekání, složené číslo.
 * Odmítnutí zápisu je chyba.
 */

/** AC6: aspoň 80 % všech dvouciferných čísel správně. */
const MIN_TWO_DIGIT_TOTAL = 0.8;

/** AC6: každé číslo 10–20 zvlášť aspoň 70 %. */
const MIN_TWO_DIGIT_EACH = 0.7;

/** AC6 (z #41): jednociferný zápis aspoň 90 % celkem. */
const MIN_ONE_DIGIT_TOTAL = 0.9;

/** AC6 (z #41): každá číslice zvlášť aspoň 80 %. */
const MIN_ONE_DIGIT_EACH = 0.8;

/** Rozpoznání celé sady trvá déle než běžný test. */
const SLOW_TEST_TIMEOUT_MS = 120_000;

const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

const TWO_DIGIT_NUMBERS = Array.from({ length: 11 }, (_, index) => 10 + index);

/** Okénko jednotek při rozsahu 20 na iPadu na šířku: stejná velikost jako ve hře. */
function gameBoxArea(): WritingAreaSize {
  const layout = layoutWritingScreen(1024, 768, 20, STARS_PER_SET);
  const ones = layout.writingAreas[1];
  expect(ones).toBeDefined();
  return { width: ones?.width ?? 0, height: ones?.height ?? 0 };
}

/** Kolo s příkladem, na jehož výsledku nezáleží: měří se jen ukázané číslo. */
function emptyRound(area: WritingAreaSize): TwoBoxRound {
  const answer: AnswerRound = {
    problem: { first: 10, second: 0, operation: 'plus', result: 10 },
    maxNumber: 20,
    wrongAnswers: 0,
    solved: false,
  };
  return createTwoBoxRound(answer, area);
}

/** Dítě položí prst do okénka v `startMs`, napíše tah a za 300 ms prst zvedne. */
function writeStroke(
  round: TwoBoxRound,
  box: WritingBox,
  stroke: Stroke,
  startMs: number,
): TwoBoxRound {
  return finishBoxStroke(startBoxStroke(round, box, startMs), stroke, startMs + 300);
}

/** Číslo, které hra ukáže po napsání `tens` vlevo a `ones` vpravo (`null` = prázdné). */
function numberWritten(
  area: WritingAreaSize,
  tens: Stroke | null,
  ones: Stroke | null,
): number | null {
  let round = emptyRound(area);
  if (tens) {
    round = writeStroke(round, 'tens', tens, 0);
  }
  if (ones) {
    round = writeStroke(round, 'ones', ones, 400);
  }
  return shownNumber(updateBoxes(round, 700 + RECOGNITION_DELAY_MS));
}

function samplesOf(samples: readonly PenDigitSample[], digit: number): PenDigitSample[] {
  return samples.filter((sample) => sample.digit === digit);
}

/**
 * Dvojice podle AC6: k-tá desítková číslice s k-tou jednotkovou (v pořadí
 * souboru), počet do menšího z obou počtů. U 11 je to stejný vzorek dvakrát.
 */
function pairsFor(samples: readonly PenDigitSample[], value: number): [Stroke, Stroke][] {
  const tens = samplesOf(samples, Math.floor(value / 10));
  const ones = samplesOf(samples, value % 10);
  const count = Math.min(tens.length, ones.length);
  return Array.from({ length: count }, (_, k) => [tens[k]?.stroke ?? [], ones[k]?.stroke ?? []]);
}

interface Measurement {
  readonly total: number;
  readonly byValue: ReadonlyMap<number, number>;
}

function measureTwoDigits(area: WritingAreaSize): Measurement {
  const samples = uciTestSamples(area);
  const byValue = new Map<number, number>();
  let correct = 0;
  let attempts = 0;

  for (const value of TWO_DIGIT_NUMBERS) {
    const pairs = pairsFor(samples, value);
    const valueCorrect = pairs.filter(
      ([tens, ones]) => numberWritten(area, tens, ones) === value,
    ).length;
    byValue.set(value, valueCorrect / pairs.length);
    correct += valueCorrect;
    attempts += pairs.length;
  }

  return { total: correct / attempts, byValue };
}

function measureOneDigit(area: WritingAreaSize): Measurement {
  const samples = uciTestSamples(area);
  const byValue = new Map<number, number>();
  let correct = 0;

  for (const digit of DIGITS) {
    const ofDigit = samplesOf(samples, digit);
    const digitCorrect = ofDigit.filter(
      (sample) => numberWritten(area, null, sample.stroke) === digit,
    ).length;
    byValue.set(digit, digitCorrect / ofDigit.length);
    correct += digitCorrect;
  }

  return { total: correct / samples.length, byValue };
}

/** Čísla pod hranicí i s podílem (pro čitelnou chybu testu). */
function valuesBelow(measurement: Measurement, minimum: number): Record<number, number> {
  const below: Record<number, number> = {};
  for (const [value, share] of measurement.byValue) {
    if (share < minimum) {
      below[value] = Math.round(share * 1000) / 1000;
    }
  }
  return below;
}

function isSingleDigitOrNothing(value: number | null): boolean {
  return value === null || (Number.isInteger(value) && value >= 0 && value <= 9);
}

describe('testovací data pro dvouciferná čísla odpovídají zadání', () => {
  it('okénko ve hře má aspoň 280 × 280 px', () => {
    const area = gameBoxArea();

    expect(area.width).toBeGreaterThanOrEqual(280);
    expect(area.height).toBeGreaterThanOrEqual(280);
  });

  it('pro každé číslo 10–20 jsou ze sady stovky dvojic, u 11 stejný vzorek dvakrát', () => {
    const samples = uciTestSamples(gameBoxArea());

    for (const value of TWO_DIGIT_NUMBERS) {
      expect(pairsFor(samples, value).length).toBeGreaterThan(300);
    }
    for (const [tens, ones] of pairsFor(samples, 11)) {
      expect(ones).toBe(tens);
    }
    const twenty = pairsFor(samples, 20).length;
    expect(twenty).toBe(Math.min(samplesOf(samples, 2).length, samplesOf(samples, 0).length));
  });
});

describe('AC6: hra pozná dvouciferné číslo napsané do dvou okének', () => {
  it(
    'čísla 10–20 od 14 nových pisatelů pozná celkem aspoň v 80 % a každé aspoň v 70 %',
    () => {
      const measurement = measureTwoDigits(gameBoxArea());

      expect(measurement.total).toBeGreaterThanOrEqual(MIN_TWO_DIGIT_TOTAL);
      expect(valuesBelow(measurement, MIN_TWO_DIGIT_EACH)).toEqual({});
    },
    SLOW_TEST_TIMEOUT_MS,
  );

  it(
    'jednu číslici v okénku jednotek pozná dál aspoň v 90 % a každou aspoň v 80 %',
    () => {
      const measurement = measureOneDigit(gameBoxArea());

      expect(measurement.total).toBeGreaterThanOrEqual(MIN_ONE_DIGIT_TOTAL);
      expect(valuesBelow(measurement, MIN_ONE_DIGIT_EACH)).toEqual({});
    },
    SLOW_TEST_TIMEOUT_MS,
  );
});

describe('AC3: dvě číslice v jednom okénku nikdy nedají dvouciferné číslo', () => {
  const pairs: [number, number][] = [
    [1, 2],
    [1, 0],
    [1, 5],
    [1, 1],
    [2, 0],
    [1, 9],
    [7, 4],
  ];

  it('dvě číslice ze sady zmenšené do okénka jednotek dají jednu číslici, nebo nic', () => {
    const area = gameBoxArea();
    const samples = uciTestSamples(area);
    const half = area.width / 2;

    for (const [left, right] of pairs) {
      const lefts = samplesOf(samples, left).slice(0, 10);
      const rights = samplesOf(samples, right).slice(0, 10);
      lefts.forEach((leftSample, index) => {
        const rightSample = rights[index];
        expect(rightSample).toBeDefined();
        const leftStroke = placeStroke(leftSample.stroke, 0.5, 0, half / 2);
        const rightStroke = placeStroke(rightSample?.stroke ?? [], 0.5, half, half / 2);

        // Rozpoznávání okénka dostane oba tahy najednou.
        expect(isSingleDigitOrNothing(recognizeDigit([leftStroke, rightStroke], area))).toBe(true);

        // Celou cestou ve hře: oba tahy do okénka jednotek, desítky prázdné.
        let round = writeStroke(emptyRound(area), 'ones', leftStroke, 0);
        round = writeStroke(round, 'ones', rightStroke, 400);
        const shown = shownNumber(updateBoxes(round, 700 + RECOGNITION_DELAY_MS));
        expect(isSingleDigitOrNothing(shown)).toBe(true);
      });
    }
  });
});
