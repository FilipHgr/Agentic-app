import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { profileFeedbackSound } from '../../src/menu/logic/profileScreens';
import type { ProfileFeedback } from '../../src/menu/logic/profileScreens';
import { PROFILE_COLORS } from '../../src/shared/logic/profiles';
import { PROFILE_LIST_KEY, openProfiles } from '../../src/shared/storage/profileStorage';
import { profileDataKeys } from '../shared/profileFixtures';
import {
  DELETE_PROFILE_HOLD_MS,
  clearNickname,
  deviceWithProfiles,
  holdConfirmDelete,
  openEdit,
  pickerNicknames,
  testProfileScreens,
  typeNickname,
} from './profileScreenFixtures';
import type { TestProfileScreens } from './profileScreenFixtures';

/**
 * Testy k #108: smazání profilu se potvrzuje podržením „Smazat“ 1 s.
 * Úpravu a smazání z #73 testuje `editProfile.test.ts`.
 *
 * Navržené rozhraní (`src/menu/logic/profileScreens.ts`), navíc k #73:
 * - `confirmDeleteButton: HoldButton` pro „Smazat“ v potvrzení: podržení
 *   1 s (`DELETE_PROFILE_HOLD_MS`, stejně jako kolečko nastavení) profil
 *   smaže, ťuknutí nebo kratší podržení jen zhoupne
 *   (`{ kind: 'wobble', target: 'confirmDelete' }`), sjetí prstu
 *   a pointercancel podržení zruší, druhý prst ho nepřeruší ani neprodlouží,
 *   plnění kroužku hlásí `{ kind: 'deleteHolding', holding }` (bez zvuku),
 * - po smazání odezva `{ kind: 'tap', target: 'confirmDelete' }` jako dřív
 *   po ťuknutí (stejný zvuk), po nepovedeném smazání
 *   `{ kind: 'wobble', target: 'delete' }` a 2. krok úpravy,
 * - `tapConfirmDelete()` zmizí (ťuknutí už nemaže); „Zpět“ zůstává
 *   `tapCancelDelete()`.
 */

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

const GAME = 'counting';
const STARS_KEY = 'agentic-app.progress';
const DELETE_WOBBLE = { kind: 'wobble', target: 'confirmDelete' } as const;
const DELETED_TAP = { kind: 'tap', target: 'confirmDelete' } as const;

/** Výběr s výchozím profilem (bez přezdívky), EMA a TOM. */
function threeProfiles(): TestProfileScreens {
  return testProfileScreens(deviceWithProfiles([{ nickname: 'EMA' }, { nickname: 'TOM' }]));
}

function profileId(test: TestProfileScreens, index: number): string {
  return test.store.profiles()[index]?.id ?? '';
}

/** Otevře úpravu profilu na pořadí `index` tužkou, přejde do 2. kroku a ťukne na koš. */
function openConfirm(test: TestProfileScreens, index: number): void {
  openEdit(test.screens, profileId(test, index));
  test.screens.tapNext();
  test.screens.tapDelete();
}

/** Odezva od otevření potvrzení dál. */
function feedbackAfter(test: TestProfileScreens, from: number): ProfileFeedback[] {
  return test.feedback.slice(from);
}

/** EMA má uložené hvězdičky v Počítání. */
function giveStarsToEma(test: TestProfileScreens): void {
  const active = test.store.activeProfile().id;
  test.store.selectProfile(profileId(test, 1));
  test.store.gameStorage(GAME).setItem(STARS_KEY, '{"stars":7}');
  test.store.selectProfile(active);
}

/** Potvrzení je pořád otevřené a nic se nesmazalo. */
function expectNothingDeleted(test: TestProfileScreens, before: Record<string, string>): void {
  expect(test.screens.screen()).toBe('confirmDelete');
  expect(test.screens.deleteConfirmProfile()?.nickname).toBe('EMA');
  expect(test.store.profiles()).toHaveLength(3);
  expect(test.storage.snapshot()).toEqual(before);
}

describe('#108 AC1: ťuknutí na „Smazat“ profil nesmaže', () => {
  it('po ťuknutí na „Smazat“ potvrzení zůstane a profil i jeho hvězdičky zůstanou', () => {
    const test = threeProfiles();
    giveStarsToEma(test);
    openConfirm(test, 1);
    const before = test.storage.snapshot();

    test.screens.confirmDeleteButton.press(1);
    test.screens.confirmDeleteButton.release(1);
    vi.advanceTimersByTime(DELETE_PROFILE_HOLD_MS * 2);

    expectNothingDeleted(test, before);
    expect(profileDataKeys(test.storage, profileId(test, 1))).not.toEqual([]);
  });

  it('po ťuknutí se „Smazat“ jen zhoupne', () => {
    const test = threeProfiles();
    openConfirm(test, 1);
    const from = test.feedback.length;

    test.screens.confirmDeleteButton.press(1);
    test.screens.confirmDeleteButton.release(1);

    const events = feedbackAfter(test, from);
    expect(events).toContainEqual(DELETE_WOBBLE);
    expect(events).not.toContainEqual(DELETED_TAP);
    expect(profileFeedbackSound(DELETE_WOBBLE)).toBe('wobble');
  });

  it('ani několik rychlých ťuknutí za sebou profil nesmaže', () => {
    const test = threeProfiles();
    openConfirm(test, 1);
    const before = test.storage.snapshot();

    for (let tap = 0; tap < 5; tap += 1) {
      test.screens.confirmDeleteButton.press(1);
      vi.advanceTimersByTime(100);
      test.screens.confirmDeleteButton.release(1);
      vi.advanceTimersByTime(100);
    }

    expectNothingDeleted(test, before);
  });
});

describe('#108 AC2: podržení „Smazat“ 1 s profil smaže', () => {
  it('podržení 1 s smaže profil i jeho hvězdičky, ostatní profily zůstanou', () => {
    const test = threeProfiles();
    giveStarsToEma(test);
    const ema = profileId(test, 1);
    openConfirm(test, 1);

    holdConfirmDelete(test.screens);

    expect(pickerNicknames(test.screens)).toEqual([null, 'TOM']);
    expect(profileDataKeys(test.storage, ema)).toEqual([]);
    expect(
      openProfiles(test.storage)
        .profiles()
        .map((profile) => profile.nickname),
    ).toEqual([undefined, 'TOM']);
  });

  it('profil se smaže už během držení po 1 s, prst se ještě nemusí zvednout', () => {
    const test = threeProfiles();
    openConfirm(test, 1);

    test.screens.confirmDeleteButton.press(1);
    vi.advanceTimersByTime(DELETE_PROFILE_HOLD_MS);

    expect(test.store.profiles()).toHaveLength(2);
    test.screens.confirmDeleteButton.release(1);
    expect(test.store.profiles()).toHaveLength(2);
  });

  it('podržení 0,99 s profil nesmaže', () => {
    const test = threeProfiles();
    openConfirm(test, 1);
    const before = test.storage.snapshot();

    test.screens.confirmDeleteButton.press(1);
    vi.advanceTimersByTime(990);

    expectNothingDeleted(test, before);
  });

  it('se zbylými dvěma profily se ukáže výběr profilu bez smazaného profilu', () => {
    const test = threeProfiles();
    openConfirm(test, 2);

    holdConfirmDelete(test.screens);

    expect(test.screens.screen()).toBe('picker');
    expect(pickerNicknames(test.screens)).toEqual([null, 'EMA']);
    expect(test.chosen()).toBe(0);
  });

  it('s jedním zbylým profilem se ukáže menu', () => {
    const test = testProfileScreens(deviceWithProfiles([{ nickname: 'EMA' }]));
    openConfirm(test, 1);

    holdConfirmDelete(test.screens);

    expect(test.screens.screen()).toBe('closed');
    expect(test.chosen()).toBe(1);
    expect(pickerNicknames(test.screens)).toEqual([null]);
  });

  it('po smazání zazní stejný zvuk jako dřív po ťuknutí na „Smazat“', () => {
    const test = threeProfiles();
    openConfirm(test, 1);
    const from = test.feedback.length;

    holdConfirmDelete(test.screens);

    const sounds = feedbackAfter(test, from)
      .map(profileFeedbackSound)
      .filter((sound) => sound !== null);
    expect(feedbackAfter(test, from)).toContainEqual(DELETED_TAP);
    expect(sounds).toEqual(['press']);
  });

  it('po smazání jednoho profilu jde podržením smazat i další', () => {
    const test = testProfileScreens(
      deviceWithProfiles([{ nickname: 'EMA' }, { nickname: 'TOM' }, { nickname: 'ANA' }]),
    );
    openConfirm(test, 1);
    holdConfirmDelete(test.screens);

    openConfirm(test, 1);
    holdConfirmDelete(test.screens);

    expect(pickerNicknames(test.screens)).toEqual([null, 'ANA']);
  });

  it('po smazání už další podržení „Smazat“ nic nesmaže', () => {
    const test = testProfileScreens(
      deviceWithProfiles([{ nickname: 'EMA' }, { nickname: 'TOM' }, { nickname: 'ANA' }]),
    );
    openConfirm(test, 1);
    holdConfirmDelete(test.screens);

    holdConfirmDelete(test.screens);

    expect(pickerNicknames(test.screens)).toEqual([null, 'TOM', 'ANA']);
  });
});

describe('#108 AC3: puštění dřív než po 1 s nic nesmaže', () => {
  it('puštění po 0,5 s nic nesmaže a potvrzení zůstane otevřené', () => {
    const test = threeProfiles();
    openConfirm(test, 1);
    const before = test.storage.snapshot();

    holdConfirmDelete(test.screens, 500);
    vi.advanceTimersByTime(DELETE_PROFILE_HOLD_MS);

    expectNothingDeleted(test, before);
  });

  it('další podržení se počítá znovu od nuly', () => {
    const test = threeProfiles();
    openConfirm(test, 1);
    const before = test.storage.snapshot();

    holdConfirmDelete(test.screens, 600);
    holdConfirmDelete(test.screens, 600);
    expectNothingDeleted(test, before);

    holdConfirmDelete(test.screens);
    expect(pickerNicknames(test.screens)).toEqual([null, 'TOM']);
  });
});

describe('#108 AC4: sjetí prstu ze „Smazat“ nic nesmaže', () => {
  it('po sjetí prstu se nic nesmaže, ani když držení doběhne do 1 s', () => {
    const test = threeProfiles();
    openConfirm(test, 1);
    const before = test.storage.snapshot();

    test.screens.confirmDeleteButton.press(1);
    vi.advanceTimersByTime(500);
    test.screens.confirmDeleteButton.leave(1);
    vi.advanceTimersByTime(DELETE_PROFILE_HOLD_MS);

    expectNothingDeleted(test, before);
  });

  it('po sjetí a návratu prstu se nic nesmaže, ani když se prst pak zvedne', () => {
    const test = threeProfiles();
    openConfirm(test, 1);
    const before = test.storage.snapshot();

    test.screens.confirmDeleteButton.press(1);
    vi.advanceTimersByTime(300);
    test.screens.confirmDeleteButton.leave(1);
    vi.advanceTimersByTime(DELETE_PROFILE_HOLD_MS);
    test.screens.confirmDeleteButton.release(1);
    vi.advanceTimersByTime(DELETE_PROFILE_HOLD_MS);

    expectNothingDeleted(test, before);
  });
});

describe('#108 okrajové případy podržení', () => {
  it('druhý prst podržení nepřeruší', () => {
    const test = threeProfiles();
    openConfirm(test, 1);

    test.screens.confirmDeleteButton.press(1);
    vi.advanceTimersByTime(300);
    test.screens.confirmDeleteButton.press(2);
    test.screens.confirmDeleteButton.release(2);
    vi.advanceTimersByTime(DELETE_PROFILE_HOLD_MS - 300);

    expect(pickerNicknames(test.screens)).toEqual([null, 'TOM']);
  });

  it('druhý prst podržení neprodlouží', () => {
    const test = threeProfiles();
    openConfirm(test, 1);

    test.screens.confirmDeleteButton.press(1);
    vi.advanceTimersByTime(600);
    test.screens.confirmDeleteButton.press(2);
    vi.advanceTimersByTime(DELETE_PROFILE_HOLD_MS - 600);

    expect(pickerNicknames(test.screens)).toEqual([null, 'TOM']);
  });

  it('druhý prst, který zůstane po puštění prvního, nic nesmaže', () => {
    const test = threeProfiles();
    openConfirm(test, 1);
    const before = test.storage.snapshot();

    test.screens.confirmDeleteButton.press(1);
    vi.advanceTimersByTime(300);
    test.screens.confirmDeleteButton.press(2);
    test.screens.confirmDeleteButton.release(1);
    vi.advanceTimersByTime(DELETE_PROFILE_HOLD_MS * 2);

    expectNothingDeleted(test, before);
  });

  it('přerušení dotyku prohlížečem (pointercancel) nic nesmaže a „Smazat“ se nezhoupne', () => {
    const test = threeProfiles();
    openConfirm(test, 1);
    const before = test.storage.snapshot();
    const from = test.feedback.length;

    test.screens.confirmDeleteButton.press(1);
    vi.advanceTimersByTime(500);
    test.screens.confirmDeleteButton.cancel(1);
    vi.advanceTimersByTime(DELETE_PROFILE_HOLD_MS);

    expectNothingDeleted(test, before);
    expect(feedbackAfter(test, from)).not.toContainEqual(DELETE_WOBBLE);
  });

  it('ťuknutí na „Zpět“ během držení „Smazat“ nic nesmaže', () => {
    const test = threeProfiles();
    openConfirm(test, 1);

    test.screens.confirmDeleteButton.press(1);
    vi.advanceTimersByTime(500);
    test.screens.tapCancelDelete();
    vi.advanceTimersByTime(DELETE_PROFILE_HOLD_MS);
    test.screens.confirmDeleteButton.release(1);

    expect(test.screens.screen()).toBe('color');
    expect(test.store.profiles()).toHaveLength(3);
  });

  it('mimo potvrzení podržení „Smazat“ nic nesmaže', () => {
    const test = threeProfiles();
    openEdit(test.screens, profileId(test, 1));
    test.screens.tapNext();

    holdConfirmDelete(test.screens);

    expect(test.screens.screen()).toBe('color');
    expect(test.store.profiles()).toHaveLength(3);
  });
});

describe('#108 AC5: „Zpět“ v potvrzení reaguje hned ťuknutím', () => {
  it('ťuknutí na „Zpět“ vrátí 2. krok s rozepsanou přezdívkou a barvou a nic nesmaže', () => {
    const test = threeProfiles();
    const before = test.storage.snapshot();
    openEdit(test.screens, profileId(test, 1));
    clearNickname(test.screens);
    typeNickname(test.screens, 'EMIL');
    test.screens.tapNext();
    test.screens.tapColor(PROFILE_COLORS[6]);
    test.screens.tapDelete();

    test.screens.tapCancelDelete();

    expect(test.screens.screen()).toBe('color');
    expect(test.screens.formMode()).toBe('edit');
    expect(test.screens.nickname()).toBe('EMIL');
    expect(test.screens.selectedColor()).toBe(PROFILE_COLORS[6]);
    expect(test.storage.snapshot()).toEqual(before);
  });

  it('„Zpět“ dostane zmáčknutí a zvuk hned po ťuknutí, bez čekání', () => {
    const test = threeProfiles();
    openConfirm(test, 1);
    const from = test.feedback.length;

    test.screens.tapCancelDelete();

    expect(feedbackAfter(test, from)).toEqual([{ kind: 'tap', target: 'cancelDelete' }]);
  });
});

describe('#108 AC6: smazání, které se nepovede, nic nerozbije', () => {
  it('když se seznam nepodaří uložit, profil zůstane, ukáže se 2. krok a koš se zhoupne', () => {
    const test = threeProfiles();
    openConfirm(test, 1);
    const before = test.storage.snapshot();
    const from = test.feedback.length;
    test.storage.failWrite = (key) => key === PROFILE_LIST_KEY;

    expect(() => holdConfirmDelete(test.screens)).not.toThrow();

    expect(test.screens.screen()).toBe('color');
    expect(test.screens.formMode()).toBe('edit');
    expect(test.screens.nickname()).toBe('EMA');
    expect(feedbackAfter(test, from)).toContainEqual({ kind: 'wobble', target: 'delete' });
    expect(feedbackAfter(test, from)).not.toContainEqual(DELETED_TAP);
    expect(test.storage.snapshot()).toEqual(before);
    expect(pickerNicknames(test.screens)).toEqual([null, 'EMA', 'TOM']);
  });

  it('po nepovedeném smazání jde potvrzení otevřít znovu a smazat, až úložiště funguje', () => {
    const test = threeProfiles();
    openConfirm(test, 1);
    test.storage.failWrite = (key) => key === PROFILE_LIST_KEY;
    holdConfirmDelete(test.screens);
    test.storage.failWrite = () => false;

    test.screens.tapDelete();
    holdConfirmDelete(test.screens);

    expect(pickerNicknames(test.screens)).toEqual([null, 'TOM']);
  });
});

describe('#108 AC7: kroužek kolem „Smazat“ (logika, animace ručně)', () => {
  it('během podržení se kroužek plní a po puštění zmizí', () => {
    const test = threeProfiles();
    openConfirm(test, 1);
    const from = test.feedback.length;

    test.screens.confirmDeleteButton.press(1);
    expect(test.screens.confirmDeleteButton.isHolding()).toBe(true);
    vi.advanceTimersByTime(400);
    test.screens.confirmDeleteButton.release(1);

    expect(test.screens.confirmDeleteButton.isHolding()).toBe(false);
    const ring = feedbackAfter(test, from).filter((event) => event.kind === 'deleteHolding');
    expect(ring).toEqual([
      { kind: 'deleteHolding', holding: true },
      { kind: 'deleteHolding', holding: false },
    ]);
    for (const event of ring) {
      expect(profileFeedbackSound(event)).toBeNull();
    }
  });
});
