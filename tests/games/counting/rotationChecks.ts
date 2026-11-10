import { expect } from 'vitest';

import type { Problem } from '../../../src/games/counting/logic/problems';
import { MAX_NUMBER_OPTIONS, OPERATION_OPTIONS } from '../../../src/games/counting/logic/settings';
import type { GameSettings, Operation } from '../../../src/games/counting/logic/settings';

/**
 * Společné kontroly k #94 (příklady se vystřídají, než se některý zopakuje).
 * Pracují jen s řadou příkladů, jak je dítě vidělo, nic nevědí o tom, jak
 * hra losuje.
 */

/** Mezi dvěma stejnými příklady jsou aspoň 4 jiné (AC1). */
export const MIN_OTHERS_BETWEEN = 4;

/** Všech 9 kombinací nastavení (5/10/20 a +, −, + −). */
export const ALL_SETTINGS: GameSettings[] = MAX_NUMBER_OPTIONS.flatMap((maxNumber) =>
  OPERATION_OPTIONS.map((operations) => ({ maxNumber, operations })),
);

export function settingsLabel(settings: GameSettings): string {
  return `do ${settings.maxNumber}, druh „${settings.operations}“`;
}

export function plus(first: number, second: number): Problem {
  return { first, second, operation: 'plus', result: first + second };
}

export function minus(first: number, second: number): Problem {
  return { first, second, operation: 'minus', result: first - second };
}

/** Stejný příklad = stejné první číslo, znaménko i druhé číslo („3 + 4“ ≠ „4 + 3“). */
export function problemKey(problem: Problem): string {
  const sign = problem.operation === 'plus' ? '+' : '−';
  return `${problem.first} ${sign} ${problem.second}`;
}

/** Příklad s nulou: nula v zadání nebo ve výsledku (#39). */
export function hasZero(problem: Problem): boolean {
  return problem.first === 0 || problem.second === 0 || problem.result === 0;
}

export type ProblemGroup = 'withoutZero' | 'withZero';

export const GROUPS: readonly ProblemGroup[] = ['withoutZero', 'withZero'];

export function groupOf(problem: Problem): ProblemGroup {
  return hasZero(problem) ? 'withZero' : 'withoutZero';
}

function operationsOf(settings: GameSettings): Operation[] {
  return settings.operations === 'mixed' ? ['plus', 'minus'] : [settings.operations];
}

/** Všechny příklady nastavení (spočítané testem nezávisle na hře). */
export function allProblems(settings: GameSettings): Problem[] {
  const problems: Problem[] = [];
  for (const operation of operationsOf(settings)) {
    for (let first = 0; first <= settings.maxNumber; first += 1) {
      if (operation === 'plus') {
        for (let second = 0; first + second <= settings.maxNumber; second += 1) {
          problems.push(plus(first, second));
        }
      } else {
        for (let second = 0; second <= first; second += 1) {
          problems.push(minus(first, second));
        }
      }
    }
  }
  return problems;
}

/** Klíče všech příkladů skupiny v daném nastavení. */
export function groupKeys(settings: GameSettings, group: ProblemGroup): Set<string> {
  return new Set(
    allProblems(settings)
      .filter((problem) => groupOf(problem) === group)
      .map(problemKey),
  );
}

export function expectValidProblem(problem: Problem, settings: GameSettings): void {
  const where = problemKey(problem);
  for (const value of [problem.first, problem.second, problem.result]) {
    expect(Number.isInteger(value), `${where}: celé číslo`).toBe(true);
    expect(value, `${where}: nezáporné`).toBeGreaterThanOrEqual(0);
    expect(value, `${where}: v rozsahu`).toBeLessThanOrEqual(settings.maxNumber);
  }
  const expectedResult =
    problem.operation === 'plus' ? problem.first + problem.second : problem.first - problem.second;
  expect(problem.result, `${where}: výsledek`).toBe(expectedResult);
  if (settings.operations !== 'mixed') {
    expect(problem.operation, `${where}: druh podle nastavení`).toBe(settings.operations);
  }
}

/**
 * Index prvního příkladu, který se zopakoval dřív než po 4 jiných,
 * nebo `null`, když pravidlo AC1 platí pro celou řadu.
 */
export function firstEarlyRepeat(problems: readonly Problem[]): string | null {
  for (let index = 0; index < problems.length; index += 1) {
    const current = problems[index];
    if (current === undefined) {
      continue;
    }
    const recent = problems.slice(Math.max(0, index - MIN_OTHERS_BETWEEN), index);
    const repeated = recent.findIndex((earlier) => problemKey(earlier) === problemKey(current));
    if (repeated !== -1) {
      return `příklad ${index + 1} „${problemKey(current)}“ se opakuje po ${recent.length - repeated - 1} jiných`;
    }
  }
  return null;
}

/** AC1: v celé řadě jsou mezi dvěma stejnými příklady aspoň 4 jiné. */
export function expectNoEarlyRepeat(problems: readonly Problem[], context: string): void {
  expect(firstEarlyRepeat(problems), context).toBeNull();
}

/**
 * Popis prvního porušení AC2 v řadě příkladů jedné skupiny, nebo `null`.
 * Řada se rozdělí po celých vystřídáních (velikost skupiny): každý celý
 * úsek obsahuje každý příklad skupiny právě jednou a poslední neúplný úsek
 * nemá žádný příklad dvakrát.
 */
export function rotationViolation(
  groupProblems: readonly Problem[],
  keys: ReadonlySet<string>,
): string | null {
  const size = keys.size;
  for (let start = 0; start < groupProblems.length; start += size) {
    const section = groupProblems.slice(start, start + size).map(problemKey);
    const outside = section.find((key) => !keys.has(key));
    if (outside !== undefined) {
      return `„${outside}“ do skupiny nepatří`;
    }
    const unique = new Set(section);
    if (unique.size !== section.length) {
      const twice = section.find((key, index) => section.indexOf(key) !== index);
      return `vystřídání od ${start + 1}. příkladu skupiny má „${twice}“ dvakrát`;
    }
  }
  return null;
}

/** AC2 pro jednu skupinu v řadě, jak ji dítě vidělo. */
export function expectRotation(
  problems: readonly Problem[],
  settings: GameSettings,
  group: ProblemGroup,
  context: string,
): void {
  const groupProblems = problems.filter((problem) => groupOf(problem) === group);
  expect(rotationViolation(groupProblems, groupKeys(settings, group)), context).toBeNull();
}

/** Kolik celých vystřídání skupiny řada obsahuje. */
export function fullRotations(
  problems: readonly Problem[],
  settings: GameSettings,
  group: ProblemGroup,
): number {
  const count = problems.filter((problem) => groupOf(problem) === group).length;
  return Math.floor(count / groupKeys(settings, group).size);
}
