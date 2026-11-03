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

/** Sčítání: obě čísla nezáporná a součet nejvýš `max`. */
function createAddition(max: number, random: () => number): Problem {
  const first = randomIntUpTo(max, random);
  const second = randomIntUpTo(max - first, random);
  return { first, second, operation: 'plus', result: first + second };
}

/** Odčítání: první číslo nejvýš `max`, odečítá se nejvýš tolik, aby výsledek nebyl záporný. */
function createSubtraction(max: number, random: () => number): Problem {
  const first = randomIntUpTo(max, random);
  const second = randomIntUpTo(first, random);
  return { first, second, operation: 'minus', result: first - second };
}

/** Vybere druh příkladu podle nastavení; při „+ −“ náhodně. */
function pickOperation(settings: GameSettings, random: () => number): Operation {
  switch (settings.operations) {
    case 'plus':
      return 'plus';
    case 'minus':
      return 'minus';
    case 'mixed':
      return random() < 0.5 ? 'plus' : 'minus';
  }
}

/**
 * Vylosuje příklad podle nastavení. Všechna čísla i výsledek jsou celá,
 * nezáporná a nejvýš zvolený rozsah.
 *
 * @param random Generátor v rozsahu [0, 1), ve testech lze podvrhnout.
 */
export function createProblem(
  settings: GameSettings = DEFAULT_SETTINGS,
  random: () => number = Math.random,
): Problem {
  return pickOperation(settings, random) === 'plus'
    ? createAddition(settings.maxNumber, random)
    : createSubtraction(settings.maxNumber, random);
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

/** Text příkladu pro vykreslení, například „3 + 4 = ?“ nebo „7 − 3 = ?“. */
export function formatProblem(problem: Problem): string {
  const sign = problem.operation === 'plus' ? '+' : '−';
  return `${problem.first} ${sign} ${problem.second} = ?`;
}
