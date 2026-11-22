/**
 * Postup v Porovnávání, který přežije zavření hry: hvězdičky v aktuální
 * řadě (#178 AC6). Čistý TypeScript bez prohlížeče; uložení řeší
 * `src/games/compare/storage/progressStorage.ts`.
 */

import { STARS_PER_SET, createStarProgress } from '../../../shared/logic/stars';
import type { StarProgress } from '../../../shared/logic/stars';

function isStarCount(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0 && (value as number) <= STARS_PER_SET;
}

/** Převede postup na text pro uložení v zařízení. */
export function serializeProgress(progress: StarProgress): string {
  return JSON.stringify({ earned: progress.earned });
}

/**
 * Postup, se kterým hra začne po znovuotevření. Chybějící, poškozený nebo
 * nesmyslný záznam dá prázdnou řadu. Plná řada znamená, že se hra zavřela
 * uprostřed oslavy: začne se prázdnou řadou a oslava se neopakuje.
 */
export function parseProgress(saved: string | null | undefined): StarProgress {
  if (typeof saved !== 'string' || saved === '') {
    return createStarProgress();
  }
  let data: unknown;
  try {
    data = JSON.parse(saved);
  } catch {
    // Poškozený záznam je stejný případ jako chybějící.
    return createStarProgress();
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return createStarProgress();
  }
  const earned = (data as Record<string, unknown>).earned;
  if (!isStarCount(earned) || earned === STARS_PER_SET) {
    return createStarProgress();
  }
  return { earned };
}
