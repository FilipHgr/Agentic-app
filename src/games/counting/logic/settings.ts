/**
 * Nastavení pro rodiče: do kolika se počítá, jaké příklady hra dává
 * a jestli dítě odpovídá číselníkem, nebo psaním.
 * Čistý TypeScript bez Phaseru i bez prohlížeče; uložení řeší
 * `src/games/counting/storage/settingsStorage.ts`.
 */

/** Rozsahy, ze kterých rodič vybírá. */
export const MAX_NUMBER_OPTIONS = [5, 10, 20] as const;

export type MaxNumber = (typeof MAX_NUMBER_OPTIONS)[number];

/** Druhy příkladů, ze kterých rodič vybírá: jen „+“, jen „−“, nebo obojí. */
export const OPERATION_OPTIONS = ['plus', 'minus', 'mixed'] as const;

export type OperationMode = (typeof OPERATION_OPTIONS)[number];

/** Druh jednoho příkladu. */
export type Operation = 'plus' | 'minus';

/** Jak dítě odpovídá: ťuká na číselník, nebo píše číslici prstem (#41). */
export const ANSWER_INPUT_OPTIONS = ['keypad', 'writing'] as const;

export type AnswerInput = (typeof ANSWER_INPUT_OPTIONS)[number];

export interface GameSettings {
  readonly maxNumber: MaxNumber;
  readonly operations: OperationMode;
  /** Chybí ve starších uložených nastaveních, pak platí číselník. */
  readonly answerInput?: AnswerInput;
}

/** Výchozí nastavení odpovídá hře před přidáním nastavení: sčítání do 10. */
export const DEFAULT_SETTINGS: GameSettings = { maxNumber: 10, operations: 'plus' };

/** Způsob odpovědi zvolený rodičem; bez volby číselník. */
export function answerInputOf(settings: GameSettings): AnswerInput {
  return isAnswerInput(settings.answerInput) ? settings.answerInput : 'keypad';
}

/** Odpovídá dítě teď psaním? Když ho rodič zvolil, v každém rozsahu (#42). */
export function isWritingActive(settings: GameSettings): boolean {
  return answerInputOf(settings) === 'writing';
}

/**
 * Kolik okének na psaní dítě má: při rozsahu 5 jedno, při 10 a 20 dvě
 * (desítky a jednotky), i když je výsledek jednociferný, aby rozložení
 * výsledek neprozradilo.
 */
export function writingBoxCount(maxNumber: MaxNumber): 1 | 2 {
  return maxNumber === 5 ? 1 : 2;
}

function isAnswerInput(value: unknown): value is AnswerInput {
  return ANSWER_INPUT_OPTIONS.some((option) => option === value);
}

function isMaxNumber(value: unknown): value is MaxNumber {
  return MAX_NUMBER_OPTIONS.some((option) => option === value);
}

function isOperationMode(value: unknown): value is OperationMode {
  return OPERATION_OPTIONS.some((option) => option === value);
}

/** Převede nastavení na text pro uložení v zařízení. */
export function serializeSettings(settings: GameSettings): string {
  return JSON.stringify(settings);
}

/**
 * Přečte uložené nastavení. Chybějící, poškozený nebo neznámý údaj se nahradí
 * výchozí hodnotou, takže hráč nikdy neuvidí chybu.
 */
export function parseSettings(saved: string | null | undefined): GameSettings {
  if (typeof saved !== 'string' || saved === '') {
    return DEFAULT_SETTINGS;
  }

  let data: unknown;
  try {
    data = JSON.parse(saved);
  } catch {
    // Poškozený záznam je stejný případ jako chybějící.
    return DEFAULT_SETTINGS;
  }

  if (typeof data !== 'object' || data === null) {
    return DEFAULT_SETTINGS;
  }

  const record = data as Record<string, unknown>;
  const settings: GameSettings = {
    maxNumber: isMaxNumber(record.maxNumber) ? record.maxNumber : DEFAULT_SETTINGS.maxNumber,
    operations: isOperationMode(record.operations)
      ? record.operations
      : DEFAULT_SETTINGS.operations,
  };
  // Neznámá nebo chybějící volba se vynechá, `answerInputOf` pak vrátí číselník.
  return isAnswerInput(record.answerInput)
    ? { ...settings, answerInput: record.answerInput }
    : settings;
}

/**
 * První spuštění (#48): uložené nastavení chybí, je prázdné, není JSON, není
 * objekt, nebo nemá platný rozsah a druh příkladů. Chybějící nebo neznámý
 * způsob odpovědi první spuštění není (bere se jako číselník).
 */
export function isFirstLaunch(saved: string | null | undefined): boolean {
  if (typeof saved !== 'string' || saved === '') {
    return true;
  }

  let data: unknown;
  try {
    data = JSON.parse(saved);
  } catch {
    // Nečitelný záznam je stejný případ jako chybějící.
    return true;
  }

  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return true;
  }
  const record = data as Record<string, unknown>;
  return !(isMaxNumber(record.maxNumber) && isOperationMode(record.operations));
}
