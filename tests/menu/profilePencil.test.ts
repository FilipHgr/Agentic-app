import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { profileFeedbackSound } from '../../src/menu/logic/profileScreens';
import type { ProfileFeedback } from '../../src/menu/logic/profileScreens';
import {
  ONE_SECOND_HOLD_MS,
  deviceWithProfiles,
  pressProfileFor,
  openEdit,
  tapEditPencil,
  tapProfileCircle,
  testProfileScreens,
} from './profileScreenFixtures';
import type { TestProfileScreens } from './profileScreenFixtures';

/**
 * Testy k #107 (tužka u každého profilu otevře jeho úpravu) na obrazovkách
 * profilů: AC1 (ťuknutí na tužku), AC2 (ťuknutí na kolečko dál vybere),
 * AC3 (tužka i u jediného profilu, u „+“ není) a AC5 (podržení kolečka dál
 * otevře úpravu; od #109 nahrazeno: úprava jen tužkou, podržení kolečka
 * profil vybere, viz `profilePickerTap.test.ts`).
 *
 * #160: tužka u každého kolečka je nahrazená jedinou tužkou v liště, která
 * přepne výběr do režimu úprav; úpravu pak otevře ťuknutí na kolečko.
 * „Tužka u profilu X“ je proto v testech níž `openEdit` (tužka v liště
 * a kolečko X) a dotyk tužky je dotyk tužky v liště (`editPencilButton`).
 * Chování z #107 (úprava právě toho profilu, bez podržení, zrušený dotyk
 * nic neudělá) zůstává. Nové chování režimu úprav testuje
 * `profileEditMode.test.ts`, rozložení `profileEditModeLayout.test.ts`.
 *
 * Rozhraní (`src/menu/logic/profileScreens.ts`): `editPencilButton`
 * a `isEditing()` z #160 místo `pencilButton(id)` z #107, odezva tužky
 * dál `{ kind: 'tap', target: 'pencil' }`;
 * `profileFeedbackSound(event): MenuSoundName | null` beze změny.
 */

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

/** Výběr s výchozím profilem (bez přezdívky, první barva), EMA a TOM. */
function threeProfiles(): TestProfileScreens {
  return testProfileScreens(deviceWithProfiles([{ nickname: 'EMA' }, { nickname: 'TOM' }]));
}

function profileAt(test: TestProfileScreens, index: number): { id: string; color: string } {
  const profile = test.store.profiles()[index];
  return { id: profile?.id ?? '', color: profile?.color ?? '' };
}

function taps(feedback: readonly ProfileFeedback[]): ProfileFeedback[] {
  return feedback.filter((event) => event.kind === 'tap');
}

describe('#107 AC1: ťuknutí na tužku otevře úpravu právě toho profilu', () => {
  it('ťuknutí na tužku u TOM otevře 1. krok úpravy s přezdívkou TOM', () => {
    const test = threeProfiles();

    openEdit(test.screens, profileAt(test, 2).id);

    expect(test.screens.screen()).toBe('nickname');
    expect(test.screens.formMode()).toBe('edit');
    expect(test.screens.nickname()).toBe('TOM');
  });

  it('ve 2. kroku úpravy otevřené tužkou je předvybraná barva profilu', () => {
    const test = threeProfiles();
    const tom = profileAt(test, 2);

    openEdit(test.screens, tom.id);
    test.screens.tapNext();

    expect(test.screens.screen()).toBe('color');
    expect(test.screens.selectedColor()).toBe(tom.color);
  });

  it('tužka u prostředního profilu neotevře jiný profil', () => {
    const test = threeProfiles();

    openEdit(test.screens, profileAt(test, 1).id);

    expect(test.screens.nickname()).toBe('EMA');
  });

  it('ťuknutí na tužku profil nevybere a stránka neukáže menu', () => {
    const test = threeProfiles();
    const activeBefore = test.store.activeProfile().id;

    openEdit(test.screens, profileAt(test, 2).id);

    expect(test.chosen()).toBe(0);
    expect(test.store.activeProfile().id).toBe(activeBefore);
    expect(test.screens.screen()).not.toBe('closed');
  });

  it('profil bez přezdívky otevře tužka s prázdným polem a jde rovnou dál', () => {
    const test = threeProfiles();
    const withoutNickname = profileAt(test, 0);

    openEdit(test.screens, withoutNickname.id);

    expect(test.screens.formMode()).toBe('edit');
    expect(test.screens.nickname()).toBe('');
    expect(test.screens.canGoNext()).toBe(true);
    test.screens.tapNext();
    expect(test.screens.selectedColor()).toBe(withoutNickname.color);
  });

  it('ťuknutí na tužku zahraje stejný zvuk jako ťuknutí na kolečko profilu', () => {
    const pencilTest = threeProfiles();
    tapEditPencil(pencilTest.screens);
    const pencilTaps = taps(pencilTest.feedback);

    const circleTest = threeProfiles();
    tapProfileCircle(circleTest.screens, profileAt(circleTest, 2).id);
    const circleTap = taps(circleTest.feedback).at(-1);

    expect(pencilTaps, 'tužka dá právě jednu odezvu ťuknutí').toHaveLength(1);
    expect(circleTap, 'kolečko dá odezvu ťuknutí').toBeDefined();
    const pencilSound = profileFeedbackSound(pencilTaps[0] as ProfileFeedback);
    const circleSound = profileFeedbackSound(circleTap as ProfileFeedback);
    expect(circleSound, 'ťuknutí na kolečko má zvuk').not.toBeNull();
    expect(pencilSound).toBe(circleSound);
  });

  it('tužka se nezhoupne ani nezačne plnit kroužek, úprava se otevře hned po ťuknutí', () => {
    const test = threeProfiles();

    openEdit(test.screens, profileAt(test, 2).id);

    const kinds = test.feedback.map((event) => event.kind);
    expect(kinds).not.toContain('wobble');
    expect(kinds).not.toContain('profileHolding');
    expect(test.screens.screen()).toBe('nickname');
  });

  // #160: dotyk tužky v liště; po zvednutí je výběr v úpravách, úpravu TOM otevře kolečko.
  it('tužka nečeká na podržení: i dotyk delší než 1 s přepne do úprav jen jednou', () => {
    const test = threeProfiles();
    const pencil = test.screens.editPencilButton;

    pencil.press(1);
    vi.advanceTimersByTime(ONE_SECOND_HOLD_MS + 500);
    expect(test.screens.isEditing(), 'během držení se ještě nic nepřepne').toBe(false);
    pencil.release(1);
    expect(test.screens.isEditing()).toBe(true);
    expect(taps(test.feedback)).toHaveLength(1);

    tapProfileCircle(test.screens, profileAt(test, 2).id);
    expect(test.screens.screen()).toBe('nickname');
    expect(test.screens.nickname()).toBe('TOM');
  });

  it('když prst z tužky sjede a zvedne se jinde, nestane se nic', () => {
    const test = threeProfiles();
    const pencil = test.screens.editPencilButton;

    pencil.press(1);
    pencil.leave(1);
    pencil.release(1);

    expect(test.screens.screen()).toBe('picker');
    expect(test.screens.isEditing()).toBe(false);
    expect(test.chosen()).toBe(0);
    expect(taps(test.feedback)).toHaveLength(0);
  });

  it('když prohlížeč dotyk na tužce přeruší (pointercancel), nestane se nic', () => {
    const test = threeProfiles();
    const pencil = test.screens.editPencilButton;

    pencil.press(1);
    pencil.cancel(1);
    pencil.release(1);

    expect(test.screens.screen()).toBe('picker');
    expect(test.screens.isEditing()).toBe(false);
    expect(test.chosen()).toBe(0);
    expect(taps(test.feedback)).toHaveLength(0);
  });

  it('prst, který začal jinde a zvedl se na tužce, do úprav nepřepne', () => {
    const test = threeProfiles();

    test.screens.editPencilButton.release(1);

    expect(test.screens.screen()).toBe('picker');
    expect(test.screens.isEditing()).toBe(false);
  });

  it('zvednutí jiného prstu, než který tužku zmáčkl, do úprav nepřepne', () => {
    const test = threeProfiles();
    const pencil = test.screens.editPencilButton;

    pencil.press(1);
    pencil.release(2);

    expect(test.screens.screen()).toBe('picker');
    expect(test.screens.isEditing()).toBe(false);
  });

  it('po zrušeném dotyku jde tužku hned ťuknout znovu', () => {
    const test = threeProfiles();
    const tom = profileAt(test, 2).id;
    const pencil = test.screens.editPencilButton;
    pencil.press(1);
    pencil.cancel(1);

    tapEditPencil(test.screens, 2);
    tapProfileCircle(test.screens, tom, 2);

    expect(test.screens.nickname()).toBe('TOM');
  });

  it('„Zpět“ z úpravy otevřené tužkou vrátí výběr a profil zůstane beze změny', () => {
    const test = threeProfiles();
    const before = test.store.profiles();

    openEdit(test.screens, profileAt(test, 2).id);
    test.screens.tapBack();

    expect(test.screens.screen()).toBe('picker');
    expect(test.store.profiles()).toEqual(before);
    expect(test.chosen()).toBe(0);
  });

  it('mimo výběr profilu (otevřený formulář nebo menu) tužka nic neotevře', () => {
    const test = threeProfiles();
    const tom = profileAt(test, 2).id;
    const ema = profileAt(test, 1).id;
    openEdit(test.screens, ema);

    // #160: ve formuláři nepřepne tužka v liště ani kolečko TOM.
    openEdit(test.screens, tom);
    expect(test.screens.nickname(), 've formuláři zůstane úprava EMA').toBe('EMA');

    test.screens.tapBack();
    tapProfileCircle(test.screens, ema);
    expect(test.screens.screen()).toBe('closed');
    tapEditPencil(test.screens);
    expect(test.screens.isEditing(), 'v menu se do úprav nepřepne').toBe(false);
    expect(test.screens.screen(), 'v menu se úprava neotevře').toBe('closed');
  });

  it('tužka u profilu, který už neexistuje, nic neotevře', () => {
    const test = threeProfiles();

    openEdit(test.screens, 'neexistujici-profil');

    expect(test.screens.screen()).toBe('picker');
    expect(test.chosen()).toBe(0);
  });
});

describe('#107 AC2: ťuknutí na kolečko profilu dál profil vybere', () => {
  it('ťuknutí na kolečko TOM úpravu neotevře, vybere TOM a stránka ukáže menu', () => {
    const test = threeProfiles();
    const tom = profileAt(test, 2).id;

    tapProfileCircle(test.screens, tom);

    expect(test.screens.formMode()).toBeNull();
    expect(test.screens.screen()).toBe('closed');
    expect(test.store.activeProfile().id).toBe(tom);
    expect(test.chosen()).toBe(1);
  });
});

// #160: místo tužky u každého kolečka jedna tužka v liště, úpravu otevře i u jediného profilu.
describe('#107 AC3: úprava jde otevřít u každého profilu, i u jediného', () => {
  it('s jediným profilem (bez přezdívky) tužka otevře jeho úpravu', () => {
    const test = testProfileScreens();
    const only = profileAt(test, 0);
    expect(test.store.profiles()).toHaveLength(1);

    openEdit(test.screens, only.id);

    expect(test.screens.formMode()).toBe('edit');
    expect(test.screens.nickname()).toBe('');
  });

  it('tužka u každého ze šesti profilů otevře úpravu svého profilu', () => {
    const test = testProfileScreens(
      deviceWithProfiles([
        { nickname: 'EMA' },
        { nickname: 'TOM' },
        { nickname: 'ANA' },
        { nickname: 'MAX' },
        { nickname: 'OLA' },
      ]),
    );
    const items = test.screens.pickerItems();
    expect(items).toHaveLength(6);

    for (const item of items) {
      openEdit(test.screens, item.id);
      expect(test.screens.nickname(), `tužka u ${item.nickname ?? '★'}`).toBe(item.nickname ?? '');
      test.screens.tapBack();
    }
  });
});

describe('#107 AC5 (od #109 nahrazeno): úprava se otevře jen tužkou, ne podržením kolečka', () => {
  it('podržení kolečka TOM 1 s úpravu neotevře, TOM se vybere a tužka úpravu TOM otevře', () => {
    const test = threeProfiles();
    const tom = profileAt(test, 2).id;

    pressProfileFor(test.screens, tom, ONE_SECOND_HOLD_MS);

    expect(test.screens.formMode(), 'podržení úpravu neotevře').toBeNull();
    expect(test.store.activeProfile().id).toBe(tom);
    expect(test.chosen()).toBe(1);

    test.screens.open();
    openEdit(test.screens, tom);
    expect(test.screens.formMode()).toBe('edit');
    expect(test.screens.nickname()).toBe('TOM');
  });
});
