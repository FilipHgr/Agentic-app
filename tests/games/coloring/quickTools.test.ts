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
  tapPrevious,
  tapQuickEraser,
} from './quickToolsHelpers';
import type { FirstButton } from './quickToolsHelpers';
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
  isColorTool,
  openToolStep,
  pickTool,
  toolColorsOf,
} from './toolColorsHelpers';

/**
 * Testy k #148 AC1 (co ukazují dvě tlačítka), AC2 (přepnutí), AC3 (guma)
 * a AC4 (výběr v panelu). Nahrazují testy nedávných barev z #99
 * (`recentColors.test.ts`) a #110 AC4 (`toolColorsRecent.test.ts`).
 * Pamatování (AC5) je v `quickToolsRecord.test.ts`, dotyky (AC6)
 * v `quickToolsTouch.test.ts`, rozložení (AC1 místo, AC7)
 * v `quickToolsLayoutRules.test.ts`. Navržené rozhraní je
 * v `quickToolsHelpers.ts`.
 *
 * X je vybraný nástroj, Y předchozí (na prvním tlačítku). Zkušební obrázek
 * 300 × 200 má oblast A vlevo od čáry x 150.
 *
 * Co je na prvním tlačítku hned po ťuknutí na gumu a jak začíná „nový
 * profil, který začne gumou“, rozhodlo upřesnění zadání #148 (bod 1): hra
 * si pamatuje poslední dva různé kreslicí nástroje, guma mezi ně nepatří,
 * takže s gumou je na prvním tlačítku nástroj, kterým se kreslilo těsně
 * před gumou, i výchozí štětec. Návrat z gumy výběrem X (tlačítkem i v
 * panelu) dá na první tlačítko nástroj před X (bod 2).
 */

function fresh(): SavedColoring {
  return openOn(new RecordingStorage(), twoHalves());
}

/** Hra, kde je vybraný X a na prvním tlačítku Y (Y vybraný v panelu dřív než X). */
function withSelectedAndPrevious(x: ToolId, y: ToolId): SavedColoring {
  const game = fresh();
  if (y !== 'brush') {
    pickTool(game, y);
  }
  pickTool(game, x);
  expect(game.selectedTool(), `kontrola: vybraný ${TOOL_NAMES[x]}`).toBe(x);
  expect(firstButton(game)?.tool, `kontrola: na prvním tlačítku ${TOOL_NAMES[y]}`).toBe(y);
  return game;
}

/** Nástroje kromě gumy (smí být na prvním tlačítku). */
const NOT_ERASER: readonly ToolId[] = [...COLOR_TOOLS, 'rainbow'];

/** Dvojice různých nástrojů kromě gumy (X vybraný, Y předchozí). */
function pairs(): Array<[ToolId, ToolId]> {
  const result: Array<[ToolId, ToolId]> = [];
  for (const x of NOT_ERASER) {
    for (const y of NOT_ERASER) {
      if (x !== y) {
        result.push([x, y]);
      }
    }
  }
  return result;
}

function describeButton(button: FirstButton | null): string {
  return button === null ? 'prázdné' : `${TOOL_NAMES[button.tool]} ${String(button.color)}`;
}

describe('#148 AC1: dvě tlačítka místo nedávných barev', () => {
  // Nahrazuje test přes přetypování (review #148): nedávné barvy nejsou,
  // výběr barev nikdy nedá na první tlačítko barvu a přepínání barev nejde.
  it('nedávné barvy ve hře nejsou: výběr barev první tlačítko nemění a nabízí jen předchozí nástroj', () => {
    const game = fresh();
    pickTool(game, 'marker');
    const before = firstButton(game);
    expect(before, 'kontrola: štětec na prvním tlačítku').toEqual(shownAs(game, 'brush'));

    for (const color of [PINK, GRAY, GREEN, YELLOW]) {
      giveColor(game, 'marker', color);
      expect(firstButton(game), `fix dostal ${color}`).toEqual(before);
    }
    const result = tapPrevious(game);

    expect(result.kind, 'první tlačítko').toBe('picked');
    expect(game.selectedTool(), 'vybral se nástroj, ne předchozí barva').toBe('brush');
    expect(game.toolColor('marker'), 'fix si nechal poslední barvu').toBe(YELLOW);
    expect(firstButton(game), 'na prvním tlačítku fix v poslední barvě').toEqual({
      tool: 'marker',
      color: YELLOW,
    });
  });

  it('první tlačítko ukazuje předchozí nástroj s barvou, jakou má (jako kolečko v úchytu)', () => {
    for (const tool of COLOR_TOOLS.filter((each) => each !== 'brush')) {
      const game = fresh();
      giveColor(game, tool, PINK);
      pickTool(game, 'brush');

      expect(firstButton(game), TOOL_NAMES[tool]).toEqual({ tool, color: PINK });
    }
  });

  it('barva předchozího nástroje na prvním tlačítku je stejná, jakou by ukázal úchyt', () => {
    for (const tool of COLOR_TOOLS.filter((each) => each !== 'brush')) {
      const game = fresh();
      giveColor(game, tool, GRAY);
      const handle = game.handleView();
      pickTool(game, 'brush');

      expect(firstButton(game), TOOL_NAMES[tool]).toEqual({
        tool: handle.tool,
        color: handle.color,
      });
    }
  });

  it('duha je na prvním tlačítku bez kolečka barvy', () => {
    const game = fresh();
    pickTool(game, 'rainbow');
    pickTool(game, 'marker');

    expect(firstButton(game)).toEqual({ tool: 'rainbow', color: null });
  });

  it('druhé tlačítko je vždy guma: z každého nástroje vybere gumu', () => {
    for (const tool of NOT_ERASER) {
      const game = fresh();
      pickTool(game, tool);

      const result = tapQuickEraser(game);

      expect(result.kind, TOOL_NAMES[tool]).toBe('picked');
      expect(game.selectedTool(), TOOL_NAMES[tool]).toBe('eraser');
    }
  });
});

describe('#148 AC2: přepnutí na předchozí nástroj', () => {
  it('ťuknutí na Y vybere Y s jeho zapamatovanou barvou a na prvním tlačítku je pak X se svou barvou', () => {
    for (const [x, y] of pairs()) {
      const game = withSelectedAndPrevious(x, y);
      const before = { x: shownAs(game, x), y: shownAs(game, y) };

      const result = tapPrevious(game);

      const what = `${TOOL_NAMES[x]} vybraný, ${TOOL_NAMES[y]} předchozí`;
      expect(result.kind, what).toBe('picked');
      expect(game.selectedTool(), `${what}: vybraný`).toBe(y);
      expect(game.handleView(), `${what}: úchyt`).toMatchObject({
        tool: y,
        color: before.y.color,
      });
      expect(firstButton(game), `${what}: první tlačítko`).toEqual(before.x);
    }
  });

  it('při přepnutí zazní krátký tón, kratší než 1 s', () => {
    for (const [x, y] of pairs()) {
      const result = tapPrevious(withSelectedAndPrevious(x, y));

      const what = `${TOOL_NAMES[x]} → ${TOOL_NAMES[y]}`;
      const tones = result.kind === 'picked' ? result.tones : [];
      expect(tones.length, `${what}: nějaký tón zazní`).toBeGreaterThan(0);
      expect(endOf(tones), `${what}: délka tónu v sekundách`).toBeLessThan(1);
    }
  });

  it('dvě ťuknutí za sebou přepnou tam a zpátky', () => {
    const game = withSelectedAndPrevious('marker', 'crayon');

    tapPrevious(game);
    tapPrevious(game);

    expect(game.selectedTool()).toBe('marker');
    expect(firstButton(game)?.tool).toBe('crayon');
  });

  it('předchozím nástrojem se hned maluje jeho barvou', () => {
    const game = fresh();
    giveColor(game, 'marker', GREEN);
    giveColor(game, 'brush', YELLOW);

    tapPrevious(game);
    paint(game, [at(20, 100), at(140, 100)]);

    expect(game.colorAt(80, 100)).toBe(GREEN);
  });

  it('úchyt hned ukazuje nový nástroj, se zavřeným panelem i s otevřeným', () => {
    for (const panel of ['closed', 'tools'] as const) {
      const game = withSelectedAndPrevious('crayon', 'spray');
      if (panel === 'tools') {
        openToolStep(game);
      } else if (game.panelOpen()) {
        game.tapHandle();
      }
      expect(game.panelView(), `kontrola: panel ${panel}`).toBe(panel);

      tapPrevious(game);

      expect(game.handleView().tool, `panel ${panel}: úchyt`).toBe('spray');
      expect(game.panelView(), `panel ${panel}: zůstal`).toBe(panel);
    }
  });

  it('otevřený krok nástrojů hned označí nový nástroj', () => {
    for (const [x, y] of pairs()) {
      const game = withSelectedAndPrevious(x, y);
      openToolStep(game);

      tapPrevious(game);

      const what = `${TOOL_NAMES[x]} → ${TOOL_NAMES[y]}`;
      expect(game.panelView(), `${what}: panel otevřený`).toBe('tools');
      expect(game.selectedTool(), `${what}: označený nástroj`).toBe(y);
    }
  });

  it('otevřený krok barev hned ukazuje sadu a barvu nového malovacího nástroje', () => {
    for (const [x, y] of pairs().filter(([a, b]) => isColorTool(a) && isColorTool(b))) {
      const game = withSelectedAndPrevious(x, y);
      const reference = withSelectedAndPrevious(y, x);
      expect(game.panelView(), 'kontrola: krok barev').toBe('colors');

      tapPrevious(game);

      const what = `${TOOL_NAMES[x]} → ${TOOL_NAMES[y]}`;
      expect(game.panelView(), `${what}: panel otevřený`).not.toBe('closed');
      expect(game.colorStep(), `${what}: sada barev`).toEqual(reference.colorStep());
      expect(game.markedColorPlace(), `${what}: označená barva`).toBe(reference.markedColorPlace());
    }
  });

  it('tloušťka čáry a barvy ostatních nástrojů se přepnutím nemění', () => {
    for (const [x, y] of pairs()) {
      const game = withSelectedAndPrevious(x, y);
      openToolStep(game);
      game.tapLineSize('large');
      if (game.panelOpen()) {
        game.tapHandle();
      }
      const before = lineSizeAndColors(game);

      tapPrevious(game);
      tapPrevious(game);
      tapQuickEraser(game);

      expect(lineSizeAndColors(game), `${TOOL_NAMES[x]} a ${TOOL_NAMES[y]}`).toEqual(before);
    }
  });

  it('přepnutí nemění obrázek ani historii Zpět', () => {
    const game = fresh();
    paint(game, [at(20, 100), at(140, 100)]);
    pickTool(game, 'marker');
    const before = game.colorAt(80, 100);

    tapPrevious(game);
    tapQuickEraser(game);
    tapPrevious(game);

    expect(game.colorAt(80, 100), 'obrázek').toBe(before);
    expect(game.tapUndo().kind, 'Zpět vrátí tah štětcem').toBe('undone');
    expect(game.colorAt(80, 100), 'tah je vrácený').toBeNull();
  });
});

describe('#148 AC3: guma', () => {
  it('ťuknutí na gumu vybere gumu a gumou se hned gumuje', () => {
    const game = fresh();
    paint(game, [at(20, 100), at(140, 100)]);
    expect(game.colorAt(80, 100), 'kontrola: namalováno').not.toBeNull();

    tapQuickEraser(game);
    paint(game, [at(20, 100), at(140, 100)]);

    expect(game.selectedTool()).toBe('eraser');
    expect(game.colorAt(80, 100), 'vygumováno').toBeNull();
  });

  it('guma nikdy není na prvním tlačítku, ani po ťuknutí na gumu, ani po výběru gumy v panelu', () => {
    for (const tool of NOT_ERASER) {
      for (const how of ['tlačítko', 'panel'] as const) {
        const game = withSelectedAndPrevious(tool, tool === 'marker' ? 'crayon' : 'marker');
        if (how === 'tlačítko') {
          tapQuickEraser(game);
        } else {
          pickTool(game, 'eraser');
        }

        const what = `${TOOL_NAMES[tool]} → guma (${how})`;
        expect(game.selectedTool(), what).toBe('eraser');
        expect(firstButton(game)?.tool, `${what}: první tlačítko`).not.toBe('eraser');
      }
    }
  });

  it('s vybranou gumou ťuknutí na gumu jen zhoupne s tónem domečku a nic nezmění', () => {
    for (const how of ['tlačítko', 'panel'] as const) {
      const game = withSelectedAndPrevious('dots', 'stripes');
      if (how === 'tlačítko') {
        tapQuickEraser(game);
      } else {
        pickTool(game, 'eraser');
      }
      const before = firstButton(game);

      const result = tapQuickEraser(game);

      expect(result, how).toEqual({ kind: 'wobble', tones: HOME_WOBBLE_TONES });
      expect(game.selectedTool(), `${how}: guma zůstala`).toBe('eraser');
      expect(firstButton(game), `${how}: první tlačítko`).toEqual(before);
    }
  });

  it('s vybranou gumou ťuknutí na první tlačítko vybere nástroj, který na něm byl, s jeho barvou', () => {
    for (const [x, y] of pairs()) {
      const game = withSelectedAndPrevious(x, y);
      tapQuickEraser(game);
      const shown = firstButton(game);
      expect(shown, `kontrola: po gumě (${TOOL_NAMES[x]}, ${TOOL_NAMES[y]})`).not.toBeNull();

      const result = tapPrevious(game);

      const what = `${TOOL_NAMES[x]}, ${TOOL_NAMES[y]}, guma, ${describeButton(shown)}`;
      expect(result.kind, what).toBe('picked');
      expect(game.selectedTool(), what).toBe(shown?.tool);
      expect(game.handleView().color, `${what}: barva`).toBe(shown?.color);
      expect(firstButton(game)?.tool, `${what}: guma není na prvním tlačítku`).not.toBe('eraser');
    }
  });

  it('ťuknutí na první tlačítko s vybranou gumou udělá totéž jako výběr stejného nástroje v panelu', () => {
    for (const [x, y] of pairs()) {
      const fromButton = withSelectedAndPrevious(x, y);
      const fromPanel = withSelectedAndPrevious(x, y);
      tapQuickEraser(fromButton);
      tapQuickEraser(fromPanel);
      const shown = firstButton(fromButton);

      tapPrevious(fromButton);
      pickTool(fromPanel, shown?.tool ?? 'brush');

      const what = `${TOOL_NAMES[x]}, ${TOOL_NAMES[y]}, guma`;
      expect(fromButton.selectedTool(), what).toBe(fromPanel.selectedTool());
      expect(firstButton(fromButton), `${what}: první tlačítko`).toEqual(firstButton(fromPanel));
    }
  });

  it('po ťuknutí na gumu i po výběru gumy v panelu je na prvním tlačítku nástroj, kterým dítě kreslilo těsně před gumou', () => {
    for (const [x, y] of pairs()) {
      for (const how of ['tlačítko', 'panel'] as const) {
        const game = withSelectedAndPrevious(x, y);
        const drawnWith = shownAs(game, x);
        if (how === 'tlačítko') {
          tapQuickEraser(game);
        } else {
          pickTool(game, 'eraser');
        }

        const what = `${TOOL_NAMES[x]} vybraný, ${TOOL_NAMES[y]} předchozí, guma (${how})`;
        expect(game.selectedTool(), what).toBe('eraser');
        expect(firstButton(game), `${what}: první tlačítko`).toEqual(drawnWith);
      }
    }
  });

  it('nový profil, který začne gumou: na prvním tlačítku je výchozí štětec a ťuknutí ho vybere', () => {
    for (const how of ['tlačítko', 'panel'] as const) {
      const game = fresh();
      expect(firstButton(game), `${how}: kontrola, na začátku prázdné`).toBeNull();
      if (how === 'tlačítko') {
        tapQuickEraser(game);
      } else {
        pickTool(game, 'eraser');
      }

      expect(firstButton(game), `${how}: štětec na prvním tlačítku`).toEqual(
        shownAs(game, 'brush'),
      );
      expect(tapPrevious(game).kind, `${how}: ťuknutí`).toBe('picked');
      expect(game.selectedTool(), `${how}: vybraný štětec`).toBe('brush');
      expect(firstButton(game), `${how}: jiný kreslicí nástroj zatím nebyl`).toBeNull();
    }
  });
});

describe('#148 AC4: výběr v panelu', () => {
  it('výběr nástroje Z jiného než vybraný X dá na první tlačítko X', () => {
    for (const [x, z] of pairs()) {
      const game = fresh();
      pickTool(game, x);
      const shownX = shownAs(game, x);

      pickTool(game, z);

      expect(firstButton(game), `${TOOL_NAMES[x]} → ${TOOL_NAMES[z]}`).toEqual(shownX);
    }
  });

  it('v novém profilu dá první výběr v panelu na první tlačítko štětec, se kterým hra začíná', () => {
    for (const tool of NOT_ERASER.filter((each) => each !== 'brush')) {
      const game = fresh();
      expect(firstButton(game), 'kontrola: na začátku prázdné').toBeNull();

      pickTool(game, tool);

      expect(firstButton(game), TOOL_NAMES[tool]).toEqual(shownAs(game, 'brush'));
    }
  });

  it('s vybranou gumou výběr Z v panelu vybere Z a na prvním tlačítku zůstane nástroj před gumou, pokud to není Z', () => {
    for (const [x, y] of pairs()) {
      for (const z of NOT_ERASER) {
        const game = withSelectedAndPrevious(x, y);
        tapQuickEraser(game);
        const beforeEraser = firstButton(game);

        pickTool(game, z);

        const what = `${TOOL_NAMES[x]}, ${TOOL_NAMES[y]}, guma, pak ${TOOL_NAMES[z]} (${describeButton(beforeEraser)})`;
        expect(game.selectedTool(), what).toBe(z);
        // Upraveno podle upřesnění #148 (bod 2): je-li Z nástroj před gumou,
        // je na prvním tlačítku kreslicí nástroj před ním (tady Y), ne
        // prázdné místo jako v AC4, stejně jako po ťuknutí na první tlačítko.
        const expected = beforeEraser?.tool === z ? shownAs(game, y) : beforeEraser;
        expect(firstButton(game), what).toEqual(expected);
      }
    }
  });

  it('výběr stejného nástroje v panelu první tlačítko nemění', () => {
    for (const [x, y] of pairs()) {
      const game = withSelectedAndPrevious(x, y);
      const before = firstButton(game);

      pickTool(game, x);

      expect(firstButton(game), `${TOOL_NAMES[x]} znovu`).toEqual(before);
      expect(game.selectedTool(), `${TOOL_NAMES[x]} znovu: vybraný`).toBe(x);
    }
  });

  it('jiná barva vybraného nástroje tlačítka nemění, změní se jen kolečko barvy v úchytu', () => {
    for (const [x, y] of pairs().filter(([a]) => isColorTool(a))) {
      const game = withSelectedAndPrevious(x, y);
      const before = firstButton(game);
      const newColor = game.toolColor(x) === PINK ? GRAY : PINK;

      giveColor(game, x, newColor);

      const what = `${TOOL_NAMES[x]} dostane ${newColor}, předchozí ${TOOL_NAMES[y]}`;
      expect(firstButton(game), what).toEqual(before);
      expect(game.selectedTool(), `${what}: nástroj`).toBe(x);
      expect(game.handleView().color, `${what}: úchyt`).toBe(newColor);
    }
  });

  it('dlouhá náhodná řada výběrů v panelu a ťuknutí na první tlačítko jde vždy podle pravidla', () => {
    const colors = [PINK, GRAY, GREEN, YELLOW];
    for (const seed of [148, 2026, 31337]) {
      const random = seededRandom(seed);
      const game = fresh();
      let selected: ToolId = 'brush';
      let previous: ToolId | null = null;
      for (let step = 0; step < 300; step += 1) {
        const roll = random();
        let what: string;
        if (roll < 0.4) {
          const tool = NOT_ERASER[pick(random, NOT_ERASER.length)] ?? 'brush';
          pickTool(game, tool);
          if (tool !== selected) {
            previous = selected;
            selected = tool;
          }
          what = `panel ${TOOL_NAMES[tool]}`;
        } else if (roll < 0.8) {
          const result = tapPrevious(game);
          if (previous === null) {
            expect(result.kind, `seed ${seed}, krok ${step + 1}: prázdné místo`).toBe('wobble');
          } else {
            [selected, previous] = [previous, selected];
          }
          what = 'první tlačítko';
        } else if (isColorTool(selected)) {
          const color = colors[pick(random, colors.length)] ?? PINK;
          giveColor(game, selected, color);
          what = `barva ${color}`;
        } else {
          what = 'nic';
        }
        const label = `seed ${seed}, krok ${step + 1}: ${what}`;
        expect(game.selectedTool(), `${label}: vybraný`).toBe(selected);
        expect(firstButton(game), `${label}: první tlačítko`).toEqual(
          previous === null ? null : shownAs(game, previous),
        );
      }
    }
  });

  it('barvy nástrojů se při střídání přes první tlačítko pamatují každému zvlášť', () => {
    const game = fresh();
    giveColor(game, 'marker', GREEN);
    giveColor(game, 'crayon', YELLOW);
    const colors = toolColorsOf(game);

    for (let round = 0; round < 4; round += 1) {
      tapPrevious(game);
      const tool = game.selectedTool();
      expect(game.handleView().color, `kolo ${round + 1}: ${TOOL_NAMES[tool]}`).toBe(
        isColorTool(tool) ? colors[tool] : null,
      );
    }
    expect(toolColorsOf(game)).toEqual(colors);
  });
});

describe('#148 upřesnění bod 4: ťuknutí na barvu, které přepne nástroj', () => {
  it('fix, duha a ťuknutí na barvu: vybraný je štětec a na prvním tlačítku duha', () => {
    const game = fresh();
    pickTool(game, 'marker');
    pickTool(game, 'rainbow');
    expect(firstButton(game)?.tool, 'kontrola: na prvním tlačítku fix').toBe('marker');

    game.tapColor(PINK);

    expect(game.selectedTool(), 'barva po duze přepne na štětec').toBe('brush');
    expect(game.handleView().color, 'štětec dostal barvu').toBe(PINK);
    expect(firstButton(game), 'na prvním tlačítku duha').toEqual({ tool: 'rainbow', color: null });
  });

  it('fix, duha, guma a ťuknutí na barvu: vybraný je štětec a na prvním tlačítku duha', () => {
    const game = fresh();
    pickTool(game, 'marker');
    pickTool(game, 'rainbow');
    tapQuickEraser(game);
    expect(firstButton(game)?.tool, 'kontrola: s gumou na prvním tlačítku duha').toBe('rainbow');

    game.tapColor(PINK);

    expect(game.selectedTool(), 'barva po gumě a duze přepne na štětec').toBe('brush');
    expect(firstButton(game), 'na prvním tlačítku duha').toEqual({ tool: 'rainbow', color: null });
  });

  it('guma po malovacím nástroji a ťuknutí na barvu vrátí ten nástroj a první tlačítko se nezmění', () => {
    const game = withSelectedAndPrevious('crayon', 'marker');
    tapQuickEraser(game);

    game.tapColor(PINK);

    expect(game.selectedTool()).toBe('crayon');
    expect(firstButton(game), 'na prvním tlačítku fix').toEqual(shownAs(game, 'marker'));
  });
});

describe('#148 upřesnění bod 5: přepnutí na gumu a duhu s otevřeným krokem barev', () => {
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

  it('ťuknutí na duhu na prvním tlačítku v kroku barev nechá panel otevřený na kroku nástrojů s označenou duhou', () => {
    for (const tool of COLOR_TOOLS) {
      const game = withSelectedAndPrevious(tool, 'rainbow');
      expect(game.panelView(), `${TOOL_NAMES[tool]}: kontrola, krok barev`).toBe('colors');

      expect(tapPrevious(game).kind, TOOL_NAMES[tool]).toBe('picked');

      expect(game.panelView(), `${TOOL_NAMES[tool]}: krok nástrojů`).toBe('tools');
      expect(game.selectedTool(), `${TOOL_NAMES[tool]}: označená duha`).toBe('rainbow');
    }
  });
});
