/**
 * Rychlé přepínání nástrojů Omalovánek (#148, od #163 jen mezi nástrojem
 * a gumou). V pruhu jsou dvě tlačítka: první ukazuje kreslicí nástroj
 * (ikonu a kolečko jeho barvy velké podle velikosti čáry, od #164 místo
 * úchytu; duha s duhovým kolečkem), druhé je vždy guma. Vybrané z nich je
 * označené.
 *
 * Na prvním tlačítku je vybraný kreslicí nástroj, s vybranou gumou ten,
 * kterým se kreslilo těsně před gumou (#163 AC1). Mění se jen výběrem
 * jiného kreslicího nástroje (v panelu nebo barvou, která přepne gumu nebo
 * duhu, AC4), střídání guma / nástroj ho nemění (AC2). Po otevření hry je
 * vybraný štětec a na prvním tlačítku štětec (AC5). Nic z toho se neukládá,
 * starý záznam `quickTools` z #148 se nečte ani nemaže. Čistý TypeScript
 * bez Phaseru.
 */

import type { Tone } from '../../../shared/audio/tonePlayer';
import { HOME_WOBBLE_TONES } from '../../../shared/logic/homeButton';
import { handleColorDotFill } from './toolIcons';
import type { HandleColorDotFill } from './toolIcons';
import { INITIAL_TOOL, TOOL_PICK_TONES } from './toolPanel';
import type { LineSize, ToolId } from './toolPanel';

/** Kreslicí nástroj: každý nástroj kromě gumy (smí být na prvním tlačítku). */
export type DrawingToolId = Exclude<ToolId, 'eraser'>;

/** Tlačítko v pruhu: první (kreslicí nástroj), nebo druhé (guma). */
export type QuickToolButton = 'drawingTool' | 'eraser';

/** Co udělal dotyk na jedno ze dvou tlačítek. */
export type QuickToolTap =
  /** Nástroj se vybral: scéna překreslí výběr a zahraje krátký tón. */
  | { readonly kind: 'picked'; readonly tones: readonly Tone[] }
  /** Už vybrané tlačítko: jen se zhoupne s tónem domečku (#163 AC3). */
  | { readonly kind: 'wobble'; readonly tones: readonly Tone[] }
  /** Jiný prst maluje nebo drží tlačítko, ukládá se, drží se domeček nebo koště: nic. */
  | { readonly kind: 'ignored' };

/** Co ukazuje první tlačítko: nástroj a barva kolečka (u duhy `null`). */
export interface QuickDrawingToolView {
  readonly tool: DrawingToolId;
  readonly color: number | null;
}

/**
 * Čím je vyplněné kolečko barvy na prvním tlačítku (#164 AC4, dřív
 * v úchytu): malovací nástroj ve své barvě, duha duhové. Kdyby nástroj
 * barvu neměl, ukáže se bílé čárkované jako u gumy. Velikost čáry
 * `size` mění jen velikost kolečka (`quickToolColorDot`), ne výplň.
 */
export function quickToolColorDotFill(
  view: QuickDrawingToolView,
  size: LineSize,
): HandleColorDotFill {
  return handleColorDotFill({ tool: view.tool, color: view.color, size });
}

/** Krátký tón přepnutí (#148 AC2), stejný jako výběr nástroje v panelu, dozní za 0,12 s. */
export const QUICK_TOOL_TONES: readonly Tone[] = TOOL_PICK_TONES;

/** Tón, když se tlačítko jen zhoupne (#148 AC3), stejný jako u domečku. */
export const QUICK_TOOL_WOBBLE_TONES: readonly Tone[] = HOME_WOBBLE_TONES;

/** Kreslí nástroj (každý kromě gumy)? */
export function isDrawingTool(tool: ToolId): tool is DrawingToolId {
  return tool !== 'eraser';
}

/** Výchozí štětec, se kterým hra začíná a který je po otevření na prvním tlačítku (#90 AC1). */
export const INITIAL_DRAWING_TOOL: DrawingToolId = isDrawingTool(INITIAL_TOOL)
  ? INITIAL_TOOL
  : 'brush';
