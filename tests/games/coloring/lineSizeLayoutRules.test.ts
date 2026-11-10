import { describe, expect, it } from 'vitest';

import { brushWidthFor } from '../../../src/games/coloring/logic/coloring';
import {
  handleArrow,
  handleColorDot,
  handleFace,
} from '../../../src/games/coloring/logic/coloringLayout';
import type { LayoutCircle, LayoutRect } from '../../../src/games/coloring/logic/coloringLayout';
import { HANDLE_COLOR_DOT_STYLE } from '../../../src/games/coloring/logic/theme';
import type { LineSize } from '../../../src/games/coloring/logic/toolPanel';
import { widthOf } from '../../shared/viewportFixtures';
import { coloringCases, isOpen } from './coloringLayoutScenes';
import type { ColoringCase } from './coloringLayoutScenes';
import { SIZES, SIZE_NAMES, TOOL_FACTOR } from './lineSizeHelpers';

/**
 * Testy rozložení k #91 v upraveném znění AC1 (v úchytu tečku velikosti
 * podle #106 nahradilo kolečko barvy) a AC3 (stopa malé tloušťky
 * aspoň 3 CSS px na obrazovce, nejtenčí z #118 je vědomě tenčí). Společná pravidla rozložení z #96
 * (64 px, 8 px, nic se nepřekrývá, vejde se) platí pro tlačítka tloušťky
 * v `toolPanelLayoutRules.test.ts`. Každé pravidlo projde v cyklu všechna
 * okna z `coloringLayoutScenes.ts` (zavřený i otevřený panel) a všechny
 * tři velikosti; popis případu je v `expect`.
 *
 * Navržené rozhraní (`src/games/coloring/logic/coloringLayout.ts`, herní
 * jednotky jako ostatní rozložení):
 * - `interface LayoutCircle { centerX: number; centerY: number; diameter: number }`,
 * - `handleFace(handle: LayoutRect, size: LineSize): { icon: LayoutRect; ... }`
 *   kam úchyt kreslí ikonu nástroje; tečku velikosti v úchytu nahradilo
 *   kolečko barvy z #106 `handleColorDot(handle: LayoutRect, size: LineSize): LayoutCircle`
 *   (průměr barevné výplně, lem a linka z `HANDLE_COLOR_DOT_STYLE` vně),
 * Scéna kreslí ikonu úchytu do `icon` a kolečko přesně podle tohoto kruhu.
 *
 * Testy přepínače s tečkou (#91 AC1: ťuknutí jde na přepínač, se zavřeným
 * panelem a v kroku barev ne, tečka leží v přepínači, tečky rostou s
 * velikostí) nahradily od #112 testy tří tlačítek tloušťky
 * v `lineSizeButtonsLayoutRules.test.ts`.
 */

/** Tolerance na zaokrouhlení v herních jednotkách. */
const TOLERANCE = 1e-6;

/** Stopa malé tloušťky na obrazovce (AC3) v CSS px. */
const MIN_TRACE_CSS = 3;

/** Nejmenší plocha omalovánky z AC3: kratší strana 240 CSS px, poměr 4 : 3. */
const SMALLEST_PICTURE_WIDTH_CSS = 240 * (4 / 3);

/**
 * Kolečko barvy v úchytu (#106, nahrazuje tečku velikosti): výplň aspoň
 * 12 CSS px. Celé kolečko i s bílým lemem a šedou linkou nejvýš 0,32 strany
 * úchytu: čtvrtina (16 px u úchytu 64 px) se při výplni 12 px a lemu 2 + 1 px
 * nevejde (18 px), maketa `sada-1.png` má 14 + 2 × 2 + 2 × 1 = 20 px, tj. 0,3125.
 */
const MIN_COLOR_DOT_CSS = 12;
const MAX_COLOR_DOT_SHARE = 0.32;

/**
 * Ikona v úchytu (#106): aspoň 0,45 strany (rozhodnutí koordinátora) a smí
 * být posunutá vlevo nahoru nejvýš o 0,2 strany. Maketa `sada-1.png` ji má
 * posunutou o 0,07 strany vlevo i nahoru, ale nemá šipku; aby se do úchytu
 * 64 px vešla šipka obou orientací i kolečko, musí jít ikona nahoru asi
 * o 0,16 až 0,18 strany. Vpravo a dolů platí dál nejvýš 1/6 strany.
 */
const MIN_HANDLE_ICON_SHARE = 0.45;
const MAX_ICON_SHIFT_SHARE = 0.2;

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
/** Kolečko barvy v úchytu i s bílým lemem a šedou linkou, v herních jednotkách. */
function colorDotWithRim(testCase: ColoringCase, size: LineSize): LayoutCircle {
  const fill = handleColorDot(testCase.layout.handle, size);
  const rimCss = HANDLE_COLOR_DOT_STYLE.rimCss + HANDLE_COLOR_DOT_STYLE.lineCss;
  return { ...fill, diameter: fill.diameter + (2 * rimCss) / testCase.area.scale };
}

function sizeCases(): Array<{ testCase: ColoringCase; size: LineSize; name: string }> {
  return cases().flatMap((testCase) =>
    SIZES.map((size) => ({ testCase, size, name: `${testCase.scene.label}, ${SIZE_NAMES[size]}` })),
  );
}

describe('#91 AC1 a #106: úchyt ukazuje ikonu nástroje a kolečko barvy velké podle velikosti čáry', () => {
  it('ikona nástroje leží v úchytu, je aspoň 0,45 strany a smí být posunutá vlevo nahoru', () => {
    for (const { testCase, size, name } of sizeCases()) {
      const { handle } = testCase.layout;
      const { icon } = handleFace(handle, size);
      const iconCenter = centerOf(icon);
      const handleCenter = centerOf(handle);
      const side = sideOf(handle);
      expect(rectInside(icon, handle), `${name}: ikona v úchytu`).toBe(true);
      expect(sideOf(icon), `${name}: ikona aspoň 0,45 strany úchytu`).toBeGreaterThanOrEqual(
        MIN_HANDLE_ICON_SHARE * side - TOLERANCE,
      );
      const towardsRight = iconCenter.x - handleCenter.x;
      const towardsBottom = iconCenter.y - handleCenter.y;
      expect(
        towardsRight,
        `${name}: ikona nejvýš o 1/6 strany vpravo od středu`,
      ).toBeLessThanOrEqual(side / 6 + TOLERANCE);
      expect(towardsBottom, `${name}: ikona nejvýš o 1/6 strany pod středem`).toBeLessThanOrEqual(
        side / 6 + TOLERANCE,
      );
      expect(
        -towardsRight,
        `${name}: ikona nejvýš o ${MAX_ICON_SHIFT_SHARE} strany vlevo od středu`,
      ).toBeLessThanOrEqual(MAX_ICON_SHIFT_SHARE * side + TOLERANCE);
      expect(
        -towardsBottom,
        `${name}: ikona nejvýš o ${MAX_ICON_SHIFT_SHARE} strany nad středem`,
      ).toBeLessThanOrEqual(MAX_ICON_SHIFT_SHARE * side + TOLERANCE);
    }
  });

  it('kolečko barvy leží i s lemem celé v úchytu v jeho pravém dolním rohu', () => {
    for (const { testCase, size, name } of sizeCases()) {
      const { handle } = testCase.layout;
      const dot = colorDotWithRim(testCase, size);
      const handleCenter = centerOf(handle);
      expect(dot.diameter, `${name}: kolečko je vidět`).toBeGreaterThan(0);
      expect(circleInside(dot, handle), `${name}: kolečko v úchytu`).toBe(true);
      expect(dot.centerX, `${name}: kolečko vpravo`).toBeGreaterThan(handleCenter.x);
      expect(dot.centerY, `${name}: kolečko dole`).toBeGreaterThan(handleCenter.y);
    }
  });

  it('kolečko barvy i s lemem se nepřekrývá s ikonou nástroje ani se šipkou panelu', () => {
    for (const { testCase, size, name } of sizeCases()) {
      const { handle, panelSlidesFrom } = testCase.layout;
      const dot = colorDotWithRim(testCase, size);
      const { icon } = handleFace(handle, size);
      const arrow = handleArrow(handle, panelSlidesFrom, isOpen(testCase));
      expect(circleOverlapsRect(dot, icon), `${name}: kolečko na ikoně`).toBe(false);
      expect(circleOverlapsRect(dot, arrow), `${name}: kolečko na šipce`).toBe(false);
    }
  });

  it('kolečko barvy je s tlustší čárou větší a jeho barva má i u nejtenčí čáry aspoň 12 px', () => {
    for (const testCase of cases()) {
      const [small, medium, large] = SIZES.map(
        (size) => handleColorDot(testCase.layout.handle, size).diameter,
      );
      const name = testCase.scene.label;
      expect(small, `${name}: malá < střední`).toBeLessThan((medium ?? 0) - TOLERANCE);
      expect(medium, `${name}: střední < velká`).toBeLessThan((large ?? 0) - TOLERANCE);
      expect(
        (small ?? 0) * testCase.area.scale,
        `${name}: výplň malé v CSS px`,
      ).toBeGreaterThanOrEqual(MIN_COLOR_DOT_CSS - TOLERANCE);
    }
  });

  it('velké kolečko i s lemem má průměr nejvýš jako v maketě (0,32 strany úchytu)', () => {
    for (const testCase of cases()) {
      const { handle } = testCase.layout;
      const dot = colorDotWithRim(testCase, 'large');
      expect(dot.diameter, testCase.scene.label).toBeLessThanOrEqual(
        MAX_COLOR_DOT_SHARE * sideOf(handle) + TOLERANCE,
      );
    }
  });
});

// Upraveno k #118: nejtenčí z #118 je vědomě tenčí.
describe('#91 AC3: stopa malé tloušťky je na obrazovce aspoň 3 CSS px', () => {
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
