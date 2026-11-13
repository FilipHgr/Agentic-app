import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { openColoring } from '../../../src/games/coloring/logic/savedPicture';
import type { SavedColoring } from '../../../src/games/coloring/logic/savedPicture';
import { COLORING_META } from '../../../src/games/coloring/meta';
import { HOME_WOBBLE_TONES } from '../../../src/shared/logic/homeButton';
import { openProfiles } from '../../../src/shared/storage/profileStorage';
import { DeviceStorage } from '../../shared/profileFixtures';
import { paintLeft, takePhoto, watchRecords } from './albumHelpers';
import type { WatchedRecords } from './albumHelpers';
import {
  BROOM_FINGER,
  BROOM_HOLD_MS,
  broomWobbles,
  clearCount,
  createPainting,
  enterGame,
  holdBroom,
  isClean,
  openFromAlbum,
  openFromPicker,
  picturePixels,
  showPainting,
  startBroomPage,
} from './broomHelpers';
import type { BroomPage } from './broomHelpers';
import { HOUSE, SwapDevice, albumPixels, pageOf, timesIn } from './continuePaintingHelpers';
import type { Pixels } from './continuePaintingHelpers';
import { choose } from './drawingToolHelpers';
import {
  PAGE_COLOR,
  SECOND_COLOR,
  paintPageDirectly,
  paintRightDot,
  previewIndexOf,
  settleLong,
} from './pageToAlbumHelpers';
import { startStroke } from './savedPictureHelpers';
import { at } from './strokeHelpers';

/**
 * Testy k #142 AC3 (kdy se nic nestane), AC4 (dotyky) a AC5 (selhání).
 * Koště je podržení 1 s jako koš v #129; pomůcky a navržené rozhraní jsou
 * v `broomHelpers.ts`. Tah začatý na koštěti (AC4) hlídá
 * `broomLayoutRules.test.ts` přes `touchTargetAt`.
 *
 * „Nic neudělá“ v AC4 znamená jako u fotoaparátu v #126 AC3: koště stránku
 * nezruší a ani se nezhoupne.
 */

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

/** Druhý prst, který maluje po obrázku. */
const PAINTING_FINGER = 2;

/** Malování N s rozmalovanou levou polovinou nad novým zařízením. */
async function paintedPicker(): Promise<{
  device: SwapDevice;
  page: BroomPage;
  game: SavedColoring;
}> {
  const device = new SwapDevice();
  const page = await enterGame(device);
  const game = await openFromPicker(page);
  paintLeft(game, PAGE_COLOR);
  return { device, page, game };
}

/** Guma přejede celou levou polovinu zkušebního obrysu. */
function eraseLeft(game: SavedColoring): void {
  choose(game, 'eraser');
  for (let y = 0; y < 200; y += 2) {
    game.pointerDown({ id: 1, x: 0, y, kind: 'touch' });
    game.pointerMove({ id: 1, x: 149, y, kind: 'touch' });
    game.pointerUp(1);
  }
}

/** Koště nezrušilo stránku a malování i uložená stránka jsou stejné jako `before`. */
function expectNothingChanged(
  page: BroomPage,
  game: SavedColoring,
  device: SwapDevice,
  before: Pixels,
  what: string,
): void {
  expect(clearCount(page), `${what}: koště stránku nezrušilo`).toBe(0);
  expect(picturePixels(page, game), `${what}: malování`).toEqual(before);
  expect(pageOf(device), `${what}: uložená stránka`).toEqual(before);
}

describe('#142 AC3: ťuknutí nebo kratší podržení koště jen zhoupne', () => {
  it('ťuknutí na koště ho jen zhoupne s tónem domečku a nic nezmění', async () => {
    const { device, page, game } = await paintedPicker();
    const before = picturePixels(page, game);
    const stored = device.snapshot();

    holdBroom(page, 0);

    expect(broomWobbles(page)).toEqual([HOME_WOBBLE_TONES]);
    expectNothingChanged(page, game, device, before, 'ťuknutí');
    expect(device.snapshot(), 'nic se nezapsalo').toEqual(stored);
  });

  it('podržení kratší než 1 s koště jen zhoupne s tónem domečku a nic nezmění', async () => {
    for (const ms of [1, BROOM_HOLD_MS / 2, BROOM_HOLD_MS - 1]) {
      const { device, page, game } = await paintedPicker();
      const before = picturePixels(page, game);

      holdBroom(page, ms);

      expect(broomWobbles(page), `${ms} ms`).toEqual([HOME_WOBBLE_TONES]);
      expectNothingChanged(page, game, device, before, `${ms} ms`);
    }
  });

  it('prst, který z koštěte sjede, nic nezmění, ani když se pak vrátí a dlouho drží', async () => {
    const { device, page, game } = await paintedPicker();
    const before = picturePixels(page, game);

    page.choice.broomButton.press(BROOM_FINGER);
    vi.advanceTimersByTime(BROOM_HOLD_MS * 0.4);
    page.choice.broomButton.leave(BROOM_FINGER);
    vi.advanceTimersByTime(BROOM_HOLD_MS * 2);
    page.choice.broomButton.release(BROOM_FINGER);

    expectNothingChanged(page, game, device, before, 'sjetí prstu');
  });

  it('další podržení po sjetí prstu se počítá od nuly', async () => {
    const { device, page, game } = await paintedPicker();
    const before = picturePixels(page, game);

    page.choice.broomButton.press(BROOM_FINGER);
    vi.advanceTimersByTime(BROOM_HOLD_MS * 0.6);
    page.choice.broomButton.leave(BROOM_FINGER);
    holdBroom(page, BROOM_HOLD_MS * 0.6);

    expectNothingChanged(page, game, device, before, 'dvě kratší podržení');
    holdBroom(page);
    expect(clearCount(page), 'celé podržení od nuly zruší').toBe(1);
  });

  it('stránka pixel po pixelu stejná jako začátek: podržení koště jen zhoupne', async () => {
    const scenarios: ReadonlyArray<
      readonly [string, () => Promise<{ page: BroomPage; game: SavedColoring; device: SwapDevice }>]
    > = [
      [
        'nová stránka z výběru',
        async () => {
          const device = new SwapDevice();
          const page = await enterGame(device);
          return { device, page, game: await openFromPicker(page) };
        },
      ],
      [
        'stránka z výběru celá vygumovaná',
        async () => {
          const opened = await paintedPicker();
          eraseLeft(opened.game);
          return opened;
        },
      ],
      [
        'stránka z výběru vrácená Zpět',
        async () => {
          const opened = await paintedPicker();
          expect(opened.game.tapUndo().kind).toBe('undone');
          return opened;
        },
      ],
      [
        'po vyfocení',
        async () => {
          const opened = await paintedPicker();
          expect((await takePhoto(opened.game)).kind).toBe('saved');
          return opened;
        },
      ],
      [
        'obrázek z alba bez změny',
        async () => {
          const device = new SwapDevice();
          const { page, game } = await openFromAlbum(device);
          return { device, page, game };
        },
      ],
      [
        'obrázek z alba vrácený Zpět',
        async () => {
          const device = new SwapDevice();
          const { page, game } = await openFromAlbum(device);
          paintRightDot(game, PAGE_COLOR);
          expect(game.tapUndo().kind).toBe('undone');
          return { device, page, game };
        },
      ],
    ];
    for (const [what, open] of scenarios) {
      const { device, page, game } = await open();
      const before = picturePixels(page, game);
      const album = await albumPixels(device);

      holdBroom(page);
      await settleLong();

      expect(broomWobbles(page), `${what}: zhoupnutí s tónem domečku`).toEqual([HOME_WOBBLE_TONES]);
      expectNothingChanged(page, game, device, before, what);
      expect(await albumPixels(device), `${what}: album`).toEqual(album);
    }
  });
});

describe('#142 AC4: koště nic neudělá, když se děje něco jiného', () => {
  it('když jiný prst maluje, koště nic neudělá a tah se dokončí', async () => {
    const { device, page, game } = await paintedPicker();
    game.tapColor(SECOND_COLOR);
    startStroke(game, [at(200, 50), at(260, 50)], PAINTING_FINGER);
    const during = picturePixels(page, game);

    holdBroom(page);

    expect(clearCount(page), 'nezrušilo').toBe(0);
    expect(broomWobbles(page), 'ani se nezhouplo').toEqual([]);
    expect(picturePixels(page, game), 'malování během tahu').toEqual(during);
    game.pointerUp(PAINTING_FINGER);
    expect(game.colorAt(230, 50), 'tah druhého prstu zůstal').toBe(SECOND_COLOR);
    expect(pageOf(device), 'uložená stránka i s tahem').toEqual(picturePixels(page, game));
  });

  it('když jiný prst začne malovat během podržení, koště nic neudělá', async () => {
    const { page, game } = await paintedPicker();

    page.choice.broomButton.press(BROOM_FINGER);
    vi.advanceTimersByTime(BROOM_HOLD_MS / 2);
    game.tapColor(SECOND_COLOR);
    startStroke(game, [at(200, 50), at(260, 50)], PAINTING_FINGER);
    vi.advanceTimersByTime(BROOM_HOLD_MS);
    page.choice.broomButton.release(BROOM_FINGER);
    game.pointerUp(PAINTING_FINGER);

    expect(clearCount(page)).toBe(0);
    expect(game.colorAt(80, 40), 'levá polovina zůstala').toBe(PAGE_COLOR);
    expect(game.colorAt(230, 50), 'tah druhého prstu zůstal').toBe(SECOND_COLOR);
  });

  it('během ukládání fotoaparátem koště nic neudělá a obrázek se uloží do alba jednou', async () => {
    const device = new SwapDevice();
    let watched: WatchedRecords | undefined;
    const page = await enterGame(device, {
      records: (inner) => {
        watched = watchRecords(inner);
        return watched;
      },
    });
    const game = await openFromPicker(page);
    paintLeft(game, PAGE_COLOR);
    const photo = picturePixels(page, game);
    watched?.holdAdds();
    const tap = game.tapCamera();
    expect(tap.kind, 'fotoaparát začal ukládat').toBe('saving');

    holdBroom(page);

    expect(clearCount(page), 'nezrušilo').toBe(0);
    expect(broomWobbles(page), 'ani se nezhouplo').toEqual([]);
    await watched?.releaseAdds();
    const saved = tap.kind === 'saving' ? await tap.done : null;
    await settleLong();
    expect(saved?.kind, 'uloženo do alba').toBe('saved');
    expect(timesIn(await albumPixels(device), photo), 'obrázek v albu jednou').toBe(1);
    expect(isClean(picturePixels(page, game)), 'po uložení čistá stránka').toBe(true);
  });

  it('když se drží domeček, koště nic neudělá; po puštění domečku zase funguje', async () => {
    const { device, page, game } = await paintedPicker();
    const before = picturePixels(page, game);

    page.choice.homeHolding(true);
    holdBroom(page);
    expectNothingChanged(page, game, device, before, 'držený domeček');
    expect(broomWobbles(page), 'ani se nezhouplo').toEqual([]);

    page.choice.homeHolding(false);
    holdBroom(page);
    expect(clearCount(page), 'po puštění domečku').toBe(1);
  });

  it('když se drží koště, domeček nic neudělá a dítě zůstane v malování', async () => {
    const { page } = await paintedPicker();

    page.choice.broomButton.press(BROOM_FINGER);
    vi.advanceTimersByTime(BROOM_HOLD_MS / 2);

    expect(page.choice.holdHome()).toBe('ignored');
    expect(page.choice.screen().kind).toBe('painting');
    page.choice.broomButton.release(BROOM_FINGER);
  });

  it('když se drží koště, fotoaparát nic neudělá a do alba se nic neuloží', async () => {
    const { device, page, game } = await paintedPicker();
    const adds = device.adds;

    page.choice.broomButton.press(BROOM_FINGER);
    vi.advanceTimersByTime(BROOM_HOLD_MS / 2);

    expect(game.tapCamera().kind).toBe('ignored');
    page.choice.broomButton.release(BROOM_FINGER);
    await settleLong();
    expect(device.adds, 'nic se neukládalo').toBe(adds);
    expect(await albumPixels(device), 'album').toEqual([]);
  });

  it('podržení začaté dřív, než je malování vidět, se nepočítá', async () => {
    const device = new SwapDevice();
    paintPageDirectly(device, HOUSE, PAGE_COLOR);
    const page = await enterGame(device, { withoutAlbum: true });
    expect(page.choice.tapPreview(previewIndexOf(HOUSE)).kind).toBe('open');
    const game = await createPainting(page, 'picker');
    const before = picturePixels(page, game);

    page.choice.broomButton.press(BROOM_FINGER);
    vi.advanceTimersByTime(BROOM_HOLD_MS / 2);
    page.choice.paintingShown();
    vi.advanceTimersByTime(BROOM_HOLD_MS * 2);
    page.choice.broomButton.release(BROOM_FINGER);

    expectNothingChanged(page, game, device, before, 'podržení z doby otevírání');
    holdBroom(page);
    expect(clearCount(page), 'nové podržení na viditelném malování').toBe(1);
  });

  it('dva prsty na koštěti zruší stránku jen jednou', async () => {
    for (const from of ['výběr', 'album'] as const) {
      const device = new SwapDevice();
      const { page, game } =
        from === 'album'
          ? await openFromAlbum(device)
          : await (async () => {
              const entered = await enterGame(device);
              return { page: entered, game: await openFromPicker(entered) };
            })();
      paintRightDot(game, PAGE_COLOR);
      const writesBefore = device.writes;

      page.choice.broomButton.press(BROOM_FINGER);
      page.choice.broomButton.press(BROOM_FINGER + 1);
      vi.advanceTimersByTime(BROOM_HOLD_MS * 2);
      page.choice.broomButton.release(BROOM_FINGER + 1);
      page.choice.broomButton.release(BROOM_FINGER);
      await settleLong();

      expect(clearCount(page), from).toBe(1);
      expect(device.writes, `${from}: stránka se uložila`).toBeGreaterThan(writesBefore);
    }
  });
});

/** Zápis klíče Omalovánek selže (plné úložiště jako v #92 AC5), ostatní klíče projdou. */
function failColoringWrites(storage: DeviceStorage): void {
  storage.failWrite = (key) => key.includes(`.${COLORING_META.id}.`);
}

describe('#142 AC5: vymazanou stránku se nepodaří uložit', () => {
  it('zrušení platí do zavření stránky a výjimka se neukáže', async () => {
    const deviceStorage = new DeviceStorage();
    const store = openProfiles(deviceStorage);
    const page = startBroomPage(store.gameStorage(COLORING_META.id), undefined);
    expect(page.choice.tapPreview(previewIndexOf(HOUSE)).kind).toBe('open');
    const game = await createPainting(page, 'picker');
    showPainting(page);
    paintLeft(game, PAGE_COLOR);
    failColoringWrites(deviceStorage);

    expect(() => {
      holdBroom(page);
    }).not.toThrow();

    expect(clearCount(page)).toBe(1);
    expect(isClean(picturePixels(page, game)), 'malování').toBe(true);
    const reopened = openColoring({ regions: page.regions, picture: HOUSE, storage: page.storage });
    expect(isClean(picturePixels(page, reopened)), 'nové otevření před zavřením stránky').toBe(
      true,
    );
  });

  it('po obnovení stránky se ukáže stav před zrušením a ten se pak přesune do alba', async () => {
    const { device, page, game } = await paintedPicker();
    const beforeClear = picturePixels(page, game);
    device.fullAfterWrites(0);

    expect(() => {
      holdBroom(page);
    }).not.toThrow();
    expect(clearCount(page)).toBe(1);
    expect(isClean(picturePixels(page, game)), 'malování do zavření stránky').toBe(true);

    device.repair();
    device.nextLoad();
    expect(pageOf(device), 'po obnovení stav před zrušením').toEqual(beforeClear);
    await enterGame(device);
    expect(timesIn(await albumPixels(device), beforeClear), 'v albu jednou').toBe(1);
    expect(isClean(pageOf(device)), 'výběr je čistý').toBe(true);
  });
});
