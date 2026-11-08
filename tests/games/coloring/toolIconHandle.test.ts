import { describe, expect, it } from 'vitest';

import { PALETTE } from '../../../src/games/coloring/logic/palette';
import type { SavedColoring } from '../../../src/games/coloring/logic/savedPicture';
import { handleColorDotFill, toolIconAsset } from '../../../src/games/coloring/logic/toolIcons';
import type {
  HandleColorDotFill,
  ToolIconAsset,
} from '../../../src/games/coloring/logic/toolIcons';
import { usesSelectedColor } from '../../../src/games/coloring/logic/toolPanel';
import type { ToolId } from '../../../src/games/coloring/logic/toolPanel';
import type { Tone } from '../../../src/shared/audio/tonePlayer';
import { choose, slotOf } from './drawingToolHelpers';
import { RecordingStorage, openOn, twoHalves } from './savedPictureHelpers';
import {
  COLOR_TOOLS,
  NOTO_EMOJI,
  RAINBOW_HEXES,
  TOOLS,
  TOOL_NAMES,
  hexOf,
} from './toolIconHelpers';
import {
  DEFAULT_TOOL_COLORS,
  defaultsWithBrush,
  giveColor,
  isColorTool,
  pickTool,
} from './toolColorsHelpers';

/**
 * Testy chování k #106 AC6 (úchyt vždy ukazuje aktuální nástroj a barvu)
 * z pohledu hráče, v novém znění: ikona je hotové SVG Noto podle nástroje
 * a barvu ukazuje kolečko v rohu úchytu. Co úchyt ukazuje, je
 * `game.handleView()` (#96 AC5); ikonu z něj dává `toolIconAsset(view.tool)`
 * a kolečko `handleColorDotFill(view)` (navržené rozhraní
 * v `toolIconAssets.test.ts` a `toolIconColorDot.test.ts`). Scéna po
 * každém ťuknutí překreslí úchyt hned v obsluze ťuknutí. „Hned“ se tu
 * ověřuje tak, že správnou ikonu a kolečko jde přečíst ihned po volání
 * `tapTool`, `tapColor` nebo `tapRecentColor`, bez čekání; že je scéna
 * nakreslí ve stejném snímku, je ruční kontrola.
 *
 * Jedno „otevření hry“ je `openOn(…)` nad úložištěm hry profilu.
 */

const RED = 0;
const YELLOW = 2;
const BLUE = 4;
const BLACK = 7;
const PINK = 8;
const LIGHT_BLUE = 11;

/** Co úchyt právě ukazuje: soubor ikony a výplň kolečka barvy. */
interface HandleLook {
  readonly icon: ToolIconAsset;
  readonly dot: HandleColorDotFill;
}

function handleLook(game: SavedColoring): HandleLook {
  const view = game.handleView();
  return { icon: toolIconAsset(view.tool), dot: handleColorDotFill(view) };
}

/** Kolečko, které má úchyt ukázat: vybraná barva, u gumy bílé čárkované, u duhy duha. */
function expectedDot(tool: ToolId, color: number): HandleColorDotFill {
  if (tool === 'eraser') {
    return { kind: 'eraser' };
  }
  if (tool === 'rainbow') {
    return { kind: 'rainbow', hexes: RAINBOW_HEXES };
  }
  return { kind: 'color', hex: hexOf(color) };
}

function expectHandleShows(game: SavedColoring, tool: ToolId, color: number, what: string): void {
  expect(game.handleView(), `${what}: úchyt`).toMatchObject({
    tool,
    color: usesSelectedColor(tool) ? color : null,
  });
  const look = handleLook(game);
  expect(look.icon.emoji, `${what}: ikona nástroje v úchytu`).toBe(NOTO_EMOJI[tool]);
  expect(look.dot, `${what}: kolečko barvy v úchytu`).toEqual(expectedDot(tool, color));
}

function expectShortTone(tones: readonly Tone[], what: string): void {
  expect(tones.length, `${what}: zazní tón`).toBeGreaterThan(0);
  const end = Math.max(...tones.map((tone) => tone.startSeconds + tone.durationSeconds));
  expect(end, `${what}: tón kratší než 1 s`).toBeLessThan(1);
}

/** Hra, kterou profil už otevřel: panel začíná zavřený. */
function returningGame(storage = new RecordingStorage()): SavedColoring {
  openOn(storage, twoHalves()).suspend();
  return openOn(storage, twoHalves());
}

/** Hra s vybranou barvou `color` a panelem otevřeným na kroku nástrojů. */
function onToolStep(color: number): SavedColoring {
  const game = returningGame();
  game.tapColor(color);
  if (game.panelView() !== 'closed') {
    game.tapHandle();
  }
  game.tapHandle();
  expect(game.panelView(), 'panel na kroku nástrojů').toBe('tools');
  return game;
}

describe('#106 AC6: úchyt vždy ukazuje aktuální nástroj a barvu', () => {
  // Přepsáno k #110 AC2: dřív „ve vybrané barvě“ (barva štětce u všech
  // nástrojů). Od #110 ukáže úchyt nástroj v jeho vlastní barvě.
  it('po ťuknutí na jiný nástroj v panelu ukáže úchyt hned jeho ikonu v jeho barvě', () => {
    for (const color of [YELLOW, LIGHT_BLUE, BLACK]) {
      const colors = defaultsWithBrush(color);
      for (const tool of TOOLS) {
        const game = onToolStep(color);
        choose(game, tool);
        const own = isColorTool(tool) ? colors[tool] : color;
        expectHandleShows(game, tool, own, `${TOOL_NAMES[tool]}, štětec v barvě ${color}`);
      }
    }
  });

  it('po ťuknutí na barvu v kroku barev ukáže úchyt hned vybraný nástroj v nové barvě', () => {
    for (const tool of COLOR_TOOLS) {
      for (const color of [YELLOW, PINK, LIGHT_BLUE]) {
        const game = onToolStep(RED);
        choose(game, tool);
        expect(game.panelView(), `${TOOL_NAMES[tool]}: krok barev`).toBe('colors');

        game.tapColor(color);

        expectHandleShows(game, tool, color, `${TOOL_NAMES[tool]}, nová barva ${color}`);
      }
    }
  });

  // Upraveno k #110 AC4: růžovou i modrou dostane nástroj sám ve svém
  // kroku barev, nedávná barva je pak jeho předchozí růžová.
  it('po ťuknutí na nedávnou barvu se zavřeným panelem ukáže úchyt hned nástroj v té barvě (#99)', () => {
    for (const tool of COLOR_TOOLS) {
      const game = returningGame();
      giveColor(game, tool, PINK);
      giveColor(game, tool, BLUE);
      expect(game.panelView(), `${TOOL_NAMES[tool]}: panel zavřený`).toBe('closed');
      const recent = game.recentColors()[0];
      expect(recent, `${TOOL_NAMES[tool]}: nedávná barva je růžová`).toBe(PINK);

      const result = game.tapRecentColor(0);

      expect(result.kind, `${TOOL_NAMES[tool]}: nedávná barva vybraná`).toBe('picked');
      expectHandleShows(game, tool, PINK, `${TOOL_NAMES[tool]}, nedávná barva`);
    }
  });

  it('po ťuknutí na nedávnou barvu po gumě nebo duze ukáže úchyt hned malovací nástroj v té barvě', () => {
    for (const tool of ['eraser', 'rainbow'] as const) {
      const game = returningGame();
      game.tapColor(PINK);
      game.tapColor(BLUE);
      game.tapHandle();
      choose(game, tool);
      expect(game.panelView(), `${TOOL_NAMES[tool]}: panel zavřený`).toBe('closed');
      const before = handleLook(game);

      game.tapRecentColor(0);

      // Nedávná barva vrátí malovací nástroj (#90, #97), úchyt ho ukáže hned v nové barvě.
      expectHandleShows(game, game.selectedTool(), PINK, `${TOOL_NAMES[tool]} a nedávná barva`);
      expect(
        before,
        `${TOOL_NAMES[tool]}: předtím úchyt s ikonou nástroje bez vybrané barvy`,
      ).toEqual({
        icon: toolIconAsset(tool),
        dot: expectedDot(tool, PINK),
      });
    }
  });

  it('po opakovaném ťuknutí na vybraný nástroj zůstane ikona v úchytu stejná a tón i krok barev platí dál', () => {
    for (const tool of COLOR_TOOLS) {
      // Upraveno k #110 AC1: žlutou dostane nástroj sám ve svém kroku barev.
      const game = returningGame();
      giveColor(game, tool, YELLOW);
      pickTool(game, tool);
      game.tapBackToTools();
      expect(game.panelView(), `${TOOL_NAMES[tool]}: zpět na nástrojích`).toBe('tools');
      const before = handleLook(game);

      const tones = game.tapTool(slotOf(tool));

      expect(handleLook(game), `${TOOL_NAMES[tool]}: ikona i kolečko stejné`).toEqual(before);
      expectHandleShows(game, tool, YELLOW, `${TOOL_NAMES[tool]} znovu`);
      expectShortTone(tones, `${TOOL_NAMES[tool]} znovu`);
      expect(game.panelView(), `${TOOL_NAMES[tool]}: krok barev (#105 AC2)`).toBe('colors');
    }
    for (const tool of ['eraser', 'rainbow'] as const) {
      const game = onToolStep(YELLOW);
      choose(game, tool);
      game.tapHandle();
      const before = handleLook(game);

      const tones = game.tapTool(slotOf(tool));

      expect(handleLook(game), `${TOOL_NAMES[tool]}: ikona i kolečko stejné`).toEqual(before);
      expectShortTone(tones, `${TOOL_NAMES[tool]} znovu`);
      expect(game.panelView(), `${TOOL_NAMES[tool]}: panel zavřený (#105 AC4)`).toBe('closed');
    }
  });

  // Upraveno k #110: dřív měl razítkový fix po výběru barvy u štětce tutéž
  // světle modrou. Od #110 má svou barvu (výchozí oranžovou).
  it('regrese #96 AC5: úchyt je ve vybrané barvě a po návratu do hry ukazuje štětec v zapamatované barvě', () => {
    const storage = new RecordingStorage();
    const game = returningGame(storage);
    expectHandleShows(game, 'brush', game.palette().selected, 'na začátku');
    game.tapColor(LIGHT_BLUE);
    choose(game, 'stamp');
    expectHandleShows(game, 'stamp', DEFAULT_TOOL_COLORS.stamp, 'razítkový fix');
    game.suspend();

    const again = openOn(storage, twoHalves());

    expectHandleShows(again, 'brush', LIGHT_BLUE, 'po návratu');
  });

  it('úchyt ukazuje každý malovací nástroj v každé barvě palety jiným kolečkem a stejnou ikonou', () => {
    for (const tool of COLOR_TOOLS) {
      const looks = PALETTE.map((_, color) => {
        const view = { tool, color, size: 'medium' } as const;
        return { icon: toolIconAsset(view.tool), dot: handleColorDotFill(view) };
      });
      expect(
        new Set(looks.map((look) => JSON.stringify(look.dot))).size,
        `${TOOL_NAMES[tool]}: 12 různých koleček`,
      ).toBe(PALETTE.length);
      expect(
        new Set(looks.map((look) => JSON.stringify(look.icon))).size,
        `${TOOL_NAMES[tool]}: ikona zůstává v barvách autora, v každé barvě stejná`,
      ).toBe(1);
    }
  });
});
