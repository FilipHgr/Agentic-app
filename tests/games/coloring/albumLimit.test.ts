import { afterEach, describe, expect, it, vi } from 'vitest';

import { albumPageCount } from '../../../src/games/coloring/logic/album';
import {
  FULL_ALBUM_PICTURES,
  FULL_ALBUM_RECORDS,
  addUnreadable,
  albumDevice,
  albumOf,
  fillAlbumQuickly,
  openWithAlbum,
  paintLeft,
  recordCount,
  shownCount,
  watchRecords,
} from './albumHelpers';
import { enterWithRecords, holdTrash, openAlbum, showBigPicture } from './bigPictureHelpers';
import {
  EMA,
  HOUSE,
  PAGE_COLOR,
  SwapDevice,
  albumPixels,
  isClean,
  openGame,
  pageOf,
  paintAndLeave,
  recordsOf,
  unreadableRecordsOf,
} from './pageToAlbumHelpers';
import {
  LEGACY_ALBUM_PICTURE,
  legacyAlbumPixels,
  legacyAlbumRecord,
  legacyAlbumRegions,
} from './legacyAlbumRecordFixture';
import { pixelsOf } from './savedPictureHelpers';

/**
 * Testy k #149 AC2 (do alba se vejde 60 zobrazitelných obrázků a 120
 * záznamů včetně nečitelných) a AC3 (nic se neztratí). Limity 12 a 24
 * z #126 AC3 a #141 AC5 nahrazují upravené testy v `cameraSaving.test.ts`,
 * `album.test.ts`, `albumLegacyRecord.test.ts`, `albumDelete.test.ts`,
 * `pageToAlbum.test.ts`, `pageToAlbumFull.test.ts`,
 * `pageToAlbumOpening.test.ts`, `pageToAlbumTouch.test.ts`,
 * `continuePainting.test.ts` a `continuePaintingReload.test.ts` (u každé
 * úpravy je komentář #149). Tady jsou případy, které dřív nebyly.
 *
 * Album se plní rychle (`fillAlbumQuickly`), 60 obrázků přes fotoaparát by
 * bylo pomalé. Měření místa úložiště při 60 obrázcích je ruční kontrola
 * (AC7).
 */

const ORANGE = 1;

afterEach(() => {
  vi.useRealTimers();
});

describe('#149 AC2: do alba se vejde 60 obrázků a 120 záznamů', () => {
  it('s 60 nečitelnými záznamy album ukáže všech 60 obrázků a nečitelné nezobrazí', async () => {
    const records = albumDevice().page();
    await addUnreadable(records, FULL_ALBUM_RECORDS - FULL_ALBUM_PICTURES);
    await fillAlbumQuickly(records, FULL_ALBUM_PICTURES);

    expect(await shownCount(records), 'zobrazí se jen obrázky').toBe(FULL_ALBUM_PICTURES);
    expect(await recordCount(records), 'všechny záznamy jsou v úložišti').toBe(FULL_ALBUM_RECORDS);
  });

  it('60 obrázků je 5 stránek po 12', async () => {
    const records = albumDevice().page();
    await fillAlbumQuickly(records, FULL_ALBUM_PICTURES);
    const album = await albumOf(records);

    const count = album.status === 'read' ? album.entries.length : 0;
    expect(albumPageCount(count)).toBe(5);
  });

  it('plné album ani fotoaparát nečitelné záznamy nesmažou', async () => {
    const device = albumDevice();
    await addUnreadable(device.page(), FULL_ALBUM_RECORDS - FULL_ALBUM_PICTURES);
    await fillAlbumQuickly(device.page(), FULL_ALBUM_PICTURES);
    const before = device.shelf.records.map((record) => record.id);
    const records = watchRecords(device.page());

    const game = await openWithAlbum({ storage: undefined, records });
    paintLeft(game, ORANGE);
    expect(game.tapCamera().kind, 'album je plné').toBe('wobble');

    expect(records.removes(), 'hra nic nemazala').toBe(0);
    expect(device.shelf.records.map((record) => record.id)).toEqual(before);
  });

  it('s 59 obrázky rozmalovaná stránka po odchodu do alba přibude jako 60. obrázek', async () => {
    const device = new SwapDevice();
    await fillAlbumQuickly(device.records(EMA), FULL_ALBUM_PICTURES - 1);
    const page = await openGame(device);

    const painted = await paintAndLeave(page, HOUSE, PAGE_COLOR);

    const album = await albumPixels(device);
    expect(album.length, 'album má 60 obrázků').toBe(FULL_ALBUM_PICTURES);
    expect(album[0], 'obrázek ze stránky je nejnovější').toEqual(painted);
    expect(isClean(pageOf(device)), 'stránka je čistá').toBe(true);
  });

  it('se 119 záznamy (i nečitelnými) rozmalovaná stránka do alba přibude a nečitelné zůstanou', async () => {
    const device = new SwapDevice();
    await fillAlbumQuickly(device.records(EMA), 19);
    await addUnreadable(device.records(EMA), FULL_ALBUM_RECORDS - 20);
    const unreadableBefore = unreadableRecordsOf(device);
    const page = await openGame(device);

    const painted = await paintAndLeave(page, HOUSE, PAGE_COLOR);

    expect((await albumPixels(device))[0], 'obrázek ze stránky je v albu').toEqual(painted);
    expect(unreadableRecordsOf(device), 'nečitelné záznamy beze změny').toEqual(unreadableBefore);
  });

  it('se 120 záznamy (i nečitelnými) rozmalovaná stránka zůstane na stránce a album se nezmění', async () => {
    const device = new SwapDevice();
    await fillAlbumQuickly(device.records(EMA), 20);
    await addUnreadable(device.records(EMA), FULL_ALBUM_RECORDS - 20);
    const page = await openGame(device);
    const before = recordsOf(device);

    const painted = await paintAndLeave(page, HOUSE, PAGE_COLOR);

    expect(pageOf(device), 'obrázek zůstal na stránce').toEqual(painted);
    expect(recordsOf(device), 'album beze změny').toEqual(before);
  });
});

describe('#149 AC3: nic se neztratí', () => {
  it('po smazání obrázku košem z plného alba se při dalším otevření Omalovánek přesune čekající stránka', async () => {
    const device = new SwapDevice();
    await fillAlbumQuickly(device.records(EMA), FULL_ALBUM_PICTURES);
    const page = await openGame(device);
    const painted = await paintAndLeave(page, HOUSE, PAGE_COLOR);
    expect(pageOf(device), 'plné album: obrázek zůstal na stránce').toEqual(painted);

    vi.useFakeTimers();
    const trash = enterWithRecords(device.records(EMA));
    await openAlbum(trash);
    showBigPicture(trash, 0);
    expect((await holdTrash(trash)).kind, 'koš obrázek smazal').toBe('deleted');
    vi.useRealTimers();

    await openGame(device);

    const album = await albumPixels(device);
    expect(album.length, 'album je zase plné').toBe(FULL_ALBUM_PICTURES);
    expect(album[0], 'obrázek ze stránky je nejnovější').toEqual(painted);
    expect(isClean(pageOf(device)), 'stránka je čistá').toBe(true);
  });

  it('dnešní album se ukáže pixel po pixelu stejně: obrázek uložený před #149 je na 1. stránce beze změny', async () => {
    vi.useFakeTimers();
    const records = albumDevice().page();
    const added = await records.add(legacyAlbumRecord());
    expect(added.status, 'záznam je v úložišti').toBe('saved');
    const regions = legacyAlbumRegions();
    const album = await albumOf(records, undefined, regions);
    const test = enterWithRecords(records);

    const tap = test.choice.tapBook(album);
    expect(tap.kind, 'kniha album otevře').toBe('open');
    const screen = test.choice.screen();
    expect(screen.kind === 'album' ? screen.page : null, 'album je na 1. stránce').toBe(0);
    const preview = test.choice.tapAlbumPreview(0);

    expect(preview.kind, 'obrázek je na 1. místě').toBe('open');
    if (preview.kind !== 'open') {
      return;
    }
    expect(preview.entry.picture).toEqual(LEGACY_ALBUM_PICTURE);
    expect(pixelsOf(preview.entry.colors, regions), 'pixel po pixelu').toEqual(legacyAlbumPixels());
  });

  it('album s nejvýš 12 obrázky má jedinou stránku se všemi obrázky v dnešním pořadí', async () => {
    vi.useFakeTimers();
    const records = albumDevice().page();
    const saved = await fillAlbumQuickly(records, 12);
    const test = enterWithRecords(records);
    await openAlbum(test);

    expect(albumPageCount(12), 'jediná stránka').toBe(1);
    expect(test.choice.tapAlbumArrow('next').kind, 'šipky nejsou').toBe('ignored');
    const newest = test.choice.tapAlbumPreview(0);
    expect(newest.kind === 'open' ? newest.entry.recordId : null, 'nejnovější první').toBe(
      saved.at(-1),
    );
  });
});
