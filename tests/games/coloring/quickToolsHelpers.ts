/**
 * Pomůcky pro testy k #148 (rychlé přepnutí na předchozí nástroj a gumu
 * místo nedávných barev z #99). V pruhu jsou dvě tlačítka: **první** ukazuje
 * předchozí nástroj (jeho ikonu a kolečko jeho barvy jako úchyt, duha bez
 * kolečka) nebo prázdné místo, **druhé** je vždy guma.
 *
 * Navržené rozhraní (`src/games/coloring/logic/savedPicture.ts`), nová pole
 * `SavedColoring` místo `recentColors()` a `tapRecentColor(i)`:
 * - `previousTool(): PreviousToolView | null`, co ukazuje první tlačítko:
 *   `{ tool: ToolId; color: number | null }` (barva jako `toolColor(tool)`,
 *   u duhy `null`), `null` u prázdného místa; nikdy guma,
 * - `pressQuickTool(button: QuickToolButton, pointerId: number): QuickToolTap`
 *   prst `pointerId` se dotkl tlačítka `'previousTool'` nebo `'eraser'`;
 *   přepnutí platí hned při dotyku,
 * - `releaseQuickTool(pointerId: number): void` prst se zvedl nebo dotyk
 *   přerušil systém; dokud první prst tlačítko drží, další prsty na obou
 *   tlačítkách nic nedělají (`ignored`, #148 AC6),
 * - `homeHolding(holding: boolean): void` domeček se začal nebo přestal
 *   držet; `PictureChoice.homeHolding` ho předá připojenému malování
 *   (`attachPainting`) stejně jako koště `broomHolding`,
 * kde
 * `type QuickToolButton = 'previousTool' | 'eraser'` a
 * `type QuickToolTap =
 *   | { kind: 'picked'; tones: readonly Tone[] }   // nástroj vybraný, tón < 1 s
 *   | { kind: 'wobble'; tones: readonly Tone[] }   // prázdné místo nebo už vybraná guma
 *   | { kind: 'ignored' }`                         // jiný prst maluje, druhý prst, ukládání, držení.
 *
 * Všechna volání nového rozhraní jsou jen tady, aby šla při implementaci
 * upravit na jednom místě.
 */

import type { SavedColoring } from '../../../src/games/coloring/logic/savedPicture';
import type { ToolId } from '../../../src/games/coloring/logic/toolPanel';
import type { Tone } from '../../../src/shared/audio/tonePlayer';

/** Co ukazuje první tlačítko: nástroj a kolečko jeho barvy, nebo prázdné místo (`null`). */
export interface FirstButton {
  readonly tool: ToolId;
  readonly color: number | null;
}

/** Co udělalo ťuknutí na jedno ze dvou tlačítek. */
export type QuickTap =
  | { readonly kind: 'picked'; readonly tones: readonly Tone[] }
  | { readonly kind: 'wobble'; readonly tones: readonly Tone[] }
  | { readonly kind: 'ignored' };

/** Tlačítko v pruhu: první (předchozí nástroj), nebo druhé (guma). */
export type QuickButton = 'previousTool' | 'eraser';

/** Prst, kterým dítě v testech ťuká na tlačítka. */
export const QUICK_FINGER = 7;

/** Druhý prst na tlačítkách. */
export const OTHER_QUICK_FINGER = 8;

/** Co dítě vidí na prvním tlačítku (kopie, aby šla porovnat). */
export function firstButton(game: SavedColoring): FirstButton | null {
  const view = game.previousTool();
  return view === null ? null : { tool: view.tool, color: view.color };
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

/** Ťuknutí na první tlačítko (předchozí nástroj). */
export function tapPrevious(game: SavedColoring, finger = QUICK_FINGER): QuickTap {
  return tap(game, 'previousTool', finger);
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
