import { describe, expect, it } from 'vitest';

import { createAnswerRound, tapAnswer } from '../src/logic/answerRound';
import { createProblem } from '../src/logic/problems';
import type { Problem } from '../src/logic/problems';
import { MAX_NUMBER_OPTIONS, OPERATION_OPTIONS } from '../src/logic/settings';
import type { GameSettings } from '../src/logic/settings';

/**
 * Generátor, který dokola vydává zadané hodnoty. Když hodnoty dají při
 * prvním losování určitý příklad, dá ho i každé další losování, takže hra
 * musí „stejný příklad“ odmítnout jinak než jen opakovaným losováním.
 */
function cycleRandom(values: readonly number[]): () => number {
  let index = 0;

  return () => {
    const value = values[index % values.length] ?? 0;
    index += 1;
    return value;
  };
}

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

/** Losování, které při sčítání do 10 dá pořád „3 + 4“. */
const ALWAYS_3_PLUS_4_TO_10 = [0.3, 0.5];
/** Losování, které při sčítání do 10 dá pořád „4 + 3“. */
const ALWAYS_4_PLUS_3_TO_10 = [0.4, 0.5];
/** Losování, které při sčítání do 10 dá pořád „2 + 1“. */
const ALWAYS_2_PLUS_1_TO_10 = [0.2, 0.2];
/** Losování, které při sčítání do 20 dá pořád „3 + 4“. */
const ALWAYS_3_PLUS_4_TO_20 = [0.15, 0.25];
/** Losování, které při „+ −“ do 10 dá pořád „3 + 4“ (nejdřív znaménko). */
const ALWAYS_3_PLUS_4_MIXED_TO_10 = [0, 0.3, 0.5];
/** Losování, které při „+ −“ do 10 dá pořád „5 + 0“. */
const ALWAYS_5_PLUS_0_MIXED_TO_10 = [0, 0.5, 0];
/** Losování, které při „+ −“ do 10 dá pořád „5 − 0“. */
const ALWAYS_5_MINUS_0_MIXED_TO_10 = [0.9, 0.5, 0];

describe('podvržené losování opravdu dává zamýšlené příklady', () => {
  it('bez předchozího příkladu vyjdou přesně příklady, se kterými testy počítají', () => {
    expect(createProblem(PLUS_TO_10, cycleRandom(ALWAYS_3_PLUS_4_TO_10))).toEqual(plus(3, 4));
    expect(createProblem(PLUS_TO_10, cycleRandom(ALWAYS_4_PLUS_3_TO_10))).toEqual(plus(4, 3));
    expect(createProblem(PLUS_TO_10, cycleRandom(ALWAYS_2_PLUS_1_TO_10))).toEqual(plus(2, 1));
    expect(createProblem(PLUS_TO_20, cycleRandom(ALWAYS_3_PLUS_4_TO_20))).toEqual(plus(3, 4));
    expect(createProblem(MIXED_TO_10, cycleRandom(ALWAYS_3_PLUS_4_MIXED_TO_10))).toEqual(
      plus(3, 4),
    );
    expect(createProblem(MIXED_TO_10, cycleRandom(ALWAYS_5_PLUS_0_MIXED_TO_10))).toEqual(
      plus(5, 0),
    );
    expect(createProblem(MIXED_TO_10, cycleRandom(ALWAYS_5_MINUS_0_MIXED_TO_10))).toEqual(
      minus(5, 0),
    );
  });
});

describe('AC1: po správné odpovědi přijde jiný příklad', () => {
  it('i když by losování znovu dalo vyřešený příklad, hra ukáže jiný', () => {
    const solvedRound = tapAnswer(
      createAnswerRound(PLUS_TO_10, cycleRandom(ALWAYS_3_PLUS_4_TO_10)),
      7,
    );
    expect(solvedRound.outcome).toBe('correct');

    const nextRound = createAnswerRound(
      PLUS_TO_10,
      cycleRandom(ALWAYS_3_PLUS_4_TO_10),
      solvedRound.round.problem,
    );

    expect(isSameProblem(nextRound.problem, plus(3, 4))).toBe(false);
  });

  it('nový příklad je pořád platný příklad z rozsahu a kolo začíná od nuly', () => {
    const nextRound = createAnswerRound(PLUS_TO_10, cycleRandom(ALWAYS_3_PLUS_4_TO_10), plus(3, 4));

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
    const beforeSettings = createAnswerRound(PLUS_TO_10, cycleRandom(ALWAYS_3_PLUS_4_TO_10));
    expect(beforeSettings.problem).toEqual(plus(3, 4));

    const afterSettings = createAnswerRound(
      PLUS_TO_20,
      cycleRandom(ALWAYS_3_PLUS_4_TO_20),
      beforeSettings.problem,
    );

    expect(isSameProblem(afterSettings.problem, plus(3, 4))).toBe(false);
    expectValidProblem(afterSettings.problem, 20);
    expect(afterSettings.problem.operation).toBe('plus');
    expect(afterSettings.maxNumber).toBe(20);
  });

  it('změna druhu na „+ −“: místo „3 + 4“ hra ukáže jiný příklad', () => {
    const afterSettings = createAnswerRound(
      MIXED_TO_10,
      cycleRandom(ALWAYS_3_PLUS_4_MIXED_TO_10),
      plus(3, 4),
    );

    expect(isSameProblem(afterSettings.problem, plus(3, 4))).toBe(false);
    expectValidProblem(afterSettings.problem, 10);
  });

  it('když předchozí příklad do nového rozsahu nepatří, hra normálně pokračuje', () => {
    const smallRange: GameSettings = { maxNumber: 5, operations: 'minus' };
    const round = createAnswerRound(smallRange, cycleRandom([0.5, 0.5]), plus(12, 7));

    expectValidProblem(round.problem, 5);
    expect(round.problem.operation).toBe('minus');
  });
});

describe('AC3: prohozená čísla nebo jiné znaménko jsou jiný příklad', () => {
  it('po „3 + 4“ smí hned přijít „4 + 3“', () => {
    const next = createProblem(PLUS_TO_10, cycleRandom(ALWAYS_4_PLUS_3_TO_10), plus(3, 4));

    expect(next).toEqual(plus(4, 3));
  });

  it('po „5 + 0“ smí hned přijít „5 − 0“', () => {
    const next = createProblem(MIXED_TO_10, cycleRandom(ALWAYS_5_MINUS_0_MIXED_TO_10), plus(5, 0));

    expect(next).toEqual(minus(5, 0));
  });

  it('po „5 − 0“ smí hned přijít „5 + 0“', () => {
    const next = createProblem(MIXED_TO_10, cycleRandom(ALWAYS_5_PLUS_0_MIXED_TO_10), minus(5, 0));

    expect(next).toEqual(plus(5, 0));
  });

  it('nové kolo po „3 + 4“ ukáže vylosované „4 + 3“ beze změny', () => {
    const round = createAnswerRound(PLUS_TO_10, cycleRandom(ALWAYS_4_PLUS_3_TO_10), plus(3, 4));

    expect(round.problem).toEqual(plus(4, 3));
  });
});

describe('AC4: příklad se smí vrátit ob jeden', () => {
  it('pořadí „2 + 1“, „3 + 3“, „2 + 1“ je povolené', () => {
    const first = createProblem(PLUS_TO_10, cycleRandom(ALWAYS_2_PLUS_1_TO_10));
    const second = createProblem(PLUS_TO_10, cycleRandom([0.3, 0.4]), first);
    const third = createProblem(PLUS_TO_10, cycleRandom(ALWAYS_2_PLUS_1_TO_10), second);

    expect(first).toEqual(plus(2, 1));
    expect(second).toEqual(plus(3, 3));
    expect(third).toEqual(plus(2, 1));
  });

  it('každý příklad z rozsahu se dřív nebo později znovu objeví', () => {
    // Rozsah do 5, jen „+“: 21 různých příkladů. Pravidlo nic trvale nevyřazuje.
    const settings: GameSettings = { maxNumber: 5, operations: 'plus' };
    const seen = new Set<string>();
    let previous: Problem | undefined;
    for (let draw = 0; draw < 3000; draw += 1) {
      const problem = createProblem(settings, Math.random, previous);
      seen.add(`${problem.first}+${problem.second}`);
      previous = problem;
    }

    expect(seen.size).toBe(21);
  });
});

describe('AC5: po špatné odpovědi zůstává stejný příklad', () => {
  it('špatné ťuknutí příklad nemění, dokud ho dítě nevyřeší', () => {
    const round = createAnswerRound(PLUS_TO_10, cycleRandom(ALWAYS_3_PLUS_4_TO_10));
    const afterFirstMistake = tapAnswer(round, 2);
    const afterSecondMistake = tapAnswer(afterFirstMistake.round, 9);

    expect(afterFirstMistake.outcome).toBe('wrong');
    expect(afterSecondMistake.outcome).toBe('wrong');
    expect(afterSecondMistake.round.problem).toEqual(plus(3, 4));
  });

  it('až po vyřešení přijde nový příklad a ten se od vyřešeného liší', () => {
    const round = createAnswerRound(PLUS_TO_10, cycleRandom(ALWAYS_3_PLUS_4_TO_10));
    const afterMistake = tapAnswer(round, 2).round;
    const solved = tapAnswer(afterMistake, 7);
    expect(solved.outcome).toBe('correct');
    expect(solved.round.problem).toEqual(plus(3, 4));

    const nextRound = createAnswerRound(
      PLUS_TO_10,
      cycleRandom(ALWAYS_3_PLUS_4_TO_10),
      solved.round.problem,
    );

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
      let previous: Problem | undefined;
      for (let draw = 0; draw < 1000; draw += 1) {
        const problem = createProblem(settings, Math.random, previous);

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
    expect(() => createAnswerRound(PLUS_TO_10)).not.toThrow();

    const round = createAnswerRound(PLUS_TO_10);
    expectValidProblem(round.problem, 10);
  });

  it('prvním příkladem může být kterýkoli příklad, i „0 + 0“', () => {
    const round = createAnswerRound(PLUS_TO_10, () => 0, undefined);

    expect(round.problem).toEqual(plus(0, 0));
  });

  it('prvním příkladem může být i „3 + 4“, nic se nevyřazuje', () => {
    const round = createAnswerRound(PLUS_TO_10, cycleRandom(ALWAYS_3_PLUS_4_TO_10));

    expect(round.problem).toEqual(plus(3, 4));
  });
});
