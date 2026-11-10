import { describe, expect, it } from 'vitest';

import { PALETTE } from '../../../src/games/coloring/logic/palette';
import { HANDLE_COLOR_DOT_STYLE, HANDLE_STYLE } from '../../../src/games/coloring/logic/theme';
import { handleColorDotFill } from '../../../src/games/coloring/logic/toolIcons';
import { contrastRatio } from '../../../src/shared/logic/theme';
import {
  COLOR_TOOLS,
  HANDLE_BACKGROUND,
  MIN_CONTRAST,
  MIN_LINE_CSS,
  MIN_RIM_CSS,
  RAINBOW_HEXES,
  TOOL_NAMES,
  WHITE,
  hexOf,
  sameHex,
} from './toolIconHelpers';

/**
 * Testy kolečka barvy v úchytu k #106 v novém znění (vybraná barva):
 * ikony zůstávají v barvách autora a vybranou barvu ukazuje barevné
 * kolečko v rohu úchytu s bílým lemem a šedou linkou. U gumy je bílé
 * a čárkované, u duhového štětce duhové. Z dřívějších AC3 (kontrast)
 * a AC6 (vybraná barva v ikoně) zůstává, že kolečko je vidět i ve
 * světlých barvách a že ukazuje vybranou barvu. Velikost a místo
 * kolečka v rozložení jsou v `toolIconLayoutRules.test.ts`.
 *
 * Navržené rozhraní:
 * - `src/games/coloring/logic/toolIcons.ts`:
 *   `type HandleColorDotFill =
 *      | { readonly kind: 'color'; readonly hex: string }
 *      | { readonly kind: 'eraser' }
 *      | { readonly kind: 'rainbow'; readonly hexes: readonly string[] }`,
 *   `handleColorDotFill(view: HandleView): HandleColorDotFill` čím je
 *   kolečko v úchytu vyplněné (malovací nástroj barvou `view.color` z palety,
 *   guma bíle a čárkovaně, duha odstíny duhy v pořadí #97),
 * - `src/games/coloring/logic/theme.ts`:
 *   `HANDLE_COLOR_DOT_STYLE = { rimColor: '#FFFFFF', rimCss, lineColor, lineCss,
 *    eraserFill: '#FFFFFF', eraserDashCss }`: bílý lem a šedá linka kolem
 *   výplně (v CSS px, kreslí se vně výplně), bílá výplň gumy a délka čárky
 *   její čárkované linky.
 */

const YELLOW = 2;

/** Světlé barvy palety, které na pozadí úchytu samy skoro nejsou vidět. */
const LIGHT_COLORS = PALETTE.flatMap((color, index) =>
  contrastRatio(color.hex, HANDLE_BACKGROUND) < MIN_CONTRAST ? [index] : [],
);

/** Je barva šedá (kanály R, G, B skoro stejné, ne bílá ani černá)? */
function isGray(hex: string): boolean {
  const channels = [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16));
  const spread = Math.max(...channels) - Math.min(...channels);
  const average = channels.reduce((sum, value) => sum + value, 0) / channels.length;
  return spread <= 16 && average > 40 && average < 215;
}

describe('#106 vybraná barva: kolečko v úchytu ukazuje barvu nástroje', () => {
  it('u malovacího nástroje je kolečko ve vybrané barvě palety, v každé z 12 barev jiné', () => {
    for (const tool of COLOR_TOOLS) {
      const hexes = PALETTE.map((_, color) => {
        const fill = handleColorDotFill({ tool, color, size: 'medium' });
        expect(fill, `${TOOL_NAMES[tool]}, barva ${color}`).toEqual({
          kind: 'color',
          hex: hexOf(color),
        });
        return fill.kind === 'color' ? fill.hex.toUpperCase() : '';
      });
      expect(new Set(hexes).size, `${TOOL_NAMES[tool]}: 12 různých koleček`).toBe(PALETTE.length);
    }
  });

  it('kolečko nezávisí na velikosti čáry, jen na nástroji a barvě', () => {
    for (const tool of COLOR_TOOLS) {
      const fills = (['small', 'medium', 'large'] as const).map((size) =>
        handleColorDotFill({ tool, color: YELLOW, size }),
      );
      expect(fills[1], `${TOOL_NAMES[tool]}: malá a střední`).toEqual(fills[0]);
      expect(fills[2], `${TOOL_NAMES[tool]}: velká a střední`).toEqual(fills[0]);
    }
  });

  it('u gumy je kolečko bílé a čárkované, bez vybrané barvy', () => {
    expect(handleColorDotFill({ tool: 'eraser', color: null, size: 'medium' })).toEqual({
      kind: 'eraser',
    });
    expect(sameHex(HANDLE_COLOR_DOT_STYLE.eraserFill, WHITE), 'výplň gumy je bílá').toBe(true);
    expect(HANDLE_COLOR_DOT_STYLE.eraserDashCss, 'linka gumy je čárkovaná').toBeGreaterThan(0);
  });

  it('u duhového štětce je kolečko duhové, ve všech 6 barvách duhy', () => {
    const fill = handleColorDotFill({ tool: 'rainbow', color: null, size: 'medium' });
    expect(fill.kind, 'duhová výplň').toBe('rainbow');
    const hexes = fill.kind === 'rainbow' ? fill.hexes.map((hex: string) => hex.toUpperCase()) : [];
    expect(hexes, 'barvy duhy v pořadí #97').toEqual(RAINBOW_HEXES.map((hex) => hex.toUpperCase()));
  });
});

describe('#106 vybraná barva: kolečko je vidět v každé barvě díky lemu', () => {
  it('kolečko má bílý lem a šedou linku', () => {
    expect(sameHex(HANDLE_COLOR_DOT_STYLE.rimColor, WHITE), 'lem je bílý').toBe(true);
    expect(HANDLE_COLOR_DOT_STYLE.rimCss, 'lem aspoň 2 px').toBeGreaterThanOrEqual(MIN_RIM_CSS);
    expect(
      isGray(HANDLE_COLOR_DOT_STYLE.lineColor),
      `linka ${HANDLE_COLOR_DOT_STYLE.lineColor} je šedá`,
    ).toBe(true);
    expect(HANDLE_COLOR_DOT_STYLE.lineCss, 'linka aspoň 1 px').toBeGreaterThanOrEqual(MIN_LINE_CSS);
  });

  it('šedá linka je vidět na pozadí úchytu i vedle bílého lemu (kontrast aspoň 3 : 1)', () => {
    expect(sameHex(HANDLE_STYLE.background, HANDLE_BACKGROUND), 'pozadí úchytu').toBe(true);
    const line = HANDLE_COLOR_DOT_STYLE.lineColor;
    expect(contrastRatio(line, HANDLE_BACKGROUND), 'linka na pozadí úchytu').toBeGreaterThanOrEqual(
      MIN_CONTRAST,
    );
    expect(
      contrastRatio(line, HANDLE_COLOR_DOT_STYLE.rimColor),
      'linka vedle bílého lemu',
    ).toBeGreaterThanOrEqual(MIN_CONTRAST);
  });

  it('žluté kolečko, ostatní světlé barvy i bílé kolečko gumy obepíná linka s kontrastem 3 : 1', () => {
    expect(LIGHT_COLORS, 'žlutá je mezi světlými barvami').toContain(YELLOW);
    const line = HANDLE_COLOR_DOT_STYLE.lineColor;
    const fills = [
      ...LIGHT_COLORS.map((color) => ({ name: PALETTE[color]?.id ?? '', hex: hexOf(color) })),
      { name: 'guma (bílá)', hex: HANDLE_COLOR_DOT_STYLE.eraserFill },
    ];
    for (const fill of fills) {
      // Výplň sama na pozadí nestačí, hranu kolečka dělá šedá linka vně bílého lemu.
      expect(
        Math.max(
          contrastRatio(fill.hex, HANDLE_BACKGROUND),
          contrastRatio(line, HANDLE_BACKGROUND),
        ),
        `${fill.name}: hrana kolečka na pozadí úchytu`,
      ).toBeGreaterThanOrEqual(MIN_CONTRAST);
    }
  });
});
