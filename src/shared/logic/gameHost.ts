/**
 * Co stránka nabízí běžící hře (#68): kolečko nastavení, domeček, odchod
 * do menu a úložiště aktivního profilu (#71). Spouštění her (`src/shared/ui/gameRunner.ts`) to hře dá do
 * registru Phaseru pod klíčem `GAME_HOST_KEY`. Čistý TypeScript.
 */

import type { KeyValueStorage } from '../storage/keyValueStorage';

export const GAME_HOST_KEY = 'gameHost';

export interface GameHost {
  /** Napojí podržení kolečka na otevření nastavení hry. Vrátí odpojení. */
  attachSettingsGear(open: () => void): () => void;
  /** Je teď domeček vidět a jde jím odejít (ne při otevřeném nastavení nebo průvodci)? */
  setHomeAvailable(available: boolean): void;
  /** Co hra udělá při odchodu domečkem, než se zničí (ztiší zvuky, zastaví časovače). */
  onLeave(handler: () => void): void;
  /**
   * Úložiště této hry pro aktivní profil (#71), `undefined`, když stránka
   * žádné nedala (hra pak ukládá jen do paměti).
   */
  readonly storage: KeyValueStorage | undefined;
}

/** Je hodnota z registru stránka pro hru? */
export function isGameHost(value: unknown): value is GameHost {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const host = value as Partial<GameHost>;
  return (
    typeof host.attachSettingsGear === 'function' &&
    typeof host.setHomeAvailable === 'function' &&
    typeof host.onLeave === 'function' &&
    (host.storage === undefined || isKeyValueStorage(host.storage))
  );
}

/** Má hodnota tvar úložiště (funkce `getItem` a `setItem`)? */
function isKeyValueStorage(value: unknown): value is KeyValueStorage {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const storage = value as Partial<KeyValueStorage>;
  return typeof storage.getItem === 'function' && typeof storage.setItem === 'function';
}
