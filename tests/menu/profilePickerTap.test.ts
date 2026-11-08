import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MAX_PROFILES, profileFeedbackSound } from '../../src/menu/logic/profileScreens';
import type { ProfileFeedback } from '../../src/menu/logic/profileScreens';
import {
  ONE_SECOND_HOLD_MS,
  deviceWithProfiles,
  pressAddFor,
  pressProfileFor,
  tapAdd,
  tapPencil,
  tapProfileCircle,
  testProfileScreens,
} from './profileScreenFixtures';
import type { TestProfileScreens } from './profileScreenFixtures';

/**
 * Testy k #109: na výběru profilu reagují kolečka profilů i „+“ hned po
 * ťuknutí, bez kroužku podržení. Úprava profilu se otevírá jen tužkou (#107).
 * AC5 (kolečko nastavení a domeček ve hrách dál podržením 1 s) testují
 * `tests/shared/settings.test.ts` a `tests/shared/homeButton.test.ts`,
 * AC6 (kroužek se nikde nekreslí) se kontroluje ručně.
 *
 * Navržené rozhraní (`src/menu/logic/profileScreens.ts`), místo #72 a #73:
 * - `profileButton(id): TapButton` (`./tapButton`, jako tužka z #107):
 *   profil se vybere po `press` a `release` stejného prstu bez `leave`
 *   a `cancel` mezi nimi, ať prst držel jakkoli dlouho; odezva
 *   `{ kind: 'tap', target: 'profile' }` (dnešní zvuk výběru profilu),
 * - `addButton: TapButton`: stejně otevře 1. krok nového profilu, odezva
 *   `{ kind: 'tap', target: 'add' }` se stejným zvukem jako výběr profilu,
 *   „+“ se už nehoupe,
 * - zmizí `ADD_PROFILE_HOLD_MS`, `EDIT_PROFILE_HOLD_MS` a odezvy
 *   `addHolding` a `profileHolding`; `DELETE_PROFILE_HOLD_MS`
 *   a `deleteHolding` (#108) zůstávají.
 */

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

/** Delší dotyk, než trvá podržení ve hře. */
const LONG_TOUCH_MS = 3000;

/** Výběr s výchozím profilem (bez přezdívky), EMA a TOM. */
function threeProfiles(): TestProfileScreens {
  return testProfileScreens(deviceWithProfiles([{ nickname: 'EMA' }, { nickname: 'TOM' }]));
}

function profileId(test: TestProfileScreens, index: number): string {
  return test.store.profiles()[index]?.id ?? '';
}

function taps(feedback: readonly ProfileFeedback[]): ProfileFeedback[] {
  return feedback.filter((event) => event.kind === 'tap');
}

/** Odezvy, které by na výběru profilu kreslily kroužek podržení. */
function holdingRings(feedback: readonly ProfileFeedback[]): ProfileFeedback[] {
  return feedback.filter((event) => event.kind.endsWith('Holding'));
}

/** Výběr zůstal otevřený, nic se nevybralo ani neotevřelo. */
function expectNothingHappened(test: TestProfileScreens, activeBefore: string): void {
  expect(test.screens.screen(), 'výběr profilu zůstane').toBe('picker');
  expect(test.screens.formMode(), 'formulář se neotevře').toBeNull();
  expect(test.store.activeProfile().id, 'aktivní profil se nezmění').toBe(activeBefore);
  expect(test.chosen(), 'stránka neukáže menu').toBe(0);
  expect(taps(test.feedback), 'žádná odezva ťuknutí').toHaveLength(0);
}

describe('#109 AC1: profil se vybere hned po zvednutí prstu z kolečka', () => {
  it('ťuknutí na kolečko TOM vybere TOM a stránka ukáže menu', () => {
    const test = threeProfiles();
    const tom = profileId(test, 2);

    tapProfileCircle(test.screens, tom);

    expect(test.store.activeProfile().id).toBe(tom);
    expect(test.screens.screen()).toBe('closed');
    expect(test.chosen()).toBe(1);
  });

  it('profil se vybere až po zvednutí prstu, dotyk sám nic nevybere', () => {
    const test = threeProfiles();
    const before = test.store.activeProfile().id;
    const button = test.screens.profileButton(profileId(test, 2));

    button.press(1);
    expectNothingHappened(test, before);

    button.release(1);
    expect(test.chosen()).toBe(1);
  });

  it('ťuknutí zahraje dnešní zvuk výběru profilu, a to jen jednou', () => {
    const test = threeProfiles();

    tapProfileCircle(test.screens, profileId(test, 1));

    const tapEvents = taps(test.feedback);
    expect(tapEvents).toEqual([{ kind: 'tap', target: 'profile' }]);
    expect(profileFeedbackSound(tapEvents[0] as ProfileFeedback), 'zvuk výběru profilu').toBe(
      'press',
    );
  });

  it('při dotyku ani během držení kolečka se neplní žádný kroužek', () => {
    const test = threeProfiles();
    const button = test.screens.profileButton(profileId(test, 1));

    button.press(1);
    vi.advanceTimersByTime(LONG_TOUCH_MS);
    button.release(1);

    expect(holdingRings(test.feedback)).toEqual([]);
  });

  it('ťuknutí na už aktivní profil jen ukáže menu se stejným profilem', () => {
    const test = threeProfiles();
    const active = test.store.activeProfile().id;

    tapProfileCircle(test.screens, active);

    expect(test.store.activeProfile().id).toBe(active);
    expect(test.chosen()).toBe(1);
  });
});

describe('#109 AC2: ťuknutí na „+“ hned otevře formulář nového profilu', () => {
  it('ťuknutí na „+“ otevře 1. krok nového profilu s prázdným polem', () => {
    const test = threeProfiles();

    tapAdd(test.screens);

    expect(test.screens.screen()).toBe('nickname');
    expect(test.screens.formMode()).toBe('new');
    expect(test.screens.nickname()).toBe('');
    expect(test.chosen(), 'nový profil se nevybírá').toBe(0);
  });

  it('„+“ se po ťuknutí už jen nezhoupne', () => {
    const test = threeProfiles();

    tapAdd(test.screens);

    expect(test.feedback).not.toContainEqual({ kind: 'wobble', target: 'add' });
  });

  it('ťuknutí na „+“ zahraje stejný zvuk jako výběr profilu', () => {
    const addTest = threeProfiles();
    tapAdd(addTest.screens);
    const addTaps = taps(addTest.feedback);

    const circleTest = threeProfiles();
    tapProfileCircle(circleTest.screens, profileId(circleTest, 1));
    const circleTaps = taps(circleTest.feedback);

    expect(addTaps, '„+“ dá právě jednu odezvu ťuknutí').toHaveLength(1);
    expect(circleTaps, 'kolečko dá právě jednu odezvu ťuknutí').toHaveLength(1);
    const addSound = profileFeedbackSound(addTaps[0] as ProfileFeedback);
    const circleSound = profileFeedbackSound(circleTaps[0] as ProfileFeedback);
    expect(addSound, '„+“ má zvuk').not.toBeNull();
    expect(addSound).toBe(circleSound);
  });

  it('formulář se otevře až po zvednutí prstu z „+“', () => {
    const test = threeProfiles();
    const before = test.store.activeProfile().id;

    test.screens.addButton.press(1);
    expectNothingHappened(test, before);

    test.screens.addButton.release(1);
    expect(test.screens.formMode()).toBe('new');
  });

  it('při dotyku ani během držení „+“ se neplní žádný kroužek', () => {
    const test = threeProfiles();

    pressAddFor(test.screens, LONG_TOUCH_MS);

    expect(holdingRings(test.feedback)).toEqual([]);
  });

  it('s 6 profily se „+“ neukáže a ťuknutí na jeho místo nic neotevře', () => {
    const test = testProfileScreens(
      deviceWithProfiles(['EMA', 'TOM', 'ANA', 'MAX', 'OLA'].map((nickname) => ({ nickname }))),
    );
    const before = test.store.activeProfile().id;
    expect(test.store.profiles()).toHaveLength(MAX_PROFILES);

    expect(test.screens.canAddProfile()).toBe(false);
    tapAdd(test.screens);

    expectNothingHappened(test, before);
  });

  it('s 5 profily jde ťuknutím na „+“ založit šestý a pak „+“ zmizí', () => {
    const test = testProfileScreens(
      deviceWithProfiles(['EMA', 'TOM', 'ANA', 'MAX'].map((nickname) => ({ nickname }))),
    );

    tapAdd(test.screens);
    expect(test.screens.formMode()).toBe('new');
    test.screens.tapLetter('O');
    test.screens.tapNext();
    test.screens.tapSave();

    expect(test.store.profiles()).toHaveLength(MAX_PROFILES);
    expect(test.screens.screen()).toBe('picker');
    expect(test.screens.canAddProfile()).toBe(false);
  });
});

describe('#109 AC3: žádný dotyk kolečka ani „+“ neotevře úpravu', () => {
  it.each([
    ['0,99 s', ONE_SECOND_HOLD_MS - 10],
    ['1 s', ONE_SECOND_HOLD_MS],
    ['3 s', LONG_TOUCH_MS],
  ])('prst na kolečku %s a zvednutí profil vybere jako po ťuknutí, úprava se neotevře', (_, ms) => {
    const test = threeProfiles();
    const tom = profileId(test, 2);

    pressProfileFor(test.screens, tom, ms);

    expect(test.screens.formMode(), 'úprava se neotevře').toBeNull();
    expect(test.store.activeProfile().id).toBe(tom);
    expect(test.screens.screen()).toBe('closed');
    expect(test.chosen()).toBe(1);
    expect(taps(test.feedback)).toEqual([{ kind: 'tap', target: 'profile' }]);
  });

  it('když prst zůstane na kolečku 1 s, během držení se nic neotevře ani nevybere', () => {
    const test = threeProfiles();
    const before = test.store.activeProfile().id;
    const button = test.screens.profileButton(profileId(test, 2));

    button.press(1);
    vi.advanceTimersByTime(ONE_SECOND_HOLD_MS);

    expectNothingHappened(test, before);
    button.release(1);
  });

  it.each([
    ['1 s', ONE_SECOND_HOLD_MS],
    ['3 s', LONG_TOUCH_MS],
  ])('prst na „+“ %s a zvednutí otevře formulář nového profilu jen jednou', (_, ms) => {
    const test = threeProfiles();

    pressAddFor(test.screens, ms);
    test.screens.addButton.release(1);

    expect(test.screens.formMode()).toBe('new');
    expect(test.screens.nickname()).toBe('');
    expect(taps(test.feedback), 'jedna odezva ťuknutí').toHaveLength(1);
  });

  it('když prst zůstane na „+“ 1 s, formulář se během držení neotevře', () => {
    const test = threeProfiles();
    const before = test.store.activeProfile().id;

    test.screens.addButton.press(1);
    vi.advanceTimersByTime(ONE_SECOND_HOLD_MS);

    expectNothingHappened(test, before);
    test.screens.addButton.release(1);
  });

  it('formulář otevřený dlouhým dotykem „+“ je nový profil, ne úprava', () => {
    const test = threeProfiles();

    pressAddFor(test.screens, LONG_TOUCH_MS);

    expect(test.screens.formMode()).toBe('new');
  });

  it('úpravu dál otevře tužka u profilu (#107)', () => {
    const test = threeProfiles();

    tapPencil(test.screens, profileId(test, 2));

    expect(test.screens.formMode()).toBe('edit');
    expect(test.screens.nickname()).toBe('TOM');
    expect(test.chosen()).toBe(0);
  });
});

describe('#109 AC4: profil se vybere jen, když dotyk začal i skončil na stejném kolečku', () => {
  it('když prst z kolečka sjede a zvedne se jinde, nic se nevybere', () => {
    const test = threeProfiles();
    const before = test.store.activeProfile().id;
    const button = test.screens.profileButton(profileId(test, 2));

    button.press(1);
    button.leave(1);
    button.release(1);

    expectNothingHappened(test, before);
  });

  it('když prohlížeč dotyk kolečka přeruší (pointercancel), nic se nevybere', () => {
    const test = threeProfiles();
    const before = test.store.activeProfile().id;
    const button = test.screens.profileButton(profileId(test, 2));

    button.press(1);
    button.cancel(1);
    button.release(1);

    expectNothingHappened(test, before);
  });

  it('dotyk začatý na kolečku EMA a skončený na kolečku TOM nevybere žádný profil', () => {
    const test = threeProfiles();
    const before = test.store.activeProfile().id;
    const ema = test.screens.profileButton(profileId(test, 1));
    const tom = test.screens.profileButton(profileId(test, 2));

    ema.press(1);
    ema.leave(1);
    tom.release(1);

    expectNothingHappened(test, before);
  });

  it('prst, který začal mimo kolečko a zvedl se na něm, nic nevybere', () => {
    const test = threeProfiles();
    const before = test.store.activeProfile().id;

    test.screens.profileButton(profileId(test, 2)).release(1);

    expectNothingHappened(test, before);
  });

  it('po zrušeném dotyku jde kolečko hned ťuknout znovu', () => {
    const test = threeProfiles();
    const tom = profileId(test, 2);
    const button = test.screens.profileButton(tom);
    button.press(1);
    button.cancel(1);

    tapProfileCircle(test.screens, tom, 2);

    expect(test.store.activeProfile().id).toBe(tom);
    expect(test.chosen()).toBe(1);
  });

  it('dva prsty na dvou kolečkách: vybere se jen profil, ze kterého se prst zvedl první', () => {
    const test = threeProfiles();
    const emaId = profileId(test, 1);
    const tomId = profileId(test, 2);
    const ema = test.screens.profileButton(emaId);
    const tom = test.screens.profileButton(tomId);

    ema.press(1);
    tom.press(2);
    tom.release(2);
    ema.release(1);

    expect(test.store.activeProfile().id).toBe(tomId);
    expect(test.chosen(), 'menu se ukáže jen jednou').toBe(1);
    expect(taps(test.feedback), 'jedna odezva ťuknutí').toHaveLength(1);
  });
});

describe('#109 AC4: formulář se otevře jen, když dotyk začal i skončil na „+“', () => {
  it('když prst z „+“ sjede a zvedne se jinde, formulář se neotevře', () => {
    const test = threeProfiles();
    const before = test.store.activeProfile().id;

    test.screens.addButton.press(1);
    test.screens.addButton.leave(1);
    test.screens.addButton.release(1);

    expectNothingHappened(test, before);
  });

  it('když prohlížeč dotyk „+“ přeruší (pointercancel), formulář se neotevře', () => {
    const test = threeProfiles();
    const before = test.store.activeProfile().id;

    test.screens.addButton.press(1);
    test.screens.addButton.cancel(1);
    test.screens.addButton.release(1);

    expectNothingHappened(test, before);
  });

  it('dotyk začatý na „+“ a skončený na kolečku nic neotevře ani nevybere', () => {
    const test = threeProfiles();
    const before = test.store.activeProfile().id;

    test.screens.addButton.press(1);
    test.screens.addButton.leave(1);
    test.screens.profileButton(profileId(test, 2)).release(1);

    expectNothingHappened(test, before);
  });

  it('dotyk začatý na kolečku a skončený na „+“ nic neotevře ani nevybere', () => {
    const test = threeProfiles();
    const before = test.store.activeProfile().id;
    const button = test.screens.profileButton(profileId(test, 2));

    button.press(1);
    button.leave(1);
    test.screens.addButton.release(1);

    expectNothingHappened(test, before);
  });

  it('prst na kolečku a druhý na „+“: když se první zvedne z kolečka, formulář se už neotevře', () => {
    const test = threeProfiles();
    const tomId = profileId(test, 2);
    const tom = test.screens.profileButton(tomId);

    test.screens.addButton.press(1);
    tom.press(2);
    tom.release(2);
    test.screens.addButton.release(1);

    expect(test.store.activeProfile().id).toBe(tomId);
    expect(test.screens.screen()).toBe('closed');
    expect(test.screens.formMode()).toBeNull();
    expect(test.chosen()).toBe(1);
  });

  it('prst na „+“ a druhý na kolečku: když se první zvedne z „+“, profil se už nevybere', () => {
    const test = threeProfiles();
    const before = test.store.activeProfile().id;
    const tom = test.screens.profileButton(profileId(test, 2));

    tom.press(1);
    test.screens.addButton.press(2);
    test.screens.addButton.release(2);
    tom.release(1);

    expect(test.screens.formMode()).toBe('new');
    expect(test.store.activeProfile().id).toBe(before);
    expect(test.chosen()).toBe(0);
  });
});
