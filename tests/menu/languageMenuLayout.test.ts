import { describe, expect, it } from 'vitest';

import { heightOf, isInside, widthOf } from '../shared/viewportFixtures';
import type { MenuLayout } from '../../src/menu/logic/menuLayout';
import { MIN_TAP_GAP } from '../shared/layoutRules';
import { LONGEST_LANGUAGE_NAME, MENU_WINDOWS, manyGamesLayout } from './manyGamesFixtures';
import {
  LANGUAGE_CASES,
  MANY_LANGUAGE_LIST,
  TODAY_LANGUAGE_NAMES,
  describeLayoutRules,
  languageLayout,
  languageScenes,
  unseenElements,
  shiftY,
} from './menuLayoutScenes';

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
 *
 * Společná pravidla (i pro viditelnou část řádků při každém zkoušeném
 * posunu, zkratku na tlačítku a název jazyka s ✓ v řádku) hlídá
 * `describeLayoutRules` (#82). Tady zůstávají kontroly podle obrázku
 * a posouvání seznamu, každá v cyklu přes okna.
 */

const ROUNDING = 1e-6;

/**
 * Kolik různých kombinací (okno × jazyky) pravidlo na nabídce jazyků
 * hlídalo před #82: 17 oken s dnešními jazyky a 17 oken s 12 jazyky,
 * spočítáno jednorázově z testů před #82.
 */
const TODAY_COMBINATIONS: Readonly<Record<string, number>> = {
  'vejde se do okna i mimo výřez': 34,
  'nic se nepřekrývá': 34,
  'ťukací plocha aspoň 64 px': 34,
  'mezera mezi plochami aspoň 8 px': 34,
  'aspoň 4 px od okraje': 34,
  'text se vejde do své plochy': 34,
};

describeLayoutRules('nabídka jazyků', languageScenes, TODAY_COMBINATIONS);

/** Každý případ: jazyky a okno, s rozložením a popisem pro zprávu. */
function eachCase(check: (label: string, layout: MenuLayout) => void): void {
  for (const { name, names } of LANGUAGE_CASES) {
    for (const window of MENU_WINDOWS) {
      check(`${name}, ${window.name}`, languageLayout(window, names));
    }
  }
}

describe('#82 AC1: posouvání nabídky ukáže každý jazyk', () => {
  it('každý řádek jazyka je změřený v každém případu a aspoň v jednom je celý vidět', () => {
    const scenes = languageScenes();
    for (const { name, names } of LANGUAGE_CASES) {
      for (const window of MENU_WINDOWS) {
        const prefix = `nabídka jazyků, ${window.name}, ${name}, `;
        const own = scenes.filter((scene) => scene.label.startsWith(prefix));
        expect(own.length, `${name}, ${window.name}`).toBeGreaterThan(0);
        expect(
          unseenElements(
            own,
            names.map((languageName) => `jazyk ${languageName}`),
          ),
          `${name}, ${window.name}`,
        ).toEqual([]);
      }
    }
  });
});

describe('#70 AC1: tlačítko jazyka v liště vpravo nahoře', () => {
  it('tlačítko je kulaté, vlevo od zástupných tlačítek (aspoň 8 px) a ve stejné výšce', () => {
    for (const window of MENU_WINDOWS) {
      const layout = languageLayout(window, TODAY_LANGUAGE_NAMES);
      const button = layout.languageSlot;
      const firstPlaceholder = layout.placeholders[0];
      expect(heightOf(button), window.name).toBeCloseTo(widthOf(button), 5);
      expect(firstPlaceholder, window.name).toBeDefined();
      expect(button.right, window.name).toBeLessThanOrEqual(
        (firstPlaceholder?.left ?? 0) - MIN_TAP_GAP + ROUNDING,
      );
      expect(button.top, window.name).toBeCloseTo(firstPlaceholder?.top ?? 0, 5);
    }
  });

  it('dlaždice, kategorie a lišta se kvůli jazykům nepohnou (#67 AC1)', () => {
    for (const window of MENU_WINDOWS) {
      const without = manyGamesLayout(window);
      for (const { name, names } of LANGUAGE_CASES) {
        const withLanguages = languageLayout(window, names);
        const label = `${name}, ${window.name}`;
        expect(withLanguages.tiles, label).toEqual(without.tiles);
        expect(withLanguages.categories, label).toEqual(without.categories);
        expect(withLanguages.placeholders, label).toEqual(without.placeholders);
        expect(withLanguages.languageSlot, label).toEqual(without.languageSlot);
        expect(withLanguages.gridScroll, label).toEqual(without.gridScroll);
      }
    }
  });
});

describe('#70 AC2: panel nabídky ve všech oknech s dnešními i 12 jazyky', () => {
  it('panel je pod tlačítkem jazyka s mezerou aspoň 8 px a viditelná plocha seznamu je v panelu', () => {
    eachCase((label, layout) => {
      const { panel, list } = layout.languagePanel;
      expect(panel.top, label).toBeGreaterThanOrEqual(layout.languageSlot.bottom + MIN_TAP_GAP);
      expect(isInside(list.viewport, panel), label).toBe(true);
    });
  });

  it('každý jazyk má v nabídce řádek široký jako viditelná plocha seznamu', () => {
    for (const { name, names } of LANGUAGE_CASES) {
      for (const window of MENU_WINDOWS) {
        const label = `${name}, ${window.name}`;
        const { rows, list } = languageLayout(window, names).languagePanel;
        expect(rows, label).toHaveLength(names.length);
        for (const row of rows) {
          expect(row.left, label).toBeCloseTo(list.viewport.left, 5);
          expect(row.right, label).toBeCloseTo(list.viewport.right, 5);
        }
      }
    }
  });

  it('posouváním jde až na konec: každý jazyk jde dostat celý do viditelné plochy', () => {
    eachCase((label, layout) => {
      const { rows, list } = layout.languagePanel;
      for (const row of rows) {
        const offset = Math.min(list.maxOffset, Math.max(0, row.bottom - list.viewport.bottom));
        expect(isInside(shiftY(row, offset), list.viewport), label).toBe(true);
      }
    });
  });

  it('na konci posouvání nezůstane pod posledním jazykem prázdné místo', () => {
    eachCase((label, layout) => {
      const { rows, list } = layout.languagePanel;
      const last = rows[rows.length - 1];
      expect(last, label).toBeDefined();
      if (list.maxOffset > 0 && last !== undefined) {
        expect(last.bottom - list.maxOffset, label).toBeCloseTo(list.viewport.bottom, 5);
      }
    });
  });

  it('když se seznam nevejde, z prvního skrytého jazyka je vidět 20–60 % řádku', () => {
    eachCase((label, layout) => {
      const { rows, list } = layout.languagePanel;
      if (list.maxOffset === 0) {
        return;
      }
      const cut = rows.find((row) => row.bottom > list.viewport.bottom);
      expect(cut, label).toBeDefined();
      const visible = list.viewport.bottom - (cut?.top ?? 0);
      const share = visible / heightOf(cut ?? list.viewport);
      expect(share, label).toBeGreaterThanOrEqual(0.2);
      expect(share, label).toBeLessThanOrEqual(0.6);
    });
  });

  it('dnešní jeden jazyk se do panelu vejde a nic se neposouvá', () => {
    for (const window of MENU_WINDOWS) {
      expect(
        languageLayout(window, TODAY_LANGUAGE_NAMES).languagePanel.list.maxOffset,
        window.name,
      ).toBe(0);
    }
  });

  it('12 jazyků se aspoň v jednom zkušebním okně nevejde a posouvá se', () => {
    const scrolling = MENU_WINDOWS.filter(
      (window) => languageLayout(window, MANY_LANGUAGE_LIST).languagePanel.list.maxOffset > 0,
    );
    expect(scrolling.length).toBeGreaterThan(0);
  });

  it('12 jazyků se posouvá na každém telefonu na šířku (nízké okno)', () => {
    for (const window of MENU_WINDOWS.filter((candidate) => candidate.height < 500)) {
      expect(
        languageLayout(window, MANY_LANGUAGE_LIST).languagePanel.list.maxOffset,
        window.name,
      ).toBeGreaterThan(0);
    }
  });

  it('nejdelší název jazyka „Português do Brasil“ je mezi zkušebními jazyky', () => {
    expect(MANY_LANGUAGE_LIST).toContain(LONGEST_LANGUAGE_NAME);
    const longest = Math.max(...MANY_LANGUAGE_LIST.map((languageName) => [...languageName].length));
    expect([...LONGEST_LANGUAGE_NAME].length).toBe(longest);
  });
});
