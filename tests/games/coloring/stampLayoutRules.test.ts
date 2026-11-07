import { describe, expect, it } from 'vitest';

import { PANEL_TOOL_PLACES, touchTargetAt } from '../../../src/games/coloring/logic/coloringLayout';
import type { LayoutRect } from '../../../src/games/coloring/logic/coloringLayout';
import { PANEL_TOOLS } from '../../../src/games/coloring/logic/toolPanel';
import { MIN_TAP_SIDE } from '../../shared/layoutRules';
import { heightOf, isInside, overlaps, widthOf } from '../../shared/viewportFixtures';
import { coloringCases } from './coloringLayoutScenes';
import type { ColoringCase } from './coloringLayoutScenes';

/**
 * Testy k #98 AC1: razítkový fix má v panelu vyhrazené místo. Společná
 * pravidla rozložení z #96 (64 px, 8 px, nic se nepřekrývá, vejde se)
 * běží beze změny v `toolPanelLayoutRules.test.ts`; tady jsou jen
 * pravidla o místě razítkového fixu. Každé pravidlo projde v cyklu všechna
 * okna z `coloringLayoutScenes.ts` (zavřený i otevřený panel).
 *
 * Navržené rozhraní: `PANEL_TOOLS` v `src/games/coloring/logic/toolPanel.ts`
 * obsahuje `'stamp'`, nástroj `PANEL_TOOLS[i]` leží na místě
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

const STAMP_SLOT = PANEL_TOOLS.indexOf('stamp');

describe('#98 AC1: razítkový fix je na vyhrazeném místě v panelu', () => {
  it('razítkový fix má jedno z vyhrazených míst pro nástroje a to místo je v každém okně', () => {
    expect(STAMP_SLOT, 'razítkový fix je v panelu').toBeGreaterThanOrEqual(0);
    expect(STAMP_SLOT, 'na vyhrazeném místě').toBeLessThan(PANEL_TOOL_PLACES);
    for (const testCase of cases()) {
      expect(
        testCase.layout.toolSlots[STAMP_SLOT],
        `${testCase.scene.label}: místo razítkového fixu`,
      ).toBeDefined();
    }
  });

  it('ťuknutí na razítkový fix v otevřeném panelu jde na jeho nástroj ve všech oknech', () => {
    expect(STAMP_SLOT, 'razítkový fix je v panelu').toBeGreaterThanOrEqual(0);
    for (const testCase of cases().filter((each) => each.panel === 'open')) {
      const name = `${testCase.scene.label}: razítkový fix`;
      const slot = testCase.layout.toolSlots[STAMP_SLOT];
      expect(slot, name).toBeDefined();
      if (slot === undefined) {
        continue;
      }
      const { x, y } = center(slot);
      expect(touchTargetAt(testCase.layout, true, x, y), name).toEqual({
        kind: 'tool',
        index: STAMP_SLOT,
      });
    }
  });

  it('razítkový fix má v otevřeném panelu aspoň 64 × 64 px a leží celý v panelu na obrazovce', () => {
    expect(STAMP_SLOT, 'razítkový fix je v panelu').toBeGreaterThanOrEqual(0);
    for (const testCase of cases().filter((each) => each.panel === 'open')) {
      const name = `${testCase.scene.label}: razítkový fix`;
      const box = testCase.tools[STAMP_SLOT];
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

  it('razítkový fix nepřekrývá jiné nástroje, barvy, přepínač velikosti ani ovládání v pruhu', () => {
    expect(STAMP_SLOT, 'razítkový fix je v panelu').toBeGreaterThanOrEqual(0);
    for (const testCase of cases().filter((each) => each.panel === 'open')) {
      const name = `${testCase.scene.label}: razítkový fix`;
      const box = testCase.tools[STAMP_SLOT];
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
        if (otherIndex !== STAMP_SLOT) {
          expect(overlaps(box, other), `${name}: překryv s nástrojem ${otherIndex + 1}`).toBe(
            false,
          );
        }
      });
      testCase.colors.forEach((color, colorIndex) => {
        expect(overlaps(box, color), `${name}: překryv s barvou ${colorIndex + 1}`).toBe(false);
      });
    }
  });

  it('se zavřeným panelem ťuknutí na místo razítkového fixu nevybere nástroj', () => {
    expect(STAMP_SLOT, 'razítkový fix je v panelu').toBeGreaterThanOrEqual(0);
    for (const testCase of cases().filter((each) => each.panel === 'closed')) {
      const slot = testCase.layout.toolSlots[STAMP_SLOT];
      if (slot === undefined) {
        continue;
      }
      const { x, y } = center(slot);
      expect(
        touchTargetAt(testCase.layout, false, x, y).kind,
        `${testCase.scene.label}: razítkový fix`,
      ).not.toBe('tool');
    }
  });
});
