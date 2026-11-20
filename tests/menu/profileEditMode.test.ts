import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { profileFeedbackSound } from '../../src/menu/logic/profileScreens';
import { findWindow } from './manyGamesFixtures';
import { pickerLayout } from './menuLayoutScenes';
import type { ProfileFeedback } from '../../src/menu/logic/profileScreens';
import {
  ONE_SECOND_HOLD_MS,
  deviceWithProfiles,
  holdConfirmDelete,
  pressProfileFor,
  tapAdd,
  tapEditPencil,
  tapProfileCircle,
  testProfileScreens,
  typeNickname,
} from './profileScreenFixtures';
import type { TestProfileScreens } from './profileScreenFixtures';

/**
 * Testy k #160: úpravy profilů za jednou tužkou v liště výběru profilu
 * (vlevo od tlačítka jazyka) místo tužky u každého kolečka (#107). Dítě
 * tak omylem neotevře úpravu profilu sourozence: úprava potřebuje dvě
 * vědomá ťuknutí (tužka, pak kolečko), bez podržení.
 * AC1 a AC2 (logika), AC3 (smazání, jeden profil) testuje tento soubor,
 * rozložení (AC1 tužka 64 px v liště, AC4) `profileEditModeLayout.test.ts`.
 * Otočení zařízení (AC3) a vzhled označené tužky a odznaků se kontrolují
 * ručně, logika na rozložení nezávisí.
 *
 * Navržené rozhraní (`src/menu/logic/profileScreens.ts`), místo
 * `pencilButton(id)` z #107:
 * - `editPencilButton: TapButton`: jediná tužka v liště; na výběru profilu
 *   ťuknutí přepne režim úprav (zapne, další ťuknutí vypne), odezva
 *   `{ kind: 'tap', target: 'pencil' }`; mimo výběr nic neudělá,
 * - `isEditing(): boolean`: je výběr v režimu úprav (kolečka s odznakem
 *   tužky, tužka označená)? Mimo výběr `false`,
 * - `profileButton(id)` v režimu úprav otevře úpravu profilu (#73) a nic
 *   nevybere; mimo režim úprav profil vybere jako dnes (#109),
 * - formulář (✓ i „Zpět“) a smazání vrátí výběr mimo úpravy.
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

/** Výběr s výchozím profilem a EMA. */
function twoProfiles(): TestProfileScreens {
  return testProfileScreens(deviceWithProfiles([{ nickname: 'EMA' }]));
}

function profileAt(test: TestProfileScreens, index: number): { id: string; color: string } {
  const profile = test.store.profiles()[index];
  return { id: profile?.id ?? '', color: profile?.color ?? '' };
}

function taps(feedback: readonly ProfileFeedback[]): ProfileFeedback[] {
  return feedback.filter((event) => event.kind === 'tap');
}

/** Smaže profil na pořadí `index` přes režim úprav: tužka, kolečko, →, koš, „Smazat“ 1 s. */
function deleteProfileAt(test: TestProfileScreens, index: number): void {
  tapEditPencil(test.screens);
  tapProfileCircle(test.screens, profileAt(test, index).id);
  test.screens.tapNext();
  test.screens.tapDelete();
  holdConfirmDelete(test.screens);
}

describe('#160 AC1: ťuknutí na kolečko mimo režim úprav vždy vybere profil', () => {
  it('po otevření výběru není výběr v úpravách', () => {
    const test = threeProfiles();

    expect(test.screens.screen()).toBe('picker');
    expect(test.screens.isEditing()).toBe(false);
  });

  // Upřesnění 3: otevření výběru (z menu i při startu) začíná vždy mimo úpravy.
  it('výběr otevřený znovu (z menu i při startu) začíná mimo úpravy, i když byl předtím v úpravách', () => {
    const reopened = threeProfiles();
    tapEditPencil(reopened.screens);
    expect(reopened.screens.isEditing(), 'před otevřením').toBe(true);
    reopened.screens.open();
    expect(reopened.screens.screen(), 'znovu otevřený').toBe('picker');
    expect(reopened.screens.isEditing(), 'znovu otevřený').toBe(false);

    const fromMenu = threeProfiles();
    tapEditPencil(fromMenu.screens);
    tapEditPencil(fromMenu.screens);
    tapProfileCircle(fromMenu.screens, profileAt(fromMenu, 1).id);
    expect(fromMenu.screens.screen(), 'v menu').toBe('closed');
    fromMenu.screens.open();
    expect(fromMenu.screens.isEditing(), 'z menu').toBe(false);
    tapProfileCircle(fromMenu.screens, profileAt(fromMenu, 2).id);
    expect(fromMenu.chosen(), 'kolečko po otevření z menu vybírá').toBe(2);
  });

  it('ťuknutí na kolečko kteréhokoli profilu ho vybere a úpravu nikdy neotevře', () => {
    for (const index of [0, 1, 2]) {
      const test = threeProfiles();
      const profile = profileAt(test, index);

      tapProfileCircle(test.screens, profile.id);

      const where = `kolečko ${index + 1}`;
      expect(test.screens.formMode(), where).toBeNull();
      expect(test.screens.screen(), where).toBe('closed');
      expect(test.store.activeProfile().id, where).toBe(profile.id);
      expect(test.chosen(), where).toBe(1);
    }
  });

  it('ani dlouhý dotyk kolečka mimo úpravy úpravu neotevře, profil se vybere', () => {
    const test = threeProfiles();
    const tom = profileAt(test, 2).id;

    pressProfileFor(test.screens, tom, ONE_SECOND_HOLD_MS + 500);

    expect(test.screens.formMode()).toBeNull();
    expect(test.store.activeProfile().id).toBe(tom);
    expect(test.chosen()).toBe(1);
  });

  it('po ťuknutí na tužku a jejím vypnutí kolečko zase jen vybírá', () => {
    const test = threeProfiles();
    const tom = profileAt(test, 2).id;

    tapEditPencil(test.screens);
    tapEditPencil(test.screens);
    tapProfileCircle(test.screens, tom);

    expect(test.screens.formMode()).toBeNull();
    expect(test.store.activeProfile().id).toBe(tom);
    expect(test.chosen()).toBe(1);
  });
});

describe('#160 AC2: ťuknutí na tužku přepne výběr do úprav', () => {
  it('po ťuknutí na tužku je výběr v úpravách (odznaky, označená tužka) a nic se neotevře ani nevybere', () => {
    const test = threeProfiles();
    const activeBefore = test.store.activeProfile().id;

    tapEditPencil(test.screens);

    expect(test.screens.isEditing()).toBe(true);
    expect(test.screens.screen()).toBe('picker');
    expect(test.screens.formMode()).toBeNull();
    expect(test.store.activeProfile().id).toBe(activeBefore);
    expect(test.chosen()).toBe(0);
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
    const circleSound = profileFeedbackSound(circleTap as ProfileFeedback);
    expect(circleSound, 'ťuknutí na kolečko má zvuk').not.toBeNull();
    expect(profileFeedbackSound(pencilTaps[0] as ProfileFeedback)).toBe(circleSound);
  });

  it('tužka nečeká na podržení: během dlouhého dotyku se nic nepřepne, po zvednutí jednou', () => {
    const test = threeProfiles();

    test.screens.editPencilButton.press(1);
    vi.advanceTimersByTime(ONE_SECOND_HOLD_MS + 500);
    expect(test.screens.isEditing(), 'během držení').toBe(false);
    test.screens.editPencilButton.release(1);

    expect(test.screens.isEditing()).toBe(true);
    expect(taps(test.feedback)).toHaveLength(1);
    const kinds = test.feedback.map((event) => event.kind);
    expect(kinds, 'tužka se nehoupe ani neplní kroužek').not.toContain('wobble');
    expect(kinds.filter((kind) => kind.endsWith('Holding'))).toEqual([]);
  });

  it('když prst z tužky sjede, prohlížeč dotyk přeruší nebo se zvedne jiný prst, režim se nepřepne', () => {
    const cases: ReadonlyArray<[string, (test: TestProfileScreens) => void]> = [
      [
        'prst sjel',
        (test) => {
          test.screens.editPencilButton.press(1);
          test.screens.editPencilButton.leave(1);
          test.screens.editPencilButton.release(1);
        },
      ],
      [
        'pointercancel',
        (test) => {
          test.screens.editPencilButton.press(1);
          test.screens.editPencilButton.cancel(1);
          test.screens.editPencilButton.release(1);
        },
      ],
      [
        'jiný prst',
        (test) => {
          test.screens.editPencilButton.press(1);
          test.screens.editPencilButton.release(2);
        },
      ],
      ['prst začal jinde', (test) => test.screens.editPencilButton.release(1)],
    ];
    for (const [name, touch] of cases) {
      const test = threeProfiles();
      touch(test);
      expect(test.screens.isEditing(), name).toBe(false);
      expect(taps(test.feedback), name).toHaveLength(0);
    }
  });

  it('v úpravách ťuknutí na kolečko TOM otevře úpravu TOM s jeho barvou a nic nevybere', () => {
    const test = threeProfiles();
    const tom = profileAt(test, 2);
    const activeBefore = test.store.activeProfile().id;

    tapEditPencil(test.screens);
    tapProfileCircle(test.screens, tom.id);

    expect(test.screens.screen()).toBe('nickname');
    expect(test.screens.formMode()).toBe('edit');
    expect(test.screens.nickname()).toBe('TOM');
    expect(test.store.activeProfile().id, 'aktivní profil se nezmění').toBe(activeBefore);
    expect(test.chosen(), 'stránka neukáže menu').toBe(0);
    test.screens.tapNext();
    expect(test.screens.selectedColor()).toBe(tom.color);
  });

  it('v úpravách otevře každé kolečko úpravu právě svého profilu, i profilu bez přezdívky', () => {
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
      tapEditPencil(test.screens);
      tapProfileCircle(test.screens, item.id);
      const where = `kolečko ${item.nickname ?? '★'}`;
      expect(test.screens.formMode(), where).toBe('edit');
      expect(test.screens.nickname(), where).toBe(item.nickname ?? '');
      test.screens.tapBack();
    }
    expect(test.chosen()).toBe(0);
  });

  it('i dlouhý dotyk kolečka v úpravách otevře úpravu, ne výběr', () => {
    const test = threeProfiles();
    const tom = profileAt(test, 2).id;

    tapEditPencil(test.screens);
    pressProfileFor(test.screens, tom, ONE_SECOND_HOLD_MS + 500);

    expect(test.screens.formMode()).toBe('edit');
    expect(test.screens.nickname()).toBe('TOM');
    expect(test.chosen()).toBe(0);
  });

  it('kolečko profilu, který už neexistuje, v úpravách nic neotevře', () => {
    const test = threeProfiles();

    tapEditPencil(test.screens);
    tapProfileCircle(test.screens, 'neexistujici-profil');

    expect(test.screens.screen()).toBe('picker');
    expect(test.screens.formMode()).toBeNull();
    expect(test.chosen()).toBe(0);
  });

  it('„+“ v úpravách otevře nový profil jako dnes', () => {
    const test = threeProfiles();

    tapEditPencil(test.screens);
    tapAdd(test.screens);

    expect(test.screens.screen()).toBe('nickname');
    expect(test.screens.formMode()).toBe('new');
    expect(test.screens.nickname()).toBe('');
  });

  it('další ťuknutí na tužku úpravy ukončí', () => {
    const test = threeProfiles();

    tapEditPencil(test.screens);
    tapEditPencil(test.screens);

    expect(test.screens.isEditing()).toBe(false);
    expect(test.screens.screen()).toBe('picker');
    expect(taps(test.feedback), 'každé přepnutí má odezvu').toHaveLength(2);
  });

  it('po „Zpět“ z úpravy je výběr mimo úpravy a profil zůstane beze změny', () => {
    const test = threeProfiles();
    const before = test.store.profiles();

    tapEditPencil(test.screens);
    tapProfileCircle(test.screens, profileAt(test, 2).id);
    test.screens.tapBack();

    expect(test.screens.screen()).toBe('picker');
    expect(test.screens.isEditing()).toBe(false);
    expect(test.store.profiles()).toEqual(before);
  });

  it('po uložení úpravy ✓ je výběr mimo úpravy a další ťuknutí na kolečko vybere', () => {
    const test = threeProfiles();
    const tom = profileAt(test, 2).id;

    tapEditPencil(test.screens);
    tapProfileCircle(test.screens, tom);
    test.screens.tapNext();
    test.screens.tapSave();

    expect(test.screens.screen()).toBe('picker');
    expect(test.screens.isEditing()).toBe(false);
    tapProfileCircle(test.screens, tom);
    expect(test.store.activeProfile().id).toBe(tom);
    expect(test.chosen()).toBe(1);
  });

  it('po návratu z formuláře nového profilu (✓ i „Zpět“) je výběr mimo úpravy', () => {
    const saved = threeProfiles();
    tapEditPencil(saved.screens);
    tapAdd(saved.screens);
    typeNickname(saved.screens, 'LEA');
    saved.screens.tapNext();
    saved.screens.tapSave();
    expect(saved.screens.screen(), '✓').toBe('picker');
    expect(saved.screens.isEditing(), '✓').toBe(false);

    const back = threeProfiles();
    tapEditPencil(back.screens);
    tapAdd(back.screens);
    back.screens.tapBack();
    expect(back.screens.screen(), '„Zpět“').toBe('picker');
    expect(back.screens.isEditing(), '„Zpět“').toBe(false);
  });

  it('ve formuláři ani v menu tužka nic nepřepne', () => {
    const test = threeProfiles();
    tapAdd(test.screens);

    tapEditPencil(test.screens);
    expect(test.screens.isEditing(), 've formuláři').toBe(false);
    expect(test.screens.formMode(), 've formuláři zůstane nový profil').toBe('new');

    test.screens.tapBack();
    tapProfileCircle(test.screens, profileAt(test, 1).id);
    expect(test.screens.screen()).toBe('closed');
    tapEditPencil(test.screens);
    expect(test.screens.isEditing(), 'v menu').toBe(false);
    expect(test.screens.screen(), 'v menu se nic neotevře').toBe('closed');
  });
});

describe('#160 AC3: okrajové případy', () => {
  it('smazání profilu (zbudou dva a víc) vrátí výběr mimo úpravy', () => {
    const test = threeProfiles();

    deleteProfileAt(test, 2);

    expect(test.store.profiles()).toHaveLength(2);
    expect(test.screens.screen()).toBe('picker');
    expect(test.screens.isEditing()).toBe(false);
    tapProfileCircle(test.screens, profileAt(test, 1).id);
    expect(test.chosen(), 'kolečko po smazání vybírá').toBe(1);
  });

  it('když po smazání zbude jeden profil, výběr se zavře a stránka ukáže menu jako dnes', () => {
    const test = twoProfiles();

    deleteProfileAt(test, 1);

    expect(test.store.profiles()).toHaveLength(1);
    expect(test.screens.screen()).toBe('closed');
    expect(test.chosen()).toBe(1);
    expect(test.screens.isEditing()).toBe(false);
  });

  it('otočení zařízení nechá výběr v úpravách: po přepočtu rozložení na šířku i na výšku je výběr dál v úpravách', () => {
    const test = threeProfiles();
    tapEditPencil(test.screens);

    for (const name of ['844×340', '390×844', 'iPad 1180×820', 'zmenšené zobrazení 820×1180']) {
      const layout = pickerLayout(
        findWindow(name),
        test.screens.pickerItems().length,
        test.screens.canAddProfile(),
      );
      expect(layout.profiles, name).toHaveLength(3);
      expect(test.screens.isEditing(), `po přepočtu ${name}`).toBe(true);
      expect(test.screens.screen(), name).toBe('picker');
    }
    tapProfileCircle(test.screens, profileAt(test, 2).id);
    expect(test.screens.formMode(), 'kolečko po otočení otevře úpravu').toBe('edit');
  });

  it('výběr otevřený z menu s jedním profilem má tužku a ta otevře úpravu jediného profilu', () => {
    const test = testProfileScreens();
    const only = profileAt(test, 0);
    expect(test.store.profiles()).toHaveLength(1);

    tapEditPencil(test.screens);
    expect(test.screens.isEditing()).toBe(true);
    tapProfileCircle(test.screens, only.id);

    expect(test.screens.formMode()).toBe('edit');
    expect(test.screens.nickname()).toBe('');
    expect(test.chosen()).toBe(0);
  });
});
