import { describe, expect, it } from 'vitest';

import { ALL_COLORS } from '../../../src/games/coloring/logic/toolColorSets';
import type { SavedColoring } from '../../../src/games/coloring/logic/savedPicture';
import {
  LINE_SIZES,
  PANEL_TOOLS,
  lineSizeWaveLook,
  markedLineSizes,
} from '../../../src/games/coloring/logic/toolPanel';
import type { LineSize, ToolId } from '../../../src/games/coloring/logic/toolPanel';
import { choose, endOf } from './drawingToolHelpers';
import { SIZES, SIZE_NAMES, TOOL_NAMES } from './lineSizeHelpers';
import { at } from './strokeHelpers';
import {
  RecordingStorage,
  openOn,
  paint,
  pixelsOf,
  startStroke,
  twoHalves,
} from './savedPictureHelpers';
import {
  BLUE,
  GREEN,
  LIGHT_BLUE,
  YELLOW,
  giveColor,
  openToolStep,
  pickTool,
  toolColorsOf,
} from './toolColorsHelpers';

/**
 * Testy chování k #112 (tři tlačítka tloušťky čáry v Omalovánkách místo
 * přepínače): AC1 (označená je právě jedna tloušťka, barva vlnky podle
 * nástroje), AC2 (výběr jedním ťuknutím, tón té tloušťky, panel zůstane
 * na kroku nástrojů), AC3 (vlnky mají hned novou barvu) a AC5 (ťuknutí na
 * už vybranou tloušťku, druhý prst během tahu, Zpět). Rozložení, kam patří
 * dotyk, tvar vlnky a kontrast jsou v `lineSizeButtonsLayoutRules.test.ts`.
 * Šířky W, platnost pro všechny nástroje, paměť podle profilu a staré
 * záznamy p1–p3 hlídají testy #91 (`lineSize.test.ts`,
 * `lineSizeRecord.test.ts`) a testy nástrojů, které od #112 vybírají
 * tloušťku přes `tapLineSize`.
 *
 * Ťuknutí na tlačítko tloušťky (`touchTargetAt(…)` je
 * `{ kind: 'lineSize', size }`) hlásí scéna jako `game.tapLineSize(size)`
 * a tlačítko zhoupne, když hra vrátí tóny.
 *
 * Navržené rozhraní:
 * - `savedPicture.ts`, `SavedColoring.tapLineSize(size: LineSize):
 *   readonly Tone[]` (nahrazuje `tapSizeToggle`): vybere `size`, hned uloží
 *   a vrátí tón té tloušťky (i když už vybraná byla); panel, nástroj ani
 *   barvy nemění. Během tahu nic nezmění a vrátí `[]`.
 * - `toolPanel.ts`:
 *   - `markedLineSizes(selected: LineSize): readonly boolean[]` u každé
 *     tloušťky z `LINE_SIZES`, jestli je označená (jako `markedTools`),
 *   - `lineSizeWaveLook(view: { tool: ToolId; color: number | null }):
 *     { color: string; outlined: boolean }` barva vlnky podle toho, co
 *     ukazuje úchyt (`game.handleView()`),
 *   - tóny tlouštěk beze změny (dnes `SIZE_TOGGLE_TONES`, doporučený nový
 *     název `LINE_SIZE_TONES`).
 */

const DARK = '#1D1D1F';

/** Dnešní tóny tlouštěk z #91 (AC2 „zazní dnešní tón té tloušťky“, tóny se nemění). */
const TODAY_TONES: Readonly<Record<LineSize, { frequencyHz: number; durationSeconds: number }>> = {
  small: { frequencyHz: 880, durationSeconds: 0.14 },
  medium: { frequencyHz: 659.25, durationSeconds: 0.14 },
  large: { frequencyHz: 493.88, durationSeconds: 0.14 },
};

function fresh(storage = new RecordingStorage()): SavedColoring {
  return openOn(storage, twoHalves());
}

/** Barva vlnky, jak ji tlačítka ukazují pro aktuální stav hry. */
function waveColorOf(game: SavedColoring): string {
  return lineSizeWaveLook(game.handleView()).color.toUpperCase();
}

/** Stav, který ťuknutí na tloušťku nesmí změnit. */
function everythingButSize(game: SavedColoring): unknown {
  return {
    tool: game.selectedTool(),
    panel: game.panelView(),
    palette: game.palette(),
    toolColors: toolColorsOf(game),
    recent: game.recentColors(),
    handleTool: game.handleView().tool,
    handleColor: game.handleView().color,
  };
}

describe('#112 AC1: označená je vždy právě jedna tloušťka', () => {
  it('na začátku je označená střední tloušťka', () => {
    expect(markedLineSizes(fresh().lineSize())).toEqual([false, true, false]);
  });

  it('po každém ťuknutí je označené právě to tlačítko, na které dítě ťuklo', () => {
    const game = fresh();
    openToolStep(game);
    for (const size of ['small', 'large', 'large', 'medium', 'small'] as const) {
      game.tapLineSize(size);
      const marked = markedLineSizes(game.lineSize());
      const what = `po ťuknutí na ${SIZE_NAMES[size]}`;
      expect(marked.length, `${what}: údaj u každého tlačítka`).toBe(LINE_SIZES.length);
      expect(marked.filter(Boolean).length, `${what}: označených`).toBe(1);
      expect(marked[LINE_SIZES.indexOf(size)], `${what}: označené vybrané`).toBe(true);
    }
  });

  it('po návratu do hry je označená tloušťka, kterou dítě nechalo', () => {
    for (const size of SIZES) {
      const storage = new RecordingStorage();
      const game = fresh(storage);
      openToolStep(game);
      game.tapLineSize(size);
      game.suspend();

      const marked = markedLineSizes(fresh(storage).lineSize());
      expect(marked.filter(Boolean).length, `${SIZE_NAMES[size]}: označených`).toBe(1);
      expect(marked[LINE_SIZES.indexOf(size)], SIZE_NAMES[size]).toBe(true);
    }
  });
});

describe('#112 AC1 a AC3: barva vlnky podle vybraného nástroje', () => {
  it('na začátku jsou vlnky v barvě štětce', () => {
    const game = fresh();
    const brushColor = game.toolColor('brush') ?? -1;
    expect(waveColorOf(game)).toBe(ALL_COLORS[brushColor]?.hex.toUpperCase());
  });

  it('u malovacího nástroje jsou vlnky v jeho barvě, u gumy a duhy tmavé', () => {
    for (const tool of PANEL_TOOLS) {
      const game = fresh();
      pickTool(game, tool);
      const color = game.toolColor(tool);
      // Upraveno k #116: barva nástroje může být ze sady nástroje, ne jen ze 12 barev štětce.
      const expected = color === null ? DARK : ALL_COLORS[color]?.hex.toUpperCase();
      expect(waveColorOf(game), TOOL_NAMES[tool]).toBe(expected);
    }
  });

  it('po výběru jiného nástroje nebo barvy mají vlnky hned novou barvu', () => {
    const game = fresh();
    type Step = { readonly tool: ToolId } | { readonly tool: ToolId; readonly color: number };
    const steps: Array<{ step: Step; expected: string }> = [
      { step: { tool: 'marker', color: YELLOW }, expected: '#FFCC00' },
      { step: { tool: 'eraser' }, expected: DARK },
      { step: { tool: 'brush', color: LIGHT_BLUE }, expected: '#44B6EC' },
      { step: { tool: 'rainbow' }, expected: DARK },
      { step: { tool: 'marker' }, expected: '#FFCC00' },
      { step: { tool: 'marker', color: BLUE }, expected: '#007AFF' },
      { step: { tool: 'crayon', color: GREEN }, expected: '#34C759' },
    ];
    steps.forEach(({ step, expected }, index) => {
      if ('color' in step) {
        giveColor(game, step.tool, step.color);
      } else {
        pickTool(game, step.tool);
      }
      expect(waveColorOf(game), `krok ${index + 1}: ${JSON.stringify(step)}`).toBe(expected);
    });
  });
});

describe('#112 AC2: výběr tloušťky jedním ťuknutím', () => {
  it('ťuknutí na tlačítko vybere jeho tloušťku a zazní dnešní tón té tloušťky kratší než 1 s', () => {
    for (const size of SIZES) {
      const game = fresh();
      openToolStep(game);
      const other = size === 'small' ? 'large' : 'small';
      game.tapLineSize(other);
      const tones = game.tapLineSize(size);
      const what = SIZE_NAMES[size];
      expect(game.lineSize(), `${what}: vybraná`).toBe(size);
      expect(tones.length, `${what}: zazní tón`).toBeGreaterThan(0);
      expect(endOf(tones), `${what}: délka tónu`).toBeLessThan(1);
      expect(
        tones.map((tone) => ({
          frequencyHz: tone.frequencyHz,
          durationSeconds: tone.durationSeconds,
        })),
        `${what}: dnešní tón`,
      ).toEqual([TODAY_TONES[size]]);
    }
  });

  it('každá tloušťka zní jinak', () => {
    const game = fresh();
    const frequencies = SIZES.map((size) => game.tapLineSize(size)[0]?.frequencyHz);
    expect(new Set(frequencies).size).toBe(SIZES.length);
  });

  it('panel zůstane otevřený na kroku nástrojů a nástroj ani barvy se nezmění', () => {
    for (const tool of PANEL_TOOLS) {
      const game = fresh();
      pickTool(game, tool);
      openToolStep(game);
      const before = everythingButSize(game);
      expect(game.panelView(), `${TOOL_NAMES[tool]}: krok nástrojů`).toBe('tools');
      for (const size of ['small', 'large', 'medium'] as const) {
        game.tapLineSize(size);
        expect(everythingButSize(game), `${TOOL_NAMES[tool]}, ${SIZE_NAMES[size]}`).toEqual(before);
      }
    }
  });

  it('další tah po výběru maluje novou tloušťkou: tlustší tloušťka zabarví víc', () => {
    const painted = SIZES.map((size) => {
      const regions = twoHalves();
      const game = openOn(new RecordingStorage(), regions);
      openToolStep(game);
      game.tapLineSize(size);
      paint(game, [at(40, 100), at(120, 100)]);
      return pixelsOf(game, regions).filter((pixel) => pixel !== null).length;
    });
    const [small, medium, large] = painted;
    expect(small, 'malá < střední').toBeLessThan(medium ?? 0);
    expect(medium, 'střední < velká').toBeLessThan(large ?? 0);
  });
});

describe('#112 AC5: okrajové případy', () => {
  it('ťuknutí na už vybranou tloušťku jen zahraje tón, nic jiného se nezmění', () => {
    for (const size of SIZES) {
      const storage = new RecordingStorage();
      const regions = twoHalves();
      const game = openOn(storage, regions);
      paint(game, [at(20, 100), at(140, 100)]);
      openToolStep(game);
      game.tapLineSize(size === 'small' ? 'large' : 'small');
      game.tapLineSize(size);
      const before = everythingButSize(game);
      const picture = pixelsOf(game, regions);
      const saved = new Map(storage.data);

      const tones = game.tapLineSize(size);

      const what = `znovu ${SIZE_NAMES[size]}`;
      expect(tones, `${what}: tón té tloušťky`).toEqual(game.tapLineSize(size));
      expect(tones.length, `${what}: zazní tón`).toBeGreaterThan(0);
      expect(game.lineSize(), `${what}: tloušťka`).toBe(size);
      expect(everythingButSize(game), `${what}: panel, nástroj a barvy`).toEqual(before);
      expect(pixelsOf(game, regions), `${what}: obrázek`).toEqual(picture);
      expect(storage.data, `${what}: úložiště`).toEqual(saved);
    }
  });

  it('ťuknutí na už vybranou tloušťku se do Zpět nepočítá: Zpět vrátí poslední tah', () => {
    const regions = twoHalves();
    const game = openOn(new RecordingStorage(), regions);
    const empty = pixelsOf(game, regions);
    paint(game, [at(20, 100), at(140, 100)]);
    openToolStep(game);
    game.tapLineSize('medium');
    game.tapLineSize('medium');

    expect(game.tapUndo().kind, 'Zpět vrátí tah').toBe('undone');
    expect(pixelsOf(game, regions), 'obrázek před tahem').toEqual(empty);
    expect(game.lineSize(), 'tloušťka zůstala').toBe('medium');
    expect(game.tapUndo().kind, 'víc není co vracet').toBe('wobble');
  });

  it('ťuknutí druhým prstem na tlačítko tloušťky během tahu tloušťku nezmění a tón nezahraje', () => {
    const game = fresh();
    openToolStep(game);
    game.tapLineSize('small');
    startStroke(game, [at(20, 100), at(60, 100)]);

    for (const size of SIZES) {
      expect(game.tapLineSize(size), `${SIZE_NAMES[size]}: žádný tón`).toEqual([]);
      expect(game.lineSize(), `${SIZE_NAMES[size]}: tloušťka`).toBe('small');
      expect(markedLineSizes(game.lineSize()), `${SIZE_NAMES[size]}: označená`).toEqual([
        true,
        false,
        false,
      ]);
    }
    game.pointerUp(1);
  });

  it('probíhající tah maluje dál původní tloušťkou, i když druhý prst ťukne na jinou', () => {
    const regions = twoHalves();
    const reference = openOn(new RecordingStorage(), regions);
    reference.tapLineSize('small');
    paint(reference, [at(20, 100), at(60, 100), at(140, 100)]);

    const game = openOn(new RecordingStorage(), regions);
    game.tapLineSize('small');
    startStroke(game, [at(20, 100), at(60, 100)]);
    game.tapLineSize('large');
    game.pointerMove({ id: 1, x: 140, y: 100, kind: 'touch' });
    game.pointerUp(1);

    expect(pixelsOf(game, regions)).toEqual(pixelsOf(reference, regions));
  });

  it('změna tloušťky obrázek nemění a do Zpět se nepočítá', () => {
    const regions = twoHalves();
    const game = openOn(new RecordingStorage(), regions);
    paint(game, [at(20, 100), at(140, 100)]);
    const picture = pixelsOf(game, regions);
    openToolStep(game);
    for (const size of ['large', 'small', 'medium'] as const) {
      game.tapLineSize(size);
      expect(pixelsOf(game, regions), SIZE_NAMES[size]).toEqual(picture);
    }

    expect(game.tapUndo().kind, 'Zpět vrátí tah, ne tloušťku').toBe('undone');
    expect(game.lineSize(), 'tloušťka zůstala').toBe('medium');
  });

  it('volba tloušťky platí i po přepnutí nástroje, výběr nástroje ji nezmění', () => {
    const game = fresh();
    openToolStep(game);
    game.tapLineSize('large');
    for (const tool of PANEL_TOOLS) {
      choose(game, tool);
      expect(game.lineSize(), TOOL_NAMES[tool]).toBe('large');
    }
  });
});
