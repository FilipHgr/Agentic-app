import { describe, expect, it } from 'vitest';

import type { MenuBox } from '../../src/menu/logic/menuLayout';
import type { ProfilePickerLayout } from '../../src/menu/logic/profileLayout';
import { MAX_PROFILES } from '../../src/menu/logic/profileScreens';
import { chooseLayoutMode } from '../../src/shared/logic/viewportLayout';
import { viewportOf, widthOf } from '../shared/viewportFixtures';
import type { TestWindow } from '../shared/viewportFixtures';
import { MENU_WINDOWS } from './manyGamesFixtures';
import { pickerLayout } from './menuLayoutScenes';

/**
 * Testy k #113: větší mezera mezi kolečkem profilu a jeho tužkou, aby dítě
 * neťuklo na tužku místo kolečka. Každé pravidlo je jeden test, který
 * v cyklu projde všechna zkušební okna menu a 1 až 6 profilů bez „+“
 * i 1 až 5 profilů s „+“; zpráva při selhání řekne okno a počet profilů.
 *
 * #160: tužka u kolečka je nahrazená jedinou tužkou v liště vlevo od jazyka
 * (režim úprav, ťuknutí na kolečko mimo něj vždy vybere). Mezery kolečko–tužka
 * (AC1, AC2, AC7) tím odpadají a nahrazují je testy v
 * `tests/menu/profileEditModeLayout.test.ts` a `tests/menu/profileEditMode.test.ts`
 * (u každého je komentář, čím). Velikosti koleček z #113 byly spočítané
 * s tužkou vedle kolečka; bez ní smí kolečka vyrůst, ale nesmí se zmenšit
 * (upřesnění 4 k #160): hlídá to pevná tabulka dnešních velikostí
 * `TODAY_CIRCLE_SIZES` pro všechna okna a 1–6 koleček, velikosti z #113 níž
 * jsou proto „ne menší než dnes“. Rozmístění koleček a „+“ (AC3–AC5) zůstává.
 *
 * Rozhraní: `profilePickerLayoutFor`, `ProfilePickerSlot` s `circle`
 * a `nickname`, `add`; tužka a odznak z #160 viz `profileEditModeLayout.test.ts`.
 */

const ROUNDING = 1e-6;
const TABLET_CIRCLE = 140;
const PHONE_CIRCLE = 110;
const SMALLEST_CIRCLE = 92;

/**
 * #160 (upřesnění 4): velikost koleček (px) v každém okně menu pro 1 až 6
 * koleček (profily i „+“), jak byla před přesunem tužky do lišty (commit
 * ca10eff). Kolečka smí být větší, menší nikdy.
 */
const TODAY_CIRCLE_SIZES: ReadonlyArray<readonly [string, readonly number[]]> = [
  ['iPad 1180×820', [140, 140, 140, 140, 140, 140]],
  ['iPad 1180×760', [140, 140, 140, 140, 140, 140]],
  ['zmenšené zobrazení 820×1180', [140, 140, 140, 140, 140, 140]],
  ['744×296 nejmenší telefon', [110, 110, 110, 92, 92, 92]],
  ['800×300 Samsung s Chromem', [110, 110, 110, 94, 94, 94]],
  ['844×340 iPhone se Safari', [110, 110, 110, 103, 103, 103]],
  ['932×430 iPhone Pro Max', [110, 110, 110, 110, 110, 110]],
  ['932×499 těsně pod hranicí', [110, 110, 110, 110, 110, 110]],
  ['932×499 těsně pod hranicí s výřezem', [110, 110, 110, 110, 110, 110]],
  ['390×844 iPhone 13–15 (výřez 47, lišta 34)', [110, 110, 110, 99, 99, 99]],
  ['390×664 iPhone v Safari s lištou', [110, 110, 99, 99, 99, 99]],
  ['360×780 Samsung s Chromem', [110, 110, 110, 93, 93, 93]],
  ['375×667 iPhone SE', [110, 110, 93, 93, 93, 93]],
  ['430×932 iPhone Pro Max (výřez 59, lišta 34)', [110, 110, 110, 110, 110, 110]],
  ['360×620 nejmenší telefon na výšku', [110, 110, 93, 93, 93, 93]],
  ['499×932 těsně pod hranicí šířky', [110, 110, 110, 110, 110, 110]],
  ['375×1180 úzký iPad (Split View)', [110, 110, 110, 110, 110, 93]],
];
interface PencilCase {
  readonly name: string;
  readonly count: number;
  readonly add: boolean;
}

/** 1 až 6 profilů bez „+“ a 1 až 5 profilů s „+“ (se 6 profily se „+“ neukáže). */
const PENCIL_CASES: readonly PencilCase[] = Array.from({ length: MAX_PROFILES }, (_, index) => {
  const count = index + 1;
  const cases: PencilCase[] = [{ name: `${count} bez „+“`, count, add: false }];
  if (count < MAX_PROFILES) {
    cases.push({ name: `${count} a „+“`, count, add: true });
  }
  return cases;
}).flat();

interface PickerCase {
  readonly label: string;
  readonly window: TestWindow;
  readonly pencilCase: PencilCase;
  readonly layout: ProfilePickerLayout;
}

function allCases(): PickerCase[] {
  return PENCIL_CASES.flatMap((pencilCase) =>
    MENU_WINDOWS.map((window) => ({
      label: `${window.name}, ${pencilCase.name}`,
      window,
      pencilCase,
      layout: pickerLayout(window, pencilCase.count, pencilCase.add),
    })),
  );
}

function modeOf(window: TestWindow) {
  return chooseLayoutMode(viewportOf(window));
}

function isTablet(window: TestWindow): boolean {
  const mode = modeOf(window);
  return mode === 'tablet' || mode === 'scaled';
}

function itemsOf(pencilCase: PencilCase): number {
  return pencilCase.count + (pencilCase.add ? 1 : 0);
}

/** Všechna kolečka (profily a „+“) v pořadí. */
function circlesOf(layout: ProfilePickerLayout): MenuBox[] {
  const circles = layout.profiles.map((slot) => slot.circle);
  return layout.add === null ? circles : [...circles, layout.add];
}

function columnsOf(layout: ProfilePickerLayout): number {
  return new Set(circlesOf(layout).map((circle) => Math.round(circle.left))).size;
}

function rowsOf(layout: ProfilePickerLayout): number {
  return new Set(circlesOf(layout).map((circle) => Math.round(circle.top))).size;
}

function circleSizeOf(layout: ProfilePickerLayout): number {
  return widthOf(circlesOf(layout)[0] ?? { left: 0, right: 0, top: 0, bottom: 0 });
}

// #160 nahrazuje #113 AC1 (mezera aspoň 16 px mezi kolečkem a jeho tužkou) a AC2 (tužka
// není blíž dalšímu kolečku než svému): u koleček žádná tužka není („u koleček profilů ani
// u „+“ není žádná tužka“ v `profileEditModeLayout.test.ts`), tužka v liště je aspoň 8 px od
// koleček, přezdívek, „+“ a jazyka („tužka je aspoň 8 px od každého kolečka…“) a omylem
// otevřenou úpravu hlídá „ťuknutí na kolečko kteréhokoli profilu ho vybere a úpravu nikdy
// neotevře“ v `profileEditMode.test.ts`.

describe('#113 AC3: na iPadu a telefonu na šířku zůstanou kolečka velká', () => {
  it('na iPadu (i zmenšené zobrazení) mají kolečka 140 px a 6 koleček je ve 2 řadách po 3', () => {
    for (const { label, window, pencilCase, layout } of allCases()) {
      if (!isTablet(window)) {
        continue;
      }
      expect(circleSizeOf(layout), label).toBeCloseTo(TABLET_CIRCLE, 5);
      if (itemsOf(pencilCase) === 6) {
        expect(rowsOf(layout), `${label}: řady`).toBe(2);
        expect(columnsOf(layout), `${label}: kolečka v řadě`).toBe(3);
      }
    }
  });

  // #160: velikosti z #113 jsou s tužkou u kolečka; bez ní smí kolečka vyrůst, ne zmenšit
  // (ne menší než dnes, celá tabulka v `TODAY_CIRCLE_SIZES`).
  it('na telefonu na šířku je 6 koleček ve 2 řadách po 3 a mají aspoň 92 px (744×296), 94 px (800×300), 103 px (844×340) a 110 px (932×430, 932×499)', () => {
    const expectedSizes: ReadonlyArray<[string, number]> = [
      ['744×296', 92],
      ['800×300', 94],
      ['844×340', 103],
      ['932×430', 110],
      ['932×499', 110],
    ];
    for (const { label, window, pencilCase, layout } of allCases()) {
      if (modeOf(window) !== 'phoneLandscape' || itemsOf(pencilCase) !== 6) {
        continue;
      }
      const expected = expectedSizes.find(([name]) => window.name.startsWith(name));
      expect(expected, `${label}: okno v tabulce velikostí`).toBeDefined();
      expect(rowsOf(layout), `${label}: řady`).toBe(2);
      expect(columnsOf(layout), `${label}: kolečka v řadě`).toBe(3);
      expect(circleSizeOf(layout), label).toBeGreaterThanOrEqual(
        (expected?.[1] ?? Infinity) - ROUNDING,
      );
      expect(circleSizeOf(layout), label).toBeLessThanOrEqual(PHONE_CIRCLE + ROUNDING);
    }
  });

  // #160: velikosti jsou „ne menší než dnes“ (tabulka `TODAY_CIRCLE_SIZES`); mřížka drží
  // rozestup koleček z doby tužky u kolečka, takže 4 kolečka zůstávají ve 2 řadách.
  it('4 kolečka na telefonu na šířku (kromě 932×499 bez výřezu) jdou do 2 řad: na 800×300 mají aspoň 94 px, na 932×430 a 932×499 s výřezem 110 px', () => {
    const expectedSizes: ReadonlyArray<[string, number]> = [
      ['800×300', 94],
      ['932×430', 110],
      ['932×499 těsně pod hranicí s výřezem', 110],
    ];
    for (const { label, window, pencilCase, layout } of allCases()) {
      if (modeOf(window) !== 'phoneLandscape' || itemsOf(pencilCase) !== 4) {
        continue;
      }
      // 932×499 bez výřezu: 4 kolečka 110 px se do řady vejdou, tam AC3 řady neurčuje (#113).
      if (window.name !== '932×499 těsně pod hranicí') {
        expect(rowsOf(layout), `${label}: 4 kolečka se nevejdou do jedné řady`).toBe(2);
      }
      const expected = expectedSizes.find(([name]) => window.name.startsWith(name));
      if (expected !== undefined) {
        expect(circleSizeOf(layout), label).toBeGreaterThanOrEqual(expected[1] - ROUNDING);
        expect(circleSizeOf(layout), label).toBeLessThanOrEqual(PHONE_CIRCLE + ROUNDING);
      }
    }
  });

  it('4 kolečka na 932×499 bez výřezu zůstanou 110 px', () => {
    for (const { label, window, pencilCase, layout } of allCases()) {
      if (window.name !== '932×499 těsně pod hranicí' || itemsOf(pencilCase) !== 4) {
        continue;
      }
      expect(circleSizeOf(layout), label).toBeCloseTo(PHONE_CIRCLE, 5);
    }
  });
});

describe('#113 AC4: na telefonu na výšku jeden sloupec, když se vejde, jinak dva', () => {
  it('na výšku jsou kolečka v 1 nebo 2 sloupcích a s víc kolečky sloupců nikdy neubude', () => {
    for (const window of MENU_WINDOWS.filter((item) => modeOf(item) === 'phonePortrait')) {
      for (const add of [false, true]) {
        let previous = 1;
        for (const pencilCase of PENCIL_CASES.filter((item) => item.add === add)) {
          const label = `${window.name}, ${pencilCase.name}`;
          const columns = columnsOf(pickerLayout(window, pencilCase.count, add));
          expect(columns, label).toBeLessThanOrEqual(2);
          expect(columns, `${label}: s víc kolečky ubyl sloupec`).toBeGreaterThanOrEqual(previous);
          previous = columns;
        }
      }
    }
  });

  it('dokud se kolečka vejdou pod sebe, je jeden sloupec s kolečky 110 px; 2 sloupce až od 3 koleček (390×664, 375×667, 360×620), 4 (390×844, 360×780, 430×932), 5 (499×932) a 6 (375×1180)', () => {
    const twoColumnsFrom: ReadonlyArray<[string, number]> = [
      ['390×664', 3],
      ['375×667', 3],
      ['360×620', 3],
      ['390×844', 4],
      ['360×780', 4],
      ['430×932', 4],
      ['499×932', 5],
      ['375×1180', 6],
    ];
    for (const { label, window, pencilCase, layout } of allCases()) {
      if (modeOf(window) !== 'phonePortrait') {
        continue;
      }
      const from = twoColumnsFrom.find(([name]) => window.name.startsWith(name));
      expect(from, `${label}: okno v tabulce sloupců`).toBeDefined();
      const items = itemsOf(pencilCase);
      const expectedColumns = items >= (from?.[1] ?? 0) ? 2 : 1;
      expect(columnsOf(layout), `${label}: sloupce`).toBe(expectedColumns);
      if (expectedColumns === 1) {
        expect(circleSizeOf(layout), `${label}: jeden sloupec`).toBeCloseTo(PHONE_CIRCLE, 5);
      }
    }
  });

  // #160: 99 px na 390 px šířky bylo kvůli tužce vedle kolečka; teď „ne menší než dnes“
  // (tabulka `TODAY_CIRCLE_SIZES`), kolečka smí vyrůst až na 110 px.
  it('se 2 sloupci se kolečka smí zmenšit, ale nikdy pod 92 px: 390×844 a 390×664 mají aspoň 99 px, 430×932 a 499×932 zůstanou 110 px', () => {
    const expectedSizes: ReadonlyArray<[string, number]> = [
      ['390×844', 99],
      ['390×664', 99],
      ['430×932', PHONE_CIRCLE],
      ['499×932', PHONE_CIRCLE],
    ];
    for (const { label, window, layout } of allCases()) {
      if (modeOf(window) !== 'phonePortrait' || columnsOf(layout) !== 2) {
        continue;
      }
      const size = circleSizeOf(layout);
      expect(size, label).toBeGreaterThanOrEqual(SMALLEST_CIRCLE - ROUNDING);
      expect(size, label).toBeLessThanOrEqual(PHONE_CIRCLE + ROUNDING);
      const expected = expectedSizes.find(([name]) => window.name.startsWith(name));
      if (expected !== undefined) {
        expect(size, label).toBeGreaterThanOrEqual(expected[1] - ROUNDING);
      }
    }
  });

  it('všechna kolečka i „+“ jsou stejně velká a kulatá', () => {
    for (const { label, layout } of allCases()) {
      const size = circleSizeOf(layout);
      circlesOf(layout).forEach((circle, index) => {
        expect(widthOf(circle), `${label}: kolečko ${index + 1}`).toBeCloseTo(size, 5);
        expect(circle.bottom - circle.top, `${label}: kolečko ${index + 1}`).toBeCloseTo(size, 5);
      });
    }
  });
});

describe('#160 upřesnění 4: kolečka profilů nejsou menší než dnes', () => {
  it('v každém okně menu a pro 1 až 6 koleček (s „+“ i bez) jsou kolečka aspoň tak velká jako před přesunem tužky do lišty', () => {
    for (const { label, window, pencilCase, layout } of allCases()) {
      const today = TODAY_CIRCLE_SIZES.find(([name]) => name === window.name)?.[1];
      expect(today, `${label}: okno v tabulce dnešních velikostí`).toBeDefined();
      const todaySize = today?.[itemsOf(pencilCase) - 1] ?? Infinity;
      const size = circleSizeOf(layout);
      expect(size, `${label}: kolečko ${size} px, dnes ${todaySize} px`).toBeGreaterThanOrEqual(
        todaySize - ROUNDING,
      );
    }
  });

  it('tabulka dnešních velikostí pokrývá všechna okna menu', () => {
    expect(TODAY_CIRCLE_SIZES.map(([name]) => name)).toEqual(
      MENU_WINDOWS.map((window) => window.name),
    );
  });
});

describe('#113 AC5: „+“ je na místě dalšího kolečka', () => {
  it('„+“ stojí v mřížce přesně tam, kde by bylo kolečko dalšího profilu', () => {
    for (const { label, window, pencilCase, layout } of allCases()) {
      if (!pencilCase.add || layout.add === null) {
        continue;
      }
      const withNextProfile = pickerLayout(window, pencilCase.count + 1, false);
      const nextCircle = withNextProfile.profiles[pencilCase.count]?.circle;
      expect(nextCircle, label).toBeDefined();
      expect(layout.add.left, `${label}: vlevo`).toBeCloseTo(nextCircle?.left ?? -1, 5);
      expect(layout.add.top, `${label}: nahoře`).toBeCloseTo(nextCircle?.top ?? -1, 5);
      expect(widthOf(layout.add), `${label}: velikost`).toBeCloseTo(
        widthOf(nextCircle ?? layout.add),
        5,
      );
    }
  });

  // #160 AC1 nahrazuje „vpravo od „+“ v jeho výšce žádná tužka není“: tužka není u žádného
  // kolečka ani u „+“ (`profileEditModeLayout.test.ts`).
});

// #160 nahrazuje #113 AC7 (ťuknutí do mezery mezi kolečkem a tužkou nic neudělá): mezera
// zmizela s tužkou u kolečka. Tužka v liště je od koleček, přezdívek, „+“ a jazyka aspoň 8 px
// a nic se nepřekrývá (`profileEditModeLayout.test.ts`, společná pravidla); odznak je uvnitř
// kolečka a ťuknutí na něj je ťuknutí na kolečko, které mimo úpravy vždy vybere
// (`profileEditMode.test.ts`).
