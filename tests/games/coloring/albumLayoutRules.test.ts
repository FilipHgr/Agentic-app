import { describe, expect, it } from 'vitest';

import { COLORING_GAME_AREA_FIT } from '../../../src/games/coloring/logic/coloringLayout';
import type { LayoutRect } from '../../../src/games/coloring/logic/coloringLayout';
import {
  albumPreviewAt,
  layoutAlbum,
  layoutPicker,
} from '../../../src/games/coloring/logic/pickerLayout';
import type { AlbumLayout, PickerLayout } from '../../../src/games/coloring/logic/pickerLayout';
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
import { PICKER_GRID_BEFORE_126 } from './layoutBefore126Fixture';
import { BOOK_BEFORE_132 } from './layoutBefore132Fixture';

/**
 * Testy k #126 AC6 (rozložení knihy na výběru a alba): pravidla v cyklu
 * pro všechna okna testů rozložení Omalovánek (`COLORING_WINDOWS`), jeden
 * test na pravidlo. Výběr a album mají stejnou herní plochu jako malování
 * (`COLORING_GAME_AREA_FIT`), domeček je prvek stránky a vyhrazené místo
 * je jeho plocha pro prst a 8 px kolem, jako v testech výběru (#124).
 *
 * Schválené obrázky (komentář k #126):
 * - kniha vpravo nahoře zrcadlově k domečku a stejně velká (otázka 5),
 * - od náhledů výběru aspoň 16 px, na telefonu na šířku (932×500,
 *   844×340, 932×430, 932×499) aspoň 8 px, mřížka výběru se nemění,
 * - album na šířku 4 × 3, na výšku 3 × 4 nebo 2 × 6 náhledů, nejmenší
 *   náhled 104 × 78 px.
 *
 * Od #132 (AC4) má výběr 12 míst a 11 náhledů. Kniha se měří proti 11
 * náhledům, které se kreslí (12. místo zůstane prázdné), s pravidly výše
 * (16 px, na telefonu na šířku 8 px) a zůstane na místě před #132.
 *
 * Navržené rozšíření `pickerLayout.ts` (herní jednotky):
 * - `PickerLayout.book: LayoutRect` kniha na výběru,
 * - `layoutAlbum(area: GameArea): AlbumLayout` s polem
 *   `previews: readonly LayoutRect[]` (12 míst od nejnovějšího obrázku,
 *   po řadách zleva doprava) a `cornerRadius`,
 * - `albumPreviewAt(layout: AlbumLayout, x, y): number | null` místo
 *   náhledu alba pod dotykem, `null` mimo náhledy a v mezerách.
 */

const BOOK_NAME = 'kniha';
const ALBUM_PLACES = 12;
/** Míst v mřížce výběru a omalovánek v sadě od #132. */
const PICKER_PLACES_SINCE_132 = 12;
const PICTURES_IN_SET = 11;
const MIN_PREVIEW_GAP = 16;
const PICTURE_ASPECT = 4 / 3;

/** Schválený nejmenší náhled alba (komentář k #126). */
const SMALLEST_ALBUM_PREVIEW = { width: 104, height: 78 };

/**
 * Okna, kde je kniha od náhledů výběru aspoň 8 px místo 16 px (úprava AC6
 * v komentáři k #126), podle rozměru okna.
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

function homeItem(home: Box): LayoutItem {
  return {
    name: HOME_NAME,
    box: {
      left: home.left - MIN_TAP_GAP,
      right: home.right + MIN_TAP_GAP,
      top: home.top - MIN_TAP_GAP,
      bottom: home.bottom + MIN_TAP_GAP,
    },
    reserved: true,
  };
}

interface ScreenCase {
  readonly window: TestWindow;
  readonly area: GameArea;
  readonly landscape: boolean;
  readonly visible: Box;
  readonly home: Box;
}

function screenCase(window: TestWindow): ScreenCase {
  const area = gameAreaFor(viewportOf(window), COLORING_GAME_AREA_FIT);
  return {
    window,
    area,
    landscape: isLandscapeArea(area),
    visible: visibleAreaOf(window, area),
    home: homeHitOf(window),
  };
}

interface PickerCase extends ScreenCase {
  readonly layout: PickerLayout;
  readonly previews: readonly Box[];
  readonly book: Box;
  readonly scene: LayoutScene;
}

function pickerCase(window: TestWindow): PickerCase {
  const base = screenCase(window);
  const layout = layoutPicker(base.area);
  const css = (rect: LayoutRect): Box => toCss(boxOfRect(rect), base.area);
  // Kreslí se jen náhledy omalovánek sady (#132: 11 z 12 míst).
  const previews = layout.previews.slice(0, PICTURES_IN_SET).map(css);
  const book = css(layout.book);
  const items: LayoutItem[] = [
    homeItem(base.home),
    ...previews.map((box, index) => ({ name: previewName(index), box, tappable: true })),
    { name: BOOK_NAME, box: book, tappable: true },
  ];
  return {
    ...base,
    layout,
    previews,
    book,
    scene: { label: `${window.name}, výběr s knihou`, free: base.visible, items },
  };
}

interface AlbumCase extends ScreenCase {
  readonly layout: AlbumLayout;
  readonly previews: readonly Box[];
  readonly scene: LayoutScene;
}

function albumCase(window: TestWindow): AlbumCase {
  const base = screenCase(window);
  const layout = layoutAlbum(base.area);
  const previews = layout.previews.map((rect) => toCss(boxOfRect(rect), base.area));
  const items: LayoutItem[] = [
    homeItem(base.home),
    ...previews.map((box, index) => ({ name: albumPreviewName(index), box, tappable: true })),
  ];
  return {
    ...base,
    layout,
    previews,
    scene: { label: `${window.name}, plné album`, free: base.visible, items },
  };
}

let pickerCached: PickerCase[] | undefined;
let albumCached: AlbumCase[] | undefined;

function pickerCases(): PickerCase[] {
  pickerCached ??= COLORING_WINDOWS.map(pickerCase);
  return pickerCached;
}

function albumCases(): AlbumCase[] {
  albumCached ??= COLORING_WINDOWS.map(albumCase);
  return albumCached;
}

/** Kolik různých hodnot má seznam (se zaokrouhlením na desetiny px). */
function distinct(values: readonly number[]): number {
  return new Set(values.map((value) => Math.round(value * 10))).size;
}

describe('#126 AC6: výběr s knihou dodrží společná pravidla rozložení', () => {
  for (const [ruleName, rule] of Object.entries(LAYOUT_RULES)) {
    it(`${ruleName} ve všech oknech i s knihou`, () => {
      for (const testCase of pickerCases()) {
        expect(rule(testCase.scene), testCase.scene.label).toEqual([]);
      }
    });
  }
});

describe('#126 AC6: kniha na výběru', () => {
  it('kniha má aspoň 64 × 64 px', () => {
    for (const testCase of pickerCases()) {
      const what = testCase.scene.label;
      expect(widthOf(testCase.book), `${what}, šířka`).toBeGreaterThanOrEqual(MIN_TAP_SIDE - 0.01);
      expect(heightOf(testCase.book), `${what}, výška`).toBeGreaterThanOrEqual(MIN_TAP_SIDE - 0.01);
    }
  });

  it('kniha je uvnitř bezpečné plochy', () => {
    for (const testCase of pickerCases()) {
      expect(isInside(testCase.book, testCase.visible), testCase.scene.label).toBe(true);
    }
  });

  it('kniha nepřekrývá domeček a 8 px kolem něj', () => {
    for (const testCase of pickerCases()) {
      expect(gapBetween(testCase.book, testCase.home), testCase.scene.label).toBeGreaterThanOrEqual(
        MIN_TAP_GAP - 0.01,
      );
    }
  });

  it('kniha je od všech 11 náhledů výběru aspoň 16 px, na telefonu na šířku aspoň 8 px (#126, #132 AC4)', () => {
    for (const testCase of pickerCases()) {
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

  it('kniha je mimo mřížku: ťuknutí na knihu nepatří žádnému náhledu', () => {
    for (const testCase of pickerCases()) {
      const rect = testCase.layout.book;
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      expect(testCase.layout.previews.length, testCase.scene.label).toBe(PICKER_PLACES_SINCE_132);
      // Náhledy dál hledá `previewAt` z #124; kniha mezi nimi není.
      expect(
        testCase.layout.previews.some(
          (preview) =>
            centerX >= preview.left &&
            centerX < preview.left + preview.width &&
            centerY >= preview.top &&
            centerY < preview.top + preview.height,
        ),
        testCase.scene.label,
      ).toBe(false);
    }
  });

  it('kniha je vpravo nahoře zrcadlově k domečku a stejně velká (otázka 5)', () => {
    for (const testCase of pickerCases()) {
      const what = testCase.scene.label;
      const homeInset = testCase.home.left - testCase.visible.left;
      expect(widthOf(testCase.book), `${what}, šířka`).toBeCloseTo(widthOf(testCase.home), 1);
      expect(heightOf(testCase.book), `${what}, výška`).toBeCloseTo(heightOf(testCase.home), 1);
      expect(testCase.book.top, `${what}, ve výšce domečku`).toBeCloseTo(testCase.home.top, 1);
      expect(
        testCase.visible.right - testCase.book.right,
        `${what}, od pravého okraje`,
      ).toBeCloseTo(homeInset, 1);
    }
  });

  it('pevná tabulka mřížky výběru před #126 má všechna okna Omalovánek', () => {
    expect(PICKER_GRID_BEFORE_126.map(([name]) => name)).toEqual(
      COLORING_WINDOWS.map((window) => window.name),
    );
  });

  // Do #132 tu byl test „mřížka výběru zůstane s knihou stejná jako před #126“
  // (tabulka PICKER_GRID_BEFORE_126). #132 mřížku výběru záměrně mění na 12
  // míst; náhradou je pevné místo knihy před #132 (BOOK_BEFORE_132) níž
  // a pravidla mřížky v pickerLayoutRules.test.ts.
  it('pevná tabulka místa knihy před #132 má všechna okna Omalovánek', () => {
    expect(BOOK_BEFORE_132.map(([name]) => name)).toEqual(
      COLORING_WINDOWS.map((window) => window.name),
    );
  });

  it('#132 AC4: kniha zůstane s mřížkou pro 11 omalovánek na svém místě jako před #132', () => {
    const before = new Map(BOOK_BEFORE_132.map((row) => [row[0], row]));
    for (const testCase of pickerCases()) {
      const row = before.get(testCase.window.name);
      if (row === undefined) {
        throw new Error(`${testCase.scene.label}: chybí místo knihy`);
      }
      const [, left, top, right, bottom] = row;
      const what = testCase.scene.label;
      expect(testCase.book.left, `${what}: levý okraj knihy`).toBeCloseTo(left, 2);
      expect(testCase.book.top, `${what}: horní okraj knihy`).toBeCloseTo(top, 2);
      expect(testCase.book.right, `${what}: pravý okraj knihy`).toBeCloseTo(right, 2);
      expect(testCase.book.bottom, `${what}: spodní okraj knihy`).toBeCloseTo(bottom, 2);
    }
  });
});

describe('#126 AC6: plné album dodrží společná pravidla rozložení', () => {
  it('album má 12 míst pro náhledy ve všech oknech', () => {
    for (const testCase of albumCases()) {
      expect(testCase.previews.length, testCase.scene.label).toBe(ALBUM_PLACES);
    }
  });

  for (const [ruleName, rule] of Object.entries(LAYOUT_RULES)) {
    it(`${ruleName} ve všech oknech v plném albu`, () => {
      for (const testCase of albumCases()) {
        expect(rule(testCase.scene), testCase.scene.label).toEqual([]);
      }
    });
  }
});

describe('#126 AC6: 12 náhledů alba se vejde bez posouvání', () => {
  it('všech 12 náhledů je uvnitř bezpečné plochy', () => {
    for (const testCase of albumCases()) {
      testCase.previews.forEach((preview, index) => {
        expect(
          isInside(preview, testCase.visible),
          `${testCase.scene.label}: ${albumPreviewName(index)}`,
        ).toBe(true);
      });
    }
  });

  it('náhledy alba nepřekrývají domeček a 8 px kolem něj', () => {
    for (const testCase of albumCases()) {
      testCase.previews.forEach((preview, index) => {
        expect(
          gapBetween(preview, testCase.home),
          `${testCase.scene.label}: ${albumPreviewName(index)} a domeček`,
        ).toBeGreaterThanOrEqual(MIN_TAP_GAP - 0.01);
      });
    }
  });

  it('každý náhled alba má aspoň 64 × 64 px', () => {
    for (const testCase of albumCases()) {
      testCase.previews.forEach((preview, index) => {
        const what = `${testCase.scene.label}: ${albumPreviewName(index)}`;
        expect(widthOf(preview), `${what}, šířka`).toBeGreaterThanOrEqual(MIN_TAP_SIDE - 0.01);
        expect(heightOf(preview), `${what}, výška`).toBeGreaterThanOrEqual(MIN_TAP_SIDE - 0.01);
      });
    }
  });

  it('každý náhled alba je aspoň tak velký jako nejmenší schválený 104 × 78 px', () => {
    for (const testCase of albumCases()) {
      testCase.previews.forEach((preview, index) => {
        const what = `${testCase.scene.label}: ${albumPreviewName(index)}`;
        expect(widthOf(preview), `${what}, šířka`).toBeGreaterThanOrEqual(
          SMALLEST_ALBUM_PREVIEW.width - 0.5,
        );
        expect(heightOf(preview), `${what}, výška`).toBeGreaterThanOrEqual(
          SMALLEST_ALBUM_PREVIEW.height - 0.5,
        );
      });
    }
  });

  it('mezi náhledy alba je mezera aspoň 16 px', () => {
    for (const testCase of albumCases()) {
      testCase.previews.forEach((first, index) => {
        testCase.previews.slice(index + 1).forEach((second, offset) => {
          expect(
            gapBetween(first, second),
            `${testCase.scene.label}: ${albumPreviewName(index)} a ${albumPreviewName(index + offset + 1)}`,
          ).toBeGreaterThanOrEqual(MIN_PREVIEW_GAP - 0.01);
        });
      });
    }
  });

  it('náhledy alba mají poměr stran 4 : 3 a jsou stejně velké', () => {
    for (const testCase of albumCases()) {
      testCase.previews.forEach((preview, index) => {
        expect(
          widthOf(preview) / heightOf(preview),
          `${testCase.scene.label}: ${albumPreviewName(index)}`,
        ).toBeCloseTo(PICTURE_ASPECT, 2);
      });
      expect(distinct(testCase.previews.map(widthOf)), testCase.scene.label).toBe(1);
    }
  });
});

describe('#126 AC6 (schválené obrázky): album na šířku 4 × 3, na výšku 3 × 4 nebo 2 × 6', () => {
  it('na šířku jsou náhledy alba ve 4 sloupcích a 3 řadách', () => {
    for (const testCase of albumCases().filter((each) => each.landscape)) {
      const { previews } = testCase;
      expect(distinct(previews.map((preview) => preview.left)), testCase.scene.label).toBe(4);
      expect(distinct(previews.map((preview) => preview.top)), testCase.scene.label).toBe(3);
    }
  });

  it('na výšku jsou náhledy alba ve 3 sloupcích a 4 řadách, nebo ve 2 sloupcích a 6 řadách', () => {
    for (const testCase of albumCases().filter((each) => !each.landscape)) {
      const { previews } = testCase;
      const shape = [
        distinct(previews.map((preview) => preview.left)),
        distinct(previews.map((preview) => preview.top)),
      ];
      expect(
        [
          [3, 4],
          [2, 6],
        ],
        testCase.scene.label,
      ).toContainEqual(shape);
    }
  });

  it('náhledy alba jdou po řadách zleva doprava, od nejnovějšího', () => {
    for (const testCase of albumCases()) {
      testCase.previews.forEach((preview, index) => {
        const previous = testCase.previews[index - 1];
        if (previous === undefined) {
          return;
        }
        const what = `${testCase.scene.label}: ${albumPreviewName(index)}`;
        const sameRow = Math.abs(preview.top - previous.top) < 0.1;
        if (sameRow) {
          expect(preview.left, `${what} vpravo od předchozího`).toBeGreaterThan(previous.left);
        } else {
          expect(preview.top, `${what} začíná novou řadu`).toBeGreaterThan(previous.top);
        }
      });
    }
  });
});

describe('#126 AC4: ťuknutí v albu patří náhledu jen na náhledu', () => {
  it('ťuknutí doprostřed náhledu alba patří tomu náhledu', () => {
    for (const testCase of albumCases()) {
      testCase.layout.previews.forEach((rect, index) => {
        expect(
          albumPreviewAt(testCase.layout, rect.left + rect.width / 2, rect.top + rect.height / 2),
          `${testCase.scene.label}: ${albumPreviewName(index)}`,
        ).toBe(index);
      });
    }
  });

  it('ťuknutí do mezery mezi náhledy alba a do rohů obrazovky nepatří žádnému náhledu', () => {
    for (const testCase of albumCases()) {
      const { layout, area } = testCase;
      const first = layout.previews[0];
      const second = layout.previews[1];
      if (first === undefined || second === undefined) {
        throw new Error(`${testCase.scene.label}: chybí náhledy alba`);
      }
      const points: ReadonlyArray<readonly [string, number, number]> = [
        ['mezera mezi náhledem 1 a 2', (first.left + first.width + second.left) / 2, first.top + 1],
        ['levý horní roh', 0, 0],
        ['pravý dolní roh', area.width - 0.5, area.height - 0.5],
        ['mimo plochu', -10, -10],
      ];
      for (const [name, x, y] of points) {
        expect(albumPreviewAt(layout, x, y), `${testCase.scene.label}: ${name}`).toBeNull();
      }
    }
  });
});
