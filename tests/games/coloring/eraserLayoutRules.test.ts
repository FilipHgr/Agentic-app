import { describe, expect, it } from 'vitest';

import { touchTargetAt } from '../../../src/games/coloring/logic/coloringLayout';
import type { LayoutRect } from '../../../src/games/coloring/logic/coloringLayout';
import { PANEL_TOOLS } from '../../../src/games/coloring/logic/toolPanel';
import { MIN_TAP_SIDE } from '../../shared/layoutRules';
import { heightOf, isInside, overlaps, widthOf } from '../../shared/viewportFixtures';
import { coloringCases } from './coloringLayoutScenes';
import type { ColoringCase } from './coloringLayoutScenes';

/**
 * Testy k #90 AC5 v upraveném znění (komentář k issue): štětec a guma jsou
 * na vyhrazených místech v panelu z #96 a pravidla rozložení z #96 dál
 * platí ve všech oknech se zavřeným panelem i v obou krocích (#105). Ta pravidla
 * (64 px, 8 px, nic se nepřekrývá, vejde se, obrázek a pruh) běží beze
 * změny v `toolPanelLayoutRules.test.ts`, `coloringLayoutRules.test.ts`
 * a `undoLayoutRules.test.ts`; tady jsou jen pravidla o místech nástrojů.
 * Každé pravidlo projde v cyklu všechna okna z `coloringLayoutScenes.ts`.
 *
 * Navržené rozhraní: `PANEL_TOOLS: readonly ToolId[]` v
 * `src/games/coloring/logic/toolPanel.ts`, nástroj `PANEL_TOOLS[i]` leží
 * na místě `layout.toolSlots[i]` (`['brush', 'eraser']`).
 */

let cached: ColoringCase[] | undefined;

function cases(): ColoringCase[] {
  cached ??= coloringCases();
  return cached;
}

function center(rect: LayoutRect): { x: number; y: number } {
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

/** Místa nástrojů (štětec, guma) v rozložení s názvem pro hlášení. */
function toolPlaces(testCase: ColoringCase): Array<{ name: string; index: number }> {
  return PANEL_TOOLS.map((tool, index) => ({
    name: `${testCase.scene.label}: ${tool}`,
    index,
  }));
}

describe('#90 AC5: štětec a guma jsou na vyhrazených místech v panelu', () => {
  it('štětec i guma mají v panelu svoje místo ve všech oknech', () => {
    expect(PANEL_TOOLS).toContain('brush');
    expect(PANEL_TOOLS).toContain('eraser');
    for (const testCase of cases()) {
      expect(
        testCase.layout.toolSlots.length,
        `${testCase.scene.label}: míst pro nástroje`,
      ).toBeGreaterThanOrEqual(PANEL_TOOLS.length);
    }
  });

  it('ťuknutí na štětec nebo gumu v kroku nástrojů jde na jejich nástroj ve všech oknech', () => {
    for (const testCase of cases().filter((each) => each.panel === 'tools')) {
      for (const { name, index } of toolPlaces(testCase)) {
        const slot = testCase.layout.toolSlots[index];
        expect(slot, name).toBeDefined();
        if (slot === undefined) {
          continue;
        }
        const { x, y } = center(slot);
        expect(touchTargetAt(testCase.layout, 'tools', x, y), name).toEqual({
          kind: 'tool',
          index,
        });
      }
    }
  });

  it('štětec a guma mají v kroku nástrojů aspoň 64 × 64 px a leží celé v panelu', () => {
    for (const testCase of cases().filter((each) => each.panel === 'tools')) {
      for (const { name, index } of toolPlaces(testCase)) {
        const box = testCase.tools[index];
        expect(box, name).toBeDefined();
        if (box === undefined) {
          continue;
        }
        expect(widthOf(box), `${name}: šířka`).toBeGreaterThanOrEqual(MIN_TAP_SIDE);
        expect(heightOf(box), `${name}: výška`).toBeGreaterThanOrEqual(MIN_TAP_SIDE);
        expect(isInside(box, testCase.panelBox), `${name}: v panelu`).toBe(true);
        expect(isInside(box, testCase.visible), `${name}: na obrazovce`).toBe(true);
      }
    }
  });

  it('štětec a guma nepřekrývají domeček, úchyt, Zpět ani nedávné barvy', () => {
    for (const testCase of cases().filter((each) => each.panel === 'tools')) {
      const strip = [testCase.home, testCase.handle, testCase.undo, ...testCase.recentColors];
      for (const { name, index } of toolPlaces(testCase)) {
        const box = testCase.tools[index];
        if (box === undefined) {
          continue;
        }
        for (const control of strip) {
          expect(overlaps(box, control), `${name}: překryv s pruhem`).toBe(false);
        }
      }
    }
  });

  it('se zavřeným panelem ani v kroku barev ťuknutí na místo štětce nebo gumy nevybere nástroj', () => {
    for (const testCase of cases().filter((each) => each.panel !== 'tools')) {
      for (const { name, index } of toolPlaces(testCase)) {
        const slot = testCase.layout.toolSlots[index];
        if (slot === undefined) {
          continue;
        }
        const { x, y } = center(slot);
        expect(touchTargetAt(testCase.layout, testCase.panel, x, y).kind, name).not.toBe('tool');
      }
    }
  });
});
