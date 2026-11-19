import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { albumDevice, fillAlbumQuickly } from './albumHelpers';
import { enterWithRecords, openAlbum } from './bigPictureHelpers';
import {
  LONG_SWIPE,
  START,
  TWENTY_FIVE_PICTURES,
  enterPagedPicker,
  openedId,
} from './pickerPagesHelpers';

/**
 * Testy k #150 (oprava po kontrole UX): když prohlížeč dotyk zruší
 * (pointercancel, touchcancel, odchod z okna), prst se zapomene na výběru
 * i v albu. Zvednutí po zrušení nic neotevře ani nenalistuje a další dotyk
 * funguje jako vždy. Scéna hlásí zrušení `pickerPointerCancel`
 * a `albumPointerCancel` (s číslem prstu, nebo bez něj pro všechny prsty).
 */

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('#150: zrušený dotyk na výběru nic neotevře ani nenalistuje', () => {
  it('po zrušení dotyku na náhledu se omalovánka neotevře', () => {
    const choice = enterPagedPicker(TWENTY_FIVE_PICTURES);
    choice.pickerPointerDown(1, START, 2);

    choice.pickerPointerCancel(1);

    expect(choice.pickerPointerUp(1, START).kind).toBe('ignored');
    expect(choice.screen()).toEqual({ kind: 'picker' });
  });

  it('po zrušení dotyku tah nenalistuje', () => {
    const choice = enterPagedPicker(TWENTY_FIVE_PICTURES);
    choice.pickerPointerDown(1, START, null);

    choice.pickerPointerCancel(1);

    expect(choice.pickerPointerUp(1, { x: START.x - LONG_SWIPE, y: START.y }).kind).toBe('ignored');
    expect(choice.pickerPage()).toBe(0);
  });

  it('zrušení všech dotyků (odchod z okna) zapomene oba prsty', () => {
    const choice = enterPagedPicker(TWENTY_FIVE_PICTURES);
    choice.pickerPointerDown(1, START, 0);
    choice.pickerPointerDown(2, START, 3);

    choice.pickerPointerCancel();

    expect(choice.pickerPointerUp(1, START).kind).toBe('ignored');
    expect(choice.pickerPointerUp(2, START).kind).toBe('ignored');
    expect(choice.screen()).toEqual({ kind: 'picker' });
  });

  it('zrušení jednoho prstu nechá druhý prst ťuknout', () => {
    const choice = enterPagedPicker(TWENTY_FIVE_PICTURES);
    choice.pickerPointerDown(1, START, 0);
    choice.pickerPointerDown(2, START, 3);

    choice.pickerPointerCancel(1);

    expect(openedId(choice.pickerPointerUp(2, START))).toBe('page-04');
  });

  it('po zrušeném dotyku další ťuknutí omalovánku otevře', () => {
    const choice = enterPagedPicker(TWENTY_FIVE_PICTURES);
    choice.pickerPointerDown(1, START, 2);
    choice.pickerPointerCancel(1);

    choice.pickerPointerDown(1, START, 2);

    expect(openedId(choice.pickerPointerUp(1, START))).toBe('page-03');
  });
});

describe('#150: zrušený dotyk v albu nic neotevře ani nenalistuje', () => {
  async function openedAlbum(): Promise<ReturnType<typeof enterWithRecords>> {
    const records = albumDevice().page();
    await fillAlbumQuickly(records, 25);
    const test = enterWithRecords(records);
    await openAlbum(test);
    return test;
  }

  it('po zrušení dotyku na náhledu v albu se velký obrázek neotevře', async () => {
    const { choice } = await openedAlbum();
    choice.albumPointerDown(1, START, 0);

    choice.albumPointerCancel(1);

    expect(choice.albumPointerUp(1, START).kind).toBe('ignored');
    expect(choice.screen().kind).toBe('album');
  });

  it('po zrušení všech dotyků tah v albu nenalistuje', async () => {
    const { choice } = await openedAlbum();
    choice.albumPointerDown(1, START, null);

    choice.albumPointerCancel();

    expect(choice.albumPointerUp(1, { x: START.x - LONG_SWIPE, y: START.y }).kind).toBe('ignored');
    const screen = choice.screen();
    expect(screen.kind === 'album' ? screen.page : null).toBe(0);
  });
});
