/**
 * Jak hra popíše svůj přehled pro rodiče (#192) a jak se v záznamu chyb
 * píšou příklady. Menu čte záznamy her bez kódu her, proto hra popis
 * (`GameOverviewSpec`) dává menu jako data v `meta.ts` a příklady ukládá
 * jako krátký text ve společném tvaru:
 *
 * - `8+5`, `9-3` příklad s výsledkem, který z čísel vyplývá (Počítání),
 * - `7?5=2` doplň znaménko + nebo − (Znaménka, #187),
 * - `7?5` doplň znaménko <, = nebo > (Znaménka, #190).
 *
 * Čísla jsou bez úvodních nul a nejvýš do `maxNumber` hry. Čistý
 * TypeScript bez Phaseru.
 */

/** Druh příkladu s vlastním podílem napoprvé na stránce Chyby (Počítání: sčítání a odčítání). */
export type OverviewOperation = 'plus' | 'minus';

/** Tvar příkladu v záznamu chyb. */
export type OverviewProblemForm = 'equation' | 'missingSign' | 'comparison';

/**
 * Popis přehledu hry: jaké příklady se v jejím záznamu smí objevit a co
 * stránka Chyby ukáže. Záznam s jinými příklady je poškozený.
 */
export interface GameOverviewSpec {
  /** Největší číslo, které hra v příkladu může dát (nejvyšší rozsah nastavení). */
  readonly maxNumber: number;
  /** Tvary příkladů, které hra zapisuje. */
  readonly problemForms: readonly OverviewProblemForm[];
  /** Druhy příkladů s podílem napoprvé, v pořadí stránky Chyby; bez nich nic. */
  readonly operations: readonly OverviewOperation[];
  /** Počítá hra ťuknutí na nápovědu (řádek „Nápověda za týden“)? */
  readonly hints: boolean;
}

/** Číslo bez úvodních nul, nejvýš dvoumístné. */
const NUMBER = '(0|[1-9]\\d?)';

/** `a`, znak, `b` a u doplnění znaménka ještě `=c`. */
const PROBLEM_KEY_PATTERN = new RegExp(`^${NUMBER}([+\\-?])${NUMBER}(?:=${NUMBER})?$`);

/** Příklad ze záznamu rozložený na čísla. */
interface ParsedProblem {
  readonly form: OverviewProblemForm;
  readonly first: number;
  readonly second: number;
  /** `+` nebo `-` u příkladu s výsledkem, jinak `?`. */
  readonly sign: '+' | '-' | '?';
  /** Výsledek u doplnění znaménka + −. */
  readonly result: number | null;
}

/** Příklad s výsledkem: `8+5`, `9-3`. */
export function equationKey(first: number, operation: OverviewOperation, second: number): string {
  return `${first}${operation === 'plus' ? '+' : '-'}${second}`;
}

/** Doplň znaménko + nebo −: `7?5=2`. */
export function missingSignKey(first: number, second: number, result: number): string {
  return `${first}?${second}=${result}`;
}

/** Doplň znaménko <, = nebo >: `7?5`. */
export function comparisonKey(first: number, second: number): string {
  return `${first}?${second}`;
}

function parseProblem(key: string): ParsedProblem | null {
  const match = PROBLEM_KEY_PATTERN.exec(key);
  if (match === null) {
    return null;
  }
  const first = Number(match[1]);
  const sign = match[2] as ParsedProblem['sign'];
  const second = Number(match[3]);
  const result = match[4] === undefined ? null : Number(match[4]);
  if (sign === '?') {
    const form = result === null ? 'comparison' : 'missingSign';
    return { form, first, second, sign, result };
  }
  // Výsledek se u příkladu s + a − nepíše, vyplývá z čísel.
  return result === null ? { form: 'equation', first, second, sign, result } : null;
}

/** Jde takový příklad ve hře dostat (tvar, čísla i výsledek nejvýš do `maxNumber`)? */
function isPossible(problem: ParsedProblem, maxNumber: number): boolean {
  const { first, second, result } = problem;
  if (first > maxNumber || second > maxNumber) {
    return false;
  }
  switch (problem.form) {
    case 'equation':
      return problem.sign === '+' ? first + second <= maxNumber : second <= first;
    case 'missingSign':
      // S druhým číslem 0 by platilo + i −, takový příklad hra nedá.
      return (
        result !== null &&
        result <= maxNumber &&
        second > 0 &&
        (first + second === result || first - second === result)
      );
    case 'comparison':
      return true;
  }
}

/** Smí se příklad `key` objevit v záznamu hry s popisem `spec`? */
export function isProblemOf(key: string, spec: GameOverviewSpec): boolean {
  const problem = parseProblem(key);
  return (
    problem !== null &&
    spec.problemForms.includes(problem.form) &&
    isPossible(problem, spec.maxNumber)
  );
}

/**
 * Příklad, jak ho dítě vidělo: „8 + 5“, „9 − 3“, „7 ☐ 5 = 2“ nebo „7 ☐ 5“.
 * Znaménka a okénko jsou symboly, ne texty jazyka. Neznámý text vrátí, jak je.
 */
export function formatOverviewProblem(key: string): string {
  const problem = parseProblem(key);
  if (problem === null) {
    return key;
  }
  const signs = { '+': '+', '-': '−', '?': '☐' } as const;
  const terms = `${problem.first} ${signs[problem.sign]} ${problem.second}`;
  return problem.result === null ? terms : `${terms} = ${problem.result}`;
}
