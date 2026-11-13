import { describe, expect, it } from 'vitest';

import {
  startPictureChoice,
  homeHoldDecision,
} from '../../../src/games/coloring/logic/pictureChoice';
import type { PictureChoice } from '../../../src/games/coloring/logic/pictureChoice';
import { COLORING_PICTURES } from '../../../src/games/coloring/logic/pictureSet';
import { CAMERA_CLICK_TONES } from '../../../src/games/coloring/logic/album';
import { fillAlbum, paintLeft } from './albumHelpers';
import { TOM, timesIn } from './continuePaintingHelpers';
import {
  CIRCLES,
  EMA,
  HOUSE,
  PAGE_COLOR,
  SECOND_COLOR,
  SwapDevice,
  albumPixels,
  isClean,
  leavePainting,
  loadWatchedGame,
  openGame,
  openPainting,
  pageOf,
  paintAndLeave,
  paintPageDirectly,
  picturePixels,
  previewIndexOf,
  settleLong,
  startLeaving,
} from './pageToAlbumHelpers';
import {
  LOCKED_IDS,
  completeMaps,
  enterColoring,
  loadPage,
  lockClock,
  lockDevice,
  lockedIdsOf,
  paintPage,
  setPictures,
  unlockByTap,
} from './pictureLocksHelpers';
import type { LockPage } from './pictureLocksHelpers';
import { startStroke } from './savedPictureHelpers';
import { at } from './strokeHelpers';

/**
 * Testy k #141 AC6: zámky z #140, fotoaparát z #126 a dotyky. Přesun do
 * alba žádnou omalovánku nezamkne ani neodemkne a nebere klíč. Ukládání
 * po fotoaparátu nebo po odchodu se dokončí, i když dítě mezitím podrží
 * domeček do menu. Druhý prst ani dvojí podržení obrázek neuloží dvakrát.
 * Každý profil mění jen své album a své stránky.
 *
 * Zámky se testují se skutečnou sadou 11 omalovánek a správou profilů
 * (`pictureLocksHelpers.ts`), protože #140 jmenuje, které jsou odemčené.
 */

/** Výběr nad sadou 11 omalovánek s albem a úložištěm profilu, bez zámků. */
function choiceOnPage(page: LockPage): PictureChoice {
  return startPictureChoice(COLORING_PICTURES, {
    now: lockClock,
    records: page.records,
    storage: page.storage,
    albumPictures: setPictures(),
  });
}

describe('#141 AC6: zámky z #140', () => {
  it('omalovánka odemčená zdarma zůstane po přesunu odemčená, ať se přesouvá před odemčením, nebo po něm', async () => {
    for (const order of ['odemčení, pak přesun', 'přesun, pak odemčení'] as const) {
      const device = lockDevice();
      const first = loadPage(device);
      paintPage(first, 'car');
      const balanceBefore = first.keys.balance();

      if (order === 'odemčení, pak přesun') {
        await enterColoring(first);
        await choiceOnPage(first).movePagesToAlbum();
      } else {
        await choiceOnPage(first).movePagesToAlbum();
        await enterColoring(first);
      }
      await settleLong();

      const again = loadPage(device);
      const locks = await enterColoring(again);
      expect(lockedIdsOf(locks), `${order}: auto zůstalo odemčené`).toEqual(
        LOCKED_IDS.filter((id) => id !== 'car'),
      );
      expect(again.keys.balance(), `${order}: klíče beze změny`).toEqual(balanceBefore);
    }
  });

  it('přesun stránky zamčené omalovánky ji neodemkne', async () => {
    const device = lockDevice();
    const first = loadPage(device);
    await enterColoring(first);
    // Stránka auta rozmalovaná, ale auto zůstalo zamčené (zkontrolované jako čisté).
    paintPage(first, 'car');

    await choiceOnPage(first).movePagesToAlbum();
    await settleLong();

    const locks = await enterColoring(loadPage(device));
    expect(lockedIdsOf(locks), 'zámky beze změny').toEqual(LOCKED_IDS);
  });

  it('omalovánka odemčená klíčem zůstane odemčená a přesun klíč nevezme', async () => {
    const device = lockDevice();
    const first = loadPage(device);
    completeMaps(first.keys, 4);
    const locks = await enterColoring(first);
    const choice = startPictureChoice(COLORING_PICTURES, {
      now: lockClock,
      locks,
      records: first.records,
      storage: first.storage,
      albumPictures: setPictures(),
    });
    unlockByTap(choice, 'car');
    paintPage(first, 'car');
    const balanceBefore = first.keys.balance();

    await choice.movePagesToAlbum();
    await settleLong();

    const again = loadPage(device);
    const after = await enterColoring(again);
    expect(lockedIdsOf(after), 'auto je odemčené').toEqual(LOCKED_IDS.filter((id) => id !== 'car'));
    expect(again.keys.balance(), 'klíče beze změny').toEqual(balanceBefore);
  });
});

describe('#141 AC6: fotoaparát a domeček do menu', () => {
  it('fotoaparát funguje jako v #126: obrázek se uloží a stránka je čistá, domalovaný obrázek pak jde do alba odchodem', async () => {
    const device = new SwapDevice();
    const page = await openGame(device);
    const game = await openPainting(page);
    paintLeft(game, PAGE_COLOR);
    const photo = picturePixels(game);

    const tap = game.tapCamera();
    expect(tap.kind === 'saving' ? tap.tones : [], 'cvak').toEqual(CAMERA_CLICK_TONES);
    expect((tap.kind === 'saving' ? await tap.done : undefined)?.kind, 'uloženo').toBe('saved');
    expect(isClean(picturePixels(game)), 'stránka je po fotce čistá').toBe(true);
    paintLeft(game, SECOND_COLOR);
    const second = picturePixels(game);
    await leavePainting(page, game);

    expect(await albumPixels(device), 'oba obrázky, nejnovější z odchodu').toEqual([second, photo]);
  });

  it('ukládání fotoaparátem, které ještě běží při odchodu, uloží obrázek jen jednou', async () => {
    const device = new SwapDevice();
    const { page, watched } = loadWatchedGame(device);
    const game = await openPainting(page);
    paintLeft(game, PAGE_COLOR);
    const painted = picturePixels(game);
    watched.holdAdds();
    const camera = game.tapCamera();
    expect(camera.kind, 'fotoaparát ukládá').toBe('saving');

    const leaving = startLeaving(page, game);
    await settleLong();
    await watched.releaseAdds();
    await leaving;
    await settleLong();

    expect(await albumPixels(device), 'obrázek je v albu jednou').toEqual([painted]);
    expect(isClean(pageOf(device)), 'stránka je čistá').toBe(true);
  });

  it('když se ukládání po fotoaparátu nebo po odchodu potká s podržením domečku do menu, ukládání se dokončí', async () => {
    for (const how of ['po odchodu', 'po fotoaparátu'] as const) {
      const device = new SwapDevice();
      const { page, watched } = loadWatchedGame(device);
      const game = await openPainting(page);
      paintLeft(game, PAGE_COLOR);
      const painted = picturePixels(game);
      watched.holdAdds();
      if (how === 'po fotoaparátu') {
        expect(game.tapCamera().kind, `${how}: fotoaparát ukládá`).toBe('saving');
      }

      const leaving = startLeaving(page, game);
      await settleLong();
      const toMenu = page.choice.holdHome();
      expect(toMenu, `${how}: domeček na výběru vede do menu`).toBe('toMenu');
      expect(homeHoldDecision(toMenu), `${how}: stránka odejde do menu`).toBe('leave');
      await watched.releaseAdds();
      await leaving;
      await settleLong();

      expect(await albumPixels(device), `${how}: obrázek je v albu jednou`).toEqual([painted]);
      expect(isClean(pageOf(device)), `${how}: stránka je čistá`).toBe(true);
    }
  });
});

describe('#141 AC6: druhý prst a dvojí podržení', () => {
  it('dvojí podržení domečku uloží obrázek jen jednou', async () => {
    const device = new SwapDevice();
    const { page, watched } = loadWatchedGame(device);
    const game = await openPainting(page);
    paintLeft(game, PAGE_COLOR);
    const painted = picturePixels(game);
    watched.holdAdds();

    const first = startLeaving(page, game);
    const second = page.choice.paintingLeft(game);
    await settleLong();
    await watched.releaseAdds();
    await Promise.all([first, second]);
    await settleLong();

    expect(await albumPixels(device), 'obrázek je v albu jednou').toEqual([painted]);
    expect(watched.adds(), 'do alba se ukládalo jednou').toBe(1);
  });

  it('otevření Omalovánek a odchod z malování, které běží zároveň, uloží každý obrázek jen jednou', async () => {
    const device = new SwapDevice();
    const housePage = paintPageDirectly(device, HOUSE, PAGE_COLOR);
    const { page, watched } = loadWatchedGame(device);
    watched.holdAdds();
    const opening = page.choice.movePagesToAlbum();
    const openingAgain = page.choice.movePagesToAlbum();
    await settleLong();
    const game = await openPainting(page, CIRCLES);
    paintLeft(game, SECOND_COLOR);
    const circles = picturePixels(game);

    const leaving = startLeaving(page, game);
    await settleLong();
    await watched.releaseAdds();
    await Promise.all([opening, openingAgain, leaving]);
    await settleLong();

    const album = await albumPixels(device);
    expect(timesIn(album, housePage), 'domek je v albu jednou').toBe(1);
    expect(timesIn(album, circles), 'kruhy jsou v albu jednou').toBe(1);
    expect(album.length).toBe(2);
  });

  it('prst, který maloval při podržení domečku, po odchodu nic nenamaluje a stránku znovu nerozmaluje', async () => {
    const device = new SwapDevice();
    const page = await openGame(device);
    const game = await openPainting(page);
    paintLeft(game, PAGE_COLOR);
    startStroke(game, [at(200, 50), at(220, 60)], 2);
    const painted = picturePixels(game);

    await leavePainting(page, game);
    game.pointerMove({ id: 2, x: 260, y: 150, kind: 'touch' });
    game.pointerUp(2);
    // Scéna při zastavení malování obrázek ještě jednou uloží (#92).
    game.suspend();
    await settleLong();

    expect(await albumPixels(device), 'v albu je obrázek z chvíle odchodu, jednou').toEqual([
      painted,
    ]);
    expect(isClean(pageOf(device)), 'stránka zůstala čistá').toBe(true);
  });

  it('po odchodu jde náhled té omalovánky zase otevřít a otevře se jednou', async () => {
    const device = new SwapDevice();
    const page = await openGame(device);
    await paintAndLeave(page, HOUSE, PAGE_COLOR);

    const first = page.choice.tapPreview(previewIndexOf(HOUSE));
    const second = page.choice.tapPreview(previewIndexOf(HOUSE));

    expect(first.kind, 'náhled otevře malování').toBe('open');
    expect(second, 'druhé ťuknutí se nepočítá').toEqual({ kind: 'ignored' });
  });
});

describe('#141 AC6: každý profil mění jen své album a své stránky', () => {
  it('odchod a otevření Omalovánek v jednom profilu nezmění album ani stránky jiného profilu', async () => {
    const device = new SwapDevice();
    await fillAlbum(device.records(TOM), 2, HOUSE);
    paintPageDirectly(device, HOUSE, SECOND_COLOR, TOM);
    paintPageDirectly(device, CIRCLES, SECOND_COLOR, TOM);
    paintPageDirectly(device, HOUSE, PAGE_COLOR, EMA);
    const tomBefore = device.profileSnapshot(TOM);

    const page = await openGame(device, { profile: EMA });
    await paintAndLeave(page, CIRCLES, PAGE_COLOR);

    expect(device.profileSnapshot(TOM), 'Tomovo album i stránky beze změny').toEqual(tomBefore);
    expect((await albumPixels(device, EMA)).length, 'Emě přibyly 2 obrázky').toBe(2);
    expect(isClean(pageOf(device, HOUSE, EMA)), 'Emina stránka domku je čistá').toBe(true);
  });

  it('obrázek v albu jiného profilu nebrání přesunu a nečistí stránku', async () => {
    const device = new SwapDevice();
    await fillAlbum(device.records(TOM), 1, HOUSE);
    const page = await openGame(device, { profile: EMA });

    const painted = await paintAndLeave(page, HOUSE, 0);

    expect(await albumPixels(device, EMA), 'Emě obrázek přibyl').toEqual([painted]);
    expect((await albumPixels(device, TOM)).length, 'Tomovi ne').toBe(1);
  });
});

describe('#141 AC6: fotoaparát s plným albem po odchodu', () => {
  it('s plným albem fotoaparát jen zhoupne a odchod obrázek nechá na stránce', async () => {
    const device = new SwapDevice();
    await fillAlbum(device.records(EMA), 12, HOUSE);
    const page = await openGame(device);
    const game = await openPainting(page);
    paintLeft(game, PAGE_COLOR);
    const painted = picturePixels(game);

    expect(game.tapCamera().kind, 'fotoaparát se zhoupne').toBe('wobble');
    await leavePainting(page, game);

    expect(pageOf(device), 'obrázek zůstal na stránce').toEqual(painted);
  });
});
