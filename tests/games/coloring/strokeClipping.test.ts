import { describe, expect, it } from 'vitest';

import { brushWidthFor, createColoring } from '../../../src/games/coloring/logic/coloring';
import { OUTLINE_REGION, regionAt } from '../../../src/games/coloring/logic/regionMap';
import {
  TEST_HEIGHT,
  TEST_WIDTH,
  drawing,
  missingPixels,
  paintedCount,
  pixelsBeyondBrush,
  pixelsOf,
  pixelsOutsideRegion,
  snapshotOf,
} from './outlineFixtures';
import { at, stroke } from './strokeHelpers';

/**
 * Testy k #88 AC1 (prázdná plocha), AC2 (ořez do oblasti), AC3 (souvislá
 * čára) a AC4 (přebarvení). Malování běží nad mapou oblastí ze syntetických
 * obrysů 300 × 200 px, takže W = 300 / 30 = 10 px. Oblast tahu se určí při
 * jeho začátku a tah zabarví jen pixely této oblasti.
 *
 * Měří se podle zadání: zabarví se každý pixel oblasti tahu, jehož střed je
 * nejvýš W/2 od čáry tahu (s rezervou 0,5 px na pixely), a nic dál než
 * W/2 + 1 px.
 *
 * Navržené rozhraní (`src/games/coloring/logic/coloring.ts`):
 * - `brushWidthFor(pictureWidth): number` = šířka / 30,
 * - `createColoring(regions: RegionMap, options?: { brushWidth?: number }): Coloring`,
 * - `Coloring { brushWidth; pointerDown(pointer, colorIndex); pointerMove(pointer);
 *   pointerUp(pointerId); interrupt(); colorAt(x, y): number | null }`,
 * - `PointerSample { id: number; x: number; y: number; kind?: PointerKind }`,
 *   `PointerKind = 'touch' | 'pen' | 'mouse'`, souřadnice v pixelech
 *   vrstvy barev (= mapy oblastí), bod mimo obrázek je mimo plochu,
 * - `colorAt` vrací index barvy palety, `null` u prázdného pixelu,
 *   obrysu i mimo plochu.
 * Metody tahu smějí vracet změněný obdélník pro texturu; testy ho nečtou.
 */

const RED = 0;
const BLUE = 4;

/** Obrázek rozdělený svislou čárou (x 150 a 151): vlevo oblast A, vpravo oblast B. */
function twoHalves() {
  const regions = drawing().verticalLine(150).regions();
  const coloring = createColoring(regions);
  const regionA = regionAt(regions, 10, 10) as number;
  const regionB = regionAt(regions, 290, 10) as number;
  return { regions, coloring, regionA, regionB };
}

describe('#88 AC1: omalovánka začíná s prázdnou plochou', () => {
  it('na nové omalovánce není zabarvený žádný pixel', () => {
    const regions = drawing().frame(100, 50, 200, 150).regions();
    const coloring = createColoring(regions);
    expect(paintedCount(coloring, regions)).toBe(0);
  });
});

describe('#88 šířka stopy W', () => {
  it('stopa je široká 1/30 šířky plochy', () => {
    expect(brushWidthFor(300)).toBeCloseTo(10);
    expect(brushWidthFor(1024)).toBeCloseTo(1024 / 30);
  });

  it('omalovánka maluje stopou široké 1/30 šířky svého obrázku', () => {
    for (const width of [300, 1024]) {
      const coloring = createColoring(drawing(width, 120).regions());
      expect(coloring.brushWidth, `obrázek široký ${width} px`).toBeCloseTo(width / 30);
    }
  });
});

describe('#88 AC2: tah barví jen oblast, ve které začal', () => {
  it('tah začatý v oblasti A barví jen oblast A, i když přejede do oblasti B', () => {
    const { regions, coloring, regionA } = twoHalves();
    stroke(coloring, [at(40, 100), at(260, 100), at(260, 20)], RED);

    expect(pixelsOutsideRegion(coloring, regions, regionA)).toEqual([]);
    expect(coloring.colorAt(100, 100), 'oblast A je zabarvená').toBe(RED);
  });

  it('když prst vyjede hluboko do oblasti B, nic dalšího se nezabarví, a po návratu do A se barví dál', () => {
    const { regions, coloring, regionA } = twoHalves();
    coloring.pointerDown({ id: 1, x: 100, y: 100, kind: 'touch' }, RED);
    coloring.pointerMove({ id: 1, x: 220, y: 100, kind: 'touch' });
    const afterLeaving = snapshotOf(coloring, regions);

    // Prst jezdí po B daleko od A (víc než W/2 od čáry mezi nimi).
    coloring.pointerMove({ id: 1, x: 220, y: 30, kind: 'touch' });
    coloring.pointerMove({ id: 1, x: 280, y: 180, kind: 'touch' });
    expect(snapshotOf(coloring, regions), 'pohyb v oblasti B nic nezabarví').toEqual(afterLeaving);

    coloring.pointerMove({ id: 1, x: 60, y: 180, kind: 'touch' });
    coloring.pointerMove({ id: 1, x: 40, y: 40, kind: 'touch' });
    coloring.pointerUp(1);
    expect(coloring.colorAt(40, 40), 'po návratu do A se barví dál').toBe(RED);
    expect(coloring.colorAt(50, 110), 'cestou zpátky přes A').toBe(RED);
    expect(pixelsOutsideRegion(coloring, regions, regionA)).toEqual([]);
  });

  it('když prst vyjede daleko mimo plochu, nic dalšího se nezabarví, a po návratu se barví dál', () => {
    const { regions, coloring, regionA } = twoHalves();
    coloring.pointerDown({ id: 1, x: 60, y: 100, kind: 'touch' }, RED);
    coloring.pointerMove({ id: 1, x: -40, y: 100, kind: 'touch' });
    const afterLeaving = snapshotOf(coloring, regions);

    coloring.pointerMove({ id: 1, x: -40, y: 10, kind: 'touch' });
    coloring.pointerMove({ id: 1, x: -60, y: 190, kind: 'touch' });
    expect(snapshotOf(coloring, regions), 'pohyb mimo plochu nic nezabarví').toEqual(afterLeaving);

    coloring.pointerMove({ id: 1, x: 80, y: 30, kind: 'touch' });
    coloring.pointerUp(1);
    expect(coloring.colorAt(80, 30), 'po návratu na plochu se barví dál').toBe(RED);
    expect(pixelsOutsideRegion(coloring, regions, regionA)).toEqual([]);
  });

  it('když prst jede po obrysu, obrys ani oblast B se nezabarví a po návratu do A se barví dál', () => {
    const { regions, coloring, regionA } = twoHalves();
    stroke(coloring, [at(100, 20), at(150.5, 20), at(150.5, 180), at(100, 180)], RED);
    expect(pixelsOutsideRegion(coloring, regions, regionA)).toEqual([]);
    expect(coloring.colorAt(100, 180), 'po návratu do A').toBe(RED);
  });

  it('obrys se nezabarví nikdy, ani když se čmárá přes celý obrázek z každé oblasti i z obrysu', () => {
    const regions = drawing()
      .frame(20, 20, 140, 180)
      .frame(60, 60, 100, 100, 1)
      .verticalLine(150)
      .horizontalLine(120, 3)
      .regions();
    const coloring = createColoring(regions);
    const zigzag = Array.from({ length: 31 }, (_, index) =>
      at(index * 10, index % 2 === 0 ? 2 : TEST_HEIGHT - 2),
    );
    const starts = [at(5, 5), at(80, 80), at(30, 40), at(200, 50), at(200, 160), at(150.5, 60)];
    starts.forEach((start, color) => stroke(coloring, [start, ...zigzag], color));

    const painted: string[] = [];
    for (const [x, y] of pixelsOf(regions)) {
      if (regionAt(regions, x, y) === OUTLINE_REGION && coloring.colorAt(x, y) !== null) {
        painted.push(`(${x}, ${y})`);
      }
    }
    expect(painted.slice(0, 5), 'zabarvené pixely obrysu').toEqual([]);
    expect(paintedCount(coloring, regions), 'čmárání něco namalovalo').toBeGreaterThan(0);
  });

  it('tah v pozadí kolem domečku obarví pozadí, ale vnitřek domečku ne', () => {
    const regions = drawing().frame(100, 50, 200, 150).regions();
    const background = regionAt(regions, 0, 0) as number;
    const coloring = createColoring(regions);
    stroke(coloring, [at(60, 20), at(240, 20), at(240, 180), at(60, 180), at(150, 100)], RED);

    expect(pixelsOutsideRegion(coloring, regions, background)).toEqual([]);
    expect(coloring.colorAt(240, 100), 'pozadí vpravo od domečku').toBe(RED);
    expect(coloring.colorAt(150, 100), 'vnitřek domečku').toBeNull();
  });

  it('tah začatý v domečku obarví jen domeček, pozadí kolem zůstane prázdné', () => {
    const regions = drawing().frame(100, 50, 200, 150).regions();
    const inside = regionAt(regions, 150, 100) as number;
    const coloring = createColoring(regions);
    stroke(coloring, [at(150, 100), at(20, 100), at(150, 190)], BLUE);

    expect(pixelsOutsideRegion(coloring, regions, inside)).toEqual([]);
    expect(coloring.colorAt(110, 100), 'domeček u levé stěny').toBe(BLUE);
  });
});

describe('#88 AC3: dva body tahu dají souvislou čáru šířky W bez mezer', () => {
  it.each([
    ['přes celou šířku', [at(3, 100), at(297, 100)]],
    ['šikmo přes celý obrázek', [at(2, 2), at(298, 198)]],
    ['svisle', [at(150, 1), at(150, 199)]],
    ['lomená čára s dlouhými skoky', [at(10, 10), at(290, 30), at(20, 190), at(280, 170)]],
  ])('body daleko od sebe (%s) dají čáru bez mezer a ne širší než W', (_name, path) => {
    const regions = drawing().regions();
    const region = regionAt(regions, 0, 0) as number;
    const coloring = createColoring(regions);
    stroke(coloring, path, RED);

    expect(missingPixels(coloring, regions, path, region, RED), 'mezery v čáře').toEqual([]);
    expect(pixelsBeyondBrush(coloring, regions, path), 'čára širší než W').toEqual([]);
  });

  it('část spojnice přes jinou oblast se nezabarví a za ní se barví dál', () => {
    const { regions, coloring, regionA, regionB } = twoHalves();
    // Dva dlouhé skoky: z A daleko do B a z B zpátky do A.
    const path = [at(20, 50), at(280, 100), at(20, 150)];
    stroke(coloring, path, RED);

    expect(pixelsOutsideRegion(coloring, regions, regionA)).toEqual([]);
    expect(missingPixels(coloring, regions, path, regionA, RED)).toEqual([]);
    expect(coloring.colorAt(280, 100), 'oblast B').toBeNull();
    expect(regionB).not.toBe(regionA);
  });

  it('tah pozadím přes tenký kmen obarví pozadí z obou stran kmene, kmen ani obrys ne', () => {
    // Kmen: obrys x 148–149 a 152–153, vnitřek x 150–151, y 52 až 148.
    const regions = drawing().frame(148, 50, 153, 150).regions();
    const background = regionAt(regions, 0, 0) as number;
    const trunk = regionAt(regions, 150, 100) as number;
    expect(trunk).not.toBe(background);
    const coloring = createColoring(regions);
    const path = [at(151, 20), at(151, 180)];
    stroke(coloring, path, RED);

    expect(coloring.colorAt(147, 100), 'pozadí vlevo od kmene').toBe(RED);
    expect(coloring.colorAt(154, 100), 'pozadí vpravo od kmene').toBe(RED);
    expect(coloring.colorAt(150, 100), 'vnitřek kmene').toBeNull();
    expect(pixelsOutsideRegion(coloring, regions, background)).toEqual([]);
    expect(missingPixels(coloring, regions, path, background, RED)).toEqual([]);
  });

  it('spojnice mimo plochu se nezabarví a čára na ploše po obou stranách je bez mezer', () => {
    const regions = drawing().regions();
    const region = regionAt(regions, 0, 0) as number;
    const coloring = createColoring(regions);
    const path = [at(100, 20), at(-80, 100), at(100, 180)];
    stroke(coloring, path, RED);

    expect(missingPixels(coloring, regions, path, region, RED)).toEqual([]);
    expect(pixelsBeyondBrush(coloring, regions, path)).toEqual([]);
  });

  it('barva dosáhne až k obrysu: úzký pruh užší než W se podél tahu zabarví celý', () => {
    // Pruh y 97 až 102 mezi čarami y 95–96 a 103–104.
    const regions = drawing().horizontalLine(95).horizontalLine(103).regions();
    const strip = regionAt(regions, 150, 100) as number;
    const coloring = createColoring(regions);
    const path = [at(20, 100), at(280, 100)];
    stroke(coloring, path, BLUE);

    expect(missingPixels(coloring, regions, path, strip, BLUE)).toEqual([]);
    for (let x = 20; x < 280; x += 1) {
      expect(coloring.colorAt(x, 97), `pixel (${x}, 97) hned pod obrysem`).toBe(BLUE);
      expect(coloring.colorAt(x, 102), `pixel (${x}, 102) hned nad obrysem`).toBe(BLUE);
    }
    expect(pixelsOutsideRegion(coloring, regions, strip)).toEqual([]);
  });

  it('barva dosáhne až k obrysu i u tahu kousek od čáry: zabarví se každý pixel do W/2', () => {
    const { regions, coloring, regionA } = twoHalves();
    // Tah 3 px od obrysu (x 150): pixely x 146 až 149 jsou blíž než W/2.
    const path = [at(147, 20), at(147, 180)];
    stroke(coloring, path, RED);

    expect(missingPixels(coloring, regions, path, regionA, RED)).toEqual([]);
    expect(coloring.colorAt(149, 100), 'pixel hned u obrysu').toBe(RED);
  });

  it('ťuknutí bez pohybu udělá kulatou tečku průměru W', () => {
    const regions = drawing().regions();
    const region = regionAt(regions, 0, 0) as number;
    const coloring = createColoring(regions);
    const center = at(150.5, 100.5);
    stroke(coloring, [center], RED);

    expect(missingPixels(coloring, regions, [center], region, RED), 'díry v tečce').toEqual([]);
    expect(pixelsBeyondBrush(coloring, regions, [center]), 'tečka větší než W').toEqual([]);
  });

  it('pohyb na stejné místo je pořád jen tečka průměru W', () => {
    const regions = drawing().regions();
    const region = regionAt(regions, 0, 0) as number;
    const coloring = createColoring(regions);
    const center = at(80, 60);
    stroke(coloring, [center, center, center], RED);

    expect(missingPixels(coloring, regions, [center], region, RED)).toEqual([]);
    expect(pixelsBeyondBrush(coloring, regions, [center])).toEqual([]);
  });

  it('tečka u obrysu zabarví jen svou oblast', () => {
    const { regions, coloring, regionA } = twoHalves();
    const center = at(148, 100);
    stroke(coloring, [center], RED);

    expect(pixelsOutsideRegion(coloring, regions, regionA)).toEqual([]);
    expect(missingPixels(coloring, regions, [center], regionA, RED)).toEqual([]);
  });

  it('tečka na kraji obrázku nic neshodí a zabarví jen to, co je na ploše', () => {
    const regions = drawing().regions();
    const region = regionAt(regions, 0, 0) as number;
    const coloring = createColoring(regions);
    expect(() => stroke(coloring, [at(0.5, 0.5)], RED)).not.toThrow();
    expect(() => stroke(coloring, [at(TEST_WIDTH - 0.5, TEST_HEIGHT - 0.5)], RED)).not.toThrow();
    expect(coloring.colorAt(0, 0)).toBe(RED);
    expect(coloring.colorAt(TEST_WIDTH - 1, TEST_HEIGHT - 1)).toBe(RED);
    expect(missingPixels(coloring, regions, [at(0.5, 0.5)], region, RED)).toEqual([]);
  });
});

describe('#88 AC4: tah přes vybarvené místo ho přebarví novou barvou', () => {
  it('druhý tah jinou barvou přebarví místa prvního tahu, kudy vede', () => {
    const regions = drawing().regions();
    const region = regionAt(regions, 0, 0) as number;
    const coloring = createColoring(regions);
    const first = [at(20, 100), at(280, 100)];
    const second = [at(150, 20), at(150, 180)];
    stroke(coloring, first, RED);
    stroke(coloring, second, BLUE);

    expect(coloring.colorAt(150, 100), 'křížení tahů').toBe(BLUE);
    expect(missingPixels(coloring, regions, second, region, BLUE)).toEqual([]);
    expect(coloring.colorAt(40, 100), 'první tah mimo druhý zůstal').toBe(RED);
  });

  it('každé místo má jen jednu barvu: stejný tah novou barvou přebarví celý starý tah', () => {
    const regions = drawing().regions();
    const coloring = createColoring(regions);
    const path = [at(30, 30), at(270, 170)];
    stroke(coloring, path, RED);
    stroke(coloring, path, BLUE);

    for (const [x, y] of pixelsOf(regions)) {
      expect([null, BLUE], `pixel (${x}, ${y})`).toContain(coloring.colorAt(x, y));
    }
  });

  it('mimo plochu ani na obrysu se barva nečte', () => {
    const { coloring } = twoHalves();
    stroke(coloring, [at(140, 100), at(160, 100)], RED);
    expect(coloring.colorAt(150, 100), 'obrys').toBeNull();
    expect(coloring.colorAt(-1, 100), 'mimo plochu').toBeNull();
    expect(coloring.colorAt(TEST_WIDTH, 100), 'mimo plochu').toBeNull();
  });
});
