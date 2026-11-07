import { describe, expect, it } from 'vitest';

import { isHintVisible, tapAnswer } from '../../../src/games/counting/logic/answerRound';
import type { AnswerRound } from '../../../src/games/counting/logic/answerRound';
import { recognizeDigit } from '../../../src/games/counting/logic/digitRecognition';
import type { Stroke, WritingAreaSize } from '../../../src/games/counting/logic/digitRecognition';
import type { Problem } from '../../../src/games/counting/logic/problems';
import { layoutWritingScreen } from '../../../src/games/counting/logic/screenLayout';
import {
  STARS_PER_SET,
  createStarProgress,
  starsAfterTap,
} from '../../../src/games/counting/logic/stars';
import {
  boxDigit,
  canConfirmBoxes,
  confirmBoxes,
  createTwoBoxRound,
  finishBoxStroke,
  shownNumber,
  startBoxStroke,
  updateBoxes,
} from '../../../src/games/counting/logic/twoBoxWriting';
import type { TwoBoxRound, WritingBox } from '../../../src/games/counting/logic/twoBoxWriting';
import {
  RECOGNITION_DELAY_MS,
  canConfirm,
  clearWriting,
  confirmWriting,
  createWritingRound,
  finishStroke,
  shownDigit,
  startStroke,
  updateWriting,
  writtenStrokes,
} from '../../../src/games/counting/logic/writingRound';
import type { WritingRound } from '../../../src/games/counting/logic/writingRound';

import { placeStroke } from './penDigits';
import { ASYMMETRIC_DIGITS, FORM_AREA, ONE, inForm, zeroLoop } from './writtenForms';
import type { WrittenForm } from './writtenForms';

/**
 * Testy k #85, AC5: číslo poznané ze zápisu odspodu nebo zrcadlově se ve hře
 * ukáže, potvrdí a vyhodnotí stejně jako každé jiné, i v jednom ze dvou
 * okének. Kolo psaní dostane skutečné rozpoznávání; čas je číslo v ms.
 */

/** Podoby, které #85 nově pozná. */
const NEW_FORMS: readonly WrittenForm[] = ['odspodu', 'zrcadlově', 'zrcadlově a odspodu'];

/** Jak dlouho má dítě prst na ploše při psaní jednoho tahu. */
const STROKE_MS = 300;

function problemWithResult(result: number): Problem {
  return { first: result, second: 0, operation: 'plus', result };
}

function answerFor(result: number, maxNumber: number): AnswerRound {
  return { problem: problemWithResult(result), maxNumber, wrongAnswers: 0, solved: false };
}

function digitStrokes(digit: number): Stroke[] {
  const found = ASYMMETRIC_DIGITS.find((item) => item.digit === digit);
  expect(found, `pevný tvar číslice ${digit}`).toBeDefined();
  return found?.strokes ?? [];
}

interface WrittenDigit {
  readonly label: string;
  readonly digit: number;
  readonly strokes: Stroke[];
}

/** Každá pevná číslice v každé nové podobě. */
function newFormDigits(): WrittenDigit[] {
  return ASYMMETRIC_DIGITS.flatMap(({ digit, strokes }) =>
    NEW_FORMS.map((form) => ({
      label: `${digit} napsaná ${form}`,
      digit,
      strokes: inForm(strokes, form),
    })),
  );
}

/** Dítě položí prst v `startMs` a napíše všechny tahy, každý za `STROKE_MS`. */
function write(round: WritingRound, strokes: readonly Stroke[], startMs: number): WritingRound {
  let current = round;
  strokes.forEach((stroke, index) => {
    const start = startMs + index * STROKE_MS;
    current = finishStroke(startStroke(current, start), stroke, start + STROKE_MS);
  });
  return current;
}

/** Kdy dítě naposledy zvedlo prst po `write` se začátkem v `startMs`. */
function liftTime(strokes: readonly Stroke[], startMs: number): number {
  return startMs + strokes.length * STROKE_MS;
}

/** Napíše zápis, počká na rozpoznání a vrátí kolo s ukázaným číslem. */
function writeAndWait(round: WritingRound, strokes: readonly Stroke[], startMs = 0): WritingRound {
  const written = write(round, strokes, startMs);
  return updateWriting(written, liftTime(strokes, startMs) + RECOGNITION_DELAY_MS);
}

function freshRound(result: number): WritingRound {
  return createWritingRound(answerFor(result, 10), FORM_AREA, recognizeDigit);
}

describe('AC5: obrácené nebo zrcadlové číslo se ukáže a potvrzuje jako každé jiné', () => {
  it('číslo napsané odspodu nebo zrcadlově se ukáže za stejnou dobu po zvednutí prstu jako normálně napsané', () => {
    for (const writing of newFormDigits()) {
      const written = write(freshRound(writing.digit), writing.strokes, 0);
      const lifted = liftTime(writing.strokes, 0);

      const justBefore = updateWriting(written, lifted + RECOGNITION_DELAY_MS - 1);
      expect(shownDigit(justBefore), `${writing.label}: těsně před`).toBeNull();
      expect(canConfirm(justBefore), `${writing.label}: těsně před`).toBe(false);

      const onTime = updateWriting(written, lifted + RECOGNITION_DELAY_MS);
      expect(shownDigit(onTime), `${writing.label}: po ${RECOGNITION_DELAY_MS} ms`).toBe(
        writing.digit,
      );
      expect(canConfirm(onTime), `${writing.label}: po ${RECOGNITION_DELAY_MS} ms`).toBe(true);
    }
  });

  it('dítě může obrácené nebo zrcadlové číslo před ✓ přepsat jiným', () => {
    const three = digitStrokes(3);
    for (const writing of newFormDigits().filter((item) => item.digit !== 3)) {
      const shown = writeAndWait(freshRound(3), writing.strokes);
      expect(shownDigit(shown), writing.label).toBe(writing.digit);

      // Nový tah do plochy: číslo zmizí a po smazání se napíše jiné.
      expect(
        shownDigit(startStroke(shown, 5000)),
        `${writing.label}: prst znovu na ploše`,
      ).toBeNull();
      const cleared = clearWriting(shown);
      expect(shownDigit(cleared), `${writing.label}: po smazání`).toBeNull();
      expect(writtenStrokes(cleared), `${writing.label}: po smazání`).toEqual([]);

      const rewritten = writeAndWait(cleared, three, 6000);
      expect(shownDigit(rewritten), `${writing.label}: přepsáno na 3`).toBe(3);
    }
  });

  it('správné obrácené nebo zrcadlové číslo po ✓ dostane hvězdičku jako každá jiná správná odpověď', () => {
    for (const writing of newFormDigits()) {
      const confirmed = confirmWriting(writeAndWait(freshRound(writing.digit), writing.strokes));
      const stars = starsAfterTap(createStarProgress(), confirmed.outcome);

      expect(confirmed.outcome, writing.label).toBe('correct');
      expect(confirmed.round.answer.solved, writing.label).toBe(true);
      expect(stars.starEarned, writing.label).toBe(true);
      expect(stars.progress.earned, writing.label).toBe(1);
    }
  });

  it('špatné obrácené nebo zrcadlové číslo dostane stejnou reakci jako jiná chyba a počítá se do nápovědy', () => {
    for (const writing of newFormDigits()) {
      // Výsledek příkladu je jiné číslo, než dítě napsalo.
      const result = writing.digit === 8 ? 6 : 8;
      const keypad = tapAnswer(answerFor(result, 10), writing.digit);

      const first = confirmWriting(writeAndWait(freshRound(result), writing.strokes));
      expect(first.outcome, writing.label).toBe(keypad.outcome);
      expect(first.outcome, writing.label).toBe('wrong');
      expect(first.round.answer.wrongAnswers, writing.label).toBe(keypad.round.wrongAnswers);
      expect(writtenStrokes(first.round), `${writing.label}: plocha se vyprázdní`).toEqual([]);
      expect(starsAfterTap(createStarProgress(), first.outcome).starEarned, writing.label).toBe(
        false,
      );
      expect(isHintVisible(first.round.answer), `${writing.label}: po 1. chybě`).toBe(false);

      const second = confirmWriting(writeAndWait(first.round, writing.strokes, 5000));
      expect(second.outcome, `${writing.label}: 2. chyba`).toBe('wrong');
      expect(isHintVisible(second.round.answer), `${writing.label}: po 2. chybě`).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Dvě okénka u výsledků do 20 (#42)
// ---------------------------------------------------------------------------

/** Okénko při rozsahu 20 na iPadu na šířku, stejně velké jako ve hře. */
function gameBoxArea(): WritingAreaSize {
  const layout = layoutWritingScreen(1024, 768, 20, STARS_PER_SET);
  const ones = layout.writingAreas[1];
  expect(ones).toBeDefined();
  return { width: ones?.width ?? 0, height: ones?.height ?? 0 };
}

/** Zápis z plochy 320 × 320 zmenšený do okénka (zrcadlení už proběhlo v ploše 320). */
function inBox(strokes: readonly Stroke[], box: WritingAreaSize): Stroke[] {
  const scale = Math.min(box.width, box.height) / FORM_AREA.width;
  return strokes.map((stroke) => placeStroke(stroke, scale, 0, 0));
}

function writeBox(
  round: TwoBoxRound,
  box: WritingBox,
  strokes: readonly Stroke[],
  startMs: number,
) {
  let current = round;
  strokes.forEach((stroke, index) => {
    const start = startMs + index * STROKE_MS;
    current = finishBoxStroke(startBoxStroke(current, box, start), stroke, start + STROKE_MS);
  });
  return current;
}

interface TwoBoxCase {
  readonly label: string;
  readonly value: number;
  readonly tens: Stroke[];
  readonly ones: Stroke[];
}

function twoBoxCases(): TwoBoxCase[] {
  return [
    {
      label: '1 normálně a 3 zrcadlově',
      value: 13,
      tens: ONE,
      ones: inForm(digitStrokes(3), 'zrcadlově'),
    },
    {
      label: '1 normálně a 7 odspodu',
      value: 17,
      tens: ONE,
      ones: inForm(digitStrokes(7), 'odspodu'),
    },
    {
      label: '1 normálně a 9 zrcadlově a odspodu',
      value: 19,
      tens: ONE,
      ones: inForm(digitStrokes(9), 'zrcadlově a odspodu'),
    },
    {
      label: '2 zrcadlově a 0 normálně',
      value: 20,
      tens: inForm(digitStrokes(2), 'zrcadlově'),
      ones: zeroLoop('proti směru'),
    },
    {
      label: '2 odspodu a 0 normálně',
      value: 20,
      tens: inForm(digitStrokes(2), 'odspodu'),
      ones: zeroLoop('proti směru'),
    },
  ];
}

/** Do levého okénka napíše desítky, do pravého jednotky a počká na rozpoznání. */
function writeNumber(result: number, writing: TwoBoxCase, box: WritingAreaSize): TwoBoxRound {
  let round = createTwoBoxRound(answerFor(result, 20), box, recognizeDigit);
  round = writeBox(round, 'tens', inBox(writing.tens, box), 0);
  round = writeBox(round, 'ones', inBox(writing.ones, box), 1000);
  return updateBoxes(round, 1000 + writing.ones.length * STROKE_MS + RECOGNITION_DELAY_MS);
}

describe('AC5: obrácené nebo zrcadlové číslo platí i v jednom ze dvou okének', () => {
  it('obrácená nebo zrcadlová číslice v okénku se složí do čísla do 20 a správné dostane hvězdičku', () => {
    const box = gameBoxArea();
    for (const writing of twoBoxCases()) {
      const round = writeNumber(writing.value, writing, box);

      expect(shownNumber(round), writing.label).toBe(writing.value);
      expect(canConfirmBoxes(round), writing.label).toBe(true);
      const confirmed = confirmBoxes(round);
      expect(confirmed.outcome, writing.label).toBe('correct');
      expect(starsAfterTap(createStarProgress(), confirmed.outcome).starEarned, writing.label).toBe(
        true,
      );
    }
  });

  it('špatné číslo s obrácenou nebo zrcadlovou číslicí v okénku je chyba jako každá jiná', () => {
    const box = gameBoxArea();
    for (const writing of twoBoxCases()) {
      const result = writing.value === 20 ? 12 : 20;
      const round = writeNumber(result, writing, box);
      const keypad = tapAnswer(answerFor(result, 20), writing.value);

      expect(shownNumber(round), writing.label).toBe(writing.value);
      const confirmed = confirmBoxes(round);
      expect(confirmed.outcome, writing.label).toBe(keypad.outcome);
      expect(confirmed.outcome, writing.label).toBe('wrong');
      expect(confirmed.round.answer.wrongAnswers, writing.label).toBe(keypad.round.wrongAnswers);
      expect(boxDigit(confirmed.round, 'tens'), `${writing.label}: okénka se vyprázdní`).toBeNull();
      expect(boxDigit(confirmed.round, 'ones'), `${writing.label}: okénka se vyprázdní`).toBeNull();
    }
  });
});
