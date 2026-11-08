import { afterEach, describe, expect, it, vi } from 'vitest';

import { NO_COLOR, createColoring } from '../../../src/games/coloring/logic/coloring';
import type { RegionMap } from '../../../src/games/coloring/logic/regionMap';
import { OUTLINE_REGION, regionAt } from '../../../src/games/coloring/logic/regionMap';
import type { SavedColoring } from '../../../src/games/coloring/logic/savedPicture';
import type { LineSize } from '../../../src/games/coloring/logic/toolPanel';
import {
  BIG_HEIGHT,
  BIG_LINE_X,
  BIG_WIDTH,
  OUTSIDE,
  bigHalves,
  bigRegions,
  changedInRegion,
  choose,
  drawWith,
  paintedBeyond,
} from './drawingToolHelpers';
import { pixelDifferences } from './extendedPaletteHelpers';
import { SIZES, SIZE_NAMES, chooseSize, fillAWithBrush } from './lineSizeHelpers';
import type { Point } from './outlineFixtures';
import {
  RecordingStorage,
  openOn,
  paintedPixels,
  pixelsOf,
  startStroke,
} from './savedPictureHelpers';
import {
  SPRAY,
  densityProblems,
  pixelsOutsideWholeDots,
  smallestDotDiameter,
  sprayAsPixels,
  sprayPixels,
  sprayStrokeProblems,
  sprayZones,
  sprayZonesAround,
  zoneShares,
} from './sprayHelpers';
import type { SprayPixels } from './sprayHelpers';
import { bigBlank, widthOf } from './stampHelpers';
import { at } from './strokeHelpers';

/**
 * Testy k #104 AC2 (stopa spreje), AC3 (stejný tah, stejný výsledek,
 * překryv tahů, ořez), AC4 (ťuknutí, tahy, které nic nezmění), AC5
 * (velikost a Zpět) a podklad k ruční kontrole AC6 (velikost tečky). Výběr
 * nástroje (AC1) je v `spraySelection.test.ts` a `sprayLayoutRules.test.ts`,
 * uložení a limit v `sprayRecord.test.ts`.
 *
 * Měří se na obrázku 900 × 600 (W stř = 30 px): stopa je pás šířky 2 W
 * kolem čáry tahu. Kde přesně tečky leží a jak hustota klesá od čáry,
 * testy neznají. Vzorek spreje (pixely, které zabarví tah vedený přímo
 * přes ně) zjistí chováním `sprayPixels` v `sprayHelpers.ts`, hustotu
 * v pásmech měří `sprayZones` a `densityProblems`.
 *
 * Navržené rozhraní:
 * - `ToolId` a `PANEL_TOOLS` v `src/games/coloring/logic/toolPanel.ts`
 *   dostanou `'spray'` (sprej, 10. místo),
 * - `SavedColoring.pointerDown` maluje sprejem, když je vybraný (`tapTool`),
 * - `Coloring.pointerDown(pointer, colorIndex, 'spray', width)` barví
 *   v pásu do vzdálenosti `width` (W) od čáry tahu (lomené čáry z bodů
 *   tahu, na koncích kulaté). Pixel se zabarví podle vzdálenosti svého
 *   středu od čáry: každá tečka (pevně umístěná vůči obrázku, velikost
 *   podle šířky plochy, ne podle velikosti čáry) má pevný práh a její
 *   pixel se zabarví, když hustota ve vzdálenosti pixelu (klesající
 *   funkce vzdálenost / W) práh přesáhne. Tak má překryv hustotu podle
 *   bližšího tahu (AC3), opakovaný tah nic nepřidá a výsledek nezávisí na
 *   rozestupu bodů, rychlosti, čase ani `Math.random`. Vzdálenost se počítá
 *   k úsečkám tahu, ne k razítkům po cestě, jinak by pomalý a rychlý tah
 *   dal jiné pixely na okrajích pásem.
 */

const ORANGE = 1;
const BLUE = 4;
const BLACK = 7;
const PINK = 8;
const LIGHT_BLUE = 11;

/** W velikosti `size` na obrázku 900 px (polovina pásu spreje). */
function bandHalf(size: LineSize = 'medium'): number {
  return widthOf(size);
}

/** Vzorek spreje obrázku 900 × 600. */
function bigSpray(): SprayPixels {
  return sprayPixels(BIG_WIDTH, BIG_HEIGHT);
}

function freshOn(regions: RegionMap): { game: SavedColoring; storage: RecordingStorage } {
  const storage = new RecordingStorage();
  return { game: openOn(storage, regions), storage };
}

/** Tah sprejem barvou `color`: výběr barvy, výběr nástroje, tah. */
function spray(game: SavedColoring, path: readonly Point[], color = BLUE): void {
  drawWith(game, SPRAY, color, path);
}

/** Pixely po jednom tahu `path` sprejem barvou `color` na novém prázdném obrázku 900 × 600. */
function aloneOnBlank(
  path: readonly Point[],
  color = BLUE,
  size: LineSize = 'medium',
): Array<number | null> {
  const regions = bigBlank();
  const { game } = freshOn(regions);
  chooseSize(game, size);
  spray(game, path, color);
  return pixelsOf(game, regions);
}

/** Obrázek `under` a přes něj zabarvené pixely obrázku `over` (prázdné pixely `over` nic nemění). */
function overlay(
  under: ReadonlyArray<number | null>,
  over: ReadonlyArray<number | null>,
): Array<number | null> {
  return under.map((color, index) => over[index] ?? color);
}

/** Pixely obrázku `pixels`, jen v oblasti `region`; jinde prázdno. */
function onlyInRegion(
  pixels: ReadonlyArray<number | null>,
  regions: RegionMap,
  region: number,
): Array<number | null> {
  return pixels.map((color, index) =>
    regionAt(regions, index % regions.width, Math.floor(index / regions.width)) === region
      ? color
      : null,
  );
}

/** Co nesedí na tahu `path` sprejem na obrázku `regions` (mimo pás, mimo vzorek, jiná barva). */
function problemsOf(
  game: SavedColoring,
  regions: RegionMap,
  before: ReadonlyArray<number | null>,
  path: readonly Point[],
  options: { color?: number; size?: LineSize; region?: number | null } = {},
): string[] {
  return sprayStrokeProblems({
    game,
    regions,
    before,
    spray: bigSpray(),
    path,
    width: bandHalf(options.size),
    color: options.color ?? BLUE,
    region: options.region ?? null,
  });
}

/** Tah po bodech s nepravidelnými rozestupy na stejné přímce jako `from`–`to`. */
function unevenLine(from: Point, to: Point): Point[] {
  const shares = [0, 0.004, 0.13, 0.131, 0.2, 0.45, 0.46, 0.7, 0.71, 0.93, 1];
  return shares.map((share) =>
    at(from.x + (to.x - from.x) * share, from.y + (to.y - from.y) * share),
  );
}

/** Vodorovný tah přes prázdný obrázek, daleko od okrajů. */
const HORIZONTAL: readonly Point[] = [at(60, 300), at(390, 300)];

/** Dlouhý vodorovný tah na řádku `y`, aby měření nezáviselo na pár tečkách. */
function longRow(y: number): Point[] {
  return [at(70, y), at(830, y)];
}

/** Tahy různých tvarů a směrů. */
const SHAPES: ReadonlyArray<{ name: string; path: readonly Point[] }> = [
  { name: 'vodorovný', path: HORIZONTAL },
  { name: 'svislý', path: [at(700.4, 70.2), at(700.4, 530.7)] },
  { name: 'šikmý dolů', path: [at(80.3, 70.8), at(530.6, 520.1)] },
  { name: 'šikmý nahoru', path: [at(90.2, 540.6), at(560.9, 70.3)] },
  { name: 'lomený', path: [at(100, 500), at(220, 380), at(330, 470), at(470, 360)] },
  {
    name: 'oblouk',
    path: Array.from({ length: 25 }, (_, step) =>
      at(600 + 150 * Math.cos(step / 8), 300 + 150 * Math.sin(step / 8)),
    ),
  },
];

/** Prst se dotkne v `point`, `moves`× se ohlásí na stejném místě po `stepMs` ms a zvedne se. */
function holdStill(game: SavedColoring, point: Point, moves: number, stepMs: number): void {
  game.pointerDown({ id: 1, x: point.x, y: point.y, kind: 'touch' });
  for (let move = 0; move < moves; move += 1) {
    vi.advanceTimersByTime(stepMs);
    game.pointerMove({ id: 1, x: point.x, y: point.y, kind: 'touch' });
  }
  game.pointerUp(1);
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('#104 AC2: stopa je pás šířky 2 W, tečky jsou uprostřed hustší', () => {
  it('ve vodorovném tahu přes prázdnou oblast je do W/2 od čáry zabarveno 50–80 % pixelů a od W/2 do W 10–40 %', () => {
    const problems: string[] = [];
    for (const size of SIZES) {
      for (const y of [150, 300, 303.2, 307.5, 311.9, 452.6]) {
        const regions = bigBlank();
        const { game } = freshOn(regions);
        const path = longRow(y);
        chooseSize(game, size);

        spray(game, path);

        const shares = zoneShares(game, sprayZones(regions, path, bandHalf(size)), BLUE);
        problems.push(...densityProblems(shares, `${SIZE_NAMES[size]}, řádek ${y}`));
      }
    }
    expect(problems).toEqual([]);
  });

  it('blíž čáře je teček víc než u okraje pásu', () => {
    const regions = bigBlank();
    const { game } = freshOn(regions);
    const path = longRow(300);
    const half = bandHalf();

    spray(game, path);

    const near = sprayZones(regions, path, half / 2);
    const nearest = zoneShares(game, { inner: near.inner, outer: near.inner }, BLUE).inner;
    const edge = zoneShares(game, sprayZones(regions, path, half), BLUE).outer;
    expect(nearest, 'do W/4 od čáry hustěji než od W/2 do W').toBeGreaterThan(edge);
  });

  it('tah v každém směru nezabarví nic dál než W od čáry', () => {
    for (const { name, path } of SHAPES) {
      const regions = bigBlank();
      const { game } = freshOn(regions);

      spray(game, path);

      expect(paintedBeyond(game, regions, path, bandHalf() + OUTSIDE), name).toEqual([]);
      expect(paintedPixels(game, regions), `${name}: něco se zabarvilo`).toBeGreaterThan(0);
    }
  });

  it('obláček i pás jsou kulaté: v rozích čtverce kolem ťuknutí nic není', () => {
    const regions = bigBlank();
    const { game } = freshOn(regions);
    const tap = at(300.5, 300.5);

    spray(game, [tap]);

    expect(paintedBeyond(game, regions, [tap], bandHalf() + OUTSIDE)).toEqual([]);
  });

  it('tečky mají jen vybranou barvu, i v nových barvách palety', () => {
    for (const color of [ORANGE, BLUE, BLACK, PINK, LIGHT_BLUE]) {
      const regions = bigBlank();
      const { game } = freshOn(regions);

      spray(game, HORIZONTAL, color);

      const used = new Set(pixelsOf(game, regions).filter((each) => each !== null));
      expect([...used], `barva ${color}`).toEqual([color]);
    }
  });

  it('mezi tečkami zůstane barva, která tam byla předtím', () => {
    const regions = bigHalves();
    const { regionA } = bigRegions(regions);
    const { game } = freshOn(regions);
    fillAWithBrush(game, BLACK);
    const before = pixelsOf(game, regions);
    chooseSize(game, 'medium');

    spray(game, HORIZONTAL, BLUE);

    expect(
      pixelDifferences(
        pixelsOf(game, regions),
        overlay(before, onlyInRegion(aloneOnBlank(HORIZONTAL), regions, regionA)),
        regions.width,
      ),
      'černá všude, kde sprej na prázdném obrázku nic nezabarví',
    ).toEqual([]);
    const shares = zoneShares(game, sprayZones(regions, HORIZONTAL, bandHalf()), BLUE);
    expect(densityProblems(shares, 'přes černou')).toEqual([]);
  });

  it('mezi tečkami na prázdném místě zůstane prázdno', () => {
    const regions = bigBlank();
    const { game } = freshOn(regions);

    spray(game, HORIZONTAL);

    const { inner } = sprayZones(regions, HORIZONTAL, bandHalf());
    const empty = inner.filter(([x, y]) => game.colorAt(x, y) === null).length / inner.length;
    expect(empty, 'i u čáry zůstane mezi tečkami prázdno').toBeGreaterThanOrEqual(0.2);
  });
});

describe('#104 AC3: tečky jsou pevné vůči obrázku a stejný tah dá stejné pixely', () => {
  it('tah v každém směru barví jen tečky vzorku spreje, jen vybranou barvou a jen v pásu', () => {
    for (const { name, path } of SHAPES) {
      const regions = bigBlank();
      const { game } = freshOn(regions);
      const before = pixelsOf(game, regions);

      spray(game, path);

      expect(problemsOf(game, regions, before, path), name).toEqual([]);
    }
  });

  it('tečky vzorku spreje jsou po celém obrázku a u čáry jich je aspoň polovina', () => {
    const pattern = bigSpray();
    const share = pattern.count / (BIG_WIDTH * BIG_HEIGHT);
    // U čáry je hustota aspoň jako průměr vnitřního pásma (50 %).
    expect(share, 'díl obrázku ve vzorku').toBeGreaterThanOrEqual(0.5);
    for (let quarter = 0; quarter < 4; quarter += 1) {
      const left = (quarter % 2) * (BIG_WIDTH / 2);
      const top = Math.floor(quarter / 2) * (BIG_HEIGHT / 2);
      let dots = 0;
      for (let y = top; y < top + BIG_HEIGHT / 2; y += 1) {
        for (let x = left; x < left + BIG_WIDTH / 2; x += 1) {
          dots += pattern.isDot(x, y) ? 1 : 0;
        }
      }
      expect(dots, `čtvrtina obrázku ${quarter + 1}: tečky`).toBeGreaterThan(0);
    }
  });

  it('pomalý tah s mnoha body, rychlý tah se dvěma body, nepravidelný i opačný tah dají stejné pixely', () => {
    const [from, to] = [at(50.5, 80.5), at(820.5, 560.5)];
    const slow: Point[] = [];
    for (let share = 0; share < 1; share += 0.004) {
      slow.push(at(from.x + (to.x - from.x) * share, from.y + (to.y - from.y) * share));
    }
    slow.push(to);
    const fast = aloneOnBlank([from, to]);
    for (const [name, path] of [
      ['pomalý', slow],
      ['nepravidelný', unevenLine(from, to)],
      ['opačným směrem', [to, from]],
    ] as const) {
      expect(pixelDifferences(aloneOnBlank(path), fast, BIG_WIDTH), name).toEqual([]);
    }
  });

  it('tah nezávisí na čase: prst tažený rychle i pomalu dá stejné pixely', () => {
    const path = [at(60.5, 300.5), at(200.5, 260.5), at(420.5, 330.5), at(700.5, 300.5)];
    const expected = aloneOnBlank(path);
    for (const stepMs of [1, 16, 900]) {
      vi.useFakeTimers({ toFake: ['Date', 'performance'], now: 1_000_000 });
      const regions = bigBlank();
      const { game } = freshOn(regions);
      game.tapColor(BLUE);
      choose(game, SPRAY);
      const [first, ...rest] = path;
      game.pointerDown({ id: 1, x: first?.x ?? 0, y: first?.y ?? 0, kind: 'touch' });
      for (const point of rest) {
        vi.advanceTimersByTime(stepMs);
        game.pointerMove({ id: 1, x: point.x, y: point.y, kind: 'touch' });
      }
      vi.advanceTimersByTime(stepMs);
      game.pointerUp(1);
      vi.useRealTimers();

      expect(
        pixelDifferences(pixelsOf(game, regions), expected, regions.width),
        `${stepMs} ms mezi body`,
      ).toEqual([]);
    }
  });

  it('prst držený na místě nic nepřidá: dlouhé držení je stejné jako krátké ťuknutí', () => {
    const tap = at(300.5, 300.5);
    const expected = aloneOnBlank([tap]);
    for (const [moves, stepMs] of [
      [5, 16],
      [120, 16],
      [30, 500],
    ] as const) {
      vi.useFakeTimers({ toFake: ['Date', 'performance'], now: 1_000_000 });
      const regions = bigBlank();
      const { game } = freshOn(regions);
      game.tapColor(BLUE);
      choose(game, SPRAY);

      holdStill(game, tap, moves, stepMs);
      vi.useRealTimers();

      expect(
        pixelDifferences(pixelsOf(game, regions), expected, regions.width),
        `${moves}× po ${stepMs} ms na místě`,
      ).toEqual([]);
    }
  });

  it('prst zastavený na konci tahu nic nepřidá', () => {
    const path = [at(60.5, 300.5), at(390.5, 300.5)];
    const expected = aloneOnBlank(path);
    vi.useFakeTimers({ toFake: ['Date', 'performance'], now: 1_000_000 });
    const regions = bigBlank();
    const { game } = freshOn(regions);
    game.tapColor(BLUE);
    choose(game, SPRAY);
    startStroke(game, path);
    for (let move = 0; move < 60; move += 1) {
      vi.advanceTimersByTime(50);
      game.pointerMove({ id: 1, x: 390.5, y: 300.5, kind: 'touch' });
    }
    game.pointerUp(1);
    vi.useRealTimers();

    expect(pixelDifferences(pixelsOf(game, regions), expected, regions.width)).toEqual([]);
  });

  it('stejné tahy ve dvou hrách nakreslí stejné pixely, i když jedna předtím malovala jinde a vrátila to', () => {
    const regions = bigBlank();
    const first = freshOn(regions).game;
    const second = freshOn(regions).game;
    spray(second, [at(700.3, 100.6), at(850.1, 140.2)]);
    second.tapUndo();

    for (const { path } of SHAPES) {
      spray(first, path);
      spray(second, path);
    }

    expect(
      pixelDifferences(pixelsOf(second, regions), pixelsOf(first, regions), regions.width),
    ).toEqual([]);
  });

  it('tečky nezávisí na náhodě: s jiným Math.random dá stejný tah stejné pixely', () => {
    const regions = bigBlank();
    const drawn: Array<Array<number | null>> = [];
    for (const value of [0.01, 0.5, 0.99]) {
      vi.spyOn(Math, 'random').mockReturnValue(value);
      const { game } = freshOn(regions);
      for (const { path } of SHAPES) {
        spray(game, path);
      }
      drawn.push(pixelsOf(game, regions));
      vi.restoreAllMocks();
    }

    const [first, ...others] = drawn;
    others.forEach((pixels, index) => {
      expect(
        pixelDifferences(pixels, first ?? [], regions.width),
        `hra ${index + 2} proti první`,
      ).toEqual([]);
    });
  });

  it('kde se dva tahy stejnou barvou překrývají, je hustota podle bližšího tahu, ne jejich součet', () => {
    const half = bandHalf();
    const cases: ReadonlyArray<{ name: string; paths: ReadonlyArray<readonly Point[]> }> = [
      {
        name: 'rovnoběžné tahy 0,8 W od sebe',
        paths: [longRow(300), [at(830, 300 + 0.8 * half), at(70, 300 + 0.8 * half)]],
      },
      {
        name: 'rovnoběžné tahy 0,3 W od sebe',
        paths: [longRow(300), longRow(300 + 0.3 * half)],
      },
      {
        name: 'křížící se tahy',
        paths: [longRow(300), [at(450.3, 60.2), at(450.3, 540.8)]],
      },
    ];
    for (const { name, paths } of cases) {
      const regions = bigBlank();
      const { game } = freshOn(regions);
      for (const path of paths) {
        spray(game, path);
      }

      const union = paths.map((path) => aloneOnBlank(path)).reduce((all, one) => overlay(all, one));
      expect(
        pixelDifferences(pixelsOf(game, regions), union, regions.width),
        `${name}: co by zabarvil každý tah sám`,
      ).toEqual([]);
      const shares = zoneShares(game, sprayZonesAround(regions, paths, half), BLUE);
      expect(densityProblems(shares, `${name}, vzdálenost k bližšímu tahu`)).toEqual([]);
    }
  });

  it('tah jinou barvou přes sprej přebarví jen své tečky, jinde zůstane první barva', () => {
    const regions = bigBlank();
    const { game } = freshOn(regions);
    const second = [at(830, 315.5), at(70, 315.5)];
    spray(game, longRow(300), PINK);

    spray(game, second, LIGHT_BLUE);

    expect(
      pixelDifferences(
        pixelsOf(game, regions),
        overlay(aloneOnBlank(longRow(300), PINK), aloneOnBlank(second, LIGHT_BLUE)),
        regions.width,
      ),
    ).toEqual([]);
  });

  it('dva tahy za sebou navazují jako jeden dlouhý tah', () => {
    const [from, to] = [at(60.3, 280.7), at(420.6, 323.3)];
    const split = at(from.x + (to.x - from.x) * 0.47, from.y + (to.y - from.y) * 0.47);
    const regions = bigBlank();
    const { game } = freshOn(regions);

    spray(game, [from, split]);
    spray(game, [split, to]);

    expect(
      pixelDifferences(pixelsOf(game, regions), aloneOnBlank([from, to]), regions.width),
    ).toEqual([]);
  });
});

describe('#104 AC3: ořez platí jako u štětce', () => {
  it('tah začatý v oblasti A a tažený přes obrys do B zabarví v A totéž co na prázdném obrázku a v B nic', () => {
    const regions = bigHalves();
    const { regionA, regionB } = bigRegions(regions);
    const { game } = freshOn(regions);
    const before = pixelsOf(game, regions);
    const path = [at(300, 300), at(650, 300), at(650, 200), at(150, 200)];

    spray(game, path);

    expect(changedInRegion(game, regions, before, regionB), 'oblast B').toEqual([]);
    expect(
      pixelDifferences(
        pixelsOf(game, regions),
        onlyInRegion(aloneOnBlank(path), regions, regionA),
        regions.width,
      ),
      'oblast A',
    ).toEqual([]);
  });

  it('tečky dosáhnou až k obrysu, za ním nic', () => {
    const regions = bigHalves();
    const { regionA } = bigRegions(regions);
    const { game } = freshOn(regions);
    const path = [at(BIG_LINE_X - 8, 30), at(BIG_LINE_X - 8, 570)];

    spray(game, path);

    expect(
      pixelDifferences(
        pixelsOf(game, regions),
        onlyInRegion(aloneOnBlank(path), regions, regionA),
        regions.width,
      ),
    ).toEqual([]);
    let nearLine = 0;
    for (let y = 30; y < 570; y += 1) {
      for (let x = BIG_LINE_X - 3; x < BIG_LINE_X; x += 1) {
        nearLine += game.colorAt(x, y) === BLUE ? 1 : 0;
      }
    }
    expect(nearLine, 'těsně u obrysu jsou tečky').toBeGreaterThan(0);
  });

  it('tah začatý na obrysu barví jen oblast, do které prst vjede', () => {
    const regions = bigHalves();
    const { regionA, regionB } = bigRegions(regions);
    const { game } = freshOn(regions);
    const before = pixelsOf(game, regions);
    const path = [at(BIG_LINE_X + 0.5, 300), at(800, 300), at(500, 100)];

    spray(game, path);

    expect(changedInRegion(game, regions, before, regionA), 'oblast A').toEqual([]);
    // Daleko od místa dotyku musí být v B totéž co na prázdném obrázku.
    const blank = onlyInRegion(aloneOnBlank(path), regions, regionB);
    const drawn = pixelsOf(game, regions);
    const farFromStart = (pixels: ReadonlyArray<number | null>): Array<number | null> =>
      pixels.map((color, index) => (index % regions.width >= BIG_LINE_X + 40 ? color : null));
    expect(
      pixelDifferences(farFromStart(drawn), farFromStart(blank), regions.width),
      'oblast B',
    ).toEqual([]);
  });

  it('tah začatý mimo obrázek nic nenamaluje, ani když prst na obrázek vjede', () => {
    const regions = bigBlank();
    const { game } = freshOn(regions);

    spray(game, [at(-30, 300), at(300, 300), at(700, 300)]);

    expect(paintedPixels(game, regions)).toBe(0);
  });

  it('obrys se nezabarví, ani u ťuknutí těsně u čáry ani při čmárání přes celý obrázek', () => {
    const regions = bigHalves();
    const coloring = createColoring(regions);
    const scribbles: Array<readonly Point[]> = [
      [at(BIG_LINE_X - 3.5, 300.5)],
      [at(BIG_LINE_X + 4.5, 120.5)],
      [at(100, 100), at(800, 500), at(100, 500), at(800, 100)],
      [at(800, 300), at(50, 310), at(870, 320)],
      [at(BIG_LINE_X + 0.5, 20), at(BIG_LINE_X + 0.5, 580), at(30, 580)],
    ];
    scribbles.forEach((path, index) => {
      const [first, ...rest] = path;
      if (first === undefined) {
        return;
      }
      const id = index + 1;
      coloring.pointerDown({ id, x: first.x, y: first.y, kind: 'touch' }, BLUE, SPRAY);
      for (const point of rest) {
        coloring.pointerMove({ id, x: point.x, y: point.y, kind: 'touch' });
      }
      coloring.pointerUp(id);
    });

    const layer = coloring.colorLayer();
    const outline: string[] = [];
    for (let y = 0; y < regions.height; y += 1) {
      for (let x = 0; x < regions.width; x += 1) {
        const color = layer[y * regions.width + x];
        if (regionAt(regions, x, y) === OUTLINE_REGION && color !== NO_COLOR) {
          outline.push(`obrys (${x}, ${y}) má ${String(color)}`);
        }
      }
    }
    expect(outline.slice(0, 5)).toEqual([]);
    expect(
      coloring.colorLayer().some((color) => color !== NO_COLOR),
      'tahy malovaly',
    ).toBe(true);
  });
});

describe('#104 AC4: ťuknutí bez pohybu udělá jeden obláček průměru 2 W', () => {
  it('ťuknutí udělá kulatý obláček průměru 2 W, uprostřed hustší, a nic mimo něj', () => {
    for (const tap of [at(300.5, 300.5), at(207.3, 141.8), at(612.9, 433.4)]) {
      const regions = bigBlank();
      const { game } = freshOn(regions);
      const before = pixelsOf(game, regions);

      spray(game, [tap]);

      const where = `ťuknutí (${tap.x}, ${tap.y})`;
      expect(problemsOf(game, regions, before, [tap]), where).toEqual([]);
      const shares = zoneShares(game, sprayZones(regions, [tap], bandHalf()), BLUE);
      expect(densityProblems(shares, where)).toEqual([]);
    }
  });

  it('ťuknutí v každé velikosti udělá obláček průměru 2 W své velikosti', () => {
    for (const size of SIZES) {
      const regions = bigBlank();
      const { game } = freshOn(regions);
      const tap = at(450.5, 300.5);
      const before = pixelsOf(game, regions);
      chooseSize(game, size);

      spray(game, [tap]);

      expect(problemsOf(game, regions, before, [tap], { size }), SIZE_NAMES[size]).toEqual([]);
      const shares = zoneShares(game, sprayZones(regions, [tap], bandHalf(size)), BLUE);
      expect(densityProblems(shares, SIZE_NAMES[size])).toEqual([]);
    }
  });
});

describe('#104 AC4: tah, který nic nezměnil, se do Zpět nepočítá', () => {
  it('opakovaný stejný tah nic nezmění a do Zpět se nepočítá: jedno Zpět vrátí první tah', () => {
    const regions = bigBlank();
    const { game } = freshOn(regions);
    spray(game, HORIZONTAL);
    const drawn = pixelsOf(game, regions);

    spray(game, HORIZONTAL);
    spray(game, HORIZONTAL);
    spray(game, [...HORIZONTAL].reverse());
    spray(game, unevenLine(HORIZONTAL[0] ?? at(0, 0), HORIZONTAL[1] ?? at(0, 0)));

    expect(
      pixelDifferences(pixelsOf(game, regions), drawn, regions.width),
      'nic nepřibylo',
    ).toEqual([]);
    expect(game.tapUndo().kind, 'první Zpět').toBe('undone');
    expect(paintedPixels(game, regions), 'jedno Zpět vrátí první tah').toBe(0);
    expect(game.tapUndo().kind, 'víc není co vracet').toBe('wobble');
  });

  it('tah po kousku dřívějšího tahu stejnou barvou nic nezmění a do Zpět se nepočítá', () => {
    const regions = bigBlank();
    const { game } = freshOn(regions);
    const [from, to] = [at(60.5, 300.5), at(420.5, 300.5)];
    spray(game, [from, to]);
    const drawn = pixelsOf(game, regions);

    spray(game, [at(150.5, 300.5), at(300.5, 300.5)]);
    spray(game, [at(200.5, 300.5)]);

    expect(
      pixelDifferences(pixelsOf(game, regions), drawn, regions.width),
      'nic se nezměnilo',
    ).toEqual([]);
    expect(game.tapUndo().kind).toBe('undone');
    expect(paintedPixels(game, regions), 'Zpět vrátil první tah').toBe(0);
    expect(game.tapUndo().kind).toBe('wobble');
  });

  it('prst držený na místě se do Zpět počítá jako jedno ťuknutí', () => {
    vi.useFakeTimers({ toFake: ['Date', 'performance'], now: 1_000_000 });
    const regions = bigBlank();
    const { game } = freshOn(regions);
    game.tapColor(BLUE);
    choose(game, SPRAY);

    holdStill(game, at(300.5, 300.5), 60, 50);
    vi.useRealTimers();

    expect(game.tapUndo().kind).toBe('undone');
    expect(paintedPixels(game, regions), 'jedno Zpět vrátí celý obláček').toBe(0);
    expect(game.tapUndo().kind).toBe('wobble');
  });

  it('sprej stejnou barvou přes místo vybarvené touž barvou nic nezmění a do Zpět se nepočítá', () => {
    const regions = bigHalves();
    const { game } = freshOn(regions);
    fillAWithBrush(game, BLUE);
    const filled = pixelsOf(game, regions);

    spray(game, HORIZONTAL, BLUE);
    expect(
      pixelDifferences(pixelsOf(game, regions), filled, regions.width),
      'nic se nezměnilo',
    ).toEqual([]);

    game.tapUndo();
    expect(paintedPixels(game, regions), 'Zpět vrátil vybarvení, ne sprej').toBeLessThan(
      filled.filter((color) => color !== null).length,
    );
  });

  it('tah začatý mimo plochu se do Zpět nepočítá', () => {
    const regions = bigBlank();
    const { game } = freshOn(regions);
    drawWith(game, 'brush', BLACK, [at(100, 100), at(300, 100)]);

    spray(game, [at(-30, 300), at(300, 300)]);

    expect(game.tapUndo().kind, 'Zpět vrátí tah štětcem').toBe('undone');
    expect(game.colorAt(200, 100), 'černá čára je pryč').toBeNull();
    expect(game.tapUndo().kind).toBe('wobble');
  });
});

describe('#104 AC5: velikost mění šířku pásu, tečky zůstávají stejné', () => {
  it('v každé velikosti je pás široký 2 W své velikosti a barví jen tečky vzorku', () => {
    for (const size of SIZES) {
      for (const { name, path } of SHAPES) {
        const regions = bigBlank();
        const { game } = freshOn(regions);
        const before = pixelsOf(game, regions);
        chooseSize(game, size);

        spray(game, path);

        expect(
          problemsOf(game, regions, before, path, { size }),
          `${SIZE_NAMES[size]}, ${name}`,
        ).toEqual([]);
      }
    }
  });

  it('velikost nemění tečky: vzorek spreje je v malé, střední i velké velikosti stejný', () => {
    // Menší obrázek, aby vzorek velké velikosti nebyl pomalý.
    const [width, height] = [450, 300];
    const medium = sprayAsPixels(sprayPixels(width, height, 'medium'));
    for (const size of ['small', 'large'] as const) {
      expect(
        pixelDifferences(sprayAsPixels(sprayPixels(width, height, size)), medium, width),
        SIZE_NAMES[size],
      ).toEqual([]);
    }
  });

  it('širší pás zabarví víc pixelů', () => {
    const counts: number[] = [];
    for (const size of SIZES) {
      const regions = bigBlank();
      const { game } = freshOn(regions);
      chooseSize(game, size);

      spray(game, longRow(300));

      counts.push(paintedPixels(game, regions));
    }
    const [small, medium, large] = counts;
    expect(small, 'malá < střední').toBeLessThan(medium ?? 0);
    expect(medium, 'střední < velká').toBeLessThan(large ?? 0);
  });

  it('velikost zvolená před tahem platí pro celý tah', () => {
    const regions = bigBlank();
    const { game } = freshOn(regions);
    const path = [at(60.5, 300.5), at(200.5, 300.5), at(420.5, 300.5)];
    chooseSize(game, 'large');
    game.tapColor(BLUE);
    choose(game, SPRAY);
    startStroke(game, path.slice(0, 2));

    // Ťuknutí na přepínač během tahu se nepočítá.
    game.tapSizeToggle();
    game.pointerMove({ id: 1, x: 420.5, y: 300.5, kind: 'touch' });
    game.pointerUp(1);

    expect(game.lineSize()).toBe('large');
    expect(
      pixelDifferences(pixelsOf(game, regions), aloneOnBlank(path, BLUE, 'large'), regions.width),
    ).toEqual([]);
  });
});

describe('#104 AC5: Zpět vrátí tah sprejem pixel po pixelu', () => {
  it('Zpět vrátí tah sprejem přes několik barev do stavu před ním', () => {
    const regions = bigHalves();
    const { game } = freshOn(regions);
    fillAWithBrush(game, ORANGE);
    drawWith(game, 'brush', BLACK, [at(200, 20), at(200, 580)]);
    drawWith(game, 'glitter', PINK, [at(60, 100), at(400, 100)]);
    const before = pixelsOf(game, regions);

    spray(game, [at(30.5, 30.5), at(420.5, 570.5), at(420.5, 30.5), at(30.5, 570.5)], BLUE);
    expect(
      pixelDifferences(pixelsOf(game, regions), before, regions.width).length,
      'sprej něco namaloval',
    ).toBeGreaterThan(0);

    expect(game.tapUndo().kind).toBe('undone');
    expect(pixelDifferences(pixelsOf(game, regions), before, regions.width)).toEqual([]);
  });

  it('Zpět vrátí tečky ořezané u obrysu a vedlejší oblast nechá, jak byla', () => {
    const regions = bigHalves();
    const { game } = freshOn(regions);
    drawWith(game, 'brush', ORANGE, [at(BIG_LINE_X + 20, 100), at(BIG_LINE_X + 20, 500)]);
    const before = pixelsOf(game, regions);

    spray(game, [at(BIG_LINE_X - 8, 60.5), at(BIG_LINE_X - 8, 540.5)], BLUE);
    game.tapUndo();

    expect(pixelDifferences(pixelsOf(game, regions), before, regions.width)).toEqual([]);
  });

  it('tahy sprejem a jinými nástroji vrátí Zpět postupně, každý do stavu před ním', () => {
    const regions = bigBlank();
    const { game } = freshOn(regions);
    const states = [pixelsOf(game, regions)];
    spray(game, HORIZONTAL, BLUE);
    states.push(pixelsOf(game, regions));
    drawWith(game, 'crayon', PINK, [at(60, 305), at(390, 295)]);
    states.push(pixelsOf(game, regions));
    drawWith(game, 'glitter', BLACK, [at(70, 300), at(380, 300)]);
    states.push(pixelsOf(game, regions));
    spray(game, [at(80, 290), at(380, 310)], LIGHT_BLUE);

    for (let step = states.length - 1; step >= 0; step -= 1) {
      expect(game.tapUndo().kind, `Zpět ${states.length - step}`).toBe('undone');
      expect(
        pixelDifferences(pixelsOf(game, regions), states[step] ?? [], regions.width),
        `po Zpět ${states.length - step}`,
      ).toEqual([]);
    }
  });

  it('vrácený tah zůstane vrácený i po návratu do hry', () => {
    const regions = bigHalves();
    const { game, storage } = freshOn(regions);
    fillAWithBrush(game, ORANGE);
    const before = pixelsOf(game, regions);
    spray(game, HORIZONTAL);
    game.tapUndo();
    game.suspend();

    expect(
      pixelDifferences(pixelsOf(openOn(storage, regions), regions), before, regions.width),
    ).toEqual([]);
  });

  it('rozpracovaný tah se při schování stránky uloží tak, kam prst došel', () => {
    const regions = bigBlank();
    const { game, storage } = freshOn(regions);
    game.tapColor(BLUE);
    choose(game, SPRAY);
    startStroke(game, HORIZONTAL);
    const drawn = pixelsOf(game, regions);
    game.suspend();

    expect(paintedPixels(game, regions), 'tečky jsou namalované').toBeGreaterThan(0);
    expect(
      pixelDifferences(pixelsOf(openOn(storage, regions), regions), drawn, regions.width),
    ).toEqual([]);
  });
});

describe('#104 AC6 (podklad k ruční kontrole): tečka je dost velká, aby byla vidět', () => {
  it('na ploše s kratší stranou 240 px by měla každá tečka průměr aspoň 2 px', () => {
    // Plocha je 4 : 3 (#96 AC1), s kratší stranou 240 px je široká 320 px.
    // Průměr v pixelech obrázku se proto porovná s 2/320 jeho šířky.
    expect(pixelsOutsideWholeDots(bigSpray(), smallestDotDiameter(BIG_WIDTH))).toEqual([]);
  });
});
