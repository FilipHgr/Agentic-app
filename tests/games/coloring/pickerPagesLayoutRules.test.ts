import { describe, expect, it } from 'vitest';

import { COLORING_GAME_AREA_FIT } from '../../../src/games/coloring/logic/coloringLayout';
import type { LayoutRect } from '../../../src/games/coloring/logic/coloringLayout';
import {
  bookAt,
  layoutPicker,
  pickerArrowAt,
  previewAt,
} from '../../../src/games/coloring/logic/pickerLayout';
import type { PickerLayout } from '../../../src/games/coloring/logic/pickerLayout';
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
import { COLORING_WINDOWS, HOME_NAME, boxOfRect } from './coloringLayoutScenes';
import { PICKER_BEFORE_150 } from './layoutBefore150Fixture';
import type { CssEdges } from './layoutBefore150Fixture';

/**
 * Testy k #150 AC5 (rozložení výběru se šipkami ◀ ▶) a AC1 (při 12 a méně
 * omalovánkách výběr pixel po pixelu jako dnes): pravidla v cyklu pro
 * všechna okna testů rozložení Omalovánek (`COLORING_WINDOWS`), jeden test
 * na pravidlo. Výběr má stejnou herní plochu jako malování
 * (`COLORING_GAME_AREA_FIT`), domeček je prvek stránky, proto je
 * vyhrazené místo (plocha pro prst a 8 px kolem), jako v testech výběru
 * (#124, #132) a alba se šipkami (#149).
 *
 * Měří se výběr testovací sady s 13 a 25 omalovánkami (AC3) na plné
 * 1. stránce (12 náhledů), kde jsou šipky vidět. Pravidla ze zadání:
 * - náhledy jako v #132 AC4 (vejdou se bez posouvání, nepřekrývají se,
 *   jsou uvnitř bezpečné plochy a mimo domeček a 8 px kolem, mají aspoň
 *   64 × 64 px a poměr 4 : 3, mezery aspoň 16 px, kniha je od nich aspoň
 *   16 px, na telefonu na šířku 8 px, a zůstane na svém místě),
 * - šipky jako v albu s listováním (#149 AC6: aspoň 64 × 64 px, uvnitř
 *   bezpečné plochy, od náhledů, knihy a domečku aspoň 16 px),
 * - kniha a ukazatel klíčů jsou od šipek aspoň 16 px.
 * Kde přesně šipky jsou, zadání nepředepisuje; testy hlídají jen, že ◀
 * je vlevo od ▶.
 *
 * Navržené rozšíření `pickerLayout.ts` (herní jednotky, jako `layoutAlbum`):
 * - `layoutPicker(area, options?: { pictureCount?: number })`; bez počtu
 *   jako dnes (bez šipek), aby testy z #124, #132 a #140 platily dál,
 * - `PickerLayout.arrows: boolean` šipky jsou vidět (víc než 12 omalovánek),
 * - `PickerLayout.previousArrow: LayoutRect` a `nextArrow: LayoutRect`,
 * - `pickerArrowAt(layout, x, y): 'previous' | 'next' | null` šipka pod
 *   dotykem, `null` mimo šipky a ve výběru bez šipek.
 */

const PAGE_PLACES = 12;
const MIN_PREVIEW_GAP = 16;
const MIN_ARROW_GAP = 16;
const PICTURE_ASPECT = 4 / 3;
const PREVIOUS_NAME = 'šipka ◀';
const NEXT_NAME = 'šipka ▶';
const BOOK_NAME = 'kniha';
const INDICATOR_NAME = 'ukazatel klíčů';

/** Testovací sady s víc stránkami (AC3). */
const PAGED_COUNTS: readonly number[] = [13, 25];

/** Počty omalovánek na jediné stránce: výběr je jako dnes (AC1). */
const SINGLE_PAGE_COUNTS: readonly number[] = [2, 11, 12];

/**
 * Okna, kde je kniha od náhledů výběru aspoň 8 px místo 16 px (rozhodnutí
 * 2026-11-10, #132 AC4 `BOOK_NARROW_GAP_WINDOWS`), podle rozměru okna.
 */
const BOOK_NARROW_GAP_WINDOWS: ReadonlySet<string> = new Set([
  '932×500',
  '844×340',
  '932×430',
  '932×499',
]);

function sizeOf(window: TestWindow): string {
  return `${window.width}×${window.height}`;
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

function areaOf(window: TestWindow): GameArea {
  return gameAreaFor(viewportOf(window), COLORING_GAME_AREA_FIT);
}

interface PagedCase {
  readonly window: TestWindow;
  readonly pictureCount: number;
  readonly layout: PickerLayout;
  readonly visible: Box;
  readonly home: Box;
  readonly book: Box;
  readonly indicator: Box;
  readonly previews: readonly Box[];
  readonly arrows: ReadonlyArray<readonly [string, Box]>;
  readonly scene: LayoutScene;
}

function pagedCase(window: TestWindow, pictureCount: number): PagedCase {
  const area = areaOf(window);
  const layout = layoutPicker(area, { pictureCount });
  const css = (rect: LayoutRect): Box => toCss(boxOfRect(rect), area);
  const visible = visibleAreaOf(window, area);
  const home = homeHitOf(window);
  const previews = layout.previews.slice(0, PAGE_PLACES).map(css);
  const book = css(layout.book);
  const indicator = css(layout.keyIndicator);
  const arrows: ReadonlyArray<readonly [string, Box]> = [
    [PREVIOUS_NAME, css(layout.previousArrow)],
    [NEXT_NAME, css(layout.nextArrow)],
  ];
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
    ...arrows.map(([name, box]) => ({ name, box, tappable: true })),
    { name: BOOK_NAME, box: book, tappable: true },
    { name: INDICATOR_NAME, box: indicator },
  ];
  return {
    window,
    pictureCount,
    layout,
    visible,
    home,
    book,
    indicator,
    previews,
    arrows,
    scene: {
      label: `${window.name}, výběr s ${pictureCount} omalovánkami se šipkami`,
      free: visible,
      items,
    },
  };
}

let cached: PagedCase[] | undefined;

function cases(): PagedCase[] {
  cached ??= COLORING_WINDOWS.flatMap((window) =>
    PAGED_COUNTS.map((count) => pagedCase(window, count)),
  );
  return cached;
}

/** Kolik různých hodnot má seznam (se zaokrouhlením na desetiny px). */
function distinct(values: readonly number[]): number {
  return new Set(values.map((value) => Math.round(value * 10))).size;
}

function centerOf(rect: LayoutRect): { readonly x: number; readonly y: number } {
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

function edgesOf(box: Box): CssEdges {
  return [box.left, box.top, box.right, box.bottom];
}

function beforeOf(window: TestWindow): (typeof PICKER_BEFORE_150)[number] {
  const row = PICKER_BEFORE_150.find((each) => each.window === window.name);
  if (row === undefined) {
    throw new Error(`${window.name}: chybí rozložení výběru před #150`);
  }
  return row;
}

function expectEdges(actual: Box, expected: CssEdges, what: string): void {
  const names = ['levý', 'horní', 'pravý', 'spodní'] as const;
  edgesOf(actual).forEach((value, index) => {
    expect(value, `${what}, ${names[index]} okraj`).toBeCloseTo(expected[index] ?? NaN, 2);
  });
}

describe('#150 AC5: výběr se šipkami dodrží společná pravidla rozložení', () => {
  for (const [ruleName, rule] of Object.entries(LAYOUT_RULES)) {
    it(`${ruleName} ve všech oknech ve výběru se šipkami`, () => {
      for (const testCase of cases()) {
        expect(rule(testCase.scene), testCase.scene.label).toEqual([]);
      }
    });
  }
});

describe('#150 AC5: náhledy na stránce se šipkami jako v #132 AC4', () => {
  it('stránka má 12 míst a při víc než 12 omalovánkách jsou šipky vidět', () => {
    for (const testCase of cases()) {
      expect(testCase.layout.previews.length, testCase.scene.label).toBe(PAGE_PLACES);
      expect(testCase.layout.arrows, testCase.scene.label).toBe(true);
    }
  });

  it('všech 12 náhledů je uvnitř bezpečné plochy, kde je hra vidět', () => {
    for (const testCase of cases()) {
      testCase.previews.forEach((preview, index) => {
        expect(
          isInside(preview, testCase.visible),
          `${testCase.scene.label}: ${previewName(index)}`,
        ).toBe(true);
      });
    }
  });

  it('náhledy nepřekrývají domeček ani 8 px kolem něj', () => {
    for (const testCase of cases()) {
      testCase.previews.forEach((preview, index) => {
        expect(
          gapBetween(preview, testCase.home),
          `${testCase.scene.label}: ${previewName(index)} a domeček`,
        ).toBeGreaterThanOrEqual(MIN_TAP_GAP - 0.01);
      });
    }
  });

  it('každý náhled má aspoň 64 × 64 px', () => {
    for (const testCase of cases()) {
      testCase.previews.forEach((preview, index) => {
        const what = `${testCase.scene.label}: ${previewName(index)}`;
        expect(widthOf(preview), `${what}, šířka`).toBeGreaterThanOrEqual(MIN_TAP_SIDE - 0.01);
        expect(heightOf(preview), `${what}, výška`).toBeGreaterThanOrEqual(MIN_TAP_SIDE - 0.01);
      });
    }
  });

  it('náhled má poměr stran omalovánky 4 : 3 a všechny jsou stejně velké', () => {
    for (const testCase of cases()) {
      testCase.previews.forEach((preview, index) => {
        expect(
          widthOf(preview) / heightOf(preview),
          `${testCase.scene.label}: ${previewName(index)}`,
        ).toBeCloseTo(PICTURE_ASPECT, 2);
      });
      expect(distinct(testCase.previews.map(widthOf)), testCase.scene.label).toBe(1);
    }
  });

  it('mezi náhledy je mezera aspoň 16 px a nepřekrývají se', () => {
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

  it('kniha je od náhledů aspoň 16 px, na telefonu na šířku aspoň 8 px', () => {
    for (const testCase of cases()) {
      const minGap = BOOK_NARROW_GAP_WINDOWS.has(sizeOf(testCase.window))
        ? MIN_TAP_GAP
        : MIN_PREVIEW_GAP;
      testCase.previews.forEach((preview, index) => {
        expect(
          gapBetween(testCase.book, preview),
          `${testCase.scene.label}: kniha a ${previewName(index)} (aspoň ${minGap} px)`,
        ).toBeGreaterThanOrEqual(minGap - 0.01);
      });
    }
  });

  it('kniha a ukazatel klíčů zůstanou na svém místě i se šipkami', () => {
    for (const testCase of cases()) {
      const before = beforeOf(testCase.window);
      expectEdges(testCase.book, before.book, `${testCase.scene.label}: kniha`);
      expectEdges(testCase.indicator, before.keyIndicator, `${testCase.scene.label}: ukazatel`);
    }
  });

  it('ukazatel klíčů nepřekrývá žádný z 12 náhledů', () => {
    for (const testCase of cases()) {
      testCase.previews.forEach((preview, index) => {
        expect(
          gapBetween(testCase.indicator, preview),
          `${testCase.scene.label}: ukazatel a ${previewName(index)}`,
        ).toBeGreaterThanOrEqual(-0.01);
      });
    }
  });
});

describe('#150 AC5: šipky ◀ ▶ jako v albu s listováním', () => {
  it('šipky mají aspoň 64 × 64 px', () => {
    for (const testCase of cases()) {
      for (const [name, box] of testCase.arrows) {
        const what = `${testCase.scene.label}: ${name}`;
        expect(widthOf(box), `${what}, šířka`).toBeGreaterThanOrEqual(MIN_TAP_SIDE - 0.01);
        expect(heightOf(box), `${what}, výška`).toBeGreaterThanOrEqual(MIN_TAP_SIDE - 0.01);
      }
    }
  });

  it('šipky jsou uvnitř bezpečné plochy', () => {
    for (const testCase of cases()) {
      for (const [name, box] of testCase.arrows) {
        expect(isInside(box, testCase.visible), `${testCase.scene.label}: ${name}`).toBe(true);
      }
    }
  });

  it('šipky jsou od všech 12 náhledů aspoň 16 px', () => {
    for (const testCase of cases()) {
      for (const [name, box] of testCase.arrows) {
        testCase.previews.forEach((preview, index) => {
          expect(
            gapBetween(box, preview),
            `${testCase.scene.label}: ${name} a ${previewName(index)}`,
          ).toBeGreaterThanOrEqual(MIN_ARROW_GAP - 0.01);
        });
      }
    }
  });

  it('šipky jsou od domečku aspoň 16 px', () => {
    for (const testCase of cases()) {
      for (const [name, box] of testCase.arrows) {
        expect(
          gapBetween(box, testCase.home),
          `${testCase.scene.label}: ${name} a domeček`,
        ).toBeGreaterThanOrEqual(MIN_ARROW_GAP - 0.01);
      }
    }
  });

  it('kniha je od šipek aspoň 16 px', () => {
    for (const testCase of cases()) {
      for (const [name, box] of testCase.arrows) {
        expect(
          gapBetween(box, testCase.book),
          `${testCase.scene.label}: ${name} a ${BOOK_NAME}`,
        ).toBeGreaterThanOrEqual(MIN_ARROW_GAP - 0.01);
      }
    }
  });

  it('ukazatel klíčů je od šipek aspoň 16 px', () => {
    for (const testCase of cases()) {
      for (const [name, box] of testCase.arrows) {
        expect(
          gapBetween(box, testCase.indicator),
          `${testCase.scene.label}: ${name} a ${INDICATOR_NAME}`,
        ).toBeGreaterThanOrEqual(MIN_ARROW_GAP - 0.01);
      }
    }
  });

  it('šipka ◀ je vlevo od šipky ▶', () => {
    for (const testCase of cases()) {
      const [[, previous], [, next]] = testCase.arrows as [
        readonly [string, Box],
        readonly [string, Box],
      ];
      expect(previous.right, testCase.scene.label).toBeLessThanOrEqual(next.left + 0.01);
    }
  });

  it('ťuknutí doprostřed šipky patří šipce, ne náhledu ani knize', () => {
    for (const testCase of cases()) {
      const { layout } = testCase;
      const rects: ReadonlyArray<readonly [string, LayoutRect, 'previous' | 'next']> = [
        [PREVIOUS_NAME, layout.previousArrow, 'previous'],
        [NEXT_NAME, layout.nextArrow, 'next'],
      ];
      for (const [name, rect, direction] of rects) {
        const { x, y } = centerOf(rect);
        const what = `${testCase.scene.label}: ${name}`;
        expect(pickerArrowAt(layout, x, y), what).toBe(direction);
        expect(previewAt(layout, x, y), `${what} není náhled`).toBeNull();
        expect(bookAt(layout, x, y), `${what} není kniha`).toBe(false);
      }
    }
  });

  it('ťuknutí doprostřed náhledu, na knihu nebo ukazatel klíčů nepatří žádné šipce', () => {
    for (const testCase of cases()) {
      const { layout } = testCase;
      const rects: ReadonlyArray<readonly [string, LayoutRect]> = [
        ...layout.previews.map((rect, index) => [previewName(index), rect] as const),
        [BOOK_NAME, layout.book],
        [INDICATOR_NAME, layout.keyIndicator],
      ];
      for (const [name, rect] of rects) {
        const { x, y } = centerOf(rect);
        expect(pickerArrowAt(layout, x, y), `${testCase.scene.label}: ${name}`).toBeNull();
      }
    }
  });
});

describe('#150 AC1: při 12 a méně omalovánkách šipky nejsou a výběr je jako dnes', () => {
  it('pevná tabulka výběru před #150 má všechna okna Omalovánek', () => {
    expect(PICKER_BEFORE_150.map((row) => row.window)).toEqual(
      COLORING_WINDOWS.map((window) => window.name),
    );
  });

  it('všech 12 míst náhledů, kniha, ukazatel klíčů a zaoblení jsou na stejném místě jako před #150', () => {
    for (const window of COLORING_WINDOWS) {
      const before = beforeOf(window);
      const area = areaOf(window);
      for (const pictureCount of SINGLE_PAGE_COUNTS) {
        const layout = layoutPicker(area, { pictureCount });
        const css = (rect: LayoutRect): Box => toCss(boxOfRect(rect), area);
        const what = `${window.name}, ${pictureCount} omalovánek`;
        expect(layout.previews.length, `${what}: míst`).toBe(PAGE_PLACES);
        layout.previews.forEach((rect, index) => {
          expectEdges(
            css(rect),
            before.places[index] ?? [NaN, NaN, NaN, NaN],
            `${what}: ${previewName(index)}`,
          );
        });
        expectEdges(css(layout.book), before.book, `${what}: kniha`);
        expectEdges(css(layout.keyIndicator), before.keyIndicator, `${what}: ukazatel`);
        expect(layout.cornerRadius * area.scale, `${what}: zaoblení`).toBeCloseTo(
          before.cornerRadius,
          2,
        );
      }
    }
  });

  it('při 12 a méně omalovánkách šipky nejsou a ťuknutí na jejich místo nepatří šipce', () => {
    for (const window of COLORING_WINDOWS) {
      const area = areaOf(window);
      for (const pictureCount of SINGLE_PAGE_COUNTS) {
        const layout = layoutPicker(area, { pictureCount });
        const what = `${window.name}, ${pictureCount} omalovánek`;
        expect(layout.arrows, `${what}: šipky nejsou`).toBe(false);
        for (const arrow of [layout.previousArrow, layout.nextArrow]) {
          const { x, y } = centerOf(arrow);
          expect(pickerArrowAt(layout, x, y), `${what}: ťuknutí na místo šipky`).toBeNull();
        }
      }
    }
  });

  it('výběr bez počtu omalovánek je stejný jako dnes (testy #124, #132 a #140 platí dál)', () => {
    for (const window of COLORING_WINDOWS) {
      const area = areaOf(window);
      const today = layoutPicker(area);
      expect(today.arrows, `${window.name}: šipky nejsou`).toBe(false);
      expect(today, window.name).toEqual(layoutPicker(area, { pictureCount: 11 }));
    }
  });

  it('při 13 omalovánkách (2 stránky) šipky jsou', () => {
    for (const window of COLORING_WINDOWS) {
      expect(layoutPicker(areaOf(window), { pictureCount: 13 }).arrows, window.name).toBe(true);
    }
  });
});
