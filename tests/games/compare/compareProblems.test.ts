import { describe, expect, it } from 'vitest';

import {
  correctSign,
  holds,
  isSameProblem,
  nextProblem,
} from '../../../src/games/compare/logic/compareProblems';
import type {
  ArithmeticProblem,
  CompareProblem,
} from '../../../src/games/compare/logic/compareProblems';
import { MAX_NUMBER_OPTIONS } from '../../../src/games/compare/logic/compareSettings';
import { arithmeticOf, openCompare, solveProblem } from './compareFakes';

/**
 * Testy k #187 AC1: příklady „a ☐ b = c“ v rozsahu z nastavení, vždy
 * s jediným správným znaménkem (b = 0 se nedává), sčítání i odčítání
 * a stejný příklad nikdy dvakrát po sobě. Příklady jdou tak, jak je dítě
 * dostane ve hře (i přes oslavy po 10 hvězdičkách).
 */

const PROBLEM_COUNT = 1000;
const SEEDS = [1, 7, 20261121, 424242, 99999];

/** Generátor náhodných čísel [0, 1) s pevným seedem (mulberry32). */
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = state;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

/** Příklady, které dítě uvidí, když jich vyřeší `count` za sebou. */
function playedProblems(seed: number, count = PROBLEM_COUNT): ArithmeticProblem[] {
  const test = openCompare(undefined, seed);
  const problems: ArithmeticProblem[] = [];
  for (let index = 0; index < count; index += 1) {
    problems.push(arithmeticOf(test.session.problem()));
    solveProblem(test);
  }
  return problems;
}

function nameOf(problem: CompareProblem): string {
  return problem.kind === 'relation'
    ? `${problem.a} ☐ ${problem.b}`
    : `${problem.a} ☐ ${problem.b} = ${problem.result}`;
}

describe('#187 AC1: dítě vždy pozná jediné správné znaménko', () => {
  it('příklad, kde platí + i − (druhé číslo 0), nikdy nepřijde', () => {
    for (const seed of SEEDS) {
      for (const problem of playedProblems(seed)) {
        expect(problem.b, nameOf(problem)).toBeGreaterThan(0);
        expect(holds(problem, '+') && holds(problem, '−'), nameOf(problem)).toBe(false);
      }
    }
  });

  it('do okénka patří vždy přesně to znaménko, se kterým příklad platí', () => {
    for (const problem of playedProblems(3)) {
      expect(holds(problem, correctSign(problem)), nameOf(problem)).toBe(true);
    }
  });

  it('dítě dostává sčítání i odčítání, každé zhruba v polovině příkladů', () => {
    for (const seed of SEEDS) {
      const plus = playedProblems(seed).filter((problem) => correctSign(problem) === '+').length;
      expect(plus / PROBLEM_COUNT, `seed ${seed}`).toBeGreaterThan(0.4);
      expect(plus / PROBLEM_COUNT, `seed ${seed}`).toBeLessThan(0.6);
    }
  });
});

describe('#187 AC1: stejný příklad dvakrát po sobě nepřijde', () => {
  it('ve hře po sobě nikdy nejdou dva stejné příklady', () => {
    for (const seed of SEEDS) {
      const problems = playedProblems(seed);
      for (let index = 1; index < problems.length; index += 1) {
        const previous = problems[index - 1]!;
        const current = problems[index]!;
        expect(isSameProblem(previous, current), `seed ${seed}: ${nameOf(current)}`).toBe(false);
      }
    }
  });

  it('ani nejmenší rozsah nedá stejný příklad dvakrát po sobě', () => {
    const random = seeded(5);
    let previous: CompareProblem | null = null;
    for (let index = 0; index < 5000; index += 1) {
      const problem = nextProblem(previous, random, 10);
      if (previous !== null) {
        expect(isSameProblem(previous, problem), nameOf(problem)).toBe(false);
      }
      previous = problem;
    }
  });
});

describe('#187 AC1: výsledek i čísla jsou v rozsahu 0 až zvolený rozsah', () => {
  it('v každém rozsahu jsou všechna čísla příkladu 0 až rozsah a výsledek sedí', () => {
    for (const maxNumber of MAX_NUMBER_OPTIONS) {
      const random = seeded(maxNumber);
      let previous: CompareProblem | null = null;
      for (let index = 0; index < 5000; index += 1) {
        const problem = arithmeticOf(nextProblem(previous, random, maxNumber));
        const name = `do ${maxNumber}: ${nameOf(problem)}`;
        for (const number of [problem.a, problem.b, problem.result]) {
          expect(Number.isInteger(number), name).toBe(true);
          expect(number, name).toBeGreaterThanOrEqual(0);
          expect(number, name).toBeLessThanOrEqual(maxNumber);
        }
        previous = problem;
      }
    }
  });

  it('v každém rozsahu přijdou všechny příklady se sčítáním i odčítáním', () => {
    for (const maxNumber of MAX_NUMBER_OPTIONS) {
      const random = seeded(maxNumber + 1);
      const seen = new Set<string>();
      let previous: CompareProblem | null = null;
      for (let index = 0; index < 40000; index += 1) {
        const problem = nextProblem(previous, random, maxNumber);
        seen.add(`${problem.a}${correctSign(problem)}${problem.b}`);
        previous = problem;
      }
      for (let a = 0; a <= maxNumber; a += 1) {
        for (let b = 1; b <= maxNumber; b += 1) {
          if (a + b <= maxNumber) {
            expect(seen.has(`${a}+${b}`), `do ${maxNumber}: ${a} + ${b}`).toBe(true);
          }
          if (a - b >= 0) {
            expect(seen.has(`${a}−${b}`), `do ${maxNumber}: ${a} − ${b}`).toBe(true);
          }
        }
      }
    }
  });
});
