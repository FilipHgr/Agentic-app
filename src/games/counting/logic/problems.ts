/**
 * Příklady na sčítání a odčítání v rozsahu z nastavení. Čistý TypeScript
 * bez Phaseru, aby šel tento soubor testovat bez prohlížeče.
 */

import { DEFAULT_SETTINGS } from './settings';
import type { GameSettings, Operation } from './settings';

/** Výchozí rozsah: žádné číslo v příkladu ani výsledek nepřekročí tuto hodnotu. */
export const MAX_SUM = DEFAULT_SETTINGS.maxNumber;

export interface Problem {
  readonly first: number;
  readonly second: number;
  readonly operation: Operation;
  readonly result: number;
}

/** Vrátí celé číslo od 0 do `max` včetně. */
function randomIntUpTo(max: number, random: () => number): number {
  // Ochrana proti generátoru, který by vrátil přesně 1.
  return Math.min(Math.floor(random() * (max + 1)), max);
}

/** Vybere druh příkladu podle nastavení; při „+ −“ náhodně. */
export function pickOperation(settings: GameSettings, random: () => number): Operation {
  switch (settings.operations) {
    case 'plus':
      return 'plus';
    case 'minus':
      return 'minus';
    case 'mixed':
      return random() < 0.5 ? 'plus' : 'minus';
  }
}

/** Stejný příklad má stejné první číslo, znaménko i druhé číslo. */
export function isSameProblem(a: Problem, b: Problem): boolean {
  return a.first === b.first && a.operation === b.operation && a.second === b.second;
}

/**
 * Jak velká část příkladů smí mít nulu. Příklady s nulou („8 + 0“, „6 − 6“)
 * dítě nic nenaučí, ale úplně zmizet nemají. Cíl je nejvýš 1 z 10.
 */
export const ZERO_SHARE = 0.08;

/** Příklad s nulou: nula je v zadání nebo ve výsledku. */
export function hasZero(problem: Problem): boolean {
  return problem.first === 0 || problem.second === 0 || problem.result === 0;
}

/** Všechny příklady daného druhu do rozsahu `max`. */
export function problemsOf(operation: Operation, max: number): Problem[] {
  const problems: Problem[] = [];
  for (let first = 0; first <= max; first += 1) {
    if (operation === 'plus') {
      for (let second = 0; first + second <= max; second += 1) {
        problems.push({ first, second, operation, result: first + second });
      }
    } else {
      for (let second = 0; second <= first; second += 1) {
        problems.push({ first, second, operation, result: first - second });
      }
    }
  }
  return problems;
}

/** Náhodná položka seznamu; u prázdného seznamu `undefined`. */
export function pickFrom<T>(items: readonly T[], random: () => number): T | undefined {
  return items[randomIntUpTo(items.length - 1, random)];
}

/**
 * Vylosuje příklad podle nastavení. Všechna čísla i výsledek jsou celá,
 * nezáporná a nejvýš zvolený rozsah. Příklad s nulou přijde jen asi
 * v `ZERO_SHARE` případů. Nový příklad není stejný jako `previous`.
 * Losování vždy skončí, i když generátor vrací pořád stejné číslo.
 *
 * @param random Generátor v rozsahu [0, 1), ve testech lze podvrhnout.
 * @param previous Příklad, který byl na obrazovce těsně předtím.
 */
export function createProblem(
  settings: GameSettings = DEFAULT_SETTINGS,
  random: () => number = Math.random,
  previous?: Problem,
): Problem {
  const operation = pickOperation(settings, random);
  const candidates = problemsOf(operation, settings.maxNumber).filter(
    (problem) => !previous || !isSameProblem(problem, previous),
  );
  const withZero = candidates.filter(hasZero);
  const withoutZero = candidates.filter((problem) => !hasZero(problem));

  const wantZero = withoutZero.length === 0 || (withZero.length > 0 && random() < ZERO_SHARE);
  const pool = wantZero ? withZero : withoutZero;

  // Rozsah 5 a víc vždy dává několik příkladů, záloha je jen pojistka.
  return pickFrom(pool, random) ?? { first: 1, second: 1, operation: 'plus', result: 2 };
}

/**
 * Uzná odpověď jen tehdy, je-li to celé číslo rovné výsledku.
 * Nesmyslný vstup (prázdný, NaN, desetinný) je prostě špatná odpověď,
 * hráč nikdy neuvidí výjimku.
 */
export function isCorrectAnswer(problem: Problem, answer: unknown): boolean {
  if (typeof answer !== 'number' || !Number.isInteger(answer)) {
    return false;
  }

  return answer === problem.result;
}

/** Levá strana příkladu i s rovnítkem, například „3 + 4 =“ nebo „7 − 3 =“. */
export function formatEquation(problem: Problem): string {
  const sign = problem.operation === 'plus' ? '+' : '−';
  return `${problem.first} ${sign} ${problem.second} =`;
}

/** Text příkladu pro vykreslení, například „3 + 4 = ?“ nebo „7 − 3 = ?“. */
export function formatProblem(problem: Problem): string {
  return `${formatEquation(problem)} ?`;
}
