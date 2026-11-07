import { describe, expect, it } from 'vitest';

import { LAYOUT_RULES, MIN_TAP_SIDE } from '../../shared/layoutRules';
import { gapBetween, heightOf, widthOf } from '../../shared/viewportFixtures';
import { undoCases } from './undoLayoutScenes';
import type { UndoCase } from './undoLayoutScenes';

/**
 * Testy k #89 AC7: tlačítko Zpět má aspoň 64 × 64 px, zatím leží zástupně
 * u palety a kratší strana plochy omalovánky má dál aspoň 240 px. Každé
 * pravidlo má jeden test, který v cyklu projde všechna okna Omalovánek
 * (iPad na šířku, telefon na šířku i na výšku, hranice, úzký iPad
 * a spuštění z plochy). Obrazovku skládá `undoLayoutScenes.ts`.
 */

/** Kratší strana plochy omalovánky aspoň 240 CSS px (#88 AC1, pravidla rozložení). */
const MIN_PICTURE_SIDE = 240;

/**
 * „U palety“: Zpět je od nejbližší barvy nejvýš o dvě běžné mezery palety
 * (2 × 12 CSS px). Zástupné místo, konečné určí úkol s gumou.
 */
const MAX_GAP_TO_PALETTE = 24;

let cached: UndoCase[] | undefined;

/** Obrazovky se spočítají jednou, všechna pravidla je pak jen čtou. */
function cases(): UndoCase[] {
  cached ??= undoCases();
  return cached;
}

describe('#89 AC7: obrazovka se Zpět dodrží společná pravidla rozložení', () => {
  for (const [ruleName, rule] of Object.entries(LAYOUT_RULES)) {
    it(`${ruleName} ve všech oknech i s tlačítkem Zpět`, () => {
      for (const testCase of cases()) {
        expect(rule(testCase.scene), testCase.scene.label).toEqual([]);
      }
    });
  }
});

describe('#89 AC7: tlačítko Zpět jde pohodlně trefit prstem a leží u palety', () => {
  it('tlačítko Zpět má ve všech oknech aspoň 64 × 64 px', () => {
    for (const testCase of cases()) {
      expect(widthOf(testCase.undo), `${testCase.scene.label}: šířka Zpět`).toBeGreaterThanOrEqual(
        MIN_TAP_SIDE,
      );
      expect(heightOf(testCase.undo), `${testCase.scene.label}: výška Zpět`).toBeGreaterThanOrEqual(
        MIN_TAP_SIDE,
      );
    }
  });

  it('tlačítko Zpět leží ve všech oknech hned u palety', () => {
    for (const testCase of cases()) {
      const nearest = Math.min(...testCase.colors.map((color) => gapBetween(testCase.undo, color)));
      expect(nearest, `${testCase.scene.label}: mezera od nejbližší barvy`).toBeLessThanOrEqual(
        MAX_GAP_TO_PALETTE,
      );
    }
  });

  it('s tlačítkem Zpět má kratší strana plochy omalovánky ve všech oknech dál aspoň 240 px', () => {
    for (const testCase of cases()) {
      const shorter = Math.min(widthOf(testCase.picture), heightOf(testCase.picture));
      expect(shorter, `${testCase.scene.label}: kratší strana plochy`).toBeGreaterThanOrEqual(
        MIN_PICTURE_SIDE,
      );
    }
  });
});
