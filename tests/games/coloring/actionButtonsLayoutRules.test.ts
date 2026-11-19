import { describe, expect, it } from 'vitest';

import {
  COLORING_GAME_AREA_FIT,
  layoutColoring,
} from '../../../src/games/coloring/logic/coloringLayout';
import type { LayoutRect } from '../../../src/games/coloring/logic/coloringLayout';
import { layoutBigPicture, layoutPicker } from '../../../src/games/coloring/logic/pickerLayout';
import { gameAreaFor } from '../../../src/shared/logic/viewportLayout';
import { MIN_TAP_SIDE } from '../../shared/layoutRules';
import { heightOf, toCss, viewportOf, widthOf } from '../../shared/viewportFixtures';
import type { Box, TestWindow } from '../../shared/viewportFixtures';
import { COLORING_WINDOWS, boxOfRect } from './coloringLayoutScenes';
import { ACTION_BUTTONS_BEFORE_153 } from './layoutBefore153Fixture';
import type { ActionButtonsBefore153, CssEdges } from './layoutBefore153Fixture';
import { limited } from './toolIconHelpers';

/**
 * Testy k #153 AC4 (rozložení): nové ikony a barvy podkladů tlačítka
 * nepřesunou ani nezmenší. Pravidla v cyklu přes všechna okna testů
 * rozložení Omalovánek (`COLORING_WINDOWS`), jeden test na pravidlo,
 * popis případu v `expect`. Místa před #153 jsou v pevné tabulce
 * `layoutBefore153Fixture.ts`. Ostatní pravidla rozložení (odstupy,
 * překryvy, okraje) hlídají dál testy #126, #129, #131 a #142; když se
 * místa nezmění, platí beze změny.
 */

type ButtonKey = Exclude<keyof ActionButtonsBefore153, 'window'>;

const BUTTON_NAMES: Readonly<Record<ButtonKey, string>> = {
  camera: 'fotoaparát',
  broom: 'koště',
  album: 'album',
  trash: 'koš',
  continueButton: 'malovat dál',
};

const BUTTON_KEYS = Object.keys(BUTTON_NAMES) as ButtonKey[];

/** Tolerance zaokrouhlení tabulky na tisíciny px. */
const TOLERANCE = 0.01;

interface ButtonCase {
  readonly label: string;
  readonly key: ButtonKey;
  readonly box: Box;
}

function buttonBoxes(window: TestWindow): Readonly<Record<ButtonKey, Box>> {
  const area = gameAreaFor(viewportOf(window), COLORING_GAME_AREA_FIT);
  const css = (rect: LayoutRect): Box => toCss(boxOfRect(rect), area);
  const painting = layoutColoring(area);
  const bigPicture = layoutBigPicture(area);
  return {
    camera: css(painting.cameraButton),
    broom: css(painting.broomButton),
    album: css(layoutPicker(area).book),
    trash: css(bigPicture.trash),
    continueButton: css(bigPicture.continueButton),
  };
}

function cases(): ButtonCase[] {
  return COLORING_WINDOWS.flatMap((window) => {
    const boxes = buttonBoxes(window);
    return BUTTON_KEYS.map((key) => ({
      label: `${window.name}, ${BUTTON_NAMES[key]}`,
      key,
      box: boxes[key],
    }));
  });
}

function edgesOf(box: Box): CssEdges {
  return [box.left, box.top, box.right, box.bottom];
}

function sameEdges(first: CssEdges, second: CssEdges): boolean {
  return first.every((value, index) => Math.abs(value - (second[index] ?? NaN)) <= TOLERANCE);
}

describe('#153 AC4: tlačítka s novými ikonami zůstávají stejná', () => {
  it('tabulka míst před #153 pokrývá všechna okna testů rozložení', () => {
    expect(ACTION_BUTTONS_BEFORE_153.map((row) => row.window)).toEqual(
      COLORING_WINDOWS.map((window) => window.name),
    );
  });

  it('fotoaparát, album, malovat dál, koš i koště mají ve všech oknech aspoň 64 × 64 px', () => {
    const problems = cases()
      .filter(
        (testCase) =>
          widthOf(testCase.box) < MIN_TAP_SIDE - TOLERANCE ||
          heightOf(testCase.box) < MIN_TAP_SIDE - TOLERANCE,
      )
      .map(
        (testCase) =>
          `${testCase.label}: ${widthOf(testCase.box).toFixed(2)} × ${heightOf(testCase.box).toFixed(2)} px`,
      );
    expect(limited(problems)).toEqual([]);
  });

  it('fotoaparát, album, malovat dál, koš i koště jsou ve všech oknech na stejném místě jako před #153', () => {
    const problems: string[] = [];
    for (const window of COLORING_WINDOWS) {
      const before = ACTION_BUTTONS_BEFORE_153.find((row) => row.window === window.name);
      if (before === undefined) {
        problems.push(`${window.name}: chybí v tabulce před #153`);
        continue;
      }
      const boxes = buttonBoxes(window);
      for (const key of BUTTON_KEYS) {
        const now = edgesOf(boxes[key]);
        if (!sameEdges(now, before[key])) {
          problems.push(
            `${window.name}, ${BUTTON_NAMES[key]}: [${now.map((value) => value.toFixed(3)).join(', ')}] místo [${before[key].join(', ')}]`,
          );
        }
      }
    }
    expect(limited(problems)).toEqual([]);
  });
});
