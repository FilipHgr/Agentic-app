import { describe, expect, it } from 'vitest';

import type { SavedColoring } from '../../../src/games/coloring/logic/savedPicture';
import type { ToolId } from '../../../src/games/coloring/logic/toolPanel';
import { HOME_WOBBLE_TONES } from '../../../src/shared/logic/homeButton';
import { endOf } from './drawingToolHelpers';
import { TOOL_NAMES } from './lineSizeHelpers';
import {
  firstButton,
  lineSizeAndColors,
  shownAs,
  tapFirstButton,
  tapQuickEraser,
} from './quickToolsHelpers';
import { pick, seededRandom } from './randomHelpers';
import { RecordingStorage, openOn, paint, twoHalves } from './savedPictureHelpers';
import { at } from './strokeHelpers';
import {
  COLOR_TOOLS,
  GRAY,
  GREEN,
  PINK,
  YELLOW,
  giveColor,
  openToolStep,
  pickTool,
  toolColorsOf,
} from './toolColorsHelpers';

/**
 * Testy k #163 (rychlé přepínání jen mezi kreslicím nástrojem a gumou),
 * které nahrazují testy předchozího nástroje z #148 AC1 až AC4: AC1 (co
 * ukazuje první tlačítko), AC2 (střídání guma / nástroj), AC3 (už vybrané
 * tlačítko) a AC4 (výběr v panelu a barvou). Otevření hry a úložiště (AC5)
 * jsou v `quickToolsRecord.test.ts`, dotyky (AC6) v `quickToolsTouch.test.ts`,
 * rozložení pruhu v `quickToolsLayoutRules.test.ts`. Rozhraní je
 * v `quickToolsHelpers.ts`.
 *
 * Kreslicí nástroj je každý kromě gumy. Zkušební obrázek 300 × 200 má
 * oblast A vlevo od čáry x 150.
 */

function fresh(): SavedColoring {
  return openOn(new RecordingStorage(), twoHalves());
}

/** Hra s vybraným nástrojem `tool` (vybraný v panelu, panel zůstane, jak ho výběr nechá). */
function withSelected(tool: ToolId): SavedColoring {
  const game = fresh();
  if (tool !== 'brush') {
    pickTool(game, tool);
  }
  expect(game.selectedTool(), `kontrola: vybraný ${TOOL_NAMES[tool]}`).toBe(tool);
  return game;
}

/** Nástroje kromě gumy (smí být na prvním tlačítku). */
const DRAWING_TOOLS: readonly ToolId[] = [...COLOR_TOOLS, 'rainbow'];

/** Všechny nástroje panelu: kreslicí a guma. */
const ALL_TOOLS: readonly ToolId[] = [...DRAWING_TOOLS, 'eraser'];

/** Dvojice různých kreslicích nástrojů. */
function pairs(): Array<[ToolId, ToolId]> {
  const result: Array<[ToolId, ToolId]> = [];
  for (const x of DRAWING_TOOLS) {
    for (const y of DRAWING_TOOLS) {
      if (x !== y) {
        result.push([x, y]);
      }
    }
  }
  return result;
}

/** Ťuknutí na gumu v pruhu, nebo výběr gumy v panelu. */
function chooseEraser(game: SavedColoring, how: 'tlačítko' | 'panel'): void {
  if (how === 'tlačítko') {
    tapQuickEraser(game);
  } else {
    pickTool(game, 'eraser');
  }
}

const ERASER_WAYS = ['tlačítko', 'panel'] as const;

describe('#163 AC1: první tlačítko ukazuje kreslicí nástroj', () => {
  it('první tlačítko ukazuje vybraný kreslicí nástroj s barvou, jakou ukazuje úchyt', () => {
    for (const tool of DRAWING_TOOLS) {
      const game = withSelected(tool);
      const handle = game.handleView();

      expect(firstButton(game), TOOL_NAMES[tool]).toEqual({
        tool: handle.tool,
        color: handle.color,
      });
    }
  });

  it('malovací nástroj je na prvním tlačítku s kolečkem své barvy', () => {
    for (const tool of COLOR_TOOLS) {
      const game = fresh();
      giveColor(game, tool, PINK);

      expect(firstButton(game), TOOL_NAMES[tool]).toEqual({ tool, color: PINK });
    }
  });

  // Upraveno k #164 AC4: duha nemá barvu palety, ale na prvním tlačítku má
  // duhové kolečko jako dřív v úchytu (handleSymbol.test.ts).
  it('duha je na prvním tlačítku bez barvy palety', () => {
    const game = withSelected('rainbow');

    expect(firstButton(game)).toEqual({ tool: 'rainbow', color: null });
  });

  it('s vybranou gumou ukazuje první tlačítko nástroj, kterým se kreslilo těsně před gumou', () => {
    for (const [before, tool] of pairs()) {
      for (const how of ERASER_WAYS) {
        const game = withSelected(before);
        pickTool(game, tool);
        const drawnWith = shownAs(game, tool);

        chooseEraser(game, how);

        const what = `${TOOL_NAMES[before]}, ${TOOL_NAMES[tool]}, guma (${how})`;
        expect(game.selectedTool(), what).toBe('eraser');
        expect(firstButton(game), `${what}: první tlačítko`).toEqual(drawnWith);
      }
    }
  });

  it('první tlačítko nikdy není prázdné ani guma, ať dítě ťuká jakkoli', () => {
    const known: readonly string[] = DRAWING_TOOLS;
    for (const seed of [163, 2026]) {
      const random = seededRandom(seed);
      const game = fresh();
      for (let step = 0; step < 200; step += 1) {
        const roll = random();
        if (roll < 0.3) {
          pickTool(game, ALL_TOOLS[pick(random, ALL_TOOLS.length)] ?? 'eraser');
        } else if (roll < 0.55) {
          tapFirstButton(game);
        } else if (roll < 0.8) {
          tapQuickEraser(game);
        } else {
          game.tapColor(pick(random, 12));
        }
        const shown = firstButton(game);
        expect(known, `seed ${seed}, krok ${step + 1}: ${shown.tool}`).toContain(shown.tool);
      }
    }
  });

  it('druhé tlačítko je vždy guma: z každého nástroje vybere gumu', () => {
    for (const tool of DRAWING_TOOLS) {
      const game = withSelected(tool);

      const result = tapQuickEraser(game);

      expect(result.kind, TOOL_NAMES[tool]).toBe('picked');
      expect(game.selectedTool(), TOOL_NAMES[tool]).toBe('eraser');
    }
  });

  // Z #148 AC1: nedávné barvy z #99 nejsou ani po #163, tlačítka přepínají
  // jen nástroje, nikdy barvu.
  it('nedávné barvy ve hře nejsou: první tlačítko ukáže jen poslední barvu nástroje a barvu nepřepíná', () => {
    const game = withSelected('marker');
    for (const color of [PINK, GRAY, GREEN, YELLOW]) {
      giveColor(game, 'marker', color);
    }
    tapQuickEraser(game);

    expect(tapFirstButton(game).kind, 'první tlačítko').toBe('picked');
    expect(game.selectedTool(), 'vybral se nástroj').toBe('marker');
    expect(game.toolColor('marker'), 'fix si nechal poslední barvu').toBe(YELLOW);
    expect(firstButton(game), 'fix v poslední barvě').toEqual({ tool: 'marker', color: YELLOW });
  });
});

describe('#163 AC2: střídání gumy a nástroje', () => {
  it('s vybranou gumou ťuknutí na první tlačítko vybere ten nástroj s jeho barvou a první tlačítko ho ukazuje dál', () => {
    for (const [before, tool] of pairs()) {
      const game = withSelected(before);
      pickTool(game, tool);
      const shown = shownAs(game, tool);
      tapQuickEraser(game);

      const result = tapFirstButton(game);

      const what = `${TOOL_NAMES[before]}, ${TOOL_NAMES[tool]}, guma`;
      expect(result.kind, what).toBe('picked');
      expect(game.selectedTool(), what).toBe(tool);
      expect(game.handleView(), `${what}: úchyt`).toMatchObject({ tool, color: shown.color });
      expect(firstButton(game), `${what}: první tlačítko`).toEqual(shown);
    }
  });

  it('opakované střídání gumy a nástroje první tlačítko nikdy nezmění', () => {
    for (const [before, tool] of pairs()) {
      const game = withSelected(before);
      pickTool(game, tool);
      const shown = firstButton(game);

      for (let round = 0; round < 6; round += 1) {
        const what = `${TOOL_NAMES[before]}, ${TOOL_NAMES[tool]}, kolo ${round + 1}`;
        tapQuickEraser(game);
        expect(game.selectedTool(), `${what}: guma`).toBe('eraser');
        expect(firstButton(game), `${what}: s gumou`).toEqual(shown);
        tapFirstButton(game);
        expect(game.selectedTool(), `${what}: nástroj`).toBe(tool);
        expect(firstButton(game), `${what}: s nástrojem`).toEqual(shown);
      }
    }
  });

  it('střídání gumy z panelu a nástroje z prvního tlačítka první tlačítko také nemění', () => {
    const game = withSelected('crayon');
    const shown = firstButton(game);

    for (let round = 0; round < 4; round += 1) {
      pickTool(game, 'eraser');
      expect(firstButton(game), `kolo ${round + 1}: s gumou`).toEqual(shown);
      tapFirstButton(game);
      expect(game.selectedTool(), `kolo ${round + 1}: pastelka`).toBe('crayon');
      expect(firstButton(game), `kolo ${round + 1}: s pastelkou`).toEqual(shown);
    }
  });

  it('při přepnutí na gumu i zpátky na nástroj zazní krátký tón, kratší než 1 s', () => {
    for (const tool of DRAWING_TOOLS) {
      const game = withSelected(tool);
      for (const [name, result] of [
        ['guma', tapQuickEraser(game)],
        ['nástroj', tapFirstButton(game)],
      ] as const) {
        const what = `${TOOL_NAMES[tool]}: ${name}`;
        const tones = result.kind === 'picked' ? result.tones : [];
        expect(tones.length, `${what}: nějaký tón zazní`).toBeGreaterThan(0);
        expect(endOf(tones), `${what}: délka tónu v sekundách`).toBeLessThan(1);
      }
    }
  });

  it('nástrojem z prvního tlačítka se po gumě hned maluje jeho barvou', () => {
    const game = fresh();
    giveColor(game, 'brush', YELLOW);
    giveColor(game, 'marker', GREEN);
    tapQuickEraser(game);

    tapFirstButton(game);
    paint(game, [at(20, 100), at(140, 100)]);

    expect(game.colorAt(80, 100)).toBe(GREEN);
  });

  it('úchyt hned ukazuje nástroj z prvního tlačítka, se zavřeným panelem i s otevřeným', () => {
    for (const panel of ['closed', 'tools'] as const) {
      const game = withSelected('spray');
      tapQuickEraser(game);
      if (panel === 'tools') {
        openToolStep(game);
      } else if (game.panelOpen()) {
        game.tapHandle();
      }
      expect(game.panelView(), `kontrola: panel ${panel}`).toBe(panel);

      tapFirstButton(game);

      expect(game.handleView().tool, `panel ${panel}: úchyt`).toBe('spray');
      expect(game.panelView(), `panel ${panel}: zůstal`).toBe(panel);
    }
  });

  it('otevřený krok nástrojů hned označí nástroj z prvního tlačítka', () => {
    for (const tool of DRAWING_TOOLS) {
      const game = withSelected(tool);
      tapQuickEraser(game);
      openToolStep(game);

      tapFirstButton(game);

      expect(game.panelView(), `${TOOL_NAMES[tool]}: panel otevřený`).toBe('tools');
      expect(game.selectedTool(), `${TOOL_NAMES[tool]}: označený nástroj`).toBe(tool);
    }
  });

  it('tloušťka čáry a barvy nástrojů se střídáním nemění', () => {
    for (const tool of DRAWING_TOOLS) {
      const game = withSelected(tool);
      openToolStep(game);
      game.tapLineSize('large');
      if (game.panelOpen()) {
        game.tapHandle();
      }
      const before = lineSizeAndColors(game);

      tapQuickEraser(game);
      tapFirstButton(game);
      tapQuickEraser(game);

      expect(lineSizeAndColors(game), TOOL_NAMES[tool]).toEqual(before);
    }
  });

  it('střídání nemění obrázek ani historii Zpět', () => {
    const game = fresh();
    paint(game, [at(20, 100), at(140, 100)]);
    pickTool(game, 'marker');
    const before = game.colorAt(80, 100);

    tapQuickEraser(game);
    tapFirstButton(game);
    tapQuickEraser(game);

    expect(game.colorAt(80, 100), 'obrázek').toBe(before);
    expect(game.tapUndo().kind, 'Zpět vrátí tah štětcem').toBe('undone');
    expect(game.colorAt(80, 100), 'tah je vrácený').toBeNull();
  });

  it('barvy nástrojů se při střídání pamatují každému zvlášť', () => {
    const game = fresh();
    giveColor(game, 'crayon', YELLOW);
    giveColor(game, 'marker', GREEN);
    const colors = toolColorsOf(game);

    for (let round = 0; round < 4; round += 1) {
      tapQuickEraser(game);
      tapFirstButton(game);
      expect(game.handleView().color, `kolo ${round + 1}: fix`).toBe(GREEN);
    }
    expect(toolColorsOf(game)).toEqual(colors);
  });
});

describe('#163 AC3: už vybrané tlačítko', () => {
  it('ťuknutí na první tlačítko s už vybraným nástrojem ho jen zhoupne s tónem domečku a nic nezmění', () => {
    for (const tool of DRAWING_TOOLS) {
      const game = withSelected(tool);
      const before = firstButton(game);
      const panel = game.panelView();

      const result = tapFirstButton(game);

      expect(result, TOOL_NAMES[tool]).toEqual({ kind: 'wobble', tones: HOME_WOBBLE_TONES });
      expect(game.selectedTool(), `${TOOL_NAMES[tool]}: nástroj zůstal`).toBe(tool);
      expect(firstButton(game), `${TOOL_NAMES[tool]}: první tlačítko`).toEqual(before);
      expect(game.panelView(), `${TOOL_NAMES[tool]}: panel`).toBe(panel);
    }
  });

  it('s vybranou gumou ťuknutí na gumu jen zhoupne s tónem domečku a nic nezmění', () => {
    for (const how of ERASER_WAYS) {
      const game = withSelected('dots');
      chooseEraser(game, how);
      const before = firstButton(game);

      const result = tapQuickEraser(game);

      expect(result, how).toEqual({ kind: 'wobble', tones: HOME_WOBBLE_TONES });
      expect(game.selectedTool(), `${how}: guma zůstala`).toBe('eraser');
      expect(firstButton(game), `${how}: první tlačítko`).toEqual(before);
    }
  });

  it('ťuknutí na gumu vybere gumu a gumou se hned gumuje', () => {
    const game = fresh();
    paint(game, [at(20, 100), at(140, 100)]);
    expect(game.colorAt(80, 100), 'kontrola: namalováno').not.toBeNull();

    tapQuickEraser(game);
    paint(game, [at(20, 100), at(140, 100)]);

    expect(game.selectedTool()).toBe('eraser');
    expect(game.colorAt(80, 100), 'vygumováno').toBeNull();
  });
});

describe('#163 AC4: výběr v panelu a barvou', () => {
  it('výběr jiného kreslicího nástroje v panelu ho dá na první tlačítko', () => {
    for (const [x, z] of pairs()) {
      const game = withSelected(x);

      pickTool(game, z);

      expect(firstButton(game), `${TOOL_NAMES[x]} → ${TOOL_NAMES[z]}`).toEqual(shownAs(game, z));
    }
  });

  it('s vybranou gumou výběr nástroje v panelu ho vybere a dá na první tlačítko', () => {
    for (const [x, z] of pairs()) {
      const game = withSelected(x);
      tapQuickEraser(game);

      pickTool(game, z);

      const what = `${TOOL_NAMES[x]}, guma, pak ${TOOL_NAMES[z]}`;
      expect(game.selectedTool(), what).toBe(z);
      expect(firstButton(game), what).toEqual(shownAs(game, z));
    }
  });

  it('nová barva vybraného nástroje se hned ukáže v kolečku na prvním tlačítku', () => {
    for (const tool of COLOR_TOOLS) {
      const game = withSelected(tool);
      const newColor = game.toolColor(tool) === PINK ? GRAY : PINK;

      giveColor(game, tool, newColor);

      expect(firstButton(game), TOOL_NAMES[tool]).toEqual({ tool, color: newColor });
      expect(game.handleView().color, `${TOOL_NAMES[tool]}: úchyt`).toBe(newColor);
    }
  });

  it('guma po malovacím nástroji a ťuknutí na barvu vrátí ten nástroj a kolečko na prvním tlačítku má novou barvu', () => {
    const game = withSelected('crayon');
    tapQuickEraser(game);

    game.tapColor(PINK);

    expect(game.selectedTool()).toBe('crayon');
    expect(firstButton(game)).toEqual({ tool: 'crayon', color: PINK });
  });

  it('duha a ťuknutí na barvu: vybraný je štětec a na prvním tlačítku štětec v nové barvě', () => {
    for (const withEraser of [false, true]) {
      const game = withSelected('rainbow');
      if (withEraser) {
        tapQuickEraser(game);
      }

      game.tapColor(PINK);

      const what = withEraser ? 'duha, guma, barva' : 'duha, barva';
      expect(game.selectedTool(), what).toBe('brush');
      expect(firstButton(game), what).toEqual({ tool: 'brush', color: PINK });
    }
  });

  it('dlouhá náhodná řada výběrů v panelu, barev a ťuknutí na tlačítka jde vždy podle pravidla', () => {
    const colors = [PINK, GRAY, GREEN, YELLOW];
    for (const seed of [163, 2026, 31337]) {
      const random = seededRandom(seed);
      const game = fresh();
      // Přetypování, aby TypeScript nezúžil typ podle první hodnoty.
      let selected = 'brush' as ToolId;
      let drawing = 'brush' as ToolId;
      const select = (tool: ToolId): void => {
        selected = tool;
        if (tool !== 'eraser') {
          drawing = tool;
        }
      };
      for (let step = 0; step < 300; step += 1) {
        const roll = random();
        let what: string;
        if (roll < 0.3) {
          const tool = ALL_TOOLS[pick(random, ALL_TOOLS.length)] ?? 'brush';
          pickTool(game, tool);
          select(tool);
          what = `panel ${TOOL_NAMES[tool]}`;
        } else if (roll < 0.55) {
          const result = tapFirstButton(game);
          expect(result.kind, `seed ${seed}, krok ${step + 1}: první tlačítko`).toBe(
            selected === drawing ? 'wobble' : 'picked',
          );
          select(drawing);
          what = 'první tlačítko';
        } else if (roll < 0.8) {
          const result = tapQuickEraser(game);
          expect(result.kind, `seed ${seed}, krok ${step + 1}: guma`).toBe(
            selected === 'eraser' ? 'wobble' : 'picked',
          );
          select('eraser');
          what = 'guma';
        } else {
          const color = colors[pick(random, colors.length)] ?? PINK;
          game.tapColor(color);
          select(drawing === 'rainbow' ? 'brush' : drawing);
          what = `barva ${color}`;
        }
        const label = `seed ${seed}, krok ${step + 1}: ${what}`;
        expect(game.selectedTool(), `${label}: vybraný`).toBe(selected);
        expect(firstButton(game), `${label}: první tlačítko`).toEqual(shownAs(game, drawing));
      }
    }
  });
});

describe('#148 upřesnění bod 5: přepnutí s otevřeným panelem', () => {
  it('ťuknutí na gumu v pruhu v kroku barev nechá panel otevřený na kroku nástrojů s označenou gumou', () => {
    for (const tool of COLOR_TOOLS) {
      const game = fresh();
      pickTool(game, tool);
      expect(game.panelView(), `${TOOL_NAMES[tool]}: kontrola, krok barev`).toBe('colors');

      expect(tapQuickEraser(game).kind, TOOL_NAMES[tool]).toBe('picked');

      expect(game.panelView(), `${TOOL_NAMES[tool]}: krok nástrojů`).toBe('tools');
      expect(game.selectedTool(), `${TOOL_NAMES[tool]}: označená guma`).toBe('eraser');
    }
  });

  it('po gumě v kroku barev ťuknutí na první tlačítko nechá krok nástrojů s označeným nástrojem', () => {
    for (const tool of COLOR_TOOLS) {
      const game = fresh();
      pickTool(game, tool);
      tapQuickEraser(game);

      expect(tapFirstButton(game).kind, TOOL_NAMES[tool]).toBe('picked');

      expect(game.panelView(), `${TOOL_NAMES[tool]}: krok nástrojů`).toBe('tools');
      expect(game.selectedTool(), `${TOOL_NAMES[tool]}: označený nástroj`).toBe(tool);
    }
  });
});
