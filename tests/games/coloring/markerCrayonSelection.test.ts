import { describe, expect, it } from 'vitest';

import { PANEL_TOOLS, markedTools } from '../../../src/games/coloring/logic/toolPanel';
import type { ToolId } from '../../../src/games/coloring/logic/toolPanel';
import { openProfiles } from '../../../src/shared/storage/profileStorage';
import { DeviceStorage } from '../../shared/profileFixtures';
import { at } from './strokeHelpers';
import { choose, endOf } from './drawingToolHelpers';
import {
  RecordingStorage,
  enterColoring,
  openOn,
  paint,
  startStroke,
  twoHalves,
} from './savedPictureHelpers';

/**
 * Testy k #93 (fix a pastelka v Omalovánkách) v upraveném znění AC1
 * z komentáře k issue: výběr fixu a pastelky v panelu z #96, úchyt, a AC5
 * (druhá část): výběr barvy po gumě vrátí naposledy vybraný malovací
 * nástroj, po návratu do hry je vybraný štětec. Stopy jsou
 * v `markerCrayonStrokes.test.ts`, místa v rozložení
 * v `markerCrayonLayoutRules.test.ts`.
 *
 * Ťuknutí na místo nástroje v panelu hlásí scéna jako `game.tapTool(index)`
 * jako u gumy (#90), `index` je pořadí místa v `toolSlots`.
 *
 * Navržené rozhraní (`src/games/coloring/logic/toolPanel.ts`):
 * - `ToolId = 'brush' | 'eraser' | 'marker' | 'crayon'` (fix a pastelka),
 * - `PANEL_TOOLS` obsahuje i `'marker'` a `'crayon'`, každý na svém místě
 *   panelu (doporučené pořadí `['brush', 'eraser', 'marker', 'crayon']`),
 * - `HandleView` u fixu a pastelky `{ tool, color: vybraná barva }`.
 * `SavedColoring.tapColor` po gumě vybere naposledy vybraný malovací
 * nástroj (štětec, fix nebo pastelku), ne vždy štětec.
 */

const RED = 0;
const BLUE = 4;
const BLACK = 7;

const NEW_TOOLS = ['marker', 'crayon'] as const satisfies readonly ToolId[];
const PAINTING_TOOLS = ['brush', 'marker', 'crayon'] as const satisfies readonly ToolId[];

const NAMES: Record<ToolId, string> = {
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

describe('#93 AC1: fix a pastelka se vybírají v panelu jako štětec a guma', () => {
  it('v panelu je místo pro fix i pastelku a každý nástroj je v panelu jen jednou', () => {
    for (const tool of NEW_TOOLS) {
      expect(PANEL_TOOLS, NAMES[tool]).toContain(tool);
    }
    expect(new Set(PANEL_TOOLS).size, 'žádný nástroj dvakrát').toBe(PANEL_TOOLS.length);
    expect(PANEL_TOOLS.slice(0, 2), 'štětec a guma zůstávají na svých místech').toEqual([
      'brush',
      'eraser',
    ]);
  });

  it('ťuknutí na fix nebo pastelku ho hned vybere a zazní tón kratší než 1 s', () => {
    for (const tool of NEW_TOOLS) {
      const game = openOn(new RecordingStorage(), twoHalves());

      const tones = choose(game, tool);

      expect(game.selectedTool(), NAMES[tool]).toBe(tool);
      expect(tones.length, `${NAMES[tool]}: nějaký tón zazní`).toBeGreaterThan(0);
      expect(endOf(tones), `${NAMES[tool]}: délka tónu v sekundách`).toBeLessThan(1);
    }
  });

  it('z každého nástroje jde přejít na každý jiný a vždy zazní tón kratší než 1 s', () => {
    for (const from of PANEL_TOOLS) {
      for (const to of PANEL_TOOLS) {
        const game = openOn(new RecordingStorage(), twoHalves());
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
    const game = openOn(new RecordingStorage(), twoHalves());
    const taps: ToolId[] = ['marker', 'crayon', 'crayon', 'eraser', 'marker', 'brush', 'crayon'];
    const check = (step: string): void => {
      const marked = markedTools(game.selectedTool());
      expect(marked.length, `${step}: u každého nástroje údaj`).toBe(PANEL_TOOLS.length);
      expect(marked.filter(Boolean).length, `${step}: označených`).toBe(1);
      expect(marked[PANEL_TOOLS.indexOf(game.selectedTool())], `${step}: označený vybraný`).toBe(
        true,
      );
    };
    check('na začátku');
    taps.forEach((tool, step) => {
      choose(game, tool);
      expect(game.selectedTool(), `ťuknutí ${step + 1}`).toBe(tool);
      check(`ťuknutí ${step + 1} (${NAMES[tool]})`);
    });
  });

  it('úchyt ukazuje fix i pastelku ve vybrané barvě, i se zavřeným panelem', () => {
    for (const tool of NEW_TOOLS) {
      const game = openOn(new RecordingStorage(), twoHalves());
      game.tapColor(BLUE);
      choose(game, tool);
      expect(game.handleView(), NAMES[tool]).toMatchObject({ tool, color: BLUE });

      game.tapColor(BLACK);
      expect(game.handleView(), `${NAMES[tool]} po změně barvy`).toMatchObject({
        tool,
        color: BLACK,
      });

      if (game.panelOpen()) {
        game.tapHandle();
      }
      expect(game.panelOpen()).toBe(false);
      expect(game.handleView(), `${NAMES[tool]} se zavřeným panelem`).toMatchObject({
        tool,
        color: BLACK,
      });
    }
  });

  it('volba fixu nebo pastelky nezmění vybranou barvu', () => {
    const game = openOn(new RecordingStorage(), twoHalves());
    game.tapColor(BLUE);
    for (const tool of NEW_TOOLS) {
      choose(game, tool);
      expect(game.palette().selected, NAMES[tool]).toBe(BLUE);
    }
  });

  it('ťuknutí druhým prstem na fix nebo pastelku během tahu se nepočítá a tah pokračuje', () => {
    for (const tool of NEW_TOOLS) {
      const game = openOn(new RecordingStorage(), twoHalves());
      startStroke(game, [at(20, 40), at(60, 40)]);

      expect(choose(game, tool), `${NAMES[tool]}: během tahu žádný tón`).toEqual([]);
      expect(game.selectedTool(), NAMES[tool]).toBe('brush');

      game.pointerMove({ id: 1, x: 140, y: 40, kind: 'touch' });
      game.pointerUp(1);
      expect(game.colorAt(130, 40), `${NAMES[tool]}: tah pokračoval štětcem`).toBe(RED);
    }
  });

  it('ťuknutí na prázdné místo za posledním nástrojem nic nezmění a nezazní', () => {
    const game = openOn(new RecordingStorage(), twoHalves());
    choose(game, 'crayon');
    for (let slot = PANEL_TOOLS.length; slot < 10; slot += 1) {
      expect(game.tapTool(slot), `místo ${slot + 1}`).toEqual([]);
      expect(game.selectedTool(), `místo ${slot + 1}`).toBe('crayon');
    }
  });
});

describe('#93 AC5: výběr barvy po gumě vrátí naposledy vybraný malovací nástroj', () => {
  it('po gumě vybere barva zase štětec, fix nebo pastelku, podle toho, co bylo před gumou', () => {
    for (const tool of PAINTING_TOOLS) {
      const game = openOn(new RecordingStorage(), twoHalves());
      choose(game, tool);
      choose(game, 'eraser');

      const tones = game.tapColor(BLUE);

      expect(game.selectedTool(), `${NAMES[tool]} → guma → barva`).toBe(tool);
      expect(game.palette().selected, NAMES[tool]).toBe(BLUE);
      expect(tones.length, `${NAMES[tool]}: tón výběru barvy`).toBeGreaterThan(0);
      expect(game.handleView(), NAMES[tool]).toMatchObject({ tool, color: BLUE });
      expect(markedTools(game.selectedTool())[PANEL_TOOLS.indexOf(tool)], NAMES[tool]).toBe(true);
    }
  });

  it('rozhoduje poslední malovací nástroj před gumou, ne první', () => {
    const sequences: Array<{ taps: ToolId[]; expected: ToolId }> = [
      { taps: ['marker', 'crayon', 'eraser'], expected: 'crayon' },
      { taps: ['crayon', 'brush', 'eraser'], expected: 'brush' },
      { taps: ['crayon', 'eraser', 'marker', 'eraser'], expected: 'marker' },
      { taps: ['marker', 'eraser', 'eraser'], expected: 'marker' },
    ];
    for (const { taps, expected } of sequences) {
      const game = openOn(new RecordingStorage(), twoHalves());
      taps.forEach((tool) => choose(game, tool));

      game.tapColor(BLACK);

      const label = taps.map((tool) => NAMES[tool]).join(' → ');
      expect(game.selectedTool(), label).toBe(expected);
    }
  });

  it('i výběr už vybrané barvy po gumě vrátí naposledy vybraný malovací nástroj', () => {
    const game = openOn(new RecordingStorage(), twoHalves());
    game.tapColor(BLUE);
    choose(game, 'crayon');
    choose(game, 'eraser');

    game.tapColor(BLUE);

    expect(game.selectedTool()).toBe('crayon');
  });

  it('výběr barvy s fixem nebo pastelkou nechá vybraný ten nástroj', () => {
    for (const tool of NEW_TOOLS) {
      const game = openOn(new RecordingStorage(), twoHalves());
      choose(game, tool);
      game.tapColor(BLUE);
      game.tapColor(BLACK);
      expect(game.selectedTool(), NAMES[tool]).toBe(tool);
    }
  });

  it('po gumě a výběru barvy maluje další tah barvou, ne gumuje', () => {
    for (const tool of NEW_TOOLS) {
      const game = openOn(new RecordingStorage(), twoHalves());
      choose(game, tool);
      choose(game, 'eraser');
      game.tapColor(BLACK);

      paint(game, [at(20, 100), at(130, 100)]);

      // Pastelka nechá mezery, proto stačí, že je na čáře tahu černá.
      const onLine = Array.from({ length: 100 }, (_, step) => game.colorAt(25 + step, 100));
      expect(onLine.filter((color) => color === BLACK).length, NAMES[tool]).toBeGreaterThan(50);
    }
  });

  it('po návratu z menu je vybraný štětec, i když dítě odešlo s fixem nebo pastelkou', () => {
    for (const tool of NEW_TOOLS) {
      const storage = new RecordingStorage();
      const regions = twoHalves();
      const game = openOn(storage, regions);
      game.tapColor(BLUE);
      choose(game, tool);
      game.suspend();

      const again = openOn(storage, regions);
      expect(again.selectedTool(), NAMES[tool]).toBe('brush');
      expect(again.handleView(), NAMES[tool]).toMatchObject({ tool: 'brush', color: BLUE });
    }
  });

  it('po návratu do hry vrátí barva po gumě štětec, i když se před odchodem malovalo pastelkou', () => {
    const storage = new RecordingStorage();
    const regions = twoHalves();
    const game = openOn(storage, regions);
    choose(game, 'crayon');
    game.suspend();

    const again = openOn(storage, regions);
    choose(again, 'eraser');
    again.tapColor(BLACK);

    expect(again.selectedTool()).toBe('brush');
  });

  it('po obnovení stránky je vybraný štětec, i když se malovalo fixem', () => {
    const storage = new DeviceStorage();
    const regions = twoHalves();
    const game = enterColoring(openProfiles(storage), regions);
    choose(game, 'marker');
    paint(game, [at(20, 100), at(130, 100)]);
    game.suspend();

    expect(enterColoring(openProfiles(storage), regions).selectedTool()).toBe('brush');
  });
});
