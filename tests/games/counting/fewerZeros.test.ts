import { describe, expect, it } from 'vitest';

import {
  createAnswerRound,
  hintDotGroups,
  isHintVisible,
  tapAnswer,
} from '../../../src/games/counting/logic/answerRound';
import type { AnswerRound } from '../../../src/games/counting/logic/answerRound';
import { createProblem } from '../../../src/games/counting/logic/problems';
import type { Problem } from '../../../src/games/counting/logic/problems';
import { MAX_NUMBER_OPTIONS, OPERATION_OPTIONS } from '../../../src/games/counting/logic/settings';
import type {
  GameSettings,
  MaxNumber,
  Operation,
} from '../../../src/games/counting/logic/settings';
import { createStarProgress, starsAfterTap } from '../../../src/games/counting/logic/stars';

import { seededRandom } from './seededRandom';

/**
 * Testy k #39 (méně příkladů s nulou). Nespoléhají na pořadí, v jakém
 * `createProblem` bere čísla z generátoru: počítají jen, jak často co přijde.
 */

/** Kolik příkladů se v jednom měření vylosuje. */
const DRAWS = 1000;

/** Hranice testu: nejvýš 15 % příkladů s nulou (cíl hry je 1 z 10). */
const MAX_ZERO_SHARE = 0.15;

/** Při „+ −“ tvoří každý druh 40 až 60 % příkladů. */
const MIN_OPERATION_SHARE = 0.4;
const MAX_OPERATION_SHARE = 0.6;

const ALL_SETTINGS: GameSettings[] = MAX_NUMBER_OPTIONS.flatMap((maxNumber) =>
  OPERATION_OPTIONS.map((operations) => ({ maxNumber, operations })),
);

function plus(first: number, second: number): Problem {
  return { first, second, operation: 'plus', result: first + second };
}

function minus(first: number, second: number): Problem {
  return { first, second, operation: 'minus', result: first - second };
}

/** Příklad s nulou: 0 je aspoň jedno číslo v zadání nebo výsledek. */
function hasZero(problem: Problem): boolean {
  return problem.first === 0 || problem.second === 0 || problem.result === 0;
}

function isSameProblem(a: Problem, b: Problem): boolean {
  return a.first === b.first && a.operation === b.operation && a.second === b.second;
}

function label(settings: GameSettings): string {
  return `do ${settings.maxNumber}, druh „${settings.operations}“`;
}

/** Všechny příklady bez nuly pro daný rozsah a druh. */
function problemsWithoutZero(maxNumber: number, operation: Operation): Problem[] {
  const problems: Problem[] = [];
  for (let first = 1; first <= maxNumber; first += 1) {
    if (operation === 'plus') {
      for (let second = 1; first + second <= maxNumber; second += 1) {
        problems.push(plus(first, second));
      }
    } else {
      for (let second = 1; second < first; second += 1) {
        problems.push(minus(first, second));
      }
    }
  }
  return problems;
}

/** Jak by hrálo dítě: každý nový příklad dostane předchozí jako `previous`. */
function playInARow(settings: GameSettings, seed?: number, startAfter?: Problem): Problem[] {
  const random = seededRandom(seed);
  const problems: Problem[] = [];
  let previous = startAfter;
  for (let draw = 0; draw < DRAWS; draw += 1) {
    const problem = createProblem(settings, random, previous);
    problems.push(problem);
    previous = problem;
  }
  return problems;
}

/** Losování, kdy se jako předchozí pokaždé předá tentýž příklad (AC5). */
function drawAlwaysAfter(settings: GameSettings, previous: Problem): Problem[] {
  const random = seededRandom();
  return Array.from({ length: DRAWS }, () => createProblem(settings, random, previous));
}

function zeroShare(problems: readonly Problem[]): number {
  if (problems.length === 0) {
    return 0;
  }
  return problems.filter(hasZero).length / problems.length;
}

function ofOperation(problems: readonly Problem[], operation: Operation): Problem[] {
  return problems.filter((problem) => problem.operation === operation);
}

function expectValidProblem(problem: Problem, maxNumber: number): void {
  for (const value of [problem.first, problem.second, problem.result]) {
    expect(Number.isInteger(value)).toBe(true);
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThanOrEqual(maxNumber);
  }
  const expectedResult =
    problem.operation === 'plus' ? problem.first + problem.second : problem.first - problem.second;
  expect(problem.result).toBe(expectedResult);
}

/** Limit nuly podle AC1–AC3: u „+ −“ platí pro každý druh zvlášť. */
function expectZeroLimit(problems: readonly Problem[], settings: GameSettings): void {
  if (settings.operations === 'mixed') {
    expect(zeroShare(ofOperation(problems, 'plus'))).toBeLessThanOrEqual(MAX_ZERO_SHARE);
    expect(zeroShare(ofOperation(problems, 'minus'))).toBeLessThanOrEqual(MAX_ZERO_SHARE);
  } else {
    expect(zeroShare(problems)).toBeLessThanOrEqual(MAX_ZERO_SHARE);
  }
}

describe('pomocné počítání příkladů s nulou', () => {
  it('za příklad s nulou se počítá nula v zadání i ve výsledku', () => {
    expect(hasZero(plus(0, 4))).toBe(true);
    expect(hasZero(plus(4, 0))).toBe(true);
    expect(hasZero(plus(0, 0))).toBe(true);
    expect(hasZero(minus(7, 0))).toBe(true);
    expect(hasZero(minus(7, 7))).toBe(true);
    expect(hasZero(plus(3, 4))).toBe(false);
    expect(hasZero(minus(7, 3))).toBe(false);
  });

  it('v rozsahu 5 je bez nuly 10 příkladů na sčítání a 10 na odčítání', () => {
    expect(problemsWithoutZero(5, 'plus')).toHaveLength(10);
    expect(problemsWithoutZero(5, 'minus')).toHaveLength(10);
  });
});

describe('AC1: při sčítání přijde nula nejvýš v 15 % příkladů', () => {
  for (const maxNumber of MAX_NUMBER_OPTIONS) {
    const settings: GameSettings = { maxNumber, operations: 'plus' };

    it(`sčítání do ${maxNumber}: z 1000 příkladů za sebou je nejvýš 15 % s nulou`, () => {
      const problems = playInARow(settings);

      expect(problems.every((problem) => problem.operation === 'plus')).toBe(true);
      expect(zeroShare(problems)).toBeLessThanOrEqual(MAX_ZERO_SHARE);
    });
  }
});

describe('AC2: při odčítání přijde nula nejvýš v 15 % příkladů', () => {
  for (const maxNumber of MAX_NUMBER_OPTIONS) {
    const settings: GameSettings = { maxNumber, operations: 'minus' };

    it(`odčítání do ${maxNumber}: z 1000 příkladů za sebou je nejvýš 15 % s nulou`, () => {
      const problems = playInARow(settings);

      expect(problems.every((problem) => problem.operation === 'minus')).toBe(true);
      expect(zeroShare(problems)).toBeLessThanOrEqual(MAX_ZERO_SHARE);
    });
  }
});

describe('AC3: při „+ −“ se střídá sčítání s odčítáním a nula je u obou vzácná', () => {
  for (const maxNumber of MAX_NUMBER_OPTIONS) {
    const settings: GameSettings = { maxNumber, operations: 'mixed' };

    it(`„+ −“ do ${maxNumber}: sčítání i odčítání tvoří každé 40 až 60 % příkladů`, () => {
      const problems = playInARow(settings);
      const plusShare = ofOperation(problems, 'plus').length / problems.length;
      const minusShare = ofOperation(problems, 'minus').length / problems.length;

      expect(plusShare).toBeGreaterThanOrEqual(MIN_OPERATION_SHARE);
      expect(plusShare).toBeLessThanOrEqual(MAX_OPERATION_SHARE);
      expect(minusShare).toBeGreaterThanOrEqual(MIN_OPERATION_SHARE);
      expect(minusShare).toBeLessThanOrEqual(MAX_OPERATION_SHARE);
    });

    it(`„+ −“ do ${maxNumber}: nula je nejvýš v 15 % sčítání a nejvýš v 15 % odčítání`, () => {
      const problems = playInARow(settings);

      expect(zeroShare(ofOperation(problems, 'plus'))).toBeLessThanOrEqual(MAX_ZERO_SHARE);
      expect(zeroShare(ofOperation(problems, 'minus'))).toBeLessThanOrEqual(MAX_ZERO_SHARE);
    });
  }
});

describe('AC4: nula úplně nezmizí', () => {
  it('kombinací nastavení je devět', () => {
    expect(ALL_SETTINGS).toHaveLength(9);
  });

  for (const settings of ALL_SETTINGS) {
    it(`${label(settings)}: mezi 1000 příklady je aspoň jeden s nulou`, () => {
      const problems = playInARow(settings);

      expect(problems.some(hasZero)).toBe(true);
    });
  }

  it('při „+ −“ se nula občas objeví u sčítání i u odčítání', () => {
    for (const maxNumber of MAX_NUMBER_OPTIONS) {
      const problems = playInARow({ maxNumber, operations: 'mixed' });

      expect(ofOperation(problems, 'plus').some(hasZero)).toBe(true);
      expect(ofOperation(problems, 'minus').some(hasZero)).toBe(true);
    }
  });
});

describe('AC5: příklady zůstávají platné a dva stejné nejdou po sobě', () => {
  for (const settings of ALL_SETTINGS) {
    it(`${label(settings)}: všechna čísla jsou celá, nezáporná a nejvýš rozsah, nic se neopakuje hned po sobě`, () => {
      const problems = playInARow(settings);

      problems.forEach((problem, index) => {
        expectValidProblem(problem, settings.maxNumber);
        if (settings.operations !== 'mixed') {
          expect(problem.operation).toBe(settings.operations);
        }
        const previous = problems[index - 1];
        if (previous) {
          expect(isSameProblem(problem, previous)).toBe(false);
        }
      });
    });
  }

  it('v rozsahu 5 se příklady bez nuly neopakují hned po sobě, i když jich je jen 10', () => {
    for (const operations of ['plus', 'minus'] as const) {
      const problems = playInARow({ maxNumber: 5, operations });
      const withoutZero = problems.filter((problem) => !hasZero(problem));

      // Bez nuly musí být většina příkladů a přesto se žádný nezopakuje hned po sobě.
      expect(withoutZero.length).toBeGreaterThanOrEqual(DRAWS * (1 - MAX_ZERO_SHARE));
      problems.forEach((problem, index) => {
        const previous = problems[index - 1];
        if (previous) {
          expect(isSameProblem(problem, previous)).toBe(false);
        }
      });
    }
  });

  for (const settings of ALL_SETTINGS) {
    it(`${label(settings)}: když je předchozí příklad pořád stejný, nula je pořád vzácná a ten příklad nepřijde`, () => {
      const repeated = settings.operations === 'minus' ? minus(4, 1) : plus(1, 3);
      const problems = drawAlwaysAfter(settings, repeated);

      for (const problem of problems) {
        expectValidProblem(problem, settings.maxNumber);
        expect(isSameProblem(problem, repeated)).toBe(false);
      }
      expectZeroLimit(problems, settings);
    });
  }

  for (const operation of ['plus', 'minus'] as const) {
    const settings: GameSettings = { maxNumber: 5, operations: operation };

    it(`${operation === 'plus' ? 'sčítání' : 'odčítání'} do 5: ať je předchozím kterýkoli příklad bez nuly, nula zůstane vzácná`, () => {
      for (const repeated of problemsWithoutZero(5, operation)) {
        const problems = drawAlwaysAfter(settings, repeated);

        expect(problems.some((problem) => isSameProblem(problem, repeated))).toBe(false);
        expect(zeroShare(problems)).toBeLessThanOrEqual(MAX_ZERO_SHARE);
      }
    });
  }

  it('„+ −“ do 5: ať je předchozím kterýkoli příklad bez nuly, nula zůstane vzácná u obou druhů', () => {
    const settings: GameSettings = { maxNumber: 5, operations: 'mixed' };
    const allWithoutZero = [...problemsWithoutZero(5, 'plus'), ...problemsWithoutZero(5, 'minus')];

    for (const repeated of allWithoutZero) {
      const problems = drawAlwaysAfter(settings, repeated);

      expect(problems.some((problem) => isSameProblem(problem, repeated))).toBe(false);
      expectZeroLimit(problems, settings);
    }
  });

  it('i po příkladu s nulou přijde platný a jiný příklad', () => {
    for (const settings of ALL_SETTINGS) {
      for (const repeated of [plus(0, 0), minus(0, 0), plus(5, 0), minus(5, 5)]) {
        const problems = drawAlwaysAfter(settings, repeated);

        for (const problem of problems) {
          expectValidProblem(problem, settings.maxNumber);
          expect(isSameProblem(problem, repeated)).toBe(false);
        }
      }
    }
  });
});

/** Kolo s daným příkladem, jak ho hra ukáže hráči. */
function roundWith(problem: Problem, maxNumber: MaxNumber = 10): AnswerRound {
  return { problem, maxNumber, wrongAnswers: 0, solved: false };
}

describe('AC6: příklad s nulou se hraje jako každý jiný', () => {
  it('u „0 + 0“ ukáže nápověda po 2. chybě žádnou tečku', () => {
    const afterFirstMistake = tapAnswer(roundWith(plus(0, 0)), 3).round;
    const afterSecondMistake = tapAnswer(afterFirstMistake, 1).round;

    expect(isHintVisible(afterSecondMistake)).toBe(true);
    expect(hintDotGroups(afterSecondMistake.problem)).toEqual([]);
  });

  it('u „0 + 0“ je odpověď 0 správná, i po chybách', () => {
    expect(tapAnswer(roundWith(plus(0, 0)), 0).outcome).toBe('correct');

    const afterMistakes = tapAnswer(tapAnswer(roundWith(plus(0, 0)), 3).round, 1).round;
    expect(tapAnswer(afterMistakes, 0).outcome).toBe('correct');
  });

  it('za správnou odpověď na příklad s nulou dostane hráč hvězdičku', () => {
    const zeroProblems = [plus(0, 4), plus(4, 0), plus(0, 0), minus(7, 0), minus(7, 7)];

    for (const problem of zeroProblems) {
      const { outcome } = tapAnswer(roundWith(problem), problem.result);
      const stars = starsAfterTap(createStarProgress(), outcome);

      expect(outcome).toBe('correct');
      expect(stars.starEarned).toBe(true);
      expect(stars.progress.earned).toBe(1);
    }
  });
});

describe('AC7: po změně nastavení platí nový rozsah a druh hned od prvního příkladu', () => {
  /** Příklady, které mohly být na obrazovce před změnou nastavení. */
  const BEFORE_CHANGE: Problem[] = [plus(3, 4), plus(12, 7), minus(20, 0), plus(0, 0), minus(4, 1)];

  for (const settings of ALL_SETTINGS) {
    it(`po přepnutí na ${label(settings)} je už první příklad z nového rozsahu a druhu`, () => {
      for (const before of BEFORE_CHANGE) {
        const round = createAnswerRound(settings, seededRandom(), before);

        expectValidProblem(round.problem, settings.maxNumber);
        expect(round.maxNumber).toBe(settings.maxNumber);
        if (settings.operations !== 'mixed') {
          expect(round.problem.operation).toBe(settings.operations);
        }
        expect(isSameProblem(round.problem, before)).toBe(false);
      }
    });

    it(`po přepnutí na ${label(settings)} je i v dalších 1000 příkladech nula vzácná`, () => {
      const problems = playInARow(settings, undefined, plus(12, 7));

      for (const problem of problems) {
        expectValidProblem(problem, settings.maxNumber);
      }
      expectZeroLimit(problems, settings);
      if (settings.operations === 'mixed') {
        const plusShare = ofOperation(problems, 'plus').length / problems.length;
        expect(plusShare).toBeGreaterThanOrEqual(MIN_OPERATION_SHARE);
        expect(plusShare).toBeLessThanOrEqual(MAX_OPERATION_SHARE);
      }
    });
  }
});
