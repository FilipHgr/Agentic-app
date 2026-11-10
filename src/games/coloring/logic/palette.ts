/**
 * Paleta Omalovánek (#88 AC4): 8 barev podle doporučení k otázce 5 a za
 * nimi 4 barvy z #100 (varianta A: růžová, tělová, šedá, světle modrá,
 * bílá ne, na bílém pozadí by nebyla vidět). Na začátku vybraná první, ťuknutí barvu hned vybere a zahraje krátký tón.
 * Označená je vždy právě jedna barva. Odstíny jsou zástupné, doladí se
 * se vzhledem. Čistý TypeScript bez Phaseru.
 */

import type { Tone } from '../../../shared/audio/tonePlayer';

export type PaletteColorId =
  | 'red'
  | 'orange'
  | 'yellow'
  | 'green'
  | 'blue'
  | 'purple'
  | 'brown'
  | 'black'
  | 'pink'
  | 'skin'
  | 'gray'
  | 'lightBlue';

export interface PaletteColor {
  readonly id: PaletteColorId;
  /** Odstín `#RRGGBB`. */
  readonly hex: string;
}

export const PALETTE: readonly PaletteColor[] = [
  { id: 'red', hex: '#FF3B30' },
  { id: 'orange', hex: '#FF9500' },
  { id: 'yellow', hex: '#FFCC00' },
  { id: 'green', hex: '#34C759' },
  { id: 'blue', hex: '#007AFF' },
  { id: 'purple', hex: '#AF52DE' },
  { id: 'brown', hex: '#A2845E' },
  { id: 'black', hex: '#2C2C2E' },
  // #100: syté odstíny odlišné od bílého pozadí i od sousedů. Kontrast proti
  // bílé: růžová 3,0, šedá 3,3, tělová 2,4 a světle modrá 2,3 (tmavší by už
  // nebyla tělová a světle modrá).
  { id: 'pink', hex: '#F75A9C' },
  { id: 'skin', hex: '#DE9670' },
  { id: 'gray', hex: '#8E8E93' },
  { id: 'lightBlue', hex: '#44B6EC' },
];

/**
 * Barvy duhového štětce (#97 AC2) v pořadí duhy jako indexy v `PALETTE`:
 * červená, oranžová, žlutá, zelená, modrá, fialová (podle doporučení
 * k otázce 2 bez hnědé a černé).
 */
export const RAINBOW_COLORS: readonly number[] = (
  ['red', 'orange', 'yellow', 'green', 'blue', 'purple'] as const
).map((id) => PALETTE.findIndex((color) => color.id === id));

/** Která barva je vybraná (index v `PALETTE`). */
export interface PaletteState {
  readonly selected: number;
}

/** Krátký tón při výběru barvy, kratší než 1 s. */
export const COLOR_PICK_TONES: readonly Tone[] = [
  { frequencyHz: 784, startSeconds: 0, durationSeconds: 0.12, volume: 0.15 },
];

/** Paleta po otevření omalovánky: vybraná první barva. */
export function initialPalette(): PaletteState {
  return { selected: 0 };
}

/** Je `index` barva palety s `paletteSize` barvami (#115)? */
export function isPaletteIndex(index: number, paletteSize: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < paletteSize;
}

/**
 * Ťuknutí na barvu: vybere ji a zahraje tón. Neplatný index nic nezmění.
 * `paletteSize` je počet barev palety (#115, od #116 všechny barvy sad).
 */
export function tapColor(
  state: PaletteState,
  index: number,
  paletteSize: number,
): { state: PaletteState; tones: readonly Tone[] } {
  if (!isPaletteIndex(index, paletteSize)) {
    return { state, tones: [] };
  }
  return { state: { selected: index }, tones: COLOR_PICK_TONES };
}

/** U každé barvy palety, jestli je označená (vždy právě jedna). */
export function markedColors(state: PaletteState): readonly boolean[] {
  return PALETTE.map((_, index) => index === state.selected);
}
