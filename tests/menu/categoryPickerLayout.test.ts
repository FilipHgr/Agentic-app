import { describe, expect, it } from 'vitest';

import { ALL_CATEGORY } from '../../src/menu/logic/menuCategories';
import type { MenuBox, MenuCategoryPicker, MenuLayout } from '../../src/menu/logic/menuLayout';
import { GAME_CATEGORIES } from '../../src/shared/logic/gameRegistry';
import { chooseLayoutMode } from '../../src/shared/logic/viewportLayout';
import { LANGUAGES } from '../../src/shared/texts/languages';
import {
  CHARACTER_WIDTH_RATIO,
  MIN_EDGE_DISTANCE,
  MIN_TAP_GAP,
  MIN_TAP_SIDE,
  textFitViolations,
} from '../shared/layoutRules';
import {
  freeAreaOf,
  gapBetween,
  heightOf,
  isInside,
  overlaps,
  viewportOf,
  widthOf,
} from '../shared/viewportFixtures';
import type { TestWindow } from '../shared/viewportFixtures';
import { MANY_CATEGORY_SYMBOLS, MENU_WINDOWS } from './manyGamesFixtures';
import {
  categoryPickerScenes,
  describeLayoutRules,
  pickerButtonText,
  categoryPickerCases,
  categoryPickerLayout,
  pickerRowText,
  shiftY,
  todayCategoryTitles,
  todayLayout,
  unseenElements,
} from './menuLayoutScenes';

/**
 * Testy k #95 AC1, AC2, AC4 a AC6, rozložení výběru kategorie na telefonu
 * na výšku ve všech zkušebních oknech z #67, ve všech jazycích ze seznamu
 * a se třemi seznamy kategorií: dnešní, „Vše“ a jedna kategorie a 13
 * zkušebních kategorií (jen v testech).
 *
 * Navržené rozhraní (`src/menu/logic/menuLayout.ts`):
 * - `layout.categoryPicker: MenuCategoryPicker | null`, jen na telefonu na
 *   výšku, jinde `null` (sloupec zůstává beze změny); na telefonu na výšku
 *   je `layout.categories` prázdné,
 * - `MenuCategoryPicker`:
 *   - `button` ťukací plocha tlačítka (64 px vysoká, přes celou šířku na
 *     místě dřívější řady), `buttonDrawn` nakreslené tlačítko (56 px),
 *   - `fontSize` písmo názvu na tlačítku i v řádcích, `textInset` odsazení
 *     od levého i pravého okraje, `symbolWidth` místo pro symbol v rámečku
 *     (s mezerou k názvu), `symbolFontSize`, `arrowWidth` místo pro ▾/▴,
 *     `checkWidth` místo pro ✓ v řádku,
 *   - `panel` bílá karta seznamu pod tlačítkem, `rows` ťukací plochy
 *     kategorií bez posunu v pořadí menu, `list` viditelná plocha seznamu
 *     (`viewport`, `clip`) a největší posun (`maxOffset`).
 *
 * Společná pravidla (vejde se, 4 px od okraje, nic se nepřekrývá, 64 px,
 * 8 px, text se vejde podle #65) pro zavřený výběr i otevřený seznam při
 * každém zkoušeném posunu hlídá `describeLayoutRules`. Tady jsou kontroly
 * podle schválených obrázků D1–D3, každá v cyklu přes okna, jazyky
 * a seznamy.
 */

const ROUNDING = 1e-6;
/** Dřívější řada kategorií na telefonu na výšku (#67): 88 px pod horním okrajem, 64 px vysoká. */
const ROW_TOP = 88;
const ROW_HEIGHT = 64;
/** Mezera mezi řadou kategorií a mřížkou (#67). */
const GRID_GAP = 12;
/** Nakreslené tlačítko výběru (schválený obrázek D1). */
const DRAWN_BUTTON_HEIGHT = 56;
/** Z první skryté řádky je vidět 55 % (schválený obrázek D3, pravidlo 20–60 %). */
const APPROVED_PEEK = 0.55;
/** Na konci posouvání nezůstane větší prázdné místo, než je okraj mřížky. */
const MAX_END_SPACE = 24;

/**
 * Nejméně případů, na které se každé pravidlo použije (v češtině): 9 oken
 * se sloupcem × 3 seznamy po jednom případu a 8 oken na výšku × 3 seznamy
 * × (zavřený a aspoň jeden otevřený), tedy 27 + 48 = 75. Náhrada případů
 * řady kategorií na telefonu na výšku z #88 a #69 AC4.
 */
const PICKER_COMBINATIONS: Readonly<Record<string, number>> = {
  'vejde se do okna i mimo výřez': 75,
  'nic se nepřekrývá': 75,
  'ťukací plocha aspoň 64 px': 75,
  'mezera mezi plochami aspoň 8 px': 75,
  'aspoň 4 px od okraje': 75,
  'text se vejde do své plochy': 75,
};

describeLayoutRules('výběr kategorie (#95)', categoryPickerScenes, PICKER_COMBINATIONS);

function isPhonePortrait(window: TestWindow): boolean {
  return chooseLayoutMode(viewportOf(window)) === 'phonePortrait';
}

const PORTRAIT_WINDOWS: readonly TestWindow[] = MENU_WINDOWS.filter(isPhonePortrait);
const COLUMN_WINDOWS: readonly TestWindow[] = MENU_WINDOWS.filter(
  (window) => !isPhonePortrait(window),
);

function pickerOf(layout: MenuLayout, label: string): MenuCategoryPicker {
  const picker = layout.categoryPicker;
  if (picker === null || picker === undefined) {
    throw new Error(`${label}: chybí výběr kategorie`);
  }
  return picker;
}

interface PickerCase {
  readonly label: string;
  readonly window: TestWindow;
  readonly titles: readonly string[];
  readonly layout: MenuLayout;
  readonly picker: MenuCategoryPicker;
}

/** Každé okno na výšku × jazyk × seznam kategorií. */
function pickerCasesInAllWindows(): PickerCase[] {
  return LANGUAGES.flatMap((language) =>
    PORTRAIT_WINDOWS.flatMap((window) =>
      categoryPickerCases(language).map(({ name, titles, tileCount }): PickerCase => {
        const label = `${window.name}, ${language}, ${name}`;
        const layout = categoryPickerLayout(window, titles, tileCount);
        return { label, window, titles, layout, picker: pickerOf(layout, label) };
      }),
    ),
  );
}

function barBoxes(layout: MenuLayout): MenuBox[] {
  return [layout.profileSlot, layout.languageSlot, ...layout.placeholders];
}

function barBottom(layout: MenuLayout): number {
  return Math.max(...barBoxes(layout).map((box) => box.bottom));
}

function lastOf<T>(items: readonly T[], label: string): T {
  const last = items[items.length - 1];
  if (last === undefined) {
    throw new Error(`${label}: seznam je prázdný`);
  }
  return last;
}

/** Seznamy, jejichž řádky se do panelu nevejdou. */
function overflowing(cases: readonly PickerCase[]): PickerCase[] {
  return cases.filter(({ picker }) =>
    picker.rows.some((row) => row.bottom > picker.list.viewport.bottom + ROUNDING),
  );
}

describe('#95 AC1: zavřený výběr jen na telefonu na výšku', () => {
  it('na telefonu na výšku je místo řady kategorií jedno tlačítko výběru', () => {
    expect(PORTRAIT_WINDOWS.length).toBeGreaterThan(0);
    for (const window of PORTRAIT_WINDOWS) {
      const layout = todayLayout(window);
      expect(layout.categoryPicker ?? null, window.name).not.toBeNull();
      expect(layout.categories, window.name).toHaveLength(0);
    }
  });

  it('na iPadu, ve zmenšeném zobrazení a na telefonu na šířku výběr není a sloupec zůstává', () => {
    expect(COLUMN_WINDOWS.length).toBeGreaterThan(0);
    for (const window of COLUMN_WINDOWS) {
      const layout = todayLayout(window);
      expect(layout.categoryPicker ?? null, window.name).toBeNull();
      expect(layout.categoryDirection, window.name).toBe('column');
      expect(layout.categories, window.name).toHaveLength(todayCategoryTitles().length);
    }
  });

  it('tlačítko je přes celou šířku menu: od levého kraje profilu po pravý kraj „…“', () => {
    for (const { label, layout, picker } of pickerCasesInAllWindows()) {
      const rightmost = Math.max(...barBoxes(layout).map((box) => box.right));
      expect(picker.button.left, label).toBeCloseTo(layout.profileSlot.left, 5);
      expect(picker.button.right, label).toBeCloseTo(rightmost, 5);
    }
  });

  it('tlačítko je na místě dřívější řady kategorií a lišta ani dlaždice se nepohnou', () => {
    for (const { label, window, layout, picker } of pickerCasesInAllWindows()) {
      const free = freeAreaOf(window);
      expect(picker.button.top - free.top, label).toBeCloseTo(ROW_TOP, 5);
      expect(heightOf(picker.button), label).toBeCloseTo(ROW_HEIGHT, 5);
      expect(picker.button.top - barBottom(layout), label).toBeCloseTo(GRID_GAP, 5);
      const first = layout.tiles[0];
      expect(first, label).toBeDefined();
      expect((first?.top ?? 0) - free.top, label).toBeCloseTo(ROW_TOP + ROW_HEIGHT + GRID_GAP, 5);
    }
  });

  it('tlačítko má aspoň 64 × 64 px a nakreslené tlačítko 56 px je uvnitř ťukací plochy', () => {
    for (const { label, picker } of pickerCasesInAllWindows()) {
      expect(widthOf(picker.button), label).toBeGreaterThanOrEqual(MIN_TAP_SIDE);
      expect(heightOf(picker.button), label).toBeGreaterThanOrEqual(MIN_TAP_SIDE);
      expect(heightOf(picker.buttonDrawn), label).toBeCloseTo(DRAWN_BUTTON_HEIGHT, 5);
      expect(isInside(picker.buttonDrawn, picker.button), label).toBe(true);
    }
  });

  it('tlačítko je ve volné ploše aspoň 4 px od okraje a nepřekrývá lištu ani mřížku', () => {
    for (const { label, window, layout, picker } of pickerCasesInAllWindows()) {
      const free = freeAreaOf(window);
      const inner: MenuBox = {
        left: free.left + MIN_EDGE_DISTANCE,
        right: free.right - MIN_EDGE_DISTANCE,
        top: free.top + MIN_EDGE_DISTANCE,
        bottom: free.bottom - MIN_EDGE_DISTANCE,
      };
      expect(isInside(picker.button, inner), label).toBe(true);
      for (const bar of barBoxes(layout)) {
        expect(overlaps(picker.button, bar), `${label}: lišta`).toBe(false);
      }
      expect(overlaps(picker.button, layout.gridScroll.viewport), `${label}: mřížka`).toBe(false);
      expect(overlaps(picker.button, layout.gridScroll.clip), `${label}: ořez mřížky`).toBe(false);
      for (const tile of layout.tiles) {
        expect(overlaps(picker.button, tile), `${label}: dlaždice`).toBe(false);
      }
    }
  });

  it('symbol, nejdelší název a šipka ▾ se společně vejdou do šířky tlačítka podle odhadu z #65', () => {
    for (const { label, titles, picker } of pickerCasesInAllWindows()) {
      const longest = [...titles].sort((a, b) => [...b].length - [...a].length)[0] ?? '';
      const scene = {
        label,
        free: picker.button,
        items: [
          {
            name: 'výběr kategorie',
            box: picker.button,
            texts: [pickerButtonText(picker, longest)],
          },
        ],
      };
      expect(textFitViolations(scene), label).toEqual([]);
    }
  });

  it('každý symbol kategorie se vejde do místa pro symbol podle odhadu z #65', () => {
    const symbols = [
      ALL_CATEGORY.symbol,
      ...GAME_CATEGORIES.map((category) => category.symbol),
      ...MANY_CATEGORY_SYMBOLS,
    ];
    for (const { label, picker } of pickerCasesInAllWindows()) {
      for (const symbol of symbols) {
        const width = [...symbol].length * CHARACTER_WIDTH_RATIO * picker.symbolFontSize;
        expect(width, `${label}: ${symbol}`).toBeLessThanOrEqual(picker.symbolWidth + ROUNDING);
      }
    }
  });
});

describe('#95 AC2: řádky seznamu', () => {
  it('seznam má řádek pro každou kategorii', () => {
    for (const { label, titles, picker } of pickerCasesInAllWindows()) {
      expect(picker.rows, label).toHaveLength(titles.length);
    }
  });

  it('řádky jdou v pořadí menu shora dolů pod sebou, stejně široké', () => {
    for (const { label, picker } of pickerCasesInAllWindows()) {
      picker.rows.slice(1).forEach((row, index) => {
        const previous = picker.rows[index] ?? row;
        expect(row.top, `${label}: řádek ${index + 2}`).toBeGreaterThan(previous.top);
        expect(row.left, `${label}: řádek ${index + 2}`).toBeCloseTo(previous.left, 5);
        expect(row.right, `${label}: řádek ${index + 2}`).toBeCloseTo(previous.right, 5);
      });
    }
  });

  it('řádky jsou aspoň 64 px vysoké a mezi sebou mají aspoň 8 px', () => {
    for (const { label, picker } of pickerCasesInAllWindows()) {
      picker.rows.forEach((row, index) => {
        expect(heightOf(row), `${label}: řádek ${index + 1}`).toBeGreaterThanOrEqual(MIN_TAP_SIDE);
        expect(widthOf(row), `${label}: řádek ${index + 1}`).toBeGreaterThanOrEqual(MIN_TAP_SIDE);
        const next = picker.rows[index + 1];
        if (next !== undefined) {
          expect(gapBetween(row, next), `${label}: za řádkem ${index + 1}`).toBeGreaterThanOrEqual(
            MIN_TAP_GAP - ROUNDING,
          );
        }
      });
    }
  });

  it('v každém řádku se vejde symbol, název a ✓ podle odhadu z #65', () => {
    for (const { label, titles, picker } of pickerCasesInAllWindows()) {
      const scene = {
        label,
        free: picker.panel,
        items: picker.rows.map((row, index) => ({
          name: `řádek ${index + 1}`,
          box: row,
          texts: [pickerRowText(picker, titles[index] ?? '')],
        })),
      };
      expect(textFitViolations(scene), label).toEqual([]);
    }
  });

  it('řádky jsou v šířce panelu a seznam je pod tlačítkem', () => {
    for (const { label, picker } of pickerCasesInAllWindows()) {
      expect(picker.panel.top, label).toBeGreaterThanOrEqual(picker.button.bottom);
      expect(isInside(picker.list.viewport, picker.panel), label).toBe(true);
      for (const row of picker.rows) {
        expect(row.left, label).toBeGreaterThanOrEqual(picker.panel.left - ROUNDING);
        expect(row.right, label).toBeLessThanOrEqual(picker.panel.right + ROUNDING);
      }
    }
  });
});

describe('#95 AC4: panel seznamu se vejde do volné plochy', () => {
  it('panel je aspoň 4 px od okraje volné plochy', () => {
    for (const { label, window, picker } of pickerCasesInAllWindows()) {
      const free = freeAreaOf(window);
      expect(picker.panel.left - free.left, label).toBeGreaterThanOrEqual(MIN_EDGE_DISTANCE);
      expect(free.right - picker.panel.right, label).toBeGreaterThanOrEqual(MIN_EDGE_DISTANCE);
      expect(free.bottom - picker.panel.bottom, label).toBeGreaterThanOrEqual(MIN_EDGE_DISTANCE);
    }
  });

  it('panel nepřekrývá tlačítko výběru ani lištu', () => {
    for (const { label, layout, picker } of pickerCasesInAllWindows()) {
      expect(overlaps(picker.panel, picker.button), `${label}: tlačítko`).toBe(false);
      for (const bar of barBoxes(layout)) {
        expect(overlaps(picker.panel, bar), `${label}: lišta`).toBe(false);
      }
    }
  });

  it('ořez seznamu je uvnitř panelu, takže posunuté řádky nevyjedou přes tlačítko', () => {
    for (const { label, picker } of pickerCasesInAllWindows()) {
      expect(isInside(picker.list.clip, picker.panel), label).toBe(true);
      expect(isInside(picker.list.viewport, picker.list.clip), label).toBe(true);
    }
  });
});

describe('#95 AC4: řádky, které se nevejdou, se posouvají', () => {
  it('13 kategorií se aspoň v jednom okně nevejde (zkušební seznam opravdu zkouší posouvání)', () => {
    expect(overflowing(pickerCasesInAllWindows()).length).toBeGreaterThan(0);
  });

  it('dnešní kategorie a „Vše“ s jednou kategorií se vejdou všude a nic se neposouvá', () => {
    for (const { label, titles, picker } of pickerCasesInAllWindows()) {
      if (titles.length > todayCategoryTitles().length) {
        continue;
      }
      expect(picker.list.maxOffset, label).toBe(0);
      for (const row of picker.rows) {
        expect(isInside(row, picker.list.viewport), label).toBe(true);
      }
    }
  });

  it('s „Vše“ a jednou kategorií má seznam dvě řádky (#95 AC6)', () => {
    for (const { label, titles, picker } of pickerCasesInAllWindows()) {
      if (titles.length === 2) {
        expect(picker.rows, label).toHaveLength(2);
        expect(picker.list.maxOffset, label).toBe(0);
      }
    }
  });

  it('když se řádky vejdou, nemají kam posunout; když ne, jde posunout až na poslední, který je pak celý vidět', () => {
    for (const { label, picker } of pickerCasesInAllWindows()) {
      const { viewport, maxOffset } = picker.list;
      const last = lastOf(picker.rows, label);
      if (last.bottom <= viewport.bottom + ROUNDING) {
        expect(maxOffset, label).toBe(0);
        continue;
      }
      expect(maxOffset, label).toBeGreaterThan(0);
      expect(isInside(shiftY(last, maxOffset), viewport), label).toBe(true);
      expect(viewport.bottom - shiftY(last, maxOffset).bottom, label).toBeLessThanOrEqual(
        MAX_END_SPACE,
      );
    }
  });

  it('na začátku je první řádek („Vše“) celý vidět', () => {
    for (const { label, picker } of pickerCasesInAllWindows()) {
      const first = picker.rows[0];
      expect(first, label).toBeDefined();
      expect(
        isInside(first ?? { ...picker.list.viewport, top: -1 }, picker.list.viewport),
        label,
      ).toBe(true);
    }
  });

  it('z první skryté řádky je vidět 20–60 % výšky, podle obrázku 55 %', () => {
    for (const { label, picker } of overflowing(pickerCasesInAllWindows())) {
      const viewport = picker.list.viewport;
      const hidden = picker.rows.find((row) => row.bottom > viewport.bottom + ROUNDING);
      expect(hidden, label).toBeDefined();
      const row = hidden ?? viewport;
      const share = (viewport.bottom - row.top) / heightOf(row);
      expect(share, label).toBeGreaterThanOrEqual(0.2);
      expect(share, label).toBeLessThanOrEqual(0.6);
      expect(share, label).toBeCloseTo(APPROVED_PEEK, 2);
    }
  });

  it('každá kategorie je v seznamu při některém posunu celá vidět a změří ji společná pravidla', () => {
    const scenes = categoryPickerScenes();
    for (const language of LANGUAGES) {
      for (const window of PORTRAIT_WINDOWS) {
        for (const { name, titles } of categoryPickerCases(language)) {
          const prefix = `výběr kategorie, ${window.name}, ${name}, ${language}, otevřený`;
          const own = scenes.filter((scene) => scene.label.startsWith(prefix));
          expect(own.length, prefix).toBeGreaterThan(0);
          expect(
            unseenElements(
              own,
              titles.map((title) => `kategorie ${title}`),
            ),
            prefix,
          ).toEqual([]);
        }
      }
    }
  });
});
