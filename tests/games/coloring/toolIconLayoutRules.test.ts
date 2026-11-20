import { describe, expect, it } from 'vitest';

import { handleArrow } from '../../../src/games/coloring/logic/coloringLayout';
import { HANDLE_STYLE } from '../../../src/games/coloring/logic/theme';
import { HANDLE_ICON_FILE } from '../../../src/games/coloring/logic/toolIcons';
import { toCss } from '../../shared/viewportFixtures';
import type { Box } from '../../shared/viewportFixtures';
import { boxOfRect, coloringCases, isOpen } from './coloringLayoutScenes';
import type { ColoringCase } from './coloringLayoutScenes';
import { maskOfSvg } from './toolIconMaskHelpers';
import {
  MIN_MARGIN_SHARE,
  TOOLS,
  TOOL_NAMES,
  colorStepIconBox,
  handleSymbolBox,
  iconSvgOfFile,
  limited,
  sideOfBox,
  slotIconBox,
} from './toolIconHelpers';

/**
 * Testy rozložení k #106 v novém znění po připomínce vlastníka: AC2 ikona
 * se vejde do místa v panelu s odstupem. Od #164 má úchyt místo ikony
 * vybraného nástroje stálý symbol panelu (paletu) se stejným středem,
 * který se i s tmavým obrysem (#164 AC5) vejde do úchytu a nepřekrývá
 * šipku. Měří se neprůhledná část palety (maska ze SVG) plus obrys. Kolečko barvy velké podle
 * velikosti čáry, které bylo v rohu úchytu, je od #164 AC4 na prvním
 * tlačítku rychlého přepínání; jeho pravidla (dřív tady) jsou
 * v `quickToolColorDotLayoutRules.test.ts`. Každé pravidlo projde v cyklu
 * všechna okna z `coloringLayoutScenes.ts` (iPad, telefon na šířku i na
 * výšku, okna z plochy, zavřený panel i oba kroky #105); popis případu je
 * v `expect`.
 *
 * Ikona je hotové SVG Noto (plocha 128 × 128), které scéna kreslí do
 * celého svého čtverce. Měří se proto čtverec ikony, ne její pixely.
 *
 * Kolečko barvy a ikona v místě nástroje v panelu a v hlavičce kroku barev
 * (#110, upravené v #114) jsou v `toolIconSlotDotLayoutRules.test.ts`.
 *
 * Rozhraní (`src/games/coloring/logic/coloringLayout.ts`, herní jednotky):
 * - čtverec ikony určují `toolSlotIcon(slot)` (panel i hlavička kroku
 *   barev) a `handleSymbol(handle)` (symbol úchytu, #164),
 * - `handleArrow(handle, slidesFrom, panelOpen)` obdélník šipky (beze změny).
 *
 * #165 AC1: symbol i s obrysem a šipka tvoří skupinu (obdélník kolem obou)
 * vystředěnou v úchytu na šířku i na výšku. Skupina je vystředěná, když se
 * odstupy od protilehlých okrajů úchytu liší nejvýš o 1 CSS px. Výjimka
 * plyne z AC2 a AC3: kde šipka (beze změny) sama sahá blíž k okraji než
 * 10 % strany (na výšku se zavřeným panelem až k okraji), skupinu víc
 * vystředit nejde; symbol pak musí být co nejblíž středu, tedy přesně
 * 10 % strany od protějšího okraje.
 */

/** Rezerva na zaokrouhlení v CSS px. */
const TOLERANCE = 0.01;

let cached: ColoringCase[] | undefined;

function cases(): ColoringCase[] {
  cached ??= coloringCases();
  return cached;
}

function casesIn(panel: ColoringCase['panel']): ColoringCase[] {
  return cases().filter((testCase) => testCase.panel === panel);
}

function label(testCase: ColoringCase, rest: string): string {
  return `${testCase.scene.label}, ${rest}`;
}

/** Nejmenší odstup `inner` od okraje `outer` (záporný, když přesahuje). */
function marginInside(inner: Box, outer: Box): number {
  return Math.min(
    inner.left - outer.left,
    outer.right - inner.right,
    inner.top - outer.top,
    outer.bottom - inner.bottom,
  );
}

/** Problém s odstupem čtverce ikony od okraje místa, nebo `null`. */
function marginProblem(icon: Box, place: Box): string | null {
  if (sideOfBox(icon) <= 0) {
    return 'ikona nemá žádnou velikost';
  }
  const needed = MIN_MARGIN_SHARE * sideOfBox(place);
  const margin = marginInside(icon, place);
  return margin + TOLERANCE >= needed
    ? null
    : `odstup od okraje ${margin.toFixed(2)} px, potřeba ${needed.toFixed(2)} px`;
}

/** Neprůhledná část palety jako díly strany jejího čtverce (0 až 1), spočítaná jednou. */
let paletteBounds: { left: number; right: number; top: number; bottom: number } | undefined;

function symbolShapeBounds(): { left: number; right: number; top: number; bottom: number } {
  if (paletteBounds !== undefined) {
    return paletteBounds;
  }
  const mask = maskOfSvg(iconSvgOfFile(HANDLE_ICON_FILE));
  const bounds = { left: 1, right: 0, top: 1, bottom: 0 };
  for (let row = 0; row < mask.samples; row += 1) {
    for (let column = 0; column < mask.samples; column += 1) {
      if (mask.opaque[row * mask.samples + column] === 1) {
        bounds.left = Math.min(bounds.left, column / mask.samples);
        bounds.right = Math.max(bounds.right, (column + 1) / mask.samples);
        bounds.top = Math.min(bounds.top, row / mask.samples);
        bounds.bottom = Math.max(bounds.bottom, (row + 1) / mask.samples);
      }
    }
  }
  paletteBounds = bounds;
  return bounds;
}

/**
 * Obdélník, který symbol skutečně zabere (neprůhledná část palety) i s tmavým
 * obrysem, který hra kreslí vně tvaru (#164 AC5), v CSS px okna.
 */
function outlinedSymbolBox(testCase: ColoringCase): Box {
  const square = handleSymbolBox(testCase);
  const side = sideOfBox(square);
  const shape = symbolShapeBounds();
  const outline = HANDLE_STYLE.symbolOutlineCss;
  return {
    left: square.left + shape.left * side - outline,
    right: square.left + shape.right * side + outline,
    top: square.top + shape.top * side - outline,
    bottom: square.top + shape.bottom * side + outline,
  };
}

/** Neprůhledné body palety jako díly strany jejího čtverce, spočítané jednou. */
let palettePoints: { u: number; v: number }[] | undefined;

function symbolShapePoints(): { u: number; v: number }[] {
  if (palettePoints === undefined) {
    const mask = maskOfSvg(iconSvgOfFile(HANDLE_ICON_FILE));
    palettePoints = [];
    for (let row = 0; row < mask.samples; row += 1) {
      for (let column = 0; column < mask.samples; column += 1) {
        if (mask.opaque[row * mask.samples + column] === 1) {
          palettePoints.push({ u: (column + 0.5) / mask.samples, v: (row + 0.5) / mask.samples });
        }
      }
    }
  }
  return palettePoints;
}

/**
 * Odstup tmavého obrysu symbolu od obdélníku `box` v CSS px (záporný, když
 * do něj zasahuje): nejmenší vzdálenost neprůhledného bodu palety od
 * obdélníku bez šířky obrysu a přesahu vzorku.
 */
function outlinedSymbolGapTo(testCase: ColoringCase, box: Box): number {
  const square = handleSymbolBox(testCase);
  const side = sideOfBox(square);
  let smallest = Number.POSITIVE_INFINITY;
  for (const point of symbolShapePoints()) {
    const x = square.left + point.u * side;
    const y = square.top + point.v * side;
    const dx = Math.max(box.left - x, 0, x - box.right);
    const dy = Math.max(box.top - y, 0, y - box.bottom);
    smallest = Math.min(smallest, Math.hypot(dx, dy));
  }
  return smallest - HANDLE_STYLE.symbolOutlineCss - (Math.SQRT1_2 * side) / 256;
}

/** Nejvýš o tolik CSS px se smí lišit odstupy vystředěné skupiny od okrajů (#165 AC1). */
const CENTERED_TOLERANCE_CSS = 1;

/** Obdélník kolem obou obdélníků. */
function unionOf(first: Box, second: Box): Box {
  return {
    left: Math.min(first.left, second.left),
    right: Math.max(first.right, second.right),
    top: Math.min(first.top, second.top),
    bottom: Math.max(first.bottom, second.bottom),
  };
}

/**
 * Problém s vystředěním skupiny na jedné ose, nebo `null`: odstupy od
 * protilehlých okrajů se liší nejvýš o 1 CSS px, nebo je větší odstup
 * přesně nejmenší povolený (10 % strany) a menší odstup (šipka) pod ním.
 */
function centeringProblem(
  axis: string,
  first: number,
  second: number,
  side: number,
): string | null {
  if (Math.abs(first - second) <= CENTERED_TOLERANCE_CSS + TOLERANCE) {
    return null;
  }
  const smallest = MIN_MARGIN_SHARE * side;
  const larger = Math.max(first, second);
  const smaller = Math.min(first, second);
  if (Math.abs(larger - smallest) <= TOLERANCE && smaller < smallest) {
    return null;
  }
  return `${axis}: odstupy skupiny ${first.toFixed(2)} a ${second.toFixed(2)} px`;
}

/** Obdélník šipky úchytu v CSS px. */
function arrowBox(testCase: ColoringCase): Box {
  return toCss(
    boxOfRect(
      handleArrow(testCase.layout.handle, testCase.layout.panelSlidesFrom, isOpen(testCase)),
    ),
    testCase.area,
  );
}

describe('#106 AC2: ikona se vejde do místa v panelu i do úchytu', () => {
  it('ikona nástroje je celá v místě v panelu s odstupem aspoň 10 % strany místa', () => {
    const problems = casesIn('tools').flatMap((testCase) =>
      TOOLS.flatMap((tool, index) => {
        const problem = marginProblem(slotIconBox(testCase, index), testCase.tools[index] as Box);
        return problem === null
          ? []
          : [label(testCase, `místo ${index + 1}, ${TOOL_NAMES[tool]}: ${problem}`)];
      }),
    );
    expect(limited(problems)).toEqual([]);
  });

  it('vybraný nástroj v hlavičce kroku barev je celý ve svém místě s odstupem aspoň 10 % strany', () => {
    const problems = casesIn('colors').flatMap((testCase) => {
      const problem = marginProblem(colorStepIconBox(testCase), testCase.colorStepTool);
      return problem === null ? [] : [label(testCase, `vybraný nástroj: ${problem}`)];
    });
    expect(limited(problems)).toEqual([]);
  });

  // Přepsáno k #164: v úchytu je místo ikony nástroje stálý symbol panelu
  // na stejném místě (AC1, AC3). Pravidla kolečka barvy z úchytu jsou
  // v `quickToolColorDotLayoutRules.test.ts` na prvním tlačítku (AC4).
  it('symbol panelu i s tmavým obrysem je celý v úchytu s odstupem aspoň 10 % strany úchytu', () => {
    const problems = cases().flatMap((testCase) => {
      const problem = marginProblem(outlinedSymbolBox(testCase), testCase.handle);
      return problem === null ? [] : [label(testCase, `úchyt: ${problem}`)];
    });
    expect(limited(problems)).toEqual([]);
  });

  it('symbol panelu i s tmavým obrysem nepřekrývá šipku panelu, ať je panel otevřený, nebo zavřený', () => {
    const problems = cases().flatMap((testCase) => {
      const gap = outlinedSymbolGapTo(testCase, arrowBox(testCase));
      return gap + TOLERANCE >= 0
        ? []
        : [label(testCase, `obrys symbolu ${(-gap).toFixed(2)} px na šipce`)];
    });
    expect(limited(problems)).toEqual([]);
  });
});

describe('#165 AC1: paleta a šipka jsou v úchytu dohromady uprostřed', () => {
  it('symbol s obrysem a šipka tvoří skupinu vystředěnou v úchytu na šířku i na výšku, otevřeném i zavřeném panelu', () => {
    const problems = cases().flatMap((testCase) => {
      const handle = testCase.handle;
      const group = unionOf(outlinedSymbolBox(testCase), arrowBox(testCase));
      const side = sideOfBox(handle);
      return [
        centeringProblem('vodorovně', group.left - handle.left, handle.right - group.right, side),
        centeringProblem('svisle', group.top - handle.top, handle.bottom - group.bottom, side),
      ].flatMap((problem) => (problem === null ? [] : [label(testCase, problem)]));
    });
    expect(limited(problems)).toEqual([]);
  });
});
