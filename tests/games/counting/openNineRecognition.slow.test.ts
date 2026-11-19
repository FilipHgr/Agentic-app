import { describe, expect, it } from 'vitest';

import type { AnswerRound } from '../../../src/games/counting/logic/answerRound';
import { recognizeDigit } from '../../../src/games/counting/logic/digitRecognition';
import type { Stroke, WritingAreaSize } from '../../../src/games/counting/logic/digitRecognition';
import { layoutWritingScreen } from '../../../src/games/counting/logic/screenLayout';
import { STARS_PER_SET } from '../../../src/games/counting/logic/stars';
import {
  createTwoBoxRound,
  finishBoxStroke,
  shownNumber,
  startBoxStroke,
  updateBoxes,
} from '../../../src/games/counting/logic/twoBoxWriting';
import type { TwoBoxRound, WritingBox } from '../../../src/games/counting/logic/twoBoxWriting';
import { RECOGNITION_DELAY_MS } from '../../../src/games/counting/logic/writingRound';

import { GRID_AREA, NINE_GAPS, SAMPLE_AREA, gridNines, line, sampleNines } from './openNineShapes';
import type { GridNine } from './openNineShapes';
import { WRITING_AREA, densify, uciTestSamples } from './penDigits';

/**
 * Pomalé testy k #143 (skupina `test:recognition`): mřížka 440 devítek
 * (AC2), testovací část sady UCI (AC4) a devítka z ukázky ve vysokém
 * okénku a ve dvou okénkách (AC5). Tvary jsou v `openNineShapes.ts`,
 * z pevných hodnot zadání, žádná náhoda.
 */

/** Rozpoznání celé sady trvá déle než běžný test. */
const SLOW_TEST_TIMEOUT_MS = 120_000;

// --- AC2 -----------------------------------------------------------------

/** AC2: otevřené devítky celkem aspoň 90 %. */
const MIN_OPEN_SHARE = 0.9;

/** AC2: při každé mezeře aspoň 80 %. */
const MIN_OPEN_SHARE_PER_GAP = 0.8;

/** AC2: uzavřené devítky (mezera 0°) dnes 64 z 88, nesmí se zhoršit. */
const CLOSED_NINES_TODAY = 64;

interface GridResult {
  readonly nine: GridNine;
  readonly recognized: number | null;
}

function recognizeGrid(): GridResult[] {
  return gridNines().map((nine) => ({ nine, recognized: recognizeDigit(nine.strokes, GRID_AREA) }));
}

function ninesAmong(results: readonly GridResult[]): number {
  return results.filter((result) => result.recognized === 9).length;
}

/** Popisy nepoznaných devítek pro čitelnou chybu testu (nejvýš 20). */
function missed(results: readonly GridResult[]): string {
  return results
    .filter((result) => result.recognized !== 9)
    .slice(0, 20)
    .map((result) => `${result.nine.description}: ${String(result.recognized)}`)
    .join('\n');
}

describe('AC2: pevnou sadu otevřených devítek hra pozná jako 9', () => {
  it(
    'otevřené devítky z mřížky hra pozná jako 9 aspoň v 90 % případů',
    () => {
      const open = recognizeGrid().filter((result) => result.nine.gap > 0);

      expect(open).toHaveLength(352);
      expect(ninesAmong(open), missed(open)).toBeGreaterThanOrEqual(
        Math.ceil(MIN_OPEN_SHARE * open.length),
      );
    },
    SLOW_TEST_TIMEOUT_MS,
  );

  it(
    'při každé velikosti mezery (30°, 60°, 90°, 120°) hra pozná otevřenou devítku aspoň v 80 % případů',
    () => {
      const results = recognizeGrid();
      const gapsBelow: Record<string, string> = {};

      for (const gap of NINE_GAPS.filter((value) => value > 0)) {
        const withGap = results.filter((result) => result.nine.gap === gap);
        expect(withGap, `mezera ${gap}°`).toHaveLength(88);
        const recognized = ninesAmong(withGap);
        if (recognized < Math.ceil(MIN_OPEN_SHARE_PER_GAP * withGap.length)) {
          gapsBelow[`${gap}°`] = `${recognized} z ${withGap.length}`;
        }
      }

      expect(gapsBelow).toEqual({});
    },
    SLOW_TEST_TIMEOUT_MS,
  );

  it(
    'uzavřené devítky z mřížky hra pozná aspoň tak dobře jako dnes (64 z 88)',
    () => {
      const closed = recognizeGrid().filter((result) => result.nine.gap === 0);

      expect(closed).toHaveLength(88);
      expect(ninesAmong(closed), missed(closed)).toBeGreaterThanOrEqual(CLOSED_NINES_TODAY);
    },
    SLOW_TEST_TIMEOUT_MS,
  );

  it(
    'stejně napsanou devítku z mřížky hra pozná pokaždé stejně',
    () => {
      const first = recognizeGrid().map((result) => result.recognized);
      const second = recognizeGrid().map((result) => result.recognized);

      expect(second).toEqual(first);
    },
    SLOW_TEST_TIMEOUT_MS,
  );
});

// --- AC4 -----------------------------------------------------------------

const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

/** UCI zhuštěná na 4 body na úsek (AC4). */
const UCI_STEPS = 4;

/**
 * Dnešní počty správně poznaných číslic na UCI (4 body na úsek), ze kterých
 * jsou hodnoty v AC4: celkem 3 312 z 3 498 (94,7 %), devítka 315 z 336 (93,8 %).
 */
const CORRECT_TODAY: Readonly<Record<number, number>> = {
  0: 362,
  1: 311,
  2: 347,
  3: 332,
  4: 350,
  5: 318,
  6: 329,
  7: 325,
  8: 323,
  9: 315,
};
const CORRECT_TOTAL_TODAY = 3312;

/**
 * AC4 celkem: vlastník 2026-11-19 přijal pokles o nejvýš 5 číslic (záměny
 * 4→9 a 5→9) výměnou za otevřenou devítku (AC1, AC2).
 */
const ACCEPTED_TOTAL_DROP = 5;

/** AC4: jiná číslice než 9 smí klesnout nejvýš o 1 procentní bod. */
const MAX_DROP = 0.01;

/** AC4: záměny s devítkou, které nesmí přibýt (dnešní počty). */
const CONFUSIONS_TODAY: Readonly<Record<string, number>> = {
  '1→9': 2,
  '7→9': 0,
  '9→1': 7,
  '9→7': 1,
};

interface UciMeasurement {
  readonly correct: ReadonlyMap<number, number>;
  readonly count: ReadonlyMap<number, number>;
  readonly confusions: ReadonlyMap<string, number>;
  readonly total: number;
}

function measureUci(): UciMeasurement {
  const correct = new Map<number, number>();
  const count = new Map<number, number>();
  const confusions = new Map<string, number>();
  let total = 0;

  for (const sample of uciTestSamples()) {
    const recognized = recognizeDigit([densify(sample.stroke, UCI_STEPS)], WRITING_AREA);
    count.set(sample.digit, (count.get(sample.digit) ?? 0) + 1);
    if (recognized === sample.digit) {
      correct.set(sample.digit, (correct.get(sample.digit) ?? 0) + 1);
      total += 1;
    } else {
      const key = `${sample.digit}→${String(recognized)}`;
      confusions.set(key, (confusions.get(key) ?? 0) + 1);
    }
  }

  return { correct, count, confusions, total };
}

describe('AC4: číslice z testovací části UCI hra pozná aspoň tak dobře jako dnes', () => {
  it(
    'celkem hra pozná aspoň 3 307 číslic (pokles o 5 přijatý vlastníkem) a devítku aspoň v 93,8 %',
    () => {
      const measurement = measureUci();

      expect(measurement.total).toBeGreaterThanOrEqual(CORRECT_TOTAL_TODAY - ACCEPTED_TOTAL_DROP);
      expect(measurement.correct.get(9) ?? 0).toBeGreaterThanOrEqual(CORRECT_TODAY[9] ?? 0);
    },
    SLOW_TEST_TIMEOUT_MS,
  );

  it(
    'žádnou jinou číslici než 9 hra nepozná o víc než 1 procentní bod hůř než dnes',
    () => {
      const measurement = measureUci();
      const worse: Record<number, string> = {};

      for (const digit of DIGITS.filter((value) => value !== 9)) {
        const count = measurement.count.get(digit) ?? 1;
        const today = (CORRECT_TODAY[digit] ?? 0) / count;
        const now = (measurement.correct.get(digit) ?? 0) / count;
        if (now < today - MAX_DROP - 1e-9) {
          worse[digit] = `${(today * 100).toFixed(1)} % → ${(now * 100).toFixed(1)} %`;
        }
      }

      expect(worse).toEqual({});
    },
    SLOW_TEST_TIMEOUT_MS,
  );

  it(
    'záměn devítky s jedničkou a sedmičkou nepřibude',
    () => {
      const measurement = measureUci();
      const more: Record<string, string> = {};

      for (const [confusion, today] of Object.entries(CONFUSIONS_TODAY)) {
        const now = measurement.confusions.get(confusion) ?? 0;
        if (now > today) {
          more[confusion] = `${today} → ${now}`;
        }
      }

      expect(more).toEqual({});
    },
    SLOW_TEST_TIMEOUT_MS,
  );
});

// --- AC5 -----------------------------------------------------------------

/** Ukázka zmenšená na šířku (nebo výšku, je-li menší) okénka a umístěná doprostřed. */
function sampleIn(strokes: readonly Stroke[], box: WritingAreaSize): Stroke[] {
  const side = Math.min(box.width, box.height);
  const scale = side / SAMPLE_AREA.width;
  const dx = (box.width - side) / 2;
  const dy = (box.height - side) / 2;
  return strokes.map((stroke) =>
    stroke.map((point) => ({ x: point.x * scale + dx, y: point.y * scale + dy })),
  );
}

/** Okénko jednotek při rozsahu 20 na iPadu na šířku, stejně velké jako ve hře. */
function gameBoxArea(): WritingAreaSize {
  const layout = layoutWritingScreen(1024, 768, 20, STARS_PER_SET);
  const ones = layout.writingAreas[1];
  expect(ones).toBeDefined();
  return { width: ones?.width ?? 0, height: ones?.height ?? 0 };
}

/** Kolo s příkladem, na jehož výsledku nezáleží: měří se jen ukázané číslo. */
function emptyTwoBoxRound(area: WritingAreaSize): TwoBoxRound {
  const answer: AnswerRound = {
    problem: { first: 10, second: 9, operation: 'plus', result: 19 },
    maxNumber: 20,
    wrongAnswers: 0,
    solved: false,
  };
  return createTwoBoxRound(answer, area, recognizeDigit);
}

/** Dítě napíše tahy do okénka (každý 300 ms, mezi nimi 100 ms). */
function writeInBox(
  round: TwoBoxRound,
  box: WritingBox,
  strokes: readonly Stroke[],
  startMs: number,
): { round: TwoBoxRound; endMs: number } {
  let current = round;
  let now = startMs;
  for (const stroke of strokes) {
    current = finishBoxStroke(startBoxStroke(current, box, now), stroke, now + 300);
    now += 400;
  }
  return { round: current, endMs: now };
}

/** Jednička: svislá čára uprostřed okénka od 0,1 do 0,9 výšky. */
function oneIn(box: WritingAreaSize): Stroke[] {
  const x = box.width / 2;
  return [line({ x, y: 0.1 * box.height }, { x, y: 0.9 * box.height }, 30)];
}

describe('AC5: devítku z ukázky hra pozná i ve vysokém okénku a ve dvou okénkách', () => {
  it('ve vysokém okénku 160 × 256 i 320 × 512 hra pozná devítku z ukázky jako 9', () => {
    for (const box of [
      { width: 160, height: 256 },
      { width: 320, height: 512 },
    ]) {
      for (const sample of sampleNines()) {
        expect(
          recognizeDigit(sampleIn(sample.strokes, box), box),
          `okénko ${box.width} × ${box.height}, ${sample.description}`,
        ).toBe(9);
      }
    }
  });

  it('jednička vlevo a devítka z ukázky vpravo se při dvou okénkách pozná jako 19', () => {
    const area = gameBoxArea();

    for (const sample of sampleNines()) {
      const tens = writeInBox(emptyTwoBoxRound(area), 'tens', oneIn(area), 0);
      const ones = writeInBox(tens.round, 'ones', sampleIn(sample.strokes, area), tens.endMs);
      const shown = shownNumber(updateBoxes(ones.round, ones.endMs + RECOGNITION_DELAY_MS));

      expect(shown, sample.description).toBe(19);
    }
  });
});
