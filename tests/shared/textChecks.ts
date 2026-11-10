/**
 * Pomůcky pro testy textů po jazycích (#65 AC4): kontrola, že jazyk má
 * přesně stejné klíče jako čeština, žádný text není prázdný a věty mají
 * předepsaný počet řádků. Zpráva o chybě vždy obsahuje jazyk, část
 * (sdílená nebo hra) a klíč, aby šlo chybu hned najít v souboru jazyka.
 *
 * Slovníky jsou volné (`unknown`), aby šly v testech vytvořit i umělé
 * jazyky, které češtině neodpovídají, a `npm run build` přesto prošel.
 */

/** Soubor jazyka se jmenuje podle kódu jazyka: `cs.ts`, `en.ts`, `pt-BR.ts`. */
const LANGUAGE_FILE = /\/([a-z]{2,3}(?:-[A-Z]{2})?)\.ts$/;

/** Kód jazyka ze jména souboru, nebo `null`, když soubor není soubor jazyka. */
export function languageOfFile(path: string): string | null {
  return LANGUAGE_FILE.exec(path)?.[1] ?? null;
}

/**
 * Slovníky ze souborů jazyků podle kódu jazyka. Dostane výsledek
 * `import.meta.glob(…, { eager: true })`; soubor jazyka vrací slovník jako
 * `export default`.
 */
export function dictionariesByLanguage(
  modules: Record<string, unknown>,
): Record<string, Record<string, unknown>> {
  const result: Record<string, Record<string, unknown>> = {};
  for (const [path, module] of Object.entries(modules)) {
    const language = languageOfFile(path);
    if (language === null) {
      continue;
    }
    const dictionary = (module as { default?: unknown }).default;
    result[language] = isDictionary(dictionary) ? dictionary : {};
  }
  return result;
}

export interface TextCheck {
  readonly language: string;
  /** „sdílená část“ nebo název hry, třeba „Počítání“. */
  readonly part: string;
  /** Čeština, podle které se porovnávají klíče. */
  readonly reference: Record<string, unknown>;
  readonly texts: Record<string, unknown>;
  /** Klíče, které jsou věta průvodce: přesně dva neprázdné řádky. */
  readonly isTwoLineKey?: (key: string) => boolean;
  /** Klíče se seznamem, který smí být prázdný (třeba seznam předložek). */
  readonly mayBeEmptyList?: (key: string) => boolean;
}

function isDictionary(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Listy slovníku podle klíče s tečkami (`rowLabels.maxNumber`); seznamy jsou list. */
export function leavesOf(dictionary: Record<string, unknown>, prefix = ''): Map<string, unknown> {
  const leaves = new Map<string, unknown>();
  for (const [key, value] of Object.entries(dictionary)) {
    const path = prefix === '' ? key : `${prefix}.${key}`;
    if (isDictionary(value)) {
      for (const [childPath, childValue] of leavesOf(value, path)) {
        leaves.set(childPath, childValue);
      }
    } else {
      leaves.set(path, value);
    }
  }
  return leaves;
}

function isBlank(value: unknown): boolean {
  return typeof value !== 'string' || value.trim() === '';
}

/** Všechny nalezené chyby jednoho jazyka v jedné části; prázdný seznam = v pořádku. */
export function findTextProblems(check: TextCheck): string[] {
  const where = (key: string): string => `jazyk ${check.language}, ${check.part}, klíč ${key}`;
  const reference = leavesOf(check.reference);
  const texts = leavesOf(check.texts);
  const problems: string[] = [];

  for (const key of reference.keys()) {
    if (!texts.has(key)) {
      problems.push(`${where(key)}: chybí`);
    }
  }
  for (const [key, value] of texts) {
    if (!reference.has(key)) {
      problems.push(`${where(key)}: navíc, čeština ho nemá`);
      continue;
    }
    problems.push(
      ...valueProblems(check, key, value).map((problem) => `${where(key)}: ${problem}`),
    );
  }
  return problems;
}

function valueProblems(check: TextCheck, key: string, value: unknown): string[] {
  if (check.isTwoLineKey?.(key) === true) {
    if (!Array.isArray(value) || value.length !== 2) {
      return ['věta průvodce musí mít přesně dva řádky'];
    }
    return value.some(isBlank) ? ['řádek věty průvodce je prázdný'] : [];
  }
  if (Array.isArray(value)) {
    if (value.length === 0 && check.mayBeEmptyList?.(key) !== true) {
      return ['seznam je prázdný'];
    }
    return value.some(isBlank) ? ['seznam obsahuje prázdný text'] : [];
  }
  return isBlank(value) ? ['text je prázdný'] : [];
}
