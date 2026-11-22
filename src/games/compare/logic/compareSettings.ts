/**
 * Nastavení Porovnávání pro rodiče (#179): do kolika se porovnává a jestli
 * dítě vidí tečky, čísla, nebo tečky s číslem pod nimi. Čistý TypeScript
 * bez Phaseru i bez prohlížeče; uložení řeší
 * `src/games/compare/storage/settingsStorage.ts`.
 */

/** Rozsahy, ze kterých rodič vybírá. */
export const MAX_NUMBER_OPTIONS = [5, 10, 20] as const;

export type MaxNumber = (typeof MAX_NUMBER_OPTIONS)[number];

/** Co dítě na kartě vidí: tečky, číslo, nebo tečky s číslem pod nimi. */
export const SHOW_OPTIONS = ['dots', 'numbers', 'both'] as const;

export type ShowMode = (typeof SHOW_OPTIONS)[number];

export interface CompareSettings {
  readonly maxNumber: MaxNumber;
  readonly show: ShowMode;
}

/** Výchozí nastavení odpovídá hře před přidáním nastavení (#178): tečky do 10. */
export const DEFAULT_COMPARE_SETTINGS: CompareSettings = { maxNumber: 10, show: 'dots' };

/** Je hodnota jeden z rozsahů nastavení? */
export function isMaxNumber(value: unknown): value is MaxNumber {
  return MAX_NUMBER_OPTIONS.some((option) => option === value);
}

/** Je hodnota jeden ze způsobů ukázání? */
export function isShowMode(value: unknown): value is ShowMode {
  return SHOW_OPTIONS.some((option) => option === value);
}

/** Jsou dvě nastavení stejná? */
export function isSameSettings(first: CompareSettings, second: CompareSettings): boolean {
  return first.maxNumber === second.maxNumber && first.show === second.show;
}

/** Převede nastavení na text pro uložení v zařízení. */
export function serializeCompareSettings(settings: CompareSettings): string {
  return JSON.stringify({ maxNumber: settings.maxNumber, show: settings.show });
}

/**
 * Přečte uložené nastavení (#179 AC5). Chybějící, poškozený nebo neznámý
 * údaj se nahradí výchozí hodnotou, takže hráč nikdy neuvidí chybu.
 */
export function parseCompareSettings(saved: string | null | undefined): CompareSettings {
  if (typeof saved !== 'string' || saved === '') {
    return DEFAULT_COMPARE_SETTINGS;
  }
  let data: unknown;
  try {
    data = JSON.parse(saved);
  } catch {
    // Poškozený záznam je stejný případ jako chybějící.
    return DEFAULT_COMPARE_SETTINGS;
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return DEFAULT_COMPARE_SETTINGS;
  }
  const record = data as Record<string, unknown>;
  return {
    maxNumber: isMaxNumber(record.maxNumber)
      ? record.maxNumber
      : DEFAULT_COMPARE_SETTINGS.maxNumber,
    show: isShowMode(record.show) ? record.show : DEFAULT_COMPARE_SETTINGS.show,
  };
}
