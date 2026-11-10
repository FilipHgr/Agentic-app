/**
 * Vlastní sady barev nástrojů Omalovánek (#116, schválená tabulka v2).
 * Každý z 8 malovacích nástrojů má v kroku barev 12 barev. Místo k je
 * stejný druh barvy jako barva štětce na místě k; kde se nástroj od
 * štětce neliší, má barvu štětce.
 *
 * Čísla barev: 0 až 11 jsou barvy štětce (`PALETTE`) a zůstávají, nové
 * barvy dostanou čísla 12 a dál po sloupcích tabulky (fix, pastelka,
 * razítkový, puntíkový, proužkový fix, třpytky, sprej) a v každém sloupci
 * po místech. Pořadí se nesmí měnit, čísla jsou v uložených obrázcích.
 * Formát p4 (#115) zná 64 barev, víc jich tabulka mít nesmí.
 * Čistý TypeScript bez Phaseru.
 */

import { PALETTE } from './palette';
import type { ColorToolId } from './toolColors';

/** Jedna barva hry: odstín `#RRGGBB`. */
export interface GameColor {
  readonly hex: string;
}

/** Kolik barev má krok barev každého nástroje (#100, #116 AC1). */
export const COLOR_STEP_SIZE = 12;

/**
 * Sloupce tabulky v2 bez štětce v pořadí čísel nových barev. `null` je
 * stejná barva jako štětec na stejném místě (znak „=“ v tabulce).
 */
const OTHER_TOOL_COLUMNS: readonly (readonly [ColorToolId, readonly (string | null)[]])[] = [
  // Fix: tmavší a sytější.
  [
    'marker',
    [
      '#A8000C',
      null,
      null,
      '#00843C',
      '#0040DD',
      '#720C93',
      null,
      null,
      '#AB005D',
      null,
      null,
      null,
    ],
  ],
  // Pastelka: tlumené odstíny.
  [
    'crayon',
    [
      null,
      '#E9762B',
      null,
      '#5E9E3A',
      '#3D74C4',
      '#9B6AC0',
      '#8A5A35',
      null,
      null,
      null,
      null,
      null,
    ],
  ],
  // Razítkový fix.
  [
    'stamp',
    [null, '#FF7E1A', null, '#1BBBA2', null, '#D63AF9', null, null, null, null, null, '#00A8C6'],
  ],
  // Puntíkový fix: zářivé odstíny.
  [
    'dots',
    [
      '#FC7542',
      null,
      null,
      '#00C08A',
      '#395AFF',
      '#ED3FE4',
      null,
      null,
      '#FF039F',
      null,
      null,
      '#06A2FF',
    ],
  ],
  // Proužkový fix.
  [
    'stripes',
    ['#C7252B', null, null, '#3F9B4A', '#2057A8', null, null, null, null, null, null, '#2E8FD8'],
  ],
  // Třpytky: zlatá (místo 3), bronzová (7) a stříbrná (11).
  [
    'glitter',
    [
      null,
      null,
      '#C9A227',
      null,
      null,
      '#8E44AD',
      '#9C6B30',
      null,
      '#D4708F',
      null,
      '#8D9FC3',
      null,
    ],
  ],
  // Sprej.
  [
    'spray',
    [
      '#FF1F4B',
      '#FF6A00',
      null,
      '#4CBB17',
      '#1E90FF',
      '#9933FF',
      null,
      null,
      null,
      null,
      null,
      null,
    ],
  ],
];

/** Nové barvy (bez barev štětce) v pořadí čísel od 12. */
const NEW_COLORS: readonly GameColor[] = OTHER_TOOL_COLUMNS.flatMap(([, column]) =>
  column.flatMap((hex) => (hex === null ? [] : [{ hex }])),
);

/** Všechny barvy hry: čísla 0 až 11 barvy štětce, od 12 nové barvy sad (46 barev). */
export const ALL_COLORS: readonly GameColor[] = [...PALETTE, ...NEW_COLORS];

/** Kolik barev hra zná. */
export const ALL_COLOR_COUNT: number = ALL_COLORS.length;

/** Odstín barvy číslo `color`, nebo `undefined` u barvy, kterou hra nezná. */
export function colorHex(color: number): string | undefined {
  return ALL_COLORS[color]?.hex;
}

/** Číslo barvy s odstínem `hex` (první výskyt). */
function colorNumberOf(hex: string): number {
  return ALL_COLORS.findIndex((color) => color.hex === hex);
}

/** Sada štětce: barvy 0 až 11. */
const BRUSH_SET: readonly number[] = PALETTE.map((_, index) => index);

/** Sloupec nástroje jako čísla barev; „=“ je barva štětce na stejném místě. */
function setOf(column: readonly (string | null)[]): readonly number[] {
  return column.map((hex, place) => (hex === null ? (BRUSH_SET[place] ?? 0) : colorNumberOf(hex)));
}

/** Sada nástroje `tool` ze sloupce tabulky; štětec má barvy 0 až 11. */
function toolSet(tool: ColorToolId): readonly number[] {
  const column = OTHER_TOOL_COLUMNS.find(([columnTool]) => columnTool === tool)?.[1];
  return column === undefined ? BRUSH_SET : setOf(column);
}

function buildToolSets(): Readonly<Record<ColorToolId, readonly number[]>> {
  return {
    brush: BRUSH_SET,
    marker: toolSet('marker'),
    crayon: toolSet('crayon'),
    stamp: toolSet('stamp'),
    dots: toolSet('dots'),
    stripes: toolSet('stripes'),
    glitter: toolSet('glitter'),
    spray: toolSet('spray'),
  };
}

/** Sada každého malovacího nástroje: 12 čísel barev v pořadí míst kroku barev. */
export const TOOL_COLOR_SETS: Readonly<Record<ColorToolId, readonly number[]>> = buildToolSets();

/**
 * Místo barvy `color` v sadě nástroje `tool` (0 až 11), nebo `null`, když
 * ji sada nemá (starší záznam nebo nedávná barva, #116 AC5).
 */
export function placeInSet(tool: ColorToolId, color: number): number | null {
  const place = TOOL_COLOR_SETS[tool].indexOf(color);
  return place < 0 ? null : place;
}

/** Barva na místě `place` sady nástroje `tool`; `undefined` mimo místa. */
export function colorAtPlace(tool: ColorToolId, place: number): number | undefined {
  return Number.isInteger(place) ? TOOL_COLOR_SETS[tool][place] : undefined;
}
