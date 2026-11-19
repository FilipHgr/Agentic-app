/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest';

import { OUTLINE_REGION } from '../../../src/games/coloring/logic/regionMap';
import licenceText from '../../../public/licence.txt?raw';
import {
  LINE_RGB,
  OUTLINE_HEIGHT,
  OUTLINE_PICTURE_IDS,
  OUTLINE_WIDTH,
  PICTURE_FILES,
  SECOND_SET_IDS,
  THIRD_SET_IDS,
  outlineBytes,
  outlineFileName,
  outlineOf,
  regionSizes,
  strokeAcrossPicture,
} from './realPicturesHelpers';
import type { ReadOutline } from './realPicturesHelpers';

/**
 * Testy k #128 AC2 (obrys a oblasti každé z 5 nových omalovánek), AC3
 * (velikost souborů obrysů) a AC6 (původ v `public/licence.txt`), od #132
 * pro všech 10 obrysů PNG (5 z #128 a 5 z #132: moře, mořská panna, duha,
 * vánoční baňka, jednorožec) se stejnými pravidly (#132 AC2, AC3, AC6),
 * od #152 pro 15 obrysů (navíc dinosaurus, raketa, traktor, hrad, sova)
 * se stejnými pravidly (#152 AC2 a AC5).
 *
 * Pravidla v cyklu: jeden test na pravidlo, omalovánka je v popisu
 * `expect`. Obrysy se rozloží na oblasti stejně jako ve hře
 * (`buildRegionMap(outlineFromImage(…))`, viz `realPicturesHelpers.ts`).
 *
 * Přesné znění AC2 podle reviewera (schváleno): každá oblast má aspoň 50
 * pixelů plochy v rozměru 1024 × 768; pozadí obrysu je průhledné a každý
 * pixel, který není úplně průhledný, má barvu #1D1D1F. Formát podle
 * doporučení k otázce 1: PNG s 16 stejnými úrovněmi průhlednosti
 * (0, 17, 34, … 255). Limit součtu podle otázky 3: 131 072 B, od #132
 * (otázka 4) pro 10 obrysů 270 336 B. Limit souboru 32 768 B platí dál
 * i pro moře (#132 otázka 3: obrys moře se zjednoduší, limit se nemění).
 * Od #152 AC2 se limit součtu zvýší o 5 × 32 768 B na 434 176 B pro
 * 15 obrysů, limit souboru zůstává 32 768 B.
 */

const MIN_REGIONS = 10;
const MAX_REGIONS = 40;
const MIN_REGION_PIXELS = 50;
const MAX_OUTLINE_BYTES = 32_768;
/**
 * #132 AC3 (otázka 4): 10 obrysů dohromady nejvýš 264 KiB. Upraveno
 * k #152 AC2: limit sady se zvýší o 5 × 32 768 B (15 obrysů, 424 KiB).
 */
const MAX_OUTLINES_TOTAL_BYTES = 270_336 + 5 * 32_768;
/** Počet obrysů PNG v sadě: 10 od #132 (AC3), od #152 AC2 15. */
const OUTLINE_FILES = 15;
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

describe('#128, #132 a #152 AC2: obrys každé omalovánky s obrysem PNG', () => {
  // Upraveno k #152 AC2: obrysů PNG je 15, navíc dinosaurus, raketa, traktor, hrad a sova.
  it('každá z 15 omalovánek kromě domku a papíru má obrys PNG ve složce obrázků omalovánek, i moře, mořská panna, duha, vánoční baňka, jednorožec, dinosaurus, raketa, traktor, hrad a sova', () => {
    for (const id of OUTLINE_PICTURE_IDS) {
      expect(PICTURE_FILES[outlineFileName(id)], outlineFileName(id)).toBeDefined();
    }
  });

  it('obrys má rozměr 1024 × 768 jako plocha malování', () => {
    for (const id of OUTLINE_PICTURE_IDS) {
      const { png } = requireOutline(id);
      expect({ width: png.width, height: png.height }, id).toEqual({
        width: OUTLINE_WIDTH,
        height: OUTLINE_HEIGHT,
      });
    }
  });

  it('pozadí obrysu je průhledné: rohy jsou úplně průhledné a průhledná je většina plochy', () => {
    for (const id of OUTLINE_PICTURE_IDS) {
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
    for (const id of OUTLINE_PICTURE_IDS) {
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
    for (const id of OUTLINE_PICTURE_IDS) {
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

describe('#152 AC2: obrysy nových omalovánek jsou vlastní obrázky', () => {
  it('soubor obrysu každé omalovánky je jiný než obrysy ostatních omalovánek', () => {
    const contents = OUTLINE_PICTURE_IDS.map((id) => PICTURE_FILES[outlineFileName(id)] ?? id);
    const same = OUTLINE_PICTURE_IDS.filter(
      (id, index) => contents.indexOf(contents[index] ?? id) !== index,
    );
    expect(same, 'obrysy, které opakují dřívější soubor').toEqual([]);
  });
});

describe('#128, #132 a #152 AC2: oblasti každé omalovánky s obrysem PNG', () => {
  it('omalovánka má 10 až 40 oblastí, pozadí se počítá jako oblast', () => {
    for (const id of OUTLINE_PICTURE_IDS) {
      const { regions } = requireOutline(id);
      expect(regions.regionCount, `${id}: počet oblastí`).toBeGreaterThanOrEqual(MIN_REGIONS);
      expect(regions.regionCount, `${id}: počet oblastí`).toBeLessThanOrEqual(MAX_REGIONS);
    }
  });

  it('pozadí kolem kresby je jedna z oblastí (roh obrázku není obrys)', () => {
    for (const id of OUTLINE_PICTURE_IDS) {
      const { regions } = requireOutline(id);
      expect(regions.regionIds[0], `${id}: levý horní roh`).not.toBe(OUTLINE_REGION);
    }
  });

  it('žádná oblast nemá méně než 50 px v rozměru 1024 × 768', () => {
    for (const id of OUTLINE_PICTURE_IDS) {
      const { regions } = requireOutline(id);
      const small = regionSizes(regions)
        .map((size, region) => ({ region, size }))
        .filter(({ region, size }) => region !== OUTLINE_REGION && size < MIN_REGION_PIXELS);
      expect(small, `${id}: oblasti pod 50 px`).toEqual([]);
    }
  });

  it('tah začatý v oblasti a tažený přes celý obrázek barví jen tuto oblast', () => {
    for (const id of OUTLINE_PICTURE_IDS) {
      const { regions } = requireOutline(id);
      for (let region = 1; region <= regions.regionCount; region += 1) {
        const spill = strokeAcrossPicture(regions, region);
        expect(spill.painted, `${id}, oblast ${region}: tah něco zabarvil`).toBeGreaterThan(0);
        expect(spill.outside, `${id}, oblast ${region}: pixely mimo oblast`).toBe(0);
      }
    }
  });
});

describe('#128, #132 a #152 AC2 a AC3: velikost obrysů', () => {
  // Upraveno k #152 AC2: limit souboru platí i pro 5 nových obrysů.
  it('každý z 15 obrysů má nejvýš 32 768 B, i zjednodušené moře a obrysy z #152', () => {
    for (const id of OUTLINE_PICTURE_IDS) {
      const bytes = outlineBytes(id);
      expect(bytes, outlineFileName(id)).not.toBeNull();
      expect(bytes?.length ?? Infinity, outlineFileName(id)).toBeLessThanOrEqual(MAX_OUTLINE_BYTES);
    }
  });

  // Upraveno k #152 AC2: 15 obrysů PNG.
  it('sada má 15 obrysů PNG: 5 z #128, 5 z #132 a 5 nových z #152', () => {
    expect(OUTLINE_PICTURE_IDS.length).toBe(OUTLINE_FILES);
    const pngs = Object.keys(PICTURE_FILES).filter((name) => name.endsWith('.png'));
    expect(pngs.sort(), 'soubory PNG ve složce obrázků').toEqual(
      OUTLINE_PICTURE_IDS.map(outlineFileName).sort(),
    );
  });

  // Upraveno k #152 AC2: limit sady 270 336 B + 5 × 32 768 B.
  it('15 obrysů PNG má dohromady nejvýš 434 176 B (limit z #132 zvýšený o 5 × 32 768 B)', () => {
    expect(MAX_OUTLINES_TOTAL_BYTES, 'limit sady').toBe(434_176);
    const sizes = OUTLINE_PICTURE_IDS.map((id) => outlineBytes(id)?.length ?? Infinity);
    const total = sizes.reduce((sum, size) => sum + size, 0);
    expect(total, `velikosti ${sizes.join(', ')}`).toBeLessThanOrEqual(MAX_OUTLINES_TOTAL_BYTES);
  });

  // Upraveno k #152 AC2: 15 obrysů PNG.
  it('ve složce obrázků je jen obrys domku a 15 obrysů PNG, kruhy ani hvězda ne', () => {
    expect(Object.keys(PICTURE_FILES).sort()).toEqual(
      ['house.svg', ...OUTLINE_PICTURE_IDS.map(outlineFileName)].sort(),
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
    OUTLINE_PICTURE_IDS.some((id) => paragraph.includes(outlineFileName(id))),
  );
}

/**
 * Odstavec licence s obrysem omalovánky `id` uvádí službu, model, komerční
 * použití, nástroj převodu a řádek s označením a otiskem SHA-256 zdroje
 * (#132 AC6, #152 AC5).
 */
function expectFullOrigin(id: string): void {
  const origin = licenceParagraphs()
    .filter((paragraph) => paragraph.includes(outlineFileName(id)))
    .join('\n');
  expect(origin, `${id}: odstavec s ${outlineFileName(id)}`).not.toBe('');
  expect(origin, `${id}: služba`).toContain('ElevenLabs');
  expect(origin, `${id}: model`).toContain('GPT Image 2.5');
  expect(origin, `${id}: komerční použití`).toMatch(/komerční/i);
  expect(origin, `${id}: převod`).toContain('tools/design/outline-from-image.mjs');
  expect(origin, `${id}: zmínka SHA-256`).toMatch(/SHA-256/i);
  expect(origin, `${id}: řádek s označením a otiskem zdroje`).toMatch(
    new RegExp(`\\b${id}\\b[^\\n]*\\b[0-9a-f]{64}\\b`),
  );
}

describe('#128 a #132 AC6, #152 AC5: původ obrázků v public/licence.txt', () => {
  // Upraveno k #152 AC5: i 5 nových obrysů z #152.
  it('licence uvádí obrys každé z 15 omalovánek s obrysem PNG, i 5 nových z #132 a 5 z #152', () => {
    const text = licenceParagraphs().join('\n');
    for (const id of OUTLINE_PICTURE_IDS) {
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

  // Upraveno k #152 AC5: otisků je aspoň 15.
  it('u obrysů je otisk SHA-256 zdrojového obrázku každé z 15 omalovánek', () => {
    const origin = outlineParagraphs().join('\n');
    const hashes = new Set(origin.toLowerCase().match(/\b[0-9a-f]{64}\b/g) ?? []);
    expect(origin, 'zmínka SHA-256').toMatch(/SHA-256/i);
    expect(hashes.size, 'různé otisky zdrojů').toBeGreaterThanOrEqual(OUTLINE_PICTURE_IDS.length);
  });

  it('u každé z 5 nových omalovánek z #132 je v jejím odstavci ElevenLabs, GPT Image 2.5, komerční použití, nástroj převodu a vlastní otisk SHA-256', () => {
    for (const id of SECOND_SET_IDS) {
      expectFullOrigin(id);
    }
  });

  it('#152 AC5: u dinosaura, rakety, traktoru, hradu a sovy je v jejich odstavci ElevenLabs, GPT Image 2.5, komerční použití, nástroj převodu a vlastní otisk SHA-256', () => {
    for (const id of THIRD_SET_IDS) {
      expectFullOrigin(id);
    }
  });

  it('#152 AC5: každý z 15 obrysů má v licenci vlastní řádek s jiným otiskem SHA-256 zdroje', () => {
    const hashes = OUTLINE_PICTURE_IDS.map((id) => {
      const line = licenceText
        .split('\n')
        .find((each) => new RegExp(`\\b${id}\\b[^\\n]*\\b[0-9a-f]{64}\\b`).test(each));
      const hash = line?.toLowerCase().match(/\b[0-9a-f]{64}\b/)?.[0];
      expect(hash, `${id}: řádek s otiskem zdroje`).toBeDefined();
      return hash;
    });
    expect(new Set(hashes).size, hashes.join(', ')).toBe(OUTLINE_PICTURE_IDS.length);
  });

  it('licence už neuvádí smazané zástupné obrysy kruhů a hvězdy', () => {
    expect(licenceText).not.toContain('pictures/circles.svg');
    expect(licenceText).not.toContain('pictures/star.svg');
  });
});
