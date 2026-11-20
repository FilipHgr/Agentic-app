import { describe, expect, it } from 'vitest';

import { handleSymbol } from '../../../src/games/coloring/logic/coloringLayout';
import type { LayoutRect } from '../../../src/games/coloring/logic/coloringLayout';
import { quickToolColorDotFill } from '../../../src/games/coloring/logic/quickTools';
import type { SavedColoring } from '../../../src/games/coloring/logic/savedPicture';
import { COLOR_BUTTON_STYLE, HANDLE_STYLE } from '../../../src/games/coloring/logic/theme';
import { HANDLE_ICON_FILE, toolIconAsset } from '../../../src/games/coloring/logic/toolIcons';
import type { HandleColorDotFill } from '../../../src/games/coloring/logic/toolIcons';
import type { LineSize, ToolId } from '../../../src/games/coloring/logic/toolPanel';
import { BLUE, contrastRatio } from '../../../src/shared/logic/theme';
import { MIN_CONTRAST, MIN_CONTRASTING_EDGE, compositeOn } from './actionIconHelpers';
import { coloringCases } from './coloringLayoutScenes';
import { ALL_SIZES, SIZE_NAMES } from './lineSizeHelpers';
import { firstButton, tapFirstButton, tapQuickEraser } from './quickToolsHelpers';
import { RecordingStorage, openOn, twoHalves } from './savedPictureHelpers';
import {
  ICON_FOLDER,
  LICENCE_TEXT,
  RAINBOW_HEXES,
  TOOLS,
  TOOL_NAMES,
  externalReferences,
  hexOf,
  iconFolderFiles,
  iconSvgOf,
  iconSvgOfFile,
  sameHex,
} from './toolIconHelpers';
import { COLOR_TOOLS, PINK, YELLOW, giveColor, pickTool } from './toolColorsHelpers';
import { MASK_SAMPLES, maskOfSvg } from './toolIconMaskHelpers';

/**
 * Testy k #164 (úchyt panelu se neplete s tlačítkem nástroje) z pohledu
 * hráče. Nahrazují testy, které hlídaly ikonu vybraného nástroje a kolečko
 * barvy v úchytu (#106 AC6, #91 AC1): od #164 má úchyt jeden stálý symbol
 * panelu, paletu 🎨 ze sady Noto Emoji (AC1), běžný okraj nevybraného
 * tlačítka (AC2) a šipku, velikost, místo, ťuknutí, tón a chování beze
 * změny (AC3, testy #96, #105 a #130 běží dál). Kolečko barvy velké podle
 * velikosti čáry je na prvním tlačítku rychlého přepínání (AC4; rozložení
 * v `quickToolColorDotLayoutRules.test.ts`). AC5 platí jen pro symbol
 * (rozhodnutí koordinátora): okraj úchytu je běžný okraj nevybraného
 * tlačítka podle AC2; kolem palety kreslí hra tmavý obrys
 * (`HANDLE_STYLE.symbolOutlineColor`, `symbolOutlineCss`).
 *
 * Měření AC5 jako u ikon tlačítek z #153 AC2: okrajový bod symbolu je
 * neprůhledný bod, jehož soused (nahoře, dole, vlevo, vpravo) je průhledný;
 * aspoň 90 % okrajových bodů musí mít po složení na podklad úchytu
 * kontrast aspoň 3 : 1 proti podkladu. Symbol je tu paleta (maska ze SVG
 * v repozitáři, `maskOfSvg`) rozšířená o obrys o poloměru
 * `symbolOutlineCss` v CSS px při skutečné velikosti symbolu v každém okně.
 * Okrajový bod mimo paletu má barvu obrysu; okrajový bod uvnitř palety
 * (kde by obrys chyběl) test počítá jako bod bez kontrastu.
 *
 * Rozhraní:
 * - `HANDLE_ICON_FILE` (`toolIcons.ts`) jméno souboru symbolu ve složce ikon,
 * - `handleSymbol(handle)` (`coloringLayout.ts`) čtverec, do kterého úchyt
 *   symbol kreslí; jiný vstup než místo úchytu nemá,
 * - `quickToolColorDotFill(view, size)` (`quickTools.ts`) čím je vyplněné
 *   kolečko na prvním tlačítku; `view` je `game.quickDrawingTool()`.
 */

/** Ikony Noto v sadě `@iconify-json/noto` mají plochu 128 × 128. */
const NOTO_VIEW_BOX = /viewBox\s*=\s*["']0 0 128 128["']/;

/** Nejvýš tolik bajtů smí mít ikona (stejně jako ikony nástrojů z #106). */
const MAX_ICON_BYTES = 20_000;

/** Kreslicí nástroje: smí být na prvním tlačítku (každý kromě gumy). */
const DRAWING_TOOLS: readonly ToolId[] = TOOLS.filter((tool) => tool !== 'eraser');

/** Strany symbolu v CSS px ve všech oknech Omalovánek, každá jednou. */
function symbolSidesCss(): number[] {
  const sides = coloringCases().map(
    ({ layout, area }) => handleSymbol(layout.handle).width * area.scale,
  );
  return [...new Set(sides.map((side) => Math.round(side * 100) / 100))];
}

/**
 * Okraj symbolu (paleta s obrysem o šířce `outlineSamples` vzorků masky):
 * díl okrajových bodů mimo paletu (barva obrysu) a uvnitř palety.
 */
function outlinedEdge(outlineSamples: number): { outline: number; palette: number } {
  const mask = maskOfSvg(iconSvgOfFile(HANDLE_ICON_FILE));
  const samples = mask.samples;
  const pad = Math.ceil(outlineSamples) + 2;
  const size = samples + 2 * pad;
  const isPalette = (row: number, column: number): boolean =>
    row >= 0 && column >= 0 && row < samples && column < samples
      ? mask.opaque[row * samples + column] === 1
      : false;
  const filled = new Uint8Array(size * size);
  const disk: Array<[number, number]> = [];
  const reach = Math.ceil(outlineSamples);
  for (let dy = -reach; dy <= reach; dy += 1) {
    for (let dx = -reach; dx <= reach; dx += 1) {
      if (Math.hypot(dx, dy) <= outlineSamples) {
        disk.push([dy, dx]);
      }
    }
  }
  for (let row = 0; row < samples; row += 1) {
    for (let column = 0; column < samples; column += 1) {
      if (!isPalette(row, column)) {
        continue;
      }
      filled[(row + pad) * size + column + pad] = 1;
      const onBorder =
        !isPalette(row - 1, column) ||
        !isPalette(row + 1, column) ||
        !isPalette(row, column - 1) ||
        !isPalette(row, column + 1);
      if (onBorder) {
        for (const [dy, dx] of disk) {
          filled[(row + pad + dy) * size + column + pad + dx] = 1;
        }
      }
    }
  }
  const at = (row: number, column: number): boolean =>
    row >= 0 && column >= 0 && row < size && column < size && filled[row * size + column] === 1;
  let outline = 0;
  let palette = 0;
  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column < size; column += 1) {
      const edge =
        at(row, column) &&
        (!at(row - 1, column) ||
          !at(row + 1, column) ||
          !at(row, column - 1) ||
          !at(row, column + 1));
      if (!edge) {
        continue;
      }
      if (isPalette(row - pad, column - pad)) {
        palette += 1;
      } else {
        outline += 1;
      }
    }
  }
  const total = outline + palette;
  return { outline: outline / total, palette: palette / total };
}

/** Hra, kterou profil už otevřel: panel začíná zavřený (#130). */
function returningGame(): SavedColoring {
  const storage = new RecordingStorage();
  openOn(storage, twoHalves()).suspend();
  return openOn(storage, twoHalves());
}

/** Co úchyt ukazuje v jednom okně: soubor symbolu a kam ho kreslí. */
function handleLook(handle: LayoutRect): { file: string; symbol: LayoutRect } {
  return { file: HANDLE_ICON_FILE, symbol: handleSymbol(handle) };
}

/** Kolečko na prvním tlačítku: malovací nástroj ve své barvě, duha duhové. */
function expectedDot(tool: ToolId, color: number | null): HandleColorDotFill {
  if (tool === 'rainbow') {
    return { kind: 'rainbow', hexes: RAINBOW_HEXES };
  }
  return color === null ? { kind: 'eraser' } : { kind: 'color', hex: hexOf(color) };
}

describe('#164 AC1: úchyt má jeden stálý symbol panelu, paletu ze sady Noto', () => {
  it('úchyt ukazuje paletu 🎨 uloženou jako SVG ve složce ikon hry', () => {
    expect(HANDLE_ICON_FILE).toBe('artist-palette.svg');
    expect(iconFolderFiles(), 'soubor ve složce ikon').toContain(
      `${ICON_FOLDER}/${HANDLE_ICON_FILE}`,
    );
  });

  it('paleta je obrázek ze sady Noto bez textu, skriptu, vložených obrázků a odkazů ven', () => {
    const svg = iconSvgOfFile(HANDLE_ICON_FILE);
    expect(svg, 'soubor začíná značkou <svg>').toMatch(/^\s*<svg[\s>]/);
    expect(svg, 'plocha 0 0 128 128 jako v sadě Noto').toMatch(NOTO_VIEW_BOX);
    for (const tag of ['text', 'script', 'image', 'foreignObject', 'style']) {
      expect(new RegExp(`<${tag}[\\s>/]`, 'i').test(svg), `obsahuje <${tag}>`).toBe(false);
    }
    expect(/\son\w+\s*=/i.test(svg), 'obsluha události (on…)').toBe(false);
    expect(externalReferences(svg), 'odkazy mimo soubor').toEqual([]);
    expect(new TextEncoder().encode(svg).length, 'velikost v B').toBeLessThanOrEqual(
      MAX_ICON_BYTES,
    );
  });

  it('paleta se neplete s žádným nástrojem: je jiná než ikona každého nástroje i gumy', () => {
    const svg = iconSvgOfFile(HANDLE_ICON_FILE);
    for (const tool of TOOLS) {
      expect(toolIconAsset(tool).file, TOOL_NAMES[tool]).not.toBe(HANDLE_ICON_FILE);
      expect(iconSvgOf(tool), `${TOOL_NAMES[tool]}: jiný obrázek`).not.toBe(svg);
    }
  });

  it('licence uvádí paletu ze sady Noto Emoji, autora Google a Apache-2.0', () => {
    const paragraph = LICENCE_TEXT.split(/\n\s*\n/).find((text) => text.includes('artist-palette'));
    expect(paragraph, 'odstavec s paletou').toBeDefined();
    expect(paragraph, 'jméno sady').toMatch(/Noto Emoji/);
    expect(paragraph, 'autor').toMatch(/Google/);
    expect(paragraph, 'licence Apache 2.0').toMatch(/Apache License, Version 2\.0/);
    expect(paragraph, 'složka s ikonami').toContain(ICON_FOLDER);
  });

  it('po výběru nástroje, barvy, tloušťky i gumy ukazuje úchyt pořád stejnou paletu na stejném místě', () => {
    const { layout } = coloringCases()[0] ?? { layout: null };
    if (layout === null) {
      throw new Error('chybí okno pro rozložení');
    }
    const before = handleLook(layout.handle);
    const game = returningGame();
    const shown: string[] = [];
    const steps: Array<[string, () => void]> = [
      ...TOOLS.map((tool): [string, () => void] => [TOOL_NAMES[tool], () => pickTool(game, tool)]),
      ['štětec v růžové', () => giveColor(game, 'brush', PINK)],
      ['fix ve žluté', () => giveColor(game, 'marker', YELLOW)],
      ...ALL_SIZES.map((size): [string, () => void] => [
        `tloušťka ${SIZE_NAMES[size]}`,
        () => game.tapLineSize(size),
      ]),
      ['guma v pruhu', () => tapQuickEraser(game)],
      ['zpět na nástroj v pruhu', () => tapFirstButton(game)],
    ];
    for (const [what, step] of steps) {
      step();
      shown.push(JSON.stringify([firstButton(game), game.lineSize(), game.selectedTool()]));
      expect(handleLook(layout.handle), `${what}: úchyt`).toEqual(before);
    }
    expect(new Set(shown).size, 'kroky opravdu měnily výběr').toBeGreaterThan(TOOLS.length);
  });

  it('symbol má ve všech oknech střed jako dřívější ikona nástroje (vodorovně uprostřed, ve 35 % výšky) a 0,45 strany', () => {
    for (const { layout, scene } of coloringCases()) {
      const { handle } = layout;
      const side = Math.min(handle.width, handle.height) * 0.45;
      const symbol = handleSymbol(handle);
      expect(symbol.width, `${scene.label}: šířka`).toBeCloseTo(side, 6);
      expect(symbol.height, `${scene.label}: výška`).toBeCloseTo(side, 6);
      expect(symbol.left + side / 2, `${scene.label}: střed vodorovně`).toBeCloseTo(
        handle.left + handle.width / 2,
        6,
      );
      expect(symbol.top + side / 2, `${scene.label}: střed svisle`).toBeCloseTo(
        handle.top + handle.height * 0.35,
        6,
      );
    }
  });
});

describe('#164 AC5: symbol úchytu je dobře vidět proti podkladu', () => {
  it('obrys palety má proti podkladu úchytu kontrast aspoň 3 : 1', () => {
    const background = HANDLE_STYLE.background;
    const color = compositeOn(HANDLE_STYLE.symbolOutlineColor, 1, background);
    expect(contrastRatio(color, background)).toBeGreaterThanOrEqual(MIN_CONTRAST);
  });

  it('aspoň 90 % okraje symbolu má po složení na podklad úchytu kontrast aspoň 3 : 1 ve všech oknech', () => {
    const background = HANDLE_STYLE.background;
    const outlineContrasts =
      contrastRatio(compositeOn(HANDLE_STYLE.symbolOutlineColor, 1, background), background) >=
      MIN_CONTRAST;
    for (const side of symbolSidesCss()) {
      const outlineSamples = (HANDLE_STYLE.symbolOutlineCss * MASK_SAMPLES) / side;
      const edge = outlinedEdge(outlineSamples);
      const share = outlineContrasts ? edge.outline : 0;
      expect(share, `symbol ${side} CSS px: díl okraje s kontrastem 3 : 1`).toBeGreaterThanOrEqual(
        MIN_CONTRASTING_EDGE,
      );
    }
  });
});

describe('#164 AC2: úchyt nemá silný modrý okraj „vybráno“', () => {
  it('úchyt má běžný okraj nevybraného tlačítka, stejný jako nevybraný nástroj v panelu', () => {
    expect(sameHex(HANDLE_STYLE.borderColor, COLOR_BUTTON_STYLE.borderColor), 'barva okraje').toBe(
      true,
    );
    expect(HANDLE_STYLE.borderWidthCss, 'šířka okraje').toBe(COLOR_BUTTON_STYLE.borderWidthCss);
  });

  it('okraj úchytu není silný modrý okraj vybraného nástroje', () => {
    expect(sameHex(HANDLE_STYLE.borderColor, COLOR_BUTTON_STYLE.selectedBorderColor)).toBe(false);
    expect(HANDLE_STYLE.borderWidthCss).toBeLessThan(COLOR_BUTTON_STYLE.selectedBorderWidthCss);
  });
});

describe('#164 AC3: šipka a podklad úchytu zůstávají', () => {
  it('úchyt má dál světle modrý podklad a zaoblení tlačítek a modrou šipku', () => {
    expect(sameHex(HANDLE_STYLE.background, '#E5F0FF'), 'podklad').toBe(true);
    expect(HANDLE_STYLE.cornerRadiusShare, 'zaoblení').toBe(COLOR_BUTTON_STYLE.cornerRadiusShare);
    expect(sameHex(HANDLE_STYLE.arrowColor, BLUE), 'šipka').toBe(true);
  });
});

describe('#164 AC4: kolečko barvy z úchytu ukazuje první tlačítko rychlého přepínání', () => {
  it('malovací nástroj na prvním tlačítku má kolečko své barvy', () => {
    for (const tool of COLOR_TOOLS) {
      const game = returningGame();
      giveColor(game, tool, PINK);

      const fill = quickToolColorDotFill(game.quickDrawingTool(), game.lineSize());

      expect(fill, TOOL_NAMES[tool]).toEqual({ kind: 'color', hex: hexOf(PINK) });
    }
  });

  it('duha na prvním tlačítku má duhové kolečko jako dřív v úchytu', () => {
    const game = returningGame();
    pickTool(game, 'rainbow');

    expect(quickToolColorDotFill(game.quickDrawingTool(), game.lineSize())).toEqual({
      kind: 'rainbow',
      hexes: RAINBOW_HEXES,
    });
  });

  it('s vybranou gumou ukazuje první tlačítko kolečko nástroje, kterým se kreslilo před gumou', () => {
    for (const tool of DRAWING_TOOLS) {
      const game = returningGame();
      pickTool(game, tool);
      const color = game.quickDrawingTool().color;
      tapQuickEraser(game);

      expect(game.selectedTool(), `${TOOL_NAMES[tool]}: guma vybraná`).toBe('eraser');
      expect(
        quickToolColorDotFill(game.quickDrawingTool(), game.lineSize()),
        `${TOOL_NAMES[tool]}, pak guma`,
      ).toEqual(expectedDot(tool, color));
    }
  });

  it('kolečko na prvním tlačítku se po změně tloušťky nepřebarví, mění se jen jeho velikost', () => {
    const sizes: readonly LineSize[] = ALL_SIZES;
    for (const tool of DRAWING_TOOLS) {
      const game = returningGame();
      pickTool(game, tool);
      const fills = sizes.map((size) => {
        game.tapLineSize(size);
        expect(game.lineSize(), `${TOOL_NAMES[tool]}: tloušťka ${SIZE_NAMES[size]}`).toBe(size);
        return quickToolColorDotFill(game.quickDrawingTool(), game.lineSize());
      });
      expect(new Set(fills.map((fill) => JSON.stringify(fill))).size, TOOL_NAMES[tool]).toBe(1);
    }
  });
});
