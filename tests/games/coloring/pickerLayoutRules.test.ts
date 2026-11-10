import { describe, expect, it } from 'vitest';

import { COLORING_GAME_AREA_FIT } from '../../../src/games/coloring/logic/coloringLayout';
import { layoutPicker, previewAt } from '../../../src/games/coloring/logic/pickerLayout';
import type { PickerLayout } from '../../../src/games/coloring/logic/pickerLayout';
import type { LayoutRect } from '../../../src/games/coloring/logic/coloringLayout';
import { homeButtonFor } from '../../../src/shared/logic/homeButton';
import { gameAreaFor } from '../../../src/shared/logic/viewportLayout';
import type { GameArea } from '../../../src/shared/logic/viewportLayout';
import { LAYOUT_RULES, MIN_TAP_GAP, MIN_TAP_SIDE } from '../../shared/layoutRules';
import type { LayoutItem, LayoutScene } from '../../shared/layoutRules';
import {
  freeAreaOf,
  gapBetween,
  heightOf,
  isInside,
  toCss,
  viewportOf,
  widthOf,
} from '../../shared/viewportFixtures';
import type { Box, TestWindow } from '../../shared/viewportFixtures';
import { COLORING_WINDOWS, HOME_NAME, boxOfRect, isLandscapeArea } from './coloringLayoutScenes';

/**
 * Testy k #124 AC6 (rozložení výběru) a AC5 (ťuknutí mimo náhledy):
 * pravidla v cyklu pro všechna okna testů rozložení Omalovánek
 * (`COLORING_WINDOWS`), jeden test na pravidlo, měří se pro 6 náhledů.
 * Podle schválených obrázků je mřížka na šířku 3 × 2 mezi pruhem domečku
 * vlevo a stejně širokým pruhem vpravo, na výšku 2 × 3 pod domečkem.
 * Prázdná místa se neukazují: sada se třemi omalovánkami zabere první tři
 * místa, ostatní nejsou vidět (logika výběru je ignoruje, viz
 * `pictureChoice.test.ts`).
 *
 * Výběr má stejnou herní plochu jako malování (`COLORING_GAME_AREA_FIT`).
 * Domeček je prvek stránky, proto je vyhrazené místo: plocha pro prst
 * a 8 px kolem, jako v `coloringLayoutScenes.ts`.
 *
 * Navržené rozhraní `src/games/coloring/logic/pickerLayout.ts` (herní jednotky):
 * - `layoutPicker(area: GameArea): PickerLayout` s polem
 *   `previews: readonly LayoutRect[]` (6 míst v pořadí sady, po řádcích
 *   zleva doprava),
 * - `previewAt(layout: PickerLayout, x: number, y: number): number | null`
 *   místo náhledu pod dotykem, `null` mimo náhledy a v mezerách.
 */

/** Náhledů se měří 6 (AC6). */
const MEASURED_PREVIEWS = 6;

/** Mezera mezi náhledy aspoň 16 px (AC6), víc než obecných 8 px. */
const MIN_PREVIEW_GAP = 16;

/** Poměr stran omalovánky 4 : 3 (AC6). */
const PICTURE_ASPECT = 4 / 3;

interface PickerCase {
  readonly window: TestWindow;
  readonly area: GameArea;
  readonly layout: PickerLayout;
  readonly landscape: boolean;
  /** Kde je hra vidět: volná plocha okna a zároveň herní plocha (CSS px). */
  readonly visible: Box;
  /** Plocha domečku pro prst (CSS px). */
  readonly home: Box;
  /** Náhledy v CSS px. */
  readonly previews: readonly Box[];
  readonly scene: LayoutScene;
}

function previewName(index: number): string {
  return `náhled ${index + 1}`;
}

function visibleAreaOf(window: TestWindow, area: GameArea): Box {
  const free = freeAreaOf(window);
  const plane = toCss({ left: 0, right: area.width, top: 0, bottom: area.height }, area);
  return {
    left: Math.max(free.left, plane.left),
    right: Math.min(free.right, plane.right),
    top: Math.max(free.top, plane.top),
    bottom: Math.min(free.bottom, plane.bottom),
  };
}

function homeHitOf(window: TestWindow): Box {
  const home = homeButtonFor(viewportOf(window));
  return {
    left: home.left,
    right: home.left + home.hitSize,
    top: home.top,
    bottom: home.top + home.hitSize,
  };
}

function pickerCase(window: TestWindow): PickerCase {
  const area = gameAreaFor(viewportOf(window), COLORING_GAME_AREA_FIT);
  const layout = layoutPicker(area);
  const previews = layout.previews.map((rect: LayoutRect) => toCss(boxOfRect(rect), area));
  const home = homeHitOf(window);
  const visible = visibleAreaOf(window, area);
  const items: LayoutItem[] = [
    {
      name: HOME_NAME,
      box: {
        left: home.left - MIN_TAP_GAP,
        right: home.right + MIN_TAP_GAP,
        top: home.top - MIN_TAP_GAP,
        bottom: home.bottom + MIN_TAP_GAP,
      },
      reserved: true,
    },
    ...previews.map((box, index) => ({ name: previewName(index), box, tappable: true })),
  ];
  return {
    window,
    area,
    layout,
    landscape: isLandscapeArea(area),
    visible,
    home,
    previews,
    scene: { label: `${window.name}, výběr omalovánky`, free: visible, items },
  };
}

let cached: PickerCase[] | undefined;

function cases(): PickerCase[] {
  cached ??= COLORING_WINDOWS.map(pickerCase);
  return cached;
}

/** Kolik různých hodnot má seznam (se zaokrouhlením na desetiny px). */
function distinct(values: readonly number[]): number {
  return new Set(values.map((value) => Math.round(value * 10))).size;
}

describe('#124 AC6: výběr omalovánky dodrží společná pravidla rozložení', () => {
  it('zkouší se iPad na šířku, telefon na šířku i na výšku a okna z plochy', () => {
    const modes = new Set(cases().map((testCase) => testCase.area.mode));
    expect([...modes].sort()).toEqual(['phoneLandscape', 'phonePortrait', 'tablet']);
    expect(cases().some((testCase) => testCase.landscape)).toBe(true);
    expect(cases().some((testCase) => !testCase.landscape)).toBe(true);
  });

  it('výběr má 6 míst pro náhledy ve všech oknech', () => {
    for (const testCase of cases()) {
      expect(testCase.previews.length, testCase.scene.label).toBe(MEASURED_PREVIEWS);
    }
  });

  for (const [ruleName, rule] of Object.entries(LAYOUT_RULES)) {
    it(`${ruleName} ve všech oknech`, () => {
      for (const testCase of cases()) {
        expect(rule(testCase.scene), testCase.scene.label).toEqual([]);
      }
    });
  }
});

describe('#124 AC6: všech 6 náhledů se vejde bez posouvání', () => {
  it('všech 6 náhledů je uvnitř bezpečné plochy, kde je hra vidět', () => {
    for (const testCase of cases()) {
      testCase.previews.forEach((preview, index) => {
        expect(
          isInside(preview, testCase.visible),
          `${testCase.scene.label}: ${previewName(index)}`,
        ).toBe(true);
      });
    }
  });

  it('náhledy se nepřekrývají navzájem ani s domečkem', () => {
    for (const testCase of cases()) {
      testCase.previews.forEach((preview, index) => {
        expect(
          gapBetween(preview, testCase.home),
          `${testCase.scene.label}: ${previewName(index)} a domeček`,
        ).toBeGreaterThanOrEqual(MIN_TAP_GAP - 0.01);
      });
    }
  });
});

describe('#124 AC6: velikost a tvar náhledů', () => {
  it('každý náhled má aspoň 64 × 64 px', () => {
    for (const testCase of cases()) {
      testCase.previews.forEach((preview, index) => {
        const what = `${testCase.scene.label}: ${previewName(index)}`;
        expect(widthOf(preview), `${what}, šířka`).toBeGreaterThanOrEqual(MIN_TAP_SIDE - 0.01);
        expect(heightOf(preview), `${what}, výška`).toBeGreaterThanOrEqual(MIN_TAP_SIDE - 0.01);
      });
    }
  });

  it('mezi náhledy je mezera aspoň 16 px', () => {
    for (const testCase of cases()) {
      testCase.previews.forEach((first, index) => {
        testCase.previews.slice(index + 1).forEach((second, offset) => {
          expect(
            gapBetween(first, second),
            `${testCase.scene.label}: ${previewName(index)} a ${previewName(index + offset + 1)}`,
          ).toBeGreaterThanOrEqual(MIN_PREVIEW_GAP - 0.01);
        });
      });
    }
  });

  it('náhled má poměr stran omalovánky 4 : 3 a na výšku se neotáčí', () => {
    for (const testCase of cases()) {
      testCase.previews.forEach((preview, index) => {
        expect(
          widthOf(preview) / heightOf(preview),
          `${testCase.scene.label}: ${previewName(index)}`,
        ).toBeCloseTo(PICTURE_ASPECT, 2);
      });
    }
  });

  it('všechny náhledy jsou stejně velké', () => {
    for (const testCase of cases()) {
      expect(distinct(testCase.previews.map(widthOf)), testCase.scene.label).toBe(1);
      expect(distinct(testCase.previews.map(heightOf)), testCase.scene.label).toBe(1);
    }
  });
});

describe('#124 AC6 (schválené obrázky): mřížka na šířku 3 × 2, na výšku 2 × 3', () => {
  it('na šířku jsou náhledy ve 3 sloupcích a 2 řadách, po řadách zleva doprava', () => {
    for (const testCase of cases().filter((each) => each.landscape)) {
      const { previews } = testCase;
      expect(distinct(previews.map((preview) => preview.left)), testCase.scene.label).toBe(3);
      expect(distinct(previews.map((preview) => preview.top)), testCase.scene.label).toBe(2);
      expectRowOrder(testCase, 3);
    }
  });

  it('na výšku jsou náhledy ve 2 sloupcích a 3 řadách, po řadách zleva doprava', () => {
    for (const testCase of cases().filter((each) => !each.landscape)) {
      const { previews } = testCase;
      expect(distinct(previews.map((preview) => preview.left)), testCase.scene.label).toBe(2);
      expect(distinct(previews.map((preview) => preview.top)), testCase.scene.label).toBe(3);
      expectRowOrder(testCase, 2);
    }
  });

  it('na šířku je mřížka mezi pruhem domečku vlevo a stejně širokým pruhem vpravo', () => {
    for (const testCase of cases().filter((each) => each.landscape)) {
      const strip = testCase.home.right - testCase.visible.left;
      for (const [index, preview] of testCase.previews.entries()) {
        const what = `${testCase.scene.label}: ${previewName(index)}`;
        expect(preview.left, `${what} vpravo od pruhu domečku`).toBeGreaterThanOrEqual(
          testCase.home.right - 0.01,
        );
        expect(preview.right, `${what} vlevo od pravého pruhu`).toBeLessThanOrEqual(
          testCase.visible.right - strip + 0.01,
        );
      }
    }
  });

  it('na výšku je mřížka pod domečkem', () => {
    for (const testCase of cases().filter((each) => !each.landscape)) {
      for (const [index, preview] of testCase.previews.entries()) {
        expect(
          preview.top,
          `${testCase.scene.label}: ${previewName(index)} pod domečkem`,
        ).toBeGreaterThanOrEqual(testCase.home.bottom - 0.01);
      }
    }
  });
});

/** Náhledy jdou po řadách: v řadě zleva doprava, další řada níž. */
function expectRowOrder(testCase: PickerCase, columns: number): void {
  testCase.previews.forEach((preview, index) => {
    const previous = testCase.previews[index - 1];
    if (previous === undefined) {
      return;
    }
    const what = `${testCase.scene.label}: ${previewName(index)}`;
    if (index % columns === 0) {
      expect(preview.top, `${what} začíná novou řadu`).toBeGreaterThan(previous.top);
    } else {
      expect(preview.top, `${what} ve stejné řadě`).toBeCloseTo(previous.top, 1);
      expect(preview.left, `${what} vpravo od předchozího`).toBeGreaterThan(previous.left);
    }
  });
}

describe('#124 AC5: ťuknutí mimo náhledy nic neudělá', () => {
  it('ťuknutí doprostřed náhledu patří tomu náhledu', () => {
    for (const testCase of cases()) {
      testCase.layout.previews.forEach((rect, index) => {
        expect(
          previewAt(testCase.layout, rect.left + rect.width / 2, rect.top + rect.height / 2),
          `${testCase.scene.label}: ${previewName(index)}`,
        ).toBe(index);
      });
    }
  });

  it('ťuknutí do mezery mezi náhledy, do rohu obrazovky a mimo plochu nepatří žádnému náhledu', () => {
    for (const testCase of cases()) {
      const { layout, area } = testCase;
      const first = layout.previews[0];
      const second = layout.previews[1];
      if (first === undefined || second === undefined) {
        throw new Error(`${testCase.scene.label}: chybí náhledy`);
      }
      const gapX = (first.left + first.width + second.left) / 2;
      const points: ReadonlyArray<readonly [string, number, number]> = [
        ['mezera mezi náhledem 1 a 2', gapX, first.top + first.height / 2],
        ['levý horní roh', 0, 0],
        ['pravý dolní roh', area.width - 0.5, area.height - 0.5],
        ['mimo plochu', -10, -10],
        ['nad prvním náhledem', first.left + first.width / 2, first.top - 1],
      ];
      for (const [name, x, y] of points) {
        expect(previewAt(layout, x, y), `${testCase.scene.label}: ${name}`).toBeNull();
      }
    }
  });
});
