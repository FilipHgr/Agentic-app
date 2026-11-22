/**
 * Příklady Porovnávání (#187): „a ☐ b = c“, do okénka patří + nebo −.
 * Všechna čísla jsou 0 až rozsah z nastavení (10 nebo 20). Druhé číslo
 * není nikdy 0, protože pak by platilo obojí. Sčítání i odčítání
 * přijde zhruba v polovině příkladů a stejný příklad nepřijde dvakrát
 * po sobě. Čistý TypeScript bez Phaseru.
 */

import { DEFAULT_COMPARE_SETTINGS } from './compareSettings';
import type { MaxNumber } from './compareSettings';

/** Znaménko do okénka. Symboly, ne texty jazyka („−“ je znak minus). */
export type CompareSign = '+' | '−';

export const COMPARE_SIGNS: readonly CompareSign[] = ['+', '−'];

/** Příklad „a ☐ b = result“. */
export interface CompareProblem {
  readonly a: number;
  readonly b: number;
  readonly result: number;
}

/** Platí příklad se znaménkem `sign`? */
export function holds(problem: CompareProblem, sign: CompareSign): boolean {
  const value = sign === '+' ? problem.a + problem.b : problem.a - problem.b;
  return value === problem.result;
}

/** Znaménko, se kterým příklad platí (u příkladů ze hry vždy právě jedno). */
export function correctSign(problem: CompareProblem): CompareSign {
  return holds(problem, '+') ? '+' : '−';
}

/** Druhé znaménko. */
export function otherSign(sign: CompareSign): CompareSign {
  return sign === '+' ? '−' : '+';
}

export function isSameProblem(first: CompareProblem, second: CompareProblem): boolean {
  return first.a === second.a && first.b === second.b && first.result === second.result;
}

/** Všechny příklady se sčítáním do `max`: a + b = c, b aspoň 1. */
function additions(max: number): CompareProblem[] {
  const problems: CompareProblem[] = [];
  for (let a = 0; a < max; a += 1) {
    for (let b = 1; a + b <= max; b += 1) {
      problems.push({ a, b, result: a + b });
    }
  }
  return problems;
}

/** Všechny příklady s odčítáním do `max`: a − b = c, b aspoň 1, c aspoň 0. */
function subtractions(max: number): CompareProblem[] {
  const problems: CompareProblem[] = [];
  for (let a = 1; a <= max; a += 1) {
    for (let b = 1; b <= a; b += 1) {
      problems.push({ a, b, result: a - b });
    }
  }
  return problems;
}

interface ProblemPools {
  readonly plus: readonly CompareProblem[];
  readonly minus: readonly CompareProblem[];
}

function poolsOf(max: MaxNumber): ProblemPools {
  return { plus: additions(max), minus: subtractions(max) };
}

/** Příklady podle rozsahu; spočítají se jednou při načtení. */
const PROBLEMS_BY_MAX: Readonly<Record<MaxNumber, ProblemPools>> = {
  10: poolsOf(10),
  20: poolsOf(20),
};

/** Všechny příklady, které hra v rozsahu může dát (pro rozložení a testy). */
export function allProblems(maxNumber: MaxNumber): readonly CompareProblem[] {
  const pools = PROBLEMS_BY_MAX[maxNumber];
  return [...pools.plus, ...pools.minus];
}

/** Prvek seznamu podle náhody v rozsahu [0, 1). */
function pick<T>(items: readonly T[], random: () => number): T {
  const index = Math.min(items.length - 1, Math.floor(random() * items.length));
  return items[index] as T;
}

/**
 * Další příklad. Nejdřív se losuje znaménko, pak příklad z příkladů
 * s tímto znaménkem jiných než minulý.
 *
 * @param previous Minulý příklad, na začátku hry `null`.
 * @param random Náhoda v rozsahu [0, 1).
 * @param maxNumber Rozsah z nastavení; žádné číslo ho nepřekročí.
 */
export function nextProblem(
  previous: CompareProblem | null,
  random: () => number,
  maxNumber: MaxNumber = DEFAULT_COMPARE_SETTINGS.maxNumber,
): CompareProblem {
  const pools = PROBLEMS_BY_MAX[maxNumber];
  const pool = random() < 0.5 ? pools.plus : pools.minus;
  const fresh = pool.filter((problem) => previous === null || !isSameProblem(problem, previous));
  return pick(fresh, random);
}
