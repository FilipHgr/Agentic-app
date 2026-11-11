import { describe, expect, it } from 'vitest';

import { COLORING_GAME_AREA_FIT } from '../../../src/games/coloring/logic/coloringLayout';
import { startPictureChoice } from '../../../src/games/coloring/logic/pictureChoice';
import { layoutPicker, previewAt } from '../../../src/games/coloring/logic/pickerLayout';
import type { PickerLayout } from '../../../src/games/coloring/logic/pickerLayout';
import type { LayoutRect } from '../../../src/games/coloring/logic/coloringLayout';
import { COLORING_PICTURES } from '../../../src/games/coloring/logic/pictureSet';
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
 * Testy k #124 AC6 (rozložení výběru) a AC5 (ťuknutí mimo náhledy), od #132
 * AC4 pro 11 omalovánek: pravidla v cyklu pro všechna okna testů rozložení
 * Omalovánek (`COLORING_WINDOWS`), jeden test na pravidlo, měří se pro 11
 * náhledů (#132 AC4).
 *
 * Od #132 (schválené obrázky) má výběr mřížku alba z #126 s 12 místy: na
 * šířku 4 × 3 mezi pruhem domečku vlevo a stejně širokým pruhem vpravo, na
 * výšku 3 × 4 nebo 2 × 6 pod domečkem, podle toho, co dá větší náhled
 * (OQ1, stejně jako `layoutAlbum`). 12. místo zůstane prázdné, nekreslí se
 * a ťuknutí na něj nic neudělá. (Před #132: 6 míst, 3 × 2 a 2 × 3.)
 * Prázdná místa se neukazují: sada s méně omalovánkami zabere první místa,
 * ostatní nejsou vidět (logika výběru je ignoruje, viz
 * `pictureChoice.test.ts`).
 *
 * Výběr má stejnou herní plochu jako malování (`COLORING_GAME_AREA_FIT`).
 * Domeček je prvek stránky, proto je vyhrazené místo: plocha pro prst
 * a 8 px kolem, jako v `coloringLayoutScenes.ts`.
 *
 * Navržené rozhraní `src/games/coloring/logic/pickerLayout.ts` (herní jednotky):
 * - `layoutPicker(area: GameArea): PickerLayout` s polem
 *   `previews: readonly LayoutRect[]` (od #132 12 míst v pořadí sady, po
 *   řádcích zleva doprava),
 * - `previewAt(layout: PickerLayout, x: number, y: number): number | null`
 *   místo náhledu pod dotykem, `null` mimo náhledy a v mezerách.
 */

/** Míst v mřížce výběru od #132 (mřížka alba z #126). */
const GRID_PLACES = 12;

/** Náhledů se měří 11, kolik má sada omalovánek (#132 AC4). */
const MEASURED_PREVIEWS = 11;

/** Sloupce a řady mřížky podle schválených obrázků #132. */
const LANDSCAPE_GRID = { columns: 4, rows: 3 };
/** Na výšku 3 × 4, nebo 2 × 6, podle toho, co dá větší náhled (#132 OQ1, jako `layoutAlbum`). */
const PORTRAIT_GRIDS: ReadonlyArray<{ readonly columns: number; readonly rows: number }> = [
  { columns: 3, rows: 4 },
  { columns: 2, rows: 6 },
];

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
  /** Všech 12 míst mřížky v CSS px. */
  readonly places: readonly Box[];
  /** 11 náhledů omalovánek (místa 1–11) v CSS px. */
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
  const places = layout.previews.map((rect: LayoutRect) => toCss(boxOfRect(rect), area));
  const previews = places.slice(0, MEASURED_PREVIEWS);
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
    places,
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

describe('#124 a #132 AC4: výběr omalovánky dodrží společná pravidla rozložení', () => {
  it('zkouší se iPad na šířku, telefon na šířku i na výšku a okna z plochy', () => {
    const modes = new Set(cases().map((testCase) => testCase.area.mode));
    expect([...modes].sort()).toEqual(['phoneLandscape', 'phonePortrait', 'tablet']);
    expect(cases().some((testCase) => testCase.landscape)).toBe(true);
    expect(cases().some((testCase) => !testCase.landscape)).toBe(true);
  });

  it('výběr má 12 míst pro náhledy ve všech oknech a měří se 11 náhledů sady', () => {
    expect(COLORING_PICTURES.length, 'omalovánek v sadě').toBe(MEASURED_PREVIEWS);
    for (const testCase of cases()) {
      expect(testCase.places.length, testCase.scene.label).toBe(GRID_PLACES);
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

describe('#132 AC4: všech 11 náhledů se vejde bez posouvání', () => {
  it('všech 11 náhledů je uvnitř bezpečné plochy, kde je hra vidět', () => {
    for (const testCase of cases()) {
      testCase.previews.forEach((preview, index) => {
        expect(
          isInside(preview, testCase.visible),
          `${testCase.scene.label}: ${previewName(index)}`,
        ).toBe(true);
      });
    }
  });

  it('náhledy se nepřekrývají navzájem', () => {
    for (const testCase of cases()) {
      testCase.previews.forEach((first, index) => {
        testCase.previews.slice(index + 1).forEach((second, offset) => {
          expect(
            gapBetween(first, second),
            `${testCase.scene.label}: ${previewName(index)} a ${previewName(index + offset + 1)}`,
          ).toBeGreaterThan(0);
        });
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
});

describe('#124 a #132 AC4: velikost a tvar náhledů', () => {
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

describe('#132 AC4 (schválené obrázky): mřížka alba na šířku 4 × 3, na výšku 3 × 4 nebo 2 × 6', () => {
  it('na šířku je 12 míst ve 4 sloupcích a 3 řadách, po řadách zleva doprava', () => {
    for (const testCase of cases().filter((each) => each.landscape)) {
      const { places } = testCase;
      expect(distinct(places.map((place) => place.left)), `${testCase.scene.label}: sloupců`).toBe(
        LANDSCAPE_GRID.columns,
      );
      expect(distinct(places.map((place) => place.top)), `${testCase.scene.label}: řad`).toBe(
        LANDSCAPE_GRID.rows,
      );
      expectRowOrder(testCase, LANDSCAPE_GRID.columns);
    }
  });

  it('na výšku je 12 míst ve 3 sloupcích a 4 řadách, nebo ve 2 sloupcích a 6 řadách, po řadách zleva doprava', () => {
    for (const testCase of cases().filter((each) => !each.landscape)) {
      const shape = gridShapeOf(testCase);
      expect(
        PORTRAIT_GRIDS.map((grid) => [grid.columns, grid.rows]),
        `${testCase.scene.label}: sloupců a řad ${shape.columns} × ${shape.rows}`,
      ).toContainEqual([shape.columns, shape.rows]);
      expectRowOrder(testCase, shape.columns);
    }
  });

  it('na výšku má náhled aspoň takovou velikost, jakou by dala lepší z mřížek 3 × 4 a 2 × 6 ve stejném volném místě', () => {
    for (const testCase of cases().filter((each) => !each.landscape)) {
      const free = portraitFreeBoxOf(testCase);
      const gap = gridGapOf(testCase);
      const best = Math.max(
        ...PORTRAIT_GRIDS.map((grid) => previewWidthIn(free, grid.columns, grid.rows, gap)),
      );
      const first = testCase.places[0];
      if (first === undefined) {
        throw new Error(`${testCase.scene.label}: chybí 1. místo`);
      }
      expect(
        widthOf(first),
        `${testCase.scene.label}: šířka náhledu proti lepší mřížce (${best.toFixed(1)} px)`,
      ).toBeGreaterThanOrEqual(best - 0.5);
    }
  });

  it('prvních 6 omalovánek je na pozicích 1–6 po řádcích: na šířku celá 1. řada a začátek 2., na výšku 1. a 2. řada', () => {
    for (const testCase of cases()) {
      const columns = gridShapeOf(testCase).columns;
      const rowTops = [...new Set(testCase.places.map((place) => Math.round(place.top * 10)))].sort(
        (first, second) => first - second,
      );
      testCase.places.slice(0, 6).forEach((place, index) => {
        expect(
          rowTops.indexOf(Math.round(place.top * 10)),
          `${testCase.scene.label}: ${previewName(index)} v řadě`,
        ).toBe(Math.floor(index / columns));
      });
    }
  });

  it('12. místo je poslední v pořadí po řádcích: v poslední řadě vpravo od všech ostatních', () => {
    for (const testCase of cases()) {
      const last = testCase.places[GRID_PLACES - 1];
      if (last === undefined) {
        throw new Error(`${testCase.scene.label}: chybí 12. místo`);
      }
      const what = testCase.scene.label;
      expect(last.top, `${what}: v poslední řadě`).toBeCloseTo(
        Math.max(...testCase.places.map((place) => place.top)),
        1,
      );
      const sameRow = testCase.places
        .slice(0, GRID_PLACES - 1)
        .filter((place) => Math.abs(place.top - last.top) < 0.1);
      for (const place of sameRow) {
        expect(last.left, `${what}: vpravo od místa v téže řadě`).toBeGreaterThan(place.left);
      }
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

/** Sloupce a řady mřížky, jak je dítě vidí (všech 12 míst). */
function gridShapeOf(testCase: PickerCase): { columns: number; rows: number } {
  return {
    columns: distinct(testCase.places.map((place) => place.left)),
    rows: distinct(testCase.places.map((place) => place.top)),
  };
}

/** Mezera mezi sousedními místy mřížky (1. a 2. místo jsou vždy v jedné řadě). */
function gridGapOf(testCase: PickerCase): number {
  const [first, second] = testCase.places;
  if (first === undefined || second === undefined) {
    throw new Error(`${testCase.scene.label}: chybí místa`);
  }
  return second.left - first.right;
}

/**
 * Volné místo pro mřížku na výšku podle pravidel AC4 (CSS px): 8 px od
 * okrajů viditelné plochy, pod domečkem a 8 px kolem něj a aspoň 16 px pod
 * knihou.
 */
function portraitFreeBoxOf(testCase: PickerCase): Box {
  const book = toCss(boxOfRect(testCase.layout.book), testCase.area);
  return {
    left: testCase.visible.left + MIN_TAP_GAP,
    right: testCase.visible.right - MIN_TAP_GAP,
    top: Math.max(testCase.home.bottom + MIN_TAP_GAP, book.bottom + MIN_PREVIEW_GAP),
    bottom: testCase.visible.bottom - MIN_TAP_GAP,
  };
}

/** Největší šířka náhledu 4 : 3, se kterou se mřížka `columns` × `rows` vejde do `free`. */
function previewWidthIn(free: Box, columns: number, rows: number, gap: number): number {
  const byWidth = (widthOf(free) - (columns - 1) * gap) / columns;
  const byHeight = ((heightOf(free) - (rows - 1) * gap) / rows) * PICTURE_ASPECT;
  return Math.min(byWidth, byHeight);
}

/** Místa jdou po řadách: v řadě zleva doprava, další řada níž. */
function expectRowOrder(testCase: PickerCase, columns: number): void {
  testCase.places.forEach((preview, index) => {
    const previous = testCase.places[index - 1];
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

describe('#132 AC4: 12. místo mřížky je prázdné', () => {
  it('ťuknutí na 12. místo nic neotevře a dítě zůstane na výběru', () => {
    for (const testCase of cases()) {
      const rect = testCase.layout.previews[GRID_PLACES - 1];
      if (rect === undefined) {
        throw new Error(`${testCase.scene.label}: chybí 12. místo`);
      }
      const place = previewAt(
        testCase.layout,
        rect.left + rect.width / 2,
        rect.top + rect.height / 2,
      );
      expect(place, `${testCase.scene.label}: místo pod prstem`).toBe(GRID_PLACES - 1);
      const choice = startPictureChoice(COLORING_PICTURES, { now: () => 0 });
      expect(choice.tapPreview(place ?? -1), `${testCase.scene.label}: ťuknutí`).toEqual({
        kind: 'ignored',
      });
      expect(choice.screen(), `${testCase.scene.label}: obrazovka`).toEqual({ kind: 'picker' });
    }
  });

  it('na 12. místě není žádná omalovánka sady (náhled se tam nekreslí)', () => {
    expect(COLORING_PICTURES[GRID_PLACES - 1]).toBeUndefined();
    const choice = startPictureChoice(COLORING_PICTURES, { now: () => 0 });
    expect(choice.previews().length, 'náhledů na výběru').toBe(GRID_PLACES - 1);
  });

  it('ťuknutí na každé z míst 1–11 otevře právě omalovánku na tom místě', () => {
    for (const testCase of cases()) {
      testCase.layout.previews.slice(0, MEASURED_PREVIEWS).forEach((rect, index) => {
        const place = previewAt(
          testCase.layout,
          rect.left + rect.width / 2,
          rect.top + rect.height / 2,
        );
        const choice = startPictureChoice(COLORING_PICTURES, { now: () => 0 });
        expect(
          choice.tapPreview(place ?? -1),
          `${testCase.scene.label}: ${previewName(index)}`,
        ).toMatchObject({ kind: 'open', picture: COLORING_PICTURES[index] });
      });
    }
  });
});
