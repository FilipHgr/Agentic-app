import { describe, expect, it } from 'vitest';

import { gameAreaFor } from '../../../src/shared/logic/viewportLayout';
import type { GameArea } from '../../../src/shared/logic/viewportLayout';
import { tabletCssLayouts } from './tabletSnapshot';
import {
  IPAD_WINDOWS,
  TODAY_GAME_HEIGHT,
  TODAY_GAME_WIDTH,
  todayFitPlacement,
  viewportOf,
} from '../../shared/viewportFixtures';
import type { TestWindow } from '../../shared/viewportFixtures';

/**
 * Testy k #54, AC5: iPad dostane přesně dnešní rozložení Počítání.
 * Ostatní testy herní plochy jsou v `tests/shared/deviceLayout.test.ts`.
 */

/** Dnešní zmenšené zobrazení: 1024 × 768 celé v okně, na střed, co největší. */
function expectTodayScaledView(area: GameArea, window: TestWindow): void {
  const today = todayFitPlacement(window.width, window.height);
  expect(area.width).toBe(TODAY_GAME_WIDTH);
  expect(area.height).toBe(TODAY_GAME_HEIGHT);
  expect(area.scale).toBeCloseTo(today.scale, 6);
  expect(area.offsetX).toBeCloseTo(today.offsetX, 3);
  expect(area.offsetY).toBeCloseTo(today.offsetY, 3);
}

describe('AC5: iPad dostane přesně dnešní rozložení', () => {
  it.each(IPAD_WINDOWS)('$name: herní plocha je dnešní 1024 × 768 na středu okna', (window) => {
    const area = gameAreaFor(viewportOf(window));

    expect(area.mode).toBe('tablet');
    expectTodayScaledView(area, window);
  });

  it.each(IPAD_WINDOWS)(
    '$name: všechny prvky jsou na iPadu na stejném místě a stejně velké jako dnes',
    (window) => {
      const area = gameAreaFor(viewportOf(window));
      const today = todayFitPlacement(window.width, window.height);

      expect(tabletCssLayouts(area.width, area.height, area)).toEqual(
        tabletCssLayouts(TODAY_GAME_WIDTH, TODAY_GAME_HEIGHT, today),
      );
    },
  );
});
