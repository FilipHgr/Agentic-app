import { describe, expect, it } from 'vitest';

import { COLOR_BUTTON_STYLE, HANDLE_STYLE } from '../../../src/games/coloring/logic/theme';
import type { ToolId } from '../../../src/games/coloring/logic/toolPanel';
import { contrastRatio } from '../../../src/shared/logic/theme';
import type { Box } from '../../shared/viewportFixtures';
import { coloringCases } from './coloringLayoutScenes';
import type { ColoringCase } from './coloringLayoutScenes';
import {
  COLOR_TOOLS,
  ICON_BACKGROUNDS,
  ICON_COLORS,
  MAX_COLORS,
  MAX_ERASER_PARTS,
  MAX_PARTS,
  MAX_RAINBOW_EXTRA_COLORS,
  MIN_CONTRAST,
  MIN_DIFFERENCE,
  MIN_PART_CSS,
  MIN_SAME_BODY_DIFFERENCE,
  MIN_STAR_DIAMETER_CSS,
  MIN_TIP_BASE_CSS,
  OUTLINE,
  RAINBOW_HEXES,
  SAME_BODY_PAIRS,
  SLOT_BACKGROUND,
  TOOLS,
  TOOL_NAMES,
  colorOfCell,
  colorParts,
  differenceShare,
  fitsDisc,
  handleIconBox,
  holes,
  iconBounds,
  iconOf,
  isColorCell,
  limited,
  movedShapes,
  narrowGaps,
  nearBackground,
  outlineOf,
  rasterize,
  sameHex,
  sideOfBox,
  slotIconBox,
  tipBaseWidth,
  visibleColors,
} from './toolIconHelpers';
import type { IconRaster } from './toolIconHelpers';

/**
 * Testy tvaru a barev ikon nástrojů k #106 (srozumitelné ikony, schválený
 * styl D „skutečné nástroje šikmo“, obrázek `ikony-D.png`): AC1 jedna
 * ikona na nástroj bez písmen, AC3 kontrast, AC4 ikony se od sebe liší,
 * AC5 jednoduchost v nejmenším úchytu. Pravidla jdou v cyklu přes všech
 * 10 nástrojů, 12 barev palety i „bez barvy“, pozadí z AC3 a velikosti
 * ikon ze všech oken `coloringLayoutScenes.ts`; popis případu je
 * v `expect`. Rozložení (AC1 panel a úchyt, AC2) je
 * v `toolIconLayoutRules.test.ts`, úchyt po ťuknutí (AC6)
 * v `toolIconHandle.test.ts`. AC7 a shoda se schváleným obrázkem (AC1)
 * jsou ruční kontrola.
 *
 * Doporučení story-revieweru z komentáře k issue:
 * - AC3 „bez vybrané barvy“: ikona s `colorHex = null` (guma a duha
 *   vždy, ostatní nástroje, když je scéna kreslí bez barvy); měří se
 *   všechny nástroje v 12 barvách i bez barvy,
 * - AC4 „pixely ikony“ = neprůhledné pixely včetně obrysu, nakreslené na
 *   mřížce o straně místa v nejmenším panelu (64 px) tak, jak ikona
 *   v místě leží; měří se ve všech 12 barvách i bez barvy. U stylu D se
 *   navíc počítá barva pixelu (viz `differenceShare` a PROBLÉMY V ZADÁNÍ),
 * - AC5 „oddělená část“ = souvislá plocha jedné barvy bez obrysu (bílé
 *   tělo fixu i odlesk jsou části), měří se v nejmenším úchytu.
 */

/** Vzorků na CSS px při měření kontrastu a jednoduchosti. */
const SAMPLES = 3;

/** Okraj mřížky kolem čtverce ikony jako díl strany: tvary D smí čtverec přesahovat. */
const PAD_SHARE = 0.3;

/** Rezerva na zaokrouhlení v CSS px. */
const TOLERANCE = 0.01;

let cached: ColoringCase[] | undefined;

function cases(): ColoringCase[] {
  cached ??= coloringCases(undefined, ['tools']);
  return cached;
}

/** Nejmenší ikona v úchytu ve všech oknech (CSS px). */
function smallestHandleSide(): number {
  return Math.min(...cases().map((testCase) => sideOfBox(handleIconBox(testCase))));
}

/** Nejmenší ikona v místě panelu ve všech oknech (CSS px). */
function smallestSlotIconSide(): number {
  return Math.min(
    ...cases().flatMap((testCase) =>
      TOOLS.map((_, index) => sideOfBox(slotIconBox(testCase, index))),
    ),
  );
}

/** Okno s nejmenším místem nástroje v panelu: první místo a čtverec jeho ikony. */
function smallestSlot(): { slot: Box; icon: Box } {
  const sides = cases().map((testCase) => sideOfBox(testCase.tools[0] as Box));
  const testCase = cases()[sides.indexOf(Math.min(...sides))] as ColoringCase;
  return { slot: testCase.tools[0] as Box, icon: slotIconBox(testCase, 0) };
}

const rasterCache = new Map<string, IconRaster>();

/** Ikona na mřížce se `SAMPLES` vzorky na CSS px a okrajem kolem. */
function rasterOf(tool: ToolId, hex: string | null, side: number): IconRaster {
  const key = `${tool}|${String(hex)}|${side}`;
  let raster = rasterCache.get(key);
  if (raster === undefined) {
    raster = rasterize(iconOf(tool, hex, side), side, SAMPLES, side * PAD_SHARE);
    rasterCache.set(key, raster);
  }
  return raster;
}

function caseName(tool: ToolId, colorName: string): string {
  return `${TOOL_NAMES[tool]}, ${colorName}`;
}

describe('#106 AC1: každý nástroj má jednu ikonu bez písmen a číslic', () => {
  it('každý z 10 nástrojů má v každé barvě ikonu jen z tvarů, bez písmen a číslic', () => {
    const allowedKinds = ['circle', 'polygon', 'line', 'star'];
    expect(TOOLS, 'v panelu je 10 nástrojů').toHaveLength(10);
    const side = smallestHandleSide();
    for (const tool of TOOLS) {
      for (const color of ICON_COLORS) {
        const shapes = iconOf(tool, color.hex, side);
        const name = caseName(tool, color.name);
        expect(shapes.length, `${name}: ikona má aspoň jeden tvar`).toBeGreaterThan(0);
        expect(
          [...new Set(shapes.map((shape) => shape.kind))].filter(
            (kind) => !allowedKinds.includes(kind),
          ),
          `${name}: jen kruhy, mnohoúhelníky, čáry a hvězdy (žádný text)`,
        ).toEqual([]);
        expect(
          shapes.map((shape) => shape.color).filter((hex) => !/^#[0-9A-Fa-f]{6}$/.test(hex)),
          `${name}: barvy tvarů jsou neprůhledné #RRGGBB`,
        ).toEqual([]);
        expect(
          shapes.map(outlineOf).filter((outline) => !(Number.isFinite(outline) && outline >= 0)),
          `${name}: obrys je nezáporné číslo`,
        ).toEqual([]);
      }
    }
  });
});

describe('#106 AC3: ikona je vidět na pozadí místa i úchytu', () => {
  it('místa v panelu i úchyt mají dál pozadí #E5F0FF (otázka 4)', () => {
    expect(COLOR_BUTTON_STYLE.background.toUpperCase(), 'místo v panelu').toBe(SLOT_BACKGROUND);
    expect(HANDLE_STYLE.background.toUpperCase(), 'úchyt').toBe(SLOT_BACKGROUND);
    expect(contrastRatio(OUTLINE, SLOT_BACKGROUND), 'tmavý obrys na pozadí').toBeGreaterThanOrEqual(
      MIN_CONTRAST,
    );
  });

  it('ikona leží celá na světlém pozadí a modrého okraje místa ani úchytu se nedotkne', () => {
    const problems: string[] = [];
    for (const testCase of cases()) {
      for (const background of ICON_BACKGROUNDS) {
        const onHandle = background.name === 'úchyt';
        const places: Array<{ place: Box; icon: Box }> = onHandle
          ? [{ place: testCase.handle, icon: handleIconBox(testCase) }]
          : TOOLS.map((_, index) => ({
              place: testCase.tools[index] as Box,
              icon: slotIconBox(testCase, index),
            }));
        places.forEach(({ place, icon }, index) => {
          const tools = onHandle ? TOOLS : [TOOLS[index] as ToolId];
          for (const tool of tools) {
            for (const color of ICON_COLORS) {
              const bounds = iconBounds(iconOf(tool, color.hex, sideOfBox(icon)));
              const margin = Math.min(
                icon.left + bounds.left - place.left,
                place.right - (icon.left + bounds.right),
                icon.top + bounds.top - place.top,
                place.bottom - (icon.top + bounds.bottom),
              );
              if (margin + TOLERANCE < background.borderCss) {
                problems.push(
                  `${testCase.scene.label}, ${background.name}, ${caseName(tool, color.name)}: ` +
                    `ikona ${margin.toFixed(2)} px od kraje, okraj má ${background.borderCss} px`,
                );
              }
            }
          }
        });
      }
    }
    expect(limited(problems)).toEqual([]);
  });

  it('každá barevná část má kontrast aspoň 3 : 1, jinak ji od pozadí všude dělí obrys aspoň 3 px', () => {
    const problems: string[] = [];
    for (const side of [smallestHandleSide(), smallestSlotIconSide()]) {
      for (const tool of TOOLS) {
        for (const color of ICON_COLORS) {
          const raster = rasterOf(tool, color.hex, side);
          const near = nearBackground(raster, MIN_PART_CSS);
          for (const background of ICON_BACKGROUNDS) {
            const touching = new Set<string>();
            raster.cells.forEach((_, index) => {
              const cellColor = colorOfCell(raster, index);
              if (
                cellColor !== null &&
                isColorCell(raster, index) &&
                near[index] === 1 &&
                contrastRatio(cellColor, background.color) < MIN_CONTRAST
              ) {
                touching.add(cellColor);
              }
            });
            if (touching.size > 0) {
              problems.push(
                `ikona ${side.toFixed(1)} px, ${background.name}, ${caseName(tool, color.name)}: ` +
                  `${[...touching].join(' ')} má kontrast pod 3 : 1 a obrys k pozadí je tenčí než 3 px`,
              );
            }
          }
        }
      }
    }
    expect(limited(problems)).toEqual([]);
  });

  it('guma vypadá ve všech barvách stejně, bez vybrané barvy', () => {
    const side = smallestHandleSide();
    const plain = iconOf('eraser', null, side);
    for (const color of ICON_COLORS) {
      expect(iconOf('eraser', color.hex, side), `guma, ${color.name}`).toEqual(plain);
      if (color.hex !== null) {
        expect(
          visibleColors(rasterOf('eraser', color.hex, side)).filter((hex) =>
            sameHex(hex, color.hex as string),
          ),
          `guma, ${color.name}: vybraná barva v ní není`,
        ).toEqual([]);
      }
    }
  });

  it('duhový štětec je ve všech barvách stejný a ukazuje všech 6 barev duhy', () => {
    const side = smallestHandleSide();
    const plain = iconOf('rainbow', null, side);
    for (const color of ICON_COLORS) {
      expect(iconOf('rainbow', color.hex, side), `duha, ${color.name}`).toEqual(plain);
    }
    const shown = visibleColors(rasterOf('rainbow', null, side));
    expect(
      RAINBOW_HEXES.filter((hex) => !shown.some((seen) => sameHex(seen, hex))),
      'barvy duhy, které v ikoně nejsou vidět',
    ).toEqual([]);
  });
});

/** Ikony všech nástrojů v barvě `hex` nakreslené na mřížku nejmenšího místa v panelu (1 px). */
function slotRasters(hex: string | null): Map<ToolId, IconRaster> {
  const { slot, icon } = smallestSlot();
  const side = sideOfBox(slot);
  const iconSide = sideOfBox(icon);
  return new Map(
    TOOLS.map((tool) => [
      tool,
      rasterize(
        movedShapes(iconOf(tool, hex, iconSide), icon.left - slot.left, icon.top - slot.top),
        side,
      ),
    ]),
  );
}

const slotRasterCache = new Map<string, Map<ToolId, IconRaster>>();

function slotRastersOf(hex: string | null): Map<ToolId, IconRaster> {
  const key = String(hex);
  let rasters = slotRasterCache.get(key);
  if (rasters === undefined) {
    rasters = slotRasters(hex);
    slotRasterCache.set(key, rasters);
  }
  return rasters;
}

function isSameBodyPair(first: ToolId, second: ToolId): boolean {
  return SAME_BODY_PAIRS.some(
    ([a, b]) => (a === first && b === second) || (a === second && b === first),
  );
}

function minimumDifference(first: ToolId, second: ToolId): number {
  return isSameBodyPair(first, second) ? MIN_SAME_BODY_DIFFERENCE : MIN_DIFFERENCE;
}

/** Problémy dvojice ve všech barvách: rozdíl pod hranicí. */
function pairProblems(first: ToolId, second: ToolId): string[] {
  const needed = minimumDifference(first, second);
  return ICON_COLORS.flatMap((color) => {
    const rasters = slotRastersOf(color.hex);
    const share = differenceShare(
      rasters.get(first) as IconRaster,
      rasters.get(second) as IconRaster,
    );
    return share >= needed
      ? []
      : [
          `${TOOL_NAMES[first]} a ${TOOL_NAMES[second]}, ${color.name}: liší se ` +
            `${(share * 100).toFixed(1)} % pixelů, potřeba ${needed * 100} %`,
        ];
  });
}

/** Dvojice, které AC4 jmenuje zvlášť (a štětec s duhovým štětcem, které mají v D stejné tělo). */
const NAMED_PAIRS: ReadonlyArray<readonly [ToolId, ToolId]> = [
  ['marker', 'dots'],
  ['marker', 'stripes'],
  ['marker', 'stamp'],
  ['dots', 'stripes'],
  ['dots', 'stamp'],
  ['stripes', 'stamp'],
  ['stamp', 'glitter'],
  ['dots', 'spray'],
  ['brush', 'marker'],
  ['brush', 'crayon'],
  ['marker', 'crayon'],
  ['brush', 'rainbow'],
];

describe('#106 AC4: každé dvě ikony ve stejné barvě se od sebe liší', () => {
  for (const [first, second] of NAMED_PAIRS) {
    it(`${TOOL_NAMES[first]} a ${TOOL_NAMES[second]} se od sebe na první pohled liší`, () => {
      expect(limited(pairProblems(first, second))).toEqual([]);
    });
  }

  it('všech 45 dvojic nástrojů se v každé barvě liší aspoň o 25 % pixelů (stejné tělo aspoň o 10 %)', () => {
    const pairs = TOOLS.flatMap((first, index) =>
      TOOLS.slice(index + 1).map((second) => [first, second] as const),
    );
    expect(pairs, 'dvojic je 45').toHaveLength(45);
    expect(limited(pairs.flatMap(([first, second]) => pairProblems(first, second)))).toEqual([]);
  });
});

describe('#106 AC5: ikony jsou jednoduché i v nejmenším úchytu', () => {
  it('ikona má kromě obrysu nejvýš 3 barvy, duha 6 barev duhy a nejvýš 2 další', () => {
    const side = smallestHandleSide();
    const problems: string[] = [];
    for (const tool of TOOLS) {
      for (const color of ICON_COLORS) {
        const shown = visibleColors(rasterOf(tool, color.hex, side));
        const name = caseName(tool, color.name);
        if (tool === 'rainbow') {
          const extra = shown.filter((hex) => !RAINBOW_HEXES.some((r) => sameHex(r, hex)));
          if (extra.length > MAX_RAINBOW_EXTRA_COLORS) {
            problems.push(`${name}: kromě duhy ${extra.length} barev (${extra.join(' ')})`);
          }
        } else if (shown.length > MAX_COLORS) {
          problems.push(`${name}: ${shown.length} barev (${shown.join(' ')})`);
        }
      }
    }
    expect(limited(problems)).toEqual([]);
  });

  it('ikona má nejvýš 10 oddělených částí, guma nejvýš 3', () => {
    const side = smallestHandleSide();
    const problems: string[] = [];
    for (const tool of TOOLS) {
      const allowed = tool === 'eraser' ? MAX_ERASER_PARTS : MAX_PARTS;
      for (const color of ICON_COLORS) {
        const count = colorParts(rasterOf(tool, color.hex, side)).length;
        if (count > allowed) {
          problems.push(`${caseName(tool, color.name)}: ${count} částí, nejvýš ${allowed}`);
        }
      }
    }
    expect(limited(problems)).toEqual([]);
  });

  it('každá barevná část i mezera je v nejmenším úchytu aspoň 3 px', () => {
    const side = smallestHandleSide();
    const problems: string[] = [];
    for (const tool of TOOLS) {
      for (const color of ICON_COLORS) {
        const raster = rasterOf(tool, color.hex, side);
        const name = caseName(tool, color.name);
        const thinParts = colorParts(raster).filter(
          (part) => !fitsDisc(raster, part, MIN_PART_CSS),
        );
        if (thinParts.length > 0) {
          const colors = thinParts.map((part) => colorOfCell(raster, part[0] as number));
          problems.push(`${name}: části užší než 3 px v barvách ${colors.join(' ')}`);
        }
        const thinHoles = holes(raster).filter((hole) => !fitsDisc(raster, hole, MIN_PART_CSS));
        if (thinHoles.length > 0) {
          problems.push(`${name}: ${thinHoles.length} mezer uvnitř ikony užších než 3 px`);
        }
        const gaps = narrowGaps(raster, MIN_PART_CSS);
        if (gaps.length > 0) {
          problems.push(`${name}: mezera užší než 3 px mezi ${gaps.join(', ')}`);
        }
      }
    }
    expect(limited(problems)).toEqual([]);
  });

  it('obrys i každá čára ikony jsou v nejmenším úchytu silné aspoň 3 px', () => {
    const side = smallestHandleSide();
    const problems: string[] = [];
    for (const tool of TOOLS) {
      for (const color of ICON_COLORS) {
        iconOf(tool, color.hex, side).forEach((shape, index) => {
          const name = `${caseName(tool, color.name)}, tvar ${index + 1}`;
          const outline = outlineOf(shape);
          if (outline > 0 && outline + TOLERANCE < MIN_PART_CSS) {
            problems.push(`${name}: obrys ${outline.toFixed(2)} px`);
          }
          if (shape.kind === 'line' && shape.width + TOLERANCE < MIN_PART_CSS) {
            problems.push(`${name}: čára ${shape.width.toFixed(2)} px`);
          }
        });
      }
    }
    expect(limited(problems)).toEqual([]);
  });

  it('hvězdička razítkového fixu a jiskry třpytek mají průměr aspoň 6 px a cípy u základny aspoň 3 px', () => {
    const side = smallestHandleSide();
    const problems: string[] = [];
    for (const tool of ['stamp', 'glitter'] as const) {
      for (const color of ICON_COLORS) {
        const name = caseName(tool, color.name);
        const stars = iconOf(tool, color.hex, side).flatMap((shape) =>
          shape.kind === 'star' ? [shape] : [],
        );
        if (stars.length === 0) {
          problems.push(`${name}: ikona nemá hvězdičku ani jiskru`);
        }
        stars.forEach((star, index) => {
          const diameter = 2 * star.outerRadius;
          const base = tipBaseWidth(star);
          if (diameter + TOLERANCE < MIN_STAR_DIAMETER_CSS) {
            problems.push(`${name}, hvězda ${index + 1}: průměr ${diameter.toFixed(2)} px`);
          }
          if (base + TOLERANCE < MIN_TIP_BASE_CSS) {
            problems.push(`${name}, hvězda ${index + 1}: cíp u základny ${base.toFixed(2)} px`);
          }
        });
      }
    }
    expect(limited(problems)).toEqual([]);
  });
});

describe('#106 AC3 a AC6: malovací nástroj ukazuje vybranou barvu', () => {
  it('štětec, fix, pastelka, razítkový, puntíkový a proužkový fix, třpytky i sprej mají v ikoně vybranou barvu', () => {
    const side = smallestHandleSide();
    const problems: string[] = [];
    for (const tool of COLOR_TOOLS) {
      for (const color of ICON_COLORS) {
        if (color.hex === null) {
          continue;
        }
        const shown = visibleColors(rasterOf(tool, color.hex, side));
        if (!shown.some((hex) => sameHex(hex, color.hex as string))) {
          problems.push(`${caseName(tool, color.name)}: vybraná barva v ikoně není vidět`);
        }
      }
    }
    expect(limited(problems)).toEqual([]);
  });
});
