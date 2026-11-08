import { describe, expect, it } from 'vitest';

import { PALETTE } from '../../../src/games/coloring/logic/palette';
import type { SavedColoring } from '../../../src/games/coloring/logic/savedPicture';
import { handleIconShapes, toolIconShapes } from '../../../src/games/coloring/logic/toolIcons';
import type { IconShape } from '../../../src/games/coloring/logic/toolIcons';
import { usesSelectedColor } from '../../../src/games/coloring/logic/toolPanel';
import type { ToolId } from '../../../src/games/coloring/logic/toolPanel';
import type { Tone } from '../../../src/shared/audio/tonePlayer';
import { coloringCases } from './coloringLayoutScenes';
import { choose, slotOf } from './drawingToolHelpers';
import { RecordingStorage, openOn, twoHalves } from './savedPictureHelpers';
import {
  COLOR_TOOLS,
  TOOLS,
  TOOL_NAMES,
  handleIconBox,
  rasterize,
  sameHex,
  sideOfBox,
  visibleColors,
} from './toolIconHelpers';

/**
 * Testy chování k #106 AC6 (úchyt vždy ukazuje aktuální nástroj a barvu)
 * z pohledu hráče. Co úchyt ukazuje, je `game.handleView()` (#96 AC5);
 * ikonu z něj dělá navržená funkce
 * `handleIconShapes(view: HandleView, side: number): readonly IconShape[]`
 * v `src/games/coloring/logic/toolIcons.ts`, stejná jako
 * `toolIconShapes(view.tool, hex barvy view.color nebo null, side)`.
 * Scéna po každém ťuknutí překreslí úchyt touto funkcí hned v obsluze
 * ťuknutí. „Hned“ se tu ověřuje tak, že správnou ikonu jde přečíst
 * ihned po volání `tapTool`, `tapColor` nebo `tapRecentColor`, bez
 * čekání; že ji scéna nakreslí ve stejném snímku, je ruční kontrola.
 *
 * Jedno „otevření hry“ je `openOn(…)` nad úložištěm hry profilu.
 */

const RED = 0;
const YELLOW = 2;
const BLUE = 4;
const BLACK = 7;
const PINK = 8;
const LIGHT_BLUE = 11;

/** Nejmenší ikona v úchytu ve všech oknech (CSS px). */
const SIDE = Math.min(
  ...coloringCases(undefined, ['closed']).map((testCase) => sideOfBox(handleIconBox(testCase))),
);

function hexOf(color: number): string {
  const hex = PALETTE[color]?.hex;
  if (hex === undefined) {
    throw new Error(`barva ${color} v paletě není`);
  }
  return hex;
}

/** Ikona, kterou má úchyt ukázat: nástroj ve vybrané barvě, guma a duha bez barvy. */
function expectedIcon(tool: ToolId, color: number): readonly IconShape[] {
  return toolIconShapes(tool, usesSelectedColor(tool) ? hexOf(color) : null, SIDE);
}

/** Ikona, kterou úchyt právě ukazuje. */
function handleIcon(game: SavedColoring): readonly IconShape[] {
  return handleIconShapes(game.handleView(), SIDE);
}

function expectHandleShows(game: SavedColoring, tool: ToolId, color: number, what: string): void {
  expect(game.handleView(), `${what}: úchyt`).toMatchObject({
    tool,
    color: usesSelectedColor(tool) ? color : null,
  });
  expect(handleIcon(game), `${what}: ikona v úchytu`).toEqual(expectedIcon(tool, color));
  if (usesSelectedColor(tool)) {
    const shown = visibleColors(rasterize(handleIcon(game), SIDE, 2, SIDE * 0.3));
    expect(
      shown.some((hex) => sameHex(hex, hexOf(color))),
      `${what}: v ikoně úchytu je vidět vybraná barva ${hexOf(color)}`,
    ).toBe(true);
  }
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
  it('po ťuknutí na jiný nástroj v panelu ukáže úchyt hned jeho ikonu ve vybrané barvě', () => {
    for (const color of [YELLOW, LIGHT_BLUE, BLACK]) {
      for (const tool of TOOLS) {
        const game = onToolStep(color);
        choose(game, tool);
        expectHandleShows(game, tool, color, `${TOOL_NAMES[tool]}, barva ${color}`);
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

  it('po ťuknutí na nedávnou barvu se zavřeným panelem ukáže úchyt hned nástroj v té barvě (#99)', () => {
    for (const tool of COLOR_TOOLS) {
      const game = onToolStep(PINK);
      choose(game, tool);
      game.tapColor(BLUE);
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
      const before = handleIcon(game);

      game.tapRecentColor(0);

      // Nedávná barva vrátí malovací nástroj (#90, #97), úchyt ho ukáže hned v nové barvě.
      expectHandleShows(game, game.selectedTool(), PINK, `${TOOL_NAMES[tool]} a nedávná barva`);
      expect(before, `${TOOL_NAMES[tool]}: předtím úchyt bez barvy`).toEqual(
        toolIconShapes(tool, null, SIDE),
      );
    }
  });

  it('po opakovaném ťuknutí na vybraný nástroj zůstane ikona v úchytu stejná a tón i krok barev platí dál', () => {
    for (const tool of COLOR_TOOLS) {
      const game = onToolStep(YELLOW);
      choose(game, tool);
      game.tapBackToTools();
      expect(game.panelView(), `${TOOL_NAMES[tool]}: zpět na nástrojích`).toBe('tools');
      const before = handleIcon(game);

      const tones = game.tapTool(slotOf(tool));

      expect(handleIcon(game), `${TOOL_NAMES[tool]}: ikona stejná`).toEqual(before);
      expectHandleShows(game, tool, YELLOW, `${TOOL_NAMES[tool]} znovu`);
      expectShortTone(tones, `${TOOL_NAMES[tool]} znovu`);
      expect(game.panelView(), `${TOOL_NAMES[tool]}: krok barev (#105 AC2)`).toBe('colors');
    }
    for (const tool of ['eraser', 'rainbow'] as const) {
      const game = onToolStep(YELLOW);
      choose(game, tool);
      game.tapHandle();
      const before = handleIcon(game);

      const tones = game.tapTool(slotOf(tool));

      expect(handleIcon(game), `${TOOL_NAMES[tool]}: ikona stejná`).toEqual(before);
      expectShortTone(tones, `${TOOL_NAMES[tool]} znovu`);
      expect(game.panelView(), `${TOOL_NAMES[tool]}: panel zavřený (#105 AC4)`).toBe('closed');
    }
  });

  it('regrese #96 AC5: úchyt je ve vybrané barvě a po návratu do hry ukazuje štětec v zapamatované barvě', () => {
    const storage = new RecordingStorage();
    const game = returningGame(storage);
    expectHandleShows(game, 'brush', game.palette().selected, 'na začátku');
    game.tapColor(LIGHT_BLUE);
    choose(game, 'stamp');
    expectHandleShows(game, 'stamp', LIGHT_BLUE, 'razítkový fix');
    game.suspend();

    const again = openOn(storage, twoHalves());

    expectHandleShows(again, 'brush', LIGHT_BLUE, 'po návratu');
  });

  it('úchyt ukazuje každý malovací nástroj v každé barvě palety jinak než v ostatních barvách', () => {
    for (const tool of COLOR_TOOLS) {
      const icons = PALETTE.map((_, color) =>
        JSON.stringify(handleIconShapes({ tool, color, size: 'medium' }, SIDE)),
      );
      expect(new Set(icons).size, `${TOOL_NAMES[tool]}: 12 různých ikon`).toBe(PALETTE.length);
    }
  });
});
