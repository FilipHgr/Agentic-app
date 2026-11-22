/**
 * Uložení nastavení Porovnávání (#179 AC5) v úložišti hry aktivního
 * profilu. Když prohlížeč úložiště nedovolí, hra jede s výchozím nebo
 * naposledy zvoleným nastavením v paměti a hráč nevidí chybu.
 */

import { parseCompareSettings, serializeCompareSettings } from '../logic/compareSettings';
import type { CompareSettings } from '../logic/compareSettings';
import type { KeyValueStorage } from '../../../shared/storage/keyValueStorage';

export const COMPARE_SETTINGS_KEY = 'compare.settings';

/** Načte nastavení; bez úložiště nebo při chybě výchozí. */
export function loadCompareSettings(storage: KeyValueStorage | undefined): CompareSettings {
  try {
    return parseCompareSettings(storage?.getItem(COMPARE_SETTINGS_KEY));
  } catch {
    // Nečitelné úložiště je stejný případ jako prázdné.
    return parseCompareSettings(null);
  }
}

/** Uloží nastavení. Když to nejde, platí aspoň do zavření hry. */
export function saveCompareSettings(
  storage: KeyValueStorage | undefined,
  settings: CompareSettings,
): void {
  try {
    storage?.setItem(COMPARE_SETTINGS_KEY, serializeCompareSettings(settings));
  } catch {
    // Plné nebo zakázané úložiště: hra pokračuje s nastavením v paměti.
    return;
  }
}
