import { describe, expect, it } from 'vitest';

import type { MenuBox, MenuLayout } from '../../src/menu/logic/menuLayout';
import { LANGUAGES } from '../../src/shared/texts/languages';
import { sharedTexts } from '../../src/shared/texts/sharedTexts';
import { freeAreaOf, gapBetween, heightOf, isInside, widthOf } from '../shared/viewportFixtures';
import type { TestWindow } from '../shared/viewportFixtures';
import {
  LONGEST_LANGUAGE_NAME,
  MANY_GAMES_COUNT,
  MANY_LANGUAGE_CODES,
  MANY_LANGUAGE_NAMES,
  MENU_WINDOWS,
  manyGamesLayout,
} from './manyGamesFixtures';

/**
 * Testy k #70 AC1 a AC2, rozložení: tlačítko jazyka v liště a panel
 * nabídky ve všech zkušebních oknech, s dnešní češtinou i s 12 umělými
 * jazyky (jen v testech) včetně nejdelšího názvu.
 *
 * Navržené rozhraní (`src/menu/logic/menuLayout.ts`):
 * - `MenuContent.languageNames`: vlastní názvy jazyků v pořadí nabídky,
 * - `layout.languageSlot`: tlačítko jazyka (už z #67),
 *   `layout.languageButtonFontSize`: písmo zkratky,
 * - `layout.languagePanel`: `panel` (bílá karta), `rows` (ťukací plochy
 *   jazyků bez posunu), `list` (viditelná plocha seznamu a největší posun),
 *   `fontSize`, `textInset` a `checkWidth` (místo pro ✓ vpravo v řádku).
 */

const MIN_TAP = 64;
const MIN_GAP = 8;
const EDGE_MARGIN = 4;
const ROUNDING = 1e-6;
const CHARACTER_WIDTH_RATIO = 0.6;
/** Text se do plochy vejde i s rezervou 8 px (jako u kategorií v #67). */
const TEXT_PADDING = 8;

const TODAY_NAMES: readonly string[] = LANGUAGES.map(
  (language) => sharedTexts(language).languageName,
);
const MANY_NAMES: readonly string[] = MANY_LANGUAGE_CODES.map(
  (code) => MANY_LANGUAGE_NAMES[code] ?? code,
);

function textWidth(text: string, fontSize: number): number {
  return [...text].length * CHARACTER_WIDTH_RATIO * fontSize;
}

function insetBox(outer: MenuBox, margin: number): MenuBox {
  return {
    left: outer.left + margin,
    right: outer.right - margin,
    top: outer.top + margin,
    bottom: outer.bottom - margin,
  };
}

function shiftY(box: MenuBox, offset: number): MenuBox {
  return { ...box, top: box.top - offset, bottom: box.bottom - offset };
}

function layoutWith(window: TestWindow, names: readonly string[]): MenuLayout {
  return manyGamesLayout(window, MANY_GAMES_COUNT, names);
}

const CASES: ReadonlyArray<{ readonly name: string; readonly names: readonly string[] }> = [
  { name: 'dnešní jazyky', names: TODAY_NAMES },
  { name: '12 jazyků', names: MANY_NAMES },
];

describe('#70 AC1: tlačítko jazyka v liště vpravo nahoře', () => {
  for (const window of MENU_WINDOWS) {
    it(`${window.name}: tlačítko je kulaté 64 × 64 px vlevo od zástupných tlačítek`, () => {
      const layout = layoutWith(window, TODAY_NAMES);
      const button = layout.languageSlot;
      expect(widthOf(button)).toBeGreaterThanOrEqual(MIN_TAP);
      expect(heightOf(button)).toBeCloseTo(widthOf(button), 5);
      const firstPlaceholder = layout.placeholders[0];
      expect(firstPlaceholder).toBeDefined();
      expect(button.right).toBeLessThanOrEqual((firstPlaceholder?.left ?? 0) - MIN_GAP + ROUNDING);
      expect(button.top).toBeCloseTo(firstPlaceholder?.top ?? 0, 5);
    });

    it(`${window.name}: zkratka jazyka se vejde do tlačítka`, () => {
      const layout = layoutWith(window, MANY_NAMES);
      for (const code of MANY_LANGUAGE_CODES) {
        expect(
          textWidth(code.toUpperCase(), layout.languageButtonFontSize) + 2 * TEXT_PADDING,
        ).toBeLessThanOrEqual(widthOf(layout.languageSlot));
      }
    });

    it(`${window.name}: dlaždice, kategorie a lišta se kvůli jazykům nepohnou (#67 AC1)`, () => {
      const without = manyGamesLayout(window);
      for (const names of [TODAY_NAMES, MANY_NAMES]) {
        const withLanguages = layoutWith(window, names);
        expect(withLanguages.tiles).toEqual(without.tiles);
        expect(withLanguages.categories).toEqual(without.categories);
        expect(withLanguages.placeholders).toEqual(without.placeholders);
        expect(withLanguages.languageSlot).toEqual(without.languageSlot);
        expect(withLanguages.gridScroll).toEqual(without.gridScroll);
      }
    });
  }
});

describe('#70 AC2: panel nabídky se vejde do volné plochy', () => {
  for (const { name, names } of CASES) {
    for (const window of MENU_WINDOWS) {
      describe(`${name}, ${window.name}`, () => {
        const layout = layoutWith(window, names);
        const panel = layout.languagePanel;
        const free = freeAreaOf(window);

        it('panel je celý ve volné ploše a aspoň 4 px od jejího okraje', () => {
          expect(isInside(panel.panel, insetBox(free, EDGE_MARGIN))).toBe(true);
        });

        it('panel je pod tlačítkem jazyka a nepřekrývá ho (mezera aspoň 8 px)', () => {
          expect(panel.panel.top).toBeGreaterThanOrEqual(layout.languageSlot.bottom + MIN_GAP);
        });

        it('každý jazyk má v nabídce řádek', () => {
          expect(panel.rows).toHaveLength(names.length);
        });

        it('každý řádek jazyka je ťukací plocha aspoň 64 × 64 px', () => {
          for (const row of panel.rows) {
            expect(widthOf(row)).toBeGreaterThanOrEqual(MIN_TAP);
            expect(heightOf(row)).toBeGreaterThanOrEqual(MIN_TAP);
          }
        });

        it('mezi řádky jazyků je mezera aspoň 8 px', () => {
          panel.rows.slice(1).forEach((row, index) => {
            const previous = panel.rows[index];
            expect(previous).toBeDefined();
            expect(gapBetween(previous ?? row, row)).toBeGreaterThanOrEqual(MIN_GAP - ROUNDING);
          });
        });

        it('viditelná plocha seznamu je uvnitř panelu', () => {
          expect(isInside(panel.list.viewport, panel.panel)).toBe(true);
        });

        it('řádky jsou široké jako viditelná plocha seznamu', () => {
          for (const row of panel.rows) {
            expect(row.left).toBeCloseTo(panel.list.viewport.left, 5);
            expect(row.right).toBeCloseTo(panel.list.viewport.right, 5);
          }
        });

        it('název každého jazyka i ✓ se vejdou do řádku', () => {
          names.forEach((languageName, index) => {
            const row = panel.rows[index];
            expect(row, languageName).toBeDefined();
            expect(
              textWidth(languageName, panel.fontSize) + 2 * panel.textInset + panel.checkWidth,
              languageName,
            ).toBeLessThanOrEqual(widthOf(row ?? panel.list.viewport) + ROUNDING);
          });
        });

        it('posouváním jde až na konec: každý jazyk jde dostat celý do viditelné plochy', () => {
          const viewport = panel.list.viewport;
          for (const row of panel.rows) {
            const offset = Math.min(
              panel.list.maxOffset,
              Math.max(0, row.bottom - viewport.bottom),
            );
            expect(isInside(shiftY(row, offset), viewport)).toBe(true);
          }
        });

        it('na konci posouvání nezůstane pod posledním jazykem prázdné místo', () => {
          const last = panel.rows[panel.rows.length - 1];
          expect(last).toBeDefined();
          if (panel.list.maxOffset > 0 && last !== undefined) {
            expect(last.bottom - panel.list.maxOffset).toBeCloseTo(panel.list.viewport.bottom, 5);
          }
        });

        it('když se seznam nevejde, z prvního skrytého jazyka je vidět 20–60 % řádku', () => {
          if (panel.list.maxOffset === 0) {
            return;
          }
          const cut = panel.rows.find((row) => row.bottom > panel.list.viewport.bottom);
          expect(cut).toBeDefined();
          const visible = panel.list.viewport.bottom - (cut?.top ?? 0);
          const share = visible / heightOf(cut ?? panel.list.viewport);
          expect(share).toBeGreaterThanOrEqual(0.2);
          expect(share).toBeLessThanOrEqual(0.6);
        });
      });
    }
  }

  it('dnešní jeden jazyk se do panelu vejde a nic se neposouvá', () => {
    for (const window of MENU_WINDOWS) {
      expect(layoutWith(window, TODAY_NAMES).languagePanel.list.maxOffset, window.name).toBe(0);
    }
  });

  it('12 jazyků se aspoň v jednom zkušebním okně nevejde a posouvá se', () => {
    const scrolling = MENU_WINDOWS.filter(
      (window) => layoutWith(window, MANY_NAMES).languagePanel.list.maxOffset > 0,
    );
    expect(scrolling.length).toBeGreaterThan(0);
  });

  it('12 jazyků se posouvá na každém telefonu na šířku (nízké okno)', () => {
    for (const window of MENU_WINDOWS.filter((candidate) => candidate.height < 500)) {
      expect(
        layoutWith(window, MANY_NAMES).languagePanel.list.maxOffset,
        window.name,
      ).toBeGreaterThan(0);
    }
  });

  it('nejdelší název jazyka „Português do Brasil“ je mezi zkušebními jazyky', () => {
    expect(MANY_NAMES).toContain(LONGEST_LANGUAGE_NAME);
    const longest = Math.max(...MANY_NAMES.map((languageName) => [...languageName].length));
    expect([...LONGEST_LANGUAGE_NAME].length).toBe(longest);
  });
});

describe('#70 AC2: texty nabídky se vejdou ve všech jazycích ze seznamu', () => {
  for (const window of MENU_WINDOWS) {
    it(`${window.name}: vlastní název každého jazyka se vejde do svého řádku`, () => {
      const panel = layoutWith(window, TODAY_NAMES).languagePanel;
      TODAY_NAMES.forEach((languageName, index) => {
        const row = panel.rows[index];
        expect(row).toBeDefined();
        expect(
          textWidth(languageName, panel.fontSize) + 2 * panel.textInset + panel.checkWidth,
        ).toBeLessThanOrEqual(widthOf(row ?? panel.list.viewport) + ROUNDING);
      });
    });
  }
});
