import { afterEach, describe, expect, it, vi } from 'vitest';

import { readAlbum } from '../../../src/games/coloring/logic/album';
import { HOME_WOBBLE_TONES } from '../../../src/shared/logic/homeButton';
import { addUnreadable, fillAlbum, paintLeft } from './albumHelpers';
import {
  P_COLOR,
  prepareSwap,
  sameImage,
  settleOn,
  swapPictures,
  tapContinue,
  timesIn,
  writesOfWholeSwap,
} from './continuePaintingHelpers';
import type { SwapScenario } from './continuePaintingHelpers';
import {
  CIRCLES,
  EMA,
  HOUSE,
  PAGE_COLOR,
  SECOND_COLOR,
  STAR,
  SwapDevice,
  THIRD_COLOR,
  albumPixels,
  beginOpening,
  isClean,
  loadGame,
  loadWatchedGame,
  openGame,
  openPainting,
  pageOf,
  paintPageDirectly,
  picturePixels,
  previewColors,
  previewIndexOf,
  settleLong,
  startLeaving,
  unreadableRecordsOf,
  writesOf,
} from './pageToAlbumHelpers';
import type { Pixels } from './pageToAlbumHelpers';

/**
 * Testy k #141 AC4: při každém otevření Omalovánek se nejdřív dořeší
 * odložená výměna z #131 (`settleAlbumSwap`) a pak se každá rozmalovaná
 * stránka profilu přesune do alba v pořadí sady (podle AC1 a AC2), dokud
 * je v albu místo (`PictureChoice.movePagesToAlbum`).
 *
 * Obnovení stránky během přesunu: zkušební zařízení po zadaném počtu
 * zápisů do obou úložišť „vypne stránku“ (`SwapDevice.cutAfterWrites`),
 * nic dalšího se nezapíše a rozběhnuté operace alba už neskončí. Přesun se
 * tak přeruší po každém zápisu, bez znalosti toho, jak kroky dělá. Počet
 * zápisů celého přesunu testy změří na stejném scénáři bez přerušení.
 */

afterEach(() => {
  vi.useRealTimers();
});

/** Zařízení s albem domku (`photos` obrázků) a dnešními rozmalovanými stránkami. */
async function deviceWithPages(options: {
  readonly photos?: number;
  readonly pages: ReadonlyArray<readonly [typeof HOUSE, number]>;
}): Promise<{ readonly device: SwapDevice; readonly pages: Pixels[] }> {
  const device = new SwapDevice();
  await fillAlbum(device.records(EMA), options.photos ?? 0, HOUSE);
  const pages = options.pages.map(([picture, color]) => paintPageDirectly(device, picture, color));
  return { device, pages };
}

/** Obrázek je v albu právě jednou, nebo na stránce a v albu není. */
function keptOnce(album: readonly Pixels[], page: Pixels, image: Pixels): boolean {
  const inAlbum = timesIn(album, image);
  return inAlbum === 1 || (inAlbum === 0 && sameImage(page, image));
}

describe('#141 AC4: převod dnešních stránek při otevření Omalovánek', () => {
  it('každá rozmalovaná stránka profilu se přesune do alba v pořadí sady a stránky jsou čisté', async () => {
    const { device, pages } = await deviceWithPages({
      photos: 2,
      pages: [
        [HOUSE, PAGE_COLOR],
        [CIRCLES, SECOND_COLOR],
        [STAR, THIRD_COLOR],
      ],
    });

    const page = await openGame(device);

    const album = await albumPixels(device);
    expect(album.length, 'v albu přibyly 3 obrázky').toBe(5);
    expect(album.slice(0, 3), 'v pořadí sady: domek první, hvězda nejnovější').toEqual([
      pages[2],
      pages[1],
      pages[0],
    ]);
    for (const picture of [HOUSE, CIRCLES, STAR]) {
      expect(isClean(pageOf(device, picture)), `${picture.id}: stránka je čistá`).toBe(true);
      expect(previewColors(page.storage, picture), `${picture.id}: náhled je obrys`).toEqual([]);
    }
  });

  it('přesouvá se, dokud je v albu místo: další stránky v pořadí sady zůstanou rozmalované', async () => {
    const { device, pages } = await deviceWithPages({
      photos: 10,
      pages: [
        [HOUSE, PAGE_COLOR],
        [CIRCLES, SECOND_COLOR],
        [STAR, THIRD_COLOR],
      ],
    });

    const page = await openGame(device);

    const album = await albumPixels(device);
    expect(album.length, 'album je plné').toBe(12);
    expect(album.slice(0, 2), 'domek a kruhy jsou v albu').toEqual([pages[1], pages[0]]);
    expect(pageOf(device, STAR), 'hvězda zůstala na stránce').toEqual(pages[2]);
    expect(previewColors(page.storage, STAR), 'náhled hvězdy ukazuje její barvy').toEqual([
      THIRD_COLOR,
    ]);
  });

  it('stránka stejná jako obrázek v albu se vyčistí i za stránkou, na kterou už místo nezbylo', async () => {
    const device = new SwapDevice();
    await fillAlbum(device.records(EMA), 10, HOUSE);
    // Hvězda s barvou 0 je stejná jako obrázek hvězdy, který dítě dřív vyfotilo.
    await fillAlbum(device.records(EMA), 1, STAR);
    const house = paintPageDirectly(device, HOUSE, PAGE_COLOR);
    const circles = paintPageDirectly(device, CIRCLES, SECOND_COLOR);
    const star = paintPageDirectly(device, STAR, 0);

    await openGame(device);

    const album = await albumPixels(device);
    expect(album.length, 'album je plné').toBe(12);
    expect(album[0], 'domek se vešel').toEqual(house);
    expect(pageOf(device, CIRCLES), 'kruhy zůstaly na stránce').toEqual(circles);
    expect(isClean(pageOf(device, STAR)), 'stránka hvězdy je čistá').toBe(true);
    const stars = await readAlbum(device.rawRecords(EMA), swapPictures());
    expect(
      stars.status === 'read'
        ? stars.entries.filter((entry) => entry.picture.id === STAR.id).length
        : 0,
      'obrázek hvězdy je v albu jednou',
    ).toBe(1);
    expect(
      star.some((pixel) => pixel !== null),
      'hvězda byla rozmalovaná',
    ).toBe(true);
  });

  it('obrázek, od kterého dítě odešlo zavřením nebo obnovením stránky, je po dalším otevření v albu', async () => {
    const device = new SwapDevice();
    const page = await openGame(device);
    const game = await openPainting(page);
    paintLeft(game, PAGE_COLOR);
    const painted = picturePixels(game);
    // Stránka se zavře: scéna obrázek jen uloží (pagehide), domeček se nedržel.
    game.suspend();

    const reopened = await openGame(device);

    expect(await albumPixels(device), 'obrázek je v albu').toEqual([painted]);
    expect(isClean(pageOf(device)), 'stránka je čistá').toBe(true);
    expect(previewColors(reopened.storage), 'náhled je obrys').toEqual([]);
  });

  it('nečitelné a poškozené záznamy alba ani stránek se při přesunu nesmažou ani nepřepíšou', async () => {
    const { device } = await deviceWithPages({ photos: 2, pages: [[HOUSE, PAGE_COLOR]] });
    await addUnreadable(device.records(EMA), 3);
    device.kv.set(`${EMA}/picture.${CIRCLES.id}`, 'nesmysl');
    const unreadableBefore = unreadableRecordsOf(device);

    await openGame(device);

    expect(unreadableRecordsOf(device), 'nečitelné záznamy alba beze změny').toEqual(
      unreadableBefore,
    );
    expect(device.kv.get(`${EMA}/picture.${CIRCLES.id}`), 'nečitelná stránka kruhů zůstala').toBe(
      'nesmysl',
    );
    expect((await albumPixels(device)).length, 'domek se přesunul').toBe(3);
  });

  it('dokud se stránka přesouvá, náhled té omalovánky se jen zhoupne s tónem domečku', async () => {
    const { device } = await deviceWithPages({ pages: [[HOUSE, PAGE_COLOR]] });
    const { page, watched } = loadWatchedGame(device);
    watched.holdAdds();

    const { moving } = await beginOpening(page);
    await settleLong();

    expect(page.choice.tapPreview(previewIndexOf(HOUSE)), 'náhled domku se zhoupne').toEqual({
      kind: 'wobble',
      tones: HOME_WOBBLE_TONES,
    });
    expect(page.choice.screen().kind, 'dítě zůstane na výběru').toBe('picker');
    await watched.releaseAdds();
    await moving;
    await settleLong();
    expect(page.choice.tapPreview(previewIndexOf(HOUSE)).kind, 'po přesunu se otevře').toBe('open');
  });

  it('během přesunu jedné stránky jde otevřít omalovánku, která se nepřesouvá', async () => {
    const { device } = await deviceWithPages({ pages: [[HOUSE, PAGE_COLOR]] });
    const { page, watched } = loadWatchedGame(device);
    watched.holdAdds();

    const { moving } = await beginOpening(page);
    await settleLong();

    expect(page.choice.tapPreview(previewIndexOf(CIRCLES)).kind, 'kruhy se otevřou').toBe('open');
    await watched.releaseAdds();
    await moving;
  });
});

describe('#141 AC4: nejdřív se dořeší odložená výměna z #131', () => {
  it('po přerušené výměně je po otevření každý obrázek v albu právě jednou a stránka čistá', async () => {
    const scenario: SwapScenario = { albumCount: 3, aIndex: 1 };
    const total = await writesOfWholeSwap(scenario);

    for (let cut = 0; cut <= total; cut += 1) {
      const prepared = await prepareSwap(scenario);
      prepared.device.cutAfterWrites(cut);
      expect(prepared.page.choice.tapContinue().kind, `přerušení po ${cut}. zápisu`).toBe(
        'swapping',
      );
      await settleLong();

      await openGame(prepared.device);

      const album = await albumPixels(prepared.device);
      const what = `přerušení výměny po ${cut}. zápisu`;
      expect(timesIn(album, prepared.p), `${what}: P je v albu jednou`).toBe(1);
      expect(timesIn(album, prepared.a), `${what}: A je v albu jednou`).toBe(1);
      for (const other of prepared.albumBefore) {
        expect(timesIn(album, other), `${what}: ostatní obrázky jednou`).toBe(1);
      }
      expect(album.length, `${what}: nic navíc`).toBe(prepared.albumBefore.length + 1);
      expect(isClean(pageOf(prepared.device)), `${what}: stránka je čistá`).toBe(true);
    }
  });

  it('výměna, která čeká na čitelné album, se nepřepíše přesunem; další otevření vše dořeší', async () => {
    const prepared = await prepareSwap({ albumCount: 3, aIndex: 1 });
    prepared.device.cutAfterWrites(1);
    prepared.page.choice.tapContinue();
    await settleLong();

    prepared.device.listUnavailable = true;
    const before = prepared.device.snapshot();
    await openGame(prepared.device);
    expect(prepared.device.snapshot(), 'album nejde přečíst: nic se nezměnilo').toEqual(before);

    prepared.device.repair();
    await openGame(prepared.device);
    const album = await albumPixels(prepared.device);
    expect(timesIn(album, prepared.p), 'P je v albu jednou').toBe(1);
    expect(timesIn(album, prepared.a), 'A je v albu jednou').toBe(1);
    expect(isClean(pageOf(prepared.device)), 'stránka je čistá').toBe(true);
  });

  it('po výměně v plném albu přesun při otevření nepřekročí 12 obrázků a obrázek z alba zůstane na stránce', async () => {
    const prepared = await prepareSwap({ albumCount: 12, aIndex: 4 });
    expect((await tapContinue(prepared.page)).kind, 'výměna proběhla').toBe('opened');
    await settleOn(prepared.page);

    await openGame(prepared.device);

    expect(
      prepared.device.maxRecords.get(EMA),
      'záznamů nebylo nikdy víc než 12',
    ).toBeLessThanOrEqual(12);
    const album = await albumPixels(prepared.device);
    expect(album.length).toBe(12);
    expect(pageOf(prepared.device), 'A zůstala na stránce, album je plné').toEqual(prepared.a);
    expect(timesIn(album, prepared.p), 'P je v albu').toBe(1);
  });
});

describe('#141 AC4: obnovení stránky během přesunu', () => {
  it('při otevření: obrázek je v každém okamžiku na stránce nebo v albu a po obnovení v albu právě jednou', async () => {
    const setup = (): Promise<{ readonly device: SwapDevice; readonly pages: Pixels[] }> =>
      deviceWithPages({
        photos: 2,
        pages: [
          [HOUSE, PAGE_COLOR],
          [CIRCLES, SECOND_COLOR],
        ],
      });
    const measured = await setup();
    const total = await writesOf(measured.device, () => openGame(measured.device));
    expect(total, 'přesun 2 stránek zapíše aspoň 2 obrázky do alba').toBeGreaterThanOrEqual(2);

    for (let cut = 0; cut <= total; cut += 1) {
      const { device, pages } = await setup();
      const page = loadGame(device);
      device.cutAfterWrites(cut);
      void beginOpening(page);
      await settleLong();
      const what = `přerušení po ${cut}. zápisu z ${total}`;
      const albumNow = await albumPixels(device);
      expect(keptOnce(albumNow, pageOf(device, HOUSE), pages[0] ?? []), `${what}: domek`).toBe(
        true,
      );
      expect(keptOnce(albumNow, pageOf(device, CIRCLES), pages[1] ?? []), `${what}: kruhy`).toBe(
        true,
      );

      await openGame(device);

      const album = await albumPixels(device);
      expect(timesIn(album, pages[0] ?? []), `${what}: domek v albu jednou`).toBe(1);
      expect(timesIn(album, pages[1] ?? []), `${what}: kruhy v albu jednou`).toBe(1);
      expect(album.length, `${what}: nic navíc`).toBe(4);
      expect(isClean(pageOf(device, HOUSE)), `${what}: stránka domku čistá`).toBe(true);
      expect(isClean(pageOf(device, CIRCLES)), `${what}: stránka kruhů čistá`).toBe(true);
    }
  });

  it('při odchodu domečkem: obrázek je v každém okamžiku na stránce nebo v albu a po obnovení v albu právě jednou', async () => {
    const measureDevice = new SwapDevice();
    const measurePage = await openGame(measureDevice);
    const measureGame = await openPainting(measurePage);
    paintLeft(measureGame, P_COLOR);
    const total = await writesOf(measureDevice, () => startLeaving(measurePage, measureGame));

    for (let cut = 0; cut <= total; cut += 1) {
      const device = new SwapDevice();
      const page = await openGame(device);
      const game = await openPainting(page);
      paintLeft(game, P_COLOR);
      const painted = picturePixels(game);
      device.cutAfterWrites(cut);
      void startLeaving(page, game);
      await settleLong();
      const what = `přerušení po ${cut}. zápisu z ${total}`;
      expect(keptOnce(await albumPixels(device), pageOf(device), painted), what).toBe(true);

      await openGame(device);

      expect(await albumPixels(device), `${what}: po obnovení v albu jednou`).toEqual([painted]);
      expect(isClean(pageOf(device)), `${what}: stránka čistá`).toBe(true);
    }
  });
});
