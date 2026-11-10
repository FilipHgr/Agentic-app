import { describe, expect, it } from 'vitest';

import type { AnswerRound } from '../../../src/games/counting/logic/answerRound';
import { recognizeDigit } from '../../../src/games/counting/logic/digitRecognition';
import type { Stroke, WritingAreaSize } from '../../../src/games/counting/logic/digitRecognition';
import { layoutWritingScreen } from '../../../src/games/counting/logic/screenLayout';
import { STARS_PER_SET, starsAfterTap } from '../../../src/games/counting/logic/stars';
import { confirmBoxes, createTwoBoxRound } from '../../../src/games/counting/logic/twoBoxWriting';
import {
  RECOGNITION_DELAY_MS,
  confirmWriting,
  createWritingRound,
  finishStroke,
  shownDigit,
  startStroke,
  updateWriting,
  writtenStrokes,
} from '../../../src/games/counting/logic/writingRound';
import { placeStroke, uciTestSamples } from './penDigits';

/**
 * Rychlé testy chování okénka na psaní, přesunuté beze změny z pomalých
 * souborů rozpoznávání (#80, AC1), aby běžely v `test:counting`:
 * z `phonePortraitRecognition.slow.test.ts` (#56, AC6) prázdné okénko, ✓
 * a špatná odpověď ve vysokém okénku, z `twoDigitRecognition.slow.test.ts`
 * (#42) velikost okénka ve hře. Pomocné funkce jsou zkopírované z těchto
 * souborů.
 */

/** Nejvýš 1,6× vyšší než široké (#56, AC6). */
const MAX_BOX_HEIGHT_RATIO = 1.6;

/** Nejmenší šířka okénka do 10 a do 20 (#56, AC6). */
const NARROWEST_BOX = 160;

/** Stačí každý 20. vzorek sady. */
const SAMPLE_STEP = 20;

/** Vysoké okénko dané šířky s poměrem `ratio`. */
function tallBox(width: number, ratio: number): WritingAreaSize {
  return { width, height: width * ratio };
}

/** Zápis ze čtverce o šířce okénka posunutý svisle doprostřed vysokého okénka. */
function inTallBox(strokes: readonly Stroke[], box: WritingAreaSize): Stroke[] {
  const dy = (box.height - box.width) / 2;
  return strokes.map((stroke) => placeStroke(stroke, 1, 0, dy));
}

/** Vzorky sady zvětšené do čtverce o šířce `width`. */
function samplesForWidth(width: number, step = 1): Stroke[][] {
  return uciTestSamples({ width, height: width })
    .filter((_, index) => index % step === 0)
    .map((sample) => [sample.stroke]);
}

/** Okénko jednotek při rozsahu 20 na iPadu na šířku: stejná velikost jako ve hře. */
function gameBoxArea(): WritingAreaSize {
  const layout = layoutWritingScreen(1024, 768, 20, STARS_PER_SET);
  const ones = layout.writingAreas[1];
  expect(ones).toBeDefined();
  return { width: ones?.width ?? 0, height: ones?.height ?? 0 };
}

describe('AC6: prázdné okénko, ✓ a špatná odpověď ve vysokém okénku jako dnes', () => {
  const box = tallBox(NARROWEST_BOX * 2, MAX_BOX_HEIGHT_RATIO);
  const round: AnswerRound = {
    problem: { first: 2, second: 3, operation: 'plus', result: 5 },
    maxNumber: 5,
    wrongAnswers: 0,
    solved: false,
  };

  /** První vzorek sady, který se ve vysokém okénku rozpozná jako jiná číslice než 5. */
  function wrongDigitStroke(): { stroke: Stroke; digit: number } {
    for (const [stroke] of samplesForWidth(box.width, SAMPLE_STEP)) {
      const placed = inTallBox([stroke ?? []], box)[0] ?? [];
      const digit = recognizeDigit([placed], box);
      if (digit !== null && digit !== round.problem.result) {
        return { stroke: placed, digit };
      }
    }
    throw new Error('ve vzorku chybí jiná číslice než 5');
  }

  it('✓ u prázdného okénka nic neudělá a nepočítá se jako chyba', () => {
    const single = confirmWriting(createWritingRound(round, box, recognizeDigit));
    expect(single.outcome).toBe('ignored');
    expect(single.round.answer.wrongAnswers).toBe(0);

    const two = confirmBoxes(createTwoBoxRound(round, box, recognizeDigit));
    expect(two.outcome).toBe('ignored');
    expect(two.round.answer.wrongAnswers).toBe(0);
  });

  it('po špatné odpovědi se okénko vyprázdní a hvězdička se nevezme', () => {
    const { stroke, digit } = wrongDigitStroke();
    let writing = createWritingRound(round, box, recognizeDigit);
    writing = startStroke(writing, 0);
    writing = finishStroke(writing, stroke, 100);
    writing = updateWriting(writing, 100 + RECOGNITION_DELAY_MS);
    expect(shownDigit(writing)).toBe(digit);

    const confirmed = confirmWriting(writing);

    expect(confirmed.outcome).toBe('wrong');
    expect(writtenStrokes(confirmed.round)).toEqual([]);
    expect(shownDigit(confirmed.round)).toBeNull();
    expect(starsAfterTap({ earned: 3 }, confirmed.outcome).progress.earned).toBe(3);
  });
});

describe('testovací data pro dvouciferná čísla odpovídají zadání', () => {
  it('okénko ve hře má aspoň 280 × 280 px', () => {
    const area = gameBoxArea();

    expect(area.width).toBeGreaterThanOrEqual(280);
    expect(area.height).toBeGreaterThanOrEqual(280);
  });
});
