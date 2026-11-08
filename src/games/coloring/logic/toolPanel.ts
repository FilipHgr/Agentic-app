/**
 * Panel nástrojů Omalovánek (#96): nástroje na místech panelu (štětec
 * a guma od #90, fix a pastelka od #93, duhový štětec od #97, razítkový
 * fix od #98, puntíkový fix od #101, proužkový fix od #102), velikost
 * čáry a její záznam (#91), co ukazuje úchyt, tóny úchytu a záznam o prvním otevření hry
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

/**
 * Nástroje Omalovánek: štětec, guma (#90), fix a pastelka (#93), duhový
 * štětec (#97), razítkový fix (#98), puntíkový fix (#101) a proužkový fix (#102).
 */
export type ToolId =
  'brush' | 'eraser' | 'marker' | 'crayon' | 'rainbow' | 'stamp' | 'dots' | 'stripes';

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
];

/** Nástroj, který je vybraný na začátku a po každém návratu do hry (#90 AC1). */
export const INITIAL_TOOL: ToolId = 'brush';

/** Maluje nástroj (štětec, fix, pastelka, duha, razítkový, puntíkový a proužkový fix), nebo gumuje? */
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

/** Velikosti v pořadí, ve kterém je přepínač prochází (#91 AC1). */
export const LINE_SIZES: readonly LineSize[] = ['small', 'medium', 'large'];

/** Velikost na začátku a po chybějícím nebo nesmyslném záznamu (#91 AC2, AC5). */
export const INITIAL_LINE_SIZE: LineSize = 'medium';

/** Velikost po ťuknutí na přepínač: malá → střední → velká → malá (#91 AC1). */
export function nextLineSize(size: LineSize): LineSize {
  const next = (LINE_SIZES.indexOf(size) + 1) % LINE_SIZES.length;
  return LINE_SIZES[next] ?? INITIAL_LINE_SIZE;
}

/**
 * Krátký tón při ťuknutí na přepínač velikosti (#91 AC1), dozní za 0,14 s.
 * Tenká čára zní výš, tlustá níž.
 */
export const SIZE_TOGGLE_TONES: Readonly<Record<LineSize, readonly Tone[]>> = {
  small: [{ frequencyHz: 880, startSeconds: 0, durationSeconds: 0.14, volume: 0.14 }],
  medium: [{ frequencyHz: 659.25, startSeconds: 0, durationSeconds: 0.14, volume: 0.14 }],
  large: [{ frequencyHz: 493.88, startSeconds: 0, durationSeconds: 0.14, volume: 0.14 }],
};

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
