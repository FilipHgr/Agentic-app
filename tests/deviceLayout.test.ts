import { describe, expect, it } from 'vitest';

import { chooseLayoutMode, gameAreaFor } from '../src/logic/deviceLayout';
import type { GameArea, Viewport } from '../src/logic/deviceLayout';
import { tabletCssLayouts } from './tabletSnapshot';
import {
  IPAD_WINDOWS,
  JUST_ABOVE_LIMIT,
  NO_NOTCH,
  PHONE_WINDOWS,
  SMALLEST_PHONE,
  TODAY_GAME_HEIGHT,
  TODAY_GAME_WIDTH,
  freeAreaOf,
  heightOf,
  isInside,
  todayFitPlacement,
  viewportOf,
  widthOf,
} from './viewportFixtures';
import type { TestWindow } from './viewportFixtures';

/**
 * Testy k #54: kdy se použije které rozložení (telefon na šířku, dnešní
 * iPad, dnešní zmenšené zobrazení) a kam a jak velká se herní plocha
 * v okně dá. AC5 přes novou volbu rozložení, AC6 okrajové případy okna
 * a AC7 okno na výšku. Rozměry jsou v CSS px.
 */

/** Tolerance na zaokrouhlení v CSS px. */
const CSS_TOLERANCE = 0.5;

function windowOf(name: string, width: number, height: number, safeArea = NO_NOTCH): TestWindow {
  return { name, width, height, safeArea };
}

/** Okna, která mají zůstat zmenšená jako dnes (na výšku, čtverec, menší než telefon). */
const SCALED_WINDOWS: readonly TestWindow[] = [
  windowOf('iPhone na výšku 390×844', 390, 844, { top: 47, right: 0, bottom: 34, left: 0 }),
  windowOf('iPad na výšku 820×1180', 820, 1180),
  windowOf('čtverec 400×400', 400, 400),
  windowOf('velký čtverec 820×820', 820, 820),
  windowOf('o 1 px užší než telefon 743×296', 743, 296),
  windowOf('o 1 px nižší než telefon 744×295', 744, 295),
  windowOf('malý telefon 667×375', 667, 375),
  windowOf('výřez ubere šířku pod 744 px (844×340, výřez 51 px)', 844, 340, {
    top: 0,
    right: 51,
    bottom: 21,
    left: 51,
  }),
  windowOf('lišta ubere výšku pod 296 px (800×316, lišta 21 px)', 800, 316, {
    top: 0,
    right: 0,
    bottom: 21,
    left: 0,
  }),
];

/** Nesmyslné údaje o okně, které může prohlížeč na chvíli poslat. */
const BROKEN_VIEWPORTS: ReadonlyArray<[string, Viewport | undefined]> = [
  ['chybějící údaj o okně', undefined],
  ['okno 0 × 0', { width: 0, height: 0, safeArea: NO_NOTCH }],
  ['šířka 0', { width: 0, height: 400, safeArea: NO_NOTCH }],
  ['výška 0', { width: 800, height: 0, safeArea: NO_NOTCH }],
  ['záporná velikost', { width: -800, height: -300, safeArea: NO_NOTCH }],
  ['NaN', { width: Number.NaN, height: Number.NaN, safeArea: NO_NOTCH }],
  ['nekonečno', { width: Number.POSITIVE_INFINITY, height: 300, safeArea: NO_NOTCH }],
  [
    'výřez větší než okno',
    { width: 800, height: 300, safeArea: { top: 0, right: 500, bottom: 0, left: 500 } },
  ],
  [
    'výřez s NaN',
    { width: 800, height: 300, safeArea: { top: Number.NaN, right: 0, bottom: 0, left: 0 } },
  ],
  ['chybí výřez', { width: 800, height: 300, safeArea: undefined } as unknown as Viewport],
];

function cssRectOf(area: GameArea): {
  left: number;
  right: number;
  top: number;
  bottom: number;
} {
  return {
    left: area.offsetX,
    right: area.offsetX + area.width * area.scale,
    top: area.offsetY,
    bottom: area.offsetY + area.height * area.scale,
  };
}

/** Dnešní zmenšené zobrazení: 1024 × 768 celé v okně, na střed, co největší. */
function expectTodayScaledView(area: GameArea, window: TestWindow): void {
  const today = todayFitPlacement(window.width, window.height);
  expect(area.width).toBe(TODAY_GAME_WIDTH);
  expect(area.height).toBe(TODAY_GAME_HEIGHT);
  expect(area.scale).toBeCloseTo(today.scale, 6);
  expect(area.offsetX).toBeCloseTo(today.offsetX, 3);
  expect(area.offsetY).toBeCloseTo(today.offsetY, 3);
}

describe('kdy se použije které rozložení', () => {
  it.each(PHONE_WINDOWS)('$name: telefon na šířku dostane telefonní rozložení', (window) => {
    expect(chooseLayoutMode(viewportOf(window))).toBe('phoneLandscape');
  });

  it.each(IPAD_WINDOWS)('$name: iPad na šířku dostane dnešní rozložení', (window) => {
    expect(chooseLayoutMode(viewportOf(window))).toBe('tablet');
  });

  it.each(SCALED_WINDOWS)('$name: hra je zmenšená jako dnes', (window) => {
    expect(chooseLayoutMode(viewportOf(window))).toBe('scaled');
  });

  it('nejmenší telefon 744×296 bez rezervy ještě dostane telefonní rozložení', () => {
    expect(chooseLayoutMode(viewportOf(SMALLEST_PHONE))).toBe('phoneLandscape');
  });

  it('čtvercové okno se bere jako okno na výšku, i když je vysoké přes 500 px', () => {
    expect(chooseLayoutMode(viewportOf(windowOf('čtverec', 600, 600)))).toBe('scaled');
    expect(chooseLayoutMode(viewportOf(windowOf('čtverec', 300, 300)))).toBe('scaled');
  });

  it('o rozložení iPadu rozhoduje výška celého okna, ne volné plochy', () => {
    const ipadWithBar = windowOf('1180×520 s lištou 30 px', 1180, 520, {
      top: 0,
      right: 0,
      bottom: 30,
      left: 0,
    });
    expect(chooseLayoutMode(viewportOf(ipadWithBar))).toBe('tablet');
  });
});

describe('herní plocha na telefonu na šířku', () => {
  it.each(PHONE_WINDOWS)('$name: herní plocha vyplní celou volnou plochu', (window) => {
    const area = gameAreaFor(viewportOf(window));
    const free = freeAreaOf(window);
    const placed = cssRectOf(area);

    expect(area.mode).toBe('phoneLandscape');
    expect(isInside(placed, free, CSS_TOLERANCE)).toBe(true);
    expect(widthOf(placed)).toBeGreaterThanOrEqual(widthOf(free) - CSS_TOLERANCE);
    expect(heightOf(placed)).toBeGreaterThanOrEqual(heightOf(free) - CSS_TOLERANCE);
  });

  it.each(PHONE_WINDOWS)(
    '$name: herní plocha má stejný poměr stran jako volná plocha',
    (window) => {
      const area = gameAreaFor(viewportOf(window));
      const free = freeAreaOf(window);

      expect(area.width / area.height).toBeCloseTo(widthOf(free) / heightOf(free), 2);
    },
  );
});

describe('AC5: iPad dostane přesně dnešní rozložení', () => {
  it.each(IPAD_WINDOWS)('$name: herní plocha je dnešní 1024 × 768 na středu okna', (window) => {
    const area = gameAreaFor(viewportOf(window));

    expect(area.mode).toBe('tablet');
    expectTodayScaledView(area, window);
  });

  it.each(IPAD_WINDOWS)(
    '$name: všechny prvky jsou na iPadu na stejném místě a stejně velké jako dnes',
    (window) => {
      const area = gameAreaFor(viewportOf(window));
      const today = todayFitPlacement(window.width, window.height);

      expect(tabletCssLayouts(area.width, area.height, area)).toEqual(
        tabletCssLayouts(TODAY_GAME_WIDTH, TODAY_GAME_HEIGHT, today),
      );
    },
  );
});

describe('AC6: okrajové případy velikosti okna', () => {
  it.each(SCALED_WINDOWS)('$name: hra se zobrazí celá a zmenšená jako dnes', (window) => {
    const area = gameAreaFor(viewportOf(window));

    expect(area.mode).toBe('scaled');
    expectTodayScaledView(area, window);
    expect(
      isInside(cssRectOf(area), { left: 0, right: window.width, top: 0, bottom: window.height }),
    ).toBe(true);
  });

  it.each(BROKEN_VIEWPORTS)('%s: hra nespadne a zobrazí se zmenšená jako dnes', (_, viewport) => {
    expect(() => chooseLayoutMode(viewport)).not.toThrow();
    expect(() => gameAreaFor(viewport)).not.toThrow();

    const area = gameAreaFor(viewport);
    expect(chooseLayoutMode(viewport)).toBe('scaled');
    expect(area.mode).toBe('scaled');
    expect(area.width).toBe(TODAY_GAME_WIDTH);
    expect(area.height).toBe(TODAY_GAME_HEIGHT);
    for (const value of [area.scale, area.offsetX, area.offsetY]) {
      expect(Number.isFinite(value)).toBe(true);
    }
    expect(area.scale).toBeGreaterThanOrEqual(0);
  });

  it('okno 932×499 těsně pod hranicí dostane telefonní rozložení', () => {
    expect(chooseLayoutMode(viewportOf(windowOf('932×499', 932, 499)))).toBe('phoneLandscape');
  });

  it('okno 932×500 těsně nad hranicí dostane dnešní rozložení iPadu', () => {
    const area = gameAreaFor(viewportOf(JUST_ABOVE_LIMIT));

    expect(chooseLayoutMode(viewportOf(JUST_ABOVE_LIMIT))).toBe('tablet');
    expectTodayScaledView(area, JUST_ABOVE_LIMIT);
  });

  it('stejné okno dostane pokaždé stejné rozložení', () => {
    for (const window of [...PHONE_WINDOWS, ...IPAD_WINDOWS, ...SCALED_WINDOWS]) {
      expect(gameAreaFor(viewportOf(window))).toEqual(gameAreaFor(viewportOf(window)));
    }
  });
});

describe('AC7: otočení telefonu', () => {
  it('po otočení telefonu na výšku zůstane dnešní zmenšené zobrazení a hra je celá vidět', () => {
    const landscape = windowOf('iPhone na šířku', 844, 390, {
      top: 0,
      right: 47,
      bottom: 21,
      left: 47,
    });
    const portrait = windowOf('iPhone na výšku', 390, 844, {
      top: 47,
      right: 0,
      bottom: 34,
      left: 0,
    });

    expect(gameAreaFor(viewportOf(landscape)).mode).toBe('phoneLandscape');
    const area = gameAreaFor(viewportOf(portrait));
    expect(area.mode).toBe('scaled');
    expectTodayScaledView(area, portrait);
  });

  it('po otočení tam a zpátky má herní plocha stejnou velikost jako předtím', () => {
    const window = PHONE_WINDOWS[2] ?? SMALLEST_PHONE;
    const before = gameAreaFor(viewportOf(window));
    gameAreaFor({ width: window.height, height: window.width, safeArea: NO_NOTCH });

    expect(gameAreaFor(viewportOf(window))).toEqual(before);
  });

  it('když se ukáže lišta prohlížeče a okno se zmenší, herní plocha se přepočítá podle nového okna', () => {
    const withoutBar = windowOf('bez lišty', 844, 390, { top: 0, right: 47, bottom: 21, left: 47 });
    const withBar = windowOf('s lištou', 844, 340, { top: 0, right: 47, bottom: 21, left: 47 });

    const tall = cssRectOf(gameAreaFor(viewportOf(withoutBar)));
    const short = cssRectOf(gameAreaFor(viewportOf(withBar)));

    expect(heightOf(tall)).toBeGreaterThan(heightOf(short));
    expect(isInside(short, freeAreaOf(withBar), CSS_TOLERANCE)).toBe(true);
  });
});
