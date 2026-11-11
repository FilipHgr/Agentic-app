import { describe, expect, it } from 'vitest';

import {
  MAP_GOAL_SYMBOLS,
  MAP_ORIENTATIONS,
  MAP_PICTURE_SIZE,
  mapPictureUrl,
} from '../../../src/games/counting/logic/mapPictures';
import { MAP_THEMES } from '../../../src/games/counting/logic/progressMap';
import {
  GOAL_SYMBOLS,
  LICENCE_TEXT,
  MAPS_FOLDER,
  MAPS_FOLDER_FILES,
  MAX_MAP_FILE_BYTES,
  PICTURE_FILES,
  PICTURE_ORIENTATIONS,
  PICTURE_SIZE,
  SYMBOL_FILES,
  bytesOf,
  externalReferences,
  goalSymbolFileName,
  isSameOrigin,
  licenceParagraphsWith,
  pictureFileName,
  picturePath,
  sha256Of,
  symbolPath,
  webpHeader,
} from './mapPictureHelpers';
import { PICTURE_TONES, TONE_GRID } from './mapPictureTones';

/**
 * Testy k #134 AC5 (a souborové části AC1 a AC2): obrázky 5 map na šířku
 * i na výšku a symboly cíle jsou malé soubory v repozitáři, původ
 * a licence jsou v `public/licence.txt` a hra nic nestahuje z cizích
 * serverů. Stejné kontroly jako u dlaždic her (#122) a ikon Noto (#106).
 *
 * Navržené soubory ve složce `src/games/counting/maps/`:
 * `<mapa>-landscape.webp` (1200 × 800), `<mapa>-portrait.webp`
 * (800 × 1200) a `goal-<mapa>.svg` (Noto Emoji z `@iconify-json/noto`
 * 1.2.10: gem-stone, mushroom, castle, spiral-shell, ringed-planet).
 *
 * Navržené rozhraní `src/games/counting/logic/mapPictures.ts` (popis
 * v `mapPictures.test.ts`): `MAP_ORIENTATIONS`, `MAP_PICTURE_SIZE`,
 * `mapPictureUrl(theme, orientation)` a `MAP_GOAL_SYMBOLS`.
 */

const NOTO_VIEW_BOX = /viewBox\s*=\s*["']0 0 128 128["']/;

describe('#134 AC5: každá z 5 map má obrázek na šířku i na výšku jako malý WebP v repozitáři', () => {
  it('každá mapa má ve složce map obrázek na šířku i na výšku', () => {
    for (const theme of MAP_THEMES) {
      for (const orientation of PICTURE_ORIENTATIONS) {
        expect(
          PICTURE_FILES[picturePath(theme, orientation)],
          picturePath(theme, orientation),
        ).toBeDefined();
      }
    }
  });

  it('ve složce map je přesně 10 obrázků a 5 symbolů cíle, nic navíc ke stažení', () => {
    const expected = MAP_THEMES.flatMap((theme) => [
      picturePath(theme, 'landscape'),
      picturePath(theme, 'portrait'),
      symbolPath(theme),
    ]).sort();
    expect([...MAPS_FOLDER_FILES].sort()).toEqual(expected);
  });

  it('každý obrázek mapy je WebP', () => {
    for (const [path, dataUrl] of Object.entries(PICTURE_FILES)) {
      expect(webpHeader(bytesOf(dataUrl)), path).not.toBeNull();
    }
  });

  it('obrázek na šířku má 1200 × 800 a na výšku 800 × 1200', () => {
    for (const theme of MAP_THEMES) {
      for (const orientation of PICTURE_ORIENTATIONS) {
        const path = picturePath(theme, orientation);
        const dataUrl = PICTURE_FILES[path] ?? '';
        expect(webpHeader(bytesOf(dataUrl)), path).toEqual(PICTURE_SIZE[orientation]);
      }
    }
  });

  it('hra počítá s rozměrem, jaký obrázky opravdu mají', () => {
    expect([...MAP_ORIENTATIONS].sort()).toEqual([...PICTURE_ORIENTATIONS].sort());
    for (const orientation of PICTURE_ORIENTATIONS) {
      expect(MAP_PICTURE_SIZE[orientation], orientation).toEqual(PICTURE_SIZE[orientation]);
    }
  });

  it('každý obrázek mapy má nejvýš 49 152 B', () => {
    expect(Object.keys(PICTURE_FILES).length).toBeGreaterThan(0);
    for (const [path, dataUrl] of Object.entries(PICTURE_FILES)) {
      expect(bytesOf(dataUrl).length, path).toBeLessThanOrEqual(MAX_MAP_FILE_BYTES);
    }
  });
});

describe('#134 AC2 a AC5: cíl má symbol tématu ze sady Noto Emoji v repozitáři', () => {
  it('ostrov má 💎, les 🍄, hrad 🏰, podmoří 🐚 a vesmír 🪐', () => {
    for (const theme of MAP_THEMES) {
      expect(MAP_GOAL_SYMBOLS[theme].emoji, theme).toBe(GOAL_SYMBOLS[theme].emoji);
      expect(MAP_GOAL_SYMBOLS[theme].notoName, theme).toBe(GOAL_SYMBOLS[theme].notoName);
    }
  });

  it('každá mapa má jiný symbol cíle', () => {
    const emojis = MAP_THEMES.map((theme) => MAP_GOAL_SYMBOLS[theme].emoji);
    expect(new Set(emojis).size).toBe(MAP_THEMES.length);
  });

  for (const theme of MAP_THEMES) {
    it(`symbol cíle mapy ${theme} je SVG ze sady Noto bez textu, skriptu a odkazů ven`, () => {
      const path = symbolPath(theme);
      const svg = SYMBOL_FILES[path] ?? '';
      expect(svg, path).not.toBe('');
      expect(svg, 'začíná značkou <svg>').toMatch(/^\s*<svg[\s>]/);
      expect(svg, 'plocha 0 0 128 128 jako v sadě Noto').toMatch(NOTO_VIEW_BOX);
      for (const tag of ['text', 'script', 'image', 'foreignObject', 'style']) {
        expect(svg, `bez <${tag}>`).not.toMatch(new RegExp(`<${tag}[\\s>/]`, 'i'));
      }
      expect(svg, 'bez obsluhy událostí').not.toMatch(/\son\w+\s*=/i);
      expect(externalReferences(svg), 'bez adres mimo soubor').toEqual([]);
      expect(new TextEncoder().encode(svg).length, 'velikost').toBeLessThanOrEqual(
        MAX_MAP_FILE_BYTES,
      );
    });
  }
});

describe('#134 AC5: hra nic nestahuje z cizích serverů', () => {
  it('adresa obrázku každé mapy v každé orientaci je ze stejné stránky', () => {
    for (const theme of MAP_THEMES) {
      for (const orientation of PICTURE_ORIENTATIONS) {
        const url = mapPictureUrl(theme, orientation);
        expect(isSameOrigin(url), `${theme}, ${orientation}: ${url}`).toBe(true);
      }
    }
  });

  it('každá mapa a orientace ukazuje na svůj vlastní soubor obrázku', () => {
    for (const theme of MAP_THEMES) {
      for (const orientation of PICTURE_ORIENTATIONS) {
        const name = pictureFileName(theme, orientation).replace('.webp', '');
        expect(mapPictureUrl(theme, orientation), `${theme}, ${orientation}`).toContain(name);
      }
    }
  });

  it('adresa symbolu cíle každé mapy je ze stejné stránky a ukazuje na symbol té mapy', () => {
    for (const theme of MAP_THEMES) {
      const { file, url } = MAP_GOAL_SYMBOLS[theme];
      expect(file, theme).toBe(goalSymbolFileName(theme));
      expect(isSameOrigin(url), `${theme}: ${url}`).toBe(true);
      // Malé SVG vloží Vite rovnou jako data: adresu, jinak je v adrese jméno souboru.
      if (!url.startsWith('data:')) {
        expect(url, theme).toContain(goalSymbolFileName(theme).replace('.svg', ''));
      }
    }
  });
});

describe('#134 AC5: původ obrázků a licence symbolů jsou v public/licence.txt', () => {
  const pictureParagraphs = (): string =>
    licenceParagraphsWith(`${MAPS_FOLDER}/`)
      .filter((paragraph) => paragraph.includes('ElevenLabs'))
      .join('\n\n');

  it('licence uvádí, že obrázky map jsou z ElevenLabs, model GPT Image 2.5, s komerčním tarifem', () => {
    const text = pictureParagraphs();
    expect(text, 'odstavec o obrázcích map').not.toBe('');
    expect(text, 'model').toMatch(/GPT Image 2\.5/);
    expect(text, 'komerční tarif').toMatch(/komerční/);
  });

  it('licence jmenuje obrázky všech 5 map na šířku i na výšku', () => {
    const text = pictureParagraphs();
    for (const theme of MAP_THEMES) {
      for (const orientation of PICTURE_ORIENTATIONS) {
        expect(text, pictureFileName(theme, orientation)).toContain(
          pictureFileName(theme, orientation),
        );
      }
    }
  });

  it('licence má otisk SHA-256 zdroje u každého z 10 obrázků', () => {
    const hashes = pictureParagraphs().match(/\b[0-9a-f]{64}\b/g) ?? [];
    expect(new Set(hashes).size).toBeGreaterThanOrEqual(MAP_THEMES.length * 2);
  });

  it('licence uvádí symboly cíle u sady Noto Emoji s licencí Apache-2.0', () => {
    const notoParagraphs = licenceParagraphsWith('Noto Emoji').join('\n\n');
    for (const theme of MAP_THEMES) {
      expect(notoParagraphs, GOAL_SYMBOLS[theme].notoName).toContain(GOAL_SYMBOLS[theme].notoName);
    }
    expect(notoParagraphs, 'složka symbolů').toContain(MAPS_FOLDER);
    expect(LICENCE_TEXT, 'licence Apache 2.0').toMatch(/Apache License, Version 2\.0/);
    expect(LICENCE_TEXT, 'odkaz na text licence').toMatch(/apache\.org\/licenses\/LICENSE-2\.0/);
  });
});

describe('#134: změřené barvy obrázků pro test kontrastu patří k souborům v repozitáři', () => {
  it('každý obrázek mapy má změřené barvy mřížky 4 × 4', () => {
    for (const theme of MAP_THEMES) {
      for (const orientation of PICTURE_ORIENTATIONS) {
        const tones = PICTURE_TONES[pictureFileName(theme, orientation)];
        expect(tones?.tones, pictureFileName(theme, orientation)).toHaveLength(
          TONE_GRID * TONE_GRID,
        );
      }
    }
  });

  it('otisk každého obrázku v repozitáři odpovídá změřeným barvám (jinak je změř znovu)', async () => {
    for (const theme of MAP_THEMES) {
      for (const orientation of PICTURE_ORIENTATIONS) {
        const file = pictureFileName(theme, orientation);
        const dataUrl = PICTURE_FILES[picturePath(theme, orientation)] ?? '';
        expect(await sha256Of(bytesOf(dataUrl)), file).toBe(PICTURE_TONES[file]?.sha256);
      }
    }
  });
});
