import { describe, expect, it } from 'vitest';

import { LAYOUT_RULES } from '../../shared/layoutRules';
import type { LayoutScene } from '../../shared/layoutRules';
import { sceneryCases, sceneryScenes, pathViolations } from './mapSceneryScenes';
import type { SceneryCase } from './mapSceneryScenes';

/**
 * Testy k #136 AC2 a AC3 (otočení): celá plocha, kterou kousek prostředí
 * během pohybu projde (i se svou velikostí), a vymezené pruhy listí
 * a bublinek nepřekrývají značku, místa, symbol cíle (ani slavící, #135
 * AC3), roh kolečka a domečku, výřez ani lištu. Každé společné pravidlo
 * rozložení má jeden test, který v cyklu projde všechna okna mapy z #133
 * AC7 (`MAP_WINDOWS`, iPad, telefon na šířku i na výšku, spuštění
 * z plochy), 5 map a značku na krocích 0 až 3; popis případu je ve zprávě
 * `expect`. Protože se pravidla zkouší v oknech obou orientací, platí AC2
 * i po otočení zařízení (AC3).
 *
 * Kousky se smí překrývat navzájem (listí ve stejném pruhu), s ničím
 * jiným. Cesta vede šikmými úseky, proto ji hlídá samostatný test
 * s přesnou vzdáleností od úseku, ne obdélník.
 *
 * Navržené rozhraní viz `mapSceneryScenes.ts`.
 */

let cachedCases: SceneryCase[] | undefined;
let cachedScenes: LayoutScene[] | undefined;

function cases(): SceneryCase[] {
  cachedCases ??= sceneryCases();
  return cachedCases;
}

function scenes(): LayoutScene[] {
  cachedScenes ??= sceneryScenes(cases());
  return cachedScenes;
}

describe('#136 AC2: pohyby prostředí nepřekrývají nic důležitého na mapě', () => {
  for (const [ruleName, rule] of Object.entries(LAYOUT_RULES)) {
    it(`${ruleName}: kousky prostředí ve všech oknech, na 5 mapách a s kroky 0–3`, () => {
      expect(scenes().length).toBeGreaterThan(0);
      for (const scene of scenes()) {
        expect(
          scene.items.some((item) => item.name.startsWith('pohyb: ')),
          `${scene.label}: na mapě se něco hýbe`,
        ).toBe(true);
        expect(rule(scene), scene.label).toEqual([]);
      }
    });
  }

  it('žádný kousek ani pruh nezasahuje do cesty široké jako značka', () => {
    expect(cases().length).toBeGreaterThan(0);
    for (const testCase of cases()) {
      expect(pathViolations(testCase), testCase.label).toEqual([]);
    }
  });
});
