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
import { isPaletteIndex } from './palette';
import { ALL_COLOR_COUNT, colorAtPlace } from './toolColorSets';
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

/** Barva každého malovacího nástroje jako číslo barvy (`ALL_COLORS`, #116). */
export type ToolColors = Readonly<Record<ColorToolId, number>>;

/** Nástroj, který dostane barvu, když je vybraná duha (#97 AC4). */
const RAINBOW_COLOR_TOOL: ColorToolId = 'brush';

/**
 * Výchozí barvy nástrojů v novém profilu jako místo v sadě nástroje
 * (#116 nahrazuje tabulku z #110 AC5): štětec #FF3B30, fix #0040DD,
 * pastelka #5E9E3A, razítkový #FF7E1A, puntíkový #FF039F (tabulka v2),
 * proužkový #2E8FD8, třpytky #C9A227, sprej #9933FF.
 */
const DEFAULT_COLOR_PLACES: Readonly<Record<ColorToolId, number>> = {
  brush: 0,
  marker: 4,
  crayon: 3,
  stamp: 1,
  dots: 8,
  stripes: 11,
  glitter: 2,
  spray: 5,
};

/** Výchozí barva nástroje: barva na jeho výchozím místě, jinak první barva palety. */
function defaultColorOf(tool: ColorToolId): number {
  return colorAtPlace(tool, DEFAULT_COLOR_PLACES[tool]) ?? 0;
}

/** Barvy nástrojů podle `colorOf`. */
function toolColorsFrom(colorOf: (tool: ColorToolId) => number): ToolColors {
  const colors = {} as Record<ColorToolId, number>;
  for (const tool of COLOR_TOOLS) {
    colors[tool] = colorOf(tool);
  }
  return colors;
}

/** Výchozí barvy nástrojů v novém profilu (#110 AC5, odstíny podle #116). */
export const DEFAULT_TOOL_COLORS: ToolColors = toolColorsFrom(defaultColorOf);

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

/** Jedno pole záznamu: index barvy palety s `paletteSize` barvami v přesném zápisu, jinak `null`. */
function readField(field: string, paletteSize: number): number | null {
  const value = Number(field);
  return field !== '' && String(value) === field && isPaletteIndex(value, paletteSize)
    ? value
    : null;
}

/**
 * Text záznamu na barvy nástrojů; poškozený záznam nebo barva mimo paletu
 * s `paletteSize` barvami (#115) dá `null`.
 */
export function decodeToolColors(
  record: string,
  paletteSize: number = ALL_COLOR_COUNT,
): ToolColors | null {
  const fields = record.split(FIELD_SEPARATOR).map((field) => readField(field, paletteSize));
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
 * nebo nečitelný záznam dá `null` (AC6). `paletteSize` jako u `decodeToolColors`.
 */
export function loadToolColors(
  storage: KeyValueStorage,
  pictureId: string,
  paletteSize: number = ALL_COLOR_COUNT,
): ToolColors | null {
  try {
    const record = storage.getItem(recordKey(pictureId));
    return record === null ? null : decodeToolColors(record, paletteSize);
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
