import { describe, expect, it } from 'vitest';

import { COLORING_GAME_AREA_FIT } from '../../../src/games/coloring/logic/coloringLayout';
import type { LayoutRect } from '../../../src/games/coloring/logic/coloringLayout';
import { keyInLockAt, layoutPicker } from '../../../src/games/coloring/logic/pickerLayout';
import type { PickerLayout } from '../../../src/games/coloring/logic/pickerLayout';
import { COLORING_PICTURES } from '../../../src/games/coloring/logic/pictureSet';
import { homeButtonFor } from '../../../src/shared/logic/homeButton';
import { gameAreaFor } from '../../../src/shared/logic/viewportLayout';
import type { GameArea } from '../../../src/shared/logic/viewportLayout';
import { LAYOUT_RULES, MIN_TAP_GAP } from '../../shared/layoutRules';
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
 * Testy k #159 AC6 (rozložení ukazatele klíčů a klíče v zámku): pravidla
 * v cyklu pro všechna okna testů rozložení Omalovánek (`COLORING_WINDOWS`),
 * jeden test na pravidlo, popis případu v `expect`. Měří se výběr se
 * skutečnou sadou (od #152 papír a 16 omalovánek na 2 stránkách, se
 * šipkami) i výběr bez počtu omalovánek (jako před #150), na plné stránce
 * s 12 náhledy.
 *
 * Pravidla ze zadání:
 * - ukazatel klíčů je od knihy, náhledů a okraje viditelné plochy aspoň
 *   8 px a nic nepřekrývá (#140 AC3 chtělo od okraje jen 4 px),
 * - klíč v zámku leží celý uvnitř náhledu, do kterého doletěl.
 * Ukazatel na ťuknutí nereaguje, proto není ťukací plocha.
 *
 * Navržené rozšíření `pickerLayout.ts` (herní jednotky):
 * `keyInLockAt(layout: PickerLayout, place: number): LayoutRect` kam se
 * kreslí klíč v zámku náhledu na místě `place` (0–11) stránky výběru.
 */

const PAGE_PLACES = 12;
const KEY_GAP = 8;
const BOOK_NAME = 'kniha';
const INDICATOR_NAME = 'ukazatel klíčů';
const PREVIOUS_NAME = 'šipka ◀';
const NEXT_NAME = 'šipka ▶';

/** Výběr se skutečnou sadou (se šipkami), nebo bez počtu omalovánek (bez šipek). */
const PICTURE_COUNTS: ReadonlyArray<number | undefined> = [COLORING_PICTURES.length, undefined];

interface KeyCase {
  readonly label: string;
  readonly layout: PickerLayout;
  readonly area: GameArea;
  readonly visible: Box;
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

function homeWithGapOf(window: TestWindow): Box {
  const home = homeButtonFor(viewportOf(window));
  return {
    left: home.left - MIN_TAP_GAP,
    right: home.left + home.hitSize + MIN_TAP_GAP,
    top: home.top - MIN_TAP_GAP,
    bottom: home.top + home.hitSize + MIN_TAP_GAP,
  };
}

function keyCase(window: TestWindow, pictureCount: number | undefined): KeyCase {
  const area = gameAreaFor(viewportOf(window), COLORING_GAME_AREA_FIT);
  const layout =
    pictureCount === undefined ? layoutPicker(area) : layoutPicker(area, { pictureCount });
  const css = (rect: LayoutRect): Box => toCss(boxOfRect(rect), area);
  const previews = layout.previews.slice(0, PAGE_PLACES).map(css);
  const book = css(layout.book);
  const indicator = css(layout.keyIndicator);
  const visible = visibleAreaOf(window, area);
  const arrows: LayoutItem[] = layout.arrows
    ? [
        { name: PREVIOUS_NAME, box: css(layout.previousArrow), tappable: true },
        { name: NEXT_NAME, box: css(layout.nextArrow), tappable: true },
      ]
    : [];
  const items: LayoutItem[] = [
    { name: HOME_NAME, box: homeWithGapOf(window), reserved: true },
    ...previews.map((box, index) => ({ name: previewName(index), box, tappable: true })),
    { name: BOOK_NAME, box: book, tappable: true },
    ...arrows,
    { name: INDICATOR_NAME, box: indicator, minEdge: KEY_GAP },
  ];
  const what = pictureCount === undefined ? 'bez počtu omalovánek' : `${pictureCount} náhledů`;
  const label = `${window.name}, výběr (${what}) s ukazatelem klíčů`;
  return {
    label,
    layout,
    area,
    visible,
    book,
    indicator,
    previews,
    scene: { label, free: visible, items },
  };
}

let cached: KeyCase[] | undefined;

function cases(): KeyCase[] {
  cached ??= COLORING_WINDOWS.flatMap((window) =>
    PICTURE_COUNTS.map((count) => keyCase(window, count)),
  );
  return cached;
}

describe('#159 AC6: výběr s ukazatelem klíčů dodrží společná pravidla rozložení', () => {
  for (const [ruleName, rule] of Object.entries(LAYOUT_RULES)) {
    it(`${ruleName} ve všech oknech, ukazatel aspoň 8 px od okraje`, () => {
      for (const testCase of cases()) {
        expect(rule(testCase.scene), testCase.label).toEqual([]);
      }
    });
  }
});

describe('#159 AC6: ukazatel klíčů má kolem sebe aspoň 8 px', () => {
  it('ukazatel je od knihy aspoň 8 px', () => {
    for (const testCase of cases()) {
      expect(gapBetween(testCase.indicator, testCase.book), testCase.label).toBeGreaterThanOrEqual(
        KEY_GAP - 0.01,
      );
    }
  });

  it('ukazatel je od každého náhledu aspoň 8 px', () => {
    for (const testCase of cases()) {
      testCase.previews.forEach((preview, index) => {
        expect(
          gapBetween(testCase.indicator, preview),
          `${testCase.label}: ukazatel a ${previewName(index)}`,
        ).toBeGreaterThanOrEqual(KEY_GAP - 0.01);
      });
    }
  });

  it('ukazatel je od okraje viditelné plochy aspoň 8 px', () => {
    for (const testCase of cases()) {
      const { visible } = testCase;
      const inner: Box = {
        left: visible.left + KEY_GAP,
        right: visible.right - KEY_GAP,
        top: visible.top + KEY_GAP,
        bottom: visible.bottom - KEY_GAP,
      };
      expect(isInside(testCase.indicator, inner), testCase.label).toBe(true);
    }
  });
});

describe('#159 AC6: klíč v zámku leží uvnitř náhledu', () => {
  it('klíč v zámku má plochu a leží celý uvnitř svého náhledu na každém místě stránky', () => {
    for (const testCase of cases()) {
      testCase.previews.forEach((preview, place) => {
        const key = toCss(boxOfRect(keyInLockAt(testCase.layout, place)), testCase.area);
        const what = `${testCase.label}: klíč v zámku ${previewName(place)}`;
        expect(widthOf(key), `${what}, šířka`).toBeGreaterThan(0);
        expect(heightOf(key), `${what}, výška`).toBeGreaterThan(0);
        expect(isInside(key, preview), what).toBe(true);
      });
    }
  });
});
