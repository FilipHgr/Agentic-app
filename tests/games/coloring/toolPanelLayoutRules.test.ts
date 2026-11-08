import { describe, expect, it } from 'vitest';

import { touchTargetAt } from '../../../src/games/coloring/logic/coloringLayout';
import type { LayoutRect } from '../../../src/games/coloring/logic/coloringLayout';
import { MIN_TAP_GAP, MIN_TAP_SIDE } from '../../shared/layoutRules';
import {
  IPAD_WINDOWS,
  boundsOf,
  heightOf,
  isInside,
  overlaps,
  widthOf,
} from '../../shared/viewportFixtures';
import type { Box } from '../../shared/viewportFixtures';
import { RECENT_COLOR_PLACES, coloringCases, isOpen } from './coloringLayoutScenes';
import type { ColoringCase } from './coloringLayoutScenes';

/**
 * Testy k #96 (obrázek přes celou obrazovku a vysouvací panel nástrojů):
 * AC1 obrázek a úzký pruh, AC2 úchyt, AC3 obsah panelu, AC4 dotyk na
 * panelu nemaluje a domeček je volný, AC6 pravidla rozložení v cyklu.
 * Rozložení L-A (pruh vlevo, panel vyjíždí zleva) a P-A (pruh dole, úchyt
 * uprostřed, Zpět vpravo, nedávné barvy vlevo, panel vyjíždí zdola) podle
 * schválení vlastníka v komentáři k issue. Každý test projde v cyklu
 * všechna okna se zavřeným panelem i v obou krocích panelu (#105);
 * obrazovku skládá
 * `coloringLayoutScenes.ts`. Společná pravidla (64 px, 8 px, nic se
 * nepřekrývá, vejde se) běží v `coloringLayoutRules.test.ts`
 * a `undoLayoutRules.test.ts` na stejných obrazovkách.
 *
 * Kde je dotyk, rozhoduje navržená čistá funkce
 * `touchTargetAt(layout, panel, x, y): TouchTarget` v herních
 * jednotkách (`coloringLayout.ts`), od #105 s krokem panelu
 * (`'closed' | 'tools' | 'colors'`). Scéna předá tah do malování jen
 * u `{ kind: 'picture' }`.
 *
 * Testy plného panelu s 23 plochami (#96 AC3: „panel má místo pro 12 barev,
 * 10 nástrojů a přepínač velikosti, celkem 23 ploch“ a „všech 23 ploch
 * panelu má aspoň 64 × 64 px a leží celé v panelu“) nahrazují od #105
 * testy obou kroků v `panelStepsLayoutRules.test.ts`.
 */

/** Plocha je od dvou protilehlých hranic volného prostoru nejvýš 8 px (AC1). */
const MAX_PICTURE_DISTANCE = 8;

/** Na iPadu na šířku má plocha kratší stranu aspoň 700 px (AC1). */
const MIN_IPAD_PICTURE_SIDE = 700;

/** Nejmenší odstup od okraje podle společných pravidel (CSS px). */
const EDGE = 4;

/** Na šířku leží panel hned vedle pruhu, na výšku hned nad ním (L-A, P-A). */
const MAX_PANEL_GAP_TO_STRIP = 24;

/** Úchyt na výšku je uprostřed šířky (P-A). */
const MAX_HANDLE_OFF_CENTER = 1;

/** Tolerance na zaokrouhlení v CSS px. */
const TOLERANCE = 0.01;

let cached: ColoringCase[] | undefined;

function cases(): ColoringCase[] {
  cached ??= coloringCases();
  return cached;
}

/** Otevřený panel v kroku nástrojů i v kroku barev. */
function openCases(): ColoringCase[] {
  return cases().filter(isOpen);
}

/** Ťukací plochy pruhu (na šířku i s domečkem, na výšku je domeček nahoře). */
function stripControls(testCase: ColoringCase): Box[] {
  const controls = [testCase.handle, testCase.undo, ...testCase.recentColors];
  return testCase.landscape ? [testCase.home, ...controls] : controls;
}

/**
 * Volný prostor pro obrázek mimo pruh (AC1): viditelná plocha bez pruhu.
 * Pruh je jen tak široký, aby se do něj plochy vešly s mezerami 8 px,
 * proto končí 8 px za jeho plochami.
 */
function spaceBesideStrip(testCase: ColoringCase): Box {
  const strip = boundsOf(stripControls(testCase));
  return testCase.landscape
    ? { ...testCase.visible, left: strip.right + MIN_TAP_GAP }
    : { ...testCase.visible, bottom: strip.top - MIN_TAP_GAP };
}

/**
 * Nejmenší tloušťka pruhu (AC1): nejmenší počet sloupců (na šířku) nebo
 * řad (na výšku), do kterých se plochy pruhu dané strany vejdou po délce
 * viditelné plochy s mezerami 8 px.
 */
function narrowestStrip(testCase: ColoringCase): number {
  const controls = stripControls(testCase);
  const side = Math.max(
    ...controls.map((control) => Math.max(widthOf(control), heightOf(control))),
  );
  const length = testCase.landscape
    ? heightOf(testCase.visible) - 2 * EDGE
    : widthOf(testCase.visible) - 2 * EDGE;
  for (let lines = 1; lines <= controls.length; lines += 1) {
    const perLine = Math.ceil(controls.length / lines);
    if (perLine * side + (perLine - 1) * MIN_TAP_GAP <= length + TOLERANCE) {
      return lines * side + (lines - 1) * MIN_TAP_GAP;
    }
  }
  return controls.length * side + (controls.length - 1) * MIN_TAP_GAP;
}

function stripThickness(testCase: ColoringCase): number {
  const strip = boundsOf(stripControls(testCase));
  return testCase.landscape ? widthOf(strip) : heightOf(strip);
}

function center(rect: LayoutRect): { x: number; y: number } {
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

/** Body v herních jednotkách rovnoměrně po obdélníku `rect` (i jeho okraje). */
function gridIn(rect: LayoutRect, steps: number): Array<{ x: number; y: number }> {
  const points: Array<{ x: number; y: number }> = [];
  const inset = Math.min(rect.width, rect.height) / 1000;
  for (let row = 0; row <= steps; row += 1) {
    for (let column = 0; column <= steps; column += 1) {
      points.push({
        x: rect.left + inset + ((rect.width - 2 * inset) * column) / steps,
        y: rect.top + inset + ((rect.height - 2 * inset) * row) / steps,
      });
    }
  }
  return points;
}

function containsPoint(rect: LayoutRect, point: { x: number; y: number }): boolean {
  return (
    point.x > rect.left &&
    point.x < rect.left + rect.width &&
    point.y > rect.top &&
    point.y < rect.top + rect.height
  );
}

/** Tlačítka zobrazeného kroku panelu v herních jednotkách. */
function panelSlots(testCase: ColoringCase): LayoutRect[] {
  const { layout } = testCase;
  return testCase.panel === 'tools'
    ? [layout.sizeToggle, ...layout.toolSlots]
    : [layout.colorStepTool, ...layout.paletteColors];
}

/** Body v mezerách mezi tlačítky panelu: kousek vpravo a pod každým tlačítkem. */
function gapPointsIn(testCase: ColoringCase): Array<{ x: number; y: number }> {
  const { panel } = testCase.layout;
  const nudge = 2 / testCase.area.scale;
  const points = panelSlots(testCase).flatMap((slot) => [
    { x: slot.left + slot.width + nudge, y: slot.top + slot.height / 2 },
    { x: slot.left + slot.width / 2, y: slot.top + slot.height + nudge },
    { x: slot.left - nudge, y: slot.top - nudge },
  ]);
  return points
    .filter((point) => containsPoint(panel, point))
    .filter((point) => !panelSlots(testCase).some((slot) => containsPoint(slot, point)));
}

describe('#96 AC1: obrázek je přes celou obrazovku, vedle něj jen úzký pruh', () => {
  it('v pruhu je domeček, úchyt, Zpět a místo pro 2 nedávné barvy, nic z nich neleží na obrázku', () => {
    for (const testCase of cases()) {
      const { label } = testCase.scene;
      expect(testCase.recentColors.length, `${label}: míst pro nedávné barvy`).toBe(
        RECENT_COLOR_PLACES,
      );
      for (const control of [testCase.home, ...stripControls(testCase)]) {
        expect(overlaps(control, testCase.picture), `${label}: plocha pruhu na obrázku`).toBe(
          false,
        );
      }
    }
  });

  it('na šířku je pruh vlevo od obrázku a na výšku dole pod obrázkem', () => {
    for (const testCase of cases()) {
      const { label } = testCase.scene;
      const strip = boundsOf(stripControls(testCase));
      if (testCase.landscape) {
        expect(
          testCase.picture.left - strip.right,
          `${label}: mezera pruh–obrázek`,
        ).toBeGreaterThanOrEqual(MIN_TAP_GAP - TOLERANCE);
      } else {
        expect(testCase.picture.top <= strip.top, `${label}: obrázek nad pruhem`).toBe(true);
        expect(
          strip.top - testCase.picture.bottom,
          `${label}: mezera obrázek–pruh`,
        ).toBeGreaterThanOrEqual(MIN_TAP_GAP - TOLERANCE);
      }
    }
  });

  it('pruh je jen tak široký, aby se do něj jeho plochy vešly s mezerami 8 px', () => {
    for (const testCase of cases()) {
      expect(
        stripThickness(testCase),
        `${testCase.scene.label}: tloušťka pruhu`,
      ).toBeLessThanOrEqual(narrowestStrip(testCase) + TOLERANCE);
    }
  });

  it('obrázek je největší 4 : 3 v prostoru mimo pruh: od dvou protilehlých hranic nejvýš 8 px', () => {
    for (const testCase of cases()) {
      const { label } = testCase.scene;
      const space = spaceBesideStrip(testCase);
      const { picture } = testCase;
      expect(isInside(picture, space), `${label}: obrázek leží v prostoru mimo pruh`).toBe(true);
      const fromLeft = picture.left - space.left;
      const fromRight = space.right - picture.right;
      const fromTop = picture.top - space.top;
      const fromBottom = space.bottom - picture.bottom;
      const touchesSides = fromLeft <= MAX_PICTURE_DISTANCE && fromRight <= MAX_PICTURE_DISTANCE;
      const touchesTopAndBottom =
        fromTop <= MAX_PICTURE_DISTANCE && fromBottom <= MAX_PICTURE_DISTANCE;
      expect(
        touchesSides || touchesTopAndBottom,
        `${label}: od kraje vlevo ${fromLeft}, vpravo ${fromRight}, nahoře ${fromTop}, dole ${fromBottom} px`,
      ).toBe(true);
    }
  });

  it('na iPadu na šířku 1180 × 820 a 1180 × 760 má obrázek kratší stranu aspoň 700 px', () => {
    const ipadCases = cases().filter((testCase) => IPAD_WINDOWS.includes(testCase.window));
    expect(ipadCases.length, 'obě okna iPadu, zavřený panel a oba kroky').toBe(
      IPAD_WINDOWS.length * 3,
    );
    for (const testCase of ipadCases) {
      const shorter = Math.min(widthOf(testCase.picture), heightOf(testCase.picture));
      expect(shorter, `${testCase.scene.label}: kratší strana obrázku`).toBeGreaterThanOrEqual(
        MIN_IPAD_PICTURE_SIDE,
      );
    }
  });
});

describe('#96 AC2: úchyt jde trefit prstem a leží mimo obrázek', () => {
  it('úchyt má ve všech oknech aspoň 64 × 64 px a neleží na obrázku ani pod panelem', () => {
    for (const testCase of cases()) {
      const { label } = testCase.scene;
      expect(widthOf(testCase.handle), `${label}: šířka úchytu`).toBeGreaterThanOrEqual(
        MIN_TAP_SIDE,
      );
      expect(heightOf(testCase.handle), `${label}: výška úchytu`).toBeGreaterThanOrEqual(
        MIN_TAP_SIDE,
      );
      expect(overlaps(testCase.handle, testCase.picture), `${label}: úchyt na obrázku`).toBe(false);
      expect(overlaps(testCase.handle, testCase.panelBox), `${label}: úchyt pod panelem`).toBe(
        false,
      );
    }
  });

  it('ťuknutí na úchyt jde na úchyt se zavřeným panelem i v obou krocích', () => {
    for (const testCase of cases()) {
      const { x, y } = center(testCase.layout.handle);
      expect(touchTargetAt(testCase.layout, testCase.panel, x, y), testCase.scene.label).toEqual({
        kind: 'handle',
      });
    }
  });

  it('na šířku je úchyt v pruhu vlevo pod domečkem (L-A)', () => {
    for (const testCase of cases().filter((each) => each.landscape)) {
      expect(
        testCase.handle.top,
        `${testCase.scene.label}: úchyt pod domečkem`,
      ).toBeGreaterThanOrEqual(testCase.home.bottom + MIN_TAP_GAP - TOLERANCE);
    }
  });

  it('na výšku je úchyt dole uprostřed, nedávné barvy vlevo od něj a Zpět vpravo (P-A)', () => {
    for (const testCase of cases().filter((each) => !each.landscape)) {
      const { label } = testCase.scene;
      const handleCenter = (testCase.handle.left + testCase.handle.right) / 2;
      const visibleCenter = (testCase.visible.left + testCase.visible.right) / 2;
      expect(
        Math.abs(handleCenter - visibleCenter),
        `${label}: úchyt mimo střed`,
      ).toBeLessThanOrEqual(MAX_HANDLE_OFF_CENTER);
      testCase.recentColors.forEach((recent, index) => {
        expect(
          recent.right,
          `${label}: nedávná barva ${index + 1} vlevo od úchytu`,
        ).toBeLessThanOrEqual(testCase.handle.left + TOLERANCE);
      });
      expect(testCase.undo.left, `${label}: Zpět vpravo od úchytu`).toBeGreaterThanOrEqual(
        testCase.handle.right - TOLERANCE,
      );
    }
  });
});

describe('#96 AC3, AC6: otevřený panel se v obou krocích vejde vedle pruhu', () => {
  it('otevřený panel se v obou krocích celý vejde do viditelné plochy', () => {
    for (const testCase of openCases()) {
      expect(isInside(testCase.panelBox, testCase.visible), testCase.scene.label).toBe(true);
    }
  });

  it('otevřený panel v obou krocích nepřekryje domeček, úchyt, Zpět ani nedávné barvy', () => {
    for (const testCase of openCases()) {
      const { label } = testCase.scene;
      const strip: Array<[string, Box]> = [
        ['domeček', testCase.home],
        ['úchyt', testCase.handle],
        ['Zpět', testCase.undo],
        ...testCase.recentColors.map((box, index): [string, Box] => [
          `nedávná barva ${index + 1}`,
          box,
        ]),
      ];
      for (const [name, box] of strip) {
        expect(overlaps(testCase.panelBox, box), `${label}: panel překrývá ${name}`).toBe(false);
      }
    }
  });

  it('na šířku vyjíždí panel hned vedle pruhu vlevo, na výšku hned nad pruhem dole', () => {
    for (const testCase of openCases()) {
      const { label } = testCase.scene;
      const strip = boundsOf([testCase.handle, testCase.undo, ...testCase.recentColors]);
      const gap = testCase.landscape
        ? testCase.panelBox.left - strip.right
        : strip.top - testCase.panelBox.bottom;
      expect(gap, `${label}: mezera panel–pruh`).toBeGreaterThanOrEqual(-TOLERANCE);
      expect(gap, `${label}: mezera panel–pruh`).toBeLessThanOrEqual(MAX_PANEL_GAP_TO_STRIP);
    }
  });
});

describe('#96 AC4: dotyk na panelu nemaluje, domeček funguje i s otevřeným panelem', () => {
  it('dotyk kdekoli na otevřeném panelu v obou krocích, i v mezeře mezi tlačítky, nemaluje do obrázku', () => {
    for (const testCase of openCases()) {
      const { layout } = testCase;
      const points = [...gridIn(layout.panel, 24), ...gapPointsIn(testCase)];
      expect(
        gapPointsIn(testCase).length,
        `${testCase.scene.label}: body v mezerách`,
      ).toBeGreaterThan(0);
      for (const point of points) {
        const target = touchTargetAt(layout, testCase.panel, point.x, point.y);
        expect(
          target.kind,
          `${testCase.scene.label}: dotyk na panelu v ${Math.round(point.x)}, ${Math.round(point.y)}`,
        ).not.toBe('picture');
      }
    }
  });

  it('tah na viditelné části obrázku vedle otevřeného panelu maluje', () => {
    for (const testCase of openCases()) {
      const { layout } = testCase;
      const visiblePicture = gridIn(layout.picture, 24).filter(
        (point) => !containsPoint(layout.panel, point),
      );
      expect(visiblePicture.length, `${testCase.scene.label}: obrázek je vidět`).toBeGreaterThan(0);
      for (const point of visiblePicture) {
        expect(
          touchTargetAt(layout, testCase.panel, point.x, point.y),
          testCase.scene.label,
        ).toEqual({
          kind: 'picture',
        });
      }
    }
  });

  it('otevřený panel nepřekrývá domeček ani 8 px kolem něj, domeček jde dál podržet', () => {
    for (const testCase of openCases()) {
      const surrounding: Box = {
        left: testCase.home.left - MIN_TAP_GAP,
        right: testCase.home.right + MIN_TAP_GAP,
        top: testCase.home.top - MIN_TAP_GAP,
        bottom: testCase.home.bottom + MIN_TAP_GAP,
      };
      expect(overlaps(testCase.panelBox, surrounding), testCase.scene.label).toBe(false);
    }
  });
});

describe('#96 AC6: zavřený panel nemá na obrázku žádnou ťukací plochu', () => {
  it('se zavřeným panelem žádná ťukací plocha neleží na obrázku', () => {
    for (const testCase of cases().filter((each) => each.panel === 'closed')) {
      for (const item of testCase.scene.items.filter((each) => each.tappable === true)) {
        expect(overlaps(item.box, testCase.picture), `${testCase.scene.label}: ${item.name}`).toBe(
          false,
        );
      }
    }
  });

  it('se zavřeným panelem maluje dotyk kdekoli na obrázku, i tam, kde by byl panel', () => {
    for (const testCase of cases().filter((each) => each.panel === 'closed')) {
      const { layout } = testCase;
      for (const point of gridIn(layout.picture, 24)) {
        expect(touchTargetAt(layout, 'closed', point.x, point.y), testCase.scene.label).toEqual({
          kind: 'picture',
        });
      }
    }
  });
});
