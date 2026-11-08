import { describe, expect, it } from 'vitest';

import type { RegionMap } from '../../../src/games/coloring/logic/regionMap';
import type { SavedColoring } from '../../../src/games/coloring/logic/savedPicture';
import type { ToolId } from '../../../src/games/coloring/logic/toolPanel';
import {
  BIG_LINE_X,
  BIG_W,
  CRAYON_GAP_MAX,
  CRAYON_GAP_MIN,
  CRAYON_RADIUS,
  INSIDE,
  MARKER_HALF,
  OUTSIDE,
  bigHalves,
  bigRegions,
  changedInRegion,
  choose,
  crayonCore,
  drawWith,
  limited,
  paintedBeyond,
  pixelsWhere,
  shareWithout,
} from './drawingToolHelpers';
import { distanceToPath, distanceToSegment } from './outlineFixtures';
import type { Point } from './outlineFixtures';
import { at } from './strokeHelpers';
import { RecordingStorage, openOn, paint, paintedPixels, pixelsOf } from './savedPictureHelpers';

/**
 * Testy k #93 AC2 (stopy štětce, fixu a pastelky), AC3 (ořez, souvislost
 * a stejný výsledek stejného tahu), AC4 (pastelka a opakování) a AC5
 * (první část: Zpět po fixu a pastelce). Výběr nástrojů je
 * v `markerCrayonSelection.test.ts`, limit uložení v `crayonRecord.test.ts`.
 *
 * Měří se na obrázku 900 × 600 z `drawingToolHelpers.ts` (W = 30 px):
 * - štětec: kulatý konec, zabarví každý pixel nejvýš W/2 od čáry,
 * - fix: čtvercový konec (čtverec o straně 0,6 W se stranami podél os),
 *   ve vodorovném tahu zabarví celý obdélník od začátku − 0,3 W do konce
 *   + 0,3 W a výšky 0,6 W, nic dál než 1 px za ním,
 * - pastelka: kulatý konec, nic dál než 0,25 W + 1 px od čáry, z pixelů
 *   s jistotou ve stopě zůstane nezabarveno 20–40 %.
 * Zrno pastelky je pevné vůči obrázku (poznámka pro vývojáře v issue),
 * proto má i opakovaný nebo posunutý tah stejné mezery.
 *
 * Navržené rozhraní: nástroje `'marker'` (fix) a `'crayon'` (pastelka)
 * v `ToolId` a `PANEL_TOOLS`; `SavedColoring.pointerDown` maluje
 * vybraným nástrojem (`tapTool`) jako u gumy (#90). Testy se nezajímají
 * o tvar zrna, jen o podíl a polohu mezer.
 */

const RED = 0;
const ORANGE = 1;
const BLUE = 4;
const BLACK = 7;

const NEW_TOOLS = ['marker', 'crayon'] as const satisfies readonly ToolId[];

const NAMES: Record<ToolId, string> = {
  brush: 'štětec',
  eraser: 'guma',
  marker: 'fix',
  crayon: 'pastelka',
  rainbow: 'duhový štětec',
  stamp: 'razítkový fix',
  dots: 'puntíkový fix',
  stripes: 'proužkový fix',
};

/** Vodorovný tah přes prázdnou oblast A. */
const HORIZONTAL: readonly Point[] = [at(100, 300), at(350, 300)];

function freshGame(): { game: SavedColoring; regions: RegionMap; storage: RecordingStorage } {
  const storage = new RecordingStorage();
  const regions = bigHalves();
  return { game: openOn(storage, regions), regions, storage };
}

/** Celou oblast A vybarví štětcem barvou `color` vodorovnými tahy. */
function fillA(game: SavedColoring, color: number): void {
  game.tapColor(color);
  choose(game, 'brush');
  for (let y = 0; y <= 600; y += 20) {
    const row = Math.min(y, 599);
    paint(game, [at(4, row), at(BIG_LINE_X - 4, row)]);
  }
}

/** Obrázek v oblasti A s několika barvami štětcem. */
function colorfulA(game: SavedColoring): void {
  fillA(game, ORANGE);
  drawWith(game, 'brush', BLUE, [at(200, 20), at(200, 580)]);
  drawWith(game, 'brush', BLACK, [at(20, 150), at(430, 450)]);
}

/** Pixely obdélníku stopy fixu ve vodorovném tahu `from`–`to`, které nemají barvu `color`. */
function markerMissing(
  game: SavedColoring,
  from: Point,
  to: Point,
  color: number,
  half = MARKER_HALF,
): string[] {
  const problems: string[] = [];
  const left = Math.min(from.x, to.x) - half + INSIDE;
  const right = Math.max(from.x, to.x) + half - INSIDE;
  const top = from.y - half + INSIDE;
  const bottom = from.y + half - INSIDE;
  for (let y = Math.ceil(top - 0.5); y + 0.5 <= bottom; y += 1) {
    for (let x = Math.ceil(left - 0.5); x + 0.5 <= right; x += 1) {
      if (game.colorAt(x, y) !== color) {
        problems.push(`pixel (${x}, ${y}) má ${String(game.colorAt(x, y))}, čeká se ${color}`);
      }
    }
  }
  return limited(problems);
}

/** Zabarvené pixely víc než 1 px za obdélníkem stopy fixu ve vodorovném tahu. */
function markerBeyond(game: SavedColoring, regions: RegionMap, from: Point, to: Point): string[] {
  const left = Math.min(from.x, to.x) - MARKER_HALF - OUTSIDE;
  const right = Math.max(from.x, to.x) + MARKER_HALF + OUTSIDE;
  const top = from.y - MARKER_HALF - OUTSIDE;
  const bottom = from.y + MARKER_HALF + OUTSIDE;
  const problems: string[] = [];
  for (let y = 0; y < regions.height; y += 1) {
    for (let x = 0; x < regions.width; x += 1) {
      const cx = x + 0.5;
      const cy = y + 0.5;
      const outside = cx < left || cx > right || cy < top || cy > bottom;
      if (outside && game.colorAt(x, y) !== null) {
        problems.push(`pixel (${x}, ${y}) za stopou fixu je zabarvený`);
      }
    }
  }
  return limited(problems);
}

/** Pixely oblasti `region` nejvýš `reach` od čáry `path`, které nemají barvu `color`. */
function missingNear(
  game: SavedColoring,
  regions: RegionMap,
  region: number,
  path: readonly Point[],
  reach: number,
  color: number,
): string[] {
  const pixels = pixelsWhere(regions, region, (center) => distanceToPath(center, path) <= reach);
  return limited(
    pixels
      .filter(([x, y]) => game.colorAt(x, y) !== color)
      .map(([x, y]) => `pixel (${x}, ${y}) má ${String(game.colorAt(x, y))}`),
  );
}

/** Podíl nezabarvených pixelů s jistotou ve stopě pastelky, s popisem pro hlášení. */
function crayonGap(
  game: SavedColoring,
  regions: RegionMap,
  region: number,
  path: readonly Point[],
  color: number,
): number {
  const core = crayonCore(regions, region, path);
  expect(core.length, 'stopa má pixely k měření').toBeGreaterThan(100);
  return shareWithout(game, core, color);
}

function expectGrain(share: number, what: string): void {
  expect(share, `${what}: nezabarvený díl stopy aspoň 20 %`).toBeGreaterThanOrEqual(CRAYON_GAP_MIN);
  expect(share, `${what}: nezabarvený díl stopy nejvýš 40 %`).toBeLessThanOrEqual(CRAYON_GAP_MAX);
}

/** Kolik pixelů s barvou `color` leží nejvýš `reach` od čáry `path`. */
function paintedNear(
  game: SavedColoring,
  regions: RegionMap,
  path: readonly Point[],
  reach: number,
  color: number,
): number {
  return pixelsWhere(regions, null, (center) => distanceToPath(center, path) <= reach).filter(
    ([x, y]) => game.colorAt(x, y) === color,
  ).length;
}

describe('#93 AC2: štětec se nezměnil', () => {
  it('štětec dál maluje kulatou stopou šířky W a zabarví v ní každý pixel', () => {
    const { game, regions } = freshGame();
    const { regionA } = bigRegions(regions);
    drawWith(game, 'brush', BLUE, HORIZONTAL);

    expect(missingNear(game, regions, regionA, HORIZONTAL, BIG_W / 2 - INSIDE, BLUE)).toEqual([]);
    expect(paintedBeyond(game, regions, HORIZONTAL, BIG_W / 2 + OUTSIDE)).toEqual([]);
  });
});

describe('#93 AC2: stopa fixu', () => {
  it('vodorovný tah fixem zabarví celý pruh šířky 0,6 W se čtvercovými konci', () => {
    const { game, regions } = freshGame();
    const [from, to] = HORIZONTAL as [Point, Point];

    drawWith(game, 'marker', RED, HORIZONTAL);

    expect(markerMissing(game, from, to, RED), 'nezabarvené ve stopě').toEqual([]);
    expect(markerBeyond(game, regions, from, to), 'zabarvené za stopou').toEqual([]);
  });

  it('fix je užší než štětec: pixel 0,4 W od čáry nezabarví', () => {
    const { game } = freshGame();
    drawWith(game, 'marker', RED, HORIZONTAL);

    expect(game.colorAt(200, 300 + 0.4 * BIG_W), 'pod čárou').toBeNull();
    expect(game.colorAt(200, 300 - 0.4 * BIG_W - 1), 'nad čárou').toBeNull();
  });

  it('ťuknutí fixem udělá čtvercovou tečku, i s rohy, kam kulatá tečka nedosáhne', () => {
    const { game, regions } = freshGame();
    const tap = at(200, 300);

    drawWith(game, 'marker', RED, [tap]);

    expect(markerMissing(game, tap, tap, RED), 'nezabarvené ve čtverci').toEqual([]);
    expect(markerBeyond(game, regions, tap, tap), 'zabarvené mimo čtverec').toEqual([]);
    // Střed pixelu (207,5; 307,5) je 10,6 px od ťuknutí: kulatá tečka 0,6 W sem nedosáhne.
    for (const [x, y] of [
      [207, 307],
      [192, 292],
      [207, 292],
      [192, 307],
    ] as const) {
      expect(game.colorAt(x, y), `roh čtverce (${x}, ${y})`).toBe(RED);
    }
  });

  it('fix přes vybarvené místo ho celé přebarví novou barvou', () => {
    const { game } = freshGame();
    const [from, to] = HORIZONTAL as [Point, Point];
    fillA(game, BLUE);

    drawWith(game, 'marker', RED, HORIZONTAL);

    expect(markerMissing(game, from, to, RED)).toEqual([]);
  });
});

describe('#93 AC2: stopa pastelky', () => {
  it('ve vodorovném tahu přes prázdnou oblast zůstane nezabarveno 20–40 % stopy', () => {
    const { game, regions } = freshGame();
    const { regionA } = bigRegions(regions);

    drawWith(game, 'crayon', RED, HORIZONTAL);

    expectGrain(crayonGap(game, regions, regionA, HORIZONTAL, RED), 'vodorovný tah');
  });

  it('pastelka má šířku 0,5 W a kulatý konec: nic nezabarví dál než 0,25 W + 1 px od čáry', () => {
    const { game, regions } = freshGame();

    drawWith(game, 'crayon', RED, HORIZONTAL);

    expect(paintedBeyond(game, regions, HORIZONTAL, CRAYON_RADIUS + OUTSIDE)).toEqual([]);
  });

  it('pastelka barví v celé šířce 0,5 W: každý řádek stopy má zabarvenou aspoň třetinu', () => {
    const { game } = freshGame();
    drawWith(game, 'crayon', RED, HORIZONTAL);

    const reach = CRAYON_RADIUS - INSIDE;
    for (let y = Math.ceil(300 - reach - 0.5); y + 0.5 <= 300 + reach; y += 1) {
      let painted = 0;
      let total = 0;
      for (let x = 100; x < 350; x += 1) {
        total += 1;
        if (game.colorAt(x, y) === RED) {
          painted += 1;
        }
      }
      expect(
        painted / total,
        `řádek ${y} (${(y + 0.5 - 300).toFixed(1)} px od čáry)`,
      ).toBeGreaterThanOrEqual(1 / 3);
    }
  });

  it('ťuknutí pastelkou udělá kulatou tečku se zrnem', () => {
    const { game, regions } = freshGame();
    const tap = [at(200, 300)];

    drawWith(game, 'crayon', RED, tap);

    expect(paintedBeyond(game, regions, tap, CRAYON_RADIUS + OUTSIDE), 'mimo tečku').toEqual([]);
    expect(paintedPixels(game, regions), 'tečka je vidět').toBeGreaterThan(0);
  });

  it('v mezerách pastelky je vidět barva, která tam byla předtím', () => {
    const { game, regions } = freshGame();
    const { regionA } = bigRegions(regions);
    fillA(game, BLUE);

    drawWith(game, 'crayon', RED, HORIZONTAL);

    const core = crayonCore(regions, regionA, HORIZONTAL);
    const other = core.filter(
      ([x, y]) => game.colorAt(x, y) !== RED && game.colorAt(x, y) !== BLUE,
    );
    expect(other.slice(0, 5), 'v mezerách jen původní modrá').toEqual([]);
    expectGrain(shareWithout(game, core, RED), 'pastelka přes modrou');
  });
});

describe('#93 AC3: ořez a souvislost platí pro fix i pastelku jako pro štětec', () => {
  it('tah začatý v oblasti A a tažený přes obrys do B barví dál jen A, i po návratu do A', () => {
    for (const tool of NEW_TOOLS) {
      const { game, regions } = freshGame();
      const { regionB } = bigRegions(regions);
      const before = pixelsOf(game, regions);
      const back = [at(BIG_LINE_X - 20, 200), at(150, 200)];

      drawWith(game, tool, RED, [at(300, 300), at(650, 300), at(650, 200), ...back]);

      expect(changedInRegion(game, regions, before, regionB), `${NAMES[tool]}: oblast B`).toEqual(
        [],
      );
      expect(
        paintedNear(game, regions, back, 2, RED),
        `${NAMES[tool]}: návrat do A`,
      ).toBeGreaterThan(100);
    }
  });

  it('tah začatý na obrysu barví jen oblast, do které prst vjede', () => {
    for (const tool of NEW_TOOLS) {
      const { game, regions } = freshGame();
      const { regionA } = bigRegions(regions);
      const before = pixelsOf(game, regions);

      drawWith(game, tool, RED, [at(BIG_LINE_X + 0.5, 300), at(700, 300), at(500, 100)]);

      expect(changedInRegion(game, regions, before, regionA), `${NAMES[tool]}: oblast A`).toEqual(
        [],
      );
      expect(
        paintedNear(game, regions, [at(520, 300), at(680, 300)], 2, RED),
        `${NAMES[tool]}: oblast B`,
      ).toBeGreaterThan(100);
    }
  });

  it('tah začatý mimo obrázek nic nenamaluje, ani když prst na obrázek vjede', () => {
    for (const tool of NEW_TOOLS) {
      const { game, regions } = freshGame();

      drawWith(game, tool, RED, [at(-30, 300), at(300, 300), at(700, 300)]);

      expect(paintedPixels(game, regions), NAMES[tool]).toBe(0);
    }
  });

  it('fix dosáhne až k obrysu a vedlejší oblast nechá prázdnou', () => {
    const { game, regions } = freshGame();
    const { regionB } = bigRegions(regions);
    const before = pixelsOf(game, regions);

    drawWith(game, 'marker', RED, [at(BIG_LINE_X - 5, 100), at(BIG_LINE_X - 5, 500)]);

    for (let y = 100; y < 500; y += 1) {
      expect(game.colorAt(BIG_LINE_X - 1, y), `pixel u obrysu (${BIG_LINE_X - 1}, ${y})`).toBe(RED);
    }
    expect(changedInRegion(game, regions, before, regionB), 'oblast B').toEqual([]);
  });

  it('pastelka u obrysu není řidší než jinde: i u obrysu zůstane nezabarveno 20–40 %', () => {
    const { game, regions } = freshGame();
    const { regionA } = bigRegions(regions);
    const path = [at(BIG_LINE_X - 4, 100), at(BIG_LINE_X - 4, 500)];

    drawWith(game, 'crayon', RED, path);

    const nextToOutline = pixelsWhere(
      regions,
      regionA,
      (center) => center.x > BIG_LINE_X - 10 && center.y > 110 && center.y < 490,
    );
    expect(nextToOutline.length, 'pixely u obrysu').toBeGreaterThan(1000);
    expectGrain(shareWithout(game, nextToOutline, RED), 'pruh u obrysu');
  });

  it('rychlý tah fixem s body daleko od sebe dá souvislou čáru bez mezer', () => {
    const { game, regions } = freshGame();
    const { regionA } = bigRegions(regions);
    const path = [at(20, 20), at(430, 580)];

    drawWith(game, 'marker', RED, path);

    // Čtvercová stopa pokryje vždy aspoň kruh o poloměru 0,3 W kolem čáry.
    expect(missingNear(game, regions, regionA, path, MARKER_HALF - INSIDE, RED)).toEqual([]);
    expect(paintedBeyond(game, regions, path, MARKER_HALF * Math.SQRT2 + OUTSIDE)).toEqual([]);
  });

  it('rychlý tah pastelkou je souvislý: po celé délce má stejné zrno bez děr', () => {
    const { game, regions } = freshGame();
    const { regionA } = bigRegions(regions);
    const from = at(20, 20);
    const to = at(430, 580);
    const pieces = 20;

    drawWith(game, 'crayon', RED, [from, to]);

    expectGrain(crayonGap(game, regions, regionA, [from, to], RED), 'celý tah');
    for (let piece = 0; piece < pieces; piece += 1) {
      const a = at(
        from.x + ((to.x - from.x) * piece) / pieces,
        from.y + ((to.y - from.y) * piece) / pieces,
      );
      const b = at(
        from.x + ((to.x - from.x) * (piece + 1)) / pieces,
        from.y + ((to.y - from.y) * (piece + 1)) / pieces,
      );
      const core = pixelsWhere(
        regions,
        regionA,
        (center) => distanceToSegment(center, a, b) <= CRAYON_RADIUS - INSIDE,
      );
      expect(
        shareWithout(game, core, RED),
        `úsek ${piece + 1} z ${pieces}: nezabarvený díl`,
      ).toBeLessThanOrEqual(CRAYON_GAP_MAX + 0.1);
    }
  });

  it('stejný tah stejným nástrojem nakreslí vždy stejné pixely', () => {
    const strokes: Array<readonly Point[]> = [
      HORIZONTAL,
      [at(30, 40), at(410, 570)],
      [at(60, 500), at(120, 420), at(260, 470), at(380, 380)],
      [at(222.3, 111.7)],
    ];
    for (const tool of NEW_TOOLS) {
      const first = freshGame();
      const second = freshGame();
      for (const path of strokes) {
        drawWith(first.game, tool, RED, path);
        drawWith(second.game, tool, RED, path);
      }
      expect(pixelsOf(second.game, second.regions), `${NAMES[tool]}: dvě hry, stejné tahy`).toEqual(
        pixelsOf(first.game, first.regions),
      );
    }
  });

  it('stejný tah nakreslí stejné pixely i po Zpět a po jiných tazích jinde', () => {
    for (const tool of NEW_TOOLS) {
      const { game, regions } = freshGame();
      drawWith(game, tool, RED, HORIZONTAL);
      const once = pixelsOf(game, regions);
      game.tapUndo();

      drawWith(game, tool, BLUE, [at(500, 50), at(850, 550)]);
      drawWith(game, 'brush', BLACK, [at(600, 500), at(800, 100)]);
      game.tapUndo();
      game.tapUndo();
      drawWith(game, tool, RED, HORIZONTAL);

      expect(pixelsOf(game, regions), NAMES[tool]).toEqual(once);
    }
  });
});

describe('#93 AC4: pastelka a opakování', () => {
  it('opakovaný tah pastelkou přes stejné místo mezery nezaplní', () => {
    const { game, regions } = freshGame();
    const { regionA } = bigRegions(regions);
    drawWith(game, 'crayon', RED, HORIZONTAL);
    const once = pixelsOf(game, regions);

    for (let repeat = 0; repeat < 3; repeat += 1) {
      drawWith(game, 'crayon', RED, HORIZONTAL);
    }

    expect(pixelsOf(game, regions), 'stopa beze změny').toEqual(once);
    expectGrain(crayonGap(game, regions, regionA, HORIZONTAL, RED), 'po opakování');
  });

  it('i trochu posunuté tahy pastelkou přes sebe nechají stopu zrnitou', () => {
    const { game, regions } = freshGame();
    const { regionA } = bigRegions(regions);
    for (const shift of [0, 2, 4, 1, 3]) {
      drawWith(game, 'crayon', RED, [at(100 + shift, 300 + shift), at(350 + shift, 300 + shift)]);
    }

    // Pixely, které s jistotou leží ve stopě všech pěti tahů.
    const overlap = pixelsWhere(
      regions,
      regionA,
      (center) =>
        center.x > 115 && center.x < 340 && Math.abs(center.y - 302) <= CRAYON_RADIUS - INSIDE - 2,
    );
    expectGrain(shareWithout(game, overlap, RED), 'přes sebe');
  });

  it('opakovaný tah pastelkou, který nic nezměnil, se do Zpět nepočítá', () => {
    const { game, regions } = freshGame();
    drawWith(game, 'crayon', RED, HORIZONTAL);
    drawWith(game, 'crayon', RED, HORIZONTAL);
    drawWith(game, 'crayon', RED, HORIZONTAL);

    expect(game.tapUndo().kind, 'první Zpět').toBe('undone');
    expect(paintedPixels(game, regions), 'jedno Zpět vrátí první tah').toBe(0);
    expect(game.tapUndo().kind, 'víc není co vracet').toBe('wobble');
  });

  it('pastelka stejnou barvou přes plně vybarvené místo nic nezmění a do Zpět se nepočítá', () => {
    const { game, regions } = freshGame();
    fillA(game, BLUE);
    const filled = pixelsOf(game, regions);

    drawWith(game, 'crayon', BLUE, HORIZONTAL);
    expect(pixelsOf(game, regions), 'pastelka nic nezměnila').toEqual(filled);

    expect(game.tapUndo().kind).toBe('undone');
    expect(pixelsOf(game, regions), 'Zpět vrátil poslední tah štětcem').not.toEqual(filled);
  });
});

describe('#93 AC5: Zpět vrátí tah fixem i pastelkou pixel po pixelu', () => {
  it('Zpět vrátí tah fixem nebo pastelkou přes několik barev do stavu před ním', () => {
    for (const tool of NEW_TOOLS) {
      const { game, regions } = freshGame();
      colorfulA(game);
      const before = pixelsOf(game, regions);

      drawWith(game, tool, RED, [at(30, 30), at(420, 570), at(420, 30), at(30, 570)]);
      expect(pixelsOf(game, regions), `${NAMES[tool]} něco namaloval`).not.toEqual(before);

      expect(game.tapUndo().kind, NAMES[tool]).toBe('undone');
      expect(pixelsOf(game, regions), NAMES[tool]).toEqual(before);
    }
  });

  it('tahy fixem a pastelkou vrátí Zpět postupně, každý do stavu před ním', () => {
    const { game, regions } = freshGame();
    colorfulA(game);
    const start = pixelsOf(game, regions);
    drawWith(game, 'marker', RED, [at(40, 300), at(420, 300)]);
    const afterMarker = pixelsOf(game, regions);
    drawWith(game, 'crayon', BLUE, [at(40, 310), at(420, 290)]);

    game.tapUndo();
    expect(pixelsOf(game, regions), 'po prvním Zpět').toEqual(afterMarker);
    game.tapUndo();
    expect(pixelsOf(game, regions), 'po druhém Zpět').toEqual(start);
  });

  it('vrácený tah fixem nebo pastelkou zůstane vrácený i po návratu do hry', () => {
    for (const tool of NEW_TOOLS) {
      const { game, regions, storage } = freshGame();
      colorfulA(game);
      const before = pixelsOf(game, regions);
      drawWith(game, tool, RED, HORIZONTAL);
      game.tapUndo();
      game.suspend();

      expect(pixelsOf(openOn(storage, regions), regions), NAMES[tool]).toEqual(before);
    }
  });
});
