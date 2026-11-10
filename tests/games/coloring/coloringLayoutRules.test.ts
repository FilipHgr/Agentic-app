import { describe, expect, it } from 'vitest';

import { touchTargetAt } from '../../../src/games/coloring/logic/coloringLayout';
import { PALETTE } from '../../../src/games/coloring/logic/palette';
import { HOME_SCREEN_WINDOWS, LAYOUT_RULES } from '../../shared/layoutRules';
import { heightOf, widthOf } from '../../shared/viewportFixtures';
import { COLORING_WINDOWS, PLANNED_COLORS, coloringCases } from './coloringLayoutScenes';
import type { ColoringCase } from './coloringLayoutScenes';

/**
 * Testy k #88 AC1 (plocha celá vidět, kratší strana aspoň 240 px), AC4
 * (paleta vedle omalovánky, od #96 v panelu) a AC6 (barvy aspoň
 * 64 × 64 px s mezerami, domeček): společná pravidla rozložení
 * (`tests/shared/layoutRules.ts`) na obrazovce Omalovánek. Každé pravidlo
 * má jeden test, který v cyklu projde všechna okna (iPad na šířku, telefon
 * na šířku i na výšku, hranice, úzký iPad a spuštění z plochy), od #96
 * vždy se zavřeným panelem a od #105 v obou krocích panelu. Obrazovku skládá
 * `coloringLayoutScenes.ts`.
 *
 * Dřívější test „žádná barva neleží na ploše omalovánky“ nahrazuje od #96
 * test, že ťuknutí na barvu v otevřeném panelu vybere barvu a nemaluje
 * (panel leží přes obrázek, #96 AC4), od #105 v kroku barev.
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
  it('zkouší se iPad na šířku, telefon na šířku i na výšku a okna z plochy, zavřený panel i oba kroky', () => {
    const modes = new Set(cases().map((testCase) => testCase.area.mode));
    expect([...modes].sort()).toEqual(['phoneLandscape', 'phonePortrait', 'tablet']);
    for (const window of HOME_SCREEN_WINDOWS) {
      expect(COLORING_WINDOWS, window.name).toContain(window);
    }
    const panels = new Set(cases().map((testCase) => testCase.panel));
    expect([...panels].sort()).toEqual(['closed', 'colors', 'tools']);
    const labels = cases().map((testCase) => testCase.scene.label);
    expect(new Set(labels).size, 'každé okno a krok panelu je jiný případ').toBe(labels.length);
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

  it('obrázek se nezdeformuje: na šířku má plocha poměr stran 4 : 3, otočená na výšku 3 : 4', () => {
    // Od #111 AC1 je obrázek na výšku otočený o 90°: na obrazovce je
    // výška 4/3 šířky. Na šířku otočený není (dřív 4 : 3 ve všech oknech).
    for (const testCase of cases()) {
      const turned = !testCase.landscape;
      const long = turned ? heightOf(testCase.picture) : widthOf(testCase.picture);
      const short = turned ? widthOf(testCase.picture) : heightOf(testCase.picture);
      expect(long / short, `${testCase.scene.label}: poměr stran plochy`).toBeCloseTo(
        PICTURE_ASPECT,
        2,
      );
    }
  });
});

describe('#88 AC4, #96 AC3: v panelu je každá barva palety', () => {
  it('ve všech oknech má panel místo pro 12 barev a každá barva palety má své tlačítko', () => {
    for (const testCase of cases()) {
      expect(testCase.colors.length, testCase.scene.label).toBe(PLANNED_COLORS);
      expect(testCase.colors.length, testCase.scene.label).toBeGreaterThanOrEqual(PALETTE.length);
    }
  });

  it('ťuknutí na barvu v kroku barev vybere tu barvu a nic nenamaluje', () => {
    for (const testCase of cases()) {
      const { layout } = testCase;
      PALETTE.forEach((_, index) => {
        const slot = layout.paletteColors[index];
        if (slot === undefined) {
          throw new Error(`${testCase.scene.label}: chybí místo barvy ${index + 1}`);
        }
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
