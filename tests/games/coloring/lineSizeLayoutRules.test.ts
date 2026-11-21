import { describe, expect, it } from 'vitest';

import { brushWidthFor } from '../../../src/games/coloring/logic/coloring';
import { quickToolColorDot } from '../../../src/games/coloring/logic/coloringLayout';
import type { LayoutCircle, LayoutRect } from '../../../src/games/coloring/logic/coloringLayout';
import { HANDLE_COLOR_DOT_STYLE } from '../../../src/games/coloring/logic/theme';
import type { LineSize } from '../../../src/games/coloring/logic/toolPanel';
import { widthOf } from '../../shared/viewportFixtures';
import { coloringCases } from './coloringLayoutScenes';
import type { ColoringCase } from './coloringLayoutScenes';
import { SIZES, SIZE_NAMES, TOOL_FACTOR } from './lineSizeHelpers';
import { handleSymbolOf } from './toolIconHelpers';

/**
 * Testy rozložení k #91 v upraveném znění AC1 (tečku velikosti v úchytu
 * podle #106 nahradilo kolečko barvy, od #164 AC4 na prvním tlačítku
 * rychlého přepínání; úchyt má stálý symbol panelu) a AC3 (stopa malé tloušťky
 * aspoň 3 CSS px na obrazovce, nejtenčí z #118 je vědomě tenčí). Společná pravidla rozložení z #96
 * (64 px, 8 px, nic se nepřekrývá, vejde se) platí pro tlačítka tloušťky
 * v `toolPanelLayoutRules.test.ts`. Každé pravidlo projde v cyklu všechna
 * okna z `coloringLayoutScenes.ts` (zavřený i otevřený panel) a všechny
 * tři velikosti; popis případu je v `expect`.
 *
 * Navržené rozhraní (`src/games/coloring/logic/coloringLayout.ts`, herní
 * jednotky jako ostatní rozložení):
 * - `interface LayoutCircle { centerX: number; centerY: number; diameter: number }`,
 * - `handleSymbol(handle, slidesFrom, panelOpen, outline): LayoutRect` kam
 *   úchyt kreslí svůj stálý symbol panelu (#164, od #165 se šipkou
 *   dohromady uprostřed úchytu),
 * - `quickToolColorDot(slot: LayoutRect, size: LineSize): LayoutCircle`
 *   kolečko barvy na prvním tlačítku rychlého přepínání (#164 AC4, dřív
 *   `handleColorDot` v úchytu; průměr barevné výplně, lem a linka
 *   z `HANDLE_COLOR_DOT_STYLE` vně).
 * Scéna kreslí symbol do čtverce a kolečko přesně podle tohoto kruhu.
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
 * Kolečko barvy na prvním tlačítku (#106, nahrazuje tečku velikosti, od
 * #164 místo v úchytu): výplň aspoň 12 CSS px. Horní mez 0,32 strany
 * tlačítka z makety `sada-1.png` od #174 neplatí (viz konec bloku níž).
 */
const MIN_COLOR_DOT_CSS = 12;

/**
 * Symbol v úchytu (#164, na místě ikony nástroje z #106): aspoň 0,45 strany (rozhodnutí koordinátora) a smí
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

function rectInside(inner: LayoutRect, outer: LayoutRect): boolean {
  return (
    inner.left >= outer.left - TOLERANCE &&
    inner.top >= outer.top - TOLERANCE &&
    inner.left + inner.width <= outer.left + outer.width + TOLERANCE &&
    inner.top + inner.height <= outer.top + outer.height + TOLERANCE
  );
}

/** Kolečko barvy na prvním tlačítku i s bílým lemem a šedou linkou, v herních jednotkách. */
function colorDotWithRim(testCase: ColoringCase, size: LineSize): LayoutCircle {
  const fill = quickToolColorDot(testCase.layout.quickDrawingToolButton, size);
  const rimCss = HANDLE_COLOR_DOT_STYLE.rimCss + HANDLE_COLOR_DOT_STYLE.lineCss;
  return { ...fill, diameter: fill.diameter + (2 * rimCss) / testCase.area.scale };
}

/** Každé okno s každou velikostí, s popisem pro hlášení. */
function sizeCases(): Array<{ testCase: ColoringCase; size: LineSize; name: string }> {
  return cases().flatMap((testCase) =>
    SIZES.map((size) => ({ testCase, size, name: `${testCase.scene.label}, ${SIZE_NAMES[size]}` })),
  );
}

// Přepsáno k #164: úchyt už neukazuje ikonu nástroje ani kolečko barvy.
// Symbol panelu zůstal na místě ikony (AC1, AC3), kolečko velké podle
// velikosti čáry je na prvním tlačítku rychlého přepínání (AC4).
describe('#91 AC1, #106 a #164: symbol v úchytu a kolečko barvy na prvním tlačítku velké podle velikosti čáry', () => {
  it('symbol panelu leží v úchytu, je aspoň 0,45 strany a smí být posunutý vlevo nahoru', () => {
    for (const testCase of cases()) {
      const name = testCase.scene.label;
      const { handle } = testCase.layout;
      const icon = handleSymbolOf(testCase);
      const iconCenter = centerOf(icon);
      const handleCenter = centerOf(handle);
      const side = sideOf(handle);
      expect(rectInside(icon, handle), `${name}: symbol v úchytu`).toBe(true);
      expect(sideOf(icon), `${name}: symbol aspoň 0,45 strany úchytu`).toBeGreaterThanOrEqual(
        MIN_HANDLE_ICON_SHARE * side - TOLERANCE,
      );
      const towardsRight = iconCenter.x - handleCenter.x;
      const towardsBottom = iconCenter.y - handleCenter.y;
      expect(
        towardsRight,
        `${name}: symbol nejvýš o 1/6 strany vpravo od středu`,
      ).toBeLessThanOrEqual(side / 6 + TOLERANCE);
      expect(towardsBottom, `${name}: symbol nejvýš o 1/6 strany pod středem`).toBeLessThanOrEqual(
        side / 6 + TOLERANCE,
      );
      expect(
        -towardsRight,
        `${name}: symbol nejvýš o ${MAX_ICON_SHIFT_SHARE} strany vlevo od středu`,
      ).toBeLessThanOrEqual(MAX_ICON_SHIFT_SHARE * side + TOLERANCE);
      expect(
        -towardsBottom,
        `${name}: symbol nejvýš o ${MAX_ICON_SHIFT_SHARE} strany nad středem`,
      ).toBeLessThanOrEqual(MAX_ICON_SHIFT_SHARE * side + TOLERANCE);
    }
  });

  it('kolečko barvy leží i s lemem celé v prvním tlačítku v jeho pravém dolním rohu', () => {
    for (const { testCase, size, name } of sizeCases()) {
      const button = testCase.layout.quickDrawingToolButton;
      const dot = colorDotWithRim(testCase, size);
      const buttonCenter = centerOf(button);
      expect(dot.diameter, `${name}: kolečko je vidět`).toBeGreaterThan(0);
      expect(circleInside(dot, button), `${name}: kolečko v tlačítku`).toBe(true);
      expect(dot.centerX, `${name}: kolečko vpravo`).toBeGreaterThan(buttonCenter.x);
      expect(dot.centerY, `${name}: kolečko dole`).toBeGreaterThan(buttonCenter.y);
    }
  });

  it('kolečko barvy na prvním tlačítku je s tlustší čárou větší a jeho barva má i u nejtenčí čáry aspoň 12 px', () => {
    for (const testCase of cases()) {
      const [small, medium, large] = SIZES.map(
        (size) => quickToolColorDot(testCase.layout.quickDrawingToolButton, size).diameter,
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

  // Pravidlo „velké kolečko i s lemem nejvýš 0,32 strany jako v maketě“
  // nahradilo #174 AC2: kolečko roste výrazněji a hlídá se, že je celé
  // uvnitř silného okraje tlačítka, zakryje nejvýš 25 % ikony a od duhy je
  // aspoň 3 px (`quickToolColorDotLayoutRules.test.ts`).
});

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
