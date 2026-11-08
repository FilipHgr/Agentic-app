import { describe, expect, it } from 'vitest';

import {
  PANEL_TOOLS,
  markedTools,
  toolForColor,
  usesSelectedColor,
} from '../../../src/games/coloring/logic/toolPanel';
import type { ToolId } from '../../../src/games/coloring/logic/toolPanel';
import { DOTS } from './dotsHelpers';
import { choose, endOf } from './drawingToolHelpers';
import { TOOL_NAMES } from './lineSizeHelpers';
import { at } from './strokeHelpers';
import { RecordingStorage, openOn, startStroke, twoHalves } from './savedPictureHelpers';

/**
 * Testy k #101 AC1: výběr puntíkového fixu v panelu a co ukazuje úchyt.
 * Místo v rozložení panelu je v `dotsLayoutRules.test.ts`, stopa
 * v `dotsStrokes.test.ts`, uložení v `dotsRecord.test.ts`.
 *
 * Ťuknutí na místo nástroje v panelu hlásí scéna jako `game.tapTool(index)`
 * (`choose` z `drawingToolHelpers.ts`), ťuknutí na barvu jako
 * `game.tapColor(index)`.
 *
 * Navržené rozhraní (`src/games/coloring/logic/toolPanel.ts`):
 * - `ToolId` dostane `'dots'` (puntíkový fix), `PANEL_TOOLS` ho má na
 *   vlastním místě (doporučeno za razítkovým fixem:
 *   `['brush', 'eraser', 'marker', 'crayon', 'rainbow', 'stamp', 'dots']`),
 * - `usesSelectedColor('dots')` je `true`, takže `HandleView` je
 *   `{ tool: 'dots', color: vybraná barva, size }` a úchyt podle `tool`
 *   ukáže puntíky v této barvě,
 * - ťuknutí na barvu nechá puntíkový fix vybraný a po gumě ho vrátí, když
 *   byl posledním malovacím nástrojem (pravidlo z #93 AC5).
 */

const RED = 0;
const BLUE = 4;
const BLACK = 7;
const PINK = 8;
const LIGHT_BLUE = 11;

const OTHER_TOOLS = [
  'brush',
  'eraser',
  'marker',
  'crayon',
  'rainbow',
  'stamp',
] as const satisfies readonly ToolId[];

function fresh(): ReturnType<typeof openOn> {
  return openOn(new RecordingStorage(), twoHalves());
}

describe('#101 AC1: puntíkový fix se vybírá v panelu jako ostatní nástroje', () => {
  it('puntíkový fix má v panelu vlastní místo a ostatní nástroje zůstávají na svých', () => {
    expect(PANEL_TOOLS).toContain(DOTS);
    expect(new Set(PANEL_TOOLS).size, 'žádný nástroj dvakrát').toBe(PANEL_TOOLS.length);
    expect(PANEL_TOOLS.slice(0, OTHER_TOOLS.length), 'dřívější nástroje na svých místech').toEqual(
      OTHER_TOOLS,
    );
  });

  it('ťuknutí na puntíkový fix ho hned vybere a zazní tón kratší než 1 s', () => {
    const game = fresh();

    const tones = choose(game, DOTS);

    expect(game.selectedTool()).toBe(DOTS);
    expect(tones.length, 'nějaký tón zazní').toBeGreaterThan(0);
    expect(endOf(tones), 'délka tónu v sekundách').toBeLessThan(1);
  });

  it('z každého nástroje jde přejít na puntíkový fix a zpátky, vždy s tónem kratším než 1 s', () => {
    for (const other of OTHER_TOOLS) {
      for (const [from, to] of [
        [other, DOTS],
        [DOTS, other],
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
    const taps: ToolId[] = [DOTS, 'stamp', DOTS, DOTS, 'eraser', 'crayon', DOTS, 'brush'];
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

  it('puntíkový fix maluje vybranou barvou palety', () => {
    expect(usesSelectedColor(DOTS)).toBe(true);
    expect(toolForColor(DOTS), 'ťuknutí na barvu nechá puntíkový fix').toBe(DOTS);
  });

  it('úchyt ukazuje puntíky ve vybrané barvě, i se zavřeným panelem a v každé velikosti', () => {
    const game = fresh();
    choose(game, DOTS);
    game.tapColor(BLUE);
    expect(game.handleView(), 'po výběru').toMatchObject({ tool: DOTS, color: BLUE });

    if (game.panelOpen()) {
      game.tapHandle();
    }
    expect(game.panelOpen()).toBe(false);
    expect(game.handleView(), 'se zavřeným panelem').toMatchObject({ tool: DOTS, color: BLUE });

    for (let tap = 0; tap < 3; tap += 1) {
      game.tapSizeToggle();
      expect(game.handleView(), `po přepnutí velikosti ${tap + 1}`).toMatchObject({
        tool: DOTS,
        color: BLUE,
        size: game.lineSize(),
      });
    }
  });

  it('po změně barvy ukazuje úchyt puntíky v nové barvě a puntíkový fix zůstane vybraný', () => {
    const game = fresh();
    choose(game, DOTS);

    for (const color of [BLACK, RED, PINK, LIGHT_BLUE, BLUE]) {
      const tones = game.tapColor(color);

      expect(game.selectedTool(), `barva ${color}`).toBe(DOTS);
      expect(game.handleView(), `barva ${color}`).toMatchObject({ tool: DOTS, color });
      expect(tones.length, `barva ${color}: tón`).toBeGreaterThan(0);
    }
  });

  it('nedávná barva v pruhu nechá puntíkový fix vybraný a úchyt ukáže puntíky v ní', () => {
    const game = fresh();
    game.tapColor(PINK);
    game.tapColor(BLUE);
    choose(game, DOTS);

    game.tapRecentColor(0);

    expect(game.selectedTool()).toBe(DOTS);
    expect(game.handleView()).toMatchObject({ tool: DOTS, color: game.palette().selected });
    expect(game.palette().selected, 'vybraná nedávná barva').toBe(PINK);
  });

  it('po gumě vrátí ťuknutí na barvu puntíkový fix, když s ním dítě malovalo naposledy', () => {
    const game = fresh();
    choose(game, DOTS);
    choose(game, 'eraser');

    game.tapColor(BLACK);

    expect(game.selectedTool()).toBe(DOTS);
    expect(game.handleView()).toMatchObject({ tool: DOTS, color: BLACK });
  });

  it('ťuknutí druhým prstem na puntíkový fix během tahu se nepočítá a tah pokračuje', () => {
    const game = fresh();
    startStroke(game, [at(20, 40), at(60, 40)]);

    expect(choose(game, DOTS), 'během tahu žádný tón').toEqual([]);
    expect(game.selectedTool()).toBe('brush');

    game.pointerMove({ id: 1, x: 140, y: 40, kind: 'touch' });
    game.pointerUp(1);
    expect(game.colorAt(130, 40), 'tah pokračoval štětcem v první barvě').toBe(RED);
  });

  it('po návratu z menu je vybraný štětec, i když dítě odešlo s puntíkovým fixem', () => {
    const storage = new RecordingStorage();
    const regions = twoHalves();
    const game = openOn(storage, regions);
    game.tapColor(BLUE);
    choose(game, DOTS);
    game.suspend();

    const again = openOn(storage, regions);
    expect(again.selectedTool()).toBe('brush');
    expect(again.handleView()).toMatchObject({ tool: 'brush', color: BLUE });
  });
});
