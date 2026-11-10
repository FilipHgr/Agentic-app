import { describe, expect, it } from 'vitest';

import { PANEL_TOOL_PLACES, touchTargetAt } from '../../../src/games/coloring/logic/coloringLayout';
import type { LayoutRect } from '../../../src/games/coloring/logic/coloringLayout';
import { PANEL_TOOLS } from '../../../src/games/coloring/logic/toolPanel';
import { MIN_TAP_SIDE } from '../../shared/layoutRules';
import { heightOf, isInside, overlaps, widthOf } from '../../shared/viewportFixtures';
import { coloringCases } from './coloringLayoutScenes';
import type { ColoringCase } from './coloringLayoutScenes';

/**
 * Testy k #97 AC1: duhový štětec má v panelu vyhrazené místo. Společná
 * pravidla rozložení z #96 (64 px, 8 px, nic se nepřekrývá, vejde se)
 * běží beze změny v `toolPanelLayoutRules.test.ts`; tady jsou jen
 * pravidla o místě duhy. Každé pravidlo projde v cyklu všechna okna
 * z `coloringLayoutScenes.ts` (zavřený panel a oba kroky panelu z #105).
 *
 * Navržené rozhraní: `PANEL_TOOLS` v `src/games/coloring/logic/toolPanel.ts`
 * obsahuje `'rainbow'`, nástroj `PANEL_TOOLS[i]` leží na místě
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

const RAINBOW_SLOT = PANEL_TOOLS.indexOf('rainbow');

describe('#97 AC1: duhový štětec je na vyhrazeném místě v panelu', () => {
  it('duha má jedno z vyhrazených míst pro nástroje a to místo je v každém okně', () => {
    expect(RAINBOW_SLOT, 'duha je v panelu').toBeGreaterThanOrEqual(0);
    expect(RAINBOW_SLOT, 'duha na vyhrazeném místě').toBeLessThan(PANEL_TOOL_PLACES);
    for (const testCase of cases()) {
      expect(
        testCase.layout.toolSlots[RAINBOW_SLOT],
        `${testCase.scene.label}: místo duhy`,
      ).toBeDefined();
    }
  });

  it('ťuknutí na duhu v kroku nástrojů jde na její nástroj ve všech oknech', () => {
    for (const testCase of cases().filter((each) => each.panel === 'tools')) {
      const name = `${testCase.scene.label}: duha`;
      const slot = testCase.layout.toolSlots[RAINBOW_SLOT];
      expect(slot, name).toBeDefined();
      if (slot === undefined) {
        continue;
      }
      const { x, y } = center(slot);
      expect(touchTargetAt(testCase.layout, 'tools', x, y), name).toEqual({
        kind: 'tool',
        index: RAINBOW_SLOT,
      });
    }
  });

  it('duha má v kroku nástrojů aspoň 64 × 64 px a leží celá v panelu na obrazovce', () => {
    for (const testCase of cases().filter((each) => each.panel === 'tools')) {
      const name = `${testCase.scene.label}: duha`;
      const box = testCase.tools[RAINBOW_SLOT];
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

  it('duha nepřekrývá jiné nástroje, tlačítka tloušťky ani ovládání v pruhu', () => {
    for (const testCase of cases().filter((each) => each.panel === 'tools')) {
      const name = `${testCase.scene.label}: duha`;
      const box = testCase.tools[RAINBOW_SLOT];
      if (box === undefined) {
        continue;
      }
      const strip = [
        testCase.home,
        testCase.handle,
        testCase.undo,
        ...testCase.sizeButtons,
        ...testCase.recentColors,
      ];
      for (const control of strip) {
        expect(overlaps(box, control), `${name}: překryv s pruhem`).toBe(false);
      }
      testCase.tools.forEach((other, otherIndex) => {
        if (otherIndex !== RAINBOW_SLOT) {
          expect(overlaps(box, other), `${name}: překryv s nástrojem ${otherIndex + 1}`).toBe(
            false,
          );
        }
      });
    }
  });

  it('se zavřeným panelem ani v kroku barev ťuknutí na místo duhy nevybere nástroj', () => {
    for (const testCase of cases().filter((each) => each.panel !== 'tools')) {
      const slot = testCase.layout.toolSlots[RAINBOW_SLOT];
      if (slot === undefined) {
        continue;
      }
      const { x, y } = center(slot);
      expect(
        touchTargetAt(testCase.layout, testCase.panel, x, y).kind,
        `${testCase.scene.label}: duha`,
      ).not.toBe('tool');
    }
  });
});
