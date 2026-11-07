/**
 * Uložení mapy postupu (#87) v úložišti hry aktivního profilu, pod vlastním
 * klíčem odděleně od hvězdiček. Když prohlížeč úložiště nedovolí, hra jede
 * dál s mapou v paměti a hráč nevidí chybu.
 */

import { START_MAP, parseMapProgress, serializeMapProgress } from '../logic/progressMap';
import type { MapProgress } from '../logic/progressMap';
import type { KeyValueStorage } from '../../../shared/storage/keyValueStorage';

export const MAP_PROGRESS_KEY = 'agentic-app.map';

/** Načte postup na mapě; bez úložiště nebo při chybě vrátí start. */
export function loadMapProgress(storage: KeyValueStorage | undefined): MapProgress {
  try {
    return parseMapProgress(storage?.getItem(MAP_PROGRESS_KEY));
  } catch {
    // Nečitelné úložiště je stejný případ jako prázdné.
    return START_MAP;
  }
}

/** Uloží postup na mapě. Když to nejde, postup platí aspoň do zavření stránky. */
export function saveMapProgress(
  storage: KeyValueStorage | undefined,
  progress: MapProgress,
): boolean {
  try {
    storage?.setItem(MAP_PROGRESS_KEY, serializeMapProgress(progress));
    return storage !== undefined;
  } catch {
    // Plné nebo zakázané úložiště: hra pokračuje s mapou v paměti.
    return false;
  }
}
