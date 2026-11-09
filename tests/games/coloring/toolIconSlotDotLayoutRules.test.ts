import { describe, expect, it } from 'vitest';

import {
  handleColorDot,
  toolSlotColorDot,
  toolSlotIcon,
} from '../../../src/games/coloring/logic/coloringLayout';
import type { LayoutRect } from '../../../src/games/coloring/logic/coloringLayout';
import {
  COLOR_BUTTON_STYLE,
  HANDLE_COLOR_DOT_STYLE,
} from '../../../src/games/coloring/logic/theme';
import { handleColorDotFill } from '../../../src/games/coloring/logic/toolIcons';
import type { ToolId } from '../../../src/games/coloring/logic/toolPanel';
import { HOME_SCREEN_WINDOWS } from '../../shared/layoutRules';
import { IPAD_WINDOWS, JUST_ABOVE_LIMIT, toCss } from '../../shared/viewportFixtures';
import type { Box, TestWindow } from '../../shared/viewportFixtures';
import { boxOfRect, coloringCases } from './coloringLayoutScenes';
import type { ColoringCase } from './coloringLayoutScenes';
import { TOOLS, TOOL_NAMES, limited, sideOfBox } from './toolIconHelpers';
import { SAMPLE_REACH_SHARE, opaqueIconPoints } from './toolIconMaskHelpers';

/**
 * Testy k #114 (kolečko barvy u vybraného nástroje nepřekrývá okraj ani
 * duhu). Každé pravidlo projde v cyklu všechna okna Omalovánek
 * z `coloringLayoutScenes.ts` v kroku nástrojů (všech 10 míst, každé může
 * být vybrané) a v kroku barev (vybraný nástroj v hlavičce, kterýkoli
 * z 10 nástrojů); popis případu je v `expect`. Vše se měří v CSS px okna.
 *
 * Schválené doporučení (komentář k #114): kolečko zůstane stejně velké
 * a posune se dovnitř jen tolik, kolik vyžaduje AC1, ikona se posune
 * nejvýš o 3 CSS px nahoru doleva, u všech nástrojů stejně.
 *
 * Silný modrý okraj vybraného nástroje (`COLOR_BUTTON_STYLE`, kreslí
 * `drawToolButton` v `ToolPanelView.ts`): vnější hrana je obdélník místa
 * se zaoblením 0,22 kratší strany, okraj má `selectedBorderWidthCss`
 * (5 CSS px) dovnitř, vnitřní hrana je tedy obdélník zmenšený o 5 px se
 * zaoblením o 5 px menším.
 *
 * Neprůhledné body ikon se zjišťují z SVG v repozitáři vlastní
 * rasterizací v testu (`toolIconMaskHelpers.ts`, bez nové závislosti).
 *
 * Navržené rozhraní (beze změny tvaru, `src/games/coloring/logic/coloringLayout.ts`,
 * herní jednotky):
 * - `toolSlotColorDot(slot: LayoutRect): LayoutCircle` barevná výplň
 *   kolečka v místě nástroje (krok nástrojů i hlavička kroku barev);
 *   `diameter` je průměr výplně, bílý lem a šedá linka
 *   z `HANDLE_COLOR_DOT_STYLE` se kreslí vně. Nezávisí na tom, jestli je
 *   nástroj vybraný, ani na druhu kolečka.
 * - `toolSlotIcon(slot: LayoutRect): LayoutRect` čtverec ikony, do kterého
 *   scéna kreslí celé SVG; také nezávisí na výběru.
 * Obě funkce dostávají jen místo; místa mají aspoň 64 CSS px, takže stačí
 * díly strany spočítané pro 64 px a nepotřebují měřítko.
 */

/** Rezerva na zaokrouhlení v CSS px. */
const TOLERANCE = 0.01;

/** Nejmenší odstup od vnitřní hrany silného okraje (AC1, AC4). */
const MIN_BORDER_GAP_CSS = 1;

/** Nejmenší odstup kolečka od duhy (AC3). */
const MIN_RAINBOW_GAP_CSS = 4;

/** Kolečko smí zakrýt nejvýš tento díl neprůhledných bodů ikony (AC5). */
const MAX_COVERED_SHARE = 0.1;

/** Nejmenší strana místa nástroje (AC1): telefon a iPad. */
const MIN_PHONE_SLOT_CSS = 64;
const MIN_IPAD_SLOT_CSS = 76;

/** Dnešní (před #114) průměr výplně kolečka jako díl strany místa: 12,8 / 64. */
const TODAY_DOT_SHARE = 12.8 / 64;

/** Dnešní (před #114) strana ikony jako díl strany místa, uprostřed místa. */
const TODAY_ICON_SHARE = 0.62;

/** Ikona nesmí být menší než 90 % dnešní (AC4). */
const MIN_ICON_SIZE_SHARE = 0.9;

/** Ikona se posune nejvýš o tolik CSS px nahoru a doleva (schválené doporučení). */
const MAX_ICON_SHIFT_CSS = 3;

/** Okna s rozložením iPadu (místa nástrojů 76 CSS px). */
const IPAD_LAYOUT_WINDOWS: readonly TestWindow[] = [
  ...IPAD_WINDOWS,
  JUST_ABOVE_LIMIT,
  ...HOME_SCREEN_WINDOWS.filter((window) => window.name.startsWith('iPad')),
];

let cached: ColoringCase[] | undefined;

function cases(): ColoringCase[] {
  cached ??= coloringCases();
  return cached;
}

/** Jedno místo nástroje na obrazovce: v kroku nástrojů, nebo v hlavičce kroku barev. */
interface ToolPlace {
  readonly testCase: ColoringCase;
  readonly tool: ToolId;
  /** Místo v herních jednotkách (vstup funkcí rozložení). */
  readonly slot: LayoutRect;
  /** Místo v CSS px okna. */
  readonly box: Box;
  readonly where: string;
}

function toolStepPlaces(): ToolPlace[] {
  return cases()
    .filter((testCase) => testCase.panel === 'tools')
    .flatMap((testCase) =>
      TOOLS.map((tool, index) => {
        const slot = testCase.layout.toolSlots[index];
        const box = testCase.tools[index];
        if (slot === undefined || box === undefined) {
          throw new Error(`${testCase.scene.label}: místo nástroje ${index + 1} chybí`);
        }
        return {
          testCase,
          tool,
          slot,
          box,
          where: `${testCase.scene.label}, místo ${index + 1} (${TOOL_NAMES[tool]})`,
        };
      }),
    );
}

function colorStepPlaces(): ToolPlace[] {
  return cases()
    .filter((testCase) => testCase.panel === 'colors')
    .flatMap((testCase) =>
      TOOLS.map((tool) => ({
        testCase,
        tool,
        slot: testCase.layout.colorStepTool,
        box: testCase.colorStepTool,
        where: `${testCase.scene.label}, hlavička kroku barev (${TOOL_NAMES[tool]})`,
      })),
    );
}

function allPlaces(): ToolPlace[] {
  return [...toolStepPlaces(), ...colorStepPlaces()];
}

/** Kolečko barvy v CSS px okna. */
interface DotCss {
  readonly x: number;
  readonly y: number;
  readonly fillDiameter: number;
  /** Poloměr i s bílým lemem a šedou linkou. */
  readonly outerRadius: number;
}

function slotDotCss(place: ToolPlace): DotCss {
  const dot = toolSlotColorDot(place.slot);
  const { scale, offsetX, offsetY } = place.testCase.area;
  const fillDiameter = dot.diameter * scale;
  return {
    x: offsetX + dot.centerX * scale,
    y: offsetY + dot.centerY * scale,
    fillDiameter,
    outerRadius: fillDiameter / 2 + HANDLE_COLOR_DOT_STYLE.rimCss + HANDLE_COLOR_DOT_STYLE.lineCss,
  };
}

function slotIconCss(place: ToolPlace): Box {
  return toCss(boxOfRect(toolSlotIcon(place.slot)), place.testCase.area);
}

/** Neprůhledné body ikony v CSS px okna. */
function opaquePointsCss(place: ToolPlace): { x: number; y: number }[] {
  const icon = slotIconCss(place);
  const width = icon.right - icon.left;
  const height = icon.bottom - icon.top;
  return opaqueIconPoints(place.tool).map((point) => ({
    x: icon.left + point.u * width,
    y: icon.top + point.v * height,
  }));
}

/** O kolik může skutečná hrana ikony přesahovat střed vzorku, v CSS px. */
function sampleReachCss(place: ToolPlace): number {
  return sideOfBox(slotIconCss(place)) * SAMPLE_REACH_SHARE;
}

/**
 * Odstup bodu od vnitřní hrany silného okraje vybraného nástroje (kladný
 * uvnitř, záporný v okraji nebo venku), i v zaobleném rohu.
 */
function gapToSelectedBorder(box: Box, x: number, y: number): number {
  const border = COLOR_BUTTON_STYLE.selectedBorderWidthCss;
  const outerRadius = sideOfBox(box) * COLOR_BUTTON_STYLE.cornerRadiusShare;
  const innerRadius = Math.max(0, outerRadius - border);
  const centerX = (box.left + box.right) / 2;
  const centerY = (box.top + box.bottom) / 2;
  // Půlky stran obdélníku, ze kterého vznikne vnitřní hrana zaoblením o innerRadius.
  const halfWidth = (box.right - box.left) / 2 - border - innerRadius;
  const halfHeight = (box.bottom - box.top) / 2 - border - innerRadius;
  const qx = Math.abs(x - centerX) - halfWidth;
  const qy = Math.abs(y - centerY) - halfHeight;
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
  const inside = Math.min(Math.max(qx, qy), 0);
  return innerRadius - outside - inside;
}

/** Nejmenší vzdálenost neprůhledného bodu ikony od kolečka (i s lemem a linkou). */
function gapToDot(place: ToolPlace): number {
  const dot = slotDotCss(place);
  let smallest = Number.POSITIVE_INFINITY;
  for (const point of opaquePointsCss(place)) {
    smallest = Math.min(smallest, Math.hypot(point.x - dot.x, point.y - dot.y));
  }
  return smallest - dot.outerRadius - sampleReachCss(place);
}

/** Kolečko vzhledem k levému hornímu rohu místa v CSS px. */
function dotOffset(place: ToolPlace): { x: number; y: number; diameter: number } {
  const dot = slotDotCss(place);
  return { x: dot.x - place.box.left, y: dot.y - place.box.top, diameter: dot.fillDiameter };
}

/** Čtverec ikony vzhledem k levému hornímu rohu místa v CSS px. */
function iconOffset(place: ToolPlace): { left: number; top: number; side: number } {
  const icon = slotIconCss(place);
  return { left: icon.left - place.box.left, top: icon.top - place.box.top, side: sideOfBox(icon) };
}

/** Okna, ve kterých místa leží, každé jednou. */
function windowsOf(places: readonly ToolPlace[]): TestWindow[] {
  return [...new Set(places.map((place) => place.testCase.window))];
}

function differs(first: Record<string, number>, second: Record<string, number>): boolean {
  return Object.keys(first).some(
    (key) => Math.abs((first[key] ?? 0) - (second[key] ?? 0)) > TOLERANCE,
  );
}

function format(value: Record<string, number>): string {
  return Object.entries(value)
    .map(([key, number]) => `${key} ${number.toFixed(2)}`)
    .join(', ');
}

describe('#114 AC1: kolečko barvy je u vybraného nástroje celé uvnitř silného okraje', () => {
  it('místo nástroje má na telefonu aspoň 64 CSS px a na iPadu aspoň 76 CSS px', () => {
    const problems = allPlaces().flatMap((place) => {
      const isIpad = IPAD_LAYOUT_WINDOWS.includes(place.testCase.window);
      const needed = isIpad ? MIN_IPAD_SLOT_CSS : MIN_PHONE_SLOT_CSS;
      const side = sideOfBox(place.box);
      return side + TOLERANCE >= needed
        ? []
        : [`${place.where}: strana ${side.toFixed(2)} px, potřeba ${needed} px`];
    });
    expect(limited(problems)).toEqual([]);
  });

  it('kolečko i s bílým lemem a šedou linkou je aspoň 1 px od vnitřní hrany modrého okraje, i v rohu', () => {
    const problems = allPlaces().flatMap((place) => {
      const dot = slotDotCss(place);
      const gap = gapToSelectedBorder(place.box, dot.x, dot.y) - dot.outerRadius;
      return gap + TOLERANCE >= MIN_BORDER_GAP_CSS
        ? []
        : [`${place.where}: kolečko ${gap.toFixed(2)} px od vnitřní hrany okraje`];
    });
    expect(limited(problems)).toEqual([]);
  });

  it('platí pro každý druh kolečka: barvu, čárkovanou gumu i duhu', () => {
    const kinds = new Set(
      TOOLS.map((tool) => handleColorDotFill({ tool, color: 0, size: 'medium' }).kind),
    );
    expect([...kinds].sort(), 'druhy kolečka u nástrojů v panelu').toEqual([
      'color',
      'eraser',
      'rainbow',
    ]);
    const problems = allPlaces().flatMap((place) => {
      const kind = handleColorDotFill({ tool: place.tool, color: 0, size: 'medium' }).kind;
      const dot = slotDotCss(place);
      const gap = gapToSelectedBorder(place.box, dot.x, dot.y) - dot.outerRadius;
      return gap + TOLERANCE >= MIN_BORDER_GAP_CSS
        ? []
        : [`${place.where}, kolečko ${kind}: ${gap.toFixed(2)} px od vnitřní hrany okraje`];
    });
    expect(limited(problems)).toEqual([]);
  });
});

describe('#114 AC2: kolečko zůstane v rohu, stejně velké a při výběru neposkočí', () => {
  it('střed kolečka leží v pravé dolní čtvrtině místa nástroje', () => {
    const problems = allPlaces().flatMap((place) => {
      const dot = slotDotCss(place);
      const middleX = (place.box.left + place.box.right) / 2;
      const middleY = (place.box.top + place.box.bottom) / 2;
      return dot.x > middleX + TOLERANCE && dot.y > middleY + TOLERANCE
        ? []
        : [
            `${place.where}: střed kolečka ${(dot.x - middleX).toFixed(2)} px vpravo ` +
              `a ${(dot.y - middleY).toFixed(2)} px pod středem místa`,
          ];
    });
    expect(limited(problems)).toEqual([]);
  });

  it('kolečko je stejně velké jako dnes a jako střední kolečko v úchytu', () => {
    const problems = allPlaces().flatMap((place) => {
      const { fillDiameter } = slotDotCss(place);
      const side = sideOfBox(place.box);
      const today = side * TODAY_DOT_SHARE;
      const handle = place.testCase.layout.handle;
      const handleShare =
        handleColorDot(handle, 'medium').diameter / Math.min(handle.width, handle.height);
      const asHandle = side * handleShare;
      return Math.abs(fillDiameter - today) <= TOLERANCE &&
        Math.abs(fillDiameter - asHandle) <= TOLERANCE
        ? []
        : [
            `${place.where}: průměr ${fillDiameter.toFixed(2)} px, dnes ${today.toFixed(2)} px, ` +
              `jako v úchytu ${asHandle.toFixed(2)} px`,
          ];
    });
    expect(limited(problems)).toEqual([]);
  });

  it('kolečko je u všech nástrojů v kroku nástrojů i v hlavičce kroku barev na stejném místě', () => {
    const places = allPlaces();
    const problems = windowsOf(places).flatMap((window) => {
      const inWindow = places.filter((place) => place.testCase.window === window);
      const first = inWindow[0];
      if (first === undefined) {
        return [];
      }
      const expected = dotOffset(first);
      return inWindow.flatMap((place) => {
        const offset = dotOffset(place);
        return differs(offset, expected)
          ? [`${place.where}: kolečko ${format(offset)}, u ${first.where} ${format(expected)}`]
          : [];
      });
    });
    expect(limited(problems)).toEqual([]);
  });
});

describe('#114 AC3: kolečko je oddělené od duhy', () => {
  it('mezi kolečkem i s lemem a linkou a duhovým štětcem je aspoň 4 px v kroku nástrojů i v hlavičce kroku barev', () => {
    const problems = allPlaces()
      .filter((place) => place.tool === 'rainbow')
      .flatMap((place) => {
        const gap = gapToDot(place);
        return gap + TOLERANCE >= MIN_RAINBOW_GAP_CSS
          ? []
          : [`${place.where}: odstup kolečka od duhy ${gap.toFixed(2)} px`];
      });
    expect(limited(problems)).toEqual([]);
  });
});

describe('#114 AC4: ikona smí ustoupit, ale zůstane celá a skoro stejně velká', () => {
  it('neprůhledné body ikony jsou aspoň 1 px od vnitřní hrany silného okraje', () => {
    const problems = allPlaces().flatMap((place) => {
      let smallest = Number.POSITIVE_INFINITY;
      for (const point of opaquePointsCss(place)) {
        smallest = Math.min(smallest, gapToSelectedBorder(place.box, point.x, point.y));
      }
      const gap = smallest - sampleReachCss(place);
      return gap + TOLERANCE >= MIN_BORDER_GAP_CSS
        ? []
        : [`${place.where}: ikona ${gap.toFixed(2)} px od vnitřní hrany okraje`];
    });
    expect(limited(problems)).toEqual([]);
  });

  it('ikona má aspoň 90 % dnešní velikosti', () => {
    const problems = allPlaces().flatMap((place) => {
      const side = sideOfBox(slotIconCss(place));
      const needed = MIN_ICON_SIZE_SHARE * TODAY_ICON_SHARE * sideOfBox(place.box);
      return side + TOLERANCE >= needed
        ? []
        : [`${place.where}: strana ikony ${side.toFixed(2)} px, potřeba ${needed.toFixed(2)} px`];
    });
    expect(limited(problems)).toEqual([]);
  });

  it('ikona se od dnešního místa jen zmenší nebo posune nejvýš o 3 px nahoru a doleva', () => {
    const problems = allPlaces().flatMap((place) => {
      const icon = slotIconCss(place);
      const todaySide = TODAY_ICON_SHARE * sideOfBox(place.box);
      const middleX = (place.box.left + place.box.right) / 2;
      const middleY = (place.box.top + place.box.bottom) / 2;
      const today = {
        left: middleX - todaySide / 2,
        right: middleX + todaySide / 2,
        top: middleY - todaySide / 2,
        bottom: middleY + todaySide / 2,
      };
      const fine =
        icon.left + TOLERANCE >= today.left - MAX_ICON_SHIFT_CSS &&
        icon.top + TOLERANCE >= today.top - MAX_ICON_SHIFT_CSS &&
        icon.right <= today.right + TOLERANCE &&
        icon.bottom <= today.bottom + TOLERANCE;
      return fine
        ? []
        : [
            `${place.where}: ikona vlevo ${(icon.left - today.left).toFixed(2)}, ` +
              `nahoře ${(icon.top - today.top).toFixed(2)}, vpravo ${(icon.right - today.right).toFixed(2)}, ` +
              `dole ${(icon.bottom - today.bottom).toFixed(2)} px proti dnešku`,
          ];
    });
    expect(limited(problems)).toEqual([]);
  });

  it('ikona je u všech nástrojů v kroku nástrojů i v hlavičce kroku barev stejná a na stejném místě', () => {
    const places = allPlaces();
    const problems = windowsOf(places).flatMap((window) => {
      const inWindow = places.filter((place) => place.testCase.window === window);
      const first = inWindow[0];
      if (first === undefined) {
        return [];
      }
      const expected = iconOffset(first);
      return inWindow.flatMap((place) => {
        const offset = iconOffset(place);
        return differs(offset, expected)
          ? [`${place.where}: ikona ${format(offset)}, u ${first.where} ${format(expected)}`]
          : [];
      });
    });
    expect(limited(problems)).toEqual([]);
  });
});

describe('#114 AC5: kolečko nezakrývá ikony', () => {
  it('kolečko nezakryje u žádného nástroje víc než 10 % neprůhledných bodů ikony', () => {
    const problems = allPlaces().flatMap((place) => {
      const dot = slotDotCss(place);
      const points = opaquePointsCss(place);
      const covered = points.filter(
        (point) => Math.hypot(point.x - dot.x, point.y - dot.y) < dot.outerRadius,
      ).length;
      const share = points.length === 0 ? 1 : covered / points.length;
      return share <= MAX_COVERED_SHARE + TOLERANCE / 100
        ? []
        : [`${place.where}: kolečko zakryje ${(share * 100).toFixed(1)} % ikony`];
    });
    expect(limited(problems)).toEqual([]);
  });

  it('pomůcka testu najde neprůhledné body každé ikony (ikona není prázdná)', () => {
    for (const tool of TOOLS) {
      expect(opaqueIconPoints(tool).length, TOOL_NAMES[tool]).toBeGreaterThan(1000);
    }
  });
});
