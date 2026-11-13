/**
 * Pomůcky pro testy k #141 (rozmalovaný obrázek jde do alba sám, výběr je
 * vždy čistý). Staví na zkušebním zařízení z testů #131
 * (`SwapDevice` v `continuePaintingHelpers.ts`): `localStorage` profilu
 * s rozmalovanými stránkami a album v záznamech hry (IndexedDB), které umí
 * selhat a „vypnout stránku“ po zadaném počtu zápisů.
 *
 * Kroky hráče tak, jak je vidí logika:
 * - „Načtení stránky“ (`loadGame`): nové úložiště i záznamy nad stejnými
 *   daty a výběr `startPictureChoice` se zkušebními hodinami.
 * - „Otevření Omalovánek“ (`openGame`): načtení, dokončení nebo vrácení
 *   odložené výměny z #131 (`settleAlbumSwap`) a pak přesun rozmalovaných
 *   stránek do alba (`PictureChoice.movePagesToAlbum`, #141 AC4).
 * - „Otevření malování“ (`openPainting`): ťuknutí na náhled, malování se
 *   ukáže s albem přečteným při otevírání a hodiny se posunou o celé
 *   podržení domečku.
 * - „Odchod domečkem“ (`leavePainting`): podržení domečku 1 s v malování
 *   (`holdHome` → `toPicker`) a předání malování výběru
 *   (`PictureChoice.paintingLeft`), který tah ukončí, obrázek uloží
 *   a stránku přesune do alba (#141 AC1).
 *
 * Testy neznají klíče úložiště ani tvar záznamů: stav čtou jen tak, jak ho
 * vidí hráč (stránka v malování, obrázky alba, náhled na výběru).
 *
 * Navržené rozhraní viz výstup testů #141 (`pictureChoice.ts`,
 * `savedPicture.ts`).
 */

import { expect } from 'vitest';

import { readAlbum } from '../../../src/games/coloring/logic/album';
import type { AlbumContents, AlbumPicture } from '../../../src/games/coloring/logic/album';
import { settleAlbumSwap } from '../../../src/games/coloring/logic/albumSwap';
import { startPictureChoice } from '../../../src/games/coloring/logic/pictureChoice';
import type { PictureChoice } from '../../../src/games/coloring/logic/pictureChoice';
import type { PictureLocks } from '../../../src/games/coloring/logic/pictureLocks';
import { loadPicturePreview } from '../../../src/games/coloring/logic/picturePreview';
import type { RegionMap } from '../../../src/games/coloring/logic/regionMap';
import { openColoring } from '../../../src/games/coloring/logic/savedPicture';
import type {
  PictureIdentity,
  SavedColoring,
} from '../../../src/games/coloring/logic/savedPicture';
import { HOLD_TO_GO_HOME_MS } from '../../../src/shared/logic/homeButton';
import type { KeyValueStorage } from '../../../src/shared/storage/keyValueStorage';
import type { GameRecords } from '../../../src/shared/storage/profileRecords';
import { paintLeft, watchRecords } from './albumHelpers';
import type { WatchedRecords } from './albumHelpers';
import {
  CIRCLES,
  EMA,
  HOUSE,
  STAR,
  SwapDevice,
  THREE_PICTURES,
  albumPixels,
  pageOf,
  swapPictures,
} from './continuePaintingHelpers';
import type { Pixels } from './continuePaintingHelpers';
import { paint, pixelsOf, twoHalves } from './savedPictureHelpers';
import { at } from './strokeHelpers';

export { CIRCLES, EMA, HOUSE, STAR, SwapDevice, THREE_PICTURES, albumPixels, pageOf };
export type { Pixels };

/** Barvy stránek v testech #141; album z `fillAlbum` má barvy 0, 1, 2 … */
export const PAGE_COLOR = 30;
export const SECOND_COLOR = 31;
export const THIRD_COLOR = 32;

/**
 * Kolik kol mikroúloh se čeká, než se stav přečte. Přesun může mít víc
 * kroků (čtení alba, uložení, vyčištění stránky), proto víc než `settle`.
 */
const SETTLE_ROUNDS = 200;

/** Nechá doběhnout všechno, co už doběhnout může (zkušební úložiště nemá časovače). */
export async function settleLong(): Promise<void> {
  for (let round = 0; round < SETTLE_ROUNDS; round += 1) {
    await Promise.resolve();
  }
}

/** Jedno načtení stránky s Omalovánkami jednoho profilu. */
export interface GamePage {
  readonly device: SwapDevice;
  readonly profile: string;
  readonly storage: KeyValueStorage;
  readonly records: GameRecords | undefined;
  readonly pictures: readonly AlbumPicture[];
  readonly regions: RegionMap;
  readonly choice: PictureChoice;
  /** Zkušební hodiny výběru v ms; posouvá je `openPainting`. */
  readonly clock: { now: number };
}

export interface LoadOptions {
  readonly profile?: string;
  /**
   * Záznamy alba místo záznamů zařízení; `undefined` je hra bez alba
   * (dočasný profil). Funkce dostane záznamy zařízení tohoto načtení.
   */
  readonly records?: ((device: GameRecords) => GameRecords) | undefined;
  readonly locks?: PictureLocks;
}

/** Načtení stránky: nové úložiště, záznamy a výběr nad stejnými daty zařízení. */
export function loadGame(device: SwapDevice, options: LoadOptions = {}): GamePage {
  device.nextLoad();
  const profile = options.profile ?? EMA;
  const storage = device.storage(profile);
  const deviceRecords = device.records(profile);
  const records =
    'records' in options
      ? options.records === undefined
        ? undefined
        : options.records(deviceRecords)
      : deviceRecords;
  const pictures = swapPictures();
  const clock = { now: 0 };
  const choice = startPictureChoice(THREE_PICTURES, {
    now: () => clock.now,
    records,
    storage,
    albumPictures: pictures,
    ...(options.locks === undefined ? {} : { locks: options.locks }),
  });
  return { device, profile, storage, records, pictures, regions: twoHalves(), choice, clock };
}

/** Načtení stránky se záznamy, které umí ukládání podržet (pomalé úložiště). */
export function loadWatchedGame(
  device: SwapDevice,
  options: Omit<LoadOptions, 'records'> = {},
): { readonly page: GamePage; readonly watched: WatchedRecords } {
  let watched: WatchedRecords | undefined;
  const page = loadGame(device, {
    ...options,
    records: (inner) => {
      watched = watchRecords(inner);
      return watched;
    },
  });
  if (watched === undefined) {
    throw new Error('záznamy se nepřipravily');
  }
  return { page, watched };
}

/**
 * Otevření Omalovánek nad načtenou stránkou: nejdřív se dořeší odložená
 * výměna (#131), pak začne přesun stránek do alba. Vrátí rozběhnutý přesun.
 */
export async function beginOpening(page: GamePage): Promise<{ readonly moving: Promise<unknown> }> {
  await settleAlbumSwap({ storage: page.storage, records: page.records, pictures: page.pictures });
  return { moving: page.choice.movePagesToAlbum() };
}

/** Dítě ťukne v menu na Omalovánky: načtení stránky, výměna, přesun, a vše doběhne. */
export async function openGame(device: SwapDevice, options: LoadOptions = {}): Promise<GamePage> {
  const page = loadGame(device, options);
  const { moving } = await beginOpening(page);
  await moving;
  await settleLong();
  return page;
}

/** Místo náhledu omalovánky na výběru. */
export function previewIndexOf(picture: PictureIdentity): number {
  const index = THREE_PICTURES.findIndex((each) => each.id === picture.id);
  if (index < 0) {
    throw new Error(`omalovánka ${picture.id} není v sadě`);
  }
  return index;
}

/** Album tak, jak ho přečte kniha (nebo malování při otevírání). */
export function albumOf(page: GamePage): Promise<AlbumContents> {
  return readAlbum(page.records, page.pictures);
}

/**
 * Dítě na výběru ťukne na náhled omalovánky, malování se ukáže s albem
 * přečteným při otevírání a uběhne celé podržení domečku. Selže, když se
 * malování neotevřelo.
 */
export async function openPainting(
  page: GamePage,
  picture: PictureIdentity = HOUSE,
): Promise<SavedColoring> {
  const tap = page.choice.tapPreview(previewIndexOf(picture));
  expect(tap.kind, `náhled ${picture.id} otevře malování`).toBe('open');
  const contents = await albumOf(page);
  page.choice.paintingShown();
  page.clock.now += HOLD_TO_GO_HOME_MS;
  return openColoring({
    regions: page.regions,
    picture,
    storage: page.storage,
    album: { records: page.records, contents },
  });
}

/** Dítě podrží domeček 1 s v malování: výběr se ukáže a začne přesun. Vrátí rozběhnutý přesun. */
export function startLeaving(page: GamePage, game: SavedColoring): Promise<unknown> {
  expect(page.choice.holdHome(), 'domeček v malování vede na výběr').toBe('toPicker');
  return page.choice.paintingLeft(game);
}

/** Dítě podrží domeček 1 s v malování a přesun do alba doběhne. */
export async function leavePainting(page: GamePage, game: SavedColoring): Promise<void> {
  await startLeaving(page, game);
  await settleLong();
}

/** Malování po pixelech. */
export function picturePixels(game: SavedColoring): Pixels {
  return pixelsOf(game, twoHalves());
}

/** Dítě namaluje levou polovinu barvou `color` a odejde domečkem. Vrátí obrázek před odchodem. */
export async function paintAndLeave(
  page: GamePage,
  picture: PictureIdentity,
  color: number,
): Promise<Pixels> {
  const game = await openPainting(page, picture);
  paintLeft(game, color);
  const pixels = picturePixels(game);
  await leavePainting(page, game);
  return pixels;
}

/** Krátký tah barvou `color` v pravé polovině (obrázek se tím liší aspoň v jednom pixelu). */
export function paintRightDot(game: SavedColoring, color: number): void {
  game.tapColor(color);
  paint(game, [at(220, 100), at(222, 100)]);
}

/**
 * Rozmalovaná stránka z doby před #141 (dítě malovalo a stránka zůstala):
 * namaluje se přímo nad úložištěm profilu, bez výběru a přesunu. Vrátí obrázek.
 */
export function paintPageDirectly(
  device: SwapDevice,
  picture: PictureIdentity,
  color: number,
  profile: string = EMA,
): Pixels {
  const game = openColoring({ regions: twoHalves(), picture, storage: device.storage(profile) });
  paintLeft(game, color);
  game.suspend();
  return pageOf(device, picture, profile);
}

/** Je obrázek bez jediné barvy (čistá stránka)? */
export function isClean(pixels: Pixels): boolean {
  return pixels.every((pixel) => pixel === null);
}

/** Barvy v náhledu omalovánky na výběru (prázdné = jen obrys). */
export function previewColors(
  storage: KeyValueStorage | undefined,
  picture: PictureIdentity = HOUSE,
): number[] {
  const preview = loadPicturePreview({
    storage,
    picture,
    regions: twoHalves(),
    width: 40,
    height: 30,
  });
  const colors = new Set<number>();
  for (let y = 0; y < preview.height; y += 1) {
    for (let x = 0; x < preview.width; x += 1) {
      const cell = preview.cellAt(x, y);
      if (cell.kind === 'color') {
        colors.add(cell.color);
      }
    }
  }
  return [...colors].sort((a, b) => a - b);
}

/** Záznamy alba profilu přímo z poličky (kopie, pro „album se nezměnilo“). */
export function recordsOf(device: SwapDevice, profile: string = EMA): unknown {
  return structuredClone(device.shelf.records.filter((record) => record.profileId === profile));
}

/** Záznamy profilu, které nejsou obrázkem alba (nečitelné). */
export function unreadableRecordsOf(device: SwapDevice, profile: string = EMA): unknown {
  return structuredClone(
    device.shelf.records.filter(
      (record) => record.profileId === profile && !('layerCode' in record.data),
    ),
  );
}

/** Kolik zápisů do obou úložišť udělá `run` na zařízení. */
export async function writesOf(device: SwapDevice, run: () => Promise<unknown>): Promise<number> {
  const before = device.writes;
  await run();
  await settleLong();
  return device.writes - before;
}
