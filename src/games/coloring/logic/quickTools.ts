/**
 * Rychlé přepínání nástrojů Omalovánek (#148) místo nedávných barev z #99.
 * V pruhu jsou dvě tlačítka: první ukazuje předchozí nástroj (ikonu
 * a kolečko jeho barvy jako úchyt, duha bez kolečka) nebo prázdné místo,
 * druhé je vždy guma.
 *
 * Hra si pamatuje poslední dva různé kreslicí nástroje (všechny kromě
 * gumy), guma mezi ně nepatří (upřesnění zadání #148, bod 1):
 * - s vybraným kreslicím nástrojem je na prvním tlačítku ten před ním,
 * - s vybranou gumou nástroj, kterým se kreslilo těsně před gumou, i výchozí
 *   štětec; prázdné je první tlačítko jen tehdy, když dosud nebyl žádný
 *   jiný kreslicí nástroj než ten vybraný,
 * - výběr kreslicího nástroje (v panelu, prvním tlačítkem i barvou, která
 *   přepne gumu nebo duhu, body 2 a 4) ho dá na první místo a dosavadní
 *   první posune na druhé; výběr stejného nástroje nic nezmění.
 *
 * Pamatuje se jen podle profilu, ne podle omalovánky (bod 6), v samostatném
 * záznamu vedle obrázku: text „a,b“ s id nástrojů, napřed ten z prvního
 * tlačítka. Po otevření hry je vybraný štětec a na prvním tlačítku je první
 * zapamatovaný nástroj, který není štětec (bod 3). Chybějící, poškozený
 * nebo neznámý záznam dá prázdné místo. Starý záznam nedávných barev se
 * nečte ani nemaže. Čistý TypeScript bez Phaseru.
 */

import type { Tone } from '../../../shared/audio/tonePlayer';
import { HOME_WOBBLE_TONES } from '../../../shared/logic/homeButton';
import type { KeyValueStorage } from '../../../shared/storage/keyValueStorage';
import { INITIAL_TOOL, PANEL_TOOLS, TOOL_PICK_TONES } from './toolPanel';
import type { ToolId } from './toolPanel';

/** Kreslicí nástroj: každý nástroj kromě gumy (smí být na prvním tlačítku). */
export type DrawingToolId = Exclude<ToolId, 'eraser'>;

/** Tlačítko v pruhu: první (předchozí nástroj), nebo druhé (guma). */
export type QuickToolButton = 'previousTool' | 'eraser';

/** Co udělal dotyk na jedno ze dvou tlačítek. */
export type QuickToolTap =
  /** Nástroj se vybral: scéna překreslí výběr a zahraje krátký tón. */
  | { readonly kind: 'picked'; readonly tones: readonly Tone[] }
  /** Prázdné místo nebo už vybraná guma: tlačítko se jen zhoupne s tónem domečku. */
  | { readonly kind: 'wobble'; readonly tones: readonly Tone[] }
  /** Jiný prst maluje nebo drží tlačítko, ukládá se, drží se domeček nebo koště: nic. */
  | { readonly kind: 'ignored' };

/** Co ukazuje první tlačítko: nástroj a barva kolečka (u duhy `null`). */
export interface PreviousToolView {
  readonly tool: DrawingToolId;
  readonly color: number | null;
}

/** Krátký tón přepnutí (#148 AC2), stejný jako výběr nástroje v panelu, dozní za 0,12 s. */
export const QUICK_TOOL_TONES: readonly Tone[] = TOOL_PICK_TONES;

/** Tón, když se tlačítko jen zhoupne (#148 AC3), stejný jako u domečku. */
export const QUICK_TOOL_WOBBLE_TONES: readonly Tone[] = HOME_WOBBLE_TONES;

/** Poslední dva různé kreslicí nástroje, nejnovější napřed. */
export interface DrawingTools {
  /** Kreslicí nástroj vybraný naposledy (s vybranou gumou ten před gumou). */
  readonly latest: DrawingToolId;
  /** Jiný kreslicí nástroj vybraný před `latest`, `null` když žádný nebyl. */
  readonly before: DrawingToolId | null;
}

/** Kreslicí nástroje: všechny nástroje panelu kromě gumy. */
const DRAWING_TOOLS: readonly DrawingToolId[] = PANEL_TOOLS.filter(isDrawingTool);

/** Kreslí nástroj (každý kromě gumy)? */
export function isDrawingTool(tool: ToolId): tool is DrawingToolId {
  return tool !== 'eraser';
}

/** Výchozí štětec, se kterým hra začíná (#90 AC1). */
const INITIAL_DRAWING_TOOL: DrawingToolId = isDrawingTool(INITIAL_TOOL) ? INITIAL_TOOL : 'brush';

/** Kreslicí nástroje po výběru `picked`: na první místo, dosavadní první na druhé. */
export function drawingToolsAfterPick(tools: DrawingTools, picked: DrawingToolId): DrawingTools {
  return picked === tools.latest ? tools : { latest: picked, before: tools.latest };
}

/** Nástroj na prvním tlačítku: s gumou ten před gumou, jinak ten před vybraným. */
export function previousToolOf(tools: DrawingTools, selected: ToolId): DrawingToolId | null {
  return selected === 'eraser' ? tools.latest : tools.before;
}

/**
 * Kreslicí nástroje po otevření hry (#148, upřesnění bod 3): vybraný je
 * štětec, na prvním tlačítku první zapamatovaný nástroj, který není štětec.
 */
export function openingDrawingTools(remembered: readonly DrawingToolId[]): DrawingTools {
  const before = remembered.find((tool) => tool !== INITIAL_DRAWING_TOOL) ?? null;
  return { latest: INITIAL_DRAWING_TOOL, before };
}

/** Klíč záznamu v úložišti hry profilu, samostatně vedle obrázků (bod 6). */
const QUICK_TOOLS_KEY = 'quickTools';

const FIELD_SEPARATOR = ',';

/** Kolik nástrojů se pamatuje (#148, mimo rozsah je víc než jeden předchozí). */
const REMEMBERED_TOOL_COUNT = 2;

function drawingToolNamed(name: string): DrawingToolId | null {
  return DRAWING_TOOLS.find((tool) => tool === name) ?? null;
}

/**
 * Text záznamu na zapamatované nástroje: 1 až 2 různé kreslicí nástroje.
 * Cokoli jiného (i guma nebo neznámý nástroj) dá prázdný seznam.
 */
export function decodeQuickTools(record: string | null): DrawingToolId[] {
  if (record === null) {
    return [];
  }
  const fields = record.split(FIELD_SEPARATOR);
  if (fields.length > REMEMBERED_TOOL_COUNT) {
    return [];
  }
  const tools: DrawingToolId[] = [];
  for (const field of fields) {
    const tool = drawingToolNamed(field);
    if (tool === null || tools.includes(tool)) {
      return [];
    }
    tools.push(tool);
  }
  return tools;
}

/**
 * Záznam z dnešního stavu: napřed nástroj z prvního tlačítka, pak druhý
 * zapamatovaný, aby se po otevření hry nabídl ten, který dítě vidělo.
 */
export function encodeQuickTools(tools: DrawingTools, selected: ToolId): string {
  const shown = previousToolOf(tools, selected);
  const other = selected === 'eraser' ? tools.before : tools.latest;
  return [shown, other]
    .filter((tool): tool is DrawingToolId => tool !== null)
    .join(FIELD_SEPARATOR);
}

/** Zapamatované nástroje profilu; chybějící, nesmyslný nebo nečitelný záznam dá prázdný seznam. */
export function loadQuickTools(storage: KeyValueStorage): DrawingToolId[] {
  try {
    return decodeQuickTools(storage.getItem(QUICK_TOOLS_KEY));
  } catch (error) {
    console.warn('Omalovánky: předchozí nástroj nejde přečíst', error);
    return [];
  }
}

/** Uloží záznam. Chyba úložiště hru nezastaví, přepínání funguje dál v paměti. */
export function storeQuickTools(storage: KeyValueStorage, record: string): void {
  try {
    storage.setItem(QUICK_TOOLS_KEY, record);
  } catch (error) {
    console.warn('Omalovánky: předchozí nástroj nejde uložit', error);
  }
}
