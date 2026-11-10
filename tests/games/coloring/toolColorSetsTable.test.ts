import { describe, expect, it } from 'vitest';

import { COLOR_TOOLS } from './toolColorsHelpers';
import {
  ALL_COLOR_COUNT,
  BRUSH_COLOR_COUNT,
  BRUSH_SET,
  MAX_COLOR_COUNT,
  NEW_COLOR_COUNT,
  PLACE_NAMES,
  SET_SIZE,
  TOOL_SETS,
  allTableHexes,
  contrastRatio,
  deltaE76,
  newColors,
} from './toolColorSetsHelpers';
import { TOOL_NAMES } from './lineSizeHelpers';

/**
 * Testy k #116 AC2: pravidla nad tabulkou sad barev ze zadání (opsanou
 * v `toolColorSetsHelpers.ts`). ΔE76 se počítá v CIELAB z sRGB s bílým
 * bodem D65, kontrast podle WCAG 2 (relativní jas), obojí pomůckou
 * v testech bez nové závislosti. Že hra ukazuje přesně tyto sady, hlídá
 * `toolColorSets.test.ts` (AC1).
 *
 * Kontrola pomůcky: dnešní nejpodobnější dvojice štětce, hnědá a tělová,
 * má podle zadání ΔE76 21,1.
 */

/** Nejmenší rozdíl dvou barev v jedné sadě (AC2 a). */
const MIN_SET_DELTA = 21;

/** Nejmenší kontrast nové barvy proti bílé (AC2 c). */
const MIN_WHITE_CONTRAST = 2.3;

/** Nejmenší rozdíl nové barvy od štětce na stejném místě a od jiné nové barvy (AC2 d). */
const MIN_NEW_DELTA = 10;

/** Nejméně vlastních barev každého nástroje kromě štětce (AC2 d). */
const MIN_OWN_COLORS = 4;

const WHITE = '#FFFFFF';

const BROWN_PLACE = 6;
const SKIN_PLACE = 9;

function placeName(place: number): string {
  return `místo ${place + 1} (${PLACE_NAMES[place] ?? '?'})`;
}

describe('#116 AC2: tabulka sad barev splňuje pravidla zadání', () => {
  it('kontrola pomůcky: hnědá a tělová štětce se liší o ΔE76 21,1 a barvy se samy od sebe neliší', () => {
    const delta = deltaE76(BRUSH_SET[BROWN_PLACE] ?? '', BRUSH_SET[SKIN_PLACE] ?? '');
    expect(delta, 'hnědá a tělová').toBeCloseTo(21.1, 1);
    expect(deltaE76('#123456', '#123456'), 'stejná barva').toBe(0);
    expect(contrastRatio(WHITE, '#000000'), 'černá proti bílé').toBeCloseTo(21, 5);
    expect(contrastRatio(WHITE, WHITE), 'bílá proti bílé').toBe(1);
  });

  it('tabulka má 12 barev štětce a 34 nových, dohromady 46 barev', () => {
    expect(new Set(BRUSH_SET).size, 'barvy štětce').toBe(BRUSH_COLOR_COUNT);
    expect(new Set(newColors().map((color) => color.hex)).size, 'nové barvy').toBe(NEW_COLOR_COUNT);
    expect(newColors().length, 'každá nová barva je v tabulce jen jednou').toBe(NEW_COLOR_COUNT);
    expect(allTableHexes().length, 'všechny barvy').toBe(ALL_COLOR_COUNT);
    for (const hex of allTableHexes()) {
      expect(hex, 'platný odstín #RRGGBB').toMatch(/^#[0-9A-F]{6}$/);
    }
  });

  it('a) každá sada má 12 různých barev a každé dvě se liší aspoň o ΔE76 21', () => {
    for (const tool of COLOR_TOOLS) {
      const set = TOOL_SETS[tool];
      expect(set.length, `${TOOL_NAMES[tool]}: počet barev`).toBe(SET_SIZE);
      expect(new Set(set).size, `${TOOL_NAMES[tool]}: různé barvy`).toBe(SET_SIZE);
      for (let first = 0; first < set.length; first += 1) {
        for (let second = first + 1; second < set.length; second += 1) {
          const delta = deltaE76(set[first] ?? '', set[second] ?? '');
          expect(
            delta,
            `${TOOL_NAMES[tool]}: ${placeName(first)} ${set[first]} a ${placeName(second)} ${set[second]}`,
          ).toBeGreaterThanOrEqual(MIN_SET_DELTA);
        }
      }
    }
  });

  it('b) barva na místě k je ze všech 12 barev štětce nejblíž barvě štětce na místě k', () => {
    for (const tool of COLOR_TOOLS) {
      TOOL_SETS[tool].forEach((hex, place) => {
        const own = deltaE76(hex, BRUSH_SET[place] ?? '');
        BRUSH_SET.forEach((brushHex, brushPlace) => {
          if (brushPlace === place) {
            return;
          }
          expect(
            deltaE76(hex, brushHex),
            `${TOOL_NAMES[tool]}, ${placeName(place)} ${hex}: štětec ${placeName(brushPlace)} ${brushHex} je dál než ${BRUSH_SET[place]} (${own.toFixed(2)})`,
          ).toBeGreaterThan(own);
        });
      });
    }
  });

  it('c) každá nová barva má proti bílé kontrast aspoň 2,3 : 1', () => {
    for (const color of newColors()) {
      expect(
        contrastRatio(color.hex, WHITE),
        `${TOOL_NAMES[color.tool]}, ${placeName(color.place)} ${color.hex}`,
      ).toBeGreaterThanOrEqual(MIN_WHITE_CONTRAST);
    }
  });

  it('c) barvy štětce zůstávají, jak jsou', () => {
    expect(TOOL_SETS.brush).toEqual([
      '#FF3B30',
      '#FF9500',
      '#FFCC00',
      '#34C759',
      '#007AFF',
      '#AF52DE',
      '#A2845E',
      '#2C2C2E',
      '#F75A9C',
      '#DE9670',
      '#8E8E93',
      '#44B6EC',
    ]);
  });

  it('d) nová barva se od barvy štětce na stejném místě liší aspoň o ΔE76 10', () => {
    for (const color of newColors()) {
      const brushHex = BRUSH_SET[color.place] ?? '';
      expect(
        deltaE76(color.hex, brushHex),
        `${TOOL_NAMES[color.tool]}, ${placeName(color.place)} ${color.hex} proti ${brushHex}`,
      ).toBeGreaterThanOrEqual(MIN_NEW_DELTA);
    }
  });

  it('d) každé dvě nové barvy se liší aspoň o ΔE76 10', () => {
    const colors = newColors();
    for (let first = 0; first < colors.length; first += 1) {
      for (let second = first + 1; second < colors.length; second += 1) {
        const a = colors[first];
        const b = colors[second];
        if (a === undefined || b === undefined) {
          continue;
        }
        expect(
          deltaE76(a.hex, b.hex),
          `${TOOL_NAMES[a.tool]} ${placeName(a.place)} ${a.hex} a ${TOOL_NAMES[b.tool]} ${placeName(b.place)} ${b.hex}`,
        ).toBeGreaterThanOrEqual(MIN_NEW_DELTA);
      }
    }
  });

  it('d) každý nástroj kromě štětce má aspoň 4 vlastní barvy', () => {
    for (const tool of COLOR_TOOLS) {
      if (tool === 'brush') {
        continue;
      }
      const own = newColors().filter((color) => color.tool === tool).length;
      expect(own, TOOL_NAMES[tool]).toBeGreaterThanOrEqual(MIN_OWN_COLORS);
    }
  });

  it('d) všech barev je nejvýš 64', () => {
    expect(allTableHexes().length).toBeLessThanOrEqual(MAX_COLOR_COUNT);
  });
});
