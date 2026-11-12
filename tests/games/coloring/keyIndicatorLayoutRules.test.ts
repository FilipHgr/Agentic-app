import { describe, expect, it } from 'vitest';

import { COLORING_GAME_AREA_FIT } from '../../../src/games/coloring/logic/coloringLayout';
import type { LayoutRect } from '../../../src/games/coloring/logic/coloringLayout';
import { bookAt, layoutPicker, previewAt } from '../../../src/games/coloring/logic/pickerLayout';
import type { PickerLayout } from '../../../src/games/coloring/logic/pickerLayout';
import { homeButtonFor } from '../../../src/shared/logic/homeButton';
import { gameAreaFor } from '../../../src/shared/logic/viewportLayout';
import type { GameArea } from '../../../src/shared/logic/viewportLayout';
import { LAYOUT_RULES, MIN_EDGE_DISTANCE, MIN_TAP_GAP } from '../../shared/layoutRules';
import type { LayoutItem, LayoutScene } from '../../shared/layoutRules';
import {
  freeAreaOf,
  gapBetween,
  heightOf,
  isInside,
  toCss,
  viewportOf,
  widthOf,
} from '../../shared/viewportFixtures';
import type { Box, TestWindow } from '../../shared/viewportFixtures';
import { COLORING_WINDOWS, HOME_NAME, boxOfRect } from './coloringLayoutScenes';

/**
 * Testy k #140 AC3 a otázce 7 (rozložení ukazatele klíčů na výběru):
 * pravidla v cyklu pro všechna okna testů rozložení Omalovánek
 * (`COLORING_WINDOWS`), jeden test na pravidlo, jako u knihy (#126)
 * a výběru (#124, #132). Ukazatel je vedle knihy alba a nesmí překrýt
 * knihu, náhledy ani domeček a 8 px kolem něj; od okraje je aspoň 4 px.
 * Na ťuknutí nereaguje, proto není ťukací plocha (pravidla 64 px a 8 px
 * se ho netýkají) a ťuknutí na něj nepatří knize ani náhledu.
 *
 * Měří se výběr se všemi 11 náhledy (zamčené jsou vidět ztlumené, AC1).
 * Kde přesně ukazatel vedle knihy leží a jak velký je, je ruční kontrola
 * v náhledu (otázka 7: obrázky po implementaci).
 *
 * Navržené rozšíření `pickerLayout.ts` (herní jednotky):
 * `PickerLayout.keyIndicator: LayoutRect` plocha ukazatele klíčů
 * (ikona 🔑 s číslicí a případnou půlkou klíče).
 */

const PICTURES_IN_SET = 11;
const BOOK_NAME = 'kniha';
const INDICATOR_NAME = 'ukazatel klíčů';

interface IndicatorCase {
  readonly window: TestWindow;
  readonly area: GameArea;
  readonly layout: PickerLayout;
  readonly visible: Box;
  readonly home: Box;
  readonly book: Box;
  readonly indicator: Box;
  readonly previews: readonly Box[];
  readonly scene: LayoutScene;
}

function previewName(index: number): string {
  return `náhled ${index + 1}`;
}

function visibleAreaOf(window: TestWindow, area: GameArea): Box {
  const free = freeAreaOf(window);
  const plane = toCss({ left: 0, right: area.width, top: 0, bottom: area.height }, area);
  return {
    left: Math.max(free.left, plane.left),
    right: Math.min(free.right, plane.right),
    top: Math.max(free.top, plane.top),
    bottom: Math.min(free.bottom, plane.bottom),
  };
}

function homeHitOf(window: TestWindow): Box {
  const home = homeButtonFor(viewportOf(window));
  return {
    left: home.left,
    right: home.left + home.hitSize,
    top: home.top,
    bottom: home.top + home.hitSize,
  };
}

function homeWithGap(home: Box): Box {
  return {
    left: home.left - MIN_TAP_GAP,
    right: home.right + MIN_TAP_GAP,
    top: home.top - MIN_TAP_GAP,
    bottom: home.bottom + MIN_TAP_GAP,
  };
}

function indicatorCase(window: TestWindow): IndicatorCase {
  const area = gameAreaFor(viewportOf(window), COLORING_GAME_AREA_FIT);
  const layout = layoutPicker(area);
  const css = (rect: LayoutRect): Box => toCss(boxOfRect(rect), area);
  const previews = layout.previews.slice(0, PICTURES_IN_SET).map(css);
  const book = css(layout.book);
  const indicator = css(layout.keyIndicator);
  const home = homeHitOf(window);
  const visible = visibleAreaOf(window, area);
  const items: LayoutItem[] = [
    { name: HOME_NAME, box: homeWithGap(home), reserved: true },
    ...previews.map((box, index) => ({ name: previewName(index), box, tappable: true })),
    { name: BOOK_NAME, box: book, tappable: true },
    { name: INDICATOR_NAME, box: indicator },
  ];
  return {
    window,
    area,
    layout,
    visible,
    home,
    book,
    indicator,
    previews,
    scene: { label: `${window.name}, výběr s ukazatelem klíčů`, free: visible, items },
  };
}

let cached: IndicatorCase[] | undefined;

function cases(): IndicatorCase[] {
  cached ??= COLORING_WINDOWS.map(indicatorCase);
  return cached;
}

/** Střed obdélníku v herních jednotkách. */
function centerOf(rect: LayoutRect): { readonly x: number; readonly y: number } {
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

describe('#140 AC3: výběr s ukazatelem klíčů dodrží společná pravidla rozložení', () => {
  for (const [ruleName, rule] of Object.entries(LAYOUT_RULES)) {
    it(`${ruleName} ve všech oknech i s ukazatelem klíčů`, () => {
      for (const testCase of cases()) {
        expect(rule(testCase.scene), testCase.scene.label).toEqual([]);
      }
    });
  }
});

describe('#140 AC3: ukazatel klíčů vedle knihy alba', () => {
  it('ukazatel je vidět: má plochu a je uvnitř bezpečné plochy aspoň 4 px od okraje', () => {
    for (const testCase of cases()) {
      const { visible } = testCase;
      const inner: Box = {
        left: visible.left + MIN_EDGE_DISTANCE,
        right: visible.right - MIN_EDGE_DISTANCE,
        top: visible.top + MIN_EDGE_DISTANCE,
        bottom: visible.bottom - MIN_EDGE_DISTANCE,
      };
      expect(widthOf(testCase.indicator), `${testCase.scene.label}, šířka`).toBeGreaterThan(0);
      expect(heightOf(testCase.indicator), `${testCase.scene.label}, výška`).toBeGreaterThan(0);
      expect(isInside(testCase.indicator, inner), testCase.scene.label).toBe(true);
    }
  });

  it('ukazatel nepřekrývá knihu alba', () => {
    for (const testCase of cases()) {
      expect(
        gapBetween(testCase.indicator, testCase.book),
        testCase.scene.label,
      ).toBeGreaterThanOrEqual(-0.01);
    }
  });

  it('ukazatel nepřekrývá žádný z 11 náhledů', () => {
    for (const testCase of cases()) {
      testCase.previews.forEach((preview, index) => {
        expect(
          gapBetween(testCase.indicator, preview),
          `${testCase.scene.label}: ukazatel a ${previewName(index)}`,
        ).toBeGreaterThanOrEqual(-0.01);
      });
    }
  });

  it('ukazatel nepřekrývá domeček ani 8 px kolem něj', () => {
    for (const testCase of cases()) {
      expect(
        gapBetween(testCase.indicator, testCase.home),
        testCase.scene.label,
      ).toBeGreaterThanOrEqual(MIN_TAP_GAP - 0.01);
    }
  });

  it('ťuknutí na ukazatel nepatří knize ani žádnému náhledu', () => {
    for (const testCase of cases()) {
      const { x, y } = centerOf(testCase.layout.keyIndicator);
      expect(previewAt(testCase.layout, x, y), `${testCase.scene.label}: náhled`).toBeNull();
      expect(bookAt(testCase.layout, x, y), `${testCase.scene.label}: kniha`).toBe(false);
    }
  });
});
