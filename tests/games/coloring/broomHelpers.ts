/**
 * Pomůcky pro testy k #142 (koště v malování vymaže stránku a zruší
 * malování). Označení podle issue: **N** je malování otevřené z výběru,
 * **A** je malování obrázku z alba otevřené štětcem (Malovat dál, #131).
 * „Začátek“ je u N čistý obrys, u A obrázek přesně tak, jak byl při
 * otevření, a po vyfocení v témže malování (N i A) čistý obrys.
 *
 * Staví na zkušebním zařízení z testů #131 a #141 (`SwapDevice`):
 * `localStorage` profilu s rozmalovanými stránkami a album v záznamech
 * hry. Koště je podržení 1 s jako koš v #129: testy ho drží s falešnými
 * časovači Vitestu a výběr měří čas přes `() => Date.now()`.
 *
 * Navržené rozhraní (viz výstup testů #142):
 * - `startPictureChoice(…, { onBroom })` hlásí odezvu koštěte
 *   (`BroomFeedback`): kroužek (`broomHolding`), zhoupnutí s tónem domečku
 *   (`broomWobble`) a zrušení (`cleared` s plochou k překreslení),
 * - `PictureChoice.broomButton: HoldButton` koště, scéna mu předává stisk,
 *   zvednutí, přerušení a sjetí prstu,
 * - `PictureChoice.attachPainting(game)` scéna předá malování, které
 *   otevřela (koště pak ruší jeho stránku),
 * - `openColoring({ …, origin })` s `origin: 'picker' | 'album'` (bez něj
 *   `'picker'`): odkud se malování otevřelo, podle toho je začátek.
 *
 * Všechna volání nového rozhraní jsou jen tady, aby šla při implementaci
 * upravit na jednom místě.
 */

import { expect, vi } from 'vitest';

import { readAlbum } from '../../../src/games/coloring/logic/album';
import type { AlbumPicture } from '../../../src/games/coloring/logic/album';
import { settleAlbumSwap } from '../../../src/games/coloring/logic/albumSwap';
import { startPictureChoice } from '../../../src/games/coloring/logic/pictureChoice';
import type {
  BroomFeedback,
  PictureChoice,
  TrashFeedback,
} from '../../../src/games/coloring/logic/pictureChoice';
import type { RegionMap } from '../../../src/games/coloring/logic/regionMap';
import { openColoring } from '../../../src/games/coloring/logic/savedPicture';
import type {
  PaintingOrigin,
  PictureIdentity,
  SavedColoring,
} from '../../../src/games/coloring/logic/savedPicture';
import type { Tone } from '../../../src/shared/audio/tonePlayer';
import { HOLD_TO_GO_HOME_MS } from '../../../src/shared/logic/homeButton';
import type { KeyValueStorage } from '../../../src/shared/storage/keyValueStorage';
import type { GameRecords } from '../../../src/shared/storage/profileRecords';
import { fillAlbum } from './albumHelpers';
import {
  EMA,
  HOUSE,
  SwapDevice,
  THREE_PICTURES,
  albumPixels,
  openBigPicture,
  swapPictures,
  tapContinue,
} from './continuePaintingHelpers';
import type { Pixels } from './continuePaintingHelpers';
import { previewIndexOf, settleLong } from './pageToAlbumHelpers';
import { pixelsOf, twoHalves } from './savedPictureHelpers';

/** Jak dlouho se drží koště, aby zrušilo stránku (#142 AC1: podržení 1 s). */
export const BROOM_HOLD_MS = 1000;

/** Prst, kterým dítě v testech drží koště. */
export const BROOM_FINGER = 1;

/** Výběr Omalovánek jednoho načtení stránky s odezvou koštěte. */
export interface BroomPage {
  readonly storage: KeyValueStorage;
  readonly records: GameRecords | undefined;
  readonly choice: PictureChoice;
  readonly pictures: readonly AlbumPicture[];
  readonly regions: RegionMap;
  /** Všechna odezva koštěte od spuštění výběru. */
  readonly broomFeedback: BroomFeedback[];
  /** Odezva koše z #129 (jen kvůli společným pomůckám velkého obrázku). */
  readonly trashFeedback: TrashFeedback[];
}

/** Výběr nad úložištěm a záznamy profilu, s odezvou koštěte. */
export function startBroomPage(
  storage: KeyValueStorage,
  records: GameRecords | undefined,
): BroomPage {
  const pictures = swapPictures();
  const broomFeedback: BroomFeedback[] = [];
  const trashFeedback: TrashFeedback[] = [];
  const choice = startPictureChoice(THREE_PICTURES, {
    now: () => Date.now(),
    records,
    storage,
    albumPictures: pictures,
    onTrash: (event) => {
      trashFeedback.push(event);
    },
    onBroom: (event) => {
      broomFeedback.push(event);
    },
  });
  return { storage, records, choice, pictures, regions: twoHalves(), broomFeedback, trashFeedback };
}

export interface BroomLoadOptions {
  /** Hra bez alba (dočasný profil, album nejde použít). */
  readonly withoutAlbum?: boolean;
  /** Záznamy místo záznamů zařízení (např. pomalé úložiště). */
  readonly records?: (device: GameRecords) => GameRecords;
}

/**
 * Dítě ťukne v menu na Omalovánky: nové načtení stránky, dořešení výměny
 * z #131 a přesun rozmalovaných stránek do alba (#141), vše doběhne.
 */
export async function enterGame(
  device: SwapDevice,
  options: BroomLoadOptions = {},
): Promise<BroomPage> {
  device.nextLoad();
  const deviceRecords = device.records(EMA);
  const records =
    options.withoutAlbum === true
      ? undefined
      : options.records === undefined
        ? deviceRecords
        : options.records(deviceRecords);
  const page = startBroomPage(device.storage(EMA), records);
  await settleAlbumSwap({ storage: page.storage, records: page.records, pictures: page.pictures });
  await page.choice.movePagesToAlbum();
  await settleLong();
  return page;
}

/** Scéna otevře malování omalovánky `picture` s albem přečteným při otevírání a předá ho výběru. */
export async function createPainting(
  page: BroomPage,
  origin: PaintingOrigin,
  picture: PictureIdentity = HOUSE,
): Promise<SavedColoring> {
  const contents = await readAlbum(page.records, page.pictures);
  const game = openColoring({
    regions: page.regions,
    picture,
    storage: page.storage,
    album: { records: page.records, contents },
    origin,
  });
  page.choice.attachPainting(game);
  return game;
}

/** Malování se ukáže a uběhne celé podržení domečku (#124 AC5). */
export function showPainting(page: BroomPage): void {
  page.choice.paintingShown();
  vi.advanceTimersByTime(HOLD_TO_GO_HOME_MS);
}

/** N: dítě na výběru ťukne na náhled omalovánky a malování se ukáže. */
export async function openFromPicker(
  page: BroomPage,
  picture: PictureIdentity = HOUSE,
): Promise<SavedColoring> {
  const tap = page.choice.tapPreview(previewIndexOf(picture));
  expect(tap.kind, `náhled ${picture.id} otevře malování`).toBe('open');
  const game = await createPainting(page, 'picker', picture);
  showPainting(page);
  return game;
}

/** A otevřený štětcem z alba: malování, obrázek A a album před ťuknutím na štětec. */
export interface AlbumPainting {
  readonly page: BroomPage;
  readonly game: SavedColoring;
  readonly a: Pixels;
  readonly albumBefore: Pixels[];
}

/**
 * A: v albu je `albumCount` obrázků domku, dítě otevře Omalovánky, album,
 * velký obrázek na místě `index` a ťukne na štětec; malování A se ukáže.
 * Album se plní se skutečnými časovači jako v testech #126, pak zase falešné.
 */
export async function openFromAlbum(
  device: SwapDevice,
  options: BroomLoadOptions & { readonly albumCount?: number; readonly index?: number } = {},
): Promise<AlbumPainting> {
  vi.useRealTimers();
  await fillAlbum(device.records(EMA), options.albumCount ?? 3, HOUSE);
  vi.useFakeTimers();
  const page = await enterGame(device, options);
  const records = page.records;
  if (records === undefined) {
    throw new Error('malování z alba potřebuje album');
  }
  const withAlbum = { ...page, records };
  const albumBefore = await albumPixels(device);
  const entry = await openBigPicture(withAlbum, options.index ?? 1);
  const a = pixelsOf(entry.colors, page.regions);
  const outcome = await tapContinue(withAlbum);
  expect(outcome.kind, 'štětec otevře malování A').toBe('opened');
  const game = await createPainting(page, 'album');
  showPainting(page);
  return { page, game, a, albumBefore };
}

/** Dítě podrží koště `ms` a zvedne prst. */
export function holdBroom(
  page: BroomPage,
  ms: number = BROOM_HOLD_MS,
  finger = BROOM_FINGER,
): void {
  page.choice.broomButton.press(finger);
  vi.advanceTimersByTime(ms);
  page.choice.broomButton.release(finger);
}

/** Kolikrát koště stránku zrušilo. */
export function clearCount(page: BroomPage): number {
  return page.broomFeedback.filter((event) => event.kind === 'cleared').length;
}

/** Tóny všech zhoupnutí koštěte. */
export function broomWobbles(page: BroomPage): Array<readonly Tone[]> {
  return page.broomFeedback.flatMap((event) => (event.kind === 'broomWobble' ? [event.tones] : []));
}

/** Dítě podrží domeček 1 s v malování a přesun do alba (#141) doběhne. */
export async function leavePainting(page: BroomPage, game: SavedColoring): Promise<void> {
  expect(page.choice.holdHome(), 'domeček v malování vede na výběr').toBe('toPicker');
  await page.choice.paintingLeft(game);
  await settleLong();
}

/** Malování po pixelech. */
export function picturePixels(page: BroomPage, game: SavedColoring): Pixels {
  return pixelsOf(game, page.regions);
}

/** Je obrázek bez jediné barvy (čistý obrys)? */
export function isClean(pixels: Pixels): boolean {
  return pixels.every((pixel) => pixel === null);
}
