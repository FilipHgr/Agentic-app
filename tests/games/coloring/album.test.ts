import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  PREVIEW_TAP_TONES,
  homeHoldDecision,
} from '../../../src/games/coloring/logic/pictureChoice';
import type { HomeHold, PictureChoice } from '../../../src/games/coloring/logic/pictureChoice';
import type { PictureIdentity } from '../../../src/games/coloring/logic/savedPicture';
import { createHoldButton } from '../../../src/shared/logic/holdButton';
import { HOLD_TO_GO_HOME_MS, HOME_WOBBLE_TONES } from '../../../src/shared/logic/homeButton';
import { PROFILE_COLORS } from '../../../src/shared/logic/profiles';
import { UNAVAILABLE_GAME_RECORDS } from '../../../src/shared/storage/profileRecords';
import { openProfiles } from '../../../src/shared/storage/profileStorage';
import { startGameSession } from '../../../src/shared/ui/gameSession';
import { DeviceStorage } from '../../shared/profileFixtures';
import { RECORDS_DEVICES, memoryDevice } from '../../shared/profileRecordsFixtures';
import {
  CIRCLES,
  COLORING_GAME_ID,
  HOUSE,
  STAR,
  THREE_PICTURES,
  addUnreadable,
  albumDevice,
  albumOf,
  damageAlbum,
  fillAlbum,
  openWithAlbum,
  paintLeft,
  recordCount,
  shownCount,
  takePhoto,
  watchRecords,
} from './albumHelpers';
import { enterPicker } from './pictureChoiceHelpers';
import { RecordingStorage, paintedPixels, pixelsOf, twoHalves } from './savedPictureHelpers';

/**
 * Testy k #126 AC4 (kniha a album) a AC5 (obnovení stránky a selhání).
 * Kniha je na výběru omalovánky (`PictureChoice.tapBook`), album čte scéna
 * ze záznamů aktivního profilu (`readAlbum`) a knize ho předá; `null`
 * znamená, že ještě není přečtené. Album má obrazovku `{ kind: 'album' }`
 * a domeček podržený 1 s z něj vede na výběr (stránka zůstane ve hře).
 *
 * Na obrazovkách alba není žádný text: to je ruční kontrola (kreslí
 * scéna), texty natvrdo v kódu hlídá i `tests/shared/hardcodedTexts.test.ts`.
 */

const ORANGE = 1;
const BLUE = 4;

/** Album s `count` obrázky domku, každý jinou barvou (nejnovější je barva `count − 1`). */
async function albumWith(count: number) {
  const device = albumDevice();
  const records = device.page();
  await fillAlbum(records, count, HOUSE);
  return { device, records, album: await albumOf(records) };
}

describe('#126 AC4: kniha na výběru otevře album', () => {
  it('ťuknutí na knihu ji zhoupne se stejným tónem jako náhled na výběru a otevře album', async () => {
    const { album } = await albumWith(2);
    const choice = enterPicker();

    const tap = choice.tapBook(album);

    expect(tap.kind).toBe('open');
    expect(tap.kind === 'open' ? tap.tones : [], 'tón jako náhled na výběru').toEqual(
      PREVIEW_TAP_TONES,
    );
    expect(choice.screen()).toMatchObject({ kind: 'album' });
  });

  it('album ukáže obrázky aktivního profilu od nejnovějšího', async () => {
    const regions = twoHalves();
    const records = albumDevice().page();
    const saved: Array<Array<number | null>> = [];
    for (const color of [ORANGE, BLUE, 7]) {
      const game = await openWithAlbum({ storage: undefined, records, regions });
      paintLeft(game, color);
      saved.push(pixelsOf(game, regions));
      await takePhoto(game);
    }

    const tap = enterPicker().tapBook(await albumOf(records));

    const entries = tap.kind === 'open' ? tap.entries : [];
    expect(entries.length).toBe(3);
    expect(entries.map((entry) => pixelsOf(entry.colors, regions))).toEqual(saved.reverse());
  });

  it('prázdné album se neotevře, kniha se jen zhoupne se stejným tónem jako domeček', async () => {
    const choice = enterPicker();

    const tap = choice.tapBook(await albumOf(albumDevice().page()));

    expect(tap).toEqual({ kind: 'wobble', tones: HOME_WOBBLE_TONES });
    expect(choice.screen()).toEqual({ kind: 'picker' });
  });

  it('nedostupné album se neotevře, kniha se jen zhoupne se stejným tónem jako domeček', async () => {
    const unavailable: ReadonlyArray<readonly [string, Parameters<typeof albumOf>[0]]> = [
      ['úložiště nedostupné', UNAVAILABLE_GAME_RECORDS],
      ['stránka nedala záznamy', undefined],
    ];
    for (const [name, records] of unavailable) {
      const choice = enterPicker();
      const album = await albumOf(records);
      expect(album, name).toEqual({ status: 'unavailable' });

      expect(choice.tapBook(album), name).toEqual({ kind: 'wobble', tones: HOME_WOBBLE_TONES });
      expect(choice.screen(), name).toEqual({ kind: 'picker' });
    }
  });

  it('album, které ještě není přečtené, se neotevře a kniha se jen zhoupne', () => {
    const choice = enterPicker();

    expect(choice.tapBook(null)).toEqual({ kind: 'wobble', tones: HOME_WOBBLE_TONES });
    expect(choice.screen()).toEqual({ kind: 'picker' });
  });

  it('album jen s nečitelnými záznamy je prázdné a kniha se jen zhoupne', async () => {
    const records = albumDevice().page();
    await addUnreadable(records, 3);
    const choice = enterPicker();

    expect(choice.tapBook(await albumOf(records))).toEqual({
      kind: 'wobble',
      tones: HOME_WOBBLE_TONES,
    });
  });

  it('kniha funguje jen na výběru: v malování a v albu nic neudělá', async () => {
    const { album } = await albumWith(1);
    const painting = enterPicker();
    painting.tapPreview(0);
    expect(painting.tapBook(album), 'během otevírání').toEqual({ kind: 'ignored' });
    painting.paintingShown();
    expect(painting.tapBook(album), 'v malování').toEqual({ kind: 'ignored' });

    const inAlbum = enterPicker();
    inAlbum.tapBook(album);
    expect(inAlbum.tapBook(album), 'v albu').toEqual({ kind: 'ignored' });
  });
});

describe('#126 AC4: v albu', () => {
  // Od #129 AC1 otevře ťuknutí na náhled v albu velký obrázek (dřív jen
  // zhoupnutí s tónem domečku); velký obrázek testuje `bigPicture.test.ts`.
  it('ťuknutí na náhled v albu otevře velký obrázek s tónem náhledu na výběru (#129)', async () => {
    const { album } = await albumWith(3);

    for (const index of [0, 1, 2]) {
      const choice = enterPicker();
      choice.tapBook(album);
      const tap = choice.tapAlbumPreview(index);
      expect(tap.kind, `náhled ${index + 1}`).toBe('open');
      expect(tap.kind === 'open' ? tap.tones : [], `náhled ${index + 1}`).toEqual(
        PREVIEW_TAP_TONES,
      );
    }
  });

  it('ťuknutí na náhled alba mimo album nic neudělá', () => {
    const choice = enterPicker();
    expect(choice.tapAlbumPreview(0)).toEqual({ kind: 'ignored' });
  });

  it('náhledy omalovánek z výběru v albu nejdou otevřít', async () => {
    const { album } = await albumWith(1);
    const choice = enterPicker();
    choice.tapBook(album);

    expect(choice.tapPreview(0)).toEqual({ kind: 'ignored' });
    expect(choice.screen()).toMatchObject({ kind: 'album' });
  });

  it('domeček podržený 1 s vrátí dítě z alba na výběr a stránka zůstane ve hře', async () => {
    const { album } = await albumWith(1);
    const choice = enterPicker();
    choice.tapBook(album);

    const hold = choice.holdHome();

    expect(hold).toBe('toPicker');
    expect(homeHoldDecision(hold), 'do menu se neodchází').toBe('stay');
    expect(choice.screen()).toEqual({ kind: 'picker' });
  });
});

describe('#126 AC4: domeček v albu na stránce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /** Omalovánky na stránce s domečkem, jak ho drží stránka (jako v testech #124). */
  function pageWithHome(choice: PictureChoice) {
    const results: HomeHold[] = [];
    let wobbles = 0;
    let left = false;
    const session = startGameSession({
      homeButton: { hidden: true },
      startScenes: (running) => {
        running.host.setHomeAvailable(true);
        running.host.onHomeHold?.(() => {
          const result = choice.holdHome();
          results.push(result);
          return homeHoldDecision(result);
        });
        return () => undefined;
      },
      onLeft: () => {
        left = true;
      },
    });
    const button = createHoldButton({
      holdMs: HOLD_TO_GO_HOME_MS,
      isEnabled: () => session.isHomeEnabled(),
      onHoldComplete: () => session.holdHome(),
      onTap: () => {
        wobbles += 1;
      },
    });
    return { button, results, wobbles: () => wobbles, left: () => left };
  }

  it('ťuknutí na domeček v albu ho jen zhoupne, podržení 1 s vrátí na výběr a ne do menu', async () => {
    vi.useRealTimers();
    const { album } = await albumWith(1);
    vi.useFakeTimers();
    const choice = enterPicker(THREE_PICTURES, () => Date.now());
    choice.tapBook(album);
    const page = pageWithHome(choice);

    page.button.press(1);
    vi.advanceTimersByTime(100);
    page.button.release(1);
    expect(page.wobbles(), 'krátké ťuknutí jen zhoupne').toBe(1);
    expect(choice.screen(), 'album zůstane').toMatchObject({ kind: 'album' });

    page.button.press(1);
    vi.advanceTimersByTime(HOLD_TO_GO_HOME_MS);
    page.button.release(1);
    expect(page.results).toEqual(['toPicker']);
    expect(choice.screen()).toEqual({ kind: 'picker' });
    expect(page.left(), 'dítě zůstane v Omalovánkách').toBe(false);
  });
});

describe('#126 AC4: poškozené, nečitelné a cizí záznamy', () => {
  it('poškozený záznam se v albu nezobrazí a nesmaže se', async () => {
    const { device } = await albumWith(2);
    const ids = damageAlbum(device.shelf);
    const records = watchRecords(device.page());

    expect(await shownCount(records)).toBe(0);
    expect(records.removes(), 'nic se nemaže').toBe(0);
    expect(device.shelf.records.map((record) => record.id)).toEqual(ids);
  });

  it('nečitelný záznam se v albu nezobrazí a nesmaže se', async () => {
    const { device, records } = await albumWith(2);
    await addUnreadable(records, 4);
    const watched = watchRecords(device.page());

    expect(await shownCount(watched)).toBe(2);
    expect(watched.removes()).toBe(0);
    expect(await recordCount(watched)).toBe(6);
  });

  it('záznam omalovánky, která není v sadě, se v albu nezobrazí a nesmaže se', async () => {
    const records = watchRecords(albumDevice().page());
    const fourth: PictureIdentity = { id: 'fourth', version: 1 };
    await fillAlbum(records, 2, fourth, [...THREE_PICTURES, fourth]);

    expect(await shownCount(records, THREE_PICTURES)).toBe(0);
    expect(await shownCount(records, [...THREE_PICTURES, fourth]), 'se sadou s ní ano').toBe(2);
    expect(records.removes()).toBe(0);
    expect(await recordCount(records)).toBe(2);
  });

  it('záznam verze omalovánky, která není v sadě, se v albu nezobrazí a nesmaže se', async () => {
    const records = watchRecords(albumDevice().page());
    await fillAlbum(records, 2, HOUSE);
    const newerHouse: PictureIdentity = { id: HOUSE.id, version: HOUSE.version + 1 };

    expect(await shownCount(records, [newerHouse, CIRCLES, STAR])).toBe(0);
    expect(records.removes()).toBe(0);
    expect(await recordCount(records)).toBe(2);
  });

  it('nezobrazitelné záznamy se do limitu 12 obrázků nepočítají', async () => {
    const device = albumDevice();
    const setup = device.page();
    const fourth: PictureIdentity = { id: 'fourth', version: 1 };
    await fillAlbum(setup, 2, fourth, [...THREE_PICTURES, fourth]);
    await fillAlbum(setup, 2, HOUSE);
    damageAlbum(device.shelf);
    await addUnreadable(setup, 3);
    const records = device.page();
    await fillAlbum(records, 11, CIRCLES);

    const game = await openWithAlbum({ storage: undefined, records, picture: STAR });
    paintLeft(game, ORANGE);
    expect((await takePhoto(game)).kind, '12. zobrazitelný obrázek').toBe('saved');
    expect(await shownCount(records)).toBe(12);
    expect(await recordCount(records), 'nezobrazitelné zůstaly').toBe(19);
  });
});

describe('#126 AC4: každý profil vidí jen své album', () => {
  it('obrázek vyfocený v jednom profilu druhý profil v albu nevidí', async () => {
    const storage = new DeviceStorage();
    const device = memoryDevice();
    const page = openProfiles(storage, device.open());
    const ema = page.createProfile({ nickname: 'EMA', color: PROFILE_COLORS[1] });
    const ota = page.createProfile({ nickname: 'OTA', color: PROFILE_COLORS[2] });

    page.selectProfile(ema.id);
    const game = await openWithAlbum({
      storage: page.gameStorage(COLORING_GAME_ID),
      records: page.gameRecords(COLORING_GAME_ID),
    });
    paintLeft(game, ORANGE);
    await takePhoto(game);

    page.selectProfile(ota.id);
    const otaAlbum = await albumOf(page.gameRecords(COLORING_GAME_ID));
    expect(otaAlbum.status === 'read' ? otaAlbum.entries.length : -1, 'OTA').toBe(0);
    expect(enterPicker().tapBook(otaAlbum).kind, 'kniha OTY se jen zhoupne').toBe('wobble');

    page.selectProfile(ema.id);
    expect(await shownCount(page.gameRecords(COLORING_GAME_ID)), 'EMA').toBe(1);
  });
});

describe('#126 AC5: obnovení stránky', () => {
  for (const [name, makeDevice] of RECORDS_DEVICES) {
    it(`po uložení a obnovení stránky je obrázek v albu právě jednou (${name})`, async () => {
      const device = makeDevice();
      const storage = new RecordingStorage();
      const regions = twoHalves();
      const records = device.open().forGame('p-test', COLORING_GAME_ID);
      const game = await openWithAlbum({ storage, records, regions });
      paintLeft(game, ORANGE);
      const painted = pixelsOf(game, regions);
      await takePhoto(game);
      game.suspend();

      const reloadedRecords = device.open().forGame('p-test', COLORING_GAME_ID);
      const album = await albumOf(reloadedRecords);
      const entries = album.status === 'read' ? album.entries : [];
      expect(entries.length, 'právě jednou').toBe(1);
      expect(pixelsOf(entries[0]?.colors ?? game, regions)).toEqual(painted);
      const reopened = await openWithAlbum({ storage, records: reloadedRecords, regions });
      expect(paintedPixels(reopened, regions), 'omalovánka je po obnovení čistá').toBe(0);
    });
  }

  it('když se čistá omalovánka nezapíše, je čistá jen do zavření stránky a po obnovení se do alba podruhé neuloží', async () => {
    const storage = new DeviceStorage();
    const device = memoryDevice();
    const regions = twoHalves();
    const page = openProfiles(storage, device.open());
    const records = page.gameRecords(COLORING_GAME_ID);
    const game = await openWithAlbum({
      storage: page.gameStorage(COLORING_GAME_ID),
      records,
      regions,
    });
    paintLeft(game, ORANGE);
    const painted = pixelsOf(game, regions);
    storage.failWrite = () => true;

    expect((await takePhoto(game)).kind, 'do alba se uloží').toBe('saved');
    expect(paintedPixels(game, regions), 'v malování je čistá stránka').toBe(0);
    game.suspend();
    const sameVisit = await openWithAlbum({
      storage: page.gameStorage(COLORING_GAME_ID),
      records,
      regions,
    });
    expect(paintedPixels(sameVisit, regions), 'do zavření stránky čistá').toBe(0);

    const reloaded = openProfiles(storage, device.open());
    const reloadedRecords = watchRecords(reloaded.gameRecords(COLORING_GAME_ID));
    const afterReload = await openWithAlbum({
      storage: reloaded.gameStorage(COLORING_GAME_ID),
      records: reloadedRecords,
      regions,
    });
    expect(pixelsOf(afterReload, regions), 'po obnovení znovu vymalovaná').toEqual(painted);
    expect(afterReload.tapCamera(), 'podruhé se neuloží').toEqual({
      kind: 'wobble',
      tones: HOME_WOBBLE_TONES,
    });
    expect(reloadedRecords.adds()).toBe(0);
    expect(await shownCount(reloadedRecords), 'v albu je jednou').toBe(1);
  });
});
