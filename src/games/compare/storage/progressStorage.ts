/**
 * Uložení hvězdiček Porovnávání (#178 AC6) v úložišti hry aktivního
 * profilu. Když prohlížeč úložiště nedovolí, hra jede dál s hvězdičkami
 * v paměti a hráč nevidí chybu.
 */

import { parseProgress, serializeProgress } from '../logic/compareProgress';
import type { StarProgress } from '../../../shared/logic/stars';
import type { KeyValueStorage } from '../../../shared/storage/keyValueStorage';

export const COMPARE_PROGRESS_KEY = 'compare.progress';

/** Načte hvězdičky; bez úložiště nebo při chybě prázdná řada. */
export function loadProgress(storage: KeyValueStorage | undefined): StarProgress {
  try {
    return parseProgress(storage?.getItem(COMPARE_PROGRESS_KEY));
  } catch {
    // Nečitelné úložiště je stejný případ jako prázdné.
    return parseProgress(null);
  }
}

/** Uloží hvězdičky. Když to nejde, platí aspoň do zavření stránky. */
export function saveProgress(storage: KeyValueStorage | undefined, progress: StarProgress): void {
  try {
    storage?.setItem(COMPARE_PROGRESS_KEY, serializeProgress(progress));
  } catch {
    // Plné nebo zakázané úložiště: hra pokračuje s hvězdičkami v paměti.
    return;
  }
}
