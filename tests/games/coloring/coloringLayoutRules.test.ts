import { describe, expect, it } from 'vitest';

import { PALETTE } from '../../../src/games/coloring/logic/palette';
import { HOME_SCREEN_WINDOWS, LAYOUT_RULES } from '../../shared/layoutRules';
import { heightOf, overlaps, widthOf } from '../../shared/viewportFixtures';
import { COLORING_WINDOWS, coloringCases } from './coloringLayoutScenes';
import type { ColoringCase } from './coloringLayoutScenes';

/**
 * Testy k #88 AC1 (plocha celá vidět, kratší strana aspoň 240 px), AC4
 * (paleta 8 barev vedle omalovánky) a AC6 (barvy aspoň 64 × 64 px
 * s mezerami, domeček): společná pravidla rozložení
 * (`tests/shared/layoutRules.ts`) na obrazovce Omalovánek. Každé pravidlo
 * má jeden test, který v cyklu projde všechna okna (iPad na šířku, telefon
 * na šířku i na výšku, hranice, úzký iPad a spuštění z plochy). Obrazovku
 * skládá `coloringLayoutScenes.ts`.
 */

/** Kratší strana plochy omalovánky aspoň 240 CSS px (AC1). */
const MIN_PICTURE_SIDE = 240;

/** Obrázek a vrstva barev mají poměr stran 1024 × 768 (poznámky pro vývojáře). */
const PICTURE_ASPECT = 1024 / 768;

let cached: ColoringCase[] | undefined;

/** Obrazovky se spočítají jednou, všechna pravidla je pak jen čtou. */
function cases(): ColoringCase[] {
  cached ??= coloringCases();
  return cached;
}

describe('#88 AC1, AC6: obrazovka Omalovánek dodrží společná pravidla rozložení', () => {
  it('zkouší se iPad na šířku, telefon na šířku i na výšku a okna z plochy', () => {
    const modes = new Set(cases().map((testCase) => testCase.area.mode));
    expect([...modes].sort()).toEqual(['phoneLandscape', 'phonePortrait', 'tablet']);
    for (const window of HOME_SCREEN_WINDOWS) {
      expect(COLORING_WINDOWS, window.name).toContain(window);
    }
    const labels = cases().map((testCase) => testCase.scene.label);
    expect(new Set(labels).size, 'každé okno je jiný případ').toBe(labels.length);
  });

  for (const [ruleName, rule] of Object.entries(LAYOUT_RULES)) {
    it(`${ruleName} ve všech oknech`, () => {
      for (const testCase of cases()) {
        expect(rule(testCase.scene), testCase.scene.label).toEqual([]);
      }
    });
  }
});

describe('#88 AC1: plocha omalovánky je celá vidět a dost velká', () => {
  it('kratší strana plochy omalovánky má ve všech oknech aspoň 240 px', () => {
    for (const testCase of cases()) {
      const shorter = Math.min(widthOf(testCase.picture), heightOf(testCase.picture));
      expect(shorter, `${testCase.scene.label}: kratší strana plochy`).toBeGreaterThanOrEqual(
        MIN_PICTURE_SIDE,
      );
    }
  });

  it('obrázek se nezdeformuje: plocha má ve všech oknech poměr stran obrázku 4 : 3', () => {
    for (const testCase of cases()) {
      const aspect = widthOf(testCase.picture) / heightOf(testCase.picture);
      expect(aspect, `${testCase.scene.label}: poměr stran plochy`).toBeCloseTo(PICTURE_ASPECT, 2);
    }
  });
});

describe('#88 AC4: na ploše vedle omalovánky je paleta 8 barev', () => {
  it('ve všech oknech je vidět 8 barev, jedna na každou barvu palety', () => {
    for (const testCase of cases()) {
      expect(testCase.colors.length, testCase.scene.label).toBe(PALETTE.length);
      expect(testCase.colors.length, testCase.scene.label).toBe(8);
    }
  });

  it('žádná barva neleží na ploše omalovánky, ťuknutí na barvu nic nenamaluje', () => {
    for (const testCase of cases()) {
      testCase.colors.forEach((color, index) => {
        expect(
          overlaps(color, testCase.picture),
          `${testCase.scene.label}: barva ${index + 1} na ploše omalovánky`,
        ).toBe(false);
      });
    }
  });
});
