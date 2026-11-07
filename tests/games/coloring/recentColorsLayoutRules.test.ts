import { describe, expect, it } from 'vitest';

import { touchTargetAt } from '../../../src/games/coloring/logic/coloringLayout';
import type { LayoutRect } from '../../../src/games/coloring/logic/coloringLayout';
import { LAYOUT_RULES, MIN_TAP_GAP, MIN_TAP_SIDE } from '../../shared/layoutRules';
import { gapBetween, heightOf, isInside, overlaps, widthOf } from '../../shared/viewportFixtures';
import type { Box } from '../../shared/viewportFixtures';
import { RECENT_COLOR_PLACES, coloringCases, recentColorName } from './coloringLayoutScenes';
import type { ColoringCase } from './coloringLayoutScenes';

/**
 * Testy rozložení k #99 AC1 (dvě nedávné barvy v pruhu vedle úchytu, aspoň
 * 64 × 64 px) a AC6 (pravidla rozložení v cyklu z #96 platí s nedávnými
 * barvami ve všech oknech a otevřený panel je nepřekryje). Každé pravidlo
 * je jeden test, který v cyklu projde všechna okna Omalovánek se zavřeným
 * i otevřeným panelem; obrazovku skládá `coloringLayoutScenes.ts`, místa
 * nedávných barev jsou v ní jako ťukací plochy (`nedávná barva 1`, `2`).
 *
 * Kam patří dotyk, rozhoduje `touchTargetAt` (#96): na místě nedávné
 * barvy je `{ kind: 'recentColor', index }` v obou stavech panelu, nikdy
 * obrázek ani panel. Rozhraní rozložení se nemění.
 */

/** Tolerance na zaokrouhlení v CSS px. */
const TOLERANCE = 0.01;

let cached: ColoringCase[] | undefined;

function cases(): ColoringCase[] {
  cached ??= coloringCases();
  return cached;
}

/** Body v herních jednotkách rovnoměrně po obdélníku `rect` (kousek od okraje). */
function gridIn(rect: LayoutRect, steps: number): Array<{ x: number; y: number }> {
  const inset = Math.min(rect.width, rect.height) / 1000;
  const points: Array<{ x: number; y: number }> = [];
  for (let row = 0; row <= steps; row += 1) {
    for (let column = 0; column <= steps; column += 1) {
      points.push({
        x: rect.left + inset + ((rect.width - 2 * inset) * column) / steps,
        y: rect.top + inset + ((rect.height - 2 * inset) * row) / steps,
      });
    }
  }
  return points;
}

/** Ostatní ťukací plochy pruhu, od kterých musí být nedávné barvy 8 px. */
function otherStripControls(testCase: ColoringCase): Array<[string, Box]> {
  return [
    ['domeček', testCase.home],
    ['úchyt', testCase.handle],
    ['Zpět', testCase.undo],
  ];
}

describe('#99 AC1: v pruhu jsou dvě místa pro nedávné barvy, aspoň 64 × 64 px', () => {
  it('ve všech oknech jsou v pruhu právě dvě místa pro nedávné barvy', () => {
    for (const testCase of cases()) {
      expect(testCase.recentColors.length, testCase.scene.label).toBe(RECENT_COLOR_PLACES);
      const names = testCase.scene.items.map((item) => item.name);
      for (let index = 0; index < RECENT_COLOR_PLACES; index += 1) {
        expect(names, `${testCase.scene.label}: obrazovka pro pravidla`).toContain(
          recentColorName(index),
        );
      }
    }
  });

  it('každé místo nedávné barvy má ve všech oknech aspoň 64 × 64 px', () => {
    for (const testCase of cases()) {
      testCase.recentColors.forEach((recent, index) => {
        const what = `${testCase.scene.label}: nedávná barva ${index + 1}`;
        expect(widthOf(recent), `${what}: šířka`).toBeGreaterThanOrEqual(MIN_TAP_SIDE - TOLERANCE);
        expect(heightOf(recent), `${what}: výška`).toBeGreaterThanOrEqual(MIN_TAP_SIDE - TOLERANCE);
      });
    }
  });

  it('místa nedávných barev jsou celá vidět a neleží na obrázku', () => {
    for (const testCase of cases()) {
      testCase.recentColors.forEach((recent, index) => {
        const what = `${testCase.scene.label}: nedávná barva ${index + 1}`;
        expect(isInside(recent, testCase.visible), `${what}: vidět`).toBe(true);
        expect(overlaps(recent, testCase.picture), `${what}: na obrázku`).toBe(false);
      });
    }
  });

  it('mezi nedávnými barvami a od domečku, úchytu a Zpět je aspoň 8 px', () => {
    for (const testCase of cases()) {
      const { label } = testCase.scene;
      const [first, second] = testCase.recentColors;
      if (first !== undefined && second !== undefined) {
        expect(
          gapBetween(first, second),
          `${label}: mezi nedávnými barvami`,
        ).toBeGreaterThanOrEqual(MIN_TAP_GAP - TOLERANCE);
      }
      testCase.recentColors.forEach((recent, index) => {
        for (const [name, control] of otherStripControls(testCase)) {
          expect(
            gapBetween(recent, control),
            `${label}: nedávná barva ${index + 1} – ${name}`,
          ).toBeGreaterThanOrEqual(MIN_TAP_GAP - TOLERANCE);
        }
      });
    }
  });

  it('ťuknutí kamkoli na místo nedávné barvy jde na tu nedávnou barvu se zavřeným i otevřeným panelem', () => {
    for (const testCase of cases()) {
      const panelOpen = testCase.panel === 'open';
      testCase.layout.recentColors.forEach((recent, index) => {
        for (const point of gridIn(recent, 8)) {
          expect(
            touchTargetAt(testCase.layout, panelOpen, point.x, point.y),
            `${testCase.scene.label}: nedávná barva ${index + 1} v ${Math.round(point.x)}, ${Math.round(point.y)}`,
          ).toEqual({ kind: 'recentColor', index });
        }
      });
    }
  });
});

describe('#99 AC6: pravidla rozložení z #96 platí s nedávnými barvami', () => {
  for (const [ruleName, rule] of Object.entries(LAYOUT_RULES)) {
    it(`${ruleName} s nedávnými barvami ve všech oknech a obou stavech panelu`, () => {
      for (const testCase of cases()) {
        const recentItems = testCase.scene.items.filter((item) =>
          item.name.startsWith('nedávná barva'),
        );
        expect(recentItems.length, `${testCase.scene.label}: nedávné barvy v obrazovce`).toBe(
          RECENT_COLOR_PLACES,
        );
        expect(rule(testCase.scene), testCase.scene.label).toEqual([]);
      }
    });
  }

  it('otevřený panel nepřekryje žádné místo nedávné barvy', () => {
    for (const testCase of cases().filter((each) => each.panel === 'open')) {
      testCase.recentColors.forEach((recent, index) => {
        expect(
          overlaps(testCase.panelBox, recent),
          `${testCase.scene.label}: panel překrývá nedávnou barvu ${index + 1}`,
        ).toBe(false);
      });
    }
  });

  it('žádné tlačítko otevřeného panelu nepřekryje místo nedávné barvy', () => {
    for (const testCase of cases().filter((each) => each.panel === 'open')) {
      const slots = [...testCase.colors, ...testCase.tools, testCase.sizeToggle];
      testCase.recentColors.forEach((recent, index) => {
        slots.forEach((slot, slotIndex) => {
          expect(
            overlaps(slot, recent),
            `${testCase.scene.label}: plocha panelu ${slotIndex + 1} na nedávné barvě ${index + 1}`,
          ).toBe(false);
        });
      });
    }
  });
});
