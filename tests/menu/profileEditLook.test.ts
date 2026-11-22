import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PROFILE_SCREEN_STYLE } from '../../src/menu/logic/menuTheme';
import { PROFILE_EDIT_WOBBLE } from '../../src/menu/logic/profilePickerAppearance';
import type { ProfilePickerAppearance } from '../../src/menu/logic/profilePickerAppearance';
import { startScreenFor } from '../../src/menu/logic/profileScreens';
import { PAGE_BACKGROUND, contrastRatio } from '../../src/shared/logic/theme';
import { openProfiles } from '../../src/shared/storage/profileStorage';
import {
  deviceWithProfiles,
  holdConfirmDelete,
  tapEditPencil,
  tapProfileCircle,
  testProfileScreens,
} from './profileScreenFixtures';
import type { TestProfileScreens } from './profileScreenFixtures';

/**
 * Testy k #197 AC1–AC3 a AC6: vzhled výběru profilu v režimu úprav (po
 * ťuknutí na tužku v liště, #160). Rozložení odznaku a pravidla v cyklu
 * (AC4, AC5) testuje `profileEditModeLayout.test.ts`.
 *
 * Navržené rozhraní:
 * - `ProfileScreens.pickerAppearance(): ProfilePickerAppearance`: jak má
 *   výběr vypadat (pozadí, odznaky, pohupování, označená tužka, ztlumení
 *   „+“); scéna ho jen kreslí,
 * - `PROFILE_EDIT_WOBBLE` (`src/menu/logic/profilePickerAppearance.ts`):
 *   úhel a doba jednoho kmitu pohupování koleček.
 * Plynulost pohupování (tween kontejneru, nic se nepřekresluje) a vzhled
 * se kontrolují na obrázcích a v náhledu.
 */

/** Text pro rodiče musí mít proti pozadí aspoň 4,5 : 1 (#197 AC2). */
const MIN_TEXT_CONTRAST = 4.5;
/** Modrý odznak a tužka jsou grafika: proti pozadí aspoň 3 : 1 (WCAG 1.4.11). */
const MIN_GRAPHIC_CONTRAST = 3;
/** Jemné pohupování: nejvýš 3° na každou stranu a jeden kmit aspoň 1 s. */
const MAX_WOBBLE_DEGREES = 3;
const MIN_WOBBLE_SWING_MS = 1000;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

function threeProfiles(): TestProfileScreens {
  return testProfileScreens(deviceWithProfiles([{ nickname: 'EMA' }, { nickname: 'TOM' }]));
}

function look(test: TestProfileScreens): ProfilePickerAppearance {
  return test.screens.pickerAppearance();
}

describe('#197 AC1: po ťuknutí na tužku je hned vidět režim úprav', () => {
  it('mimo úpravy nemají kolečka odznak, nehoupou se a tužka v liště není označená', () => {
    const normal = look(threeProfiles());

    expect(normal.editBadges).toBe(false);
    expect(normal.wobble).toBe(false);
    expect(normal.pencilSelected).toBe(false);
  });

  it('po ťuknutí na tužku má každé kolečko odznak tužky, kolečka se pohupují a tužka je zapnutá', () => {
    const test = threeProfiles();

    tapEditPencil(test.screens);
    const editing = look(test);

    expect(editing.editBadges, 'odznaky').toBe(true);
    expect(editing.wobble, 'pohupování').toBe(true);
    expect(editing.pencilSelected, 'tužka označená').toBe(true);
  });

  it('zapnutá tužka je plná modrá s bílou tužkou, vypnutá světle modrá s modrou', () => {
    expect(PROFILE_SCREEN_STYLE.pencilSelectedBackground).toBe('#0062CC');
    expect(PROFILE_SCREEN_STYLE.pencilSelectedSymbol).toBe('#FFFFFF');
    expect(PROFILE_SCREEN_STYLE.pencilBackground).not.toBe(
      PROFILE_SCREEN_STYLE.pencilSelectedBackground,
    );
  });

  it('pohupování je jemné: nejvýš 3° na každou stranu a jeden kmit trvá aspoň 1 s', () => {
    expect(PROFILE_EDIT_WOBBLE.angleDegrees).toBeGreaterThan(0);
    expect(PROFILE_EDIT_WOBBLE.angleDegrees).toBeLessThanOrEqual(MAX_WOBBLE_DEGREES);
    expect(PROFILE_EDIT_WOBBLE.swingMs).toBeGreaterThanOrEqual(MIN_WOBBLE_SWING_MS);
  });
});

describe('#197 AC2: v úpravách má výběr jiné jemné pozadí a ztlumené „+“', () => {
  it('mimo úpravy je pozadí jako na celé stránce (#F5F5F7) a „+“ je plné', () => {
    const normal = look(threeProfiles());

    expect(normal.background).toBe(PAGE_BACKGROUND);
    expect(normal.addAlpha).toBe(1);
  });

  it('v úpravách je pozadí jiný, modravý odstín a „+“ je ztlumené, ale vidět', () => {
    const test = threeProfiles();
    tapEditPencil(test.screens);
    const editing = look(test);

    expect(editing.background).not.toBe(PAGE_BACKGROUND);
    const value = Number.parseInt(editing.background.slice(1), 16);
    const [red, green, blue] = [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
    expect(blue, 'modrá složka je nejsilnější').toBeGreaterThan(Math.max(red, green));
    expect(editing.addAlpha, '„+“ ztlumené').toBeLessThan(1);
    expect(editing.addAlpha, '„+“ je pořád vidět').toBeGreaterThan(0);
  });

  it('pozadí úprav je jemné: od běžného pozadí se liší, ale ne ostře (kontrast nejvýš 1,2 : 1)', () => {
    const test = threeProfiles();
    tapEditPencil(test.screens);

    const ratio = contrastRatio(look(test).background, PAGE_BACKGROUND);
    expect(ratio).toBeGreaterThan(1.05);
    expect(ratio).toBeLessThanOrEqual(1.2);
  });

  it(`přezdívky mají proti pozadí úprav kontrast aspoň ${MIN_TEXT_CONTRAST} : 1, modrý odznak a tužka aspoň ${MIN_GRAPHIC_CONTRAST} : 1`, () => {
    const test = threeProfiles();
    tapEditPencil(test.screens);
    const { background } = look(test);

    const nickname = contrastRatio(PROFILE_SCREEN_STYLE.nickname, background);
    expect(nickname, `přezdívka ${nickname.toFixed(2)} : 1`).toBeGreaterThanOrEqual(
      MIN_TEXT_CONTRAST,
    );
    for (const [name, color] of [
      ['odznak', PROFILE_SCREEN_STYLE.editBadgeBackground],
      ['zapnutá tužka', PROFILE_SCREEN_STYLE.pencilSelectedBackground],
    ] as const) {
      const ratio = contrastRatio(color, background);
      expect(ratio, `${name} ${ratio.toFixed(2)} : 1`).toBeGreaterThanOrEqual(MIN_GRAPHIC_CONTRAST);
    }
  });
});

describe('#197 AC3: ťuknutí na tužku režim vypne a vše se vrátí', () => {
  it('po druhém ťuknutí na tužku je vzhled přesně jako před zapnutím úprav', () => {
    const test = threeProfiles();
    const before = look(test);

    tapEditPencil(test.screens);
    tapEditPencil(test.screens);

    expect(look(test)).toEqual(before);
  });

  it('po návratu z úpravy profilu (Zpět) je výběr zase v běžných barvách bez odznaků', () => {
    const test = threeProfiles();
    const before = look(test);
    const tom = test.store.profiles()[2]?.id ?? '';

    tapEditPencil(test.screens);
    tapProfileCircle(test.screens, tom);
    expect(test.screens.formMode(), 'kolečko otevřelo úpravu').toBe('edit');
    test.screens.tapBack();

    expect(test.screens.screen()).toBe('picker');
    expect(look(test)).toEqual(before);
  });

  it('po smazání profilu je výběr zase v běžných barvách bez odznaků', () => {
    const test = threeProfiles();
    const before = look(test);

    tapEditPencil(test.screens);
    tapProfileCircle(test.screens, test.store.profiles()[2]?.id ?? '');
    test.screens.tapNext();
    test.screens.tapDelete();
    holdConfirmDelete(test.screens);

    expect(test.screens.screen()).toBe('picker');
    expect(look(test)).toEqual(before);
  });
});

describe('#197 AC6: výběr profilu při startu i v menu má stejný režim úprav', () => {
  it('výběr při startu (dva a víc profilů) i výběr otevřený z menu zapne a vypne úpravy stejně', () => {
    const atStart = threeProfiles();
    expect(startScreenFor(openProfiles(atStart.storage).profiles())).toBe('profilePicker');

    const fromMenu = threeProfiles();
    tapProfileCircle(fromMenu.screens, fromMenu.store.profiles()[1]?.id ?? '');
    expect(fromMenu.screens.screen(), 'vybraný profil, je vidět menu').toBe('closed');
    fromMenu.screens.open();

    for (const [where, test] of [
      ['při startu', atStart],
      ['z menu', fromMenu],
    ] as const) {
      const normal = look(test);
      tapEditPencil(test.screens);
      const editing = look(test);
      expect(editing.editBadges && editing.wobble && editing.pencilSelected, where).toBe(true);
      expect(editing.background, where).not.toBe(normal.background);
      tapEditPencil(test.screens);
      expect(look(test), where).toEqual(normal);
    }
    expect(look(atStart)).toEqual(look(fromMenu));
  });

  it('mimo výběr (v menu) je vzhled běžný, i když byl výběr předtím v úpravách', () => {
    const test = threeProfiles();
    tapEditPencil(test.screens);
    tapEditPencil(test.screens);
    tapProfileCircle(test.screens, test.store.profiles()[1]?.id ?? '');

    expect(test.screens.screen()).toBe('closed');
    expect(look(test).editBadges).toBe(false);
    expect(look(test).background).toBe(PAGE_BACKGROUND);
  });
});
