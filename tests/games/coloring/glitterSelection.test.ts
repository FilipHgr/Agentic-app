import { describe, expect, it } from 'vitest';

import {
  PANEL_TOOLS,
  markedTools,
  toolForColor,
  usesSelectedColor,
} from '../../../src/games/coloring/logic/toolPanel';
import type { ToolId } from '../../../src/games/coloring/logic/toolPanel';
import { choose, endOf } from './drawingToolHelpers';
import { GLITTER } from './glitterHelpers';
import { RecordingStorage, openOn, startStroke, twoHalves } from './savedPictureHelpers';
import { at } from './strokeHelpers';

/**
 * Testy k #103 AC1: výběr třpytek v panelu a co ukazuje úchyt. Místo
 * v rozložení panelu je v `glitterLayoutRules.test.ts`, stopa
 * v `glitterStrokes.test.ts`, lesk během tahu v `glitterShine.test.ts`,
 * uložení v `glitterRecord.test.ts`.
 *
 * Ťuknutí na místo nástroje v panelu hlásí scéna jako `game.tapTool(index)`
 * (`choose` z `drawingToolHelpers.ts`), ťuknutí na barvu jako
 * `game.tapColor(index)`.
 *
 * Navržené rozhraní (`src/games/coloring/logic/toolPanel.ts`):
 * - `ToolId` dostane `'glitter'` (třpytky), `PANEL_TOOLS` je má na
 *   vlastním místě (doporučeno za proužkovým fixem:
 *   `['brush', 'eraser', 'marker', 'crayon', 'rainbow', 'stamp', 'dots', 'stripes', 'glitter']`),
 * - `usesSelectedColor('glitter')` je `true`, takže `HandleView` je
 *   `{ tool: 'glitter', color: vybraná barva, size }` a úchyt podle `tool`
 *   ukáže třpytky v této barvě (otevřená otázka 2: jiskry jen ve vybrané barvě),
 * - ťuknutí na barvu nechá třpytky vybrané a po gumě je vrátí, když byly
 *   posledním malovacím nástrojem (pravidlo z #93 AC5).
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
  'dots',
  'stripes',
] as const satisfies readonly ToolId[];

/** Názvy nástrojů do zpráv testů. */
const NAMES: Readonly<Record<string, string>> = {
  brush: 'štětec',
  eraser: 'guma',
  marker: 'fix',
  crayon: 'pastelka',
  rainbow: 'duhový štětec',
  stamp: 'razítkový fix',
  dots: 'puntíkový fix',
  stripes: 'proužkový fix',
  glitter: 'třpytky',
};

function fresh(): ReturnType<typeof openOn> {
  return openOn(new RecordingStorage(), twoHalves());
}

describe('#103 AC1: třpytky se vybírají v panelu jako ostatní nástroje', () => {
  it('třpytky mají v panelu vlastní místo a ostatní nástroje zůstávají na svých', () => {
    expect(PANEL_TOOLS).toContain(GLITTER);
    expect(new Set(PANEL_TOOLS).size, 'žádný nástroj dvakrát').toBe(PANEL_TOOLS.length);
    expect(PANEL_TOOLS.slice(0, OTHER_TOOLS.length), 'dřívější nástroje na svých místech').toEqual(
      OTHER_TOOLS,
    );
  });

  it('ťuknutí na třpytky je hned vybere a zazní tón kratší než 1 s', () => {
    const game = fresh();

    const tones = choose(game, GLITTER);

    expect(game.selectedTool()).toBe(GLITTER);
    expect(tones.length, 'nějaký tón zazní').toBeGreaterThan(0);
    expect(endOf(tones), 'délka tónu v sekundách').toBeLessThan(1);
  });

  it('z každého nástroje jde přejít na třpytky a zpátky, vždy s tónem kratším než 1 s', () => {
    for (const other of OTHER_TOOLS) {
      for (const [from, to] of [
        [other, GLITTER],
        [GLITTER, other],
      ] as const) {
        const game = fresh();
        choose(game, from);

        const tones = choose(game, to);

        const step = `${NAMES[from]} → ${NAMES[to]}`;
        expect(game.selectedTool(), step).toBe(to);
        expect(tones.length, `${step}: tón`).toBeGreaterThan(0);
        expect(endOf(tones), `${step}: délka tónu`).toBeLessThan(1);
      }
    }
  });

  it('označený je po každém ťuknutí právě jeden nástroj, ten vybraný', () => {
    const game = fresh();
    const taps: ToolId[] = [
      GLITTER,
      'stripes',
      GLITTER,
      GLITTER,
      'eraser',
      'dots',
      GLITTER,
      'brush',
    ];
    taps.forEach((tool, step) => {
      choose(game, tool);
      const label = `ťuknutí ${step + 1} (${NAMES[tool]})`;
      const marked = markedTools(game.selectedTool());
      expect(game.selectedTool(), label).toBe(tool);
      expect(marked.length, `${label}: u každého nástroje údaj`).toBe(PANEL_TOOLS.length);
      expect(marked.filter(Boolean).length, `${label}: označených`).toBe(1);
      expect(marked[PANEL_TOOLS.indexOf(tool)], `${label}: označený vybraný`).toBe(true);
    });
  });

  it('třpytky malují vybranou barvou palety', () => {
    expect(usesSelectedColor(GLITTER)).toBe(true);
    expect(toolForColor(GLITTER), 'ťuknutí na barvu nechá třpytky').toBe(GLITTER);
  });

  it('úchyt ukazuje třpytky ve vybrané barvě, i se zavřeným panelem a v každé velikosti', () => {
    const game = fresh();
    choose(game, GLITTER);
    game.tapColor(BLUE);
    expect(game.handleView(), 'po výběru').toMatchObject({ tool: GLITTER, color: BLUE });

    if (game.panelOpen()) {
      game.tapHandle();
    }
    expect(game.panelOpen()).toBe(false);
    expect(game.handleView(), 'se zavřeným panelem').toMatchObject({
      tool: GLITTER,
      color: BLUE,
    });

    // #112: tloušťka se vybírá přímo tlačítkem, ne přepínačem dokola.
    for (const size of ['large', 'small', 'medium'] as const) {
      game.tapLineSize(size);
      expect(game.handleView(), `po výběru tloušťky ${size}`).toMatchObject({
        tool: GLITTER,
        color: BLUE,
        size,
      });
    }
  });

  it('po změně barvy ukazuje úchyt třpytky v nové barvě a třpytky zůstanou vybrané', () => {
    const game = fresh();
    choose(game, GLITTER);

    for (const color of [BLACK, RED, PINK, LIGHT_BLUE, BLUE]) {
      const tones = game.tapColor(color);

      expect(game.selectedTool(), `barva ${color}`).toBe(GLITTER);
      expect(game.handleView(), `barva ${color}`).toMatchObject({ tool: GLITTER, color });
      expect(tones.length, `barva ${color}: tón`).toBeGreaterThan(0);
    }
  });

  it('nedávná barva v pruhu nechá třpytky vybrané a úchyt ukáže třpytky v ní', () => {
    const game = fresh();
    game.tapColor(PINK);
    game.tapColor(BLUE);
    choose(game, GLITTER);

    game.tapRecentColor(0);

    expect(game.selectedTool()).toBe(GLITTER);
    expect(game.palette().selected, 'vybraná nedávná barva').toBe(PINK);
    expect(game.handleView()).toMatchObject({ tool: GLITTER, color: PINK });
  });

  it('po gumě vrátí ťuknutí na barvu třpytky, když s nimi dítě malovalo naposledy', () => {
    const game = fresh();
    choose(game, GLITTER);
    choose(game, 'eraser');

    game.tapColor(BLACK);

    expect(game.selectedTool()).toBe(GLITTER);
    expect(game.handleView()).toMatchObject({ tool: GLITTER, color: BLACK });
  });

  it('ťuknutí druhým prstem na třpytky během tahu se nepočítá a tah pokračuje', () => {
    const game = fresh();
    startStroke(game, [at(20, 40), at(60, 40)]);

    expect(choose(game, GLITTER), 'během tahu žádný tón').toEqual([]);
    expect(game.selectedTool()).toBe('brush');

    game.pointerMove({ id: 1, x: 140, y: 40, kind: 'touch' });
    game.pointerUp(1);
    expect(game.colorAt(130, 40), 'tah pokračoval štětcem v první barvě').toBe(RED);
  });

  it('po návratu z menu je vybraný štětec, i když dítě odešlo s třpytkami', () => {
    const storage = new RecordingStorage();
    const regions = twoHalves();
    const game = openOn(storage, regions);
    game.tapColor(BLUE);
    choose(game, GLITTER);
    game.suspend();

    const again = openOn(storage, regions);
    expect(again.selectedTool()).toBe('brush');
    expect(again.handleView()).toMatchObject({ tool: 'brush', color: BLUE });
  });
});
