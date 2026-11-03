/**
 * Nastavení pro rodiče: do kolika se počítá a jaké příklady hra dává.
 * Čistý TypeScript bez Phaseru i bez prohlížeče; uložení řeší
 * `src/storage/settingsStorage.ts`.
 */

/** Rozsahy, ze kterých rodič vybírá. */
export const MAX_NUMBER_OPTIONS = [5, 10, 20] as const;

export type MaxNumber = (typeof MAX_NUMBER_OPTIONS)[number];

/** Druhy příkladů, ze kterých rodič vybírá: jen „+“, jen „−“, nebo obojí. */
export const OPERATION_OPTIONS = ['plus', 'minus', 'mixed'] as const;

export type OperationMode = (typeof OPERATION_OPTIONS)[number];

/** Druh jednoho příkladu. */
export type Operation = 'plus' | 'minus';

export interface GameSettings {
  readonly maxNumber: MaxNumber;
  readonly operations: OperationMode;
}

/** Výchozí nastavení odpovídá hře před přidáním nastavení: sčítání do 10. */
export const DEFAULT_SETTINGS: GameSettings = { maxNumber: 10, operations: 'plus' };

/** Jak dlouho musí rodič držet ozubené kolečko, aby se nastavení otevřelo. */
export const HOLD_TO_OPEN_SETTINGS_MS = 2000;

/** Otevře se nastavení po takto dlouhém držení kolečka? */
export function isHoldLongEnough(heldMs: number): boolean {
  return Number.isFinite(heldMs) && heldMs >= HOLD_TO_OPEN_SETTINGS_MS;
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
  return {
    maxNumber: isMaxNumber(record.maxNumber) ? record.maxNumber : DEFAULT_SETTINGS.maxNumber,
    operations: isOperationMode(record.operations)
      ? record.operations
      : DEFAULT_SETTINGS.operations,
  };
}
