import { describe, expect, it } from 'vitest';

import { PANEL_TOOLS, markedTools } from '../../../src/games/coloring/logic/toolPanel';
import type { ToolId } from '../../../src/games/coloring/logic/toolPanel';
import { choose, endOf } from './drawingToolHelpers';
import { TOOL_NAMES } from './lineSizeHelpers';
import { at } from './strokeHelpers';
import { RecordingStorage, openOn, startStroke, twoHalves } from './savedPictureHelpers';

/**
 * Testy k #98 AC1: výběr razítkového fixu v panelu a co ukazuje úchyt.
 * Místo v rozložení panelu je v `stampLayoutRules.test.ts`, stopa
 * v `stampStrokes.test.ts`.
 *
 * Ťuknutí na místo nástroje v panelu hlásí scéna jako `game.tapTool(index)`
 * (`choose` z `drawingToolHelpers.ts`), ťuknutí na barvu jako
 * `game.tapColor(index)`.
 *
 * Navržené rozhraní (`src/games/coloring/logic/toolPanel.ts`):
 * - `ToolId` dostane `'stamp'` (razítkový fix), `PANEL_TOOLS` ho má na
 *   vlastním místě (doporučeno za duhou:
 *   `['brush', 'eraser', 'marker', 'crayon', 'rainbow', 'stamp']`),
 * - `usesSelectedColor('stamp')` je `true`, takže `HandleView` je
 *   `{ tool: 'stamp', color: vybraná barva, size }` a úchyt podle `tool`
 *   ukáže hvězdičku v této barvě,
 * - ťuknutí na barvu nechá razítkový fix vybraný a po gumě ho vrátí, když
 *   byl posledním malovacím nástrojem (pravidlo z #93 AC5).
 */

const RED = 0;
const BLUE = 4;
const BLACK = 7;

const OTHER_TOOLS = [
  'brush',
  'eraser',
  'marker',
  'crayon',
  'rainbow',
] as const satisfies readonly ToolId[];

const STAMP: ToolId = 'stamp';

function fresh(): ReturnType<typeof openOn> {
  return openOn(new RecordingStorage(), twoHalves());
}

describe('#98 AC1: razítkový fix se vybírá v panelu jako ostatní nástroje', () => {
  it('razítkový fix má v panelu vlastní místo a ostatní nástroje zůstávají na svých', () => {
    expect(PANEL_TOOLS).toContain(STAMP);
    expect(new Set(PANEL_TOOLS).size, 'žádný nástroj dvakrát').toBe(PANEL_TOOLS.length);
    expect(PANEL_TOOLS.slice(0, OTHER_TOOLS.length), 'dřívější nástroje na svých místech').toEqual(
      OTHER_TOOLS,
    );
  });

  it('ťuknutí na razítkový fix ho hned vybere a zazní tón kratší než 1 s', () => {
    const game = fresh();

    const tones = choose(game, STAMP);

    expect(game.selectedTool()).toBe(STAMP);
    expect(tones.length, 'nějaký tón zazní').toBeGreaterThan(0);
    expect(endOf(tones), 'délka tónu v sekundách').toBeLessThan(1);
  });

  it('z každého nástroje jde přejít na razítkový fix a zpátky, vždy s tónem kratším než 1 s', () => {
    for (const other of OTHER_TOOLS) {
      for (const [from, to] of [
        [other, STAMP],
        [STAMP, other],
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

  it('označený je po každém ťuknutí právě jeden nástroj, ten vybraný', () => {
    const game = fresh();
    const taps: ToolId[] = [STAMP, 'marker', STAMP, STAMP, 'eraser', 'rainbow', STAMP, 'brush'];
    taps.forEach((tool, step) => {
      choose(game, tool);
      const label = `ťuknutí ${step + 1} (${TOOL_NAMES[tool]})`;
      const marked = markedTools(game.selectedTool());
      expect(game.selectedTool(), label).toBe(tool);
      expect(marked.filter(Boolean).length, `${label}: označených`).toBe(1);
      expect(marked[PANEL_TOOLS.indexOf(tool)], `${label}: označený vybraný`).toBe(true);
    });
  });

  it('úchyt ukazuje hvězdičku ve vybrané barvě, i se zavřeným panelem a v každé velikosti', () => {
    const game = fresh();
    choose(game, STAMP);
    game.tapColor(BLUE);
    expect(game.handleView(), 'po výběru').toMatchObject({ tool: STAMP, color: BLUE });

    if (game.panelOpen()) {
      game.tapHandle();
    }
    expect(game.panelOpen()).toBe(false);
    expect(game.handleView(), 'se zavřeným panelem').toMatchObject({ tool: STAMP, color: BLUE });

    for (let tap = 0; tap < 3; tap += 1) {
      game.tapSizeToggle();
      expect(game.handleView(), `po přepnutí velikosti ${tap + 1}`).toMatchObject({
        tool: STAMP,
        color: BLUE,
        size: game.lineSize(),
      });
    }
  });

  it('po změně barvy ukazuje úchyt hvězdičku v nové barvě a razítkový fix zůstane vybraný', () => {
    const game = fresh();
    choose(game, STAMP);

    for (const color of [BLACK, RED, BLUE]) {
      const tones = game.tapColor(color);

      expect(game.selectedTool(), `barva ${color}`).toBe(STAMP);
      expect(game.handleView(), `barva ${color}`).toMatchObject({ tool: STAMP, color });
      expect(tones.length, `barva ${color}: tón`).toBeGreaterThan(0);
    }
  });

  it('po gumě vrátí ťuknutí na barvu razítkový fix, když s ním dítě malovalo naposledy', () => {
    const game = fresh();
    choose(game, STAMP);
    choose(game, 'eraser');

    game.tapColor(BLACK);

    expect(game.selectedTool()).toBe(STAMP);
    expect(game.handleView()).toMatchObject({ tool: STAMP, color: BLACK });
  });

  it('ťuknutí druhým prstem na razítkový fix během tahu se nepočítá a tah pokračuje', () => {
    const game = fresh();
    startStroke(game, [at(20, 40), at(60, 40)]);

    expect(choose(game, STAMP), 'během tahu žádný tón').toEqual([]);
    expect(game.selectedTool()).toBe('brush');

    game.pointerMove({ id: 1, x: 140, y: 40, kind: 'touch' });
    game.pointerUp(1);
    expect(game.colorAt(130, 40), 'tah pokračoval štětcem v první barvě').toBe(RED);
  });

  it('po návratu z menu je vybraný štětec, i když dítě odešlo s razítkovým fixem', () => {
    const storage = new RecordingStorage();
    const regions = twoHalves();
    const game = openOn(storage, regions);
    game.tapColor(BLUE);
    choose(game, STAMP);
    game.suspend();

    const again = openOn(storage, regions);
    expect(again.selectedTool()).toBe('brush');
    expect(again.handleView()).toMatchObject({ tool: 'brush', color: BLUE });
  });
});
