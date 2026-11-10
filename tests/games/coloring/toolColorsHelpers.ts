/**
 * Pomůcky pro testy k #110 (každý nástroj v Omalovánkách si pamatuje svou
 * barvu). Barva nástroje se čte tak, jak ji vidí dítě: úchyt ukazuje
 * vybraný nástroj v jeho barvě (`game.handleView()`), krok barev označí
 * barvu vybraného nástroje (od #116 `game.markedColorPlace()`) a krok nástrojů
 * ukazuje barvu každého malovacího nástroje (`game.toolColor(tool)`,
 * navržené rozhraní v `toolColors.test.ts`).
 */

import type { SavedColoring } from '../../../src/games/coloring/logic/savedPicture';
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

/**
 * Výchozí barvy nových sad z #116 jako čísla barev: nové barvy mají čísla
 * od 12 po sloupcích schválené tabulky v2 (fix 12–16, pastelka 17–21,
 * razítkový 22–25, puntíkový 26–31, proužkový 32–35, třpytky 36–40,
 * sprej 41–45). Čísla jsou v uložených obrázcích, proto jsou tu opsaná.
 */
export const MARKER_BLUE = 14; // #0040DD
export const CRAYON_GREEN = 18; // #5E9E3A
export const STAMP_ORANGE = 22; // #FF7E1A
export const DOTS_PINK = 30; // #FF039F
export const STRIPES_LIGHT_BLUE = 35; // #2E8FD8
export const GLITTER_GOLD = 36; // #C9A227
export const SPRAY_PURPLE = 45; // #9933FF

/**
 * Výchozí barvy nástrojů v novém profilu. Tabulku z #110 AC5 nahradil #116
 * (výchozí barvy ze zadání #116, puntíkový podle tabulky v2).
 */
export const DEFAULT_TOOL_COLORS: Readonly<Record<ColorTool, number>> = {
  brush: RED,
  marker: MARKER_BLUE,
  crayon: CRAYON_GREEN,
  stamp: STAMP_ORANGE,
  dots: DOTS_PINK,
  stripes: STRIPES_LIGHT_BLUE,
  glitter: GLITTER_GOLD,
  spray: SPRAY_PURPLE,
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

/**
 * Barva (číslo barvy) označená v kroku barev, prázdné, když není označená
 * žádná. Upraveno k #116: krok barev ukazuje sadu nástroje, označené místo
 * je `markedColorPlace()` a barva na něm `colorStep()[místo]`; do #116 to
 * bylo `markedColors(game.palette())` nad 12 barvami štětce.
 */
export function markedColorIndexes(game: SavedColoring): number[] {
  const place = game.markedColorPlace();
  const color = place === null ? undefined : game.colorStep()[place];
  return color === undefined ? [] : [color];
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
