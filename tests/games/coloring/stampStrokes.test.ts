import { describe, expect, it } from 'vitest';

import { NO_COLOR, createColoring } from '../../../src/games/coloring/logic/coloring';
import type { RegionMap } from '../../../src/games/coloring/logic/regionMap';
import { regionAt } from '../../../src/games/coloring/logic/regionMap';
import type { SavedColoring } from '../../../src/games/coloring/logic/savedPicture';
import {
  BIG_HEIGHT,
  BIG_LINE_X,
  bigHalves,
  bigRegions,
  changedInRegion,
  choose,
  drawWith,
} from './drawingToolHelpers';
import { SIZES, SIZE_NAMES, chooseSize } from './lineSizeHelpers';
import type { Point } from './outlineFixtures';
import {
  RecordingStorage,
  openOn,
  paint,
  paintedPixels,
  pixelsOf,
  startStroke,
} from './savedPictureHelpers';
import {
  bigBlank,
  boxProblems,
  paintedAwayFromStars,
  paintedOutside,
  paintedPatches,
  starCenters,
  starProblems,
  starRadius,
  starSpacing,
  widthOf,
} from './stampHelpers';
import { at } from './strokeHelpers';

/**
 * Testy k #98 AC2 (stopa razítkového fixu), AC3 (ořez a stejný výsledek),
 * AC4 (okrajové případy) a AC5 (velikost a Zpět). Výběr nástroje (AC1) je
 * v `stampSelection.test.ts` a `stampLayoutRules.test.ts`, limit uložení
 * v `stampRecord.test.ts`.
 *
 * Měří se na obrázku 900 × 600 (W stř = 30 px): hvězdička má poloměr kruhu
 * R = 0,75 W = 22,5 px a středy jsou po 2 W = 60 px dráhy. Tvar hvězdičky
 * hlídají pomůcky ze `stampHelpers.ts` (cípy, zářezy, obdélník kolem).
 * Body tahů leží na středech pixelů (x,5), aby hvězdičky byly souměrné
 * podle sloupce pixelů.
 *
 * Navržené rozhraní:
 * - `ToolId` a `PANEL_TOOLS` v `src/games/coloring/logic/toolPanel.ts`
 *   dostanou `'stamp'` (razítkový fix),
 * - `SavedColoring.pointerDown` klade hvězdičky, když je vybraný (`tapTool`),
 * - `Coloring.pointerDown(pointer, colorIndex, 'stamp', width)` klade
 *   hvězdičky barvy `colorIndex` s poloměrem kruhu 0,75 `width` po 2 `width`
 *   dráhy prstu; dráha se měří od dotyku po celé cestě prstu (i mimo
 *   oblast tahu), jako u duhy (#97).
 */

const ORANGE = 1;
const BLUE = 4;
const BLACK = 7;

const R = starRadius('medium');
const SPACING = starSpacing('medium');
const W = widthOf('medium');

/** Vodorovný tah délky 10 W stř z AC2 (300 px) přes prázdný obrázek. */
const TEN_W_START_X = 60.5;
const TEN_W: readonly Point[] = [at(TEN_W_START_X, 300.5), at(TEN_W_START_X + 10 * W, 300.5)];

function freshOn(regions: RegionMap): { game: SavedColoring; storage: RecordingStorage } {
  const storage = new RecordingStorage();
  return { game: openOn(storage, regions), storage };
}

/** Tah razítkovým fixem barvou `color`: výběr barvy, výběr nástroje, tah. */
function stars(game: SavedColoring, path: readonly Point[], color = BLUE): void {
  drawWith(game, 'stamp', color, path);
}

/** Celou oblast A (nebo celý prázdný obrázek do x 450) vybarví štětcem. */
function fillLeft(game: SavedColoring, color: number): void {
  game.tapColor(color);
  choose(game, 'brush');
  for (let y = 0; y <= BIG_HEIGHT; y += 20) {
    paint(game, [
      at(4, Math.min(y, BIG_HEIGHT - 1)),
      at(BIG_LINE_X - 4, Math.min(y, BIG_HEIGHT - 1)),
    ]);
  }
}

/** Tah po bodech s nepravidelnými rozestupy na stejné přímce jako `from`–`to`. */
function unevenLine(from: Point, to: Point): Point[] {
  const shares = [0, 0.004, 0.13, 0.131, 0.2, 0.45, 0.46, 0.7, 0.71, 0.93, 1];
  return shares.map((share) =>
    at(from.x + (to.x - from.x) * share, from.y + (to.y - from.y) * share),
  );
}

describe('#98 AC2: podél tahu se kladou plné hvězdičky', () => {
  it('vodorovný tah délky 10 W udělá přesně 6 hvězdiček', () => {
    const regions = bigBlank();
    const { game } = freshOn(regions);

    stars(game, TEN_W);

    expect(paintedPatches(game, regions).length).toBe(6);
  });

  it('hvězdičky leží po 2 W od začátku tahu a každá je plná pěticípá se špičkou nahoru', () => {
    const regions = bigBlank();
    const { game } = freshOn(regions);
    const centers = starCenters(TEN_W, SPACING);

    stars(game, TEN_W);

    expect(centers.length, 'očekávaných středů').toBe(6);
    expect(centers.flatMap((center) => starProblems(game, center, R, BLUE))).toEqual([]);
  });

  it('každá hvězdička je vepsaná do kruhu průměru 1,5 W a míří špičkou nahoru', () => {
    const regions = bigBlank();
    const { game } = freshOn(regions);
    const centers = starCenters(TEN_W, SPACING);

    stars(game, TEN_W);

    const patches = paintedPatches(game, regions);
    expect(patches.length).toBe(centers.length);
    expect(
      centers.flatMap((center, index) => {
        const patch = patches[index];
        return patch === undefined ? ['chybí hvězdička'] : boxProblems(patch, center, R);
      }),
    ).toEqual([]);
  });

  it('mezi hvězdičkami se nic nezabarví', () => {
    const regions = bigBlank();
    const { game } = freshOn(regions);

    stars(game, TEN_W);

    expect(paintedAwayFromStars(game, regions, starCenters(TEN_W, SPACING), R)).toEqual([]);
  });

  it('hvězdičky mají jen vybranou barvu', () => {
    for (const color of [ORANGE, BLUE, BLACK]) {
      const regions = bigBlank();
      const { game } = freshOn(regions);

      stars(game, TEN_W, color);

      const used = new Set(pixelsOf(game, regions).filter((each) => each !== null));
      expect([...used], `barva ${color}`).toEqual([color]);
    }
  });

  it('ťuknutí udělá jednu hvězdičku přesně v místě ťuknutí', () => {
    const regions = bigBlank();
    const { game } = freshOn(regions);
    const tap = at(200.5, 300.5);

    stars(game, [tap]);

    const patches = paintedPatches(game, regions);
    expect(patches.length, 'počet hvězdiček').toBe(1);
    expect(starProblems(game, tap, R, BLUE), 'tvar').toEqual([]);
    expect(boxProblems(patches[0] as (typeof patches)[number], tap, R), 'rozměry').toEqual([]);
  });

  it('ťuknutí, při kterém se prst zachvěje na místě, je taky jedna hvězdička', () => {
    const regions = bigBlank();
    const { game } = freshOn(regions);
    const tap = at(200.5, 300.5);

    stars(game, [tap, at(201, 300.5), tap, at(200.5, 301)]);

    expect(paintedPatches(game, regions).length).toBe(1);
  });

  it('tah kratší než 2 W udělá jen hvězdičku na začátku', () => {
    const regions = bigBlank();
    const { game } = freshOn(regions);
    const path = [at(200.5, 300.5), at(200.5 + SPACING - 5, 300.5)];

    stars(game, path);

    expect(paintedPatches(game, regions).length).toBe(1);
    expect(starProblems(game, at(200.5, 300.5), R, BLUE)).toEqual([]);
  });

  it('rozestup se měří po dráze prstu, i když tah zahne', () => {
    const regions = bigBlank();
    const { game } = freshOn(regions);
    // Zatáčka po 90 px dráhy, tedy uprostřed mezi 2. a 3. hvězdičkou.
    const path = [at(100.5, 100.5), at(190.5, 100.5), at(190.5, 400.5)];
    const centers = starCenters(path, SPACING);

    stars(game, path);

    // 3. hvězdička je 30 px za zatáčkou (190,5; 130,5); vzdušnou čarou od
    // 2. hvězdičky by byla až v (190,5; 152,5).
    expect(centers[2], 'střed 3. hvězdičky').toEqual(at(190.5, 130.5));
    expect(centers.length, 'očekávaných středů').toBe(7);
    expect(centers.flatMap((center) => starProblems(game, center, R, BLUE))).toEqual([]);
    expect(paintedAwayFromStars(game, regions, centers, R)).toEqual([]);
  });

  it('hvězdičky přes vybarvené místo přebarví jen samy sebe, mezi nimi zůstane původní barva', () => {
    const regions = bigBlank();
    const { game } = freshOn(regions);
    fillLeft(game, BLACK);
    const centers = starCenters(TEN_W, SPACING);

    stars(game, TEN_W, BLUE);

    expect(
      centers.flatMap((center) => starProblems(game, center, R, BLUE)),
      'hvězdičky',
    ).toEqual([]);
    // Uprostřed mezi dvěma hvězdičkami (na čáře tahu) je pořád černá.
    for (let gap = 0; gap < centers.length - 1; gap += 1) {
      const x = Math.floor(TEN_W_START_X + (gap + 0.5) * SPACING);
      expect(game.colorAt(x, 300), `mezera ${gap + 1}`).toBe(BLACK);
    }
  });
});

describe('#98 AC3: hvězdička u obrysu se ořízne do oblasti tahu', () => {
  it('hvězdička kousek od obrysu zabarví jen oblast, kde tah začal', () => {
    const regions = bigHalves();
    const { regionA, regionB } = bigRegions(regions);
    const { game } = freshOn(regions);
    const before = pixelsOf(game, regions);
    const tap = at(BIG_LINE_X - 9.5, 300.5);

    stars(game, [tap]);

    expect(changedInRegion(game, regions, before, regionB), 'oblast B').toEqual([]);
    expect(paintedOutside(game, regions, regionA), 'jen oblast A').toEqual([]);
    // Horní cíp leží celý v A, ten zůstane namalovaný.
    for (let distance = 0; distance <= 0.7 * R; distance += 1) {
      expect(game.colorAt(Math.floor(tap.x), Math.floor(tap.y - distance)), `cíp ${distance}`).toBe(
        BLUE,
      );
    }
  });

  it('obrys pod hvězdičkou zůstane bez barvy', () => {
    const regions = bigHalves();
    const coloring = createColoring(regions);
    const tap = at(BIG_LINE_X - 9.5, 300.5);

    coloring.pointerDown({ id: 1, x: tap.x, y: tap.y, kind: 'touch' }, BLUE, 'stamp');
    coloring.pointerUp(1);

    const layer = coloring.colorLayer();
    const outline: string[] = [];
    for (let y = 0; y < regions.height; y += 1) {
      for (let x = 0; x < regions.width; x += 1) {
        const region = regionAt(regions, x, y);
        const color = layer[y * regions.width + x];
        if (region !== regionAt(regions, 10, 10) && color !== NO_COLOR) {
          outline.push(`pixel (${x}, ${y}) mimo oblast A má ${String(color)}`);
        }
      }
    }
    expect(outline.slice(0, 5)).toEqual([]);
    expect(coloring.colorAt(Math.floor(tap.x), Math.floor(tap.y)), 'střed hvězdičky').toBe(BLUE);
  });

  it('tah přes obrys do vedlejší oblasti tam nic nezabarví a po návratu klade hvězdičky dál po dráze', () => {
    const regions = bigHalves();
    const { regionA, regionB } = bigRegions(regions);
    const { game } = freshOn(regions);
    const before = pixelsOf(game, regions);
    const path = [at(300.5, 300.5), at(650.5, 300.5), at(650.5, 200.5), at(100.5, 200.5)];
    const centers = starCenters(path, SPACING);

    stars(game, path);

    expect(changedInRegion(game, regions, before, regionB), 'oblast B').toEqual([]);
    expect(paintedOutside(game, regions, regionA), 'jen oblast A').toEqual([]);
    expect(paintedAwayFromStars(game, regions, centers, R), 'mezi hvězdičkami').toEqual([]);
    const wholeInA = centers.filter((center) => center.x + R + 2 < BIG_LINE_X);
    expect(wholeInA.length, 'hvězdičky celé v A').toBeGreaterThan(5);
    expect(wholeInA.flatMap((center) => starProblems(game, center, R, BLUE))).toEqual([]);
  });

  it('tah začatý mimo plochu nic nenamaluje, ani když prst na obrázek vjede', () => {
    const regions = bigBlank();
    const { game } = freshOn(regions);

    stars(game, [at(-30, 300), at(300, 300), at(700, 300)]);

    expect(paintedPixels(game, regions)).toBe(0);
  });
});

describe('#98 AC3: stejný tah dá vždy stejné pixely', () => {
  it('pomalý tah s mnoha body a rychlý tah se dvěma body nakreslí stejné pixely', () => {
    const regions = bigBlank();
    const fast = freshOn(regions).game;
    const slow = freshOn(regions).game;
    const [from, to] = [at(60.5, 300.5), at(500.5, 300.5)];
    stars(fast, [from, to]);

    const slowPath: Point[] = [];
    for (let x = from.x; x <= to.x; x += 3) {
      slowPath.push(at(x, from.y));
    }
    slowPath.push(to);
    stars(slow, slowPath);

    expect(pixelsOf(slow, regions)).toEqual(pixelsOf(fast, regions));
  });

  it('nepravidelné rozestupy bodů a šikmý tah dají stejné pixely jako tah dvěma body', () => {
    const regions = bigBlank();
    const [from, to] = [at(50.5, 80.5), at(820.5, 560.5)];
    const even = freshOn(regions).game;
    const uneven = freshOn(regions).game;

    stars(even, [from, to]);
    stars(uneven, unevenLine(from, to));

    expect(pixelsOf(uneven, regions)).toEqual(pixelsOf(even, regions));
  });

  it('zastavení prstu uprostřed tahu (stejný bod hlášený víckrát) nic nezmění', () => {
    const regions = bigBlank();
    const smooth = freshOn(regions).game;
    const paused = freshOn(regions).game;
    const corner = at(300.5, 100.5);
    stars(smooth, [at(50.5, 100.5), corner, at(300.5, 500.5)]);

    stars(paused, [
      at(50.5, 100.5),
      at(50.5, 100.5),
      at(170.5, 100.5),
      corner,
      corner,
      corner,
      at(300.5, 300.5),
      at(300.5, 500.5),
    ]);

    expect(pixelsOf(paused, regions)).toEqual(pixelsOf(smooth, regions));
  });

  it('pomalý tah nepřekryje hvězdičky: rozestup je pořád 2 W', () => {
    const regions = bigBlank();
    const { game } = freshOn(regions);
    const path: Point[] = [];
    for (let x = 60.5; x <= 60.5 + 10 * W; x += 0.5) {
      path.push(at(x, 300.5));
    }

    stars(game, path);

    expect(paintedPatches(game, regions).length).toBe(6);
  });

  it('stejné tahy ve dvou hrách nakreslí stejné pixely', () => {
    const strokes: Array<readonly Point[]> = [
      TEN_W,
      [at(30.5, 40.5), at(410.5, 570.5)],
      [at(60, 500), at(120, 420), at(260, 470), at(380, 380)],
      [at(222.3, 111.7)],
    ];
    const regions = bigBlank();
    const first = freshOn(regions).game;
    const second = freshOn(regions).game;
    for (const path of strokes) {
      stars(first, path);
      stars(second, path);
    }
    expect(pixelsOf(second, regions)).toEqual(pixelsOf(first, regions));
  });
});

describe('#98 AC4: okrajové případy', () => {
  it('opakovaný stejný tah nic nezmění a do Zpět se nepočítá', () => {
    const regions = bigBlank();
    const { game } = freshOn(regions);
    stars(game, TEN_W);
    stars(game, TEN_W);
    stars(game, TEN_W);

    expect(game.tapUndo().kind, 'první Zpět').toBe('undone');
    expect(paintedPixels(game, regions), 'jedno Zpět vrátí první tah').toBe(0);
    expect(game.tapUndo().kind, 'víc není co vracet').toBe('wobble');
  });

  it('hvězdička stejnou barvou přes stejnou barvu se do Zpět nepočítá', () => {
    const regions = bigBlank();
    const { game } = freshOn(regions);
    fillLeft(game, BLUE);
    const filled = pixelsOf(game, regions);

    stars(game, [at(200.5, 300.5), at(300.5, 300.5)], BLUE);
    expect(pixelsOf(game, regions), 'nic se nezměnilo').toEqual(filled);

    game.tapUndo();
    expect(paintedPixels(game, regions), 'Zpět vrátil vybarvení, ne hvězdičky').toBeLessThan(
      filled.filter((color) => color !== null).length,
    );
  });

  it('tah začatý mimo plochu se do Zpět nepočítá', () => {
    const regions = bigBlank();
    const { game } = freshOn(regions);
    drawWith(game, 'brush', BLACK, [at(100, 100), at(300, 100)]);

    stars(game, [at(-30, 300), at(300, 300)]);

    expect(game.tapUndo().kind, 'Zpět vrátí tah štětcem').toBe('undone');
    expect(game.colorAt(200, 100), 'černá čára je pryč').toBeNull();
    expect(game.tapUndo().kind).toBe('wobble');
  });

  it('ani velmi rychlý tah s jediným pohybem přes 14 W nevynechá žádnou hvězdičku', () => {
    const regions = bigBlank();
    const { game } = freshOn(regions);
    const path = [at(60.5, 300.5), at(60.5 + 14 * W, 300.5)];
    const centers = starCenters(path, SPACING);

    stars(game, path);

    expect(centers.length, 'očekávaných hvězdiček').toBe(8);
    expect(paintedPatches(game, regions).length, 'hvězdiček').toBe(8);
    expect(centers.flatMap((center) => starProblems(game, center, R, BLUE))).toEqual([]);
  });

  it('rychlý šikmý tah přes celý obrázek má všechny hvězdičky po dráze', () => {
    const regions = bigBlank();
    const { game } = freshOn(regions);
    const path = [at(40.5, 40.5), at(860.5, 560.5)];
    const centers = starCenters(path, SPACING);

    stars(game, path);

    expect(paintedPatches(game, regions).length).toBe(centers.length);
    expect(centers.flatMap((center) => starProblems(game, center, R, BLUE))).toEqual([]);
  });
});

describe('#98 AC5: velikost mění velikost hvězdiček i rozestup', () => {
  it('v každé velikosti má hvězdička kruh 1,5 W a rozestup 2 W, tah 10 W udělá 6 hvězdiček', () => {
    for (const size of SIZES) {
      const regions = bigBlank();
      const { game } = freshOn(regions);
      const radius = starRadius(size);
      const path = [at(60.5, 300.5), at(60.5 + 10 * widthOf(size), 300.5)];
      const centers = starCenters(path, starSpacing(size));
      chooseSize(game, size);

      stars(game, path);

      const what = SIZE_NAMES[size];
      const patches = paintedPatches(game, regions);
      expect(patches.length, `${what}: počet hvězdiček`).toBe(6);
      expect(
        centers.flatMap((center) => starProblems(game, center, radius, BLUE)),
        `${what}: tvar`,
      ).toEqual([]);
      expect(
        centers.flatMap((center, index) => {
          const patch = patches[index];
          return patch === undefined ? ['chybí hvězdička'] : boxProblems(patch, center, radius);
        }),
        `${what}: rozměry`,
      ).toEqual([]);
      expect(paintedAwayFromStars(game, regions, centers, radius), `${what}: mezi`).toEqual([]);
    }
  });

  it('velikost zvolená před tahem platí pro celý tah', () => {
    const regions = bigBlank();
    const { game } = freshOn(regions);
    chooseSize(game, 'large');
    choose(game, 'stamp');
    startStroke(game, [at(60.5, 300.5), at(200.5, 300.5)]);

    // Ťuknutí na přepínač během tahu se nepočítá.
    game.tapSizeToggle();
    game.pointerMove({ id: 1, x: 60.5 + 10 * widthOf('large'), y: 300.5, kind: 'touch' });
    game.pointerUp(1);

    expect(game.lineSize()).toBe('large');
    expect(paintedPatches(game, regions).length).toBe(6);
  });
});

describe('#98 AC5: Zpět vrátí tah razítkovým fixem', () => {
  it('Zpět vrátí tah s hvězdičkami do stavu před ním pixel po pixelu', () => {
    const regions = bigHalves();
    const { game } = freshOn(regions);
    fillLeft(game, ORANGE);
    drawWith(game, 'brush', BLACK, [at(200, 20), at(200, 580)]);
    const before = pixelsOf(game, regions);

    stars(game, [at(30.5, 30.5), at(420.5, 570.5), at(420.5, 30.5), at(30.5, 570.5)], BLUE);
    expect(pixelsOf(game, regions), 'hvězdičky něco namalovaly').not.toEqual(before);

    expect(game.tapUndo().kind).toBe('undone');
    expect(pixelsOf(game, regions)).toEqual(before);
  });

  it('Zpět vrátí hvězdičky ořezané u obrysu a vedlejší oblast nechá, jak byla', () => {
    const regions = bigHalves();
    const { game } = freshOn(regions);
    drawWith(game, 'brush', ORANGE, [at(BIG_LINE_X + 20, 100), at(BIG_LINE_X + 20, 500)]);
    const before = pixelsOf(game, regions);

    stars(game, [at(BIG_LINE_X - 9.5, 60.5), at(BIG_LINE_X - 9.5, 540.5)], BLUE);
    game.tapUndo();

    expect(pixelsOf(game, regions)).toEqual(before);
  });

  it('vrácený tah zůstane vrácený i po návratu do hry', () => {
    const regions = bigBlank();
    const { game, storage } = freshOn(regions);
    fillLeft(game, ORANGE);
    const before = pixelsOf(game, regions);
    stars(game, TEN_W);
    game.tapUndo();
    game.suspend();

    expect(pixelsOf(openOn(storage, regions), regions)).toEqual(before);
  });

  it('rozpracovaný tah se při schování stránky uloží tak, kam prst došel', () => {
    const regions = bigBlank();
    const { game, storage } = freshOn(regions);
    game.tapColor(BLUE);
    choose(game, 'stamp');
    startStroke(game, TEN_W);
    const drawn = pixelsOf(game, regions);
    game.suspend();

    expect(paintedPatches(game, regions).length, 'hvězdičky jsou namalované').toBe(6);
    expect(pixelsOf(openOn(storage, regions), regions)).toEqual(drawn);
  });
});
