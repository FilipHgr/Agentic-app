import { describe, expect, it } from 'vitest';

import {
  COLORING_GAME_AREA_FIT,
  layoutColoring,
} from '../../../src/games/coloring/logic/coloringLayout';
import type { LayoutRect } from '../../../src/games/coloring/logic/coloringLayout';
import {
  bigPictureTrashAt,
  layoutAlbum,
  layoutBigPicture,
} from '../../../src/games/coloring/logic/pickerLayout';
import type { BigPictureLayout } from '../../../src/games/coloring/logic/pickerLayout';
import { homeButtonFor } from '../../../src/shared/logic/homeButton';
import { gameAreaFor } from '../../../src/shared/logic/viewportLayout';
import type { GameArea } from '../../../src/shared/logic/viewportLayout';
import {
  LAYOUT_RULES,
  MIN_EDGE_DISTANCE,
  MIN_TAP_GAP,
  MIN_TAP_SIDE,
} from '../../shared/layoutRules';
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
import {
  COLORING_WINDOWS,
  HOME_NAME,
  PICTURE_EDGE_EXCEPTION,
  boxOfRect,
  isLandscapeArea,
} from './coloringLayoutScenes';
import { ALBUM_GRID_BEFORE_129 } from './layoutBefore129Fixture';
import { PICTURE_BEFORE_142, PICTURE_MAY_MOVE_IN } from './layoutBefore142Fixture';

/**
 * Testy k #129 AC6 (rozložení velkého obrázku a koše): pravidla v cyklu
 * pro všechna okna testů rozložení Omalovánek (`COLORING_WINDOWS`), jeden
 * test na pravidlo. Velký obrázek má stejnou herní plochu jako malování
 * (`COLORING_GAME_AREA_FIT`), domeček je prvek stránky a vyhrazené místo
 * je jeho plocha pro prst a 8 px kolem, jako v testech alba (#126).
 *
 * Schválené obrázky (komentář k #129):
 * - koš 🗑️ je na místě fotoaparátu z rozložení malování (na šířku vlevo
 *   dole, na výšku vpravo nahoře),
 * - velký obrázek má stejnou velikost jako obrázek v malování; na šířku se
 *   podle potřeby posune doprava, aby byl od koše aspoň 16 px (na iPadu
 *   1180 × 820 o 8 px), na výšku je na stejném místě.
 *
 * Na šířku smí obrázek sahat k hornímu a dolnímu okraji jako v malování
 * (#111 AC4, `PICTURE_EDGE_EXCEPTION`).
 *
 * Navržené rozhraní `pickerLayout.ts` (herní jednotky):
 * - `layoutBigPicture(area: GameArea): BigPictureLayout` s poli
 *   `picture: LayoutRect` (velký obrázek) a `trash: LayoutRect` (koš),
 * - `bigPictureTrashAt(layout, x, y): boolean` trefil dotyk koš?
 */

const PICTURE_NAME = 'velký obrázek';
const TRASH_NAME = 'koš';
const MIN_TRASH_GAP = 16;
const PICTURE_ASPECT = 4 / 3;

/** Okno se schváleným posunem obrázku (komentář k #129): iPad 1180 × 820 o 8 px. */
const IPAD_SHIFT_WINDOW = 'iPad 1180×820';
const IPAD_SHIFT_CSS = 8;

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

interface BigPictureCase {
  readonly window: TestWindow;
  readonly area: GameArea;
  readonly landscape: boolean;
  readonly layout: BigPictureLayout;
  readonly visible: Box;
  readonly home: Box;
  readonly picture: Box;
  readonly trash: Box;
  /** Obrázek a fotoaparát v malování ve stejném okně. */
  readonly paintingPicture: Box;
  readonly camera: Box;
  readonly scene: LayoutScene;
}

/**
 * Obrázek v malování, jak byl před koštětem (#142): velký obrázek koště
 * nemá a kvůli němu se neposouvá. Malování se od #142 AC6 posune jen
 * v okně `PICTURE_MAY_MOVE_IN`, tam platí pevná míra před #142.
 */
function paintingPictureBefore142(
  window: TestWindow,
  picture: LayoutRect,
  css: (rect: LayoutRect) => Box,
): Box {
  const before = PICTURE_BEFORE_142.find(([name]) => name === window.name);
  if (window.name !== PICTURE_MAY_MOVE_IN || before === undefined) {
    return css(picture);
  }
  const [, left, top, width, height] = before;
  return { left, top, right: left + width, bottom: top + height };
}

function bigPictureCase(window: TestWindow): BigPictureCase {
  const area = gameAreaFor(viewportOf(window), COLORING_GAME_AREA_FIT);
  const css = (rect: LayoutRect): Box => toCss(boxOfRect(rect), area);
  const layout = layoutBigPicture(area);
  const painting = layoutColoring(area);
  const landscape = isLandscapeArea(area);
  const visible = visibleAreaOf(window, area);
  const home = homeHitOf(window);
  const picture = css(layout.picture);
  const trash = css(layout.trash);
  const pictureItem: LayoutItem = landscape
    ? { name: PICTURE_NAME, box: picture, minEdge: PICTURE_EDGE_EXCEPTION }
    : { name: PICTURE_NAME, box: picture };
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
    pictureItem,
    { name: TRASH_NAME, box: trash, tappable: true },
  ];
  return {
    window,
    area,
    landscape,
    layout,
    visible,
    home,
    picture,
    trash,
    paintingPicture: paintingPictureBefore142(window, painting.picture, css),
    camera: css(painting.cameraButton),
    scene: { label: `${window.name}, velký obrázek`, free: visible, items },
  };
}

let cached: BigPictureCase[] | undefined;

function cases(): BigPictureCase[] {
  cached ??= COLORING_WINDOWS.map(bigPictureCase);
  return cached;
}

describe('#129 AC6: velký obrázek s košem dodrží společná pravidla rozložení', () => {
  for (const [ruleName, rule] of Object.entries(LAYOUT_RULES)) {
    it(`${ruleName} ve všech oknech na velkém obrázku`, () => {
      for (const testCase of cases()) {
        expect(rule(testCase.scene), testCase.scene.label).toEqual([]);
      }
    });
  }
});

describe('#129 AC6: velký obrázek', () => {
  it('velký obrázek se neotáčí: leží rovně s poměrem stran 4 : 3', () => {
    for (const testCase of cases()) {
      expect(
        widthOf(testCase.picture) / heightOf(testCase.picture),
        testCase.scene.label,
      ).toBeCloseTo(PICTURE_ASPECT, 2);
    }
  });

  it('velký obrázek je celý uvnitř bezpečné plochy', () => {
    for (const testCase of cases()) {
      expect(isInside(testCase.picture, testCase.visible), testCase.scene.label).toBe(true);
    }
  });

  it('velký obrázek nepřekrývá domeček ani 8 px kolem něj', () => {
    for (const testCase of cases()) {
      expect(
        gapBetween(testCase.picture, testCase.home),
        testCase.scene.label,
      ).toBeGreaterThanOrEqual(MIN_TAP_GAP - 0.01);
    }
  });

  it('velký obrázek je v každém okně aspoň tak velký jako obrázek v malování', () => {
    for (const testCase of cases()) {
      const what = testCase.scene.label;
      expect(widthOf(testCase.picture), `${what}, šířka`).toBeGreaterThanOrEqual(
        widthOf(testCase.paintingPicture) - 0.01,
      );
      expect(heightOf(testCase.picture), `${what}, výška`).toBeGreaterThanOrEqual(
        heightOf(testCase.paintingPicture) - 0.01,
      );
    }
  });

  it('velký obrázek je stejně velký jako obrázek v malování (schválené obrázky)', () => {
    for (const testCase of cases()) {
      const what = testCase.scene.label;
      expect(widthOf(testCase.picture), `${what}, šířka`).toBeCloseTo(
        widthOf(testCase.paintingPicture),
        1,
      );
      expect(heightOf(testCase.picture), `${what}, výška`).toBeCloseTo(
        heightOf(testCase.paintingPicture),
        1,
      );
    }
  });

  it('na výšku je velký obrázek na stejném místě jako obrázek v malování', () => {
    for (const testCase of cases().filter((each) => !each.landscape)) {
      const what = testCase.scene.label;
      expect(testCase.picture.left, `${what}, vlevo`).toBeCloseTo(testCase.paintingPicture.left, 1);
      expect(testCase.picture.top, `${what}, nahoře`).toBeCloseTo(testCase.paintingPicture.top, 1);
    }
  });

  it('na šířku se velký obrázek proti malování jen posune doprava, a jen když je u koše blíž než 16 px', () => {
    for (const testCase of cases().filter((each) => each.landscape)) {
      const what = testCase.scene.label;
      const shift = testCase.picture.left - testCase.paintingPicture.left;
      expect(testCase.picture.top, `${what}, ve stejné výšce`).toBeCloseTo(
        testCase.paintingPicture.top,
        1,
      );
      expect(shift, `${what}, posun jen doprava`).toBeGreaterThanOrEqual(-0.01);
      if (shift > 0.01) {
        expect(
          gapBetween(testCase.picture, testCase.trash),
          `${what}, posun jen tak velký, aby byl od koše 16 px`,
        ).toBeCloseTo(MIN_TRASH_GAP, 1);
      }
    }
  });

  it('na iPadu 1180 × 820 se velký obrázek posune o 8 px doprava (schválené obrázky)', () => {
    const ipad = cases().filter((each) => each.window.name === IPAD_SHIFT_WINDOW);
    expect(ipad.length, 'okno iPadu 1180 × 820 je mezi okny Omalovánek').toBe(1);
    for (const testCase of ipad) {
      expect(
        testCase.picture.left - testCase.paintingPicture.left,
        testCase.scene.label,
      ).toBeCloseTo(IPAD_SHIFT_CSS, 1);
    }
  });
});

describe('#129 AC6: koš', () => {
  it('koš má aspoň 64 × 64 px', () => {
    for (const testCase of cases()) {
      const what = testCase.scene.label;
      expect(widthOf(testCase.trash), `${what}, šířka`).toBeGreaterThanOrEqual(MIN_TAP_SIDE - 0.01);
      expect(heightOf(testCase.trash), `${what}, výška`).toBeGreaterThanOrEqual(
        MIN_TAP_SIDE - 0.01,
      );
    }
  });

  it('koš je uvnitř bezpečné plochy aspoň 4 px od okraje', () => {
    for (const testCase of cases()) {
      const { visible } = testCase;
      const inner: Box = {
        left: visible.left + MIN_EDGE_DISTANCE,
        right: visible.right - MIN_EDGE_DISTANCE,
        top: visible.top + MIN_EDGE_DISTANCE,
        bottom: visible.bottom - MIN_EDGE_DISTANCE,
      };
      expect(isInside(testCase.trash, inner), testCase.scene.label).toBe(true);
    }
  });

  it('koš je od velkého obrázku aspoň 16 px', () => {
    for (const testCase of cases()) {
      expect(
        gapBetween(testCase.trash, testCase.picture),
        testCase.scene.label,
      ).toBeGreaterThanOrEqual(MIN_TRASH_GAP - 0.01);
    }
  });

  it('koš je od domečku aspoň 16 px, takže nepřekrývá ani 8 px kolem něj', () => {
    for (const testCase of cases()) {
      expect(
        gapBetween(testCase.trash, testCase.home),
        testCase.scene.label,
      ).toBeGreaterThanOrEqual(MIN_TRASH_GAP - 0.01);
    }
  });

  it('koš je na místě fotoaparátu z malování (schválené obrázky)', () => {
    for (const testCase of cases()) {
      const what = testCase.scene.label;
      expect(testCase.trash.left, `${what}, vlevo`).toBeCloseTo(testCase.camera.left, 1);
      expect(testCase.trash.top, `${what}, nahoře`).toBeCloseTo(testCase.camera.top, 1);
      expect(widthOf(testCase.trash), `${what}, šířka`).toBeCloseTo(widthOf(testCase.camera), 1);
      expect(heightOf(testCase.trash), `${what}, výška`).toBeCloseTo(heightOf(testCase.camera), 1);
    }
  });
});

describe('#129 AC5: ťuknutí na velkém obrázku patří koši jen na koši', () => {
  it('ťuknutí doprostřed koše trefí koš, ťuknutí na velký obrázek a do rohů obrazovky ne', () => {
    for (const testCase of cases()) {
      const { layout, area } = testCase;
      const { trash, picture } = layout;
      const what = testCase.scene.label;
      expect(
        bigPictureTrashAt(layout, trash.left + trash.width / 2, trash.top + trash.height / 2),
        `${what}: střed koše`,
      ).toBe(true);
      const misses: ReadonlyArray<readonly [string, number, number]> = [
        [
          'střed velkého obrázku',
          picture.left + picture.width / 2,
          picture.top + picture.height / 2,
        ],
        ['levý horní roh obrázku', picture.left + 1, picture.top + 1],
        ['pravý dolní roh obrazovky', area.width - 0.5, area.height - 0.5],
        ['mimo plochu', -10, -10],
      ];
      for (const [name, x, y] of misses) {
        expect(bigPictureTrashAt(layout, x, y), `${what}: ${name}`).toBe(false);
      }
    }
  });
});

describe('#129 AC6: album z #126 zůstane beze změny', () => {
  it('pevná tabulka alba před #129 má všechna okna Omalovánek', () => {
    expect(ALBUM_GRID_BEFORE_129.map(([name]) => name)).toEqual(
      COLORING_WINDOWS.map((window) => window.name),
    );
  });

  it('náhledy alba jsou na stejném místě a stejně velké jako před #129', () => {
    const before = new Map(ALBUM_GRID_BEFORE_129.map((row) => [row[0], row]));
    for (const window of COLORING_WINDOWS) {
      const area = gameAreaFor(viewportOf(window), COLORING_GAME_AREA_FIT);
      const previews = layoutAlbum(area).previews.map((rect) => toCss(boxOfRect(rect), area));
      const row = before.get(window.name);
      const first = previews[0];
      const last = previews[11];
      if (row === undefined || first === undefined || last === undefined) {
        throw new Error(`${window.name}: chybí míra nebo náhled alba`);
      }
      const [, left, top, right, bottom, width, height] = row;
      const what = `${window.name}, album`;
      expect(previews.length, `${what}: počet míst`).toBe(12);
      expect(first.left, `${what}: levý okraj`).toBeCloseTo(left, 2);
      expect(first.top, `${what}: horní okraj`).toBeCloseTo(top, 2);
      expect(last.right, `${what}: pravý okraj`).toBeCloseTo(right, 2);
      expect(last.bottom, `${what}: spodní okraj`).toBeCloseTo(bottom, 2);
      expect(widthOf(first), `${what}: šířka náhledu`).toBeCloseTo(width, 2);
      expect(heightOf(first), `${what}: výška náhledu`).toBeCloseTo(height, 2);
    }
  });
});
