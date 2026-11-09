import { describe, expect, it } from 'vitest';

import {
  COLOR_PICK_TONES,
  PALETTE,
  initialPalette,
  markedColors,
  tapColor,
} from '../../../src/games/coloring/logic/palette';
import type { Tone } from '../../../src/shared/audio/tonePlayer';

/**
 * Testy k #88 AC4 (paleta): 8 barev podle doporučení k otázce 5 (červená,
 * oranžová, žlutá, zelená, modrá, fialová, hnědá, černá; odstíny se doladí
 * se vzhledem, proto se netestují), na začátku vybraná první barva,
 * ťuknutí barvu hned vybere, označená je vždy právě jedna a ozve se tón
 * kratší než 1 s. Že tah přes vybarvené místo ho přebarví, je
 * ve `strokeClipping.test.ts`, rozložení palety v `coloringLayoutRules.test.ts`.
 * Od #100 jsou za těmito 8 barvami 4 nové (`extendedPalette.test.ts`).
 *
 * Navržené rozhraní (`src/games/coloring/logic/palette.ts`):
 * - `PALETTE: readonly PaletteColor[]`, `PaletteColor { id: PaletteColorId; hex: string }`
 *   (`'#RRGGBB'`), `PaletteColorId` = `'red' | 'orange' | 'yellow' | 'green' |
 *   'blue' | 'purple' | 'brown' | 'black'`,
 * - `PaletteState { selected: number }` (index barvy v `PALETTE`),
 * - `initialPalette(): PaletteState`,
 * - `tapColor(state, index, paletteSize): { state: PaletteState; tones: readonly Tone[] }`
 *   (upraveno k #116: `paletteSize` je povinný, tady 12 barev `PALETTE`),
 * - `markedColors(state): readonly boolean[]` (jedno `true` u označené barvy),
 * - `COLOR_PICK_TONES: readonly Tone[]` tón výběru barvy.
 */

/** Kdy dozní poslední tón, v sekundách od ťuknutí. */
function endOf(tones: readonly Tone[]): number {
  return Math.max(...tones.map((tone) => tone.startSeconds + tone.durationSeconds));
}

const COLOR_INDEXES = PALETTE.map((_, index) => index);

describe('#88 AC4: paleta začíná 8 barvami z #88', () => {
  // Od #100 má paleta 12 barev; původních 8 zůstává na prvních místech
  // (12 barev a nové barvy hlídá `extendedPalette.test.ts`).
  it('prvních 8 barev palety je v pořadí z doporučení', () => {
    expect(PALETTE.slice(0, 8).map((color) => color.id)).toEqual([
      'red',
      'orange',
      'yellow',
      'green',
      'blue',
      'purple',
      'brown',
      'black',
    ]);
  });

  it('každá barva má platný odstín #RRGGBB a žádné dvě nejsou stejné', () => {
    for (const color of PALETTE) {
      expect(color.hex, color.id).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
    const hexes = PALETTE.map((color) => color.hex.toUpperCase());
    expect(new Set(hexes).size).toBe(PALETTE.length);
  });
});

describe('#88 AC4: na začátku je vybraná první barva', () => {
  it('po otevření omalovánky je vybraná první barva', () => {
    expect(initialPalette().selected).toBe(0);
  });

  it('po otevření je označená právě první barva', () => {
    expect(markedColors(initialPalette())).toEqual(COLOR_INDEXES.map((index) => index === 0));
  });
});

describe('#88 AC4: ťuknutí na barvu ji hned vybere a ozve se krátký tón', () => {
  it.each(COLOR_INDEXES)('ťuknutí na barvu %i ji hned vybere', (index) => {
    const { state } = tapColor(initialPalette(), index, PALETTE.length);
    expect(state.selected).toBe(index);
  });

  it('po každém ťuknutí je označená právě jedna barva, ta ťuknutá', () => {
    let state = initialPalette();
    for (const index of [3, 7, 0, 5, 5, 1, 6, 2, 4]) {
      state = tapColor(state, index, PALETTE.length).state;
      const marks = markedColors(state);
      expect(marks.length, `po ťuknutí na ${index}`).toBe(PALETTE.length);
      expect(marks.filter(Boolean).length, `po ťuknutí na ${index}`).toBe(1);
      expect(marks[index], `po ťuknutí na ${index}`).toBe(true);
    }
  });

  it('ťuknutí na barvu zahraje tón kratší než 1 s', () => {
    for (const index of COLOR_INDEXES) {
      const { tones } = tapColor(initialPalette(), index, PALETTE.length);
      expect(tones.length, `barva ${index}`).toBeGreaterThan(0);
      expect(tones, `barva ${index}`).toEqual(COLOR_PICK_TONES);
    }
    expect(endOf(COLOR_PICK_TONES)).toBeLessThan(1);
  });

  it('tón výběru barvy je slyšet: má hlasitost nad 0 a nejvýš 1 a nenulovou délku', () => {
    for (const tone of COLOR_PICK_TONES) {
      expect(tone.volume).toBeGreaterThan(0);
      expect(tone.volume).toBeLessThanOrEqual(1);
      expect(tone.durationSeconds).toBeGreaterThan(0);
      expect(tone.startSeconds).toBeGreaterThanOrEqual(0);
    }
  });

  it('ťuknutí na už vybranou barvu ji nechá vybranou a tón zazní znovu', () => {
    const first = tapColor(initialPalette(), 4, PALETTE.length);
    const again = tapColor(first.state, 4, PALETTE.length);
    expect(again.state.selected).toBe(4);
    expect(again.tones).toEqual(COLOR_PICK_TONES);
  });

  it.each([
    ['záporný index', -1],
    ['index za paletou', PALETTE.length],
    ['index za 12 barvami', 12],
    ['desetinný index', 1.5],
    ['nečíselný index', Number.NaN],
  ])('%s barvu nezmění, nezahraje tón a nic neshodí', (_name, index) => {
    const before = tapColor(initialPalette(), 2, PALETTE.length).state;
    expect(() => tapColor(before, index, PALETTE.length)).not.toThrow();
    const { state, tones } = tapColor(before, index, PALETTE.length);
    expect(state.selected).toBe(2);
    expect(tones).toEqual([]);
    expect(markedColors(state).filter(Boolean).length).toBe(1);
  });
});
