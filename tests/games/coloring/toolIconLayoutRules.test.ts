import { describe, expect, it } from 'vitest';

import { handleArrow } from '../../../src/games/coloring/logic/coloringLayout';
import { HANDLE_STYLE } from '../../../src/games/coloring/logic/theme';
import { toCss } from '../../shared/viewportFixtures';
import type { Box } from '../../shared/viewportFixtures';
import { boxOfRect, coloringCases, isOpen } from './coloringLayoutScenes';
import type { ColoringCase } from './coloringLayoutScenes';
import { SIZES, SIZE_NAMES } from './lineSizeHelpers';
import {
  MIN_DOT_CSS,
  MIN_MARGIN_SHARE,
  TOOLS,
  TOOL_NAMES,
  colorDotCss,
  colorStepIconBox,
  handleIconBox,
  limited,
  sideOfBox,
  slotIconBox,
} from './toolIconHelpers';
import type { DotCss } from './toolIconHelpers';

/**
 * Testy rozložení k #106 v novém znění po připomínce vlastníka: AC2 ikona
 * se vejde do místa v panelu i do úchytu s odstupem a nepřekrývá šipku
 * ani kolečko barvy, které nahrazuje tečku velikosti (#91), a kolečko
 * barvy je v rohu úchytu, nejméně 12 px a roste s velikostí čáry. Každé
 * pravidlo projde v cyklu všechna okna z `coloringLayoutScenes.ts` (iPad,
 * telefon na šířku i na výšku, okna z plochy, zavřený panel i oba kroky
 * #105) a všechny tři velikosti čáry; popis případu je v `expect`.
 *
 * Ikona je hotové SVG Noto (plocha 128 × 128), které scéna kreslí do
 * celého svého čtverce. Měří se proto čtverec ikony, ne její pixely:
 * dřívější měření na nakreslených tvarech stylu D se tím nahrazuje.
 *
 * Navržené rozhraní (`src/games/coloring/logic/coloringLayout.ts`, herní
 * jednotky):
 * - čtverec ikony dál určují `toolSlotIcon(slot)` (panel i hlavička kroku
 *   barev) a `handleFace(handle, size).icon` (úchyt),
 * - `handleColorDot(handle: LayoutRect, size: LineSize): LayoutCircle`
 *   barevná výplň kolečka v úchytu (`diameter` je průměr výplně, bílý lem
 *   a šedá linka z `HANDLE_COLOR_DOT_STYLE` se kreslí vně). Průměr se
 *   počítá jako díl strany úchytu; úchyt má aspoň 64 CSS px, takže díl
 *   aspoň 12/64 dá aspoň 12 CSS px v každém okně.
 * - `handleArrow(handle, slidesFrom, panelOpen)` obdélník šipky (beze změny).
 */

/** Rezerva na zaokrouhlení v CSS px. */
const TOLERANCE = 0.01;

/** Kolik bodů na obvodu kolečka se kontroluje proti zaobleným rohům úchytu. */
const PERIMETER_POINTS = 72;

/** Kolečko je „v rohu“: střed leží ve vnější třetině úchytu vodorovně i svisle. */
const CORNER_SHARE = 1 / 3;

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

/** Překrývají se dva obdélníky (dotyk na hraně se nepočítá)? */
function boxesOverlap(first: Box, second: Box): boolean {
  return (
    first.left < second.right - TOLERANCE &&
    second.left < first.right - TOLERANCE &&
    first.top < second.bottom - TOLERANCE &&
    second.top < first.bottom - TOLERANCE
  );
}

/** Překrývá se celé kolečko (i s lemem a linkou) s obdélníkem? */
function dotOverlapsBox(dot: DotCss, box: Box): boolean {
  const nearestX = Math.max(box.left, Math.min(dot.x, box.right));
  const nearestY = Math.max(box.top, Math.min(dot.y, box.bottom));
  return Math.hypot(dot.x - nearestX, dot.y - nearestY) < dot.outerRadius - TOLERANCE;
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

/** Leží bod uvnitř úchytu se zaoblenými rohy, uvnitř jeho modrého okraje? */
function insideHandleBorder(testCase: ColoringCase, x: number, y: number): boolean {
  const { handle } = testCase;
  const border = HANDLE_STYLE.borderWidthCss;
  const radius = Math.max(0, sideOfBox(handle) * HANDLE_STYLE.cornerRadiusShare - border);
  const inner = {
    left: handle.left + border + radius,
    right: handle.right - border - radius,
    top: handle.top + border + radius,
    bottom: handle.bottom - border - radius,
  };
  const nearestX = Math.max(inner.left, Math.min(x, inner.right));
  const nearestY = Math.max(inner.top, Math.min(y, inner.bottom));
  return Math.hypot(x - nearestX, y - nearestY) <= radius + TOLERANCE;
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

  it('ikona nástroje je celá v úchytu s odstupem aspoň 10 % strany úchytu v každé velikosti čáry', () => {
    const problems = cases().flatMap((testCase) =>
      SIZES.flatMap((size) => {
        const problem = marginProblem(handleIconBox(testCase, size), testCase.handle);
        return problem === null ? [] : [label(testCase, `úchyt, ${SIZE_NAMES[size]}: ${problem}`)];
      }),
    );
    expect(limited(problems)).toEqual([]);
  });

  it('ikona v úchytu nepřekrývá šipku panelu, ať je panel otevřený, nebo zavřený', () => {
    const problems = cases().flatMap((testCase) =>
      SIZES.flatMap((size) =>
        boxesOverlap(handleIconBox(testCase, size), arrowBox(testCase))
          ? [label(testCase, `${SIZE_NAMES[size]}: ikona na šipce`)]
          : [],
      ),
    );
    expect(limited(problems)).toEqual([]);
  });

  it('ikona v úchytu nepřekrývá kolečko barvy v žádné velikosti čáry', () => {
    const problems = cases().flatMap((testCase) =>
      SIZES.flatMap((size) =>
        dotOverlapsBox(colorDotCss(testCase, size), handleIconBox(testCase, size))
          ? [label(testCase, `${SIZE_NAMES[size]}: kolečko barvy na ikoně`)]
          : [],
      ),
    );
    expect(limited(problems)).toEqual([]);
  });
});

describe('#106 vybraná barva: kolečko barvy v rohu úchytu', () => {
  it('kolečko barvy leží i s lemem celé v úchytu uvnitř modrého okraje a zaoblených rohů', () => {
    const problems: string[] = [];
    for (const testCase of cases()) {
      for (const size of SIZES) {
        const dot = colorDotCss(testCase, size);
        let outside = 0;
        for (let step = 0; step < PERIMETER_POINTS; step += 1) {
          const angle = (2 * Math.PI * step) / PERIMETER_POINTS;
          const x = dot.x + dot.outerRadius * Math.cos(angle);
          const y = dot.y + dot.outerRadius * Math.sin(angle);
          if (!insideHandleBorder(testCase, x, y)) {
            outside += 1;
          }
        }
        if (outside > 0) {
          problems.push(
            label(testCase, `${SIZE_NAMES[size]}: ${outside} bodů obvodu kolečka mimo úchyt`),
          );
        }
      }
    }
    expect(limited(problems)).toEqual([]);
  });

  it('kolečko barvy je v rohu úchytu', () => {
    const problems: string[] = [];
    for (const testCase of cases()) {
      const { handle } = testCase;
      const width = handle.right - handle.left;
      const height = handle.bottom - handle.top;
      for (const size of SIZES) {
        const dot = colorDotCss(testCase, size);
        const fromLeft = (dot.x - handle.left) / width;
        const fromTop = (dot.y - handle.top) / height;
        const nearSide = fromLeft <= CORNER_SHARE || fromLeft >= 1 - CORNER_SHARE;
        const nearTopOrBottom = fromTop <= CORNER_SHARE || fromTop >= 1 - CORNER_SHARE;
        if (!(nearSide && nearTopOrBottom)) {
          problems.push(
            label(
              testCase,
              `${SIZE_NAMES[size]}: střed kolečka na ${(fromLeft * 100).toFixed(0)} % šířky ` +
                `a ${(fromTop * 100).toFixed(0)} % výšky úchytu`,
            ),
          );
        }
      }
    }
    expect(limited(problems)).toEqual([]);
  });

  it('kolečko barvy nepřekrývá šipku panelu, ať je panel otevřený, nebo zavřený', () => {
    const problems = cases().flatMap((testCase) =>
      SIZES.flatMap((size) =>
        dotOverlapsBox(colorDotCss(testCase, size), arrowBox(testCase))
          ? [label(testCase, `${SIZE_NAMES[size]}: kolečko barvy na šipce`)]
          : [],
      ),
    );
    expect(limited(problems)).toEqual([]);
  });

  it('barva v kolečku má průměr aspoň 12 px i u nejtenčí čáry', () => {
    const problems = cases().flatMap((testCase) =>
      SIZES.flatMap((size) => {
        const { fillDiameter } = colorDotCss(testCase, size);
        return fillDiameter + TOLERANCE >= MIN_DOT_CSS
          ? []
          : [label(testCase, `${SIZE_NAMES[size]}: průměr ${fillDiameter.toFixed(2)} px`)];
      }),
    );
    expect(limited(problems)).toEqual([]);
  });

  it('kolečko barvy je s tlustší čárou větší (malá < střední < velká)', () => {
    const problems = cases().flatMap((testCase) => {
      const diameters = SIZES.map((size) => colorDotCss(testCase, size).fillDiameter);
      return diameters.slice(1).flatMap((diameter, index) => {
        const smaller = diameters[index] ?? 0;
        return diameter > smaller + TOLERANCE
          ? []
          : [
              label(
                testCase,
                `${SIZE_NAMES[SIZES[index + 1] ?? 'large']} ${diameter.toFixed(2)} px ` +
                  `není větší než ${SIZE_NAMES[SIZES[index] ?? 'small']} ${smaller.toFixed(2)} px`,
              ),
            ];
      });
    });
    expect(limited(problems)).toEqual([]);
  });
});
