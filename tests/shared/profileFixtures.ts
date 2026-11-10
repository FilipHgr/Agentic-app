import type { KeyValueStorage } from '../../src/shared/storage/keyValueStorage';

/**
 * Pomůcky pro testy profilů (#71): úložiště zařízení v paměti, které přežije
 * „obnovení stránky“ a umí na požádání selhat při zápisu vybraných klíčů.
 * Od #73 umí jako `localStorage` i mazat (`removeItem`) a projít klíče
 * (`key`, `length`), mazání vybraných klíčů umí také selhat.
 * Dnešní (staré) klíče jsou tu napsané natvrdo schválně: jsou to záznamy,
 * které v zařízení nechala verze hry před profily, a nesmějí se změnit.
 */

/** Nastavení Počítání uložené verzí hry před profily. */
export const LEGACY_SETTINGS_KEY = 'agentic-app.settings';

/** Postup Počítání (hvězdičky) uložený verzí hry před profily. */
export const LEGACY_PROGRESS_KEY = 'agentic-app.progress';

export class DeviceStorage implements KeyValueStorage {
  readonly data: Map<string, string>;
  /** Zápis klíče, pro který vrátí `true`, selže (plné úložiště). */
  failWrite: (key: string) => boolean = () => false;
  /** Čtení selže (zakázané úložiště). */
  failReads = false;
  /** Smazání klíče, pro který vrátí `true`, selže (#73). */
  failRemove: (key: string) => boolean = () => false;

  constructor(initial: Record<string, string> = {}) {
    this.data = new Map(Object.entries(initial));
  }

  getItem(key: string): string | null {
    if (this.failReads) {
      throw new Error('úložiště nejde číst');
    }
    return this.data.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    if (this.failWrite(key)) {
      throw new Error('úložiště je plné');
    }
    this.data.set(key, value);
  }

  /** Smaže záznam jako `localStorage.removeItem` (#73). */
  removeItem(key: string): void {
    if (this.failRemove(key)) {
      throw new Error('záznam nejde smazat');
    }
    this.data.delete(key);
  }

  /** Klíč na pořadí `index` jako `localStorage.key` (#73). */
  key(index: number): string | null {
    if (this.failReads) {
      throw new Error('úložiště nejde číst');
    }
    return [...this.data.keys()][index] ?? null;
  }

  /** Počet záznamů jako `localStorage.length` (#73). */
  get length(): number {
    return this.data.size;
  }

  /** Obsah úložiště jako obyčejný objekt, aby šel porovnat. */
  snapshot(): Record<string, string> {
    return Object.fromEntries(this.data);
  }

  /** Klíče, které přibyly proti dřívějšímu obsahu `before`. */
  keysAddedSince(before: Record<string, string>): string[] {
    return [...this.data.keys()].filter((key) => !(key in before));
  }
}

/** Úložiště, které prohlížeč zakázal: čtení i zápis selže. */
export function forbiddenStorage(): DeviceStorage {
  const storage = new DeviceStorage();
  storage.failReads = true;
  storage.failWrite = () => true;
  storage.failRemove = () => true;
  return storage;
}

/** Poškozené seznamy profilů (nejsou to čitelná data seznamu). */
export const CORRUPT_PROFILE_LISTS: readonly string[] = ['{', 'nesmysl', 'null', '42', '"text"'];

/** Předpona dat jednoho profilu v úložišti: `agentic-app.profile.<id>.` (#71). */
export function profileDataPrefix(profileId: string): string {
  return `agentic-app.profile.${profileId}.`;
}

/** Klíče dat profilu `profileId`, které v úložišti jsou (#73). */
export function profileDataKeys(storage: DeviceStorage, profileId: string): string[] {
  const prefix = profileDataPrefix(profileId);
  return [...storage.data.keys()].filter((key) => key.startsWith(prefix));
}
