/**
 * Pomůcky pro testy k #140 (zamčené omalovánky odemyká klíč z Počítání).
 *
 * Zařízení (`LockDevice`) má `localStorage` (`DeviceStorage`) a záznamy
 * her v IndexedDB (polička v paměti `MemoryRecordsShelf`). Jedno „načtení
 * stránky“ je `loadPage(device)`: správa profilů nad stejnými daty
 * (`openProfiles(storage, memoryProfileRecords(shelf))`), úložiště a album
 * Omalovánek aktivního profilu a klíče aktivního profilu tak, jak je
 * stránka dá hře (`openKeyRewards(gameStorage(KEY_REWARDS_AREA))`). Dva
 * panely jsou dvě načtení stránky nad stejným zařízením.
 *
 * Půlky klíčů dává Počítání hlášením dokončených map
 * (`keys.reportCompletedMaps`, #139). Testy Omalovánek Počítání
 * nespouštějí (hra smí importovat jen sebe a sdílenou část), hlásí mapy
 * přímo klíčům, jako by dítě hrálo Počítání.
 *
 * Jedno „otevření Omalovánek“ (`enterColoring`) udělá to, co scéna při
 * otevření hry: přečte album, jednou odemkne omalovánky s rozmalovanou
 * stránkou nebo obrázkem v albu (`unlockPaintedPictures`, #140 AC2)
 * a otevře zámky (`openPictureLocks`) nad úložištěm hry a klíči od
 * stránky. Výběr (`startPictureChoice`) dostane zámky volbou `locks`.
 *
 * Testy pracují se skutečnou sadou 11 omalovánek (`COLORING_PICTURES`),
 * protože AC1 jmenuje, které tři jsou odemčené. Obrys mají všechny
 * zkušební (`twoHalves()`), logika zámků obrys nezná.
 *
 * Testy neznají klíče záznamů zámků v úložišti: poškozený záznam vznikne
 * přepsáním všeho, co odemykání zapsalo (`damageWritesSince`).
 */

import { expect } from 'vitest';

import { readAlbum, removeAlbumEntry } from '../../../src/games/coloring/logic/album';
import type { AlbumContents, AlbumPicture } from '../../../src/games/coloring/logic/album';
import { startPictureChoice } from '../../../src/games/coloring/logic/pictureChoice';
import type { PictureChoice, PreviewTap } from '../../../src/games/coloring/logic/pictureChoice';
import {
  openPictureLocks,
  unlockPaintedPictures,
} from '../../../src/games/coloring/logic/pictureLocks';
import type { PictureLocks } from '../../../src/games/coloring/logic/pictureLocks';
import { COLORING_PICTURES } from '../../../src/games/coloring/logic/pictureSet';
import { openColoring, pageKeyOf } from '../../../src/games/coloring/logic/savedPicture';
import type { PictureIdentity } from '../../../src/games/coloring/logic/savedPicture';
import { HOLD_TO_GO_HOME_MS } from '../../../src/shared/logic/homeButton';
import type { KeyRewards } from '../../../src/shared/logic/keyRewards';
import type { KeyValueStorage } from '../../../src/shared/storage/keyValueStorage';
import { KEY_REWARDS_AREA, openKeyRewards } from '../../../src/shared/storage/keyRewardsStorage';
import {
  createMemoryRecordsShelf,
  memoryProfileRecords,
} from '../../../src/shared/storage/profileRecords';
import type { GameRecords, MemoryRecordsShelf } from '../../../src/shared/storage/profileRecords';
import { openProfiles } from '../../../src/shared/storage/profileStorage';
import type { ProfileStore } from '../../../src/shared/storage/profileStorage';
import { DeviceStorage } from '../../shared/profileFixtures';
import { fillAlbum, paintLeft } from './albumHelpers';
import { twoHalves } from './savedPictureHelpers';

/** Označení Omalovánek; úložiště a záznamy hry jsou pod ním. */
const COLORING = 'coloring';

/** Omalovánky odemčené od začátku (#140 AC1), schválně opsané, ne konstanta z kódu. */
export const FREE_IDS: readonly string[] = ['house', 'cat', 'dog'];

/** Zbylých 8 omalovánek sady v pořadí náhledů, na začátku zamčené (#140 AC1). */
export const LOCKED_IDS: readonly string[] = [
  'car',
  'butterfly',
  'fish',
  'sea',
  'mermaid',
  'rainbow',
  'ornament',
  'unicorn',
];

/** Omalovánka sady podle označení. */
export function pictureOf(id: string): PictureIdentity {
  const picture = COLORING_PICTURES.find((each) => each.id === id);
  if (picture === undefined) {
    throw new Error(`v sadě chybí omalovánka ${id}`);
  }
  return picture;
}

/** Místo náhledu omalovánky na výběru. */
export function previewIndexOf(id: string): number {
  const index = COLORING_PICTURES.findIndex((each) => each.id === id);
  if (index < 0) {
    throw new Error(`v sadě chybí omalovánka ${id}`);
  }
  return index;
}

/** Omalovánky sady i s (zkušebním) obrysem, jak je scéna dá albu a zámkům. */
export function setPictures(): AlbumPicture[] {
  const regions = twoHalves();
  return COLORING_PICTURES.map((identity) => ({ identity, regions }));
}

/** Zařízení s `localStorage` a IndexedDB v paměti. */
export interface LockDevice {
  readonly storage: DeviceStorage;
  readonly shelf: MemoryRecordsShelf;
}

export function lockDevice(): LockDevice {
  return { storage: new DeviceStorage(), shelf: createMemoryRecordsShelf() };
}

/** Jedno načtení stránky: aktivní profil, jeho úložiště a album Omalovánek a jeho klíče. */
export interface LockPage {
  readonly store: ProfileStore;
  readonly storage: KeyValueStorage;
  readonly records: GameRecords;
  readonly keys: KeyRewards;
}

export function loadPage(device: LockDevice): LockPage {
  const store = openProfiles(device.storage, memoryProfileRecords(device.shelf));
  return pageOfStore(store);
}

/** Úložiště, album a klíče aktivního profilu správy profilů `store`. */
export function pageOfStore(store: ProfileStore): LockPage {
  return {
    store,
    storage: store.gameStorage(COLORING),
    records: store.gameRecords(COLORING),
    keys: openKeyRewards(store.gameStorage(KEY_REWARDS_AREA)),
  };
}

/** Dítě v Počítání dokončí mapy až do `maps` (každá mapa půl klíče). */
export function completeMaps(keys: KeyRewards, maps: number): void {
  for (let completed = 1; completed <= maps; completed += 1) {
    keys.reportCompletedMaps(completed);
  }
}

export interface EnterOptions {
  /** Klíče od stránky; bez volby klíče stránky, `undefined` = stránka žádné nedala. */
  readonly keys?: KeyRewards | undefined;
  /** Album; bez volby album stránky. */
  readonly records?: GameRecords;
  /**
   * Omalovánky, jejichž obrys se nestáhl (scéna je odemčení zdarma ani
   * albu nedá). Jejich stránku ani obrázky v albu nejde zkontrolovat.
   */
  readonly missingOutlines?: readonly string[];
}

/**
 * Dítě ťukne v menu na Omalovánky: scéna přečte album, jednou odemkne
 * rozmalované omalovánky (AC2) a otevře zámky nad úložištěm hry a klíči.
 */
export async function enterColoring(
  page: LockPage,
  options: EnterOptions = {},
): Promise<PictureLocks> {
  const keyRewards = 'keys' in options ? options.keys : page.keys;
  const missing = options.missingOutlines ?? [];
  const pictures = setPictures().filter((picture) => !missing.includes(picture.identity.id));
  const album: AlbumContents = await readAlbum(options.records ?? page.records, pictures);
  unlockPaintedPictures({ storage: page.storage, pictures, album });
  return openPictureLocks({ pictures: COLORING_PICTURES, storage: page.storage, keyRewards });
}

/** Které omalovánky sady jsou zamčené (v pořadí náhledů). */
export function lockedIdsOf(locks: PictureLocks): string[] {
  return COLORING_PICTURES.filter((picture) => locks.isLocked(picture)).map(
    (picture) => picture.id,
  );
}

/** Zkušební hodiny výběru v ms; jdou jen dopředu. */
const clock = { now: 0 };

export function lockClock(): number {
  return clock.now;
}

/** Výběr se zámky nad celou sadou (bez alba a výměny s ním). */
export function choiceWith(locks: PictureLocks): PictureChoice {
  return startPictureChoice(COLORING_PICTURES, { now: lockClock, locks });
}

/** Výběr se zámky, albem a výměnou stránky s albem (Malovat dál, #131). */
export function choiceWithAlbum(page: LockPage, locks: PictureLocks): PictureChoice {
  return startPictureChoice(COLORING_PICTURES, {
    now: lockClock,
    locks,
    records: page.records,
    storage: page.storage,
    albumPictures: setPictures(),
  });
}

/** Dítě ťukne na náhled omalovánky `id`. */
export function tapPicture(choice: PictureChoice, id: string): PreviewTap {
  return choice.tapPreview(previewIndexOf(id));
}

/** Malování otevírané omalovánky se ukáže a dítě se domečkem vrátí na výběr. */
export function paintAndReturn(choice: PictureChoice): void {
  choice.paintingShown();
  clock.now += HOLD_TO_GO_HOME_MS;
  expect(choice.holdHome(), 'domeček v malování vede na výběr').toBe('toPicker');
}

/**
 * Dítě odemkne omalovánku `id` klíčem ťuknutím na výběru a vrátí se na
 * výběr. Selže, když se omalovánka neodemkla.
 */
export function unlockByTap(choice: PictureChoice, id: string): void {
  const tap = tapPicture(choice, id);
  expect(tap.kind, `${id} se odemkne`).toBe('unlocked');
  paintAndReturn(choice);
}

/** Omalovánka `id` má rozmalovanou stránku s tahem v levé polovině. */
export function paintPage(page: LockPage, id: string): void {
  const game = openColoring({
    regions: twoHalves(),
    picture: pictureOf(id),
    storage: page.storage,
  });
  paintLeft(game, 2);
  game.suspend();
}

/** Omalovánka `id` má uloženou stránku jen s vybranou barvou, bez tahu. */
export function colorOnlyPage(page: LockPage, id: string): void {
  const game = openColoring({
    regions: twoHalves(),
    picture: pictureOf(id),
    storage: page.storage,
  });
  game.tapColor(3);
  game.suspend();
}

/** Dítě stránku omalovánky `id` smaže (stránka bez záznamu). */
export function clearPage(page: LockPage, id: string): void {
  page.storage.setItem(pageKeyOf(pictureOf(id)), '');
}

/** V albu je obrázek omalovánky `id`. */
export async function photograph(page: LockPage, id: string): Promise<void> {
  await fillAlbum(page.records, 1, pictureOf(id), COLORING_PICTURES);
}

/** Dítě smaže z alba všechny obrázky omalovánky `id`. */
export async function removeFromAlbum(page: LockPage, id: string): Promise<void> {
  const album = await readAlbum(page.records, setPictures());
  if (album.status !== 'read') {
    throw new Error('album nejde přečíst');
  }
  for (const entry of album.entries.filter((each) => each.picture.id === id)) {
    expect(await removeAlbumEntry(page.records, entry.recordId), `smazání ${id}`).toBe('removed');
  }
}

/** Album, které při čtení skončí „nedostupné“ (jako zakázaná IndexedDB). */
export const UNAVAILABLE_ALBUM: GameRecords = {
  list: () => Promise.resolve({ status: 'unavailable' }),
  add: () => Promise.resolve({ status: 'unavailable' }),
  remove: () => Promise.resolve('unavailable'),
};

/** Obsah `localStorage` zařízení (pro „nic se nezměnilo“). */
export function snapshotOf(device: LockDevice): Record<string, string> {
  return device.storage.snapshot();
}

/**
 * Přepíše nesmyslem všechno, co se v `localStorage` od `before` zapsalo
 * nebo změnilo (poškozené záznamy odemčení). Vrátí přepsané klíče.
 */
export function damageWritesSince(device: LockDevice, before: Record<string, string>): string[] {
  const changed = [...device.storage.data.keys()].filter(
    (key) => before[key] !== device.storage.data.get(key),
  );
  for (const key of changed) {
    device.storage.data.set(key, '{nesmysl');
  }
  return changed;
}

/** Klíče, které při každém volání vyhodí výjimku (rozbitá stránka). */
export const THROWING_KEYS: KeyRewards = {
  reportCompletedMaps: () => {
    throw new Error('klíče selhaly');
  },
  balance: () => {
    throw new Error('klíče selhaly');
  },
  spendKey: () => {
    throw new Error('klíče selhaly');
  },
  spentItems: () => {
    throw new Error('klíče selhaly');
  },
};
