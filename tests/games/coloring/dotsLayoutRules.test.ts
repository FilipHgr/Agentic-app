import { describe, expect, it } from 'vitest';

import { PANEL_TOOL_PLACES, touchTargetAt } from '../../../src/games/coloring/logic/coloringLayout';
import type { LayoutRect } from '../../../src/games/coloring/logic/coloringLayout';
import { PANEL_TOOLS } from '../../../src/games/coloring/logic/toolPanel';
import { MIN_TAP_SIDE } from '../../shared/layoutRules';
import { heightOf, isInside, overlaps, widthOf } from '../../shared/viewportFixtures';
import { coloringCases } from './coloringLayoutScenes';
import type { ColoringCase } from './coloringLayoutScenes';

/**
 * Testy k #101 AC1: puntíkový fix má v panelu vyhrazené místo. Společná
 * pravidla rozložení z #96 (64 px, 8 px, nic se nepřekrývá, vejde se)
 * běží beze změny v `toolPanelLayoutRules.test.ts`; tady jsou jen
 * pravidla o místě puntíkového fixu. Každé pravidlo projde v cyklu všechna
 * okna z `coloringLayoutScenes.ts` (zavřený panel a oba kroky panelu z #105).
 *
 * Navržené rozhraní: `PANEL_TOOLS` v `src/games/coloring/logic/toolPanel.ts`
 * obsahuje `'dots'`, nástroj `PANEL_TOOLS[i]` leží na místě
 * `layout.toolSlots[i]`, jedno z 10 míst panelu (`PANEL_TOOL_PLACES`).
 */

let cached: ColoringCase[] | undefined;

function cases(): ColoringCase[] {
  cached ??= coloringCases();
  return cached;
}

function center(rect: LayoutRect): { x: number; y: number } {
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

const DOTS_SLOT = PANEL_TOOLS.indexOf('dots');

describe('#101 AC1: puntíkový fix je na vyhrazeném místě v panelu', () => {
  it('puntíkový fix má jedno z vyhrazených míst pro nástroje a to místo je v každém okně', () => {
    expect(DOTS_SLOT, 'puntíkový fix je v panelu').toBeGreaterThanOrEqual(0);
    expect(DOTS_SLOT, 'na vyhrazeném místě').toBeLessThan(PANEL_TOOL_PLACES);
    for (const testCase of cases()) {
      expect(
        testCase.layout.toolSlots[DOTS_SLOT],
        `${testCase.scene.label}: místo puntíkového fixu`,
      ).toBeDefined();
    }
  });

  it('ťuknutí na puntíkový fix v kroku nástrojů jde na jeho nástroj ve všech oknech', () => {
    expect(DOTS_SLOT, 'puntíkový fix je v panelu').toBeGreaterThanOrEqual(0);
    for (const testCase of cases().filter((each) => each.panel === 'tools')) {
      const name = `${testCase.scene.label}: puntíkový fix`;
      const slot = testCase.layout.toolSlots[DOTS_SLOT];
      expect(slot, name).toBeDefined();
      if (slot === undefined) {
        continue;
      }
      const { x, y } = center(slot);
      expect(touchTargetAt(testCase.layout, 'tools', x, y), name).toEqual({
        kind: 'tool',
        index: DOTS_SLOT,
      });
    }
  });

  it('puntíkový fix má v kroku nástrojů aspoň 64 × 64 px a leží celý v panelu na obrazovce', () => {
    expect(DOTS_SLOT, 'puntíkový fix je v panelu').toBeGreaterThanOrEqual(0);
    for (const testCase of cases().filter((each) => each.panel === 'tools')) {
      const name = `${testCase.scene.label}: puntíkový fix`;
      const box = testCase.tools[DOTS_SLOT];
      expect(box, name).toBeDefined();
      if (box === undefined) {
        continue;
      }
      expect(widthOf(box), `${name}: šířka`).toBeGreaterThanOrEqual(MIN_TAP_SIDE);
      expect(heightOf(box), `${name}: výška`).toBeGreaterThanOrEqual(MIN_TAP_SIDE);
      expect(isInside(box, testCase.panelBox), `${name}: v panelu`).toBe(true);
      expect(isInside(box, testCase.visible), `${name}: na obrazovce`).toBe(true);
    }
  });

  it('puntíkový fix nepřekrývá jiné nástroje, přepínač velikosti ani ovládání v pruhu', () => {
    expect(DOTS_SLOT, 'puntíkový fix je v panelu').toBeGreaterThanOrEqual(0);
    for (const testCase of cases().filter((each) => each.panel === 'tools')) {
      const name = `${testCase.scene.label}: puntíkový fix`;
      const box = testCase.tools[DOTS_SLOT];
      if (box === undefined) {
        continue;
      }
      const strip = [
        testCase.home,
        testCase.handle,
        testCase.undo,
        testCase.sizeToggle,
        ...testCase.recentColors,
      ];
      for (const control of strip) {
        expect(overlaps(box, control), `${name}: překryv s pruhem`).toBe(false);
      }
      testCase.tools.forEach((other, otherIndex) => {
        if (otherIndex !== DOTS_SLOT) {
          expect(overlaps(box, other), `${name}: překryv s nástrojem ${otherIndex + 1}`).toBe(
            false,
          );
        }
      });
    }
  });

  it('se zavřeným panelem ani v kroku barev ťuknutí na místo puntíkového fixu nevybere nástroj', () => {
    expect(DOTS_SLOT, 'puntíkový fix je v panelu').toBeGreaterThanOrEqual(0);
    for (const testCase of cases().filter((each) => each.panel !== 'tools')) {
      const slot = testCase.layout.toolSlots[DOTS_SLOT];
      if (slot === undefined) {
        continue;
      }
      const { x, y } = center(slot);
      expect(
        touchTargetAt(testCase.layout, testCase.panel, x, y).kind,
        `${testCase.scene.label}: puntíkový fix`,
      ).not.toBe('tool');
    }
  });
});
