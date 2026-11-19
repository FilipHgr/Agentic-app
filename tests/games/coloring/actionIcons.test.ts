import { describe, expect, it } from 'vitest';

import {
  BOOK_ICON_FILE,
  BROOM_ICON_FILE,
  CAMERA_ICON_FILE,
  CONTINUE_ICON_FILE,
  TRASH_ICON_FILE,
  toolIconAsset,
} from '../../../src/games/coloring/logic/toolIcons';
import {
  ICON_FOLDER,
  MAX_ACTION_ICON_BYTES,
  MIN_DIFFERENCE,
  asciiOf,
  differenceShare,
  gridOfMeasure,
  gridOfSvg,
  sha256Of,
  shapeShare,
  webpBytesOf,
} from './actionIconHelpers';
import type { IconGrid } from './actionIconHelpers';
import {
  ACTION_ICON_MEASURES,
  DRAWN_SYMBOL_MEASURES,
  KEY_ICON_MEASURES,
} from './actionIconMeasures';
import type { DrawnSymbol } from './actionIconMeasures';
import { LICENCE_TEXT, TOOLS, TOOL_NAMES, iconSvgOf, limited } from './toolIconHelpers';

/**
 * Testy k #153 (Omalovánky: srozumitelná tlačítka alba a malování, ikony
 * z ElevenLabs): AC1 nové ikony, které se nepodobají žádné jiné ikoně ve
 * hře, a AC4 soubory (WebP nejvýš 8 192 B s původem v `public/licence.txt`).
 * Barvy podkladů a kontrast (AC2) jsou v `actionButtonColors.test.ts`,
 * rozložení (AC4) v `actionButtonsLayoutRules.test.ts`. Chování tlačítek
 * (AC3) hlídají beze změny testy #126, #129, #131 a #142.
 *
 * Nahrazují kontroly emoji Noto 📷 📔 🗑️ z `cameraBookIcons.test.ts`
 * (#126, #129) a koštěte 🧹 a štětce 🖌️ na malovat dál
 * (`toolIconAssets.test.ts`, #131, #142), které od #153 neplatí.
 *
 * Navržené rozhraní (`src/games/coloring/logic/toolIcons.ts`, jména
 * souborů ve složce `src/games/coloring/icons/`):
 * - `CAMERA_ICON_FILE = 'action-camera.webp'` fotoaparát v malování,
 * - `BOOK_ICON_FILE = 'action-album.webp'` album na výběru omalovánky,
 * - `CONTINUE_ICON_FILE = 'action-continue.webp'` malovat dál (obrázek
 *   s tužkou, už ne soubor štětce z panelu),
 * - `TRASH_ICON_FILE = 'action-trash.webp'` koš na velkém obrázku z alba,
 * - `BROOM_ICON_FILE = 'action-broom.webp'` koště v malování.
 * Staré SVG `camera.svg`, `notebook-with-decorative-cover.svg`,
 * `wastebasket.svg` a `broom.svg` ze složky zmizí. Změřené mřížky nových
 * ikon a symbolů kreslených kódem doplní implementace do
 * `actionIconMeasures.ts`.
 */

interface ActionIcon {
  readonly name: string;
  readonly file: string;
  readonly expectedFile: string;
}

const ACTION_ICONS: readonly ActionIcon[] = [
  { name: 'fotoaparát', file: CAMERA_ICON_FILE, expectedFile: 'action-camera.webp' },
  { name: 'album', file: BOOK_ICON_FILE, expectedFile: 'action-album.webp' },
  { name: 'malovat dál', file: CONTINUE_ICON_FILE, expectedFile: 'action-continue.webp' },
  { name: 'koš', file: TRASH_ICON_FILE, expectedFile: 'action-trash.webp' },
  { name: 'koště', file: BROOM_ICON_FILE, expectedFile: 'action-broom.webp' },
];

const DRAWN_SYMBOL_NAMES: Readonly<Record<DrawnSymbol, string>> = {
  home: 'domeček',
  gear: 'kolečko nastavení',
  undo: 'Zpět',
};

const KEY_NAMES: Readonly<Record<string, string>> = {
  'key.webp': 'klíč',
  'key-head.webp': 'půlka klíče',
};

/** Nejmenší díl neprůhledných dílků, aby změřená ikona nebyla prázdná nebo nepatrná. */
const MIN_SHAPE_SHARE = 0.1;

function actionGridOf(icon: ActionIcon): IconGrid | string {
  const measure = ACTION_ICON_MEASURES[icon.file];
  if (measure === undefined) {
    return `${icon.name}: chybí změřená mřížka ${icon.file} v actionIconMeasures.ts`;
  }
  return gridOfMeasure(icon.name, measure);
}

/** Ostatní ikony ve hře, kterým se nová ikona nesmí podobat (AC1). */
function otherIconGrids(): (IconGrid | string)[] {
  const tools = TOOLS.map((tool) => gridOfSvg(`nástroj ${TOOL_NAMES[tool]}`, iconSvgOf(tool)));
  const drawn = (Object.keys(DRAWN_SYMBOL_NAMES) as DrawnSymbol[]).map((symbol) => {
    const measure = DRAWN_SYMBOL_MEASURES[symbol];
    const name = DRAWN_SYMBOL_NAMES[symbol];
    return measure === undefined
      ? `${name}: chybí změřená mřížka v actionIconMeasures.ts`
      : gridOfMeasure(name, measure);
  });
  const keys = Object.entries(KEY_ICON_MEASURES).map(([file, measure]) =>
    gridOfMeasure(KEY_NAMES[file] ?? file, measure),
  );
  return [...tools, ...drawn, ...keys];
}

describe('#153 AC1: tlačítka alba a malování mají nové ikony', () => {
  it('fotoaparát, album, malovat dál, koš a koště mají každé svou novou ikonu WebP', () => {
    for (const icon of ACTION_ICONS) {
      expect(icon.file, icon.name).toBe(icon.expectedFile);
    }
    const files = ACTION_ICONS.map((icon) => icon.file);
    expect(new Set(files).size, `soubory ${files.join(', ')}`).toBe(ACTION_ICONS.length);
  });

  it('malovat dál už neukazuje štětec z panelu nástrojů', () => {
    expect(CONTINUE_ICON_FILE).not.toBe(toolIconAsset('brush').file);
  });

  it('každá ikona je jiný obrázek, žádná dvě tlačítka nemají stejný soubor', async () => {
    const hashes: string[] = [];
    for (const icon of ACTION_ICONS) {
      const bytes = webpBytesOf(icon.file);
      expect(bytes, `${icon.name}: chybí ${ICON_FOLDER}/${icon.file}`).not.toBeNull();
      hashes.push(bytes === null ? icon.file : await sha256Of(bytes));
    }
    expect(new Set(hashes).size, 'otisky souborů').toBe(ACTION_ICONS.length);
  });

  it('změřené obrázky ikon odpovídají souborům v repozitáři (po výměně se měří znovu)', async () => {
    const problems: string[] = [];
    for (const icon of ACTION_ICONS) {
      const bytes = webpBytesOf(icon.file);
      const measure = ACTION_ICON_MEASURES[icon.file];
      if (bytes === null || measure === undefined) {
        problems.push(`${icon.name}: chybí soubor nebo jeho měření`);
        continue;
      }
      const hash = await sha256Of(bytes);
      if (hash !== measure.sha256) {
        problems.push(`${icon.name}: soubor ${hash}, měření ${measure.sha256}`);
      }
    }
    for (const [file, measure] of Object.entries(KEY_ICON_MEASURES)) {
      const bytes = webpBytesOf(file);
      const hash = bytes === null ? 'chybí' : await sha256Of(bytes);
      if (hash !== measure.sha256) {
        problems.push(`${KEY_NAMES[file] ?? file}: soubor ${hash}, měření ${measure.sha256}`);
      }
    }
    expect(limited(problems)).toEqual([]);
  });

  it('každá nová ikona je vidět: aspoň desetina jejího čtverce není průhledná', () => {
    const problems: string[] = [];
    for (const icon of ACTION_ICONS) {
      const grid = actionGridOf(icon);
      if (typeof grid === 'string') {
        problems.push(grid);
      } else if (shapeShare(grid) < MIN_SHAPE_SHARE) {
        problems.push(`${icon.name}: neprůhledné jen ${(shapeShare(grid) * 100).toFixed(1)} %`);
      }
    }
    expect(limited(problems)).toEqual([]);
  });

  it('žádná nová ikona se nepodobá nástrojům v panelu, domečku, kolečku, Zpět ani klíči (rozdíl aspoň 25 %)', () => {
    const problems: string[] = [];
    const others = otherIconGrids();
    for (const icon of ACTION_ICONS) {
      const grid = actionGridOf(icon);
      if (typeof grid === 'string') {
        problems.push(grid);
        continue;
      }
      for (const other of others) {
        if (typeof other === 'string') {
          problems.push(other);
          continue;
        }
        const share = differenceShare(grid, other);
        if (share < MIN_DIFFERENCE) {
          problems.push(`${icon.name} a ${other.name}: rozdíl ${(share * 100).toFixed(1)} %`);
        }
      }
    }
    expect(limited([...new Set(problems)])).toEqual([]);
  });

  it('nové ikony se nepodobají ani sobě navzájem, koš a koště se liší aspoň o 25 %', () => {
    const problems: string[] = [];
    const grids = ACTION_ICONS.map(actionGridOf);
    for (const [first, firstGrid] of grids.entries()) {
      for (const secondGrid of grids.slice(first + 1)) {
        if (typeof firstGrid === 'string' || typeof secondGrid === 'string') {
          problems.push(typeof firstGrid === 'string' ? firstGrid : String(secondGrid));
          continue;
        }
        const share = differenceShare(firstGrid, secondGrid);
        if (share < MIN_DIFFERENCE) {
          problems.push(
            `${firstGrid.name} a ${secondGrid.name}: rozdíl ${(share * 100).toFixed(1)} %`,
          );
        }
      }
    }
    expect(limited([...new Set(problems)])).toEqual([]);
  });
});

describe('#153 AC4: ikony jsou malé soubory WebP uložené u hry', () => {
  it('každá ikona je WebP s průhledností a má nejvýš 8 192 B', () => {
    const problems: string[] = [];
    for (const icon of ACTION_ICONS) {
      const bytes = webpBytesOf(icon.file);
      if (bytes === null) {
        problems.push(`${icon.name}: chybí ${ICON_FOLDER}/${icon.file}`);
        continue;
      }
      if (bytes.length > MAX_ACTION_ICON_BYTES) {
        problems.push(`${icon.name}: ${bytes.length} B, nejvýš ${MAX_ACTION_ICON_BYTES} B`);
      }
      if (asciiOf(bytes, 0, 4) + asciiOf(bytes, 8, 4) !== 'RIFFWEBP') {
        problems.push(`${icon.name}: není WebP`);
      } else if (asciiOf(bytes, 12, 4) !== 'VP8X' || ((bytes[20] ?? 0) & 0x10) !== 0x10) {
        problems.push(`${icon.name}: WebP bez průhlednosti (ikona leží na barevném podkladu)`);
      }
    }
    expect(limited(problems)).toEqual([]);
  });

  it('původ každé ikony je v public/licence.txt jako obrázek ze služby ElevenLabs', () => {
    const paragraphs = LICENCE_TEXT.split(/\n\s*\n/);
    for (const icon of ACTION_ICONS) {
      const paragraph = paragraphs.find((text) => text.includes(icon.file));
      expect(paragraph, `${icon.name}: odstavec s ${icon.file}`).toBeDefined();
      expect(paragraph ?? '', `${icon.name}: služba`).toMatch(/ElevenLabs/);
      expect(paragraph ?? '', `${icon.name}: složka hry`).toContain(ICON_FOLDER);
    }
  });
});
