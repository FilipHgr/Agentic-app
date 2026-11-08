import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { profileFeedbackSound } from '../../src/menu/logic/profileScreens';
import type { ProfileFeedback } from '../../src/menu/logic/profileScreens';
import {
  EDIT_PROFILE_HOLD_MS,
  deviceWithProfiles,
  holdProfile,
  tapPencil,
  tapProfileCircle,
  testProfileScreens,
} from './profileScreenFixtures';
import type { TestProfileScreens } from './profileScreenFixtures';

/**
 * Testy k #107 (tužka u každého profilu otevře jeho úpravu) na obrazovkách
 * profilů: AC1 (ťuknutí na tužku), AC2 (ťuknutí na kolečko dál vybere),
 * AC3 (tužka i u jediného profilu, u „+“ není) a AC5 (podržení kolečka dál
 * otevře úpravu). Rozložení tužky (AC3, AC4) testuje
 * `tests/menu/profilePencilLayout.test.ts`, vzhled (AC6) se kontroluje ručně.
 *
 * Navržené rozhraní (`src/menu/logic/profileScreens.ts`), navíc k #73:
 * - `pencilButton(id): PencilButton` pro tužku u profilu `id` na výběru,
 *   `PencilButton` má `press(pointerId)`, `release(pointerId)`,
 *   `leave(pointerId)` (prst sjel z tužky) a `cancel(pointerId)`
 *   (pointercancel). Úprava se otevře jen po `press` a `release` stejného
 *   prstu bez `leave` a `cancel` mezi nimi; tužka nečeká na podržení.
 *   Po otevření úpravy je odezva `{ kind: 'tap', target: 'pencil' }`.
 * - `profileFeedbackSound(event): MenuSoundName | null`: který zvuk menu
 *   (`MENU_SOUNDS`) scéna k odezvě zahraje, `null` bez zvuku. Dnes je to
 *   rozhodování ve scéně (`ProfileScene.playSoundOf`), přesune se do logiky,
 *   aby šlo ověřit, že tužka zní stejně jako ťuknutí na kolečko profilu.
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

    tapPencil(test.screens, profileAt(test, 2).id);

    expect(test.screens.screen()).toBe('nickname');
    expect(test.screens.formMode()).toBe('edit');
    expect(test.screens.nickname()).toBe('TOM');
  });

  it('ve 2. kroku úpravy otevřené tužkou je předvybraná barva profilu', () => {
    const test = threeProfiles();
    const tom = profileAt(test, 2);

    tapPencil(test.screens, tom.id);
    test.screens.tapNext();

    expect(test.screens.screen()).toBe('color');
    expect(test.screens.selectedColor()).toBe(tom.color);
  });

  it('tužka u prostředního profilu neotevře jiný profil', () => {
    const test = threeProfiles();

    tapPencil(test.screens, profileAt(test, 1).id);

    expect(test.screens.nickname()).toBe('EMA');
  });

  it('ťuknutí na tužku profil nevybere a stránka neukáže menu', () => {
    const test = threeProfiles();
    const activeBefore = test.store.activeProfile().id;

    tapPencil(test.screens, profileAt(test, 2).id);

    expect(test.chosen()).toBe(0);
    expect(test.store.activeProfile().id).toBe(activeBefore);
    expect(test.screens.screen()).not.toBe('closed');
  });

  it('profil bez přezdívky otevře tužka s prázdným polem a jde rovnou dál', () => {
    const test = threeProfiles();
    const withoutNickname = profileAt(test, 0);

    tapPencil(test.screens, withoutNickname.id);

    expect(test.screens.formMode()).toBe('edit');
    expect(test.screens.nickname()).toBe('');
    expect(test.screens.canGoNext()).toBe(true);
    test.screens.tapNext();
    expect(test.screens.selectedColor()).toBe(withoutNickname.color);
  });

  it('ťuknutí na tužku zahraje stejný zvuk jako ťuknutí na kolečko profilu', () => {
    const pencilTest = threeProfiles();
    tapPencil(pencilTest.screens, profileAt(pencilTest, 2).id);
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

    tapPencil(test.screens, profileAt(test, 2).id);

    const kinds = test.feedback.map((event) => event.kind);
    expect(kinds).not.toContain('wobble');
    expect(kinds).not.toContain('profileHolding');
    expect(test.screens.screen()).toBe('nickname');
  });

  it('tužka nečeká na podržení: i dotyk delší než 1 s otevře úpravu jen jednou', () => {
    const test = threeProfiles();
    const pencil = test.screens.pencilButton(profileAt(test, 2).id);

    pencil.press(1);
    vi.advanceTimersByTime(EDIT_PROFILE_HOLD_MS + 500);
    expect(test.screens.screen(), 'během držení se ještě nic neotevře').toBe('picker');
    pencil.release(1);

    expect(test.screens.screen()).toBe('nickname');
    expect(test.screens.nickname()).toBe('TOM');
    expect(taps(test.feedback)).toHaveLength(1);
  });

  it('když prst z tužky sjede a zvedne se jinde, nestane se nic', () => {
    const test = threeProfiles();
    const pencil = test.screens.pencilButton(profileAt(test, 2).id);

    pencil.press(1);
    pencil.leave(1);
    pencil.release(1);

    expect(test.screens.screen()).toBe('picker');
    expect(test.chosen()).toBe(0);
    expect(taps(test.feedback)).toHaveLength(0);
  });

  it('když prohlížeč dotyk na tužce přeruší (pointercancel), nestane se nic', () => {
    const test = threeProfiles();
    const pencil = test.screens.pencilButton(profileAt(test, 2).id);

    pencil.press(1);
    pencil.cancel(1);
    pencil.release(1);

    expect(test.screens.screen()).toBe('picker');
    expect(test.chosen()).toBe(0);
    expect(taps(test.feedback)).toHaveLength(0);
  });

  it('prst, který začal jinde a zvedl se na tužce, úpravu neotevře', () => {
    const test = threeProfiles();
    const pencil = test.screens.pencilButton(profileAt(test, 2).id);

    pencil.release(1);

    expect(test.screens.screen()).toBe('picker');
  });

  it('zvednutí jiného prstu, než který tužku zmáčkl, úpravu neotevře', () => {
    const test = threeProfiles();
    const pencil = test.screens.pencilButton(profileAt(test, 2).id);

    pencil.press(1);
    pencil.release(2);

    expect(test.screens.screen()).toBe('picker');
  });

  it('po zrušeném dotyku jde tužku hned ťuknout znovu', () => {
    const test = threeProfiles();
    const tom = profileAt(test, 2).id;
    const pencil = test.screens.pencilButton(tom);
    pencil.press(1);
    pencil.cancel(1);

    tapPencil(test.screens, tom, 2);

    expect(test.screens.nickname()).toBe('TOM');
  });

  it('„Zpět“ z úpravy otevřené tužkou vrátí výběr a profil zůstane beze změny', () => {
    const test = threeProfiles();
    const before = test.store.profiles();

    tapPencil(test.screens, profileAt(test, 2).id);
    test.screens.tapBack();

    expect(test.screens.screen()).toBe('picker');
    expect(test.store.profiles()).toEqual(before);
    expect(test.chosen()).toBe(0);
  });

  it('mimo výběr profilu (otevřený formulář nebo menu) tužka nic neotevře', () => {
    const test = threeProfiles();
    const tom = profileAt(test, 2).id;
    const ema = profileAt(test, 1).id;
    tapPencil(test.screens, ema);

    tapPencil(test.screens, tom);
    expect(test.screens.nickname(), 've formuláři zůstane úprava EMA').toBe('EMA');

    test.screens.tapBack();
    tapProfileCircle(test.screens, ema);
    expect(test.screens.screen()).toBe('closed');
    tapPencil(test.screens, tom);
    expect(test.screens.screen(), 'v menu se úprava neotevře').toBe('closed');
  });

  it('tužka u profilu, který už neexistuje, nic neotevře', () => {
    const test = threeProfiles();

    tapPencil(test.screens, 'neexistujici-profil');

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

describe('#107 AC3: tužka je u každého profilu, i u jediného', () => {
  it('s jediným profilem (bez přezdívky) tužka otevře jeho úpravu', () => {
    const test = testProfileScreens();
    const only = profileAt(test, 0);
    expect(test.store.profiles()).toHaveLength(1);

    tapPencil(test.screens, only.id);

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
      tapPencil(test.screens, item.id);
      expect(test.screens.nickname(), `tužka u ${item.nickname ?? '★'}`).toBe(item.nickname ?? '');
      test.screens.tapBack();
    }
  });
});

describe('#107 AC5: podržení kolečka profilu 1 s dál otevře úpravu', () => {
  it('podržení kolečka TOM 1 s otevře úpravu TOM a profil nevybere', () => {
    const test = threeProfiles();

    holdProfile(test.screens, profileAt(test, 2).id);

    expect(test.screens.formMode()).toBe('edit');
    expect(test.screens.nickname()).toBe('TOM');
    expect(test.chosen()).toBe(0);
  });
});
