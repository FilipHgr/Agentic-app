import { describe, expect, it } from 'vitest';

import { COLORING_GAME_AREA_FIT } from '../../../src/games/coloring/logic/coloringLayout';
import type { LayoutRect } from '../../../src/games/coloring/logic/coloringLayout';
import {
  bigPictureContinueAt,
  bigPictureTrashAt,
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
  overlaps,
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
import { BIG_PICTURE_BEFORE_131 } from './layoutBefore131Fixture';

/**
 * Testy k #131 AC7 (rozložení tlačítka malovat dál na velkém obrázku):
 * pravidla v cyklu pro všechna okna testů rozložení Omalovánek
 * (`COLORING_WINDOWS`), jeden test na pravidlo, popis případu v `expect`.
 * Velký obrázek má stejnou herní plochu jako malování
 * (`COLORING_GAME_AREA_FIT`), domeček je prvek stránky a vyhrazené místo je
 * jeho plocha pro prst a 8 px kolem, jako v testech velkého obrázku (#129).
 *
 * Schválené obrázky (komentář k #131):
 * - tlačítko malovat dál má ikonu štětce 🖌️ a stejnou velikost jako koš,
 * - na šířku je ve sloupci koše 16 CSS px nad košem,
 * - na výšku je v horní řadě 16 CSS px vlevo od koše,
 * - velký obrázek ani koš se proti #129 nemění (pevná tabulka
 *   `layoutBefore131Fixture.ts`).
 *
 * Na šířku smí obrázek sahat k hornímu a dolnímu okraji jako v malování
 * (#111 AC4, `PICTURE_EDGE_EXCEPTION`).
 *
 * Navržené rozhraní `pickerLayout.ts` (herní jednotky):
 * - `BigPictureLayout.continueButton: LayoutRect` tlačítko malovat dál,
 * - `bigPictureContinueAt(layout, x, y): boolean` trefil dotyk tlačítko?
 */

const PICTURE_NAME = 'velký obrázek';
const TRASH_NAME = 'koš';
const CONTINUE_NAME = 'malovat dál';
/** Nejmenší odstup tlačítka od koše, obrázku a domečku (AC7) a odstup ze schválených obrázků. */
const MIN_GAP = 16;
const APPROVED_GAP = 16;

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

function grown(b: Box, by: number): Box {
  return { left: b.left - by, right: b.right + by, top: b.top - by, bottom: b.bottom + by };
}

interface ContinueCase {
  readonly window: TestWindow;
  readonly area: GameArea;
  readonly landscape: boolean;
  readonly layout: BigPictureLayout;
  readonly visible: Box;
  readonly home: Box;
  readonly picture: Box;
  readonly trash: Box;
  readonly button: Box;
  readonly scene: LayoutScene;
}

function continueCase(window: TestWindow): ContinueCase {
  const area = gameAreaFor(viewportOf(window), COLORING_GAME_AREA_FIT);
  const css = (rect: LayoutRect): Box => toCss(boxOfRect(rect), area);
  const layout = layoutBigPicture(area);
  const landscape = isLandscapeArea(area);
  const visible = visibleAreaOf(window, area);
  const home = homeHitOf(window);
  const picture = css(layout.picture);
  const trash = css(layout.trash);
  const button = css(layout.continueButton);
  const pictureItem: LayoutItem = landscape
    ? { name: PICTURE_NAME, box: picture, minEdge: PICTURE_EDGE_EXCEPTION }
    : { name: PICTURE_NAME, box: picture };
  const items: LayoutItem[] = [
    { name: HOME_NAME, box: grown(home, MIN_TAP_GAP), reserved: true },
    pictureItem,
    { name: TRASH_NAME, box: trash, tappable: true },
    { name: CONTINUE_NAME, box: button, tappable: true },
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
    button,
    scene: { label: `${window.name}, velký obrázek s tlačítkem malovat dál`, free: visible, items },
  };
}

/** Velký obrázek a koš v CSS px (bez tlačítka, aby šly porovnat s #129 samostatně). */
function pictureAndTrashOf(window: TestWindow): { readonly picture: Box; readonly trash: Box } {
  const area = gameAreaFor(viewportOf(window), COLORING_GAME_AREA_FIT);
  const layout = layoutBigPicture(area);
  return {
    picture: toCss(boxOfRect(layout.picture), area),
    trash: toCss(boxOfRect(layout.trash), area),
  };
}

let cached: ContinueCase[] | undefined;

function cases(): ContinueCase[] {
  cached ??= COLORING_WINDOWS.map(continueCase);
  return cached;
}

describe('#131 AC7: velký obrázek s tlačítkem malovat dál dodrží společná pravidla rozložení', () => {
  for (const [ruleName, rule] of Object.entries(LAYOUT_RULES)) {
    it(`${ruleName} ve všech oknech na velkém obrázku s tlačítkem malovat dál`, () => {
      for (const testCase of cases()) {
        expect(rule(testCase.scene), testCase.scene.label).toEqual([]);
      }
    });
  }
});

describe('#131 AC7: tlačítko malovat dál jde dobře trefit prstem', () => {
  it('tlačítko malovat dál má aspoň 64 × 64 px', () => {
    for (const testCase of cases()) {
      const what = testCase.scene.label;
      expect(widthOf(testCase.button), `${what}, šířka`).toBeGreaterThanOrEqual(
        MIN_TAP_SIDE - 0.01,
      );
      expect(heightOf(testCase.button), `${what}, výška`).toBeGreaterThanOrEqual(
        MIN_TAP_SIDE - 0.01,
      );
    }
  });

  it('tlačítko malovat dál je stejně velké jako koš (schválené obrázky)', () => {
    for (const testCase of cases()) {
      const what = testCase.scene.label;
      expect(widthOf(testCase.button), `${what}, šířka`).toBeCloseTo(widthOf(testCase.trash), 1);
      expect(heightOf(testCase.button), `${what}, výška`).toBeCloseTo(heightOf(testCase.trash), 1);
    }
  });

  it('tlačítko malovat dál je uvnitř bezpečné plochy aspoň 4 px od okraje', () => {
    for (const testCase of cases()) {
      expect(
        isInside(testCase.button, grown(testCase.visible, -MIN_EDGE_DISTANCE)),
        testCase.scene.label,
      ).toBe(true);
    }
  });
});

describe('#131 AC7: tlačítko malovat dál má kolem sebe místo', () => {
  it('tlačítko malovat dál je od koše aspoň 16 px', () => {
    for (const testCase of cases()) {
      expect(
        gapBetween(testCase.button, testCase.trash),
        testCase.scene.label,
      ).toBeGreaterThanOrEqual(MIN_GAP - 0.01);
    }
  });

  it('tlačítko malovat dál je od velkého obrázku aspoň 16 px', () => {
    for (const testCase of cases()) {
      expect(
        gapBetween(testCase.button, testCase.picture),
        testCase.scene.label,
      ).toBeGreaterThanOrEqual(MIN_GAP - 0.01);
    }
  });

  it('tlačítko malovat dál je od domečku aspoň 16 px', () => {
    for (const testCase of cases()) {
      expect(
        gapBetween(testCase.button, testCase.home),
        testCase.scene.label,
      ).toBeGreaterThanOrEqual(MIN_GAP - 0.01);
    }
  });

  it('tlačítko malovat dál nepřekrývá domeček ani 8 px kolem něj', () => {
    for (const testCase of cases()) {
      expect(
        overlaps(testCase.button, grown(testCase.home, MIN_TAP_GAP)),
        testCase.scene.label,
      ).toBe(false);
    }
  });
});

describe('#131 AC7: tlačítko malovat dál je tam, kde ho ukazují schválené obrázky', () => {
  it('na šířku je tlačítko malovat dál ve sloupci koše 16 px nad košem', () => {
    const landscape = cases().filter((each) => each.landscape);
    expect(landscape.length, 'mezi okny jsou okna na šířku').toBeGreaterThan(0);
    for (const testCase of landscape) {
      const what = testCase.scene.label;
      expect(testCase.button.left, `${what}, vlevo jako koš`).toBeCloseTo(testCase.trash.left, 1);
      expect(testCase.button.right, `${what}, vpravo jako koš`).toBeCloseTo(
        testCase.trash.right,
        1,
      );
      expect(testCase.trash.top - testCase.button.bottom, `${what}, 16 px nad košem`).toBeCloseTo(
        APPROVED_GAP,
        1,
      );
    }
  });

  it('na výšku je tlačítko malovat dál v řadě koše 16 px vlevo od koše', () => {
    const portrait = cases().filter((each) => !each.landscape);
    expect(portrait.length, 'mezi okny jsou okna na výšku').toBeGreaterThan(0);
    for (const testCase of portrait) {
      const what = testCase.scene.label;
      expect(testCase.button.top, `${what}, nahoře jako koš`).toBeCloseTo(testCase.trash.top, 1);
      expect(testCase.button.bottom, `${what}, dole jako koš`).toBeCloseTo(
        testCase.trash.bottom,
        1,
      );
      expect(
        testCase.trash.left - testCase.button.right,
        `${what}, 16 px vlevo od koše`,
      ).toBeCloseTo(APPROVED_GAP, 1);
    }
  });
});

describe('#131 AC7: velký obrázek a koš zůstanou jako v #129', () => {
  it('pevná tabulka velkého obrázku a koše před #131 má všechna okna Omalovánek', () => {
    expect(BIG_PICTURE_BEFORE_131.map(([name]) => name)).toEqual(
      COLORING_WINDOWS.map((window) => window.name),
    );
  });

  it('velký obrázek se nezmenší ani neposune proti #129', () => {
    const before = new Map(BIG_PICTURE_BEFORE_131.map((row) => [row[0], row]));
    for (const window of COLORING_WINDOWS) {
      const row = before.get(window.name);
      if (row === undefined) {
        throw new Error(`${window.name}: chybí míra velkého obrázku`);
      }
      const { picture } = pictureAndTrashOf(window);
      const [, left, top, right, bottom] = row;
      const what = `${window.name}, obrázek`;
      expect(picture.left, `${what}: levý okraj`).toBeCloseTo(left, 2);
      expect(picture.top, `${what}: horní okraj`).toBeCloseTo(top, 2);
      expect(picture.right, `${what}: pravý okraj`).toBeCloseTo(right, 2);
      expect(picture.bottom, `${what}: spodní okraj`).toBeCloseTo(bottom, 2);
    }
  });

  it('koš má stejnou velikost i místo jako v #129', () => {
    const before = new Map(BIG_PICTURE_BEFORE_131.map((row) => [row[0], row]));
    for (const window of COLORING_WINDOWS) {
      const row = before.get(window.name);
      if (row === undefined) {
        throw new Error(`${window.name}: chybí míra koše`);
      }
      const { trash } = pictureAndTrashOf(window);
      const [, , , , , left, top, right, bottom] = row;
      const what = `${window.name}, koš`;
      expect(trash.left, `${what}: levý okraj`).toBeCloseTo(left, 2);
      expect(trash.top, `${what}: horní okraj`).toBeCloseTo(top, 2);
      expect(trash.right, `${what}: pravý okraj`).toBeCloseTo(right, 2);
      expect(trash.bottom, `${what}: spodní okraj`).toBeCloseTo(bottom, 2);
    }
  });
});

describe('#131 AC6: ťuknutí na velkém obrázku patří tlačítku malovat dál jen na něm', () => {
  it('ťuknutí doprostřed tlačítka malovat dál trefí jen je, ne koš', () => {
    for (const testCase of cases()) {
      const { layout } = testCase;
      const button = layout.continueButton;
      const x = button.left + button.width / 2;
      const y = button.top + button.height / 2;
      const what = testCase.scene.label;
      expect(bigPictureContinueAt(layout, x, y), `${what}: střed tlačítka`).toBe(true);
      expect(bigPictureTrashAt(layout, x, y), `${what}: střed tlačítka není koš`).toBe(false);
    }
  });

  it('ťuknutí na koš, na velký obrázek a mimo plochu tlačítko malovat dál netrefí', () => {
    for (const testCase of cases()) {
      const { layout, area } = testCase;
      const { trash, picture } = layout;
      const what = testCase.scene.label;
      const misses: ReadonlyArray<readonly [string, number, number]> = [
        ['střed koše', trash.left + trash.width / 2, trash.top + trash.height / 2],
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
        expect(bigPictureContinueAt(layout, x, y), `${what}: ${name}`).toBe(false);
      }
    }
  });
});
