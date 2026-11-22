/**
 * Uložení přehledu pro rodiče (#183) v úložišti hry aktivního profilu, pod
 * vlastním klíčem. Úložiště profilu ukládá pod vnitřním označením profilu
 * a se smazáním profilu záznam zmizí (AC5). Když prohlížeč úložiště
 * nedovolí nebo je plné, hra jede dál s přehledem v paměti (AC6).
 */

import { EMPTY_ACTIVITY, parseActivity, serializeActivity } from '../logic/weekActivity';
import type { ActivityRecord } from '../logic/weekActivity';
import type { KeyValueStorage } from '../../../shared/storage/keyValueStorage';

export const ACTIVITY_KEY = 'agentic-app.activity';

/** Načte vyřešené příklady; bez úložiště nebo při chybě prázdný záznam. */
export function loadActivity(storage: KeyValueStorage | undefined): ActivityRecord {
  try {
    return parseActivity(storage?.getItem(ACTIVITY_KEY));
  } catch {
    // Nečitelné úložiště je stejný případ jako prázdné.
    return EMPTY_ACTIVITY;
  }
}

/** Uloží vyřešené příklady. Když to nejde, platí aspoň do zavření stránky. */
export function saveActivity(storage: KeyValueStorage | undefined, record: ActivityRecord): void {
  try {
    storage?.setItem(ACTIVITY_KEY, serializeActivity(record));
  } catch {
    // Plné nebo zakázané úložiště: hra pokračuje s přehledem v paměti.
  }
}
