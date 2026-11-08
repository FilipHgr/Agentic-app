/**
 * Pomůcky pro testy k #110 (každý nástroj v Omalovánkách si pamatuje svou
 * barvu). Barva nástroje se čte tak, jak ji vidí dítě: úchyt ukazuje
 * vybraný nástroj v jeho barvě (`game.handleView()`), krok barev označí
 * barvu vybraného nástroje (`markedColors(game.palette())`) a krok nástrojů
 * ukazuje barvu každého malovacího nástroje (`game.toolColor(tool)`,
 * navržené rozhraní v `toolColors.test.ts`).
 */

import type { SavedColoring } from '../../../src/games/coloring/logic/savedPicture';
import { markedColors } from '../../../src/games/coloring/logic/palette';
import type { ToolId } from '../../../src/games/coloring/logic/toolPanel';
import { choose } from './drawingToolHelpers';

/** Barvy palety podle indexu (schválně ne konstanty z kódu). */
export const RED = 0;
export const ORANGE = 1;
export const YELLOW = 2;
export const GREEN = 3;
export const BLUE = 4;
export const PURPLE = 5;
export const BROWN = 6;
export const BLACK = 7;
export const PINK = 8;
export const SKIN = 9;
export const GRAY = 10;
export const LIGHT_BLUE = 11;

/** Malovací nástroje, které malují vybranou barvou (#110 AC1), v pořadí panelu. */
export const COLOR_TOOLS = [
  'brush',
  'marker',
  'crayon',
  'stamp',
  'dots',
  'stripes',
  'glitter',
  'spray',
] as const satisfies readonly ToolId[];

export type ColorTool = (typeof COLOR_TOOLS)[number];

/** Nástroje bez barvy (#110 AC1): guma a duha. */
export const TOOLS_WITHOUT_COLOR = ['eraser', 'rainbow'] as const satisfies readonly ToolId[];

/** Výchozí barvy nástrojů v novém profilu, tabulka z #110 AC5 (přepsaná přímo ze zadání). */
export const DEFAULT_TOOL_COLORS: Readonly<Record<ColorTool, number>> = {
  brush: RED,
  marker: BLUE,
  crayon: GREEN,
  stamp: ORANGE,
  dots: PURPLE,
  stripes: PINK,
  glitter: LIGHT_BLUE,
  spray: BLACK,
};

/** Je nástroj malovací nástroj s vlastní barvou? */
export function isColorTool(tool: ToolId): tool is ColorTool {
  return COLOR_TOOLS.some((each) => each === tool);
}

/** Výchozí barvy, jen štětec má barvu `brushColor`. */
export function defaultsWithBrush(brushColor: number): Record<ColorTool, number> {
  return { ...DEFAULT_TOOL_COLORS, brush: brushColor };
}

/** Všech 8 malovacích nástrojů v barvě `color` (starý stav, #110 AC6). */
export function allToolsIn(color: number): Record<ColorTool, number> {
  return Object.fromEntries(COLOR_TOOLS.map((tool) => [tool, color])) as Record<ColorTool, number>;
}

/** Barvy všech malovacích nástrojů tak, jak je dítě vidí v kroku nástrojů. */
export function toolColorsOf(game: SavedColoring): Record<ColorTool, number | null> {
  return Object.fromEntries(COLOR_TOOLS.map((tool) => [tool, game.toolColor(tool)])) as Record<
    ColorTool,
    number | null
  >;
}

/** Index jediné označené barvy v kroku barev (nebo všechny označené, když jich je víc). */
export function markedColorIndexes(game: SavedColoring): number[] {
  return markedColors(game.palette()).flatMap((marked, index) => (marked ? [index] : []));
}

/** Panel otevřený na kroku nástrojů (z kteréhokoli kroku). */
export function openToolStep(game: SavedColoring): void {
  if (game.panelView() !== 'closed') {
    game.tapHandle();
  }
  game.tapHandle();
}

/**
 * Dítě otevře panel, ťukne na nástroj `tool` a v jeho kroku barev zvolí
 * `color`. Výběr barvy panel zavře (#105 AC3).
 */
export function giveColor(game: SavedColoring, tool: ToolId, color: number): void {
  openToolStep(game);
  choose(game, tool);
  game.tapColor(color);
}

/** Dítě otevře panel a ťukne na nástroj `tool` (malovací nástroj otevře krok barev). */
export function pickTool(game: SavedColoring, tool: ToolId): void {
  openToolStep(game);
  choose(game, tool);
}
