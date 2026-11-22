/**
 * Příklady Porovnávání (#178): dvě karty s 1 až 10 tečkami. Dítě ťukne na
 * kartu s víc tečkami, nebo na „=“, když je jich stejně. Stejný počet má
 * zhruba každý čtvrtý příklad a stejná dvojice (ani prohozená) nepřijde
 * dvakrát po sobě. Čistý TypeScript bez Phaseru.
 */

/** Nejméně a nejvíc teček na kartě; prázdná karta se neukáže. */
export const MIN_DOTS = 1;
export const MAX_DOTS = 10;

/** Jak velká část příkladů má na obou kartách stejně teček. */
export const EQUAL_SHARE = 0.25;

/** Počty teček na levé a pravé kartě (karty jsou vždy vedle sebe). */
export interface CompareProblem {
  readonly left: number;
  readonly right: number;
}

/** Na co dítě ťuklo: levá karta, pravá karta, nebo „=“. */
export type CompareChoice = 'left' | 'right' | 'equal';

/** Znak, který se po správné odpovědi ukáže mezi kartami. Symbol, ne text jazyka. */
export type CompareSign = '>' | '<' | '=';

/** Kam má dítě ťuknout. */
export function correctChoice(problem: CompareProblem): CompareChoice {
  if (problem.left > problem.right) {
    return 'left';
  }
  return problem.left < problem.right ? 'right' : 'equal';
}

/** Znak mezi kartami: levá strana proti pravé. */
export function signOf(problem: CompareProblem): CompareSign {
  switch (correctChoice(problem)) {
    case 'left':
      return '>';
    case 'right':
      return '<';
    case 'equal':
      return '=';
  }
}

/** Stejná dvojice počtů bez ohledu na stranu (3 : 5 i 5 : 3). */
export function isSamePair(first: CompareProblem, second: CompareProblem): boolean {
  const low = (problem: CompareProblem): number => Math.min(problem.left, problem.right);
  const high = (problem: CompareProblem): number => Math.max(problem.left, problem.right);
  return low(first) === low(second) && high(first) === high(second);
}

/** Všechny dvojice se stejným počtem (1 : 1 až 10 : 10). */
function equalPairs(): CompareProblem[] {
  const pairs: CompareProblem[] = [];
  for (let count = MIN_DOTS; count <= MAX_DOTS; count += 1) {
    pairs.push({ left: count, right: count });
  }
  return pairs;
}

/** Všechny dvojice různých počtů, menší číslo vlevo (strana se losuje potom). */
function differentPairs(): CompareProblem[] {
  const pairs: CompareProblem[] = [];
  for (let low = MIN_DOTS; low <= MAX_DOTS; low += 1) {
    for (let high = low + 1; high <= MAX_DOTS; high += 1) {
      pairs.push({ left: low, right: high });
    }
  }
  return pairs;
}

const EQUAL_PAIRS = equalPairs();
const DIFFERENT_PAIRS = differentPairs();

/** Prvek seznamu podle náhody v rozsahu [0, 1). */
function pick<T>(items: readonly T[], random: () => number): T {
  const index = Math.min(items.length - 1, Math.floor(random() * items.length));
  return items[index] as T;
}

/**
 * Další příklad. Nejdřív se losuje, jestli bude stejný počet, pak dvojice
 * z dvojic jiných než minulá. Proto se stejná dvojice nikdy neopakuje
 * a podíl stejných počtů zůstává čtvrtinový.
 *
 * @param previous Minulý příklad, na začátku hry `null`.
 * @param random Náhoda v rozsahu [0, 1).
 */
export function nextProblem(previous: CompareProblem | null, random: () => number): CompareProblem {
  const wantsEqual = random() < EQUAL_SHARE;
  const pool = (wantsEqual ? EQUAL_PAIRS : DIFFERENT_PAIRS).filter(
    (pair) => previous === null || !isSamePair(pair, previous),
  );
  const pair = pick(pool, random);
  if (wantsEqual) {
    return pair;
  }
  // Víc teček je stejně často vlevo jako vpravo.
  return random() < 0.5 ? pair : { left: pair.right, right: pair.left };
}
