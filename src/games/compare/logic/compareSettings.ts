/**
 * Nastavení hry Znaménka pro rodiče (#179, #187, #188, #190): jaká
 * znaménka dítě doplňuje (+ − do „a ☐ b = c“, < = > do „a ☐ b“, nebo
 * obojí), do kolika jdou čísla (do 10, nebo do 20) a jak dítě znaménko
 * doplní (ťuknutím, nebo psaním prstem do okénka). Čistý
 * TypeScript bez Phaseru i bez prohlížeče; uložení řeší
 * `src/games/compare/storage/settingsStorage.ts`.
 */

/** Rozsahy, ze kterých rodič vybírá (#187 AC3). */
export const MAX_NUMBER_OPTIONS = [10, 20] as const;

export type MaxNumber = (typeof MAX_NUMBER_OPTIONS)[number];

/** Jak dítě znaménko doplní (#188 AC1): ťuknutím na + a −, nebo psaním prstem. */
export const ANSWER_INPUT_OPTIONS = ['tap', 'writing'] as const;

export type AnswerInput = (typeof ANSWER_INPUT_OPTIONS)[number];

/**
 * Jaká znaménka dítě doplňuje (#190 AC2): + − do „a ☐ b = c“, < = >
 * do „a ☐ b“, nebo obojí střídavě.
 */
export const SIGN_KIND_OPTIONS = ['plusMinus', 'comparison', 'all'] as const;

export type SignKind = (typeof SIGN_KIND_OPTIONS)[number];

export interface CompareSettings {
  readonly maxNumber: MaxNumber;
  readonly answerInput: AnswerInput;
  readonly signKind: SignKind;
}

/** Výchozí nastavení: + −, příklady do 10, znaménko ťuknutím. */
export const DEFAULT_COMPARE_SETTINGS: CompareSettings = {
  maxNumber: 10,
  answerInput: 'tap',
  signKind: 'plusMinus',
};

/** Je hodnota jeden z rozsahů nastavení? */
export function isMaxNumber(value: unknown): value is MaxNumber {
  return MAX_NUMBER_OPTIONS.some((option) => option === value);
}

/** Je hodnota jeden ze způsobů odpovědi? */
export function isAnswerInput(value: unknown): value is AnswerInput {
  return ANSWER_INPUT_OPTIONS.some((option) => option === value);
}

/** Je hodnota jedna z voleb řady „Znaménka“? */
export function isSignKind(value: unknown): value is SignKind {
  return SIGN_KIND_OPTIONS.some((option) => option === value);
}

/** Jsou dvě nastavení stejná? */
export function isSameSettings(first: CompareSettings, second: CompareSettings): boolean {
  return (
    first.maxNumber === second.maxNumber &&
    first.answerInput === second.answerInput &&
    first.signKind === second.signKind
  );
}

/** Převede nastavení na text pro uložení v zařízení. */
export function serializeCompareSettings(settings: CompareSettings): string {
  return JSON.stringify({
    maxNumber: settings.maxNumber,
    answerInput: settings.answerInput,
    signKind: settings.signKind,
  });
}

/**
 * Přečte uložené nastavení (#179 AC5, #187 AC3, #188 AC1). Chybějící,
 * poškozený nebo neznámý údaj se nahradí výchozí hodnotou, takže hráč
 * nikdy neuvidí chybu. Nastavení ze hry s tečkami (#179–#182) mohlo mít
 * rozsah 5 a volby „Ukázat“ a „Otázka“: rozsah 5 dá nejbližší rozsah 10,
 * ostatní volby se zahodí. Nastavení z doby před #188 nemá způsob
 * odpovědi: dítě pak ťuká. Nastavení z doby před #190 nemá řadu
 * „Znaménka“: dítě pak doplňuje + −.
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
  const maxNumber = isMaxNumber(record.maxNumber)
    ? record.maxNumber
    : DEFAULT_COMPARE_SETTINGS.maxNumber;
  const answerInput = isAnswerInput(record.answerInput)
    ? record.answerInput
    : DEFAULT_COMPARE_SETTINGS.answerInput;
  const signKind = isSignKind(record.signKind)
    ? record.signKind
    : DEFAULT_COMPARE_SETTINGS.signKind;
  return { maxNumber, answerInput, signKind };
}
