import { describe, expect, it } from 'vitest';

import { PANEL_TOOL_PLACES, touchTargetAt } from '../../../src/games/coloring/logic/coloringLayout';
import type { LayoutRect } from '../../../src/games/coloring/logic/coloringLayout';
import { PANEL_TOOLS } from '../../../src/games/coloring/logic/toolPanel';
import type { ToolId } from '../../../src/games/coloring/logic/toolPanel';
import { MIN_TAP_SIDE } from '../../shared/layoutRules';
import { heightOf, isInside, overlaps, widthOf } from '../../shared/viewportFixtures';
import { coloringCases } from './coloringLayoutScenes';
import type { ColoringCase } from './coloringLayoutScenes';

/**
 * Testy k #93 AC1 v upraveném znění (komentář k issue): fix a pastelka
 * jsou v panelu na místech vyhrazených v #96. Společná pravidla rozložení
 * z #96 (64 px, 8 px, nic se nepřekrývá, vejde se) běží beze změny
 * v `toolPanelLayoutRules.test.ts`; tady jsou jen pravidla o místech fixu
 * a pastelky. Každé pravidlo projde v cyklu všechna okna
 * z `coloringLayoutScenes.ts` (zavřený panel a oba kroky panelu z #105).
 *
 * Navržené rozhraní: `PANEL_TOOLS` v `src/games/coloring/logic/toolPanel.ts`
 * obsahuje `'marker'` a `'crayon'`, nástroj `PANEL_TOOLS[i]` leží na místě
 * `layout.toolSlots[i]`, jedno z 10 míst panelu (`PANEL_TOOL_PLACES`).
 */

const NEW_TOOLS = ['marker', 'crayon'] as const satisfies readonly ToolId[];

const NAMES: Record<ToolId, string> = {
  brush: 'štětec',
  eraser: 'guma',
  marker: 'fix',
  crayon: 'pastelka',
  rainbow: 'duhový štětec',
  stamp: 'razítkový fix',
  dots: 'puntíkový fix',
  stripes: 'proužkový fix',
  glitter: 'třpytky',
  spray: 'sprej',
};

let cached: ColoringCase[] | undefined;

function cases(): ColoringCase[] {
  cached ??= coloringCases();
  return cached;
}

function center(rect: LayoutRect): { x: number; y: number } {
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

/** Místa fixu a pastelky v rozložení s názvem pro hlášení. */
function newToolPlaces(testCase: ColoringCase): Array<{ name: string; index: number }> {
  return NEW_TOOLS.map((tool) => ({
    name: `${testCase.scene.label}: ${NAMES[tool]}`,
    index: PANEL_TOOLS.indexOf(tool),
  }));
}

describe('#93 AC1: fix a pastelka jsou na vyhrazených místech v panelu', () => {
  it('fix i pastelka mají jedno z vyhrazených míst pro nástroje ve všech oknech', () => {
    for (const tool of NEW_TOOLS) {
      const index = PANEL_TOOLS.indexOf(tool);
      expect(index, `${NAMES[tool]} je v panelu`).toBeGreaterThanOrEqual(0);
      expect(index, `${NAMES[tool]} na vyhrazeném místě`).toBeLessThan(PANEL_TOOL_PLACES);
    }
    for (const testCase of cases()) {
      expect(
        testCase.layout.toolSlots.length,
        `${testCase.scene.label}: míst pro nástroje`,
      ).toBeGreaterThanOrEqual(PANEL_TOOLS.length);
    }
  });

  it('ťuknutí na fix nebo pastelku v kroku nástrojů jde na jejich nástroj ve všech oknech', () => {
    for (const testCase of cases().filter((each) => each.panel === 'tools')) {
      for (const { name, index } of newToolPlaces(testCase)) {
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

  it('fix a pastelka mají v kroku nástrojů aspoň 64 × 64 px a leží celé v panelu', () => {
    for (const testCase of cases().filter((each) => each.panel === 'tools')) {
      for (const { name, index } of newToolPlaces(testCase)) {
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

  it('fix a pastelka nepřekrývají jiné nástroje, tlačítka tloušťky ani ovládání v pruhu', () => {
    for (const testCase of cases().filter((each) => each.panel === 'tools')) {
      const strip = [
        testCase.home,
        testCase.handle,
        testCase.undo,
        ...testCase.sizeButtons,
        ...testCase.recentColors,
      ];
      for (const { name, index } of newToolPlaces(testCase)) {
        const box = testCase.tools[index];
        if (box === undefined) {
          continue;
        }
        for (const control of strip) {
          expect(overlaps(box, control), `${name}: překryv s pruhem`).toBe(false);
        }
        testCase.tools.forEach((other, otherIndex) => {
          if (otherIndex !== index) {
            expect(overlaps(box, other), `${name}: překryv s nástrojem ${otherIndex + 1}`).toBe(
              false,
            );
          }
        });
      }
    }
  });

  it('se zavřeným panelem ani v kroku barev ťuknutí na místo fixu nebo pastelky nevybere nástroj', () => {
    for (const testCase of cases().filter((each) => each.panel !== 'tools')) {
      for (const { name, index } of newToolPlaces(testCase)) {
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
