import { describe, expect, it } from 'vitest';

import { touchTargetAt } from '../../../src/games/coloring/logic/coloringLayout';
import type { LayoutRect } from '../../../src/games/coloring/logic/coloringLayout';
import {
  LAYOUT_RULES,
  MIN_EDGE_DISTANCE,
  MIN_TAP_GAP,
  MIN_TAP_SIDE,
} from '../../shared/layoutRules';
import type { LayoutItem } from '../../shared/layoutRules';
import {
  gapBetween,
  heightOf,
  isInside,
  overlaps,
  toCss,
  widthOf,
} from '../../shared/viewportFixtures';
import type { Box } from '../../shared/viewportFixtures';
import {
  COLORING_WINDOWS,
  HANDLE_NAME,
  PANEL_NAME,
  PICTURE_NAME,
  QUICK_TOOL_PLACES,
  UNDO_NAME,
  boxOfRect,
  coloringCases,
  isOpen,
  quickToolName,
  quickToolRects,
  quickToolTarget,
} from './coloringLayoutScenes';
import type { ColoringCase } from './coloringLayoutScenes';
import { LAYOUT_BEFORE_148 } from './layoutBefore148Fixture';
import type { FixedRect } from './layoutBefore148Fixture';

/**
 * Testy rozložení k #148 AC1 (kde jsou tlačítka kreslicího nástroje
 * a gumy), AC6 (tah začatý na tlačítku nemaluje) a AC7 (pravidla v cyklu
 * pro všech 22 oken testů Omalovánek, na šířku i na výšku, se zavřeným
 * panelem i v obou krocích panelu, jeden test na pravidlo). Obrazovka je
 * obrazovka Omalovánek z `coloringLayoutScenes.ts` a navíc fotoaparát
 * (#126) a koště (#142). Nahrazují testy rozložení nedávných barev z #99
 * (`recentColorsLayoutRules.test.ts`).
 *
 * Rozhraní `coloringLayout.ts` (herní jednotky) místo
 * `recentColors: readonly LayoutRect[]`:
 * - `ColoringLayout.quickDrawingToolButton: LayoutRect` první tlačítko
 *   (kreslicí nástroj, #163),
 * - `ColoringLayout.quickEraserButton: LayoutRect` druhé tlačítko (guma),
 * - `touchTargetAt` vrátí `{ kind: 'quickDrawingTool' }` a `{ kind: 'quickEraser' }`
 *   ve všech krocích panelu; `{ kind: 'recentColor' }` už nevrací.
 *
 * Kolečko barvy nepřekrývá okraj ikony (#114) je podle zadání ruční kontrola.
 */

/** Tolerance na zaokrouhlení v CSS px. */
const TOLERANCE = 0.01;

/** Tolerance pevných měr z doby před #148 (zaokrouhlené na tisíciny px). */
const FIXED_TOLERANCE = 0.002;

const CAMERA_NAME = 'fotoaparát';
const BROOM_NAME = 'koště';

interface QuickCase extends ColoringCase {
  readonly camera: Box;
  readonly broom: Box;
}

function withCameraAndBroom(testCase: ColoringCase): QuickCase {
  const camera = toCss(boxOfRect(testCase.layout.cameraButton), testCase.area);
  const broom = toCss(boxOfRect(testCase.layout.broomButton), testCase.area);
  const items: LayoutItem[] = [
    { name: CAMERA_NAME, box: camera, tappable: true },
    { name: BROOM_NAME, box: broom, tappable: true },
  ];
  return {
    ...testCase,
    camera,
    broom,
    scene: { ...testCase.scene, items: [...testCase.scene.items, ...items] },
  };
}

let cached: QuickCase[] | undefined;

function cases(): QuickCase[] {
  cached ??= coloringCases().map(withCameraAndBroom);
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

function fixedBox([left, top, width, height]: FixedRect): Box {
  return { left, top, right: left + width, bottom: top + height };
}

function expectCloseBox(actual: Box, expected: Box, what: string): void {
  for (const side of ['left', 'top', 'right', 'bottom'] as const) {
    expect(Math.abs(actual[side] - expected[side]), `${what}: ${side}`).toBeLessThanOrEqual(
      FIXED_TOLERANCE,
    );
  }
}

/** Ovládání a plochy, od kterých musí být obě tlačítka aspoň 8 px (AC7). */
function othersOf(testCase: QuickCase): Array<[string, Box]> {
  return [
    [HANDLE_NAME, testCase.handle],
    [UNDO_NAME, testCase.undo],
    [CAMERA_NAME, testCase.camera],
    [BROOM_NAME, testCase.broom],
    [PICTURE_NAME, testCase.picture],
    [PANEL_NAME, testCase.panelBox],
  ];
}

describe('#148 AC1: dvě tlačítka místo nedávných barev', () => {
  it('ve všech oknech jsou v pruhu právě dvě tlačítka: kreslicí nástroj a guma', () => {
    for (const testCase of cases()) {
      expect(testCase.quickTools.length, testCase.scene.label).toBe(QUICK_TOOL_PLACES);
      const names = testCase.scene.items.map((item) => item.name);
      for (let index = 0; index < QUICK_TOOL_PLACES; index += 1) {
        expect(names, `${testCase.scene.label}: obrazovka pro pravidla`).toContain(
          quickToolName(index),
        );
      }
    }
  });

  // Nahrazuje test přes přetypování (review #148): kdekoli v okně se dotyk
  // trefí jen do známých ploch a z pruhu rychlého přepínání jen do dvou tlačítek.
  it('místa nedávných barev nejsou: dotyk kdekoli trefí jen dvě tlačítka rychlého přepínání', () => {
    const known = [
      'handle',
      'undo',
      'camera',
      'broom',
      'quickDrawingTool',
      'quickEraser',
      'picture',
      'panel',
      'none',
      'tool',
      'color',
      'lineSize',
      'backToTools',
    ];
    for (const testCase of cases()) {
      const whole: LayoutRect = {
        left: 0,
        top: 0,
        width: testCase.area.width,
        height: testCase.area.height,
      };
      const quickHits = new Set<string>();
      for (const point of gridIn(whole, 60)) {
        const target = touchTargetAt(testCase.layout, testCase.panel, point.x, point.y);
        expect(known, `${testCase.scene.label}: ${target.kind}`).toContain(target.kind);
        if (target.kind === 'quickDrawingTool' || target.kind === 'quickEraser') {
          quickHits.add(target.kind);
          const inside = quickToolRects(testCase.layout).some(
            (rect) =>
              point.x >= rect.left &&
              point.x < rect.left + rect.width &&
              point.y >= rect.top &&
              point.y < rect.top + rect.height,
          );
          expect(inside, `${testCase.scene.label}: ${target.kind} mimo tlačítka`).toBe(true);
        }
      }
      expect([...quickHits].sort(), testCase.scene.label).toEqual([
        'quickDrawingTool',
        'quickEraser',
      ]);
    }
  });

  it('na šířku jsou obě tlačítka v levém pruhu pod úchytem a Zpět', () => {
    for (const testCase of cases().filter((each) => each.landscape)) {
      expect(testCase.quickTools.length, testCase.scene.label).toBe(QUICK_TOOL_PLACES);
      testCase.quickTools.forEach((button, index) => {
        const what = `${testCase.scene.label}: ${quickToolName(index)}`;
        for (const [name, above] of [
          [HANDLE_NAME, testCase.handle],
          [UNDO_NAME, testCase.undo],
        ] as const) {
          expect(button.top, `${what} pod ${name}`).toBeGreaterThanOrEqual(
            above.bottom + MIN_TAP_GAP - TOLERANCE,
          );
        }
        expect(button.right, `${what} vlevo od obrázku`).toBeLessThanOrEqual(
          testCase.picture.left - MIN_TAP_GAP + TOLERANCE,
        );
      });
    }
  });

  it('na výšku jsou obě tlačítka na místě dnešních nedávných barev', () => {
    const portrait = cases().filter((each) => !each.landscape);
    expect(portrait.length, 'okna na výšku').toBeGreaterThan(0);
    for (const testCase of portrait) {
      const fixed = LAYOUT_BEFORE_148.find(([name]) => name === testCase.window.name);
      expect(fixed, `${testCase.window.name}: pevné míry`).toBeDefined();
      const places = (fixed?.[2] ?? []).map(fixedBox);
      expect(places.length, `${testCase.window.name}: místa nedávných barev`).toBe(2);
      expect(testCase.quickTools.length, testCase.scene.label).toBe(QUICK_TOOL_PLACES);
      const sorted = [...testCase.quickTools].sort((a, b) => a.left - b.left);
      sorted.forEach((button, index) => {
        const place = places[index];
        expect(place, `${testCase.scene.label}: místo ${index + 1}`).toBeDefined();
        if (place !== undefined) {
          expectCloseBox(button, place, `${testCase.scene.label}: tlačítko ${index + 1}`);
        }
      });
    }
  });

  it('ťuknutí kamkoli na tlačítko jde na to tlačítko se zavřeným panelem i v obou krocích', () => {
    for (const testCase of cases()) {
      expect(quickToolRects(testCase.layout).length, testCase.scene.label).toBe(QUICK_TOOL_PLACES);
      quickToolRects(testCase.layout).forEach((button, index) => {
        for (const point of gridIn(button, 8)) {
          expect(
            touchTargetAt(testCase.layout, testCase.panel, point.x, point.y),
            `${testCase.scene.label}: ${quickToolName(index)} v ${Math.round(point.x)}, ${Math.round(point.y)}`,
          ).toEqual(quickToolTarget(index));
        }
      });
    }
  });
});

describe('#148 AC6: tah začatý na tlačítku nemaluje', () => {
  it('dotyk na tlačítku nikdy nejde na obrázek ani na panel, v žádném kroku', () => {
    for (const testCase of cases()) {
      expect(quickToolRects(testCase.layout).length, testCase.scene.label).toBe(QUICK_TOOL_PLACES);
      quickToolRects(testCase.layout).forEach((button, index) => {
        for (const point of gridIn(button, 8)) {
          const target = touchTargetAt(testCase.layout, testCase.panel, point.x, point.y);
          expect(
            ['picture', 'panel', 'none', 'recentColor'],
            `${testCase.scene.label}: ${quickToolName(index)}`,
          ).not.toContain(target.kind);
        }
      });
    }
  });
});

describe('#148 AC7: rozložení s tlačítky kreslicího nástroje a gumy', () => {
  it('zkouší se všech 22 oken Omalovánek na šířku i na výšku, se zavřeným panelem i v obou krocích', () => {
    expect(COLORING_WINDOWS.length).toBe(22);
    expect(cases().length).toBe(COLORING_WINDOWS.length * 3);
    expect(
      cases().some((each) => each.landscape),
      'na šířku',
    ).toBe(true);
    expect(
      cases().some((each) => !each.landscape),
      'na výšku',
    ).toBe(true);
  });

  for (const [ruleName, rule] of Object.entries(LAYOUT_RULES)) {
    it(`${ruleName} s tlačítky kreslicího nástroje a gumy ve všech oknech`, () => {
      for (const testCase of cases()) {
        expect(testCase.quickTools.length, `${testCase.scene.label}: tlačítka`).toBe(
          QUICK_TOOL_PLACES,
        );
        expect(rule(testCase.scene), testCase.scene.label).toEqual([]);
      }
    });
  }

  it('obě tlačítka mají ve všech oknech aspoň 64 × 64 px', () => {
    for (const testCase of cases()) {
      expect(testCase.quickTools.length, testCase.scene.label).toBe(QUICK_TOOL_PLACES);
      testCase.quickTools.forEach((button, index) => {
        const what = `${testCase.scene.label}: ${quickToolName(index)}`;
        expect(widthOf(button), `${what}: šířka`).toBeGreaterThanOrEqual(MIN_TAP_SIDE - TOLERANCE);
        expect(heightOf(button), `${what}: výška`).toBeGreaterThanOrEqual(MIN_TAP_SIDE - TOLERANCE);
      });
    }
  });

  it('obě tlačítka jsou uvnitř bezpečné plochy aspoň 4 px od okraje', () => {
    for (const testCase of cases()) {
      const { visible } = testCase;
      const inner: Box = {
        left: visible.left + MIN_EDGE_DISTANCE,
        right: visible.right - MIN_EDGE_DISTANCE,
        top: visible.top + MIN_EDGE_DISTANCE,
        bottom: visible.bottom - MIN_EDGE_DISTANCE,
      };
      expect(testCase.quickTools.length, testCase.scene.label).toBe(QUICK_TOOL_PLACES);
      testCase.quickTools.forEach((button, index) => {
        expect(isInside(button, inner), `${testCase.scene.label}: ${quickToolName(index)}`).toBe(
          true,
        );
      });
    }
  });

  it('od úchytu, Zpět, fotoaparátu, koštěte, obrázku a panelu v každém kroku jsou obě tlačítka aspoň 8 px', () => {
    for (const testCase of cases()) {
      expect(testCase.quickTools.length, testCase.scene.label).toBe(QUICK_TOOL_PLACES);
      testCase.quickTools.forEach((button, index) => {
        for (const [name, other] of othersOf(testCase)) {
          expect(
            gapBetween(button, other),
            `${testCase.scene.label}: ${quickToolName(index)} a ${name}`,
          ).toBeGreaterThanOrEqual(MIN_TAP_GAP - TOLERANCE);
        }
      });
    }
  });

  it('tlačítka jsou navzájem aspoň 8 px od sebe a nepřekrývají se', () => {
    for (const testCase of cases()) {
      const [first, second] = testCase.quickTools;
      expect(first, `${testCase.scene.label}: první`).toBeDefined();
      expect(second, `${testCase.scene.label}: druhé`).toBeDefined();
      if (first !== undefined && second !== undefined) {
        expect(overlaps(first, second), `${testCase.scene.label}: překryv`).toBe(false);
        expect(gapBetween(first, second), testCase.scene.label).toBeGreaterThanOrEqual(
          MIN_TAP_GAP - TOLERANCE,
        );
      }
    }
  });

  it('otevřený panel ani žádná jeho plocha v obou krocích nepřekryje tlačítka', () => {
    for (const testCase of cases().filter(isOpen)) {
      expect(testCase.quickTools.length, testCase.scene.label).toBe(QUICK_TOOL_PLACES);
      testCase.quickTools.forEach((button, index) => {
        const what = `${testCase.scene.label}: ${quickToolName(index)}`;
        expect(overlaps(testCase.panelBox, button), `${what}: panel`).toBe(false);
        testCase.stepPlaces.forEach((place, placeIndex) => {
          expect(overlaps(place, button), `${what}: plocha panelu ${placeIndex + 1}`).toBe(false);
        });
      });
    }
  });

  it('obrázek má ve všech oknech stejnou velikost jako před #148', () => {
    for (const testCase of cases()) {
      const fixed = LAYOUT_BEFORE_148.find(([name]) => name === testCase.window.name);
      expect(fixed, `${testCase.window.name}: pevné míry`).toBeDefined();
      if (fixed !== undefined) {
        const [, , width, height] = fixed[1];
        const what = testCase.scene.label;
        expect(Math.abs(widthOf(testCase.picture) - width), `${what}: šířka`).toBeLessThanOrEqual(
          FIXED_TOLERANCE,
        );
        expect(Math.abs(heightOf(testCase.picture) - height), `${what}: výška`).toBeLessThanOrEqual(
          FIXED_TOLERANCE,
        );
      }
    }
  });
});
