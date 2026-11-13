import { describe, expect, it } from 'vitest';

import { touchTargetAt } from '../../../src/games/coloring/logic/coloringLayout';
import {
  LAYOUT_RULES,
  MIN_EDGE_DISTANCE,
  MIN_TAP_GAP,
  MIN_TAP_SIDE,
} from '../../shared/layoutRules';
import type { LayoutItem } from '../../shared/layoutRules';
import { gapBetween, heightOf, isInside, toCss, widthOf } from '../../shared/viewportFixtures';
import type { Box } from '../../shared/viewportFixtures';
import {
  COLORING_WINDOWS,
  HANDLE_NAME,
  PANEL_NAME,
  PICTURE_NAME,
  UNDO_NAME,
  boxOfRect,
  coloringCases,
  isOpen,
  recentColorName,
} from './coloringLayoutScenes';
import type { ColoringCase } from './coloringLayoutScenes';
import { PICTURE_BEFORE_142, PICTURE_MAY_MOVE_IN } from './layoutBefore142Fixture';

/**
 * Testy k #142 AC6 (rozložení koštěte v malování) a AC4 (tah začatý na
 * koštěti nemaluje): pravidla v cyklu pro všech 22 oken testů rozložení
 * Omalovánek (`COLORING_WINDOWS`) se zavřeným panelem i v obou krocích
 * panelu, jeden test na pravidlo. Obrazovka je obrazovka Omalovánek
 * z `coloringLayoutScenes.ts` a navíc fotoaparát (#126) a koště.
 *
 * Podle zadání je koště na šířku v levém pruhu: v jednom sloupci 16 px
 * pod fotoaparátem, jen když se tam vejde (dnes iPad 1180×820, 1180×760
 * a iPad z plochy), jinak ve dvou sloupcích 16 px vpravo od fotoaparátu ve
 * stejné výšce (nově i obě okna 932×499). Na výšku je v horní řadě 16 px
 * vlevo od fotoaparátu. Obrázek má stejnou velikost jako před #142
 * a posune se jen v okně 932×499 s výřezem.
 *
 * Navržené rozšíření `coloringLayout.ts`:
 * - `ColoringLayout.broomButton: LayoutRect` (herní jednotky),
 * - `touchTargetAt` vrátí na koštěti `{ kind: 'broom' }`, v každém kroku panelu.
 */

const BROOM_NAME = 'koště';
const CAMERA_NAME = 'fotoaparát';

/** Odstup koštěte od fotoaparátu podle zadání (přesně) a od domečku (aspoň). */
const BROOM_CAMERA_GAP = 16;
const BROOM_HOME_GAP = 16;

/** Okna, kde má pruh na šířku podle zadání jeden sloupec. */
const ONE_COLUMN_WINDOWS: readonly string[] = [
  'iPad 1180×820',
  'iPad 1180×760',
  'iPad na šířku z plochy (stavový řádek 24, lišta 20)',
];

/** Kolik ploch má pruh na šířku v jednom sloupci: domeček, úchyt, Zpět, 2 nedávné barvy, fotoaparát. */
const ONE_COLUMN_CONTROLS_ABOVE_BROOM = 6;

interface BroomCase extends ColoringCase {
  /** Fotoaparát v CSS px okna. */
  readonly camera: Box;
  /** Koště v CSS px okna. */
  readonly broom: Box;
}

function withBroom(testCase: ColoringCase): BroomCase {
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

let cached: BroomCase[] | undefined;

function cases(): BroomCase[] {
  cached ??= coloringCases().map(withBroom);
  return cached;
}

function landscapeCases(): BroomCase[] {
  return cases().filter((each) => each.landscape);
}

/**
 * Vejde se koště v jednom sloupci 16 px pod fotoaparát? Sloupec začíná
 * domečkem, plochy jsou stejně velké jako domeček a 8 px od sebe, koště
 * je 16 px pod fotoaparátem a aspoň 4 px nad spodním okrajem.
 */
function broomFitsOneColumn(testCase: BroomCase): boolean {
  const side = heightOf(testCase.home);
  const cameraBottom =
    testCase.home.top +
    ONE_COLUMN_CONTROLS_ABOVE_BROOM * side +
    (ONE_COLUMN_CONTROLS_ABOVE_BROOM - 1) * MIN_TAP_GAP;
  const broomBottom = cameraBottom + BROOM_CAMERA_GAP + side;
  return broomBottom <= testCase.visible.bottom - MIN_EDGE_DISTANCE + 0.01;
}

describe('#142 AC6: malování s koštětem dodrží společná pravidla rozložení', () => {
  it('zkouší se všech 22 oken Omalovánek se zavřeným panelem i v obou krocích', () => {
    expect(COLORING_WINDOWS.length).toBe(22);
    expect(cases().length).toBe(COLORING_WINDOWS.length * 3);
  });

  for (const [ruleName, rule] of Object.entries(LAYOUT_RULES)) {
    it(`${ruleName} ve všech oknech i s koštětem`, () => {
      for (const testCase of cases()) {
        expect(rule(testCase.scene), testCase.scene.label).toEqual([]);
      }
    });
  }
});

describe('#142 AC6: velikost a místo koštěte', () => {
  it('koště je stejně velké jako fotoaparát a má aspoň 64 × 64 px', () => {
    for (const testCase of cases()) {
      const what = testCase.scene.label;
      expect(widthOf(testCase.broom), `${what}, šířka jako fotoaparát`).toBeCloseTo(
        widthOf(testCase.camera),
        2,
      );
      expect(heightOf(testCase.broom), `${what}, výška jako fotoaparát`).toBeCloseTo(
        heightOf(testCase.camera),
        2,
      );
      expect(widthOf(testCase.broom), `${what}, šířka`).toBeGreaterThanOrEqual(MIN_TAP_SIDE - 0.01);
      expect(heightOf(testCase.broom), `${what}, výška`).toBeGreaterThanOrEqual(
        MIN_TAP_SIDE - 0.01,
      );
    }
  });

  it('koště je uvnitř bezpečné plochy aspoň 4 px od okraje', () => {
    for (const testCase of cases()) {
      const { visible } = testCase;
      const inner: Box = {
        left: visible.left + MIN_EDGE_DISTANCE,
        right: visible.right - MIN_EDGE_DISTANCE,
        top: visible.top + MIN_EDGE_DISTANCE,
        bottom: visible.bottom - MIN_EDGE_DISTANCE,
      };
      expect(isInside(testCase.broom, inner), testCase.scene.label).toBe(true);
    }
  });

  it('koště je od fotoaparátu přesně 16 px', () => {
    for (const testCase of cases()) {
      expect(gapBetween(testCase.broom, testCase.camera), testCase.scene.label).toBeCloseTo(
        BROOM_CAMERA_GAP,
        2,
      );
    }
  });

  it('koště je od domečku aspoň 16 px', () => {
    for (const testCase of cases()) {
      expect(
        gapBetween(testCase.broom, testCase.home),
        testCase.scene.label,
      ).toBeGreaterThanOrEqual(BROOM_HOME_GAP - 0.01);
    }
  });

  it('od úchytu, Zpět, nedávných barev, obrázku a panelu v každém kroku je koště aspoň 8 px', () => {
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
          gapBetween(testCase.broom, other),
          `${testCase.scene.label}: koště a ${name}`,
        ).toBeGreaterThanOrEqual(MIN_TAP_GAP - 0.01);
      }
    }
  });

  it('otevřený panel v obou krocích je od koštěte aspoň 8 px, na šířku vpravo od něj', () => {
    for (const testCase of cases().filter(isOpen)) {
      const what = testCase.scene.label;
      expect(gapBetween(testCase.panelBox, testCase.broom), what).toBeGreaterThanOrEqual(
        MIN_TAP_GAP - 0.01,
      );
      if (testCase.landscape) {
        expect(testCase.panelBox.left, `${what}: panel vpravo od koštěte`).toBeGreaterThanOrEqual(
          testCase.broom.right + MIN_TAP_GAP - 0.01,
        );
      }
    }
  });

  it('na šířku má pruh jeden sloupec jen tam, kde se koště vejde 16 px pod fotoaparát', () => {
    for (const testCase of landscapeCases()) {
      const what = testCase.scene.label;
      const oneColumn = broomFitsOneColumn(testCase);
      if (oneColumn) {
        expect(testCase.broom.left, `${what}: koště pod fotoaparátem`).toBeCloseTo(
          testCase.camera.left,
          2,
        );
        expect(testCase.broom.top - testCase.camera.bottom, `${what}: 16 px pod ním`).toBeCloseTo(
          BROOM_CAMERA_GAP,
          2,
        );
        for (const [name, box] of [
          [HANDLE_NAME, testCase.handle],
          [UNDO_NAME, testCase.undo],
          [CAMERA_NAME, testCase.camera],
        ] as const) {
          expect(box.left, `${what}: ${name} v jednom sloupci s domečkem`).toBeCloseTo(
            testCase.home.left,
            2,
          );
        }
      } else {
        expect(testCase.camera.left, `${what}: fotoaparát vlevo pod domečkem`).toBeCloseTo(
          testCase.home.left,
          2,
        );
        expect(testCase.broom.top, `${what}: koště ve výšce fotoaparátu`).toBeCloseTo(
          testCase.camera.top,
          2,
        );
        expect(
          testCase.broom.left - testCase.camera.right,
          `${what}: koště 16 px vpravo od fotoaparátu`,
        ).toBeCloseTo(BROOM_CAMERA_GAP, 2);
      }
    }
  });

  it('jeden sloupec mají jen iPad 1180×820, 1180×760 a iPad z plochy, obě okna 932×499 mají dva', () => {
    const oneColumn = new Set(
      landscapeCases()
        .filter(broomFitsOneColumn)
        .map((each) => each.window.name),
    );
    expect([...oneColumn].sort()).toEqual([...ONE_COLUMN_WINDOWS].sort());
    for (const testCase of landscapeCases().filter((each) =>
      each.window.name.startsWith('932×499'),
    )) {
      expect(
        testCase.broom.left - testCase.camera.right,
        `${testCase.scene.label}: koště vpravo od fotoaparátu`,
      ).toBeCloseTo(BROOM_CAMERA_GAP, 2);
    }
  });

  it('na výšku je koště v horní řadě 16 px vlevo od fotoaparátu', () => {
    for (const testCase of cases().filter((each) => !each.landscape)) {
      const what = testCase.scene.label;
      expect(testCase.broom.top, `${what}: ve výšce fotoaparátu`).toBeCloseTo(
        testCase.camera.top,
        2,
      );
      expect(
        testCase.camera.left - testCase.broom.right,
        `${what}: 16 px vlevo od fotoaparátu`,
      ).toBeCloseTo(BROOM_CAMERA_GAP, 2);
    }
  });
});

describe('#142 AC6: obrázek zůstane stejně velký a posune se jen v 932×499 s výřezem', () => {
  const before = new Map(
    PICTURE_BEFORE_142.map(([name, left, top, width, height]) => [
      name,
      { left, top, width, height },
    ]),
  );

  it('pevná tabulka měr před #142 má všechna okna Omalovánek', () => {
    expect(PICTURE_BEFORE_142.map(([name]) => name)).toEqual(
      COLORING_WINDOWS.map((window) => window.name),
    );
  });

  it('obrázek má v každém okně stejnou velikost jako před koštětem', () => {
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

  it('obrázek zůstane na místě ve všech oknech kromě 932×499 s výřezem', () => {
    for (const testCase of cases().filter((each) => each.window.name !== PICTURE_MAY_MOVE_IN)) {
      const place = before.get(testCase.window.name);
      expect(testCase.picture.left, `${testCase.scene.label}, levý okraj`).toBeCloseTo(
        place?.left ?? Number.NaN,
        2,
      );
      expect(testCase.picture.top, `${testCase.scene.label}, horní okraj`).toBeCloseTo(
        place?.top ?? Number.NaN,
        2,
      );
    }
  });

  it('v 932×499 s výřezem se obrázek posune doprava za koště', () => {
    const moved = cases().filter((each) => each.window.name === PICTURE_MAY_MOVE_IN);
    expect(moved.length).toBe(3);
    for (const testCase of moved) {
      const place = before.get(testCase.window.name);
      expect(testCase.picture.left, testCase.scene.label).toBeGreaterThan(
        place?.left ?? Number.NaN,
      );
      expect(
        testCase.picture.left,
        `${testCase.scene.label}: 8 px od koštěte`,
      ).toBeGreaterThanOrEqual(testCase.broom.right + MIN_TAP_GAP - 0.01);
    }
  });
});

describe('#142 AC4: tah začatý na koštěti nemaluje', () => {
  it('dotyk na koštěti patří koštěti, ne obrázku, v každém kroku panelu', () => {
    for (const testCase of cases()) {
      const rect = testCase.layout.broomButton;
      const points: ReadonlyArray<readonly [string, number, number]> = [
        ['střed', rect.left + rect.width / 2, rect.top + rect.height / 2],
        ['levý horní roh', rect.left + 0.5, rect.top + 0.5],
        ['pravý dolní roh', rect.left + rect.width - 0.5, rect.top + rect.height - 0.5],
      ];
      for (const [name, x, y] of points) {
        expect(
          touchTargetAt(testCase.layout, testCase.panel, x, y),
          `${testCase.scene.label}: ${name} koštěte`,
        ).toEqual({ kind: 'broom' });
      }
    }
  });
});
