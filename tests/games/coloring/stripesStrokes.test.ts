import { describe, expect, it } from 'vitest';

import { NO_COLOR, createColoring } from '../../../src/games/coloring/logic/coloring';
import type { RegionMap } from '../../../src/games/coloring/logic/regionMap';
import { OUTLINE_REGION, regionAt } from '../../../src/games/coloring/logic/regionMap';
import type { SavedColoring } from '../../../src/games/coloring/logic/savedPicture';
import type { LineSize } from '../../../src/games/coloring/logic/toolPanel';
import { shareWith, strokeCore } from './dotsHelpers';
import {
  BIG_HEIGHT,
  BIG_LINE_X,
  BIG_WIDTH,
  bigHalves,
  bigRegions,
  changedInRegion,
  choose,
  drawWith,
} from './drawingToolHelpers';
import { pixelDifferences } from './extendedPaletteHelpers';
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
import {
  STRIPES,
  stripeGeometryProblems,
  stripePixels,
  stripeStrokeProblems,
  stripeWidth,
  stripesAsPixels,
} from './stripesHelpers';
import type { StripePixels } from './stripesHelpers';
import { at } from './strokeHelpers';

/**
 * Testy k #102 AC2 (stopa proužkového fixu), AC3 (opakování, ořez,
 * souvislost a stejný výsledek), AC4 (okrajové případy) a AC5 (velikost
 * a Zpět). Výběr nástroje (AC1) je ve `stripesSelection.test.ts`
 * a `stripesLayoutRules.test.ts`, uložení a limit ve `stripesRecord.test.ts`.
 *
 * Měří se na obrázku 900 × 600 (W stř = 30 px): stopa je kulatá a široká
 * 1,0 W, proužky jsou šikmé 45° a proužek i mezera mají kolmo 1/3 W stř
 * = 10 px (doporučení z otevřených otázek 1 a 2). Kde přesně proužky
 * leží a kterým směrem jsou šikmé, testy zjistí chováním (`stripePixels`
 * ve `stripesHelpers.ts`): celý prázdný obrázek se přejede proužkovým
 * fixem. Že jsou šikmé 45° a správně široké, hlídá první test. Ostatní
 * testy porovnávají tahy s těmito proužky.
 *
 * Navržené rozhraní:
 * - `ToolId` a `PANEL_TOOLS` v `src/games/coloring/logic/toolPanel.ts`
 *   dostanou `'stripes'` (proužkový fix),
 * - `SavedColoring.pointerDown` maluje proužky, když je vybraný (`tapTool`),
 * - `Coloring.pointerDown(pointer, colorIndex, 'stripes', width)` maluje
 *   kulatou stopou šířky `width` (1,0 W), ale barvou `colorIndex` zapíše
 *   jen pixely šikmých proužků; proužky (šířka podle W stř, tedy šířky
 *   plochy) jsou pevné vůči obrázku a nezávisí na tahu, jeho směru ani
 *   velikosti (u puntíků vzor stopy `pattern: 'dots'`, tady třeba
 *   `pattern: 'stripes'`).
 */

const ORANGE = 1;
const BLUE = 4;
const BLACK = 7;
const PINK = 8;
const LIGHT_BLUE = 11;

/** Polovina šířky stopy velikosti `size` (stopa je široká 1,0 W). */
function radiusOf(size: LineSize = 'medium'): number {
  return widthOf(size) / 2;
}

/** Proužky obrázku 900 × 600. */
function bigStripes(): StripePixels {
  return stripePixels(BIG_WIDTH, BIG_HEIGHT);
}

function freshOn(regions: RegionMap): { game: SavedColoring; storage: RecordingStorage } {
  const storage = new RecordingStorage();
  return { game: openOn(storage, regions), storage };
}

/** Tah proužkovým fixem barvou `color`: výběr barvy, výběr nástroje, tah. */
function stripes(game: SavedColoring, path: readonly Point[], color = BLUE): void {
  drawWith(game, STRIPES, color, path);
}

/** Tah po bodech s nepravidelnými rozestupy na stejné přímce jako `from`–`to`. */
function unevenLine(from: Point, to: Point): Point[] {
  const shares = [0, 0.004, 0.13, 0.131, 0.2, 0.45, 0.46, 0.7, 0.71, 0.93, 1];
  return shares.map((share) =>
    at(from.x + (to.x - from.x) * share, from.y + (to.y - from.y) * share),
  );
}

/** Co nesedí na tahu `path` proužkovým fixem na obrázku `regions`. */
function problemsOf(
  game: SavedColoring,
  regions: RegionMap,
  before: ReadonlyArray<number | null>,
  path: readonly Point[],
  options: { color?: number; size?: LineSize; region?: number | null } = {},
): string[] {
  return stripeStrokeProblems({
    game,
    regions,
    before,
    stripes: bigStripes(),
    path,
    radius: radiusOf(options.size),
    color: options.color ?? BLUE,
    region: options.region ?? null,
  });
}

/** Pixely proužků ve stopě, které nemají barvu `color`, a zabarvené mezery. */
function offStripes(
  game: SavedColoring,
  pixels: ReadonlyArray<[number, number]>,
  color: number,
): { missing: number; inGaps: number } {
  const grid = bigStripes();
  return {
    missing: pixels.filter(([x, y]) => grid.isStripe(x, y) && game.colorAt(x, y) !== color).length,
    inGaps: pixels.filter(([x, y]) => !grid.isStripe(x, y) && game.colorAt(x, y) !== null).length,
  };
}

/** Vodorovný tah přes prázdný obrázek, daleko od okrajů. */
const HORIZONTAL: readonly Point[] = [at(60, 300), at(390, 300)];

/**
 * Tahy různých tvarů a směrů: svislý, oba šikmé (jeden po proužcích,
 * druhý napříč), lomený a oblouk. Proužky nesmí záviset na směru tahu
 * (mimo rozsah #102).
 */
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

describe('#102 AC2: proužky jsou šikmé 45° a proužek je stejně široký jako mezera', () => {
  it('proužky jsou šikmé 45° a proužek i mezera mají kolmo 1/3 W stř', () => {
    expect(stripeGeometryProblems(bigStripes())).toEqual([]);
  });

  it('proužky pokrývají zhruba polovinu obrázku', () => {
    const share = bigStripes().count / (BIG_WIDTH * BIG_HEIGHT);

    expect(share, 'podíl pixelů proužků').toBeGreaterThanOrEqual(0.45);
    expect(share, 'podíl pixelů proužků').toBeLessThanOrEqual(0.55);
  });
});

describe('#102 AC2: stopa je kulatá, široká 1,0 W a barví jen proužky', () => {
  it('ve vodorovném tahu přes prázdnou oblast je zabarveno 40–60 % pixelů stopy', () => {
    for (const size of SIZES) {
      for (const y of [300, 303.2, 307.5, 311.9]) {
        const regions = bigBlank();
        const { game } = freshOn(regions);
        const path = [at(60, y), at(420, y)];
        chooseSize(game, size);

        stripes(game, path);

        const share = shareWith(game, strokeCore(regions, path, radiusOf(size)), BLUE);
        const what = `${SIZE_NAMES[size]}, řádek ${y}: zabarvený díl stopy`;
        expect(share, what).toBeGreaterThanOrEqual(0.4);
        expect(share, what).toBeLessThanOrEqual(0.6);
      }
    }
  });

  it('tah v každém směru zabarví vybranou barvou proužky ve stopě široké 1,0 W a nic v mezerách ani mimo stopu', () => {
    for (const { name, path } of SHAPES) {
      const regions = bigBlank();
      const { game } = freshOn(regions);
      const before = pixelsOf(game, regions);

      stripes(game, path);

      expect(problemsOf(game, regions, before, path), name).toEqual([]);
    }
  });

  it('stopa je kulatá: ťuknutí nezabarví proužky v rozích čtverce kolem kruhu', () => {
    const regions = bigBlank();
    const { game } = freshOn(regions);
    const tap = at(300.5, 300.5);
    const radius = radiusOf();

    stripes(game, [tap]);

    const corners = strokeCore(regions, [tap], radius * Math.SQRT2).filter(([x, y]) => {
      const distance = distanceToPath(centerOf(x, y), [tap]);
      return distance > radius + 1 && bigStripes().isStripe(x, y);
    });
    expect(corners.length, 'v rozích jsou proužky').toBeGreaterThan(0);
    expect(shareWith(game, corners, BLUE), 'rohy zůstaly prázdné').toBe(0);
  });

  it('proužky mají jen vybranou barvu, i v nových barvách palety', () => {
    for (const color of [ORANGE, BLUE, BLACK, PINK, LIGHT_BLUE]) {
      const regions = bigBlank();
      const { game } = freshOn(regions);

      stripes(game, HORIZONTAL, color);

      const used = new Set(pixelsOf(game, regions).filter((each) => each !== null));
      expect([...used], `barva ${color}`).toEqual([color]);
    }
  });

  it('v mezerách mezi proužky zůstane barva, která tam byla předtím', () => {
    const regions = bigHalves();
    const { regionA } = bigRegions(regions);
    const { game } = freshOn(regions);
    fillAWithBrush(game, BLACK);
    const before = pixelsOf(game, regions);
    chooseSize(game, 'medium');

    stripes(game, HORIZONTAL, BLUE);

    expect(problemsOf(game, regions, before, HORIZONTAL, { region: regionA })).toEqual([]);
    const core = strokeCore(regions, HORIZONTAL, radiusOf());
    expect(shareWith(game, core, BLACK), 'v mezerách je vidět černá').toBeGreaterThan(0.4);
    expect(shareWith(game, core, BLUE), 'proužky jsou modré').toBeGreaterThan(0.4);
  });

  it('v mezerách na prázdném místě zůstane prázdno', () => {
    const regions = bigBlank();
    const { game } = freshOn(regions);

    stripes(game, HORIZONTAL);

    const core = strokeCore(regions, HORIZONTAL, radiusOf());
    const gaps = core.filter(([x, y]) => !bigStripes().isStripe(x, y));
    expect(gaps.length, 've stopě jsou mezery').toBeGreaterThan(0);
    expect(gaps.filter(([x, y]) => game.colorAt(x, y) !== null).length).toBe(0);
  });

  it('proužky jsou pevné vůči obrázku: v oblastech obrázku s obrysem leží na stejných místech', () => {
    const regions = bigHalves();
    const { game } = freshOn(regions);
    const large = widthOf('large');
    chooseSize(game, 'large');
    for (let y = 0; y < BIG_HEIGHT + large / 2; y += large / 2) {
      const row = Math.min(y, BIG_HEIGHT - 0.5);
      stripes(game, [at(0.5, row), at(BIG_LINE_X - 1, row)]);
      stripes(game, [at(BIG_LINE_X + 2.5, row), at(BIG_WIDTH - 0.5, row)]);
    }

    const expected = pixelsOf(
      {
        colorAt: (x, y) => {
          const region = regionAt(regions, x, y);
          return region !== OUTLINE_REGION && bigStripes().isStripe(x, y) ? BLUE : null;
        },
      },
      regions,
    );
    expect(pixelDifferences(pixelsOf(game, regions), expected, regions.width)).toEqual([]);
  });
});

describe('#102 AC3: opakovaný tah mezery nezaplní a proužky na sebe navazují', () => {
  it('opakovaný tah přes stejné místo mezery nezaplní', () => {
    const regions = bigBlank();
    const { game } = freshOn(regions);
    const before = pixelsOf(game, regions);

    for (let repeat = 0; repeat < 5; repeat += 1) {
      stripes(game, HORIZONTAL);
    }

    expect(problemsOf(game, regions, before, HORIZONTAL)).toEqual([]);
  });

  it('i trochu posunuté tahy tam a zpátky barví jen proužky, mezery zůstanou prázdné', () => {
    const regions = bigBlank();
    const { game } = freshOn(regions);
    [0, 2.3, 4.6, 7.1, 9.4, 13.8].forEach((shift, index) => {
      const there = [at(60 + shift, 300 + shift), at(390 + shift, 300 - shift)];
      stripes(game, index % 2 === 0 ? there : [...there].reverse());
    });

    const painted: string[] = [];
    for (let y = 0; y < regions.height; y += 1) {
      for (let x = 0; x < regions.width; x += 1) {
        if (game.colorAt(x, y) !== null && !bigStripes().isStripe(x, y)) {
          painted.push(`mezera (${x}, ${y}) je zabarvená`);
        }
      }
    }
    expect(painted.slice(0, 5)).toEqual([]);
    expect(paintedPixels(game, regions), 'tahy něco namalovaly').toBeGreaterThan(0);
  });

  it('dva tahy za sebou navazují jako jeden dlouhý tah: proužky na styku nejsou posunuté', () => {
    const regions = bigBlank();
    const { game } = freshOn(regions);
    const before = pixelsOf(game, regions);
    const [from, to] = [at(60.3, 280.7), at(420.6, 323.3)];
    const split = at(from.x + (to.x - from.x) * 0.47, from.y + (to.y - from.y) * 0.47);

    stripes(game, [from, split]);
    stripes(game, [split, to]);

    expect(problemsOf(game, regions, before, [from, to])).toEqual([]);
  });

  it('vedlejší tahy různými směry se překrývají bez posunutých proužků: každý pixel je proužek, nebo prázdno', () => {
    const regions = bigBlank();
    const { game } = freshOn(regions);
    const paths = [
      [at(60, 300), at(400, 300)],
      [at(400, 312.4), at(60, 312.4)],
      [at(230.6, 150.2), at(230.6, 450.8)],
    ];

    for (const path of paths) {
      stripes(game, path);
    }

    const core = paths.flatMap((path) => strokeCore(regions, path, radiusOf()));
    const { missing, inGaps } = offStripes(game, core, BLUE);
    expect(missing, 'proužky všech stop jsou celé').toBe(0);
    expect(inGaps, 'v mezerách nic').toBe(0);
  });

  it('proužek pokračuje přes několik tahů: dlouhý šikmý proužek je celý jedné barvy bez přerušení', () => {
    const regions = bigBlank();
    const { game } = freshOn(regions);
    // Několik krátkých vodorovných tahů pod sebou překryje pás, kterým proužky jdou šikmo.
    for (let y = 150; y <= 450; y += 12) {
      stripes(game, [at(300, y), at(600, y)]);
    }

    const band = [];
    for (let y = 160; y < 440; y += 1) {
      for (let x = 320; x < 580; x += 1) {
        band.push([x, y] as [number, number]);
      }
    }
    const { missing, inGaps } = offStripes(game, band, BLUE);
    expect(missing, 'žádný proužek v pásu není přerušený').toBe(0);
    expect(inGaps, 'v mezerách nic').toBe(0);
  });
});

describe('#102 AC3: ořez a souvislost platí jako u štětce', () => {
  it('tah začatý v oblasti A a tažený přes obrys do B barví dál jen proužky v A, i po návratu do A', () => {
    const regions = bigHalves();
    const { regionA, regionB } = bigRegions(regions);
    const { game } = freshOn(regions);
    const before = pixelsOf(game, regions);
    const path = [at(300, 300), at(650, 300), at(650, 200), at(150, 200)];

    stripes(game, path);

    expect(changedInRegion(game, regions, before, regionB), 'oblast B').toEqual([]);
    expect(problemsOf(game, regions, before, path, { region: regionA }), 'oblast A').toEqual([]);
  });

  it('proužky dosáhnou až k obrysu, za ním nic', () => {
    const regions = bigHalves();
    const { regionA } = bigRegions(regions);
    const { game } = freshOn(regions);
    const before = pixelsOf(game, regions);
    const path = [at(BIG_LINE_X - 6, 60), at(BIG_LINE_X - 6, 540)];

    stripes(game, path);

    expect(problemsOf(game, regions, before, path, { region: regionA })).toEqual([]);
    const nearLine = strokeCore(regions, path, radiusOf()).filter(
      ([x, y]) => x < BIG_LINE_X && x >= BIG_LINE_X - 3 && bigStripes().isStripe(x, y),
    );
    expect(nearLine.length, 'u obrysu jsou proužky').toBeGreaterThan(0);
    expect(shareWith(game, nearLine, BLUE), 'proužky těsně u obrysu jsou zabarvené').toBe(1);
  });

  it('tah začatý na obrysu barví jen oblast, do které prst vjede', () => {
    const regions = bigHalves();
    const { regionA, regionB } = bigRegions(regions);
    const { game } = freshOn(regions);
    const before = pixelsOf(game, regions);
    const path = [at(BIG_LINE_X + 0.5, 300), at(700, 300), at(500, 100)];

    stripes(game, path);

    expect(changedInRegion(game, regions, before, regionA), 'oblast A').toEqual([]);
    const inB = strokeCore(regions, [at(520, 300), at(680, 300)], radiusOf()).filter(
      ([x, y]) => regionAt(regions, x, y) === regionB && bigStripes().isStripe(x, y),
    );
    expect(shareWith(game, inB, BLUE), 'proužky v B').toBe(1);
  });

  it('tah začatý mimo obrázek nic nenamaluje, ani když prst na obrázek vjede', () => {
    const regions = bigBlank();
    const { game } = freshOn(regions);

    stripes(game, [at(-30, 300), at(300, 300), at(700, 300)]);

    expect(paintedPixels(game, regions)).toBe(0);
  });

  it('rychlý tah se dvěma body daleko od sebe je souvislý: žádný kousek proužku po cestě nechybí', () => {
    const regions = bigBlank();
    const { game } = freshOn(regions);
    const before = pixelsOf(game, regions);
    const path = [at(20.2, 30.7), at(880.4, 570.9)];

    stripes(game, path);

    expect(problemsOf(game, regions, before, path)).toEqual([]);
  });
});

describe('#102 AC3: stejný tah dá vždy stejné pixely', () => {
  it('pomalý tah s mnoha body, rychlý tah se dvěma body i tah s nepravidelnými body barví stejnou stopu', () => {
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

      stripes(game, path);

      expect(problemsOf(game, regions, before, [from, to]), name).toEqual([]);
    }
  });

  it('stejné tahy ve dvou hrách nakreslí stejné pixely, i když jinde předtím malovaly jinak', () => {
    const regions = bigBlank();
    const first = freshOn(regions).game;
    const second = freshOn(regions).game;
    // Druhá hra nejdřív maluje jinde a pak to vrátí, proužky se tím nesmí posunout.
    stripes(second, [at(700.3, 100.6), at(850.1, 140.2)]);
    second.tapUndo();

    for (const { path } of SHAPES) {
      stripes(first, path);
      stripes(second, path);
    }

    expect(
      pixelDifferences(pixelsOf(second, regions), pixelsOf(first, regions), regions.width),
    ).toEqual([]);
  });
});

describe('#102 AC4: okrajové případy', () => {
  it('ťuknutí zabarví pixely proužků v kruhu průměru W a nic mimo něj', () => {
    const radius = radiusOf();
    for (const tap of [at(300.5, 300.5), at(207.3, 141.8), at(612.9, 433.4)]) {
      const regions = bigBlank();
      const { game } = freshOn(regions);
      const before = pixelsOf(game, regions);

      stripes(game, [tap]);

      const where = `ťuknutí (${tap.x}, ${tap.y})`;
      expect(problemsOf(game, regions, before, [tap]), where).toEqual([]);
      const inCircle = strokeCore(regions, [tap], radius);
      expect(
        inCircle.filter(([x, y]) => bigStripes().isStripe(x, y)).length,
        `${where}: kruhem jdou proužky`,
      ).toBeGreaterThan(0);
      expect(
        inCircle.filter(([x, y]) => !bigStripes().isStripe(x, y)).length,
        `${where}: kruhem jdou mezery`,
      ).toBeGreaterThan(0);
    }
  });

  it('ťuknutí, při kterém se prst zachvěje na místě, je pořád kruh proužků průměru W', () => {
    const regions = bigBlank();
    const { game } = freshOn(regions);
    const before = pixelsOf(game, regions);
    const tap = at(300.5, 300.5);

    stripes(game, [tap, at(300.7, 300.5), tap, at(300.5, 300.6), tap]);

    expect(problemsOf(game, regions, before, [tap])).toEqual([]);
  });

  it('opakovaný stejný tah nic nezmění a do Zpět se nepočítá', () => {
    const regions = bigBlank();
    const { game } = freshOn(regions);
    stripes(game, HORIZONTAL);
    const drawn = pixelsOf(game, regions);
    stripes(game, HORIZONTAL);
    stripes(game, [...HORIZONTAL].reverse());

    expect(
      pixelDifferences(pixelsOf(game, regions), drawn, regions.width),
      'nic se nezměnilo',
    ).toEqual([]);
    expect(game.tapUndo().kind, 'první Zpět').toBe('undone');
    expect(paintedPixels(game, regions), 'jedno Zpět vrátí první tah').toBe(0);
    expect(game.tapUndo().kind, 'víc není co vracet').toBe('wobble');
  });

  it('tah přes místo, které už má stejné proužky, nic nezmění a do Zpět se nepočítá', () => {
    const regions = bigBlank();
    const { game } = freshOn(regions);
    chooseSize(game, 'large');
    stripes(game, HORIZONTAL);
    const drawn = pixelsOf(game, regions);

    // Užší a kratší tahy uvnitř velké stopy, jiné body, směr i velikost.
    chooseSize(game, 'small');
    stripes(game, [at(100.3, 297.1), at(250.8, 305.4)]);
    chooseSize(game, 'medium');
    stripes(game, [at(320.6, 306.2), at(140.1, 293.9), at(200.2, 300.4)]);
    stripes(game, [at(180.5, 300.5)]);

    expect(
      pixelDifferences(pixelsOf(game, regions), drawn, regions.width),
      'nic se nezměnilo',
    ).toEqual([]);
    expect(game.tapUndo().kind).toBe('undone');
    expect(paintedPixels(game, regions), 'Zpět vrátil velký tah').toBe(0);
    expect(game.tapUndo().kind).toBe('wobble');
  });

  it('proužky stejnou barvou přes stejně vybarvené místo nic nezmění a do Zpět se nepočítají', () => {
    const regions = bigHalves();
    const { game } = freshOn(regions);
    fillAWithBrush(game, BLUE);
    const filled = pixelsOf(game, regions);

    stripes(game, HORIZONTAL, BLUE);
    expect(
      pixelDifferences(pixelsOf(game, regions), filled, regions.width),
      'nic se nezměnilo',
    ).toEqual([]);

    game.tapUndo();
    expect(paintedPixels(game, regions), 'Zpět vrátil vybarvení, ne proužky').toBeLessThan(
      filled.filter((color) => color !== null).length,
    );
  });

  it('tah začatý mimo plochu se do Zpět nepočítá', () => {
    const regions = bigBlank();
    const { game } = freshOn(regions);
    drawWith(game, 'brush', BLACK, [at(100, 100), at(300, 100)]);

    stripes(game, [at(-30, 300), at(300, 300)]);

    expect(game.tapUndo().kind, 'Zpět vrátí tah štětcem').toBe('undone');
    expect(game.colorAt(200, 100), 'černá čára je pryč').toBeNull();
    expect(game.tapUndo().kind).toBe('wobble');
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
      coloring.pointerDown({ id, x: first.x, y: first.y, kind: 'touch' }, BLUE, STRIPES);
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

describe('#102 AC5: velikost mění šířku stopy, proužky zůstávají stejné', () => {
  it('v každé velikosti je stopa kulatá a široká 1,0 W své velikosti a barví stejné proužky', () => {
    for (const size of SIZES) {
      for (const { name, path } of SHAPES) {
        const regions = bigBlank();
        const { game } = freshOn(regions);
        const before = pixelsOf(game, regions);
        chooseSize(game, size);

        stripes(game, path);

        expect(
          problemsOf(game, regions, before, path, { size }),
          `${SIZE_NAMES[size]}, ${name}`,
        ).toEqual([]);
      }
    }
  });

  it('velikost nemění proužky: celý obrázek přejetý malou, střední i velkou stopou má stejné proužky', () => {
    const large = stripesAsPixels(stripePixels(BIG_WIDTH, BIG_HEIGHT, 'large'));
    for (const size of ['small', 'medium'] as const) {
      expect(
        pixelDifferences(
          stripesAsPixels(stripePixels(BIG_WIDTH, BIG_HEIGHT, size)),
          large,
          BIG_WIDTH,
        ),
        SIZE_NAMES[size],
      ).toEqual([]);
    }
  });

  it('proužky jsou v malé velikosti stejně široké jako ve velké, i měřeno kolmo', () => {
    for (const size of SIZES) {
      expect(
        stripeGeometryProblems(stripePixels(BIG_WIDTH, BIG_HEIGHT, size)),
        `${SIZE_NAMES[size]}: proužky ${stripeWidth(BIG_WIDTH).toFixed(1)} px`,
      ).toEqual([]);
    }
  });

  it('širší stopa zabarví víc proužků', () => {
    const counts: number[] = [];
    for (const size of SIZES) {
      const regions = bigBlank();
      const { game } = freshOn(regions);
      chooseSize(game, size);

      stripes(game, HORIZONTAL);

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
    choose(game, STRIPES);
    game.tapColor(BLUE);
    startStroke(game, path.slice(0, 2));

    // Ťuknutí na přepínač během tahu se nepočítá.
    game.tapSizeToggle();
    game.pointerMove({ id: 1, x: 420.5, y: 300.5, kind: 'touch' });
    game.pointerUp(1);

    expect(game.lineSize()).toBe('large');
    expect(problemsOf(game, regions, before, path, { size: 'large' })).toEqual([]);
  });
});

describe('#102 AC5: Zpět vrátí tah proužkovým fixem pixel po pixelu', () => {
  it('Zpět vrátí tah s proužky přes několik barev do stavu před ním', () => {
    const regions = bigHalves();
    const { game } = freshOn(regions);
    fillAWithBrush(game, ORANGE);
    drawWith(game, 'brush', BLACK, [at(200, 20), at(200, 580)]);
    drawWith(game, 'dots', PINK, [at(60, 100), at(400, 100)]);
    const before = pixelsOf(game, regions);

    stripes(game, [at(30.5, 30.5), at(420.5, 570.5), at(420.5, 30.5), at(30.5, 570.5)], BLUE);
    expect(
      pixelDifferences(pixelsOf(game, regions), before, regions.width).length,
      'proužky něco namalovaly',
    ).toBeGreaterThan(0);

    expect(game.tapUndo().kind).toBe('undone');
    expect(pixelDifferences(pixelsOf(game, regions), before, regions.width)).toEqual([]);
  });

  it('Zpět vrátí proužky ořezané u obrysu a vedlejší oblast nechá, jak byla', () => {
    const regions = bigHalves();
    const { game } = freshOn(regions);
    drawWith(game, 'brush', ORANGE, [at(BIG_LINE_X + 20, 100), at(BIG_LINE_X + 20, 500)]);
    const before = pixelsOf(game, regions);

    stripes(game, [at(BIG_LINE_X - 6, 60.5), at(BIG_LINE_X - 6, 540.5)], BLUE);
    game.tapUndo();

    expect(pixelDifferences(pixelsOf(game, regions), before, regions.width)).toEqual([]);
  });

  it('tahy proužkovým fixem a jinými nástroji vrátí Zpět postupně, každý do stavu před ním', () => {
    const regions = bigBlank();
    const { game } = freshOn(regions);
    const states = [pixelsOf(game, regions)];
    stripes(game, HORIZONTAL, BLUE);
    states.push(pixelsOf(game, regions));
    drawWith(game, 'crayon', PINK, [at(60, 305), at(390, 295)]);
    states.push(pixelsOf(game, regions));
    drawWith(game, 'dots', BLACK, [at(70, 300), at(380, 300)]);
    states.push(pixelsOf(game, regions));
    stripes(game, [at(80, 290), at(380, 310)], LIGHT_BLUE);

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
    stripes(game, HORIZONTAL);
    game.tapUndo();
    game.suspend();

    expect(
      pixelDifferences(pixelsOf(openOn(storage, regions), regions), before, regions.width),
    ).toEqual([]);
  });

  it('rozpracovaný tah se při schování stránky uloží tak, kam prst došel', () => {
    const regions = bigBlank();
    const { game, storage } = freshOn(regions);
    choose(game, STRIPES);
    game.tapColor(BLUE);
    startStroke(game, HORIZONTAL);
    const drawn = pixelsOf(game, regions);
    game.suspend();

    expect(paintedPixels(game, regions), 'proužky jsou namalované').toBeGreaterThan(0);
    expect(
      pixelDifferences(pixelsOf(openOn(storage, regions), regions), drawn, regions.width),
    ).toEqual([]);
  });
});
