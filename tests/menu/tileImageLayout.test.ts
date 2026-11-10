import { describe, expect, it } from 'vitest';

import { GAMES } from '../../src/gameList';
import { menuLayoutFor } from '../../src/menu/logic/menuLayout';
import type { MenuBox, MenuLayout } from '../../src/menu/logic/menuLayout';
import { HOME_SCREEN_WINDOWS } from '../shared/layoutRules';
import { viewportOf } from '../shared/viewportFixtures';
import type { TestWindow } from '../shared/viewportFixtures';
import {
  FingerMenu,
  MENU_WINDOWS,
  centerOf,
  findWindow,
  manyGamesLayout,
} from './manyGamesFixtures';
import { SCROLL_CONTENTS, todayCategoryTitles, todayLayout } from './menuLayoutScenes';

/**
 * Testy k #122 AC4 (a částem AC1 a AC7): kde je na dlaždici obrázek hry
 * a název pod ním. Velikost a místo počítá logika rozložení menu, scéna je
 * jen nakreslí.
 *
 * Navržené rozhraní (`src/menu/logic/menuLayout.ts`): `MenuLayout` má
 * navíc `tileImages`, pro každou dlaždici z `tiles` (ve stejném pořadí)
 * `{ image: MenuBox; title: MenuBox }`: čtverec obrázku a řádek názvu
 * pod ním, v CSS px okna bez posunu mřížky jako `tiles`.
 *
 * Každé pravidlo je jeden test v cyklu přes všechny případy (okna menu
 * a okna z plochy, dnešní menu i zkušebních 40 her, „Vše“ i vybraná
 * kategorie, posouvaná mřížka); popis případu je v `expect`. Že se
 * skutečný text Phaseru do řádku vejde, ověří ruční kontrola AC8.
 */

const EDGE = 8;
const GAP = 2;
const TITLE_LINE = 1.2;
const MIN_IMAGE = 40;

interface ImageCase {
  readonly label: string;
  readonly layout: MenuLayout;
}

const WINDOWS: readonly TestWindow[] = [...MENU_WINDOWS, ...HOME_SCREEN_WINDOWS];

/** Dnešní menu po výběru kategorie Počítání: jedna dlaždice, výška podle „Vše“. */
function todaySelectedLayout(window: TestWindow): MenuLayout {
  return menuLayoutFor(viewportOf(window), {
    categoryTitles: todayCategoryTitles('cs'),
    tileCount: 1,
    allTileCount: GAMES.length,
  });
}

function imageCases(): ImageCase[] {
  return WINDOWS.flatMap((window): ImageCase[] => [
    { label: `${window.name}, dnešní menu, Vše`, layout: todayLayout(window) },
    {
      label: `${window.name}, dnešní menu, vybraná kategorie`,
      layout: todaySelectedLayout(window),
    },
    ...SCROLL_CONTENTS.map((content) => ({
      label: `${window.name}, zkušební menu, ${content.name}`,
      layout: manyGamesLayout(window, content.count),
    })),
  ]);
}

const CASES = imageCases();

interface TileCase {
  readonly label: string;
  readonly layout: MenuLayout;
  readonly tile: MenuBox;
  readonly image: MenuBox;
  readonly title: MenuBox;
}

/** Všechny dlaždice všech případů s obrázkem a názvem. */
function tileCases(): TileCase[] {
  return CASES.flatMap(({ label, layout }) =>
    layout.tiles.map((tile, index): TileCase => {
      const face = layout.tileImages[index];
      if (face === undefined) {
        throw new Error(`${label}: dlaždice ${index + 1} nemá obrázek v rozložení`);
      }
      return { label: `${label}, dlaždice ${index + 1}`, layout, tile, ...face };
    }),
  );
}

const width = (box: MenuBox): number => box.right - box.left;
const height = (box: MenuBox): number => box.bottom - box.top;
const centerX = (box: MenuBox): number => (box.left + box.right) / 2;

describe('#122 AC4: obrázek a název na dlaždici', () => {
  it('každá dlaždice má v rozložení místo pro obrázek a název', () => {
    for (const { label, layout } of CASES) {
      expect(layout.tileImages.length, label).toBe(layout.tiles.length);
    }
  });

  it('název je jeden řádek vysoký 1,2 × velikost písma názvu', () => {
    for (const { label, layout, title } of tileCases()) {
      expect(height(title), label).toBeCloseTo(TITLE_LINE * layout.tileTitleFontSize, 5);
    }
  });

  it('název je vodorovně uprostřed dlaždice', () => {
    for (const { label, tile, title } of tileCases()) {
      expect(centerX(title), label).toBeCloseTo(centerX(tile), 5);
    }
  });

  it('obrázek je čtverec', () => {
    for (const { label, image } of tileCases()) {
      expect(height(image), label).toBeCloseTo(width(image), 5);
    }
  });

  it('obrázek je vodorovně uprostřed dlaždice', () => {
    for (const { label, tile, image } of tileCases()) {
      expect(centerX(image), label).toBeCloseTo(centerX(tile), 5);
    }
  });

  it('pod obrázkem je mezera 2 px a pod ní název', () => {
    for (const { label, image, title } of tileCases()) {
      expect(title.top - image.bottom, label).toBeCloseTo(GAP, 5);
    }
  });

  it('obrázek, mezera a název tvoří skupinu svisle uprostřed dlaždice', () => {
    for (const { label, tile, image, title } of tileCases()) {
      expect(image.top - tile.top, label).toBeCloseTo(tile.bottom - title.bottom, 5);
    }
  });

  it('obrázek je od všech okrajů dlaždice aspoň 8 px', () => {
    for (const { label, tile, image } of tileCases()) {
      const distance = Math.min(
        image.left - tile.left,
        tile.right - image.right,
        image.top - tile.top,
        tile.bottom - image.bottom,
      );
      expect(distance, label).toBeGreaterThanOrEqual(EDGE - 0.01);
    }
  });

  it('název je aspoň 8 px od spodního okraje dlaždice', () => {
    for (const { label, tile, title } of tileCases()) {
      expect(tile.bottom - title.bottom, label).toBeGreaterThanOrEqual(EDGE - 0.01);
    }
  });

  it('obrázek a název se nepřekrývají', () => {
    for (const { label, image, title } of tileCases()) {
      expect(title.top, label).toBeGreaterThanOrEqual(image.bottom);
    }
  });

  it('velikost obrázku je min(šířka − 16, výška − 8 − 2 − výška názvu − 8)', () => {
    for (const { label, layout, tile, image } of tileCases()) {
      const titleHeight = TITLE_LINE * layout.tileTitleFontSize;
      const expected = Math.min(
        width(tile) - 2 * EDGE,
        height(tile) - EDGE - GAP - titleHeight - EDGE,
      );
      expect(width(image), label).toBeCloseTo(expected, 5);
    }
  });

  it('obrázek nikde nemá méně než 40 px', () => {
    for (const { label, image } of tileCases()) {
      expect(width(image), label).toBeGreaterThanOrEqual(MIN_IMAGE);
    }
  });

  it('na iPadu 1180 × 820 má obrázek 161,6 px', () => {
    for (const { label, image } of tileCases().filter((c) => c.label.startsWith('iPad 1180×820'))) {
      expect(width(image), label).toBeCloseTo(161.6, 5);
    }
  });

  it('v nejmenší dlaždici (telefon na šířku, výška 80 px) má obrázek 44 px', () => {
    const smallest = tileCases().filter((c) => Math.abs(height(c.tile) - 80) < 0.01);
    expect(smallest.length).toBeGreaterThan(0);
    for (const { label, image } of smallest) {
      expect(width(image), label).toBeCloseTo(44, 5);
    }
  });
});

/** Nechá doběhnout stahování a spuštění hry (sliby). */
async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

/** Obrázek a název první dlaždice prstem ovládaného menu. */
function firstFace(finger: FingerMenu): { image: MenuBox; title: MenuBox } {
  const face = finger.layout().tileImages[0];
  if (face === undefined) {
    throw new Error(`${finger.window.name}: první dlaždice nemá obrázek v rozložení`);
  }
  return face;
}

describe('#122 AC1: ťuknutí na obrázek spustí hru', () => {
  it('ťuknutí doprostřed obrázku spustí hru stejně jako ťuknutí jinam na dlaždici', async () => {
    for (const window of MENU_WINDOWS) {
      const onImage = new FingerMenu(window);
      onImage.tap(centerOf(firstFace(onImage).image));
      await settle();

      const onTile = new FingerMenu(window);
      onTile.tap(onTile.tileCenter(0));
      await settle();

      expect(onImage.started, window.name).toEqual(['game1']);
      expect(onImage.started, window.name).toEqual(onTile.started);
    }
  });

  it('ťuknutí na název pod obrázkem spustí hru', async () => {
    for (const window of MENU_WINDOWS) {
      const finger = new FingerMenu(window);
      finger.tap(centerOf(firstFace(finger).title));
      await settle();
      expect(finger.started, window.name).toEqual(['game1']);
    }
  });
});

describe('#122 AC7: po přepnutí kategorie je obrázek stejně velký a na stejném místě', () => {
  it('první dlaždice má po výběru kategorie obrázek stejně velký a na stejném místě jako ve „Vše“', () => {
    for (const window of [findWindow('iPad 1180×820'), findWindow('844×340')]) {
      const finger = new FingerMenu(window);
      const before = finger.layout().tileImages[0];
      finger.tap(finger.categoryCenter(1));
      expect(finger.selectedCategory(), window.name).toBe('category1');
      const after = finger.layout().tileImages[0];
      expect(after, window.name).toEqual(before);
      expect(before, window.name).toBeDefined();
    }
  });

  it('dnešní menu má obrázek dlaždice ve „Vše“ i ve vybrané kategorii stejně velký a na stejném místě', () => {
    for (const window of WINDOWS) {
      expect(todaySelectedLayout(window).tileImages[0], window.name).toEqual(
        todayLayout(window).tileImages[0],
      );
    }
  });
});
