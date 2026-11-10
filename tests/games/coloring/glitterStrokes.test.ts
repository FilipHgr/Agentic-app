import { afterEach, describe, expect, it, vi } from 'vitest';

import { NO_COLOR, createColoring } from '../../../src/games/coloring/logic/coloring';
import type { RegionMap } from '../../../src/games/coloring/logic/regionMap';
import { OUTLINE_REGION, regionAt } from '../../../src/games/coloring/logic/regionMap';
import type { SavedColoring } from '../../../src/games/coloring/logic/savedPicture';
import type { LineSize } from '../../../src/games/coloring/logic/toolPanel';
import { shareWith, strokeCore, surelyInside } from './dotsHelpers';
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
} from './drawingToolHelpers';
import { pixelDifferences } from './extendedPaletteHelpers';
import {
  GLITTER,
  GLITTER_SHARE_MAX,
  GLITTER_SHARE_MIN,
  GLITTER_WIDTH_FACTOR,
  cutSparkles,
  glitterAsPixels,
  glitterPixels,
  glitterStrokeProblems,
  smallestSparkleSpan,
  sparkleShapeProblems,
  sparklesOf,
  spanOf,
} from './glitterHelpers';
import type { GlitterPixels } from './glitterHelpers';
import { SIZES, SIZE_NAMES, chooseSize, fillAWithBrush } from './lineSizeHelpers';
import { centerOf, distanceToPath } from './outlineFixtures';
import type { Point } from './outlineFixtures';
import {
  RecordingStorage,
  openOn,
  paintedPixels,
  pixelsOf,
  startStroke,
} from './savedPictureHelpers';
import { bigBlank, widthOf } from './stampHelpers';
import { at } from './strokeHelpers';

/**
 * Testy k #103 AC2 (stopa třpytek), AC4 (stejný výsledek, ořez,
 * souvislost, opakovaný tah a ťuknutí), AC5 (velikost a Zpět) a podklad
 * k ruční kontrole AC6 (rozpětí jiskry). Výběr nástroje (AC1) je
 * v `glitterSelection.test.ts` a `glitterLayoutRules.test.ts`, lesk během
 * tahu (AC3) v `glitterShine.test.ts`, uložení a limit v `glitterRecord.test.ts`.
 *
 * Měří se na obrázku 900 × 600 (W stř = 30 px): stopa je kulatá a široká
 * 1,5 W. Kde přesně jiskry leží, jak jsou velké a natočené, testy zjistí
 * chováním (`glitterPixels` v `glitterHelpers.ts`): celý prázdný obrázek se
 * přejede třpytkami. Že jsou to drobné čtyřcípé jiskry, hlídá první blok.
 * Ostatní testy porovnávají tahy s těmito jiskrami.
 *
 * Navržené rozhraní:
 * - `ToolId` a `PANEL_TOOLS` v `src/games/coloring/logic/toolPanel.ts`
 *   dostanou `'glitter'` (třpytky),
 * - `SavedColoring.pointerDown` maluje třpytky, když jsou vybrané (`tapTool`),
 * - `Coloring.pointerDown(pointer, colorIndex, 'glitter', width)` maluje
 *   kulatou stopou šířky 1,5 `width`, ale barvou `colorIndex` zapíše jen
 *   pixely jisker; jiskry (velikost podle W stř, tedy šířky plochy) jsou
 *   pevné vůči obrázku a nezávisí na tahu, jeho směru, velikosti ani na
 *   `Math.random` (u proužků vzor stopy `pattern: 'stripes'`, tady třeba
 *   `pattern: 'glitter'`).
 */

const ORANGE = 1;
const BLUE = 4;
const BLACK = 7;
const PINK = 8;
const LIGHT_BLUE = 11;

/** Polovina šířky stopy velikosti `size` (stopa je široká 1,5 W). */
function radiusOf(size: LineSize = 'medium'): number {
  return (GLITTER_WIDTH_FACTOR * widthOf(size)) / 2;
}

/** Jiskry obrázku 900 × 600. */
function bigGlitter(): GlitterPixels {
  return glitterPixels(BIG_WIDTH, BIG_HEIGHT);
}

function freshOn(regions: RegionMap): { game: SavedColoring; storage: RecordingStorage } {
  const storage = new RecordingStorage();
  return { game: openOn(storage, regions), storage };
}

/** Tah třpytkami barvou `color`: výběr barvy, výběr nástroje, tah. */
function glitter(game: SavedColoring, path: readonly Point[], color = BLUE): void {
  drawWith(game, GLITTER, color, path);
}

/** Tah po bodech s nepravidelnými rozestupy na stejné přímce jako `from`–`to`. */
function unevenLine(from: Point, to: Point): Point[] {
  const shares = [0, 0.004, 0.13, 0.131, 0.2, 0.45, 0.46, 0.7, 0.71, 0.93, 1];
  return shares.map((share) =>
    at(from.x + (to.x - from.x) * share, from.y + (to.y - from.y) * share),
  );
}

/** Co nesedí na tahu `path` třpytkami na obrázku `regions`. */
function problemsOf(
  game: SavedColoring,
  regions: RegionMap,
  before: ReadonlyArray<number | null>,
  path: readonly Point[],
  options: { color?: number; size?: LineSize; region?: number | null } = {},
): string[] {
  return glitterStrokeProblems({
    game,
    regions,
    before,
    glitter: bigGlitter(),
    path,
    radius: radiusOf(options.size),
    color: options.color ?? BLUE,
    region: options.region ?? null,
  });
}

/** Pixely jisker ve stopě, které nemají barvu `color`, a zabarvené pixely mimo jiskry. */
function offSparkles(
  game: SavedColoring,
  pixels: ReadonlyArray<[number, number]>,
  color: number,
): { missing: number; outside: number } {
  const grid = bigGlitter();
  return {
    missing: pixels.filter(([x, y]) => grid.isSparkle(x, y) && game.colorAt(x, y) !== color).length,
    outside: pixels.filter(([x, y]) => !grid.isSparkle(x, y) && game.colorAt(x, y) !== null).length,
  };
}

/** Vodorovný tah přes prázdný obrázek, daleko od okrajů. */
const HORIZONTAL: readonly Point[] = [at(60, 300), at(390, 300)];

/** Dlouhý vodorovný tah na řádku `y`, aby měření nezáviselo na pár jiskrách. */
function longRow(y: number): Point[] {
  return [at(60, y), at(840, y)];
}

/** Tahy různých tvarů a směrů: jiskry nesmí záviset na směru tahu. */
const SHAPES: ReadonlyArray<{ name: string; path: readonly Point[] }> = [
  { name: 'vodorovný', path: HORIZONTAL },
  { name: 'svislý', path: [at(700.4, 40.2), at(700.4, 560.7)] },
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

afterEach(() => {
  vi.restoreAllMocks();
});

describe('#103 AC2: jiskry jsou drobné a čtyřcípé', () => {
  it('každá jiskra je drobná čtyřcípá jiskra se čtyřmi cípy po 90° a zářezy mezi nimi', () => {
    expect(sparkleShapeProblems(bigGlitter())).toEqual([]);
  });

  it('jisker je na obrázku hodně a jsou rozeseté po celé ploše, ne jen na jednom místě', () => {
    const sparkles = sparklesOf(bigGlitter()).filter((sparkle) => !sparkle.atEdge);
    const quarters = [0, 1, 2, 3].map(
      (quarter) =>
        sparkles.filter(
          (sparkle) =>
            Math.floor(sparkle.center.x / (BIG_WIDTH / 2)) +
              2 * Math.floor(sparkle.center.y / (BIG_HEIGHT / 2)) ===
            quarter,
        ).length,
    );
    quarters.forEach((count, quarter) => {
      expect(count, `čtvrtina obrázku ${quarter + 1}: jisker`).toBeGreaterThan(10);
    });
  });
});

describe('#103 AC2: stopa je kulatá, široká 1,5 W a barví jen jiskry', () => {
  it('ve vodorovném tahu přes prázdnou oblast je zabarveno 8–20 % pixelů stopy', () => {
    for (const size of SIZES) {
      for (const y of [150, 300, 303.2, 307.5, 311.9, 452.6]) {
        const regions = bigBlank();
        const { game } = freshOn(regions);
        const path = longRow(y);
        chooseSize(game, size);

        glitter(game, path);

        const share = shareWith(game, strokeCore(regions, path, radiusOf(size)), BLUE);
        const what = `${SIZE_NAMES[size]}, řádek ${y}: zabarvený díl stopy`;
        expect(share, what).toBeGreaterThanOrEqual(GLITTER_SHARE_MIN);
        expect(share, what).toBeLessThanOrEqual(GLITTER_SHARE_MAX);
      }
    }
  });

  it('tah v každém směru zabarví vybranou barvou jiskry ve stopě široké 1,5 W a nic mimo jiskry ani mimo stopu', () => {
    for (const { name, path } of SHAPES) {
      const regions = bigBlank();
      const { game } = freshOn(regions);
      const before = pixelsOf(game, regions);

      glitter(game, path);

      expect(problemsOf(game, regions, before, path), name).toEqual([]);
    }
  });

  it('stopa je široká 1,5 W: jiskry daleko od čáry až skoro do 0,75 W se zabarví, za ní ne', () => {
    const regions = bigBlank();
    const { game } = freshOn(regions);
    const radius = radiusOf();

    glitter(game, HORIZONTAL);

    const nearEdge = strokeCore(regions, HORIZONTAL, radius).filter(([x, y]) => {
      const distance = distanceToPath(centerOf(x, y), HORIZONTAL);
      return distance > 0.6 * radius && bigGlitter().isSparkle(x, y);
    });
    expect(nearEdge.length, 'u okraje stopy jsou jiskry').toBeGreaterThan(0);
    expect(shareWith(game, nearEdge, BLUE), 'jiskry u okraje stopy jsou zabarvené').toBe(1);
  });

  it('stopa je kulatá: ťuknutí nezabarví jiskry v rozích čtverce kolem kruhu', () => {
    const regions = bigBlank();
    const { game } = freshOn(regions);
    const tap = at(300.5, 300.5);
    const radius = radiusOf();

    glitter(game, [tap]);

    const corners = strokeCore(regions, [tap], radius * Math.SQRT2).filter(([x, y]) => {
      const distance = distanceToPath(centerOf(x, y), [tap]);
      return distance > radius + OUTSIDE && bigGlitter().isSparkle(x, y);
    });
    expect(corners.length, 'v rozích jsou jiskry').toBeGreaterThan(0);
    expect(shareWith(game, corners, BLUE), 'rohy zůstaly prázdné').toBe(0);
  });

  it('jiskry mají jen vybranou barvu, i v nových barvách palety', () => {
    for (const color of [ORANGE, BLUE, BLACK, PINK, LIGHT_BLUE]) {
      const regions = bigBlank();
      const { game } = freshOn(regions);

      glitter(game, HORIZONTAL, color);

      const used = new Set(pixelsOf(game, regions).filter((each) => each !== null));
      expect([...used], `barva ${color}`).toEqual([color]);
    }
  });

  it('mimo jiskry zůstane barva, která tam byla předtím', () => {
    const regions = bigHalves();
    const { regionA } = bigRegions(regions);
    const { game } = freshOn(regions);
    fillAWithBrush(game, BLACK);
    const before = pixelsOf(game, regions);
    chooseSize(game, 'medium');

    glitter(game, HORIZONTAL, BLUE);

    expect(problemsOf(game, regions, before, HORIZONTAL, { region: regionA })).toEqual([]);
    const core = strokeCore(regions, HORIZONTAL, radiusOf());
    expect(shareWith(game, core, BLACK), 'mezi jiskrami je vidět černá').toBeGreaterThan(0.75);
    expect(shareWith(game, core, BLUE), 'jiskry jsou modré').toBeGreaterThan(0.05);
  });

  it('mimo jiskry na prázdném místě zůstane prázdno', () => {
    const regions = bigBlank();
    const { game } = freshOn(regions);

    glitter(game, HORIZONTAL);

    const core = strokeCore(regions, HORIZONTAL, radiusOf());
    const between = core.filter(([x, y]) => !bigGlitter().isSparkle(x, y));
    expect(between.length, 've stopě je místo mezi jiskrami').toBeGreaterThan(0);
    expect(between.filter(([x, y]) => game.colorAt(x, y) !== null).length).toBe(0);
  });

  it('jiskry jsou pevné vůči obrázku: v oblastech obrázku s obrysem leží na stejných místech', () => {
    const regions = bigHalves();
    const { game } = freshOn(regions);
    const large = GLITTER_WIDTH_FACTOR * widthOf('large');
    chooseSize(game, 'large');
    for (let y = 0; y < BIG_HEIGHT + large / 2; y += large / 2) {
      const row = Math.min(y, BIG_HEIGHT - 0.5);
      glitter(game, [at(0.5, row), at(BIG_LINE_X - 1, row)]);
      glitter(game, [at(BIG_LINE_X + 2.5, row), at(BIG_WIDTH - 0.5, row)]);
    }

    const expected = pixelsOf(
      {
        colorAt: (x, y) => {
          const region = regionAt(regions, x, y);
          return region !== OUTLINE_REGION && bigGlitter().isSparkle(x, y) ? BLUE : null;
        },
      },
      regions,
    );
    expect(pixelDifferences(pixelsOf(game, regions), expected, regions.width)).toEqual([]);
  });
});

describe('#103 AC4: stejný tah dá vždy stejné pixely', () => {
  it('pomalý tah s mnoha body, rychlý tah se dvěma body i tah s nepravidelnými body barví stejné jiskry', () => {
    const [from, to] = [at(50.5, 80.5), at(820.5, 560.5)];
    const slow: Point[] = [];
    for (let share = 0; share < 1; share += 0.004) {
      slow.push(at(from.x + (to.x - from.x) * share, from.y + (to.y - from.y) * share));
    }
    slow.push(to);
    for (const [name, path] of [
      ['rychlý', [from, to]],
      ['pomalý', slow],
      ['nepravidelný', unevenLine(from, to)],
      ['opačným směrem', [to, from]],
    ] as const) {
      const regions = bigBlank();
      const { game } = freshOn(regions);
      const before = pixelsOf(game, regions);

      glitter(game, path);

      expect(problemsOf(game, regions, before, [from, to]), name).toEqual([]);
    }
  });

  it('stejné tahy ve dvou hrách nakreslí stejné pixely, i když jinde předtím malovaly jinak', () => {
    const regions = bigBlank();
    const first = freshOn(regions).game;
    const second = freshOn(regions).game;
    // Druhá hra nejdřív maluje jinde a pak to vrátí, jiskry se tím nesmí posunout.
    glitter(second, [at(700.3, 100.6), at(850.1, 140.2)]);
    second.tapUndo();

    for (const { path } of SHAPES) {
      glitter(first, path);
      glitter(second, path);
    }

    expect(
      pixelDifferences(pixelsOf(second, regions), pixelsOf(first, regions), regions.width),
    ).toEqual([]);
  });

  it('jiskry v obrázku nezávisí na náhodě: s jiným Math.random dá stejný tah stejné pixely', () => {
    const regions = bigBlank();
    const drawn: Array<Array<number | null>> = [];
    for (const value of [0.01, 0.5, 0.99]) {
      vi.spyOn(Math, 'random').mockReturnValue(value);
      const { game } = freshOn(regions);
      for (const { path } of SHAPES) {
        glitter(game, path);
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
});

describe('#103 AC4: ořez a souvislost platí jako u štětce', () => {
  it('tah začatý v oblasti A a tažený přes obrys do B barví dál jen jiskry v A, i po návratu do A', () => {
    const regions = bigHalves();
    const { regionA, regionB } = bigRegions(regions);
    const { game } = freshOn(regions);
    const before = pixelsOf(game, regions);
    const path = [at(300, 300), at(650, 300), at(650, 200), at(150, 200)];

    glitter(game, path);

    expect(changedInRegion(game, regions, before, regionB), 'oblast B').toEqual([]);
    expect(problemsOf(game, regions, before, path, { region: regionA }), 'oblast A').toEqual([]);
  });

  it('jiskry dosáhnou až k obrysu, za ním nic', () => {
    const regions = bigHalves();
    const { regionA } = bigRegions(regions);
    const { game } = freshOn(regions);
    const before = pixelsOf(game, regions);
    const path = [at(BIG_LINE_X - 8, 30), at(BIG_LINE_X - 8, 570)];

    glitter(game, path);

    expect(problemsOf(game, regions, before, path, { region: regionA })).toEqual([]);
    const nearLine = strokeCore(regions, path, radiusOf()).filter(
      ([x, y]) => x < BIG_LINE_X && x >= BIG_LINE_X - 3 && bigGlitter().isSparkle(x, y),
    );
    expect(nearLine.length, 'u obrysu jsou jiskry').toBeGreaterThan(0);
    expect(shareWith(game, nearLine, BLUE), 'jiskry těsně u obrysu jsou zabarvené').toBe(1);
  });

  it('tah začatý na obrysu barví jen oblast, do které prst vjede', () => {
    const regions = bigHalves();
    const { regionA, regionB } = bigRegions(regions);
    const { game } = freshOn(regions);
    const before = pixelsOf(game, regions);
    const path = [at(BIG_LINE_X + 0.5, 300), at(800, 300), at(500, 100)];

    glitter(game, path);

    expect(changedInRegion(game, regions, before, regionA), 'oblast A').toEqual([]);
    const inB = strokeCore(regions, [at(530, 300), at(780, 300)], radiusOf()).filter(
      ([x, y]) => regionAt(regions, x, y) === regionB && bigGlitter().isSparkle(x, y),
    );
    expect(inB.length, 'stopou v B jdou jiskry').toBeGreaterThan(0);
    expect(shareWith(game, inB, BLUE), 'jiskry v B').toBe(1);
  });

  it('tah začatý mimo obrázek nic nenamaluje, ani když prst na obrázek vjede', () => {
    const regions = bigBlank();
    const { game } = freshOn(regions);

    glitter(game, [at(-30, 300), at(300, 300), at(700, 300)]);

    expect(paintedPixels(game, regions)).toBe(0);
  });

  it('rychlý tah se dvěma body daleko od sebe je souvislý: žádná jiskra po cestě nechybí', () => {
    const regions = bigBlank();
    const { game } = freshOn(regions);
    const before = pixelsOf(game, regions);
    const path = [at(20.2, 30.7), at(880.4, 570.9)];

    glitter(game, path);

    expect(problemsOf(game, regions, before, path)).toEqual([]);
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
      coloring.pointerDown({ id, x: first.x, y: first.y, kind: 'touch' }, BLUE, GLITTER);
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

describe('#103 AC4: opakovaný tah nic nepřidá a do Zpět se nepočítá', () => {
  it('opakovaný tah přes stejné místo nic nepřidá a mezi jiskrami zůstane prázdno', () => {
    const regions = bigBlank();
    const { game } = freshOn(regions);
    const before = pixelsOf(game, regions);
    glitter(game, HORIZONTAL);
    const drawn = pixelsOf(game, regions);

    for (let repeat = 0; repeat < 5; repeat += 1) {
      glitter(game, HORIZONTAL);
    }

    expect(
      pixelDifferences(pixelsOf(game, regions), drawn, regions.width),
      'nic nepřibylo',
    ).toEqual([]);
    expect(problemsOf(game, regions, before, HORIZONTAL)).toEqual([]);
  });

  it('opakovaný stejný tah do Zpět nepočítá: jedno Zpět vrátí první tah a víc není co vracet', () => {
    const regions = bigBlank();
    const { game } = freshOn(regions);
    glitter(game, HORIZONTAL);
    glitter(game, HORIZONTAL);
    glitter(game, [...HORIZONTAL].reverse());

    expect(game.tapUndo().kind, 'první Zpět').toBe('undone');
    expect(paintedPixels(game, regions), 'jedno Zpět vrátí první tah').toBe(0);
    expect(game.tapUndo().kind, 'víc není co vracet').toBe('wobble');
  });

  it('i trochu posunuté tahy tam a zpátky barví jen jiskry, mezi nimi zůstane prázdno', () => {
    const regions = bigBlank();
    const { game } = freshOn(regions);
    [0, 2.3, 4.6, 7.1, 9.4, 13.8].forEach((shift, index) => {
      const there = [at(60 + shift, 300 + shift), at(390 + shift, 300 - shift)];
      glitter(game, index % 2 === 0 ? there : [...there].reverse());
    });

    const painted: string[] = [];
    for (let y = 0; y < regions.height; y += 1) {
      for (let x = 0; x < regions.width; x += 1) {
        if (game.colorAt(x, y) !== null && !bigGlitter().isSparkle(x, y)) {
          painted.push(`pixel mimo jiskry (${x}, ${y}) je zabarvený`);
        }
      }
    }
    expect(painted.slice(0, 5)).toEqual([]);
    expect(paintedPixels(game, regions), 'tahy něco namalovaly').toBeGreaterThan(0);
  });

  it('tah přes místo, které už má stejné jiskry, nic nezmění a do Zpět se nepočítá', () => {
    const regions = bigBlank();
    const { game } = freshOn(regions);
    chooseSize(game, 'large');
    glitter(game, HORIZONTAL);
    const drawn = pixelsOf(game, regions);

    // Užší a kratší tahy uvnitř velké stopy, jiné body, směr i velikost.
    chooseSize(game, 'small');
    glitter(game, [at(100.3, 297.1), at(250.8, 305.4)]);
    chooseSize(game, 'medium');
    glitter(game, [at(320.6, 306.2), at(140.1, 293.9), at(200.2, 300.4)]);
    glitter(game, [at(180.5, 300.5)]);

    expect(
      pixelDifferences(pixelsOf(game, regions), drawn, regions.width),
      'nic se nezměnilo',
    ).toEqual([]);
    expect(game.tapUndo().kind).toBe('undone');
    expect(paintedPixels(game, regions), 'Zpět vrátil velký tah').toBe(0);
    expect(game.tapUndo().kind).toBe('wobble');
  });

  it('dva tahy za sebou navazují jako jeden dlouhý tah: jiskry na styku nejsou posunuté', () => {
    const regions = bigBlank();
    const { game } = freshOn(regions);
    const before = pixelsOf(game, regions);
    const [from, to] = [at(60.3, 280.7), at(420.6, 323.3)];
    const split = at(from.x + (to.x - from.x) * 0.47, from.y + (to.y - from.y) * 0.47);

    glitter(game, [from, split]);
    glitter(game, [split, to]);

    expect(problemsOf(game, regions, before, [from, to])).toEqual([]);
  });

  it('vedlejší tahy různými směry se překrývají bez posunutých jisker', () => {
    const regions = bigBlank();
    const { game } = freshOn(regions);
    const paths = [
      [at(60, 300), at(400, 300)],
      [at(400, 318.4), at(60, 318.4)],
      [at(230.6, 150.2), at(230.6, 450.8)],
    ];

    for (const path of paths) {
      glitter(game, path);
    }

    const core = paths.flatMap((path) => strokeCore(regions, path, radiusOf()));
    const { missing, outside } = offSparkles(game, core, BLUE);
    expect(missing, 'jiskry všech stop jsou celé').toBe(0);
    expect(outside, 'mimo jiskry nic').toBe(0);
  });

  it('tah začatý mimo plochu se do Zpět nepočítá', () => {
    const regions = bigBlank();
    const { game } = freshOn(regions);
    drawWith(game, 'brush', BLACK, [at(100, 100), at(300, 100)]);

    glitter(game, [at(-30, 300), at(300, 300)]);

    expect(game.tapUndo().kind, 'Zpět vrátí tah štětcem').toBe('undone');
    expect(game.colorAt(200, 100), 'černá čára je pryč').toBeNull();
    expect(game.tapUndo().kind).toBe('wobble');
  });

  it('třpytky stejnou barvou přes stejně vybarvené místo nic nezmění a do Zpět se nepočítají', () => {
    const regions = bigHalves();
    const { game } = freshOn(regions);
    fillAWithBrush(game, BLUE);
    const filled = pixelsOf(game, regions);

    glitter(game, HORIZONTAL, BLUE);
    expect(
      pixelDifferences(pixelsOf(game, regions), filled, regions.width),
      'nic se nezměnilo',
    ).toEqual([]);

    game.tapUndo();
    expect(paintedPixels(game, regions), 'Zpět vrátil vybarvení, ne třpytky').toBeLessThan(
      filled.filter((color) => color !== null).length,
    );
  });
});

describe('#103 AC4: ťuknutí zabarví jiskry v kruhu průměru 1,5 W', () => {
  it('ťuknutí zabarví pixely jisker v kruhu průměru 1,5 W a nic mimo něj', () => {
    for (const tap of [at(300.5, 300.5), at(207.3, 141.8), at(612.9, 433.4)]) {
      const regions = bigBlank();
      const { game } = freshOn(regions);
      const before = pixelsOf(game, regions);

      glitter(game, [tap]);

      const where = `ťuknutí (${tap.x}, ${tap.y})`;
      expect(problemsOf(game, regions, before, [tap]), where).toEqual([]);
      const inCircle = strokeCore(regions, [tap], radiusOf());
      expect(
        inCircle.filter(([x, y]) => bigGlitter().isSparkle(x, y)).length,
        `${where}: v kruhu jsou jiskry`,
      ).toBeGreaterThan(0);
    }
  });

  it('jiskra, do které kruh ťuknutí zasahuje jen zčásti, se zabarví jen uvnitř kruhu', () => {
    const radius = radiusOf();
    let checked = 0;
    for (const tap of [at(300.5, 300.5), at(207.3, 141.8), at(612.9, 433.4), at(455.2, 77.7)]) {
      const regions = bigBlank();
      const { game } = freshOn(regions);

      glitter(game, [tap]);

      const where = `ťuknutí (${tap.x}, ${tap.y})`;
      for (const sparkle of cutSparkles(bigGlitter(), tap, radius)) {
        checked += 1;
        const inside = sparkle.pixels.filter(
          ([x, y]) => distanceToPath(centerOf(x, y), [tap]) <= surelyInside(radius),
        );
        const outside = sparkle.pixels.filter(
          ([x, y]) => distanceToPath(centerOf(x, y), [tap]) > radius + OUTSIDE,
        );
        const name = `${where}, jiskra (${sparkle.center.x.toFixed(1)}, ${sparkle.center.y.toFixed(1)})`;
        expect(shareWith(game, inside, BLUE), `${name}: část v kruhu`).toBe(1);
        expect(shareWith(game, outside, BLUE), `${name}: část mimo kruh`).toBe(0);
      }
    }
    expect(checked, 'kruhy ťuknutí protínají nějaké jiskry').toBeGreaterThan(0);
  });

  it('ťuknutí, při kterém se prst zachvěje na místě, je pořád kruh jisker průměru 1,5 W', () => {
    const regions = bigBlank();
    const { game } = freshOn(regions);
    const before = pixelsOf(game, regions);
    const tap = at(300.5, 300.5);

    glitter(game, [tap, at(300.7, 300.5), tap, at(300.5, 300.6), tap]);

    expect(problemsOf(game, regions, before, [tap])).toEqual([]);
  });
});

describe('#103 AC5: velikost mění šířku stopy, jiskry zůstávají stejné', () => {
  it('v každé velikosti je stopa kulatá a široká 1,5 W své velikosti a barví stejné jiskry', () => {
    for (const size of SIZES) {
      for (const { name, path } of SHAPES) {
        const regions = bigBlank();
        const { game } = freshOn(regions);
        const before = pixelsOf(game, regions);
        chooseSize(game, size);

        glitter(game, path);

        expect(
          problemsOf(game, regions, before, path, { size }),
          `${SIZE_NAMES[size]}, ${name}`,
        ).toEqual([]);
      }
    }
  });

  it('velikost nemění jiskry: celý obrázek přejetý malou, střední i velkou stopou má stejné jiskry', () => {
    const large = glitterAsPixels(glitterPixels(BIG_WIDTH, BIG_HEIGHT, 'large'));
    for (const size of ['small', 'medium'] as const) {
      expect(
        pixelDifferences(
          glitterAsPixels(glitterPixels(BIG_WIDTH, BIG_HEIGHT, size)),
          large,
          BIG_WIDTH,
        ),
        SIZE_NAMES[size],
      ).toEqual([]);
    }
  });

  it('širší stopa zabarví víc jisker', () => {
    const counts: number[] = [];
    for (const size of SIZES) {
      const regions = bigBlank();
      const { game } = freshOn(regions);
      chooseSize(game, size);

      glitter(game, longRow(300));

      counts.push(paintedPixels(game, regions));
    }
    const [small, medium, large] = counts;
    expect(small, 'malá < střední').toBeLessThan(medium ?? 0);
    expect(medium, 'střední < velká').toBeLessThan(large ?? 0);
  });

  it('velikost zvolená před tahem platí pro celý tah', () => {
    const regions = bigBlank();
    const { game } = freshOn(regions);
    const before = pixelsOf(game, regions);
    const path = [at(60.5, 300.5), at(200.5, 300.5), at(420.5, 300.5)];
    chooseSize(game, 'large');
    choose(game, GLITTER);
    game.tapColor(BLUE);
    startStroke(game, path.slice(0, 2));

    // Ťuknutí na tlačítko jiné tloušťky během tahu se nepočítá (#112 AC5).
    game.tapLineSize('small');
    game.pointerMove({ id: 1, x: 420.5, y: 300.5, kind: 'touch' });
    game.pointerUp(1);

    expect(game.lineSize()).toBe('large');
    expect(problemsOf(game, regions, before, path, { size: 'large' })).toEqual([]);
  });
});

describe('#103 AC5: Zpět vrátí tah třpytkami pixel po pixelu', () => {
  it('Zpět vrátí tah s jiskrami přes několik barev do stavu před ním', () => {
    const regions = bigHalves();
    const { game } = freshOn(regions);
    fillAWithBrush(game, ORANGE);
    drawWith(game, 'brush', BLACK, [at(200, 20), at(200, 580)]);
    drawWith(game, 'stripes', PINK, [at(60, 100), at(400, 100)]);
    const before = pixelsOf(game, regions);

    glitter(game, [at(30.5, 30.5), at(420.5, 570.5), at(420.5, 30.5), at(30.5, 570.5)], BLUE);
    expect(
      pixelDifferences(pixelsOf(game, regions), before, regions.width).length,
      'třpytky něco namalovaly',
    ).toBeGreaterThan(0);

    expect(game.tapUndo().kind).toBe('undone');
    expect(pixelDifferences(pixelsOf(game, regions), before, regions.width)).toEqual([]);
  });

  it('Zpět vrátí jiskry ořezané u obrysu a vedlejší oblast nechá, jak byla', () => {
    const regions = bigHalves();
    const { game } = freshOn(regions);
    drawWith(game, 'brush', ORANGE, [at(BIG_LINE_X + 20, 100), at(BIG_LINE_X + 20, 500)]);
    const before = pixelsOf(game, regions);

    glitter(game, [at(BIG_LINE_X - 8, 60.5), at(BIG_LINE_X - 8, 540.5)], BLUE);
    game.tapUndo();

    expect(pixelDifferences(pixelsOf(game, regions), before, regions.width)).toEqual([]);
  });

  it('tahy třpytkami a jinými nástroji vrátí Zpět postupně, každý do stavu před ním', () => {
    const regions = bigBlank();
    const { game } = freshOn(regions);
    const states = [pixelsOf(game, regions)];
    glitter(game, HORIZONTAL, BLUE);
    states.push(pixelsOf(game, regions));
    drawWith(game, 'crayon', PINK, [at(60, 305), at(390, 295)]);
    states.push(pixelsOf(game, regions));
    drawWith(game, 'dots', BLACK, [at(70, 300), at(380, 300)]);
    states.push(pixelsOf(game, regions));
    glitter(game, [at(80, 290), at(380, 310)], LIGHT_BLUE);

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
    glitter(game, HORIZONTAL);
    game.tapUndo();
    game.suspend();

    expect(
      pixelDifferences(pixelsOf(openOn(storage, regions), regions), before, regions.width),
    ).toEqual([]);
  });

  it('rozpracovaný tah se při schování stránky uloží tak, kam prst došel', () => {
    const regions = bigBlank();
    const { game, storage } = freshOn(regions);
    choose(game, GLITTER);
    game.tapColor(BLUE);
    startStroke(game, HORIZONTAL);
    const drawn = pixelsOf(game, regions);
    game.suspend();

    expect(paintedPixels(game, regions), 'jiskry jsou namalované').toBeGreaterThan(0);
    expect(
      pixelDifferences(pixelsOf(openOn(storage, regions), regions), drawn, regions.width),
    ).toEqual([]);
  });
});

describe('#103 AC6 (podklad k ruční kontrole): jiskra je dost velká, aby byla vidět', () => {
  it('na ploše s kratší stranou 240 px by měla každá jiskra rozpětí aspoň 5 px', () => {
    // Plocha je 4 : 3 (#96 AC1), s kratší stranou 240 px je široká 320 px.
    // Rozpětí v pixelech obrázku se proto porovná s 5/320 jeho šířky.
    for (const [width, height] of [
      [BIG_WIDTH, BIG_HEIGHT],
      [1024, 768],
    ] as const) {
      const smallest = smallestSparkleSpan(width);
      const tooSmall = sparklesOf(glitterPixels(width, height))
        .filter((sparkle) => !sparkle.atEdge && spanOf(sparkle) < smallest)
        .map(
          (sparkle) =>
            `jiskra (${sparkle.center.x.toFixed(1)}, ${sparkle.center.y.toFixed(1)}): ${spanOf(sparkle)} px`,
        );
      expect(
        tooSmall.slice(0, 5),
        `obrázek ${width} × ${height}, nejméně ${smallest.toFixed(1)} px`,
      ).toEqual([]);
    }
  });
});
