import { describe, expect, it } from 'vitest';

import {
  MAX_SUM,
  createAdditionProblem,
  formatProblem,
  isCorrectAnswer,
} from '../src/logic/addition';

/** Vrátí generátor, který postupně vydá zadané hodnoty (pak poslední dokola). */
function fakeRandom(values: readonly number[]): () => number {
  let index = 0;

  return () => {
    const value = values[Math.min(index, values.length - 1)] ?? 0;
    index += 1;
    return value;
  };
}

const MANY_PROBLEMS = Array.from({ length: 500 }, () => createAdditionProblem());

describe('náhodný příklad na sčítání do 10', () => {
  it('výsledek je součtem obou čísel', () => {
    for (const problem of MANY_PROBLEMS) {
      expect(problem.result).toBe(problem.first + problem.second);
    }
  });

  it('součet nikdy nepřekročí deset', () => {
    for (const problem of MANY_PROBLEMS) {
      expect(problem.result).toBeLessThanOrEqual(MAX_SUM);
    }
  });

  it('žádné číslo v příkladu není záporné', () => {
    for (const problem of MANY_PROBLEMS) {
      expect(problem.first).toBeGreaterThanOrEqual(0);
      expect(problem.second).toBeGreaterThanOrEqual(0);
      expect(problem.result).toBeGreaterThanOrEqual(0);
    }
  });

  it('obě čísla jsou celá, hráč nevidí desetinná místa', () => {
    for (const problem of MANY_PROBLEMS) {
      expect(Number.isInteger(problem.first)).toBe(true);
      expect(Number.isInteger(problem.second)).toBe(true);
    }
  });

  it('nejmenší možný příklad je 0 + 0', () => {
    const problem = createAdditionProblem(fakeRandom([0, 0]));

    expect(problem).toEqual({ first: 0, second: 0, result: 0 });
  });

  it('největší možný příklad má součet deset', () => {
    const problem = createAdditionProblem(fakeRandom([0.999999, 0.999999]));

    expect(problem.result).toBe(MAX_SUM);
  });

  it('příklad se hráči zobrazí jako „3 + 4 = ?“', () => {
    expect(formatProblem({ first: 3, second: 4, result: 7 })).toBe('3 + 4 = ?');
  });
});

describe('vyhodnocení odpovědi', () => {
  const problem = { first: 3, second: 4, result: 7 } as const;

  it('správná odpověď je uznána', () => {
    expect(isCorrectAnswer(problem, 7)).toBe(true);
  });

  it('špatná odpověď není uznána', () => {
    expect(isCorrectAnswer(problem, 6)).toBe(false);
    expect(isCorrectAnswer(problem, 8)).toBe(false);
    expect(isCorrectAnswer(problem, 0)).toBe(false);
  });

  it('prázdná odpověď není uznána', () => {
    expect(isCorrectAnswer(problem, undefined)).toBe(false);
    expect(isCorrectAnswer(problem, null)).toBe(false);
    expect(isCorrectAnswer(problem, '')).toBe(false);
  });

  it('nesmyslná odpověď není uznána a nespadne', () => {
    expect(isCorrectAnswer(problem, Number.NaN)).toBe(false);
    expect(isCorrectAnswer(problem, 7.5)).toBe(false);
    expect(isCorrectAnswer(problem, '7')).toBe(false);
    expect(isCorrectAnswer(problem, -7)).toBe(false);
  });
});
