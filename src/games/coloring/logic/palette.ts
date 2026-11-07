/**
 * Paleta Omalovánek (#88 AC4): 8 barev podle doporučení k otázce 5, na
 * začátku vybraná první, ťuknutí barvu hned vybere a zahraje krátký tón.
 * Označená je vždy právě jedna barva. Odstíny jsou zástupné, doladí se
 * se vzhledem. Čistý TypeScript bez Phaseru.
 */

import type { Tone } from '../../../shared/audio/tonePlayer';

export type PaletteColorId =
  'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple' | 'brown' | 'black';

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
];

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

function isPaletteIndex(index: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < PALETTE.length;
}

/** Ťuknutí na barvu: vybere ji a zahraje tón. Neplatný index nic nezmění. */
export function tapColor(
  state: PaletteState,
  index: number,
): { state: PaletteState; tones: readonly Tone[] } {
  if (!isPaletteIndex(index)) {
    return { state, tones: [] };
  }
  return { state: { selected: index }, tones: COLOR_PICK_TONES };
}

/** U každé barvy palety, jestli je označená (vždy právě jedna). */
export function markedColors(state: PaletteState): readonly boolean[] {
  return PALETTE.map((_, index) => index === state.selected);
}
