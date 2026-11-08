/**
 * Barvy nástrojů Omalovánek (#110): každý z 8 malovacích nástrojů (štětec,
 * fix, pastelka, razítkový, puntíkový a proužkový fix, třpytky a sprej)
 * má svou barvu. Guma a duha barvu nemají (AC1).
 *
 * Barvy se pamatují podle profilu a omalovánky v samostatném záznamu vedle
 * obrázku (AC5), záznam obrázku se nemění. Záznam je text s indexy barev
 * palety oddělenými čárkou v pořadí `COLOR_TOOLS`. Chybějící, poškozený
 * nebo nečitelný záznam se nepoužije a o barvách rozhodne obrázek
 * (`savedPicture.ts`, AC6). Čistý TypeScript bez Phaseru.
 */

import type { KeyValueStorage } from '../../../shared/storage/keyValueStorage';
import { PALETTE } from './palette';
import type { PaletteColorId } from './palette';
import type { ToolId } from './toolPanel';

/** Malovací nástroj s vlastní barvou (všechny kromě gumy a duhy). */
export type ColorToolId = Exclude<ToolId, 'eraser' | 'rainbow'>;

/** Malovací nástroje s vlastní barvou v pořadí panelu; v tomto pořadí je i záznam. */
export const COLOR_TOOLS: readonly ColorToolId[] = [
  'brush',
  'marker',
  'crayon',
  'stamp',
  'dots',
  'stripes',
  'glitter',
  'spray',
];

/** Barva každého malovacího nástroje jako index `PALETTE`. */
export type ToolColors = Readonly<Record<ColorToolId, number>>;

/** Nástroj, který dostane barvu, když je vybraná duha (#97 AC4). */
const RAINBOW_COLOR_TOOL: ColorToolId = 'brush';

/** Výchozí barvy nástrojů v novém profilu (tabulka v #110 AC5). */
const DEFAULT_COLOR_IDS: Readonly<Record<ColorToolId, PaletteColorId>> = {
  brush: 'red',
  marker: 'blue',
  crayon: 'green',
  stamp: 'orange',
  dots: 'purple',
  stripes: 'pink',
  glitter: 'lightBlue',
  spray: 'black',
};

function paletteIndexOf(id: PaletteColorId): number {
  return PALETTE.findIndex((color) => color.id === id);
}

function isPaletteIndex(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value < PALETTE.length;
}

/** Barvy nástrojů podle `colorOf`. */
function toolColorsFrom(colorOf: (tool: ColorToolId) => number): ToolColors {
  const colors = {} as Record<ColorToolId, number>;
  for (const tool of COLOR_TOOLS) {
    colors[tool] = colorOf(tool);
  }
  return colors;
}

/** Výchozí barvy nástrojů v novém profilu (AC5). */
export const DEFAULT_TOOL_COLORS: ToolColors = toolColorsFrom((tool) =>
  paletteIndexOf(DEFAULT_COLOR_IDS[tool]),
);

/** Všechny malovací nástroje v barvě `color`: obrázek uložený před #110 (AC6). */
export function allToolsIn(color: number): ToolColors {
  return toolColorsFrom(() => color);
}

/** Má nástroj vlastní barvu? Guma a duha ne. */
export function isColorTool(tool: ToolId): tool is ColorToolId {
  return COLOR_TOOLS.some((colorTool) => colorTool === tool);
}

/**
 * Který nástroj dostane vybranou barvu, když je naposledy vybraný
 * malovací nástroj `paintingTool` (AC3): on sám, u duhy štětec.
 */
export function toolReceivingColor(paintingTool: ToolId): ColorToolId {
  return isColorTool(paintingTool) ? paintingTool : RAINBOW_COLOR_TOOL;
}

/** Barvy nástrojů, kde nástroj `tool` dostal barvu `color`. */
export function withToolColor(colors: ToolColors, tool: ColorToolId, color: number): ToolColors {
  return { ...colors, [tool]: color };
}

const FIELD_SEPARATOR = ',';

/** Klíč záznamu v úložišti hry profilu, samostatně vedle obrázku `pictureId`. */
function recordKey(pictureId: string): string {
  return `toolColors.${pictureId}`;
}

/** Jedno pole záznamu: index barvy v přesném zápisu, jinak `null`. */
function readField(field: string): number | null {
  const value = Number(field);
  return field !== '' && String(value) === field && isPaletteIndex(value) ? value : null;
}

/** Text záznamu na barvy nástrojů; poškozený záznam dá `null`. */
export function decodeToolColors(record: string): ToolColors | null {
  const fields = record.split(FIELD_SEPARATOR).map(readField);
  if (fields.length !== COLOR_TOOLS.length) {
    return null;
  }
  const colors = {} as Record<ColorToolId, number>;
  for (const [index, tool] of COLOR_TOOLS.entries()) {
    const color = fields[index];
    if (color === null || color === undefined) {
      return null;
    }
    colors[tool] = color;
  }
  return colors;
}

/** Barvy nástrojů jako text záznamu. */
export function encodeToolColors(colors: ToolColors): string {
  return COLOR_TOOLS.map((tool) => String(colors[tool])).join(FIELD_SEPARATOR);
}

/**
 * Uložené barvy nástrojů omalovánky `pictureId`; chybějící, poškozený
 * nebo nečitelný záznam dá `null` (AC6).
 */
export function loadToolColors(storage: KeyValueStorage, pictureId: string): ToolColors | null {
  try {
    const record = storage.getItem(recordKey(pictureId));
    return record === null ? null : decodeToolColors(record);
  } catch (error) {
    console.warn('Omalovánky: barvy nástrojů nejde přečíst', error);
    return null;
  }
}

/** Uloží barvy nástrojů. Chyba úložiště hru nezastaví, barvy zůstanou v paměti (AC5). */
export function storeToolColors(
  storage: KeyValueStorage,
  pictureId: string,
  colors: ToolColors,
): void {
  try {
    storage.setItem(recordKey(pictureId), encodeToolColors(colors));
  } catch (error) {
    console.warn('Omalovánky: barvy nástrojů nejde uložit', error);
  }
}
