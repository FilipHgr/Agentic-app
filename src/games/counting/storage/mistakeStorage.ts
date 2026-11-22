/**
 * Uložení přehledu chyb pro rodiče (#184) v úložišti hry aktivního profilu,
 * pod vlastním klíčem vedle přehledu vyřešených příkladů (#183). Úložiště
 * profilu ukládá pod vnitřním označením profilu a se smazáním profilu
 * záznam zmizí. Když prohlížeč úložiště nedovolí nebo je plné, hra jede
 * dál s chybami v paměti (AC6).
 */

import { EMPTY_MISTAKES, parseMistakes, serializeMistakes } from '../logic/mistakeActivity';
import type { MistakeRecord } from '../logic/mistakeActivity';
import type { KeyValueStorage } from '../../../shared/storage/keyValueStorage';

export const MISTAKES_KEY = 'agentic-app.mistakes';

/** Načte chyby; bez úložiště nebo při chybě prázdný záznam. */
export function loadMistakes(storage: KeyValueStorage | undefined): MistakeRecord {
  try {
    return parseMistakes(storage?.getItem(MISTAKES_KEY));
  } catch {
    // Nečitelné úložiště je stejný případ jako prázdné.
    return EMPTY_MISTAKES;
  }
}

/** Uloží chyby. Když to nejde, platí aspoň do zavření stránky. */
export function saveMistakes(storage: KeyValueStorage | undefined, record: MistakeRecord): void {
  try {
    storage?.setItem(MISTAKES_KEY, serializeMistakes(record));
  } catch {
    // Plné nebo zakázané úložiště: hra pokračuje s chybami v paměti.
  }
}
