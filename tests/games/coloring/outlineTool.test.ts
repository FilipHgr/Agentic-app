import { describe, expect, it } from 'vitest';

// @ts-expect-error -- nástroj je čistý JavaScript bez typů
import { outlineFromPixels } from '../../../tools/design/outline-from-image.mjs';
import { buildRegionMap, outlineFromImage } from '../../../src/games/coloring/logic/regionMap';
import { decodePng, readRepoFile, runOutlineTool } from './pngReader.mjs';
import type { DecodedPng } from './pngReader.mjs';
import { LINE_RGB, regionSizes } from './realPicturesHelpers';

/**
 * Testy k #128 AC5: převodní nástroj pro vývojáře
 * `tools/design/outline-from-image.mjs` udělá ze schváleného obrázku
 * z ElevenLabs obrys podle AC2. Zdrojové PNG v repozitáři nejsou (otázka 4),
 * nástroj se proto ověřuje na malém pevném vstupu
 * `fixtures/outlineSource.png` (32 × 24 px, RGB jako zdroje z ElevenLabs,
 * 191 B). Na vstupu je:
 * - čtverec A s vnitřkem 7 × 7 = 49 px (pod 50 px, zaplní se),
 * - obdélník B s vnitřkem 5 × 10 = 50 px (zůstane),
 * - čtverec C s vnitřkem 1 px (zaplní se),
 * - obdélník D s vnitřkem 28 × 7 = 196 px, část jeho čáry je šedá 100,
 * - pozadí s jednotlivými šedými pixely 200, 133, 132, 240, 235, 30 a 20.
 * Čáry jsou černé (0) a tlusté 1 px, zbytek bílý (255).
 *
 * Převod podle zadání koordinátora: šedá → průhlednost (světlejší než 235
 * je pozadí, tmavší než 30 plná čára, mezi lineárně), obrys je jako ve hře
 * průhlednost aspoň 128, oblasti pod 50 px (mimo obrys, sousední přes hrany
 * jako `buildRegionMap`) se zaplní plnou čarou, 16 úrovní průhlednosti
 * (pixel obrysu úroveň aspoň 8 = 136, ostatní nejvýš 7 = 119), barva čáry
 * #1D1D1F.
 *
 * Navržené rozhraní nástroje:
 * - `outlineFromPixels({ width, height, channels, data })` s `channels`
 *   1 (šedá), 3 (RGB) nebo 4 (RGBA) a `data` po řádcích, vrátí
 *   `{ png: Uint8Array, filledRegions: number, remainingRegions: number }`,
 * - `node tools/design/outline-from-image.mjs <zdroj.png> <cíl.png>`
 *   zapíše `png` do cíle a vypíše počet zaplněných a zbylých oblastí.
 */

const FIXTURE_PATH = 'tests/games/coloring/fixtures/outlineSource.png';
const FIXTURE_WIDTH = 32;
const FIXTURE_HEIGHT = 24;
const MAX_FIXTURE_BYTES = 1024;

/** Průhlednost úrovně 8 a 7 z 16 (krok 17). */
const LOWEST_OUTLINE_LEVEL = 136;
const HIGHEST_FREE_LEVEL = 119;
const OUTLINE_MIN_ALPHA = 128;

interface ToolResult {
  readonly png: Uint8Array;
  readonly filledRegions: number;
  readonly remainingRegions: number;
}

/** Vstup nástroje jako ve skutečnosti: pixely přečtené ze zdrojového PNG. */
function fixture(): DecodedPng {
  return decodePng(readRepoFile(FIXTURE_PATH));
}

function rgbaInput(source: DecodedPng = fixture()) {
  return {
    width: source.width,
    height: source.height,
    channels: 4,
    data: new Uint8Array(source.data),
  };
}

function convert(input: ReturnType<typeof rgbaInput> = rgbaInput()): ToolResult {
  return outlineFromPixels(input) as ToolResult;
}

/** Šedá zdrojového pixelu (vstup je neutrálně šedý, R = G = B). */
function sourceGray(source: DecodedPng, x: number, y: number): number {
  return source.data[(y * source.width + x) * 4] ?? -1;
}

/** Průhlednost podle zadání před rozdělením na 16 úrovní. */
function expectedAlpha(gray: number): number {
  return Math.min(255, Math.max(0, (255 * (235 - gray)) / (235 - 30)));
}

interface Rect {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

/** Vnitřky malých oblastí, které nástroj zaplní (A 7 × 7 a C 1 px). */
const FILLED_INSIDES: readonly Rect[] = [
  { left: 2, top: 2, right: 8, bottom: 8 },
  { left: 21, top: 2, right: 21, bottom: 2 },
];

/** Vnitřky oblastí, které zůstanou (B 5 × 10 = 50 px a D 28 × 7). */
const KEPT_INSIDES: readonly Rect[] = [
  { left: 12, top: 2, right: 16, bottom: 11 },
  { left: 2, top: 15, right: 29, bottom: 21 },
];

function isInside(rect: Rect, x: number, y: number): boolean {
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

function isFilledPixel(x: number, y: number): boolean {
  return FILLED_INSIDES.some((rect) => isInside(rect, x, y));
}

function alphaOf(png: DecodedPng, x: number, y: number): number {
  return png.data[(y * png.width + x) * 4 + 3] ?? -1;
}

/** Projde všechny pixely vstupu 32 × 24. */
function eachPixel(visit: (x: number, y: number) => void): void {
  for (let y = 0; y < FIXTURE_HEIGHT; y += 1) {
    for (let x = 0; x < FIXTURE_WIDTH; x += 1) {
      visit(x, y);
    }
  }
}

describe('#128 AC5: pevný vstup nástroje je malý obrázek v testech', () => {
  it('vstup má 32 × 24 px a do 1 kB', () => {
    const bytes = readRepoFile(FIXTURE_PATH);
    expect(bytes.length).toBeLessThanOrEqual(MAX_FIXTURE_BYTES);
    const source = fixture();
    expect({ width: source.width, height: source.height }).toEqual({
      width: FIXTURE_WIDTH,
      height: FIXTURE_HEIGHT,
    });
  });
});

describe('#128 AC5: stejný vstup dá stejný soubor bajt po bajtu', () => {
  it('dvakrát převedený stejný obrázek dá stejné bajty', () => {
    const first = convert().png;
    const second = convert().png;
    expect(first.length).toBeGreaterThan(0);
    expect([...second]).toEqual([...first]);
  });

  it('šedý vstup s jedním kanálem dá stejný soubor jako stejný obrázek v RGBA', () => {
    const source = fixture();
    const gray = new Uint8Array(source.width * source.height);
    eachPixel((x, y) => {
      gray[y * source.width + x] = sourceGray(source, x, y);
    });
    const fromGray = outlineFromPixels({
      width: source.width,
      height: source.height,
      channels: 1,
      data: gray,
    }) as ToolResult;
    expect([...fromGray.png]).toEqual([...convert().png]);
  });
});

describe('#128 AC5: nástroj vytvoří obrys podle AC2', () => {
  it('výsledek je PNG se stejným rozměrem jako zdroj', () => {
    const png = decodePng(convert().png);
    expect({ width: png.width, height: png.height }).toEqual({
      width: FIXTURE_WIDTH,
      height: FIXTURE_HEIGHT,
    });
  });

  it('každý pixel, který není úplně průhledný, má barvu čáry #1D1D1F', () => {
    const png = decodePng(convert().png);
    const wrong: string[] = [];
    eachPixel((x, y) => {
      const index = (y * png.width + x) * 4;
      if (png.data[index + 3] === 0) {
        return;
      }
      const rgb = [png.data[index], png.data[index + 1], png.data[index + 2]];
      if (rgb.some((value, channel) => value !== LINE_RGB[channel])) {
        wrong.push(`(${x}, ${y}) má ${rgb.join(',')}`);
      }
    });
    expect(wrong).toEqual([]);
  });

  it('průhlednost má nejvýš 16 úrovní po stejných krocích (0, 17, … 255)', () => {
    const png = decodePng(convert().png);
    const levels = new Set<number>();
    eachPixel((x, y) => levels.add(alphaOf(png, x, y)));
    expect(levels.size).toBeLessThanOrEqual(16);
    expect([...levels].filter((alpha) => alpha % 17 !== 0)).toEqual([]);
  });

  it('bílé a světlejší než 235 je průhledné pozadí, tmavší než 30 je plná čára', () => {
    const source = fixture();
    const png = decodePng(convert().png);
    eachPixel((x, y) => {
      if (isFilledPixel(x, y)) {
        return;
      }
      const gray = sourceGray(source, x, y);
      if (gray >= 235) {
        expect(alphaOf(png, x, y), `(${x}, ${y}) šedá ${gray}`).toBe(0);
      }
      if (gray <= 30) {
        expect(alphaOf(png, x, y), `(${x}, ${y}) šedá ${gray}`).toBe(255);
      }
    });
  });

  it('pixel je obrysem ve hře právě tehdy, když je ve zdroji dost tmavý (průhlednost aspoň 128)', () => {
    const source = fixture();
    const png = decodePng(convert().png);
    eachPixel((x, y) => {
      if (isFilledPixel(x, y)) {
        return;
      }
      const gray = sourceGray(source, x, y);
      const alpha = alphaOf(png, x, y);
      if (expectedAlpha(gray) >= OUTLINE_MIN_ALPHA) {
        expect(alpha, `(${x}, ${y}) šedá ${gray} je obrys`).toBeGreaterThanOrEqual(
          LOWEST_OUTLINE_LEVEL,
        );
      } else {
        expect(alpha, `(${x}, ${y}) šedá ${gray} není obrys`).toBeLessThanOrEqual(
          HIGHEST_FREE_LEVEL,
        );
      }
    });
  });

  it('šedé okraje čar zůstanou poloprůhledné a tmavší zdroj nikdy nedá průhlednější pixel', () => {
    const source = fixture();
    const png = decodePng(convert().png);
    const soft = alphaOf(png, 25, 8);
    expect(soft, 'šedá 200 je poloprůhledná').toBeGreaterThan(0);
    expect(soft, 'šedá 200 není obrys').toBeLessThan(OUTLINE_MIN_ALPHA);

    const pairs: Array<readonly [number, number]> = [];
    eachPixel((x, y) => {
      if (!isFilledPixel(x, y)) {
        pairs.push([sourceGray(source, x, y), alphaOf(png, x, y)]);
      }
    });
    pairs.sort((a, b) => b[0] - a[0] || a[1] - b[1]);
    for (let index = 1; index < pairs.length; index += 1) {
      const [lighter, lighterAlpha] = pairs[index - 1] ?? [0, 0];
      const [darker, darkerAlpha] = pairs[index] ?? [0, 0];
      expect(darkerAlpha, `šedá ${darker} proti ${lighter}`).toBeGreaterThanOrEqual(lighterAlpha);
    }
  });
});

describe('#128 AC5: nástroj zaplní oblasti pod 50 px čarou', () => {
  it('oblast 49 px a oblast 1 px se zaplní plnou čarou', () => {
    const png = decodePng(convert().png);
    eachPixel((x, y) => {
      if (isFilledPixel(x, y)) {
        expect(alphaOf(png, x, y), `(${x}, ${y})`).toBe(255);
      }
    });
  });

  it('oblast s přesně 50 px a větší oblasti zůstanou průhledné', () => {
    const png = decodePng(convert().png);
    for (const rect of KEPT_INSIDES) {
      for (let y = rect.top; y <= rect.bottom; y += 1) {
        for (let x = rect.left; x <= rect.right; x += 1) {
          expect(alphaOf(png, x, y), `(${x}, ${y})`).toBe(0);
        }
      }
    }
  });

  it('nástroj ohlásí 2 zaplněné oblasti a 3 zbylé (pozadí, 50 px a velkou)', () => {
    const result = convert();
    expect(result.filledRegions).toBe(2);
    expect(result.remainingRegions).toBe(3);
  });

  it('hra rozloží výsledek na zbylé 3 oblasti a žádná nemá méně než 50 px', () => {
    const png = decodePng(convert().png);
    const regions = buildRegionMap(outlineFromImage(png));
    expect(regions.regionCount).toBe(3);
    const small = regionSizes(regions)
      .slice(1)
      .filter((size) => size < 50);
    expect(small).toEqual([]);
  });
});

describe('#128 AC5: nástroj z příkazové řádky', () => {
  it('node tools/design/outline-from-image.mjs <zdroj> <cíl> zapíše stejný soubor jako funkce a vypíše počty oblastí', () => {
    const run = runOutlineTool(FIXTURE_PATH);
    expect(run.status, run.stderr).toBe(0);
    expect(run.output, 'cílový soubor').not.toBeNull();
    expect([...(run.output ?? [])], 'stejné bajty jako funkce').toEqual([...convert().png]);
    expect(run.stdout, 'počet zaplněných oblastí').toMatch(/\b2\b/);
    expect(run.stdout, 'počet zbylých oblastí').toMatch(/\b3\b/);
  });

  it('dvě spuštění nad stejným zdrojem dají stejný soubor bajt po bajtu', () => {
    const first = runOutlineTool(FIXTURE_PATH);
    const second = runOutlineTool(FIXTURE_PATH);
    expect(first.output, 'první spuštění').not.toBeNull();
    expect([...(second.output ?? [])]).toEqual([...(first.output ?? [])]);
  });
});
