/**
 * Nastavení Porovnávání pro rodiče (#179): do kolika se porovnává, jestli
 * dítě vidí tečky, čísla, nebo tečky s číslem pod nimi, a na co se hra ptá
 * (#182: kde je víc, kde je míň, nebo střídavě). Čistý TypeScript
 * bez Phaseru i bez prohlížeče; uložení řeší
 * `src/games/compare/storage/settingsStorage.ts`.
 */

/** Rozsahy, ze kterých rodič vybírá. */
export const MAX_NUMBER_OPTIONS = [5, 10, 20] as const;

export type MaxNumber = (typeof MAX_NUMBER_OPTIONS)[number];

/** Co dítě na kartě vidí: tečky, číslo, nebo tečky s číslem pod nimi. */
export const SHOW_OPTIONS = ['dots', 'numbers', 'both'] as const;

export type ShowMode = (typeof SHOW_OPTIONS)[number];

/** Na co se hra ptá (#182): kde je víc, kde je míň, nebo střídavě obojí. */
export const QUESTION_OPTIONS = ['more', 'less', 'alternate'] as const;

export type QuestionSetting = (typeof QUESTION_OPTIONS)[number];

export interface CompareSettings {
  readonly maxNumber: MaxNumber;
  readonly show: ShowMode;
  readonly question: QuestionSetting;
}

/**
 * Výchozí nastavení odpovídá hře před přidáním nastavení (#178): tečky
 * do 10 a otázka „kde je víc“.
 */
export const DEFAULT_COMPARE_SETTINGS: CompareSettings = {
  maxNumber: 10,
  show: 'dots',
  question: 'more',
};

/** Je hodnota jeden z rozsahů nastavení? */
export function isMaxNumber(value: unknown): value is MaxNumber {
  return MAX_NUMBER_OPTIONS.some((option) => option === value);
}

/** Je hodnota jeden ze způsobů ukázání? */
export function isShowMode(value: unknown): value is ShowMode {
  return SHOW_OPTIONS.some((option) => option === value);
}

/** Je hodnota jedna z otázek nastavení (#182)? */
export function isQuestionSetting(value: unknown): value is QuestionSetting {
  return QUESTION_OPTIONS.some((option) => option === value);
}

/** Jsou dvě nastavení stejná? */
export function isSameSettings(first: CompareSettings, second: CompareSettings): boolean {
  return (
    first.maxNumber === second.maxNumber &&
    first.show === second.show &&
    first.question === second.question
  );
}

/** Převede nastavení na text pro uložení v zařízení. */
export function serializeCompareSettings(settings: CompareSettings): string {
  return JSON.stringify({
    maxNumber: settings.maxNumber,
    show: settings.show,
    question: settings.question,
  });
}

/**
 * Přečte uložené nastavení (#179 AC5). Chybějící, poškozený nebo neznámý
 * údaj se nahradí výchozí hodnotou, takže hráč nikdy neuvidí chybu.
 * Nastavení uložené před #182 otázku nemá: platí výchozí „kde je víc“.
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
    question: isQuestionSetting(record.question)
      ? record.question
      : DEFAULT_COMPARE_SETTINGS.question,
  };
}
