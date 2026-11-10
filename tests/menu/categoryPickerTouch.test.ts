import { describe, expect, it } from 'vitest';

import { COAST_MAX_MS, DRAG_THRESHOLD_PX } from '../../src/menu/logic/menuScroll';
import { FingerMenu, MANY_GAMES, centerOf, findWindow, manyLanguages } from './manyGamesFixtures';
import type { Point } from './manyGamesFixtures';

/**
 * Testy k #95 AC2, AC3, AC4 a AC6, ovládání prstem: tlačítko výběru
 * kategorie na telefonu na výšku, seznam kategorií a jeho posouvání podle
 * pravidel z #69. Zkušební menu se 40 hrami ve 12 kategoriích (s „Vše“
 * 13 řádků, jen v testech).
 *
 * Nahrazuje testy vodorovného posouvání řady kategorií na telefonu na
 * výšku z #69 AC4 a AC5 (`menuScrolling.test.ts`); každý nahrazený test má
 * tady test se stejnou kontrolou pro svislý seznam.
 *
 * Navržené rozhraní (`src/menu/logic/menuTouch.ts`): dotyky jako v #69
 * a #70, navíc:
 * - `categoryListOffset()`: o kolik px je seznam kategorií posunutý nahoru,
 * - ťuknutí na tlačítko výběru (`layout.categoryPicker.button`) volá
 *   `menu.tapCategoryButton()`, i když seznam dojíždí (dojíždění zastaví),
 * - s otevřeným seznamem se ťuká jen na řádky (`menu.tapCategory`),
 *   ťuknutí nebo tah mimo panel volá `menu.closeCategoryMenu()` a nic
 *   jiného neudělá, tah po seznamu ho posouvá,
 * - po otevření je vybraná kategorie v seznamu celá vidět,
 * - `setLayout` s rozložením bez výběru (otočení na šířku) seznam zavře.
 */

const PHONE_PORTRAIT = findWindow('390×844');
const SMALLEST_PORTRAIT = findWindow('360×620');
const PHONE_LANDSCAPE = findWindow('844×340');
/** Stejný telefon na výšku s lištou Safari, menší výška. */
const SMALLER_PORTRAIT = findWindow('390×664');

/** Okna na výšku, ve kterých se 13 řádků do panelu nevejde. */
const WINDOWS = [PHONE_PORTRAIT, SMALLEST_PORTRAIT];

function offsetBy(point: Point, dx: number, dy: number): Point {
  return { x: point.x + dx, y: point.y + dy };
}

async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function openList(finger: FingerMenu): void {
  finger.tap(finger.categoryButtonCenter());
  expect(finger.menu.isCategoryMenuOpen()).toBe(true);
}

/** Hýbe se seznam ještě sám (dojíždí)? Posune čas o jeden snímek. */
function isListMoving(finger: FingerMenu): boolean {
  const offset = finger.touch.categoryListOffset();
  finger.wait(16);
  return finger.touch.categoryListOffset() !== offset;
}

/** Posune seznam až na konec. */
function scrollListToEnd(finger: FingerMenu): void {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const start = finger.categoryListCenter();
    finger.slowDrag(start, offsetBy(start, 0, -150));
  }
}

function categoryIdAt(finger: FingerMenu, index: number): string | undefined {
  return finger.menu.categories()[index]?.id;
}

/** Menu jen s hrami z `categoryCount` prvních kategorií (s „Vše“ o řádek víc). */
function fewCategories(window = PHONE_PORTRAIT, categoryCount = 2): FingerMenu {
  const ids = Array.from({ length: categoryCount }, (_, index) => `category${index + 1}`);
  return new FingerMenu(
    window,
    MANY_GAMES.filter((game) => ids.includes(game.categoryId)),
  );
}

/** Bod v panelu seznamu nad dlaždicí, která pod panelem leží. */
function pointOverTileUnderList(finger: FingerMenu): Point {
  const layout = finger.layout();
  const panel = finger.picker().panel;
  const tile = layout.tiles.find(
    (box) =>
      box.left < panel.right &&
      panel.left < box.right &&
      box.top < panel.bottom &&
      panel.top < box.bottom &&
      box.top >= layout.gridScroll.viewport.top,
  );
  if (tile === undefined) {
    throw new Error('pod seznamem není žádná dlaždice');
  }
  const center = centerOf(tile);
  return {
    x: Math.min(Math.max(center.x, panel.left + 4), panel.right - 4),
    y: Math.min(Math.max(center.y, panel.top + 4), panel.bottom - 4),
  };
}

/** Bod mimo panel seznamu na dlaždici, která je celá vidět, nebo `undefined`. */
function tileOutsideList(finger: FingerMenu): Point | undefined {
  const layout = finger.layout();
  const panel = finger.picker().panel;
  const viewport = layout.gridScroll.viewport;
  for (const tile of layout.tiles) {
    if (tile.top < viewport.top || tile.bottom > viewport.bottom) {
      continue;
    }
    const corners = [
      { x: tile.left + 10, y: tile.bottom - 10 },
      { x: tile.right - 10, y: tile.bottom - 10 },
    ];
    const outside = corners.find(
      (point) =>
        point.x < panel.left ||
        point.x > panel.right ||
        point.y < panel.top ||
        point.y > panel.bottom,
    );
    if (outside !== undefined) {
      return outside;
    }
  }
  return undefined;
}

describe('#95 AC2: seznam se otevře a zavře tlačítkem', () => {
  for (const window of WINDOWS) {
    describe(window.name, () => {
      it('ťuknutí na zavřené tlačítko otevře seznam, šipka je ▴ a zazní „select“', () => {
        const finger = new FingerMenu(window);
        finger.tap(finger.categoryButtonCenter());
        expect(finger.menu.isCategoryMenuOpen()).toBe(true);
        expect(finger.menu.categoryButton().arrow).toBe('▴');
        expect(finger.sounds()).toEqual(['select']);
      });

      it('druhé ťuknutí na tlačítko seznam zavře, kategorie se nezmění a zazní znovu „select“', () => {
        const finger = new FingerMenu(window);
        openList(finger);
        finger.tap(finger.categoryButtonCenter());
        expect(finger.menu.isCategoryMenuOpen()).toBe(false);
        expect(finger.menu.categoryButton().arrow).toBe('▾');
        expect(finger.selectedCategory()).toBe('all');
        expect(finger.sounds()).toEqual(['select', 'select']);
      });

      it('rychlé dvojí ťuknutí seznam otevře a zavře, kategorie zůstane, nic se nespustí a „select“ zazní dvakrát', async () => {
        const finger = new FingerMenu(window);
        const button = finger.categoryButtonCenter();
        finger.down(button);
        finger.wait(40);
        finger.up(button);
        finger.wait(60);
        finger.down(button);
        finger.wait(40);
        finger.up(button);
        await settle();
        expect(finger.menu.isCategoryMenuOpen()).toBe(false);
        expect(finger.selectedCategory()).toBe('all');
        expect(finger.started).toEqual([]);
        expect(finger.sounds()).toEqual(['select', 'select']);
      });

      it('v otevřeném seznamu je každá kategorie v pořadí menu a ✓ má jen vybraná', () => {
        const finger = new FingerMenu(window);
        openList(finger);
        expect(finger.picker().rows).toHaveLength(finger.menu.categories().length);
        expect(
          finger.menu
            .categories()
            .filter((category) => category.selected)
            .map((category) => category.id),
        ).toEqual(['all']);
      });
    });
  }
});

describe('#95 AC3: výběr a zavření v seznamu', () => {
  for (const window of WINDOWS) {
    describe(window.name, () => {
      it('ťuknutí na jinou kategorii ji vybere, seznam zavře a za výběr zazní jednou „select“', () => {
        const finger = new FingerMenu(window);
        openList(finger);
        finger.tap(finger.categoryRowCenter(2));
        expect(finger.selectedCategory()).toBe(categoryIdAt(finger, 2));
        expect(finger.menu.isCategoryMenuOpen()).toBe(false);
        expect(finger.sounds()).toEqual(['select', 'select']);
        expect(finger.menu.categoryButton().title).toBe(finger.menu.categories()[2]?.title);
      });

      it('po výběru ukáže mřížka jen hry vybrané kategorie v pořadí registru', () => {
        const finger = new FingerMenu(window);
        openList(finger);
        finger.tap(finger.categoryRowCenter(1));
        const expected = MANY_GAMES.filter((game) => game.categoryId === 'category1').map(
          (game) => game.id,
        );
        expect(finger.menu.tiles().map((tile) => tile.gameId)).toEqual(expected);
        expect(finger.layout().tiles).toHaveLength(expected.length);
      });

      it('ťuknutí na už vybranou kategorii seznam zavře, nic nezmění a zazní „wobble“', () => {
        const finger = new FingerMenu(window);
        openList(finger);
        finger.tap(finger.categoryRowCenter(0));
        expect(finger.menu.isCategoryMenuOpen()).toBe(false);
        expect(finger.selectedCategory()).toBe('all');
        expect(finger.sounds()).toEqual(['select', 'wobble']);
      });

      it('po výběru jiné kategorie v seznamu začne mřížka nahoře', () => {
        const finger = new FingerMenu(window);
        const grid = finger.gridCenter();
        finger.slowDrag(grid, offsetBy(grid, 0, -120));
        expect(finger.touch.gridOffset()).toBeGreaterThan(0);
        openList(finger);
        finger.tap(finger.categoryRowCenter(1));
        expect(finger.selectedCategory()).toBe('category1');
        expect(finger.touch.gridOffset()).toBe(0);
      });

      it('ťuknutí na už vybranou kategorii v seznamu nechá mřížku, kde je', () => {
        const finger = new FingerMenu(window);
        const grid = finger.gridCenter();
        finger.slowDrag(grid, offsetBy(grid, 0, -120));
        openList(finger);
        finger.tap(finger.categoryRowCenter(0));
        expect(finger.touch.gridOffset()).toBeCloseTo(120, 5);
      });

      it('ťuknutí na dlaždici mimo seznam ho jen zavře, hra se nespustí a zazní „select“', async () => {
        const finger = fewCategories(window, 2); // Krátký seznam, pod ním jsou vidět celé dlaždice.
        openList(finger);
        const point = tileOutsideList(finger);
        expect(point, 'mimo seznam je vidět dlaždice').toBeDefined();
        finger.tap(point ?? finger.gridCenter());
        await settle();
        expect(finger.menu.isCategoryMenuOpen()).toBe(false);
        expect(finger.started).toEqual([]);
        expect(finger.feedback.filter((event) => event.kind === 'press')).toEqual([]);
        expect(finger.sounds()).toEqual(['select', 'select']);
      });

      it('ťuknutí na dlaždici pod otevřeným seznamem hru nespustí ani nezmáčkne', async () => {
        const finger = new FingerMenu(window);
        openList(finger);
        finger.tap(pointOverTileUnderList(finger));
        await settle();
        expect(finger.started).toEqual([]);
        expect(finger.feedback.filter((event) => event.kind === 'press')).toEqual([]);
      });

      it('ťuknutí na profil s otevřeným seznamem ho jen zavře, výběr profilu se neotevře', () => {
        const finger = new FingerMenu(window);
        openList(finger);
        finger.tap(centerOf(finger.layout().profileBadge.circle));
        expect(finger.menu.isCategoryMenuOpen()).toBe(false);
        expect(finger.profileOpened).toBe(0);
        expect(finger.sounds()).toEqual(['select', 'select']);
      });

      it('ťuknutí na tlačítko jazyka s otevřeným seznamem ho jen zavře, nabídka jazyků se neotevře', () => {
        const finger = new FingerMenu(window, MANY_GAMES, manyLanguages());
        openList(finger);
        finger.tap(finger.languageButtonCenter());
        expect(finger.menu.isCategoryMenuOpen()).toBe(false);
        expect(finger.menu.isLanguageMenuOpen()).toBe(false);
        expect(finger.sounds()).toEqual(['select', 'select']);
      });

      it('ťuknutí na „…“ s otevřeným seznamem ho jen zavře, „…“ se nezhoupne', () => {
        const finger = new FingerMenu(window);
        openList(finger);
        const placeholder = finger.layout().placeholders[0];
        expect(placeholder).toBeDefined();
        finger.tap(centerOf(placeholder ?? finger.layout().languageSlot));
        expect(finger.menu.isCategoryMenuOpen()).toBe(false);
        expect(finger.feedback.filter((event) => event.kind === 'wobble')).toEqual([]);
        expect(finger.sounds()).toEqual(['select', 'select']);
      });

      it('tah mimo seznam ho zavře, mřížka se pod ním neposune a zazní „select“', () => {
        const finger = fewCategories(window, 2); // Krátký seznam, pod ním jsou vidět celé dlaždice.
        openList(finger);
        const start = tileOutsideList(finger);
        expect(start, 'mimo seznam je vidět dlaždice').toBeDefined();
        const from = start ?? finger.gridCenter();
        finger.slowDrag(from, offsetBy(from, 0, -60));
        expect(finger.menu.isCategoryMenuOpen()).toBe(false);
        expect(finger.touch.gridOffset()).toBe(0);
        expect(finger.selectedCategory()).toBe('all');
        expect(finger.sounds()).toEqual(['select', 'select']);
      });

      it('ťuknutí na okraj panelu mezi řádky seznam nezavře a nic nevybere', () => {
        const finger = new FingerMenu(window);
        openList(finger);
        const panel = finger.picker().panel;
        finger.tap({ x: (panel.left + panel.right) / 2, y: panel.top + 2 });
        expect(finger.menu.isCategoryMenuOpen()).toBe(true);
        expect(finger.selectedCategory()).toBe('all');
      });
    });
  }
});

describe('#95 AC4: hodně kategorií se v seznamu posouvá podle pravidel z #69', () => {
  for (const window of WINDOWS) {
    describe(window.name, () => {
      it('13 kategorií se do panelu nevejde', () => {
        expect(new FingerMenu(window).picker().list.maxOffset).toBeGreaterThan(0);
      });

      it('po tažení prstem nahoru se seznam posune svisle o stejný kus a mřížka zůstane', () => {
        const finger = new FingerMenu(window);
        openList(finger);
        const start = finger.categoryListCenter();
        finger.slowDrag(start, offsetBy(start, 0, -40));
        expect(finger.touch.categoryListOffset()).toBeCloseTo(40, 5);
        expect(finger.touch.gridOffset()).toBe(0);
        expect(finger.menu.isCategoryMenuOpen()).toBe(true);
      });

      it('vodorovný tah po seznamu ho neposune', () => {
        const finger = new FingerMenu(window);
        openList(finger);
        const start = finger.categoryListCenter();
        finger.slowDrag(start, offsetBy(start, -40, 0));
        expect(finger.touch.categoryListOffset()).toBe(0);
      });

      it('seznam se nedá posunout před první ani za poslední řádek a na krajích se zastaví bez pružení', () => {
        const finger = new FingerMenu(window);
        openList(finger);
        const start = finger.categoryListCenter();
        finger.slowDrag(start, offsetBy(start, 0, 100));
        expect(finger.touch.categoryListOffset()).toBe(0);
        scrollListToEnd(finger);
        const max = finger.picker().list.maxOffset;
        expect(finger.touch.categoryListOffset()).toBeCloseTo(max, 5);
        finger.wait(1000);
        expect(finger.touch.categoryListOffset()).toBeCloseTo(max, 5);
      });

      it('ťuknutí s pohybem do 10 px kategorii vybere', () => {
        const finger = new FingerMenu(window);
        openList(finger);
        const start = finger.categoryRowCenter(1);
        finger.down(start);
        finger.move(offsetBy(start, 0, -DRAG_THRESHOLD_PX));
        finger.up(offsetBy(start, 0, -DRAG_THRESHOLD_PX));
        expect(finger.selectedCategory()).toBe('category1');
      });

      it('tah o 11 px kategorii nevybere, svisle ani vodorovně, a seznam zůstane otevřený', () => {
        const finger = new FingerMenu(window);
        openList(finger);
        const steps = [
          { dx: 0, dy: DRAG_THRESHOLD_PX + 1 },
          { dx: 0, dy: -(DRAG_THRESHOLD_PX + 1) },
          { dx: DRAG_THRESHOLD_PX + 1, dy: 0 },
          { dx: -(DRAG_THRESHOLD_PX + 1), dy: 0 },
        ];
        for (const { dx, dy } of steps) {
          const point = finger.categoryRowCenter(1);
          finger.down(point);
          finger.move(offsetBy(point, dx, dy));
          finger.up(offsetBy(point, dx, dy));
          finger.wait(1000);
        }
        expect(finger.selectedCategory()).toBe('all');
        expect(finger.menu.isCategoryMenuOpen()).toBe(true);
        expect(finger.feedback.filter((event) => event.kind === 'select')).toEqual([]);
      });

      it('druhý prst na řádku se ignoruje: vybere se jen kategorie pod prvním prstem', () => {
        const finger = new FingerMenu(window);
        openList(finger);
        const first = finger.categoryRowCenter(1);
        const second = finger.categoryRowCenter(2);
        finger.down(first, 1);
        finger.down(second, 2);
        finger.up(second, 2);
        finger.up(first, 1);
        expect(finger.selectedCategory()).toBe('category1');
        expect(finger.feedback.filter((event) => event.kind === 'select')).toHaveLength(1);
      });

      it('druhý prst během tažení seznam neposune', () => {
        const finger = new FingerMenu(window);
        openList(finger);
        const start = finger.categoryListCenter();
        finger.down(start, 1);
        finger.move(offsetBy(start, 0, -15), 1);
        finger.move(offsetBy(start, 0, -45), 1);
        finger.down(offsetBy(start, 20, 0), 2);
        finger.move(offsetBy(start, 20, -135), 2);
        finger.up(offsetBy(start, 20, -135), 2);
        expect(finger.touch.categoryListOffset()).toBeCloseTo(30, 5);
        finger.wait(200);
        finger.up(offsetBy(start, 0, -45), 1);
        expect(finger.selectedCategory()).toBe('all');
        expect(finger.menu.isCategoryMenuOpen()).toBe(true);
      });

      it('po švihnutí seznam dojede dál než po pomalém tahu, do 1 s stojí a nepřejede kraj', () => {
        const fast = new FingerMenu(window);
        const slow = new FingerMenu(window);
        openList(fast);
        openList(slow);
        const start = fast.categoryListCenter();
        fast.drag(start, offsetBy(start, 0, -40), 48);
        slow.slowDrag(start, offsetBy(start, 0, -40));
        const max = fast.picker().list.maxOffset;
        const seen: number[] = [];
        for (let frame = 0; frame < Math.ceil(1000 / 16); frame += 1) {
          fast.wait(16);
          seen.push(fast.touch.categoryListOffset());
        }
        expect(isListMoving(fast)).toBe(false);
        expect(Math.max(...seen)).toBeLessThanOrEqual(max);
        expect(Math.min(...seen)).toBeGreaterThanOrEqual(0);
        expect(fast.touch.categoryListOffset()).toBeGreaterThan(slow.touch.categoryListOffset());
      });

      it('nejdelší dojíždění seznamu skončí do 1 s', () => {
        expect(COAST_MAX_MS).toBeLessThanOrEqual(1000);
      });

      it('ťuknutí na řádek během dojíždění seznam zastaví a kategorii nevybere', () => {
        const finger = new FingerMenu(window);
        openList(finger);
        const start = finger.categoryListCenter();
        finger.drag(start, offsetBy(start, 0, -40), 48);
        finger.wait(50);
        expect(isListMoving(finger)).toBe(true);
        finger.down(finger.categoryListCenter());
        const stopped = finger.touch.categoryListOffset();
        finger.up(finger.categoryListCenter());
        finger.wait(1000);
        expect(finger.touch.categoryListOffset()).toBe(stopped);
        expect(finger.selectedCategory()).toBe('all');
        expect(finger.menu.isCategoryMenuOpen()).toBe(true);
      });

      it('ťuknutí na posunutý řádek vybere kategorii, která je pod prstem', () => {
        const finger = new FingerMenu(window);
        openList(finger);
        const start = finger.categoryListCenter();
        finger.slowDrag(start, offsetBy(start, 0, -150));
        const picker = finger.picker();
        const offset = finger.touch.categoryListOffset();
        const index = picker.rows.findIndex((row) => row.top - offset >= picker.list.viewport.top);
        expect(index).toBeGreaterThan(0);
        finger.tap(finger.categoryRowCenter(index));
        expect(finger.selectedCategory()).toBe(categoryIdAt(finger, index));
      });

      it('poslední kategorie jde po posunutí na konec vybrat', () => {
        const finger = new FingerMenu(window);
        openList(finger);
        scrollListToEnd(finger);
        const last = finger.menu.categories().length - 1;
        finger.tap(finger.categoryRowCenter(last));
        expect(finger.selectedCategory()).toBe(categoryIdAt(finger, last));
      });

      it('po otevření je vybraná kategorie celá vidět, i když je na konci seznamu', () => {
        const finger = new FingerMenu(window);
        openList(finger);
        scrollListToEnd(finger);
        const last = finger.menu.categories().length - 1;
        finger.tap(finger.categoryRowCenter(last));
        openList(finger);
        const picker = finger.picker();
        const row = picker.rows[last];
        const offset = finger.touch.categoryListOffset();
        expect(row).toBeDefined();
        expect((row?.top ?? -Infinity) - offset).toBeGreaterThanOrEqual(
          picker.list.viewport.top - 0.01,
        );
        expect((row?.bottom ?? Infinity) - offset).toBeLessThanOrEqual(
          picker.list.viewport.bottom + 0.01,
        );
      });

      it('po otevření s vybranou „Vše“ začíná seznam nahoře', () => {
        const finger = new FingerMenu(window);
        openList(finger);
        const start = finger.categoryListCenter();
        finger.slowDrag(start, offsetBy(start, 0, -80));
        finger.tap(finger.categoryButtonCenter());
        openList(finger);
        expect(finger.touch.categoryListOffset()).toBe(0);
      });
    });
  }

  it('když se všechny řádky vejdou (dnešní 3 kategorie), tah seznam neposune ani nezavře', () => {
    for (const window of WINDOWS) {
      const finger = fewCategories(window, 2);
      openList(finger);
      expect(finger.picker().list.maxOffset, window.name).toBe(0);
      const start = finger.categoryListCenter();
      finger.slowDrag(start, offsetBy(start, 0, -40));
      finger.drag(start, offsetBy(start, 0, -120), 48);
      finger.wait(1000);
      expect(finger.touch.categoryListOffset(), window.name).toBe(0);
      expect(finger.menu.isCategoryMenuOpen(), window.name).toBe(true);
    }
  });
});

describe('#95 AC6: okrajové případy', () => {
  it('s „Vše“ a jednou kategorií má seznam dvě řádky, neposouvá se a výběr funguje stejně', () => {
    for (const window of WINDOWS) {
      const finger = fewCategories(window, 1);
      openList(finger);
      expect(finger.picker().rows, window.name).toHaveLength(2);
      expect(finger.picker().list.maxOffset, window.name).toBe(0);
      finger.tap(finger.categoryRowCenter(1));
      expect(finger.selectedCategory(), window.name).toBe('category1');
      expect(finger.menu.isCategoryMenuOpen(), window.name).toBe(false);
      expect(finger.sounds(), window.name).toEqual(['select', 'select']);
    }
  });

  it('ťuknutí na tlačítko během dojíždění seznamu dojíždění zastaví a seznam zavře beze změny kategorie', () => {
    for (const window of WINDOWS) {
      const finger = new FingerMenu(window);
      openList(finger);
      const start = finger.categoryListCenter();
      finger.drag(start, offsetBy(start, 0, -40), 48);
      finger.wait(50);
      expect(isListMoving(finger), window.name).toBe(true);
      finger.tap(finger.categoryButtonCenter());
      const stopped = finger.touch.categoryListOffset();
      finger.wait(1000);
      expect(finger.touch.categoryListOffset(), window.name).toBe(stopped);
      expect(finger.menu.isCategoryMenuOpen(), window.name).toBe(false);
      expect(finger.selectedCategory(), window.name).toBe('all');
      expect(finger.sounds(), window.name).toEqual(['select', 'select']);
    }
  });

  it('po otočení na šířku s otevřeným seznamem se seznam zavře a vybraná kategorie je zvýrazněná ve sloupci', () => {
    const finger = new FingerMenu(PHONE_PORTRAIT);
    openList(finger);
    finger.tap(finger.categoryRowCenter(2));
    openList(finger);
    finger.rotateTo(PHONE_LANDSCAPE);
    expect(finger.menu.isCategoryMenuOpen()).toBe(false);
    expect(finger.layout().categoryPicker ?? null).toBeNull();
    expect(
      finger.menu
        .categories()
        .filter((category) => category.selected)
        .map((category) => category.id),
    ).toEqual(['category2']);
    expect(finger.layout().categories).toHaveLength(finger.menu.categories().length);
  });

  it('po otočení zpět na výšku je seznam zavřený a tlačítko ukazuje stejnou kategorii', () => {
    const finger = new FingerMenu(PHONE_PORTRAIT);
    openList(finger);
    finger.tap(finger.categoryRowCenter(2));
    openList(finger);
    finger.rotateTo(PHONE_LANDSCAPE);
    finger.rotateTo(PHONE_PORTRAIT);
    expect(finger.menu.isCategoryMenuOpen()).toBe(false);
    expect(finger.menu.categoryButton().title).toBe(finger.menu.categories()[2]?.title);
    expect(finger.menu.categoryButton().arrow).toBe('▾');
  });

  it('po změně okna na výšku (lišta Safari) zůstane seznam posunutý nanejvýš na konec', () => {
    // Náhrada za „po otočení zůstanou kategorie posunuté nanejvýš na konec“
    // z #69 AC5, který dřív začínal posunutou řadou na telefonu na výšku.
    const finger = new FingerMenu(PHONE_PORTRAIT);
    openList(finger);
    scrollListToEnd(finger);
    expect(finger.touch.categoryListOffset()).toBeGreaterThan(0);
    finger.rotateTo(SMALLER_PORTRAIT);
    const max = finger.picker().list.maxOffset;
    expect(finger.touch.categoryListOffset()).toBeLessThanOrEqual(max);
    expect(finger.touch.categoryListOffset()).toBeGreaterThanOrEqual(0);
  });

  it('po otočení z šířky na výšku zůstane vybraná kategorie ze sloupce a seznam je zavřený', () => {
    const finger = new FingerMenu(PHONE_LANDSCAPE);
    finger.tap(finger.categoryCenter(1));
    finger.rotateTo(PHONE_PORTRAIT);
    expect(finger.selectedCategory()).toBe('category1');
    expect(finger.menu.isCategoryMenuOpen()).toBe(false);
    expect(finger.menu.categoryButton().title).toBe(finger.menu.categories()[1]?.title);
  });

  it('po návratu ze hry je seznam zavřený, tlačítko ukazuje stejnou kategorii a mřížka je posunutá stejně (#69 AC5)', async () => {
    for (const window of WINDOWS) {
      const finger = new FingerMenu(window);
      const grid = finger.gridCenter();
      finger.slowDrag(grid, offsetBy(grid, 0, -230));
      const offset = finger.touch.gridOffset();
      expect(offset, window.name).toBeGreaterThan(0);
      openList(finger);
      finger.tap(finger.categoryButtonCenter());
      finger.tap(finger.tileCenter(finger.firstFullyVisibleTile()));
      await settle();
      expect(finger.menu.runningGame(), window.name).not.toBeNull();
      finger.menu.returnFromGame();
      finger.relayout();
      expect(finger.menu.isCategoryMenuOpen(), window.name).toBe(false);
      expect(finger.menu.categoryButton().title, window.name).toBe('Vše');
      expect(finger.touch.gridOffset(), window.name).toBe(offset);
    }
  });

  it('po návratu ze hry spuštěné z vybrané kategorie ukazuje tlačítko tuto kategorii', async () => {
    const finger = new FingerMenu(PHONE_PORTRAIT);
    openList(finger);
    finger.tap(finger.categoryRowCenter(2));
    finger.tap(finger.tileCenter(0));
    await settle();
    expect(finger.menu.runningGame()).not.toBeNull();
    finger.menu.returnFromGame();
    finger.relayout();
    expect(finger.selectedCategory()).toBe('category2');
    expect(finger.menu.isCategoryMenuOpen()).toBe(false);
    expect(finger.menu.categoryButton().title).toBe(finger.menu.categories()[2]?.title);
  });

  it('po obnovení stránky je vybraná „Vše“, seznam je zavřený a začíná nahoře', () => {
    const finger = new FingerMenu(PHONE_PORTRAIT);
    openList(finger);
    finger.tap(finger.categoryRowCenter(3));
    openList(finger);
    const reloaded = new FingerMenu(PHONE_PORTRAIT);
    expect(reloaded.selectedCategory()).toBe('all');
    expect(reloaded.menu.isCategoryMenuOpen()).toBe(false);
    expect(reloaded.touch.categoryListOffset()).toBe(0);
  });

  it('s otevřenou nabídkou jazyků ťuknutí na tlačítko výběru jen zavře nabídku a seznam se neotevře', () => {
    for (const window of WINDOWS) {
      const finger = new FingerMenu(window, MANY_GAMES, manyLanguages());
      finger.tap(finger.languageButtonCenter());
      expect(finger.menu.isLanguageMenuOpen(), window.name).toBe(true);
      // Levý kraj tlačítka výběru, mimo panel nabídky jazyků vpravo.
      const button = finger.picker().button;
      finger.tap({ x: button.left + 20, y: (button.top + button.bottom) / 2 });
      expect(finger.menu.isLanguageMenuOpen(), window.name).toBe(false);
      expect(finger.menu.isCategoryMenuOpen(), window.name).toBe(false);
    }
  });

  it('seznam kategorií a nabídka jazyků nejsou nikdy otevřené současně, ani při střídání tlačítek', () => {
    for (const window of WINDOWS) {
      const finger = new FingerMenu(window, MANY_GAMES, manyLanguages());
      const button = finger.picker().button;
      const pickerPoint = { x: button.left + 20, y: (button.top + button.bottom) / 2 };
      const taps = [
        pickerPoint,
        finger.languageButtonCenter(),
        finger.languageButtonCenter(),
        pickerPoint,
        pickerPoint,
        finger.languageButtonCenter(),
      ];
      for (const point of taps) {
        finger.tap(point);
        expect(
          finger.menu.isCategoryMenuOpen() && finger.menu.isLanguageMenuOpen(),
          window.name,
        ).toBe(false);
      }
    }
  });
});
