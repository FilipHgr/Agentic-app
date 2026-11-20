/**
 * Pomůcky pro testy k #148 a #163 (rychlé přepínání jen mezi kreslicím
 * nástrojem a gumou místo nedávných barev z #99). V pruhu jsou dvě
 * tlačítka: **první** ukazuje kreslicí nástroj (vybraný, s vybranou gumou
 * ten těsně před gumou; ikonu a kolečko jeho barvy, od #164 velké podle
 * velikosti čáry a u duhy duhové), **druhé** je vždy guma.
 *
 * Rozhraní (`src/games/coloring/logic/savedPicture.ts`, pole `SavedColoring`):
 * - `quickDrawingTool(): QuickDrawingToolView`, co ukazuje první tlačítko:
 *   `{ tool; color: number | null }` (barva jako `toolColor(tool)`, u duhy
 *   `null`); nikdy guma a nikdy prázdné,
 * - `pressQuickTool(button: QuickToolButton, pointerId: number): QuickToolTap`
 *   prst `pointerId` se dotkl tlačítka `'drawingTool'` nebo `'eraser'`;
 *   přepnutí platí hned při dotyku,
 * - `releaseQuickTool(pointerId: number): void` prst se zvedl nebo dotyk
 *   přerušil systém; dokud první prst tlačítko drží, další prsty na obou
 *   tlačítkách nic nedělají (`ignored`, #148 AC6),
 * - `homeHolding(holding: boolean): void` domeček se začal nebo přestal
 *   držet; `PictureChoice.homeHolding` ho předá připojenému malování
 *   (`attachPainting`) stejně jako koště `broomHolding`,
 * kde
 * `type QuickToolButton = 'drawingTool' | 'eraser'` a
 * `type QuickToolTap =
 *   | { kind: 'picked'; tones: readonly Tone[] }   // nástroj vybraný, tón < 1 s
 *   | { kind: 'wobble'; tones: readonly Tone[] }   // už vybrané tlačítko
 *   | { kind: 'ignored' }`                         // jiný prst maluje, druhý prst, ukládání, držení.
 *
 * Všechna volání rozhraní jsou jen tady, aby šla upravit na jednom místě.
 */

import type { SavedColoring } from '../../../src/games/coloring/logic/savedPicture';
import type { ToolId } from '../../../src/games/coloring/logic/toolPanel';
import type { Tone } from '../../../src/shared/audio/tonePlayer';

/** Co ukazuje první tlačítko: kreslicí nástroj a kolečko jeho barvy. */
export interface FirstButton {
  readonly tool: ToolId;
  readonly color: number | null;
}

/** Co udělalo ťuknutí na jedno ze dvou tlačítek. */
export type QuickTap =
  | { readonly kind: 'picked'; readonly tones: readonly Tone[] }
  | { readonly kind: 'wobble'; readonly tones: readonly Tone[] }
  | { readonly kind: 'ignored' };

/** Tlačítko v pruhu: první (kreslicí nástroj), nebo druhé (guma). */
export type QuickButton = 'drawingTool' | 'eraser';

/** Prst, kterým dítě v testech ťuká na tlačítka. */
export const QUICK_FINGER = 7;

/** Druhý prst na tlačítkách. */
export const OTHER_QUICK_FINGER = 8;

/** Co dítě vidí na prvním tlačítku (kopie, aby šla porovnat). */
export function firstButton(game: SavedColoring): FirstButton {
  const view = game.quickDrawingTool();
  return { tool: view.tool, color: view.color };
}

/** Prst se dotkne tlačítka a zůstane na něm. */
export function press(game: SavedColoring, button: QuickButton, finger = QUICK_FINGER): QuickTap {
  return game.pressQuickTool(button, finger);
}

/** Prst se z tlačítka zvedne. */
export function release(game: SavedColoring, finger = QUICK_FINGER): void {
  game.releaseQuickTool(finger);
}

/** Ťuknutí na tlačítko: dotyk a hned zvednutí. */
export function tap(game: SavedColoring, button: QuickButton, finger = QUICK_FINGER): QuickTap {
  const result = press(game, button, finger);
  release(game, finger);
  return result;
}

/** Ťuknutí na první tlačítko (kreslicí nástroj). */
export function tapFirstButton(game: SavedColoring, finger = QUICK_FINGER): QuickTap {
  return tap(game, 'drawingTool', finger);
}

/** Ťuknutí na druhé tlačítko (guma). */
export function tapQuickEraser(game: SavedColoring, finger = QUICK_FINGER): QuickTap {
  return tap(game, 'eraser', finger);
}

/** Co ukazuje první tlačítko pro nástroj `tool` podle dnešních barev nástrojů. */
export function shownAs(game: SavedColoring, tool: ToolId): FirstButton {
  return { tool, color: game.toolColor(tool) };
}

/** Vše, co přepnutí nástroje nesmí změnit kromě nástroje (#148 AC2). */
export function lineSizeAndColors(game: SavedColoring): unknown {
  return {
    lineSize: game.lineSize(),
    toolColors: Object.fromEntries(
      (['brush', 'marker', 'crayon', 'stamp', 'dots', 'stripes', 'glitter', 'spray'] as const).map(
        (tool) => [tool, game.toolColor(tool)],
      ),
    ),
  };
}
