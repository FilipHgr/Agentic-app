import { describe, expect, it } from 'vitest';

import type { AnswerRound } from '../../../src/games/counting/logic/answerRound';
import { isHintVisible } from '../../../src/games/counting/logic/answerRound';
import { recognizeDigit } from '../../../src/games/counting/logic/digitRecognition';
import type { Stroke } from '../../../src/games/counting/logic/digitRecognition';
import type { Problem } from '../../../src/games/counting/logic/problems';
import {
  RECOGNITION_DELAY_MS,
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

import {
  GRID_AREA,
  SAMPLE_AREA,
  gridNines,
  gridOnes,
  gridSevens,
  sampleNineOneStroke,
  sampleNineTwoStrokes,
  sampleNines,
} from './openNineShapes';
import type { ShapedDigit } from './openNineShapes';

/**
 * Testy k #143: devítka s otevřeným kolečkem nahoře se pozná jako 9,
 * ne jako 7 nebo 1. Tady jsou malé pevné sady (ukázka vlastníka, sedmičky
 * a jedničky), velké sady jsou v `openNineRecognition.slow.test.ts`.
 * Tvary jsou v `openNineShapes.ts`, z pevných hodnot zadání, žádná náhoda.
 */

/** AC3: sedmiček aspoň 38 ze 40 jako 7. */
const MIN_SEVENS_AS_SEVEN = 38;

/** AC3: jedniček aspoň 14 z 18 jako 1. */
const MIN_ONES_AS_ONE = 14;

/** Popisy zápisů, které hra nepoznala jako `expected` (s tím, co poznala). */
function notRecognizedAs(
  expected: number,
  digits: readonly ShapedDigit[],
  area = GRID_AREA,
): string[] {
  return digits.flatMap((digit) => {
    const recognized = recognizeDigit(digit.strokes, area);
    return recognized === expected ? [] : [`${digit.description}: ${String(recognized)}`];
  });
}

/** Popisy zápisů, které hra poznala jako 9. */
function recognizedAsNine(digits: readonly ShapedDigit[]): string[] {
  return digits
    .filter((digit) => recognizeDigit(digit.strokes, GRID_AREA) === 9)
    .map((digit) => digit.description);
}

function expectInside(strokes: readonly Stroke[], area: { width: number; height: number }): void {
  for (const point of strokes.flat()) {
    expect(point.x).toBeGreaterThanOrEqual(0);
    expect(point.x).toBeLessThanOrEqual(area.width);
    expect(point.y).toBeGreaterThanOrEqual(0);
    expect(point.y).toBeLessThanOrEqual(area.height);
  }
}

describe('#143: testovací tvary odpovídají zadání', () => {
  it('ukázka vlastníka má mezi sousedními body 8 bodů navíc a dva tahy se potkají v (160,190)', () => {
    const [oneStroke] = sampleNineOneStroke();
    // 13 pevných bodů, 12 úseků po 9 krocích.
    expect(oneStroke).toHaveLength(12 * 9 + 1);

    const [arc, leg] = sampleNineTwoStrokes();
    expect(arc?.[0]).toEqual({ x: 225, y: 135 });
    expect(arc?.[arc.length - 1]).toEqual({ x: 160, y: 190 });
    expect(leg?.[0]).toEqual({ x: 160, y: 190 });
    expect(leg?.[leg.length - 1]).toEqual({ x: 165, y: 290 });

    for (const sample of sampleNines()) {
      expectInside(sample.strokes, SAMPLE_AREA);
    }
  });

  it('mřížka devítek má 440 devítek, 352 otevřených a 88 uzavřených, všechny v ploše', () => {
    const nines = gridNines();

    expect(nines).toHaveLength(440);
    expect(nines.filter((nine) => nine.gap > 0)).toHaveLength(352);
    expect(nines.filter((nine) => nine.gap === 0)).toHaveLength(88);
    for (const gap of [30, 60, 90, 120]) {
      expect(
        nines.filter((nine) => nine.gap === gap),
        `mezera ${gap}°`,
      ).toHaveLength(88);
    }
    for (const nine of nines) {
      expectInside(nine.strokes, GRID_AREA);
      expect(nine.strokes.length).toBeGreaterThanOrEqual(1);
      expect(nine.strokes.length).toBeLessThanOrEqual(2);
    }
  });

  it('sedmiček je 40 a jedniček 18, všechny v ploše', () => {
    expect(gridSevens()).toHaveLength(40);
    expect(gridOnes()).toHaveLength(18);
    for (const digit of [...gridSevens(), ...gridOnes()]) {
      expectInside(digit.strokes, GRID_AREA);
    }
  });

  it('sady jsou pokaždé stejné (bez náhody)', () => {
    expect(gridNines()).toEqual(gridNines());
    expect(gridSevens()).toEqual(gridSevens());
    expect(gridOnes()).toEqual(gridOnes());
    expect(sampleNines()).toEqual(sampleNines());
  });
});

describe('AC1: devítku z ukázky vlastníka hra pozná jako 9', () => {
  it('devítku s otevřeným kolečkem napsanou jedním tahem hra pozná jako 9', () => {
    expect(recognizeDigit(sampleNineOneStroke(), SAMPLE_AREA)).toBe(9);
  });

  it('devítku s otevřeným kolečkem napsanou dvěma tahy (oblouk, pak noha) hra pozná jako 9', () => {
    expect(recognizeDigit(sampleNineTwoStrokes(), SAMPLE_AREA)).toBe(9);
  });
});

// --- Kolo s psaním a skutečným rozpoznáváním --------------------------------

function plus(first: number, second: number): Problem {
  return { first, second, operation: 'plus', result: first + second };
}

function roundFor(problem: Problem): WritingRound {
  const answer: AnswerRound = { problem, maxNumber: 10, wrongAnswers: 0, solved: false };
  return createWritingRound(answer, SAMPLE_AREA, recognizeDigit);
}

/** Dítě napíše tahy (každý 300 ms) a počká, až se ukáže rozpoznaná číslice. */
function writeAndWait(
  round: WritingRound,
  strokes: readonly Stroke[],
  startMs: number,
): WritingRound {
  let current = round;
  let now = startMs;
  for (const stroke of strokes) {
    current = finishStroke(startStroke(current, now), stroke, now + 300);
    now += 400;
  }
  return updateWriting(current, now + RECOGNITION_DELAY_MS);
}

/** Sedmička z mřížky AC3 přepočtená do okénka ukázky. */
function sevenInSampleArea(): Stroke[] {
  const seven = gridSevens()[0];
  expect(seven).toBeDefined();
  const scale = SAMPLE_AREA.width / GRID_AREA.width;
  return (seven?.strokes ?? []).map((stroke) =>
    stroke.map((point) => ({ x: point.x * scale, y: point.y * scale })),
  );
}

describe('AC1: za devítku s otevřeným kolečkem jako správný výsledek hra nedá chybu', () => {
  it('příklad 4 + 5 vyřeší devítka z ukázky jedním tahem i dvěma tahy', () => {
    for (const sample of sampleNines()) {
      const shown = writeAndWait(roundFor(plus(4, 5)), sample.strokes, 0);
      expect(shownDigit(shown), sample.description).toBe(9);

      const result = confirmWriting(shown);
      expect(result.outcome, sample.description).toBe('correct');
      expect(result.round.answer.wrongAnswers, sample.description).toBe(0);
    }
  });
});

describe('AC3: sedmičky a jedničky hra nikdy nevezme za devítku', () => {
  it('žádnou sedmičku z pevné sady hra nepozná jako 9', () => {
    expect(recognizedAsNine(gridSevens())).toEqual([]);
  });

  it('aspoň 38 ze 40 sedmiček hra pozná jako 7', () => {
    const failures = notRecognizedAs(7, gridSevens());

    expect(failures.length, failures.join('\n')).toBeLessThanOrEqual(40 - MIN_SEVENS_AS_SEVEN);
  });

  it('žádnou jedničku z pevné sady hra nepozná jako 9', () => {
    expect(recognizedAsNine(gridOnes())).toEqual([]);
  });

  it('aspoň 14 z 18 jedniček hra pozná jako 1', () => {
    const failures = notRecognizedAs(1, gridOnes());

    expect(failures.length, failures.join('\n')).toBeLessThanOrEqual(18 - MIN_ONES_AS_ONE);
  });
});

describe('AC6: otevřená devítka nic nemění na průběhu kola', () => {
  it('otevřená devítka jako odpověď na jiný příklad je obyčejná špatná odpověď bez trestu', () => {
    for (const sample of sampleNines()) {
      const shown = writeAndWait(roundFor(plus(3, 5)), sample.strokes, 0);
      const result = confirmWriting(shown);

      expect(result.outcome, sample.description).toBe('wrong');
      expect(result.round.answer.wrongAnswers, sample.description).toBe(1);
      expect(result.round.answer.solved, sample.description).toBe(false);
      // Po jedné chybě nápověda ještě není a zápis se smaže, dítě píše znovu.
      expect(isHintVisible(result.round.answer), sample.description).toBe(false);
      expect(writtenStrokes(result.round), sample.description).toEqual([]);
    }
  });

  it('rozpoznanou otevřenou devítku jde před ✓ smazat a přepsat bez chyby', () => {
    const nine = writeAndWait(roundFor(plus(3, 4)), sampleNineOneStroke(), 0);
    expect(shownDigit(nine)).not.toBeNull();

    const rewritten = writeAndWait(clearWriting(nine), sevenInSampleArea(), 5000);
    expect(shownDigit(rewritten)).toBe(7);

    const result = confirmWriting(rewritten);
    expect(result.outcome).toBe('correct');
    expect(result.round.answer.wrongAnswers).toBe(0);
  });
});
