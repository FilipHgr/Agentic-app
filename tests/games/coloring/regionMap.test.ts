import { describe, expect, it } from 'vitest';

import {
  OUTLINE_REGION,
  buildRegionMap,
  outlineFromImage,
  regionAt,
} from '../../../src/games/coloring/logic/regionMap';
import type { RegionMap } from '../../../src/games/coloring/logic/regionMap';
import { drawing, pixelsOf } from './outlineFixtures';

/**
 * Testy k #88 AC2 (pozadí je oblast jako ostatní, obrys je obrys) a k mapě
 * oblastí z poznámek pro vývojáře: obrys se při startu vykreslí do pole
 * pixelů a čistá logika z něj rozdělí oblasti. Každý pixel nese číslo
 * oblasti, obrys má 0. Oblasti jsou souvislé přes hrany pixelů, takže ani
 * šikmá čára 1 px nepustí barvu do vedlejší oblasti.
 *
 * Navržené rozhraní (`src/games/coloring/logic/regionMap.ts`):
 * - `OUTLINE_REGION = 0`,
 * - `OutlineBitmap { width; height; outline: Uint8Array }` (1 = obrys, po řádcích),
 * - `outlineFromImage({ width, height, data })` z RGBA snímku obrysu
 *   (neprůhledný pixel je obrys, průhledný volné místo),
 * - `buildRegionMap(bitmap): RegionMap { width; height; regionCount }`,
 * - `regionAt(map, x, y): number | null` (souřadnice v pixelech, desetinné
 *   se zaokrouhlí dolů; 0 obrys, 1 až `regionCount` oblast, `null` mimo plochu).
 */

/** Čísla oblastí, která mapa opravdu používá (bez obrysu). */
function usedRegions(map: RegionMap): number[] {
  const ids = new Set<number>();
  for (const [x, y] of pixelsOf(map)) {
    const id = regionAt(map, x, y);
    if (id !== null && id !== OUTLINE_REGION) {
      ids.add(id);
    }
  }
  return [...ids].sort((a, b) => a - b);
}

describe('#88 AC2: pozadí kolem kreseb je oblast jako ostatní', () => {
  it('obrázek bez čar je celý jedna oblast pozadí, žádný pixel není obrys', () => {
    const map = drawing(40, 30).regions();
    expect(map.regionCount).toBe(1);
    const background = regionAt(map, 0, 0);
    expect(background).not.toBe(OUTLINE_REGION);
    for (const [x, y] of pixelsOf(map)) {
      expect(regionAt(map, x, y), `pixel (${x}, ${y})`).toBe(background);
    }
  });

  it('domeček uprostřed obrázku: vnitřek je jedna oblast a pozadí kolem něj druhá', () => {
    const map = drawing(60, 40).frame(20, 10, 40, 30).regions();
    expect(map.regionCount).toBe(2);
    const background = regionAt(map, 0, 0);
    const inside = regionAt(map, 30, 20);
    expect(background).not.toBe(OUTLINE_REGION);
    expect(inside).not.toBe(OUTLINE_REGION);
    expect(inside).not.toBe(background);
    // Všechny rohy obrázku i místa vedle domečku jsou totéž pozadí.
    for (const [x, y] of [
      [59, 0],
      [0, 39],
      [59, 39],
      [10, 20],
      [50, 20],
      [30, 5],
      [30, 35],
    ] as const) {
      expect(regionAt(map, x, y), `pozadí v (${x}, ${y})`).toBe(background);
    }
  });

  it('čára přes celý obrázek rozdělí pozadí na dvě oblasti', () => {
    const map = drawing(60, 40).verticalLine(30).regions();
    expect(map.regionCount).toBe(2);
    expect(regionAt(map, 5, 5)).not.toBe(regionAt(map, 55, 5));
  });

  it('obrys je vždy oblast 0', () => {
    const map = drawing(60, 40).frame(20, 10, 40, 30).regions();
    expect(regionAt(map, 20, 10)).toBe(OUTLINE_REGION);
    expect(regionAt(map, 21, 20)).toBe(OUTLINE_REGION);
    expect(regionAt(map, 40, 30)).toBe(OUTLINE_REGION);
  });
});

describe('#88 mapa oblastí z obrysu', () => {
  it('šikmá čára tlustá 1 px oddělí oblasti, i když se pixely po obou stranách dotýkají rohem', () => {
    const lines = drawing(30, 30);
    for (let i = 0; i < 30; i += 1) {
      lines.dot(i, i);
    }
    const map = lines.regions();
    expect(map.regionCount).toBe(2);
    // (1, 0) a (0, 1) se dotýkají jen rohem přes čáru, barva mezi nimi nepřeteče.
    expect(regionAt(map, 1, 0)).not.toBe(regionAt(map, 0, 1));
  });

  it('okno v domečku i střed slunce jsou vlastní oblasti (oblast v oblasti)', () => {
    const map = drawing(80, 60).frame(10, 10, 70, 50).frame(30, 20, 50, 40).regions();
    expect(map.regionCount).toBe(3);
    const ids = new Set([regionAt(map, 2, 2), regionAt(map, 20, 30), regionAt(map, 40, 30)]);
    expect(ids.size).toBe(3);
    expect(ids.has(OUTLINE_REGION)).toBe(false);
  });

  it('i maličká uzavřená oblast (jeden pixel) je vlastní oblast', () => {
    const map = drawing(20, 20).frame(5, 5, 7, 7, 1).regions();
    expect(map.regionCount).toBe(2);
    expect(regionAt(map, 6, 6)).not.toBe(regionAt(map, 0, 0));
    expect(regionAt(map, 6, 6)).not.toBe(OUTLINE_REGION);
  });

  it('oblasti mají čísla 1 až počet oblastí bez děr', () => {
    const map = drawing(90, 60)
      .frame(5, 5, 40, 40)
      .frame(50, 5, 85, 40)
      .frame(15, 15, 30, 30)
      .horizontalLine(50)
      .regions();
    const expected = Array.from({ length: map.regionCount }, (_, index) => index + 1);
    expect(usedRegions(map)).toEqual(expected);
    expect(map.regionCount).toBe(5);
  });

  it('obrázek celý z obrysu nemá žádnou oblast', () => {
    const map = drawing(10, 10).fill(0, 0, 9, 9).regions();
    expect(map.regionCount).toBe(0);
    expect(regionAt(map, 5, 5)).toBe(OUTLINE_REGION);
  });

  it('mapa má rozměry obrysu', () => {
    const map = drawing(64, 48).regions();
    expect(map.width).toBe(64);
    expect(map.height).toBe(48);
  });

  it.each([
    ['vlevo od obrázku', -1, 5],
    ['vpravo za obrázkem', 40, 5],
    ['nad obrázkem', 5, -0.5],
    ['pod obrázkem', 5, 30],
    ['nečíselná souřadnice', Number.NaN, 5],
    ['nekonečno', Number.POSITIVE_INFINITY, 5],
  ])('bod %s je mimo plochu', (_name, x, y) => {
    const map = drawing(40, 30).regions();
    expect(regionAt(map, x, y)).toBeNull();
  });

  it('desetinná souřadnice patří pixelu, ve kterém leží', () => {
    const map = drawing(40, 30).verticalLine(20).regions();
    expect(regionAt(map, 19.9, 3.2)).toBe(regionAt(map, 19, 3));
    expect(regionAt(map, 20.5, 3)).toBe(OUTLINE_REGION);
  });

  it('prázdný obrys 0 × 0 nic neshodí a každý bod je mimo plochu', () => {
    expect(() => buildRegionMap({ width: 0, height: 0, outline: new Uint8Array(0) })).not.toThrow();
    const map = buildRegionMap({ width: 0, height: 0, outline: new Uint8Array(0) });
    expect(map.regionCount).toBe(0);
    expect(regionAt(map, 0, 0)).toBeNull();
  });
});

describe('#88 obrys ze snímku obrázku', () => {
  /** RGBA snímek 4 × 1: neprůhledná černá, průhledná, neprůhledná šedá, průhledná bílá. */
  function image(): { width: number; height: number; data: Uint8ClampedArray } {
    return {
      width: 4,
      height: 1,
      data: new Uint8ClampedArray([0, 0, 0, 255, 0, 0, 0, 0, 128, 128, 128, 255, 255, 255, 255, 0]),
    };
  }

  it('neprůhledný pixel obrázku je obrys, průhledný je volné místo', () => {
    const bitmap = outlineFromImage(image());
    expect(bitmap.width).toBe(4);
    expect(bitmap.height).toBe(1);
    expect([...bitmap.outline]).toEqual([1, 0, 1, 0]);
  });

  it('z obrysu ze snímku jde postavit mapa oblastí', () => {
    const map = buildRegionMap(outlineFromImage(image()));
    expect(regionAt(map, 0, 0)).toBe(OUTLINE_REGION);
    expect(regionAt(map, 1, 0)).not.toBe(OUTLINE_REGION);
    expect(regionAt(map, 1, 0)).not.toBe(regionAt(map, 3, 0));
  });
});
