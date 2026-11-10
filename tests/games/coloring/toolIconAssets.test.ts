import { describe, expect, it } from 'vitest';

import {
  BOOK_ICON_FILE,
  CAMERA_ICON_FILE,
  TRASH_ICON_FILE,
  toolIconAsset,
} from '../../../src/games/coloring/logic/toolIcons';
import {
  ICON_FOLDER,
  LICENCE_TEXT,
  NOTO_EMOJI,
  TOOLS,
  TOOL_NAMES,
  externalReferences,
  iconFileExists,
  iconPathOf,
  iconSvgOf,
  limited,
  iconFolderFiles,
} from './toolIconHelpers';

/**
 * Testy ikon nástrojů k #106 v novém znění po připomínce vlastníka
 * (komentář „Připomínka vlastníka po předání“): AC1 ikony všech 10
 * nástrojů jsou z Google Noto Emoji, SVG jsou v repozitáři, licence je
 * v `public/licence.txt` a nic se nestahuje za běhu. Nahrazují dřívější
 * testy vlastních kreseb stylu D (`toolIconShapes.test.ts`: AC1 tvary bez
 * písmen, AC3 kontrast, AC4 odlišnost, AC5 jednoduchost). Z AC3 a AC4
 * zůstává podle nového znění „každý nástroj má jinou ikonu“ (tady)
 * a „kolečko barvy je vidět“ (`toolIconColorDot.test.ts`). Rozložení
 * (AC2) je v `toolIconLayoutRules.test.ts`, úchyt po ťuknutí (AC6)
 * v `toolIconHandle.test.ts`.
 *
 * Navržené rozhraní (`src/games/coloring/logic/toolIcons.ts`, čistý
 * TypeScript bez Phaseru):
 * - `type NotoEmojiName = 'paintbrush' | 'eraser' | 'pen' | 'pencil' | 'rainbow'
 *    | 'star' | 'bubbles' | 'barber-pole' | 'sparkles' | 'splatter'`,
 * - `interface ToolIconAsset { readonly emoji: NotoEmojiName; readonly file: string }`,
 *   `file` je jméno souboru (např. `paintbrush.svg`) ve složce
 *   `src/games/coloring/icons/`,
 * - `toolIconAsset(tool: ToolId): ToolIconAsset`. Ikona nezávisí na barvě:
 *   panel, hlavička kroku barev i úchyt kreslí pro nástroj stejný soubor,
 *   jen jinak velký. Scéna soubory načte jako součást balíčku hry (Vite
 *   import z `src/games/coloring/icons/`, např. `import.meta.glob` s `?url`),
 *   ne z cizího serveru.
 */

/** Ikony Noto v sadě `@iconify-json/noto` mají plochu 128 × 128. */
const NOTO_VIEW_BOX = /viewBox\s*=\s*["']0 0 128 128["']/;

/** Ikona nesmí být zbytečně velký asset (CLAUDE.md, plynulost); Noto ikony mají do 5 kB. */
const MAX_ICON_BYTES = 20_000;

describe('#106 AC1: každý nástroj má ikonu z hotové sady Google Noto Emoji', () => {
  it('každý z 10 nástrojů má ikonu podle schváleného výběru emoji', () => {
    expect(TOOLS, 'v panelu je 10 nástrojů').toHaveLength(10);
    for (const tool of TOOLS) {
      expect(toolIconAsset(tool), TOOL_NAMES[tool]).toEqual({
        emoji: NOTO_EMOJI[tool],
        file: `${NOTO_EMOJI[tool]}.svg`,
      });
    }
  });

  it('každý nástroj má jinou ikonu, žádné dva nástroje nesdílejí obrázek', () => {
    const emojis = TOOLS.map((tool) => toolIconAsset(tool).emoji);
    expect(new Set(emojis).size, `jména emoji ${emojis.join(', ')}`).toBe(TOOLS.length);
    const files = TOOLS.map((tool) => toolIconAsset(tool).file);
    expect(new Set(files).size, `soubory ${files.join(', ')}`).toBe(TOOLS.length);
    const contents = TOOLS.map((tool) => iconSvgOf(tool));
    expect(new Set(contents).size, 'obsah SVG souborů je u každého nástroje jiný').toBe(
      TOOLS.length,
    );
  });

  it('SVG každé ikony je uložené v repozitáři u hry a navíc tam žádné nejsou', () => {
    const missing = TOOLS.filter((tool) => !iconFileExists(tool)).map(
      (tool) => `${TOOL_NAMES[tool]}: chybí ${iconPathOf(tool)}`,
    );
    expect(limited(missing)).toEqual([]);
    // Upraveno k #126: ve složce jsou navíc ikony fotoaparátu a knihy (cameraBookIcons.test.ts),
    // k #129 ikona koše u velkého obrázku z alba.
    const buttonIcons = [CAMERA_ICON_FILE, BOOK_ICON_FILE, TRASH_ICON_FILE].map(
      (file) => `${ICON_FOLDER}/${file}`,
    );
    expect(iconFolderFiles(), `soubory ve složce ${ICON_FOLDER}`).toEqual(
      [...TOOLS.map((tool) => iconPathOf(tool)), ...buttonIcons].sort(),
    );
  });

  it('ikony jsou obrázky ze sady Noto bez textu, skriptu a vložených obrázků', () => {
    const problems: string[] = [];
    for (const tool of TOOLS) {
      const svg = iconSvgOf(tool);
      const name = TOOL_NAMES[tool];
      if (!/^\s*(<\?xml[^>]*\?>\s*)?<svg[\s>]/.test(svg)) {
        problems.push(`${name}: soubor nezačíná značkou <svg>`);
      }
      if (!NOTO_VIEW_BOX.test(svg)) {
        problems.push(`${name}: plocha není 0 0 128 128 jako v sadě Noto`);
      }
      for (const tag of ['text', 'script', 'image', 'foreignObject', 'style']) {
        if (new RegExp(`<${tag}[\\s>/]`, 'i').test(svg)) {
          problems.push(`${name}: obsahuje <${tag}>`);
        }
      }
      if (/\son\w+\s*=/i.test(svg)) {
        problems.push(`${name}: obsahuje obsluhu události (on…)`);
      }
      const bytes = new TextEncoder().encode(svg).length;
      if (bytes > MAX_ICON_BYTES) {
        problems.push(`${name}: ${bytes} B, nejvýš ${MAX_ICON_BYTES} B`);
      }
    }
    expect(limited(problems)).toEqual([]);
  });
});

describe('#106 AC1: ikony se nikdy nestahují za běhu', () => {
  it('ikona nástroje je soubor ve složce hry, ne adresa na cizím serveru', () => {
    for (const tool of TOOLS) {
      const { file } = toolIconAsset(tool);
      expect(file, `${TOOL_NAMES[tool]}: jen jméno souboru .svg`).toMatch(/^[a-z-]+\.svg$/);
      expect(iconPathOf(tool).startsWith(`${ICON_FOLDER}/`), TOOL_NAMES[tool]).toBe(true);
    }
  });

  it('SVG ikon neodkazují na nic mimo soubor (žádné adresy, fonty ani CDN)', () => {
    const problems = TOOLS.flatMap((tool) =>
      externalReferences(iconSvgOf(tool)).map((reference) => `${TOOL_NAMES[tool]}: ${reference}`),
    );
    expect(limited(problems)).toEqual([]);
  });
});

describe('#106 AC1: licence ikon je uvedená v public/licence.txt', () => {
  it('licence uvádí Google Noto Emoji, autora Google, Apache-2.0 a kde ikony ve hře jsou', () => {
    const licence = LICENCE_TEXT;
    expect(licence, 'jméno sady').toMatch(/Noto Emoji/);
    expect(licence, 'autor').toMatch(/Google/);
    expect(licence, 'licence Apache 2.0').toMatch(/Apache[- ]?(License,? )?(Version )?2\.0/i);
    expect(licence, 'odkaz na text licence').toMatch(/apache\.org\/licenses\/LICENSE-2\.0/);
    expect(licence, 'složka s ikonami').toContain(ICON_FOLDER);
  });
});
