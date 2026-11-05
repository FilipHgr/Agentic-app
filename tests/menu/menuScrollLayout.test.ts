import { describe, expect, it } from 'vitest';

import { GAMES } from '../../src/gameList';
import { ALL_CATEGORY, visibleCategories } from '../../src/menu/logic/menuCategories';
import { menuLayoutFor } from '../../src/menu/logic/menuLayout';
import type { MenuBox, MenuLayout } from '../../src/menu/logic/menuLayout';
import { menuText } from '../../src/menu/logic/menuTexts';
import { GAME_CATEGORIES } from '../../src/shared/logic/gameRegistry';
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
import {
  MANY_GAMES,
  MANY_GAMES_COUNT,
  MANY_MENU_CATEGORY_TITLES,
  MANY_TEXTS_CS,
  MENU_WINDOWS,
  manyGamesLayout,
} from './manyGamesFixtures';

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
 */

const MIN_TAP = 64;
const MIN_GAP = 8;
const EDGE_MARGIN = 4;
const ROUNDING = 1e-6;
const CHARACTER_WIDTH_RATIO = 0.6;
const TEXT_PADDING = 8;
/** Z další skryté kategorie je vidět aspoň tolik (AC4). */
const CATEGORY_PEEK = 24;
/** Na konci posouvání nezůstane větší prázdné místo, než je okraj mřížky. */
const MAX_END_SPACE = 24;

function insetBox(outer: MenuBox, margin: number): MenuBox {
  return {
    left: outer.left + margin,
    right: outer.right - margin,
    top: outer.top + margin,
    bottom: outer.bottom - margin,
  };
}

function shiftY(box: MenuBox, offset: number): MenuBox {
  return { ...box, top: box.top - offset, bottom: box.bottom - offset };
}

function shiftX(box: MenuBox, offset: number): MenuBox {
  return { ...box, left: box.left - offset, right: box.right - offset };
}

function shiftCategory(layout: MenuLayout, box: MenuBox, offset: number): MenuBox {
  return layout.categoryDirection === 'row' ? shiftX(box, offset) : shiftY(box, offset);
}

/** Část obdélníku, která je vidět ve viditelné ploše, nebo `undefined`. */
function visiblePart(box: MenuBox, viewport: MenuBox): MenuBox | undefined {
  const part = {
    left: Math.max(box.left, viewport.left),
    right: Math.min(box.right, viewport.right),
    top: Math.max(box.top, viewport.top),
    bottom: Math.min(box.bottom, viewport.bottom),
  };
  return part.left < part.right && part.top < part.bottom ? part : undefined;
}

function barBoxes(layout: MenuLayout): MenuBox[] {
  return [layout.profileSlot, layout.languageSlot, ...layout.placeholders];
}

function textWidth(text: string, fontSize: number): number {
  return [...text].length * CHARACTER_WIDTH_RATIO * fontSize;
}

/** Názvy kategorií, které dnes menu ukáže. */
function todayCategoryTitles(): string[] {
  const all = [ALL_CATEGORY, ...GAME_CATEGORIES];
  return visibleCategories(GAMES, GAME_CATEGORIES).map((id) => {
    const category = all.find((candidate) => candidate.id === id);
    return menuText(category?.titleKey ?? '', 'cs') ?? '';
  });
}

function todayLayout(window: TestWindow): MenuLayout {
  return menuLayoutFor(viewportOf(window), {
    categoryTitles: todayCategoryTitles(),
    tileCount: GAMES.length,
  });
}

describe('#69 AC1: dnes (jedna hra) se nic neposouvá a menu vypadá stejně', () => {
  for (const window of MENU_WINDOWS) {
    it(`${window.name}: mřížka ani kategorie nemají kam posunout`, () => {
      const layout = todayLayout(window);
      expect(layout.gridScroll.maxOffset).toBe(0);
      expect(layout.categoryScroll.maxOffset).toBe(0);
    });

    it(`${window.name}: dnešní dlaždice i kategorie jsou celé ve viditelné ploše`, () => {
      const layout = todayLayout(window);
      for (const tile of layout.tiles) {
        expect(isInside(tile, layout.gridScroll.viewport)).toBe(true);
      }
      for (const category of layout.categories) {
        expect(isInside(category.hit, layout.categoryScroll.viewport)).toBe(true);
      }
    });

    it(`${window.name}: počet her v „Vše“ navíc dnešní rozložení nezmění`, () => {
      const plain = todayLayout(window);
      const withAll = menuLayoutFor(viewportOf(window), {
        categoryTitles: todayCategoryTitles(),
        tileCount: GAMES.length,
        allTileCount: GAMES.length,
      });
      expect(withAll).toEqual(plain);
    });
  }
});

describe('#69 AC1: mřížka se 40 hrami se posouvá svisle a je poznat, že je toho víc', () => {
  for (const window of MENU_WINDOWS) {
    describe(window.name, () => {
      const layout = manyGamesLayout(window);
      const viewport = layout.gridScroll.viewport;
      const max = layout.gridScroll.maxOffset;

      it('dlaždice se nevejdou, takže mřížka jde posunout', () => {
        expect(max).toBeGreaterThan(0);
      });

      it('z první skryté řady je vidět 20–60 % výšky dlaždice', () => {
        const firstHidden = layout.tiles.find((tile) => tile.bottom > viewport.bottom + ROUNDING);
        expect(firstHidden).toBeDefined();
        const tile = firstHidden ?? viewport;
        const visible = (viewport.bottom - tile.top) / heightOf(tile);
        expect(visible).toBeGreaterThanOrEqual(0.2);
        expect(visible).toBeLessThanOrEqual(0.6);
      });

      it('poslední dlaždice jde posunout celá do viditelné plochy', () => {
        const last = layout.tiles[layout.tiles.length - 1];
        expect(last).toBeDefined();
        expect(isInside(shiftY(last ?? viewport, max), viewport)).toBe(true);
      });

      it('na konci se mřížka zastaví bez prázdného místa pod poslední řadou', () => {
        const last = layout.tiles[layout.tiles.length - 1] ?? viewport;
        expect(viewport.bottom - shiftY(last, max).bottom).toBeLessThanOrEqual(MAX_END_SPACE);
      });

      it('na začátku je první dlaždice celá vidět v levém horním rohu', () => {
        const first = layout.tiles[0];
        expect(first).toBeDefined();
        expect(isInside(first ?? { ...viewport, top: -1 }, viewport)).toBe(true);
      });

      it('viditelná plocha mřížky není pod lištou ani pod kategoriemi', () => {
        for (const box of barBoxes(layout)) {
          expect(overlaps(viewport, box)).toBe(false);
          expect(viewport.top).toBeGreaterThanOrEqual(box.bottom);
        }
        expect(overlaps(viewport, layout.categoryScroll.viewport)).toBe(false);
      });

      it('žádná dlaždice není pod lištou ani pod kategoriemi při žádném posunu', () => {
        const steps = [0, max / 3, max / 2, max];
        for (const offset of steps) {
          for (const tile of layout.tiles) {
            const part = visiblePart(shiftY(tile, offset), viewport);
            if (part === undefined) {
              continue;
            }
            for (const box of barBoxes(layout)) {
              expect(overlaps(part, box)).toBe(false);
            }
            for (const category of layout.categories) {
              expect(overlaps(part, category.hit)).toBe(false);
            }
          }
        }
      });

      it('viditelná plocha mřížky není pod výřezem a je aspoň 4 px od okraje volné plochy', () => {
        expect(isInside(viewport, insetBox(freeAreaOf(window), EDGE_MARGIN))).toBe(true);
      });

      it('každá dlaždice má aspoň 64 × 64 px a mezi dlaždicemi je aspoň 8 px', () => {
        for (const tile of layout.tiles) {
          expect(widthOf(tile)).toBeGreaterThanOrEqual(MIN_TAP - ROUNDING);
          expect(heightOf(tile)).toBeGreaterThanOrEqual(MIN_TAP - ROUNDING);
        }
        const [first, second] = layout.tiles;
        const below = layout.tiles[layout.gridColumns];
        expect(gapBetween(first ?? viewport, second ?? viewport)).toBeGreaterThanOrEqual(MIN_GAP);
        expect(gapBetween(first ?? viewport, below ?? viewport)).toBeGreaterThanOrEqual(MIN_GAP);
      });

      it('název každé hry se vejde do dlaždice', () => {
        MANY_GAMES.forEach((game, index) => {
          const tile = layout.tiles[index] ?? viewport;
          const title = MANY_TEXTS_CS[game.titleKey] ?? '';
          expect(textWidth(title, layout.tileTitleFontSize) + 2 * TEXT_PADDING).toBeLessThanOrEqual(
            widthOf(tile) + ROUNDING,
          );
        });
      });

      it('v kategorii s méně hrami mají dlaždice stejnou velikost jako ve „Vše“', () => {
        const fewer = manyGamesLayout(window, 4);
        expect(fewer.tiles[0]).toEqual(layout.tiles[0]);
        expect(fewer.gridScroll.viewport).toEqual(viewport);
      });

      it('kategorie s hrami, které se vejdou, se neposouvá', () => {
        const fewer = manyGamesLayout(window, 1);
        expect(fewer.gridScroll.maxOffset).toBe(0);
      });

      it(`ve „Vše“ je ${MANY_GAMES_COUNT} dlaždic, jedna na hru`, () => {
        expect(layout.tiles).toHaveLength(MANY_GAMES_COUNT);
      });
    });
  }
});

describe('#69 AC1: kamera mřížky má rezervu na pulzování, zatřesení a stín', () => {
  /** Rezerva kolem dlaždice v ořezu kamery (pulzování o 5 % a stín). */
  const RESERVE = 8;
  for (const window of MENU_WINDOWS) {
    it(`${window.name}: ořez obsahuje viditelnou plochu a kolem krajních dlaždic je aspoň 8 px`, () => {
      const layout = manyGamesLayout(window);
      const { clip, viewport, maxOffset } = layout.gridScroll;
      expect(isInside(viewport, clip)).toBe(true);
      const first = layout.tiles[0] ?? viewport;
      const last = shiftY(layout.tiles[layout.tiles.length - 1] ?? viewport, maxOffset);
      const rightmost = layout.tiles[layout.gridColumns - 1] ?? viewport;
      expect(first.top - clip.top).toBeGreaterThanOrEqual(RESERVE - ROUNDING);
      expect(first.left - clip.left).toBeGreaterThanOrEqual(RESERVE - ROUNDING);
      expect(clip.right - rightmost.right).toBeGreaterThanOrEqual(RESERVE - ROUNDING);
      expect(clip.bottom - last.bottom).toBeGreaterThanOrEqual(RESERVE - ROUNDING);
    });

    it(`${window.name}: ořez kamery mřížky nezasahuje do lišty, kategorií ani pod výřez`, () => {
      const layout = manyGamesLayout(window);
      const { clip } = layout.gridScroll;
      for (const box of barBoxes(layout)) {
        expect(overlaps(clip, box)).toBe(false);
      }
      for (const category of layout.categories) {
        expect(overlaps(clip, category.hit)).toBe(false);
      }
      expect(overlaps(clip, layout.categoryScroll.viewport)).toBe(false);
      expect(isInside(clip, freeAreaOf(window))).toBe(true);
    });
  }
});

describe('#69 AC4: rozestup kategorií podle schváleného obrázku', () => {
  for (const name of ['744×296', '800×300']) {
    it(`${name}: rozestup kategorií je nejvýš 88 px jako na obrázku`, () => {
      const window = MENU_WINDOWS.find((candidate) => candidate.name.startsWith(name));
      expect(window).toBeDefined();
      const layout = manyGamesLayout(window ?? MENU_WINDOWS[0]!);
      const [first, second] = layout.categories;
      expect((second?.hit.top ?? Infinity) - (first?.hit.top ?? 0)).toBeLessThanOrEqual(88);
    });
  }
});

describe('#69 AC4: 13 kategorií (12 a „Vše“) se posouvá a je poznat, že je jich víc', () => {
  for (const window of MENU_WINDOWS) {
    describe(window.name, () => {
      const layout = manyGamesLayout(window);
      const viewport = layout.categoryScroll.viewport;
      const max = layout.categoryScroll.maxOffset;
      const hits = layout.categories.map((category) => category.hit);
      const pills = layout.categories.map((category) => category.pill);
      const isRow = layout.categoryDirection === 'row';
      const end = (box: MenuBox): number => (isRow ? box.right : box.bottom);
      const viewportEnd = isRow ? viewport.right : viewport.bottom;

      it('každá kategorie má svou ťukací plochu aspoň 64 px vysokou a mezery aspoň 8 px', () => {
        expect(layout.categories).toHaveLength(MANY_MENU_CATEGORY_TITLES.length);
        for (const hit of hits) {
          expect(heightOf(hit)).toBeGreaterThanOrEqual(MIN_TAP - ROUNDING);
          expect(widthOf(hit)).toBeGreaterThanOrEqual(MIN_TAP - ROUNDING);
        }
        for (let index = 1; index < hits.length; index += 1) {
          expect(
            gapBetween(hits[index - 1] ?? viewport, hits[index] ?? viewport),
          ).toBeGreaterThanOrEqual(MIN_GAP - ROUNDING);
        }
      });

      const overflowing = hits.some((hit) => end(hit) > viewportEnd + ROUNDING);

      if (overflowing) {
        it('z další skryté kategorie je vidět aspoň 24 px', () => {
          const index = pills.findIndex((pill) => end(pill) > viewportEnd + ROUNDING);
          const pill = pills[index] ?? viewport;
          const part = visiblePart(pill, viewport);
          expect(part).toBeDefined();
          const shown = part === undefined ? 0 : isRow ? widthOf(part) : heightOf(part);
          expect(shown).toBeGreaterThanOrEqual(CATEGORY_PEEK);
        });

        it('kategorie jdou posunout tak, že je celá vidět i poslední', () => {
          expect(max).toBeGreaterThan(0);
          const last = hits[hits.length - 1] ?? viewport;
          expect(isInside(shiftCategory(layout, last, max), viewport)).toBe(true);
        });

        it('na konci se kategorie zastaví bez prázdného místa za poslední', () => {
          const last = hits[hits.length - 1] ?? viewport;
          expect(viewportEnd - end(shiftCategory(layout, last, max))).toBeLessThanOrEqual(
            MAX_END_SPACE,
          );
        });
      } else {
        it('kategorie se vejdou celé, takže se neposouvají', () => {
          expect(max).toBe(0);
          for (const hit of hits) {
            expect(isInside(hit, viewport)).toBe(true);
          }
        });
      }

      it('na začátku je „Vše“ celá vidět', () => {
        expect(isInside(hits[0] ?? { ...viewport, top: -1 }, viewport)).toBe(true);
      });

      it('viditelná plocha kategorií není pod lištou, pod výřezem ani u okraje', () => {
        for (const box of barBoxes(layout)) {
          expect(overlaps(viewport, box)).toBe(false);
        }
        expect(isInside(viewport, insetBox(freeAreaOf(window), EDGE_MARGIN))).toBe(true);
      });

      it('posunuté kategorie nejsou pod lištou ani v mřížce', () => {
        for (const offset of [0, max / 2, max]) {
          for (const hit of hits) {
            const part = visiblePart(shiftCategory(layout, hit, offset), viewport);
            if (part === undefined) {
              continue;
            }
            for (const box of barBoxes(layout)) {
              expect(overlaps(part, box)).toBe(false);
            }
            expect(overlaps(part, layout.gridScroll.viewport)).toBe(false);
          }
        }
      });

      it('název každé kategorie se vejde do své pilulky', () => {
        MANY_MENU_CATEGORY_TITLES.forEach((title, index) => {
          const pill = pills[index] ?? viewport;
          expect(textWidth(title, layout.categoryFontSize) + 2 * TEXT_PADDING).toBeLessThanOrEqual(
            widthOf(pill) + ROUNDING,
          );
        });
      });
    });
  }
});
