import { describe, expect, it } from 'vitest';

import { PALETTE } from '../../../src/games/coloring/logic/palette';
import type { RegionMap } from '../../../src/games/coloring/logic/regionMap';
import type { SavedColoring } from '../../../src/games/coloring/logic/savedPicture';
import { handleColorDotFill } from '../../../src/games/coloring/logic/toolIcons';
import type { ToolId } from '../../../src/games/coloring/logic/toolPanel';
import { choose, endOf } from './drawingToolHelpers';
import { TOOL_NAMES } from './lineSizeHelpers';
import { pick, seededRandom } from './randomHelpers';
import { at } from './strokeHelpers';
import { RecordingStorage, openOn, paint, startStroke, twoHalves } from './savedPictureHelpers';
import {
  BLACK,
  BROWN,
  COLOR_TOOLS,
  DEFAULT_TOOL_COLORS,
  GRAY,
  GREEN,
  LIGHT_BLUE,
  PINK,
  RED,
  SKIN,
  TOOLS_WITHOUT_COLOR,
  YELLOW,
  defaultsWithBrush,
  giveColor,
  isColorTool,
  markedColorIndexes,
  openToolStep,
  pickTool,
  toolColorsOf,
} from './toolColorsHelpers';
import type { ColorTool } from './toolColorsHelpers';
import { firstButton, tapPrevious, tapQuickEraser } from './quickToolsHelpers';

/**
 * Testy k #110 (každý nástroj v Omalovánkách si pamatuje svou barvu):
 * AC1 každý malovací nástroj má svou barvu, AC2 barva nástroje je vidět
 * (část, kterou jde ověřit logikou), AC3 barva po gumě a duze a AC7
 * okrajové případy. Nedávné barvy (AC4) od #148 nejsou, jejich testy
 * (`toolColorsRecent.test.ts`) nahradily testy předchozího nástroje
 * (`quickTools*.test.ts`); pamatování a staré záznamy (AC5, AC6) jsou
 * v `toolColorsRecord.test.ts`.
 *
 * Ťuknutí scéna hlásí jako dnes (#105): úchyt `tapHandle()`, nástroj
 * `tapTool(i)`, barva v kroku barev `tapColor(i)`, od #148 předchozí
 * nástroj a guma v pruhu (`quickToolsHelpers.ts`), Zpět `tapUndo()`.
 * Zkušební obrázek 300 × 200 má
 * oblast A vlevo a B vpravo od čáry x 150. Nový profil začíná výchozími
 * barvami z tabulky v AC5 (štětec červený, fix modrý, …).
 *
 * Navržené rozhraní (`SavedColoring` v `src/games/coloring/logic/savedPicture.ts`):
 * - `toolColor(tool: ToolId): number | null` nové: barva malovacího
 *   nástroje (index `PALETTE`), kterou ukazuje krok nástrojů na hrotu
 *   nástroje; u gumy a duhy `null`. Nezávisí na tom, který nástroj je
 *   vybraný ani v jakém kroku je panel.
 * - `handleView().color` je barva vybraného nástroje (u gumy a duhy `null`).
 * - `palette().selected` je barva nástroje, který by výběr barvy dostal:
 *   vybraného malovacího nástroje, po gumě naposledy vybraného malovacího
 *   nástroje, po duze štětce. V kroku barev je to tedy barva nástroje na
 *   prvním místě a `markedColors(palette())` ji označí.
 * - `tapColor(i)` dá barvu jen tomuto nástroji.
 * - `pointerDown` maluje barvou vybraného nástroje.
 * Výchozí barvy může kód mít třeba jako `DEFAULT_TOOL_COLORS` v novém
 * `src/games/coloring/logic/toolColors.ts`; testy mají vlastní opis
 * tabulky (`toolColorsHelpers.ts`), aby ji nešlo potichu změnit.
 */

/** Tah v oblasti A a v oblasti B. */
const STROKE_A = [at(20, 100), at(140, 100)];
const STROKE_B = [at(170, 100), at(290, 100)];

function fresh(): SavedColoring {
  return openOn(new RecordingStorage(), twoHalves());
}

/** Barvy, které jsou namalované v pixelech se sloupci `fromX` až `toX`. */
function colorsBetween(
  game: SavedColoring,
  regions: RegionMap,
  fromX: number,
  toX: number,
): number[] {
  const found = new Set<number>();
  for (let y = 0; y < regions.height; y += 1) {
    for (let x = fromX; x <= toX; x += 1) {
      const color = game.colorAt(x, y);
      if (color !== null) {
        found.add(color);
      }
    }
  }
  return [...found];
}

/** Co dítě vidí z barev: barvy nástrojů, předchozí nástroj (#148), vybraný nástroj a velikost. */
function snapshotOf(game: SavedColoring): {
  colors: Record<ColorTool, number | null>;
  first: ReturnType<typeof firstButton>;
  tool: ToolId;
  size: string;
} {
  return {
    colors: toolColorsOf(game),
    first: firstButton(game),
    tool: game.selectedTool(),
    size: game.lineSize(),
  };
}

describe('#110 AC1: každý malovací nástroj má svou barvu', () => {
  it('nový profil má u každého z 8 malovacích nástrojů jeho výchozí barvu', () => {
    expect(toolColorsOf(fresh())).toEqual(DEFAULT_TOOL_COLORS);
  });

  it('guma a duha barvu nemají', () => {
    const game = fresh();
    for (const tool of TOOLS_WITHOUT_COLOR) {
      expect(game.toolColor(tool), TOOL_NAMES[tool]).toBeNull();
      choose(game, tool);
      expect(game.handleView().color, `${TOOL_NAMES[tool]}: úchyt bez barvy`).toBeNull();
    }
  });

  it('výběr barvy v kroku barev změní barvu jen nástroje, ke kterému se vybírá', () => {
    for (const tool of COLOR_TOOLS) {
      const game = fresh();

      giveColor(game, tool, GRAY);

      expect(toolColorsOf(game), TOOL_NAMES[tool]).toEqual({
        ...DEFAULT_TOOL_COLORS,
        [tool]: GRAY,
      });
    }
  });

  it('příklad ze zadání: fix dostane zelenou, štětec maluje dál červeně a fix zeleně', () => {
    const regions = twoHalves();
    const game = openOn(new RecordingStorage(), regions);
    expect(toolColorsOf(game).brush, 'štětec je červený').toBe(RED);
    // Upraveno k #116: fix má výchozí modrou ze své sady, ne modrou štětce.
    expect(toolColorsOf(game).marker, 'fix je modrý').toBe(DEFAULT_TOOL_COLORS.marker);

    giveColor(game, 'marker', GREEN);
    pickTool(game, 'brush');
    paint(game, STROKE_A);
    pickTool(game, 'marker');
    paint(game, STROKE_B);

    expect(colorsBetween(game, regions, 0, 149), 'štětec maluje červeně').toEqual([RED]);
    expect(colorsBetween(game, regions, 152, 299), 'fix maluje zeleně').toEqual([GREEN]);
    expect(toolColorsOf(game)).toEqual({ ...DEFAULT_TOOL_COLORS, marker: GREEN });
  });

  it('ťuknutí na nástroj ho vybere i s jeho barvou a tah maluje barvou nástroje', () => {
    const own = { ...DEFAULT_TOOL_COLORS, brush: PINK, crayon: SKIN, spray: LIGHT_BLUE };
    for (const tool of COLOR_TOOLS) {
      const regions = twoHalves();
      const game = openOn(new RecordingStorage(), regions);
      giveColor(game, 'brush', PINK);
      giveColor(game, 'crayon', SKIN);
      giveColor(game, 'spray', LIGHT_BLUE);

      pickTool(game, tool);
      game.tapHandle();
      paint(game, STROKE_A);

      const name = TOOL_NAMES[tool];
      expect(game.selectedTool(), name).toBe(tool);
      expect(game.handleView(), `${name}: úchyt`).toMatchObject({ tool, color: own[tool] });
      expect(colorsBetween(game, regions, 0, 149), `${name}: barva tahu`).toEqual([own[tool]]);
    }
  });

  it('střídání nástrojů v obou směrech: každý nástroj maluje pořád svou barvou', () => {
    const regions = twoHalves();
    const game = openOn(new RecordingStorage(), regions);
    giveColor(game, 'brush', YELLOW);
    giveColor(game, 'marker', BROWN);

    for (let round = 0; round < 3; round += 1) {
      pickTool(game, 'brush');
      expect(game.handleView().color, `kolo ${round + 1}: štětec`).toBe(YELLOW);
      pickTool(game, 'marker');
      expect(game.handleView().color, `kolo ${round + 1}: fix`).toBe(BROWN);
    }
    game.tapHandle();
    paint(game, STROKE_B);
    pickTool(game, 'brush');
    game.tapHandle();
    paint(game, STROKE_A);

    expect(colorsBetween(game, regions, 0, 149), 'štětec').toEqual([YELLOW]);
    expect(colorsBetween(game, regions, 152, 299), 'fix').toEqual([BROWN]);
  });

  // Upraveno k #148: místo nedávných barev ťuká dítě na předchozí nástroj.
  it('dlouhá náhodná řada ťuknutí na nástroje, barvy a předchozí nástroj mění barvu jen jednoho nástroje', () => {
    const allTools: readonly ToolId[] = [...COLOR_TOOLS, ...TOOLS_WITHOUT_COLOR];
    for (const seed of [110, 2026, 4242]) {
      const random = seededRandom(seed);
      const game = fresh();
      const colors: Record<ColorTool, number> = { ...DEFAULT_TOOL_COLORS };
      let tool: ToolId = 'brush';
      let paintingTool: ToolId = 'brush';
      for (let step = 0; step < 300; step += 1) {
        const roll = random();
        let what: string;
        let picked: number | null = null;
        if (roll < 0.4) {
          tool = allTools[pick(random, allTools.length)] ?? 'brush';
          if (tool !== 'eraser') {
            paintingTool = tool;
          }
          choose(game, tool);
          what = `nástroj ${TOOL_NAMES[tool]}`;
        } else if (roll < 0.8) {
          picked = pick(random, PALETTE.length);
          game.tapColor(picked);
          what = `barva ${picked}`;
        } else {
          const shown = firstButton(game);
          tapPrevious(game);
          if (shown !== null) {
            tool = shown.tool;
            paintingTool = shown.tool;
          }
          what = `předchozí nástroj (${shown === null ? 'prázdné' : TOOL_NAMES[shown.tool]})`;
        }
        if (picked !== null) {
          // Barvu dostane vybraný malovací nástroj, po gumě naposledy vybraný, po duze štětec (AC3).
          const target: ColorTool = isColorTool(paintingTool) ? paintingTool : 'brush';
          colors[target] = picked;
          tool = target;
          paintingTool = target;
        }
        const label = `seed ${seed}, krok ${step + 1}: ${what}`;
        expect(toolColorsOf(game), `${label}: barvy nástrojů`).toEqual(colors);
        expect(game.selectedTool(), `${label}: vybraný nástroj`).toBe(tool);
        expect(game.handleView().color, `${label}: úchyt`).toBe(
          isColorTool(tool) ? colors[tool] : null,
        );
      }
    }
  });
});

describe('#110 AC2: barvu nástroje je vidět', () => {
  /** Hra, ve které má každý malovací nástroj jinou barvu než výchozí. */
  function everyToolRecolored(): { game: SavedColoring; colors: Record<ColorTool, number> } {
    const game = fresh();
    const colors = {
      brush: BLACK,
      marker: YELLOW,
      crayon: PINK,
      stamp: GRAY,
      dots: SKIN,
      stripes: BROWN,
      glitter: GREEN,
      spray: LIGHT_BLUE,
    } satisfies Record<ColorTool, number>;
    for (const tool of COLOR_TOOLS) {
      giveColor(game, tool, colors[tool]);
    }
    return { game, colors };
  }

  it('v kroku nástrojů má každý malovací nástroj svou barvu, ať je vybraný kterýkoli nástroj', () => {
    const { game, colors } = everyToolRecolored();
    for (const tool of [...COLOR_TOOLS, ...TOOLS_WITHOUT_COLOR]) {
      openToolStep(game);
      expect(game.panelView(), 'krok nástrojů').toBe('tools');
      expect(toolColorsOf(game), `krok nástrojů s vybraným ${TOOL_NAMES[tool]}`).toEqual(colors);
      choose(game, tool);
      expect(toolColorsOf(game), `po ťuknutí na ${TOOL_NAMES[tool]}`).toEqual(colors);
    }
  });

  it('v kroku barev je označená barva toho nástroje a na prvním místě je nástroj v ní', () => {
    const { game, colors } = everyToolRecolored();
    for (const tool of COLOR_TOOLS) {
      pickTool(game, tool);

      const name = TOOL_NAMES[tool];
      expect(game.panelView(), `${name}: krok barev`).toBe('colors');
      expect(game.selectedTool(), `${name}: na prvním místě`).toBe(tool);
      expect(markedColorIndexes(game), `${name}: označená barva`).toEqual([colors[tool]]);
      expect(game.handleView().color, `${name}: nástroj v jeho barvě`).toBe(colors[tool]);
    }
  });

  it('v kroku barev nového profilu je u každého nástroje označená jeho výchozí barva', () => {
    for (const tool of COLOR_TOOLS) {
      const game = fresh();
      pickTool(game, tool);
      expect(markedColorIndexes(game), TOOL_NAMES[tool]).toEqual([DEFAULT_TOOL_COLORS[tool]]);
    }
  });

  it('úchyt ukazuje vybraný nástroj v jeho barvě', () => {
    const { game, colors } = everyToolRecolored();
    for (const tool of COLOR_TOOLS) {
      pickTool(game, tool);
      game.tapHandle();

      const name = TOOL_NAMES[tool];
      expect(game.handleView(), `${name}: úchyt`).toMatchObject({ tool, color: colors[tool] });
      expect(handleColorDotFill(game.handleView()), `${name}: kolečko v úchytu`).toEqual({
        kind: 'color',
        hex: PALETTE[colors[tool]]?.hex,
      });
    }
  });

  it('guma a duha zůstávají v úchytu bez barvy jako dnes', () => {
    const { game } = everyToolRecolored();
    for (const tool of TOOLS_WITHOUT_COLOR) {
      pickTool(game, tool);

      expect(game.handleView(), TOOL_NAMES[tool]).toMatchObject({ tool, color: null });
      expect(handleColorDotFill(game.handleView()).kind, TOOL_NAMES[tool]).toBe(tool);
    }
  });
});

describe('#110 AC3: barva po gumě a duze', () => {
  it('s gumou dá barva v panelu barvu naposledy vybranému malovacímu nástroji a přepne na něj', () => {
    for (const tool of COLOR_TOOLS) {
      const game = fresh();
      pickTool(game, tool);
      pickTool(game, 'eraser');

      game.tapColor(GRAY);

      const name = TOOL_NAMES[tool];
      expect(game.selectedTool(), `${name} → guma → barva`).toBe(tool);
      expect(toolColorsOf(game), `${name}: barvu dostal jen on`).toEqual({
        ...DEFAULT_TOOL_COLORS,
        [tool]: GRAY,
      });
    }
  });

  // Nahrazuje k #148 test „s gumou dá nedávná barva barvu …“ (#99, #110):
  // guma vybraná v pruhu se k barvě chová stejně jako guma z panelu.
  it('s gumou vybranou v pruhu dá barva barvu naposledy vybranému malovacímu nástroji', () => {
    const game = fresh();
    giveColor(game, 'brush', YELLOW);
    pickTool(game, 'crayon');
    tapQuickEraser(game);
    expect(game.selectedTool(), 'kontrola: guma').toBe('eraser');

    game.tapColor(RED);

    expect(game.selectedTool()).toBe('crayon');
    expect(toolColorsOf(game)).toEqual({ ...DEFAULT_TOOL_COLORS, brush: YELLOW, crayon: RED });
  });

  it('s duhou dá barva barvu štětci a přepne na něj', () => {
    const game = fresh();
    giveColor(game, 'marker', PINK);
    pickTool(game, 'rainbow');

    game.tapColor(GRAY);

    expect(game.selectedTool()).toBe('brush');
    expect(toolColorsOf(game)).toEqual({ ...DEFAULT_TOOL_COLORS, marker: PINK, brush: GRAY });
  });

  it('s gumou po duze dá barva barvu štětci, i když byl před duhou vybraný jiný nástroj', () => {
    const game = fresh();
    pickTool(game, 'marker');
    pickTool(game, 'rainbow');
    pickTool(game, 'eraser');

    game.tapColor(GRAY);

    expect(game.selectedTool()).toBe('brush');
    expect(toolColorsOf(game)).toEqual(defaultsWithBrush(GRAY));
  });

  // Nahrazuje k #148 test „s duhou dá nedávná barva barvu štětci“ (#99,
  // #110): duha vybraná prvním tlačítkem se k barvě chová jako z panelu.
  it('s duhou vybranou prvním tlačítkem dá barva barvu štětci', () => {
    const game = fresh();
    pickTool(game, 'rainbow');
    giveColor(game, 'spray', YELLOW);
    tapPrevious(game);
    expect(game.selectedTool(), 'kontrola: duha').toBe('rainbow');

    game.tapColor(GRAY);

    expect(game.selectedTool()).toBe('brush');
    expect(toolColorsOf(game)).toEqual({ ...DEFAULT_TOOL_COLORS, spray: YELLOW, brush: GRAY });
  });

  it('po gumě a duze se maluje hned nástrojem, který barvu dostal, a jen jeho barvou', () => {
    const regions = twoHalves();
    const game = openOn(new RecordingStorage(), regions);
    pickTool(game, 'marker');
    pickTool(game, 'eraser');
    game.tapColor(GRAY);
    paint(game, STROKE_A);
    pickTool(game, 'rainbow');
    game.tapColor(PINK);
    paint(game, STROKE_B);

    expect(colorsBetween(game, regions, 0, 149), 'fix šedě').toEqual([GRAY]);
    expect(colorsBetween(game, regions, 152, 299), 'štětec růžově').toEqual([PINK]);
  });
});

describe('#110 AC7: okrajové případy', () => {
  // Upraveno k #148: místo nedávné barvy předchozí nástroj a guma v pruhu.
  it('ťuknutí druhým prstem během tahu na nástroj, barvu, předchozí nástroj nebo gumu v pruhu se nepočítá a tah pokračuje', () => {
    const taps: ReadonlyArray<[string, (game: SavedColoring) => unknown]> = [
      ['nástroj', (game) => choose(game, 'marker')],
      ['barva', (game) => game.tapColor(GRAY)],
      ['předchozí nástroj', (game) => tapPrevious(game)],
      ['guma v pruhu', (game) => tapQuickEraser(game)],
    ];
    for (const [what, tap] of taps) {
      const regions = twoHalves();
      const game = openOn(new RecordingStorage(), regions);
      pickTool(game, 'crayon');
      giveColor(game, 'brush', YELLOW);
      expect(firstButton(game)?.tool, `${what}: pastelka na prvním tlačítku`).toBe('crayon');
      startStroke(game, [at(20, 100), at(60, 100)]);
      const before = snapshotOf(game);

      tap(game);

      expect(snapshotOf(game), `${what}: nic se nezměnilo`).toEqual(before);
      game.pointerMove({ id: 1, x: 140, y: 100, kind: 'touch' });
      game.pointerUp(1);
      expect(game.colorAt(130, 100), `${what}: tah pokračoval žlutým štětcem`).toBe(YELLOW);
    }
  });

  it('Zpět vrací jen tahy, barvy nástrojů ani předchozí nástroj nemění', () => {
    const regions = twoHalves();
    const game = openOn(new RecordingStorage(), regions);
    giveColor(game, 'brush', YELLOW);
    paint(game, STROKE_A);
    giveColor(game, 'marker', GREEN);
    paint(game, STROKE_B);
    giveColor(game, 'crayon', BROWN);
    const before = snapshotOf(game);

    for (let undo = 1; undo <= 3; undo += 1) {
      game.tapUndo();
      expect({ ...snapshotOf(game), tool: before.tool }, `po ${undo}. Zpět`).toEqual(before);
    }
    expect(colorsBetween(game, regions, 0, 299), 'tahy jsou vrácené').toEqual([]);
  });

  it('ťuknutí na barvu, kterou už nástroj má, zavře panel a nic jiného nezmění', () => {
    for (const tool of COLOR_TOOLS) {
      const game = fresh();
      giveColor(game, 'brush', YELLOW);
      giveColor(game, tool, GRAY);
      pickTool(game, tool);
      const before = snapshotOf(game);

      const tones = game.tapColor(GRAY);

      const name = TOOL_NAMES[tool];
      expect(game.panelView(), `${name}: panel zavřený`).toBe('closed');
      expect(tones.length, `${name}: zazní tón`).toBeGreaterThan(0);
      expect(endOf(tones), `${name}: tón kratší než 1 s`).toBeLessThan(1);
      expect(snapshotOf(game), `${name}: nic jiného se nezměnilo`).toEqual(before);
    }
  });

  // Upraveno k #148: místo prázdných nedávných barev se nezmění první tlačítko.
  it('ťuknutí na výchozí barvu nástroje v novém profilu zavře panel a první tlačítko nezmění', () => {
    for (const tool of COLOR_TOOLS) {
      const game = fresh();
      pickTool(game, tool);
      const first = firstButton(game);

      game.tapColor(DEFAULT_TOOL_COLORS[tool]);

      expect(game.panelView(), TOOL_NAMES[tool]).toBe('closed');
      expect(firstButton(game), TOOL_NAMES[tool]).toEqual(first);
      expect(toolColorsOf(game), TOOL_NAMES[tool]).toEqual(DEFAULT_TOOL_COLORS);
    }
  });

  // Nahrazuje k #148 test prázdného nedávného místa (#99, #110).
  it('ťuknutí na prázdné první tlačítko se jen zhoupne a žádnému nástroji barvu nedá', () => {
    const game = fresh();
    const before = snapshotOf(game);
    expect(before.first, 'kontrola: prázdné').toBeNull();

    for (let tap = 1; tap <= 2; tap += 1) {
      expect(tapPrevious(game).kind, `${tap}. ťuknutí`).toBe('wobble');
    }

    expect(snapshotOf(game)).toEqual(before);
  });

  // Nahrazuje k #148 test „nedávná barva, kterou už nástroj má“ (#110):
  // ťuknutí na první tlačítko vybere nástroj a žádnou barvu nezmění.
  it('ťuknutí na první tlačítko vybere předchozí nástroj a barvy nástrojů ani tloušťku nezmění', () => {
    const game = fresh();
    giveColor(game, 'marker', RED);
    giveColor(game, 'marker', GREEN);
    pickTool(game, 'brush');
    game.tapHandle();
    const before = snapshotOf(game);

    const result = tapPrevious(game);

    expect(result.kind).toBe('picked');
    expect(snapshotOf(game)).toEqual({
      ...before,
      tool: 'marker',
      first: { tool: 'brush', color: before.colors.brush },
    });
  });
});
