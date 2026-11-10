import { describe, expect, it } from 'vitest';

import { touchTargetAt } from '../../../src/games/coloring/logic/coloringLayout';
import { PALETTE } from '../../../src/games/coloring/logic/palette';
import { LAYOUT_RULES } from '../../shared/layoutRules';
import { heightOf, widthOf } from '../../shared/viewportFixtures';
import { coloringCases } from './coloringLayoutScenes';
import type { ColoringCase } from './coloringLayoutScenes';
import { COLOR_COUNT } from './extendedPaletteHelpers';

/**
 * Testy k #100 AC6 (první část): pravidla rozložení v cyklu z #96 platí
 * s 12 barvami ve všech oknech (iPad na šířku, telefon na šířku i na
 * výšku, hranice, úzký iPad a okna z plochy), vždy se zavřeným i otevřeným
 * panelem. Obrazovku skládá `coloringLayoutScenes.ts` s plným plánovaným
 * obsahem panelu. Rozdíl proti #96: všech 12 míst pro barvy je obsazených,
 * žádné už není prázdné, a ťuknutí na každé vybere svou barvu.
 *
 * Že je každá barva v panelu na první pohled odlišná od sousedních i od
 * bílého pozadí omalovánky, je ruční kontrola (AC6 druhá část).
 */

/** Nejmenší ťukací plocha podle CLAUDE.md. */
const MIN_TAP_SIZE = 64;

let cached: ColoringCase[] | undefined;

/** Obrazovky se spočítají jednou, všechna pravidla je pak jen čtou. */
function cases(): ColoringCase[] {
  cached ??= coloringCases();
  return cached;
}

function openCases(): ColoringCase[] {
  return cases().filter((testCase) => testCase.panel === 'colors');
}

describe('#100 AC6: pravidla rozložení platí s 12 barvami ve všech oknech', () => {
  it('paleta má 12 barev, tolik, kolik je v panelu míst pro barvy', () => {
    expect(PALETTE.length).toBe(COLOR_COUNT);
    for (const testCase of cases()) {
      expect(testCase.colors.length, testCase.scene.label).toBe(COLOR_COUNT);
    }
  });

  for (const [ruleName, rule] of Object.entries(LAYOUT_RULES)) {
    it(`${ruleName} ve všech oknech s 12 barvami v panelu`, () => {
      for (const testCase of cases()) {
        expect(rule(testCase.scene), testCase.scene.label).toEqual([]);
      }
    });
  }

  it('každé z 12 míst pro barvy má aspoň 64 × 64 px ve všech oknech', () => {
    for (const testCase of openCases()) {
      testCase.colors.forEach((box, index) => {
        const what = `${testCase.scene.label}: barva ${index + 1}`;
        expect(widthOf(box), `${what}, šířka`).toBeGreaterThanOrEqual(MIN_TAP_SIZE);
        expect(heightOf(box), `${what}, výška`).toBeGreaterThanOrEqual(MIN_TAP_SIZE);
      });
    }
  });

  it('ťuknutí na každé z 12 míst v kroku barev vybere barvu na tom místě a nic nenamaluje', () => {
    for (const testCase of openCases()) {
      const { layout } = testCase;
      expect(layout.paletteColors.length, testCase.scene.label).toBe(COLOR_COUNT);
      layout.paletteColors.forEach((slot, index) => {
        const target = touchTargetAt(
          layout,
          'colors',
          slot.left + slot.width / 2,
          slot.top + slot.height / 2,
        );
        expect(target, `${testCase.scene.label}: barva ${index + 1}`).toEqual({
          kind: 'color',
          index,
        });
      });
    }
  });
});
