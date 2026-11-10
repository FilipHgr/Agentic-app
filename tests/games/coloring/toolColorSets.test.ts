import { describe, expect, it } from 'vitest';

import type { RegionMap } from '../../../src/games/coloring/logic/regionMap';
import type { SavedColoring } from '../../../src/games/coloring/logic/savedPicture';
import { handleColorDotFill } from '../../../src/games/coloring/logic/toolIcons';
import type { ToolId } from '../../../src/games/coloring/logic/toolPanel';
import { choose } from './drawingToolHelpers';
import { usedColors } from './extendedPaletteHelpers';
import { TOOL_NAMES } from './lineSizeHelpers';
import { pick, seededRandom } from './recentColorsHelpers';
import {
  RecordingStorage,
  openOn,
  paint,
  pixelsOf,
  startStroke,
  twoHalves,
} from './savedPictureHelpers';
import { at } from './strokeHelpers';
import {
  COLOR_TOOLS,
  TOOLS_WITHOUT_COLOR,
  isColorTool,
  openToolStep,
  pickTool,
  toolColorsOf,
} from './toolColorsHelpers';
import type { ColorTool } from './toolColorsHelpers';
import {
  DEFAULT_HEXES,
  PLACE_NAMES,
  RAINBOW_HEXES,
  SET_SIZE,
  TOOL_SETS,
  colorAtPlace,
  giveToolPlace,
  hexOf,
  stepHexes,
  tapPlace,
} from './toolColorSetsHelpers';

/**
 * Testy k #116 AC1 (krok barev ukazuje sadu nástroje), AC3 (tah maluje
 * přesně zvolenou barvou a vzor se nemění) a AC4 (každý nástroj si pamatuje
 * svou barvu, výchozí barvy, nedávné barvy). Pravidla nad tabulkou (AC2)
 * jsou v `toolColorSetsTable.test.ts`, starší stavy a obnovení obrázku
 * (AC5, AC6) v `toolColorSetsRecord.test.ts`, limit (AC6)
 * v `toolColorSetsLimit.test.ts`. AC7 je ruční kontrola.
 *
 * Testy neznají čísla nových barev. Co je v kroku barev, čtou z
 * `game.colorStep()` a odstín barvy z kolečka barvy v úchytu
 * (`hexOf`, `toolColorSetsHelpers.ts`).
 *
 * Navržené rozhraní (`SavedColoring` v `src/games/coloring/logic/savedPicture.ts`):
 * - `colorStep(): readonly number[]` nové: 12 barev (čísla barev, ne místa)
 *   kroku barev v pořadí míst. Je to sada nástroje, který by výběr barvy
 *   dostal (#110 AC3): vybraného malovacího nástroje, po gumě naposledy
 *   vybraného, po duze štětce. Sada se výběrem barvy nemění.
 * - `markedColorPlace(): number | null` nové: označené místo kroku barev
 *   (0 až 11), tedy místo barvy toho nástroje v jeho sadě. Když barvu nástroje
 *   sada nemá (starší záznam nebo nedávná barva, AC5), je `null` a krok
 *   barev nic neoznačí.
 * - `tapColor(color)` zůstává: dá barvu `color` (číslo barvy) nástroji,
 *   který barvu dostává. Scéna ťuknutí na místo k hlásí jako
 *   `tapColor(colorStep()[k])`.
 * - `openColoring` bez `paletteSize` zná všech 46 barev ze všech sad
 *   (barvy 0 až 45, #115), kolečko barvy (`handleColorDotFill`) i barvy
 *   v obrázku ukazují odstín každé z nich.
 */

/** Tah v oblasti A zkušebního obrázku `twoHalves()` (oblast vlevo od čáry x 150). */
const STROKE = [at(20, 40), at(75, 100), at(130, 160)];

/** Tah v oblasti B (vpravo od čáry). */
const STROKE_B = [at(170, 100), at(290, 100)];

function fresh(): SavedColoring {
  return openOn(new RecordingStorage(), twoHalves());
}

function placeName(place: number): string {
  return `místo ${place + 1} (${PLACE_NAMES[place] ?? '?'})`;
}

/** Odstíny barev, které jsou v obrázku. */
function paintedHexes(game: SavedColoring, regions: RegionMap): Array<string | null> {
  return usedColors(pixelsOf(game, regions)).map(hexOf);
}

/** Pixely, které nejsou prázdné, jako `true`/`false` po řádcích. */
function maskOf(game: SavedColoring, regions: RegionMap): boolean[] {
  return pixelsOf(game, regions).map((color) => color !== null);
}

/** Kolik pixelů se v maskách liší. */
function maskDifferences(first: readonly boolean[], second: readonly boolean[]): number {
  return first.filter((value, index) => value !== second[index]).length;
}

describe('#116 AC1: krok barev ukazuje sadu barev nástroje', () => {
  it('krok barev každého malovacího nástroje ukazuje 12 barev jeho sloupce v pořadí míst', () => {
    for (const tool of COLOR_TOOLS) {
      const game = fresh();
      pickTool(game, tool);

      const name = TOOL_NAMES[tool];
      expect(game.panelView(), `${name}: krok barev`).toBe('colors');
      expect(game.colorStep().length, `${name}: počet barev`).toBe(SET_SIZE);
      expect(stepHexes(game), `${name}: barvy sloupce`).toEqual(TOOL_SETS[tool]);
    }
  });

  it('krok barev ukazuje sadu nástroje i po dlouhé řadě výběrů nástrojů a barev', () => {
    const allTools: readonly ToolId[] = [...COLOR_TOOLS, ...TOOLS_WITHOUT_COLOR];
    for (const seed of [116, 2026]) {
      const random = seededRandom(seed);
      const game = fresh();
      for (let step = 0; step < 150; step += 1) {
        const tool = allTools[pick(random, allTools.length)] ?? 'brush';
        pickTool(game, tool);
        const label = `seed ${seed}, krok ${step + 1}: ${TOOL_NAMES[tool]}`;
        if (!isColorTool(tool)) {
          continue;
        }
        expect(stepHexes(game), `${label}: sada nástroje`).toEqual(TOOL_SETS[tool]);
        if (random() < 0.7) {
          tapPlace(game, pick(random, SET_SIZE));
        }
      }
    }
  });

  it('ťuknutí na místo k dá nástroji barvu z místa k jeho sady a barvy ostatních nástrojů se nezmění', () => {
    for (const tool of COLOR_TOOLS) {
      for (let place = 0; place < SET_SIZE; place += 1) {
        const game = fresh();
        const before = toolColorsOf(game);

        giveToolPlace(game, tool, place);

        const what = `${TOOL_NAMES[tool]}, ${placeName(place)}`;
        expect(hexOf(game.toolColor(tool)), `${what}: barva nástroje`).toBe(TOOL_SETS[tool][place]);
        expect(toolColorsOf(game), `${what}: ostatní nástroje beze změny`).toEqual({
          ...before,
          [tool]: game.toolColor(tool),
        });
        expect(game.selectedTool(), `${what}: vybraný nástroj`).toBe(tool);
        expect(hexOf(game.handleView().color), `${what}: úchyt`).toBe(TOOL_SETS[tool][place]);
        pickTool(game, tool);
        expect(game.markedColorPlace(), `${what}: označené místo`).toBe(place);
      }
    }
  });

  it('kolečko barvy u nástroje ukazuje barvu ze sady nástroje', () => {
    for (const tool of COLOR_TOOLS) {
      for (let place = 0; place < SET_SIZE; place += 1) {
        const game = fresh();
        giveToolPlace(game, tool, place);

        const what = `${TOOL_NAMES[tool]}, ${placeName(place)}`;
        const expected = { kind: 'color', hex: TOOL_SETS[tool][place] };
        const handle = handleColorDotFill(game.handleView());
        expect(
          handle.kind === 'color' ? { ...handle, hex: handle.hex.toUpperCase() } : handle,
          `${what}: kolečko v úchytu`,
        ).toEqual(expected);
        openToolStep(game);
        const inToolStep = handleColorDotFill({
          tool,
          color: game.toolColor(tool),
          size: game.lineSize(),
        });
        expect(
          inToolStep.kind === 'color'
            ? { ...inToolStep, hex: inToolStep.hex.toUpperCase() }
            : inToolStep,
          `${what}: kolečko v kroku nástrojů`,
        ).toEqual(expected);
      }
    }
  });

  it('duha nemá krok barev a dál maluje jen 6 barvami štětce', () => {
    const regions = twoHalves();
    const game = openOn(new RecordingStorage(), regions);
    // Nástroje mají barvy z vlastních sad, duhu to nesmí ovlivnit.
    for (const tool of COLOR_TOOLS) {
      giveToolPlace(game, tool, 5);
    }
    openToolStep(game);

    choose(game, 'rainbow');

    expect(game.panelView(), 'ťuknutí na duhu panel zavře').toBe('closed');
    expect(game.toolColor('rainbow'), 'duha barvu nemá').toBeNull();
    const fill = handleColorDotFill(game.handleView());
    expect(fill.kind === 'rainbow' ? fill.hexes.map((hex) => hex.toUpperCase()) : fill).toEqual(
      RAINBOW_HEXES,
    );
    paint(game, [at(10, 20), at(140, 20), at(140, 180), at(10, 180), at(10, 30)]);
    const painted = paintedHexes(game, regions);
    expect(painted.length, 'duha něco namalovala').toBeGreaterThan(1);
    for (const hex of painted) {
      expect(RAINBOW_HEXES, `barva duhy ${String(hex)}`).toContain(hex);
    }
  });

  it('guma barvu ani krok barev nemá', () => {
    const game = fresh();
    for (const tool of COLOR_TOOLS) {
      giveToolPlace(game, tool, 3);
    }
    openToolStep(game);

    choose(game, 'eraser');

    expect(game.panelView(), 'ťuknutí na gumu panel zavře').toBe('closed');
    expect(game.toolColor('eraser'), 'guma barvu nemá').toBeNull();
    expect(game.handleView().color, 'úchyt bez barvy').toBeNull();
  });
});

describe('#116 AC3: tah maluje přesně zvolenou barvou a vzor nástroje se nemění', () => {
  it('každý malovací nástroj maluje přesně barvou z kteréhokoli místa své sady', () => {
    const regions = twoHalves();
    for (const tool of COLOR_TOOLS) {
      for (let place = 0; place < SET_SIZE; place += 1) {
        const game = openOn(new RecordingStorage(), regions);
        giveToolPlace(game, tool, place);
        const chosen = game.toolColor(tool);

        paint(game, STROKE);

        const what = `${TOOL_NAMES[tool]}, ${placeName(place)}`;
        expect(usedColors(pixelsOf(game, regions)), `${what}: jen zvolená barva`).toEqual([chosen]);
        expect(paintedHexes(game, regions), `${what}: odstín`).toEqual([TOOL_SETS[tool][place]]);
      }
    }
  });

  it('pastelka, puntíky, proužky, třpytky a sprej barví v každé barvě sady stejné pixely svého vzoru', () => {
    const regions = twoHalves();
    for (const tool of COLOR_TOOLS) {
      // Vzor s barvou štětce (červená na místě 1), jak maloval nástroj před #116.
      const reference = openOn(new RecordingStorage(), regions);
      pickTool(reference, tool);
      reference.tapColor(colorAtPlace(fresh(), 'brush', 0));
      paint(reference, STROKE);
      const referenceMask = maskOf(reference, regions);
      expect(
        referenceMask.filter(Boolean).length,
        `${TOOL_NAMES[tool]}: tah něco namaloval`,
      ).toBeGreaterThan(0);

      for (let place = 0; place < SET_SIZE; place += 1) {
        const game = openOn(new RecordingStorage(), regions);
        giveToolPlace(game, tool, place);
        paint(game, STROKE);

        expect(
          maskDifferences(maskOf(game, regions), referenceMask),
          `${TOOL_NAMES[tool]}, ${placeName(place)}: pixely vzoru jako s barvou štětce`,
        ).toBe(0);
      }
    }
  });

  it('lesk třpytek se do obrázku nezapisuje ani zlatou, stříbrnou a bronzovou barvou', () => {
    const regions = twoHalves();
    // Zlatá (místo 3), bronzová (místo 7) a stříbrná (místo 11).
    for (const place of [2, 6, 10]) {
      const storage = new RecordingStorage();
      const game = openOn(storage, regions);
      giveToolPlace(game, 'glitter', place);
      const chosen = game.toolColor('glitter');
      const what = placeName(place);

      startStroke(game, STROKE);
      expect(usedColors(pixelsOf(game, regions)), `${what}: během tahu jen zvolená barva`).toEqual([
        chosen,
      ]);
      game.pointerUp(1);
      const painted = pixelsOf(game, regions);
      expect(usedColors(painted), `${what}: po tahu jen zvolená barva`).toEqual([chosen]);
      game.suspend();

      const reopened = openOn(storage, regions);
      expect(pixelsOf(reopened, regions), `${what}: po návratu stejné pixely`).toEqual(painted);
    }
  });
});

describe('#116 AC4: každý nástroj si pamatuje svou barvu ze sady', () => {
  it('nový profil má u každého nástroje výchozí barvu z tabulky a v kroku barev je označená', () => {
    for (const tool of COLOR_TOOLS) {
      const game = fresh();
      expect(hexOf(game.toolColor(tool)), `${TOOL_NAMES[tool]}: výchozí barva`).toBe(
        DEFAULT_HEXES[tool],
      );
      pickTool(game, tool);
      expect(game.markedColorPlace(), `${TOOL_NAMES[tool]}: označené místo`).toBe(
        TOOL_SETS[tool].indexOf(DEFAULT_HEXES[tool]),
      );
    }
  });

  it('příklad ze zadání: pastelka dostane #E9762B, štětec maluje #FF3B30 a po návratu má pastelka dál své', () => {
    const regions = twoHalves();
    const storage = new RecordingStorage();
    const game = openOn(storage, regions);

    // 1. Pastelka má označené místo 4 (#5E9E3A).
    pickTool(game, 'crayon');
    expect(game.markedColorPlace(), '1. označené místo 4').toBe(3);
    expect(hexOf(game.toolColor('crayon')), '1. pastelka').toBe('#5E9E3A');

    // 2. Dítě ťukne na místo 2 a pastelka maluje #E9762B.
    tapPlace(game, 1);
    paint(game, STROKE);
    expect(paintedHexes(game, regions), '2. pastelka maluje').toEqual(['#E9762B']);

    // 3. Dítě přepne na štětec, ten maluje #FF3B30.
    pickTool(game, 'brush');
    game.tapHandle();
    paint(game, STROKE_B);
    expect(paintedHexes(game, regions).sort(), '3. štětec maluje').toEqual(
      ['#E9762B', '#FF3B30'].sort(),
    );
    expect(hexOf(game.toolColor('brush')), '3. štětec').toBe('#FF3B30');
    game.suspend();

    // 4. Po návratu do hry má pastelka dál #E9762B a označené místo 2.
    const again = openOn(storage, regions);
    expect(hexOf(again.toolColor('crayon')), '4. pastelka po návratu').toBe('#E9762B');
    pickTool(again, 'crayon');
    expect(again.markedColorPlace(), '4. označené místo 2').toBe(1);
  });

  it('po návratu do hry má každý nástroj barvu i označené místo, které mu dítě dalo', () => {
    const regions = twoHalves();
    const storage = new RecordingStorage();
    const game = openOn(storage, regions);
    const places: Record<ColorTool, number> = {
      brush: 11,
      marker: 0,
      crayon: 6,
      stamp: 3,
      dots: 4,
      stripes: 7,
      glitter: 10,
      spray: 5,
    };
    for (const tool of COLOR_TOOLS) {
      giveToolPlace(game, tool, places[tool]);
    }
    game.suspend();

    const again = openOn(storage, regions);
    for (const tool of COLOR_TOOLS) {
      expect(hexOf(again.toolColor(tool)), `${TOOL_NAMES[tool]}: barva`).toBe(
        TOOL_SETS[tool][places[tool]],
      );
      pickTool(again, tool);
      expect(again.markedColorPlace(), `${TOOL_NAMES[tool]}: označené místo`).toBe(places[tool]);
    }
  });

  it('ťuknutí na už vybranou barvu v kroku barev nic nezmění', () => {
    for (const tool of COLOR_TOOLS) {
      for (const place of [0, 4, 11]) {
        const game = fresh();
        giveToolPlace(game, 'brush', 2);
        giveToolPlace(game, tool, place);
        const colors = toolColorsOf(game);
        const recent = [...game.recentColors()];

        pickTool(game, tool);
        tapPlace(game, place);

        const what = `${TOOL_NAMES[tool]}, ${placeName(place)}`;
        expect(toolColorsOf(game), `${what}: barvy nástrojů`).toEqual(colors);
        expect([...game.recentColors()], `${what}: nedávné barvy`).toEqual(recent);
        expect(game.selectedTool(), `${what}: nástroj`).toBe(tool);
        pickTool(game, tool);
        expect(game.markedColorPlace(), `${what}: označené místo`).toBe(place);
      }
    }
  });

  it('výběr barvy ze sady posune nedávné barvy podle #99 a předchozí barva nástroje je první', () => {
    for (const seed of [99, 116, 4242]) {
      const random = seededRandom(seed);
      const game = fresh();
      for (let step = 0; step < 200; step += 1) {
        const tool = COLOR_TOOLS[pick(random, COLOR_TOOLS.length)] ?? 'brush';
        const place = pick(random, SET_SIZE);
        const before = [...game.recentColors()];
        const own = game.toolColor(tool);
        const picked = colorAtPlace(game, tool, place);

        giveToolPlace(game, tool, place);

        const after = [...game.recentColors()];
        const label = `seed ${seed}, krok ${step + 1}: ${TOOL_NAMES[tool]}, ${placeName(place)}, před [${before.join(', ')}]`;
        const filled = after.filter((color): color is number => color !== null);
        expect(new Set(filled).size, `${label}: místa se neopakují`).toBe(filled.length);
        if (picked === own) {
          expect(after, `${label}: nedávné beze změny`).toEqual(before);
          continue;
        }
        expect(after[0], `${label}: předchozí barva nástroje je první`).toBe(own);
        expect(after, `${label}: vybraná barva není v nedávných`).not.toContain(picked);
        if (own !== null && !before.includes(own)) {
          const kept = before.find((color) => color !== picked) ?? null;
          expect(after, `${label}: pořadí podle #99 AC2`).toEqual([own, kept]);
        }
      }
    }
  });

  it('nedávná barva po gumě dá barvu naposledy vybranému nástroji, po duze štětci (#110 AC3)', () => {
    for (const [last, between, receiving] of [
      ['crayon', 'eraser', 'crayon'],
      ['spray', 'eraser', 'spray'],
      ['marker', 'rainbow', 'brush'],
      ['glitter', 'rainbow', 'brush'],
    ] as const) {
      const game = fresh();
      giveToolPlace(game, 'stamp', 3);
      const recent = game.recentColors()[0] ?? null;
      expect(recent, 'kontrola: nedávná barva je výchozí barva razítkového fixu').not.toBeNull();
      pickTool(game, last);
      pickTool(game, between);
      const what = `${TOOL_NAMES[last]} → ${TOOL_NAMES[between]}`;
      expect(stepHexes(game), `${what}: krok barev patří nástroji, který barvu dostane`).toEqual(
        TOOL_SETS[receiving],
      );

      game.tapRecentColor(0);

      expect(game.selectedTool(), `${what}: vybraný nástroj`).toBe(receiving);
      expect(game.toolColor(receiving), `${what}: barvu dostal`).toBe(recent);
    }
  });
});
