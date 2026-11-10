import { describe, expect, it } from 'vitest';

import { touchTargetAt } from '../../../src/games/coloring/logic/coloringLayout';
import { homeButtonFor } from '../../../src/shared/logic/homeButton';
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
  toCss,
  viewportOf,
  widthOf,
} from '../../shared/viewportFixtures';
import type { Box } from '../../shared/viewportFixtures';
import {
  COLORING_WINDOWS,
  HANDLE_NAME,
  PANEL_NAME,
  PICTURE_NAME,
  UNDO_NAME,
  boxOfRect,
  coloringCases,
  recentColorName,
} from './coloringLayoutScenes';
import type { ColoringCase } from './coloringLayoutScenes';
import { PICTURE_SIZE_BEFORE_126 } from './layoutBefore126Fixture';

/**
 * Testy k #126 AC6 (rozložení fotoaparátu v malování) a AC3 (tah začatý
 * na fotoaparátu nemaluje): pravidla v cyklu pro všechna okna testů
 * rozložení Omalovánek (`COLORING_WINDOWS`) se zavřeným panelem i v obou
 * krocích panelu, jeden test na pravidlo. Obrazovka je obrazovka
 * Omalovánek z `coloringLayoutScenes.ts` a navíc fotoaparát.
 *
 * Podle schválených obrázků (komentář k #126, otázka 4) je fotoaparát na
 * šířku v levém pruhu pod nedávnými barvami (v oknech 932×500 a 932×430
 * přejde pruh do 2 sloupců a obrázek se jen posune), na výšku vpravo
 * nahoře zrcadlově k domečku.
 *
 * Navržené rozšíření `coloringLayout.ts`:
 * - `ColoringLayout.cameraButton: LayoutRect` (herní jednotky),
 * - `touchTargetAt` vrátí na fotoaparátu `{ kind: 'camera' }`, v každém
 *   kroku panelu.
 */

const CAMERA_NAME = 'fotoaparát';

interface CameraCase extends ColoringCase {
  /** Fotoaparát v CSS px okna. */
  readonly camera: Box;
}

function withCamera(testCase: ColoringCase): CameraCase {
  const camera = toCss(boxOfRect(testCase.layout.cameraButton), testCase.area);
  const item: LayoutItem = { name: CAMERA_NAME, box: camera, tappable: true };
  return {
    ...testCase,
    camera,
    scene: { ...testCase.scene, items: [...testCase.scene.items, item] },
  };
}

let cached: CameraCase[] | undefined;

function cases(): CameraCase[] {
  cached ??= coloringCases().map(withCamera);
  return cached;
}

/** Na iPadu je fotoaparát stejně velký jako domeček (AC6). */
function homeSideOf(testCase: CameraCase): number {
  return homeButtonFor(viewportOf(testCase.window)).hitSize;
}

describe('#126 AC6: malování s fotoaparátem dodrží společná pravidla rozložení', () => {
  it('zkouší se všechna okna Omalovánek se zavřeným panelem i v obou krocích', () => {
    expect(cases().length).toBe(COLORING_WINDOWS.length * 3);
  });

  for (const [ruleName, rule] of Object.entries(LAYOUT_RULES)) {
    it(`${ruleName} ve všech oknech i s fotoaparátem`, () => {
      for (const testCase of cases()) {
        expect(rule(testCase.scene), testCase.scene.label).toEqual([]);
      }
    });
  }
});

describe('#126 AC6: velikost a místo fotoaparátu', () => {
  it('fotoaparát má aspoň 64 × 64 px', () => {
    for (const testCase of cases()) {
      const what = testCase.scene.label;
      expect(widthOf(testCase.camera), `${what}, šířka`).toBeGreaterThanOrEqual(
        MIN_TAP_SIDE - 0.01,
      );
      expect(heightOf(testCase.camera), `${what}, výška`).toBeGreaterThanOrEqual(
        MIN_TAP_SIDE - 0.01,
      );
    }
  });

  it('na iPadu je fotoaparát stejně velký jako domeček', () => {
    for (const testCase of cases().filter((each) => each.area.mode === 'tablet')) {
      const side = homeSideOf(testCase);
      expect(widthOf(testCase.camera), testCase.scene.label).toBeCloseTo(side, 1);
      expect(heightOf(testCase.camera), testCase.scene.label).toBeCloseTo(side, 1);
    }
  });

  it('fotoaparát je uvnitř bezpečné plochy aspoň 4 px od okraje', () => {
    for (const testCase of cases()) {
      const { visible } = testCase;
      const inner: Box = {
        left: visible.left + MIN_EDGE_DISTANCE,
        right: visible.right - MIN_EDGE_DISTANCE,
        top: visible.top + MIN_EDGE_DISTANCE,
        bottom: visible.bottom - MIN_EDGE_DISTANCE,
      };
      expect(isInside(testCase.camera, inner), testCase.scene.label).toBe(true);
    }
  });

  it('fotoaparát nepřekrývá domeček a 8 px kolem něj', () => {
    for (const testCase of cases()) {
      expect(
        gapBetween(testCase.camera, testCase.home),
        testCase.scene.label,
      ).toBeGreaterThanOrEqual(MIN_TAP_GAP - 0.01);
    }
  });

  it('od úchytu, Zpět, nedávných barev, obrázku a panelu v každém kroku je fotoaparát aspoň 8 px', () => {
    for (const testCase of cases()) {
      const others: ReadonlyArray<readonly [string, Box]> = [
        [HANDLE_NAME, testCase.handle],
        [UNDO_NAME, testCase.undo],
        ...testCase.recentColors.map((box, index) => [recentColorName(index), box] as const),
        [PICTURE_NAME, testCase.picture],
        [PANEL_NAME, testCase.panelBox],
      ];
      for (const [name, other] of others) {
        expect(
          gapBetween(testCase.camera, other),
          `${testCase.scene.label}: fotoaparát a ${name}`,
        ).toBeGreaterThanOrEqual(MIN_TAP_GAP - 0.01);
      }
    }
  });

  it('na šířku je fotoaparát v levém pruhu pod nedávnými barvami (schválené obrázky)', () => {
    for (const testCase of cases().filter((each) => each.landscape)) {
      const what = testCase.scene.label;
      expect(testCase.camera.right, `${what}: vlevo od obrázku`).toBeLessThanOrEqual(
        testCase.picture.left + 0.01,
      );
      for (const [index, recent] of testCase.recentColors.entries()) {
        expect(
          testCase.camera.top,
          `${what}: pod nedávnou barvou ${index + 1}`,
        ).toBeGreaterThanOrEqual(recent.bottom - 0.01);
      }
    }
  });

  it('na výšku je fotoaparát vpravo nahoře zrcadlově k domečku (schválené obrázky)', () => {
    for (const testCase of cases().filter((each) => !each.landscape)) {
      const what = testCase.scene.label;
      const homeInset = testCase.home.left - testCase.visible.left;
      expect(testCase.camera.top, `${what}: ve výšce domečku`).toBeCloseTo(testCase.home.top, 1);
      expect(
        testCase.visible.right - testCase.camera.right,
        `${what}: od pravého okraje`,
      ).toBeCloseTo(homeInset, 1);
    }
  });
});

describe('#126 AC6: obrázek má stejnou velikost jako bez fotoaparátu', () => {
  it('pevná tabulka měr před #126 má všechna okna Omalovánek', () => {
    expect(PICTURE_SIZE_BEFORE_126.map(([name]) => name)).toEqual(
      COLORING_WINDOWS.map((window) => window.name),
    );
  });

  it('obrázek v malování má v každém okně stejnou velikost jako před #126, smí se jen posunout', () => {
    const before = new Map(
      PICTURE_SIZE_BEFORE_126.map(([name, width, height]) => [name, { width, height }]),
    );
    for (const testCase of cases()) {
      const size = before.get(testCase.window.name);
      expect(size, `${testCase.scene.label}: míra v tabulce`).toBeDefined();
      expect(widthOf(testCase.picture), `${testCase.scene.label}, šířka`).toBeCloseTo(
        size?.width ?? Number.NaN,
        2,
      );
      expect(heightOf(testCase.picture), `${testCase.scene.label}, výška`).toBeCloseTo(
        size?.height ?? Number.NaN,
        2,
      );
    }
  });
});

describe('#126 AC3: tah začatý na fotoaparátu nemaluje', () => {
  it('dotyk na fotoaparátu patří fotoaparátu, ne obrázku, v každém kroku panelu', () => {
    for (const testCase of cases()) {
      const rect = testCase.layout.cameraButton;
      const points: ReadonlyArray<readonly [string, number, number]> = [
        ['střed', rect.left + rect.width / 2, rect.top + rect.height / 2],
        ['levý horní roh', rect.left + 0.5, rect.top + 0.5],
        ['pravý dolní roh', rect.left + rect.width - 0.5, rect.top + rect.height - 0.5],
      ];
      for (const [name, x, y] of points) {
        expect(
          touchTargetAt(testCase.layout, testCase.panel, x, y),
          `${testCase.scene.label}: ${name} fotoaparátu`,
        ).toEqual({ kind: 'camera' });
      }
    }
  });
});
