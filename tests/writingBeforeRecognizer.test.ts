import { describe, expect, it } from 'vitest';

import { isHintVisible, tapAnswer } from '../src/logic/answerRound';
import type { AnswerRound } from '../src/logic/answerRound';
import type { Stroke } from '../src/logic/digitRecognition';
import type { Problem } from '../src/logic/problems';
import {
  boxDigit,
  boxFadingStrokes,
  boxStrokes,
  boxesWithRecognizer,
  canConfirmBoxes,
  confirmBoxes,
  createTwoBoxRound,
  finishBoxStroke,
  shownNumber,
  startBoxStroke,
  switchToKeypad,
  updateBoxes,
} from '../src/logic/twoBoxWriting';
import type { TwoBoxRound, WritingBox } from '../src/logic/twoBoxWriting';
import {
  RECOGNITION_DELAY_MS,
  canConfirm,
  confirmWriting,
  createWritingRound,
  fadingStrokes,
  finishStroke,
  shownDigit,
  startStroke,
  updateWriting,
  withRecognizer,
  writtenStrokes,
} from '../src/logic/writingRound';
import type { DigitRecognizer, WritingRound } from '../src/logic/writingRound';

/**
 * Testy k #58 (rozpoznávání se stahuje na pozadí): dítě píše dřív, než se
 * rozpoznávání stáhne. Kolo psaní bez rozpoznávání (`null`) zápis drží,
 * dokud rozpoznávání nedostane, a pak se chová jako dnes (#41, #42).
 * Čas se předává jako číslo v ms. Rozpoznávání je podvržené jako
 * v `writingRound.test.ts`: tah nese značku, kterou vrátí jako číslici.
 */

const AREA = { width: 280, height: 280 } as const;
const TENS: WritingBox = 'tens';
const ONES: WritingBox = 'ones';

/** Značka tahu, který podvržené rozpoznávání odmítne (čmáranice). */
const NOT_A_DIGIT = -1;

/** Tah, který podvržené rozpoznávání přečte jako `digit` (nebo odmítne). */
function strokeFor(digit: number): Stroke {
  return [
    { x: 100, y: 100 },
    { x: 150, y: 200 },
    { x: 200, y: 250 + digit },
  ];
}

/** Podvržené rozpoznávání: přečte značku posledního tahu. */
const fakeRecognizer: DigitRecognizer = (strokes) => {
  const last = strokes[strokes.length - 1]?.[2];
  const mark = last === undefined ? undefined : last.y - 250;
  return mark === undefined || mark === NOT_A_DIGIT ? null : mark;
};

function plus(first: number, second: number): Problem {
  return { first, second, operation: 'plus', result: first + second };
}

function roundWith(problem: Problem, maxNumber = 10, wrongAnswers = 0): AnswerRound {
  return { problem, maxNumber, wrongAnswers, solved: false };
}

/** Jedno okénko bez stažení rozpoznávání; prst se zvedne v čase `liftedAtMs`. */
function writtenWithoutRecognizer(digit: number, liftedAtMs: number): WritingRound {
  const empty = createWritingRound(roundWith(plus(3, 4), 5), AREA, null);
  return finishStroke(startStroke(empty, liftedAtMs - 200), strokeFor(digit), liftedAtMs);
}

/** Do okénka `box` se napíše `digit`, prst se zvedne v čase `liftedAtMs`. */
function writeInBox(round: TwoBoxRound, box: WritingBox, digit: number, liftedAtMs: number) {
  return finishBoxStroke(
    startBoxStroke(round, box, liftedAtMs - 200),
    strokeFor(digit),
    liftedAtMs,
  );
}

describe('zápis dokončený před stažením rozpoznávání (AC3, jedno okénko)', () => {
  it('dokud se rozpoznávání nestáhne, zápis zůstane vidět a ✓ nejde stisknout', () => {
    let round = writtenWithoutRecognizer(7, 0);

    for (const nowMs of [RECOGNITION_DELAY_MS, 5_000, 60_000, 10 * 60_000]) {
      round = updateWriting(round, nowMs);
      expect(writtenStrokes(round)).toHaveLength(1);
      expect(fadingStrokes(round)).toEqual([]);
      expect(shownDigit(round)).toBeNull();
      expect(canConfirm(round)).toBe(false);
    }
    expect(confirmWriting(round).outcome).toBe('ignored');
  });

  it('po stažení se zápis rozpozná, ukáže se číslice a dítě ji potvrdí ✓', () => {
    let round = updateWriting(writtenWithoutRecognizer(7, 0), 30_000);

    round = updateWriting(withRecognizer(round, fakeRecognizer), 30_000);

    expect(shownDigit(round)).toBe(7);
    expect(canConfirm(round)).toBe(true);
    expect(confirmWriting(round).outcome).toBe('correct');
  });

  it('i rychle stažené rozpoznávání ukáže číslici nejdřív za 1 s po zvednutí prstu', () => {
    let round = updateWriting(writtenWithoutRecognizer(7, 1_000), 1_300);

    round = withRecognizer(round, fakeRecognizer);
    round = updateWriting(round, 1_300);
    expect(shownDigit(round)).toBeNull();
    round = updateWriting(round, 1_000 + RECOGNITION_DELAY_MS - 1);
    expect(shownDigit(round)).toBeNull();
    round = updateWriting(round, 1_000 + RECOGNITION_DELAY_MS);
    expect(shownDigit(round)).toBe(7);
  });

  it('nečitelný zápis po stažení vybledne jako dnes', () => {
    let round = updateWriting(writtenWithoutRecognizer(NOT_A_DIGIT, 0), 5_000);

    round = updateWriting(withRecognizer(round, fakeRecognizer), 5_000);

    expect(writtenStrokes(round)).toEqual([]);
    expect(fadingStrokes(round)).toHaveLength(1);
    expect(shownDigit(round)).toBeNull();
    expect(canConfirm(round)).toBe(false);
  });

  it('dítě může před stažením psát dál, rozpozná se celý zápis', () => {
    let round = writtenWithoutRecognizer(1, 0);
    round = updateWriting(round, 3_000);
    round = finishStroke(startStroke(round, 3_100), strokeFor(4), 3_400);

    round = updateWriting(withRecognizer(round, fakeRecognizer), 3_400 + RECOGNITION_DELAY_MS);

    expect(shownDigit(round)).toBe(4);
  });
});

describe('zápis do dvou okének před stažením rozpoznávání (AC3, do 10 a do 20)', () => {
  for (const maxNumber of [10, 20]) {
    it(`do ${maxNumber}: zápis v obou okénkách počká na stažení a pak se složí číslo`, () => {
      let round = createTwoBoxRound(roundWith(plus(8, 7), maxNumber), AREA, null);
      round = writeInBox(round, TENS, 1, 0);
      round = writeInBox(round, ONES, 5, 500);
      round = updateBoxes(round, 20_000);

      expect(boxStrokes(round, TENS)).toHaveLength(1);
      expect(boxStrokes(round, ONES)).toHaveLength(1);
      expect(boxFadingStrokes(round, TENS)).toEqual([]);
      expect(shownNumber(round)).toBeNull();
      expect(canConfirmBoxes(round)).toBe(false);
      expect(confirmBoxes(round).outcome).toBe('ignored');

      round = updateBoxes(boxesWithRecognizer(round, fakeRecognizer), 20_000);

      expect(boxDigit(round, TENS)).toBe(1);
      expect(boxDigit(round, ONES)).toBe(5);
      expect(shownNumber(round)).toBe(15);
      expect(canConfirmBoxes(round)).toBe(true);
      expect(confirmBoxes(round).outcome).toBe('correct');
    });
  }

  it('nečitelný zápis v okénku po stažení vybledne, druhé okénko se rozpozná', () => {
    let round = createTwoBoxRound(roundWith(plus(2, 5)), AREA, null);
    round = writeInBox(round, TENS, NOT_A_DIGIT, 0);
    round = writeInBox(round, ONES, 7, 300);

    round = updateBoxes(boxesWithRecognizer(round, fakeRecognizer), 10_000);

    expect(boxStrokes(round, TENS)).toEqual([]);
    expect(boxFadingStrokes(round, TENS)).toHaveLength(1);
    expect(boxDigit(round, ONES)).toBe(7);
  });

  it('okénka nedostanou číslici dřív než za 1 s po zvednutí prstu', () => {
    let round = createTwoBoxRound(roundWith(plus(2, 5)), AREA, null);
    round = writeInBox(round, ONES, 7, 2_000);

    round = updateBoxes(boxesWithRecognizer(round, fakeRecognizer), 2_500);
    expect(shownNumber(round)).toBeNull();
    round = updateBoxes(round, 2_000 + RECOGNITION_DELAY_MS);
    expect(shownNumber(round)).toBe(7);
  });
});

describe('stahování selže, když je okénko vidět (AC5)', () => {
  it('okénko se vymění za číselník se stejným příkladem a chyby se počítají dál', () => {
    const problem = plus(6, 3);
    let boxes = createTwoBoxRound(roundWith(problem, 10, 1), AREA, null);
    boxes = updateBoxes(writeInBox(boxes, ONES, 4, 0), 5_000);

    const keypad = switchToKeypad(boxes);

    expect(keypad.problem).toEqual(problem);
    expect(keypad.maxNumber).toBe(10);
    expect(keypad.wrongAnswers).toBe(1);
    expect(keypad.solved).toBe(false);
    expect(isHintVisible(keypad)).toBe(false);

    const afterSecondMistake = tapAnswer(keypad, 4).round;
    expect(isHintVisible(afterSecondMistake)).toBe(true);
    expect(tapAnswer(afterSecondMistake, 9).outcome).toBe('correct');
  });

  it('chyby z okének před výpadkem se po výměně za číselník neztratí', () => {
    const problem = plus(6, 3);
    let boxes = createTwoBoxRound(roundWith(problem), AREA, fakeRecognizer);
    boxes = updateBoxes(writeInBox(boxes, ONES, 4, 0), RECOGNITION_DELAY_MS);
    boxes = confirmBoxes(boxes).round;

    const keypad = switchToKeypad(boxes);

    expect(keypad.problem).toEqual(problem);
    expect(keypad.wrongAnswers).toBe(1);
    expect(isHintVisible(tapAnswer(keypad, 2).round)).toBe(true);
  });
});
