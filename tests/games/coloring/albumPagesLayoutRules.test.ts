import { describe, expect, it } from 'vitest';

import { COLORING_GAME_AREA_FIT } from '../../../src/games/coloring/logic/coloringLayout';
import type { LayoutRect } from '../../../src/games/coloring/logic/coloringLayout';
import {
  albumArrowAt,
  albumPreviewAt,
  layoutAlbum,
  layoutPicker,
} from '../../../src/games/coloring/logic/pickerLayout';
import type { AlbumLayout } from '../../../src/games/coloring/logic/pickerLayout';
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
import { ALBUM_GRID_BEFORE_129 } from './layoutBefore129Fixture';
import { ALBUM_PREVIEW_BEFORE_149 } from './layoutBefore149Fixture';

/**
 * Testy k #149 AC6 (rozložení alba se šipkami ◀ ▶): pravidla v cyklu pro
 * všechna okna testů rozložení Omalovánek (`COLORING_WINDOWS`), jeden test
 * na pravidlo. Album má stejnou herní plochu jako malování
 * (`COLORING_GAME_AREA_FIT`), domeček je prvek stránky, jako v testech
 * rozložení alba z #126 (`albumLayoutRules.test.ts`).
 *
 * Pravidla ze zadání:
 * - šipky mají aspoň 64 × 64 px a jsou uvnitř bezpečné plochy,
 * - od náhledů, knihy a domečku jsou aspoň 16 px,
 * - náhledy mají stejnou velikost jako dnes (pevná tabulka před #149).
 *
 * Kniha na obrazovce alba dnes není (scéna ji s výběrem schová); měří se
 * proti jejímu místu na výběru (`layoutPicker(area).book`), aby šipka
 * nebyla tam, kde dítě čeká knihu. Kde šipky přesně jsou („po stranách“),
 * zadání nepředepisuje, testy ho proto nehlídají kromě toho, že ◀ je vlevo
 * od ▶.
 *
 * Navržené rozšíření `pickerLayout.ts` (herní jednotky):
 * - `AlbumLayout.previousArrow: LayoutRect` šipka ◀ a
 *   `AlbumLayout.nextArrow: LayoutRect` šipka ▶ (scéna je kreslí jen při
 *   víc stránkách),
 * - `albumArrowAt(layout: AlbumLayout, x, y): 'previous' | 'next' | null`
 *   šipka pod dotykem, `null` mimo šipky.
 */

const MIN_ARROW_GAP = 16;
const ALBUM_PLACES = 12;
const PREVIOUS_NAME = 'šipka ◀';
const NEXT_NAME = 'šipka ▶';
const BOOK_NAME = 'místo knihy';

function albumPreviewName(index: number): string {
  return `obrázek alba ${index + 1}`;
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

interface ArrowsCase {
  readonly window: TestWindow;
  readonly layout: AlbumLayout;
  readonly visible: Box;
  readonly home: Box;
  readonly book: Box;
  readonly previews: readonly Box[];
  readonly arrows: ReadonlyArray<readonly [string, Box]>;
  readonly scene: LayoutScene;
}

function arrowsCase(window: TestWindow): ArrowsCase {
  const area = gameAreaFor(viewportOf(window), COLORING_GAME_AREA_FIT);
  const layout = layoutAlbum(area);
  const css = (rect: LayoutRect): Box => toCss(boxOfRect(rect), area);
  const visible = visibleAreaOf(window, area);
  const home = homeHitOf(window);
  const previews = layout.previews.map(css);
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
    ...previews.map((box, index) => ({ name: albumPreviewName(index), box, tappable: true })),
    ...arrows.map(([name, box]) => ({ name, box, tappable: true })),
  ];
  return {
    window,
    layout,
    visible,
    home,
    book: css(layoutPicker(area).book),
    previews,
    arrows,
    scene: { label: `${window.name}, plné album se šipkami`, free: visible, items },
  };
}

let cached: ArrowsCase[] | undefined;

function arrowsCases(): ArrowsCase[] {
  cached ??= COLORING_WINDOWS.map(arrowsCase);
  return cached;
}

describe('#149 AC6: album se šipkami dodrží společná pravidla rozložení', () => {
  for (const [ruleName, rule] of Object.entries(LAYOUT_RULES)) {
    it(`${ruleName} ve všech oknech v plném albu se šipkami`, () => {
      for (const testCase of arrowsCases()) {
        expect(rule(testCase.scene), testCase.scene.label).toEqual([]);
      }
    });
  }
});

describe('#149 AC6: šipky ◀ ▶ v albu', () => {
  it('šipky mají aspoň 64 × 64 px', () => {
    for (const testCase of arrowsCases()) {
      for (const [name, box] of testCase.arrows) {
        const what = `${testCase.scene.label}: ${name}`;
        expect(widthOf(box), `${what}, šířka`).toBeGreaterThanOrEqual(MIN_TAP_SIDE - 0.01);
        expect(heightOf(box), `${what}, výška`).toBeGreaterThanOrEqual(MIN_TAP_SIDE - 0.01);
      }
    }
  });

  it('šipky jsou uvnitř bezpečné plochy', () => {
    for (const testCase of arrowsCases()) {
      for (const [name, box] of testCase.arrows) {
        expect(isInside(box, testCase.visible), `${testCase.scene.label}: ${name}`).toBe(true);
      }
    }
  });

  it('šipky jsou od všech 12 náhledů aspoň 16 px', () => {
    for (const testCase of arrowsCases()) {
      for (const [name, box] of testCase.arrows) {
        testCase.previews.forEach((preview, index) => {
          expect(
            gapBetween(box, preview),
            `${testCase.scene.label}: ${name} a ${albumPreviewName(index)}`,
          ).toBeGreaterThanOrEqual(MIN_ARROW_GAP - 0.01);
        });
      }
    }
  });

  it('šipky jsou od knihy aspoň 16 px', () => {
    for (const testCase of arrowsCases()) {
      for (const [name, box] of testCase.arrows) {
        expect(
          gapBetween(box, testCase.book),
          `${testCase.scene.label}: ${name} a ${BOOK_NAME}`,
        ).toBeGreaterThanOrEqual(MIN_ARROW_GAP - 0.01);
      }
    }
  });

  it('šipky jsou od domečku aspoň 16 px', () => {
    for (const testCase of arrowsCases()) {
      for (const [name, box] of testCase.arrows) {
        expect(
          gapBetween(box, testCase.home),
          `${testCase.scene.label}: ${name} a domeček`,
        ).toBeGreaterThanOrEqual(MIN_ARROW_GAP - 0.01);
      }
    }
  });

  it('šipka ◀ je vlevo od šipky ▶', () => {
    for (const testCase of arrowsCases()) {
      const [[, previous], [, next]] = testCase.arrows as [
        readonly [string, Box],
        readonly [string, Box],
      ];
      expect(previous.right, testCase.scene.label).toBeLessThanOrEqual(next.left + 0.01);
    }
  });

  it('ťuknutí doprostřed šipky patří šipce a žádnému náhledu', () => {
    for (const testCase of arrowsCases()) {
      const { layout } = testCase;
      const rects: ReadonlyArray<readonly [string, LayoutRect, 'previous' | 'next']> = [
        [PREVIOUS_NAME, layout.previousArrow, 'previous'],
        [NEXT_NAME, layout.nextArrow, 'next'],
      ];
      for (const [name, rect, direction] of rects) {
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        const what = `${testCase.scene.label}: ${name}`;
        expect(albumArrowAt(layout, x, y), what).toBe(direction);
        expect(albumPreviewAt(layout, x, y), `${what} není náhled`).toBeNull();
      }
    }
  });

  it('ťuknutí doprostřed náhledu nepatří žádné šipce', () => {
    for (const testCase of arrowsCases()) {
      testCase.layout.previews.forEach((rect, index) => {
        expect(
          albumArrowAt(testCase.layout, rect.left + rect.width / 2, rect.top + rect.height / 2),
          `${testCase.scene.label}: ${albumPreviewName(index)}`,
        ).toBeNull();
      });
    }
  });
});

describe('#149 AC6: náhledy alba mají stejnou velikost jako dnes', () => {
  it('pevná tabulka náhledů alba před #149 má všechna okna Omalovánek', () => {
    expect(ALBUM_PREVIEW_BEFORE_149.map(([name]) => name)).toEqual(
      COLORING_WINDOWS.map((window) => window.name),
    );
  });

  it('na stránce alba je 12 míst a každý náhled je stejně velký jako před #149', () => {
    const before = new Map(ALBUM_PREVIEW_BEFORE_149.map((row) => [row[0], row]));
    // Se šipkami: náhledy jsou stejně velké i tam, kde se kvůli šipkám mřížka posune.
    for (const window of COLORING_WINDOWS) {
      const row = before.get(window.name);
      if (row === undefined) {
        throw new Error(`${window.name}: chybí velikost náhledu`);
      }
      const [, width, height] = row;
      const area = gameAreaFor(viewportOf(window), COLORING_GAME_AREA_FIT);
      const previews = layoutAlbum(area).previews.map((rect) => toCss(boxOfRect(rect), area));
      expect(previews.length, `${window.name}: míst`).toBe(ALBUM_PLACES);
      previews.forEach((preview, index) => {
        const what = `${window.name}: ${albumPreviewName(index)}`;
        expect(widthOf(preview), `${what}, šířka`).toBeCloseTo(width, 2);
        expect(heightOf(preview), `${what}, výška`).toBeCloseTo(height, 2);
      });
    }
  });
});

// #158 AC1: vizuální kontrolu „pixel po pixelu“ z #149 AC3 nahrazuje pravidlo
// stejného místa a velikosti náhledů po #149 pro 1 až 60 obrázků
// (`albumBookLayoutRules.test.ts`). Míra z tabulky #129 tady zůstává.
describe('#149 AC1, AC3: album s jedinou stránkou je jako dnes a nemá šipky', () => {
  it('při 12 obrázcích je mřížka na místě z tabulky #129 a šipky nejsou', () => {
    const before = new Map(ALBUM_GRID_BEFORE_129.map((row) => [row[0], row]));
    for (const window of COLORING_WINDOWS) {
      const row = before.get(window.name);
      if (row === undefined) {
        throw new Error(`${window.name}: chybí míra alba`);
      }
      const [, left, top, right, bottom] = row;
      const area = gameAreaFor(viewportOf(window), COLORING_GAME_AREA_FIT);
      const layout = layoutAlbum(area, { pictureCount: 12 });
      const previews = layout.previews.map((rect) => toCss(boxOfRect(rect), area));
      const first = previews[0];
      const last = previews[11];
      if (first === undefined || last === undefined) {
        throw new Error(`${window.name}: chybí náhledy alba`);
      }
      expect(first.left, `${window.name}: levý okraj`).toBeCloseTo(left, 2);
      expect(first.top, `${window.name}: horní okraj`).toBeCloseTo(top, 2);
      expect(last.right, `${window.name}: pravý okraj`).toBeCloseTo(right, 2);
      expect(last.bottom, `${window.name}: spodní okraj`).toBeCloseTo(bottom, 2);
      expect(layout.arrows, `${window.name}: šipky nejsou`).toBe(false);
      for (const arrow of [layout.previousArrow, layout.nextArrow]) {
        const x = arrow.left + arrow.width / 2;
        const y = arrow.top + arrow.height / 2;
        expect(albumArrowAt(layout, x, y), `${window.name}: ťuknutí na místo šipky`).toBeNull();
      }
    }
  });

  it('při 13 obrázcích (2 stránky) šipky jsou', () => {
    for (const window of COLORING_WINDOWS) {
      const area = gameAreaFor(viewportOf(window), COLORING_GAME_AREA_FIT);
      expect(layoutAlbum(area, { pictureCount: 13 }).arrows, window.name).toBe(true);
    }
  });
});
