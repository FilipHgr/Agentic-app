import { describe, expect, it } from 'vitest';

import { MAP_STEPS } from '../../../src/games/counting/logic/progressMap';
import { layoutProgressMap, markerAt } from '../../../src/games/counting/logic/progressMapLayout';
import { gameAreaFor } from '../../../src/shared/logic/viewportLayout';
import { LAYOUT_RULES } from '../../shared/layoutRules';
import type { LayoutScene } from '../../shared/layoutRules';
import { viewportOf } from '../../shared/viewportFixtures';
import { MAP_WINDOWS, mapScenes } from './mapLayoutScenes';

/**
 * Testy k #87 AC7: zástupný vzhled mapy postupu (start, 8 zastávek
 * včetně cíle a značka) se vejde do obrazovky na iPadu na šířku i na
 * telefonu na šířku i na výšku. Každé společné pravidlo rozložení má
 * jeden test, který v cyklu projde všechna okna a značku na každém kroku
 * (`mapLayoutScenes.ts`), popis případu je ve zprávě `expect`.
 *
 * Ručně se kontroluje: mapa je bez textů a vypadá jako mapa (cesta mezi
 * zastávkami), plynulost kroku a zvuk (AC8).
 */

let cached: LayoutScene[] | undefined;

/** Obrazovky mapy se spočítají jednou, všechna pravidla je pak jen čtou. */
function scenes(): LayoutScene[] {
  cached ??= mapScenes();
  return cached;
}

describe('#87 AC7: mapa postupu dodrží společná pravidla rozložení', () => {
  for (const [ruleName, rule] of Object.entries(LAYOUT_RULES)) {
    it(`${ruleName} ve všech oknech se značkou na každém kroku`, () => {
      expect(scenes().length).toBeGreaterThan(0);
      for (const scene of scenes()) {
        expect(rule(scene), scene.label).toEqual([]);
      }
    });
  }

  it('každá kombinace okna a kroku je jiný případ', () => {
    const labels = scenes().map((scene) => scene.label);
    expect(new Set(labels).size).toBe(labels.length);
    expect(labels.length).toBe(MAP_WINDOWS.length * (MAP_STEPS + 1));
  });
});

describe('#87 AC7: na mapě je start, zastávky, cíl a značka', () => {
  it('mapa má místo pro každý krok: start, 7 zastávek a cíl jako 8. zastávku', () => {
    for (const window of MAP_WINDOWS) {
      const layout = layoutProgressMap(gameAreaFor(viewportOf(window)));
      expect(layout.places, window.name).toHaveLength(MAP_STEPS + 1);
    }
  });

  it('značka stojí na startu na kroku 0, v cíli na kroku 8 a jinak na své zastávce', () => {
    for (const window of MAP_WINDOWS) {
      const layout = layoutProgressMap(gameAreaFor(viewportOf(window)));
      for (let step = 0; step <= MAP_STEPS; step += 1) {
        expect(markerAt(layout, step), `${window.name}, krok ${step}`).toEqual(layout.places[step]);
      }
    }
  });

  it('značka a místa na mapě jsou vidět (nenulová velikost)', () => {
    for (const window of MAP_WINDOWS) {
      const layout = layoutProgressMap(gameAreaFor(viewportOf(window)));
      expect(layout.placeSize, window.name).toBeGreaterThan(0);
      expect(layout.markerSize, window.name).toBeGreaterThan(0);
    }
  });
});
