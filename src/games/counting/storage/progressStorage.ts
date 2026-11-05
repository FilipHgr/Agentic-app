/**
 * Uložení postupu hráče (hvězdičky) v zařízení. Když prohlížeč
 * úložiště nedovolí, hra jede dál a hráč nevidí chybu.
 */

import { START_PROGRESS, parseProgress, serializeProgress } from '../logic/progress';
import type { GameProgress } from '../logic/progress';
import type { KeyValueStorage } from '../../../shared/storage/keyValueStorage';

const STORAGE_KEY = 'agentic-app.progress';

/** Načte postup; bez úložiště nebo při chybě vrátí začátek hry. */
export function loadProgress(storage: KeyValueStorage | undefined): GameProgress {
  try {
    return parseProgress(storage?.getItem(STORAGE_KEY));
  } catch {
    // Nečitelné úložiště je stejný případ jako prázdné.
    return START_PROGRESS;
  }
}

/** Uloží postup. Když to nejde, postup platí aspoň do zavření stránky. */
export function saveProgress(
  storage: KeyValueStorage | undefined,
  progress: GameProgress,
): boolean {
  try {
    storage?.setItem(STORAGE_KEY, serializeProgress(progress));
    return storage !== undefined;
  } catch {
    // Plné nebo zakázané úložiště: hra pokračuje s postupem v paměti.
    return false;
  }
}
