import { describe, expect, it } from 'vitest';

import { handleArrow, handleFace } from '../../../src/games/coloring/logic/coloringLayout';
import type { IconShape } from '../../../src/games/coloring/logic/toolIcons';
import type { ToolId } from '../../../src/games/coloring/logic/toolPanel';
import { toCss } from '../../shared/viewportFixtures';
import type { Box } from '../../shared/viewportFixtures';
import { boxOfRect, coloringCases, isOpen } from './coloringLayoutScenes';
import type { ColoringCase } from './coloringLayoutScenes';
import { SIZES, SIZE_NAMES } from './lineSizeHelpers';
import {
  ICON_COLORS,
  MIN_MARGIN_SHARE,
  TOOLS,
  TOOL_NAMES,
  cellCenter,
  colorStepIconBox,
  handleIconBox,
  iconBounds,
  iconOf,
  limited,
  maskOf,
  rasterize,
  scaledShapes,
  sideOfBox,
  slotIconBox,
  visibleColors,
} from './toolIconHelpers';

/**
 * Testy rozložení k #106 (srozumitelné ikony nástrojů, schválený styl D
 * „skutečné nástroje šikmo“): AC1 stejná ikona v panelu i v úchytu, AC2
 * ikona se vejde a nepřekrývá šipku ani tečku velikosti. Každé pravidlo
 * projde v cyklu všechna okna z `coloringLayoutScenes.ts` (iPad, telefon
 * na šířku i na výšku, okna z plochy, zavřený panel i oba kroky #105),
 * všech 10 nástrojů a 12 barev palety i „bez barvy“; popis případu je
 * v `expect`. Tvary a barvy ikon jsou v `toolIconShapes.test.ts`, úchyt
 * po ťuknutí v `toolIconHandle.test.ts`.
 *
 * Navržené rozhraní:
 * - `src/games/coloring/logic/toolIcons.ts`:
 *   `toolIconShapes(tool: ToolId, colorHex: string | null, side: number): readonly IconShape[]`
 *   tvary ikony pro čtverec o straně `side` CSS px (popis tvarů
 *   v `toolIconHelpers.ts`). Úchyt, místa v panelu i vybraný nástroj
 *   v hlavičce kroku barev volají stejnou funkci, jen s jinou stranou;
 *   scéna tvary přepočte na herní jednotky a nakreslí.
 * - `src/games/coloring/logic/coloringLayout.ts` (herní jednotky):
 *   - `toolSlotIcon(slot: LayoutRect): LayoutRect` čtverec ikony v místě
 *     nástroje v panelu i v hlavičce kroku barev (dnes `TOOL_ICON_SHARE`
 *     ve scéně `ToolPanelView`),
 *   - `handleArrow(handle: LayoutRect, slidesFrom: 'left' | 'bottom', panelOpen: boolean): LayoutRect`
 *     obdélník, do kterého se vejde šipka úchytu i s tloušťkou čáry (dnes
 *     počítá scéna v `HandleButtonView.drawArrow`),
 *   - ikonu v úchytu dál určuje `handleFace(handle, size).icon`.
 *
 * Výklad AC1 „liší se nejvýš o 1 px“ podle doporučení story-revieweru:
 * ikona z panelu se přepočítá na velikost ikony v úchytu (tvary i obrys
 * se zmenší) a obě se nakreslí na mřížku 1 vzorek = 1 CSS px. Každý
 * neprůhledný pixel jedné ikony má neprůhledný pixel druhé ve vzdálenosti
 * nejvýš 1 px (i šikmo) a obě mají stejné barvy.
 */

/** Rezerva na zaokrouhlení v CSS px. */
const TOLERANCE = 0.01;

/** AC1: rozdíl tvaru po přepočtu nejvýš 1 px. */
const MAX_SHAPE_DIFFERENCE_PX = 1;

/** Vzorků na CSS px při hledání překryvu se šipkou a tečkou (AC2). */
const OVERLAP_SAMPLES = 2;

/** Okraj mřížky kolem čtverce ikony jako díl strany: tvary D smí čtverec přesahovat. */
const PAD_SHARE = 0.3;

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

/** Obdélník ikony posunutý na místo `box` (tvary jsou od jeho rohu). */
function placedBounds(shapes: readonly IconShape[], box: Box): Box {
  const bounds = iconBounds(shapes);
  return {
    left: box.left + bounds.left,
    right: box.left + bounds.right,
    top: box.top + bounds.top,
    bottom: box.top + bounds.bottom,
  };
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

/** Problém s odstupem ikony od okraje místa, nebo `null`. */
function marginProblem(shapes: readonly IconShape[], iconBox: Box, place: Box): string | null {
  if (shapes.length === 0) {
    return 'ikona nemá žádný tvar';
  }
  const needed = MIN_MARGIN_SHARE * sideOfBox(place);
  const margin = marginInside(placedBounds(shapes, iconBox), place);
  return margin + TOLERANCE >= needed
    ? null
    : `odstup od okraje ${margin.toFixed(2)} px, potřeba ${needed.toFixed(2)} px`;
}

/** Problémy s odstupem ikon všech nástrojů a barev v místě `place`. */
function placeProblems(
  testCase: ColoringCase,
  placeName: string,
  tools: readonly ToolId[],
  iconBox: Box,
  place: Box,
): string[] {
  const problems: string[] = [];
  for (const tool of tools) {
    for (const color of ICON_COLORS) {
      const problem = marginProblem(iconOf(tool, color.hex, sideOfBox(iconBox)), iconBox, place);
      if (problem !== null) {
        problems.push(
          label(testCase, `${placeName}, ${TOOL_NAMES[tool]}, ${color.name}: ${problem}`),
        );
      }
    }
  }
  return problems;
}

const pointsCache = new Map<string, ReadonlyArray<{ x: number; y: number }>>();

/** Středy neprůhledných vzorků ikony v úchytu v CSS px od rohu jejího čtverce. */
function opaquePoints(
  tool: ToolId,
  hex: string | null,
  side: number,
): ReadonlyArray<{ x: number; y: number }> {
  const key = `${tool}|${String(hex)}|${side}`;
  let points = pointsCache.get(key);
  if (points === undefined) {
    const raster = rasterize(iconOf(tool, hex, side), side, OVERLAP_SAMPLES, side * PAD_SHARE);
    const found: Array<{ x: number; y: number }> = [];
    maskOf(raster).forEach((opaque, index) => {
      if (opaque === 1) {
        found.push(cellCenter(raster, index));
      }
    });
    points = found;
    pointsCache.set(key, points);
  }
  return points;
}

/** Obdélník `box` v CSS px od rohu čtverce ikony `icon`. */
function relativeTo(box: Box, icon: Box): Box {
  return {
    left: box.left - icon.left,
    right: box.right - icon.left,
    top: box.top - icon.top,
    bottom: box.bottom - icon.top,
  };
}

/** Klíč stejné geometrie úchytu, aby se stejné úchyty v různých oknech neměřily znovu. */
function geometryKey(side: number, target: Box): string {
  return [side, target.left, target.right, target.top, target.bottom]
    .map((value) => value.toFixed(3))
    .join('|');
}

/** Počet neprůhledných pixelů `first`, které nemají do 1 px (i šikmo) neprůhledný pixel `second`. */
function strayPixels(first: Uint8Array, second: Uint8Array, size: number): number {
  let stray = 0;
  for (let index = 0; index < size * size; index += 1) {
    if (first[index] !== 1) {
      continue;
    }
    const column = index % size;
    const row = Math.floor(index / size);
    let found = false;
    for (let dy = -MAX_SHAPE_DIFFERENCE_PX; dy <= MAX_SHAPE_DIFFERENCE_PX && !found; dy += 1) {
      for (let dx = -MAX_SHAPE_DIFFERENCE_PX; dx <= MAX_SHAPE_DIFFERENCE_PX && !found; dx += 1) {
        const x = column + dx;
        const y = row + dy;
        found = x >= 0 && y >= 0 && x < size && y < size && second[y * size + x] === 1;
      }
    }
    if (!found) {
      stray += 1;
    }
  }
  return stray;
}

describe('#106 AC1: ikona v panelu je stejná jako v úchytu, jen jinak velká', () => {
  it('ikona z panelu přepočtená na velikost úchytu se od ikony v úchytu liší nejvýš o 1 px a má stejné barvy', () => {
    const problems: string[] = [];
    const checked = new Set<string>();
    for (const testCase of casesIn('tools')) {
      const handleSide = sideOfBox(handleIconBox(testCase));
      const pad = handleSide * PAD_SHARE;
      TOOLS.forEach((tool, index) => {
        const slotSide = sideOfBox(slotIconBox(testCase, index));
        const key = `${tool}|${handleSide}|${slotSide}`;
        if (checked.has(key)) {
          return;
        }
        checked.add(key);
        for (const color of ICON_COLORS) {
          const inHandle = rasterize(iconOf(tool, color.hex, handleSide), handleSide, 1, pad);
          const fromPanel = rasterize(
            scaledShapes(iconOf(tool, color.hex, slotSide), handleSide / slotSide),
            handleSide,
            1,
            pad,
          );
          const name = label(testCase, `${TOOL_NAMES[tool]}, ${color.name}`);
          const handleMask = maskOf(inHandle);
          const panelMask = maskOf(fromPanel);
          const onlyInHandle = strayPixels(handleMask, panelMask, inHandle.size);
          const onlyInPanel = strayPixels(panelMask, handleMask, inHandle.size);
          if (onlyInHandle > 0 || onlyInPanel > 0) {
            problems.push(
              `${name}: ${onlyInHandle} px úchytu a ${onlyInPanel} px panelu dál než 1 px od druhé ikony`,
            );
          }
          const handleColors = visibleColors(inHandle).sort();
          const panelColors = visibleColors(fromPanel).sort();
          if (handleColors.join() !== panelColors.join()) {
            problems.push(
              `${name}: barvy v úchytu ${handleColors.join(' ')}, v panelu ${panelColors.join(' ')}`,
            );
          }
        }
      });
    }
    expect(limited(problems)).toEqual([]);
  });
});

describe('#106 AC2: ikona se vejde do místa v panelu i do úchytu', () => {
  it('ikona nástroje je celá v místě v panelu s odstupem aspoň 10 % strany místa', () => {
    const problems = casesIn('tools').flatMap((testCase) =>
      TOOLS.flatMap((tool, index) =>
        placeProblems(
          testCase,
          `místo ${index + 1}`,
          [tool],
          slotIconBox(testCase, index),
          testCase.tools[index] as Box,
        ),
      ),
    );
    expect(limited(problems)).toEqual([]);
  });

  it('vybraný nástroj v hlavičce kroku barev je celý ve svém místě s odstupem aspoň 10 % strany', () => {
    const problems = casesIn('colors').flatMap((testCase) =>
      placeProblems(
        testCase,
        'vybraný nástroj',
        TOOLS,
        colorStepIconBox(testCase),
        testCase.colorStepTool,
      ),
    );
    expect(limited(problems)).toEqual([]);
  });

  it('ikona nástroje je celá v úchytu s odstupem aspoň 10 % strany úchytu', () => {
    const problems = cases().flatMap((testCase) =>
      placeProblems(testCase, 'úchyt', TOOLS, handleIconBox(testCase), testCase.handle),
    );
    expect(limited(problems)).toEqual([]);
  });

  it('ikona v úchytu nepřekrývá šipku panelu, ať je panel otevřený, nebo zavřený', () => {
    const problems: string[] = [];
    const checked = new Set<string>();
    for (const testCase of cases()) {
      const iconBox = handleIconBox(testCase);
      const side = sideOfBox(iconBox);
      const arrow = relativeTo(
        toCss(
          boxOfRect(
            handleArrow(testCase.layout.handle, testCase.layout.panelSlidesFrom, isOpen(testCase)),
          ),
          testCase.area,
        ),
        iconBox,
      );
      const key = geometryKey(side, arrow);
      if (checked.has(key)) {
        continue;
      }
      checked.add(key);
      for (const tool of TOOLS) {
        for (const color of ICON_COLORS) {
          const hits = opaquePoints(tool, color.hex, side).filter(
            (point) =>
              point.x > arrow.left &&
              point.x < arrow.right &&
              point.y > arrow.top &&
              point.y < arrow.bottom,
          );
          if (hits.length > 0) {
            problems.push(
              label(
                testCase,
                `${TOOL_NAMES[tool]}, ${color.name}: ${hits.length} vzorků ikony na šipce`,
              ),
            );
          }
        }
      }
    }
    expect(limited(problems)).toEqual([]);
  });

  it('ikona v úchytu nepřekrývá tečku velikosti čáry v žádné velikosti', () => {
    const problems: string[] = [];
    const checked = new Set<string>();
    for (const testCase of casesIn('closed')) {
      const iconBox = handleIconBox(testCase);
      const side = sideOfBox(iconBox);
      for (const size of SIZES) {
        const dot = handleFace(testCase.layout.handle, size).sizeDot;
        const radius = (dot.diameter * testCase.area.scale) / 2;
        const center = relativeTo(
          toCss(
            { left: dot.centerX, right: dot.centerX, top: dot.centerY, bottom: dot.centerY },
            testCase.area,
          ),
          iconBox,
        );
        const key = `${geometryKey(side, center)}|${radius.toFixed(3)}`;
        if (checked.has(key)) {
          continue;
        }
        checked.add(key);
        for (const tool of TOOLS) {
          for (const color of ICON_COLORS) {
            const hits = opaquePoints(tool, color.hex, side).filter(
              (point) => Math.hypot(point.x - center.left, point.y - center.top) < radius,
            );
            if (hits.length > 0) {
              problems.push(
                label(
                  testCase,
                  `${SIZE_NAMES[size]} tečka, ${TOOL_NAMES[tool]}, ${color.name}: ${hits.length} vzorků ikony na tečce`,
                ),
              );
            }
          }
        }
      }
    }
    expect(limited(problems)).toEqual([]);
  });
});
