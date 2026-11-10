import { describe, expect, it } from 'vitest';

import { createColoring } from '../../../src/games/coloring/logic/coloring';
import { regionAt } from '../../../src/games/coloring/logic/regionMap';
import {
  drawing,
  missingPixels,
  paintedCount,
  pixelsOutsideRegion,
  snapshotOf,
} from './outlineFixtures';
import { at, pointer, stroke } from './strokeHelpers';

/**
 * Testy k #88 AC5 (okrajové případy): tah začatý na obrysu nebo mimo
 * plochu, druhý prst a dlaň, zvednutí prvního prstu, systémové přerušení
 * a tužka. Rozhraní je stejné jako v `strokeClipping.test.ts`; přerušení
 * (příchozí hovor, gesto systému, přepnutí aplikace, `pointercancel`) hlásí
 * scéna jako `coloring.interrupt()`.
 */

const RED = 0;
const GREEN = 3;

/** Obrázek rozdělený svislou čárou (x 150 a 151): vlevo oblast A, vpravo oblast B. */
function twoHalves() {
  const regions = drawing().verticalLine(150).regions();
  const coloring = createColoring(regions);
  const regionA = regionAt(regions, 10, 10) as number;
  const regionB = regionAt(regions, 290, 10) as number;
  return { regions, coloring, regionA, regionB };
}

describe('#88 AC5: tah začatý na obrysu barví první oblast, do které prst vjede', () => {
  it('prst položený na obrys a tažený doprava barví jen oblast B', () => {
    const { regions, coloring, regionB } = twoHalves();
    stroke(coloring, [at(150.5, 100), at(200, 100), at(260, 60)], RED);

    expect(pixelsOutsideRegion(coloring, regions, regionB), 'oblast A ani obrys').toEqual([]);
    expect(coloring.colorAt(200, 100), 'oblast B').toBe(RED);
  });

  it('prst položený na obrys a tažený doleva barví jen oblast A, i když pak přejede do B', () => {
    const { regions, coloring, regionA } = twoHalves();
    stroke(coloring, [at(150.5, 100), at(150.5, 140), at(90, 140), at(260, 60)], RED);

    expect(pixelsOutsideRegion(coloring, regions, regionA)).toEqual([]);
    expect(coloring.colorAt(90, 140), 'oblast A').toBe(RED);
  });

  it('dokud prst jede jen po obrysu, nic se nezabarví ani u oblasti ne', () => {
    const regions = drawing().verticalLine(150, 20).regions(); // obrys x 150 až 169
    const coloring = createColoring(regions);
    stroke(coloring, [at(160, 20), at(160, 180), at(158, 40)], RED);
    expect(paintedCount(coloring, regions)).toBe(0);
  });

  it('ťuknutí na obrys nic nenamaluje', () => {
    const { regions, coloring } = twoHalves();
    stroke(coloring, [at(150.5, 100)], RED);
    expect(paintedCount(coloring, regions)).toBe(0);
  });
});

describe('#88 AC5: tah začatý mimo plochu nic nenamaluje', () => {
  it.each([
    ['vlevo od plochy', at(-30, 100)],
    ['nad plochou', at(100, -1)],
    ['vpravo za plochou', at(300, 100)],
    ['pod plochou (paleta)', at(100, 260)],
  ])('tah začatý %s nic nenamaluje, ani když prst vjede na plochu', (_name, start) => {
    const { regions, coloring } = twoHalves();
    stroke(coloring, [start, at(60, 100), at(250, 100), at(60, 30)], RED);
    expect(paintedCount(coloring, regions)).toBe(0);
  });

  it('ťuknutí mimo plochu nic nenamaluje', () => {
    const { regions, coloring } = twoHalves();
    stroke(coloring, [at(-5, -5)], RED);
    expect(paintedCount(coloring, regions)).toBe(0);
  });

  it('po tahu mimo plochu namaluje další tah normálně', () => {
    const { coloring } = twoHalves();
    stroke(coloring, [at(-30, 100), at(60, 100)], RED);
    stroke(coloring, [at(60, 50), at(100, 50)], GREEN);
    expect(coloring.colorAt(80, 50)).toBe(GREEN);
    expect(coloring.colorAt(60, 100)).toBeNull();
  });
});

describe('#88 AC5: druhý prst nebo dlaň během tahu nic nenamaluje a tah pokračuje prvním prstem', () => {
  it('druhý prst během tahu nic nenamaluje a první prst maluje dál', () => {
    const { regions, coloring, regionA } = twoHalves();
    coloring.pointerDown(pointer(1, at(40, 40)), RED);
    coloring.pointerDown(pointer(2, at(250, 100)), GREEN);
    coloring.pointerMove(pointer(2, at(250, 180)));
    coloring.pointerMove(pointer(2, at(100, 180)));
    coloring.pointerMove(pointer(1, at(120, 40)));
    coloring.pointerMove(pointer(1, at(120, 120)));
    coloring.pointerUp(2);
    coloring.pointerUp(1);

    expect(coloring.colorAt(250, 140), 'druhý prst v oblasti B').toBeNull();
    expect(coloring.colorAt(100, 180), 'druhý prst v oblasti A').toBeNull();
    expect(
      missingPixels(coloring, regions, [at(40, 40), at(120, 40), at(120, 120)], regionA, RED),
      'tah prvního prstu je souvislý',
    ).toEqual([]);
    expect(pixelsOutsideRegion(coloring, regions, regionA)).toEqual([]);
  });

  it('dlaň položená během tahu (víc dotyků najednou) nic nenamaluje', () => {
    const { regions, coloring } = twoHalves();
    coloring.pointerDown(pointer(1, at(40, 40)), RED);
    for (const id of [5, 6, 7]) {
      coloring.pointerDown(pointer(id, at(200 + id * 5, 150)), RED);
      coloring.pointerMove(pointer(id, at(200 + id * 5, 190)));
    }
    coloring.pointerMove(pointer(1, at(60, 40)));
    for (const id of [5, 6, 7]) {
      coloring.pointerUp(id);
    }
    coloring.pointerUp(1);

    expect(coloring.colorAt(230, 170), 'místo pod dlaní').toBeNull();
    expect(coloring.colorAt(50, 40), 'tah prstu').toBe(RED);
    expect(pixelsOutsideRegion(coloring, regions, regionAt(regions, 40, 40) as number)).toEqual([]);
  });

  it('druhý prst položený na obrázek tah nepřeruší: zvednutí druhého prstu tah neukončí', () => {
    const { coloring } = twoHalves();
    coloring.pointerDown(pointer(1, at(40, 40)), RED);
    coloring.pointerDown(pointer(2, at(100, 100)), RED);
    coloring.pointerUp(2);
    coloring.pointerMove(pointer(1, at(40, 120)));
    coloring.pointerUp(1);

    expect(coloring.colorAt(40, 80), 'tah pokračoval').toBe(RED);
    expect(coloring.colorAt(100, 100), 'místo druhého prstu').toBeNull();
  });
});

describe('#88 AC5: když se první prst zvedne a druhý zůstane, tah skončí', () => {
  it('druhý prst, který zůstal na obrázku, po zvednutí prvního nic nenamaluje', () => {
    const { regions, coloring } = twoHalves();
    coloring.pointerDown(pointer(1, at(40, 40)), RED);
    coloring.pointerDown(pointer(2, at(100, 100)), RED);
    coloring.pointerMove(pointer(1, at(60, 40)));
    coloring.pointerUp(1);
    const afterFirst = snapshotOf(coloring, regions);

    coloring.pointerMove(pointer(2, at(100, 180)));
    coloring.pointerMove(pointer(2, at(20, 180)));
    coloring.pointerUp(2);
    expect(snapshotOf(coloring, regions)).toEqual(afterFirst);
  });

  it('druhý prst začne malovat až po novém dotyku', () => {
    const { coloring } = twoHalves();
    coloring.pointerDown(pointer(1, at(40, 40)), RED);
    coloring.pointerDown(pointer(2, at(100, 100)), GREEN);
    coloring.pointerUp(1);
    coloring.pointerMove(pointer(2, at(100, 150)));
    coloring.pointerUp(2);
    expect(coloring.colorAt(100, 130), 'před novým dotykem').toBeNull();

    coloring.pointerDown(pointer(2, at(100, 160)), GREEN);
    coloring.pointerMove(pointer(2, at(100, 190)));
    coloring.pointerUp(2);
    expect(coloring.colorAt(100, 175), 'po novém dotyku').toBe(GREEN);
  });

  it('nový dotyk po skončeném tahu začne nový tah v oblasti, kde se prst dotkl', () => {
    const { regions, coloring, regionB } = twoHalves();
    stroke(coloring, [at(40, 40), at(60, 40)], RED);
    const beforeSecond = snapshotOf(coloring, regions);
    stroke(coloring, [at(200, 100), at(40, 100), at(250, 150)], GREEN, { id: 9 });

    expect(coloring.colorAt(200, 100), 'nový tah v oblasti B').toBe(GREEN);
    expect(coloring.colorAt(40, 100), 'oblast A nový tah nezabarví').toBeNull();
    const changed = snapshotOf(coloring, regions).flatMap((color, index) =>
      color === beforeSecond[index] ? [] : [index],
    );
    for (const index of changed) {
      const x = index % regions.width;
      const y = Math.floor(index / regions.width);
      expect(regionAt(regions, x, y), `změněný pixel (${x}, ${y})`).toBe(regionB);
    }
  });
});

describe('#88 AC5: systémové přerušení ukončí tah tam, kam došel', () => {
  it('namalované zůstane a po přerušení se nic nedokreslí', () => {
    const { regions, coloring, regionA } = twoHalves();
    coloring.pointerDown(pointer(1, at(20, 40)), RED);
    coloring.pointerMove(pointer(1, at(120, 40)));
    coloring.interrupt();
    const afterInterrupt = snapshotOf(coloring, regions);

    // Prohlížeč po přerušení ještě pošle pohyb a zvednutí téhož prstu.
    coloring.pointerMove(pointer(1, at(120, 180)));
    coloring.pointerMove(pointer(1, at(20, 180)));
    coloring.pointerUp(1);

    expect(snapshotOf(coloring, regions), 'nic se nedokreslilo').toEqual(afterInterrupt);
    expect(
      missingPixels(coloring, regions, [at(20, 40), at(120, 40)], regionA, RED),
      'namalovaná část zůstala',
    ).toEqual([]);
  });

  it('po přerušení namaluje nový dotyk normálně', () => {
    const { coloring } = twoHalves();
    coloring.pointerDown(pointer(1, at(20, 40)), RED);
    coloring.interrupt();
    stroke(coloring, [at(60, 150), at(120, 150)], GREEN);
    expect(coloring.colorAt(90, 150)).toBe(GREEN);
  });

  it('přerušení bez tahu ani opakované přerušení nic neshodí', () => {
    const { regions, coloring } = twoHalves();
    expect(() => {
      coloring.interrupt();
      coloring.interrupt();
    }).not.toThrow();
    expect(paintedCount(coloring, regions)).toBe(0);
  });

  it('přerušení ukončí i druhý prst, který čekal na obrázku', () => {
    const { regions, coloring } = twoHalves();
    coloring.pointerDown(pointer(1, at(20, 40)), RED);
    coloring.pointerDown(pointer(2, at(60, 120)), RED);
    coloring.interrupt();
    const afterInterrupt = snapshotOf(coloring, regions);
    coloring.pointerMove(pointer(2, at(60, 180)));
    coloring.pointerUp(2);
    coloring.pointerMove(pointer(1, at(100, 40)));
    coloring.pointerUp(1);
    expect(snapshotOf(coloring, regions)).toEqual(afterInterrupt);
  });
});

describe('#88 AC5: neočekávané pořadí dotyků nic neshodí', () => {
  it('pohyb a zvednutí prstu, který se obrázku nedotkl, nic nenamaluje ani neshodí', () => {
    const { regions, coloring } = twoHalves();
    expect(() => {
      coloring.pointerMove(pointer(4, at(40, 40)));
      coloring.pointerMove(pointer(4, at(80, 80)));
      coloring.pointerUp(4);
      coloring.pointerUp(99);
    }).not.toThrow();
    expect(paintedCount(coloring, regions)).toBe(0);
  });

  it('nečíselné souřadnice dotyku nic neshodí a nic nenamalují', () => {
    const { regions, coloring } = twoHalves();
    expect(() => {
      coloring.pointerDown({ id: 1, x: Number.NaN, y: 40, kind: 'touch' }, RED);
      coloring.pointerMove({ id: 1, x: 40, y: Number.POSITIVE_INFINITY, kind: 'touch' });
      coloring.pointerUp(1);
    }).not.toThrow();
    expect(paintedCount(coloring, regions)).toBe(0);
  });
});

describe('#88 AC5: tužka i prst barví stejně', () => {
  it('stejný tah tužkou a prstem dá stejný obrázek', () => {
    const path = [at(150.5, 30), at(40, 60), at(260, 120), at(30, 190)];
    const byFinger = twoHalves();
    const byPen = twoHalves();
    stroke(byFinger.coloring, path, RED, { kind: 'touch' });
    stroke(byPen.coloring, path, RED, { kind: 'pen' });

    expect(paintedCount(byPen.coloring, byPen.regions)).toBeGreaterThan(0);
    expect(snapshotOf(byPen.coloring, byPen.regions)).toEqual(
      snapshotOf(byFinger.coloring, byFinger.regions),
    );
  });

  it('tužka položená během tahu prstem nic nenamaluje (je to druhý dotyk)', () => {
    const { coloring } = twoHalves();
    coloring.pointerDown(pointer(1, at(40, 40), 'touch'), RED);
    coloring.pointerDown(pointer(2, at(100, 150), 'pen'), GREEN);
    coloring.pointerMove(pointer(2, at(100, 190), 'pen'));
    coloring.pointerUp(2);
    coloring.pointerUp(1);
    expect(coloring.colorAt(100, 170)).toBeNull();
  });
});
