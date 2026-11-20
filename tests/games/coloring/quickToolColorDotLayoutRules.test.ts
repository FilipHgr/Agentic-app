import { describe, expect, it } from 'vitest';

import { toolSlotColorDot } from '../../../src/games/coloring/logic/coloringLayout';
import { COLOR_BUTTON_STYLE } from '../../../src/games/coloring/logic/theme';
import type { LineSize, ToolId } from '../../../src/games/coloring/logic/toolPanel';
import type { Box } from '../../shared/viewportFixtures';
import { coloringCases } from './coloringLayoutScenes';
import type { ColoringCase } from './coloringLayoutScenes';
import { ALL_SIZES, SIZES, SIZE_NAMES } from './lineSizeHelpers';
import {
  MIN_DOT_CSS,
  TOOLS,
  TOOL_NAMES,
  colorDotCss,
  firstButtonIconBox,
  limited,
  sideOfBox,
} from './toolIconHelpers';
import type { DotCss } from './toolIconHelpers';
import { SAMPLE_REACH_SHARE, opaqueIconPoints } from './toolIconMaskHelpers';

/**
 * Testy rozložení k #164 AC4: kolečko barvy velké podle velikosti čáry,
 * které dřív ukazoval úchyt (#91, #106, #118), ukazuje první tlačítko
 * rychlého přepínání (#163). Nahrazují pravidla kolečka v rohu úchytu
 * z `toolIconLayoutRules.test.ts` a `lineSizeLayoutRules.test.ts`
 * a přebírají pravidla kolečka nástroje v panelu z #114
 * (`toolIconSlotDotLayoutRules.test.ts`), protože první tlačítko má stejný
 * silný modrý okraj, když je vybrané.
 *
 * Každé pravidlo projde v cyklu všechna okna Omalovánek
 * z `coloringLayoutScenes.ts` (tlačítka v pruhu jsou na stejném místě při
 * zavřeném i otevřeném panelu, proto stačí zavřený), každou velikost čáry
 * a u zakrytí ikony každý kreslicí nástroj; popis případu je v `expect`.
 * Vše se měří v CSS px okna.
 *
 * Rozhraní (`src/games/coloring/logic/coloringLayout.ts`, herní jednotky):
 * `quickToolColorDot(slot: LayoutRect, size: LineSize): LayoutCircle`
 * barevná výplň kolečka na prvním tlačítku (`diameter` je průměr výplně,
 * bílý lem a šedá linka z `HANDLE_COLOR_DOT_STYLE` se kreslí vně); čtverec
 * ikony nástroje na tlačítku určuje `toolSlotIcon(slot)` jako v panelu.
 */

/** Rezerva na zaokrouhlení v CSS px. */
const TOLERANCE = 0.01;

/** Nejmenší odstup kolečka od vnitřní hrany silného okraje (jako #114 AC1). */
const MIN_BORDER_GAP_CSS = 1;

/** Kolečko smí zakrýt nejvýš tento díl neprůhledných bodů ikony (jako #114 AC5). */
const MAX_COVERED_SHARE = 0.1;

/**
 * Nejmenší odstup duhového kolečka od ikony duhy: u střední čáry 4 px jako
 * v panelu (#114 AC3, kolečko v panelu je vždy střední). Velké kolečko
 * z #91 a #106 je o 0,4 CSS px širší v poloměru a roste dovnitř tlačítka,
 * od duhy zůstane aspoň 3 px (na telefonu 3,3 px), nedotkne se jí.
 */
const MIN_RAINBOW_GAP_CSS: Readonly<Record<LineSize, number>> = {
  tiny: 4,
  small: 4,
  medium: 4,
  large: 3,
};

/** Kreslicí nástroje: smí být na prvním tlačítku (každý kromě gumy). */
const DRAWING_TOOLS: readonly ToolId[] = TOOLS.filter((tool) => tool !== 'eraser');

let cached: ColoringCase[] | undefined;

function cases(): ColoringCase[] {
  cached ??= coloringCases().filter((testCase) => testCase.panel === 'closed');
  return cached;
}

/** První tlačítko rychlého přepínání v CSS px okna. */
function firstButtonBox(testCase: ColoringCase): Box {
  const box = testCase.quickTools[0];
  if (box === undefined) {
    throw new Error(`${testCase.scene.label}: první tlačítko v pruhu chybí`);
  }
  return box;
}

function label(testCase: ColoringCase, size: LineSize, rest: string): string {
  return `${testCase.scene.label}, ${SIZE_NAMES[size]}: ${rest}`;
}

/**
 * Odstup bodu od vnitřní hrany silného okraje vybraného tlačítka (kladný
 * uvnitř, záporný v okraji nebo venku), i v zaobleném rohu.
 */
function gapToSelectedBorder(box: Box, x: number, y: number): number {
  const border = COLOR_BUTTON_STYLE.selectedBorderWidthCss;
  const outerRadius = sideOfBox(box) * COLOR_BUTTON_STYLE.cornerRadiusShare;
  const innerRadius = Math.max(0, outerRadius - border);
  const centerX = (box.left + box.right) / 2;
  const centerY = (box.top + box.bottom) / 2;
  const halfWidth = (box.right - box.left) / 2 - border - innerRadius;
  const halfHeight = (box.bottom - box.top) / 2 - border - innerRadius;
  const qx = Math.abs(x - centerX) - halfWidth;
  const qy = Math.abs(y - centerY) - halfHeight;
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
  const inside = Math.min(Math.max(qx, qy), 0);
  return innerRadius - outside - inside;
}

/** Neprůhledné body ikony nástroje na prvním tlačítku v CSS px okna. */
function opaquePointsCss(testCase: ColoringCase, tool: ToolId): { x: number; y: number }[] {
  const icon = firstButtonIconBox(testCase);
  const width = icon.right - icon.left;
  const height = icon.bottom - icon.top;
  return opaqueIconPoints(tool).map((point) => ({
    x: icon.left + point.u * width,
    y: icon.top + point.v * height,
  }));
}

function coveredShare(dot: DotCss, points: readonly { x: number; y: number }[]): number {
  const covered = points.filter(
    (point) => Math.hypot(point.x - dot.x, point.y - dot.y) < dot.outerRadius,
  ).length;
  return points.length === 0 ? 1 : covered / points.length;
}

describe('#164 AC4: první tlačítko ukazuje kolečko barvy velké podle velikosti čáry', () => {
  it('kolečko i s bílým lemem a šedou linkou je u každé velikosti aspoň 1 px od vnitřní hrany silného modrého okraje, i v rohu', () => {
    const problems = cases().flatMap((testCase) =>
      ALL_SIZES.flatMap((size) => {
        const dot = colorDotCss(testCase, size);
        const gap = gapToSelectedBorder(firstButtonBox(testCase), dot.x, dot.y) - dot.outerRadius;
        return gap + TOLERANCE >= MIN_BORDER_GAP_CSS
          ? []
          : [label(testCase, size, `kolečko ${gap.toFixed(2)} px od vnitřní hrany okraje`)];
      }),
    );
    expect(limited(problems)).toEqual([]);
  });

  it('střed kolečka leží v pravé dolní čtvrtině prvního tlačítka', () => {
    const problems = cases().flatMap((testCase) =>
      ALL_SIZES.flatMap((size) => {
        const box = firstButtonBox(testCase);
        const dot = colorDotCss(testCase, size);
        const middleX = (box.left + box.right) / 2;
        const middleY = (box.top + box.bottom) / 2;
        return dot.x > middleX + TOLERANCE && dot.y > middleY + TOLERANCE
          ? []
          : [
              label(
                testCase,
                size,
                `střed kolečka ${(dot.x - middleX).toFixed(2)} px vpravo ` +
                  `a ${(dot.y - middleY).toFixed(2)} px pod středem tlačítka`,
              ),
            ];
      }),
    );
    expect(limited(problems)).toEqual([]);
  });

  it('barva v kolečku má průměr aspoň 12 px i u nejtenčí čáry', () => {
    const problems = cases().flatMap((testCase) =>
      ALL_SIZES.flatMap((size) => {
        const { fillDiameter } = colorDotCss(testCase, size);
        return fillDiameter + TOLERANCE >= MIN_DOT_CSS
          ? []
          : [label(testCase, size, `průměr ${fillDiameter.toFixed(2)} px`)];
      }),
    );
    expect(limited(problems)).toEqual([]);
  });

  it('kolečko je s tlustší čárou větší (malá < střední < velká)', () => {
    const problems = cases().flatMap((testCase) => {
      const diameters = SIZES.map((size) => colorDotCss(testCase, size).fillDiameter);
      return diameters.slice(1).flatMap((diameter, index) => {
        const smaller = diameters[index] ?? 0;
        const size = SIZES[index + 1] ?? 'large';
        return diameter > smaller + TOLERANCE
          ? []
          : [
              label(
                testCase,
                size,
                `${diameter.toFixed(2)} px není větší než ${smaller.toFixed(2)} px`,
              ),
            ];
      });
    });
    expect(limited(problems)).toEqual([]);
  });

  it('u střední čáry je kolečko stejně velké jako kolečko nástroje v panelu', () => {
    const problems = cases().flatMap((testCase) => {
      const button = testCase.layout.quickDrawingToolButton;
      const panelShare = toolSlotColorDot(button).diameter / Math.min(button.width, button.height);
      const expected = panelShare * sideOfBox(firstButtonBox(testCase));
      const { fillDiameter } = colorDotCss(testCase, 'medium');
      return Math.abs(fillDiameter - expected) <= TOLERANCE
        ? []
        : [
            label(
              testCase,
              'medium',
              `průměr ${fillDiameter.toFixed(2)} px, v panelu ${expected.toFixed(2)} px`,
            ),
          ];
    });
    expect(limited(problems)).toEqual([]);
  });

  it('kolečko nezakryje u žádného kreslicího nástroje a žádné velikosti víc než 10 % ikony', () => {
    const problems = cases().flatMap((testCase) =>
      DRAWING_TOOLS.flatMap((tool) => {
        const points = opaquePointsCss(testCase, tool);
        return ALL_SIZES.flatMap((size) => {
          const share = coveredShare(colorDotCss(testCase, size), points);
          return share <= MAX_COVERED_SHARE + TOLERANCE / 100
            ? []
            : [
                label(
                  testCase,
                  size,
                  `${TOOL_NAMES[tool]}: kolečko zakryje ${(share * 100).toFixed(1)} % ikony`,
                ),
              ];
        });
      }),
    );
    expect(limited(problems)).toEqual([]);
  });

  it('duhové kolečko je od ikony duhy aspoň 4 px jako v panelu, u velké čáry aspoň 3 px', () => {
    const problems = cases().flatMap((testCase) => {
      const points = opaquePointsCss(testCase, 'rainbow');
      const reach = sideOfBox(firstButtonIconBox(testCase)) * SAMPLE_REACH_SHARE;
      return ALL_SIZES.flatMap((size) => {
        const dot = colorDotCss(testCase, size);
        let smallest = Number.POSITIVE_INFINITY;
        for (const point of points) {
          smallest = Math.min(smallest, Math.hypot(point.x - dot.x, point.y - dot.y));
        }
        const gap = smallest - dot.outerRadius - reach;
        return gap + TOLERANCE >= MIN_RAINBOW_GAP_CSS[size]
          ? []
          : [label(testCase, size, `odstup kolečka od duhy ${gap.toFixed(2)} px`)];
      });
    });
    expect(limited(problems)).toEqual([]);
  });
});
