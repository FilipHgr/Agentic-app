import { describe, expect, it } from 'vitest';

import type { MenuBox } from '../../src/menu/logic/menuLayout';
import type { ProfilePickerLayout } from '../../src/menu/logic/profileLayout';
import { MAX_PROFILES } from '../../src/menu/logic/profileScreens';
import { chooseLayoutMode } from '../../src/shared/logic/viewportLayout';
import { gapBetween, viewportOf, widthOf } from '../shared/viewportFixtures';
import type { TestWindow } from '../shared/viewportFixtures';
import { MENU_WINDOWS } from './manyGamesFixtures';
import { pickerLayout } from './menuLayoutScenes';

/**
 * Testy k #113: větší mezera mezi kolečkem profilu a jeho tužkou, aby dítě
 * neťuklo na tužku místo kolečka (od #109 reagují obě hned po ťuknutí).
 * Každé pravidlo je jeden test, který v cyklu projde všechna zkušební okna
 * menu a 1 až 6 profilů bez „+“ i 1 až 5 profilů s „+“; zpráva při selhání
 * řekne okno a počet profilů.
 *
 * Rozhraní zůstává z #107 (`profilePickerLayoutFor`, `ProfilePickerSlot`
 * s `circle`, `nickname` a `pencil`, `add` bez tužky), nic nového.
 * Ostatní pravidla #107 (tužka 64 px zarovnaná nahoře, 8 px od přezdívky,
 * tlačítka jazyka a okraje, nic se nepřekrývá a vše se vejde) hlídá dál
 * `tests/menu/profilePencilLayout.test.ts` (#113 AC6).
 */

const ROUNDING = 1e-6;
const TOLERANCE = 0.01;
const WIDE_GAP = 16;
const TABLET_CIRCLE = 140;
const PHONE_CIRCLE = 110;
const SMALLEST_CIRCLE = 92;
const TABLET_NEXT_GAP = 56;

/** Úzká okna na výšku, kde se ve 2 sloupcích 16 px nevejde (AC1): nejmenší mezera. */
const NARROW_PORTRAIT_GAPS: ReadonlyArray<{ readonly window: string; readonly gap: number }> = [
  { window: '375×667', gap: 15 },
  { window: '375×1180', gap: 15 },
  { window: '360×620', gap: 10 },
  { window: '360×780', gap: 10 },
];

/** Mezera mezi tužkou a dalším kolečkem v řadě na výšku podle šířky okna (AC2). */
const PORTRAIT_NEXT_GAPS: Readonly<Record<number, number>> = {
  390: 16,
  430: 16,
  499: 16,
  375: 15,
  360: 10,
};

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

function pencilGapOf(slot: ProfilePickerLayout['profiles'][number]): number {
  return slot.pencil.left - slot.circle.right;
}

/** Nejbližší kolečko (profil nebo „+“) vpravo od tužky ve stejné řadě, nebo `undefined`. */
function nextCircleInRow(layout: ProfilePickerLayout, pencil: MenuBox): MenuBox | undefined {
  return circlesOf(layout)
    .filter((circle) => Math.abs(circle.top - pencil.top) < TOLERANCE)
    .filter((circle) => circle.left >= pencil.right - TOLERANCE)
    .sort((a, b) => a.left - b.left)[0];
}

/** Nejmenší povolená mezera kolečko–tužka v okně (AC1): 16 px, v úzkých oknech se 2 sloupci méně. */
function minimumGapFor(window: TestWindow, layout: ProfilePickerLayout): number {
  if (modeOf(window) !== 'phonePortrait' || columnsOf(layout) < 2) {
    return WIDE_GAP;
  }
  const narrow = NARROW_PORTRAIT_GAPS.find((entry) => window.name.startsWith(entry.window));
  return narrow?.gap ?? WIDE_GAP;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function isInside(x: number, y: number, box: MenuBox): boolean {
  return x >= box.left && x <= box.right && y >= box.top && y <= box.bottom;
}

describe('#113 AC1: mezi kolečkem a jeho tužkou je víc místa', () => {
  it('mezera mezi kolečkem a tužkou je v celých px a aspoň 16 px, v úzkých oknech na výšku se 2 sloupci aspoň 15 px (375 px) a 10 px (360 px)', () => {
    for (const { label, window, layout } of allCases()) {
      const minimum = minimumGapFor(window, layout);
      layout.profiles.forEach((slot, index) => {
        const gap = pencilGapOf(slot);
        const where = `${label}: kolečko ${index + 1}, mezera ${round(gap)} px`;
        expect(Math.abs(gap - Math.round(gap)), `${where} není v celých px`).toBeLessThan(ROUNDING);
        expect(gap, `${where}, má být aspoň ${minimum} px`).toBeGreaterThanOrEqual(
          minimum - ROUNDING,
        );
      });
    }
  });

  it('úzká okna 375 px a 360 px na výšku opravdu mají 2 sloupce se 6 kolečky (výjimka z 16 px platí jen pro ně)', () => {
    for (const { window: name } of NARROW_PORTRAIT_GAPS) {
      const window = MENU_WINDOWS.find((candidate) => candidate.name.startsWith(name));
      expect(window, `zkušební okno ${name}`).toBeDefined();
      if (window === undefined) {
        continue;
      }
      expect(columnsOf(pickerLayout(window, 6, false)), window.name).toBe(2);
    }
  });
});

describe('#113 AC2: tužka není blíž dalšímu kolečku než svému', () => {
  it('mezera od tužky k dalšímu kolečku v řadě (profilu i „+“) je aspoň tak velká jako mezera od jejího kolečka', () => {
    for (const { label, layout } of allCases()) {
      layout.profiles.forEach((slot, index) => {
        const next = nextCircleInRow(layout, slot.pencil);
        if (next === undefined) {
          return;
        }
        const own = pencilGapOf(slot);
        const toNext = next.left - slot.pencil.right;
        expect(
          toNext,
          `${label}: tužka ${index + 1} má ke svému kolečku ${round(own)} px a k dalšímu ${round(toNext)} px`,
        ).toBeGreaterThanOrEqual(own - ROUNDING);
      });
    }
  });

  it('mezera od tužky k dalšímu kolečku vychází na iPadu 56 px, na výšku při šířce 390, 430 a 499 px 16 px, 375 px 15 px a 360 px 10 px', () => {
    for (const { label, window, layout } of allCases()) {
      const portraitGap = PORTRAIT_NEXT_GAPS[window.width];
      const expected = isTablet(window)
        ? TABLET_NEXT_GAP
        : modeOf(window) === 'phonePortrait'
          ? portraitGap
          : undefined;
      if (expected === undefined) {
        continue;
      }
      layout.profiles.forEach((slot, index) => {
        const next = nextCircleInRow(layout, slot.pencil);
        if (next === undefined) {
          return;
        }
        expect(next.left - slot.pencil.right, `${label}: za tužkou ${index + 1}`).toBeCloseTo(
          expected,
          5,
        );
      });
    }
  });
});

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

  it('na telefonu na šířku je 6 koleček ve 2 řadách po 3 a mají 92 px (744×296), 94 px (800×300), 103 px (844×340) a 110 px (932×430, 932×499)', () => {
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
      expect(circleSizeOf(layout), label).toBeCloseTo(expected?.[1] ?? -1, 5);
    }
  });

  it('4 kolečka na telefonu na šířku (kromě 932×499 bez výřezu) jdou do 2 řad: na 800×300 mají 94 px, na 932×430 a 932×499 s výřezem zůstanou 110 px', () => {
    const expectedSizes: ReadonlyArray<[string, number]> = [
      ['800×300', 94],
      ['932×430', 110],
      ['932×499 těsně pod hranicí s výřezem', 110],
    ];
    for (const { label, window, pencilCase, layout } of allCases()) {
      if (modeOf(window) !== 'phoneLandscape' || itemsOf(pencilCase) !== 4) {
        continue;
      }
      // 932×499 bez výřezu: 4 kolečka 110 px s mezerou 16 px se do řady vejdou (808 px z 916 px),
      // tam AC3 řady neurčuje jednoznačně (4 × 110 px s mezerou 16 px se vejdou, 808 px z 916 px, viz #113), hlídá se jen velikost níž.
      if (window.name !== '932×499 těsně pod hranicí') {
        expect(rowsOf(layout), `${label}: 4 kolečka se nevejdou do jedné řady`).toBe(2);
      }
      const expected = expectedSizes.find(([name]) => window.name.startsWith(name));
      if (expected !== undefined) {
        expect(circleSizeOf(layout), label).toBeCloseTo(expected[1], 5);
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

  it('se 2 sloupci se kolečka smí zmenšit, ale nikdy pod 92 px: 390×844 a 390×664 mají 99 px, 430×932 a 499×932 zůstanou 110 px', () => {
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
        expect(size, label).toBeCloseTo(expected[1], 5);
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

describe('#113 AC5: „+“ je bez tužky na místě dalšího kolečka', () => {
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

  it('vpravo od „+“ v jeho výšce žádná tužka není', () => {
    for (const { label, layout } of allCases()) {
      const plus = layout.add;
      if (plus === null) {
        continue;
      }
      const pencilsRightOfPlus = layout.profiles
        .map((slot) => slot.pencil)
        .filter((pencil) => pencil.top < plus.bottom && pencil.bottom > plus.top)
        .filter((pencil) => pencil.left >= plus.right - TOLERANCE);
      expect(pencilsRightOfPlus, label).toHaveLength(0);
    }
  });
});

describe('#113 AC7: ťuknutí do mezery mezi kolečkem a tužkou nic neudělá', () => {
  it('žádné místo v mezeře mezi kolečkem a tužkou nepatří kolečku, tužce, „+“ ani tlačítku jazyka', () => {
    for (const { label, layout } of allCases()) {
      const tappable: Array<[string, MenuBox]> = [
        ...layout.profiles.flatMap((slot, index): Array<[string, MenuBox]> => [
          [`kolečko ${index + 1}`, slot.circle],
          [`tužka ${index + 1}`, slot.pencil],
        ]),
        ...(layout.add === null ? [] : [['„+“', layout.add] as [string, MenuBox]]),
        ['tlačítko jazyka', layout.languageSlot],
      ];
      layout.profiles.forEach((slot, index) => {
        const y = (slot.pencil.top + slot.pencil.bottom) / 2;
        const inGap = [0.25, 0.5, 0.75].map(
          (part) => slot.circle.right + part * (slot.pencil.left - slot.circle.right),
        );
        for (const x of inGap) {
          const hit = tappable.filter(([, box]) => isInside(x, y, box)).map(([name]) => name);
          expect(
            hit,
            `${label}: mezera u kolečka ${index + 1}, bod ${round(x)} × ${round(y)}`,
          ).toEqual([]);
        }
        expect(
          gapBetween(slot.circle, slot.pencil),
          `${label}: mezera u kolečka ${index + 1}`,
        ).toBeGreaterThan(0);
      });
    }
  });
});
