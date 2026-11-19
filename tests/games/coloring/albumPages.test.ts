import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { albumPageCount } from '../../../src/games/coloring/logic/album';
import type {
  AlbumPointerResult,
  ColoringScreen,
  PictureChoice,
} from '../../../src/games/coloring/logic/pictureChoice';
import { HOLD_TO_GO_HOME_MS, HOME_WOBBLE_TONES } from '../../../src/shared/logic/homeButton';
import { ALBUM_PAGE_SIZE, albumDevice, fillAlbumQuickly } from './albumHelpers';
import { enterWithRecords, holdTrash, openAlbum, showBigPicture } from './bigPictureHelpers';
import type { BigPictureTest } from './bigPictureHelpers';

/**
 * Testy k #149 AC1 (listování), AC4 (velký obrázek a koš na stránkách)
 * a AC5 (dotyky při listování). Album ukazuje 12 obrázků na stránku od
 * nejnovějšího; stránku drží výběr (`PictureChoice`) na obrazovce alba
 * (`screen().page`, 0 je 1. stránka) i na velkém obrázku, aby se po jeho
 * zavření vrátil na stejnou stránku.
 *
 * Dotyky v albu hlásí scéna výběru v CSS px okna: stisk prstu s místem
 * náhledu pod ním (`albumPointerDown`, `null` mimo náhledy) a zvednutí
 * s místem, kde prst skončil (`albumPointerUp`). Výběr pozná ťuknutí
 * a tah (posun aspoň 48 px vodorovně a víc než svisle). Šipky ◀ ▶ hlásí
 * scéna ťuknutím (`tapAlbumArrow`). Po nalistování scéna novou stránku
 * ukáže animací a pak zavolá `albumPageShown`; do té doby se listuje
 * („během listování“, AC5).
 *
 * Album se tu plní rychle (`fillAlbumQuickly`), testy jsou tak i s 25
 * obrázky rychlé. Tón listování zadání neurčuje, testy ho nehlídají.
 */

/** Kde prst začne v CSS px (uprostřed alba, na tom nezáleží). */
const START = { x: 500, y: 400 } as const;

/** Tah dost dlouhý na nalistování (AC1: aspoň 48 px). */
const LONG_SWIPE = 120;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

interface PagedAlbum {
  readonly test: BigPictureTest;
  /** Označení obrázků od nejnovějšího (jak je album ukazuje). */
  readonly newestFirst: readonly string[];
}

/** Album s `count` obrázky, otevřené ťuknutím na knihu na výběru. */
async function openedAlbum(count: number): Promise<PagedAlbum> {
  const records = albumDevice().page();
  const saved = await fillAlbumQuickly(records, count);
  const test = enterWithRecords(records);
  await openAlbum(test);
  return { test, newestFirst: [...saved].reverse() };
}

/** Stránka alba, která je vidět; `null`, když dítě není v albu. */
function shownPage(choice: PictureChoice): number | null {
  const screen: ColoringScreen = choice.screen();
  return screen.kind === 'album' ? screen.page : null;
}

/** Obrázky stránky `page` od nejnovějšího, jak by je dítě v albu mělo vidět. */
function expectedOnPage(newestFirst: readonly string[], page: number): readonly string[] {
  return newestFirst.slice(page * ALBUM_PAGE_SIZE, (page + 1) * ALBUM_PAGE_SIZE);
}

/** Obrázek, který otevře ťuknutí na místo `place` na stránce, která je vidět. */
function entryAt(choice: PictureChoice, place: number): string | null {
  const tap = choice.tapAlbumPreview(place);
  return tap.kind === 'open' ? tap.entry.recordId : null;
}

/**
 * Obrázek, který otevře ťuknutí na místo `place`, a zpátky do alba
 * domečkem z velkého obrázku (stránka alba se nezmění, AC4).
 */
function openedAt(test: BigPictureTest, place: number): string | null {
  const recordId = entryAt(test.choice, place);
  if (recordId === null) {
    return null;
  }
  test.choice.bigPictureShown();
  vi.advanceTimersByTime(HOLD_TO_GO_HOME_MS);
  expect(test.choice.holdHome(), 'domeček z velkého obrázku vede do alba').toBe('toAlbum');
  return recordId;
}

/** Dítě nalistuje šipkou a scéna novou stránku ukáže. */
function turnByArrow(choice: PictureChoice, direction: 'next' | 'previous'): void {
  const turn = choice.tapAlbumArrow(direction);
  expect(turn.kind, `šipka ${direction === 'next' ? '▶' : '◀'} nalistuje`).toBe('turned');
  choice.albumPageShown();
}

/** Jeden prst se dotkne v `START` (na místě náhledu `place`) a zvedne o `dx`, `dy` dál. */
function swipe(
  choice: PictureChoice,
  dx: number,
  dy: number,
  options: { readonly pointerId?: number; readonly place?: number | null } = {},
): AlbumPointerResult {
  const pointerId = options.pointerId ?? 1;
  choice.albumPointerDown(pointerId, START, options.place ?? null);
  return choice.albumPointerUp(pointerId, { x: START.x + dx, y: START.y + dy });
}

describe('#149 AC1: album ukazuje 12 obrázků na stránku od nejnovějšího', () => {
  it('na stránku se vejde 12 obrázků: 12 obrázků je 1 stránka, 13 už 2 a 60 obrázků 5 stránek', () => {
    const cases: ReadonlyArray<readonly [number, number]> = [
      [1, 1],
      [11, 1],
      [12, 1],
      [13, 2],
      [24, 2],
      [25, 3],
      [59, 5],
      [60, 5],
    ];
    for (const [pictures, pages] of cases) {
      expect(albumPageCount(pictures), `${pictures} obrázků`).toBe(pages);
    }
  });

  it('album se otevře na 1. stránce s 12 nejnovějšími obrázky', async () => {
    const { test, newestFirst } = await openedAlbum(25);

    expect(shownPage(test.choice), 'otevře se 1. stránka').toBe(0);
    for (let place = 0; place < ALBUM_PAGE_SIZE; place += 1) {
      expect(openedAt(test, place), `místo ${place + 1}`).toBe(
        expectedOnPage(newestFirst, 0)[place],
      );
    }
  });

  it('album se otevře vždy na 1. stránce, i když dítě odešlo z jiné stránky', async () => {
    const { test } = await openedAlbum(25);
    turnByArrow(test.choice, 'next');
    turnByArrow(test.choice, 'next');
    expect(shownPage(test.choice), 'předpoklad: 3. stránka').toBe(2);

    expect(test.choice.holdHome(), 'domeček z alba vede na výběr').toBe('toPicker');
    await openAlbum(test);

    expect(shownPage(test.choice)).toBe(0);
  });

  it('šipka ▶ ukáže další stránku s dalšími obrázky', async () => {
    const { test, newestFirst } = await openedAlbum(25);

    turnByArrow(test.choice, 'next');
    expect(shownPage(test.choice), 'po ▶ 2. stránka').toBe(1);
    expect(entryAt(test.choice, 0), 'první obrázek 2. stránky je 13. nejnovější').toBe(
      newestFirst[12],
    );
  });

  it('na poslední neúplné stránce jsou jen zbylé obrázky, prázdné místo nic neotevře', async () => {
    const { test, newestFirst } = await openedAlbum(25);
    turnByArrow(test.choice, 'next');
    turnByArrow(test.choice, 'next');

    expect(shownPage(test.choice)).toBe(2);
    // #158 AC3: prázdné místo je okénko, ťuknutí ho zhoupne s tónem domečku
    // (dřív `ignored`) a nic neotevře.
    expect(test.choice.tapAlbumPreview(1), 'místo 2 na 3. stránce je prázdné').toEqual({
      kind: 'wobble',
      index: 1,
      tones: HOME_WOBBLE_TONES,
    });
    expect(test.choice.screen().kind, 'velký obrázek se neotevřel').toBe('album');
    expect(entryAt(test.choice, 0), 'jediný obrázek 3. stránky je nejstarší').toBe(newestFirst[24]);
  });

  it('šipka ◀ vrátí předchozí stránku', async () => {
    const { test, newestFirst } = await openedAlbum(25);
    turnByArrow(test.choice, 'next');
    turnByArrow(test.choice, 'next');

    turnByArrow(test.choice, 'previous');

    expect(shownPage(test.choice)).toBe(1);
    expect(entryAt(test.choice, 11), 'poslední obrázek 2. stránky').toBe(newestFirst[23]);
  });

  it('tah doleva ukáže další stránku a tah doprava předchozí', async () => {
    const { test } = await openedAlbum(25);

    const left = swipe(test.choice, -LONG_SWIPE, 0);
    expect(left).toMatchObject({ kind: 'turned', page: 1, direction: 'next' });
    test.choice.albumPageShown();
    expect(shownPage(test.choice), 'po tahu doleva 2. stránka').toBe(1);

    const right = swipe(test.choice, LONG_SWIPE, 0);
    expect(right).toMatchObject({ kind: 'turned', page: 0, direction: 'previous' });
    test.choice.albumPageShown();
    expect(shownPage(test.choice), 'po tahu doprava zase 1. stránka').toBe(0);
  });
});

describe('#149 AC1: tah je posun aspoň 48 px vodorovně a víc než svisle', () => {
  it('posun přesně o 48 px vodorovně je tah a nalistuje', async () => {
    const { test } = await openedAlbum(13);

    expect(swipe(test.choice, -48, 0).kind).toBe('turned');
  });

  it('posun o 47 px vodorovně je ťuknutí: nenalistuje, na náhledu otevře velký obrázek', async () => {
    const { test, newestFirst } = await openedAlbum(13);

    const result = swipe(test.choice, -47, 0, { place: 2 });

    expect(result.kind, 'ťuknutí na náhled').toBe('open');
    expect(result.kind === 'open' ? result.entry.recordId : null).toBe(newestFirst[2]);
    expect(test.choice.screen().kind).toBe('openingBigPicture');
  });

  it('posun stejně velký svisle jako vodorovně není tah a nenalistuje', async () => {
    const { test } = await openedAlbum(13);

    const result = swipe(test.choice, -100, 100);

    expect(result.kind).not.toBe('turned');
    expect(shownPage(test.choice)).toBe(0);
  });

  it('posun víc svisle než vodorovně není tah a nenalistuje', async () => {
    const { test } = await openedAlbum(13);

    for (const [dx, dy] of [
      [-60, 61],
      [-60, -200],
      [0, -300],
    ] as const) {
      expect(swipe(test.choice, dx, dy).kind, `posun ${dx}, ${dy}`).not.toBe('turned');
      expect(shownPage(test.choice), `posun ${dx}, ${dy}`).toBe(0);
    }
  });

  it('šikmý tah víc vodorovně než svisle nalistuje', async () => {
    const { test } = await openedAlbum(13);

    expect(swipe(test.choice, -80, 79).kind).toBe('turned');
  });

  it('ťuknutí mimo náhledy nic neotevře a nenalistuje', async () => {
    const { test } = await openedAlbum(13);

    expect(swipe(test.choice, 3, 2, { place: null }).kind).toBe('ignored');
    expect(shownPage(test.choice)).toBe(0);
  });
});

describe('#149 AC1: na krajních stránkách se nic nenalistuje', () => {
  it('šipka ◀ na 1. stránce se zhoupne s tónem domečku a stránka zůstane', async () => {
    const { test } = await openedAlbum(25);

    expect(test.choice.tapAlbumArrow('previous')).toEqual({
      kind: 'edge',
      wobble: 'arrow',
      tones: HOME_WOBBLE_TONES,
    });
    expect(shownPage(test.choice)).toBe(0);
  });

  it('šipka ▶ na poslední stránce se zhoupne s tónem domečku a stránka zůstane', async () => {
    const { test } = await openedAlbum(25);
    turnByArrow(test.choice, 'next');
    turnByArrow(test.choice, 'next');

    expect(test.choice.tapAlbumArrow('next')).toEqual({
      kind: 'edge',
      wobble: 'arrow',
      tones: HOME_WOBBLE_TONES,
    });
    expect(shownPage(test.choice)).toBe(2);
  });

  it('tah doprava na 1. stránce nic nenalistuje a náhledy se zhoupnou s tónem domečku', async () => {
    const { test } = await openedAlbum(25);

    expect(swipe(test.choice, LONG_SWIPE, 0)).toEqual({
      kind: 'edge',
      wobble: 'previews',
      tones: HOME_WOBBLE_TONES,
    });
    expect(shownPage(test.choice)).toBe(0);
  });

  it('tah doleva na poslední stránce nic nenalistuje a náhledy se zhoupnou s tónem domečku', async () => {
    const { test } = await openedAlbum(25);
    turnByArrow(test.choice, 'next');
    turnByArrow(test.choice, 'next');

    expect(swipe(test.choice, -LONG_SWIPE, 0)).toEqual({
      kind: 'edge',
      wobble: 'previews',
      tones: HOME_WOBBLE_TONES,
    });
    expect(shownPage(test.choice)).toBe(2);
  });

  it('po zhoupnutí na kraji jde dál listovat a ťukat na náhledy', async () => {
    const { test, newestFirst } = await openedAlbum(25);
    test.choice.tapAlbumArrow('previous');
    swipe(test.choice, LONG_SWIPE, 0);

    turnByArrow(test.choice, 'next');

    expect(entryAt(test.choice, 0)).toBe(newestFirst[12]);
  });
});

describe('#149 AC1: při jediné stránce šipky nejsou', () => {
  it('s 12 obrázky je album jedna stránka a šipky nic nedělají', async () => {
    const { test } = await openedAlbum(12);

    expect(albumPageCount(12)).toBe(1);
    expect(test.choice.tapAlbumArrow('next').kind, '▶ není').toBe('ignored');
    expect(test.choice.tapAlbumArrow('previous').kind, '◀ není').toBe('ignored');
    expect(shownPage(test.choice)).toBe(0);
  });

  it('s jedinou stránkou tah nic nenalistuje a náhledy se zhoupnou s tónem domečku', async () => {
    const { test } = await openedAlbum(3);

    for (const dx of [-LONG_SWIPE, LONG_SWIPE]) {
      expect(swipe(test.choice, dx, 0), `tah o ${dx} px`).toEqual({
        kind: 'edge',
        wobble: 'previews',
        tones: HOME_WOBBLE_TONES,
      });
      expect(shownPage(test.choice)).toBe(0);
    }
  });
});

describe('#149 AC4: velký obrázek a koš na stránkách alba', () => {
  it('ťuknutí na náhled na 2. stránce otevře obrázek té stránky', async () => {
    const { test, newestFirst } = await openedAlbum(25);
    turnByArrow(test.choice, 'next');

    const tap = test.choice.tapAlbumPreview(4);

    expect(tap.kind === 'open' ? tap.entry.recordId : null).toBe(newestFirst[16]);
  });

  it('po zavření velkého obrázku domečkem je album na stejné stránce', async () => {
    const { test, newestFirst } = await openedAlbum(25);
    turnByArrow(test.choice, 'next');
    showBigPicture(test, 3);

    expect(test.choice.holdHome(), 'domeček vede do alba').toBe('toAlbum');

    expect(shownPage(test.choice), 'album je na 2. stránce').toBe(1);
    expect(entryAt(test.choice, 3), 'na stejném místě je stejný obrázek').toBe(newestFirst[15]);
  });

  it('po smazání obrázku je album na stejné stránce, když na ní ještě nějaký obrázek zbyl', async () => {
    const { test, newestFirst } = await openedAlbum(25);
    turnByArrow(test.choice, 'next');
    showBigPicture(test, 0);

    expect((await holdTrash(test)).kind).toBe('deleted');

    expect(shownPage(test.choice), 'album je dál na 2. stránce').toBe(1);
    expect(entryAt(test.choice, 0), 'na místo smazaného se posunul další obrázek').toBe(
      newestFirst[13],
    );
  });

  it('po smazání posledního obrázku na stránce se ukáže předchozí stránka', async () => {
    const { test, newestFirst } = await openedAlbum(13);
    turnByArrow(test.choice, 'next');
    showBigPicture(test, 0);

    expect((await holdTrash(test)).kind).toBe('deleted');

    expect(shownPage(test.choice), 'album je na 1. stránce').toBe(0);
    expect(entryAt(test.choice, 11), 'poslední místo 1. stránky').toBe(newestFirst[11]);
  });

  it('po smazání posledního obrázku na stránce zmizí šipky, když zbyla jediná stránka', async () => {
    const { test } = await openedAlbum(13);
    turnByArrow(test.choice, 'next');
    showBigPicture(test, 0);
    await holdTrash(test);

    expect(test.choice.tapAlbumArrow('next').kind, '▶ není').toBe('ignored');
    expect(test.choice.tapAlbumArrow('previous').kind, '◀ není').toBe('ignored');
  });

  it('po smazání posledního obrázku vůbec se album zavře a dítě je na výběru omalovánek', async () => {
    const { test } = await openedAlbum(1);
    showBigPicture(test, 0);

    expect((await holdTrash(test)).kind).toBe('deleted');

    expect(test.choice.screen()).toEqual({ kind: 'picker' });
  });
});

describe('#149 AC5: dotyky při listování', () => {
  it('tah začatý na náhledu nalistuje a neotevře velký obrázek', async () => {
    const { test } = await openedAlbum(25);

    const result = swipe(test.choice, -LONG_SWIPE, 0, { place: 5 });

    expect(result.kind).toBe('turned');
    test.choice.albumPageShown();
    expect(test.choice.screen().kind, 'velký obrázek se neotevírá').toBe('album');
    expect(shownPage(test.choice)).toBe(1);
  });

  it('tah dvěma prsty naráz nalistuje jen o jednu stránku', async () => {
    const { test } = await openedAlbum(25);
    test.choice.albumPointerDown(1, START, 2);
    test.choice.albumPointerDown(2, { x: START.x, y: START.y + 100 }, 6);

    const first = test.choice.albumPointerUp(1, { x: START.x - LONG_SWIPE, y: START.y });
    const second = test.choice.albumPointerUp(2, {
      x: START.x - LONG_SWIPE,
      y: START.y + 100,
    });
    test.choice.albumPageShown();

    expect([first.kind, second.kind].filter((kind) => kind === 'turned').length).toBe(1);
    expect(shownPage(test.choice), 'album je na 2. stránce, ne na 3.').toBe(1);
  });

  it('tah dvěma prsty nalistuje jen o jednu stránku, i když se stránka ukáže dřív, než se zvedne druhý prst', async () => {
    const { test } = await openedAlbum(25);
    test.choice.albumPointerDown(1, START, null);
    test.choice.albumPointerDown(2, { x: START.x, y: START.y + 100 }, null);

    test.choice.albumPointerUp(1, { x: START.x - LONG_SWIPE, y: START.y });
    test.choice.albumPageShown();
    const second = test.choice.albumPointerUp(2, {
      x: START.x - LONG_SWIPE,
      y: START.y + 100,
    });

    expect(second.kind, 'druhý prst nenalistuje').not.toBe('turned');
    expect(shownPage(test.choice), 'album je na 2. stránce, ne na 3.').toBe(1);
  });

  it('během listování ťuknutí na náhled nic neotevře', async () => {
    const { test } = await openedAlbum(25);
    expect(test.choice.tapAlbumArrow('next').kind).toBe('turned');

    expect(swipe(test.choice, 0, 0, { place: 0 }).kind, 'ťuknutí prstem').toBe('ignored');
    expect(test.choice.tapAlbumPreview(0).kind, 'ťuknutí na místo náhledu').toBe('ignored');
    expect(test.choice.screen().kind).toBe('album');
  });

  it('ťuknutí začaté během listování nic neotevře ani po dolistování', async () => {
    const { test } = await openedAlbum(25);
    expect(test.choice.tapAlbumArrow('next').kind).toBe('turned');
    test.choice.albumPointerDown(1, START, 0);
    test.choice.albumPageShown();

    const result = test.choice.albumPointerUp(1, START);

    expect(result.kind, 'prst se dotkl během listování').toBe('ignored');
    expect(test.choice.screen().kind).toBe('album');
    expect(shownPage(test.choice)).toBe(1);
  });

  it('po dolistování otevře ťuknutí na náhled obrázek nové stránky', async () => {
    const { test, newestFirst } = await openedAlbum(25);
    swipe(test.choice, -LONG_SWIPE, 0);
    test.choice.albumPageShown();

    const result = swipe(test.choice, 0, 0, { place: 0 });

    expect(result.kind === 'open' ? result.entry.recordId : null).toBe(newestFirst[12]);
  });
});
