import type { KeyValueStorage } from '../src/storage/settingsStorage';

/** Klíč, pod kterým hra ukládá nastavení v zařízení. */
export const SETTINGS_KEY = 'agentic-app.settings';

/** Úložiště v paměti, jako localStorage v prohlížeči. Přežije „zavření hry“. */
export function memoryStorage(
  initialSettings?: string,
): KeyValueStorage & { readonly data: Map<string, string> } {
  const data = new Map<string, string>();
  if (initialSettings !== undefined) {
    data.set(SETTINGS_KEY, initialSettings);
  }
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
  };
}

/** Úložiště, které prohlížeč zakázal (soukromé okno): čtení i zápis selže. */
export function brokenStorage(): KeyValueStorage {
  return {
    getItem: () => {
      throw new Error('úložiště zakázáno');
    },
    setItem: () => {
      throw new Error('úložiště zakázáno');
    },
  };
}

/** Úložiště, které jde přečíst, ale ne zapsat (plné). */
export function readOnlyStorage(): KeyValueStorage {
  return {
    getItem: () => null,
    setItem: () => {
      throw new Error('úložiště plné');
    },
  };
}
