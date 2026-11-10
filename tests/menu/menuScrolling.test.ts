import { describe, expect, it } from 'vitest';

import { COAST_MAX_MS, DRAG_THRESHOLD_PX } from '../../src/menu/logic/menuScroll';
import { FingerMenu, MANY_GAMES, findWindow } from './manyGamesFixtures';
import type { Point } from './manyGamesFixtures';

/**
 * Testy k #69 (posouvání mřížky a kategorií prstem), část ovládání:
 * zkušební menu se 40 hrami a 12 kategoriemi (jen v testech).
 *
 * Navržené rozhraní (`src/menu/logic/menuTouch.ts`, čistý TypeScript):
 * - `createMenuTouch({ menu })` převezme dotyky prstů v CSS px okna,
 * - `setLayout(layout)` po každém překreslení (změna okna, otočení,
 *   jiná kategorie, návrat z hry),
 * - `pointerDown/Move/Up(id, bod, čas)`, `pointerCancel(id)`,
 * - `frame(čas)` v každém snímku (setrvačnost),
 * - `gridOffset()` a `categoryOffset()`: o kolik je mřížka a kategorie
 *   posunutá, `pressed()`: dlaždice nebo kategorie zmáčknutá prstem.
 * Tah posouvá od místa, kde prst překročil práh, takže obsah neposkočí.
 * Ťuknutí na dlaždici nebo kategorii platí až po zvednutí prstu, a jen když
 * se prst nepohnul víc než o 10 px (`DRAG_THRESHOLD_PX`).
 *
 * Řadu kategorií na telefonu na výšku nahradil výběr kategorie (#95).
 * Testy posouvání kategorií (AC4) a návratu z hry s posunutými kategoriemi
 * (AC5) tu proto běží jen v oknech se sloupcem; jejich náhrada pro
 * telefon na výšku (posouvání seznamu kategorií) je
 * v `categoryPickerTouch.test.ts`.
 */

const IPAD = findWindow('iPad 1180×820');
const IPAD_PORTRAIT = findWindow('zmenšené zobrazení 820×1180');
const PHONE_LANDSCAPE = findWindow('844×340');
const PHONE_PORTRAIT = findWindow('390×844');

/** Okna, ve kterých se mřížka posouvá (i telefon na výšku). */
const SCROLL_WINDOWS = [IPAD, PHONE_LANDSCAPE, PHONE_PORTRAIT];

/** Okna se sloupcem kategorií, který se posouvá svisle (#95: na výšku je výběr). */
const CATEGORY_WINDOWS = [IPAD, PHONE_LANDSCAPE];

function offsetBy(point: Point, dx: number, dy: number): Point {
  return { x: point.x + dx, y: point.y + dy };
}

/** Nechá doběhnout stahování a spuštění hry (sliby). */
async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

/** Hýbe se mřížka nebo kategorie ještě sama (dojíždí)? Posune čas o jeden snímek. */
function isStillMoving(finger: FingerMenu): boolean {
  const grid = finger.touch.gridOffset();
  const categories = finger.touch.categoryOffset();
  finger.wait(16);
  return finger.touch.gridOffset() !== grid || finger.touch.categoryOffset() !== categories;
}

function presses(finger: FingerMenu): number {
  return finger.feedback.filter((event) => event.kind === 'press').length;
}

function selects(finger: FingerMenu): number {
  return finger.feedback.filter((event) => event.kind === 'select').length;
}

/** Posun kategorií po směru jejich řady nebo sloupce. */
function categoryStep(finger: FingerMenu, distance: number): { dx: number; dy: number } {
  return finger.layout().categoryDirection === 'row'
    ? { dx: distance, dy: 0 }
    : { dx: 0, dy: distance };
}

/** Bod uprostřed kategorie, která je vidět celá (druhá v menu). */
function categoryPoint(finger: FingerMenu): Point {
  return finger.categoryCenter(1);
}

describe('#69 AC1: mřížka se posune za prstem', () => {
  for (const window of SCROLL_WINDOWS) {
    describe(window.name, () => {
      it('po tažení prstem nahoru se mřížka posune o stejný kus', () => {
        const finger = new FingerMenu(window);
        const start = finger.gridCenter();
        finger.slowDrag(start, offsetBy(start, 0, -60));
        expect(finger.touch.gridOffset()).toBeCloseTo(60, 5);
      });

      it('po tažení zpět dolů se mřížka vrátí', () => {
        const finger = new FingerMenu(window);
        const start = finger.gridCenter();
        finger.slowDrag(start, offsetBy(start, 0, -60));
        finger.slowDrag(start, offsetBy(start, 0, 40));
        expect(finger.touch.gridOffset()).toBeCloseTo(20, 5);
      });

      it('lišta nahoře a kategorie zůstanou při posouvání mřížky na místě', () => {
        const finger = new FingerMenu(window);
        const start = finger.gridCenter();
        finger.slowDrag(start, offsetBy(start, 0, -60));
        expect(finger.touch.categoryOffset()).toBe(0);
      });

      it('mřížka se nedá posunout nad první řadu', () => {
        const finger = new FingerMenu(window);
        const start = finger.gridCenter();
        finger.slowDrag(start, offsetBy(start, 0, 150));
        expect(finger.touch.gridOffset()).toBe(0);
      });

      it('mřížka se nedá posunout za poslední řadu a poslední dlaždice je celá vidět', () => {
        const finger = new FingerMenu(window);
        const start = finger.gridCenter();
        for (let index = 0; index < 30; index += 1) {
          finger.slowDrag(start, offsetBy(start, 0, -200));
        }
        const layout = finger.layout();
        expect(finger.touch.gridOffset()).toBeCloseTo(layout.gridScroll.maxOffset, 5);
        const last = layout.tiles[layout.tiles.length - 1];
        const viewport = layout.gridScroll.viewport;
        expect((last?.bottom ?? Infinity) - finger.touch.gridOffset()).toBeLessThanOrEqual(
          viewport.bottom + 0.01,
        );
      });

      it('první dlaždice jde vrátit na začátek', () => {
        const finger = new FingerMenu(window);
        const start = finger.gridCenter();
        for (let index = 0; index < 30; index += 1) {
          finger.slowDrag(start, offsetBy(start, 0, -200));
        }
        for (let index = 0; index < 30; index += 1) {
          finger.slowDrag(start, offsetBy(start, 0, 200));
        }
        expect(finger.touch.gridOffset()).toBe(0);
        expect(finger.firstFullyVisibleTile()).toBe(0);
      });
    });
  }

  it('s jednou hrou (dnes) tažení mřížku neposune', () => {
    const game = MANY_GAMES[0];
    expect(game).toBeDefined();
    for (const window of SCROLL_WINDOWS) {
      const finger = new FingerMenu(window, game === undefined ? [] : [game]);
      const start = finger.gridCenter();
      finger.slowDrag(start, offsetBy(start, 0, -100));
      finger.drag(start, offsetBy(start, 0, -300), 50);
      finger.wait(1500);
      expect(finger.touch.gridOffset(), window.name).toBe(0);
      expect(finger.touch.categoryOffset(), window.name).toBe(0);
    }
  });
});

describe('#69 AC2: tažení není ťuknutí', () => {
  const cases = [
    { name: 'svisle', dx: 0, dy: 1 },
    { name: 'vodorovně', dx: 1, dy: 0 },
  ];
  for (const { name, dx, dy } of cases) {
    it(`ťuknutí s pohybem o 9 px ${name} hru spustí`, async () => {
      const finger = new FingerMenu(IPAD);
      const tile = finger.tileCenter(0);
      finger.down(tile);
      finger.wait(50);
      finger.move(offsetBy(tile, 9 * dx, 9 * dy));
      finger.wait(50);
      finger.up(offsetBy(tile, 9 * dx, 9 * dy));
      await settle();
      expect(finger.started).toEqual(['game1']);
    });

    it(`ťuknutí s pohybem přesně o 10 px ${name} hru ještě spustí`, async () => {
      const finger = new FingerMenu(IPAD);
      const tile = finger.tileCenter(0);
      finger.down(tile);
      finger.move(offsetBy(tile, DRAG_THRESHOLD_PX * dx, DRAG_THRESHOLD_PX * dy));
      finger.up(offsetBy(tile, DRAG_THRESHOLD_PX * dx, DRAG_THRESHOLD_PX * dy));
      await settle();
      expect(finger.started).toEqual(['game1']);
    });

    it(`tah o 11 px ${name} hru nespustí, i když začal na dlaždici`, async () => {
      const finger = new FingerMenu(IPAD);
      const tile = finger.tileCenter(0);
      finger.down(tile);
      finger.wait(50);
      finger.move(offsetBy(tile, 11 * dx, 11 * dy));
      finger.wait(50);
      finger.up(offsetBy(tile, 11 * dx, 11 * dy));
      await settle();
      expect(finger.started).toEqual([]);
      expect(presses(finger)).toBe(0);
    });

    it(`tah o 11 px ${name}, který se vrátí na místo, hru také nespustí`, async () => {
      const finger = new FingerMenu(IPAD);
      const tile = finger.tileCenter(0);
      finger.down(tile);
      finger.move(offsetBy(tile, 11 * dx, 11 * dy));
      finger.move(tile);
      finger.up(tile);
      await settle();
      expect(finger.started).toEqual([]);
    });
  }

  it('na začátku tahu mřížka neposkočí: posouvá se až od místa, kde tah začal', () => {
    const finger = new FingerMenu(IPAD);
    const start = finger.gridCenter();
    finger.down(start);
    finger.move(offsetBy(start, 0, -11));
    expect(finger.touch.gridOffset()).toBe(0);
    finger.move(offsetBy(start, 0, -21));
    expect(finger.touch.gridOffset()).toBeCloseTo(10, 5);
  });

  it('dlaždice se zmáčkne hned po dotyku, ještě před zvednutím prstu', () => {
    const finger = new FingerMenu(IPAD);
    const tile = finger.tileCenter(0);
    finger.down(tile);
    expect(finger.touch.pressed()).toEqual({ kind: 'tile', gameId: 'game1' });
    finger.up(tile);
    expect(finger.touch.pressed()).toBeUndefined();
  });

  it('zmáčknutí dlaždice se zruší, když se z dotyku stane tah', () => {
    const finger = new FingerMenu(IPAD);
    const tile = finger.tileCenter(0);
    finger.down(tile);
    finger.move(offsetBy(tile, 0, 9));
    expect(finger.touch.pressed()).toEqual({ kind: 'tile', gameId: 'game1' });
    finger.move(offsetBy(tile, 0, 11));
    expect(finger.touch.pressed()).toBeUndefined();
  });

  it('kategorie se zmáčkne hned po dotyku a druhý prst zmáčknutí nezmění', () => {
    const finger = new FingerMenu(IPAD);
    finger.down(finger.categoryCenter(1), 1);
    expect(finger.touch.pressed()).toEqual({ kind: 'category', categoryId: 'category1' });
    finger.down(finger.categoryCenter(2), 2);
    expect(finger.touch.pressed()).toEqual({ kind: 'category', categoryId: 'category1' });
  });

  it('dotyk během dojíždění nic nezmáčkne', () => {
    const finger = new FingerMenu(IPAD);
    const start = finger.gridCenter();
    finger.drag(start, offsetBy(start, 0, -60), 48);
    finger.wait(100);
    finger.down(finger.tileCenter(finger.firstFullyVisibleTile()));
    expect(finger.touch.pressed()).toBeUndefined();
  });

  it('hra se spustí až po zvednutí prstu, ne při dotyku', async () => {
    const finger = new FingerMenu(IPAD);
    const tile = finger.tileCenter(0);
    finger.down(tile);
    await settle();
    expect(finger.started).toEqual([]);
    expect(presses(finger)).toBe(0);
    finger.up(tile);
    expect(presses(finger)).toBe(1);
    await settle();
    expect(finger.started).toEqual(['game1']);
  });

  it('ťuknutí na posunutou dlaždici spustí tu hru, která je pod prstem', async () => {
    const finger = new FingerMenu(PHONE_PORTRAIT);
    const start = finger.gridCenter();
    finger.slowDrag(start, offsetBy(start, 0, -300));
    finger.tap(finger.tileCenter(6));
    await settle();
    expect(finger.started).toEqual(['game7']);
  });

  it('druhý prst během tažení se ignoruje: neposouvá a nic nespustí', async () => {
    const finger = new FingerMenu(IPAD);
    const start = finger.gridCenter();
    finger.down(start, 1);
    finger.wait(20);
    finger.move(offsetBy(start, 0, -15), 1);
    finger.move(offsetBy(start, 0, -65), 1);
    const tile = finger.tileCenter(1);
    finger.down(tile, 2);
    finger.wait(20);
    finger.move(offsetBy(tile, 0, -200), 2);
    expect(finger.touch.gridOffset()).toBeCloseTo(50, 5);
    finger.up(tile, 2);
    finger.wait(200);
    finger.move(offsetBy(start, 0, -95), 1);
    finger.wait(200);
    finger.up(offsetBy(start, 0, -95), 1);
    await settle();
    expect(finger.touch.gridOffset()).toBeCloseTo(80, 5);
    expect(finger.started).toEqual([]);
    expect(presses(finger)).toBe(0);
  });

  it('druhý prst během ťuknutí se ignoruje: spustí se jen první hra a jen jednou', async () => {
    const finger = new FingerMenu(IPAD);
    const first = finger.tileCenter(0);
    const second = finger.tileCenter(1);
    finger.down(first, 1);
    finger.down(second, 2);
    finger.up(second, 2);
    finger.up(first, 1);
    finger.up(first, 1);
    await settle();
    expect(finger.started).toEqual(['game1']);
    expect(presses(finger)).toBe(1);
  });

  it('přerušený dotyk (systém prst zruší) nic nespustí', async () => {
    const finger = new FingerMenu(IPAD);
    const tile = finger.tileCenter(0);
    finger.down(tile);
    finger.touch.pointerCancel(1);
    finger.up(tile);
    await settle();
    expect(finger.started).toEqual([]);
  });
});

describe('#69 AC3: setrvačnost mřížky', () => {
  for (const window of SCROLL_WINDOWS) {
    describe(window.name, () => {
      it('rychlý tah posune mřížku dál než pomalý tah stejné délky', () => {
        const fast = new FingerMenu(window);
        const slow = new FingerMenu(window);
        const start = fast.gridCenter();
        fast.drag(start, offsetBy(start, 0, -60), 48);
        slow.slowDrag(start, offsetBy(start, 0, -60));
        fast.wait(1500);
        slow.wait(1500);
        expect(fast.touch.gridOffset()).toBeGreaterThan(slow.touch.gridOffset() + 20);
      });

      it('dojíždění skončí nejpozději 1 s po puštění', () => {
        const finger = new FingerMenu(window);
        const start = finger.gridCenter();
        finger.drag(start, offsetBy(start, 0, -80), 48);
        finger.wait(1000);
        const stopped = finger.touch.gridOffset();
        finger.wait(1000);
        expect(finger.touch.gridOffset()).toBe(stopped);
      });

      it('mřížka při dojíždění nikdy nepřejede horní ani dolní kraj', () => {
        const finger = new FingerMenu(window);
        const start = finger.gridCenter();
        const max = finger.layout().gridScroll.maxOffset;
        const seen: number[] = [];
        // Švihnutí dolů na začátku, pak několik rychlých švihnutí nahoru až na konec.
        finger.drag(start, offsetBy(start, 0, 80), 48);
        for (let frame = 0; frame < 70; frame += 1) {
          finger.wait(16);
          seen.push(finger.touch.gridOffset());
        }
        for (let fling = 0; fling < 8; fling += 1) {
          finger.drag(start, offsetBy(start, 0, -120), 48);
          for (let frame = 0; frame < 70; frame += 1) {
            finger.wait(16);
            seen.push(finger.touch.gridOffset());
          }
        }
        expect(Math.min(...seen)).toBeGreaterThanOrEqual(0);
        expect(Math.max(...seen)).toBeLessThanOrEqual(max);
        expect(finger.touch.gridOffset()).toBeCloseTo(max, 5);
      });

      it('na kraji se mřížka zastaví hned, bez pružení zpět', () => {
        const finger = new FingerMenu(window);
        const start = finger.gridCenter();
        for (let fling = 0; fling < 10; fling += 1) {
          finger.drag(start, offsetBy(start, 0, -150), 48);
          finger.wait(1000);
        }
        const max = finger.layout().gridScroll.maxOffset;
        expect(finger.touch.gridOffset()).toBeCloseTo(max, 5);
        expect(isStillMoving(finger)).toBe(false);
      });

      it('ťuknutí během dojíždění mřížku zastaví a hru nespustí', async () => {
        const finger = new FingerMenu(window);
        const start = finger.gridCenter();
        finger.drag(start, offsetBy(start, 0, -60), 48);
        finger.wait(100);
        expect(isStillMoving(finger)).toBe(true);
        const tile = finger.tileCenter(finger.firstFullyVisibleTile());
        finger.down(tile);
        const stopped = finger.touch.gridOffset();
        finger.wait(50);
        finger.up(tile);
        finger.wait(1000);
        await settle();
        expect(finger.touch.gridOffset()).toBe(stopped);
        expect(finger.started).toEqual([]);
        expect(presses(finger)).toBe(0);
      });

      it('po zastavení ťuknutím další ťuknutí hru spustí', async () => {
        const finger = new FingerMenu(window);
        const start = finger.gridCenter();
        finger.drag(start, offsetBy(start, 0, -60), 48);
        finger.wait(100);
        finger.tap(start);
        const index = finger.firstFullyVisibleTile();
        finger.tap(finger.tileCenter(index));
        await settle();
        expect(finger.started).toEqual([MANY_GAMES[index]?.id]);
      });
    });
  }

  it('nejdelší dojíždění je kratší než 1 s', () => {
    expect(COAST_MAX_MS).toBeLessThanOrEqual(1000);
  });
});

describe('#69 AC4: kategorie se posouvají prstem', () => {
  for (const window of CATEGORY_WINDOWS) {
    describe(window.name, () => {
      it('sloupec kategorií se posune svisle', () => {
        const finger = new FingerMenu(window);
        expect(finger.layout().categoryDirection).toBe('column');
        const start = categoryPoint(finger);
        const { dx, dy } = categoryStep(finger, -40);
        finger.slowDrag(start, offsetBy(start, dx, dy));
        expect(finger.touch.categoryOffset()).toBeCloseTo(40, 5);
        expect(finger.touch.gridOffset()).toBe(0);
      });

      it('tah napříč řadou kategorií je neposune', () => {
        const finger = new FingerMenu(window);
        const start = categoryPoint(finger);
        const { dx, dy } = categoryStep(finger, -20);
        finger.slowDrag(start, offsetBy(start, dy, dx));
        expect(finger.touch.categoryOffset()).toBe(0);
      });

      it('kategorie se nedají posunout před první ani za poslední', () => {
        const finger = new FingerMenu(window);
        const start = categoryPoint(finger);
        const back = categoryStep(finger, 100);
        finger.slowDrag(start, offsetBy(start, back.dx, back.dy));
        expect(finger.touch.categoryOffset()).toBe(0);
        const forward = categoryStep(finger, -150);
        for (let index = 0; index < 30; index += 1) {
          finger.slowDrag(start, offsetBy(start, forward.dx, forward.dy));
        }
        const max = finger.layout().categoryScroll.maxOffset;
        expect(max).toBeGreaterThan(0);
        expect(finger.touch.categoryOffset()).toBeCloseTo(max, 5);
      });

      it('ťuknutí do 10 px kategorii vybere', () => {
        const finger = new FingerMenu(window);
        const start = categoryPoint(finger);
        const step = categoryStep(finger, 9);
        finger.down(start);
        finger.move(offsetBy(start, step.dx, step.dy));
        finger.up(offsetBy(start, step.dx, step.dy));
        expect(finger.selectedCategory()).toBe('category1');
        expect(selects(finger)).toBe(1);
      });

      it('tah o 11 px kategorii nevybere, ani napříč', () => {
        const finger = new FingerMenu(window);
        const start = categoryPoint(finger);
        for (const step of [categoryStep(finger, 11), categoryStep(finger, -11)]) {
          finger.down(start);
          finger.move(offsetBy(start, step.dx, step.dy));
          finger.up(offsetBy(start, step.dx, step.dy));
          finger.wait(1000);
          finger.down(start);
          finger.move(offsetBy(start, step.dy, step.dx));
          finger.up(offsetBy(start, step.dy, step.dx));
          finger.wait(1000);
        }
        expect(finger.selectedCategory()).toBe('all');
        expect(selects(finger)).toBe(0);
      });

      it('druhý prst na kategorii se ignoruje', () => {
        const finger = new FingerMenu(window);
        const first = finger.categoryCenter(1);
        const second = finger.categoryCenter(2);
        finger.down(first, 1);
        finger.down(second, 2);
        finger.up(second, 2);
        finger.up(first, 1);
        expect(finger.selectedCategory()).toBe('category1');
        expect(selects(finger)).toBe(1);
      });

      it('druhý prst během tažení kategorií je neposune', () => {
        const finger = new FingerMenu(window);
        const start = categoryPoint(finger);
        const lead = categoryStep(finger, -15);
        const step = categoryStep(finger, -45);
        finger.down(start, 1);
        finger.move(offsetBy(start, lead.dx, lead.dy), 1);
        finger.move(offsetBy(start, step.dx, step.dy), 1);
        finger.down(finger.categoryCenter(0), 2);
        finger.move(offsetBy(finger.categoryCenter(0), 3 * step.dx, 3 * step.dy), 2);
        finger.up(finger.categoryCenter(0), 2);
        expect(finger.touch.categoryOffset()).toBeCloseTo(30, 5);
        finger.wait(200);
        finger.up(offsetBy(start, step.dx, step.dy), 1);
        expect(selects(finger)).toBe(0);
      });

      it('po švihnutí kategorie dojedou dál a nejpozději 1 s po puštění stojí, bez přejetí kraje', () => {
        const fast = new FingerMenu(window);
        const slow = new FingerMenu(window);
        const start = categoryPoint(fast);
        const step = categoryStep(fast, -40);
        fast.drag(start, offsetBy(start, step.dx, step.dy), 48);
        slow.slowDrag(start, offsetBy(start, step.dx, step.dy));
        const max = fast.layout().categoryScroll.maxOffset;
        const seen: number[] = [];
        for (let frame = 0; frame < 63; frame += 1) {
          fast.wait(16);
          seen.push(fast.touch.categoryOffset());
        }
        expect(isStillMoving(fast)).toBe(false);
        expect(Math.max(...seen)).toBeLessThanOrEqual(max);
        expect(Math.min(...seen)).toBeGreaterThanOrEqual(0);
        expect(fast.touch.categoryOffset()).toBeGreaterThan(slow.touch.categoryOffset());
      });

      it('ťuknutí během dojíždění kategorie zastaví a kategorii nevybere', () => {
        const finger = new FingerMenu(window);
        const start = categoryPoint(finger);
        const step = categoryStep(finger, -40);
        finger.drag(start, offsetBy(start, step.dx, step.dy), 48);
        finger.wait(50);
        expect(isStillMoving(finger)).toBe(true);
        finger.down(start);
        const stopped = finger.touch.categoryOffset();
        finger.up(start);
        finger.wait(1000);
        expect(finger.touch.categoryOffset()).toBe(stopped);
        expect(finger.selectedCategory()).toBe('all');
        expect(selects(finger)).toBe(0);
      });

      it('po výběru jiné kategorie začne mřížka nahoře', () => {
        const finger = new FingerMenu(window);
        const grid = finger.gridCenter();
        finger.slowDrag(grid, offsetBy(grid, 0, -120));
        expect(finger.touch.gridOffset()).toBeGreaterThan(0);
        finger.tap(categoryPoint(finger));
        expect(finger.selectedCategory()).toBe('category1');
        expect(finger.touch.gridOffset()).toBe(0);
      });

      it('ťuknutí na už vybranou kategorii mřížku nechá, kde je', () => {
        const finger = new FingerMenu(window);
        const grid = finger.gridCenter();
        finger.slowDrag(grid, offsetBy(grid, 0, -120));
        finger.tap(finger.categoryCenter(0));
        expect(finger.touch.gridOffset()).toBeCloseTo(120, 5);
      });

      it('ťuknutí na posunutou kategorii vybere tu, která je pod prstem', () => {
        const finger = new FingerMenu(window);
        const start = categoryPoint(finger);
        const step = categoryStep(finger, -150);
        finger.slowDrag(start, offsetBy(start, step.dx, step.dy));
        const layout = finger.layout();
        const viewport = layout.categoryScroll.viewport;
        const offset = finger.touch.categoryOffset();
        const isRow = layout.categoryDirection === 'row';
        const index = layout.categories.findIndex((category) =>
          isRow
            ? category.hit.left - offset >= viewport.left
            : category.hit.top - offset >= viewport.top,
        );
        finger.tap(finger.categoryCenter(index));
        expect(finger.selectedCategory()).toBe(finger.menu.categories()[index]?.id);
      });
    });
  }
});

describe('#69 AC5: menu zůstane, kde dítě bylo', () => {
  /** Posune mřížku i kategorie a vrátí posuny. */
  function scrollBoth(finger: FingerMenu): { grid: number; categories: number } {
    const grid = finger.gridCenter();
    finger.slowDrag(grid, offsetBy(grid, 0, -230));
    const start = categoryPoint(finger);
    const step = categoryStep(finger, -70);
    finger.slowDrag(start, offsetBy(start, step.dx, step.dy));
    return { grid: finger.touch.gridOffset(), categories: finger.touch.categoryOffset() };
  }

  async function playAndReturn(finger: FingerMenu, tileIndex: number): Promise<void> {
    finger.tap(finger.tileCenter(tileIndex));
    await settle();
    expect(finger.menu.runningGame()).not.toBeNull();
    finger.menu.returnFromGame();
    finger.relayout();
  }

  for (const window of CATEGORY_WINDOWS) {
    it(`${window.name}: po návratu z hry jsou mřížka i kategorie posunuté stejně`, async () => {
      const finger = new FingerMenu(window);
      const before = scrollBoth(finger);
      expect(before.grid).toBeGreaterThan(0);
      expect(before.categories).toBeGreaterThan(0);
      await playAndReturn(finger, finger.firstFullyVisibleTile());
      expect(finger.selectedCategory()).toBe('all');
      expect(finger.touch.gridOffset()).toBe(before.grid);
      expect(finger.touch.categoryOffset()).toBe(before.categories);
    });
  }

  it('po návratu z hry je vybraná stejná kategorie a kategorie jsou posunuté stejně', async () => {
    const finger = new FingerMenu(PHONE_LANDSCAPE);
    const start = categoryPoint(finger);
    const step = categoryStep(finger, -70);
    finger.slowDrag(start, offsetBy(start, step.dx, step.dy));
    const index = finger.menu.categories().findIndex((category) => category.id === 'category2');
    finger.tap(finger.categoryCenter(index));
    expect(finger.selectedCategory()).toBe('category2');
    const categories = finger.touch.categoryOffset();
    await playAndReturn(finger, 0);
    expect(finger.selectedCategory()).toBe('category2');
    expect(finger.touch.categoryOffset()).toBe(categories);
    expect(finger.touch.gridOffset()).toBe(0);
  });

  it('po obnovení stránky je vybraná „Vše“ a mřížka i kategorie jsou na začátku', () => {
    const finger = new FingerMenu(IPAD);
    scrollBoth(finger);
    finger.tap(categoryPoint(finger));
    const reloaded = new FingerMenu(IPAD);
    expect(reloaded.selectedCategory()).toBe('all');
    expect(reloaded.touch.gridOffset()).toBe(0);
    expect(reloaded.touch.categoryOffset()).toBe(0);
  });

  const rotations = [
    { from: IPAD, to: IPAD_PORTRAIT },
    { from: IPAD_PORTRAIT, to: IPAD },
    { from: PHONE_LANDSCAPE, to: PHONE_PORTRAIT },
    { from: PHONE_PORTRAIT, to: PHONE_LANDSCAPE },
  ];

  for (const { from, to } of rotations) {
    it(`po otočení ${from.name} → ${to.name} je vidět první celá dlaždice z doby před otočením`, () => {
      const finger = new FingerMenu(from);
      const grid = finger.gridCenter();
      finger.slowDrag(grid, offsetBy(grid, 0, -250));
      const anchor = finger.firstFullyVisibleTile();
      expect(anchor).toBeGreaterThan(0);
      finger.rotateTo(to);
      const layout = finger.layout();
      const tile = layout.tiles[anchor];
      const viewport = layout.gridScroll.viewport;
      const offset = finger.touch.gridOffset();
      expect(tile).toBeDefined();
      expect((tile?.top ?? -Infinity) - offset).toBeGreaterThanOrEqual(viewport.top - 0.01);
      expect((tile?.bottom ?? Infinity) - offset).toBeLessThanOrEqual(viewport.bottom + 0.01);
      expect(offset).toBeLessThanOrEqual(layout.gridScroll.maxOffset);
    });
  }

  it('po otočení zůstane vybraná kategorie', () => {
    const finger = new FingerMenu(PHONE_LANDSCAPE);
    finger.tap(categoryPoint(finger));
    finger.rotateTo(PHONE_PORTRAIT);
    expect(finger.selectedCategory()).toBe('category1');
  });

  it('po otočení zůstanou kategorie posunuté nanejvýš na konec', () => {
    const finger = new FingerMenu(PHONE_LANDSCAPE);
    const start = categoryPoint(finger);
    const step = categoryStep(finger, -150);
    for (let index = 0; index < 20; index += 1) {
      finger.slowDrag(start, offsetBy(start, step.dx, step.dy));
    }
    finger.rotateTo(IPAD_PORTRAIT);
    expect(finger.touch.categoryOffset()).toBeLessThanOrEqual(
      finger.layout().categoryScroll.maxOffset,
    );
    expect(finger.touch.categoryOffset()).toBeGreaterThanOrEqual(0);
  });

  it('po otočení během hry je po návratu vidět první celá dlaždice z doby před odchodem', async () => {
    const finger = new FingerMenu(PHONE_LANDSCAPE);
    const grid = finger.gridCenter();
    finger.slowDrag(grid, offsetBy(grid, 0, -250));
    const anchor = finger.firstFullyVisibleTile();
    expect(anchor).toBeGreaterThan(0);
    finger.tap(finger.tileCenter(anchor));
    await settle();
    expect(finger.menu.runningGame()).not.toBeNull();
    // Menu je schované, překreslí se až po návratu, už v novém okně.
    finger.window = PHONE_PORTRAIT;
    finger.menu.returnFromGame();
    finger.relayout();
    const layout = finger.layout();
    const tile = layout.tiles[anchor];
    const offset = finger.touch.gridOffset();
    const viewport = layout.gridScroll.viewport;
    expect((tile?.top ?? -Infinity) - offset).toBeGreaterThanOrEqual(viewport.top - 0.01);
    expect((tile?.bottom ?? Infinity) - offset).toBeLessThanOrEqual(viewport.bottom + 0.01);
  });
});
