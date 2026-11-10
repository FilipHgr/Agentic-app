import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { removeAlbumEntry } from '../../../src/games/coloring/logic/album';
import {
  PREVIEW_TAP_TONES,
  homeHoldDecision,
} from '../../../src/games/coloring/logic/pictureChoice';
import type { HomeHold, PictureChoice } from '../../../src/games/coloring/logic/pictureChoice';
import { createHoldButton } from '../../../src/shared/logic/holdButton';
import { HOLD_TO_GO_HOME_MS } from '../../../src/shared/logic/homeButton';
import {
  createMemoryRecordsShelf,
  memoryProfileRecords,
} from '../../../src/shared/storage/profileRecords';
import { startGameSession } from '../../../src/shared/ui/gameSession';
import {
  COLORING_GAME_ID,
  HOUSE,
  albumDevice,
  albumOf,
  fillAlbum,
  openWithAlbum,
  paintLeft,
  takePhoto,
} from './albumHelpers';
import {
  TRASH_HOLD_MS,
  enterWithRecords,
  feedbackAfter,
  holdTrash,
  openAlbum,
  showBigPicture,
  shownIds,
} from './bigPictureHelpers';
import type { BigPictureTest } from './bigPictureHelpers';
import { pixelsOf, twoHalves } from './savedPictureHelpers';

/**
 * Testy k #129 AC1 (velký obrázek), AC2 (domeček) a AC5 (dotyky) na
 * výběru omalovánky (`PictureChoice`). Smazání podržením koše a selhání
 * úložiště testuje `albumDelete.test.ts`, rozložení
 * `bigPictureLayoutRules.test.ts`.
 *
 * Velký obrázek má obrazovku `{ kind: 'bigPicture', entries, entry }`,
 * otevírání (od ťuknutí na náhled po hlášení scény `bigPictureShown`)
 * `{ kind: 'openingBigPicture', entries, entry }`. Domeček z velkého
 * obrázku vede do alba (`'toAlbum'`, stránka zůstane ve hře).
 *
 * Že na obrazovce velkého obrázku není žádný text ani jiný prvek než
 * velký obrázek, koš a domeček, kreslí scéna: rozložení velkého obrázku
 * má jen obrázek a koš (`bigPictureLayoutRules.test.ts`), zbytek je ruční
 * kontrola. Texty natvrdo v kódu hlídá `tests/shared/hardcodedTexts.test.ts`.
 */

const ORANGE = 1;
const BLUE = 4;
const GREEN = 7;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

/**
 * Připraví zařízení s albem domku o `count` obrázcích (nejnovější má barvu
 * `count − 1`). Album se plní se skutečnými časovači jako v testech #126.
 */
async function deviceWithAlbum(count: number) {
  vi.useRealTimers();
  const device = albumDevice();
  const records = device.page();
  await fillAlbum(records, count, HOUSE);
  vi.useFakeTimers();
  return { device, records };
}

async function albumTest(count: number): Promise<BigPictureTest> {
  const { records } = await deviceWithAlbum(count);
  const test = enterWithRecords(records);
  await openAlbum(test);
  return test;
}

function screenKind(choice: PictureChoice): string {
  return choice.screen().kind;
}

/** Označení obrázků na obrazovce alba; mimo album `null`. */
function albumIds(choice: PictureChoice): string[] | null {
  const screen = choice.screen();
  return screen.kind === 'album' ? screen.entries.map((entry) => entry.recordId) : null;
}

function shownRecordId(choice: PictureChoice): string | undefined {
  const screen = choice.screen();
  return screen.kind === 'bigPicture' || screen.kind === 'openingBigPicture'
    ? screen.entry.recordId
    : undefined;
}

describe('#129 AC1: ťuknutí na náhled v albu ukáže velký obrázek', () => {
  it('ťuknutí na náhled v albu ho zhoupne se stejným tónem jako náhled na výběru a otevře velký obrázek', async () => {
    const test = await albumTest(2);

    const tap = test.choice.tapAlbumPreview(0);

    expect(tap.kind).toBe('open');
    expect(tap.kind === 'open' ? tap.tones : [], 'tón jako náhled na výběru').toEqual(
      PREVIEW_TAP_TONES,
    );
    expect(screenKind(test.choice), 'velký obrázek se otevírá').toBe('openingBigPicture');
    test.choice.bigPictureShown();
    expect(screenKind(test.choice), 'velký obrázek je vidět').toBe('bigPicture');
  });

  it('velký obrázek je ten náhled, na který dítě ťuklo', async () => {
    const test = await albumTest(3);
    const ids = await shownIds(test.records);

    for (const index of [0, 1, 2]) {
      const choice = enterWithRecords(test.records);
      await openAlbum(choice);
      showBigPicture(choice, index);
      expect(shownRecordId(choice.choice), `náhled ${index + 1}`).toBe(ids[index]);
    }
  });

  it('velký obrázek je pixel po pixelu stejný jako obrázek v malování před vyfocením', async () => {
    vi.useRealTimers();
    const regions = twoHalves();
    const records = albumDevice().page();
    const painted: Array<Array<number | null>> = [];
    for (const color of [ORANGE, BLUE, GREEN]) {
      const game = await openWithAlbum({ storage: undefined, records, regions });
      paintLeft(game, color);
      painted.push(pixelsOf(game, regions));
      await takePhoto(game);
    }
    vi.useFakeTimers();
    // Album je od nejnovějšího: náhled 1 je poslední vyfocený obrázek.
    const newestFirst = [...painted].reverse();

    for (const [index, expected] of newestFirst.entries()) {
      const test = enterWithRecords(records);
      await openAlbum(test);
      showBigPicture(test, index);
      const screen = test.choice.screen();
      const shown = screen.kind === 'bigPicture' ? pixelsOf(screen.entry.colors, regions) : [];
      expect(shown, `náhled ${index + 1}`).toEqual(expected);
    }
  });

  it('ťuknutí na místo alba bez obrázku nic neotevře', async () => {
    const test = await albumTest(2);

    for (const index of [2, 11, -1, 1.5]) {
      expect(test.choice.tapAlbumPreview(index), `místo ${index}`).toEqual({ kind: 'ignored' });
    }
    expect(screenKind(test.choice)).toBe('album');
  });

  it('ťuknutí na náhled alba mimo album nic neotevře', async () => {
    const { records } = await deviceWithAlbum(1);
    const test = enterWithRecords(records);

    expect(test.choice.tapAlbumPreview(0), 'na výběru').toEqual({ kind: 'ignored' });
    expect(screenKind(test.choice)).toBe('picker');
  });
});

describe('#129 AC1: každý profil vidí a maže jen obrázky ze svého alba', () => {
  /** Dva profily na jednom zařízení: Ema má 2 obrázky, Tom 1. */
  async function twoProfiles() {
    vi.useRealTimers();
    const shelf = createMemoryRecordsShelf();
    const page = memoryProfileRecords(shelf);
    const ema = page.forGame('p-ema', COLORING_GAME_ID);
    const tom = page.forGame('p-tom', COLORING_GAME_ID);
    await fillAlbum(ema, 2, HOUSE);
    await fillAlbum(tom, 1, HOUSE);
    vi.useFakeTimers();
    return { ema, tom };
  }

  it('velký obrázek v albu profilu ukáže jen obrázky toho profilu', async () => {
    const { ema, tom } = await twoProfiles();
    const tomIds = await shownIds(tom);

    const test = enterWithRecords(ema);
    await openAlbum(test);
    for (const index of [0, 1]) {
      showBigPictureAgain(test, index);
      expect(tomIds, `náhled ${index + 1} je Emin`).not.toContain(shownRecordId(test.choice));
    }
    test.choice.holdHome();
    expect(screenKind(test.choice), 'zpět v Emině albu').toBe('album');
    expect(test.choice.tapAlbumPreview(2), 'Tomův obrázek v Emině albu není').toEqual({
      kind: 'ignored',
    });
  });

  it('smazání obrázku v jednom profilu album druhého profilu nezmění', async () => {
    const { ema, tom } = await twoProfiles();
    const tomBefore = await shownIds(tom);
    const test = enterWithRecords(ema);
    await openAlbum(test);
    showBigPicture(test, 0);

    expect((await holdTrash(test)).kind).toBe('deleted');

    expect((await shownIds(ema)).length, 'Emě zbyl 1 obrázek').toBe(1);
    expect(await shownIds(tom), 'Tomovo album beze změny').toEqual(tomBefore);
  });

  it('obrázek jiného profilu nejde smazat záznamy svého profilu', async () => {
    const { ema, tom } = await twoProfiles();
    const [tomPicture] = await shownIds(tom);

    await removeAlbumEntry(ema, tomPicture ?? '');

    expect(await shownIds(tom), 'Tomův obrázek zůstal').toEqual([tomPicture]);
    expect((await shownIds(ema)).length, 'Emino album beze změny').toBe(2);
  });
});

/** Z velkého obrázku zpět do alba domečkem a otevření dalšího náhledu. */
function showBigPictureAgain(test: BigPictureTest, index: number): void {
  if (test.choice.screen().kind === 'bigPicture') {
    expect(test.choice.holdHome(), 'domeček vede do alba').toBe('toAlbum');
  }
  showBigPicture(test, index);
}

describe('#129 AC2: domeček na velkém obrázku', () => {
  it('domeček podržený 1 s vrátí dítě z velkého obrázku do alba a stránka zůstane ve hře', async () => {
    const test = await albumTest(2);
    const ids = await shownIds(test.records);
    showBigPicture(test, 1);

    const hold = test.choice.holdHome();

    expect(hold).toBe('toAlbum');
    expect(homeHoldDecision(hold), 'do menu se neodchází').toBe('stay');
    expect(albumIds(test.choice), 'stejné album jako před otevřením').toEqual(ids);
  });

  it('z velkého obrázku vede domeček do alba, z alba na výběr a z výběru do menu', async () => {
    const test = await albumTest(1);
    showBigPicture(test, 0);

    const holds: HomeHold[] = [];
    for (let step = 0; step < 3; step += 1) {
      holds.push(test.choice.holdHome());
    }

    expect(holds).toEqual(['toAlbum', 'toPicker', 'toMenu']);
    expect(holds.map(homeHoldDecision)).toEqual(['stay', 'stay', 'leave']);
  });

  it('po návratu z velkého obrázku do alba jde otevřít jiný obrázek', async () => {
    const test = await albumTest(2);
    const ids = await shownIds(test.records);
    showBigPicture(test, 0);
    test.choice.holdHome();

    showBigPicture(test, 1);

    expect(shownRecordId(test.choice)).toBe(ids[1]);
  });

  /** Omalovánky na stránce s domečkem, jak ho drží stránka (jako v testech #124 a #126). */
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

  it('ťuknutí na domeček na velkém obrázku ho jen zhoupne a velký obrázek zůstane', async () => {
    const test = await albumTest(1);
    showBigPicture(test, 0);
    const page = pageWithHome(test.choice);

    page.button.press(1);
    vi.advanceTimersByTime(100);
    page.button.release(1);

    expect(page.wobbles(), 'krátké ťuknutí jen zhoupne').toBe(1);
    expect(page.results, 'domeček nikam nevede').toEqual([]);
    expect(screenKind(test.choice)).toBe('bigPicture');
  });

  it('domeček podržený na stránce 1 s vrátí z velkého obrázku do alba a ne do menu', async () => {
    const test = await albumTest(1);
    showBigPicture(test, 0);
    const page = pageWithHome(test.choice);

    page.button.press(1);
    vi.advanceTimersByTime(HOLD_TO_GO_HOME_MS);
    page.button.release(1);

    expect(page.results).toEqual(['toAlbum']);
    expect(screenKind(test.choice)).toBe('album');
    expect(page.left(), 'dítě zůstane v Omalovánkách').toBe(false);
  });

  it('domeček podržený kratší dobu než 1 s dítě z velkého obrázku nikam nevede', async () => {
    const test = await albumTest(1);
    showBigPicture(test, 0);
    const page = pageWithHome(test.choice);

    page.button.press(1);
    vi.advanceTimersByTime(HOLD_TO_GO_HOME_MS - 1);
    page.button.release(1);
    vi.advanceTimersByTime(HOLD_TO_GO_HOME_MS);

    expect(page.results).toEqual([]);
    expect(screenKind(test.choice)).toBe('bigPicture');
  });
});

describe('#129 AC5: dotyky při otevírání velkého obrázku', () => {
  it('druhý prst na jiném náhledu během otevírání velkého obrázku nic neotevře', async () => {
    const test = await albumTest(3);
    const ids = await shownIds(test.records);

    test.choice.tapAlbumPreview(0);
    const second = test.choice.tapAlbumPreview(1);

    expect(second).toEqual({ kind: 'ignored' });
    test.choice.bigPictureShown();
    expect(shownRecordId(test.choice), 'otevře se jen první obrázek').toBe(ids[0]);
  });

  it('rychlé dvojí ťuknutí na náhled otevře velký obrázek jen jednou', async () => {
    const test = await albumTest(2);

    const first = test.choice.tapAlbumPreview(0);
    const second = test.choice.tapAlbumPreview(0);

    expect(first.kind).toBe('open');
    expect(second).toEqual({ kind: 'ignored' });
  });

  it('dvojí ťuknutí na jiný náhled, když je velký obrázek už vidět, nic nezmění', async () => {
    const test = await albumTest(3);
    showBigPicture(test, 0);
    const before = test.choice.screen();

    for (const index of [1, 2, 1, 2]) {
      expect(test.choice.tapAlbumPreview(index), `náhled ${index + 1}`).toEqual({
        kind: 'ignored',
      });
    }
    expect(test.choice.screen()).toEqual(before);
  });

  it('podržení domečku dokončené během otevírání velkého obrázku se nepočítá', async () => {
    const test = await albumTest(1);
    test.choice.tapAlbumPreview(0);

    expect(test.choice.holdHome(), 'během otevírání').toBe('ignored');

    test.choice.bigPictureShown();
    expect(screenKind(test.choice), 'otevírání se dokončí').toBe('bigPicture');
  });

  it('prst držený na domečku z doby otevírání se nepočítá, ani když drží dál', async () => {
    const test = await albumTest(1);
    test.choice.tapAlbumPreview(0);
    vi.advanceTimersByTime(300);
    test.choice.bigPictureShown();
    // Podržení začalo před zobrazením a skončí dřív než 1 s po něm.
    vi.advanceTimersByTime(HOLD_TO_GO_HOME_MS - 300);

    expect(test.choice.holdHome()).toBe('ignored');
    expect(screenKind(test.choice), 'velký obrázek zůstane').toBe('bigPicture');
  });

  it('podržení domečku začaté, až je velký obrázek vidět, se počítá a vrátí do alba', async () => {
    const test = await albumTest(1);
    test.choice.tapAlbumPreview(0);
    test.choice.bigPictureShown();
    vi.advanceTimersByTime(HOLD_TO_GO_HOME_MS);

    expect(test.choice.holdHome()).toBe('toAlbum');
    expect(screenKind(test.choice)).toBe('album');
  });

  it('kniha ani náhledy výběru na velkém obrázku nic neudělají', async () => {
    const test = await albumTest(1);
    const album = await albumOf(test.records);
    showBigPicture(test, 0);
    const before = test.choice.screen();

    expect(test.choice.tapBook(album), 'kniha').toEqual({ kind: 'ignored' });
    expect(test.choice.tapPreview(0), 'náhled výběru').toEqual({ kind: 'ignored' });
    expect(test.choice.screen()).toEqual(before);
  });
});

describe('#129 AC5: koš a domeček se navzájem nepřeruší', () => {
  it('když se drží koš, podržení domečku nic neudělá a velký obrázek zůstane', async () => {
    const test = await albumTest(2);
    showBigPicture(test, 0);

    test.choice.trashButton.press(1);
    vi.advanceTimersByTime(TRASH_HOLD_MS / 2);

    expect(test.choice.holdHome()).toBe('ignored');
    expect(screenKind(test.choice)).toBe('bigPicture');
    test.choice.trashButton.release(1);
  });

  it('když se drží domeček, koš nic neudělá: nezhoupne se, nekreslí kroužek a nic nesmaže', async () => {
    const test = await albumTest(2);
    showBigPicture(test, 0);
    const before = await shownIds(test.records);
    const from = test.feedback.length;

    test.choice.homeHolding(true);
    test.choice.trashButton.press(2);
    vi.advanceTimersByTime(TRASH_HOLD_MS * 2);
    test.choice.trashButton.release(2);
    test.choice.trashButton.press(2);
    test.choice.trashButton.release(2);

    expect(feedbackAfter(test, from), 'žádná odezva koše').toEqual([]);
    expect(await shownIds(test.records)).toEqual(before);
    expect(screenKind(test.choice)).toBe('bigPicture');
  });

  it('po puštění domečku koš zase funguje', async () => {
    const test = await albumTest(2);
    showBigPicture(test, 0);

    test.choice.homeHolding(true);
    test.choice.homeHolding(false);

    expect((await holdTrash(test)).kind).toBe('deleted');
  });
});
