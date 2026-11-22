/**
 * Příklady hry Znaménka (dřív Porovnávání). Dva druhy podle řady
 * „Znaménka“ v nastavení (#190):
 *
 * - „a ☐ b = c“ (#187), do okénka patří + nebo −. Druhé číslo není nikdy
 *   0, protože pak by platilo obojí. Sčítání i odčítání přijde zhruba
 *   v polovině příkladů.
 * - „a ☐ b“ (#190), do okénka patří <, = nebo >. „=“ (stejná čísla)
 *   přijde asi ve čtvrtině příkladů, < a > ve zbytku zhruba stejně.
 *
 * Při volbě „vše“ se oba druhy střídají zhruba napůl. Všechna čísla jsou
 * 0 až rozsah z nastavení (10 nebo 20) a stejný příklad nepřijde dvakrát
 * po sobě. Čistý TypeScript bez Phaseru.
 */

import { DEFAULT_COMPARE_SETTINGS } from './compareSettings';
import type { MaxNumber, SignKind } from './compareSettings';

/** Znaménko do „a ☐ b = c“. Symboly, ne texty jazyka („−“ je znak minus). */
export type ArithmeticSign = '+' | '−';

/** Znaménko do „a ☐ b“ (#190). */
export type RelationSign = '<' | '=' | '>';

/** Jakékoli znaménko do okénka. */
export type CompareSign = ArithmeticSign | RelationSign;

/** Tlačítka u „a ☐ b = c“ zleva doprava. */
export const COMPARE_SIGNS: readonly ArithmeticSign[] = ['+', '−'];

/** Tlačítka u „a ☐ b“ zleva doprava (#190 AC4). */
export const RELATION_SIGNS: readonly RelationSign[] = ['<', '=', '>'];

/** Příklad „a ☐ b = result“. */
export interface ArithmeticProblem {
  readonly kind: 'arithmetic';
  readonly a: number;
  readonly b: number;
  readonly result: number;
}

/** Příklad „a ☐ b“ (#190). */
export interface RelationProblem {
  readonly kind: 'relation';
  readonly a: number;
  readonly b: number;
}

export type CompareProblem = ArithmeticProblem | RelationProblem;

/** Druh příkladu: „a ☐ b = c“, nebo „a ☐ b“. */
export type ProblemKind = CompareProblem['kind'];

/** Znaménka, ze kterých dítě u příkladu vybírá, v pořadí tlačítek. */
export function signsFor(problem: CompareProblem): readonly CompareSign[] {
  return problem.kind === 'relation' ? RELATION_SIGNS : COMPARE_SIGNS;
}

/** Platí příklad se znaménkem `sign`? Znaménko jiného druhu neplatí nikdy. */
export function holds(problem: CompareProblem, sign: CompareSign): boolean {
  if (problem.kind === 'relation') {
    return relationOf(problem) === sign;
  }
  if (sign === '+') {
    return problem.a + problem.b === problem.result;
  }
  if (sign === '−') {
    return problem.a - problem.b === problem.result;
  }
  return false;
}

/** Znaménko mezi dvěma čísly. */
function relationOf(problem: RelationProblem): RelationSign {
  if (problem.a < problem.b) {
    return '<';
  }
  return problem.a > problem.b ? '>' : '=';
}

/** Znaménko, se kterým příklad platí (u příkladů ze hry vždy právě jedno). */
export function correctSign(problem: CompareProblem): CompareSign {
  if (problem.kind === 'relation') {
    return relationOf(problem);
  }
  return holds(problem, '+') ? '+' : '−';
}

/** Jiné znaménko stejného druhu: u + − to druhé, u < = > první další v pořadí tlačítek. */
export function otherSign(sign: CompareSign): CompareSign {
  switch (sign) {
    case '+':
      return '−';
    case '−':
      return '+';
    case '<':
      return '=';
    case '=':
      return '>';
    case '>':
      return '<';
  }
}

export function isSameProblem(first: CompareProblem, second: CompareProblem): boolean {
  if (first.kind === 'relation' || second.kind === 'relation') {
    return first.kind === second.kind && first.a === second.a && first.b === second.b;
  }
  return first.a === second.a && first.b === second.b && first.result === second.result;
}

/** Všechny příklady se sčítáním do `max`: a + b = c, b aspoň 1. */
function additions(max: number): ArithmeticProblem[] {
  const problems: ArithmeticProblem[] = [];
  for (let a = 0; a < max; a += 1) {
    for (let b = 1; a + b <= max; b += 1) {
      problems.push({ kind: 'arithmetic', a, b, result: a + b });
    }
  }
  return problems;
}

/** Všechny příklady s odčítáním do `max`: a − b = c, b aspoň 1, c aspoň 0. */
function subtractions(max: number): ArithmeticProblem[] {
  const problems: ArithmeticProblem[] = [];
  for (let a = 1; a <= max; a += 1) {
    for (let b = 1; b <= a; b += 1) {
      problems.push({ kind: 'arithmetic', a, b, result: a - b });
    }
  }
  return problems;
}

/** Všechny dvojice „a ☐ b“ do `max`, buď se stejnými, nebo s různými čísly. */
function relations(max: number, equal: boolean): RelationProblem[] {
  const problems: RelationProblem[] = [];
  for (let a = 0; a <= max; a += 1) {
    for (let b = 0; b <= max; b += 1) {
      if ((a === b) === equal) {
        problems.push({ kind: 'relation', a, b });
      }
    }
  }
  return problems;
}

interface ProblemPools {
  readonly plus: readonly ArithmeticProblem[];
  readonly minus: readonly ArithmeticProblem[];
  readonly equal: readonly RelationProblem[];
  readonly unequal: readonly RelationProblem[];
}

function poolsOf(max: MaxNumber): ProblemPools {
  return {
    plus: additions(max),
    minus: subtractions(max),
    equal: relations(max, true),
    unequal: relations(max, false),
  };
}

/** Příklady podle rozsahu; spočítají se jednou při načtení. */
const PROBLEMS_BY_MAX: Readonly<Record<MaxNumber, ProblemPools>> = {
  10: poolsOf(10),
  20: poolsOf(20),
};

/** Jak často u „a ☐ b“ patří do okénka „=“ (#190 AC3: asi ve čtvrtině). */
const EQUAL_SHARE = 0.25;

/** Všechny příklady „a ☐ b = c“, které hra v rozsahu může dát (pro rozložení a testy). */
export function allProblems(maxNumber: MaxNumber): readonly ArithmeticProblem[] {
  const pools = PROBLEMS_BY_MAX[maxNumber];
  return [...pools.plus, ...pools.minus];
}

/** Všechny příklady „a ☐ b“, které hra v rozsahu může dát (pro rozložení a testy). */
export function allRelationProblems(maxNumber: MaxNumber): readonly RelationProblem[] {
  const pools = PROBLEMS_BY_MAX[maxNumber];
  return [...pools.equal, ...pools.unequal];
}

/** Prvek seznamu podle náhody v rozsahu [0, 1). */
function pick<T>(items: readonly T[], random: () => number): T {
  const index = Math.min(items.length - 1, Math.floor(random() * items.length));
  return items[index] as T;
}

/** Druh dalšího příkladu podle volby rodiče; u „vše“ napůl. */
function nextKind(signKind: SignKind, random: () => number): ProblemKind {
  switch (signKind) {
    case 'plusMinus':
      return 'arithmetic';
    case 'comparison':
      return 'relation';
    case 'all':
      return random() < 0.5 ? 'arithmetic' : 'relation';
  }
}

/** Skupina příkladů, ze které se losuje: nejdřív se losuje znaménko. */
function poolFor(
  kind: ProblemKind,
  pools: ProblemPools,
  random: () => number,
): readonly CompareProblem[] {
  if (kind === 'arithmetic') {
    return random() < 0.5 ? pools.plus : pools.minus;
  }
  return random() < EQUAL_SHARE ? pools.equal : pools.unequal;
}

/**
 * Další příklad. Nejdřív se losuje druh (jen u „vše“), pak znaménko a pak
 * příklad z příkladů s tímto znaménkem jiných než minulý.
 *
 * @param previous Minulý příklad, na začátku hry `null`.
 * @param random Náhoda v rozsahu [0, 1).
 * @param maxNumber Rozsah z nastavení; žádné číslo ho nepřekročí.
 * @param signKind Řada „Znaménka“ z nastavení (#190).
 */
export function nextProblem(
  previous: CompareProblem | null,
  random: () => number,
  maxNumber: MaxNumber = DEFAULT_COMPARE_SETTINGS.maxNumber,
  signKind: SignKind = DEFAULT_COMPARE_SETTINGS.signKind,
): CompareProblem {
  const pool = poolFor(nextKind(signKind, random), PROBLEMS_BY_MAX[maxNumber], random);
  const fresh = pool.filter((problem) => previous === null || !isSameProblem(problem, previous));
  return pick(fresh, random);
}
