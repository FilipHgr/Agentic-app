import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  CANVAS_PIXELS_PER_CSS_PX,
  canvasResolutionFor,
  canvasToGamePoint,
  windowToGamePoint,
} from '../../src/shared/logic/canvasResolution';
import type { CanvasResolution } from '../../src/shared/logic/canvasResolution';
import { gameAreaFor, PHONE_UNITS_PER_CSS_PX } from '../../src/shared/logic/viewportLayout';
import type { GameArea, Viewport } from '../../src/shared/logic/viewportLayout';
import {
  IPAD_WINDOWS,
  JUST_ABOVE_LIMIT,
  NO_NOTCH,
  PHONE_PORTRAIT_EDGE_WINDOWS,
  PHONE_PORTRAIT_WINDOWS,
  PHONE_WINDOWS,
  TODAY_GAME_HEIGHT,
  TODAY_GAME_WIDTH,
  isInside,
  todayFitPlacement,
  viewportOf,
} from './viewportFixtures';
import type { Box, TestWindow } from './viewportFixtures';

/**
 * Testy k #77 (ostrá hra na iPadu a ve zmenšeném zobrazení), sdílená část:
 * jak velké je plátno v obrazových bodech, kde a jak velké se v okně
 * zobrazí a kam padne dotyk v herních jednotkách.
 *
 * Herní plocha (`gameAreaFor`) se nemění: iPad a zmenšené zobrazení mají
 * dál 1024 × 768 herních jednotek na stejném místě okna. Mění se jen
 * rozlišení plátna: 2 obrazové body na každý zobrazený CSS px, stejně jako
 * telefon a menu. Kamera hry pak herní jednotky zvětší na obrazové body.
 *
 * AC2 (stejné polohy prvků), AC3 (ťuknutí na kraj tlačítka) a AC4 (psaní)
 * pro prvky Počítání jsou v `tests/games/counting/sharpCanvas.test.ts`.
 */

/** Tolerance na zaokrouhlení plátna na celé obrazové body, v CSS px. */
const CSS_TOLERANCE = 0.5;

function windowOf(name: string, width: number, height: number): TestWindow {
  return { name, width, height, safeArea: NO_NOTCH };
}

/** Okna s dnešní plochou 1024 × 768: iPad a počítač (režim `tablet`). */
const TABLET_WINDOWS: readonly TestWindow[] = [
  ...IPAD_WINDOWS,
  JUST_ABOVE_LIMIT,
  windowOf('iPad Pro 1366×1024', 1366, 1024),
  windowOf('počítač 1920×1080', 1920, 1080),
  windowOf('okno přesně 1024×768', 1024, 768),
];

/** Zmenšené zobrazení: iPad na výšku, Split View a okna menší než 1024 × 768 (AC6). */
const SMALL_WINDOWS: readonly TestWindow[] = [
  windowOf('iPad na výšku 820×1180', 820, 1180),
  windowOf('iPad ve Split View na výšku 507×1180', 507, 1180),
  windowOf('iPad ve Split View na půl 678×820', 678, 820),
  windowOf('malé okno počítače 800×600', 800, 600),
  windowOf('okno o 1 px menší 1023×767', 1023, 767),
  windowOf('nízké okno 667×320', 667, 320),
  windowOf('iPhone SE s lištami 375×553', 375, 553),
  windowOf('čtverec 400×400', 400, 400),
  windowOf('liché rozměry 999×701', 999, 701),
];

const SHARP_WINDOWS: readonly TestWindow[] = [...TABLET_WINDOWS, ...SMALL_WINDOWS];

const PHONE_ALL_WINDOWS: readonly TestWindow[] = [
  ...PHONE_WINDOWS,
  ...PHONE_PORTRAIT_WINDOWS,
  ...PHONE_PORTRAIT_EDGE_WINDOWS,
];

/** Nesmyslné údaje o okně, které může prohlížeč na chvíli poslat. */
const BROKEN_VIEWPORTS: ReadonlyArray<[string, Viewport | undefined]> = [
  ['chybějící údaj o okně', undefined],
  ['okno 0 × 0', { width: 0, height: 0, safeArea: NO_NOTCH }],
  ['záporná velikost', { width: -800, height: -300, safeArea: NO_NOTCH }],
  ['NaN', { width: Number.NaN, height: Number.NaN, safeArea: NO_NOTCH }],
  ['nekonečno', { width: Number.POSITIVE_INFINITY, height: 300, safeArea: NO_NOTCH }],
];

function resolutionOf(window: TestWindow): CanvasResolution {
  return canvasResolutionFor(gameAreaFor(viewportOf(window)));
}

/** Kde je plátno v okně, v CSS px. */
function canvasBoxOf(resolution: CanvasResolution): Box {
  return {
    left: resolution.offsetX,
    right: resolution.offsetX + resolution.cssWidth,
    top: resolution.offsetY,
    bottom: resolution.offsetY + resolution.cssHeight,
  };
}

/** Kde je herní plocha v okně dnes (Phaser Scale.FIT), v CSS px. */
function todayBoxOf(area: GameArea): Box {
  return {
    left: area.offsetX,
    right: area.offsetX + area.width * area.scale,
    top: area.offsetY,
    bottom: area.offsetY + area.height * area.scale,
  };
}

/** Bod herní plochy (v jednotkách) tak, jak ho dnes dítě vidí v okně (CSS px). */
function todayCssPointOf(area: GameArea, x: number, y: number): { x: number; y: number } {
  return { x: area.offsetX + x * area.scale, y: area.offsetY + y * area.scale };
}

function expectFinitePositive(value: number): void {
  expect(Number.isFinite(value)).toBe(true);
  expect(value).toBeGreaterThan(0);
}

describe('AC1: na iPadu a ve zmenšeném zobrazení má plátno 2 obrazové body na CSS px', () => {
  it('hra se kreslí ve 2 obrazových bodech na CSS px jako telefon', () => {
    expect(CANVAS_PIXELS_PER_CSS_PX).toBe(2);
    expect(CANVAS_PIXELS_PER_CSS_PX).toBe(PHONE_UNITS_PER_CSS_PX);
  });

  it('plátno má přesně 2 obrazové body na zobrazený CSS px', () => {
    for (const window of SHARP_WINDOWS) {
      const resolution = resolutionOf(window);

      expect(Number.isInteger(resolution.pixelWidth), window.name).toBe(true);
      expect(Number.isInteger(resolution.pixelHeight), window.name).toBe(true);
      expect(resolution.pixelWidth, window.name).toBe(
        resolution.cssWidth * CANVAS_PIXELS_PER_CSS_PX,
      );
      expect(resolution.pixelHeight, window.name).toBe(
        resolution.cssHeight * CANVAS_PIXELS_PER_CSS_PX,
      );
    }
  });

  it('plátno má dvojnásobek obrazových bodů co dnes', () => {
    for (const window of TABLET_WINDOWS) {
      const area = gameAreaFor(viewportOf(window));
      const resolution = canvasResolutionFor(area);

      // Dnes má plátno 1024 × 768 obrazových bodů, ať je zobrazené jakkoli velké.
      expect(resolution.pixelWidth, window.name).toBeGreaterThan(TODAY_GAME_WIDTH);
      expect(resolution.pixelHeight, window.name).toBeGreaterThan(TODAY_GAME_HEIGHT);
    }
  });

  it('hra je v okně stejně velká a na stejném místě jako dnes', () => {
    for (const window of SHARP_WINDOWS) {
      const area = gameAreaFor(viewportOf(window));
      const today = todayBoxOf(area);
      const placed = canvasBoxOf(canvasResolutionFor(area));

      expect(Math.abs(placed.left - today.left), window.name).toBeLessThanOrEqual(CSS_TOLERANCE);
      expect(Math.abs(placed.right - today.right), window.name).toBeLessThanOrEqual(CSS_TOLERANCE);
      expect(Math.abs(placed.top - today.top), window.name).toBeLessThanOrEqual(CSS_TOLERANCE);
      expect(Math.abs(placed.bottom - today.bottom), window.name).toBeLessThanOrEqual(
        CSS_TOLERANCE,
      );
    }
  });

  it('herní plocha zůstává 1024 × 768 herních jednotek', () => {
    for (const window of SHARP_WINDOWS) {
      const area = gameAreaFor(viewportOf(window));
      const today = todayFitPlacement(window.width, window.height);

      expect(area.width, window.name).toBe(TODAY_GAME_WIDTH);
      expect(area.height, window.name).toBe(TODAY_GAME_HEIGHT);
      expect(area.scale, window.name).toBeCloseTo(today.scale, 6);
    }
  });

  it('celá herní plocha je vidět na plátně, nic se neořízne', () => {
    for (const window of SHARP_WINDOWS) {
      const resolution = resolutionOf(window);
      const pixelTolerance = 1;

      expect(TODAY_GAME_WIDTH * resolution.zoom, window.name).toBeLessThanOrEqual(
        resolution.pixelWidth + pixelTolerance,
      );
      expect(TODAY_GAME_HEIGHT * resolution.zoom, window.name).toBeLessThanOrEqual(
        resolution.pixelHeight + pixelTolerance,
      );
      expect(TODAY_GAME_WIDTH * resolution.zoom, window.name).toBeGreaterThanOrEqual(
        resolution.pixelWidth - pixelTolerance,
      );
    }
  });

  it('kamera zvětší herní jednotky na 2 obrazové body na CSS px', () => {
    for (const window of SHARP_WINDOWS) {
      const area = gameAreaFor(viewportOf(window));
      const resolution = canvasResolutionFor(area);

      // Jednotka je dnes vidět jako `scale` CSS px, nově jako `zoom` obrazových bodů.
      expect(resolution.zoom / CANVAS_PIXELS_PER_CSS_PX, window.name).toBeCloseTo(area.scale, 2);
    }
  });
});

describe('AC3: ťuknutí v okně padne na stejné místo hry jako dnes', () => {
  /** Body herní plochy: rohy, středy hran, střed a pár bodů uvnitř. */
  const GAME_POINTS: ReadonlyArray<[number, number]> = [
    [0, 0],
    [TODAY_GAME_WIDTH, 0],
    [0, TODAY_GAME_HEIGHT],
    [TODAY_GAME_WIDTH, TODAY_GAME_HEIGHT],
    [TODAY_GAME_WIDTH / 2, TODAY_GAME_HEIGHT / 2],
    [TODAY_GAME_WIDTH / 2, 0],
    [0, TODAY_GAME_HEIGHT / 2],
    [137, 641],
    [903.5, 88.25],
  ];

  it('dotyk v okně dá stejné herní souřadnice jako dnes', () => {
    for (const window of SHARP_WINDOWS) {
      const area = gameAreaFor(viewportOf(window));
      const resolution = canvasResolutionFor(area);
      // Odchylka nejvýš o půl CSS px, přepočtená na herní jednotky.
      const unitTolerance = CSS_TOLERANCE / area.scale;

      for (const [x, y] of GAME_POINTS) {
        const touched = windowToGamePoint(resolution, todayCssPointOf(area, x, y));
        expect(Math.abs(touched.x - x), window.name).toBeLessThanOrEqual(unitTolerance);
        expect(Math.abs(touched.y - y), window.name).toBeLessThanOrEqual(unitTolerance);
      }
    }
  });

  it('levý horní a pravý dolní roh plátna jsou rohy herní plochy', () => {
    for (const window of SHARP_WINDOWS) {
      const resolution = resolutionOf(window);
      const topLeft = canvasToGamePoint(resolution, { x: 0, y: 0 });
      const bottomRight = canvasToGamePoint(resolution, {
        x: resolution.pixelWidth,
        y: resolution.pixelHeight,
      });
      const unitTolerance = 1;

      expect(topLeft.x, window.name).toBeCloseTo(0, 6);
      expect(topLeft.y, window.name).toBeCloseTo(0, 6);
      expect(Math.abs(bottomRight.x - TODAY_GAME_WIDTH), window.name).toBeLessThanOrEqual(
        unitTolerance,
      );
      expect(Math.abs(bottomRight.y - TODAY_GAME_HEIGHT), window.name).toBeLessThanOrEqual(
        unitTolerance,
      );
    }
  });

  it('dotyk v okně a stejný bod na plátně dají stejné herní souřadnice', () => {
    for (const window of SHARP_WINDOWS) {
      const resolution = resolutionOf(window);
      const cssPoint = {
        x: resolution.offsetX + resolution.cssWidth * 0.3,
        y: resolution.offsetY + resolution.cssHeight * 0.7,
      };
      const canvasPoint = {
        x: (cssPoint.x - resolution.offsetX) * CANVAS_PIXELS_PER_CSS_PX,
        y: (cssPoint.y - resolution.offsetY) * CANVAS_PIXELS_PER_CSS_PX,
      };

      const fromWindow = windowToGamePoint(resolution, cssPoint);
      const fromCanvas = canvasToGamePoint(resolution, canvasPoint);
      expect(fromWindow.x, window.name).toBeCloseTo(fromCanvas.x, 6);
      expect(fromWindow.y, window.name).toBeCloseTo(fromCanvas.y, 6);
    }
  });
});

describe('AC5: pevně 2× bez ohledu na hustotu displeje, telefon beze změny', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const DENSITIES: ReadonlyArray<[string, unknown]> = [
    ['displej 1×', 1],
    ['Retina 2×', 2],
    ['iPhone 3×', 3],
    ['neznámá hustota (chybí)', undefined],
    ['nesmyslná hustota NaN', Number.NaN],
    ['nulová hustota', 0],
  ];

  it('plátno má stejné rozlišení jako vždy', () => {
    for (const [densityName, density] of DENSITIES) {
      const windows = [...SHARP_WINDOWS, ...PHONE_ALL_WINDOWS];
      const expected = windows.map((window) => resolutionOf(window));

      vi.stubGlobal('devicePixelRatio', density);
      expect(() => windows.map((window) => resolutionOf(window)), densityName).not.toThrow();
      expect(
        windows.map((window) => resolutionOf(window)),
        densityName,
      ).toEqual(expected);
    }
  });

  it('telefon má plátno přesně jako dnes', () => {
    for (const window of PHONE_ALL_WINDOWS) {
      const area = gameAreaFor(viewportOf(window));
      const resolution = canvasResolutionFor(area);

      // Dnes: plátno má velikost herní plochy a jednotka je půl CSS px.
      expect(resolution.pixelWidth, window.name).toBe(area.width);
      expect(resolution.pixelHeight, window.name).toBe(area.height);
      expect(resolution.zoom, window.name).toBe(1);
      expect(resolution.cssWidth, window.name).toBeCloseTo(area.width * area.scale, 6);
      expect(resolution.cssHeight, window.name).toBeCloseTo(area.height * area.scale, 6);
      expect(resolution.offsetX, window.name).toBe(area.offsetX);
      expect(resolution.offsetY, window.name).toBe(area.offsetY);
    }
  });

  it('ťuknutí na telefonu padne přesně tam, kam dnes', () => {
    for (const window of PHONE_ALL_WINDOWS) {
      const area = gameAreaFor(viewportOf(window));
      const resolution = canvasResolutionFor(area);

      for (const [x, y] of [
        [0, 0],
        [area.width / 2, area.height / 2],
        [area.width, area.height],
        [41, 517],
      ] as const) {
        const touched = windowToGamePoint(resolution, todayCssPointOf(area, x, y));
        expect(touched.x, window.name).toBeCloseTo(x, 6);
        expect(touched.y, window.name).toBeCloseTo(y, 6);
      }
    }
  });

  it('hra nespadne a plátno má použitelnou velikost', () => {
    for (const [viewportName, viewport] of BROKEN_VIEWPORTS) {
      const area = gameAreaFor(viewport);

      expect(() => canvasResolutionFor(area), viewportName).not.toThrow();
      const resolution = canvasResolutionFor(area);
      expect(Number.isInteger(resolution.pixelWidth), viewportName).toBe(true);
      expect(Number.isInteger(resolution.pixelHeight), viewportName).toBe(true);
      expect(resolution.pixelWidth, viewportName).toBeGreaterThanOrEqual(1);
      expect(resolution.pixelHeight, viewportName).toBeGreaterThanOrEqual(1);
      expectFinitePositive(resolution.zoom);
      for (const value of [
        resolution.cssWidth,
        resolution.cssHeight,
        resolution.offsetX,
        resolution.offsetY,
      ]) {
        expect(Number.isFinite(value), viewportName).toBe(true);
      }

      const touched = windowToGamePoint(resolution, { x: 10, y: 10 });
      expect(Number.isFinite(touched.x), viewportName).toBe(true);
      expect(Number.isFinite(touched.y), viewportName).toBe(true);
    }
  });
});

describe('AC6: v okně menším než 1024 × 768 se celá hra vejde a je ostrá', () => {
  it('plátno nevyčnívá z okna', () => {
    for (const window of SMALL_WINDOWS) {
      const placed = canvasBoxOf(resolutionOf(window));
      const wholeWindow: Box = { left: 0, right: window.width, top: 0, bottom: window.height };

      expect(isInside(placed, wholeWindow), window.name).toBe(true);
    }
  });

  it('plátno je na středu okna jako dnes', () => {
    for (const window of SMALL_WINDOWS) {
      const placed = canvasBoxOf(resolutionOf(window));
      const leftGap = placed.left;
      const rightGap = window.width - placed.right;
      const topGap = placed.top;
      const bottomGap = window.height - placed.bottom;

      expect(Math.abs(leftGap - rightGap), window.name).toBeLessThanOrEqual(2 * CSS_TOLERANCE);
      expect(Math.abs(topGap - bottomGap), window.name).toBeLessThanOrEqual(2 * CSS_TOLERANCE);
    }
  });

  it('plátno má víc obrazových bodů než dnes, ale nejvýš tolik co okno ve 2×', () => {
    for (const window of SMALL_WINDOWS) {
      const area = gameAreaFor(viewportOf(window));
      const resolution = canvasResolutionFor(area);

      expect(resolution.pixelWidth, window.name).toBeLessThanOrEqual(
        window.width * CANVAS_PIXELS_PER_CSS_PX,
      );
      expect(resolution.pixelHeight, window.name).toBeLessThanOrEqual(
        window.height * CANVAS_PIXELS_PER_CSS_PX,
      );
      // Dnes se 1024 × 768 zmenší na `scale`, tedy 1 obrazový bod na CSS px.
      expect(resolution.pixelWidth, window.name).toBeGreaterThanOrEqual(
        Math.floor(TODAY_GAME_WIDTH * area.scale * CANVAS_PIXELS_PER_CSS_PX) - 1,
      );
    }
  });

  it('plátno nevyčnívá z okna ani na iPadu a počítači', () => {
    for (const window of TABLET_WINDOWS) {
      const placed = canvasBoxOf(resolutionOf(window));
      const wholeWindow: Box = { left: 0, right: window.width, top: 0, bottom: window.height };

      expect(isInside(placed, wholeWindow), window.name).toBe(true);
    }
  });
});

describe('AC7: po otočení a změně lišty je hra dál ostrá podle nového okna', () => {
  const ipad = windowOf('iPad na šířku 1180×820', 1180, 820);
  const ipadPortrait = windowOf('iPad na výšku 820×1180', 820, 1180);
  const ipadWithBar = windowOf('iPad s lištou 1180×760', 1180, 760);

  it('po otočení iPadu na výšku odpovídá plátno novému oknu a má 2 body na CSS px', () => {
    const before = resolutionOf(ipad);
    const after = resolutionOf(ipadPortrait);
    const area = gameAreaFor(viewportOf(ipadPortrait));

    expect(after).not.toEqual(before);
    expect(after.pixelWidth).toBe(after.cssWidth * CANVAS_PIXELS_PER_CSS_PX);
    expect(Math.abs(after.cssWidth - TODAY_GAME_WIDTH * area.scale)).toBeLessThanOrEqual(
      CSS_TOLERANCE,
    );
    expect(isInside(canvasBoxOf(after), { left: 0, right: 820, top: 0, bottom: 1180 })).toBe(true);
  });

  it('když se ukáže lišta prohlížeče, plátno se zmenší podle okna a zůstane ve 2×', () => {
    const tall = resolutionOf(ipad);
    const short = resolutionOf(ipadWithBar);

    expect(short.cssHeight).toBeLessThan(tall.cssHeight);
    expect(short.pixelHeight).toBe(short.cssHeight * CANVAS_PIXELS_PER_CSS_PX);
    expect(isInside(canvasBoxOf(short), { left: 0, right: 1180, top: 0, bottom: 760 })).toBe(true);
  });

  it('po otočení tam a zpátky je plátno stejné jako před otočením', () => {
    const before = resolutionOf(ipad);
    resolutionOf(ipadPortrait);

    expect(resolutionOf(ipad)).toEqual(before);
  });

  it('po otočení z iPadu na telefonní rozložení má plátno rozlišení jako telefon dnes', () => {
    const phone = PHONE_PORTRAIT_WINDOWS[0];
    if (!phone) {
      throw new Error('chybí zkušební okno telefonu');
    }
    resolutionOf(ipad);
    const area = gameAreaFor(viewportOf(phone));
    const resolution = canvasResolutionFor(area);

    expect(resolution.pixelWidth).toBe(area.width);
    expect(resolution.zoom).toBe(1);
  });
});

describe('AC8: po návratu z menu je hra stejně ostrá a stejně rozložená', () => {
  it('nové spuštění ve stejném okně dá stejné plátno', () => {
    for (const window of SHARP_WINDOWS) {
      const first = resolutionOf(window);
      // Mezitím hra běžela v jiných oknech (menu, otočení), nic si nepamatuje.
      for (const other of [...PHONE_ALL_WINDOWS, ...TABLET_WINDOWS]) {
        resolutionOf(other);
      }

      expect(resolutionOf(window), window.name).toEqual(first);
      expect(gameAreaFor(viewportOf(window)), window.name).toEqual(gameAreaFor(viewportOf(window)));
    }
  });
});
