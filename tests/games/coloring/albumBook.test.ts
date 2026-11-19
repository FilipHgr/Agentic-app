import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ALBUM_PICTURE_LIMIT,
  albumEmptyPlaces,
  albumPageCount,
} from '../../../src/games/coloring/logic/album';
import type {
  AlbumPointerResult,
  PictureChoice,
} from '../../../src/games/coloring/logic/pictureChoice';
import { HOME_WOBBLE_TONES } from '../../../src/shared/logic/homeButton';
import { ALBUM_PAGE_SIZE, albumDevice, fillAlbumQuickly } from './albumHelpers';
import { enterWithRecords, holdTrash, openAlbum, showBigPicture } from './bigPictureHelpers';
import type { BigPictureTest } from './bigPictureHelpers';
import {
  EMA,
  HOUSE,
  PAGE_COLOR,
  SwapDevice,
  albumOf,
  openGame,
  paintAndLeave,
} from './pageToAlbumHelpers';
import { pixelsOf } from './savedPictureHelpers';

/**
 * Testy k #158 AC2 (volná místa stránky jsou prázdná okénka), AC3 (ťuknutí
 * a tah na okénku) a AC4 (okénka po smazání, uložení a návratu z velkého
 * obrázku).
 *
 * Okénka jsou jen do konce stránky, která je vidět (rozhodnutá otázka
 * v #158), ne pro všech 60 míst. Které místo stránky je okénko, říká
 * `albumEmptyPlaces(počet obrázků, stránka)`; scéna okénko kreslí na místě
 * náhledu z rozložení (`layoutAlbum(...).previews[místo]`), je proto stejně
 * velké jako náhledy. Vzhled okénka (světlý okraj, bez stínu, bez obrázku)
 * je ruční kontrola.
 *
 * Dotyky v albu hlásí scéna jako v #149: ťuknutí na místo (`tapAlbumPreview`)
 * a stisk a zvednutí prstu s místem pod ním (`albumPointerDown`,
 * `albumPointerUp`). Místo okénka se hlásí stejně jako místo náhledu.
 *
 * Navržené rozhraní:
 * - `src/games/coloring/logic/album.ts`:
 *   `albumEmptyPlaces(pictureCount: number, page: number): readonly number[]`
 *   místa (0–11) okének na stránce `page` (0 je 1. stránka) alba
 *   s `pictureCount` obrázky, vzestupně; plná stránka `[]`,
 * - `src/games/coloring/logic/pictureChoice.ts`: `AlbumPreviewTap` má navíc
 *   `{ kind: 'wobble'; index: number; tones: readonly Tone[] }` (ťuknutí
 *   na okénko `index`, zhoupne se s `HOME_WOBBLE_TONES`) a
 *   `AlbumPointerResult` je
 *   `AlbumTurn | Extract<AlbumPreviewTap, { kind: 'open' | 'wobble' }>`.
 */

/** Kde prst začne v CSS px (na tom nezáleží, místo pod prstem hlásí scéna). */
const START = { x: 500, y: 400 } as const;

/** Tah dost dlouhý na nalistování (#149 AC1: aspoň 48 px). */
const LONG_SWIPE = 120;

afterEach(() => {
  vi.useRealTimers();
});

/** Místa od `from` do konce stránky (11). */
function placesFrom(from: number): number[] {
  return Array.from({ length: ALBUM_PAGE_SIZE - from }, (_, index) => from + index);
}

/** Okénka na stránce alba, která je vidět; `null`, když dítě není v albu. */
function shownEmptyPlaces(choice: PictureChoice): readonly number[] | null {
  const screen = choice.screen();
  return screen.kind === 'album' ? albumEmptyPlaces(screen.entries.length, screen.page) : null;
}

/** Stránka alba, která je vidět; `null`, když dítě není v albu. */
function shownPage(choice: PictureChoice): number | null {
  const screen = choice.screen();
  return screen.kind === 'album' ? screen.page : null;
}

/** Album s `count` obrázky, otevřené ťuknutím na knihu na výběru. */
async function openedAlbum(count: number): Promise<BigPictureTest> {
  const records = albumDevice().page();
  await fillAlbumQuickly(records, count);
  const test = enterWithRecords(records);
  await openAlbum(test);
  return test;
}

/** Dítě nalistuje šipkou ▶ a scéna novou stránku ukáže. */
function turnNext(choice: PictureChoice): void {
  expect(choice.tapAlbumArrow('next').kind, 'šipka ▶ nalistuje').toBe('turned');
  choice.albumPageShown();
}

/** Jeden prst se dotkne na místě `place` a zvedne o `dx` dál. */
function swipeFrom(choice: PictureChoice, place: number, dx: number): AlbumPointerResult {
  choice.albumPointerDown(1, START, place);
  return choice.albumPointerUp(1, { x: START.x + dx, y: START.y });
}

describe('#158 AC2: volná místa stránky jsou prázdná okénka', () => {
  it('na každé stránce alba s 1 až 60 obrázky jsou okénka právě na volných místech do konce stránky', () => {
    for (let count = 1; count <= ALBUM_PICTURE_LIMIT; count += 1) {
      for (let page = 0; page < albumPageCount(count); page += 1) {
        const onPage = Math.min(ALBUM_PAGE_SIZE, count - page * ALBUM_PAGE_SIZE);
        expect(albumEmptyPlaces(count, page), `${count} obrázků, ${page + 1}. stránka`).toEqual(
          placesFrom(onPage),
        );
      }
    }
  });

  it('album s jediným obrázkem má na stránce 11 okének za obrázkem', () => {
    expect(albumEmptyPlaces(1, 0)).toEqual(placesFrom(1));
  });

  it('plná stránka okénko nemá', () => {
    expect(albumEmptyPlaces(12, 0), '12 obrázků').toEqual([]);
    expect(albumEmptyPlaces(13, 0), '1. stránka ze 13 obrázků').toEqual([]);
    expect(albumEmptyPlaces(24, 1), '2. stránka z 24 obrázků').toEqual([]);
  });

  it('album se 60 obrázky nemá okénko na žádné stránce', () => {
    for (let page = 0; page < albumPageCount(ALBUM_PICTURE_LIMIT); page += 1) {
      expect(albumEmptyPlaces(ALBUM_PICTURE_LIMIT, page), `${page + 1}. stránka`).toEqual([]);
    }
  });

  it('okénka jsou jen do konce stránky, která je vidět, ne pro všech 60 míst', () => {
    expect(albumEmptyPlaces(13, 1), '2. stránka ze 13 obrázků').toEqual(placesFrom(1));
  });

  it('v otevřeném albu s 5 obrázky jsou okénka na místech 6 až 12 a obrázky na místech 1 až 5', async () => {
    vi.useFakeTimers();
    const test = await openedAlbum(5);

    expect(shownEmptyPlaces(test.choice)).toEqual(placesFrom(5));
    expect(test.choice.tapAlbumPreview(4).kind, 'místo 5 je obrázek').toBe('open');
  });
});

describe('#158 AC3: ťuknutí na okénko a tah z okénka', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('ťuknutí na okénko nic neotevře a okénko se zhoupne s tónem domečku', async () => {
    const test = await openedAlbum(5);

    for (const place of placesFrom(5)) {
      const tap = test.choice.tapAlbumPreview(place);
      expect(tap, `okénko na místě ${place + 1}`).toEqual({
        kind: 'wobble',
        index: place,
        tones: HOME_WOBBLE_TONES,
      });
      expect(test.choice.screen().kind, 'dítě zůstane v albu').toBe('album');
      expect(shownPage(test.choice), 'stránka se nezmění').toBe(0);
    }
  });

  it('ťuknutí prstem na okénko (stisk a zvednutí na místě) okénko zhoupne s tónem domečku', async () => {
    const test = await openedAlbum(5);

    const result = swipeFrom(test.choice, 7, 0);

    expect(result).toEqual({ kind: 'wobble', index: 7, tones: HOME_WOBBLE_TONES });
    expect(test.choice.screen().kind, 'velký obrázek se neotevře').toBe('album');
  });

  it('po zhoupnutí okénka otevře ťuknutí na obrázek velký obrázek', async () => {
    const test = await openedAlbum(5);
    test.choice.tapAlbumPreview(8);

    expect(test.choice.tapAlbumPreview(0).kind).toBe('open');
  });

  it('tah začatý na okénku nalistuje', async () => {
    const test = await openedAlbum(25);
    turnNext(test.choice);
    turnNext(test.choice);
    expect(shownEmptyPlaces(test.choice), 'na 3. stránce jsou okénka').toEqual(placesFrom(1));

    const result = swipeFrom(test.choice, 5, LONG_SWIPE);

    expect(result).toMatchObject({ kind: 'turned', page: 1, direction: 'previous' });
    test.choice.albumPageShown();
    expect(shownPage(test.choice), 'album je na 2. stránce').toBe(1);
  });

  it('tah z okénka na jediné stránce nic nenalistuje a zhoupnou se náhledy, ne okénko', async () => {
    const test = await openedAlbum(5);

    const result = swipeFrom(test.choice, 9, -LONG_SWIPE);

    expect(result).toMatchObject({ kind: 'edge', wobble: 'previews', tones: HOME_WOBBLE_TONES });
    expect(shownPage(test.choice)).toBe(0);
  });

  it('během listování ťuknutí na okénko nic neudělá', async () => {
    const test = await openedAlbum(25);
    turnNext(test.choice);
    expect(test.choice.tapAlbumArrow('next').kind, 'listuje se na 3. stránku').toBe('turned');

    expect(test.choice.tapAlbumPreview(5).kind).toBe('ignored');
  });
});

describe('#158 AC4: okénka po změnách v albu', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('po smazání obrázku košem je volné místo okénko', async () => {
    const test = await openedAlbum(5);
    showBigPicture(test, 0);

    expect((await holdTrash(test)).kind, 'koš obrázek smazal').toBe('deleted');

    expect(test.choice.screen().kind, 'dítě je zpátky v albu').toBe('album');
    expect(shownEmptyPlaces(test.choice), 'okénka od místa 5').toEqual(placesFrom(4));
    expect(test.choice.tapAlbumPreview(4)).toEqual({
      kind: 'wobble',
      index: 4,
      tones: HOME_WOBBLE_TONES,
    });
  });

  it('po smazání obrázku z plné stránky přibude na konci stránky jedno okénko', async () => {
    const test = await openedAlbum(12);
    expect(shownEmptyPlaces(test.choice), 'plná stránka').toEqual([]);
    showBigPicture(test, 3);

    expect((await holdTrash(test)).kind).toBe('deleted');

    expect(shownEmptyPlaces(test.choice)).toEqual([11]);
    expect(test.choice.tapAlbumPreview(11).kind, 'místo 12 je okénko').toBe('wobble');
  });

  it('po uložení je nový obrázek na prvním místě a okénko ubude', async () => {
    const device = new SwapDevice();
    await fillAlbumQuickly(device.records(EMA), 5);
    const page = await openGame(device);
    expect(page.choice.tapBook(await albumOf(page)).kind, 'kniha otevře album').toBe('open');
    expect(shownEmptyPlaces(page.choice), 'před malováním okénka od místa 6').toEqual(
      placesFrom(5),
    );
    expect(page.choice.holdHome(), 'domeček z alba vede na výběr').toBe('toPicker');

    const painted = await paintAndLeave(page, HOUSE, PAGE_COLOR);
    const tap = page.choice.tapBook(await albumOf(page));

    expect(tap.kind, 'kniha otevře album').toBe('open');
    const screen = page.choice.screen();
    const newest = screen.kind === 'album' ? screen.entries[0] : undefined;
    expect(newest && pixelsOf(newest.colors, page.regions), 'nový obrázek je první').toEqual(
      painted,
    );
    expect(shownEmptyPlaces(page.choice), 'okénka od místa 7').toEqual(placesFrom(6));
    expect(page.choice.tapAlbumPreview(5).kind, 'na místě 6 je obrázek').toBe('open');
  });

  it('po uložení do alba s 12 obrázky má 1. stránka dál bez okénka a na 2. stránce je 11 okének', async () => {
    const device = new SwapDevice();
    await fillAlbumQuickly(device.records(EMA), 12);
    const page = await openGame(device);

    await paintAndLeave(page, HOUSE, PAGE_COLOR);
    expect(page.choice.tapBook(await albumOf(page)).kind).toBe('open');

    expect(shownEmptyPlaces(page.choice), '1. stránka').toEqual([]);
    expect(page.choice.tapAlbumArrow('next').kind, 'album má 2 stránky').toBe('turned');
    page.choice.albumPageShown();
    expect(shownEmptyPlaces(page.choice), '2. stránka').toEqual(placesFrom(1));
  });

  it('po návratu z velkého obrázku je album na stejné stránce se stejnými okénky', async () => {
    const test = await openedAlbum(25);
    turnNext(test.choice);
    turnNext(test.choice);
    showBigPicture(test, 0);

    expect(test.choice.holdHome(), 'domeček vede do alba').toBe('toAlbum');

    expect(shownPage(test.choice), 'album je na 3. stránce').toBe(2);
    expect(shownEmptyPlaces(test.choice)).toEqual(placesFrom(1));
    expect(test.choice.tapAlbumPreview(1).kind, 'místo 2 je okénko').toBe('wobble');
  });
});
