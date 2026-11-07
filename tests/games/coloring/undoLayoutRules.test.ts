import { describe, expect, it } from 'vitest';

import { LAYOUT_RULES, MIN_TAP_SIDE } from '../../shared/layoutRules';
import { gapBetween, heightOf, overlaps, widthOf } from '../../shared/viewportFixtures';
import { undoCases } from './undoLayoutScenes';
import type { UndoCase } from './undoLayoutScenes';

/**
 * Testy k #89 AC7 s novým místem Zpět z #96 AC3: tlačítko Zpět má aspoň
 * 64 × 64 px, leží v pruhu ovládání (na šířku hned pod úchytem nebo vedle
 * něj, na výšku vpravo u palce), nikdy na obrázku ani pod otevřeným
 * panelem, a kratší strana plochy omalovánky má dál aspoň 240 px.
 * Nahrazuje dřívější test „Zpět leží hned u palety“ (nejvýš 24 px od
 * barvy) stejně přísnou vzdáleností od úchytu. Každé pravidlo má jeden
 * test, který v cyklu projde všechna okna se zavřeným i otevřeným panelem.
 */

/** Kratší strana plochy omalovánky aspoň 240 CSS px (#88 AC1, pravidla rozložení). */
const MIN_PICTURE_SIDE = 240;

/** „Hned u úchytu“: nejvýš dvě mezery po 12 CSS px, stejně jako dřív u palety. */
const MAX_GAP_TO_HANDLE = 24;

/** Na výšku je Zpět vpravo u palce: od pravého okraje nejvýš mezera pruhu a odstup. */
const MAX_DISTANCE_FROM_RIGHT_EDGE = 16;

/** Tolerance na zaokrouhlení v CSS px. */
const TOLERANCE = 0.01;

let cached: UndoCase[] | undefined;

/** Obrazovky se spočítají jednou, všechna pravidla je pak jen čtou. */
function cases(): UndoCase[] {
  cached ??= undoCases();
  return cached;
}

describe('#89 AC7, #96 AC3: obrazovka se Zpět dodrží společná pravidla rozložení', () => {
  for (const [ruleName, rule] of Object.entries(LAYOUT_RULES)) {
    it(`${ruleName} ve všech oknech i s tlačítkem Zpět, se zavřeným i otevřeným panelem`, () => {
      for (const testCase of cases()) {
        expect(rule(testCase.scene), testCase.scene.label).toEqual([]);
      }
    });
  }
});

describe('#89 AC7, #96 AC3: tlačítko Zpět jde pohodlně trefit prstem a leží v pruhu u úchytu', () => {
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

  it('na šířku leží Zpět hned pod úchytem nebo vedle něj, nikdy nad ním', () => {
    for (const testCase of cases().filter((each) => each.landscape)) {
      const { label } = testCase.scene;
      expect(
        gapBetween(testCase.undo, testCase.handle),
        `${label}: mezera od úchytu`,
      ).toBeLessThanOrEqual(MAX_GAP_TO_HANDLE);
      expect(testCase.undo.top, `${label}: Zpět je výš než úchyt`).toBeGreaterThanOrEqual(
        testCase.handle.top - TOLERANCE,
      );
    }
  });

  it('na šířku v jednom sloupci pruhu leží Zpět přímo pod úchytem', () => {
    for (const testCase of cases().filter((each) => each.landscape)) {
      const { label } = testCase.scene;
      const sameColumn =
        testCase.undo.left < testCase.handle.right && testCase.handle.left < testCase.undo.right;
      if (!sameColumn) {
        continue;
      }
      expect(testCase.undo.top, `${label}: Zpět pod úchytem`).toBeGreaterThanOrEqual(
        testCase.handle.bottom - TOLERANCE,
      );
    }
  });

  it('na výšku leží Zpět v pruhu dole vpravo od úchytu, u pravého okraje', () => {
    for (const testCase of cases().filter((each) => !each.landscape)) {
      const { label } = testCase.scene;
      expect(testCase.undo.left, `${label}: Zpět vpravo od úchytu`).toBeGreaterThanOrEqual(
        testCase.handle.right - TOLERANCE,
      );
      expect(
        testCase.visible.right - testCase.undo.right,
        `${label}: vzdálenost Zpět od pravého okraje`,
      ).toBeLessThanOrEqual(MAX_DISTANCE_FROM_RIGHT_EDGE);
      expect(testCase.undo.top, `${label}: Zpět pod obrázkem`).toBeGreaterThanOrEqual(
        testCase.picture.bottom - TOLERANCE,
      );
    }
  });

  it('tlačítko Zpět neleží na obrázku ani pod otevřeným panelem, jde trefit v obou stavech', () => {
    for (const testCase of cases()) {
      const { label } = testCase.scene;
      expect(overlaps(testCase.undo, testCase.picture), `${label}: Zpět na obrázku`).toBe(false);
      expect(overlaps(testCase.undo, testCase.panelBox), `${label}: Zpět pod panelem`).toBe(false);
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
