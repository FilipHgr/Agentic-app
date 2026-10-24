/**
 * Příklady na sčítání do deseti. Čistý TypeScript bez Phaseru,
 * aby šel tento soubor testovat bez prohlížeče.
 */

/** Součet v příkladu nikdy nepřekročí tuto hodnotu. */
export const MAX_SUM = 10;

export interface AdditionProblem {
  readonly first: number;
  readonly second: number;
  readonly result: number;
}

/** Vrátí celé číslo od 0 do `max` včetně. */
function randomIntUpTo(max: number, random: () => number): number {
  return Math.floor(random() * (max + 1));
}

/**
 * Vylosuje příklad na sčítání, jehož součet je nejvýše `MAX_SUM`
 * a obě čísla jsou nezáporná.
 *
 * @param random Generátor v rozsahu [0, 1), ve testech lze podvrhnout.
 */
export function createAdditionProblem(random: () => number = Math.random): AdditionProblem {
  const first = randomIntUpTo(MAX_SUM, random);
  const second = randomIntUpTo(MAX_SUM - first, random);

  return { first, second, result: first + second };
}

/**
 * Uzná odpověď jen tehdy, je-li to celé číslo rovné součtu.
 * Nesmyslný vstup (prázdný, NaN, desetinný) je prostě špatná odpověď,
 * hráč nikdy neuvidí výjimku.
 */
export function isCorrectAnswer(problem: AdditionProblem, answer: unknown): boolean {
  if (typeof answer !== 'number' || !Number.isInteger(answer)) {
    return false;
  }

  return answer === problem.result;
}

/** Text příkladu pro vykreslení, například „3 + 4 = ?“. */
export function formatProblem(problem: AdditionProblem): string {
  return `${problem.first} + ${problem.second} = ?`;
}
