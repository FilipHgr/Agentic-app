import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  loadPicturePreview,
  previewOfColors,
} from '../../../src/games/coloring/logic/picturePreview';
import type { PicturePreview } from '../../../src/games/coloring/logic/picturePreview';
import { PREVIEW_TAP_TONES } from '../../../src/games/coloring/logic/pictureChoice';
import { openColoring } from '../../../src/games/coloring/logic/savedPicture';
import type { SavedColoring } from '../../../src/games/coloring/logic/savedPicture';
import { HOME_WOBBLE_TONES, HOLD_TO_GO_HOME_MS } from '../../../src/shared/logic/homeButton';
import { paintLeft, takePhoto, openWithAlbum } from './albumHelpers';
import {
  CIRCLES,
  EMA,
  HOUSE,
  P_COLOR,
  TOM,
  albumAfter,
  albumOn,
  albumPixels,
  choiceOn,
  pageOf,
  prepareSwap,
  reloadAndOpen,
  sameAlbum,
  showPainting,
  tapContinue,
  timesIn,
} from './continuePaintingHelpers';
import type { PreparedSwap } from './continuePaintingHelpers';
import { choose } from './drawingToolHelpers';
import { pixelsOf, twoHalves } from './savedPictureHelpers';
import { at } from './strokeHelpers';

/**
 * Testy k #131 AC1 (otevření), AC2 (výměna) a AC6 (dotyky): dítě na velkém
 * obrázku z alba ťukne na štětec a maluje obrázek dál. Označení podle
 * issue: P je rozmalovaná stránka té omalovánky před ťuknutím, A obrázek
 * z alba. Selhání úložiště (AC3, AC4) testuje
 * `continuePaintingFailures.test.ts`, obnovení stránky (AC5)
 * `continuePaintingReload.test.ts`, rozložení (AC7)
 * `continueButtonLayoutRules.test.ts`.
 *
 * Štětec je na velkém obrázku `PictureChoice.tapContinue()`:
 * - `{ kind: 'swapping', tones, done }` hned tón náhledu a zhoupnutí,
 *   výměna běží; `done` skončí `{ kind: 'opened', picture }` (výběr
 *   otevírá malování té omalovánky, scéna pak hlásí `paintingShown`), nebo
 *   `{ kind: 'failed', tones }` (dítě zůstane na velkém obrázku, štětec se
 *   zhoupne s tónem domečku),
 * - `{ kind: 'wobble', tones }` výměna nezačne, zhoupnutí s tónem domečku,
 * - `{ kind: 'ignored' }` ťuknutí se nepočítá.
 *
 * Podle doporučení u otevřených otázek: obrázek z alba se na stránku
 * přesune (album neroste), limity 12 a 24 se nemění, P přijde do alba jako
 * nejnovější, štětec reaguje ťuknutím.
 */

afterEach(() => {
  vi.useRealTimers();
});

/** Limity alba ze zadání #126 (otázka 2 k #131: beze změny). */
const ALBUM_PICTURES = 12;
const ALBUM_RECORDS = 24;

const RED = 0;
const BLUE = 4;
const GREEN = 3;

/** Dítě ťukne na štětec, výměna doběhne a malování se ukáže. Selže, když se neotevřelo. */
async function continueToPainting(prepared: PreparedSwap): Promise<SavedColoring> {
  const outcome = await tapContinue(prepared.page);
  expect(outcome, 'štětec otevře malování domku').toEqual({ kind: 'opened', picture: HOUSE });
  return showPainting(prepared.page, HOUSE);
}

function previewPixels(preview: PicturePreview): string[] {
  const cells: string[] = [];
  for (let y = 0; y < preview.height; y += 1) {
    for (let x = 0; x < preview.width; x += 1) {
      cells.push(JSON.stringify(preview.cellAt(x, y)));
    }
  }
  return cells;
}

describe('#131 AC1: ťuknutí na štětec otevře malování obrázku z alba', () => {
  it('ťuknutí na štětec hned zahraje tón náhledu a otevře malování omalovánky, ke které obrázek patří', async () => {
    const prepared = await prepareSwap();

    const tap = prepared.page.choice.tapContinue();

    expect(tap.kind, 'štětec se hned zhoupne a výměna běží').toBe('swapping');
    expect(tap.kind === 'swapping' ? tap.tones : [], 'tón náhledu').toEqual(PREVIEW_TAP_TONES);
    const result = tap.kind === 'swapping' ? await tap.done : null;
    expect(result, 'otevře se domek').toEqual({ kind: 'opened', picture: HOUSE });
    expect(prepared.page.choice.screen(), 'malování domku se otevírá').toEqual({
      kind: 'opening',
      picture: HOUSE,
    });
    prepared.page.choice.paintingShown();
    expect(prepared.page.choice.screen()).toEqual({ kind: 'painting', picture: HOUSE });
  });

  it('obrázek v malování je pixel po pixelu stejný jako velký obrázek', async () => {
    const prepared = await prepareSwap({ aIndex: 2 });

    const game = await continueToPainting(prepared);

    expect(pixelsOf(game, prepared.page.regions)).toEqual(prepared.a);
  });

  it('po obnovení stránky je v malování dál stejný obrázek jako na velkém obrázku', async () => {
    const prepared = await prepareSwap();
    await continueToPainting(prepared);

    const { page } = await reloadAndOpen(prepared.device);
    const game = openColoring({ regions: page.regions, picture: HOUSE, storage: page.storage });

    expect(pixelsOf(game, page.regions)).toEqual(prepared.a);
  });

  it('barvy nástrojů, nedávné barvy a tloušťka čáry zůstanou a nástroj je štětec', async () => {
    const prepared = await prepareSwap();
    const before = openColoring({
      regions: prepared.page.regions,
      picture: HOUSE,
      storage: prepared.page.storage,
    });
    before.tapColor(GREEN);
    choose(before, 'marker');
    before.tapColor(BLUE);
    before.tapColor(RED);
    before.tapLineSize('large');
    choose(before, 'eraser');
    before.suspend();
    const tools = ['brush', 'marker', 'crayon', 'glitter'] as const;
    const toolColors = tools.map((tool) => before.toolColor(tool));
    const recent = before.recentColors();

    const game = await continueToPainting(prepared);

    expect(
      tools.map((tool) => game.toolColor(tool)),
      'barvy nástrojů',
    ).toEqual(toolColors);
    expect(game.recentColors(), 'nedávné barvy').toEqual(recent);
    expect(game.lineSize(), 'tloušťka čáry').toBe('large');
    expect(game.selectedTool(), 'nástroj je štětec jako při každém otevření').toBe('brush');
  });

  it('Zpět po otevření nemá co vracet: zhoupne se s tónem domečku a obrázek zůstane', async () => {
    const prepared = await prepareSwap();
    const game = await continueToPainting(prepared);

    const undo = game.tapUndo();

    expect(undo).toEqual({ kind: 'wobble', tones: HOME_WOBBLE_TONES });
    expect(pixelsOf(game, prepared.page.regions)).toEqual(prepared.a);
  });

  it('podržení domečku 1 s vrátí dítě na výběr a náhled domku pak ukazuje obrázek z alba', async () => {
    const prepared = await prepareSwap();
    const game = await continueToPainting(prepared);

    vi.advanceTimersByTime(HOLD_TO_GO_HOME_MS);
    expect(prepared.page.choice.holdHome(), 'domeček vede na výběr').toBe('toPicker');
    game.suspend();

    const size = { width: 40, height: 30 };
    const shown = loadPicturePreview({
      storage: prepared.page.storage,
      picture: HOUSE,
      regions: prepared.page.regions,
      ...size,
    });
    const expected = previewOfColors({
      colors: prepared.entry.colors,
      regions: prepared.page.regions,
      ...size,
    });
    expect(previewPixels(shown)).toEqual(previewPixels(expected));
  });
});

describe('#131 AC2: výměna stránky a obrázku z alba', () => {
  it('rozmalovaná stránka přibude do alba jako nejnovější, obrázek z alba zmizí a obrázků je stejně', async () => {
    const prepared = await prepareSwap({ albumCount: 3, aIndex: 1 });

    await continueToPainting(prepared);

    const album = await albumPixels(prepared.device);
    expect(album.length, 'počet obrázků v albu').toBe(prepared.albumBefore.length);
    expect(album[0], 'stránka P je v albu jako nejnovější').toEqual(prepared.p);
    expect(timesIn(album, prepared.a), 'obrázek A z alba zmizel').toBe(0);
    expect(sameAlbum(album, albumAfter(prepared, true)), 'ostatní obrázky v původním pořadí').toBe(
      true,
    );
  });

  it('čistá stránka do alba nepřibude, obrázek z alba zmizí a album má o 1 obrázek méně', async () => {
    const prepared = await prepareSwap({ page: 'clean' });

    await continueToPainting(prepared);

    const album = await albumPixels(prepared.device);
    expect(album.length).toBe(prepared.albumBefore.length - 1);
    expect(sameAlbum(album, albumAfter(prepared, false)), 'jen bez A, nic nepřibylo').toBe(true);
  });

  it('úplně vygumovaná stránka je čistá: do alba nic nepřibude a album má o 1 obrázek méně', async () => {
    const prepared = await prepareSwap({ page: 'erased' });
    expect(
      prepared.p.every((pixel) => pixel === null),
      'stránka je po vygumování bez barvy',
    ).toBe(true);

    await continueToPainting(prepared);

    const album = await albumPixels(prepared.device);
    expect(album.length).toBe(prepared.albumBefore.length - 1);
    expect(sameAlbum(album, albumAfter(prepared, false))).toBe(true);
  });

  it('stránka stejná jako jiný obrázek domku v albu do alba nepřibude a ten obrázek tam zůstane jednou', async () => {
    const prepared = await prepareSwap({ albumCount: 3, aIndex: 1, page: { sameAsAlbumIndex: 2 } });
    expect(timesIn(prepared.albumBefore, prepared.p), 'P je v albu jednou už před výměnou').toBe(1);

    await continueToPainting(prepared);

    const album = await albumPixels(prepared.device);
    expect(album.length, 'album má o 1 obrázek méně').toBe(prepared.albumBefore.length - 1);
    expect(timesIn(album, prepared.p), 'stejný obrázek je v albu jednou').toBe(1);
    expect(timesIn(album, prepared.a), 'A z alba zmizel').toBe(0);
  });

  it('stránka stejná jako obrázek z alba sám do alba nepřibude, obrázek je jen na stránce a album má o 1 méně', async () => {
    const prepared = await prepareSwap({ albumCount: 3, aIndex: 0, page: { sameAsAlbumIndex: 0 } });
    expect(prepared.p, 'P je stejná jako A').toEqual(prepared.a);

    const game = await continueToPainting(prepared);

    const album = await albumPixels(prepared.device);
    expect(album.length).toBe(prepared.albumBefore.length - 1);
    expect(timesIn(album, prepared.a), 'v albu není dvakrát ani jednou navíc').toBe(0);
    expect(pixelsOf(game, prepared.page.regions), 'obrázek je na stránce').toEqual(prepared.a);
  });

  it('plné album s 12 obrázky výměnu nezablokuje a 12 obrázků nepřekročí ani na okamžik', async () => {
    const prepared = await prepareSwap({ albumCount: ALBUM_PICTURES, aIndex: 5 });

    await continueToPainting(prepared);

    const album = await albumPixels(prepared.device);
    expect(album.length, 'album je dál plné').toBe(ALBUM_PICTURES);
    expect(album[0], 'P je v albu jako nejnovější').toEqual(prepared.p);
    expect(
      prepared.device.maxRecords.get(EMA),
      'záznamů v albu nebylo nikdy víc než 12',
    ).toBeLessThanOrEqual(ALBUM_PICTURES);
  });

  it('album s 24 záznamy (i nečitelnými) výměnu nezablokuje a 24 záznamů nepřekročí ani na okamžik', async () => {
    const pictures = 12;
    const prepared = await prepareSwap({
      albumCount: pictures,
      unreadable: ALBUM_RECORDS - pictures,
      aIndex: 0,
    });

    await continueToPainting(prepared);

    const album = await albumPixels(prepared.device);
    expect(album[0], 'P je v albu jako nejnovější').toEqual(prepared.p);
    expect(album.length).toBe(pictures);
    expect(
      prepared.device.maxRecords.get(EMA),
      'záznamů nebylo nikdy víc než 24',
    ).toBeLessThanOrEqual(ALBUM_RECORDS);
  });

  it('ostatní obrázky alba, jejich pořadí, nečitelné záznamy a stránka jiné omalovánky zůstanou', async () => {
    const prepared = await prepareSwap({
      albumCount: 4,
      aIndex: 2,
      unreadable: 2,
      otherPage: true,
    });
    const unreadableBefore = structuredClone(
      prepared.device.shelf.records.filter((record) => !('layerCode' in record.data)),
    );

    await continueToPainting(prepared);

    expect(sameAlbum(await albumPixels(prepared.device), albumAfter(prepared, true))).toBe(true);
    expect(
      prepared.device.shelf.records.filter((record) => !('layerCode' in record.data)),
      'nečitelné záznamy beze změny',
    ).toEqual(unreadableBefore);
    expect(pageOf(prepared.device, CIRCLES), 'stránka kruhů beze změny').toEqual(
      prepared.otherPageBefore,
    );
    expect(
      prepared.otherPageBefore.some((pixel) => pixel !== null),
      'stránka kruhů je rozmalovaná',
    ).toBe(true);
  });

  it('výměna v jednom profilu nezmění album ani stránky jiného profilu', async () => {
    const prepared = await prepareSwap({ profile: EMA });
    vi.useRealTimers();
    const tomRecords = prepared.device.records(TOM);
    const tomGame = await openWithAlbum({
      storage: prepared.device.storage(TOM),
      records: tomRecords,
      picture: HOUSE,
    });
    paintLeft(tomGame, P_COLOR + 1);
    await takePhoto(tomGame);
    paintLeft(tomGame, P_COLOR + 2);
    tomGame.suspend();
    vi.useFakeTimers();
    const tomBefore = prepared.device.profileSnapshot(TOM);

    const outcome = await tapContinue(prepared.page);

    expect(outcome.kind, 'Emě se malování otevřelo').toBe('opened');
    expect(prepared.device.profileSnapshot(TOM), 'Tomovo album i stránky beze změny').toEqual(
      tomBefore,
    );
  });
});

describe('#131 AC2: odložená stránka se do plného alba počítá', () => {
  it('když P zůstane odložená mimo album, fotoaparát ji započítá do 12 obrázků a pro P zůstane místo', async () => {
    const prepared = await prepareSwap({ albumCount: ALBUM_PICTURES, aIndex: 3 });
    // Uložení P do alba i vrácení A selže: dítě maluje A, P je odložená (AC4).
    prepared.device.addFailure = 'full';
    const outcome = await tapContinue(prepared.page);
    expect(outcome.kind, 'dítě je v malování s A').toBe('opened');
    expect((await albumPixels(prepared.device)).length, 'v albu je 11 obrázků').toBe(
      ALBUM_PICTURES - 1,
    );
    prepared.device.addFailure = null;

    const contents = await albumOn(prepared.page);
    const circles = openColoring({
      regions: prepared.page.regions,
      picture: CIRCLES,
      storage: prepared.page.storage,
      album: { records: prepared.page.records, contents },
    });
    paintLeft(circles, P_COLOR + 3);
    const camera = circles.tapCamera();

    expect(camera, 'fotoaparát se jen zhoupne, album je s odloženou P plné').toEqual({
      kind: 'wobble',
      tones: HOME_WOBBLE_TONES,
    });
    await reloadAndOpen(prepared.device);
    const album = await albumPixels(prepared.device);
    expect(album.length, 'P se do alba vešla').toBe(ALBUM_PICTURES);
    expect(timesIn(album, prepared.p), 'P je v albu').toBe(1);
  });
});

describe('#131 AC6: dotyky na štětci', () => {
  it('rychlé dvojí ťuknutí nebo druhý prst na štětci provede výměnu jen jednou', async () => {
    const prepared = await prepareSwap();
    const removesBefore = prepared.device.removes;

    const first = prepared.page.choice.tapContinue();
    const second = prepared.page.choice.tapContinue();

    expect(first.kind).toBe('swapping');
    expect(second, 'druhé ťuknutí se nepočítá').toEqual({ kind: 'ignored' });
    if (first.kind === 'swapping') {
      await first.done;
    }
    expect(prepared.page.choice.tapContinue(), 'po otevření malování štětec nic').toEqual({
      kind: 'ignored',
    });
    expect(prepared.device.removes - removesBefore, 'A se z alba mazal jednou').toBe(1);
    const album = await albumPixels(prepared.device);
    expect(timesIn(album, prepared.p), 'P je v albu jednou').toBe(1);
    expect(album.length).toBe(prepared.albumBefore.length);
  });

  it('když se drží koš, štětec nic neudělá', async () => {
    const prepared = await prepareSwap();
    const before = prepared.device.snapshot();
    prepared.page.choice.trashButton.press(1);

    const tap = prepared.page.choice.tapContinue();

    expect(tap).toEqual({ kind: 'ignored' });
    expect(prepared.device.snapshot(), 'nic se nezměnilo').toEqual(before);
    expect(prepared.page.choice.screen().kind).toBe('bigPicture');
    prepared.page.choice.trashButton.cancel(1);
  });

  it('během výměny nic neudělá štětec, koš ani domeček', async () => {
    const prepared = await prepareSwap();
    prepared.device.holdRemoves();
    const tap = prepared.page.choice.tapContinue();
    expect(tap.kind).toBe('swapping');
    const feedbackFrom = prepared.page.trashFeedback.length;

    expect(prepared.page.choice.tapContinue(), 'štětec').toEqual({ kind: 'ignored' });
    prepared.page.choice.trashButton.press(2);
    vi.advanceTimersByTime(2 * HOLD_TO_GO_HOME_MS);
    prepared.page.choice.trashButton.release(2);
    expect(
      prepared.page.trashFeedback.slice(feedbackFrom).filter((event) => event.kind === 'deleting'),
      'koš nic nesmaže',
    ).toEqual([]);
    expect(prepared.page.choice.holdHome(), 'domeček').toBe('ignored');

    await prepared.device.releaseRemoves();
    const result = tap.kind === 'swapping' ? await tap.done : null;
    expect(result, 'výměna doběhne a otevře malování').toEqual({ kind: 'opened', picture: HOUSE });
    const album = await albumPixels(prepared.device);
    expect(album.length, 'koš nic navíc nesmazal').toBe(prepared.albumBefore.length);
    expect(prepared.device.removes, 'mazalo se jen A').toBeGreaterThan(0);
  });

  it('ťuknutí na štětec během otevírání velkého obrázku se nepočítá', async () => {
    const prepared = await prepareSwap();
    vi.advanceTimersByTime(HOLD_TO_GO_HOME_MS);
    expect(prepared.page.choice.holdHome(), 'zpátky do alba').toBe('toAlbum');
    expect(prepared.page.choice.tapAlbumPreview(0).kind).toBe('open');
    const before = prepared.device.snapshot();

    const tap = prepared.page.choice.tapContinue();

    expect(tap).toEqual({ kind: 'ignored' });
    expect(prepared.page.choice.screen().kind, 'velký obrázek se dál otevírá').toBe(
      'openingBigPicture',
    );
    expect(prepared.device.snapshot(), 'nic se nezměnilo').toEqual(before);
  });

  it('mimo velký obrázek štětec nic neudělá', async () => {
    const device = (await prepareSwap()).device;
    const page = choiceOn(device);
    const before = device.snapshot();

    expect(page.choice.tapContinue(), 'na výběru').toEqual({ kind: 'ignored' });
    expect(page.choice.screen().kind).toBe('picker');
    expect(device.snapshot()).toEqual(before);
  });

  it('prst, který ťukl na štětec a v malování dál drží a pohybuje se, nic nenamaluje ani nevybere', async () => {
    const prepared = await prepareSwap();
    const game = await continueToPainting(prepared);
    const palette = game.palette();
    const recent = game.recentColors();

    for (const point of [at(40, 60), at(80, 80), at(240, 100), at(-20, 40)]) {
      expect(
        game.pointerMove({ id: 1, x: point.x, y: point.y, kind: 'touch' }),
        `pohyb na ${point.x}, ${point.y}`,
      ).toBeNull();
    }
    game.pointerUp(1);

    expect(pixelsOf(game, twoHalves()), 'obrázek beze změny').toEqual(prepared.a);
    expect(game.palette(), 'barva beze změny').toEqual(palette);
    expect(game.recentColors(), 'nedávné barvy beze změny').toEqual(recent);
    expect(game.panelView(), 'panel zůstal zavřený').toBe('closed');
  });
});
