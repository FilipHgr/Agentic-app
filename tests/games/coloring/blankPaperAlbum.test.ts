import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TRASH_HOLD_MS } from '../../../src/games/coloring/logic/pictureChoice';
import { FULL_ALBUM_PICTURES, fillAlbumQuickly } from './albumHelpers';
import {
  EMA,
  OTHER_COLOR,
  PAPER,
  PAPER_COLOR,
  SwapDevice,
  albumEntries,
  albumOf,
  createPainting,
  isBlank,
  leavePaper,
  openPaper,
  openPaperGame,
  paintAcrossPaper,
  paperPixels,
  previewColorsOfPaper,
  sameImage,
  storedPaper,
} from './blankPaperHelpers';
import type { PaperPage, Pixels } from './blankPaperHelpers';
import { outcomeOf } from './continuePaintingHelpers';
import { choose } from './drawingToolHelpers';
import { tapFirstButton, tapQuickEraser } from './quickToolsHelpers';
import { paint } from './savedPictureHelpers';
import { at } from './strokeHelpers';

/**
 * Testy k #151 AC3 (papír v albu jako ostatní omalovánky) a AC5 (plné
 * album jako v #141 AC5). Papír se do alba dostane stejně jako omalovánky:
 * odchodem domečkem (#141), fotoaparátem (#126); koště (#142), velký
 * obrázek a koš (#129), Malovat dál (#131) a rychlé přepnutí nástroje
 * (#148) fungují i na papíře. Pomůcky a navržené rozhraní popisuje
 * `blankPaperHelpers.ts` a `blankPaper.test.ts`.
 *
 * V albu jsou vedle papíru obrázky domku (zkušební obrys `twoHalves()`),
 * aby bylo vidět, že papír přibude jako nejnovější a nic jiného se nezmění.
 */

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

/** Zařízení s `photos` obrázky domku v albu. */
async function deviceWithHouses(photos: number): Promise<SwapDevice> {
  const device = new SwapDevice();
  await fillAlbumQuickly(device.records(EMA), photos);
  return device;
}

/** Dítě otevře papír, pomaluje ho přes celou plochu a odejde domečkem. Vrátí obrázek. */
async function paintPaperAndLeave(page: PaperPage): Promise<Pixels> {
  const game = await openPaper(page);
  paintAcrossPaper(game);
  const painted = paperPixels(game);
  await leavePaper(page, game);
  return painted;
}

/** Dítě otevře album knihou a ťukne na nejnovější obrázek; velký obrázek se ukáže. */
async function openNewestBigPicture(page: PaperPage): Promise<void> {
  const album = await albumOf(page);
  expect(page.choice.tapBook(album).kind, 'kniha otevře album').toBe('open');
  expect(page.choice.tapAlbumPreview(0).kind, 'náhled otevře velký obrázek').toBe('open');
  page.choice.bigPictureShown();
  vi.advanceTimersByTime(TRASH_HOLD_MS);
}

describe('#151 AC3: odchod domečkem uloží pomalovaný papír do alba', () => {
  it('pomalovaný papír přibude do alba jako nejnovější, pixel po pixelu stejný', async () => {
    const device = await deviceWithHouses(3);
    const page = await openPaperGame(device);

    const painted = await paintPaperAndLeave(page);

    const album = await albumEntries(device);
    expect(album.length, 'v albu přibyl jeden obrázek').toBe(4);
    expect(album[0]?.picture, 'nejnovější je papír').toEqual(PAPER);
    expect(sameImage(album[0]?.pixels ?? [], painted), 'pixel po pixelu').toBe(true);
    expect(
      album.slice(1).map((entry) => entry.picture.id),
      'obrázky domku zůstaly',
    ).toEqual(['house', 'house', 'house']);
  });

  it('pomalovaný papír je v albu i po obnovení stránky', async () => {
    const device = await deviceWithHouses(0);
    const painted = await paintPaperAndLeave(await openPaperGame(device));

    await openPaperGame(device);

    const album = await albumEntries(device);
    expect(album.map((entry) => entry.picture)).toEqual([PAPER]);
    expect(sameImage(album[0]?.pixels ?? [], painted)).toBe(true);
  });

  it('čistý papír se do alba neuloží', async () => {
    const device = await deviceWithHouses(2);
    const page = await openPaperGame(device);

    const game = await openPaper(page);
    await leavePaper(page, game);

    expect((await albumEntries(device)).length, 'album beze změny').toBe(2);
  });

  it('papír, na kterém dítě tah vrátilo Zpět, je čistý a do alba se neuloží', async () => {
    const device = await deviceWithHouses(0);
    const page = await openPaperGame(device);

    const game = await openPaper(page);
    paintAcrossPaper(game);
    expect(game.tapUndo().kind).toBe('undone');
    await leavePaper(page, game);

    expect(await albumEntries(device)).toEqual([]);
  });

  it('po odchodu je papír i jeho náhled na výběru zase čistý, i po obnovení stránky', async () => {
    const device = await deviceWithHouses(0);
    const page = await openPaperGame(device);

    await paintPaperAndLeave(page);

    expect(isBlank(storedPaper(device)), 'papír je čistý').toBe(true);
    expect(previewColorsOfPaper(page.storage), 'náhled je bílý').toEqual(['#FFFFFF']);
    const reloaded = await openPaperGame(device);
    expect(previewColorsOfPaper(reloaded.storage), 'po obnovení dál bílý').toEqual(['#FFFFFF']);
    const again = await openPaper(reloaded);
    expect(isBlank(paperPixels(again)), 'znovu otevřený papír je bílý').toBe(true);
  });
});

describe('#151 AC3: fotoaparát, koště, velký obrázek, koš, Malovat dál a rychlé přepnutí na papíře', () => {
  it('fotoaparát uloží pomalovaný papír do alba a papír je pak čistý', async () => {
    const device = await deviceWithHouses(1);
    const page = await openPaperGame(device);
    const game = await openPaper(page);
    paintAcrossPaper(game);
    const painted = paperPixels(game);

    const tap = game.tapCamera();
    expect(tap.kind, 'cvak').toBe('saving');
    if (tap.kind === 'saving') {
      expect((await tap.done).kind).toBe('saved');
    }

    const album = await albumEntries(device);
    expect(album[0]?.picture, 'nejnovější je papír').toEqual(PAPER);
    expect(sameImage(album[0]?.pixels ?? [], painted), 'pixel po pixelu').toBe(true);
    expect(isBlank(paperPixels(game)), 'papír v malování je čistý').toBe(true);
  });

  it('koště podržené 1 s vrátí pomalovaný papír na čistý bílý a do alba nic nepřidá', async () => {
    const device = await deviceWithHouses(1);
    const page = await openPaperGame(device);
    const game = await openPaper(page);
    paintAcrossPaper(game);

    page.choice.broomButton.press(1);
    vi.advanceTimersByTime(1000);
    page.choice.broomButton.release(1);

    expect(page.broomFeedback.filter((event) => event.kind === 'cleared').length).toBe(1);
    expect(isBlank(paperPixels(game)), 'papír v malování je čistý').toBe(true);
    expect(isBlank(storedPaper(device)), 'uložený papír je čistý').toBe(true);
    expect((await albumEntries(device)).length, 'album beze změny').toBe(1);
  });

  it('papír z alba se otevře jako velký obrázek', async () => {
    const device = await deviceWithHouses(1);
    const painted = await paintPaperAndLeave(await openPaperGame(device));
    const page = await openPaperGame(device);

    await openNewestBigPicture(page);

    const screen = page.choice.screen();
    expect(screen.kind).toBe('bigPicture');
    if (screen.kind === 'bigPicture') {
      expect(screen.entry.picture).toEqual(PAPER);
      expect(sameImage(paperPixels(screen.entry.colors), painted), 'pixel po pixelu').toBe(true);
    }
  });

  it('koš podržený 1 s smaže papír z alba', async () => {
    const device = await deviceWithHouses(1);
    await paintPaperAndLeave(await openPaperGame(device));
    const page = await openPaperGame(device);
    await openNewestBigPicture(page);

    page.choice.trashButton.press(1);
    vi.advanceTimersByTime(TRASH_HOLD_MS);
    const deleting = page.trashFeedback.filter((event) => event.kind === 'deleting');
    page.choice.trashButton.release(1);
    expect(deleting.length, 'mazání začalo jednou').toBe(1);
    const [started] = deleting;
    if (started?.kind === 'deleting') {
      expect(started.entry.picture).toEqual(PAPER);
      expect((await started.done).kind).toBe('deleted');
    }

    expect((await albumEntries(device)).map((entry) => entry.picture.id)).toEqual(['house']);
  });

  it('Malovat dál otevře papír z alba s jeho obrázkem a dítě může kreslit dál', async () => {
    const device = await deviceWithHouses(0);
    const painted = await paintPaperAndLeave(await openPaperGame(device));
    const page = await openPaperGame(device);
    await openNewestBigPicture(page);

    const outcome = await outcomeOf(page.choice.tapContinue());

    expect(outcome).toEqual({ kind: 'opened', picture: PAPER });
    const game = await createPainting(page, PAPER, 'album');
    expect(sameImage(paperPixels(game), painted), 'papír má obrázek z alba').toBe(true);
    game.tapColor(OTHER_COLOR);
    paint(game, [at(500, 100), at(520, 100)]);
    expect(game.colorAt(510, 100)).toBe(OTHER_COLOR);
  });

  // Upraveno k #163: první tlačítko vrací nástroj z doby před gumou.
  it('rychlé přepnutí na gumu a zpátky na nástroj funguje na papíře', async () => {
    const page = await openPaperGame(await deviceWithHouses(0));
    const game = await openPaper(page);
    choose(game, 'marker');
    game.tapColor(PAPER_COLOR);
    paint(game, [at(100, 300), at(900, 300)]);

    expect(tapQuickEraser(game).kind).toBe('picked');
    expect(game.selectedTool()).toBe('eraser');
    paint(game, [at(100, 300), at(900, 300)]);
    expect(game.colorAt(500, 300), 'guma vrátí bílou').toBeNull();

    expect(tapFirstButton(game).kind).toBe('picked');
    expect(game.selectedTool(), 'nástroj před gumou').toBe('marker');
    paint(game, [at(100, 300), at(900, 300)]);
    expect(game.colorAt(500, 300), 'fix maluje svou barvou').toBe(PAPER_COLOR);
  });
});

describe('#151 AC5: plné album jako v #141 AC5', () => {
  it('do plného alba se papír nepřidá, zůstane pomalovaný a jeho náhled ukazuje barvy', async () => {
    const device = await deviceWithHouses(FULL_ALBUM_PICTURES);
    const page = await openPaperGame(device);

    const painted = await paintPaperAndLeave(page);

    const album = await albumEntries(device);
    expect(album.length, 'album beze změny').toBe(FULL_ALBUM_PICTURES);
    expect(
      album.some((entry) => entry.picture.id === PAPER.id),
      'papír v albu není',
    ).toBe(false);
    expect(sameImage(storedPaper(device), painted), 'papír zůstal pomalovaný').toBe(true);
    expect(previewColorsOfPaper(page.storage), 'náhled ukazuje barvy').toContain('#FFFFFF');
    expect(previewColorsOfPaper(page.storage).length, 'a nejen bílou').toBeGreaterThan(1);
  });

  it('hra bez alba (dočasný profil) nechá papír pomalovaný i po návratu', async () => {
    const device = new SwapDevice();
    const page = await openPaperGame(device, { withoutAlbum: true });

    const painted = await paintPaperAndLeave(page);

    expect(sameImage(storedPaper(device), painted)).toBe(true);
  });
});
