/**
 * Panel nástrojů Omalovánek (#96): nástroje na místech panelu (štětec
 * a guma od #90, fix a pastelka od #93, duhový štětec od #97, razítkový
 * fix od #98, puntíkový fix od #101, proužkový fix od #102, třpytky od
 * #103, sprej od #104), velikost čáry a její záznam (#91), co ukazuje úchyt, tóny úchytu a záznam o prvním otevření hry
 * v profilu. Při úplně prvním otevření je panel otevřený, aby dítě
 * vidělo, co v něm je, jindy začíná zavřený. Záznam se zapíše při prvním
 * ukládání (tah, barva, velikost, Zpět) nebo nejpozději při odchodu
 * a schování stránky, ne hned při otevření: pouhé otevření hry do
 * úložiště nic nezapíše (#92 AC1). Kdo panel nezavře, uvidí ho příště
 * zavřený. Chybějící, nesmyslný nebo nečitelný záznam znamená první otevření.
 * Čistý TypeScript bez Phaseru.
 */

import type { Tone } from '../../../shared/audio/tonePlayer';
import type { KeyValueStorage } from '../../../shared/storage/keyValueStorage';
import { contrastRatio } from '../../../shared/logic/theme';
import { colorHex } from './toolColorSets';
import { COLOR_BUTTON_STYLE, LINE_SIZE_WAVE_STYLE } from './theme';

/**
 * Nástroje Omalovánek: štětec, guma (#90), fix a pastelka (#93), duhový
 * štětec (#97), razítkový fix (#98), puntíkový fix (#101), proužkový fix (#102),
 * třpytky (#103) a sprej (#104).
 */
export type ToolId =
  | 'brush'
  | 'eraser'
  | 'marker'
  | 'crayon'
  | 'rainbow'
  | 'stamp'
  | 'dots'
  | 'stripes'
  | 'glitter'
  | 'spray';

/** Nástroje podle míst v panelu: nástroj `PANEL_TOOLS[i]` je na místě `toolSlots[i]`. */
export const PANEL_TOOLS: readonly ToolId[] = [
  'brush',
  'eraser',
  'marker',
  'crayon',
  'rainbow',
  'stamp',
  'dots',
  'stripes',
  'glitter',
  'spray',
];

/** Nástroj, který je vybraný na začátku a po každém návratu do hry (#90 AC1). */
export const INITIAL_TOOL: ToolId = 'brush';

/** Maluje nástroj (štětec, fix, pastelka, duha, razítkový, puntíkový a proužkový fix, třpytky, sprej), nebo gumuje? */
export function paintsWithColor(tool: ToolId): boolean {
  return tool !== 'eraser';
}

/** Maluje nástroj barvou vybranou v paletě? Guma ani duha (#97) ne. */
export function usesSelectedColor(tool: ToolId): boolean {
  return tool !== 'eraser' && tool !== 'rainbow';
}

/**
 * Nástroj, na který přepne ťuknutí na barvu (#90 AC4, #93 AC5, #97 AC4):
 * naposledy vybraný malovací nástroj, u duhy štětec, protože duha
 * vybranou barvu nepoužívá.
 */
export function toolForColor(paintingTool: ToolId): ToolId {
  return usesSelectedColor(paintingTool) ? paintingTool : INITIAL_TOOL;
}

/**
 * Krok panelu (#105): zavřený, krok nástrojů (tři tlačítka tloušťky od
 * #112 a 10 nástrojů), nebo krok barev (vybraný nástroj a 12 barev).
 */
export type PanelView = 'closed' | 'tools' | 'colors';

/**
 * Má nástroj krok barev (#105 AC2)? Jen nástroje, které malují vybranou
 * barvou; guma a duha ho nemají a ťuknutí na ně panel zavře (AC4).
 */
export function hasColorStep(tool: ToolId): boolean {
  return usesSelectedColor(tool);
}

/**
 * Krátký tón při návratu z kroku barev k nástrojům (#105 AC4), dozní za
 * 0,1 s. Zní níž než výběr nástroje, aby se návrat od výběru odlišil.
 */
export const BACK_TO_TOOLS_TONES: readonly Tone[] = [
  { frequencyHz: 587.33, startSeconds: 0, durationSeconds: 0.1, volume: 0.13 },
];

/** Krátký tón při ťuknutí na nástroj (#90 AC1), dozní za 0,12 s. */
export const TOOL_PICK_TONES: readonly Tone[] = [
  { frequencyHz: 698.46, startSeconds: 0, durationSeconds: 0.12, volume: 0.15 },
];

/** U každého nástroje z `PANEL_TOOLS`, jestli je označený (vždy právě jeden). */
export function markedTools(selected: ToolId): readonly boolean[] {
  return PANEL_TOOLS.map((tool) => tool === selected);
}

/** Nástroj na místě `index` v panelu, nebo `null` u prázdného místa. */
export function toolAtSlot(index: number): ToolId | null {
  return PANEL_TOOLS[index] ?? null;
}

/** Velikost čáry (#91): platí pro všechny nástroje naráz. */
export type LineSize = 'small' | 'medium' | 'large';

/** Tloušťky od nejtenčí, v pořadí tlačítek tloušťky v panelu (#91, #112 AC1). */
export const LINE_SIZES: readonly LineSize[] = ['small', 'medium', 'large'];

/** Velikost na začátku a po chybějícím nebo nesmyslném záznamu (#91 AC2, AC5). */
export const INITIAL_LINE_SIZE: LineSize = 'medium';

/** U každé tloušťky z `LINE_SIZES`, jestli je označená (vždy právě jedna, #112 AC1). */
export function markedLineSizes(selected: LineSize): readonly boolean[] {
  return LINE_SIZES.map((size) => size === selected);
}

/**
 * Krátký tón při ťuknutí na tlačítko tloušťky (#91, #112 AC2), dozní za
 * 0,14 s. Tenká čára zní výš, tlustá níž.
 */
export const LINE_SIZE_TONES: Readonly<Record<LineSize, readonly Tone[]>> = {
  small: [{ frequencyHz: 880, startSeconds: 0, durationSeconds: 0.14, volume: 0.14 }],
  medium: [{ frequencyHz: 659.25, startSeconds: 0, durationSeconds: 0.14, volume: 0.14 }],
  large: [{ frequencyHz: 493.88, startSeconds: 0, durationSeconds: 0.14, volume: 0.14 }],
};

/** Vzhled vlnky na tlačítkách tloušťky: barva `#RRGGBB` a jestli má tmavý obrys. */
export interface LineSizeWaveLook {
  readonly color: string;
  readonly outlined: boolean;
}

/** Vlnka potřebuje aspoň tento kontrast vůči pozadí tlačítka, jinak dostane obrys (#112 AC3). */
const WAVE_MIN_CONTRAST = 3;

/**
 * Barva vlnek podle toho, co ukazuje úchyt (#112 AC1, AC3): u malovacího
 * nástroje jeho barva (#110), u gumy a duhy (bez barvy) tmavá. Barva se
 * slabým kontrastem vůči pozadí tlačítka dostane tmavý obrys.
 */
export function lineSizeWaveLook(view: {
  readonly tool: ToolId;
  readonly color: number | null;
}): LineSizeWaveLook {
  const hex = view.color === null ? undefined : colorHex(view.color);
  if (hex === undefined) {
    return { color: LINE_SIZE_WAVE_STYLE.neutralColor, outlined: false };
  }
  const contrast = contrastRatio(hex, COLOR_BUTTON_STYLE.background);
  return { color: hex, outlined: contrast < WAVE_MIN_CONTRAST };
}

/** Klíč záznamu velikosti v úložišti hry profilu, samostatně vedle obrázku (#91 AC5). */
const LINE_SIZE_KEY = 'lineSize';

function isLineSize(value: string | null): value is LineSize {
  return LINE_SIZES.some((size) => size === value);
}

/** Uložená velikost; chybějící, nesmyslný nebo nečitelný záznam je střední (#91 AC5). */
export function loadLineSize(storage: KeyValueStorage): LineSize {
  try {
    const stored = storage.getItem(LINE_SIZE_KEY);
    return isLineSize(stored) ? stored : INITIAL_LINE_SIZE;
  } catch (error) {
    console.warn('Omalovánky: velikost čáry nejde přečíst', error);
    return INITIAL_LINE_SIZE;
  }
}

/** Uloží velikost. Chyba úložiště hru nezastaví. */
export function storeLineSize(storage: KeyValueStorage, size: LineSize): void {
  try {
    storage.setItem(LINE_SIZE_KEY, size);
  } catch (error) {
    console.warn('Omalovánky: velikost čáry nejde uložit', error);
  }
}

/**
 * Co ukazuje úchyt (#96 AC5, #91 AC1): vybraný nástroj ve vybrané barvě,
 * guma a duha bez barvy (`null`, #90 AC1, #97 AC1), a vybranou velikost čáry.
 */
export interface HandleView {
  readonly tool: ToolId;
  readonly color: number | null;
  readonly size: LineSize;
}

/** Krátký stoupající tón při otevření panelu, dozní za 0,2 s. */
export const PANEL_OPEN_TONES: readonly Tone[] = [
  { frequencyHz: 523.25, startSeconds: 0, durationSeconds: 0.08, volume: 0.12 },
  { frequencyHz: 659.25, startSeconds: 0.08, durationSeconds: 0.12, volume: 0.12 },
];

/** Krátký klesající tón při zavření panelu, dozní za 0,2 s. */
export const PANEL_CLOSE_TONES: readonly Tone[] = [
  { frequencyHz: 659.25, startSeconds: 0, durationSeconds: 0.08, volume: 0.1 },
  { frequencyHz: 523.25, startSeconds: 0.08, durationSeconds: 0.12, volume: 0.1 },
];

/** Klíč záznamu o prvním otevření v úložišti hry profilu. */
const PANEL_SEEN_KEY = 'toolPanel.seen';

/** Jediná platná hodnota záznamu; cokoli jiného je první otevření. */
const PANEL_SEEN_VALUE = '1';

/** Otevřel už profil Omalovánky? Selhání čtení je jako první otevření. */
export function wasOpenedBefore(storage: KeyValueStorage): boolean {
  try {
    return storage.getItem(PANEL_SEEN_KEY) === PANEL_SEEN_VALUE;
  } catch (error) {
    console.warn('Omalovánky: záznam o prvním otevření nejde přečíst', error);
    return false;
  }
}

/** Zapíše, že profil Omalovánky otevřel. Chyba úložiště hru nezastaví. */
export function rememberOpened(storage: KeyValueStorage): void {
  try {
    storage.setItem(PANEL_SEEN_KEY, PANEL_SEEN_VALUE);
  } catch (error) {
    console.warn('Omalovánky: záznam o prvním otevření nejde uložit', error);
  }
}
