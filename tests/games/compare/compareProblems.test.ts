import { describe, expect, it } from 'vitest';

import { correctChoice } from '../../../src/games/compare/logic/compareProblems';
import type { CompareProblem } from '../../../src/games/compare/logic/compareProblems';
import { openCompare, solveProblem } from './compareFakes';

/**
 * Testy k #178 AC5: stejný počet má zhruba každý čtvrtý příklad a stejná
 * dvojice se dvakrát po sobě neopakuje, ani prohozená. Příklady jdou
 * tak, jak je dítě dostane ve hře (i přes oslavy po 10 hvězdičkách).
 */

const PROBLEM_COUNT = 1000;
const SEEDS = [1, 7, 20261121, 424242, 99999];

/** Příklady, které dítě uvidí, když jich vyřeší `count` za sebou. */
function playedProblems(seed: number, count = PROBLEM_COUNT): CompareProblem[] {
  const test = openCompare(undefined, seed);
  const problems: CompareProblem[] = [];
  for (let index = 0; index < count; index += 1) {
    problems.push(test.session.problem());
    solveProblem(test);
  }
  return problems;
}

/** Stejná dvojice čísel bez ohledu na stranu. */
function isSamePair(first: CompareProblem, second: CompareProblem): boolean {
  const sorted = (problem: CompareProblem): string =>
    [problem.left, problem.right].sort((a, b) => a - b).join(':');
  return sorted(first) === sorted(second);
}

describe('#178 AC5: stejný počet má zhruba každý čtvrtý příklad', () => {
  it('v 1 000 příkladech je stejný počet teček ve 20–30 % příkladů', () => {
    for (const seed of SEEDS) {
      const equal = playedProblems(seed).filter((problem) => problem.left === problem.right);
      const share = equal.length / PROBLEM_COUNT;
      expect(share, `seed ${seed}: ${share}`).toBeGreaterThanOrEqual(0.2);
      expect(share, `seed ${seed}: ${share}`).toBeLessThanOrEqual(0.3);
    }
  });

  it('víc teček je stejně často vlevo jako vpravo (každá strana aspoň 30 %)', () => {
    for (const seed of SEEDS) {
      const problems = playedProblems(seed);
      const left = problems.filter((problem) => correctChoice(problem) === 'left').length;
      const right = problems.filter((problem) => correctChoice(problem) === 'right').length;
      expect(left / PROBLEM_COUNT, `seed ${seed}`).toBeGreaterThanOrEqual(0.3);
      expect(right / PROBLEM_COUNT, `seed ${seed}`).toBeGreaterThanOrEqual(0.3);
    }
  });

  it('v 1 000 příkladech se objeví každý počet teček od 1 do 10', () => {
    const counts = new Set(playedProblems(SEEDS[0] ?? 1).flatMap((p) => [p.left, p.right]));
    expect([...counts].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });
});

describe('#178 AC5: stejná dvojice se dvakrát po sobě neopakuje', () => {
  it('žádný příklad nemá stejnou dvojici jako ten před ním, ani prohozenou', () => {
    for (const seed of SEEDS) {
      const problems = playedProblems(seed);
      const repeats = problems
        .slice(1)
        .map((problem, index) => ({ problem, previous: problems[index] as CompareProblem }))
        .filter(({ problem, previous }) => isSamePair(problem, previous))
        .map(
          ({ problem, previous }) =>
            `${previous.left}:${previous.right} → ${problem.left}:${problem.right}`,
        );
      expect(repeats, `seed ${seed}`).toEqual([]);
    }
  });

  it('dva stejné počty za sebou (třeba 4 : 4 a 4 : 4) také ne', () => {
    for (const seed of SEEDS) {
      const problems = playedProblems(seed);
      for (let index = 1; index < problems.length; index += 1) {
        const previous = problems[index - 1] as CompareProblem;
        const problem = problems[index] as CompareProblem;
        if (previous.left === previous.right && problem.left === problem.right) {
          expect(problem.left, `seed ${seed}, příklad ${index}`).not.toBe(previous.left);
        }
      }
    }
  });

  it('po chybě zůstává stejný příklad (opakování po sobě je jen nový příklad)', () => {
    const test = openCompare();
    const problem = test.session.problem();
    const wrong = correctChoice(problem) === 'equal' ? 'left' : 'equal';
    test.session.tap(wrong);
    expect(test.session.problem()).toEqual(problem);
  });
});
