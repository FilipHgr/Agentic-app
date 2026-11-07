import { describe, expect, it } from 'vitest';

import { PANEL_TOOLS, markedTools } from '../../../src/games/coloring/logic/toolPanel';
import type { ToolId } from '../../../src/games/coloring/logic/toolPanel';
import { choose, endOf } from './drawingToolHelpers';
import { TOOL_NAMES } from './lineSizeHelpers';
import { at } from './strokeHelpers';
import { RecordingStorage, openOn, paint, startStroke, twoHalves } from './savedPictureHelpers';

/**
 * Testy k #97 AC1 (výběr duhového štětce, úchyt) a AC4 (volba barvy
 * u duhy). Místo duhy v rozložení panelu je
 * v `rainbowLayoutRules.test.ts`, stopa v `rainbowStrokes.test.ts`.
 *
 * Ťuknutí na místo nástroje v panelu hlásí scéna jako `game.tapTool(index)`
 * (`choose` z `drawingToolHelpers.ts`), ťuknutí na barvu jako
 * `game.tapColor(index)`. Druhý prst během tahu je ťuknutí, zatímco první
 * prst ještě nezvedl (`startStroke` bez `pointerUp`).
 *
 * Navržené rozhraní (`src/games/coloring/logic/toolPanel.ts`):
 * - `ToolId` dostane `'rainbow'`, `PANEL_TOOLS` ho má na vlastním místě
 *   (doporučeno za pastelkou: `['brush', 'eraser', 'marker', 'crayon', 'rainbow']`),
 * - `HandleView` u duhy `{ tool: 'rainbow', … }`; úchyt podle `tool`
 *   ukáže symbol duhy (doporučeno `color: null`, duha nemá jednu barvu).
 * `SavedColoring.tapColor` při vybrané duze vybere štětec a po gumě, když
 * byla posledním malovacím nástrojem duha, taky štětec.
 */

const RED = 0;
const BLUE = 4;
const BLACK = 7;

const OTHER_TOOLS = ['brush', 'eraser', 'marker', 'crayon'] as const satisfies readonly ToolId[];

function fresh(): ReturnType<typeof openOn> {
  return openOn(new RecordingStorage(), twoHalves());
}

describe('#97 AC1: duhový štětec se vybírá v panelu jako ostatní nástroje', () => {
  it('duhový štětec má v panelu vlastní místo a ostatní nástroje zůstávají na svých', () => {
    expect(PANEL_TOOLS).toContain('rainbow');
    expect(new Set(PANEL_TOOLS).size, 'žádný nástroj dvakrát').toBe(PANEL_TOOLS.length);
    expect(PANEL_TOOLS.slice(0, OTHER_TOOLS.length), 'dřívější nástroje na svých místech').toEqual(
      OTHER_TOOLS,
    );
  });

  it('ťuknutí na duhový štětec ho hned vybere a zazní tón kratší než 1 s', () => {
    const game = fresh();

    const tones = choose(game, 'rainbow');

    expect(game.selectedTool()).toBe('rainbow');
    expect(tones.length, 'nějaký tón zazní').toBeGreaterThan(0);
    expect(endOf(tones), 'délka tónu v sekundách').toBeLessThan(1);
  });

  it('z každého nástroje jde přejít na duhu a z duhy zpátky, vždy s tónem kratším než 1 s', () => {
    for (const other of OTHER_TOOLS) {
      for (const [from, to] of [
        [other, 'rainbow'],
        ['rainbow', other],
      ] as const) {
        const game = fresh();
        choose(game, from);

        const tones = choose(game, to);

        const step = `${TOOL_NAMES[from]} → ${TOOL_NAMES[to]}`;
        expect(game.selectedTool(), step).toBe(to);
        expect(tones.length, `${step}: tón`).toBeGreaterThan(0);
        expect(endOf(tones), `${step}: délka tónu`).toBeLessThan(1);
      }
    }
  });

  it('i opakované ťuknutí na už vybranou duhu zahraje tón', () => {
    const game = fresh();
    choose(game, 'rainbow');

    const tones = choose(game, 'rainbow');

    expect(game.selectedTool()).toBe('rainbow');
    expect(tones.length).toBeGreaterThan(0);
  });

  it('označený je po každém ťuknutí právě jeden nástroj, ten vybraný', () => {
    const game = fresh();
    const taps: ToolId[] = [
      'rainbow',
      'marker',
      'rainbow',
      'rainbow',
      'eraser',
      'rainbow',
      'brush',
    ];
    taps.forEach((tool, step) => {
      choose(game, tool);
      const label = `ťuknutí ${step + 1} (${TOOL_NAMES[tool]})`;
      const marked = markedTools(game.selectedTool());
      expect(game.selectedTool(), label).toBe(tool);
      expect(marked.length, `${label}: u každého nástroje údaj`).toBe(PANEL_TOOLS.length);
      expect(marked.filter(Boolean).length, `${label}: označených`).toBe(1);
      expect(marked[PANEL_TOOLS.indexOf(tool)], `${label}: označený vybraný`).toBe(true);
    });
  });

  it('úchyt ukazuje duhu, i se zavřeným panelem a v každé velikosti', () => {
    const game = fresh();
    choose(game, 'rainbow');
    expect(game.handleView().tool, 'po výběru').toBe('rainbow');

    if (game.panelOpen()) {
      game.tapHandle();
    }
    expect(game.panelOpen()).toBe(false);
    expect(game.handleView().tool, 'se zavřeným panelem').toBe('rainbow');

    for (let tap = 0; tap < 3; tap += 1) {
      game.tapSizeToggle();
      expect(game.handleView(), `po přepnutí velikosti ${tap + 1}`).toMatchObject({
        tool: 'rainbow',
        size: game.lineSize(),
      });
    }
  });

  it('úchyt po přepnutí z duhy na jiný nástroj ukáže ten nástroj', () => {
    const game = fresh();
    game.tapColor(BLUE);
    choose(game, 'rainbow');

    choose(game, 'marker');

    expect(game.handleView()).toMatchObject({ tool: 'marker', color: BLUE });
  });

  it('ťuknutí druhým prstem na duhu během tahu se nepočítá a tah pokračuje', () => {
    const game = fresh();
    startStroke(game, [at(20, 40), at(60, 40)]);

    expect(choose(game, 'rainbow'), 'během tahu žádný tón').toEqual([]);
    expect(game.selectedTool()).toBe('brush');

    game.pointerMove({ id: 1, x: 140, y: 40, kind: 'touch' });
    game.pointerUp(1);
    expect(game.colorAt(130, 40), 'tah pokračoval štětcem v první barvě').toBe(RED);
  });

  it('po návratu z menu je vybraný štětec, i když dítě odešlo s duhou', () => {
    const storage = new RecordingStorage();
    const regions = twoHalves();
    const game = openOn(storage, regions);
    game.tapColor(BLUE);
    choose(game, 'rainbow');
    game.suspend();

    const again = openOn(storage, regions);
    expect(again.selectedTool()).toBe('brush');
    expect(again.handleView()).toMatchObject({ tool: 'brush', color: BLUE });
  });
});

describe('#97 AC4: volba barvy u duhy', () => {
  it('ťuknutí na barvu při vybrané duze přepne na štětec s touto barvou', () => {
    for (const color of [BLUE, BLACK]) {
      const game = fresh();
      choose(game, 'rainbow');

      const tones = game.tapColor(color);

      expect(game.selectedTool(), `barva ${color}`).toBe('brush');
      expect(game.palette().selected, `barva ${color}`).toBe(color);
      expect(tones.length, `barva ${color}: tón výběru barvy`).toBeGreaterThan(0);
      expect(endOf(tones), `barva ${color}: délka tónu`).toBeLessThan(1);
      expect(game.handleView(), `barva ${color}`).toMatchObject({ tool: 'brush', color });
      expect(markedTools(game.selectedTool())[PANEL_TOOLS.indexOf('brush')]).toBe(true);
    }
  });

  it('i ťuknutí na už vybranou barvu při duze přepne na štětec', () => {
    const game = fresh();
    game.tapColor(BLUE);
    choose(game, 'rainbow');

    game.tapColor(BLUE);

    expect(game.selectedTool()).toBe('brush');
    expect(game.palette().selected).toBe(BLUE);
  });

  it('po přepnutí z duhy barvou maluje další tah jen touto barvou', () => {
    const game = fresh();
    choose(game, 'rainbow');
    game.tapColor(BLUE);

    paint(game, [at(20, 100), at(130, 100)]);

    const onLine = Array.from({ length: 100 }, (_, step) => game.colorAt(25 + step, 100));
    expect(onLine.every((color) => color === BLUE)).toBe(true);
  });

  it('po gumě vybere barva štětec, když posledním malovacím nástrojem byla duha', () => {
    const sequences: Array<{ taps: ToolId[]; expected: ToolId }> = [
      { taps: ['rainbow', 'eraser'], expected: 'brush' },
      { taps: ['marker', 'rainbow', 'eraser'], expected: 'brush' },
      { taps: ['crayon', 'rainbow', 'eraser', 'eraser'], expected: 'brush' },
      { taps: ['rainbow', 'crayon', 'eraser'], expected: 'crayon' },
      { taps: ['rainbow', 'eraser', 'marker', 'eraser'], expected: 'marker' },
    ];
    for (const { taps, expected } of sequences) {
      const game = fresh();
      taps.forEach((tool) => choose(game, tool));

      const tones = game.tapColor(BLACK);

      const label = taps.map((tool) => TOOL_NAMES[tool]).join(' → ');
      expect(game.selectedTool(), label).toBe(expected);
      expect(game.palette().selected, label).toBe(BLACK);
      expect(tones.length, `${label}: tón`).toBeGreaterThan(0);
    }
  });

  it('po duze a výběru barvy vrátí barva po gumě štětec', () => {
    const game = fresh();
    choose(game, 'rainbow');
    game.tapColor(BLUE);
    choose(game, 'eraser');

    game.tapColor(BLACK);

    expect(game.selectedTool()).toBe('brush');
  });
});
