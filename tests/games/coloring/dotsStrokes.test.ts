import { describe, expect, it } from 'vitest';

import { NO_COLOR, createColoring } from '../../../src/games/coloring/logic/coloring';
import type { RegionMap } from '../../../src/games/coloring/logic/regionMap';
import { OUTLINE_REGION, regionAt } from '../../../src/games/coloring/logic/regionMap';
import type { SavedColoring } from '../../../src/games/coloring/logic/savedPicture';
import type { LineSize } from '../../../src/games/coloring/logic/toolPanel';
import {
  DOTS,
  cutSpots,
  dotGridProblems,
  dotPixels,
  dotSpacing,
  dotStrokeProblems,
  shareWith,
  strokeCore,
} from './dotsHelpers';
import type { DotPixels } from './dotsHelpers';
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
import { at } from './strokeHelpers';

/**
 * Testy k #101 AC2 (stopa puntíkového fixu), AC3 (opakování, ořez,
 * souvislost a stejný výsledek), AC4 (okrajové případy) a AC5 (velikost
 * a Zpět). Výběr nástroje (AC1) je v `dotsSelection.test.ts`
 * a `dotsLayoutRules.test.ts`, uložení a limit v `dotsRecord.test.ts`.
 *
 * Měří se na obrázku 900 × 600 (W stř = 30 px): stopa je kulatá a široká
 * 1,0 W, puntík má průměr 1/3 W stř = 10 px a středy jsou po 1/2 W stř
 * = 15 px (doporučení z otevřené otázky 1). Kde přesně mřížka leží, testy
 * zjistí chováním (`dotPixels` v `dotsHelpers.ts`): celý prázdný obrázek
 * se přejede puntíkovým fixem. Že je to pravidelná mřížka kulatých puntíků,
 * hlídá první test. Ostatní testy porovnávají tahy s touto mřížkou.
 *
 * Navržené rozhraní:
 * - `ToolId` a `PANEL_TOOLS` v `src/games/coloring/logic/toolPanel.ts`
 *   dostanou `'dots'` (puntíkový fix),
 * - `SavedColoring.pointerDown` maluje puntíky, když je vybraný (`tapTool`),
 * - `Coloring.pointerDown(pointer, colorIndex, 'dots', width)` maluje
 *   kulatou stopou šířky `width` (1,0 W), ale barvou `colorIndex` zapíše
 *   jen pixely mřížky puntíků; mřížka (průměr a rozestup podle W stř, tedy
 *   šířky plochy) je pevná vůči obrázku a nezávisí na tahu ani velikosti.
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

/** Mřížka puntíků obrázku 900 × 600. */
function bigDots(): DotPixels {
  return dotPixels(BIG_WIDTH, BIG_HEIGHT);
}

function freshOn(regions: RegionMap): { game: SavedColoring; storage: RecordingStorage } {
  const storage = new RecordingStorage();
  return { game: openOn(storage, regions), storage };
}

/** Tah puntíkovým fixem barvou `color`: výběr barvy, výběr nástroje, tah. */
function dots(game: SavedColoring, path: readonly Point[], color = BLUE): void {
  drawWith(game, DOTS, color, path);
}

/** Tah po bodech s nepravidelnými rozestupy na stejné přímce jako `from`–`to`. */
function unevenLine(from: Point, to: Point): Point[] {
  const shares = [0, 0.004, 0.13, 0.131, 0.2, 0.45, 0.46, 0.7, 0.71, 0.93, 1];
  return shares.map((share) =>
    at(from.x + (to.x - from.x) * share, from.y + (to.y - from.y) * share),
  );
}

/** Co nesedí na tahu `path` puntíkovým fixem na obrázku `regions`. */
function problemsOf(
  game: SavedColoring,
  regions: RegionMap,
  before: ReadonlyArray<number | null>,
  path: readonly Point[],
  options: { color?: number; size?: LineSize; region?: number | null } = {},
): string[] {
  return dotStrokeProblems({
    game,
    regions,
    before,
    dots: bigDots(),
    path,
    radius: radiusOf(options.size),
    color: options.color ?? BLUE,
    region: options.region ?? null,
  });
}

/** Vodorovný tah přes prázdný obrázek, daleko od okrajů. */
const HORIZONTAL: readonly Point[] = [at(60, 300), at(390, 300)];

/** Tahy různých tvarů: šikmý, lomený a oblouk z krátkých úseků. */
const SHAPES: ReadonlyArray<{ name: string; path: readonly Point[] }> = [
  { name: 'vodorovný', path: HORIZONTAL },
  { name: 'šikmý', path: [at(80.3, 70.8), at(610.6, 520.1)] },
  { name: 'lomený', path: [at(100, 500), at(220, 380), at(330, 470), at(470, 360)] },
  {
    name: 'oblouk',
    path: Array.from({ length: 25 }, (_, step) =>
      at(600 + 150 * Math.cos(step / 8), 300 + 150 * Math.sin(step / 8)),
    ),
  },
];

describe('#101 AC2: puntíky tvoří pravidelnou mřížku kulatých puntíků', () => {
  it('puntíky jsou kulaté, mají průměr 1/3 W stř a středy po 1/2 W stř', () => {
    expect(dotGridProblems(bigDots())).toEqual([]);
  });

  it('puntíky pokrývají zhruba třetinu obrázku, ne celou plochu', () => {
    const share = bigDots().count / (BIG_WIDTH * BIG_HEIGHT);

    expect(share, 'podíl pixelů puntíků').toBeGreaterThanOrEqual(0.25);
    expect(share, 'podíl pixelů puntíků').toBeLessThanOrEqual(0.45);
  });
});

describe('#101 AC2: stopa je kulatá, široká 1,0 W a barví jen puntíky', () => {
  it('ve vodorovném tahu přes prázdnou oblast je zabarveno 25–45 % pixelů stopy', () => {
    for (const size of SIZES) {
      for (const y of [300, 303.2, 307.5, 311.9]) {
        const regions = bigBlank();
        const { game } = freshOn(regions);
        const path = [at(60, y), at(420, y)];
        chooseSize(game, size);

        dots(game, path);

        const share = shareWith(game, strokeCore(regions, path, radiusOf(size)), BLUE);
        const what = `${SIZE_NAMES[size]}, řádek ${y}: zabarvený díl stopy`;
        expect(share, what).toBeGreaterThanOrEqual(0.25);
        expect(share, what).toBeLessThanOrEqual(0.45);
      }
    }
  });

  it('tah zabarví vybranou barvou každý puntík ve stopě široké 1,0 W a nic mimo puntíky ani mimo stopu', () => {
    for (const { name, path } of SHAPES) {
      const regions = bigBlank();
      const { game } = freshOn(regions);
      const before = pixelsOf(game, regions);

      dots(game, path);

      expect(problemsOf(game, regions, before, path), name).toEqual([]);
    }
  });

  it('stopa je kulatá: ťuknutí nezabarví puntíky v rozích čtverce kolem kruhu', () => {
    const regions = bigBlank();
    const { game } = freshOn(regions);
    const tap = at(300.5, 300.5);
    const radius = radiusOf();

    dots(game, [tap]);

    const corners = strokeCore(regions, [tap], radius * Math.SQRT2).filter(([x, y]) => {
      const distance = distanceToPath(centerOf(x, y), [tap]);
      return distance > radius + 1 && bigDots().isDot(x, y);
    });
    expect(corners.length, 'v rozích jsou puntíky mřížky').toBeGreaterThan(0);
    expect(shareWith(game, corners, BLUE), 'rohy zůstaly prázdné').toBe(0);
  });

  it('puntíky mají jen vybranou barvu, i v nových barvách palety', () => {
    for (const color of [ORANGE, BLUE, BLACK, PINK, LIGHT_BLUE]) {
      const regions = bigBlank();
      const { game } = freshOn(regions);

      dots(game, HORIZONTAL, color);

      const used = new Set(pixelsOf(game, regions).filter((each) => each !== null));
      expect([...used], `barva ${color}`).toEqual([color]);
    }
  });

  it('v mezerách mezi puntíky zůstane barva, která tam byla předtím', () => {
    const regions = bigHalves();
    const { regionA } = bigRegions(regions);
    const { game } = freshOn(regions);
    fillAWithBrush(game, BLACK);
    const before = pixelsOf(game, regions);
    chooseSize(game, 'medium');

    dots(game, HORIZONTAL, BLUE);

    expect(problemsOf(game, regions, before, HORIZONTAL, { region: regionA })).toEqual([]);
    const core = strokeCore(regions, HORIZONTAL, radiusOf());
    expect(shareWith(game, core, BLACK), 'v mezerách je vidět černá').toBeGreaterThan(0.5);
    expect(shareWith(game, core, BLUE), 'puntíky jsou modré').toBeGreaterThan(0.25);
  });

  it('v mezerách na prázdném místě zůstane prázdno', () => {
    const regions = bigBlank();
    const { game } = freshOn(regions);

    dots(game, HORIZONTAL);

    const core = strokeCore(regions, HORIZONTAL, radiusOf());
    const gaps = core.filter(([x, y]) => !bigDots().isDot(x, y));
    expect(gaps.length, 've stopě jsou mezery').toBeGreaterThan(0);
    expect(gaps.filter(([x, y]) => game.colorAt(x, y) !== null).length).toBe(0);
  });

  it('mřížka je pevná vůči obrázku: v oblastech obrázku s obrysem leží puntíky na stejných místech', () => {
    const regions = bigHalves();
    const { game } = freshOn(regions);
    const large = widthOf('large');
    chooseSize(game, 'large');
    for (let y = 0; y < BIG_HEIGHT + large / 2; y += large / 2) {
      const row = Math.min(y, BIG_HEIGHT - 0.5);
      dots(game, [at(0.5, row), at(BIG_LINE_X - 1, row)]);
      dots(game, [at(BIG_LINE_X + 2.5, row), at(BIG_WIDTH - 0.5, row)]);
    }

    const expected = pixelsOf(
      {
        colorAt: (x, y) => {
          const region = regionAt(regions, x, y);
          return region !== OUTLINE_REGION && bigDots().isDot(x, y) ? BLUE : null;
        },
      },
      regions,
    );
    expect(pixelDifferences(pixelsOf(game, regions), expected, regions.width)).toEqual([]);
  });
});

describe('#101 AC3: opakovaný tah mezery nezaplní a puntíky na sebe navazují', () => {
  it('opakovaný tah přes stejné místo mezery nezaplní', () => {
    const regions = bigBlank();
    const { game } = freshOn(regions);
    const before = pixelsOf(game, regions);

    for (let repeat = 0; repeat < 5; repeat += 1) {
      dots(game, HORIZONTAL);
    }

    expect(problemsOf(game, regions, before, HORIZONTAL)).toEqual([]);
  });

  it('i trochu posunuté tahy přes sebe barví jen puntíky, mezery zůstanou prázdné', () => {
    const regions = bigBlank();
    const { game } = freshOn(regions);
    for (const shift of [0, 2.3, 4.6, 7.1, 9.4, 13.8]) {
      dots(game, [at(60 + shift, 300 + shift), at(390 + shift, 300 - shift)]);
    }

    const painted: string[] = [];
    for (let y = 0; y < regions.height; y += 1) {
      for (let x = 0; x < regions.width; x += 1) {
        if (game.colorAt(x, y) !== null && !bigDots().isDot(x, y)) {
          painted.push(`mezera (${x}, ${y}) je zabarvená`);
        }
      }
    }
    expect(painted.slice(0, 5)).toEqual([]);
    expect(paintedPixels(game, regions), 'tahy něco namalovaly').toBeGreaterThan(0);
  });

  it('dva tahy za sebou navazují jako jeden dlouhý tah: puntíky na styku nejsou posunuté ani zdvojené', () => {
    const regions = bigBlank();
    const { game } = freshOn(regions);
    const before = pixelsOf(game, regions);
    const [from, to] = [at(60.3, 280.7), at(420.6, 323.3)];
    const split = at(from.x + (to.x - from.x) * 0.47, from.y + (to.y - from.y) * 0.47);

    dots(game, [from, split]);
    dots(game, [split, to]);

    expect(problemsOf(game, regions, before, [from, to])).toEqual([]);
  });

  it('dva vedlejší tahy se překrývají bez posunutých puntíků: každý pixel je puntík, nebo prázdno', () => {
    const regions = bigBlank();
    const { game } = freshOn(regions);
    const first = [at(60, 300), at(400, 300)];
    const second = [at(60, 312.4), at(400, 312.4)];

    dots(game, first);
    dots(game, second);

    const radius = radiusOf();
    const core = [...strokeCore(regions, first, radius), ...strokeCore(regions, second, radius)];
    const missing = core.filter(([x, y]) => bigDots().isDot(x, y) && game.colorAt(x, y) !== BLUE);
    expect(missing.length, 'puntíky obou stop jsou celé').toBe(0);
    const offGrid = core.filter(([x, y]) => !bigDots().isDot(x, y) && game.colorAt(x, y) !== null);
    expect(offGrid.length, 'mezi puntíky nic').toBe(0);
  });
});

describe('#101 AC3: ořez a souvislost platí jako u štětce', () => {
  it('tah začatý v oblasti A a tažený přes obrys do B barví dál jen puntíky v A, i po návratu do A', () => {
    const regions = bigHalves();
    const { regionA, regionB } = bigRegions(regions);
    const { game } = freshOn(regions);
    const before = pixelsOf(game, regions);
    const path = [at(300, 300), at(650, 300), at(650, 200), at(150, 200)];

    dots(game, path);

    expect(changedInRegion(game, regions, before, regionB), 'oblast B').toEqual([]);
    expect(problemsOf(game, regions, before, path, { region: regionA }), 'oblast A').toEqual([]);
  });

  it('puntíky dosáhnou až k obrysu, za ním nic', () => {
    const regions = bigHalves();
    const { regionA } = bigRegions(regions);
    const { game } = freshOn(regions);
    const before = pixelsOf(game, regions);
    const path = [at(BIG_LINE_X - 6, 60), at(BIG_LINE_X - 6, 540)];

    dots(game, path);

    expect(problemsOf(game, regions, before, path, { region: regionA })).toEqual([]);
    // Nejbližší sloupec puntíků k obrysu je od něj nejvýš rozestup puntíků.
    const nearLine = strokeCore(regions, path, radiusOf()).filter(
      ([x, y]) =>
        x < BIG_LINE_X && x >= BIG_LINE_X - dotSpacing(BIG_WIDTH) && bigDots().isDot(x, y),
    );
    expect(nearLine.length, 'u obrysu jsou puntíky mřížky').toBeGreaterThan(0);
    expect(shareWith(game, nearLine, BLUE), 'puntíky těsně u obrysu jsou zabarvené').toBe(1);
  });

  it('tah začatý na obrysu barví jen oblast, do které prst vjede', () => {
    const regions = bigHalves();
    const { regionA, regionB } = bigRegions(regions);
    const { game } = freshOn(regions);
    const before = pixelsOf(game, regions);
    const path = [at(BIG_LINE_X + 0.5, 300), at(700, 300), at(500, 100)];

    dots(game, path);

    expect(changedInRegion(game, regions, before, regionA), 'oblast A').toEqual([]);
    const inB = strokeCore(regions, [at(520, 300), at(680, 300)], radiusOf()).filter(
      ([x, y]) => regionAt(regions, x, y) === regionB && bigDots().isDot(x, y),
    );
    expect(shareWith(game, inB, BLUE), 'puntíky v B').toBe(1);
  });

  it('tah začatý mimo obrázek nic nenamaluje, ani když prst na obrázek vjede', () => {
    const regions = bigBlank();
    const { game } = freshOn(regions);

    dots(game, [at(-30, 300), at(300, 300), at(700, 300)]);

    expect(paintedPixels(game, regions)).toBe(0);
  });

  it('rychlý tah se dvěma body daleko od sebe je souvislý: žádný puntík po cestě nechybí', () => {
    const regions = bigBlank();
    const { game } = freshOn(regions);
    const before = pixelsOf(game, regions);
    const path = [at(20.2, 30.7), at(880.4, 570.9)];

    dots(game, path);

    expect(problemsOf(game, regions, before, path)).toEqual([]);
  });
});

describe('#101 AC3: stejný tah dá vždy stejné pixely', () => {
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
    ] as const) {
      const regions = bigBlank();
      const { game } = freshOn(regions);
      const before = pixelsOf(game, regions);

      dots(game, path);

      expect(problemsOf(game, regions, before, [from, to]), name).toEqual([]);
    }
  });

  it('stejné tahy ve dvou hrách nakreslí stejné pixely, i když jinde předtím malovaly jinak', () => {
    const regions = bigBlank();
    const first = freshOn(regions).game;
    const second = freshOn(regions).game;
    // Druhá hra nejdřív maluje jinde a pak to vrátí, mřížka se tím nesmí posunout.
    dots(second, [at(700.3, 100.6), at(850.1, 140.2)]);
    second.tapUndo();

    for (const { path } of SHAPES) {
      dots(first, path);
      dots(second, path);
    }

    expect(
      pixelDifferences(pixelsOf(second, regions), pixelsOf(first, regions), regions.width),
    ).toEqual([]);
  });
});

describe('#101 AC4: okrajové případy', () => {
  it('ťuknutí bez pohybu zabarví puntíky v kruhu průměru W, i ty, do kterých kruh zasahuje jen částí', () => {
    const radius = radiusOf();
    for (const tap of [at(300.5, 300.5), at(207.3, 141.8), at(612.9, 433.4)]) {
      const regions = bigBlank();
      const { game } = freshOn(regions);
      const before = pixelsOf(game, regions);

      dots(game, [tap]);

      const where = `ťuknutí (${tap.x}, ${tap.y})`;
      expect(problemsOf(game, regions, before, [tap]), where).toEqual([]);
      // Puntíky, které kruh protíná: část leží s jistotou uvnitř, část s jistotou venku.
      const cut = cutSpots(bigDots(), tap, radius);
      expect(cut.length, `${where}: kruh protíná puntíky`).toBeGreaterThan(0);
      for (const spot of cut) {
        const insideSpot = strokeCore(regions, [tap], radius).filter(
          ([x, y]) =>
            x >= spot.left &&
            x <= spot.right &&
            y >= spot.top &&
            y <= spot.bottom &&
            bigDots().isDot(x, y),
        );
        expect(
          shareWith(game, insideSpot, BLUE),
          `${where}: část puntíku v kruhu je zabarvená`,
        ).toBe(1);
      }
    }
  });

  it('ťuknutí, při kterém se prst zachvěje na místě, je pořád kruh puntíků průměru W', () => {
    const regions = bigBlank();
    const { game } = freshOn(regions);
    const before = pixelsOf(game, regions);
    const tap = at(300.5, 300.5);

    dots(game, [tap, at(300.7, 300.5), tap, at(300.5, 300.6), tap]);

    expect(problemsOf(game, regions, before, [tap])).toEqual([]);
  });

  it('opakovaný stejný tah nic nezmění a do Zpět se nepočítá', () => {
    const regions = bigBlank();
    const { game } = freshOn(regions);
    dots(game, HORIZONTAL);
    const drawn = pixelsOf(game, regions);
    dots(game, HORIZONTAL);
    dots(game, HORIZONTAL);

    expect(
      pixelDifferences(pixelsOf(game, regions), drawn, regions.width),
      'nic se nezměnilo',
    ).toEqual([]);
    expect(game.tapUndo().kind, 'první Zpět').toBe('undone');
    expect(paintedPixels(game, regions), 'jedno Zpět vrátí první tah').toBe(0);
    expect(game.tapUndo().kind, 'víc není co vracet').toBe('wobble');
  });

  it('tah přes místo, které už má stejné puntíky, nic nezmění a do Zpět se nepočítá', () => {
    const regions = bigBlank();
    const { game } = freshOn(regions);
    chooseSize(game, 'large');
    dots(game, HORIZONTAL);
    const drawn = pixelsOf(game, regions);

    // Užší a kratší tahy uvnitř velké stopy, jiné body i jiná velikost.
    chooseSize(game, 'small');
    dots(game, [at(100.3, 297.1), at(250.8, 305.4)]);
    chooseSize(game, 'medium');
    dots(game, [at(320.6, 306.2), at(140.1, 293.9), at(200.2, 300.4)]);

    expect(
      pixelDifferences(pixelsOf(game, regions), drawn, regions.width),
      'nic se nezměnilo',
    ).toEqual([]);
    expect(game.tapUndo().kind).toBe('undone');
    expect(paintedPixels(game, regions), 'Zpět vrátil velký tah').toBe(0);
    expect(game.tapUndo().kind).toBe('wobble');
  });

  it('puntíky stejnou barvou přes stejně vybarvené místo nic nezmění a do Zpět se nepočítají', () => {
    const regions = bigHalves();
    const { game } = freshOn(regions);
    fillAWithBrush(game, BLUE);
    const filled = pixelsOf(game, regions);

    dots(game, HORIZONTAL, BLUE);
    expect(
      pixelDifferences(pixelsOf(game, regions), filled, regions.width),
      'nic se nezměnilo',
    ).toEqual([]);

    game.tapUndo();
    expect(paintedPixels(game, regions), 'Zpět vrátil vybarvení, ne puntíky').toBeLessThan(
      filled.filter((color) => color !== null).length,
    );
  });

  it('tah začatý mimo plochu se do Zpět nepočítá', () => {
    const regions = bigBlank();
    const { game } = freshOn(regions);
    drawWith(game, 'brush', BLACK, [at(100, 100), at(300, 100)]);

    dots(game, [at(-30, 300), at(300, 300)]);

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
      coloring.pointerDown({ id, x: first.x, y: first.y, kind: 'touch' }, BLUE, DOTS);
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

describe('#101 AC5: velikost mění šířku stopy, puntíky zůstávají stejné', () => {
  it('v každé velikosti je stopa kulatá a široká 1,0 W své velikosti a barví puntíky stejné mřížky', () => {
    for (const size of SIZES) {
      for (const { name, path } of SHAPES) {
        const regions = bigBlank();
        const { game } = freshOn(regions);
        const before = pixelsOf(game, regions);
        chooseSize(game, size);

        dots(game, path);

        expect(
          problemsOf(game, regions, before, path, { size }),
          `${SIZE_NAMES[size]}, ${name}`,
        ).toEqual([]);
      }
    }
  });

  it('velikost nemění puntíky: celý obrázek přejetý malou, střední i velkou stopou má stejné puntíky', () => {
    const large = dotPixels(BIG_WIDTH, BIG_HEIGHT, 'large');
    const asPixels = (grid: DotPixels): Array<number | null> => {
      const pixels: Array<number | null> = [];
      for (let y = 0; y < grid.height; y += 1) {
        for (let x = 0; x < grid.width; x += 1) {
          pixels.push(grid.isDot(x, y) ? 1 : null);
        }
      }
      return pixels;
    };
    for (const size of ['small', 'medium'] as const) {
      expect(
        pixelDifferences(
          asPixels(dotPixels(BIG_WIDTH, BIG_HEIGHT, size)),
          asPixels(large),
          BIG_WIDTH,
        ),
        SIZE_NAMES[size],
      ).toEqual([]);
    }
  });

  it('širší stopa zabarví víc puntíků', () => {
    const counts: number[] = [];
    for (const size of SIZES) {
      const regions = bigBlank();
      const { game } = freshOn(regions);
      chooseSize(game, size);

      dots(game, HORIZONTAL);

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
    game.tapColor(BLUE);
    choose(game, DOTS);
    startStroke(game, path.slice(0, 2));

    // Ťuknutí na přepínač během tahu se nepočítá.
    game.tapSizeToggle();
    game.pointerMove({ id: 1, x: 420.5, y: 300.5, kind: 'touch' });
    game.pointerUp(1);

    expect(game.lineSize()).toBe('large');
    expect(problemsOf(game, regions, before, path, { size: 'large' })).toEqual([]);
  });
});

describe('#101 AC5: Zpět vrátí tah puntíkovým fixem pixel po pixelu', () => {
  it('Zpět vrátí tah s puntíky přes několik barev do stavu před ním', () => {
    const regions = bigHalves();
    const { game } = freshOn(regions);
    fillAWithBrush(game, ORANGE);
    drawWith(game, 'brush', BLACK, [at(200, 20), at(200, 580)]);
    const before = pixelsOf(game, regions);

    dots(game, [at(30.5, 30.5), at(420.5, 570.5), at(420.5, 30.5), at(30.5, 570.5)], BLUE);
    expect(
      pixelDifferences(pixelsOf(game, regions), before, regions.width).length,
      'puntíky něco namalovaly',
    ).toBeGreaterThan(0);

    expect(game.tapUndo().kind).toBe('undone');
    expect(pixelDifferences(pixelsOf(game, regions), before, regions.width)).toEqual([]);
  });

  it('Zpět vrátí puntíky ořezané u obrysu a vedlejší oblast nechá, jak byla', () => {
    const regions = bigHalves();
    const { game } = freshOn(regions);
    drawWith(game, 'brush', ORANGE, [at(BIG_LINE_X + 20, 100), at(BIG_LINE_X + 20, 500)]);
    const before = pixelsOf(game, regions);

    dots(game, [at(BIG_LINE_X - 6, 60.5), at(BIG_LINE_X - 6, 540.5)], BLUE);
    game.tapUndo();

    expect(pixelDifferences(pixelsOf(game, regions), before, regions.width)).toEqual([]);
  });

  it('tahy puntíkovým fixem a jinými nástroji vrátí Zpět postupně, každý do stavu před ním', () => {
    const regions = bigBlank();
    const { game } = freshOn(regions);
    const states = [pixelsOf(game, regions)];
    dots(game, HORIZONTAL, BLUE);
    states.push(pixelsOf(game, regions));
    drawWith(game, 'crayon', PINK, [at(60, 305), at(390, 295)]);
    states.push(pixelsOf(game, regions));
    dots(game, [at(80, 290), at(380, 310)], LIGHT_BLUE);

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
    dots(game, HORIZONTAL);
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
    choose(game, DOTS);
    startStroke(game, HORIZONTAL);
    const drawn = pixelsOf(game, regions);
    game.suspend();

    expect(paintedPixels(game, regions), 'puntíky jsou namalované').toBeGreaterThan(0);
    expect(
      pixelDifferences(pixelsOf(openOn(storage, regions), regions), drawn, regions.width),
    ).toEqual([]);
  });
});
