import { describe, expect, it } from 'vitest';

import { PANEL_TOOL_PLACES, touchTargetAt } from '../../../src/games/coloring/logic/coloringLayout';
import type { LayoutRect } from '../../../src/games/coloring/logic/coloringLayout';
import { PANEL_TOOLS } from '../../../src/games/coloring/logic/toolPanel';
import { MIN_TAP_SIDE } from '../../shared/layoutRules';
import { heightOf, isInside, overlaps, widthOf } from '../../shared/viewportFixtures';
import { coloringCases } from './coloringLayoutScenes';
import type { ColoringCase } from './coloringLayoutScenes';

/**
 * Testy k #102 AC1: proužkový fix má v panelu vyhrazené místo. Společná
 * pravidla rozložení z #96 (64 px, 8 px, nic se nepřekrývá, vejde se)
 * běží beze změny v `toolPanelLayoutRules.test.ts`; tady jsou jen
 * pravidla o místě proužkového fixu. Každé pravidlo projde v cyklu všechna
 * okna z `coloringLayoutScenes.ts` (zavřený panel a oba kroky panelu z #105).
 *
 * Navržené rozhraní: `PANEL_TOOLS` v `src/games/coloring/logic/toolPanel.ts`
 * obsahuje `'stripes'`, nástroj `PANEL_TOOLS[i]` leží na místě
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

const STRIPES_SLOT = PANEL_TOOLS.indexOf('stripes');

describe('#102 AC1: proužkový fix je na vyhrazeném místě v panelu', () => {
  it('proužkový fix má jedno z vyhrazených míst pro nástroje a to místo je v každém okně', () => {
    expect(STRIPES_SLOT, 'proužkový fix je v panelu').toBeGreaterThanOrEqual(0);
    expect(STRIPES_SLOT, 'na vyhrazeném místě').toBeLessThan(PANEL_TOOL_PLACES);
    for (const testCase of cases()) {
      expect(
        testCase.layout.toolSlots[STRIPES_SLOT],
        `${testCase.scene.label}: místo proužkového fixu`,
      ).toBeDefined();
    }
  });

  it('ťuknutí na proužkový fix v kroku nástrojů jde na jeho nástroj ve všech oknech', () => {
    expect(STRIPES_SLOT, 'proužkový fix je v panelu').toBeGreaterThanOrEqual(0);
    for (const testCase of cases().filter((each) => each.panel === 'tools')) {
      const name = `${testCase.scene.label}: proužkový fix`;
      const slot = testCase.layout.toolSlots[STRIPES_SLOT];
      expect(slot, name).toBeDefined();
      if (slot === undefined) {
        continue;
      }
      const { x, y } = center(slot);
      expect(touchTargetAt(testCase.layout, 'tools', x, y), name).toEqual({
        kind: 'tool',
        index: STRIPES_SLOT,
      });
    }
  });

  it('proužkový fix má v kroku nástrojů aspoň 64 × 64 px a leží celý v panelu na obrazovce', () => {
    expect(STRIPES_SLOT, 'proužkový fix je v panelu').toBeGreaterThanOrEqual(0);
    for (const testCase of cases().filter((each) => each.panel === 'tools')) {
      const name = `${testCase.scene.label}: proužkový fix`;
      const box = testCase.tools[STRIPES_SLOT];
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

  it('proužkový fix nepřekrývá jiné nástroje, tlačítka tloušťky ani ovládání v pruhu', () => {
    expect(STRIPES_SLOT, 'proužkový fix je v panelu').toBeGreaterThanOrEqual(0);
    for (const testCase of cases().filter((each) => each.panel === 'tools')) {
      const name = `${testCase.scene.label}: proužkový fix`;
      const box = testCase.tools[STRIPES_SLOT];
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
        if (otherIndex !== STRIPES_SLOT) {
          expect(overlaps(box, other), `${name}: překryv s nástrojem ${otherIndex + 1}`).toBe(
            false,
          );
        }
      });
    }
  });

  it('se zavřeným panelem ani v kroku barev ťuknutí na místo proužkového fixu nevybere nástroj', () => {
    expect(STRIPES_SLOT, 'proužkový fix je v panelu').toBeGreaterThanOrEqual(0);
    for (const testCase of cases().filter((each) => each.panel !== 'tools')) {
      const slot = testCase.layout.toolSlots[STRIPES_SLOT];
      if (slot === undefined) {
        continue;
      }
      const { x, y } = center(slot);
      expect(
        touchTargetAt(testCase.layout, testCase.panel, x, y).kind,
        `${testCase.scene.label}: proužkový fix`,
      ).not.toBe('tool');
    }
  });
});
