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
import { firstButton, tapFirstButton } from './quickToolsHelpers';

/**
 * Testy chování k #106 AC6 (úchyt vždy ukazuje aktuální nástroj a barvu)
 * z pohledu hráče, v novém znění: ikona je hotové SVG Noto podle nástroje
 * a barvu ukazuje kolečko v rohu úchytu. Co úchyt ukazuje, je
 * `game.handleView()` (#96 AC5); ikonu z něj dává `toolIconAsset(view.tool)`
 * a kolečko `handleColorDotFill(view)` (navržené rozhraní
 * v `toolIconAssets.test.ts` a `toolIconColorDot.test.ts`). Scéna po
 * každém ťuknutí překreslí úchyt hned v obsluze ťuknutí. „Hned“ se tu
 * ověřuje tak, že správnou ikonu a kolečko jde přečíst ihned po volání
 * `tapTool`, `tapColor` nebo ťuknutí na první tlačítko v pruhu (#148), bez čekání; že je scéna
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

  // Nahrazuje k #148 testy nedávné barvy v úchytu (#99, #110 AC4):
  // nedávné barvy nejsou, první tlačítko v pruhu vrátí po gumě nástroj
  // z doby před ní (#163).
  it('po gumě a ťuknutí na první tlačítko se zavřeným panelem ukáže úchyt hned nástroj v jeho barvě (#148, #163)', () => {
    for (const tool of COLOR_TOOLS) {
      const other = tool === 'brush' ? 'marker' : 'brush';
      const game = returningGame();
      giveColor(game, other, BLUE);
      giveColor(game, tool, PINK);
      game.tapHandle();
      choose(game, 'eraser');
      expect(game.panelView(), `${TOOL_NAMES[tool]}: panel zavřený`).toBe('closed');
      expect(firstButton(game), `${TOOL_NAMES[tool]}: na prvním tlačítku`).toEqual({
        tool,
        color: PINK,
      });

      const result = tapFirstButton(game);

      expect(result.kind, `${TOOL_NAMES[tool]}: nástroj vybraný`).toBe('picked');
      expectHandleShows(game, tool, PINK, `${TOOL_NAMES[tool]}, první tlačítko`);
    }
  });

  // Upraveno k #163: s vybranou duhou je duha i na prvním tlačítku, proto
  // se úchyt s gumou ověřuje po malovacím nástroji i po duze.
  it('po ťuknutí na první tlačítko s gumou ukáže úchyt hned nástroj z tlačítka v jeho barvě', () => {
    for (const drawn of ['marker', 'rainbow'] as const) {
      const tool = 'eraser';
      const game = returningGame();
      giveColor(game, 'marker', PINK);
      game.tapHandle();
      choose(game, drawn);
      if (game.panelOpen()) {
        game.tapHandle();
      }
      game.tapHandle();
      choose(game, tool);
      expect(game.panelView(), `${TOOL_NAMES[drawn]}: panel zavřený`).toBe('closed');
      const before = handleLook(game);
      const shown = firstButton(game);
      expect(shown.tool, `${TOOL_NAMES[drawn]}: na prvním tlačítku je nástroj`).toBe(drawn);

      tapFirstButton(game);

      expectHandleShows(
        game,
        shown.tool,
        shown.color ?? PINK,
        `${TOOL_NAMES[drawn]}, guma a první tlačítko`,
      );
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
