import { afterEach, describe, expect, it, vi } from 'vitest';

import type { SavedColoring } from '../../../src/games/coloring/logic/savedPicture';
import { HOLD_TO_GO_HOME_MS } from '../../../src/shared/logic/homeButton';
import {
  prepareSwap,
  reloadAndOpen,
  sameAlbum,
  showPainting,
  tapContinue,
  timesIn,
} from './continuePaintingHelpers';
import type { PreparedSwap } from './continuePaintingHelpers';
import {
  HOUSE,
  SECOND_COLOR,
  albumPixels,
  isClean,
  pageOf,
  paintRightDot,
  picturePixels,
  previewColors,
  settleLong,
} from './pageToAlbumHelpers';

/**
 * Testy k #141 AC3 (malovat dál z #131). Označení podle #131: P je
 * rozmalovaná stránka omalovánky před ťuknutím na štětec, A obrázek
 * z alba. Poslední odrážka #131 AC1 („Náhled té omalovánky pak ukazuje
 * A.“) se nahrazuje: po podržení domečku 1 s ukazuje náhled jen obrys a A
 * je v albu jako nejnovější. Nahrazený test je
 * `continuePainting.test.ts` („podržení domečku 1 s vrátí dítě na výběr,
 * náhled domku ukazuje jen obrys a obrázek z alba je v albu jako
 * nejnovější“). Výměna podle #131 AC2–AC5 platí beze změny a testují ji
 * dál testy #131.
 */

afterEach(() => {
  vi.useRealTimers();
});

/** Dítě ťukne na štětec a malování A se ukáže. */
async function continueToPainting(prepared: PreparedSwap): Promise<SavedColoring> {
  const outcome = await tapContinue(prepared.page);
  expect(outcome, 'štětec otevře malování domku').toEqual({ kind: 'opened', picture: HOUSE });
  return showPainting(prepared.page, HOUSE);
}

/** Dítě v malování A podrží domeček 1 s a přesun doběhne. */
async function leaveContinued(prepared: PreparedSwap, game: SavedColoring): Promise<void> {
  vi.advanceTimersByTime(HOLD_TO_GO_HOME_MS);
  expect(prepared.page.choice.holdHome(), 'domeček vede na výběr').toBe('toPicker');
  await prepared.page.choice.paintingLeft(game);
  await settleLong();
}

describe('#141 AC3: malovat dál a odchod domečkem', () => {
  it('dítě odejde bez tahu: A je v albu právě jednou, nezměněný a nejnovější, náhled je obrys', async () => {
    const prepared = await prepareSwap({ albumCount: 3, aIndex: 1 });
    const game = await continueToPainting(prepared);

    await leaveContinued(prepared, game);

    const album = await albumPixels(prepared.device);
    expect(album[0], 'A je nejnovější a nezměněný').toEqual(prepared.a);
    expect(timesIn(album, prepared.a), 'A je v albu právě jednou').toBe(1);
    expect(timesIn(album, prepared.p), 'P zůstala v albu jednou').toBe(1);
    expect(album.length, 'album má o P víc než před výměnou').toBe(prepared.albumBefore.length + 1);
    expect(previewColors(prepared.page.storage), 'náhled domku je obrys').toEqual([]);
    expect(isClean(pageOf(prepared.device)), 'stránka je čistá').toBe(true);
  });

  it('dítě A domaluje a odejde: v albu je jen domalovaný obrázek, původní A tam není', async () => {
    const prepared = await prepareSwap({ albumCount: 3, aIndex: 1 });
    const game = await continueToPainting(prepared);
    paintRightDot(game, SECOND_COLOR);
    const finished = picturePixels(game);

    await leaveContinued(prepared, game);

    const album = await albumPixels(prepared.device);
    expect(album[0], 'domalovaný obrázek je nejnovější').toEqual(finished);
    expect(timesIn(album, finished), 'domalovaný obrázek je v albu jednou').toBe(1);
    expect(timesIn(album, prepared.a), 'původní A v albu není').toBe(0);
    expect(isClean(pageOf(prepared.device)), 'stránka je čistá').toBe(true);
  });

  it('s čistou stránkou P se A po odchodu vrátí do alba a album je jako před výměnou, jen A nejnovější', async () => {
    const prepared = await prepareSwap({ albumCount: 3, aIndex: 2, page: 'clean' });
    const game = await continueToPainting(prepared);

    await leaveContinued(prepared, game);

    const album = await albumPixels(prepared.device);
    const others = prepared.albumBefore.filter((pixels) => pixels !== prepared.albumBefore[2]);
    expect(sameAlbum(album, [prepared.a, ...others]), 'A nejnovější, ostatní v pořadí').toBe(true);
  });

  it('A, od kterého dítě odešlo zavřením stránky, je po dalším otevření Omalovánek v albu jednou', async () => {
    const prepared = await prepareSwap({ albumCount: 3, aIndex: 1 });
    const game = await continueToPainting(prepared);
    game.suspend();

    const { page } = await reloadAndOpen(prepared.device);
    await page.choice.movePagesToAlbum();
    await settleLong();

    const album = await albumPixels(prepared.device);
    expect(timesIn(album, prepared.a), 'A je v albu jednou').toBe(1);
    expect(timesIn(album, prepared.p), 'P je v albu jednou').toBe(1);
    expect(isClean(pageOf(prepared.device)), 'stránka je čistá').toBe(true);
  });
});
