import { afterEach, describe, expect, it, vi } from 'vitest';

import * as menuLayout from '../../src/menu/logic/menuLayout';
import type { MenuBox } from '../../src/menu/logic/menuLayout';
import type { Menu } from '../../src/menu/logic/menu';
import { CHARACTER_WIDTH_RATIO, MIN_TAP_SIDE } from '../shared/layoutRules';
import { heightOf, widthOf } from '../shared/viewportFixtures';
import { MENU_WINDOWS } from './manyGamesFixtures';
import {
  PICKER_CASES,
  TODAY_LANGUAGE_NAMES,
  languageLayout,
  pickerLayout,
} from './menuLayoutScenes';
import { TEST_LANGUAGE_NAMES, TestLanguages, testMenu, watchedLocalStorage } from './menuFixtures';

/**
 * Testy k #138 AC10 (komentář vlastníka): tlačítko jazyka (kolečko v liště
 * menu i na výběru profilu) ukazuje kód aktuálního jazyka velkými písmeny
 * (ISO 639-1: CS, EN) a pod ním vlajku téhož jazyka, stejné SVG jako
 * v nabídce (`languageFlag(language)`). Kód i vlajka se celé vejdou do
 * kolečka ve všech zkušebních oknech, ťukací plocha zůstane aspoň 64 px,
 * po přepnutí jazyka se změní kód i vlajka. Každé pravidlo je jeden test
 * v cyklu přes okna a obrazovky, případ je v popisu porušení.
 *
 * Navržené rozhraní:
 * - `src/menu/logic/menuLayout.ts`:
 *   `interface MenuLanguageButtonParts { readonly code: MenuBox; readonly flag: MenuBox }`,
 *   `languageButtonParts(button: MenuBox, fontSize: number): MenuLanguageButtonParts`.
 *   `button` je `languageSlot` (menu i výběr profilu), `fontSize` jeho
 *   `languageButtonFontSize`. `code` je plocha kódu (výška aspoň písmo),
 *   `flag` rámeček vlajky 24 × 16 px (3 : 2) pod kódem; vlajka se do něj
 *   vepíše celá se zachovaným poměrem (2 : 1 bude 24 × 12 px uprostřed).
 *   Kód a vlajka jsou dohromady svisle uprostřed kolečka.
 * - `src/menu/logic/menu.ts`: `Menu.languageButtonFlag(): LanguageFlag | null`,
 *   vlajka aktuálního jazyka podle `languageFlag` (`null` pro jazyk bez
 *   vlajky, třeba umělý jazyk v testech). Kreslí ji `MenuScene` i `ProfileScene`.
 */

const ROUNDING = 1e-6;

/** Rámeček vlajky v tlačítku (navržené: 3 : 2 jako česká vlajka, menší než 30 × 20 v nabídce). */
const FLAG_FRAME_WIDTH = 24;
const FLAG_FRAME_HEIGHT = 16;

/** Mezera mezi kódem a vlajkou pod ním (navržené). */
const MIN_CODE_FLAG_GAP = 2;

/** Kódy jazyků na tlačítku mají dvě písmena (ISO 639-1). */
const CODE_LENGTH = 2;

interface MenuLanguageButtonParts {
  readonly code: MenuBox;
  readonly flag: MenuBox;
}

/** Navržená funkce z `menuLayout.ts`; dokud chybí, test selže s jasnou zprávou. */
function buttonParts(button: MenuBox, fontSize: number): MenuLanguageButtonParts {
  const parts = (menuLayout as Record<string, unknown>)['languageButtonParts'];
  if (typeof parts !== 'function') {
    throw new Error('src/menu/logic/menuLayout.ts nevydává languageButtonParts');
  }
  return (parts as (button: MenuBox, fontSize: number) => MenuLanguageButtonParts)(
    button,
    fontSize,
  );
}

interface ButtonCase {
  readonly label: string;
  readonly button: MenuBox;
  readonly fontSize: number;
  readonly parts: MenuLanguageButtonParts;
}

/** Tlačítko jazyka v liště menu a na výběru profilu v každém zkušebním okně. */
function buttonCases(): ButtonCase[] {
  const menuCases = MENU_WINDOWS.map((window) => {
    const layout = languageLayout(window, TODAY_LANGUAGE_NAMES);
    return {
      label: `menu, ${window.name}`,
      button: layout.languageSlot,
      fontSize: layout.languageButtonFontSize,
    };
  });
  const pickerCases = PICKER_CASES.flatMap(({ name, count, add }) =>
    MENU_WINDOWS.map((window) => {
      const layout = pickerLayout(window, count, add);
      return {
        label: `výběr profilu (${name}), ${window.name}`,
        button: layout.languageSlot,
        fontSize: layout.languageButtonFontSize,
      };
    }),
  );
  return [...menuCases, ...pickerCases].map((buttonCase) => ({
    ...buttonCase,
    parts: buttonParts(buttonCase.button, buttonCase.fontSize),
  }));
}

function px(value: number): string {
  return `${value.toFixed(1).replace('.', ',')} px`;
}

function violations(rule: (buttonCase: ButtonCase) => string | null): string[] {
  return buttonCases().flatMap((buttonCase) => {
    const problem = rule(buttonCase);
    return problem === null ? [] : [`${buttonCase.label}: ${problem}`];
  });
}

/** Leží obdélník celý v kolečku vepsaném do tlačítka? */
function insideCircle(box: MenuBox, button: MenuBox): boolean {
  const centerX = (button.left + button.right) / 2;
  const centerY = (button.top + button.bottom) / 2;
  const radius = Math.min(widthOf(button), heightOf(button)) / 2;
  const corners: ReadonlyArray<readonly [number, number]> = [
    [box.left, box.top],
    [box.right, box.top],
    [box.left, box.bottom],
    [box.right, box.bottom],
  ];
  return corners.every(([x, y]) => Math.hypot(x - centerX, y - centerY) <= radius + ROUNDING);
}

function centerX(box: MenuBox): number {
  return (box.left + box.right) / 2;
}

describe('#138 AC10: kód a vlajka se celé vejdou do kolečka tlačítka jazyka', () => {
  it('tlačítko jazyka je v menu i na výběru profilu v každém zkušebním okně', () => {
    expect(buttonCases()).toHaveLength(MENU_WINDOWS.length * (1 + PICKER_CASES.length));
  });

  it('ťukací plocha tlačítka zůstává aspoň 64 × 64 px', () => {
    expect(
      violations(({ button }) =>
        widthOf(button) >= MIN_TAP_SIDE - ROUNDING && heightOf(button) >= MIN_TAP_SIDE - ROUNDING
          ? null
          : `tlačítko má ${px(widthOf(button))} × ${px(heightOf(button))}`,
      ),
    ).toEqual([]);
  });

  it('plocha kódu je celá v kolečku', () => {
    expect(
      violations(({ button, parts }) =>
        insideCircle(parts.code, button) ? null : 'kód přesahuje kolečko',
      ),
    ).toEqual([]);
  });

  it('rámeček vlajky je celý v kolečku', () => {
    expect(
      violations(({ button, parts }) =>
        insideCircle(parts.flag, button) ? null : 'vlajka přesahuje kolečko',
      ),
    ).toEqual([]);
  });

  it('rámeček vlajky je obdélník 24 × 16 px', () => {
    expect(
      violations(({ parts }) =>
        Math.abs(widthOf(parts.flag) - FLAG_FRAME_WIDTH) <= ROUNDING &&
        Math.abs(heightOf(parts.flag) - FLAG_FRAME_HEIGHT) <= ROUNDING
          ? null
          : `rámeček vlajky má ${px(widthOf(parts.flag))} × ${px(heightOf(parts.flag))}`,
      ),
    ).toEqual([]);
  });

  it('vlajka je pod kódem s mezerou aspoň 2 px a nepřekrývá ho', () => {
    expect(
      violations(({ parts }) =>
        parts.flag.top - parts.code.bottom >= MIN_CODE_FLAG_GAP - ROUNDING
          ? null
          : `mezi kódem a vlajkou je ${px(parts.flag.top - parts.code.bottom)}`,
      ),
    ).toEqual([]);
  });

  it('kód i vlajka jsou vodorovně uprostřed tlačítka', () => {
    expect(
      violations(({ button, parts }) => {
        const middle = centerX(button);
        const offsets = [centerX(parts.code) - middle, centerX(parts.flag) - middle];
        return offsets.every((offset) => Math.abs(offset) <= 0.5)
          ? null
          : `kód je o ${px(offsets[0] ?? 0)} a vlajka o ${px(offsets[1] ?? 0)} mimo střed`;
      }),
    ).toEqual([]);
  });

  it('kód a vlajka jsou dohromady svisle uprostřed kolečka', () => {
    expect(
      violations(({ button, parts }) => {
        const offset = (parts.code.top + parts.flag.bottom) / 2 - (button.top + button.bottom) / 2;
        return Math.abs(offset) <= 0.5 ? null : `dvojice je o ${px(offset)} mimo střed`;
      }),
    ).toEqual([]);
  });

  it('dvoupísmenný kód velkými písmeny se vejde do své plochy', () => {
    expect(
      violations(({ fontSize, parts }) => {
        const need = CODE_LENGTH * CHARACTER_WIDTH_RATIO * fontSize;
        if (heightOf(parts.code) < fontSize - ROUNDING) {
          return `plocha kódu má výšku ${px(heightOf(parts.code))}, písmo ${px(fontSize)}`;
        }
        return need <= widthOf(parts.code) + ROUNDING
          ? null
          : `kód potřebuje ${px(need)}, plocha má ${px(widthOf(parts.code))}`;
      }),
    ).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Po přepnutí jazyka se změní kód i vlajka
// ---------------------------------------------------------------------------

/** Navržená metoda menu; dokud chybí, test selže s jasnou zprávou. */
function buttonFlag(menu: Menu): unknown {
  const method = (menu as unknown as Record<string, unknown>)['languageButtonFlag'];
  if (typeof method !== 'function') {
    throw new Error('menu nemá languageButtonFlag()');
  }
  return (method as () => unknown).call(menu);
}

/** Menu se skutečnými jazyky zařízení po novém načtení stránky (úložiště v paměti). */
async function deviceMenu(): Promise<Menu> {
  watchedLocalStorage();
  vi.stubGlobal('window', { localStorage: globalThis.localStorage });
  vi.resetModules();
  const { deviceLanguages } = await import('../../src/menu/logic/menuLanguages');
  return testMenu({ languages: deviceLanguages() }).menu;
}

function choose(menu: Menu, language: string): void {
  menu.tapLanguageButton();
  menu.tapLanguage(language);
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('#138 AC10: tlačítko jazyka ukazuje kód a vlajku aktuálního jazyka', () => {
  it('s češtinou je na tlačítku „CS“ a česká vlajka ze stejného SVG jako v nabídce', async () => {
    const menu = await deviceMenu();
    expect(menu.languageButtonLabel()).toBe('CS');
    expect(buttonFlag(menu)).toEqual({ emoji: 'flag-czechia', file: 'flag-czechia.svg' });
  });

  it('po výběru angličtiny se změní kód na „EN“ i vlajka na britskou', async () => {
    const menu = await deviceMenu();
    choose(menu, 'en');
    expect(menu.languageButtonLabel()).toBe('EN');
    expect(buttonFlag(menu)).toEqual({
      emoji: 'flag-united-kingdom',
      file: 'flag-united-kingdom.svg',
    });
  });

  it('po návratu na češtinu je zase „CS“ a česká vlajka', async () => {
    const menu = await deviceMenu();
    choose(menu, 'en');
    choose(menu, 'cs');
    expect(menu.languageButtonLabel()).toBe('CS');
    expect(buttonFlag(menu)).toEqual({ emoji: 'flag-czechia', file: 'flag-czechia.svg' });
  });

  it('vlajka na tlačítku je vždy stejná jako vlajka jazyka v nabídce (languageFlag)', async () => {
    const menu = await deviceMenu();
    const { languageFlag } = (await import('../../src/menu/logic/languageFlags')) as {
      languageFlag: (language: string) => unknown;
    };
    for (const language of ['cs', 'en', 'cs']) {
      choose(menu, language);
      expect(buttonFlag(menu), language).toEqual(languageFlag(language));
    }
  });

  it('kód na tlačítku jsou dvě velká písmena (ISO 639-1)', async () => {
    const menu = await deviceMenu();
    for (const language of ['cs', 'en']) {
      choose(menu, language);
      expect(menu.languageButtonLabel(), language).toMatch(/^[A-Z]{2}$/);
    }
  });

  it('menu s jazykem bez vlajky (umělý jazyk v testu) nespadne a vlajku neukáže', () => {
    const menu = testMenu({ languages: new TestLanguages(TEST_LANGUAGE_NAMES, 'xx') }).menu;
    expect(menu.languageButtonLabel()).toBe('XX');
    expect(buttonFlag(menu)).toBeNull();
  });
});
