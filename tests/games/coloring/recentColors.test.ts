import { describe, expect, it } from 'vitest';

import type { SavedColoring } from '../../../src/games/coloring/logic/savedPicture';
import { choose, endOf } from './drawingToolHelpers';
import { TOOL_NAMES } from './lineSizeHelpers';
import {
  BLACK,
  BLUE,
  BROWN,
  GREEN,
  ORANGE,
  PALETTE_SIZE,
  PURPLE,
  RECENT_PLACES,
  RED,
  YELLOW,
  arrange,
  choiceOf,
  expectedAfterPick,
  pick,
  seededRandom,
  visibleColors,
} from './recentColorsHelpers';
import type { ColorChoice } from './recentColorsHelpers';
import { at } from './strokeHelpers';
import { RecordingStorage, openOn, paint, startStroke, twoHalves } from './savedPictureHelpers';

/**
 * Testy k #99 (rychlý výběr dvou nedávných barev se zavřeným panelem):
 * AC1 výběr nedávné barvy, tón a panel, AC2 pořadí, AC3 začátek, prázdné
 * místo a druhý prst, AC4 nástroje a Zpět. Pamatování (AC5) je
 * v `recentColorsRecord.test.ts`, rozložení (AC1 64 px, AC6)
 * v `recentColorsLayoutRules.test.ts`.
 *
 * Ťuknutí na nedávnou barvu hlásí scéna jako `game.tapRecentColor(index)`,
 * ťuknutí na barvu v panelu jako `game.tapColor(index)`. Druhý prst během
 * tahu je ťuknutí, zatímco první prst ještě nezvedl (`startStroke` bez
 * `pointerUp`). Zkušební obrázek 300 × 200 má oblast A vlevo od čáry x 150.
 *
 * Navržené rozhraní (`src/games/coloring/logic/savedPicture.ts`), nová pole
 * `SavedColoring`:
 * - `recentColors(): readonly (number | null)[]` vždy dvě místa v pořadí
 *   pruhu (index barvy `PALETTE`, `null` u prázdného místa),
 * - `tapRecentColor(index: number): RecentColorTap` ťuknutí na místo
 *   `index` v pruhu, kde
 *   `type RecentColorTap =
 *     | { kind: 'picked'; tones: readonly Tone[] }   // barva vybraná, tón < 1 s
 *     | { kind: 'wobble'; tones: readonly Tone[] }   // prázdné místo se zhoupne
 *     | { kind: 'ignored' }`                         // druhý prst během tahu.
 *   Výběr funguje jako `tapColor` (přepnutí z gumy a duhy, hned uloží).
 * `tapColor` mění nedávné barvy podle pravidla z AC2.
 */

/** Stav „S, [A, B]“ z příkladů v AC2. */
const S = GREEN;
const A = BLUE;
const B = YELLOW;
const C = PURPLE;

function fresh(): SavedColoring {
  return openOn(new RecordingStorage(), twoHalves());
}

/** Hra ve stavu S, [A, B] (ověří, že se stav opravdu připravil). */
function arranged(): SavedColoring {
  const game = fresh();
  arrange(game, S, A, B);
  expect(choiceOf(game), 'připravený stav S, [A, B]').toEqual({ selected: S, recent: [A, B] });
  return game;
}

/** Hra s panelem v daném stavu. */
function withPanel(game: SavedColoring, open: boolean): SavedColoring {
  if (game.panelOpen() !== open) {
    game.tapHandle();
  }
  expect(game.panelOpen(), 'panel připravený').toBe(open);
  return game;
}

function choiceText(choice: ColorChoice): string {
  return `${choice.selected}, [${choice.recent.join(', ')}]`;
}

describe('#99 AC1: ťuknutí na nedávnou barvu ji vybere', () => {
  it('ťuknutí na nedávnou barvu ji vybere a zazní tón kratší než 1 s', () => {
    for (const index of [0, 1]) {
      const game = arranged();
      const color = game.recentColors()[index];

      const result = game.tapRecentColor(index);

      expect(result.kind, `místo ${index + 1}`).toBe('picked');
      expect(game.palette().selected, `místo ${index + 1}: vybraná barva`).toBe(color);
      const tones = result.kind === 'picked' ? result.tones : [];
      expect(tones.length, `místo ${index + 1}: nějaký tón zazní`).toBeGreaterThan(0);
      expect(endOf(tones), `místo ${index + 1}: délka tónu v sekundách`).toBeLessThan(1);
    }
  });

  it('vybraná nedávná barva je vidět na úchytu', () => {
    for (const index of [0, 1]) {
      const game = arranged();
      const color = game.recentColors()[index];

      game.tapRecentColor(index);

      expect(game.handleView(), `místo ${index + 1}`).toMatchObject({ tool: 'brush', color });
    }
  });

  it('se zavřeným panelem zůstane panel po výběru nedávné barvy zavřený', () => {
    const game = withPanel(arranged(), false);

    game.tapRecentColor(0);

    expect(game.panelOpen()).toBe(false);
  });

  it('s otevřeným panelem zůstane panel po výběru nedávné barvy otevřený', () => {
    const game = withPanel(arranged(), true);

    game.tapRecentColor(1);

    expect(game.panelOpen()).toBe(true);
  });

  it('nedávnou barvou se hned maluje', () => {
    const game = arranged();
    game.tapRecentColor(1);

    paint(game, [at(20, 100), at(140, 100)]);

    expect(game.colorAt(80, 100)).toBe(B);
  });

  it('obě místa jsou na začátku hry k dispozici, i když jsou prázdná', () => {
    expect(fresh().recentColors().length).toBe(RECENT_PLACES);
  });
});

describe('#99 AC2: pořadí nedávných barev', () => {
  it('příklad 1: S, [A, B], ťuknutí na B v pruhu → B, [S, A]', () => {
    const game = arranged();

    game.tapRecentColor(1);

    expect(choiceOf(game)).toEqual({ selected: B, recent: [S, A] });
  });

  it('příklad 2: S, [A, B], výběr A v panelu → A, [S, B]', () => {
    const game = arranged();

    game.tapColor(A);

    expect(choiceOf(game)).toEqual({ selected: A, recent: [S, B] });
  });

  it('příklad 3: S, [A, B], výběr C v panelu → C, [S, A]', () => {
    const game = arranged();

    game.tapColor(C);

    expect(choiceOf(game)).toEqual({ selected: C, recent: [S, A] });
  });

  it('příklad 4: na začátku S, [prázdné, prázdné], výběr X → X, [S, prázdné]', () => {
    const game = fresh();
    expect(choiceOf(game), 'začátek').toEqual({ selected: RED, recent: [null, null] });

    game.tapColor(ORANGE);

    expect(choiceOf(game)).toEqual({ selected: ORANGE, recent: [RED, null] });
  });

  it('stejná barva vybraná v pruhu i v panelu dá stejné pořadí', () => {
    for (const index of [0, 1]) {
      const fromStrip = arranged();
      const fromPanel = arranged();
      const color = fromStrip.recentColors()[index] ?? -1;

      fromStrip.tapRecentColor(index);
      fromPanel.tapColor(color);

      expect(choiceOf(fromStrip), `místo ${index + 1}`).toEqual(choiceOf(fromPanel));
    }
  });

  it('výběr barvy, která už je vybraná, nic nezmění', () => {
    const game = arranged();

    game.tapColor(S);

    expect(choiceOf(game)).toEqual({ selected: S, recent: [A, B] });
  });

  it('výběr už vybrané barvy na začátku nechá místa prázdná', () => {
    const game = fresh();

    game.tapColor(RED);
    game.tapColor(RED);

    expect(choiceOf(game)).toEqual({ selected: RED, recent: [null, null] });
  });

  it('neplatné ťuknutí na barvu nedávné barvy nezmění', () => {
    const game = arranged();
    for (const index of [-1, PALETTE_SIZE, 1.5, Number.NaN]) {
      game.tapColor(index);
      expect(choiceOf(game), `index ${index}`).toEqual({ selected: S, recent: [A, B] });
    }
  });

  it('dlouhá náhodná řada výběrů v pruhu i v panelu jde vždy podle pravidla', () => {
    for (const seed of [99, 2026, 31337]) {
      const random = seededRandom(seed);
      const game = fresh();
      let expected = choiceOf(game);
      for (let step = 0; step < 300; step += 1) {
        const fromStrip = random() < 0.5;
        const before = expected;
        if (fromStrip) {
          const index = pick(random, RECENT_PLACES);
          const color = before.recent[index] ?? null;
          game.tapRecentColor(index);
          expected = color === null ? before : expectedAfterPick(before, color);
        } else {
          const color = pick(random, PALETTE_SIZE);
          game.tapColor(color);
          expected = expectedAfterPick(before, color);
        }
        const what = `seed ${seed}, krok ${step + 1} (${fromStrip ? 'pruh' : 'panel'}) z ${choiceText(before)}`;
        expect(choiceOf(game), what).toEqual(expected);
      }
    }
  });

  // Upraveno k #110 AC4: pravidlo „stejná barva nikdy není vidět dvakrát“
  // z #99 AC2 je nahrazené. Platí dál, dokud dítě maluje jedním nástrojem;
  // při střídání nástrojů viz `toolColorsRecent.test.ts`.
  it('jedním nástrojem stejná barva nikdy není vidět dvakrát, ani vybraná a nedávná zároveň', () => {
    const random = seededRandom(7);
    const game = fresh();
    for (let step = 0; step < 300; step += 1) {
      if (random() < 0.5) {
        game.tapRecentColor(pick(random, RECENT_PLACES));
      } else {
        game.tapColor(pick(random, PALETTE_SIZE));
      }
      const visible = visibleColors(choiceOf(game));
      expect(new Set(visible).size, `krok ${step + 1}: ${visible.join(', ')}`).toBe(visible.length);
    }
  });
});

describe('#99 AC3: začátek a okrajové případy', () => {
  it('na začátku jsou obě místa prázdná', () => {
    expect(fresh().recentColors()).toEqual([null, null]);
  });

  it('po prvním výběru barvy zůstane druhé místo prázdné', () => {
    const game = fresh();

    game.tapColor(BLUE);

    expect(game.recentColors()[1]).toBeNull();
  });

  it('ťuknutí na prázdné místo ho jen zhoupne a nic nevybere', () => {
    for (const index of [0, 1]) {
      const game = fresh();

      const result = game.tapRecentColor(index);

      expect(result.kind, `místo ${index + 1}`).toBe('wobble');
      expect(choiceOf(game), `místo ${index + 1}`).toEqual({ selected: RED, recent: [null, null] });
    }
  });

  it('ťuknutí na druhé místo, které je ještě prázdné, jen zhoupne a nic nevybere', () => {
    const game = fresh();
    game.tapColor(BLUE);

    const result = game.tapRecentColor(1);

    expect(result.kind).toBe('wobble');
    expect(choiceOf(game)).toEqual({ selected: BLUE, recent: [RED, null] });
    expect(game.handleView().color, 'úchyt ukazuje dál modrou').toBe(BLUE);
  });

  it('ťuknutí na prázdné místo nezmění nástroj ani panel', () => {
    const game = fresh();
    choose(game, 'eraser');
    withPanel(game, true);

    game.tapRecentColor(0);

    expect(game.selectedTool()).toBe('eraser');
    expect(game.panelOpen()).toBe(true);
  });

  it('ťuknutí mimo dvě místa nic nevybere', () => {
    const game = arranged();
    for (const index of [-1, RECENT_PLACES, 0.5, Number.NaN]) {
      expect(game.tapRecentColor(index).kind, `místo ${index}`).not.toBe('picked');
      expect(choiceOf(game), `místo ${index}`).toEqual({ selected: S, recent: [A, B] });
    }
  });

  it('ťuknutí druhým prstem na nedávnou barvu během tahu se nepočítá a tah pokračuje', () => {
    const game = arranged();
    startStroke(game, [at(20, 100), at(60, 100)]);

    const result = game.tapRecentColor(0);

    expect(result.kind).toBe('ignored');
    expect(choiceOf(game), 'výběr se nezměnil').toEqual({ selected: S, recent: [A, B] });
    game.pointerMove({ id: 1, x: 140, y: 100, kind: 'touch' });
    game.pointerUp(1);
    expect(game.colorAt(130, 100), 'tah pokračoval vybranou barvou').toBe(S);
  });

  it('ťuknutí druhým prstem na barvu v panelu během tahu nedávné barvy nezmění', () => {
    const game = arranged();
    startStroke(game, [at(20, 100), at(60, 100)]);

    game.tapColor(C);

    expect(choiceOf(game)).toEqual({ selected: S, recent: [A, B] });
    game.pointerUp(1);
  });

  it('po zvednutí prstu jde nedávnou barvu zase vybrat', () => {
    const game = arranged();
    startStroke(game, [at(20, 100), at(60, 100)]);
    game.tapRecentColor(0);
    game.pointerUp(1);

    const result = game.tapRecentColor(0);

    expect(result.kind).toBe('picked');
    expect(choiceOf(game)).toEqual({ selected: A, recent: [S, B] });
  });
});

describe('#99 AC4: nedávná barva se vybírá jako barva v panelu i u nástrojů', () => {
  it('z gumy přepne nedávná barva na naposledy vybraný malovací nástroj a maluje se jí', () => {
    for (const paintingTool of ['brush', 'marker', 'crayon', 'stamp'] as const) {
      const game = arranged();
      choose(game, paintingTool);
      choose(game, 'eraser');

      game.tapRecentColor(0);

      const what = `${TOOL_NAMES[paintingTool]} → guma → nedávná barva`;
      expect(game.selectedTool(), what).toBe(paintingTool);
      expect(game.handleView(), `${what}: úchyt`).toMatchObject({ tool: paintingTool, color: A });
    }
  });

  it('z gumy po štětci maluje nedávná barva hned štětcem', () => {
    const game = arranged();
    choose(game, 'eraser');

    game.tapRecentColor(1);
    paint(game, [at(20, 100), at(140, 100)]);

    expect(game.selectedTool()).toBe('brush');
    expect(game.colorAt(80, 100)).toBe(B);
  });

  it('z duhy přepne nedávná barva na štětec', () => {
    const game = arranged();
    choose(game, 'rainbow');

    game.tapRecentColor(0);

    expect(game.selectedTool()).toBe('brush');
    expect(game.handleView()).toMatchObject({ tool: 'brush', color: A });
  });

  it('z gumy po duze přepne nedávná barva na štětec', () => {
    const game = arranged();
    choose(game, 'rainbow');
    choose(game, 'eraser');

    game.tapRecentColor(0);

    expect(game.selectedTool()).toBe('brush');
  });

  it('nedávná barva přepne nástroj stejně jako stejná barva v panelu', () => {
    for (const tools of [
      ['eraser'],
      ['marker', 'eraser'],
      ['rainbow'],
      ['rainbow', 'eraser'],
      ['crayon'],
    ] as const) {
      const fromStrip = arranged();
      const fromPanel = arranged();
      for (const tool of tools) {
        choose(fromStrip, tool);
        choose(fromPanel, tool);
      }

      fromStrip.tapRecentColor(1);
      fromPanel.tapColor(B);

      const what = tools.map((tool) => TOOL_NAMES[tool]).join(' → ');
      expect(fromStrip.selectedTool(), what).toBe(fromPanel.selectedTool());
      expect(fromStrip.handleView(), `${what}: úchyt`).toEqual(fromPanel.handleView());
    }
  });

  it('Zpět nedávné barvy nemění', () => {
    const game = fresh();
    game.tapColor(BLUE);
    paint(game, [at(20, 60), at(140, 60)]);
    game.tapColor(BROWN);
    paint(game, [at(20, 100), at(140, 100)]);
    game.tapColor(BLACK);
    paint(game, [at(170, 100), at(290, 100)]);
    const before = choiceOf(game);
    expect(before, 'před Zpět').toEqual({ selected: BLACK, recent: [BROWN, BLUE] });

    for (let undo = 1; undo <= 4; undo += 1) {
      game.tapUndo();
      expect(choiceOf(game), `po ${undo}. Zpět`).toEqual(before);
    }
  });

  it('Zpět po výběru nedávné barvy vrátí tah, ale ne výběr barvy', () => {
    const game = arranged();
    paint(game, [at(20, 100), at(140, 100)]);
    game.tapRecentColor(0);
    const after = choiceOf(game);

    const result = game.tapUndo();

    expect(result.kind).toBe('undone');
    expect(game.colorAt(80, 100), 'tah je vrácený').toBeNull();
    expect(choiceOf(game)).toEqual(after);
  });
});
