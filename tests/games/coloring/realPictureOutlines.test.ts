/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest';

import { OUTLINE_REGION } from '../../../src/games/coloring/logic/regionMap';
import licenceText from '../../../public/licence.txt?raw';
import {
  LINE_RGB,
  NEW_PICTURE_IDS,
  OUTLINE_HEIGHT,
  OUTLINE_WIDTH,
  PICTURE_FILES,
  outlineBytes,
  outlineFileName,
  outlineOf,
  regionSizes,
  strokeAcrossPicture,
} from './realPicturesHelpers';
import type { ReadOutline } from './realPicturesHelpers';

/**
 * Testy k #128 AC2 (obrys a oblasti každé z 5 nových omalovánek), AC3
 * (velikost souborů obrysů) a AC6 (původ v `public/licence.txt`).
 *
 * Pravidla v cyklu: jeden test na pravidlo, omalovánka je v popisu
 * `expect`. Obrysy se rozloží na oblasti stejně jako ve hře
 * (`buildRegionMap(outlineFromImage(…))`, viz `realPicturesHelpers.ts`).
 *
 * Přesné znění AC2 podle reviewera (schváleno): každá oblast má aspoň 50
 * pixelů plochy v rozměru 1024 × 768; pozadí obrysu je průhledné a každý
 * pixel, který není úplně průhledný, má barvu #1D1D1F. Formát podle
 * doporučení k otázce 1: PNG s 16 stejnými úrovněmi průhlednosti
 * (0, 17, 34, … 255). Limit součtu podle otázky 3: 131 072 B.
 */

const MIN_REGIONS = 10;
const MAX_REGIONS = 40;
const MIN_REGION_PIXELS = 50;
const MAX_OUTLINE_BYTES = 32_768;
const MAX_OUTLINES_TOTAL_BYTES = 131_072;
const ALPHA_STEP = 17;

/** Přečtený obrys omalovánky; selže s jménem souboru, když soubor chybí. */
function requireOutline(id: string): ReadOutline {
  const outline = outlineOf(id);
  expect(outline, `obrys ${outlineFileName(id)} je ve složce pictures`).not.toBeNull();
  return outline as ReadOutline;
}

function alphaAt(outline: ReadOutline, x: number, y: number): number {
  return outline.png.data[(y * outline.png.width + x) * 4 + 3] ?? -1;
}

describe('#128 AC2: obrys každé nové omalovánky', () => {
  it('každá z 5 nových omalovánek má obrys PNG ve složce obrázků omalovánek', () => {
    for (const id of NEW_PICTURE_IDS) {
      expect(PICTURE_FILES[outlineFileName(id)], outlineFileName(id)).toBeDefined();
    }
  });

  it('obrys má rozměr 1024 × 768 jako plocha malování', () => {
    for (const id of NEW_PICTURE_IDS) {
      const { png } = requireOutline(id);
      expect({ width: png.width, height: png.height }, id).toEqual({
        width: OUTLINE_WIDTH,
        height: OUTLINE_HEIGHT,
      });
    }
  });

  it('pozadí obrysu je průhledné: rohy jsou úplně průhledné a průhledná je většina plochy', () => {
    for (const id of NEW_PICTURE_IDS) {
      const outline = requireOutline(id);
      const { width, height, data } = outline.png;
      const corners = [
        [0, 0],
        [width - 1, 0],
        [0, height - 1],
        [width - 1, height - 1],
      ] as const;
      for (const [x, y] of corners) {
        expect(alphaAt(outline, x, y), `${id}: roh (${x}, ${y})`).toBe(0);
      }
      let transparent = 0;
      for (let index = 3; index < data.length; index += 4) {
        if (data[index] === 0) {
          transparent += 1;
        }
      }
      expect(transparent / (width * height), `${id}: podíl průhledných pixelů`).toBeGreaterThan(
        0.5,
      );
    }
  });

  it('každý pixel obrysu, který není úplně průhledný, má barvu čáry #1D1D1F', () => {
    for (const id of NEW_PICTURE_IDS) {
      const { png } = requireOutline(id);
      const wrong: string[] = [];
      for (let index = 0; index < png.data.length && wrong.length < 5; index += 4) {
        if (png.data[index + 3] === 0) {
          continue;
        }
        const rgb = [png.data[index], png.data[index + 1], png.data[index + 2]];
        if (rgb.some((value, channel) => value !== LINE_RGB[channel])) {
          const pixel = index / 4;
          wrong.push(
            `(${pixel % png.width}, ${Math.floor(pixel / png.width)}) má ${rgb.join(',')}`,
          );
        }
      }
      expect(wrong, id).toEqual([]);
    }
  });

  it('obrys má nejvýš 16 úrovní průhlednosti po stejných krocích (0, 17, … 255)', () => {
    for (const id of NEW_PICTURE_IDS) {
      const { png } = requireOutline(id);
      const levels = new Set<number>();
      for (let index = 3; index < png.data.length; index += 4) {
        levels.add(png.data[index] ?? -1);
      }
      expect(levels.size, `${id}: počet úrovní`).toBeLessThanOrEqual(16);
      const offStep = [...levels].filter((alpha) => alpha % ALPHA_STEP !== 0);
      expect(offStep, `${id}: úrovně mimo kroky po 17`).toEqual([]);
    }
  });
});

describe('#128 AC2: oblasti každé nové omalovánky', () => {
  it('omalovánka má 10 až 40 oblastí, pozadí se počítá jako oblast', () => {
    for (const id of NEW_PICTURE_IDS) {
      const { regions } = requireOutline(id);
      expect(regions.regionCount, `${id}: počet oblastí`).toBeGreaterThanOrEqual(MIN_REGIONS);
      expect(regions.regionCount, `${id}: počet oblastí`).toBeLessThanOrEqual(MAX_REGIONS);
    }
  });

  it('pozadí kolem kresby je jedna z oblastí (roh obrázku není obrys)', () => {
    for (const id of NEW_PICTURE_IDS) {
      const { regions } = requireOutline(id);
      expect(regions.regionIds[0], `${id}: levý horní roh`).not.toBe(OUTLINE_REGION);
    }
  });

  it('žádná oblast nemá méně než 50 px v rozměru 1024 × 768', () => {
    for (const id of NEW_PICTURE_IDS) {
      const { regions } = requireOutline(id);
      const small = regionSizes(regions)
        .map((size, region) => ({ region, size }))
        .filter(({ region, size }) => region !== OUTLINE_REGION && size < MIN_REGION_PIXELS);
      expect(small, `${id}: oblasti pod 50 px`).toEqual([]);
    }
  });

  it('tah začatý v oblasti a tažený přes celý obrázek barví jen tuto oblast', () => {
    for (const id of NEW_PICTURE_IDS) {
      const { regions } = requireOutline(id);
      for (let region = 1; region <= regions.regionCount; region += 1) {
        const spill = strokeAcrossPicture(regions, region);
        expect(spill.painted, `${id}, oblast ${region}: tah něco zabarvil`).toBeGreaterThan(0);
        expect(spill.outside, `${id}, oblast ${region}: pixely mimo oblast`).toBe(0);
      }
    }
  });
});

describe('#128 AC3: velikost obrysů', () => {
  it('každý obrys nové omalovánky má nejvýš 32 768 B', () => {
    for (const id of NEW_PICTURE_IDS) {
      const bytes = outlineBytes(id);
      expect(bytes, outlineFileName(id)).not.toBeNull();
      expect(bytes?.length ?? Infinity, outlineFileName(id)).toBeLessThanOrEqual(MAX_OUTLINE_BYTES);
    }
  });

  it('5 nových obrysů má dohromady nejvýš 131 072 B', () => {
    const sizes = NEW_PICTURE_IDS.map((id) => outlineBytes(id)?.length ?? Infinity);
    const total = sizes.reduce((sum, size) => sum + size, 0);
    expect(total, `velikosti ${sizes.join(', ')}`).toBeLessThanOrEqual(MAX_OUTLINES_TOTAL_BYTES);
  });

  it('ve složce obrázků je jen obrys domku a 5 nových obrysů, kruhy ani hvězda ne', () => {
    expect(Object.keys(PICTURE_FILES).sort()).toEqual(
      ['house.svg', ...NEW_PICTURE_IDS.map(outlineFileName)].sort(),
    );
  });
});

/** Odstavce `licence.txt` (oddělené prázdným řádkem). */
function licenceParagraphs(): string[] {
  return licenceText.split(/\n\s*\n/);
}

/** Odstavce licence, které zmiňují obrys nové omalovánky. */
function outlineParagraphs(): string[] {
  return licenceParagraphs().filter((paragraph) =>
    NEW_PICTURE_IDS.some((id) => paragraph.includes(outlineFileName(id))),
  );
}

describe('#128 AC6: původ obrázků v public/licence.txt', () => {
  it('licence uvádí obrys každé z 5 nových omalovánek s cestou v repozitáři', () => {
    const text = licenceParagraphs().join('\n');
    for (const id of NEW_PICTURE_IDS) {
      const path = `src/games/coloring/pictures/${outlineFileName(id)}`;
      const named = text.includes(path) || text.includes(outlineFileName(id));
      expect(named, path).toBe(true);
    }
  });

  it('u obrysů je uvedená služba ElevenLabs, model GPT Image 2.5 a komerční použití jako u dlaždic', () => {
    const origin = outlineParagraphs().join('\n');
    expect(origin, 'odstavec o obrysech').not.toBe('');
    expect(origin).toContain('ElevenLabs');
    expect(origin).toContain('GPT Image 2.5');
    expect(origin).toMatch(/komerční/i);
  });

  it('u obrysů je uvedený převod nástrojem v repozitáři tools/design/outline-from-image.mjs', () => {
    expect(outlineParagraphs().join('\n')).toContain('tools/design/outline-from-image.mjs');
  });

  it('u obrysů je otisk SHA-256 zdrojového obrázku každé z 5 omalovánek', () => {
    const origin = outlineParagraphs().join('\n');
    const hashes = new Set(origin.toLowerCase().match(/\b[0-9a-f]{64}\b/g) ?? []);
    expect(origin, 'zmínka SHA-256').toMatch(/SHA-256/i);
    expect(hashes.size, 'různé otisky zdrojů').toBeGreaterThanOrEqual(NEW_PICTURE_IDS.length);
  });

  it('licence už neuvádí smazané zástupné obrysy kruhů a hvězdy', () => {
    expect(licenceText).not.toContain('pictures/circles.svg');
    expect(licenceText).not.toContain('pictures/star.svg');
  });
});
