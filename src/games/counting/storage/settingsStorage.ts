/**
 * Uložení nastavení v zařízení (localStorage). Prohlížeč může úložiště
 * zakázat (soukromý režim, vypnuté ukládání), pak hra jede s výchozím
 * nastavením a hráč nevidí chybu.
 */

import {
  DEFAULT_SETTINGS,
  isFirstLaunch,
  parseSettings,
  serializeSettings,
} from '../logic/settings';
import type { GameSettings } from '../logic/settings';
import type { KeyValueStorage } from '../../../shared/storage/keyValueStorage';

const STORAGE_KEY = 'agentic-app.settings';

/** Načte nastavení; bez úložiště nebo při chybě vrátí výchozí. */
export function loadSettings(storage: KeyValueStorage | undefined): GameSettings {
  try {
    return parseSettings(storage?.getItem(STORAGE_KEY));
  } catch {
    // Nečitelné úložiště je stejný případ jako prázdné.
    return parseSettings(null);
  }
}

export interface SettingsState {
  readonly settings: GameSettings;
  /** Hra běží v zařízení poprvé, nastavení se má otevřít samo (#48). */
  readonly firstLaunch: boolean;
}

/**
 * Načte nastavení a pozná první spuštění. Nečitelné úložiště je stejný
 * případ jako chybějící záznam. Při prvním spuštění platí výchozí volby.
 */
export function loadSettingsState(storage: KeyValueStorage | undefined): SettingsState {
  let saved: string | null | undefined;
  try {
    saved = storage?.getItem(STORAGE_KEY);
  } catch {
    // Zakázané úložiště: hra ho bere jako prázdné.
    saved = undefined;
  }
  if (isFirstLaunch(saved)) {
    return { settings: DEFAULT_SETTINGS, firstLaunch: true };
  }
  return { settings: parseSettings(saved), firstLaunch: false };
}

/** Uloží nastavení. Když to nejde, nastavení platí aspoň do zavření stránky. */
export function saveSettings(
  storage: KeyValueStorage | undefined,
  settings: GameSettings,
): boolean {
  try {
    storage?.setItem(STORAGE_KEY, serializeSettings(settings));
    return storage !== undefined;
  } catch {
    // Plné nebo zakázané úložiště: hra pokračuje s nastavením v paměti.
    return false;
  }
}
