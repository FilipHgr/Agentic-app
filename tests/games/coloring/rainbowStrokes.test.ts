import { describe, expect, it } from 'vitest';

import type { RegionMap } from '../../../src/games/coloring/logic/regionMap';
import type { SavedColoring } from '../../../src/games/coloring/logic/savedPicture';
import type { LineSize } from '../../../src/games/coloring/logic/toolPanel';
import {
  BIG_LINE_X,
  INSIDE,
  OUTSIDE,
  bigHalves,
  bigRegions,
  changedInRegion,
  choose,
  drawWith,
  limited,
  paintedBeyond,
  pixelsWhere,
} from './drawingToolHelpers';
import { SIZES, SIZE_NAMES, WIDTH_SHARE, chooseSize } from './lineSizeHelpers';
import { distanceToPath } from './outlineFixtures';
import type { Point } from './outlineFixtures';
import {
  BAND,
  BAND_TOLERANCE,
  RAINBOW,
  RAINBOW_NAMES,
  colorRunsInRow,
  isRainbowColor,
  rainbowMismatches,
} from './rainbowHelpers';
import { at } from './strokeHelpers';
import {
  RecordingStorage,
  openOn,
  paint,
  paintedPixels,
  pixelsOf,
  startStroke,
} from './savedPictureHelpers';

/**
 * Testy k #97 AC2 (stopa duhového štětce), AC3 (stejný tah, stejný
 * výsledek; ořez a souvislost jako u štětce z #88) a AC5 (velikost a Zpět).
 * Výběr nástroje a volba barvy (AC1, AC4) jsou v `rainbowSelection.test.ts`,
 * místo v panelu v `rainbowLayoutRules.test.ts`, limit uložení
 * v `rainbowRecord.test.ts`.
 *
 * Měří se na obrázku 900 × 600 z `drawingToolHelpers.ts`: W stř = 30 px,
 * úsek jedné barvy duhy 2 W stř = 60 px. Očekávané barvy pixelů počítá
 * `rainbowHelpers.ts` přímo podle znění AC2 (nejbližší bod dráhy, při
 * shodě pozdější, barva podle délky dráhy).
 *
 * Navržené rozhraní:
 * - `ToolId` a `PANEL_TOOLS` v `src/games/coloring/logic/toolPanel.ts`
 *   dostanou `'rainbow'` (duhový štětec),
 * - `SavedColoring.pointerDown` maluje duhou, když je vybraná (`tapTool`),
 * - `Coloring.pointerDown(pointer, colorIndex, 'rainbow', width)` maluje
 *   duhou a `colorIndex` nepoužije; délka úseku je 2 W stř podle šířky
 *   plochy (`brushWidthFor(regions.width, 'medium')`), ne podle `width`.
 */

const ORANGE = 1;
const BLUE = 4;
const BLACK = 7;

const RED = RAINBOW[0] as number;
const PURPLE = RAINBOW[5] as number;
const GREEN = RAINBOW[3] as number;

/** Polovina šířky stopy duhy (1,0 W) při velikosti `size` na obrázku 900 px. */
function halfWidth(size: LineSize): number {
  return (WIDTH_SHARE[size] * 900) / 2;
}

const MID_HALF = halfWidth('medium');

/** Měřený tah z AC2: vodorovně, 12 W stř = 360 px, přes prázdnou oblast A. */
const MEASURED: readonly Point[] = [at(50, 300), at(410, 300)];

function freshGame(): { game: SavedColoring; regions: RegionMap; storage: RecordingStorage } {
  const storage = new RecordingStorage();
  const regions = bigHalves();
  return { game: openOn(storage, regions), regions, storage };
}

/** Tah duhovým štětcem: výběr nástroje a tah. */
function rainbow(game: SavedColoring, path: readonly Point[]): void {
  choose(game, 'rainbow');
  paint(game, path);
}

/** Celou oblast A vybarví štětcem barvou `color`. */
function fillA(game: SavedColoring, color: number): void {
  choose(game, 'brush');
  game.tapColor(color);
  for (let y = 0; y <= 600; y += 20) {
    paint(game, [at(4, Math.min(y, 599)), at(BIG_LINE_X - 4, Math.min(y, 599))]);
  }
}

/** Pixely oblasti nejvýš `reach` od dráhy, které nemají žádnou barvu duhy. */
function notRainbowNear(
  game: SavedColoring,
  regions: RegionMap,
  region: number,
  path: readonly Point[],
  reach: number,
): string[] {
  return limited(
    pixelsWhere(regions, region, (center) => distanceToPath(center, path) <= reach)
      .filter(([x, y]) => !isRainbowColor(game.colorAt(x, y)))
      .map(([x, y]) => `pixel (${x}, ${y}) má ${String(game.colorAt(x, y))}`),
  );
}

/** Úseky barev podél středu měřeného tahu, jen mezi počátečním a koncovým bodem. */
function measuredRuns(game: SavedColoring): Array<{ color: number | null; length: number }> {
  const [from, to] = MEASURED as [Point, Point];
  return colorRunsInRow(game, from.y, from.x, to.x);
}

function expectSixBands(game: SavedColoring, what: string): void {
  const runs = measuredRuns(game);
  expect(
    runs.map((run) => run.color),
    `${what}: pořadí barev ${RAINBOW_NAMES.join(', ')}`,
  ).toEqual(RAINBOW);
  runs.forEach((run, index) => {
    const name = `${what}: úsek ${index + 1} (${RAINBOW_NAMES[index] ?? '?'})`;
    expect(run.length, `${name} aspoň ${BAND - BAND_TOLERANCE} px`).toBeGreaterThanOrEqual(
      BAND - BAND_TOLERANCE,
    );
    expect(run.length, `${name} nejvýš ${BAND + BAND_TOLERANCE} px`).toBeLessThanOrEqual(
      BAND + BAND_TOLERANCE,
    );
  });
}

describe('#97 AC2: stopa duhy má tvar a šířku štětce', () => {
  it('tah duhou zabarví každý pixel kulaté stopy šířky W a nic za ní', () => {
    const { game, regions } = freshGame();
    const { regionA } = bigRegions(regions);
    const path = [at(60, 100), at(400, 140), at(380, 500)];

    rainbow(game, path);

    expect(notRainbowNear(game, regions, regionA, path, MID_HALF - INSIDE), 've stopě').toEqual([]);
    expect(paintedBeyond(game, regions, path, MID_HALF + OUTSIDE), 'za stopou').toEqual([]);
  });

  it('duha přes vybarvené místo přebarví celou stopu barvami duhy', () => {
    const { game, regions } = freshGame();
    const { regionA } = bigRegions(regions);
    fillA(game, BLACK);

    rainbow(game, MEASURED);

    expect(notRainbowNear(game, regions, regionA, MEASURED, MID_HALF - INSIDE)).toEqual([]);
  });

  it('duha maluje jen 6 barev duhy, i v dlouhém tahu přes několik kol', () => {
    const { game, regions } = freshGame();
    const path = [at(30, 30), at(420, 30), at(420, 570), at(30, 570), at(30, 100), at(380, 300)];

    rainbow(game, path);

    const used = new Set(pixelsOf(game, regions).filter((color) => color !== null));
    expect([...used].sort(), 'použité barvy').toEqual([...RAINBOW].sort());
  });
});

describe('#97 AC2: barva se mění podle délky dráhy prstu', () => {
  it('vodorovný tah 12 W stř má podél středu 6 úseků v pořadí duhy, každý 2 W stř ± 1 px', () => {
    const { game } = freshGame();

    rainbow(game, MEASURED);

    expectSixBands(game, 'střední velikost');
  });

  it('po fialové začne duha znovu červenou', () => {
    const { game } = freshGame();

    rainbow(game, [at(20, 300), at(440, 300)]);

    const runs = colorRunsInRow(game, 300, 20, 440).map((run) => run.color);
    expect(runs, 'úseky podél tahu').toEqual([...RAINBOW, RED]);
  });

  it('délka se měří po dráze prstu, ne vzdušnou čarou od začátku', () => {
    const { game } = freshGame();

    // 240 px doprava a pak dolů: v pixelu (290, 250) je za prstem 390,5 px
    // dráhy (7. úsek, znovu červená), vzdušnou čarou je to jen 284 px (modrá).
    rainbow(game, [at(50, 100), at(290, 100), at(290, 400)]);

    expect(game.colorAt(290, 250), 'po 390,5 px dráhy').toBe(RED);
    expect(game.colorAt(290, 180), 'po 320,5 px dráhy').toBe(PURPLE);
  });

  it('barva každého pixelu odpovídá délce dráhy v nejbližším bodě, i v lomeném tahu', () => {
    const paths: Array<readonly Point[]> = [
      MEASURED,
      [at(40, 40), at(430, 560)],
      [at(60, 500), at(120, 420), at(260, 470), at(380, 380), at(400, 100)],
      [at(80, 80), at(380, 80), at(380, 300), at(80, 300), at(80, 520), at(380, 520)],
    ];
    paths.forEach((path, index) => {
      const { game, regions } = freshGame();
      const { regionA } = bigRegions(regions);

      rainbow(game, path);

      expect(
        rainbowMismatches(game, regions, regionA, path, MID_HALF - INSIDE),
        `tah ${index + 1}`,
      ).toEqual([]);
    });
  });
});

describe('#97 AC2: pixel, na který dosáhne víc míst dráhy', () => {
  it('pixel dostane barvu bližšího místa dráhy, i když to vzdálenější je pozdější', () => {
    const { game } = freshGame();

    // Tam po řádku 300, zpátky po řádku 320: obě stopy na sebe dosáhnou.
    rainbow(game, [at(50, 300), at(400, 300), at(400, 320), at(50, 320)]);

    // Pixel (100, 307) má blíž cestu tam (50,5 px dráhy, červená) než zpátky.
    expect(game.colorAt(100, 307), 'blíž cesta tam').toBe(RED);
    // Pixel (100, 313) má blíž cestu zpátky (669,5 px dráhy, fialová).
    expect(game.colorAt(100, 313), 'blíž cesta zpátky').toBe(PURPLE);
  });

  it('při stejné vzdálenosti vyhraje pozdější místo dráhy: tah tam a zpátky má barvy cesty zpátky', () => {
    const { game, regions } = freshGame();
    const { regionA } = bigRegions(regions);
    const path = [at(50, 300), at(350, 300), at(50, 300)];

    rainbow(game, path);

    // Pixel (100, 300): tam 50,5 px dráhy (červená), zpátky 549,5 px (zelená).
    expect(game.colorAt(100, 300), 'na čáře tahu').toBe(GREEN);
    expect(game.colorAt(100, 310), 'kousek pod čárou').toBe(GREEN);
    // Pixel (300, 300): tam 250,5 px (modrá), zpátky 349,5 px (fialová).
    expect(game.colorAt(300, 300), 'u otočky').toBe(PURPLE);
    expect(rainbowMismatches(game, regions, regionA, path, MID_HALF - INSIDE)).toEqual([]);
  });
});

describe('#97 AC2: každý tah začíná červenou', () => {
  it('ťuknutí bez pohybu udělá kulatou červenou tečku velikosti štětce', () => {
    const { game, regions } = freshGame();
    const { regionA } = bigRegions(regions);
    const tap = [at(200, 300)];

    rainbow(game, tap);

    const dot = pixelsWhere(regions, regionA, (c) => distanceToPath(c, tap) <= MID_HALF - INSIDE);
    expect(dot.length, 'tečka má pixely').toBeGreaterThan(500);
    expect(
      dot.filter(([x, y]) => game.colorAt(x, y) !== RED).slice(0, 5),
      'celá tečka červená',
    ).toEqual([]);
    expect(paintedBeyond(game, regions, tap, MID_HALF + OUTSIDE), 'mimo tečku').toEqual([]);
  });

  it('ťuknutí, při kterém se prst zachvěje na místě, je taky červená tečka', () => {
    const { game, regions } = freshGame();

    rainbow(game, [at(200, 300), at(200, 300), at(200, 300)]);

    const colors = new Set(pixelsOf(game, regions).filter((color) => color !== null));
    expect([...colors]).toEqual([RED]);
  });

  it('každý další tah začíná znovu červenou, i po dlouhém tahu', () => {
    const { game } = freshGame();
    rainbow(game, [at(20, 100), at(430, 100)]);

    rainbow(game, [at(100, 400), at(400, 400)]);

    expect(game.colorAt(105, 400), 'začátek druhého tahu').toBe(RED);
    expect(game.colorAt(95, 400), 'těsně před začátkem druhého tahu').toBe(RED);
  });

  it('duha začíná červenou bez ohledu na vybranou barvu v paletě', () => {
    for (const color of [ORANGE, BLUE, BLACK]) {
      const { game } = freshGame();
      game.tapColor(color);

      rainbow(game, MEASURED);

      expect(game.colorAt(60, 300), `vybraná barva ${color}`).toBe(RED);
      expectSixBands(game, `vybraná barva ${color}`);
    }
  });
});

describe('#97 AC3: stejný tah, stejný výsledek', () => {
  it('pomalý tah s mnoha body a rychlý tah se dvěma body nakreslí stejné pixely', () => {
    const fast = freshGame();
    const slow = freshGame();
    rainbow(fast.game, MEASURED);

    const slowPath: Point[] = [];
    for (let x = 50; x <= 410; x += 5) {
      slowPath.push(at(x, 300));
    }
    rainbow(slow.game, slowPath);

    expect(pixelsOf(slow.game, slow.regions)).toEqual(pixelsOf(fast.game, fast.regions));
  });

  it('zastavení prstu uprostřed tahu (stejný bod hlášený víckrát) nic nezmění', () => {
    const smooth = freshGame();
    const paused = freshGame();
    const corner = at(300, 100);
    rainbow(smooth.game, [at(50, 100), corner, at(300, 500)]);

    rainbow(paused.game, [
      at(50, 100),
      at(50, 100),
      at(170, 100),
      corner,
      corner,
      corner,
      at(300, 300),
      at(300, 500),
    ]);

    expect(pixelsOf(paused.game, paused.regions)).toEqual(pixelsOf(smooth.game, smooth.regions));
  });

  it('stejné tahy ve dvou hrách nakreslí stejné pixely', () => {
    const strokes: Array<readonly Point[]> = [
      MEASURED,
      [at(30, 40), at(410, 570)],
      [at(60, 500), at(120, 420), at(260, 470), at(380, 380)],
      [at(222.3, 111.7)],
    ];
    const first = freshGame();
    const second = freshGame();
    for (const path of strokes) {
      rainbow(first.game, path);
      rainbow(second.game, path);
    }
    expect(pixelsOf(second.game, second.regions)).toEqual(pixelsOf(first.game, first.regions));
  });

  it('stejný tah nakreslí stejné pixely i po Zpět a po jiných tazích jinde', () => {
    const { game, regions } = freshGame();
    rainbow(game, MEASURED);
    const once = pixelsOf(game, regions);
    game.tapUndo();

    rainbow(game, [at(500, 50), at(850, 550)]);
    drawWith(game, 'brush', BLACK, [at(600, 500), at(800, 100)]);
    game.tapUndo();
    game.tapUndo();
    rainbow(game, MEASURED);

    expect(pixelsOf(game, regions)).toEqual(once);
  });
});

describe('#97 AC3: ořez a souvislost jako u štětce', () => {
  it('tah začatý v oblasti A a tažený přes obrys do B barví dál jen A, i po návratu do A', () => {
    const { game, regions } = freshGame();
    const { regionA, regionB } = bigRegions(regions);
    const before = pixelsOf(game, regions);
    const back = [at(BIG_LINE_X - 20, 200), at(150, 200)];

    rainbow(game, [at(300, 300), at(650, 300), at(650, 200), ...back]);

    expect(changedInRegion(game, regions, before, regionB), 'oblast B').toEqual([]);
    expect(notRainbowNear(game, regions, regionA, back, 2), 'návrat do A').toEqual([]);
  });

  it('barva se mění podle celé dráhy prstu, i té, kterou jel mimo oblast tahu', () => {
    const { game } = freshGame();

    // Do B a zpátky: v bodě (320,5; 200) je za prstem 929,5 px dráhy (zelená),
    // v bodě (200,5; 200) 1049,5 px (fialová).
    rainbow(game, [at(50, 300), at(600, 300), at(600, 200), at(100, 200)]);

    expect(game.colorAt(320, 200), 'po 929,5 px dráhy').toBe(GREEN);
    expect(game.colorAt(200, 200), 'po 1049,5 px dráhy').toBe(PURPLE);
  });

  it('tah začatý na obrysu barví jen oblast, do které prst vjede', () => {
    const { game, regions } = freshGame();
    const { regionA, regionB } = bigRegions(regions);
    const before = pixelsOf(game, regions);
    const inB = [at(520, 300), at(680, 300)];

    rainbow(game, [at(BIG_LINE_X + 0.5, 300), at(700, 300), at(500, 100)]);

    expect(changedInRegion(game, regions, before, regionA), 'oblast A').toEqual([]);
    expect(notRainbowNear(game, regions, regionB, inB, 2), 'oblast B').toEqual([]);
  });

  it('tah začatý mimo obrázek nic nenamaluje, ani když prst na obrázek vjede', () => {
    const { game, regions } = freshGame();

    rainbow(game, [at(-30, 300), at(300, 300), at(700, 300)]);

    expect(paintedPixels(game, regions)).toBe(0);
  });

  it('duha dosáhne až k obrysu a vedlejší oblast nechá prázdnou', () => {
    const { game, regions } = freshGame();
    const { regionB } = bigRegions(regions);
    const before = pixelsOf(game, regions);

    rainbow(game, [at(BIG_LINE_X - 5, 100), at(BIG_LINE_X - 5, 500)]);

    for (let y = 100; y < 500; y += 1) {
      expect(
        isRainbowColor(game.colorAt(BIG_LINE_X - 1, y)),
        `pixel u obrysu (${BIG_LINE_X - 1}, ${y})`,
      ).toBe(true);
    }
    expect(changedInRegion(game, regions, before, regionB), 'oblast B').toEqual([]);
  });

  it('rychlý tah s body daleko od sebe dá souvislou duhu bez mezer', () => {
    const { game, regions } = freshGame();
    const { regionA } = bigRegions(regions);
    const path = [at(20, 20), at(430, 580)];

    rainbow(game, path);

    expect(notRainbowNear(game, regions, regionA, path, MID_HALF - INSIDE)).toEqual([]);
    expect(rainbowMismatches(game, regions, regionA, path, MID_HALF - INSIDE)).toEqual([]);
  });
});

describe('#97 AC5: velikost mění šířku stopy, ne délku úseků', () => {
  it('v každé velikosti má duha šířku 1,0 W a úseky dlouhé 2 W stř ± 1 px', () => {
    for (const size of SIZES) {
      const { game, regions } = freshGame();
      const { regionA } = bigRegions(regions);
      chooseSize(game, size);
      const half = halfWidth(size);

      rainbow(game, MEASURED);

      const what = SIZE_NAMES[size];
      expectSixBands(game, what);
      expect(
        notRainbowNear(game, regions, regionA, MEASURED, half - INSIDE),
        `${what}: ve stopě`,
      ).toEqual([]);
      expect(paintedBeyond(game, regions, MEASURED, half + OUTSIDE), `${what}: za stopou`).toEqual(
        [],
      );
      expect(
        rainbowMismatches(game, regions, regionA, MEASURED, half - INSIDE),
        `${what}: barvy`,
      ).toEqual([]);
    }
  });
});

describe('#97 AC5: Zpět vrátí tah duhou', () => {
  it('Zpět vrátí tah duhou přes několik barev do stavu před ním pixel po pixelu', () => {
    const { game, regions } = freshGame();
    fillA(game, ORANGE);
    drawWith(game, 'brush', BLUE, [at(200, 20), at(200, 580)]);
    const before = pixelsOf(game, regions);

    rainbow(game, [at(30, 30), at(420, 570), at(420, 30), at(30, 570)]);
    expect(pixelsOf(game, regions), 'duha něco namalovala').not.toEqual(before);

    expect(game.tapUndo().kind).toBe('undone');
    expect(pixelsOf(game, regions)).toEqual(before);
  });

  it('opakovaný stejný tah duhou nic nezmění a do Zpět se nepočítá', () => {
    const { game, regions } = freshGame();
    rainbow(game, MEASURED);
    rainbow(game, MEASURED);
    rainbow(game, MEASURED);

    expect(game.tapUndo().kind, 'první Zpět').toBe('undone');
    expect(paintedPixels(game, regions), 'jedno Zpět vrátí první tah').toBe(0);
    expect(game.tapUndo().kind, 'víc není co vracet').toBe('wobble');
  });

  it('tah duhou začatý mimo obrázek se do Zpět nepočítá', () => {
    const { game } = freshGame();
    drawWith(game, 'brush', BLUE, [at(100, 100), at(300, 100)]);

    rainbow(game, [at(-30, 300), at(300, 300)]);
    expect(game.tapUndo().kind, 'Zpět vrátí tah štětcem').toBe('undone');
    expect(game.colorAt(200, 100), 'modrá čára je pryč').toBeNull();
    expect(game.tapUndo().kind).toBe('wobble');
  });

  it('vrácený tah duhou zůstane vrácený i po návratu do hry', () => {
    const { game, regions, storage } = freshGame();
    fillA(game, ORANGE);
    const before = pixelsOf(game, regions);
    rainbow(game, MEASURED);
    game.tapUndo();
    game.suspend();

    expect(pixelsOf(openOn(storage, regions), regions)).toEqual(before);
  });

  it('rozpracovaný tah duhou se při schování stránky uloží tak, kam prst došel', () => {
    const { game, regions, storage } = freshGame();
    choose(game, 'rainbow');
    startStroke(game, MEASURED);
    const drawn = pixelsOf(game, regions);
    game.suspend();

    expect(pixelsOf(openOn(storage, regions), regions)).toEqual(drawn);
  });
});
