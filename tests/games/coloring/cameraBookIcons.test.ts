import { describe, expect, it } from 'vitest';

import {
  BOOK_ICON_FILE,
  CAMERA_ICON_FILE,
  TRASH_ICON_FILE,
} from '../../../src/games/coloring/logic/toolIcons';
import { ICON_FOLDER, LICENCE_TEXT, externalReferences, iconSvgOfFile } from './toolIconHelpers';

/**
 * Testy ikon k #126 podle schválených obrázků: fotoaparát 📷 (U+1F4F7)
 * a kniha 📔 (U+1F4D4) jsou ze stejné sady Google Noto Emoji
 * (Apache-2.0) jako ikony nástrojů (#106), SVG jsou v repozitáři u hry,
 * nic se nestahuje a licence je v `public/licence.txt`.
 */

const ICONS: ReadonlyArray<readonly [string, string]> = [
  ['fotoaparát', CAMERA_ICON_FILE],
  ['kniha', BOOK_ICON_FILE],
  // Upraveno k #129: stejné kontroly platí i pro ikonu koše u velkého obrázku z alba.
  ['koš', TRASH_ICON_FILE],
];

/** Plocha ikon Noto v sadě `@iconify-json/noto`. */
const NOTO_VIEW_BOX = /viewBox\s*=\s*["']0 0 128 128["']/;

/** Ikona nesmí být zbytečně velký asset (jako u ikon nástrojů). */
const MAX_ICON_BYTES = 20_000;

describe('#126: fotoaparát a kniha mají ikony ze sady Noto Emoji', () => {
  it('fotoaparát je emoji „camera“ a kniha „notebook with decorative cover“ ze sady Noto', () => {
    expect(CAMERA_ICON_FILE).toBe('camera.svg');
    expect(BOOK_ICON_FILE).toBe('notebook-with-decorative-cover.svg');
  });

  for (const [name, file] of ICONS) {
    it(`ikona „${name}“ je SVG ve složce hry bez textu, skriptu a odkazů ven`, () => {
      const svg = iconSvgOfFile(file);
      expect(svg, `${ICON_FOLDER}/${file}`).not.toBe('');
      expect(svg, 'začíná značkou <svg>').toMatch(/^\s*<svg[\s>]/);
      expect(svg, 'plocha 0 0 128 128 jako v sadě Noto').toMatch(NOTO_VIEW_BOX);
      for (const tag of ['text', 'script', 'image', 'foreignObject', 'style']) {
        expect(svg, `bez <${tag}>`).not.toMatch(new RegExp(`<${tag}[\\s>/]`, 'i'));
      }
      expect(svg, 'bez obsluhy událostí').not.toMatch(/\son\w+\s*=/i);
      expect(externalReferences(svg), 'bez adres mimo soubor').toEqual([]);
      expect(new TextEncoder().encode(svg).length, 'velikost').toBeLessThanOrEqual(MAX_ICON_BYTES);
    });
  }

  it('licence uvádí ikony fotoaparátu a knihy u ikon Noto Emoji', () => {
    const notoPart = LICENCE_TEXT.slice(LICENCE_TEXT.indexOf(ICON_FOLDER));
    expect(notoPart, 'fotoaparát').toMatch(/camera/);
    expect(notoPart, 'kniha').toMatch(/notebook-with-decorative-cover/);
    expect(notoPart, 'koš (#129)').toMatch(/wastebasket/);
    expect(notoPart, 'sada').toMatch(/Noto Emoji/);
  });
});
