/**
 * Nastavení Porovnávání pro rodiče (#179, od #187 jen rozsah): do kolika
 * jdou čísla příkladu „a ☐ b = c“, do 10, nebo do 20. Čistý TypeScript
 * bez Phaseru i bez prohlížeče; uložení řeší
 * `src/games/compare/storage/settingsStorage.ts`.
 */

/** Rozsahy, ze kterých rodič vybírá (#187 AC3). */
export const MAX_NUMBER_OPTIONS = [10, 20] as const;

export type MaxNumber = (typeof MAX_NUMBER_OPTIONS)[number];

export interface CompareSettings {
  readonly maxNumber: MaxNumber;
}

/** Výchozí nastavení: příklady do 10. */
export const DEFAULT_COMPARE_SETTINGS: CompareSettings = { maxNumber: 10 };

/** Je hodnota jeden z rozsahů nastavení? */
export function isMaxNumber(value: unknown): value is MaxNumber {
  return MAX_NUMBER_OPTIONS.some((option) => option === value);
}

/** Jsou dvě nastavení stejná? */
export function isSameSettings(first: CompareSettings, second: CompareSettings): boolean {
  return first.maxNumber === second.maxNumber;
}

/** Převede nastavení na text pro uložení v zařízení. */
export function serializeCompareSettings(settings: CompareSettings): string {
  return JSON.stringify({ maxNumber: settings.maxNumber });
}

/**
 * Přečte uložené nastavení (#179 AC5, #187 AC3). Chybějící, poškozený
 * nebo neznámý údaj se nahradí výchozí hodnotou, takže hráč nikdy neuvidí
 * chybu. Nastavení ze hry s tečkami (#179–#182) mohlo mít rozsah 5
 * a volby „Ukázat“ a „Otázka“: rozsah 5 dá nejbližší rozsah 10, ostatní
 * volby se zahodí.
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
  const maxNumber = (data as Record<string, unknown>).maxNumber;
  return isMaxNumber(maxNumber) ? { maxNumber } : DEFAULT_COMPARE_SETTINGS;
}
