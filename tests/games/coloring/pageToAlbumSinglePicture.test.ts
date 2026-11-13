import { describe, expect, it } from 'vitest';

import { readAlbum } from '../../../src/games/coloring/logic/album';
import type { AlbumPicture } from '../../../src/games/coloring/logic/album';
import { settleAlbumSwap } from '../../../src/games/coloring/logic/albumSwap';
import {
  homeHoldDecision,
  startPictureChoice,
} from '../../../src/games/coloring/logic/pictureChoice';
import type { PictureChoice } from '../../../src/games/coloring/logic/pictureChoice';
import { openColoring } from '../../../src/games/coloring/logic/savedPicture';
import type { SavedColoring } from '../../../src/games/coloring/logic/savedPicture';
import { HOLD_TO_GO_HOME_MS } from '../../../src/shared/logic/homeButton';
import type { KeyValueStorage } from '../../../src/shared/storage/keyValueStorage';
import type { GameRecords } from '../../../src/shared/storage/profileRecords';
import { paintLeft } from './albumHelpers';
import {
  EMA,
  HOUSE,
  PAGE_COLOR,
  SwapDevice,
  albumPixels,
  isClean,
  pageOf,
  picturePixels,
  settleLong,
} from './pageToAlbumHelpers';
import type { Pixels } from './pageToAlbumHelpers';
import { twoHalves } from './savedPictureHelpers';

/**
 * Testy k #141 AC1, AC4 a AC5 pro sadu s jedinou omalovánkou (#124: výběr
 * se nezobrazí, rovnou se otevírá malování a domeček z malování vede do
 * menu). Odchod do menu je odchod z malování: obrázek jde do alba stejně
 * jako po návratu na výběr. Při otevření Omalovánek začíná výběr ve stavu
 * „otevírá se“ té jediné omalovánky; přesun při otevření ji kvůli tomu
 * nesmí přeskočit, dokud dítě ještě nemaluje.
 */

/** Jediná omalovánka sady se zkušebním obrysem. */
const ONLY: readonly AlbumPicture[] = [{ identity: HOUSE, regions: twoHalves() }];

interface SinglePage {
  readonly storage: KeyValueStorage;
  readonly records: GameRecords;
  readonly choice: PictureChoice;
  readonly clock: { now: number };
}

/** Načtení stránky s Omalovánkami, které mají jedinou omalovánku. */
function loadSingle(device: SwapDevice): SinglePage {
  device.nextLoad();
  const storage = device.storage(EMA);
  const records = device.records(EMA);
  const clock = { now: 0 };
  const choice = startPictureChoice([HOUSE], {
    now: () => clock.now,
    records,
    storage,
    albumPictures: ONLY,
  });
  return { storage, records, choice, clock };
}

/** Otevření Omalovánek: odložená výměna, pak přesun stránek do alba, a vše doběhne. */
async function openSingle(device: SwapDevice): Promise<SinglePage> {
  const page = loadSingle(device);
  expect(page.choice.screen(), 'malování jediné omalovánky se otevírá').toEqual({
    kind: 'opening',
    picture: HOUSE,
  });
  await settleAlbumSwap({ storage: page.storage, records: page.records, pictures: ONLY });
  await page.choice.movePagesToAlbum();
  await settleLong();
  return page;
}

/** Malování se ukáže s albem přečteným při otevírání a uběhne celé podržení domečku. */
async function showPainting(page: SinglePage): Promise<SavedColoring> {
  const contents = await readAlbum(page.records, ONLY);
  page.choice.paintingShown();
  page.clock.now += HOLD_TO_GO_HOME_MS;
  return openColoring({
    regions: twoHalves(),
    picture: HOUSE,
    storage: page.storage,
    album: { records: page.records, contents },
  });
}

/** Dítě namaluje levou polovinu a podrží domeček 1 s do menu. Vrátí obrázek. */
async function paintAndLeaveToMenu(page: SinglePage): Promise<Pixels> {
  const game = await showPainting(page);
  paintLeft(game, PAGE_COLOR);
  const painted = picturePixels(game);
  const hold = page.choice.holdHome();
  expect(hold, 'domeček vede do menu').toBe('toMenu');
  expect(homeHoldDecision(hold), 'stránka odejde do menu').toBe('leave');
  await page.choice.paintingLeft(game);
  await settleLong();
  return painted;
}

describe('#141: sada s jedinou omalovánkou', () => {
  it('po podržení domečku do menu je obrázek v albu jednou a stránka je čistá', async () => {
    const device = new SwapDevice();
    const page = await openSingle(device);

    const painted = await paintAndLeaveToMenu(page);

    expect(await albumPixels(device, EMA, ONLY), 'obrázek je v albu jednou').toEqual([painted]);
    expect(isClean(pageOf(device)), 'stránka je čistá').toBe(true);
  });

  it('stránka, která se při odchodu do menu nepřesunula, se přesune při dalším otevření Omalovánek, než dítě začne malovat', async () => {
    const device = new SwapDevice();
    device.recordsUnavailable = true;
    const first = await openSingle(device);
    const painted = await paintAndLeaveToMenu(first);
    expect(pageOf(device), 'album nebylo dostupné: obrázek zůstal na stránce').toEqual(painted);
    device.repair();

    const again = await openSingle(device);

    expect(await albumPixels(device, EMA, ONLY), 'obrázek je v albu jednou').toEqual([painted]);
    expect(isClean(pageOf(device)), 'stránka je čistá').toBe(true);
    const game = await showPainting(again);
    expect(isClean(picturePixels(game)), 'malování se otevře čisté').toBe(true);
  });
});
