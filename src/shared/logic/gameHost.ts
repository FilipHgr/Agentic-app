/**
 * Co stránka nabízí běžící hře (#68): kolečko nastavení, domeček, odchod
 * do menu, úložiště aktivního profilu (#71) a značku profilu (#87). Spouštění her (`src/shared/ui/gameRunner.ts`) to hře dá do
 * registru Phaseru pod klíčem `GAME_HOST_KEY`. Čistý TypeScript.
 */

import type { Profile } from './profiles';
import type { KeyValueStorage } from '../storage/keyValueStorage';

export const GAME_HOST_KEY = 'gameHost';

/**
 * Značka aktivního profilu pro hru (#87): jen barva a první písmeno
 * přezdívky, nic dalšího o profilu hra nedostane. Bez přezdívky písmeno chybí.
 */
export interface GameProfileMarker {
  readonly color: string;
  readonly letter?: string;
}

/** Značka profilu: jeho barva a první písmeno přezdívky. */
export function profileMarkerOf(profile: Pick<Profile, 'nickname' | 'color'>): GameProfileMarker {
  const [letter] = [...(profile.nickname ?? '')];
  return letter === undefined ? { color: profile.color } : { color: profile.color, letter };
}

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
  /** Značka aktivního profilu (#87), `undefined`, když ji stránka nedala. */
  readonly profileMarker?: GameProfileMarker | undefined;
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
    (host.storage === undefined || isKeyValueStorage(host.storage)) &&
    (host.profileMarker === undefined || isProfileMarker(host.profileMarker))
  );
}

/** Má hodnota tvar značky profilu (barva a nejvýš písmeno)? */
function isProfileMarker(value: unknown): value is GameProfileMarker {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const marker = value as Partial<GameProfileMarker>;
  return (
    typeof marker.color === 'string' &&
    (marker.letter === undefined || typeof marker.letter === 'string')
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
