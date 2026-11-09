import { describe, expect, it } from 'vitest';

import { PALETTE } from '../../../src/games/coloring/logic/palette';
import type { SavedColoring } from '../../../src/games/coloring/logic/savedPicture';
import type { ToolId } from '../../../src/games/coloring/logic/toolPanel';
import { choose } from './drawingToolHelpers';
import { TOOL_NAMES } from './lineSizeHelpers';
import { pick, seededRandom } from './recentColorsHelpers';
import { RecordingStorage, openOn, twoHalves } from './savedPictureHelpers';
import {
  MARKER_BLUE,
  COLOR_TOOLS,
  DEFAULT_TOOL_COLORS,
  GRAY,
  GREEN,
  PINK,
  RED,
  TOOLS_WITHOUT_COLOR,
  YELLOW,
  giveColor,
  isColorTool,
  pickTool,
  toolColorsOf,
} from './toolColorsHelpers';
import type { ColorTool } from './toolColorsHelpers';

/**
 * Testy k #110 AC4 (nedávné barvy zůstávají barvy, ne dvojice nástroj
 * a barva). Pravidlo pořadí z #99 AC2 platí dál, jen za S se bere barva,
 * kterou měl nástroj, který barvu dostává, před výběrem: je S a nedávné
 * [A, B], výběr X jiné než S dá nedávné S a za ní první ze starých
 * nedávných, která není X. Pravidlo „stejná barva nikdy není vidět
 * dvakrát“ z #99 AC2 je nahrazené: dvě nedávná místa se nikdy neopakují,
 * ale jedno z nich smí mít stejnou barvu jako úchyt.
 *
 * Navržené rozhraní: viz `toolColors.test.ts` (`toolColor(tool)`), nic
 * dalšího nového. `recentColors()` a `tapRecentColor(i)` zůstávají z #99.
 */

function fresh(): SavedColoring {
  return openOn(new RecordingStorage(), twoHalves());
}

/** Nedávné barvy jako pole (kopie, aby šly porovnat). */
function recentOf(game: SavedColoring): (number | null)[] {
  return [...game.recentColors()];
}

describe('#110 AC4: nedávné barvy zůstávají barvy', () => {
  it('příklad ze zadání: přepnutí na fix nedávné barvy nezmění, zelená pro fix je posune', () => {
    const game = fresh();
    giveColor(game, 'brush', YELLOW);
    giveColor(game, 'brush', RED);
    expect(toolColorsOf(game).brush, 'štětec je červený').toBe(RED);
    // Upraveno k #116: výchozí modrá fixu je ze sady fixu (MARKER_BLUE), ne modrá štětce.
    expect(toolColorsOf(game).marker, 'fix je modrý').toBe(MARKER_BLUE);
    expect(recentOf(game), 'nedávné [žlutá, prázdné]').toEqual([YELLOW, null]);

    pickTool(game, 'marker');
    expect(recentOf(game), 'po výběru fixu se nedávné nezmění').toEqual([YELLOW, null]);

    game.tapColor(GREEN);

    expect(toolColorsOf(game).marker, 'fix je zelený').toBe(GREEN);
    expect(recentOf(game), 'nedávné [modrá, žlutá]').toEqual([MARKER_BLUE, YELLOW]);
    expect(toolColorsOf(game).brush, 'štětec je dál červený').toBe(RED);
  });

  it('přepnutí nástroje nedávné barvy nemění, ani u gumy a duhy', () => {
    const game = fresh();
    giveColor(game, 'brush', YELLOW);
    giveColor(game, 'brush', PINK);
    const before = recentOf(game);
    expect(before, 'připravené nedávné').toEqual([YELLOW, RED]);

    for (const tool of [...COLOR_TOOLS, ...TOOLS_WITHOUT_COLOR, ...COLOR_TOOLS]) {
      pickTool(game, tool);
      expect(recentOf(game), TOOL_NAMES[tool]).toEqual(before);
      game.tapBackToTools();
      expect(recentOf(game), `${TOOL_NAMES[tool]}: návrat k nástrojům`).toEqual(before);
    }
  });

  it('výběr barvy posune nedávné barvy a za S se bere předchozí barva nástroje, který barvu dostává', () => {
    for (const tool of COLOR_TOOLS) {
      const game = fresh();

      giveColor(game, tool, GRAY);

      expect(recentOf(game), TOOL_NAMES[tool]).toEqual([DEFAULT_TOOL_COLORS[tool], null]);
    }
  });

  it('za S se po gumě bere barva naposledy vybraného malovacího nástroje, po duze barva štětce', () => {
    const cases: ReadonlyArray<{
      tools: readonly ToolId[];
      receives: keyof typeof DEFAULT_TOOL_COLORS;
    }> = [
      { tools: ['crayon', 'eraser'], receives: 'crayon' },
      { tools: ['dots', 'eraser'], receives: 'dots' },
      { tools: ['marker', 'rainbow'], receives: 'brush' },
      { tools: ['marker', 'rainbow', 'eraser'], receives: 'brush' },
    ];
    for (const { tools, receives } of cases) {
      const game = fresh();
      for (const tool of tools) {
        pickTool(game, tool);
      }

      game.tapColor(GRAY);

      const what = tools.map((tool) => TOOL_NAMES[tool]).join(' → ');
      expect(recentOf(game), what).toEqual([DEFAULT_TOOL_COLORS[receives], null]);
    }
  });

  it('výběr v pruhu i v panelu posune nedávné barvy stejně, i u jiného nástroje než štětce', () => {
    for (const tool of COLOR_TOOLS) {
      const fromStrip = fresh();
      const fromPanel = fresh();
      for (const game of [fromStrip, fromPanel]) {
        giveColor(game, 'brush', YELLOW);
        giveColor(game, 'brush', PINK);
        pickTool(game, tool);
        game.tapHandle();
      }
      const color = fromStrip.recentColors()[1] ?? -1;

      fromStrip.tapRecentColor(1);
      fromPanel.tapColor(color);

      const name = TOOL_NAMES[tool];
      expect(recentOf(fromStrip), name).toEqual(recentOf(fromPanel));
      expect(toolColorsOf(fromStrip), `${name}: barvy nástrojů`).toEqual(toolColorsOf(fromPanel));
    }
  });

  it('ťuknutí na nedávnou barvu ji dá vybranému malovacímu nástroji a ostatní si nechají svou', () => {
    for (const tool of COLOR_TOOLS) {
      const game = fresh();
      giveColor(game, 'brush', YELLOW);
      giveColor(game, 'brush', PINK);
      expect(recentOf(game), 'připravené nedávné').toEqual([YELLOW, RED]);
      pickTool(game, tool);
      game.tapHandle();
      const before = toolColorsOf(game);

      const result = game.tapRecentColor(0);

      const name = TOOL_NAMES[tool];
      expect(result.kind, name).toBe('picked');
      expect(game.selectedTool(), `${name}: zůstal vybraný`).toBe(tool);
      expect(toolColorsOf(game), `${name}: barvu dostal jen on`).toEqual({
        ...before,
        [tool]: YELLOW,
      });
    }
  });

  it('po přepnutí nástroje smí mít nedávné místo stejnou barvu jako úchyt', () => {
    const game = fresh();
    giveColor(game, 'marker', RED);
    giveColor(game, 'marker', GREEN);

    pickTool(game, 'brush');

    expect(game.handleView().color, 'úchyt: červený štětec').toBe(RED);
    expect(recentOf(game), 'nedávné [červená, modrá]').toEqual([RED, MARKER_BLUE]);
  });

  it('výběr barvy po přepnutí nástroje nikdy nedá dvě stejná nedávná místa a S je první', () => {
    const game = fresh();
    giveColor(game, 'marker', RED);
    giveColor(game, 'marker', GREEN);
    expect(recentOf(game), 'nedávné [červená, modrá]').toEqual([RED, MARKER_BLUE]);
    pickTool(game, 'brush');

    // Červený štětec dostane žlutou: S je červená a červená je už i v nedávných.
    game.tapColor(YELLOW);

    const recent = recentOf(game);
    expect(recent[0], 'S (červená) je na prvním místě').toBe(RED);
    expect(recent[1], 'druhé místo není červená').not.toBe(RED);
    expect(recent, 'vybraná žlutá není mezi nedávnými').not.toContain(YELLOW);
  });

  it('dlouhá náhodná řada se střídáním nástrojů: místa se neopakují a jdou podle pravidla', () => {
    const allTools: readonly ToolId[] = [...COLOR_TOOLS, ...TOOLS_WITHOUT_COLOR];
    for (const seed of [99, 110, 31337]) {
      const random = seededRandom(seed);
      const game = fresh();
      let paintingTool: ToolId = 'brush';
      for (let step = 0; step < 300; step += 1) {
        const before = recentOf(game);
        const roll = random();
        let picked: number | null = null;
        let what: string;
        if (roll < 0.4) {
          const tool = allTools[pick(random, allTools.length)] ?? 'brush';
          if (tool !== 'eraser') {
            paintingTool = tool;
          }
          choose(game, tool);
          what = `nástroj ${TOOL_NAMES[tool]}`;
        } else if (roll < 0.8) {
          picked = pick(random, PALETTE.length);
          what = `barva ${picked}`;
        } else {
          const place = pick(random, 2);
          picked = before[place] ?? null;
          what = `nedávné místo ${place + 1} (${String(picked)})`;
        }
        const receiving: ColorTool = isColorTool(paintingTool) ? paintingTool : 'brush';
        const own = toolColorsOf(game)[receiving];
        if (picked !== null) {
          if (roll < 0.8) {
            game.tapColor(picked);
          } else {
            game.tapRecentColor(before.indexOf(picked));
          }
          paintingTool = receiving;
        }
        const after = recentOf(game);
        const label = `seed ${seed}, krok ${step + 1}: ${what}, před [${before.join(', ')}]`;
        const places = after.filter((color): color is number => color !== null);
        expect(new Set(places).size, `${label}: místa se neopakují`).toBe(places.length);
        if (picked === null || picked === own) {
          expect(after, `${label}: nedávné beze změny`).toEqual(before);
          continue;
        }
        expect(after[0], `${label}: S je první`).toBe(own);
        expect(after, `${label}: vybraná barva není v nedávných`).not.toContain(picked);
        if (!before.includes(own)) {
          // Jednoznačný případ z #99 AC2: S a za ní první ze starých, která není X.
          const kept = before.find((color) => color !== picked) ?? null;
          expect(after, `${label}: pořadí podle #99 AC2`).toEqual([own, kept]);
        }
      }
    }
  });
});
