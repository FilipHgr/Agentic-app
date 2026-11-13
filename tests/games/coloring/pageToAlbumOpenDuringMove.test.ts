import { describe, expect, it } from 'vitest';

import type { PictureIdentity } from '../../../src/games/coloring/logic/savedPicture';
import { timesIn } from './continuePaintingHelpers';
import {
  CIRCLES,
  HOUSE,
  PAGE_COLOR,
  SECOND_COLOR,
  STAR,
  SwapDevice,
  THIRD_COLOR,
  albumPixels,
  beginOpening,
  isClean,
  loadWatchedGame,
  openPainting,
  pageOf,
  paintPageDirectly,
  paintRightDot,
  picturePixels,
  settleLong,
  startLeaving,
} from './pageToAlbumHelpers';
import type { Pixels } from './pageToAlbumHelpers';

/**
 * Testy k #141 AC4 a AC6: dítě otevře omalovánku, zatímco při otevření
 * Omalovánek běží přesun stránek do alba (`movePagesToAlbum`), a maluje
 * v ní dřív, než k ní přesun v pořadí sady dojde. Přesun nesmí stránku
 * právě otevřené omalovánky vyčistit ani uložit její rozpracovaný stav;
 * do alba jde jen hotový obrázek při odchodu domečkem, jednou.
 *
 * Přesun se zdrží na ukládání domku (záznamy podrží `add`), takže
 * omalovánky dál v sadě ještě nepřišly na řadu. Dvě pořadí: přesun dojde
 * k otevřené omalovánce, zatímco v ní dítě maluje, nebo až po jejím odchodu.
 */

/** Kdy přesun při otevření pokračuje: během malování, nebo až po odchodu. */
const TIMINGS = ['během malování', 'po odchodu'] as const;

/** Případ (a) ještě dřív: dítě omalovánku otevře, než přesun při otevření vůbec začne. */
const EARLY = 'začne až během malování';

interface Case {
  readonly what: string;
  readonly picture: PictureIdentity;
  /** Má omalovánka rozmalovanou stránku, která čeká na převod? */
  readonly waitingPage: boolean;
}

const CASES: readonly Case[] = [
  { what: '(a) rozmalovaná stránka čekající na převod', picture: STAR, waitingPage: true },
  { what: '(b) omalovánka bez záznamu stránky', picture: CIRCLES, waitingPage: false },
];

describe('#141 AC4: omalovánka otevřená během přesunu při otevření Omalovánek', () => {
  it('dítě maluje omalovánku otevřenou během přesunu a po odchodu je v albu jen hotový obrázek, jednou', async () => {
    for (const { what, picture, waitingPage } of CASES) {
      for (const timing of TIMINGS) {
        const label = `${what}, přesun pokračuje ${timing}`;
        const device = new SwapDevice();
        const house = paintPageDirectly(device, HOUSE, PAGE_COLOR);
        const before: Pixels | null = waitingPage
          ? paintPageDirectly(device, picture, THIRD_COLOR)
          : null;
        const { page, watched } = loadWatchedGame(device);
        watched.holdAdds();
        const { moving } = await beginOpening(page);
        await settleLong();

        const game = await openPainting(page, picture);
        paintRightDot(game, SECOND_COLOR);
        const started = picturePixels(game);
        let leaving: Promise<unknown> = Promise.resolve();
        if (timing === 'během malování') {
          await watched.releaseAdds();
          await settleLong();
          expect(pageOf(device, picture), `${label}: přesun stránku otevřené nevyčistil`).toEqual(
            started,
          );
          paintRightDot(game, PAGE_COLOR);
          leaving = startLeaving(page, game);
        } else {
          leaving = startLeaving(page, game);
          await settleLong();
          await watched.releaseAdds();
        }
        const finished = timing === 'během malování' ? picturePixels(game) : started;
        await Promise.all([moving, leaving]);
        await settleLong();

        const album = await albumPixels(device);
        expect(timesIn(album, finished), `${label}: hotový obrázek je v albu jednou`).toBe(1);
        if (timing === 'během malování') {
          expect(timesIn(album, started), `${label}: rozpracovaný stav v albu není`).toBe(0);
        }
        if (before !== null) {
          expect(timesIn(album, before), `${label}: stav před malováním v albu není`).toBe(0);
        }
        expect(timesIn(album, house), `${label}: domek je v albu jednou`).toBe(1);
        expect(album.length, `${label}: nic navíc`).toBe(2);
        expect(isClean(pageOf(device, picture)), `${label}: stránka je čistá`).toBe(true);
      }
    }
  });

  it('dítě otevře rozmalovanou omalovánku dřív, než přesun začne: přesun ji nevyčistí a v albu je jen hotový obrázek, jednou', async () => {
    const device = new SwapDevice();
    const house = paintPageDirectly(device, HOUSE, PAGE_COLOR);
    const before = paintPageDirectly(device, STAR, THIRD_COLOR);
    const { page } = loadWatchedGame(device);

    const game = await openPainting(page, STAR);
    paintRightDot(game, SECOND_COLOR);
    const started = picturePixels(game);
    const { moving } = await beginOpening(page);
    await moving;
    await settleLong();
    expect(pageOf(device, STAR), `${EARLY}: stránka otevřené omalovánky zůstala`).toEqual(started);
    paintRightDot(game, PAGE_COLOR);
    const finished = picturePixels(game);
    await startLeaving(page, game);
    await settleLong();

    const album = await albumPixels(device);
    expect(timesIn(album, finished), `${EARLY}: hotový obrázek je v albu jednou`).toBe(1);
    expect(timesIn(album, started), `${EARLY}: rozpracovaný stav v albu není`).toBe(0);
    expect(timesIn(album, before), `${EARLY}: stav před malováním v albu není`).toBe(0);
    expect(timesIn(album, house), `${EARLY}: domek je v albu jednou`).toBe(1);
    expect(album.length, `${EARLY}: nic navíc`).toBe(2);
    expect(isClean(pageOf(device, STAR)), `${EARLY}: stránka je čistá`).toBe(true);
  });
});
