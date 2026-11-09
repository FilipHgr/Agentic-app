/**
 * Pomůcky pro testy k #116 (vlastní sada barev u každého nástroje
 * v Omalovánkách).
 *
 * Tabulka sad a výchozí barvy jsou schválně opsané přímo ze zadání (tabulka sad podle schválené v2), ne
 * převzaté z kódu, aby je nešlo potichu změnit. Znak „=“ ze zadání je tu
 * rovnou nahrazený barvou štětce na stejném místě.
 *
 * Testy neznají čísla barev (poznámka pro vývoj v zadání je nezávazná).
 * Odstín barvy `color` čtou tak, jak ho dítě vidí na kolečku barvy
 * v úchytu (`handleColorDotFill`, #106, #110), a co je v kroku barev,
 * z navrženého `game.colorStep()` (viz `toolColorSets.test.ts`).
 *
 * Výpočty barev pro AC2 jsou tu napsané bez nové závislosti:
 * - ΔE76 je vzdálenost v CIELAB, převod sRGB → lineární RGB → XYZ (matice
 *   sRGB z IEC 61966-2-1) → L*a*b* s bílým bodem D65,
 * - kontrast je poměr podle WCAG 2: (L1 + 0,05) / (L2 + 0,05) z relativního
 *   jasu L = 0,2126 R + 0,7152 G + 0,0722 B lineárních kanálů.
 */

import type { SavedColoring } from '../../../src/games/coloring/logic/savedPicture';
import { handleColorDotFill } from '../../../src/games/coloring/logic/toolIcons';
import { COLOR_TOOLS, pickTool } from './toolColorsHelpers';
import type { ColorTool } from './toolColorsHelpers';

/** Kolik barev má krok barev každého nástroje (#100, #116 AC1). */
export const SET_SIZE = 12;

/** Kolik je barev štětce, nových barev a všech barev podle zadání. */
export const BRUSH_COLOR_COUNT = 12;
export const NEW_COLOR_COUNT = 34;
export const ALL_COLOR_COUNT = 46;

/** Nejvíc barev, které zná formát obrázku (#115) a které dovoluje AC2 d). */
export const MAX_COLOR_COUNT = 64;

/** Názvy míst 1 až 12 podle druhu barvy štětce (sloupec „místo“ v zadání). */
export const PLACE_NAMES: readonly string[] = [
  'červená',
  'oranžová',
  'žlutá',
  'zelená',
  'modrá',
  'fialová',
  'hnědá',
  'černá',
  'růžová',
  'tělová',
  'šedá',
  'světle modrá',
];

/** Sloupec štětce (barvy štětce zůstávají, jak jsou). */
const BRUSH_COLUMN: readonly string[] = [
  '#FF3B30',
  '#FF9500',
  '#FFCC00',
  '#34C759',
  '#007AFF',
  '#AF52DE',
  '#A2845E',
  '#2C2C2E',
  '#F75A9C',
  '#DE9670',
  '#8E8E93',
  '#44B6EC',
];

/** Stejná barva jako štětec na stejném místě (znak „=“ v tabulce zadání). */
const SAME = '=';

/** Sloupce ostatních nástrojů přesně podle schválené tabulky v2 (komentář „Schválené odstíny v2“ v #116). */
const OTHER_COLUMNS: Readonly<Record<Exclude<ColorTool, 'brush'>, readonly string[]>> = {
  marker: [
    '#A8000C',
    SAME,
    SAME,
    '#00843C',
    '#0040DD',
    '#720C93',
    SAME,
    SAME,
    '#AB005D',
    SAME,
    SAME,
    SAME,
  ],
  crayon: [
    SAME,
    '#E9762B',
    SAME,
    '#5E9E3A',
    '#3D74C4',
    '#9B6AC0',
    '#8A5A35',
    SAME,
    SAME,
    SAME,
    SAME,
    SAME,
  ],
  stamp: [
    SAME,
    '#FF7E1A',
    SAME,
    '#1BBBA2',
    SAME,
    '#D63AF9',
    SAME,
    SAME,
    SAME,
    SAME,
    SAME,
    '#00A8C6',
  ],
  dots: [
    '#FC7542',
    SAME,
    SAME,
    '#00C08A',
    '#395AFF',
    '#ED3FE4',
    SAME,
    SAME,
    '#FF039F',
    SAME,
    SAME,
    '#06A2FF',
  ],
  stripes: [
    '#C7252B',
    SAME,
    SAME,
    '#3F9B4A',
    '#2057A8',
    SAME,
    SAME,
    SAME,
    SAME,
    SAME,
    SAME,
    '#2E8FD8',
  ],
  glitter: [
    SAME,
    SAME,
    '#C9A227',
    SAME,
    SAME,
    '#8E44AD',
    '#9C6B30',
    SAME,
    '#D4708F',
    SAME,
    '#8D9FC3',
    SAME,
  ],
  spray: [
    '#FF1F4B',
    '#FF6A00',
    SAME,
    '#4CBB17',
    '#1E90FF',
    '#9933FF',
    SAME,
    SAME,
    SAME,
    SAME,
    SAME,
    SAME,
  ],
};

/** Barvy štětce na místech 1 až 12. */
export const BRUSH_SET: readonly string[] = BRUSH_COLUMN;

/** Sloupec nástroje s „=“ nahrazeným barvou štětce na stejném místě. */
function resolved(column: readonly string[]): readonly string[] {
  return column.map((hex, place) => (hex === SAME ? (BRUSH_COLUMN[place] ?? '') : hex));
}

/** Sada každého malovacího nástroje: 12 odstínů v pořadí míst, „=“ nahrazené barvou štětce. */
export const TOOL_SETS: Readonly<Record<ColorTool, readonly string[]>> = {
  brush: BRUSH_COLUMN,
  marker: resolved(OTHER_COLUMNS.marker),
  crayon: resolved(OTHER_COLUMNS.crayon),
  stamp: resolved(OTHER_COLUMNS.stamp),
  dots: resolved(OTHER_COLUMNS.dots),
  stripes: resolved(OTHER_COLUMNS.stripes),
  glitter: resolved(OTHER_COLUMNS.glitter),
  spray: resolved(OTHER_COLUMNS.spray),
};

/** Výchozí barvy nového profilu podle zadání, puntíkový podle v2 (nahrazují #110 AC5). */
export const DEFAULT_HEXES: Readonly<Record<ColorTool, string>> = {
  brush: '#FF3B30',
  marker: '#0040DD',
  crayon: '#5E9E3A',
  stamp: '#FF7E1A',
  dots: '#FF039F',
  stripes: '#2E8FD8',
  glitter: '#C9A227',
  spray: '#9933FF',
};

/** Barvy duhy (#97): prvních 6 barev štětce, duha se nemění. */
export const RAINBOW_HEXES: readonly string[] = BRUSH_COLUMN.slice(0, 6);

/** Nová barva sady: odstín, nástroj a místo (0 až 11). */
export interface NewColor {
  readonly hex: string;
  readonly tool: ColorTool;
  readonly place: number;
}

/** Všechny nové barvy tabulky (místa, kde se nástroj liší od štětce), po sloupcích. */
export function newColors(): NewColor[] {
  const found: NewColor[] = [];
  for (const tool of COLOR_TOOLS) {
    TOOL_SETS[tool].forEach((hex, place) => {
      if (hex !== BRUSH_COLUMN[place]) {
        found.push({ hex, tool, place });
      }
    });
  }
  return found;
}

/** Všechny různé odstíny tabulky po sloupcích (štětec, fix, …, sprej). */
export function allTableHexes(): string[] {
  return [...new Set(COLOR_TOOLS.flatMap((tool) => TOOL_SETS[tool]))];
}

/** Kanály R, G, B 0 až 255 z `#RRGGBB`. */
function channelsOf(hex: string): [number, number, number] {
  return [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16)) as [
    number,
    number,
    number,
  ];
}

/** Kanál sRGB 0 až 255 jako lineární hodnota 0 až 1. */
function linear(channel: number): number {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

/** Bílý bod D65 (Y = 1). */
const WHITE_X = 0.95047;
const WHITE_Y = 1;
const WHITE_Z = 1.08883;

/** Pomocná funkce převodu XYZ → L*a*b*. */
function labCurve(ratio: number): number {
  const epsilon = 216 / 24389;
  const kappa = 24389 / 27;
  return ratio > epsilon ? Math.cbrt(ratio) : (kappa * ratio + 16) / 116;
}

/** Barva `#RRGGBB` v CIELAB (D65). */
export function labOf(hex: string): [number, number, number] {
  const [r, g, b] = channelsOf(hex).map(linear) as [number, number, number];
  const x = 0.4124 * r + 0.3576 * g + 0.1805 * b;
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const z = 0.0193 * r + 0.1192 * g + 0.9505 * b;
  const fx = labCurve(x / WHITE_X);
  const fy = labCurve(y / WHITE_Y);
  const fz = labCurve(z / WHITE_Z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/** Rozdíl dvou barev ΔE76 (vzdálenost v CIELAB). */
export function deltaE76(first: string, second: string): number {
  const [l1, a1, b1] = labOf(first);
  const [l2, a2, b2] = labOf(second);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}

/** Relativní jas podle WCAG 2. */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = channelsOf(hex).map(linear) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Kontrast dvou barev podle WCAG 2 (vždy aspoň 1). */
export function contrastRatio(first: string, second: string): number {
  const lighter = Math.max(relativeLuminance(first), relativeLuminance(second));
  const darker = Math.min(relativeLuminance(first), relativeLuminance(second));
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Odstín barvy `color` tak, jak ho dítě vidí na kolečku barvy štětce
 * v úchytu (velkými písmeny); `null`, když ho kolečko neukáže.
 */
export function hexOf(color: number | null): string | null {
  if (color === null) {
    return null;
  }
  const fill = handleColorDotFill({ tool: 'brush', color, size: 'medium' });
  return fill.kind === 'color' ? fill.hex.toUpperCase() : null;
}

/** Odstíny v kroku barev v pořadí míst. */
export function stepHexes(game: SavedColoring): Array<string | null> {
  return game.colorStep().map(hexOf);
}

/**
 * Dítě ťukne v kroku barev na místo `place` (0 až 11). Scéna ťuknutí na
 * místo hlásí jako `tapColor` s barvou, kterou místo ukazuje.
 */
export function tapPlace(game: SavedColoring, place: number): void {
  const color = game.colorStep()[place];
  if (color === undefined) {
    throw new Error(`v kroku barev není místo ${place + 1}`);
  }
  game.tapColor(color);
}

/** Dítě otevře panel, ťukne na nástroj `tool` a v jeho kroku barev na místo `place`. */
export function giveToolPlace(game: SavedColoring, tool: ColorTool, place: number): void {
  pickTool(game, tool);
  tapPlace(game, place);
}

/** Barva (číslo) na místě `place` sady nástroje `tool`, jak ji ukazuje krok barev. */
export function colorAtPlace(game: SavedColoring, tool: ColorTool, place: number): number {
  pickTool(game, tool);
  const color = game.colorStep()[place];
  game.tapHandle();
  if (color === undefined) {
    throw new Error(`${tool}: v kroku barev není místo ${place + 1}`);
  }
  return color;
}

/**
 * Všechny barvy ze všech sad (čísla barev bez opakování) po sloupcích
 * tabulky, jak je ukazují kroky barev nástrojů. Panel nechá zavřený.
 */
export function allSetColors(game: SavedColoring): number[] {
  const colors: number[] = [];
  for (const tool of COLOR_TOOLS) {
    pickTool(game, tool);
    for (const color of game.colorStep()) {
      if (!colors.includes(color)) {
        colors.push(color);
      }
    }
  }
  game.tapHandle();
  return colors;
}
