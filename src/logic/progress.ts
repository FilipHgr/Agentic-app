/**
 * Postup hráče, který přežije zavření hry: hvězdičky v aktuální řadě
 * a postavička, se kterou hraje. Čistý TypeScript bez prohlížeče;
 * uložení řeší `src/storage/progressStorage.ts`.
 */

import { CHARACTERS, FIRST_CHARACTER, nextCharacter } from './characters';
import type { CharacterId } from './characters';
import { STARS_PER_SET } from './stars';
import type { StarProgress } from './stars';

export interface GameProgress extends StarProgress {
  readonly character: CharacterId;
}

/** Začátek hry: prázdná řada hvězdiček a Hvězdík. */
export const START_PROGRESS: GameProgress = { earned: 0, character: FIRST_CHARACTER };

function isCharacterId(value: unknown): value is CharacterId {
  return CHARACTERS.some((character) => character === value);
}

function isStarCount(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0 && (value as number) <= STARS_PER_SET;
}

/** Převede postup na text pro uložení v zařízení. */
export function serializeProgress(progress: GameProgress): string {
  return JSON.stringify({ earned: progress.earned, character: progress.character });
}

/**
 * Postup, se kterým hra začne po znovuotevření. Chybějící, poškozený nebo
 * nesmyslný záznam se zahodí celý a hra začne od začátku. Plná řada znamená,
 * že se hra zavřela uprostřed oslavy: začne se prázdnou řadou s další
 * postavičkou a oslava se neopakuje.
 */
export function parseProgress(saved: string | null | undefined): GameProgress {
  if (typeof saved !== 'string' || saved === '') {
    return START_PROGRESS;
  }

  let data: unknown;
  try {
    data = JSON.parse(saved);
  } catch {
    // Poškozený záznam je stejný případ jako chybějící.
    return START_PROGRESS;
  }

  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return START_PROGRESS;
  }

  const record = data as Record<string, unknown>;
  if (!isStarCount(record.earned) || !isCharacterId(record.character)) {
    return START_PROGRESS;
  }

  if (record.earned === STARS_PER_SET) {
    return { earned: 0, character: nextCharacter(record.character) };
  }
  return { earned: record.earned, character: record.character };
}
