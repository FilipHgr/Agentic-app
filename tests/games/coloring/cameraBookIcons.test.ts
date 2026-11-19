import { describe, expect, it } from 'vitest';

import {
  BOOK_ICON_FILE,
  CAMERA_ICON_FILE,
  TRASH_ICON_FILE,
} from '../../../src/games/coloring/logic/toolIcons';
import { ICON_FOLDER, webpBytesOf } from './actionIconHelpers';
import { iconSvgOfFile } from './toolIconHelpers';

/**
 * Testy ikon k #126 (fotoaparát a kniha) a #129 (koš), upravené k #153.
 *
 * Do #153 byly ikony emoji Noto 📷 (`camera.svg`), 📔
 * (`notebook-with-decorative-cover.svg`) a 🗑️ (`wastebasket.svg`) a test
 * hlídal jejich SVG (bez textu, skriptu a odkazů ven, nejvýš 20 000 B)
 * a uvedení u ikon Noto v `public/licence.txt`. #153 je nahrazuje vlastními
 * ikonami z ElevenLabs (WebP), proto tytéž požadavky hlídá nově:
 * - jméno a jedinečnost souboru, rozdíl od ostatních ikon:
 *   `actionIcons.test.ts` (#153 AC1),
 * - malý soubor uložený u hry a původ v `public/licence.txt`:
 *   `actionIcons.test.ts` (#153 AC4, WebP nejvýš 8 192 B).
 * Tady zůstává z #126 jen to, že se ikony nikdy nestahují za běhu.
 */

const ICONS: ReadonlyArray<readonly [string, string]> = [
  ['fotoaparát', CAMERA_ICON_FILE],
  ['kniha', BOOK_ICON_FILE],
  // Upraveno k #129: stejné kontroly platí i pro ikonu koše u velkého obrázku z alba.
  ['koš', TRASH_ICON_FILE],
];

/** Staré SVG emoji Noto, které #153 nahrazuje. */
const REPLACED_NOTO_FILES = ['camera.svg', 'notebook-with-decorative-cover.svg', 'wastebasket.svg'];

describe('#126 (upraveno k #153): fotoaparát, kniha a koš mají ikonu uloženou u hry', () => {
  for (const [name, file] of ICONS) {
    it(`ikona „${name}“ je obrázek ve složce hry, ne adresa na cizím serveru`, () => {
      expect(file, `${name}: jen jméno souboru .webp`).toMatch(/^[a-z-]+\.webp$/);
      expect(webpBytesOf(file), `${ICON_FOLDER}/${file}`).not.toBeNull();
    });
  }

  it('staré ikony Noto fotoaparátu, knihy a koše ve hře už nejsou (#153)', () => {
    for (const file of REPLACED_NOTO_FILES) {
      expect(iconSvgOfFile(file), `${ICON_FOLDER}/${file}`).toBe('');
    }
  });
});
