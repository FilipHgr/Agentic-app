import { describe, expect, it } from 'vitest';

import { MAP_STEPS, MAP_THEMES } from '../../../src/games/counting/logic/progressMap';
import { MAP_ARRIVAL_PULSE_SCALE } from '../../../src/games/counting/logic/progressMapLayout';
import { LAYOUT_RULES, MIN_TAP_SIDE } from '../../shared/layoutRules';
import type { LayoutScene } from '../../shared/layoutRules';
import { heightOf, toCss, box, widthOf } from '../../shared/viewportFixtures';
import {
  GOAL_SYMBOL_NAME,
  MAP_WINDOWS,
  goalSymbolBox,
  pictureMapCases,
  pictureMapScenes,
} from './mapPictureLayoutScenes';

/**
 * Testy k #134 AC2 a AC3: cesta, místa, symbol cíle a značka leží nad
 * obrázkem podle mapy na 3 kroky (#133 AC7). Každé společné pravidlo
 * rozložení má jeden test, který v cyklu projde všechna okna × 5 map ×
 * kroky 0–3 (`mapPictureLayoutScenes.ts`), popis případu je ve zprávě
 * `expect`. Místa a značka se měří i s okrajem a poskočením 1,15×
 * (kontrola #133). Mapa nemá ťukací plochu, kolečko a domeček zůstávají
 * ve svém rohu (AC3, #87 AC4).
 *
 * Symbol cíle i značka mají aspoň 64 CSS px (AC2). Je to velikost
 * obrázku, ne ťukací plochy; měří se bez okraje a poskočení.
 *
 * Ručně se kontroluje: kolečko a domeček jsou nad mapou vidět a fungují
 * (AC3, kreslí scéna), jak symbol a značka na obrázku vypadají (AC6).
 */

let cached: LayoutScene[] | undefined;

function scenes(): LayoutScene[] {
  cached ??= pictureMapScenes();
  return cached;
}

/** Vzdálenost dvou bodů. */
function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

describe('#134 AC2: místa, symbol cíle a značka dodrží společná pravidla rozložení', () => {
  for (const [ruleName, rule] of Object.entries(LAYOUT_RULES)) {
    it(`${ruleName} ve všech oknech, na každé z 5 map a se značkou na každém kroku`, () => {
      expect(scenes().length).toBeGreaterThan(0);
      for (const scene of scenes()) {
        expect(rule(scene), scene.label).toEqual([]);
      }
    });
  }

  it('každá kombinace okna, mapy a kroku je jiný případ a symbol cíle je v každém', () => {
    const labels = scenes().map((scene) => scene.label);
    expect(new Set(labels).size).toBe(labels.length);
    expect(labels.length).toBe(MAP_WINDOWS.length * MAP_THEMES.length * (MAP_STEPS + 1));
    for (const scene of scenes()) {
      expect(
        scene.items.some((item) => item.name === GOAL_SYMBOL_NAME),
        scene.label,
      ).toBe(true);
    }
  });

  it('rozložení počítá s poskočením místa a značky aspoň na 1,15×', () => {
    expect(MAP_ARRIVAL_PULSE_SCALE).toBeGreaterThanOrEqual(1.15);
  });
});

describe('#134 AC2: symbol cíle a značka jsou dost velké a symbol stojí u cíle', () => {
  it('symbol cíle má v každém okně na každé mapě aspoň 64 px', () => {
    for (const testCase of pictureMapCases()) {
      const symbol = goalSymbolBox(testCase);
      expect(Math.min(widthOf(symbol), heightOf(symbol)), testCase.label).toBeGreaterThanOrEqual(
        MIN_TAP_SIDE,
      );
    }
  });

  it('značka má v každém okně na každé mapě aspoň 64 px', () => {
    for (const { label, area, layout } of pictureMapCases()) {
      const marker = toCss(box(0, 0, layout.markerSize, layout.markerSize), area);
      expect(widthOf(marker), label).toBeGreaterThanOrEqual(MIN_TAP_SIDE);
    }
  });

  it('symbol cíle stojí blíž k cíli než ke kterémukoli jinému místu na cestě', () => {
    for (const { label, layout } of pictureMapCases()) {
      const goal = layout.places[MAP_STEPS];
      expect(goal, label).toBeDefined();
      if (!goal) {
        continue;
      }
      const toGoal = distance(layout.goalSymbol, goal);
      for (let step = 0; step < MAP_STEPS; step += 1) {
        const place = layout.places[step];
        if (place) {
          expect(toGoal, `${label}: blíž k cíli než k místu ${step}`).toBeLessThan(
            distance(layout.goalSymbol, place),
          );
        }
      }
    }
  });
});
