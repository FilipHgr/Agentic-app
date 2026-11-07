import { describe, expect, it } from 'vitest';

import { GAMES } from '../../src/gameList';
import { menuLayoutFor } from '../../src/menu/logic/menuLayout';
import type { MenuBox, MenuLayout } from '../../src/menu/logic/menuLayout';
import {
  freeAreaOf,
  gapBetween,
  heightOf,
  isInside,
  overlaps,
  viewportOf,
  widthOf,
} from '../shared/viewportFixtures';
import type { TestWindow } from '../shared/viewportFixtures';
import { MIN_EDGE_DISTANCE } from '../shared/layoutRules';
import {
  MANY_GAMES_COUNT,
  MANY_MENU_CATEGORY_TITLES,
  MENU_WINDOWS,
  findWindow,
  manyGamesLayout,
} from './manyGamesFixtures';
import {
  describeLayoutRules,
  scrollScenes,
  unseenElements,
  shiftCategory,
  shiftY,
  todayCategoryTitles,
  todayLayout,
  visiblePart,
} from './menuLayoutScenes';

/**
 * Testy k #69 (posouvání mřížky a kategorií prstem), část rozložení:
 * zkušební menu se 40 hrami a 12 kategoriemi (jen v testech) ve všech
 * zkušebních oknech.
 *
 * Navržené rozhraní (`src/menu/logic/menuLayout.ts`):
 * - `MenuContent.allTileCount`: počet her ve „Vše“; podle něj se volí
 *   výška dlaždic, aby se při přepínání kategorií neměnila,
 * - `layout.gridScroll` a `layout.categoryScroll`: viditelná plocha
 *   (`viewport`, obsah mimo ni se ořízne) a největší posun (`maxOffset`,
 *   0 = nic se neposouvá). Polohy dlaždic a kategorií v rozložení jsou bez
 *   posunu; mřížka se posouvá svisle, kategorie v řadě vodorovně a ve
 *   sloupci svisle.
 *
 * Společná pravidla pro viditelnou část každé dlaždice a kategorie při
 * každém zkoušeném posunu hlídá `describeLayoutRules` (#82). Tady
 * zůstávají kontroly podle schválených obrázků, každá v cyklu přes okna.
 */

const ROUNDING = 1e-6;
/** Z další skryté kategorie je vidět aspoň tolik (AC4). */
const CATEGORY_PEEK = 24;
/** Na konci posouvání nezůstane větší prázdné místo, než je okraj mřížky. */
const MAX_END_SPACE = 24;
/** Rezerva kolem dlaždice v ořezu kamery (pulzování o 5 % a stín). */
const CLIP_RESERVE = 8;

/**
 * Kolik různých kombinací (okno × stav) pravidlo na posouvání hlídalo
 * před #82, spočítáno jednorázově z testů před #82. Stav je počet her
 * a zkoušený posun: 64 px, 8 px, text a viditelná plocha jen ve 40 hrách
 * bez posunu (17 oken), překryv v 17 oknech se 4 posuny mřížky a ve 16
 * oknech, kde se kategorie posouvají, se 2 dalšími posuny kategorií.
 */
const TODAY_COMBINATIONS: Readonly<Record<string, number>> = {
  'vejde se do okna i mimo výřez': 17,
  'nic se nepřekrývá': 100,
  'ťukací plocha aspoň 64 px': 17,
  'mezera mezi plochami aspoň 8 px': 17,
  'aspoň 4 px od okraje': 17,
  'text se vejde do své plochy': 17,
};

describeLayoutRules(
  'posouvání mřížky a kategorií (40 her, 13 kategorií)',
  scrollScenes,
  TODAY_COMBINATIONS,
);

function insetBox(outer: MenuBox, margin: number): MenuBox {
  return {
    left: outer.left + margin,
    right: outer.right - margin,
    top: outer.top + margin,
    bottom: outer.bottom - margin,
  };
}

function barBoxes(layout: MenuLayout): MenuBox[] {
  return [layout.profileSlot, layout.languageSlot, ...layout.placeholders];
}

function lastOf<T>(items: readonly T[], window: TestWindow): T {
  const last = items[items.length - 1];
  if (last === undefined) {
    throw new Error(`${window.name}: seznam je prázdný`);
  }
  return last;
}

/** Kategorie ve zkušebním menu: směr, konec plochy a konec viditelné plochy. */
function categoryAxis(layout: MenuLayout): {
  end: (box: MenuBox) => number;
  viewportEnd: number;
  overflowing: boolean;
} {
  const viewport = layout.categoryScroll.viewport;
  const isRow = layout.categoryDirection === 'row';
  const end = (box: MenuBox): number => (isRow ? box.right : box.bottom);
  const viewportEnd = isRow ? viewport.right : viewport.bottom;
  const overflowing = layout.categories.some(
    (category) => end(category.hit) > viewportEnd + ROUNDING,
  );
  return { end, viewportEnd, overflowing };
}

/** Okna, ve kterých se 13 kategorií nevejde. */
function overflowingWindows(): TestWindow[] {
  return MENU_WINDOWS.filter((window) => categoryAxis(manyGamesLayout(window)).overflowing);
}

describe('#82 AC1: posouvání ukáže každou dlaždici a kategorii', () => {
  it('každá dlaždice a kategorie je změřená v každém případu a aspoň v jednom je celá vidět', () => {
    const scenes = scrollScenes();
    const names = [
      ...Array.from({ length: MANY_GAMES_COUNT }, (_, index) => `dlaždice ${index + 1}`),
      ...MANY_MENU_CATEGORY_TITLES.map((title) => `kategorie ${title}`),
    ];
    for (const window of MENU_WINDOWS) {
      const prefix = `posouvání, ${window.name}, ${MANY_GAMES_COUNT} her`;
      const own = scenes.filter((scene) => scene.label.startsWith(prefix));
      expect(own.length, window.name).toBeGreaterThan(0);
      expect(unseenElements(own, names), window.name).toEqual([]);
    }
  });
});

describe('#69 AC1: dnes (jedna hra) se nic neposouvá a menu vypadá stejně', () => {
  it('mřížka ani kategorie nemají kam posunout a dnešní dlaždice i kategorie jsou celé vidět', () => {
    for (const window of MENU_WINDOWS) {
      const layout = todayLayout(window);
      expect(layout.gridScroll.maxOffset, window.name).toBe(0);
      expect(layout.categoryScroll.maxOffset, window.name).toBe(0);
      for (const tile of layout.tiles) {
        expect(isInside(tile, layout.gridScroll.viewport), window.name).toBe(true);
      }
      for (const category of layout.categories) {
        expect(isInside(category.hit, layout.categoryScroll.viewport), window.name).toBe(true);
      }
    }
  });

  it('počet her v „Vše“ navíc dnešní rozložení nezmění', () => {
    for (const window of MENU_WINDOWS) {
      const withAll = menuLayoutFor(viewportOf(window), {
        categoryTitles: todayCategoryTitles(),
        tileCount: GAMES.length,
        allTileCount: GAMES.length,
      });
      expect(withAll, window.name).toEqual(todayLayout(window));
    }
  });
});

describe('#69 AC1: mřížka se 40 hrami se posouvá svisle a je poznat, že je toho víc', () => {
  it(`ve „Vše“ je ${MANY_GAMES_COUNT} dlaždic, mřížka jde posunout, na začátku je první celá vidět a poslední jde posunout celá do viditelné plochy`, () => {
    for (const window of MENU_WINDOWS) {
      const layout = manyGamesLayout(window);
      const { viewport, maxOffset } = layout.gridScroll;
      expect(layout.tiles, window.name).toHaveLength(MANY_GAMES_COUNT);
      expect(maxOffset, window.name).toBeGreaterThan(0);
      expect(isInside(layout.tiles[0] ?? { ...viewport, top: -1 }, viewport), window.name).toBe(
        true,
      );
      expect(isInside(shiftY(lastOf(layout.tiles, window), maxOffset), viewport), window.name).toBe(
        true,
      );
    }
  });

  it('z první skryté řady je vidět 20–60 % výšky dlaždice', () => {
    for (const window of MENU_WINDOWS) {
      const layout = manyGamesLayout(window);
      const viewport = layout.gridScroll.viewport;
      const firstHidden = layout.tiles.find((tile) => tile.bottom > viewport.bottom + ROUNDING);
      expect(firstHidden, window.name).toBeDefined();
      const tile = firstHidden ?? viewport;
      const visible = (viewport.bottom - tile.top) / heightOf(tile);
      expect(visible, window.name).toBeGreaterThanOrEqual(0.2);
      expect(visible, window.name).toBeLessThanOrEqual(0.6);
    }
  });

  it('na konci se mřížka zastaví bez prázdného místa pod poslední řadou', () => {
    for (const window of MENU_WINDOWS) {
      const layout = manyGamesLayout(window);
      const { viewport, maxOffset } = layout.gridScroll;
      const last = shiftY(lastOf(layout.tiles, window), maxOffset);
      expect(viewport.bottom - last.bottom, window.name).toBeLessThanOrEqual(MAX_END_SPACE);
    }
  });

  it('v kategorii s méně hrami mají dlaždice stejnou velikost jako ve „Vše“ a kategorie, jejíž hry se vejdou, se neposouvá', () => {
    for (const window of MENU_WINDOWS) {
      const layout = manyGamesLayout(window);
      const fewer = manyGamesLayout(window, 4);
      expect(fewer.tiles[0], window.name).toEqual(layout.tiles[0]);
      expect(fewer.gridScroll.viewport, window.name).toEqual(layout.gridScroll.viewport);
      expect(manyGamesLayout(window, 1).gridScroll.maxOffset, window.name).toBe(0);
    }
  });
});

describe('#69 AC1: kamera mřížky má rezervu a nezasahuje do lišty, kategorií ani pod výřez', () => {
  it('ořez obsahuje viditelnou plochu a kolem krajních dlaždic je aspoň 8 px', () => {
    for (const window of MENU_WINDOWS) {
      const layout = manyGamesLayout(window);
      const { clip, viewport, maxOffset } = layout.gridScroll;
      expect(isInside(viewport, clip), window.name).toBe(true);
      const first = layout.tiles[0] ?? viewport;
      const last = shiftY(lastOf(layout.tiles, window), maxOffset);
      const rightmost = layout.tiles[layout.gridColumns - 1] ?? viewport;
      expect(first.top - clip.top, window.name).toBeGreaterThanOrEqual(CLIP_RESERVE - ROUNDING);
      expect(first.left - clip.left, window.name).toBeGreaterThanOrEqual(CLIP_RESERVE - ROUNDING);
      expect(clip.right - rightmost.right, window.name).toBeGreaterThanOrEqual(
        CLIP_RESERVE - ROUNDING,
      );
      expect(clip.bottom - last.bottom, window.name).toBeGreaterThanOrEqual(
        CLIP_RESERVE - ROUNDING,
      );
    }
  });

  it('ořez a viditelné plochy mřížky a kategorií nezasahují do lišty, do sebe navzájem ani pod výřez', () => {
    for (const window of MENU_WINDOWS) {
      const layout = manyGamesLayout(window);
      const { clip } = layout.gridScroll;
      const gridViewport = layout.gridScroll.viewport;
      const categoryViewport = layout.categoryScroll.viewport;
      const free = freeAreaOf(window);
      for (const bar of barBoxes(layout)) {
        expect(overlaps(clip, bar), `${window.name}: ořez × lišta`).toBe(false);
        expect(overlaps(gridViewport, bar), `${window.name}: mřížka × lišta`).toBe(false);
        expect(gridViewport.top, `${window.name}: mřížka pod lištou`).toBeGreaterThanOrEqual(
          bar.bottom,
        );
        expect(overlaps(categoryViewport, bar), `${window.name}: kategorie × lišta`).toBe(false);
        // Viditelná plocha, ve které prst posouvá a ťuká, je od lišty aspoň 4 px jako
        // dnes. Kreslený ořez sahá až k liště (výjimka v menuLayoutScenes.ts).
        for (const viewport of [gridViewport, categoryViewport]) {
          expect(
            gapBetween(viewport, bar),
            `${window.name}: mezera od lišty`,
          ).toBeGreaterThanOrEqual(MIN_EDGE_DISTANCE - ROUNDING);
        }
      }
      for (const category of layout.categories) {
        expect(overlaps(clip, category.hit), `${window.name}: ořez × kategorie`).toBe(false);
      }
      expect(overlaps(clip, categoryViewport), `${window.name}: ořez × kategorie`).toBe(false);
      expect(overlaps(gridViewport, categoryViewport), `${window.name}: mřížka × kategorie`).toBe(
        false,
      );
      expect(isInside(clip, free), `${window.name}: ořez pod výřezem`).toBe(true);
      for (const viewport of [gridViewport, categoryViewport]) {
        expect(
          isInside(viewport, insetBox(free, MIN_EDGE_DISTANCE)),
          `${window.name}: viditelná plocha 4 px od okraje`,
        ).toBe(true);
      }
    }
  });
});

describe('#69 AC4: 13 kategorií (12 a „Vše“) se posouvá a je poznat, že je jich víc', () => {
  it('rozestup kategorií je nejvýš 88 px jako na obrázku (744×296 a 800×300)', () => {
    for (const name of ['744×296', '800×300']) {
      const [first, second] = manyGamesLayout(findWindow(name)).categories;
      expect((second?.hit.top ?? Infinity) - (first?.hit.top ?? 0), name).toBeLessThanOrEqual(88);
    }
  });

  it('každá kategorie má svou ťukací plochu a na začátku je „Vše“ celá vidět', () => {
    for (const window of MENU_WINDOWS) {
      const layout = manyGamesLayout(window);
      const viewport = layout.categoryScroll.viewport;
      expect(layout.categories, window.name).toHaveLength(MANY_MENU_CATEGORY_TITLES.length);
      const all = layout.categories[0]?.hit ?? { ...viewport, top: -1 };
      expect(isInside(all, viewport), window.name).toBe(true);
    }
  });

  it('kategorie, které se nevejdou, jdou posunout až na poslední; ty, které se vejdou, se neposouvají', () => {
    for (const window of MENU_WINDOWS) {
      const layout = manyGamesLayout(window);
      const { viewport, maxOffset } = layout.categoryScroll;
      const hits = layout.categories.map((category) => category.hit);
      if (categoryAxis(layout).overflowing) {
        expect(maxOffset, window.name).toBeGreaterThan(0);
        const last = shiftCategory(layout, lastOf(hits, window), maxOffset);
        expect(isInside(last, viewport), window.name).toBe(true);
      } else {
        expect(maxOffset, window.name).toBe(0);
        for (const hit of hits) {
          expect(isInside(hit, viewport), window.name).toBe(true);
        }
      }
    }
  });

  it('z další skryté kategorie je vidět aspoň 24 px', () => {
    expect(overflowingWindows().length, 'aspoň jedno okno přetéká').toBeGreaterThan(0);
    for (const window of MENU_WINDOWS) {
      const layout = manyGamesLayout(window);
      const { end, viewportEnd, overflowing } = categoryAxis(layout);
      if (!overflowing) {
        continue;
      }
      const viewport = layout.categoryScroll.viewport;
      const pill = layout.categories.find(
        (category) => end(category.pill) > viewportEnd + ROUNDING,
      )?.pill;
      const part = visiblePart(pill ?? viewport, viewport);
      expect(part, window.name).toBeDefined();
      const isRow = layout.categoryDirection === 'row';
      const shown = part === undefined ? 0 : isRow ? widthOf(part) : heightOf(part);
      expect(shown, window.name).toBeGreaterThanOrEqual(CATEGORY_PEEK);
    }
  });

  it('na konci se kategorie zastaví bez prázdného místa za poslední', () => {
    expect(overflowingWindows().length, 'aspoň jedno okno přetéká').toBeGreaterThan(0);
    for (const window of MENU_WINDOWS) {
      const layout = manyGamesLayout(window);
      const { end, viewportEnd, overflowing } = categoryAxis(layout);
      if (!overflowing) {
        continue;
      }
      const hits = layout.categories.map((category) => category.hit);
      const last = shiftCategory(layout, lastOf(hits, window), layout.categoryScroll.maxOffset);
      expect(viewportEnd - end(last), window.name).toBeLessThanOrEqual(MAX_END_SPACE);
    }
  });
});
