/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest';

import { suggestedProfileColor } from '../../src/menu/logic/profileScreens';
import { PROFILE_COLORS } from '../../src/shared/logic/profiles';
import { dictionariesByLanguage, leavesOf } from '../shared/textChecks';
import {
  clearNickname,
  deviceWithProfiles,
  openEdit,
  tapAdd,
  testProfileScreens,
  typeNickname,
} from './profileScreenFixtures';
import type { TestProfileScreens } from './profileScreenFixtures';

/**
 * Testy k #161: formulář profilu ukazuje nahoře kolečko upravovaného
 * profilu, aby rodič viděl, čí profil mění. AC1 (barva profilu a první
 * písmeno z pole, mění se hned při ťukání), AC2 (ve 2. kroku právě vybraná
 * barva) a AC3 (prázdné pole bez písmene, nový profil ve výchozí barvě,
 * žádný nový text). Rozložení (AC4) testuje
 * `tests/menu/profileFormBadgeLayout.test.ts`, čitelnost písmene na 8
 * barvách (AC5) je ruční kontrola ve WebKitu.
 *
 * Navržené rozhraní (`src/menu/logic/profileScreens.ts`):
 * - `formBadge(): ProfileFormBadge | null` kolečko nahoře ve formuláři,
 *   v 1. i 2. kroku; mimo formulář (výběr, menu) `null`,
 * - `ProfileFormBadge { color: ProfileColor; symbol: string | null }`:
 *   `color` je barva rozepsaného profilu (u úpravy barva profilu, u nového
 *   profilu výchozí barva, tedy ta, kterou 2. krok předvybere; ve 2. kroku
 *   právě vybraná barva), `symbol` je první písmeno přezdívky z pole,
 *   při prázdném poli `null` (kolečko bez písmene, ani ★).
 */

function threeProfiles(): TestProfileScreens {
  return testProfileScreens(
    deviceWithProfiles([
      { nickname: 'EMA', color: PROFILE_COLORS[3] },
      { nickname: 'ŠTĚPÁN', color: PROFILE_COLORS[6] },
    ]),
  );
}

function profileId(test: TestProfileScreens, index: number): string {
  return test.screens.pickerItems()[index]?.id ?? '';
}

describe('#161 AC1: kolečko upravovaného profilu v jeho barvě s prvním písmenem z pole', () => {
  it('úprava profilu ukáže v 1. kroku kolečko v barvě profilu s prvním písmenem přezdívky', () => {
    const test = threeProfiles();

    openEdit(test.screens, profileId(test, 1));

    expect(test.screens.formBadge()).toEqual({ color: PROFILE_COLORS[3], symbol: 'E' });
  });

  it('úprava jiného profilu ukáže kolečko právě toho profilu, i s diakritikou', () => {
    const test = threeProfiles();

    openEdit(test.screens, profileId(test, 2));

    expect(test.screens.formBadge()).toEqual({ color: PROFILE_COLORS[6], symbol: 'Š' });
  });

  it('písmeno se změní hned po smazání a naťukání nové přezdívky, ještě před uložením', () => {
    const test = threeProfiles();
    openEdit(test.screens, profileId(test, 1));
    clearNickname(test.screens);

    typeNickname(test.screens, 'O');

    expect(test.screens.formBadge()?.symbol).toBe('O');
    expect(test.screens.formBadge()?.color).toBe(PROFILE_COLORS[3]);
    expect(test.store.profiles()[1]?.nickname).toBe('EMA');
  });

  it('u nového profilu se po prvním ťuknutém písmenu hned ukáže v kolečku', () => {
    const { screens } = testProfileScreens();
    tapAdd(screens);

    typeNickname(screens, 'Č');

    expect(screens.formBadge()?.symbol).toBe('Č');
  });

  it('další písmena první písmeno v kolečku nezmění', () => {
    const { screens } = testProfileScreens();
    tapAdd(screens);

    typeNickname(screens, 'ADAM');

    expect(screens.formBadge()?.symbol).toBe('A');
  });

  it('písmeno z fyzické klávesnice se v kolečku ukáže hned jako ťuknuté', () => {
    const { screens } = testProfileScreens();
    tapAdd(screens);

    screens.keyDown('k');

    expect(screens.formBadge()?.symbol).toBe('K');
  });

  it('kolečko je jen ve formuláři: na výběru profilu není', () => {
    const test = threeProfiles();

    expect(test.screens.formBadge()).toBeNull();

    openEdit(test.screens, profileId(test, 1));
    test.screens.tapBack();

    expect(test.screens.screen()).toBe('picker');
    expect(test.screens.formBadge()).toBeNull();
  });
});

describe('#161 AC2: ve 2. kroku má kolečko právě vybranou barvu', () => {
  it('ťuknutí na barvu kolečko hned přebarví, písmeno zůstane', () => {
    const test = threeProfiles();
    openEdit(test.screens, profileId(test, 1));
    test.screens.tapNext();

    test.screens.tapColor(PROFILE_COLORS[5]);

    expect(test.screens.screen()).toBe('color');
    expect(test.screens.formBadge()).toEqual({ color: PROFILE_COLORS[5], symbol: 'E' });
  });

  it('kolečko má vždy barvu, která je v paletě označená', () => {
    const { screens } = testProfileScreens();
    tapAdd(screens);
    typeNickname(screens, 'EMA');
    screens.tapNext();

    for (const color of PROFILE_COLORS) {
      screens.tapColor(color);
      const marked = screens.palette().find((swatch) => swatch.selected)?.color;
      expect(screens.formBadge()?.color, color).toBe(marked);
      expect(screens.formBadge()?.color, color).toBe(color);
    }
  });

  it('před výběrem barvy má kolečko ve 2. kroku barvu profilu', () => {
    const test = threeProfiles();
    openEdit(test.screens, profileId(test, 2));

    test.screens.tapNext();

    expect(test.screens.formBadge()).toEqual({ color: PROFILE_COLORS[6], symbol: 'Š' });
  });
});

describe('#161 upřesnění 5: návrat z 2. do 1. kroku', () => {
  it('po návratu do 1. kroku má kolečko úpravy dál vybranou barvu', () => {
    const test = threeProfiles();
    openEdit(test.screens, profileId(test, 1));
    test.screens.tapNext();
    test.screens.tapColor(PROFILE_COLORS[5]);

    test.screens.tapBack();

    expect(test.screens.screen()).toBe('nickname');
    expect(test.screens.formBadge()).toEqual({ color: PROFILE_COLORS[5], symbol: 'E' });
  });

  it('nový profil si po návratu do 1. kroku nechá vybranou barvu i pro další 2. krok', () => {
    const { screens } = testProfileScreens();
    tapAdd(screens);
    typeNickname(screens, 'OLA');
    screens.tapNext();
    screens.tapColor(PROFILE_COLORS[7]);

    screens.tapBack();

    expect(screens.formBadge()?.color).toBe(PROFILE_COLORS[7]);

    screens.tapNext();

    expect(screens.selectedColor()).toBe(PROFILE_COLORS[7]);
    expect(screens.formBadge()?.color).toBe(PROFILE_COLORS[7]);
  });
});

describe('#161 AC3: prázdné pole, nový profil a žádný nový text', () => {
  it('nový profil („+“) začíná kolečkem bez písmene', () => {
    const { screens } = testProfileScreens();

    tapAdd(screens);

    expect(screens.formBadge()?.symbol).toBeNull();
  });

  it('po smazání všech písmen je kolečko bez písmene', () => {
    const test = threeProfiles();
    openEdit(test.screens, profileId(test, 1));

    clearNickname(test.screens);

    expect(test.screens.nickname()).toBe('');
    expect(test.screens.formBadge()).toEqual({ color: PROFILE_COLORS[3], symbol: null });
  });

  it('profil bez přezdívky má v kolečku formuláře prázdno v obou krocích', () => {
    const test = threeProfiles();
    openEdit(test.screens, profileId(test, 0));

    expect(test.screens.formBadge()?.symbol).toBeNull();

    test.screens.tapNext();

    expect(test.screens.screen()).toBe('color');
    expect(test.screens.formBadge()?.symbol).toBeNull();
  });

  it('nový profil má kolečko ve výchozí barvě, kterou pak 2. krok předvybere', () => {
    const test = threeProfiles();
    tapAdd(test.screens);
    const defaultColor = suggestedProfileColor(test.store.profiles());

    expect(test.screens.formBadge()?.color).toBe(defaultColor);

    typeNickname(test.screens, 'OLA');
    test.screens.tapNext();

    expect(test.screens.selectedColor()).toBe(defaultColor);
    expect(test.screens.formBadge()?.color).toBe(defaultColor);
  });

  it('výchozí barva nového profilu není barva jiného profilu, dokud je v paletě volná', () => {
    const test = threeProfiles();
    tapAdd(test.screens);

    const taken = test.store.profiles().map((profile) => profile.color);

    expect(taken).not.toContain(test.screens.formBadge()?.color);
  });
});

/** Texty menu každého jazyka, který má soubor `src/menu/texts/<jazyk>.ts`. */
const MENU_FILES = dictionariesByLanguage(
  import.meta.glob('../../src/menu/texts/*.ts', { eager: true }),
);

/** Klíče textů menu před #161 (commit 8572b72). */
const TEXT_KEYS_BEFORE_161: readonly string[] = [
  'categories.addingSubtracting.title',
  'categories.all.title',
  'categories.drawing.title',
  'profiles.colorTitle',
  'profiles.deleteCancel',
  'profiles.deleteConfirm',
  'profiles.deleteQuestion',
  'profiles.nicknameTitle',
];

describe('#161 AC3: kolečko nepřidá žádný nový text', () => {
  it('texty menu mají v každém jazyce stejné klíče jako před #161', () => {
    expect(Object.keys(MENU_FILES).length).toBeGreaterThan(0);
    for (const [language, texts] of Object.entries(MENU_FILES)) {
      expect([...leavesOf(texts).keys()].sort(), language).toEqual(TEXT_KEYS_BEFORE_161);
    }
  });

  it('v kolečku je jen písmeno z pole, nic jiného', () => {
    const { screens } = testProfileScreens();
    tapAdd(screens);

    for (const nickname of ['E', 'EM', 'EMA']) {
      clearNickname(screens);
      typeNickname(screens, nickname);
      expect(screens.formBadge()?.symbol, nickname).toBe(nickname[0]);
    }
  });
});
