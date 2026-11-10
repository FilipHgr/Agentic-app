/**
 * Pomůcky pro testy k #126 (fotoaparát uloží hotový obrázek do alba, kniha
 * na výběru ho ukáže). Album je v záznamech hry aktivního profilu z #125
 * (`GameRecords`, v testech verze v paměti `memoryProfileRecords`).
 *
 * Jedno „otevření omalovánky“ je přečtení alba (`readAlbum`, scéna ho čte
 * během otevírání omalovánky) a `openColoring` s albem, aby hra po ťuknutí
 * na fotoaparát věděla hned, jestli se obrázek uloží (#126 AC2 a). Jedno
 * „obnovení stránky“ je nové `memoryProfileRecords` nad stejnou poličkou
 * (`MemoryRecordsShelf`) a nové otevření nad stejným úložištěm hry.
 *
 * Testy neznají tvar záznamu alba: obrázky do alba ukládá jen fotoaparát,
 * nečitelné záznamy jsou cizí data (`addUnreadable`) a poškozené záznamy
 * vzniknou zkrácením textů a bajtů platného záznamu (`damageAlbum`).
 *
 * Všechny omalovánky sady mají v testech stejný zkušební obrys
 * `twoHalves()`, jako v testech výběru (#124).
 *
 * Navržené rozhraní (viz výstup testů #126):
 * - `src/games/coloring/logic/album.ts`: `readAlbum`, `AlbumPicture`,
 *   `AlbumContents`, `AlbumEntry`, `CAMERA_CLICK_TONES`,
 *   `ALBUM_PICTURE_LIMIT`, `ALBUM_RECORD_LIMIT`,
 * - `openColoring({ …, album: { records, contents } })`
 *   a `SavedColoring.tapCamera(): CameraTap` v `savedPicture.ts`,
 * - `PictureChoice.tapBook`, `PictureChoice.tapAlbumPreview` a obrazovka
 *   `{ kind: 'album' }` v `pictureChoice.ts`.
 */

import { expect } from 'vitest';

import { readAlbum } from '../../../src/games/coloring/logic/album';
import type { AlbumContents, AlbumPicture } from '../../../src/games/coloring/logic/album';
import type { RegionMap } from '../../../src/games/coloring/logic/regionMap';
import { openColoring } from '../../../src/games/coloring/logic/savedPicture';
import type {
  CameraSaveResult,
  PictureIdentity,
  SavedColoring,
} from '../../../src/games/coloring/logic/savedPicture';
import type { KeyValueStorage } from '../../../src/shared/storage/keyValueStorage';
import {
  createMemoryRecordsShelf,
  memoryProfileRecords,
} from '../../../src/shared/storage/profileRecords';
import type {
  GameRecords,
  MemoryRecordsShelf,
  RecordData,
  RecordsAdd,
} from '../../../src/shared/storage/profileRecords';
import { CIRCLES, HOUSE, STAR, THREE_PICTURES } from './pictureChoiceHelpers';
import { paint, twoHalves } from './savedPictureHelpers';
import { at } from './strokeHelpers';

export { CIRCLES, HOUSE, STAR, THREE_PICTURES };

/** Označení Omalovánek v registru her; záznamy alba patří této hře. */
export const COLORING_GAME_ID = 'coloring';

/** Profil v testech bez správy profilů. */
const TEST_PROFILE = 'p-test';

/** Omalovánky sady i s obrysem, jak je scéna dá albu (všechny se zkušebním obrysem). */
export function albumPicturesOf(
  pictures: readonly PictureIdentity[] = THREE_PICTURES,
  regions: RegionMap = twoHalves(),
): AlbumPicture[] {
  return pictures.map((identity) => ({ identity, regions }));
}

/** Zařízení se záznamy her v paměti; `page()` je nové načtení stránky. */
export interface AlbumDevice {
  readonly shelf: MemoryRecordsShelf;
  /** Záznamy Omalovánek zkušebního profilu po novém načtení stránky. */
  page(): GameRecords;
}

export function albumDevice(): AlbumDevice {
  const shelf = createMemoryRecordsShelf();
  return {
    shelf,
    page: () => memoryProfileRecords(shelf).forGame(TEST_PROFILE, COLORING_GAME_ID),
  };
}

/**
 * Záznamy, které počítají ukládání a mazání a umí ukládání podržet
 * (`holdAdds`) nebo nechat skončit jinak (`addResult`), jako pomalé nebo
 * plné úložiště.
 */
export interface WatchedRecords extends GameRecords {
  /** Kolikrát hra zkusila uložit. */
  adds(): number;
  /** Kolikrát hra zkusila mazat. */
  removes(): number;
  /** Další ukládání počkají na `releaseAdds`. */
  holdAdds(): void;
  /** Pustí podržená ukládání; s `result` skončí tak, bez uložení. */
  releaseAdds(result?: 'full' | 'unavailable'): Promise<void>;
  /** Každé další ukládání skončí `result` a nic neuloží. */
  failAdds(result: 'full' | 'unavailable'): void;
}

export function watchRecords(inner: GameRecords): WatchedRecords {
  let adds = 0;
  let removes = 0;
  let holding = false;
  let failure: 'full' | 'unavailable' | null = null;
  const waiting: Array<{ data: RecordData; finish: (result: RecordsAdd) => void }> = [];

  const addNow = (data: RecordData): Promise<RecordsAdd> =>
    failure === null ? inner.add(data) : Promise.resolve({ status: failure });

  return {
    list: () => inner.list(),
    add: (data) => {
      adds += 1;
      if (!holding) {
        return addNow(data);
      }
      return new Promise((finish) => {
        waiting.push({ data, finish });
      });
    },
    remove: (id) => {
      removes += 1;
      return inner.remove(id);
    },
    adds: () => adds,
    removes: () => removes,
    holdAdds: () => {
      holding = true;
    },
    releaseAdds: async (result) => {
      holding = false;
      for (const { data, finish } of waiting.splice(0)) {
        finish(result === undefined ? await inner.add(data) : { status: result });
      }
    },
    failAdds: (result) => {
      failure = result;
    },
  };
}

/** Dítě otevře omalovánku `picture`: scéna přečte album a otevře malování s ním. */
export async function openWithAlbum(options: {
  readonly storage: KeyValueStorage | undefined;
  readonly records: GameRecords | undefined;
  readonly regions?: RegionMap;
  readonly picture?: PictureIdentity;
  readonly pictures?: readonly PictureIdentity[];
}): Promise<SavedColoring> {
  const regions = options.regions ?? twoHalves();
  const contents = await readAlbum(
    options.records,
    albumPicturesOf(options.pictures ?? THREE_PICTURES, regions),
  );
  return openColoring({
    regions,
    picture: options.picture ?? HOUSE,
    storage: options.storage,
    album: { records: options.records, contents },
  });
}

/** Album, jak ho kniha na výběru přečte. */
export function albumOf(
  records: GameRecords | undefined,
  pictures: readonly PictureIdentity[] = THREE_PICTURES,
  regions: RegionMap = twoHalves(),
): Promise<AlbumContents> {
  return readAlbum(records, albumPicturesOf(pictures, regions));
}

/** Kolik obrázků album ukáže (nedostupné album žádný). */
export async function shownCount(
  records: GameRecords | undefined,
  pictures: readonly PictureIdentity[] = THREE_PICTURES,
): Promise<number> {
  const album = await albumOf(records, pictures);
  return album.status === 'read' ? album.entries.length : 0;
}

/** Kolik záznamů v profilu je (i nečitelných). */
export async function recordCount(records: GameRecords): Promise<number> {
  const listed = await records.list();
  return listed.status === 'read' ? listed.records.length : 0;
}

/** Tah štětcem barvou `color` v levé polovině zkušebního obrysu. */
export function paintLeft(game: SavedColoring, color: number): void {
  game.tapColor(color);
  paint(game, [at(30, 40), at(120, 40), at(120, 120), at(30, 120)]);
}

/**
 * Dítě ťukne na fotoaparát a ukládání se dokončí. Selže, když fotoaparát
 * nezačal ukládat (cvak a animace).
 */
export async function takePhoto(game: SavedColoring): Promise<CameraSaveResult> {
  const tap = game.tapCamera();
  expect(tap.kind, 'fotoaparát začne ukládat').toBe('saving');
  if (tap.kind !== 'saving') {
    throw new Error('fotoaparát neukládal');
  }
  return tap.done;
}

/**
 * Do alba omalovánky `picture` se uloží `count` různých obrázků (každý
 * jinou barvou, nad vlastním úložištěm hry), jako by je dítě postupně
 * namalovalo a vyfotilo.
 */
export async function fillAlbum(
  records: GameRecords,
  count: number,
  picture: PictureIdentity = HOUSE,
  pictures: readonly PictureIdentity[] = THREE_PICTURES,
): Promise<void> {
  for (let photo = 0; photo < count; photo += 1) {
    const game = await openWithAlbum({ storage: undefined, records, picture, pictures });
    paintLeft(game, photo);
    const result = await takePhoto(game);
    expect(result.kind, `uložení obrázku ${photo + 1} do alba`).toBe('saved');
  }
}

/** Nečitelné záznamy: cizí data, která nejsou obrázkem alba. */
const UNREADABLE: readonly RecordData[] = [
  {},
  { nesmysl: true },
  { picture: 42, pixels: 'xyz' },
  { bytes: new Uint8Array([1, 2, 3]) },
];

/** Uloží `count` nečitelných záznamů rovnou do úložiště (jako od jiné verze nebo poškozené). */
export async function addUnreadable(records: GameRecords, count: number): Promise<void> {
  for (let index = 0; index < count; index += 1) {
    const data = UNREADABLE[index % UNREADABLE.length] ?? {};
    const result = await records.add({ ...data, index });
    expect(result.status, `nečitelný záznam ${index + 1}`).toBe('saved');
  }
}

/** Zkrácená hodnota: text a bajty na polovinu, ostatní beze změny. */
function damaged(value: unknown): unknown {
  if (typeof value === 'string') {
    return value.slice(0, Math.floor(value.length / 2));
  }
  if (value instanceof Uint8Array) {
    return value.slice(0, Math.floor(value.length / 2));
  }
  if (Array.isArray(value)) {
    return value.slice(0, Math.floor(value.length / 2));
  }
  return value;
}

/**
 * Poškodí všechny záznamy v poličce: texty, bajty a seznamy v datech
 * zkrátí na polovinu (jako nedopsaný zápis). Vrátí jejich označení.
 */
export function damageAlbum(shelf: MemoryRecordsShelf): string[] {
  const damagedRecords = shelf.records.map((record) => ({
    ...record,
    data: Object.fromEntries(
      Object.entries(record.data).map(([key, value]) => [key, damaged(value)]),
    ),
  }));
  shelf.records.splice(0, shelf.records.length, ...damagedRecords);
  return shelf.records.map((record) => record.id);
}

/** Nechá doběhnout čekající sliby (ukládání ve verzi v paměti skončí hned). */
export async function settle(): Promise<void> {
  for (let round = 0; round < 10; round += 1) {
    await Promise.resolve();
  }
}
