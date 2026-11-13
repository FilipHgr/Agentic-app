import { afterEach, describe, expect, it, vi } from 'vitest';

import { removeAlbumEntry, readAlbum } from '../../../src/games/coloring/logic/album';
import { startPictureChoice } from '../../../src/games/coloring/logic/pictureChoice';
import { openColoring } from '../../../src/games/coloring/logic/savedPicture';
import { HOLD_TO_GO_HOME_MS } from '../../../src/shared/logic/homeButton';
import type { KeyValueStorage } from '../../../src/shared/storage/keyValueStorage';
import type { GameRecords } from '../../../src/shared/storage/profileRecords';
import { addUnreadable, fillAlbum, paintLeft } from './albumHelpers';
import {
  prepareSwap,
  showPainting,
  swapPictures,
  tapContinue,
  timesIn,
} from './continuePaintingHelpers';
import {
  EMA,
  HOUSE,
  PAGE_COLOR,
  SECOND_COLOR,
  SwapDevice,
  THREE_PICTURES,
  albumPixels,
  isClean,
  leavePainting,
  openGame,
  openPainting,
  pageOf,
  paintAndLeave,
  paintPageDirectly,
  paintRightDot,
  picturePixels,
  previewColors,
  recordsOf,
  settleLong,
} from './pageToAlbumHelpers';
import type { LoadOptions } from './pageToAlbumHelpers';
import { pixelsOf, twoHalves } from './savedPictureHelpers';

/**
 * Testy k #141 AC5: plné album (12 obrázků nebo 24 záznamů, odložená
 * stránka z #131 se počítá), nedostupné úložiště, zápis, který selže,
 * a dočasný profil bez alba. Rozmalovaná stránka, která do alba ještě
 * nepřibyla, zůstane beze změny a přesun se zkusí znovu při dalším odchodu
 * z malování a při dalším otevření Omalovánek. Hráč nikdy nevidí výjimku.
 *
 * Dočasný profil: správa profilů mu dá záznamy, které na všechno odpoví
 * „nedostupné“ (`profileStorage.ts`); hra spuštěná bez alba nedostane
 * záznamy vůbec. Oba případy se testují.
 */

/** Když do alba nic nepřibude: jak zařízení selže, nebo jak je album plné. */
interface KeptCase {
  readonly what: string;
  readonly prepare: (device: SwapDevice) => Promise<void>;
  readonly options?: LoadOptions;
}

afterEach(() => {
  vi.useRealTimers();
});

const KEPT_CASES: readonly KeptCase[] = [
  { what: 'plné album s 12 obrázky', prepare: (device) => fillAlbum(device.records(EMA), 12) },
  {
    what: 'album s 24 záznamy',
    prepare: async (device) => {
      await fillAlbum(device.records(EMA), 4);
      await addUnreadable(device.records(EMA), 20);
    },
  },
  {
    what: 'nedostupné úložiště alba',
    prepare: async (device) => {
      device.recordsUnavailable = true;
    },
  },
  {
    what: 'uložení do alba skončí „plné“',
    prepare: async (device) => {
      device.addFailure = 'full';
    },
  },
  {
    what: 'uložení do alba skončí „nedostupné“',
    prepare: async (device) => {
      device.addFailure = 'unavailable';
    },
  },
  { what: 'hra bez alba', prepare: async () => undefined, options: { records: undefined } },
];

describe('#141 AC5: když se obrázek do alba nevejde nebo nejde uložit', () => {
  it('rozmalovaná stránka zůstane beze změny a náhled ukazuje její barvy', async () => {
    for (const { what, prepare, options } of KEPT_CASES) {
      const device = new SwapDevice();
      await prepare(device);
      const page = await openGame(device, options);
      const albumBefore = recordsOf(device);

      const painted = await paintAndLeave(page, HOUSE, PAGE_COLOR);

      expect(pageOf(device), `${what}: stránka beze změny`).toEqual(painted);
      expect(previewColors(page.storage), `${what}: náhled ukazuje barvy`).toEqual([PAGE_COLOR]);
      expect(recordsOf(device), `${what}: album beze změny`).toEqual(albumBefore);
    }
  });

  it('dítě může v rozmalované stránce malovat dál a nic se neztratí', async () => {
    for (const { what, prepare, options } of KEPT_CASES) {
      const device = new SwapDevice();
      await prepare(device);
      const page = await openGame(device, options);
      const first = await paintAndLeave(page, HOUSE, PAGE_COLOR);

      const game = await openPainting(page);
      expect(picturePixels(game), `${what}: malování ukazuje rozmalovaný obrázek`).toEqual(first);
      paintRightDot(game, SECOND_COLOR);
      const more = picturePixels(game);
      await leavePainting(page, game);

      expect(pageOf(device), `${what}: domalovaný obrázek je na stránce`).toEqual(more);
    }
  });

  it('dnešní rozmalovaná stránka zůstane při otevření Omalovánek beze změny', async () => {
    for (const { what, prepare, options } of KEPT_CASES) {
      const device = new SwapDevice();
      await prepare(device);
      const painted = paintPageDirectly(device, HOUSE, PAGE_COLOR);
      const albumBefore = recordsOf(device);

      const page = await openGame(device, options);

      expect(pageOf(device), `${what}: stránka beze změny`).toEqual(painted);
      expect(previewColors(page.storage), `${what}: náhled ukazuje barvy`).toEqual([PAGE_COLOR]);
      expect(recordsOf(device), `${what}: album beze změny`).toEqual(albumBefore);
    }
  });

  it('odložená stránka z výměny #131 se do plného alba počítá: obrázek z malování zůstane na stránce', async () => {
    const prepared = await prepareSwap({ albumCount: 12, aIndex: 3 });
    // Uložení P i vrácení A selže: dítě maluje A a P počká odložená (#131 AC4).
    prepared.device.addFailure = 'full';
    expect((await tapContinue(prepared.page)).kind, 'malování se otevřelo').toBe('opened');
    prepared.device.addFailure = null;
    const game = await showPainting(prepared.page, HOUSE);
    paintRightDot(game, SECOND_COLOR);
    const painted = picturePixels(game);

    vi.advanceTimersByTime(HOLD_TO_GO_HOME_MS);
    expect(prepared.page.choice.holdHome(), 'domeček vede na výběr').toBe('toPicker');
    await prepared.page.choice.paintingLeft(game);
    await settleLong();

    expect(pageOf(prepared.device), 'album s odloženou P je plné: obrázek je na stránce').toEqual(
      painted,
    );
    expect((await albumPixels(prepared.device)).length, 'v albu je 11 obrázků').toBe(11);
    await openGame(prepared.device);
    const album = await albumPixels(prepared.device);
    expect(album.length, 'P se do alba vešla').toBe(12);
    expect(timesIn(album, prepared.p), 'P je v albu jednou').toBe(1);
    expect(pageOf(prepared.device), 'obrázek z malování zůstal na stránce').toEqual(painted);
  });
});

describe('#141 AC5: přesun se zkusí znovu', () => {
  it('po smazání obrázku z alba se stránka přesune při dalším otevření Omalovánek', async () => {
    const device = new SwapDevice();
    await fillAlbum(device.records(EMA), 12);
    const page = await openGame(device);
    const painted = await paintAndLeave(page, HOUSE, PAGE_COLOR);
    expect(pageOf(device), 'plné album: obrázek zůstal na stránce').toEqual(painted);
    const album = await readAlbum(page.records, page.pictures);
    const oldest = album.status === 'read' ? album.entries.at(-1) : undefined;
    expect(await removeAlbumEntry(page.records, oldest?.recordId ?? ''), 'smazání').toBe('removed');

    await openGame(device);

    const after = await albumPixels(device);
    expect(after.length, 'album je zase plné').toBe(12);
    expect(after[0], 'obrázek ze stránky je nejnovější').toEqual(painted);
    expect(isClean(pageOf(device)), 'stránka je čistá').toBe(true);
  });

  it('po smazání obrázku z alba se stránka přesune při dalším odchodu z malování', async () => {
    const device = new SwapDevice();
    await fillAlbum(device.records(EMA), 12);
    const page = await openGame(device);
    await paintAndLeave(page, HOUSE, PAGE_COLOR);
    const album = await readAlbum(page.records, page.pictures);
    const oldest = album.status === 'read' ? album.entries.at(-1) : undefined;
    expect(await removeAlbumEntry(page.records, oldest?.recordId ?? ''), 'smazání').toBe('removed');

    const game = await openPainting(page);
    const painted = picturePixels(game);
    await leavePainting(page, game);

    const after = await albumPixels(device);
    expect(after[0], 'obrázek ze stránky je nejnovější').toEqual(painted);
    expect(isClean(pageOf(device)), 'stránka je čistá').toBe(true);
  });

  it('když úložiště zase funguje, další otevření Omalovánek stránku přesune', async () => {
    const device = new SwapDevice();
    device.recordsUnavailable = true;
    const page = await openGame(device);
    const painted = await paintAndLeave(page, HOUSE, PAGE_COLOR);
    device.repair();

    await openGame(device);

    expect(await albumPixels(device), 'obrázek je v albu').toEqual([painted]);
    expect(isClean(pageOf(device)), 'stránka je čistá').toBe(true);
  });

  it('když se obrázek uloží do alba, ale stránku nejde vyčistit, zůstane obrázek na obou místech a další otevření stránku vyčistí', async () => {
    const device = new SwapDevice();
    const page = await openGame(device);
    const game = await openPainting(page);
    paintLeft(game, PAGE_COLOR);
    const painted = picturePixels(game);
    device.fullAfterWrites(1);

    await leavePainting(page, game);
    const album = await albumPixels(device);
    expect(
      timesIn(album, painted) === 1 || isClean(pageOf(device)) === false,
      'obrázek je v albu nebo na stránce',
    ).toBe(true);
    expect(timesIn(album, painted), 'v albu nejvýš jednou').toBeLessThanOrEqual(1);

    device.repair();
    await openGame(device);
    expect(timesIn(await albumPixels(device), painted), 'obrázek je v albu jednou').toBe(1);
    expect(isClean(pageOf(device)), 'stránka je čistá').toBe(true);
  });
});

describe('#141 AC5: dočasný profil a hráč nikdy nevidí výjimku', () => {
  it('bez alba se stránky chovají jako dnes: po návratu i po obnovení má omalovánka svůj obrázek', async () => {
    const device = new SwapDevice();
    const page = await openGame(device, { records: undefined });
    const painted = await paintAndLeave(page, HOUSE, PAGE_COLOR);

    const again = await openPainting(page);
    expect(picturePixels(again), 'po návratu').toEqual(painted);
    const reloaded = await openGame(device, { records: undefined });
    const afterReload = await openPainting(reloaded);
    expect(picturePixels(afterReload), 'po obnovení stránky').toEqual(painted);
  });

  it('úložiště, které čtení i zápis odmítne výjimkou, otevření ani odchod nezastaví', async () => {
    const throwingStorage: KeyValueStorage = {
      getItem: () => {
        throw new Error('zkušební chyba úložiště');
      },
      setItem: () => {
        throw new Error('zkušební chyba úložiště');
      },
    };
    const rejecting: GameRecords = {
      list: () => Promise.reject(new Error('zkušební chyba alba')),
      add: () => Promise.reject(new Error('zkušební chyba alba')),
      remove: () => Promise.reject(new Error('zkušební chyba alba')),
    };
    const cases: ReadonlyArray<{
      readonly what: string;
      readonly storage: KeyValueStorage;
      readonly records: GameRecords;
    }> = [
      { what: 'úložiště i album vyhodí', storage: throwingStorage, records: rejecting },
      { what: 'album vyhodí', storage: new SwapDevice().storage(EMA), records: rejecting },
    ];

    for (const { what, storage, records } of cases) {
      const clock = { now: 0 };
      const choice = startPictureChoice(THREE_PICTURES, {
        now: () => clock.now,
        records,
        storage,
        albumPictures: swapPictures(),
      });
      // Zamítnutý slib by test shodil: otevření i odchod musí doběhnout bez výjimky.
      await choice.movePagesToAlbum();
      expect(choice.tapPreview(0).kind, `${what}: náhled se otevře`).toBe('open');
      choice.paintingShown();
      clock.now += HOLD_TO_GO_HOME_MS;
      const game = openColoring({ regions: twoHalves(), picture: HOUSE, storage });
      paintLeft(game, PAGE_COLOR);
      const painted = pixelsOf(game, twoHalves());
      expect(choice.holdHome(), `${what}: domeček vede na výběr`).toBe('toPicker');
      await choice.paintingLeft(game);
      await settleLong();
      expect(choice.screen().kind, `${what}: dítě je na výběru`).toBe('picker');
      if (storage !== throwingStorage) {
        expect(
          pixelsOf(openColoring({ regions: twoHalves(), picture: HOUSE, storage }), twoHalves()),
          `${what}: obrázek zůstal na stránce`,
        ).toEqual(painted);
      }
    }
  });
});
