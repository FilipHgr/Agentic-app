import { describe, expect, it } from 'vitest';

import { pageKeyOf } from '../../../src/games/coloring/logic/savedPicture';
import { HOME_WOBBLE_TONES } from '../../../src/shared/logic/homeButton';
import { addUnreadable, fillAlbum, paintLeft } from './albumHelpers';
import { pixelsOf } from './savedPictureHelpers';
import { choose } from './drawingToolHelpers';
import {
  CIRCLES,
  EMA,
  HOUSE,
  PAGE_COLOR,
  SECOND_COLOR,
  SwapDevice,
  albumOf,
  albumPixels,
  isClean,
  leavePainting,
  loadWatchedGame,
  openGame,
  openPainting,
  pageOf,
  paintAndLeave,
  paintRightDot,
  picturePixels,
  previewColors,
  previewIndexOf,
  recordsOf,
  settleLong,
  startLeaving,
} from './pageToAlbumHelpers';
import { timesIn } from './continuePaintingHelpers';
import { BLUE, GREEN, RED } from './toolColorsHelpers';

/**
 * Testy k #141 AC1 (uložení při odchodu domečkem) a AC2 (kdy do alba nic
 * nepřibude). Dítě maluje omalovánku otevřenou z výběru a podrží domeček
 * 1 s; výběr pak stránku přesune do alba aktivního profilu
 * (`PictureChoice.paintingLeft`). Plné a nedostupné album (AC5) testuje
 * `pageToAlbumFull.test.ts`, otevření Omalovánek a obnovení stránky (AC4)
 * `pageToAlbumOpening.test.ts`, malovat dál (AC3)
 * `pageToAlbumContinue.test.ts`, zámky a dotyky (AC6)
 * `pageToAlbumTouch.test.ts`.
 *
 * „Pixel po pixelu stejná jako čistá omalovánka“ = obrázek bez jediné barvy.
 * Animace odletu do knihy a poskočení knihy jsou ruční kontrola (AC7).
 */

/** Zařízení s albem domku (`photos` obrázků s barvami 0, 1, …). */
async function deviceWithAlbum(photos: number): Promise<SwapDevice> {
  const device = new SwapDevice();
  await fillAlbum(device.records(EMA), photos, HOUSE);
  return device;
}

describe('#141 AC1: obrázek se při odchodu domečkem uloží do alba', () => {
  it('rozmalovaný obrázek přibude do alba jako nejnovější, pixel po pixelu stejný i po obnovení stránky', async () => {
    const device = await deviceWithAlbum(3);
    const page = await openGame(device);

    const painted = await paintAndLeave(page, HOUSE, PAGE_COLOR);

    const album = await albumPixels(device);
    expect(album.length, 'v albu přibyl jeden obrázek').toBe(4);
    expect(album[0], 'nový obrázek je v albu jako nejnovější').toEqual(painted);
    await openGame(device);
    const afterReload = await albumPixels(device);
    expect(afterReload[0], 'po obnovení stránky je stejný').toEqual(painted);
    expect(timesIn(afterReload, painted), 'a je v albu jednou').toBe(1);
  });

  it('teprve po potvrzeném uložení je stránka čistá; do té doby je obrázek na stránce', async () => {
    const device = await deviceWithAlbum(1);
    const { page, watched } = loadWatchedGame(device);
    const game = await openPainting(page);
    paintLeft(game, PAGE_COLOR);
    const painted = picturePixels(game);
    watched.holdAdds();

    const leaving = startLeaving(page, game);
    await settleLong();

    expect(pageOf(device), 'před potvrzením je obrázek dál na stránce').toEqual(painted);
    expect(timesIn(await albumPixels(device), painted), 'v albu ještě není').toBe(0);
    await watched.releaseAdds();
    await leaving;
    await settleLong();
    expect(isClean(pageOf(device)), 'po potvrzení je stránka čistá').toBe(true);
    expect(timesIn(await albumPixels(device), painted), 'obrázek je v albu').toBe(1);
  });

  it('po uložení ukazuje náhled na výběru jen obrys, i po obnovení stránky', async () => {
    const device = await deviceWithAlbum(0);
    const page = await openGame(device);

    await paintAndLeave(page, HOUSE, PAGE_COLOR);

    expect(previewColors(page.storage), 'náhled domku je čistý obrys').toEqual([]);
    const reloaded = await openGame(device);
    expect(previewColors(reloaded.storage), 'po obnovení stránky dál jen obrys').toEqual([]);
  });

  it('barvy nástrojů, nedávné barvy a tloušťka čáry zůstanou', async () => {
    const device = await deviceWithAlbum(0);
    const page = await openGame(device);
    const game = await openPainting(page);
    game.tapColor(GREEN);
    paintLeft(game, PAGE_COLOR);
    choose(game, 'marker');
    game.tapColor(BLUE);
    game.tapColor(RED);
    game.tapLineSize('large');
    const tools = ['brush', 'marker', 'crayon', 'glitter'] as const;
    const toolColors = tools.map((tool) => game.toolColor(tool));
    const recent = game.recentColors();

    await leavePainting(page, game);
    const again = await openPainting(page);

    expect(
      tools.map((tool) => again.toolColor(tool)),
      'barvy nástrojů',
    ).toEqual(toolColors);
    expect(again.recentColors(), 'nedávné barvy').toEqual(recent);
    expect(again.lineSize(), 'tloušťka čáry').toBe('large');
  });

  it('ťuknutí na náhled pak otevře čistou stránku a Zpět nemá co vracet', async () => {
    const device = await deviceWithAlbum(0);
    const page = await openGame(device);
    await paintAndLeave(page, HOUSE, PAGE_COLOR);

    const game = await openPainting(page);

    expect(isClean(picturePixels(game)), 'stránka je čistá').toBe(true);
    expect(game.tapUndo(), 'Zpět se jen zhoupne').toEqual({
      kind: 'wobble',
      tones: HOME_WOBBLE_TONES,
    });
    expect(isClean(picturePixels(game)), 'a nic nevrátí').toBe(true);
  });

  it('kniha ukáže nový obrázek na prvním místě', async () => {
    const device = await deviceWithAlbum(2);
    const page = await openGame(device);
    const painted = await paintAndLeave(page, HOUSE, PAGE_COLOR);

    const book = page.choice.tapBook(await albumOf(page));

    expect(book.kind, 'kniha otevře album').toBe('open');
    const first = book.kind === 'open' ? book.entries[0] : undefined;
    expect(first?.picture, 'první je obrázek domku').toEqual(HOUSE);
    expect(first === undefined ? [] : pixelsOf(first.colors, page.regions)).toEqual(painted);
  });

  it('obrázek, který se od obrázku v albu liší jediným malým tahem, do alba přibude', async () => {
    const device = await deviceWithAlbum(1);
    const page = await openGame(device);
    const game = await openPainting(page);
    paintLeft(game, 0);
    paintRightDot(game, SECOND_COLOR);
    const painted = picturePixels(game);

    await leavePainting(page, game);

    const album = await albumPixels(device);
    expect(album.length, 'album má 2 obrázky').toBe(2);
    expect(album[0], 'odlišný obrázek je nejnovější').toEqual(painted);
  });

  it('obrázek stejný jako obrázek jiné omalovánky v albu do alba přibude', async () => {
    const device = new SwapDevice();
    await fillAlbum(device.records(EMA), 1, CIRCLES);
    const page = await openGame(device);

    const painted = await paintAndLeave(page, HOUSE, 0);

    const album = await albumOf(page);
    const entries = album.status === 'read' ? album.entries : [];
    expect(entries.length, 'album má obrázek kruhů i domku').toBe(2);
    expect(entries[0]?.picture, 'nejnovější je domek').toEqual(HOUSE);
    expect(entries[0] === undefined ? [] : pixelsOf(entries[0].colors, page.regions)).toEqual(
      painted,
    );
  });
});

describe('#141 AC2: kdy do alba nic nepřibude', () => {
  it('stránka bez jediné barvy album nezmění: nemalovaná, vygumovaná i jen s vybranou barvou', async () => {
    const cases = [
      { what: 'nemalovaná stránka', paint: () => undefined },
      {
        what: 'vygumovaná stránka',
        paint: (game: Awaited<ReturnType<typeof openPainting>>) => {
          paintLeft(game, PAGE_COLOR);
          choose(game, 'eraser');
          for (let y = 0; y < 200; y += 2) {
            game.pointerDown({ id: 1, x: 0, y, kind: 'touch' });
            game.pointerMove({ id: 1, x: 149, y, kind: 'touch' });
            game.pointerUp(1);
          }
        },
      },
      {
        what: 'jen vybraná barva bez tahu',
        paint: (game: Awaited<ReturnType<typeof openPainting>>) => {
          game.tapColor(PAGE_COLOR);
        },
      },
    ];

    for (const { what, paint } of cases) {
      const device = await deviceWithAlbum(2);
      const page = await openGame(device);
      const before = recordsOf(device);
      const game = await openPainting(page);
      paint(game);
      expect(isClean(picturePixels(game)), `${what}: stránka je bez barvy`).toBe(true);

      await leavePainting(page, game);

      expect(recordsOf(device), `${what}: album se nezměnilo`).toEqual(before);
      expect(isClean(pageOf(device)), `${what}: stránka zůstala čistá`).toBe(true);
    }
  });

  it('stránka stejná jako obrázek té omalovánky v albu: obrázek zůstane v albu jednou a stránka je čistá, i v plném albu', async () => {
    const cases = [
      { what: 'album se 3 obrázky', photos: 3, unreadable: 0 },
      { what: 'plné album s 12 obrázky', photos: 12, unreadable: 0 },
      { what: 'album s 24 záznamy', photos: 6, unreadable: 18 },
    ];

    for (const { what, photos, unreadable } of cases) {
      const device = await deviceWithAlbum(photos);
      await addUnreadable(device.records(EMA), unreadable);
      const page = await openGame(device);
      const before = recordsOf(device);

      const painted = await paintAndLeave(page, HOUSE, 1);

      expect(recordsOf(device), `${what}: album se nezměnilo`).toEqual(before);
      expect(timesIn(await albumPixels(device), painted), `${what}: obrázek je v albu jednou`).toBe(
        1,
      );
      expect(isClean(pageOf(device)), `${what}: stránka je čistá`).toBe(true);
      expect(previewColors(page.storage), `${what}: náhled je čistý obrys`).toEqual([]);
    }
  });

  it('nečitelná nebo poškozená stránka: náhled je čistý obrys a přesun ji nesmaže ani nepřepíše', async () => {
    for (const text of ['nesmysl', '{}', 'p5|house|1|300|200|x', 'A'.repeat(60_000)]) {
      const what = `záznam ${JSON.stringify(text.slice(0, 12))}`;
      const device = await deviceWithAlbum(2);
      device.kv.set(`${EMA}/${pageKeyOf(HOUSE)}`, text);
      const albumBefore = recordsOf(device);

      const page = await openGame(device);

      expect(previewColors(page.storage), `${what}: náhled je čistý obrys`).toEqual([]);
      expect(device.kv.get(`${EMA}/${pageKeyOf(HOUSE)}`), `${what}: záznam zůstal`).toBe(text);
      expect(recordsOf(device), `${what}: album se nezměnilo`).toEqual(albumBefore);
      expect(page.choice.tapPreview(previewIndexOf(HOUSE)).kind, `${what}: náhled se otevře`).toBe(
        'open',
      );
    }
  });

  it('malování nečitelné stránky se chová jako dnes: otevře se čistá a co dítě namaluje, přibude do alba', async () => {
    const device = await deviceWithAlbum(0);
    device.kv.set(`${EMA}/${pageKeyOf(HOUSE)}`, 'nesmysl');
    const page = await openGame(device);

    const game = await openPainting(page);
    expect(isClean(picturePixels(game)), 'otevře se čistá stránka').toBe(true);
    paintLeft(game, PAGE_COLOR);
    const painted = picturePixels(game);
    await leavePainting(page, game);

    expect(await albumPixels(device), 'nový obrázek je v albu').toEqual([painted]);
  });
});
