import { describe, expect, it } from 'vitest';

import { brushWidthFor } from '../../../src/games/coloring/logic/coloring';
import { OUTLINE_REGION, regionAt } from '../../../src/games/coloring/logic/regionMap';
import type { RegionMap } from '../../../src/games/coloring/logic/regionMap';
import type { SavedColoring } from '../../../src/games/coloring/logic/savedPicture';
import {
  INITIAL_LINE_SIZE,
  LINE_SIZES,
  PANEL_TOOLS,
  markedLineSizes,
  usesSelectedColor,
} from '../../../src/games/coloring/logic/toolPanel';
import type { LineSize, ToolId } from '../../../src/games/coloring/logic/toolPanel';
import { PROFILE_COLORS } from '../../../src/shared/logic/profiles';
import { openProfiles } from '../../../src/shared/storage/profileStorage';
import { DeviceStorage } from '../../shared/profileFixtures';
import {
  BIG_LINE_X,
  bigHalves,
  bigRegions,
  changedInRegion,
  choose,
  endOf,
  limited,
} from './drawingToolHelpers';
import { pixelDifferences } from './extendedPaletteHelpers';
import {
  ALL_SIZES,
  HORIZONTAL,
  SIZES,
  SIZE_NAMES,
  TOOL_NAMES,
  chooseSize,
  emptyInMeasuredColumns,
  expectedHalf,
  fillAWithBrush,
  reachOf,
} from './lineSizeHelpers';
import type { Point } from './outlineFixtures';
import {
  RecordingStorage,
  enterColoring,
  openOn,
  paint,
  pixelsOf,
  startStroke,
  twoHalves,
} from './savedPictureHelpers';
import { at } from './strokeHelpers';
import {
  DOT_TOLERANCE,
  LIKE_SMALL_AT_TINY,
  TAP_POINT,
  TAP_WIDTH,
  extentAround,
  farthestPainted,
  paintedAround,
  tapPicture,
} from './thinnestHelpers';
import { openToolStep, pickTool, toolColorsOf } from './toolColorsHelpers';

/**
 * Testy chování k #118 (čtyři tloušťky čáry v Omalovánkách s novou
 * nejtenčí): AC1 (čtvrté tlačítko, výběr, tón, druhý prst), AC2 (šířky,
 * výjimka puntíkového a proužkového fixu a třpytek, tečky po ťuknutí,
 * ořez do oblasti) a AC5 (paměť podle profilu, poškozený záznam, Zpět).
 * Rozložení tlačítek, vlnky a kolečko v úchytu (AC1, AC3, AC4) jsou
 * v `thinnestLineSizeLayoutRules.test.ts`, staré záznamy a limit uložení
 * (AC5, AC6) v `thinnestLineSizeRecord.test.ts`.
 *
 * Platí doporučení u otevřených otázek a schválení obrázků vlastníkem
 * (komentáře k issue z 2026-11-10): třpytky malují u nejtenčí stejně
 * široce jako u malé, stejně jako puntíkový a proužkový fix.
 *
 * Navržené rozhraní:
 * - `toolPanel.ts`:
 *   - `type LineSize = 'tiny' | 'small' | 'medium' | 'large'`,
 *   - `LINE_SIZES = ['tiny', 'small', 'medium', 'large']` (pořadí tlačítek),
 *   - `LINE_SIZE_TONES.tiny` tón výš než malá (dnešní tři tóny beze změny),
 *   - `loadLineSize` přijme i uloženou nejtenčí, dnešní záznamy malé,
 *     střední a velké čte beze změny.
 * - `coloring.ts`: `brushWidthFor(pictureWidth, 'tiny')` je 1/100 šířky
 *   plochy. Výjimku (puntíkový a proužkový fix a třpytky u nejtenčí jako
 *   u malé) doporučuji jako `strokeWidthFor(tool: ToolId, pictureWidth:
 *   number, size: LineSize): number`, kterou volá `SavedColoring.pointerDown`
 *   místo `brushWidthFor`; testy ji ale nevolají, výjimku ověřují chováním.
 * - `savedPicture.ts`: `SavedColoring.tapLineSize('tiny')` jako u ostatních.
 */

const RED = 0;
const BLUE = 4;
const BLACK = 7;

/** Tolerance měření šířky stopy na pixely (střed pixelu je po 1 px), jako u #91. */
const PIXEL_TOLERANCE = 1;

/** Tón tloušťky musí doznít do 1 s (#91, #112 AC2). */
const MAX_TONE_SECONDS = 1;

function fresh(storage = new RecordingStorage()): SavedColoring {
  return openOn(storage, twoHalves());
}

/** Stav, který ťuknutí na tloušťku nesmí změnit (jako v testech #112). */
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

/** Dítě vybere nástroj `tool`, u malovacího barvu `color`, a tloušťku `size`. */
function prepare(game: SavedColoring, tool: ToolId, size: LineSize, color = RED): void {
  choose(game, tool);
  if (usesSelectedColor(tool)) {
    game.tapColor(color);
  }
  chooseSize(game, size);
}

/** Polovina šířky stopy v měřených sloupcích (jako v `lineSize.test.ts`). */
function measuredHalf(game: SavedColoring, tool: ToolId, color: number): number {
  if (tool === 'eraser') {
    return reachOf(game, (each) => each === null);
  }
  if (tool === 'rainbow') {
    return reachOf(game, (each) => each !== null);
  }
  return reachOf(game, (each) => each === color);
}

/** Vodorovný tah nástrojem `tool` velikosti `size` na čerstvém obrázku 900 × 600. */
function strokeWith(tool: ToolId, size: LineSize): SavedColoring {
  const game = openOn(new RecordingStorage(), bigHalves());
  if (tool === 'eraser') {
    fillAWithBrush(game, BLUE);
    expect(emptyInMeasuredColumns(game), 'oblast A je před gumováním celá vybarvená').toBe(0);
  }
  prepare(game, tool, size);
  paint(game, HORIZONTAL);
  return game;
}

describe('#118 AC1: čtyři tlačítka tloušťky od nejtenčí', () => {
  it('tloušťky jsou čtyři v pořadí od nejtenčí: nejtenčí, malá, střední, velká', () => {
    expect(LINE_SIZES).toEqual(ALL_SIZES);
  });

  it('na začátku zůstává vybraná střední tloušťka', () => {
    expect(INITIAL_LINE_SIZE).toBe('medium');
    expect(fresh().lineSize()).toBe('medium');
  });

  it('z kterékoli tloušťky jde jedním ťuknutím vybrat kteroukoli, i nejtenčí', () => {
    for (const from of ALL_SIZES) {
      for (const to of ALL_SIZES) {
        const game = fresh();
        openToolStep(game);
        game.tapLineSize(from);
        game.tapLineSize(to);
        expect(game.lineSize(), `${SIZE_NAMES[from]} → ${SIZE_NAMES[to]}`).toBe(to);
      }
    }
  });

  it('označená je vždy právě jedna ze čtyř tlouštěk, ta naposledy vybraná', () => {
    const game = fresh();
    openToolStep(game);
    for (const size of ['tiny', 'large', 'tiny', 'small', 'medium', 'tiny'] as const) {
      game.tapLineSize(size);
      const marked = markedLineSizes(game.lineSize());
      const what = `po ťuknutí na ${SIZE_NAMES[size]}`;
      expect(marked.length, `${what}: údaj u každého ze 4 tlačítek`).toBe(ALL_SIZES.length);
      expect(marked.filter(Boolean).length, `${what}: označených`).toBe(1);
      expect(marked[ALL_SIZES.indexOf(size)], `${what}: označené vybrané`).toBe(true);
    }
  });

  it('ťuknutí na nejtenčí ji vybere a zazní tón kratší než 1 s', () => {
    const game = fresh();
    openToolStep(game);
    const tones = game.tapLineSize('tiny');
    expect(game.lineSize()).toBe('tiny');
    expect(tones.length, 'zazní tón').toBeGreaterThan(0);
    expect(endOf(tones), 'délka tónu').toBeLessThan(MAX_TONE_SECONDS);
  });

  it('tenčí tloušťka zní výš: nejtenčí nejvýš, pak malá, střední a velká', () => {
    const game = fresh();
    openToolStep(game);
    const pitches = ALL_SIZES.map((size) => {
      const tones = game.tapLineSize(size);
      return Math.max(...tones.map((tone) => tone.frequencyHz));
    });
    pitches.slice(1).forEach((pitch, offset) => {
      const thinner = ALL_SIZES[offset] ?? 'tiny';
      const thicker = ALL_SIZES[offset + 1] ?? 'large';
      expect(
        pitch,
        `${SIZE_NAMES[thicker]} (${pitch} Hz) zní níž než ${SIZE_NAMES[thinner]} (${pitches[offset]} Hz)`,
      ).toBeLessThan(pitches[offset] ?? 0);
    });
  });

  it('úchyt ukazuje nejtenčí velikost, i se zavřeným panelem', () => {
    const game = fresh();
    openToolStep(game);
    game.tapLineSize('tiny');
    expect(game.handleView().size, 'otevřený panel').toBe('tiny');
    game.tapHandle();
    expect(game.panelOpen(), 'panel zavřený').toBe(false);
    expect(game.handleView().size, 'zavřený panel').toBe('tiny');
  });

  it('po ťuknutí na nejtenčí zůstane panel na kroku nástrojů a nástroj ani barvy se nezmění', () => {
    for (const tool of PANEL_TOOLS) {
      const game = fresh();
      pickTool(game, tool);
      openToolStep(game);
      const before = everythingButSize(game);
      expect(game.panelView(), `${TOOL_NAMES[tool]}: krok nástrojů`).toBe('tools');
      game.tapLineSize('tiny');
      expect(everythingButSize(game), TOOL_NAMES[tool]).toEqual(before);
      expect(game.lineSize(), `${TOOL_NAMES[tool]}: tloušťka`).toBe('tiny');
    }
  });

  it('ťuknutí na už vybranou nejtenčí jen zahraje tón, nic jiného se nezmění', () => {
    const storage = new RecordingStorage();
    const regions = twoHalves();
    const game = openOn(storage, regions);
    paint(game, [at(20, 100), at(140, 100)]);
    openToolStep(game);
    game.tapLineSize('tiny');
    const before = everythingButSize(game);
    const picture = pixelsOf(game, regions);
    const saved = new Map(storage.data);

    const tones = game.tapLineSize('tiny');

    expect(tones.length, 'zazní tón').toBeGreaterThan(0);
    expect(tones, 'stejný tón jako při výběru').toEqual(game.tapLineSize('tiny'));
    expect(game.lineSize(), 'tloušťka').toBe('tiny');
    expect(everythingButSize(game), 'panel, nástroj a barvy').toEqual(before);
    expect(pixelsOf(game, regions), 'obrázek').toEqual(picture);
    expect(storage.data, 'úložiště').toEqual(saved);
  });

  it('ťuknutí druhým prstem na kteroukoli tloušťku během tahu nejtenčí nic nezmění a tón nezahraje', () => {
    const game = fresh();
    openToolStep(game);
    game.tapLineSize('tiny');
    startStroke(game, [at(20, 100), at(60, 100)]);
    for (const size of ALL_SIZES) {
      expect(game.tapLineSize(size), `${SIZE_NAMES[size]}: žádný tón`).toEqual([]);
      expect(game.lineSize(), `${SIZE_NAMES[size]}: tloušťka`).toBe('tiny');
      expect(
        markedLineSizes(game.lineSize())[ALL_SIZES.indexOf('tiny')],
        `${SIZE_NAMES[size]}: označená nejtenčí`,
      ).toBe(true);
    }
    game.pointerUp(1);
  });

  it('ťuknutí druhým prstem na nejtenčí během tahu jinou tloušťkou tloušťku nezmění', () => {
    for (const size of SIZES) {
      const game = fresh();
      game.tapLineSize(size);
      startStroke(game, [at(20, 100), at(60, 100)]);
      expect(game.tapLineSize('tiny'), `${SIZE_NAMES[size]}: žádný tón`).toEqual([]);
      expect(game.lineSize(), SIZE_NAMES[size]).toBe(size);
      game.pointerUp(1);
    }
  });

  it('tah nejtenčí maluje dál nejtenčí, i když druhý prst ťukne na jinou tloušťku', () => {
    const regions = twoHalves();
    const reference = openOn(new RecordingStorage(), regions);
    reference.tapLineSize('tiny');
    paint(reference, [at(20, 100), at(60, 100), at(140, 100)]);

    for (const other of SIZES) {
      const game = openOn(new RecordingStorage(), regions);
      game.tapLineSize('tiny');
      startStroke(game, [at(20, 100), at(60, 100)]);
      game.tapLineSize(other);
      game.pointerMove({ id: 1, x: 140, y: 100, kind: 'touch' });
      game.pointerUp(1);
      expect(pixelsOf(game, regions), `druhý prst na ${SIZE_NAMES[other]}`).toEqual(
        pixelsOf(reference, regions),
      );
    }
  });

  it('po skončení tahu jde nejtenčí zase vybrat', () => {
    const game = fresh();
    startStroke(game, [at(20, 40), at(60, 40)]);
    game.tapLineSize('tiny');
    game.pointerUp(1);

    const tones = game.tapLineSize('tiny');

    expect(game.lineSize()).toBe('tiny');
    expect(tones.length).toBeGreaterThan(0);
  });
});

describe('#118 AC2: šířka W nejtenčí', () => {
  it('W nejtenčí je 1/100 šířky plochy, tedy polovina malé', () => {
    for (const width of [300, 900, 1024]) {
      const tiny = brushWidthFor(width, 'tiny');
      expect(tiny, `plocha ${width} px: 1/100`).toBeCloseTo(width / 100, 6);
      expect(tiny, `plocha ${width} px: polovina malé`).toBeCloseTo(
        brushWidthFor(width, 'small') / 2,
        6,
      );
    }
  });

  it('malá, střední a velká zůstávají 1/50, 1/30 a 1/15 šířky plochy', () => {
    const shares: Record<'small' | 'medium' | 'large', number> = {
      small: 1 / 50,
      medium: 1 / 30,
      large: 1 / 15,
    };
    for (const width of [300, 900, 1024]) {
      for (const size of SIZES) {
        expect(brushWidthFor(width, size), `${SIZE_NAMES[size]}, plocha ${width} px`).toBeCloseTo(
          width * shares[size],
          6,
        );
      }
    }
  });

  it('štětec, guma, fix, pastelka a duha malují nejtenčí stopou svého násobku W nejtenčí', () => {
    // Razítkový fix, sprej a vzorkové nástroje se měří tečkou po ťuknutí níže.
    const continuous: readonly ToolId[] = ['brush', 'eraser', 'marker', 'crayon', 'rainbow'];
    for (const tool of continuous) {
      const game = strokeWith(tool, 'tiny');
      const color = tool === 'eraser' ? BLUE : RED;
      const measured = measuredHalf(game, tool, color);
      const expected = expectedHalf(tool, 'tiny');
      const what = `${TOOL_NAMES[tool]}: polovina šířky ${measured} px, má být ${expected} px`;
      expect(measured, what).toBeGreaterThanOrEqual(expected - PIXEL_TOLERANCE);
      expect(measured, what).toBeLessThanOrEqual(expected + 0.01);
    }
  });

  it('nejtenčí čára je tenčí než malá u štětce, gumy, fixu, pastelky i duhy', () => {
    const continuous: readonly ToolId[] = ['brush', 'eraser', 'marker', 'crayon', 'rainbow'];
    for (const tool of continuous) {
      const color = tool === 'eraser' ? BLUE : RED;
      const tiny = measuredHalf(strokeWith(tool, 'tiny'), tool, color);
      const small = measuredHalf(strokeWith(tool, 'small'), tool, color);
      expect(tiny, `${TOOL_NAMES[tool]}: nejtenčí čára je vidět`).toBeGreaterThan(0);
      expect(tiny, `${TOOL_NAMES[tool]}: nejtenčí ${tiny} px < malá ${small} px`).toBeLessThan(
        small,
      );
    }
  });

  it('puntíkový a proužkový fix a třpytky malují u nejtenčí pixel po pixelu stejně jako u malé', () => {
    const regions = bigHalves();
    const path = [at(60, 300), at(250, 220), at(420, 340)];
    for (const tool of LIKE_SMALL_AT_TINY) {
      const painted = (['tiny', 'small'] as const).map((size) => {
        const game = openOn(new RecordingStorage(), regions);
        prepare(game, tool, size, BLUE);
        paint(game, path);
        return pixelsOf(game, regions);
      });
      const [tiny, small] = painted;
      expect(
        tiny?.filter((color) => color !== null).length,
        `${TOOL_NAMES[tool]}: tah něco zabarvil`,
      ).toBeGreaterThan(0);
      expect(pixelDifferences(tiny ?? [], small ?? [], regions.width), TOOL_NAMES[tool]).toEqual(
        [],
      );
    }
  });

  it('ostatní nástroje malují u nejtenčí jinak než u malé (výjimka platí jen pro tři nástroje)', () => {
    const regions = bigHalves();
    const path = [at(60, 300), at(250, 220), at(420, 340)];
    const others = PANEL_TOOLS.filter(
      (tool) => tool !== 'eraser' && !LIKE_SMALL_AT_TINY.includes(tool),
    );
    for (const tool of others) {
      const painted = (['tiny', 'small'] as const).map((size) => {
        const game = openOn(new RecordingStorage(), regions);
        prepare(game, tool, size, BLUE);
        paint(game, path);
        return pixelsOf(game, regions).filter((color) => color !== null).length;
      });
      const [tiny, small] = painted;
      expect(tiny, `${TOOL_NAMES[tool]}: nejtenčí něco zabarví`).toBeGreaterThan(0);
      expect(tiny, `${TOOL_NAMES[tool]}: nejtenčí zabarví méně než malá`).toBeLessThan(small ?? 0);
    }
  });
});

/** Místa ťuknutí: střed pixelu, roh pixelu a obecný bod (výsledek nesmí záviset na poloze). */
const TAP_POINTS: readonly Point[] = [TAP_POINT, at(601, 201), at(812.3, 100.7)];

/** Okolí bodu ťuknutí, ve kterém se tečka hledá (větší než každá tečka nejtenčí). */
const TAP_REACH = 30;

/** Dítě ťukne na obrázek 1024 px nástrojem `tool` nejtenčí (nebo `size`) velikostí. */
function tapWith(tool: ToolId, point: Point, size: LineSize = 'tiny'): SavedColoring {
  const game = openOn(new RecordingStorage(), tapPicture());
  if (tool === 'eraser') {
    // Guma potřebuje zabarvené místo: velký štětec kolem místa ťuknutí.
    prepare(game, 'brush', 'large', BLUE);
    paint(game, [at(point.x - 40, point.y), at(point.x + 40, point.y)]);
  }
  prepare(game, tool, size, BLUE);
  paint(game, [point]);
  return game;
}

/** Násobek W nejtenčí, jak široká je tečka nástroje (#118 AC2). */
const TAP_DOT_WIDTHS: ReadonlyArray<{ tool: ToolId; width: number }> = [
  { tool: 'brush', width: 1 * (TAP_WIDTH / 100) },
  { tool: 'rainbow', width: 1 * (TAP_WIDTH / 100) },
  { tool: 'eraser', width: 1.5 * (TAP_WIDTH / 100) },
  { tool: 'marker', width: 0.6 * (TAP_WIDTH / 100) },
  { tool: 'crayon', width: 0.5 * (TAP_WIDTH / 100) },
];

describe('#118 AC2: krátké ťuknutí nejtenčí velikostí namaluje tečku', () => {
  it('tečka štětce a duhy má 10,2 px, gumy 15,4 px, fixu 6,1 px a pastelky 5,1 px (±1 px)', () => {
    for (const { tool, width } of TAP_DOT_WIDTHS) {
      for (const point of TAP_POINTS) {
        const game = tapWith(tool, point);
        const matches =
          tool === 'eraser'
            ? (color: number | null) => color === null
            : (color: number | null) => color !== null;
        const extent = extentAround(game, point, TAP_REACH, matches);
        const what = `${TOOL_NAMES[tool]} v ${point.x}, ${point.y}: ${extent.width} × ${extent.height} px místo ${width.toFixed(2)} px`;
        expect(extent.count, `${what}, tečka je vidět`).toBeGreaterThan(0);
        expect(Math.abs(extent.width - width), `${what}, šířka`).toBeLessThanOrEqual(
          DOT_TOLERANCE + 1e-9,
        );
        expect(Math.abs(extent.height - width), `${what}, výška`).toBeLessThanOrEqual(
          DOT_TOLERANCE + 1e-9,
        );
      }
    }
  });

  it('hvězdička razítkového fixu je vepsaná do kruhu průměru 1,5 × W nejtenčí (15,4 px)', () => {
    const diameter = 1.5 * (TAP_WIDTH / 100);
    // Ostré cípy hvězdičky nemusí mít pixel až u kruhu, proto rezerva
    // dovnitř 1,5 px a ven 0,5 px (střed pixelu).
    for (const point of TAP_POINTS) {
      const game = tapWith('stamp', point);
      const farthest = farthestPainted(game, point, TAP_REACH);
      const what = `v ${point.x}, ${point.y}: nejdál ${farthest.toFixed(2)} px od středu`;
      expect(farthest, `${what}, uvnitř kruhu ${diameter.toFixed(2)} px`).toBeLessThanOrEqual(
        diameter / 2 + 0.5,
      );
      expect(farthest, `${what}, cípy sahají ke kruhu`).toBeGreaterThanOrEqual(diameter / 2 - 1.5);
    }
  });

  it('hvězdička nejtenčí má asi čtvrtinu plochy hvězdičky malé (poloviční průměr)', () => {
    for (const point of TAP_POINTS) {
      const [tiny, small] = (['tiny', 'small'] as const).map(
        (size) => paintedAround(tapWith('stamp', point, size), point, TAP_REACH).size,
      );
      const share = (tiny ?? 0) / (small ?? 1);
      expect(share, `v ${point.x}, ${point.y}: ${tiny} z ${small} pixelů`).toBeGreaterThan(0.2);
      expect(share, `v ${point.x}, ${point.y}: ${tiny} z ${small} pixelů`).toBeLessThan(0.3);
    }
  });

  it('sprej ťuknutím nastříká tečky jako dnes, jen v menším kruhu do W nejtenčí', () => {
    const half = TAP_WIDTH / 100;
    for (const point of TAP_POINTS) {
      const tiny = tapWith('spray', point);
      const small = tapWith('spray', point, 'small');
      const tinyPixels = paintedAround(tiny, point, TAP_REACH);
      const smallPixels = paintedAround(small, point, TAP_REACH);
      const where = `v ${point.x}, ${point.y}`;
      expect(tinyPixels.size, `${where}: nějaké tečky`).toBeGreaterThan(0);
      expect(
        farthestPainted(tiny, point, TAP_REACH),
        `${where}: tečky nejdál W nejtenčí od místa ťuknutí`,
      ).toBeLessThanOrEqual(half + 0.5);
      expect(
        [...tinyPixels].filter((pixel) => !smallPixels.has(pixel)),
        `${where}: tečky nejtenčí jsou tečky z dnešního vzoru (jsou i u malé)`,
      ).toEqual([]);
      expect(tinyPixels.size, `${where}: menší než u malé`).toBeLessThan(smallPixels.size);
    }
  });

  it('tečka puntíkového a proužkového fixu a třpytek je u nejtenčí stejná jako u malé', () => {
    for (const tool of LIKE_SMALL_AT_TINY) {
      for (const point of TAP_POINTS) {
        const what = `${TOOL_NAMES[tool]} v ${point.x}, ${point.y}`;
        const tiny = [...paintedAround(tapWith(tool, point), point, TAP_REACH)].sort();
        const small = [...paintedAround(tapWith(tool, point, 'small'), point, TAP_REACH)].sort();
        expect(tiny.length, `${what}: tečka je vidět`).toBeGreaterThan(0);
        expect(tiny, what).toEqual(small);
      }
    }
  });
});

/** Pixely obrysu, které mají barvu (obrys barvu mít nesmí). */
function paintedOutline(game: SavedColoring, regions: RegionMap): string[] {
  const problems: string[] = [];
  for (let y = 0; y < regions.height; y += 1) {
    for (let x = 0; x < regions.width; x += 1) {
      if (regionAt(regions, x, y) === OUTLINE_REGION && game.colorAt(x, y) !== null) {
        problems.push(`obrys (${x}, ${y}) má barvu ${String(game.colorAt(x, y))}`);
      }
    }
  }
  return limited(problems);
}

describe('#118 AC2: tah nejtenčí velikostí nepřeteče přes obrys', () => {
  it('tah každým nástrojem z oblasti A přes obrys do B nezmění oblast B ani obrys', () => {
    const regions = bigHalves();
    const { regionA, regionB } = bigRegions(regions);
    // Tah začíná těsně u obrysu, jak dítě maluje u čáry, a jde daleko za ni.
    const paths: ReadonlyArray<readonly Point[]> = [
      [at(BIG_LINE_X - 3, 300), at(BIG_LINE_X + 200, 300)],
      [at(BIG_LINE_X - 40, 100), at(BIG_LINE_X + 60, 160), at(BIG_LINE_X - 2, 500)],
    ];
    for (const tool of PANEL_TOOLS) {
      for (const [index, path] of paths.entries()) {
        const game = openOn(new RecordingStorage(), regions);
        if (tool === 'eraser') {
          // Guma se pozná jen na zabarveném místě: obě oblasti se celé vybarví.
          prepare(game, 'brush', 'large', BLACK);
          for (let y = 0; y < regions.height; y += 20) {
            paint(game, [at(4, y), at(BIG_LINE_X - 4, y)]);
            paint(game, [at(BIG_LINE_X + 4, y), at(regions.width - 1, y)]);
          }
        }
        const before = pixelsOf(game, regions);
        prepare(game, tool, 'tiny', BLUE);
        paint(game, path);
        const what = `${TOOL_NAMES[tool]}, tah ${index + 1}`;
        expect(
          changedInRegion(game, regions, before, regionA).length,
          `${what}: tah maluje v oblasti A, kde začal`,
        ).toBeGreaterThan(0);
        expect(changedInRegion(game, regions, before, regionB), `${what}: oblast B`).toEqual([]);
        expect(paintedOutline(game, regions), `${what}: obrys`).toEqual([]);
      }
    }
  });
});

/** Klíče, jejichž hodnotu hra změnila mezi `before` a teď. */
function changedKeys(storage: RecordingStorage, before: ReadonlyMap<string, string>): string[] {
  return storage.keys().filter((key) => storage.data.get(key) !== before.get(key));
}

/** Úložiště s uloženou nejtenčí a klíče, které hra zapsala jen kvůli ní. */
function storageWithTiny(regions: RegionMap): { storage: RecordingStorage; sizeKeys: string[] } {
  const storage = new RecordingStorage();
  const game = openOn(storage, regions);
  game.tapColor(BLUE);
  paint(game, [at(20, 100), at(140, 100)]);
  game.suspend();
  const before = new Map(storage.data);
  const again = openOn(storage, regions);
  again.tapLineSize('tiny');
  again.suspend();
  return { storage, sizeKeys: changedKeys(storage, before) };
}

describe('#118 AC5: nejtenčí se pamatuje podle profilu', () => {
  it('po návratu z menu je vybraná a označená nejtenčí a úchyt ji ukazuje', () => {
    const storage = new RecordingStorage();
    const game = fresh(storage);
    game.tapLineSize('tiny');
    game.suspend();

    const again = fresh(storage);
    expect(again.lineSize()).toBe('tiny');
    expect(markedLineSizes(again.lineSize())[ALL_SIZES.indexOf('tiny')], 'označená').toBe(true);
    expect(again.handleView().size, 'úchyt').toBe('tiny');
  });

  it('nejtenčí se uloží hned po ťuknutí, bez tahu a bez odchodu ze hry', () => {
    const storage = new RecordingStorage();
    fresh(storage).tapLineSize('tiny');
    expect(fresh(storage).lineSize()).toBe('tiny');
  });

  it('po obnovení stránky je vybraná nejtenčí a tah maluje nejtenčí stopou', () => {
    const storage = new DeviceStorage();
    const regions = bigHalves();
    const game = enterColoring(openProfiles(storage), regions);
    game.tapLineSize('tiny');
    game.suspend();

    const again = enterColoring(openProfiles(storage), regions);
    expect(again.lineSize()).toBe('tiny');
    paint(again, HORIZONTAL);
    const measured = measuredHalf(again, 'brush', RED);
    const expected = expectedHalf('brush', 'tiny');
    expect(measured, `polovina šířky ${measured} px`).toBeGreaterThanOrEqual(
      expected - PIXEL_TOLERANCE,
    );
    expect(measured, `polovina šířky ${measured} px`).toBeLessThanOrEqual(expected + 0.01);
  });

  it('nejtenčí jednoho profilu nezmění tloušťku jiného profilu', () => {
    const storage = new DeviceStorage();
    const store = openProfiles(storage);
    const regions = twoHalves();
    const first = store.activeProfile();
    const second = store.createProfile({ nickname: 'BETA', color: PROFILE_COLORS[1] });

    const firstGame = enterColoring(store, regions);
    firstGame.tapLineSize('tiny');
    firstGame.suspend();

    store.selectProfile(second.id);
    const secondGame = enterColoring(store, regions);
    expect(secondGame.lineSize(), 'nový profil začíná střední').toBe('medium');
    secondGame.tapLineSize('large');
    secondGame.suspend();

    const reloaded = openProfiles(storage);
    reloaded.selectProfile(first.id);
    expect(enterColoring(reloaded, regions).lineSize(), 'první profil').toBe('tiny');
    reloaded.selectProfile(second.id);
    expect(enterColoring(reloaded, regions).lineSize(), 'druhý profil').toBe('large');
  });

  it('malá, střední i velká uložené dřív zůstanou vybrané a malují stejně široce jako dřív', () => {
    const regions = bigHalves();
    for (const size of SIZES) {
      // „Dřív“ je hra, která tloušťku jen uložila; tah pak maluje hra po návratu.
      const storage = new RecordingStorage();
      const before = openOn(storage, regions);
      before.tapLineSize(size);
      before.suspend();

      const again = openOn(storage, regions);
      expect(again.lineSize(), SIZE_NAMES[size]).toBe(size);
      paint(again, HORIZONTAL);
      const measured = measuredHalf(again, 'brush', RED);
      const expected = expectedHalf('brush', size);
      const what = `${SIZE_NAMES[size]}: polovina šířky ${measured} px`;
      expect(measured, what).toBeGreaterThanOrEqual(expected - PIXEL_TOLERANCE);
      expect(measured, what).toBeLessThanOrEqual(expected + 0.01);
    }
  });

  it('smazaný záznam po uložení nejtenčí znamená střední', () => {
    const regions = twoHalves();
    const { storage, sizeKeys } = storageWithTiny(regions);
    expect(sizeKeys.length, 'nejtenčí se zapsala').toBeGreaterThan(0);
    for (const key of sizeKeys) {
      storage.data.delete(key);
    }
    expect(openOn(storage, regions).lineSize()).toBe('medium');
  });

  it('nesmyslný záznam místo nejtenčí znamená střední a hra se nezastaví', () => {
    const regions = twoHalves();
    const { storage, sizeKeys } = storageWithTiny(regions);
    expect(sizeKeys.length, 'nejtenčí se zapsala').toBeGreaterThan(0);
    const nonsense = [
      '',
      'nesmysl',
      'null',
      '{}',
      '0',
      '-1',
      'TINY',
      ' tiny',
      '"tiny"',
      'nejtenčí',
    ];
    for (const text of nonsense) {
      const broken = new RecordingStorage();
      for (const [key, value] of storage.data) {
        broken.data.set(key, sizeKeys.includes(key) ? text : value);
      }
      let size: LineSize | undefined;
      expect(
        () => {
          size = openOn(broken, regions).lineSize();
        },
        `záznam ${JSON.stringify(text)}: hra se nezastaví`,
      ).not.toThrow();
      expect(size, `záznam ${JSON.stringify(text)}`).toBe('medium');
    }
  });

  it('nečitelné úložiště po uložení nejtenčí znamená střední a hra se nezastaví', () => {
    const regions = twoHalves();
    const { storage } = storageWithTiny(regions);
    storage.failReads = true;
    let size: LineSize | undefined;
    expect(() => {
      size = openOn(storage, regions).lineSize();
    }).not.toThrow();
    expect(size).toBe('medium');
  });

  it('při plném úložišti jde nejtenčí vybrat bez chyby a tah jí maluje', () => {
    const regions = bigHalves();
    const storage = new RecordingStorage();
    const game = openOn(storage, regions);
    storage.failWrites = true;

    expect(() => game.tapLineSize('tiny')).not.toThrow();
    expect(game.lineSize()).toBe('tiny');
    expect(() => paint(game, HORIZONTAL)).not.toThrow();
    const measured = measuredHalf(game, 'brush', RED);
    const expected = expectedHalf('brush', 'tiny');
    expect(measured, `polovina šířky ${measured} px`).toBeGreaterThanOrEqual(
      expected - PIXEL_TOLERANCE,
    );
    expect(measured, `polovina šířky ${measured} px`).toBeLessThanOrEqual(expected + 0.01);
  });

  it('změna na nejtenčí a zpět obrázek nemění', () => {
    const regions = twoHalves();
    const game = openOn(new RecordingStorage(), regions);
    paint(game, [at(20, 100), at(140, 100)]);
    const picture = pixelsOf(game, regions);
    openToolStep(game);
    for (const size of ['tiny', 'large', 'tiny', 'small', 'tiny'] as const) {
      game.tapLineSize(size);
      expect(pixelsOf(game, regions), SIZE_NAMES[size]).toEqual(picture);
    }
  });

  it('změna na nejtenčí se do Zpět nepočítá: Zpět vrátí poslední tah a nejtenčí zůstane', () => {
    const regions = twoHalves();
    const game = openOn(new RecordingStorage(), regions);
    const empty = pixelsOf(game, regions);
    paint(game, [at(20, 100), at(140, 100)]);
    game.tapLineSize('tiny');

    expect(game.tapUndo().kind, 'Zpět vrátí tah').toBe('undone');
    expect(pixelsOf(game, regions), 'obrázek před tahem').toEqual(empty);
    expect(game.lineSize(), 'tloušťka zůstala').toBe('tiny');
    expect(game.tapUndo().kind, 'víc není co vracet').toBe('wobble');
  });

  it('Zpět vrátí tah nejtenčí pixel po pixelu, i po přepnutí na jinou tloušťku', () => {
    const regions = bigHalves();
    const game = openOn(new RecordingStorage(), regions);
    paint(game, [at(100, 100), at(300, 400)]);
    const before = pixelsOf(game, regions);
    game.tapLineSize('tiny');
    game.tapColor(BLUE);
    paint(game, [at(50, 300), at(400, 300)]);
    game.tapLineSize('large');

    expect(game.tapUndo().kind).toBe('undone');
    expect(pixelDifferences(pixelsOf(game, regions), before, regions.width)).toEqual([]);
  });
});
