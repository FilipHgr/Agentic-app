import { describe, expect, it } from 'vitest';

import {
  answerChoices,
  createAnswerRound,
  formatRoundProblem,
  isHintVisible,
  problemText,
  tapAnswer,
} from '../src/logic/answerRound';
import type { AnswerRound } from '../src/logic/answerRound';
import type { Problem } from '../src/logic/problems';
import { STAR_SIZE, layoutScreen } from '../src/logic/screenLayout';
import type { ScreenLayout } from '../src/logic/screenLayout';
import { MAX_NUMBER_OPTIONS, OPERATION_OPTIONS } from '../src/logic/settings';
import type { GameSettings } from '../src/logic/settings';
import { STARS_PER_SET, starsAfterTap } from '../src/logic/stars';

import { seededRandom } from './seededRandom';

const SCREEN_WIDTH = 1024;
const SCREEN_HEIGHT = 768;

/** Okraj místa pro příklad od levé i pravé hrany herní plochy (#63, AC2). */
const MIN_SIDE_MARGIN = 24;

/** Nové kolo s pevným příkladem, aby testy ťukání nezávisely na náhodě. */
function roundFor(problem: Problem, maxNumber = 10): AnswerRound {
  return { problem, maxNumber, wrongAnswers: 0, solved: false };
}

function plus(first: number, second: number): Problem {
  return { first, second, operation: 'plus', result: first + second };
}

function minus(first: number, second: number): Problem {
  return { first, second, operation: 'minus', result: first - second };
}

/** Postupně ťukne na zadaná čísla a vrátí výsledný stav kola. */
function tapAll(round: AnswerRound, numbers: readonly number[]): AnswerRound {
  return numbers.reduce((current, number) => tapAnswer(current, number).round, round);
}

/** Nějaké špatné číslo z číselníku (jiné než výsledek). */
function wrongNumber(round: AnswerRound, offset = 1): number {
  return (round.problem.result + offset) % (round.maxNumber + 1);
}

/** Všechny kombinace, které rodič může nastavit. */
const ALL_SETTINGS: GameSettings[] = MAX_NUMBER_OPTIONS.flatMap((maxNumber) =>
  OPERATION_OPTIONS.map((operations) => ({ maxNumber, operations })),
);

describe('AC1: po správné odpovědi se v příkladu místo „?“ ukáže výsledek', () => {
  it('nový příklad má místo výsledku otazník', () => {
    expect(formatRoundProblem(roundFor(plus(3, 4)))).toBe('3 + 4 = ?');
  });

  it('po ťuknutí na 7 se ukáže „3 + 4 = 7“', () => {
    const round = tapAnswer(roundFor(plus(3, 4)), 7).round;

    expect(formatRoundProblem(round)).toBe('3 + 4 = 7');
  });

  it('po ťuknutí na 4 se ukáže „7 − 3 = 4“', () => {
    const round = tapAnswer(roundFor(minus(7, 3)), 4).round;

    expect(formatRoundProblem(round)).toBe('7 − 3 = 4');
  });

  it('výsledek 0 se ukáže taky: „5 − 5 = 0“', () => {
    const round = tapAnswer(roundFor(minus(5, 5), 5), 0).round;

    expect(formatRoundProblem(round)).toBe('5 − 5 = 0');
  });

  it('výsledek 0 se ukáže taky: „0 + 0 = 0“', () => {
    const round = tapAnswer(roundFor(plus(0, 0), 5), 0).round;

    expect(formatRoundProblem(round)).toBe('0 + 0 = 0');
  });

  it('dvouciferný výsledek se ukáže celý: „10 + 10 = 20“', () => {
    const round = tapAnswer(roundFor(plus(10, 10), 20), 20).round;

    expect(formatRoundProblem(round)).toBe('10 + 10 = 20');
  });

  it.each(ALL_SETTINGS)(
    'u vylosovaných příkladů ($maxNumber / $operations) se po správné odpovědi ukáže jejich výsledek',
    (settings) => {
      const random = seededRandom();
      for (let index = 0; index < 30; index += 1) {
        const round = createAnswerRound(settings, random);
        const { first, second, operation, result } = round.problem;
        const sign = operation === 'plus' ? '+' : '−';

        expect(formatRoundProblem(round)).toBe(`${first} ${sign} ${second} = ?`);
        const solved = tapAnswer(round, result).round;
        expect(formatRoundProblem(solved)).toBe(`${first} ${sign} ${second} = ${result}`);
      }
    },
  );
});

describe('AC2: po špatné odpovědi zůstane v příkladu „?“', () => {
  it('po ťuknutí na špatné číslo zůstane „3 + 4 = ?“', () => {
    const round = tapAnswer(roundFor(plus(3, 4)), 5).round;

    expect(formatRoundProblem(round)).toBe('3 + 4 = ?');
  });

  it('ani po 2. chybě, kdy se ukáže nápověda, se výsledek neprozradí', () => {
    const round = tapAll(roundFor(plus(3, 4)), [5, 2]);

    expect(isHintVisible(round)).toBe(true);
    expect(formatRoundProblem(round)).toBe('3 + 4 = ?');
    expect(formatRoundProblem(round)).not.toContain('7');
  });

  it('ani po mnoha chybách se výsledek neprozradí', () => {
    const round = tapAll(roundFor(minus(9, 2)), [0, 1, 2, 3, 4, 5, 6, 8, 9, 10]);

    expect(formatRoundProblem(round)).toBe('9 − 2 = ?');
  });

  it('ťuknutí mimo číselník výsledek neprozradí', () => {
    const round = tapAll(roundFor(plus(3, 4)), [-1, 11, Number.NaN]);

    expect(formatRoundProblem(round)).toBe('3 + 4 = ?');
  });
});

describe('AC3: výsledek se ukáže i po chybách a s nápovědou', () => {
  it('po jedné chybě a správné odpovědi se ukáže „3 + 4 = 7“', () => {
    const round = tapAll(roundFor(plus(3, 4)), [5, 7]);

    expect(formatRoundProblem(round)).toBe('3 + 4 = 7');
  });

  it('po nápovědě s tečkami a správné odpovědi se ukáže „7 − 3 = 4“', () => {
    const withHint = tapAll(roundFor(minus(7, 3)), [1, 2]);
    expect(isHintVisible(withHint)).toBe(true);

    const solved = tapAnswer(withHint, 4).round;

    expect(formatRoundProblem(solved)).toBe('7 − 3 = 4');
  });

  it('výsledek po chybách vypadá stejně jako bez chyb', () => {
    const withoutMistakes = tapAll(roundFor(plus(2, 6)), [8]);
    const withMistakes = tapAll(roundFor(plus(2, 6)), [1, 9, 3, 8]);

    expect(problemText(withMistakes)).toEqual(problemText(withoutMistakes));
  });
});

describe('AC4: vyřešený příklad zůstane s výsledkem až do dalšího kola', () => {
  it('další ťuknutí na jiné číslo po vyřešení výsledek nezmění ani neskryje', () => {
    const solved = tapAnswer(roundFor(plus(3, 4)), 7).round;

    for (const number of [0, 5, 10]) {
      expect(formatRoundProblem(tapAnswer(solved, number).round)).toBe('3 + 4 = 7');
    }
  });

  it('další ťuknutí na správné číslo po vyřešení výsledek nezmění', () => {
    const solved = tapAll(roundFor(plus(3, 4)), [7, 7, 7]);

    expect(formatRoundProblem(solved)).toBe('3 + 4 = 7');
  });

  it('při 10. hvězdičce zůstane vyřešený příklad s výsledkem', () => {
    const tap = tapAnswer(roundFor(minus(6, 2)), 4);
    const stars = starsAfterTap({ earned: STARS_PER_SET - 1 }, tap.outcome);

    expect(stars.setCompleted).toBe(true);
    expect(formatRoundProblem(tap.round)).toBe('6 − 2 = 4');
    expect(formatRoundProblem(tapAnswer(tap.round, 1).round)).toBe('6 − 2 = 4');
  });

  it('nový příklad po vyřešeném začíná zase s „?“', () => {
    const random = seededRandom();
    const settings: GameSettings = { maxNumber: 10, operations: 'mixed' };
    let round = createAnswerRound(settings, random);

    for (let index = 0; index < 10; index += 1) {
      const solved = tapAnswer(round, round.problem.result).round;
      expect(formatRoundProblem(solved)).not.toContain('?');

      round = createAnswerRound(settings, random, solved.problem);
      expect(formatRoundProblem(round).endsWith('= ?')).toBe(true);
    }
  });
});

describe('AC5: výsledek jde vybarvit zvlášť od zbytku příkladu', () => {
  it('nevyřešený příklad má odpověď „?“ a výsledek není ukázaný', () => {
    expect(problemText(roundFor(plus(3, 4)))).toEqual({
      equation: '3 + 4 =',
      answer: '?',
      answerRevealed: false,
    });
  });

  it('vyřešený příklad má odpověď zvlášť, aby mohla být zelená', () => {
    expect(problemText(tapAnswer(roundFor(minus(7, 3)), 4).round)).toEqual({
      equation: '7 − 3 =',
      answer: '4',
      answerRevealed: true,
    });
  });

  it('po špatné odpovědi výsledek ukázaný není', () => {
    const round = roundFor(plus(3, 4));
    const afterWrong = tapAnswer(round, wrongNumber(round)).round;

    expect(problemText(afterWrong).answerRevealed).toBe(false);
  });
});

/*
 * AC6: odhad šířky textu v písmu Arial, stejné pravidlo jako v rozložení:
 * číslice asi 0,56 velikosti písma, mezera 0,28, znaménka +, −, = asi 0,59.
 * Test počítá šířku sám, aby nezávisel na tom, jak ji počítá rozložení.
 */
const DIGIT_WIDTH = 0.56;
const SPACE_WIDTH = 0.28;
const SIGN_WIDTH = 0.59;

function estimatedTextWidth(text: string, fontSize: number): number {
  let widthInFontSizes = 0;
  for (const character of text) {
    if (character >= '0' && character <= '9') {
      widthInFontSizes += DIGIT_WIDTH;
    } else if (character === ' ') {
      widthInFontSizes += SPACE_WIDTH;
    } else {
      widthInFontSizes += SIGN_WIDTH;
    }
  }
  return widthInFontSizes * fontSize;
}

interface Box {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}

function box(x: number, y: number, width: number, height: number): Box {
  return { left: x - width / 2, right: x + width / 2, top: y - height / 2, bottom: y + height / 2 };
}

function overlaps(a: Box, b: Box): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

function insideScreen(b: Box): boolean {
  return b.left >= 0 && b.top >= 0 && b.right <= SCREEN_WIDTH && b.bottom <= SCREEN_HEIGHT;
}

function layoutFor(maxNumber: number): ScreenLayout {
  return layoutScreen(SCREEN_WIDTH, SCREEN_HEIGHT, answerChoices(maxNumber).length, STARS_PER_SET);
}

function problemBox(layout: ScreenLayout): Box {
  const { problem, problemSize } = layout;
  return box(problem.x, problem.y, problemSize.width, problemSize.height);
}

/** Nejširší vyřešené příklady pro každý rozsah podle zadání. */
const WIDEST_SOLVED: ReadonlyArray<{ maxNumber: number; problem: Problem; text: string }> = [
  { maxNumber: 5, problem: minus(5, 5), text: '5 − 5 = 0' },
  { maxNumber: 5, problem: plus(4, 1), text: '4 + 1 = 5' },
  { maxNumber: 10, problem: minus(10, 10), text: '10 − 10 = 0' },
  { maxNumber: 10, problem: minus(10, 0), text: '10 − 0 = 10' },
  { maxNumber: 20, problem: plus(10, 10), text: '10 + 10 = 20' },
  { maxNumber: 20, problem: minus(20, 10), text: '20 − 10 = 10' },
];

describe('AC6: příklad i s nejširším výsledkem se vejde na herní plochu 1024 × 768', () => {
  it.each(WIDEST_SOLVED)(
    'v rozsahu $maxNumber se vyřešený příklad „$text“ vejde do místa pro příklad',
    ({ maxNumber, problem, text }) => {
      const layout = layoutFor(maxNumber);
      const solved = tapAnswer(roundFor(problem, maxNumber), problem.result).round;

      expect(formatRoundProblem(solved)).toBe(text);
      expect(layout.problemSize.width).toBeGreaterThanOrEqual(
        estimatedTextWidth(text, layout.problemFontSize),
      );
      expect(layout.problemSize.height).toBeGreaterThanOrEqual(layout.problemFontSize);
    },
  );

  it.each(MAX_NUMBER_OPTIONS)(
    'v rozsahu %i je místo pro příklad celé na herní ploše',
    (maxNumber) => {
      expect(insideScreen(problemBox(layoutFor(maxNumber)))).toBe(true);
    },
  );

  it.each(MAX_NUMBER_OPTIONS)(
    'v rozsahu %i má místo pro příklad okraj aspoň 24 vlevo i vpravo (#63)',
    (maxNumber) => {
      const problem = problemBox(layoutFor(maxNumber));

      expect(problem.left).toBeGreaterThanOrEqual(MIN_SIDE_MARGIN);
      expect(problem.right).toBeLessThanOrEqual(SCREEN_WIDTH - MIN_SIDE_MARGIN);
    },
  );

  it.each(MAX_NUMBER_OPTIONS)('v rozsahu %i příklad nezasahuje do hvězdiček', (maxNumber) => {
    const layout = layoutFor(maxNumber);

    for (const star of layout.stars) {
      expect(overlaps(problemBox(layout), box(star.x, star.y, STAR_SIZE, STAR_SIZE))).toBe(false);
    }
  });

  it.each(MAX_NUMBER_OPTIONS)('v rozsahu %i příklad nezasahuje do číselníku', (maxNumber) => {
    const layout = layoutFor(maxNumber);

    for (const button of layout.answerButtons) {
      const buttonBox = box(button.x, button.y, button.size, button.size);
      expect(overlaps(problemBox(layout), buttonBox)).toBe(false);
    }
  });
});
