import { describe, expect, it } from 'vitest';

import type { MenuBox } from '../../src/menu/logic/menuLayout';
import { PROFILE_SCREEN_STYLE } from '../../src/menu/logic/menuTheme';
import type { ProfilePickerLayout } from '../../src/menu/logic/profileLayout';
import { MAX_PROFILES } from '../../src/menu/logic/profileScreens';
import { BLUE, contrastRatio } from '../../src/shared/logic/theme';
import { boundsOf, freeAreaOf, gapBetween, widthOf } from '../shared/viewportFixtures';
import type { TestWindow } from '../shared/viewportFixtures';
import { MENU_WINDOWS } from './manyGamesFixtures';
import { pickerLayout } from './menuLayoutScenes';
import { deviceWithProfiles, tapAdd, testProfileScreens } from './profileScreenFixtures';

/**
 * Testy k #162: výrazné „+“ na výběru profilu a mřížka profilů vodorovně
 * uprostřed.
 *
 * AC1: „+“ má barvy aktivního tlačítka výběru ve stylu A3 (jako tužka
 * v liště z #160): světle modrou výplň, světle modrý okraj a modré „+“. Kontroluje se přes
 * barvy v `PROFILE_SCREEN_STYLE` (logika), samotné kreslení ručně.
 * AC2: každé pravidlo je jeden test, který v cyklu projde všechna zkušební
 * okna menu a 1 až 6 profilů bez „+“ i 1 až 5 profilů s „+“ (se 6 profily
 * se „+“ neukáže, `MAX_PROFILES`); zpráva při selhání řekne okno a počet.
 * „Uprostřed“ se měří k volné ploše okna (bez výřezu a lišty), mřížka jsou
 * obal všech koleček (profily i „+“).
 *
 * Rozhraní: žádné nové. `profilePickerLayoutFor` (přes `pickerLayout`),
 * `PROFILE_SCREEN_STYLE.addBackground`, `addBorder` a `addSymbol`.
 */

const ROUNDING = 1e-6;
/** AC2: okraje mřížky se smí lišit nejvýš o 1 px. */
const MAX_MARGIN_DIFFERENCE = 1;
/** AC2: mezi kolečky aspoň 16 px. */
const MIN_CIRCLE_GAP = 16;
/** Výplň a okraj aktivního tlačítka A3 (tlačítka čísel, tužka v liště). */
const A3_LIGHT_BLUE = '#E5F0FF';
/** Okraj aktivního tlačítka A3 (tlačítka čísel, tužka v liště). */
const A3_BORDER = '#B8D6FF';
/** Dřívější šedé „+“, které vypadalo jako vypnuté (review 2026-11-19). */
const FORMER_GREY_ADD = '#C7C7CC';

/**
 * #162 AC2: velikost koleček (px) v každém okně menu pro 1 až 6 koleček
 * (profily i „+“), jak byla před #162 (po #160, změřeno z dnešního
 * `profilePickerLayoutFor`). S „+“ i bez jsou stejné. Kolečka smí být
 * větší, menší nikdy. Je přísnější než `TODAY_CIRCLE_SIZES` z #160
 * (`profilePencilGap.test.ts`), protože po #160 kolečka na výšku vyrostla.
 */
const CIRCLE_SIZES_BEFORE_162: ReadonlyArray<readonly [string, readonly number[]]> = [
  ['iPad 1180×820', [140, 140, 140, 140, 140, 140]],
  ['iPad 1180×760', [140, 140, 140, 140, 140, 140]],
  ['zmenšené zobrazení 820×1180', [140, 140, 140, 140, 140, 140]],
  ['744×296 nejmenší telefon', [110, 110, 110, 92, 92, 92]],
  ['800×300 Samsung s Chromem', [110, 110, 110, 94, 94, 94]],
  ['844×340 iPhone se Safari', [110, 110, 110, 103, 103, 103]],
  ['932×430 iPhone Pro Max', [110, 110, 110, 110, 110, 110]],
  ['932×499 těsně pod hranicí', [110, 110, 110, 110, 110, 110]],
  ['932×499 těsně pod hranicí s výřezem', [110, 110, 110, 110, 110, 110]],
  ['390×844 iPhone 13–15 (výřez 47, lišta 34)', [110, 110, 110, 110, 110, 110]],
  ['390×664 iPhone v Safari s lištou', [110, 110, 110, 110, 110, 110]],
  ['360×780 Samsung s Chromem', [110, 110, 110, 110, 110, 110]],
  ['375×667 iPhone SE', [110, 110, 110, 110, 110, 110]],
  ['430×932 iPhone Pro Max (výřez 59, lišta 34)', [110, 110, 110, 110, 110, 110]],
  ['360×620 nejmenší telefon na výšku', [110, 110, 110, 110, 110, 110]],
  ['499×932 těsně pod hranicí šířky', [110, 110, 110, 110, 110, 110]],
  ['375×1180 úzký iPad (Split View)', [110, 110, 110, 110, 110, 110]],
];

interface CountCase {
  readonly name: string;
  readonly count: number;
  readonly add: boolean;
}

/** 1 až 6 profilů bez „+“ a 1 až 5 profilů s „+“. */
const COUNT_CASES: readonly CountCase[] = Array.from({ length: MAX_PROFILES }, (_, index) => {
  const count = index + 1;
  const cases: CountCase[] = [{ name: `${count} bez „+“`, count, add: false }];
  if (count < MAX_PROFILES) {
    cases.push({ name: `${count} a „+“`, count, add: true });
  }
  return cases;
}).flat();

interface PickerCase {
  readonly label: string;
  readonly window: TestWindow;
  readonly countCase: CountCase;
  readonly layout: ProfilePickerLayout;
}

function allCases(): PickerCase[] {
  return COUNT_CASES.flatMap((countCase) =>
    MENU_WINDOWS.map((window) => ({
      label: `${window.name}, ${countCase.name}`,
      window,
      countCase,
      layout: pickerLayout(window, countCase.count, countCase.add),
    })),
  );
}

/** Všechna kolečka (profily a „+“) v pořadí. */
function circlesOf(layout: ProfilePickerLayout): MenuBox[] {
  const circles = layout.profiles.map((slot) => slot.circle);
  return layout.add === null ? circles : [...circles, layout.add];
}

/**
 * Mřížka: obal všech koleček. Plocha přezdívky přesahuje kolečko na obě
 * strany stejně a text je pod kolečkem uprostřed, „+“ přezdívku nemá;
 * proto se plochy přezdívek do okrajů nepočítají.
 */
function gridOf(layout: ProfilePickerLayout): MenuBox {
  return boundsOf(circlesOf(layout));
}

function itemsOf(countCase: CountCase): number {
  return countCase.count + (countCase.add ? 1 : 0);
}

describe('#162 AC1: „+“ vypadá jako aktivní tlačítko výběru', () => {
  it('„+“ má světle modrou výplň a modré „+“ ve stylu A3, stejně jako tužka v liště', () => {
    expect(PROFILE_SCREEN_STYLE.addBackground).toBe(A3_LIGHT_BLUE);
    expect(PROFILE_SCREEN_STYLE.addSymbol).toBe(BLUE);
    expect(PROFILE_SCREEN_STYLE.addBackground, 'výplň jako tužka').toBe(
      PROFILE_SCREEN_STYLE.pencilBackground,
    );
    expect(PROFILE_SCREEN_STYLE.addSymbol, '„+“ jako tužka').toBe(
      PROFILE_SCREEN_STYLE.pencilSymbol,
    );
  });

  it('„+“ má světle modrý okraj ve stylu A3, stejný jako tužka v liště', () => {
    expect(PROFILE_SCREEN_STYLE.addBorder).toBe(A3_BORDER);
    expect(PROFILE_SCREEN_STYLE.addBorder, 'okraj jako tužka').toBe(
      PROFILE_SCREEN_STYLE.pencilBorder,
    );
    expect(PROFILE_SCREEN_STYLE.addBorder, 'okraj se liší od výplně').not.toBe(
      PROFILE_SCREEN_STYLE.addBackground,
    );
  });

  it('„+“ už není šedé jako vypnuté tlačítko a je na své výplni dobře vidět', () => {
    expect(PROFILE_SCREEN_STYLE.addBackground).not.toBe(FORMER_GREY_ADD);
    const contrast = contrastRatio(
      PROFILE_SCREEN_STYLE.addSymbol,
      PROFILE_SCREEN_STYLE.addBackground,
    );
    expect(contrast, `kontrast „+“ na výplni ${contrast.toFixed(2)} : 1`).toBeGreaterThanOrEqual(3);
  });

  it('ťuknutí na „+“ dál otevře 1. krok nového profilu', () => {
    const test = testProfileScreens(deviceWithProfiles([{ nickname: 'EMA' }]));

    tapAdd(test.screens);

    expect(test.screens.screen()).toBe('nickname');
    expect(test.screens.formMode()).toBe('new');
    expect(test.screens.nickname()).toBe('');
  });
});

describe('#162 AC2: mřížka profilů stojí vodorovně uprostřed', () => {
  it('v každém okně a pro každý počet profilů s „+“ i bez se levý a pravý okraj mřížky liší nejvýš o 1 px', () => {
    for (const { label, window, layout } of allCases()) {
      const free = freeAreaOf(window);
      const grid = gridOf(layout);
      const left = grid.left - free.left;
      const right = free.right - grid.right;
      expect(
        Math.abs(left - right),
        `${label}: vlevo ${left.toFixed(1)} px, vpravo ${right.toFixed(1)} px`,
      ).toBeLessThanOrEqual(MAX_MARGIN_DIFFERENCE + ROUNDING);
    }
  });

  it('v každém okně a pro každý počet profilů s „+“ i bez nejsou kolečka menší než před #162', () => {
    for (const { label, window, countCase, layout } of allCases()) {
      const before = CIRCLE_SIZES_BEFORE_162.find(([name]) => name === window.name)?.[1];
      expect(before, `${label}: okno v tabulce velikostí`).toBeDefined();
      const beforeSize = before?.[itemsOf(countCase) - 1] ?? Infinity;
      circlesOf(layout).forEach((circle, index) => {
        const size = widthOf(circle);
        expect(
          size,
          `${label}: kolečko ${index + 1} má ${size} px, před #162 ${beforeSize} px`,
        ).toBeGreaterThanOrEqual(beforeSize - ROUNDING);
      });
    }
  });

  it('tabulka velikostí před #162 pokrývá všechna okna menu', () => {
    expect(CIRCLE_SIZES_BEFORE_162.map(([name]) => name)).toEqual(
      MENU_WINDOWS.map((window) => window.name),
    );
  });

  it('v každém okně a pro každý počet profilů s „+“ i bez je mezi každými dvěma kolečky aspoň 16 px', () => {
    for (const { label, layout } of allCases()) {
      const circles = circlesOf(layout);
      circles.forEach((first, firstIndex) => {
        circles.slice(firstIndex + 1).forEach((second, offset) => {
          const gap = gapBetween(first, second);
          expect(
            gap,
            `${label}: mezi kolečkem ${firstIndex + 1} a ${firstIndex + offset + 2} je ${gap.toFixed(1)} px`,
          ).toBeGreaterThanOrEqual(MIN_CIRCLE_GAP - ROUNDING);
        });
      });
    }
  });
});
