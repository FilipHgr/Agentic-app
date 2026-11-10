/**
 * Postup hráče, který přežije zavření hry: hvězdičky v aktuální řadě.
 * Čistý TypeScript bez prohlížeče; uložení řeší
 * `src/games/counting/storage/progressStorage.ts`.
 */

import { STARS_PER_SET } from './stars';
import type { StarProgress } from './stars';

export type GameProgress = StarProgress;

/** Začátek hry: prázdná řada hvězdiček. */
export const START_PROGRESS: GameProgress = { earned: 0 };

function isStarCount(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0 && (value as number) <= STARS_PER_SET;
}

/** Převede postup na text pro uložení v zařízení. */
export function serializeProgress(progress: GameProgress): string {
  return JSON.stringify({ earned: progress.earned });
}

/**
 * Postup, se kterým hra začne po znovuotevření. Chybějící, poškozený nebo
 * nesmyslný počet hvězdiček dá začátek hry. Ostatní pole ze starších verzí
 * hry se ignorují (#63), hvězdičky kvůli nim nepřijdou nazmar. Plná řada
 * znamená, že se hra zavřela uprostřed oslavy: začne se prázdnou řadou
 * a oslava se neopakuje.
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
  if (!isStarCount(record.earned)) {
    return START_PROGRESS;
  }

  if (record.earned === STARS_PER_SET) {
    return START_PROGRESS;
  }
  return { earned: record.earned };
}
