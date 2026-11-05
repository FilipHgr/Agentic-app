import { describe, expect, it } from 'vitest';

import { createAnswerRound, tapAnswer } from '../../../src/games/counting/logic/answerRound';
import { createProblem } from '../../../src/games/counting/logic/problems';
import type { Problem } from '../../../src/games/counting/logic/problems';
import { MAX_NUMBER_OPTIONS, OPERATION_OPTIONS } from '../../../src/games/counting/logic/settings';
import type { GameSettings } from '../../../src/games/counting/logic/settings';

import { seededRandom } from './seededRandom';

function plus(first: number, second: number): Problem {
  return { first, second, operation: 'plus', result: first + second };
}

function minus(first: number, second: number): Problem {
  return { first, second, operation: 'minus', result: first - second };
}

/** Stejný příklad = stejné první číslo, znaménko i druhé číslo. */
function isSameProblem(a: Problem, b: Problem): boolean {
  return a.first === b.first && a.operation === b.operation && a.second === b.second;
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

const PLUS_TO_10: GameSettings = { maxNumber: 10, operations: 'plus' };
const PLUS_TO_20: GameSettings = { maxNumber: 20, operations: 'plus' };
const MIXED_TO_10: GameSettings = { maxNumber: 10, operations: 'mixed' };

/** Kolik losování nebo seedů testy nejvýš projdou, než příklad prohlásí za nemožný. */
const SEARCH_LIMIT = 20000;

/**
 * Najde seed, se kterým `createProblem` bez předchozího příkladu dá právě
 * `target`. Testy tak nespoléhají na to, jaký příklad dá konkrétní řada
 * náhodných čísel, jen na to, že takové losování existuje.
 */
function seedThatGives(settings: GameSettings, target: Problem): number | undefined {
  for (let seed = 1; seed <= SEARCH_LIMIT; seed += 1) {
    if (isSameProblem(createProblem(settings, seededRandom(seed)), target)) {
      return seed;
    }
  }
  return undefined;
}

/** Může po příkladu `previous` (nebo na začátku hry) přijít `target`? */
function canComeNext(
  settings: GameSettings,
  target: Problem,
  previous: Problem | undefined,
): boolean {
  const random = seededRandom();
  for (let draw = 0; draw < SEARCH_LIMIT; draw += 1) {
    if (isSameProblem(createProblem(settings, random, previous), target)) {
      return true;
    }
  }
  return false;
}

/** Číslo z číselníku, které není výsledkem příkladu. */
function wrongAnswerFor(problem: Problem, offset: number): number {
  return (problem.result + offset) % 11;
}

describe('podvržené losování opravdu dává zamýšlené příklady', () => {
  it('bez předchozího příkladu vyjdou přesně příklady, se kterými testy počítají', () => {
    // Každý příklad, se kterým testy níž počítají, musí jít vylosovat.
    expect(seedThatGives(PLUS_TO_10, plus(3, 4))).toBeDefined();
    expect(seedThatGives(PLUS_TO_10, plus(4, 3))).toBeDefined();
    expect(seedThatGives(PLUS_TO_10, plus(2, 1))).toBeDefined();
    expect(seedThatGives(PLUS_TO_10, plus(3, 3))).toBeDefined();
    expect(seedThatGives(PLUS_TO_20, plus(3, 4))).toBeDefined();
    expect(seedThatGives(MIXED_TO_10, plus(3, 4))).toBeDefined();
    expect(seedThatGives(MIXED_TO_10, plus(5, 0))).toBeDefined();
    expect(seedThatGives(MIXED_TO_10, minus(5, 0))).toBeDefined();
  });
});

describe('AC1: po správné odpovědi přijde jiný příklad', () => {
  it('i když by losování znovu dalo vyřešený příklad, hra ukáže jiný', () => {
    const seed = seedThatGives(PLUS_TO_10, plus(3, 4));
    expect(seed).toBeDefined();

    const solvedRound = tapAnswer(createAnswerRound(PLUS_TO_10, seededRandom(seed)), 7);
    expect(solvedRound.outcome).toBe('correct');

    // Stejná řada čísel by bez předchozího příkladu dala znovu „3 + 4“.
    const nextRound = createAnswerRound(PLUS_TO_10, seededRandom(seed), solvedRound.round.problem);

    expect(isSameProblem(nextRound.problem, plus(3, 4))).toBe(false);
  });

  it('nový příklad je pořád platný příklad z rozsahu a kolo začíná od nuly', () => {
    const nextRound = createAnswerRound(PLUS_TO_10, seededRandom(), plus(3, 4));

    expectValidProblem(nextRound.problem, 10);
    expect(nextRound.problem.operation).toBe('plus');
    expect(nextRound.solved).toBe(false);
    expect(nextRound.wrongAnswers).toBe(0);
    expect(nextRound.maxNumber).toBe(10);
  });

  it('hra se nezasekne, ani když losování dává pořád stejné číslo', () => {
    for (const constant of [0, 0.5, 0.999]) {
      const first = createProblem(PLUS_TO_10, () => constant);
      const next = createProblem(PLUS_TO_10, () => constant, first);

      expect(isSameProblem(next, first)).toBe(false);
      expectValidProblem(next, 10);
    }
  });
});

describe('AC2: po potvrzení nastavení přijde jiný příklad, než byl před ním', () => {
  it('rozsah do 10 → do 20 a „+“: místo „3 + 4“ hra ukáže jiný příklad', () => {
    const seedBefore = seedThatGives(PLUS_TO_10, plus(3, 4));
    const beforeSettings = createAnswerRound(PLUS_TO_10, seededRandom(seedBefore));
    expect(beforeSettings.problem).toEqual(plus(3, 4));

    // Řada čísel, která by do 20 bez předchozího příkladu dala také „3 + 4“.
    const seedAfter = seedThatGives(PLUS_TO_20, plus(3, 4));
    expect(seedAfter).toBeDefined();
    const afterSettings = createAnswerRound(
      PLUS_TO_20,
      seededRandom(seedAfter),
      beforeSettings.problem,
    );

    expect(isSameProblem(afterSettings.problem, plus(3, 4))).toBe(false);
    expectValidProblem(afterSettings.problem, 20);
    expect(afterSettings.problem.operation).toBe('plus');
    expect(afterSettings.maxNumber).toBe(20);
  });

  it('změna druhu na „+ −“: místo „3 + 4“ hra ukáže jiný příklad', () => {
    const seed = seedThatGives(MIXED_TO_10, plus(3, 4));
    expect(seed).toBeDefined();
    const afterSettings = createAnswerRound(MIXED_TO_10, seededRandom(seed), plus(3, 4));

    expect(isSameProblem(afterSettings.problem, plus(3, 4))).toBe(false);
    expectValidProblem(afterSettings.problem, 10);
  });

  it('když předchozí příklad do nového rozsahu nepatří, hra normálně pokračuje', () => {
    const smallRange: GameSettings = { maxNumber: 5, operations: 'minus' };
    const round = createAnswerRound(smallRange, seededRandom(), plus(12, 7));

    expectValidProblem(round.problem, 5);
    expect(round.problem.operation).toBe('minus');
  });
});

describe('AC3: prohozená čísla nebo jiné znaménko jsou jiný příklad', () => {
  it('po „3 + 4“ smí hned přijít „4 + 3“', () => {
    expect(canComeNext(PLUS_TO_10, plus(4, 3), plus(3, 4))).toBe(true);
  });

  it('po „5 + 0“ smí hned přijít „5 − 0“', () => {
    expect(canComeNext(MIXED_TO_10, minus(5, 0), plus(5, 0))).toBe(true);
  });

  it('po „5 − 0“ smí hned přijít „5 + 0“', () => {
    expect(canComeNext(MIXED_TO_10, plus(5, 0), minus(5, 0))).toBe(true);
  });

  it('nové kolo po „3 + 4“ ukáže vylosované „4 + 3“ beze změny', () => {
    const random = seededRandom();
    let shownFourPlusThree = false;
    for (let draw = 0; draw < SEARCH_LIMIT && !shownFourPlusThree; draw += 1) {
      const round = createAnswerRound(PLUS_TO_10, random, plus(3, 4));
      shownFourPlusThree = isSameProblem(round.problem, plus(4, 3));
    }

    expect(shownFourPlusThree).toBe(true);
  });
});

describe('AC4: příklad se smí vrátit ob jeden', () => {
  it('pořadí „2 + 1“, „3 + 3“, „2 + 1“ je povolené', () => {
    expect(canComeNext(PLUS_TO_10, plus(2, 1), undefined)).toBe(true);
    expect(canComeNext(PLUS_TO_10, plus(3, 3), plus(2, 1))).toBe(true);
    expect(canComeNext(PLUS_TO_10, plus(2, 1), plus(3, 3))).toBe(true);
  });

  it('při běžné hře se příklad občas vrátí ob jeden', () => {
    const random = seededRandom();
    const problems: Problem[] = [];
    for (let draw = 0; draw < 3000; draw += 1) {
      problems.push(createProblem({ maxNumber: 5, operations: 'plus' }, random, problems.at(-1)));
    }

    const returnsAfterOne = problems.some((problem, index) => {
      const twoBefore = problems[index - 2];
      return twoBefore !== undefined && isSameProblem(problem, twoBefore);
    });
    expect(returnsAfterOne).toBe(true);
  });

  it('každý příklad z rozsahu se dřív nebo později znovu objeví', () => {
    // Rozsah do 5, jen „+“: 21 různých příkladů. Pravidlo nic trvale nevyřazuje.
    const settings: GameSettings = { maxNumber: 5, operations: 'plus' };
    const seen = new Set<string>();
    const random = seededRandom();
    let previous: Problem | undefined;
    for (let draw = 0; draw < 3000; draw += 1) {
      const problem = createProblem(settings, random, previous);
      seen.add(`${problem.first}+${problem.second}`);
      previous = problem;
    }

    expect(seen.size).toBe(21);
  });
});

describe('AC5: po špatné odpovědi zůstává stejný příklad', () => {
  it('špatné ťuknutí příklad nemění, dokud ho dítě nevyřeší', () => {
    const round = createAnswerRound(PLUS_TO_10, seededRandom());
    const afterFirstMistake = tapAnswer(round, wrongAnswerFor(round.problem, 1));
    const afterSecondMistake = tapAnswer(afterFirstMistake.round, wrongAnswerFor(round.problem, 5));

    expect(afterFirstMistake.outcome).toBe('wrong');
    expect(afterSecondMistake.outcome).toBe('wrong');
    expect(afterSecondMistake.round.problem).toEqual(round.problem);
  });

  it('až po vyřešení přijde nový příklad a ten se od vyřešeného liší', () => {
    const seed = seedThatGives(PLUS_TO_10, plus(3, 4));
    expect(seed).toBeDefined();
    const round = createAnswerRound(PLUS_TO_10, seededRandom(seed));
    const afterMistake = tapAnswer(round, 2).round;
    const solved = tapAnswer(afterMistake, 7);
    expect(solved.outcome).toBe('correct');
    expect(solved.round.problem).toEqual(plus(3, 4));

    // Stejná řada čísel by bez předchozího příkladu dala znovu „3 + 4“.
    const nextRound = createAnswerRound(PLUS_TO_10, seededRandom(seed), solved.round.problem);

    expect(isSameProblem(nextRound.problem, plus(3, 4))).toBe(false);
  });
});

describe('AC6: pravidlo platí pro všech 9 kombinací nastavení', () => {
  const ALL_SETTINGS: GameSettings[] = MAX_NUMBER_OPTIONS.flatMap((maxNumber) =>
    OPERATION_OPTIONS.map((operations) => ({ maxNumber, operations })),
  );

  it('kombinací nastavení je devět', () => {
    expect(ALL_SETTINGS).toHaveLength(9);
  });

  for (const settings of ALL_SETTINGS) {
    const label = `do ${settings.maxNumber}, druh „${settings.operations}“`;

    it(`${label}: z 1000 příkladů za sebou nejsou žádné dva po sobě stejné a všechny jsou platné`, () => {
      const random = seededRandom();
      let previous: Problem | undefined;
      for (let draw = 0; draw < 1000; draw += 1) {
        const problem = createProblem(settings, random, previous);

        expectValidProblem(problem, settings.maxNumber);
        if (settings.operations !== 'mixed') {
          expect(problem.operation).toBe(settings.operations);
        }
        if (previous) {
          expect(isSameProblem(problem, previous)).toBe(false);
        }
        previous = problem;
      }
    });

    it(`${label}: ani pořád stejné losování nevrátí stejný příklad a hra se nezasekne`, () => {
      for (const constant of [0, 0.999]) {
        const first = createProblem(settings, () => constant);
        const next = createAnswerRound(settings, () => constant, first);

        expectValidProblem(next.problem, settings.maxNumber);
        expect(isSameProblem(next.problem, first)).toBe(false);
      }
    });
  }
});

describe('AC7: úplně první příklad nemá předchozí', () => {
  it('první kolo se připraví bez chyby a příklad je z rozsahu', () => {
    expect(() => createAnswerRound(PLUS_TO_10, seededRandom())).not.toThrow();

    const round = createAnswerRound(PLUS_TO_10, seededRandom());
    expectValidProblem(round.problem, 10);
  });

  it('prvním příkladem může být kterýkoli příklad, i „0 + 0“', () => {
    const seed = seedThatGives(PLUS_TO_10, plus(0, 0));
    expect(seed).toBeDefined();

    const round = createAnswerRound(PLUS_TO_10, seededRandom(seed), undefined);
    expect(round.problem).toEqual(plus(0, 0));
  });

  it('prvním příkladem může být i „3 + 4“, nic se nevyřazuje', () => {
    const seed = seedThatGives(PLUS_TO_10, plus(3, 4));
    expect(seed).toBeDefined();

    const round = createAnswerRound(PLUS_TO_10, seededRandom(seed));
    expect(round.problem).toEqual(plus(3, 4));
  });
});
