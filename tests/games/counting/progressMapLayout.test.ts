import { describe, expect, it } from 'vitest';

import { MAP_STEPS, MAP_THEMES } from '../../../src/games/counting/logic/progressMap';
import { layoutProgressMap, markerAt } from '../../../src/games/counting/logic/progressMapLayout';
import type {
  MapPoint,
  ProgressMapLayout,
} from '../../../src/games/counting/logic/progressMapLayout';
import { gameAreaFor } from '../../../src/shared/logic/viewportLayout';
import { LAYOUT_RULES } from '../../shared/layoutRules';
import type { LayoutScene } from '../../shared/layoutRules';
import { viewportOf } from '../../shared/viewportFixtures';
import type { TestWindow } from '../../shared/viewportFixtures';
import { MAP_WINDOWS, mapScenes } from './mapLayoutScenes';

/**
 * Testy k #133 AC6 a AC7 (nahrazují #87 AC7 s 8 kroky): zástupná mapa
 * postupu se 4 místy (start, 2 zastávky, cíl) a značkou se vejde do
 * obrazovky na iPadu na šířku i na telefonu na šířku i na výšku, pro
 * každou z 5 map a se značkou na každém kroku 0 až 3. Každé společné
 * pravidlo rozložení má jeden test, který v cyklu projde všechny případy
 * (`mapLayoutScenes.ts`), popis případu je ve zprávě `expect`.
 *
 * Cesta vede rovnými úseky od místa k místu po řadě (start, 1. zastávka,
 * 2. zastávka, cíl), nesmí se sama křížit, na šířku vede zleva doprava
 * a na výšku zdola nahoru.
 *
 * Ručně se kontroluje: mapa je bez textů a vypadá jako mapa, kontrast
 * značky a míst vůči pozadí každé mapy (#133 AC6).
 */

let cached: LayoutScene[] | undefined;

/** Obrazovky mapy se spočítají jednou, všechna pravidla je pak jen čtou. */
function scenes(): LayoutScene[] {
  cached ??= mapScenes();
  return cached;
}

interface MapCase {
  readonly label: string;
  readonly window: TestWindow;
  readonly layout: ProgressMapLayout;
}

/** Rozložení každé z 5 map v každém okně. */
function mapCases(): MapCase[] {
  return MAP_WINDOWS.flatMap((window) =>
    MAP_THEMES.map((theme) => ({
      label: `${window.name}, mapa ${theme}`,
      window,
      layout: layoutProgressMap(gameAreaFor(viewportOf(window)), theme),
    })),
  );
}

function isLandscape(window: TestWindow): boolean {
  return window.width > window.height;
}

/** Na které straně přímky `a`–`b` leží `c`: kladně, záporně, nebo 0 na přímce. */
function side(a: MapPoint, b: MapPoint, c: MapPoint): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

/** Leží `c` (na přímce `a`–`b`) uvnitř úseku `a`–`b`? */
function liesOnSegment(a: MapPoint, b: MapPoint, c: MapPoint): boolean {
  return (
    side(a, b, c) === 0 &&
    Math.min(a.x, b.x) <= c.x &&
    c.x <= Math.max(a.x, b.x) &&
    Math.min(a.y, b.y) <= c.y &&
    c.y <= Math.max(a.y, b.y)
  );
}

/** Mají úseky `a`–`b` a `c`–`d` společný bod? */
function segmentsTouch(a: MapPoint, b: MapPoint, c: MapPoint, d: MapPoint): boolean {
  const d1 = side(c, d, a);
  const d2 = side(c, d, b);
  const d3 = side(a, b, c);
  const d4 = side(a, b, d);
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
    return true;
  }
  return (
    liesOnSegment(c, d, a) ||
    liesOnSegment(c, d, b) ||
    liesOnSegment(a, b, c) ||
    liesOnSegment(a, b, d)
  );
}

/** Kde se cesta kříží sama se sebou (popis pro `expect`), prázdné pole = nikde. */
function pathCrossings(places: readonly MapPoint[]): string[] {
  const found: string[] = [];
  for (let first = 0; first + 1 < places.length; first += 1) {
    for (let second = first + 1; second + 1 < places.length; second += 1) {
      const [a, b, c, d] = [
        places[first],
        places[first + 1],
        places[second],
        places[second + 1],
      ] as [MapPoint, MapPoint, MapPoint, MapPoint];
      const neighbours = second === first + 1;
      // Sousední úseky sdílí jen společné místo, cesta se nesmí vracet po sobě.
      const touches = neighbours
        ? liesOnSegment(a, b, d) || liesOnSegment(c, d, a)
        : segmentsTouch(a, b, c, d);
      if (touches) {
        found.push(`úsek ${first}–${first + 1} a úsek ${second}–${second + 1}`);
      }
    }
  }
  return found;
}

describe('#133 AC7: mapa postupu dodrží společná pravidla rozložení', () => {
  for (const [ruleName, rule] of Object.entries(LAYOUT_RULES)) {
    it(`${ruleName} ve všech oknech, na každé z 5 map a se značkou na každém kroku`, () => {
      expect(scenes().length).toBeGreaterThan(0);
      for (const scene of scenes()) {
        expect(rule(scene), scene.label).toEqual([]);
      }
    });
  }

  it('každá kombinace okna, mapy a kroku je jiný případ', () => {
    const labels = scenes().map((scene) => scene.label);
    expect(new Set(labels).size).toBe(labels.length);
    expect(labels.length).toBe(MAP_WINDOWS.length * MAP_THEMES.length * (MAP_STEPS + 1));
  });
});

describe('#133 AC6: na mapě jsou 4 místa na cestě a značka', () => {
  it('každá mapa má v každém okně 4 místa: start, 2 zastávky a cíl', () => {
    for (const { label, layout } of mapCases()) {
      expect(layout.places, label).toHaveLength(4);
      expect(layout.places, label).toHaveLength(MAP_STEPS + 1);
    }
  });

  it('značka stojí na startu na kroku 0, v cíli na kroku 3 a jinak na své zastávce', () => {
    for (const { label, layout } of mapCases()) {
      for (let step = 0; step <= MAP_STEPS; step += 1) {
        expect(markerAt(layout, step), `${label}, krok ${step}`).toEqual(layout.places[step]);
      }
    }
  });

  it('značka a místa na mapě jsou vidět (nenulová velikost)', () => {
    for (const { label, layout } of mapCases()) {
      expect(layout.placeSize, label).toBeGreaterThan(0);
      expect(layout.markerSize, label).toBeGreaterThan(0);
    }
  });
});

describe('#133 AC7: cesta spojuje sousední místa po řadě a nekříží se', () => {
  it('cesta se na žádné mapě v žádném okně sama nekříží ani nevrací po sobě', () => {
    for (const { label, layout } of mapCases()) {
      expect(pathCrossings(layout.places), label).toEqual([]);
    }
  });

  it('na šířku vede cesta zleva doprava: každé další místo je víc vpravo', () => {
    const landscape = mapCases().filter((testCase) => isLandscape(testCase.window));
    expect(landscape.length).toBeGreaterThan(0);
    for (const { label, layout } of landscape) {
      for (let step = 1; step <= MAP_STEPS; step += 1) {
        const before = layout.places[step - 1];
        const place = layout.places[step];
        expect(place?.x, `${label}, ${step - 1} → ${step}`).toBeGreaterThan(before?.x ?? Infinity);
      }
    }
  });

  it('na výšku vede cesta zdola nahoru: každé další místo je výš', () => {
    const portrait = mapCases().filter((testCase) => !isLandscape(testCase.window));
    expect(portrait.length).toBeGreaterThan(0);
    for (const { label, layout } of portrait) {
      for (let step = 1; step <= MAP_STEPS; step += 1) {
        const before = layout.places[step - 1];
        const place = layout.places[step];
        expect(place?.y, `${label}, ${step - 1} → ${step}`).toBeLessThan(before?.y ?? -Infinity);
      }
    }
  });

  it('pomůcka na křížení pozná zkříženou i vracející se cestu', () => {
    const crossed = [
      { x: 0, y: 0 },
      { x: 10, y: 10 },
      { x: 10, y: 0 },
      { x: 0, y: 10 },
    ];
    const folded = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 5, y: 0 },
      { x: 5, y: 10 },
    ];
    const straight = [
      { x: 0, y: 0 },
      { x: 10, y: 5 },
      { x: 20, y: 0 },
      { x: 30, y: 5 },
    ];
    expect(pathCrossings(crossed)).not.toEqual([]);
    expect(pathCrossings(folded)).not.toEqual([]);
    expect(pathCrossings(straight)).toEqual([]);
  });
});
