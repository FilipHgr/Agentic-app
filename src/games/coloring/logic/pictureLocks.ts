/**
 * Zamčené omalovánky (#140), čistá logika bez Phaseru. Odemčené jsou:
 * - první 3 omalovánky sady (domek, kočka, pejsek) od začátku (AC1),
 * - omalovánky odemčené zdarma, které měly při prvním otevření Omalovánek
 *   po změně rozmalovanou stránku s aspoň jednou zabarvenou plochou nebo
 *   obrázek v albu (AC2, `unlockPaintedPictures`),
 * - omalovánky, za které profil utratil klíč z Počítání (AC5).
 *
 * Odemčení zdarma je záznam v úložišti hry aktivního profilu
 * (`PICTURE_UNLOCKS_KEY`). Odemčení klíčem záznam nemá: je to seznam věcí,
 * za které se utratil klíč (`KeyRewards.spentItems`, `coloring/<id>`), takže
 * se klíč a odemčení uloží jedním zápisem a nemůže se stát, že by klíč
 * zmizel a omalovánka zůstala zamčená, ani naopak (AC7). Poškozený záznam
 * utracení vrátí klíče i zámky, poškozený záznam odemčení zdarma se
 * přepočítá ze stránek a alba. Omalovánku, jejíž stránka ještě není
 * zkontrolovaná (obrys se nestáhl), klíč neodemkne.
 *
 * Omalovánka se odemyká podle označení (`id`), ne verze obrysu, aby změna
 * obrysu odemčenou omalovánku nezamkla. Stav se čte znovu při každém
 * volání, takže dva panely vidí stejné odemčení i klíče (AC6). Selhání
 * úložiště ani klíčů hra nikdy nevyhodí (AC7).
 */

import type { KeyRewards } from '../../../shared/logic/keyRewards';
import type { KeyValueStorage } from '../../../shared/storage/keyValueStorage';
import { NO_COLOR } from './coloring';
import type { AlbumContents, AlbumPicture } from './album';
import { COLORING_PICTURES } from './pictureSet';
import { readStoredPage } from './savedPicture';
import type { PictureIdentity } from './savedPicture';

/** Omalovánky odemčené od začátku (#140 AC1). */
export const FREE_PICTURE_IDS: readonly string[] = ['house', 'cat', 'dog'];

/** Klíč záznamu odemčení zdarma v úložišti hry (#140 AC2). */
export const PICTURE_UNLOCKS_KEY = 'pictureUnlocks';

/** Začátek označení věci, za kterou se utrácí klíč (označení hry). */
const SPEND_ITEM_PREFIX = 'coloring/';

/** Co ukáže ukazatel klíčů: celé klíče a jestli má dítě i půlku (#140 AC3). */
export interface KeyIndicatorState {
  readonly wholeKeys: number;
  readonly hasHalf: boolean;
}

/** Jak dopadlo ťuknutí na zamčenou omalovánku: odemčená klíčem, už odemčená, nebo bez klíče. */
export type PictureUnlock = 'unlocked' | 'alreadyUnlocked' | 'noKey';

export interface PictureLocks {
  /** Je omalovánka zamčená? */
  isLocked(picture: PictureIdentity): boolean;
  /** Stav ukazatele klíčů; `null`, když není zamčená žádná omalovánka (ukazatel zmizí). */
  keyIndicator(): KeyIndicatorState | null;
  /** Odemkne omalovánku jedním celým klíčem. */
  unlock(picture: PictureIdentity): PictureUnlock;
}

/**
 * Záznam odemčení zdarma: omalovánky, jejichž stránka a obrázky v albu už
 * jsou zkontrolované, a omalovánky odemčené zdarma.
 */
interface UnlocksRecord {
  readonly pagesChecked: readonly string[];
  readonly albumChecked: readonly string[];
  readonly unlocked: readonly string[];
}

const NO_UNLOCKS: UnlocksRecord = { pagesChecked: [], albumChecked: [], unlocked: [] };

/** Označení všech omalovánek sady; jiná v záznamu nejsou. */
const KNOWN_IDS: readonly string[] = COLORING_PICTURES.map((picture) => picture.id);

/** Záznam odemčení zdarma; chybějící, poškozený nebo nečitelný je „nic zkontrolováno“. */
function readUnlocks(storage: KeyValueStorage | undefined): UnlocksRecord {
  if (storage === undefined) {
    return NO_UNLOCKS;
  }
  let saved: string | null;
  try {
    saved = storage.getItem(PICTURE_UNLOCKS_KEY);
  } catch (error) {
    console.warn('Omalovánky: odemčené omalovánky nejde přečíst', error);
    return NO_UNLOCKS;
  }
  return saved === null ? NO_UNLOCKS : parseUnlocks(saved);
}

function parseUnlocks(saved: string): UnlocksRecord {
  let record: unknown;
  try {
    record = JSON.parse(saved);
  } catch {
    // Poškozený záznam: odemčení zdarma se přepočítá ze stránek a alba (AC7).
    return NO_UNLOCKS;
  }
  if (typeof record !== 'object' || record === null || Array.isArray(record)) {
    return NO_UNLOCKS;
  }
  const { pagesChecked, albumChecked, unlocked } = record as Partial<Record<string, unknown>>;
  if (!Array.isArray(pagesChecked) || !Array.isArray(albumChecked) || !Array.isArray(unlocked)) {
    return NO_UNLOCKS;
  }
  return {
    pagesChecked: knownIdsIn(pagesChecked),
    albumChecked: knownIdsIn(albumChecked),
    unlocked: knownIdsIn(unlocked),
  };
}

/** Jen označení omalovánek sady, každé jednou. */
function knownIdsIn(values: readonly unknown[]): string[] {
  const ids = values.filter(
    (value): value is string => typeof value === 'string' && KNOWN_IDS.includes(value),
  );
  return [...new Set(ids)];
}

/** Uloží záznam odemčení zdarma. Co se nepodaří, drží úložiště profilu v paměti. */
function writeUnlocks(storage: KeyValueStorage, record: UnlocksRecord): void {
  try {
    storage.setItem(PICTURE_UNLOCKS_KEY, JSON.stringify(record));
  } catch (error) {
    console.warn('Omalovánky: odemčené omalovánky nejde uložit', error);
  }
}

/** Má omalovánka uloženou stránku s aspoň jednou zabarvenou plochou? */
function hasPaintedPage(storage: KeyValueStorage, picture: AlbumPicture): boolean {
  const page = readStoredPage(storage, picture.identity, picture.regions);
  return page.kind === 'painted' && page.layer.some((color) => color !== NO_COLOR);
}

/**
 * Jednou odemkne zdarma omalovánky s rozmalovanou stránkou nebo obrázkem
 * v albu (#140 AC2). Volá se při otevření Omalovánek, dřív než výběr
 * přijme ťuknutí. `pictures` jsou jen omalovánky s připraveným obrysem:
 * stránka a album každé se kontrolují jen jednou, ostatní se zkontrolují
 * při dalším otevření (do té doby je klíč neodemkne). Když album nejde
 * přečíst, zkontroluje se při dalším otevření. Nikdy nevyhodí výjimku.
 */
export function unlockPaintedPictures(options: {
  readonly storage: KeyValueStorage | undefined;
  readonly pictures: readonly AlbumPicture[];
  readonly album: AlbumContents | null;
}): void {
  const { storage, pictures, album } = options;
  if (storage === undefined) {
    return;
  }
  const before = readUnlocks(storage);
  const albumEntries = album !== null && album.status === 'read' ? album.entries : null;
  const newPages = pictures.filter((picture) => !before.pagesChecked.includes(picture.identity.id));
  const newAlbum =
    albumEntries === null
      ? []
      : pictures.filter((picture) => !before.albumChecked.includes(picture.identity.id));
  if (newPages.length === 0 && newAlbum.length === 0) {
    return;
  }
  const unlocked = new Set(before.unlocked);
  for (const picture of newPages) {
    if (hasPaintedPage(storage, picture)) {
      unlocked.add(picture.identity.id);
    }
  }
  const newAlbumIds = newAlbum.map((picture) => picture.identity.id);
  for (const entry of albumEntries ?? []) {
    if (newAlbumIds.includes(entry.picture.id)) {
      unlocked.add(entry.picture.id);
    }
  }
  writeUnlocks(storage, {
    pagesChecked: knownIdsIn([...before.pagesChecked, ...newPages.map((each) => each.identity.id)]),
    albumChecked: knownIdsIn([...before.albumChecked, ...newAlbumIds]),
    unlocked: knownIdsIn([...unlocked]),
  });
}

/** Utracené věci od klíčů; klíče, které chybí nebo selžou, nic neutratily. */
function spentItemsOf(keyRewards: KeyRewards | undefined): readonly string[] {
  if (keyRewards === undefined) {
    return [];
  }
  try {
    return keyRewards.spentItems();
  } catch (error) {
    console.warn('Omalovánky: klíče nejde přečíst', error);
    return [];
  }
}

/** Stav ukazatele od klíčů; klíče, které chybí nebo selžou, jsou 0 klíčů (AC7). */
function indicatorOf(keyRewards: KeyRewards | undefined): KeyIndicatorState {
  if (keyRewards === undefined) {
    return { wholeKeys: 0, hasHalf: false };
  }
  try {
    const { wholeKeys, hasHalf } = keyRewards.balance();
    return { wholeKeys: Math.max(0, wholeKeys), hasHalf };
  } catch (error) {
    console.warn('Omalovánky: klíče nejde přečíst', error);
    return { wholeKeys: 0, hasHalf: false };
  }
}

/** Utratí klíč za omalovánku; klíče, které chybí nebo selžou, žádný klíč nemají. */
function spendKeyFor(keyRewards: KeyRewards | undefined, pictureId: string): PictureUnlock {
  if (keyRewards === undefined) {
    return 'noKey';
  }
  try {
    switch (keyRewards.spendKey(SPEND_ITEM_PREFIX + pictureId)) {
      case 'spent':
        return 'unlocked';
      case 'alreadySpent':
        return 'alreadyUnlocked';
      case 'noKey':
        return 'noKey';
    }
  } catch (error) {
    console.warn('Omalovánky: klíč nejde utratit', error);
    return 'noKey';
  }
}

/**
 * Zámky omalovánek `pictures` nad úložištěm hry aktivního profilu a klíči
 * od stránky (`GameHost.keyRewards`, bez nich 0 klíčů).
 */
export function openPictureLocks(options: {
  readonly pictures: readonly PictureIdentity[];
  readonly storage: KeyValueStorage | undefined;
  readonly keyRewards: KeyRewards | undefined;
}): PictureLocks {
  const { pictures, storage, keyRewards } = options;

  const isLocked = (picture: PictureIdentity): boolean =>
    !FREE_PICTURE_IDS.includes(picture.id) &&
    !readUnlocks(storage).unlocked.includes(picture.id) &&
    !spentItemsOf(keyRewards).includes(SPEND_ITEM_PREFIX + picture.id);

  /**
   * Je stránka omalovánky zkontrolovaná pro odemčení zdarma? Dokud ne
   * (obrys se nestáhl), klíč ji neodemkne, aby dítě neplatilo za
   * rozmalovanou omalovánku (AC2). Bez úložiště hry žádná stránka není.
   */
  const pageChecked = (picture: PictureIdentity): boolean =>
    storage === undefined || readUnlocks(storage).pagesChecked.includes(picture.id);

  return {
    isLocked,
    keyIndicator: () => (pictures.some(isLocked) ? indicatorOf(keyRewards) : null),
    unlock: (picture) => {
      if (!isLocked(picture)) {
        return 'alreadyUnlocked';
      }
      return pageChecked(picture) ? spendKeyFor(keyRewards, picture.id) : 'noKey';
    },
  };
}
