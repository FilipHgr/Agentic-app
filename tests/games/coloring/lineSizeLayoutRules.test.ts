import { describe, expect, it } from 'vitest';

import { brushWidthFor } from '../../../src/games/coloring/logic/coloring';
import {
  handleFace,
  sizeToggleDot,
  touchTargetAt,
} from '../../../src/games/coloring/logic/coloringLayout';
import type { LayoutCircle, LayoutRect } from '../../../src/games/coloring/logic/coloringLayout';
import type { LineSize } from '../../../src/games/coloring/logic/toolPanel';
import { widthOf } from '../../shared/viewportFixtures';
import { coloringCases } from './coloringLayoutScenes';
import type { ColoringCase } from './coloringLayoutScenes';
import { SIZES, SIZE_NAMES, TOOL_FACTOR } from './lineSizeHelpers';

/**
 * Testy rozložení k #91 v upraveném znění AC1 (přepínač v panelu na místě
 * vyhrazeném v #96, tečka velikosti v přepínači i v úchytu) a AC3 (nejtenčí
 * stopa aspoň 3 CSS px na obrazovce). Společná pravidla rozložení z #96
 * (64 px, 8 px, nic se nepřekrývá, vejde se) platí pro přepínač beze změny
 * v `toolPanelLayoutRules.test.ts`. Každé pravidlo projde v cyklu všechna
 * okna z `coloringLayoutScenes.ts` (zavřený i otevřený panel) a všechny
 * tři velikosti; popis případu je v `expect`.
 *
 * Navržené rozhraní (`src/games/coloring/logic/coloringLayout.ts`, herní
 * jednotky jako ostatní rozložení):
 * - `interface LayoutCircle { centerX: number; centerY: number; diameter: number }`,
 * - `handleFace(handle: LayoutRect, size: LineSize): { icon: LayoutRect; sizeDot: LayoutCircle }`
 *   kam úchyt kreslí ikonu nástroje a tečku velikosti,
 * - `sizeToggleDot(toggle: LayoutRect, size: LineSize): LayoutCircle`
 *   tečka velikosti v přepínači.
 * Scéna kreslí ikonu úchytu do `icon` a tečky přesně podle těchto kruhů.
 */

/** Tolerance na zaokrouhlení v herních jednotkách. */
const TOLERANCE = 1e-6;

/** Nejtenčí stopa na obrazovce (AC3) v CSS px. */
const MIN_TRACE_CSS = 3;

/** Nejmenší plocha omalovánky z AC3: kratší strana 240 CSS px, poměr 4 : 3. */
const SMALLEST_PICTURE_WIDTH_CSS = 240 * (4 / 3);

/** Průměry tečky v úchytu v poměru 1 : 2 : 3 (AC1). */
const HANDLE_DOT_RATIO: Record<LineSize, number> = { small: 1, medium: 2, large: 3 };

let cached: ColoringCase[] | undefined;

function cases(): ColoringCase[] {
  cached ??= coloringCases();
  return cached;
}

function centerOf(rect: LayoutRect): { x: number; y: number } {
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

function sideOf(rect: LayoutRect): number {
  return Math.min(rect.width, rect.height);
}

/** Leží celý kruh v obdélníku? */
function circleInside(circle: LayoutCircle, rect: LayoutRect): boolean {
  const radius = circle.diameter / 2;
  return (
    circle.centerX - radius >= rect.left - TOLERANCE &&
    circle.centerX + radius <= rect.left + rect.width + TOLERANCE &&
    circle.centerY - radius >= rect.top - TOLERANCE &&
    circle.centerY + radius <= rect.top + rect.height + TOLERANCE
  );
}

/** Překrývá se kruh s obdélníkem (dotyk na hraně se nepočítá)? */
function circleOverlapsRect(circle: LayoutCircle, rect: LayoutRect): boolean {
  const nearestX = Math.max(rect.left, Math.min(circle.centerX, rect.left + rect.width));
  const nearestY = Math.max(rect.top, Math.min(circle.centerY, rect.top + rect.height));
  const distance = Math.hypot(circle.centerX - nearestX, circle.centerY - nearestY);
  return distance < circle.diameter / 2 - TOLERANCE;
}

function rectInside(inner: LayoutRect, outer: LayoutRect): boolean {
  return (
    inner.left >= outer.left - TOLERANCE &&
    inner.top >= outer.top - TOLERANCE &&
    inner.left + inner.width <= outer.left + outer.width + TOLERANCE &&
    inner.top + inner.height <= outer.top + outer.height + TOLERANCE
  );
}

/** Každé okno s každou velikostí, s popisem pro hlášení. */
function sizeCases(): Array<{ testCase: ColoringCase; size: LineSize; name: string }> {
  return cases().flatMap((testCase) =>
    SIZES.map((size) => ({ testCase, size, name: `${testCase.scene.label}, ${SIZE_NAMES[size]}` })),
  );
}

describe('#91 AC1: přepínač velikosti je v panelu na vyhrazeném místě', () => {
  it('ťuknutí na přepínač v kroku nástrojů jde na přepínač ve všech oknech', () => {
    for (const testCase of cases().filter((each) => each.panel === 'tools')) {
      const { x, y } = centerOf(testCase.layout.sizeToggle);
      expect(touchTargetAt(testCase.layout, 'tools', x, y), testCase.scene.label).toEqual({
        kind: 'sizeToggle',
      });
    }
  });

  it('se zavřeným panelem ani v kroku barev ťuknutí na místo přepínače velikost nepřepne', () => {
    for (const testCase of cases().filter((each) => each.panel !== 'tools')) {
      const { x, y } = centerOf(testCase.layout.sizeToggle);
      expect(
        touchTargetAt(testCase.layout, testCase.panel, x, y).kind,
        testCase.scene.label,
      ).not.toBe('sizeToggle');
    }
  });

  it('tečka v přepínači leží celá v přepínači ve všech oknech a velikostech', () => {
    for (const { testCase, size, name } of sizeCases()) {
      const dot = sizeToggleDot(testCase.layout.sizeToggle, size);
      expect(dot.diameter, `${name}: tečka je vidět`).toBeGreaterThan(0);
      expect(circleInside(dot, testCase.layout.sizeToggle), `${name}: tečka v přepínači`).toBe(
        true,
      );
    }
  });

  it('tečka v přepínači je u malé velikosti nejmenší a u velké největší ve všech oknech', () => {
    for (const testCase of cases()) {
      const [small, medium, large] = SIZES.map(
        (size) => sizeToggleDot(testCase.layout.sizeToggle, size).diameter,
      );
      const name = testCase.scene.label;
      expect(small, `${name}: malá < střední`).toBeLessThan(medium ?? 0);
      expect(medium, `${name}: střední < velká`).toBeLessThan(large ?? 0);
    }
  });
});

describe('#91 AC1: úchyt ukazuje ikonu nástroje a tečku velikosti', () => {
  it('ikona nástroje leží v úchytu a její střed je v prostřední třetině úchytu', () => {
    for (const { testCase, size, name } of sizeCases()) {
      const { handle } = testCase.layout;
      const { icon } = handleFace(handle, size);
      const iconCenter = centerOf(icon);
      const handleCenter = centerOf(handle);
      expect(icon.width * icon.height, `${name}: ikona je vidět`).toBeGreaterThan(0);
      expect(rectInside(icon, handle), `${name}: ikona v úchytu`).toBe(true);
      expect(
        Math.abs(iconCenter.x - handleCenter.x),
        `${name}: ikona uprostřed (vodorovně)`,
      ).toBeLessThanOrEqual(handle.width / 6);
      expect(
        Math.abs(iconCenter.y - handleCenter.y),
        `${name}: ikona uprostřed (svisle)`,
      ).toBeLessThanOrEqual(handle.height / 6);
    }
  });

  it('tečka velikosti leží celá v úchytu v jeho pravém dolním rohu', () => {
    for (const { testCase, size, name } of sizeCases()) {
      const { handle } = testCase.layout;
      const { sizeDot } = handleFace(handle, size);
      const handleCenter = centerOf(handle);
      expect(sizeDot.diameter, `${name}: tečka je vidět`).toBeGreaterThan(0);
      expect(circleInside(sizeDot, handle), `${name}: tečka v úchytu`).toBe(true);
      expect(sizeDot.centerX, `${name}: tečka vpravo`).toBeGreaterThan(handleCenter.x);
      expect(sizeDot.centerY, `${name}: tečka dole`).toBeGreaterThan(handleCenter.y);
    }
  });

  it('tečka velikosti se nepřekrývá s ikonou nástroje', () => {
    for (const { testCase, size, name } of sizeCases()) {
      const { icon, sizeDot } = handleFace(testCase.layout.handle, size);
      expect(circleOverlapsRect(sizeDot, icon), name).toBe(false);
    }
  });

  it('průměry tečky velikosti v úchytu jsou v poměru 1 : 2 : 3', () => {
    for (const testCase of cases()) {
      const diameters = SIZES.map(
        (size) => handleFace(testCase.layout.handle, size).sizeDot.diameter,
      );
      const unit = (diameters[0] ?? 0) / HANDLE_DOT_RATIO.small;
      SIZES.forEach((size, index) => {
        expect(diameters[index], `${testCase.scene.label}, ${SIZE_NAMES[size]}`).toBeCloseTo(
          unit * HANDLE_DOT_RATIO[size],
          6,
        );
      });
    }
  });

  it('velká tečka má průměr nejvýš čtvrtinu strany úchytu', () => {
    for (const testCase of cases()) {
      const { handle } = testCase.layout;
      const { sizeDot } = handleFace(handle, 'large');
      expect(sizeDot.diameter, testCase.scene.label).toBeLessThanOrEqual(
        sideOf(handle) / 4 + TOLERANCE,
      );
    }
  });
});

describe('#91 AC3: nejtenčí stopa je na obrazovce aspoň 3 CSS px', () => {
  /** Šířka stopy pastelky malé velikosti na obrazovce pro plochu široké `pictureCss` CSS px. */
  function thinnestTraceCss(pictureCss: number): number {
    // Šířka W je díl šířky plochy, proto stačí počítat rovnou v CSS px plochy.
    const smallW = brushWidthFor(pictureCss, 'small');
    expect(smallW, 'W malé velikosti je 1/50 šířky plochy (AC2)').toBeCloseTo(pictureCss / 50, 6);
    return TOOL_FACTOR.crayon * smallW;
  }

  it('na nejmenší ploše (kratší strana 240 px) má pastelka malé velikosti aspoň 3 CSS px', () => {
    expect(thinnestTraceCss(SMALLEST_PICTURE_WIDTH_CSS)).toBeGreaterThanOrEqual(MIN_TRACE_CSS);
  });

  it('pastelka malé velikosti má aspoň 3 CSS px ve všech oknech, kde se Omalovánky hrají', () => {
    for (const testCase of cases()) {
      const pictureCss = widthOf(testCase.picture);
      expect(
        thinnestTraceCss(pictureCss),
        `${testCase.scene.label} (plocha ${pictureCss.toFixed(1)} px)`,
      ).toBeGreaterThanOrEqual(MIN_TRACE_CSS);
    }
  });
});
