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

/** Stejný příklad má stejné první číslo, znaménko i druhé číslo. */
export function isSameProblem(a: Problem, b: Problem): boolean {
  return a.first === b.first && a.operation === b.operation && a.second === b.second;
}

/** Všechny příklady, které nastavení dovoluje. */
function allProblems(settings: GameSettings): Problem[] {
  const max = settings.maxNumber;
  const problems: Problem[] = [];

  for (let first = 0; first <= max; first += 1) {
    if (settings.operations !== 'minus') {
      for (let second = 0; first + second <= max; second += 1) {
        problems.push({ first, second, operation: 'plus', result: first + second });
      }
    }
    if (settings.operations !== 'plus') {
      for (let second = 0; second <= first; second += 1) {
        problems.push({ first, second, operation: 'minus', result: first - second });
      }
    }
  }
  return problems;
}

/** Jeden náhodný příklad podle nastavení, bez ohledu na předchozí. */
function drawProblem(settings: GameSettings, random: () => number): Problem {
  return pickOperation(settings, random) === 'plus'
    ? createAddition(settings.maxNumber, random)
    : createSubtraction(settings.maxNumber, random);
}

/**
 * Vylosuje příklad podle nastavení. Všechna čísla i výsledek jsou celá,
 * nezáporná a nejvýš zvolený rozsah. Nový příklad není stejný jako
 * `previous`: když ho losování dá, vybere se náhodně jiný povolený
 * příklad, takže se hra nezasekne ani při pořád stejném losování.
 *
 * @param random Generátor v rozsahu [0, 1), ve testech lze podvrhnout.
 * @param previous Příklad, který byl na obrazovce těsně předtím.
 */
export function createProblem(
  settings: GameSettings = DEFAULT_SETTINGS,
  random: () => number = Math.random,
  previous?: Problem,
): Problem {
  const drawn = drawProblem(settings, random);
  if (!previous || !isSameProblem(drawn, previous)) {
    return drawn;
  }

  const others = allProblems(settings).filter((problem) => !isSameProblem(problem, previous));
  return others[randomIntUpTo(others.length - 1, random)] ?? drawn;
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
