import { describe, expect, it } from 'vitest';

import { MAP_GOAL_CELEBRATION_SCALE } from '../../../src/games/counting/logic/mapAnimation';
import { MAP_STEPS } from '../../../src/games/counting/logic/progressMap';
import { LAYOUT_RULES } from '../../shared/layoutRules';
import type { LayoutItem, LayoutScene } from '../../shared/layoutRules';
import { box, isInside, toCss, widthOf } from '../../shared/viewportFixtures';
import type { Box } from '../../shared/viewportFixtures';
import { cornerItems, isOwnSurrounding, visibleAreaOf } from './layoutScenes';
import { placeName } from './mapLayoutScenes';
import {
  GOAL_SYMBOL_NAME,
  drawnPlaceSize,
  goalSymbolBox,
  pictureMapCases,
} from './mapPictureLayoutScenes';
import type { PictureMapCase } from './mapPictureLayoutScenes';

/**
 * Testy k #135 AC3 a upřesnění vzhledu z 2026-11-12: symbol cíle se po
 * dojití značky zvětší 1,3× se zlatou září a prstencem a celý se musí vejít
 * do herní plochy (dnes by se na iPadu vpravo usekl). Cíl se proto posune
 * dovnitř. Každé společné pravidlo rozložení má jeden test, který v cyklu
 * projde všechna okna mapy (`MAP_WINDOWS`) a 5 map, popis případu je ve
 * zprávě `expect`.
 *
 * Navržené rozhraní (navíc k #134):
 * - `ProgressMapLayout.goalCelebration: MapSquare` v
 *   `src/games/counting/logic/progressMapLayout.ts`: čtverec, do kterého
 *   se vejde celý slavící symbol cíle (podklad zvětšený 1,3× i se září
 *   a prstencem), se středem ve středu symbolu cíle, v herních jednotkách,
 * - `MAP_GOAL_CELEBRATION_SCALE` v `src/games/counting/logic/mapAnimation.ts`.
 *
 * Značka v cíli smí slavící cíl překrýt (záře je kolem cíle, aby cíl byl
 * poznat i pod značkou, kontrola UX #133), start ani zastávky ne.
 * Ručně se kontroluje, jak záře a prstenec vypadají.
 */

const CELEBRATING_GOAL_NAME = 'slavící symbol cíle';

/** Čtverec slavícího symbolu cíle v CSS px okna, nebo `null`, když chybí. */
function celebrationBox(testCase: PictureMapCase): Box | null {
  const square = testCase.layout.goalCelebration;
  if (!square) {
    return null;
  }
  return toCss(box(square.x, square.y, square.size, square.size), testCase.area);
}

/** Herní plocha v CSS px okna: mimo ni plátno nic nenakreslí. */
function gamePlaneOf(testCase: PictureMapCase): Box {
  const { area } = testCase;
  return toCss({ left: 0, right: area.width, top: 0, bottom: area.height }, area);
}

/** Obrazovka mapy v cíli: kolečko a domeček, start, zastávky a slavící cíl. */
function celebrationScene(testCase: PictureMapCase): LayoutScene {
  const { window, area, layout } = testCase;
  const stops: LayoutItem[] = layout.places.slice(0, MAP_STEPS).map((place, step) => {
    const size = drawnPlaceSize(layout, step);
    return { name: placeName(step), box: toCss(box(place.x, place.y, size, size), area) };
  });
  const celebrating = celebrationBox(testCase);
  const goalItems: LayoutItem[] =
    celebrating === null ? [] : [{ name: CELEBRATING_GOAL_NAME, box: celebrating }];
  return {
    label: `${testCase.label}, značka v cíli, cíl slaví`,
    free: visibleAreaOf(window, area),
    items: [...cornerItems(window, area), ...stops, ...goalItems],
    mayOverlap: (first, second) =>
      isOwnSurrounding(first, second) || isOwnSurrounding(second, first),
  };
}

let cached: PictureMapCase[] | undefined;

function cases(): PictureMapCase[] {
  cached ??= pictureMapCases();
  return cached;
}

describe('#135 AC3: zvětšený cíl se září se celý vejde do herní plochy', () => {
  for (const [ruleName, rule] of Object.entries(LAYOUT_RULES)) {
    it(`${ruleName}: slavící cíl ve všech oknech a na každé z 5 map`, () => {
      expect(cases().length).toBeGreaterThan(0);
      for (const testCase of cases()) {
        const scene = celebrationScene(testCase);
        expect(
          scene.items.some((item) => item.name === CELEBRATING_GOAL_NAME),
          `${scene.label}: rozložení zná slavící cíl`,
        ).toBe(true);
        expect(rule(scene), scene.label).toEqual([]);
      }
    });
  }

  it('slavící cíl se na iPadu ani nikde jinde neusekne na okraji herní plochy', () => {
    for (const testCase of cases()) {
      const celebrating = celebrationBox(testCase);
      expect(celebrating, testCase.label).not.toBeNull();
      if (celebrating) {
        expect(isInside(celebrating, gamePlaneOf(testCase)), testCase.label).toBe(true);
      }
    }
  });

  it('slavící cíl je aspoň 1,3× větší než symbol cíle a stojí na jeho místě', () => {
    for (const testCase of cases()) {
      const square = testCase.layout.goalCelebration;
      expect(square, testCase.label).toBeDefined();
      if (!square) {
        continue;
      }
      const symbol = testCase.layout.goalSymbol;
      expect(
        square.size,
        `${testCase.label}: ${GOAL_SYMBOL_NAME} zvětšený i se září`,
      ).toBeGreaterThanOrEqual(symbol.size * MAP_GOAL_CELEBRATION_SCALE);
      expect(square.x, testCase.label).toBeCloseTo(symbol.x, 6);
      expect(square.y, testCase.label).toBeCloseTo(symbol.y, 6);
    }
  });

  it('symbol cíle v klidu leží celý uvnitř místa pro slavící cíl', () => {
    for (const testCase of cases()) {
      const celebrating = celebrationBox(testCase);
      expect(celebrating, testCase.label).not.toBeNull();
      if (celebrating) {
        const symbol = goalSymbolBox(testCase);
        expect(isInside(symbol, celebrating), testCase.label).toBe(true);
        expect(widthOf(celebrating), testCase.label).toBeGreaterThan(widthOf(symbol));
      }
    }
  });
});
