/**
 * Pomůcky pro testy k #151 (prázdný papír na volné kreslení).
 *
 * Papír je v sadě omalovánek (`COLORING_PICTURES`) na 1. místě s označením
 * `PAPER` (opsané v `realPicturesHelpers.ts`). Obrys nemá: jeho mapa oblastí
 * je celá plocha vrstvy barev 1024 × 768 jako jedna oblast. Tu dává hra
 * čistou funkcí `blankPaperRegions()` (navržené rozhraní, viz
 * `blankPaper.test.ts`), scéna ji předá malování, náhledu i albu místo
 * obrysu z obrázku. Ostatní omalovánky mají v testech zkušební obrys
 * `twoHalves()` jako v #124: logika výběru, ukládání a alba obrys nezná.
 *
 * Kroky hráče staví na zkušebním zařízení z testů #131 a #141
 * (`SwapDevice`): `localStorage` profilu a album v záznamech hry.
 * - „Otevření Omalovánek“ (`openPaperGame`): nové načtení stránky, výběr nad
 *   celou sadou, dořešení výměny z #131 a přesun stránek do alba (#141 AC4).
 * - „Otevření papíru“ (`openPaper`): ťuknutí na 1. náhled, malování papíru
 *   se ukáže s albem přečteným při otevírání a scéna ho předá výběru
 *   (`attachPainting`, kvůli koštěti z #142); uběhne celé podržení domečku.
 * - „Odchod domečkem“ (`leavePaper`): podržení domečku 1 s a předání
 *   malování výběru (`paintingLeft`), který obrázek uloží a přesune do alba.
 *
 * Výběr měří čas přes `() => Date.now()`, testy běží s falešnými časovači
 * Vitestu (koště a koš se drží 1 s).
 *
 * Obrázek papíru má 786 432 pixelů, proto se pixely porovnávají funkcí
 * `sameImage` a ne `toEqual` (rychlejší a selhání nevypíše celé pole).
 */

import { expect, vi } from 'vitest';

import { readAlbum } from '../../../src/games/coloring/logic/album';
import type { AlbumContents, AlbumPicture } from '../../../src/games/coloring/logic/album';
import { settleAlbumSwap } from '../../../src/games/coloring/logic/albumSwap';
import { blankPaperRegions } from '../../../src/games/coloring/logic/blankPaper';
import { startPictureChoice } from '../../../src/games/coloring/logic/pictureChoice';
import type {
  BroomFeedback,
  PictureChoice,
  TrashFeedback,
} from '../../../src/games/coloring/logic/pictureChoice';
import type { PictureLocks } from '../../../src/games/coloring/logic/pictureLocks';
import {
  loadPicturePreview,
  previewCellHex,
} from '../../../src/games/coloring/logic/picturePreview';
import { COLORING_PICTURES } from '../../../src/games/coloring/logic/pictureSet';
import type { RegionMap } from '../../../src/games/coloring/logic/regionMap';
import { openColoring } from '../../../src/games/coloring/logic/savedPicture';
import type {
  PaintingOrigin,
  PictureIdentity,
  SavedColoring,
} from '../../../src/games/coloring/logic/savedPicture';
import { HOLD_TO_GO_HOME_MS } from '../../../src/shared/logic/homeButton';
import type { KeyValueStorage } from '../../../src/shared/storage/keyValueStorage';
import type { GameRecords } from '../../../src/shared/storage/profileRecords';
import { EMA, SwapDevice, sameImage } from './continuePaintingHelpers';
import type { Pixels } from './continuePaintingHelpers';
import { settleLong } from './pageToAlbumHelpers';
import { PAPER } from './realPicturesHelpers';
import { paint, pixelsOf, twoHalves } from './savedPictureHelpers';
import type { Point } from './outlineFixtures';
import { at } from './strokeHelpers';

export { EMA, PAPER, SwapDevice, sameImage };
export type { Pixels };

/** Rozměr vrstvy barev malování (jako u omalovánek s obrysem, #127: naležato). */
export const PAPER_WIDTH = 1024;
export const PAPER_HEIGHT = 768;

/** Místo papíru na výběru (#151 AC1: první na 1. stránce). */
export const PAPER_PLACE = 0;

/** Barvy tahů v testech papíru (čísla barev sad). */
export const PAPER_COLOR = 30;
export const OTHER_COLOR = 31;

let cachedRegions: RegionMap | undefined;

/** Mapa oblastí papíru, jak ji hra dá malování, náhledu i albu. */
export function paperRegions(): RegionMap {
  const regions = cachedRegions ?? blankPaperRegions();
  cachedRegions = regions;
  return regions;
}

/** Je omalovánka papír? */
export function isPaper(picture: PictureIdentity): boolean {
  return picture.id === PAPER.id && picture.version === PAPER.version;
}

/** Mapa oblastí omalovánky sady v testech: papír bez obrysu, ostatní zkušební obrys. */
export function regionsOf(picture: PictureIdentity): RegionMap {
  return isPaper(picture) ? paperRegions() : twoHalves();
}

/** Omalovánky sady i s mapou oblastí, jak je scéna dá albu (papír s mapou papíru). */
export function paperSetPictures(): AlbumPicture[] {
  return COLORING_PICTURES.map((identity) => ({ identity, regions: regionsOf(identity) }));
}

/** Jedno načtení stránky s Omalovánkami nad zkušebním zařízením. */
export interface PaperPage {
  readonly device: SwapDevice;
  readonly storage: KeyValueStorage;
  readonly records: GameRecords | undefined;
  readonly pictures: readonly AlbumPicture[];
  readonly choice: PictureChoice;
  readonly broomFeedback: BroomFeedback[];
  readonly trashFeedback: TrashFeedback[];
}

export interface PaperLoadOptions {
  /** Hra bez alba (dočasný profil). */
  readonly withoutAlbum?: boolean;
  readonly locks?: PictureLocks;
}

/** Dítě ťukne v menu na Omalovánky: načtení stránky, výměna z #131, přesun stránek (#141). */
export async function openPaperGame(
  device: SwapDevice,
  options: PaperLoadOptions = {},
): Promise<PaperPage> {
  device.nextLoad();
  const storage = device.storage(EMA);
  const records = options.withoutAlbum === true ? undefined : device.records(EMA);
  const pictures = paperSetPictures();
  const broomFeedback: BroomFeedback[] = [];
  const trashFeedback: TrashFeedback[] = [];
  const choice = startPictureChoice(COLORING_PICTURES, {
    now: () => Date.now(),
    records,
    storage,
    albumPictures: pictures,
    onBroom: (event) => {
      broomFeedback.push(event);
    },
    onTrash: (event) => {
      trashFeedback.push(event);
    },
    ...(options.locks === undefined ? {} : { locks: options.locks }),
  });
  await settleAlbumSwap({ storage, records, pictures });
  await choice.movePagesToAlbum();
  await settleLong();
  return { device, storage, records, pictures, choice, broomFeedback, trashFeedback };
}

/** Album tak, jak ho přečte kniha (nebo malování při otevírání). */
export function albumOf(page: PaperPage): Promise<AlbumContents> {
  return readAlbum(page.records, page.pictures);
}

/** Scéna otevře malování omalovánky `picture` s albem přečteným při otevírání a předá ho výběru. */
export async function createPainting(
  page: PaperPage,
  picture: PictureIdentity,
  origin: PaintingOrigin,
): Promise<SavedColoring> {
  const contents = await albumOf(page);
  const game = openColoring({
    regions: regionsOf(picture),
    picture,
    storage: page.storage,
    album: { records: page.records, contents },
    origin,
  });
  page.choice.attachPainting(game);
  page.choice.paintingShown();
  vi.advanceTimersByTime(HOLD_TO_GO_HOME_MS);
  return game;
}

/** Dítě na výběru ťukne na papír a malování papíru se ukáže. */
export async function openPaper(page: PaperPage): Promise<SavedColoring> {
  const tap = page.choice.tapPreview(PAPER_PLACE);
  expect(tap, 'ťuknutí na 1. náhled otevře papír').toMatchObject({ kind: 'open', picture: PAPER });
  return createPainting(page, PAPER, 'picker');
}

/** Dítě podrží domeček 1 s v malování a přesun do alba (#141) doběhne. */
export async function leavePaper(page: PaperPage, game: SavedColoring): Promise<void> {
  expect(page.choice.holdHome(), 'domeček v malování vede na výběr').toBe('toPicker');
  await page.choice.paintingLeft(game);
  await settleLong();
}

/** Tah štětcem barvou `color` přes celý papír: rohy a střed. */
export function paintAcrossPaper(game: SavedColoring, color: number = PAPER_COLOR): void {
  game.tapColor(color);
  paint(game, [
    at(20, 20),
    at(PAPER_WIDTH - 20, 20),
    at(PAPER_WIDTH - 20, PAPER_HEIGHT - 20),
    at(20, PAPER_HEIGHT - 20),
    at(PAPER_WIDTH / 2, PAPER_HEIGHT / 2),
  ]);
}

/** Papír po pixelech. */
export function paperPixels(colors: { colorAt(x: number, y: number): number | null }): Pixels {
  return pixelsOf(colors, paperRegions());
}

/** Je obrázek bez jediné barvy (čistý bílý papír)? */
export function isBlank(pixels: Pixels): boolean {
  return pixels.every((pixel) => pixel === null);
}

/** Rozmalovaná stránka papíru v úložišti profilu, jak by ji dítě vidělo po otevření. */
export function storedPaper(device: SwapDevice): Pixels {
  const game = openColoring({
    regions: paperRegions(),
    picture: PAPER,
    storage: device.reader(EMA),
  });
  return paperPixels(game);
}

/** Obrázek alba: omalovánka a u papíru jeho pixely. */
export interface ShownEntry {
  readonly picture: PictureIdentity;
  readonly pixels: Pixels | null;
}

/** Obrázky alba profilu od nejnovějšího, přímo z úložiště (u papíru i pixely). */
export async function albumEntries(device: SwapDevice): Promise<ShownEntry[]> {
  const album = await readAlbum(device.rawRecords(EMA), paperSetPictures());
  if (album.status !== 'read') {
    return [];
  }
  return album.entries.map((entry) => ({
    picture: entry.picture,
    pixels: isPaper(entry.picture) ? paperPixels(entry.colors) : null,
  }));
}

/** Barvy v náhledu papíru na výběru jako šestnáctkové kódy. */
export function previewColorsOfPaper(storage: KeyValueStorage | undefined): string[] {
  const preview = loadPicturePreview({
    storage,
    picture: PAPER,
    regions: paperRegions(),
    width: 64,
    height: 48,
  });
  const colors = new Set<string>();
  for (let y = 0; y < preview.height; y += 1) {
    for (let x = 0; x < preview.width; x += 1) {
      colors.add(previewCellHex(preview.cellAt(x, y)));
    }
  }
  return [...colors].sort();
}

/** Kolik zabarvených pixelů je ve čtverci o poloměru `radius` kolem bodu. */
export function paintedNear(
  colors: { colorAt(x: number, y: number): number | null },
  point: Point,
  radius: number,
): number {
  let count = 0;
  for (let y = Math.floor(point.y - radius); y <= point.y + radius; y += 1) {
    for (let x = Math.floor(point.x - radius); x <= point.x + radius; x += 1) {
      if (colors.colorAt(x, y) !== null) {
        count += 1;
      }
    }
  }
  return count;
}
