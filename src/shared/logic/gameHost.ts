/**
 * Co stránka nabízí běžící hře (#68): kolečko nastavení, domeček, odchod
 * do menu, úložiště aktivního profilu (#71), značku profilu (#87), háček
 * na podržení domečku (#124), záznamy her aktivního profilu (#125),
 * háček na držení domečku (#129), pozadí stránky kolem hry (#134) a klíče
 * za dokončené mapy aktivního profilu (#139).
 * Spouštění her (`src/shared/ui/gameRunner.ts`) to hře dá do registru
 * Phaseru pod klíčem `GAME_HOST_KEY`. Čistý TypeScript.
 */

import type { KeyRewards } from './keyRewards';
import type { Profile } from './profiles';
import type { KeyValueStorage } from '../storage/keyValueStorage';
import type { GameRecords } from '../storage/profileRecords';

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

/**
 * Co hra odpoví na podržení domečku (#124 AC4): `'leave'` odejde do menu
 * jako dřív, `'stay'` nechá dítě ve hře (hra se vrátí o úroveň výš sama).
 */
export type HomeHoldDecision = 'leave' | 'stay';

/**
 * Pozadí stránky kolem plátna hry (#134): barva a volitelně obrázek ze
 * stejné stránky, který zakryje celé okno (jako CSS `cover`, na střed).
 * Plátno hry leží jen v herní ploše, okraje okna kolem něj tak vyplní
 * stránka stejným obrázkem.
 */
export interface PageBackdrop {
  readonly color: string;
  readonly imageUrl?: string | undefined;
}

export interface GameHost {
  /** Napojí podržení kolečka na otevření nastavení hry. Vrátí odpojení. */
  attachSettingsGear(open: () => void): () => void;
  /** Je teď domeček vidět a jde jím odejít (ne při otevřeném nastavení nebo průvodci)? */
  setHomeAvailable(available: boolean): void;
  /** Co hra udělá při odchodu domečkem, než se zničí (ztiší zvuky, zastaví časovače). */
  onLeave(handler: () => void): void;
  /**
   * Napojí hru na podržení domečku (#124): po podržení 1 s se stránka zeptá
   * `decide`, jestli odejít do menu. Nové napojení nahradí předchozí. Hra
   * bez napojení odchází domečkem do menu jako dřív. Starší hostitel háček
   * nemusí mít.
   */
  onHomeHold?(decide: () => HomeHoldDecision): void;
  /**
   * Napojí hru na držení domečku (#129 AC5): `listener(true)`, když se kolem
   * domečku začne plnit kroužek, `listener(false)`, když zmizí (puštění,
   * sjetí prstu i dokončené podržení). Nové napojení nahradí předchozí.
   * Starší hostitel háček nemusí mít.
   */
  onHomeHolding?(listener: (holding: boolean) => void): void;
  /**
   * Nastaví pozadí stránky kolem plátna hry (#134), `null` vrátí výchozí.
   * Při odchodu z hry se vrátí výchozí samo. Starší hostitel háček nemusí mít.
   */
  setPageBackdrop?(backdrop: PageBackdrop | null): void;
  /**
   * Úložiště této hry pro aktivní profil (#71), `undefined`, když stránka
   * žádné nedala (hra pak ukládá jen do paměti).
   */
  readonly storage: KeyValueStorage | undefined;
  /** Značka aktivního profilu (#87), `undefined`, když ji stránka nedala. */
  readonly profileMarker?: GameProfileMarker | undefined;
  /**
   * Záznamy této hry pro aktivní profil (#125, album Omalovánek), jen
   * v zařízení. Hra nedostane označení profilu ani přístup k jiným
   * profilům. `undefined`, když stránka žádné nedala.
   */
  readonly records?: GameRecords | undefined;
  /**
   * Klíče za dokončené mapy aktivního profilu (#139): hra jen hlásí
   * dokončené mapy a čte stav, označení profilu ani přezdívku nedostane.
   * `undefined`, když stránka žádné nedala (hra pak klíče nedává).
   */
  readonly keyRewards?: KeyRewards | undefined;
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
    (host.onHomeHold === undefined || typeof host.onHomeHold === 'function') &&
    (host.onHomeHolding === undefined || typeof host.onHomeHolding === 'function') &&
    (host.setPageBackdrop === undefined || typeof host.setPageBackdrop === 'function') &&
    (host.storage === undefined || isKeyValueStorage(host.storage)) &&
    (host.profileMarker === undefined || isProfileMarker(host.profileMarker)) &&
    (host.records === undefined || isGameRecords(host.records)) &&
    (host.keyRewards === undefined || isKeyRewards(host.keyRewards))
  );
}

/** Má hodnota tvar klíčů (funkce `reportCompletedMaps` a `balance`)? */
function isKeyRewards(value: unknown): value is KeyRewards {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const keys = value as Partial<KeyRewards>;
  return typeof keys.reportCompletedMaps === 'function' && typeof keys.balance === 'function';
}

/** Má hodnota tvar záznamů hry (funkce `list`, `add` a `remove`)? */
function isGameRecords(value: unknown): value is GameRecords {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const records = value as Partial<GameRecords>;
  return (
    typeof records.list === 'function' &&
    typeof records.add === 'function' &&
    typeof records.remove === 'function'
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
