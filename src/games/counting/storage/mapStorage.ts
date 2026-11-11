/**
 * Uložení mapy postupu (#87) v úložišti hry aktivního profilu, pod vlastním
 * klíčem odděleně od hvězdiček. Záznam z #87 (8 kroků) se při prvním
 * načtení převede na 3 kroky a hned uloží v novém tvaru (#133 AC4). Když
 * prohlížeč úložiště nedovolí, hra jede dál s mapou v paměti a hráč nevidí
 * chybu.
 */

import { START_MAP, readMapRecord, serializeMapProgress } from '../logic/progressMap';
import type { MapProgress, MapRecord } from '../logic/progressMap';
import type { KeyValueStorage } from '../../../shared/storage/keyValueStorage';

export const MAP_PROGRESS_KEY = 'agentic-app.map';

/**
 * Načte postup na mapě; bez úložiště nebo při chybě vrátí start. Převedený
 * záznam z #87 se hned uloží, aby se při dalším načtení už nepřeváděl.
 */
export function loadMapProgress(storage: KeyValueStorage | undefined): MapProgress {
  let record: MapRecord;
  try {
    record = readMapRecord(storage?.getItem(MAP_PROGRESS_KEY));
  } catch {
    // Nečitelné úložiště je stejný případ jako prázdné.
    return START_MAP;
  }
  if (record.legacy) {
    // Když zápis selže, hra jede s převedeným postupem v paměti.
    saveMapProgress(storage, record.progress);
  }
  return record.progress;
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
