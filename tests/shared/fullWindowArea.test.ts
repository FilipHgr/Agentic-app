import { describe, expect, it } from 'vitest';

import { gameAreaFor } from '../../src/shared/logic/viewportLayout';
import type { GameArea } from '../../src/shared/logic/viewportLayout';
import { HOME_SCREEN_WINDOWS } from './layoutRules';
import {
  IPAD_WINDOWS,
  JUST_ABOVE_LIMIT,
  NO_NOTCH,
  PHONE_PORTRAIT_EDGE_WINDOWS,
  PHONE_PORTRAIT_WINDOWS,
  PHONE_WINDOWS,
  freeAreaOf,
  heightOf,
  viewportOf,
  widthOf,
} from './viewportFixtures';
import type { Box, TestWindow } from './viewportFixtures';

/**
 * Testy k volbě herní plochy `fullWindow` (#96, technické rozhodnutí 1):
 * hra si může říct o plochu přes celou volnou plochu okna i na iPadu.
 * Telefon a zmenšené zobrazení zůstanou jako u `fixed` a bez volby je
 * všechno jako dřív (Počítání se nemění, #54 AC5). Každé pravidlo má jeden
 * test, který v cyklu projde všechna okna; popis okna je ve zprávě `expect`.
 */

/** Tolerance v CSS px: plocha má celé jednotky, ubere nejvýš půl CSS px. */
const CSS_TOLERANCE = 0.5;

/** Okna, která dostanou zmenšené zobrazení (iPad na výšku, malé okno). */
const SCALED_WINDOWS: readonly TestWindow[] = [
  { name: 'iPad 820×1180 na výšku', width: 820, height: 1180, safeArea: NO_NOTCH },
  { name: '600×400 malé okno', width: 600, height: 400, safeArea: NO_NOTCH },
];

const PHONE_ALL: readonly TestWindow[] = [
  ...PHONE_WINDOWS,
  ...PHONE_PORTRAIT_WINDOWS,
  ...PHONE_PORTRAIT_EDGE_WINDOWS,
];

/** iPad na šířku v Safari i z plochy (se stavovým řádkem a lištou). */
const TABLET_WINDOWS: readonly TestWindow[] = [
  ...IPAD_WINDOWS,
  JUST_ABOVE_LIMIT,
  ...HOME_SCREEN_WINDOWS.filter((window) => window.width >= 1000),
];

const ALL_WINDOWS: readonly TestWindow[] = [...TABLET_WINDOWS, ...PHONE_ALL, ...SCALED_WINDOWS];

function cssBoxOf(area: GameArea): Box {
  return {
    left: area.offsetX,
    top: area.offsetY,
    right: area.offsetX + area.width * area.scale,
    bottom: area.offsetY + area.height * area.scale,
  };
}

describe('#96: herní plocha přes celou volnou plochu okna (`fullWindow`)', () => {
  it('zkouší se iPad na šířku i z plochy, telefon na šířku i na výšku a zmenšené zobrazení', () => {
    const modes = new Set(
      ALL_WINDOWS.map((window) => gameAreaFor(viewportOf(window), 'fullWindow').mode),
    );
    expect([...modes].sort()).toEqual(['phoneLandscape', 'phonePortrait', 'scaled', 'tablet']);
  });

  it('iPad na šířku dostane celou volnou plochu okna, mimo výřez, stavový řádek a lištu', () => {
    for (const window of TABLET_WINDOWS) {
      const area = gameAreaFor(viewportOf(window), 'fullWindow');
      const placed = cssBoxOf(area);
      const free = freeAreaOf(window);
      expect(area.mode, window.name).toBe('tablet');
      expect(placed.left, `${window.name}: levý okraj`).toBeCloseTo(free.left, 6);
      expect(placed.top, `${window.name}: horní okraj`).toBeCloseTo(free.top, 6);
      expect(placed.right, `${window.name}: pravý okraj`).toBeLessThanOrEqual(free.right);
      expect(placed.bottom, `${window.name}: spodní okraj`).toBeLessThanOrEqual(free.bottom);
      expect(widthOf(placed), `${window.name}: šířka`).toBeGreaterThanOrEqual(
        widthOf(free) - CSS_TOLERANCE,
      );
      expect(heightOf(placed), `${window.name}: výška`).toBeGreaterThanOrEqual(
        heightOf(free) - CSS_TOLERANCE,
      );
      expect(area.coveredEdges, `${window.name}: nic pod výřezem`).toBeUndefined();
    }
  });

  it('iPad s plochou přes celé okno má 2 herní jednotky na CSS px jako telefon', () => {
    for (const window of TABLET_WINDOWS) {
      expect(gameAreaFor(viewportOf(window), 'fullWindow').scale, window.name).toBeCloseTo(0.5, 6);
    }
  });

  it('telefon na šířku i na výšku dostane stejnou plochu jako u `fixed`', () => {
    for (const window of PHONE_ALL) {
      expect(gameAreaFor(viewportOf(window), 'fullWindow'), window.name).toEqual(
        gameAreaFor(viewportOf(window), 'fixed'),
      );
    }
  });

  it('zmenšené zobrazení zůstane stejné jako u `fixed`', () => {
    for (const window of SCALED_WINDOWS) {
      const area = gameAreaFor(viewportOf(window), 'fullWindow');
      expect(area.mode, window.name).toBe('scaled');
      expect(area, window.name).toEqual(gameAreaFor(viewportOf(window), 'fixed'));
    }
  });

  it('bez volby je plocha `fixed`: iPad má dál dnešní plochu 1024 × 768', () => {
    for (const window of ALL_WINDOWS) {
      expect(gameAreaFor(viewportOf(window)), window.name).toEqual(
        gameAreaFor(viewportOf(window), 'fixed'),
      );
    }
    for (const window of IPAD_WINDOWS) {
      const area = gameAreaFor(viewportOf(window));
      expect([area.width, area.height], window.name).toEqual([1024, 768]);
    }
  });

  it('nesmyslné okno dá s `fullWindow` stejné zmenšené zobrazení jako bez volby', () => {
    const broken = [undefined, { width: Number.NaN, height: 500, safeArea: NO_NOTCH }];
    for (const viewport of broken) {
      expect(gameAreaFor(viewport, 'fullWindow')).toEqual(gameAreaFor(viewport));
    }
  });
});
