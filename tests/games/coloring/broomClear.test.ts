import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { openColoring } from '../../../src/games/coloring/logic/savedPicture';
import type { SavedColoring } from '../../../src/games/coloring/logic/savedPicture';
import { PANEL_TOOLS } from '../../../src/games/coloring/logic/toolPanel';
import { HOME_WOBBLE_TONES } from '../../../src/shared/logic/homeButton';
import { paintLeft, takePhoto } from './albumHelpers';
import {
  enterGame,
  holdBroom,
  clearCount,
  isClean,
  leavePainting,
  openFromAlbum,
  openFromPicker,
  picturePixels,
} from './broomHelpers';
import type { BroomPage } from './broomHelpers';
import {
  HOUSE,
  SwapDevice,
  albumPixels,
  pageOf,
  sameImage,
  timesIn,
} from './continuePaintingHelpers';
import { choose } from './drawingToolHelpers';
import {
  PAGE_COLOR,
  SECOND_COLOR,
  THIRD_COLOR,
  paintPageDirectly,
  paintRightDot,
  recordsOf,
  settleLong,
} from './pageToAlbumHelpers';

/**
 * Testy k #142 AC1 (zrušení) a AC2 (album). Koště je podržení 1 s;
 * pomůcky a navržené rozhraní jsou v `broomHelpers.ts`.
 *
 * Stav se čte jen tak, jak ho vidí hráč: malování po pixelech, stránka
 * omalovánky po otevření (`pageOf`, čte úložiště jako nové otevření)
 * a obrázky alba.
 */

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

type Origin = 'výběr' | 'album';

/** Dítě otevře malování domku z výběru (N), nebo štětcem z alba (A). */
async function openBy(
  device: SwapDevice,
  from: Origin,
): Promise<{ page: BroomPage; game: SavedColoring }> {
  if (from === 'album') {
    return openFromAlbum(device);
  }
  const page = await enterGame(device);
  return { page, game: await openFromPicker(page) };
}

/** Malování N nad novým zařízením s prázdným albem. */
async function freshPicker(): Promise<{
  device: SwapDevice;
  page: BroomPage;
  game: SavedColoring;
}> {
  const device = new SwapDevice();
  const page = await enterGame(device);
  const game = await openFromPicker(page);
  return { device, page, game };
}

describe('#142 AC1: podržení koštěte 1 s vrátí stránku na začátek', () => {
  it('u malování z výběru se rozmalovaná stránka vymaže na čistý obrys a dítě zůstane v malování', async () => {
    const { page, game } = await freshPicker();
    paintLeft(game, PAGE_COLOR);
    paintRightDot(game, SECOND_COLOR);

    holdBroom(page);

    expect(clearCount(page), 'koště stránku zrušilo jednou').toBe(1);
    expect(isClean(picturePixels(page, game)), 'čistý obrys').toBe(true);
    expect(page.choice.screen().kind, 'dítě zůstane v malování').toBe('painting');
    paintLeft(game, THIRD_COLOR);
    expect(game.colorAt(80, 40), 'po zrušení jde malovat dál').toBe(THIRD_COLOR);
  });

  it('u malování z výběru je začátkem čistý obrys, i když stránka byla rozmalovaná už při otevření', async () => {
    const device = new SwapDevice();
    paintPageDirectly(device, HOUSE, PAGE_COLOR);
    const page = await enterGame(device, { withoutAlbum: true });
    const game = await openFromPicker(page);
    expect(isClean(picturePixels(page, game)), 'stránka je při otevření rozmalovaná').toBe(false);

    holdBroom(page);

    expect(isClean(picturePixels(page, game))).toBe(true);
    expect(isClean(pageOf(device)), 'uložená stránka').toBe(true);
  });

  it('vymazaná stránka je hned uložená a po obnovení stránky je čistá', async () => {
    const { device, page, game } = await freshPicker();
    paintLeft(game, PAGE_COLOR);

    holdBroom(page);

    expect(isClean(pageOf(device)), 'hned po zrušení, bez odchodu').toBe(true);
    const reloaded = await enterGame(device);
    const again = await openFromPicker(reloaded);
    expect(isClean(picturePixels(reloaded, again)), 'po obnovení stránky').toBe(true);
  });

  it('u obrázku z alba vrátí koště obrázek přesně tak, jak byl při otevření, a hned ho uloží', async () => {
    const device = new SwapDevice();
    const { page, game, a } = await openFromAlbum(device);
    paintRightDot(game, PAGE_COLOR);
    paintLeft(game, SECOND_COLOR);
    expect(sameImage(picturePixels(page, game), a), 'dítě obrázek změnilo').toBe(false);

    holdBroom(page);

    expect(clearCount(page)).toBe(1);
    expect(picturePixels(page, game), 'malování ukazuje A').toEqual(a);
    expect(pageOf(device), 'uložená stránka je A').toEqual(a);
    expect(page.choice.screen().kind, 'dítě zůstane v malování').toBe('painting');
  });

  it('po vyfocení v malování z výběru je začátkem čistý obrys', async () => {
    const { device, page, game } = await freshPicker();
    paintLeft(game, PAGE_COLOR);
    expect((await takePhoto(game)).kind).toBe('saved');
    paintRightDot(game, SECOND_COLOR);

    holdBroom(page);

    expect(isClean(picturePixels(page, game))).toBe(true);
    expect(isClean(pageOf(device)), 'uložená stránka').toBe(true);
  });

  it('po vyfocení v malování obrázku z alba je začátkem čistý obrys, ne A', async () => {
    const device = new SwapDevice();
    const { page, game } = await openFromAlbum(device);
    paintRightDot(game, PAGE_COLOR);
    expect((await takePhoto(game)).kind).toBe('saved');
    paintLeft(game, SECOND_COLOR);

    holdBroom(page);

    expect(isClean(picturePixels(page, game)), 'čistý obrys').toBe(true);
    expect(isClean(pageOf(device)), 'uložená stránka').toBe(true);
  });

  it('barvy nástrojů, nedávné barvy, tloušťka čáry a vybraný nástroj zůstanou', async () => {
    const { page, game } = await freshPicker();
    paintLeft(game, PAGE_COLOR);
    choose(game, 'marker');
    game.tapColor(SECOND_COLOR);
    game.tapLineSize('large');
    choose(game, 'crayon');
    game.tapColor(THIRD_COLOR);
    const toolColors = PANEL_TOOLS.map((tool) => game.toolColor(tool));
    const recent = [...game.recentColors()];
    const lineSize = game.lineSize();
    const tool = game.selectedTool();

    holdBroom(page);

    expect(clearCount(page)).toBe(1);
    expect(
      PANEL_TOOLS.map((each) => game.toolColor(each)),
      'barvy nástrojů',
    ).toEqual(toolColors);
    expect([...game.recentColors()], 'nedávné barvy').toEqual(recent);
    expect(game.lineSize(), 'tloušťka čáry').toBe(lineSize);
    expect(game.selectedTool(), 'vybraný nástroj').toBe(tool);

    const reopened = openColoring({
      regions: page.regions,
      picture: HOUSE,
      storage: page.storage,
    });
    expect(
      PANEL_TOOLS.map((each) => reopened.toolColor(each)),
      'barvy nástrojů po novém otevření',
    ).toEqual(toolColors);
    expect([...reopened.recentColors()], 'nedávné barvy po novém otevření').toEqual(recent);
    expect(reopened.lineSize(), 'tloušťka po novém otevření').toBe(lineSize);
  });

  it('po zrušení je historie Zpět prázdná a Zpět se jen zhoupne s tónem domečku', async () => {
    for (const from of ['výběr', 'album'] as const) {
      const device = new SwapDevice();
      const { page, game } = await openBy(device, from);
      paintLeft(game, PAGE_COLOR);
      paintRightDot(game, SECOND_COLOR);
      const start = picturePixels(page, game);
      holdBroom(page);
      const afterClear = picturePixels(page, game);
      expect(sameImage(afterClear, start), `${from}: stránka se změnila`).toBe(false);

      const undo = game.tapUndo();

      expect(undo.kind, `${from}: Zpět se jen zhoupne`).toBe('wobble');
      expect(undo.kind === 'wobble' ? undo.tones : null, `${from}: tón domečku`).toEqual(
        HOME_WOBBLE_TONES,
      );
      expect(picturePixels(page, game), `${from}: Zpět nic nevrátí`).toEqual(afterClear);
    }
  });
});

describe('#142 AC2: zrušení do alba nic neuloží a z alba nic nesmaže', () => {
  it('u malování z výběru i z alba zůstane album po zrušení beze změny', async () => {
    for (const from of ['výběr', 'album'] as const) {
      const device = new SwapDevice();
      const { page, game } = await openBy(device, from);
      paintLeft(game, PAGE_COLOR);
      const records = recordsOf(device);
      const adds = device.adds;
      const removes = device.removes;

      holdBroom(page);
      await settleLong();

      expect(clearCount(page), from).toBe(1);
      expect(recordsOf(device), `${from}: záznamy alba`).toEqual(records);
      expect(device.adds, `${from}: nic se neukládalo`).toBe(adds);
      expect(device.removes, `${from}: nic se nemazalo`).toBe(removes);
    }
  });

  it('po zrušení a odchodu domečkem z malování z výběru je album beze změny', async () => {
    const device = new SwapDevice();
    const page = await enterGame(device);
    const albumBefore = await albumPixels(device);
    const game = await openFromPicker(page);
    paintLeft(game, PAGE_COLOR);

    holdBroom(page);
    await leavePainting(page, game);

    expect(await albumPixels(device), 'album').toEqual(albumBefore);
    expect(isClean(pageOf(device)), 'stránka na výběru').toBe(true);
  });

  it('po zrušení a odchodu domečkem je obrázek A v albu právě jednou a nezměněný', async () => {
    const device = new SwapDevice();
    const { page, game, a, albumBefore } = await openFromAlbum(device);
    paintRightDot(game, PAGE_COLOR);

    holdBroom(page);
    await leavePainting(page, game);

    const album = await albumPixels(device);
    expect(timesIn(album, a), 'A v albu právě jednou').toBe(1);
    expect(album.length, 'počet obrázků jako před otevřením A').toBe(albumBefore.length);
    for (const [index, before] of albumBefore.entries()) {
      expect(timesIn(album, before), `obrázek alba ${index + 1}`).toBe(
        timesIn(albumBefore, before),
      );
    }
  });

  it('po zrušení a obnovení stránky je obrázek A v albu právě jednou a nezměněný', async () => {
    const device = new SwapDevice();
    const { page, game, a, albumBefore } = await openFromAlbum(device);
    paintRightDot(game, PAGE_COLOR);

    holdBroom(page);
    await enterGame(device);

    const album = await albumPixels(device);
    expect(timesIn(album, a), 'A v albu právě jednou').toBe(1);
    expect(album.length).toBe(albumBefore.length);
  });

  it('obrázky vyfocené v tomto malování v albu zůstanou, i po odchodu domečkem', async () => {
    for (const from of ['výběr', 'album'] as const) {
      const device = new SwapDevice();
      const { page, game } = await openBy(device, from);
      paintRightDot(game, PAGE_COLOR);
      const photo = picturePixels(page, game);
      expect((await takePhoto(game)).kind, `${from}: vyfoceno`).toBe('saved');
      const albumAfterPhoto = await albumPixels(device);
      paintLeft(game, SECOND_COLOR);

      holdBroom(page);
      await settleLong();

      expect(clearCount(page), `${from}: koště stránku zrušilo`).toBe(1);
      expect(await albumPixels(device), `${from}: hned po zrušení`).toEqual(albumAfterPhoto);
      await leavePainting(page, game);
      const album = await albumPixels(device);
      expect(timesIn(album, photo), `${from}: vyfocený obrázek po odchodu`).toBe(1);
      for (const [index, before] of albumAfterPhoto.entries()) {
        expect(timesIn(album, before), `${from}: obrázek alba ${index + 1}`).toBeGreaterThanOrEqual(
          1,
        );
      }
    }
  });
});
