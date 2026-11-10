import { describe, expect, it } from 'vitest';

import {
  pictureLayerPoint,
  pictureScreenPoint,
  touchTargetAt,
} from '../../../src/games/coloring/logic/coloringLayout';
import { regionAt } from '../../../src/games/coloring/logic/regionMap';
import type { RegionMap } from '../../../src/games/coloring/logic/regionMap';
import type { Box } from '../../shared/viewportFixtures';
import {
  HANDLE_NAME,
  HOME_NAME,
  PANEL_NAME,
  UNDO_NAME,
  coloringCases,
  isOpen,
  recentColorName,
} from './coloringLayoutScenes';
import type { ColoringCase } from './coloringLayoutScenes';
import { drawing } from './outlineFixtures';
import type { Point } from './outlineFixtures';
import {
  LAYER,
  expectedLayerPoint,
  fingerStroke,
  lineOf,
  pictureBoxOf,
  pointsInside,
  screenPointOf,
  touchedLayerPoint,
  unitsOf,
} from './pictureRotationHelpers';
import { openOn, pixelsOf } from './savedPictureHelpers';

/**
 * Testy k #127 AC2 (tah jde přesně pod prstem, #111 AC2 na výšku beze
 * změny, jen bez otočení): obrázek není otočený v žádném okně a tah barví
 * místo pod prstem. Převod dotyku je čistá logika:
 *
 * - `pictureLayerPoint(layout, layer, x, y): { x, y }` vrátí z bodu
 *   obrazovky v herních jednotkách bod vrstvy barev velikosti
 *   `layer.width × layer.height` podle `layout.picture`. Bod mimo obrázek
 *   vrátí bod mimo vrstvu (logika malování ho pak bere jako „mimo plochu“).
 * - `pictureScreenPoint(layout, layer, x, y): { x, y }` je obrácený
 *   převod (bod vrstvy na obrazovku), např. pro lesk třpytek.
 *
 * Co je „pod prstem“, počítají testy podle zadání samy
 * (`pictureRotationHelpers.ts`). Pravidla běží v cyklu přes všechna okna
 * (`COLORING_WINDOWS`), u ovládání i v obou krocích panelu.
 *
 * Nahrazené testy #111 na výšku (#127 AC5): „pravý horní roh obrázku je
 * levý horní roh omalovánky“ nahrazuje „levý horní roh obrázku je levý
 * horní roh omalovánky ve všech oknech“, „sluníčko je na výšku vpravo
 * nahoře“ nahrazuje „sluníčko je na výšku vlevo nahoře“, tah přetažený
 * ven vlevo (dřív spodní okraj omalovánky) nahrazují tahy přetažené ven
 * dolů a doleva. Ořez tahu, sluníčko a ovládání zůstávají se stejnou
 * ochranou, jen s neotočeným obrázkem.
 *
 * Ruční kontrola (není tu): lesk třpytek běží pod prstem. Lesk je jen
 * animace ve scéně, logika ho neukládá.
 */

/** Tolerance převodu v pixelech vrstvy. */
const LAYER_TOLERANCE = 1e-6;

/** Jak daleko za okrajem obrázku leží dotyk mimo obrázek (herní jednotky). */
const OUTSIDE_STEP = 2;

let cached: ColoringCase[] | undefined;

function cases(): ColoringCase[] {
  cached ??= coloringCases();
  return cached;
}

function closedCases(): ColoringCase[] {
  return cases().filter((testCase) => testCase.panel === 'closed');
}

function portraitClosedCases(): ColoringCase[] {
  return closedCases().filter((testCase) => !testCase.landscape);
}

function describePoint(point: Point): string {
  return `${point.x.toFixed(2)}, ${point.y.toFixed(2)}`;
}

function expectSamePoint(actual: Point, expected: Point, what: string): void {
  expect(
    Math.abs(actual.x - expected.x) <= LAYER_TOLERANCE &&
      Math.abs(actual.y - expected.y) <= LAYER_TOLERANCE,
    `${what}: dostal ${describePoint(actual)}, má být ${describePoint(expected)}`,
  ).toBe(true);
}

/** Rohy obrázku na obrazovce (herní jednotky) a který roh omalovánky pod nimi má být. */
function cornersOf(testCase: ColoringCase): Array<{ name: string; screen: Point; layer: Point }> {
  const picture = pictureBoxOf(testCase.layout);
  const { width, height } = LAYER;
  return [
    { name: 'levý horní roh', screen: { x: picture.left, y: picture.top }, layer: { x: 0, y: 0 } },
    {
      name: 'pravý horní roh',
      screen: { x: picture.right, y: picture.top },
      layer: { x: width, y: 0 },
    },
    {
      name: 'levý dolní roh',
      screen: { x: picture.left, y: picture.bottom },
      layer: { x: 0, y: height },
    },
    {
      name: 'pravý dolní roh',
      screen: { x: picture.right, y: picture.bottom },
      layer: { x: width, y: height },
    },
  ];
}

/** Omalovánka se sluníčkem: rámeček v levém horním rohu vrstvy (vršek obrázku). */
const SUN = { left: 60, top: 60, right: 260, bottom: 260 } as const;
const SUN_CENTER: Point = { x: 160, y: 160 };

let sunRegions: RegionMap | undefined;

function sunPicture(): RegionMap {
  sunRegions ??= drawing(LAYER.width, LAYER.height)
    .frame(SUN.left, SUN.top, SUN.right, SUN.bottom, 4)
    .regions();
  return sunRegions;
}

/** Omalovánka rozdělená svislou čárou x 512 na levou a pravou půlku. */
let halvesRegions: RegionMap | undefined;

function halvesPicture(): RegionMap {
  halvesRegions ??= drawing(LAYER.width, LAYER.height).verticalLine(512, 4).regions();
  return halvesRegions;
}

/** Zabarvené pixely mimo oblast `region`. */
function coloredOutside(
  pixels: ReadonlyArray<number | null>,
  regions: RegionMap,
  region: number | null,
): number {
  let count = 0;
  pixels.forEach((color, index) => {
    const x = index % regions.width;
    const y = Math.floor(index / regions.width);
    if (color !== null && regionAt(regions, x, y) !== region) {
      count += 1;
    }
  });
  return count;
}

describe('#127 AC2: dotyk se převede na místo omalovánky přesně pod prstem', () => {
  it('zkouší se okna na výšku i na šířku', () => {
    expect(portraitClosedCases().length, 'okna na výšku').toBeGreaterThan(0);
    expect(closedCases().filter((each) => each.landscape).length, 'okna na šířku').toBeGreaterThan(
      0,
    );
  });

  it('na výšku i na šířku je levý horní roh obrázku levý horní roh omalovánky, omalovánka není otočená', () => {
    for (const testCase of closedCases()) {
      for (const corner of cornersOf(testCase)) {
        const actual = pictureLayerPoint(testCase.layout, LAYER, corner.screen.x, corner.screen.y);
        expectSamePoint(actual, corner.layer, `${testCase.scene.label}, ${corner.name}`);
      }
    }
  });

  it('kdekoli na obrázku se dotyk převede na místo omalovánky pod prstem ve všech oknech', () => {
    for (const testCase of closedCases()) {
      for (const screen of pointsInside(pictureBoxOf(testCase.layout), 8)) {
        expectSamePoint(
          touchedLayerPoint(testCase, screen),
          expectedLayerPoint(testCase, screen),
          `${testCase.scene.label}, dotyk ${describePoint(screen)}`,
        );
      }
    }
  });

  it('místo omalovánky se převede zpět na stejné místo obrazovky (pro kreslení pod prstem)', () => {
    for (const testCase of closedCases()) {
      for (const screen of pointsInside(pictureBoxOf(testCase.layout), 6)) {
        const layer = pictureLayerPoint(testCase.layout, LAYER, screen.x, screen.y);
        const back = pictureScreenPoint(testCase.layout, LAYER, layer.x, layer.y);
        expectSamePoint(back, screen, `${testCase.scene.label}, dotyk ${describePoint(screen)}`);
      }
    }
  });

  it('dotyk kousek za každým okrajem obrázku je mimo omalovánku', () => {
    for (const testCase of closedCases()) {
      const picture = pictureBoxOf(testCase.layout);
      const middleX = (picture.left + picture.right) / 2;
      const middleY = (picture.top + picture.bottom) / 2;
      const outside: Array<[string, Point]> = [
        ['vlevo', { x: picture.left - OUTSIDE_STEP, y: middleY }],
        ['vpravo', { x: picture.right + OUTSIDE_STEP, y: middleY }],
        ['nahoře', { x: middleX, y: picture.top - OUTSIDE_STEP }],
        ['dole', { x: middleX, y: picture.bottom + OUTSIDE_STEP }],
      ];
      for (const [side, screen] of outside) {
        const point = pictureLayerPoint(testCase.layout, LAYER, screen.x, screen.y);
        const inside =
          point.x >= 0 && point.x < LAYER.width && point.y >= 0 && point.y < LAYER.height;
        expect(
          inside,
          `${testCase.scene.label}: dotyk ${side} za obrázkem → ${describePoint(point)}`,
        ).toBe(false);
      }
    }
  });
});

describe('#127 AC2: na výšku barví tah přesně místo pod prstem', () => {
  it('tah začatý na sluníčku vybarví sluníčko a nic jiného ve všech oknech na výšku', () => {
    const regions = sunPicture();
    const sun = regionAt(regions, SUN_CENTER.x, SUN_CENTER.y);
    for (const testCase of portraitClosedCases()) {
      const game = openOn(undefined, regions);
      const start = screenPointOf(testCase, SUN_CENTER);
      const end = screenPointOf(testCase, { x: SUN_CENTER.x + 40, y: SUN_CENTER.y + 30 });
      fingerStroke(game, testCase, lineOf(start, end, 8));
      const pixels = pixelsOf(game, regions);
      expect(
        game.colorAt(SUN_CENTER.x, SUN_CENTER.y),
        `${testCase.scene.label}: sluníčko`,
      ).not.toBeNull();
      expect(
        coloredOutside(pixels, regions, sun),
        `${testCase.scene.label}: zabarveno mimo sluníčko`,
      ).toBe(0);
    }
  });

  it('sluníčko (levý horní roh omalovánky) je na výšku vlevo nahoře, jako na papíře', () => {
    for (const testCase of portraitClosedCases()) {
      const picture = pictureBoxOf(testCase.layout);
      const sunOnScreen = pictureScreenPoint(testCase.layout, LAYER, SUN_CENTER.x, SUN_CENTER.y);
      const label = `${testCase.scene.label}: sluníčko na ${describePoint(sunOnScreen)}`;
      expect(sunOnScreen.x < (picture.left + picture.right) / 2, `${label} je vlevo`).toBe(true);
      expect(sunOnScreen.y < (picture.top + picture.bottom) / 2, `${label} je nahoře`).toBe(true);
    }
  });

  it('ořez tahu do oblasti, kde začal, platí i na výšku: tah přes čáru barví jen první půlku', () => {
    const regions = halvesPicture();
    const leftHalf = regionAt(regions, 300, 384);
    for (const testCase of portraitClosedCases()) {
      const game = openOn(undefined, regions);
      // Levá půlka omalovánky je i na výšku vlevo, prst jede po obrazovce doprava přes čáru.
      const start = screenPointOf(testCase, { x: 300, y: 384 });
      const end = screenPointOf(testCase, { x: 760, y: 384 });
      fingerStroke(game, testCase, lineOf(start, end, 20));
      const pixels = pixelsOf(game, regions);
      expect(game.colorAt(300, 384), `${testCase.scene.label}: začátek tahu`).not.toBeNull();
      expect(game.colorAt(760, 384), `${testCase.scene.label}: druhá půlka`).toBeNull();
      expect(
        coloredOutside(pixels, regions, leftHalf),
        `${testCase.scene.label}: mimo první půlku`,
      ).toBe(0);
    }
  });

  it('tah přetažený přes spodní okraj ven z obrázku nezabarví nic u horního okraje omalovánky', () => {
    const regions = halvesPicture();
    for (const testCase of portraitClosedCases()) {
      const game = openOn(undefined, regions);
      // Spodní okraj omalovánky (y 768) je spodní okraj obrázku, prst vyjede dolů ven.
      const start = screenPointOf(testCase, { x: 300, y: 700 });
      const picture = pictureBoxOf(testCase.layout);
      const beyond = { x: start.x, y: picture.bottom + 40 };
      fingerStroke(game, testCase, lineOf(start, beyond, 20));
      const pixels = pixelsOf(game, regions);
      expect(game.colorAt(300, 700), `${testCase.scene.label}: začátek tahu`).not.toBeNull();
      const farRows = pixels.filter((color, index) => color !== null && index < 600 * LAYER.width);
      expect(farRows.length, `${testCase.scene.label}: zabarveno daleko od tahu`).toBe(0);
    }
  });

  it('tah přetažený přes levý okraj ven z obrázku nezabarví nic u pravého okraje omalovánky', () => {
    const regions = halvesPicture();
    for (const testCase of portraitClosedCases()) {
      const game = openOn(undefined, regions);
      // Levý okraj omalovánky (x 0) je levý okraj obrázku, prst vyjede doleva ven.
      const start = screenPointOf(testCase, { x: 120, y: 384 });
      const picture = pictureBoxOf(testCase.layout);
      const beyond = { x: picture.left - 40, y: start.y };
      fingerStroke(game, testCase, lineOf(start, beyond, 20));
      const pixels = pixelsOf(game, regions);
      expect(game.colorAt(120, 384), `${testCase.scene.label}: začátek tahu`).not.toBeNull();
      const farColumns = pixels.filter(
        (color, index) => color !== null && index % LAYER.width >= 400,
      );
      expect(farColumns.length, `${testCase.scene.label}: zabarveno daleko od tahu`).toBe(0);
    }
  });
});

describe('#127 AC2 (#111 AC2 beze změny): dotyk na ovládání nikdy nemaluje', () => {
  /** Ovládání pruhu v herních jednotkách: domeček, úchyt, Zpět a nedávné barvy. */
  function controlsOf(testCase: ColoringCase): Array<[string, Box]> {
    const units = (box: Box): Box => unitsOf(testCase, box);
    return [
      [HOME_NAME, units(testCase.home)],
      [HANDLE_NAME, units(testCase.handle)],
      [UNDO_NAME, units(testCase.undo)],
      ...testCase.recentColors.map((box, index): [string, Box] => [
        recentColorName(index),
        units(box),
      ]),
    ];
  }

  it('dotyk na domečku, úchytu, Zpět ani nedávné barvě nemaluje, se zavřeným panelem ani v obou krocích', () => {
    for (const testCase of cases()) {
      for (const [name, control] of controlsOf(testCase)) {
        for (const point of pointsInside(control, 4)) {
          const target = touchTargetAt(testCase.layout, testCase.panel, point.x, point.y);
          expect(target.kind, `${testCase.scene.label}: dotyk na ${name}`).not.toBe('picture');
        }
      }
    }
  });

  it('dotyk kdekoli na otevřeném panelu nemaluje, ani když panel leží přes obrázek', () => {
    for (const testCase of cases().filter(isOpen)) {
      const panel = unitsOf(testCase, testCase.panelBox);
      for (const point of pointsInside(panel, 12)) {
        const target = touchTargetAt(testCase.layout, testCase.panel, point.x, point.y);
        expect(target.kind, `${testCase.scene.label}: dotyk na ${PANEL_NAME}`).not.toBe('picture');
      }
    }
  });
});
