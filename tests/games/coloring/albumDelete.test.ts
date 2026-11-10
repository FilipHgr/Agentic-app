import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { removeAlbumEntry } from '../../../src/games/coloring/logic/album';
import { HOME_WOBBLE_TONES } from '../../../src/shared/logic/homeButton';
import { UNAVAILABLE_GAME_RECORDS } from '../../../src/shared/storage/profileRecords';
import type { GameRecords } from '../../../src/shared/storage/profileRecords';
import {
  CIRCLES,
  HOUSE,
  addUnreadable,
  albumDevice,
  albumOf,
  fillAlbum,
  openWithAlbum,
  paintLeft,
  recordCount,
  shownCount,
  takePhoto,
  watchRecords,
} from './albumHelpers';
import type { AlbumDevice, RemoveFailure, WatchedRecords } from './albumHelpers';
import {
  TRASH_HOLD_MS,
  deletions,
  enterWithRecords,
  feedbackAfter,
  holdTrash,
  openAlbum,
  showBigPicture,
  shownIds,
  trashWobbles,
} from './bigPictureHelpers';
import type { BigPictureTest } from './bigPictureHelpers';
import { pixelsOf, twoHalves } from './savedPictureHelpers';

/**
 * Testy k #129 AC3 (smazání podržením koše) a AC4 (selhání a obnovení
 * stránky). Koš na velkém obrázku je `PictureChoice.trashButton`
 * (podržení 1 s jako „Smazat“ u profilu, #108), odezvu hlásí `onTrash`:
 * - `{ kind: 'trashHolding', holding }` kroužek kolem koše se plní nebo zmizel,
 * - `{ kind: 'trashWobble', tones }` ťuknutí nebo kratší podržení, koš se
 *   jen zhoupne s tónem domečku,
 * - `{ kind: 'deleting', entry, done }` podržení 1 s začalo mazat; `done`
 *   skončí `{ kind: 'deleted' }`, nebo `{ kind: 'failed', tones }` (úložiště
 *   plné, nedostupné nebo chyba, koš se zhoupne s tónem domečku).
 *
 * Mazání jednoho obrázku je `removeAlbumEntry(records, recordId)`
 * v `album.ts`: smaže jen ten záznam a nikdy nevyhodí výjimku.
 *
 * Podle doporučení story-reviewer (komentář k #129): koš během mazání jen
 * zhoupne a nic dalšího nesmaže, podržení domečku během mazání se dokončí
 * až po mazání (album pak ukáže výsledek), selhání je plné i nedostupné
 * úložiště a záznam smazaný mezitím jinudy vrátí dítě do alba bez výjimky.
 *
 * „Obnovení stránky“ je nové `page()` nad stejnou poličkou záznamů
 * (`albumHelpers.ts`). Záznamy v paměti smažou záznam celý najednou jako
 * transakce IndexedDB; testy hlídají, že hra při mazání nic jiného
 * nepřepíše a nezapíše.
 */

const ORANGE = 1;
const FAILURES: readonly RemoveFailure[] = ['full', 'unavailable', 'rejected'];
const FAILURE_NAMES: Readonly<Record<RemoveFailure, string>> = {
  full: 'plné úložiště',
  unavailable: 'nedostupné úložiště',
  rejected: 'chyba úložiště',
};

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

interface DeleteCase {
  readonly device: AlbumDevice;
  readonly records: WatchedRecords;
  readonly test: BigPictureTest;
  /** Označení obrázků v albu před mazáním, od nejnovějšího. */
  readonly before: readonly string[];
}

/**
 * Zařízení s albem `count` obrázků domku (a `unreadable` nečitelnými
 * záznamy); dítě otevře album a velký obrázek náhledu `index`.
 */
async function bigPictureOf(count: number, index = 0, unreadable = 0): Promise<DeleteCase> {
  vi.useRealTimers();
  const device = albumDevice();
  await fillAlbum(device.page(), count, HOUSE);
  await addUnreadable(device.page(), unreadable);
  vi.useFakeTimers();
  const records = watchRecords(device.page());
  const before = await shownIds(records);
  const test = enterWithRecords(records);
  await openAlbum(test);
  showBigPicture(test, index);
  return { device, records, test, before };
}

function albumIdsOn(test: BigPictureTest): string[] | null {
  const screen = test.choice.screen();
  return screen.kind === 'album' ? screen.entries.map((entry) => entry.recordId) : null;
}

function without(ids: readonly string[], removed: string | undefined): string[] {
  return ids.filter((id) => id !== removed);
}

/** Data všech záznamů v poličce kromě `except` (pro „ostatní se nezměnily“). */
function otherRecords(device: AlbumDevice, except: string | undefined) {
  return structuredClone(device.shelf.records.filter((record) => record.id !== except));
}

describe('#129 AC3: podržení koše 1 s smaže obrázek', () => {
  it('podržení koše 1 s smaže z alba právě tento obrázek a dítě se vrátí do alba bez něj', async () => {
    const { records, test, before } = await bigPictureOf(3, 1);

    const result = await holdTrash(test);

    expect(result.kind).toBe('deleted');
    expect(await shownIds(records), 'album bez smazaného obrázku').toEqual(
      without(before, before[1]),
    );
    expect(albumIdsOn(test), 'dítě je v albu bez obrázku').toEqual(without(before, before[1]));
  });

  it('po smazání posledního obrázku je album prázdné a dítě se vrátí na výběr', async () => {
    const { records, test } = await bigPictureOf(1);

    expect((await holdTrash(test)).kind).toBe('deleted');

    expect(await shownCount(records)).toBe(0);
    expect(test.choice.screen()).toEqual({ kind: 'picker' });
  });

  it('kroužek kolem koše se při podržení plní a po smazání zmizí', async () => {
    const { test } = await bigPictureOf(2);
    const from = test.feedback.length;

    test.choice.trashButton.press(1);
    expect(feedbackAfter(test, from), 'kroužek se začne plnit hned').toEqual([
      { kind: 'trashHolding', holding: true },
    ]);
    vi.advanceTimersByTime(TRASH_HOLD_MS);
    test.choice.trashButton.release(1);

    expect(feedbackAfter(test, from)).toContainEqual({ kind: 'trashHolding', holding: false });
    expect(trashWobbles(test, from), 'po smazání se koš nehoupe').toEqual([]);
  });

  it('podržení koše trvá 1 s: 1 ms před koncem se ještě nic nesmaže', async () => {
    const { records, test } = await bigPictureOf(2);
    const from = test.feedback.length;

    test.choice.trashButton.press(1);
    vi.advanceTimersByTime(TRASH_HOLD_MS - 1);

    expect(deletions(test, from), 'ještě se nemaže').toEqual([]);
    vi.advanceTimersByTime(1);
    expect(deletions(test, from).length, 'po 1 s se maže').toBe(1);
    test.choice.trashButton.release(1);
    expect(records.removes()).toBe(1);
  });
});

describe('#129 AC3: ťuknutí a kratší podržení koše nic nesmaže', () => {
  it('ťuknutí na koš ho jen zhoupne se stejným tónem jako domeček a nic nesmaže', async () => {
    const { records, test, before } = await bigPictureOf(2);
    const from = test.feedback.length;

    test.choice.trashButton.press(1);
    test.choice.trashButton.release(1);
    vi.advanceTimersByTime(TRASH_HOLD_MS * 2);

    expect(trashWobbles(test, from)).toEqual([{ kind: 'trashWobble', tones: HOME_WOBBLE_TONES }]);
    expect(deletions(test, from)).toEqual([]);
    expect(records.removes()).toBe(0);
    expect(await shownIds(records)).toEqual(before);
    expect(test.choice.screen().kind, 'velký obrázek zůstane').toBe('bigPicture');
  });

  it('ani několik rychlých ťuknutí za sebou nic nesmaže', async () => {
    const { records, test } = await bigPictureOf(2);

    for (let tap = 0; tap < 5; tap += 1) {
      test.choice.trashButton.press(1);
      vi.advanceTimersByTime(TRASH_HOLD_MS / 5);
      test.choice.trashButton.release(1);
    }
    vi.advanceTimersByTime(TRASH_HOLD_MS * 2);

    expect(records.removes()).toBe(0);
  });

  it('když prst koš pustí dřív než za 1 s, nic se nesmaže', async () => {
    const { records, test, before } = await bigPictureOf(2);

    test.choice.trashButton.press(1);
    vi.advanceTimersByTime(TRASH_HOLD_MS - 1);
    test.choice.trashButton.release(1);
    vi.advanceTimersByTime(TRASH_HOLD_MS * 2);

    expect(records.removes()).toBe(0);
    expect(await shownIds(records)).toEqual(before);
  });

  it('když prst z koše sjede, nic se nesmaže, ani když se pak na koš vrátí', async () => {
    const { records, test, before } = await bigPictureOf(2);
    const from = test.feedback.length;

    test.choice.trashButton.press(1);
    vi.advanceTimersByTime(TRASH_HOLD_MS / 2);
    test.choice.trashButton.leave(1);
    // Prst se vrátí na koš bez zvednutí: nový stisk to není, držení nepokračuje.
    vi.advanceTimersByTime(TRASH_HOLD_MS * 2);
    test.choice.trashButton.release(1);

    expect(deletions(test, from)).toEqual([]);
    expect(feedbackAfter(test, from)).toContainEqual({ kind: 'trashHolding', holding: false });
    expect(records.removes()).toBe(0);
    expect(await shownIds(records)).toEqual(before);
  });

  it('když prohlížeč dotyk na koši přeruší, nic se nesmaže', async () => {
    const { records, test } = await bigPictureOf(2);

    test.choice.trashButton.press(1);
    vi.advanceTimersByTime(TRASH_HOLD_MS / 2);
    test.choice.trashButton.cancel(1);
    vi.advanceTimersByTime(TRASH_HOLD_MS * 2);

    expect(records.removes()).toBe(0);
  });

  it('další podržení koše se počítá od nuly', async () => {
    const { records, test } = await bigPictureOf(2);
    const from = test.feedback.length;

    test.choice.trashButton.press(1);
    vi.advanceTimersByTime(TRASH_HOLD_MS * 0.6);
    test.choice.trashButton.leave(1);
    test.choice.trashButton.press(2);
    vi.advanceTimersByTime(TRASH_HOLD_MS * 0.6);

    expect(deletions(test, from), 'obě podržení se nesčítají').toEqual([]);
    vi.advanceTimersByTime(TRASH_HOLD_MS * 0.4);
    expect(deletions(test, from).length, 'celá 1 s druhého podržení').toBe(1);
    test.choice.trashButton.release(2);
    expect(records.removes()).toBe(1);
  });

  it('druhý prst na koši podržení nepřeruší ani neprodlouží', async () => {
    const { records, test } = await bigPictureOf(2);
    const from = test.feedback.length;

    test.choice.trashButton.press(1);
    vi.advanceTimersByTime(TRASH_HOLD_MS / 2);
    test.choice.trashButton.press(2);
    test.choice.trashButton.release(2);
    vi.advanceTimersByTime(TRASH_HOLD_MS / 2);

    expect(trashWobbles(test, from), 'druhý prst koš nezhoupne').toEqual([]);
    expect(deletions(test, from).length, 'smaže se po 1 s od prvního prstu').toBe(1);
    test.choice.trashButton.release(1);
    expect(records.removes()).toBe(1);
  });
});

describe('#129 AC3: ostatní obrázky a nečitelné záznamy zůstanou', () => {
  it('smazání jednoho obrázku nezmění ostatní obrázky alba ani nečitelné záznamy', async () => {
    const { device, records, test, before } = await bigPictureOf(3, 0, 2);
    const deleted = before[0];
    const others = otherRecords(device, deleted);
    const othersPixels = await picturesExcept(records, deleted);

    expect((await holdTrash(test)).kind).toBe('deleted');

    expect(otherRecords(device, deleted), 'ostatní záznamy beze změny').toEqual(others);
    expect(await recordCount(records), '2 obrázky a 2 nečitelné záznamy').toBe(4);
    expect(await picturesExcept(records, deleted), 'ostatní obrázky pixel po pixelu').toEqual(
      othersPixels,
    );
  });

  it('po smazání obrázku z plného alba fotoaparát zase uloží nový obrázek', async () => {
    vi.useRealTimers();
    const device = albumDevice();
    await fillAlbum(device.page(), 12, HOUSE);
    const blocked = await openWithAlbum({ storage: undefined, records: device.page() });
    paintLeft(blocked, ORANGE + 20);
    expect(blocked.tapCamera().kind, 'předpoklad: plné album, fotoaparát se jen zhoupne').toBe(
      'wobble',
    );
    vi.useFakeTimers();
    const test = enterWithRecords(device.page());
    await openAlbum(test);
    showBigPicture(test, 5);

    expect((await holdTrash(test)).kind).toBe('deleted');

    vi.useRealTimers();
    const game = await openWithAlbum({
      storage: undefined,
      records: device.page(),
      picture: CIRCLES,
    });
    paintLeft(game, ORANGE);
    expect((await takePhoto(game)).kind, 'nový obrázek se uloží').toBe('saved');
    expect(await shownCount(device.page())).toBe(12);
  });
});

/** Pixely obrázků alba kromě `except`, od nejnovějšího. */
async function picturesExcept(records: GameRecords, except: string | undefined) {
  const album = await albumOf(records);
  const entries = album.status === 'read' ? album.entries : [];
  return entries
    .filter((entry) => entry.recordId !== except)
    .map((entry) => [entry.recordId, pixelsOf(entry.colors, twoHalves())]);
}

describe('#129 AC3 (doporučení story-reviewer): dotyky během mazání', () => {
  it('koš během mazání jen zhoupne s tónem domečku a nic dalšího nesmaže', async () => {
    const { records, test, before } = await bigPictureOf(3);
    records.holdRemoves();
    const done = holdTrash(test);
    const from = test.feedback.length;

    test.choice.trashButton.press(1);
    test.choice.trashButton.release(1);
    test.choice.trashButton.press(1);
    vi.advanceTimersByTime(TRASH_HOLD_MS);
    test.choice.trashButton.release(1);

    expect(deletions(test, from), 'druhé mazání nezačne').toEqual([]);
    expect(trashWobbles(test, from).length, 'koš se zhoupne').toBeGreaterThanOrEqual(1);
    expect(trashWobbles(test, from)).toContainEqual({
      kind: 'trashWobble',
      tones: HOME_WOBBLE_TONES,
    });
    await records.releaseRemoves();
    expect((await done).kind).toBe('deleted');
    expect(records.removes(), 'mazalo se jen jednou').toBe(1);
    expect(await shownIds(records), 'smazal se jen jeden obrázek').toEqual(
      without(before, before[0]),
    );
  });

  it('podržení domečku během mazání se dokončí až po mazání a album ukáže obrázky bez smazaného', async () => {
    const { records, test, before } = await bigPictureOf(3);
    records.holdRemoves();
    const done = holdTrash(test);

    const hold = test.choice.holdHome();

    expect(hold, 'stránka zůstane ve hře').toBe('toAlbum');
    expect(test.choice.screen().kind, 'během mazání se album ještě neukáže').not.toBe('album');
    await records.releaseRemoves();
    await done;
    expect(albumIdsOn(test)).toEqual(without(before, before[0]));
  });

  it('podržení domečku během mazání posledního obrázku vrátí dítě po mazání na výběr', async () => {
    const { records, test } = await bigPictureOf(1);
    records.holdRemoves();
    const done = holdTrash(test);

    expect(test.choice.holdHome()).toBe('toAlbum');
    await records.releaseRemoves();
    await done;

    expect(test.choice.screen()).toEqual({ kind: 'picker' });
  });

  it('podržení domečku během nepovedeného mazání vrátí dítě po mazání do alba i s obrázkem', async () => {
    const { records, test, before } = await bigPictureOf(2);
    records.failRemoves('unavailable');
    records.holdRemoves();
    const done = holdTrash(test);

    expect(test.choice.holdHome()).toBe('toAlbum');
    expect((await done).kind).toBe('failed');

    expect(albumIdsOn(test)).toEqual(before);
  });
});

describe('#129 AC3 (doporučení story-reviewer): obrázek smazaný mezitím jinudy', () => {
  it('když obrázek mezitím smazala jiná záložka, podržení koše vrátí dítě do alba bez něj', async () => {
    const { device, records, test, before } = await bigPictureOf(3, 1);
    await device.page().remove(before[1] ?? '');

    const result = await holdTrash(test);

    expect(result.kind).toBe('deleted');
    expect(albumIdsOn(test)).toEqual(without(before, before[1]));
    expect(await shownIds(records)).toEqual(without(before, before[1]));
  });

  it('když jiná záložka smazala poslední obrázek, podržení koše vrátí dítě na výběr', async () => {
    const { device, test, before } = await bigPictureOf(1);
    await device.page().remove(before[0] ?? '');

    expect((await holdTrash(test)).kind).toBe('deleted');

    expect(test.choice.screen()).toEqual({ kind: 'picker' });
  });
});

describe('#129 AC4: smazání se nepovede', () => {
  for (const failure of FAILURES) {
    it(`při selhání (${FAILURE_NAMES[failure]}) zůstane dítě na velkém obrázku, obrázek je dál v albu a koš se zhoupne s tónem domečku`, async () => {
      const { records, test, before } = await bigPictureOf(2);
      const shownBefore = test.choice.screen();
      records.failRemoves(failure);

      const result = await holdTrash(test);

      expect(result).toEqual({ kind: 'failed', tones: HOME_WOBBLE_TONES });
      expect(test.choice.screen(), 'velký obrázek zůstane').toEqual(shownBefore);
      expect(await shownIds(records), 'obrázek je dál v albu').toEqual(before);
    });
  }

  it('po nepovedeném smazání jde koš podržet znovu, a když úložiště zase funguje, obrázek smaže', async () => {
    const { records, test, before } = await bigPictureOf(2);
    records.failRemoves('full');
    expect((await holdTrash(test)).kind).toBe('failed');
    records.failRemoves(null);

    expect((await holdTrash(test)).kind).toBe('deleted');
    expect(await shownIds(records)).toEqual(without(before, before[0]));
  });
});

describe('#129 AC4: mazání jednoho obrázku v albu (removeAlbumEntry)', () => {
  it('smaže jen záznam obrázku a ostatní záznamy nechá', async () => {
    vi.useRealTimers();
    const device = albumDevice();
    await fillAlbum(device.page(), 3, HOUSE);
    await addUnreadable(device.page(), 2);
    const [first] = await shownIds(device.page());
    const others = otherRecords(device, first);

    expect(await removeAlbumEntry(device.page(), first ?? '')).toBe('removed');

    expect(otherRecords(device, first)).toEqual(others);
    expect(await recordCount(device.page())).toBe(4);
  });

  it('záznam, který už v albu není, je smazaný a nic jiného se nesmaže', async () => {
    vi.useRealTimers();
    const device = albumDevice();
    await fillAlbum(device.page(), 2, HOUSE);
    const before = await shownIds(device.page());

    expect(await removeAlbumEntry(device.page(), 'neexistuje')).toBe('removed');
    expect(await shownIds(device.page())).toEqual(before);
  });

  it('nepovedené mazání skončí „nepovedlo se“ bez výjimky', async () => {
    vi.useRealTimers();
    const unavailable: ReadonlyArray<readonly [string, GameRecords | undefined]> = [
      ['úložiště nedostupné', UNAVAILABLE_GAME_RECORDS],
      ['stránka nedala záznamy', undefined],
    ];
    for (const [name, records] of unavailable) {
      await expect(removeAlbumEntry(records, '1'), name).resolves.toBe('failed');
    }
    for (const failure of FAILURES) {
      const records = watchRecords(albumDevice().page());
      records.failRemoves(failure);
      await expect(removeAlbumEntry(records, '1'), FAILURE_NAMES[failure]).resolves.toBe('failed');
    }
  });
});

describe('#129 AC4: obnovení stránky během mazání', () => {
  it('obnovení stránky během mazání nenechá obrázek napůl: je v albu právě jednou a celý stejný', async () => {
    const { device, records, test, before } = await bigPictureOf(3);
    const pixelsBefore = await picturesExcept(records, undefined);
    records.holdRemoves();
    void holdTrash(test);

    // Stránka se obnoví dřív, než úložiště smazání dokončí.
    const reloaded = device.page();

    expect(await shownIds(reloaded), 'obrázek je v albu právě jednou').toEqual(before);
    expect(await picturesExcept(reloaded, undefined), 'celý stejný jako předtím').toEqual(
      pixelsBefore,
    );
  });

  it('když úložiště smazání dokončí, obrázek po obnovení v albu není a jeho místo se uvolní', async () => {
    const { device, records, test, before } = await bigPictureOf(3);
    records.holdRemoves();
    const done = holdTrash(test);
    await records.releaseRemoves();
    await done;

    const reloaded = device.page();

    expect(await shownIds(reloaded)).toEqual(without(before, before[0]));
    expect(await recordCount(reloaded), 'místo pro fotoaparát se uvolní').toBe(2);
  });

  it('mazání ostatní obrázky alba nepřepíše: hra nic neukládá a smaže jen jeden záznam', async () => {
    const { device, records, test, before } = await bigPictureOf(3, 1, 1);
    const deleted = before[1];
    const others = otherRecords(device, deleted);
    records.holdRemoves();
    const done = holdTrash(test);

    expect(otherRecords(device, deleted), 'během mazání').toEqual(others);
    await records.releaseRemoves();
    await done;

    expect(otherRecords(device, deleted), 'po mazání').toEqual(others);
    expect(records.adds(), 'nic se neukládá').toBe(0);
    expect(records.removes(), 'maže se jen jednou').toBe(1);
  });

  it('obnovení stránky během mazání ostatní obrázky alba nezmění', async () => {
    const { device, records, test, before } = await bigPictureOf(3, 2);
    const deleted = before[2];
    const othersPixels = await picturesExcept(records, deleted);
    records.holdRemoves();
    const done = holdTrash(test);

    expect(await picturesExcept(device.page(), deleted), 'před dokončením').toEqual(othersPixels);
    await records.releaseRemoves();
    await done;
    expect(await picturesExcept(device.page(), deleted), 'po dokončení').toEqual(othersPixels);
  });
});
