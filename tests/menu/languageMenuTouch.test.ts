import { describe, expect, it } from 'vitest';

import { COAST_MAX_MS, DRAG_THRESHOLD_PX } from '../../src/menu/logic/menuScroll';
import { FingerMenu, MANY_GAMES, centerOf, findWindow, manyLanguages } from './manyGamesFixtures';
import type { Point } from './manyGamesFixtures';

/**
 * Testy k #70 AC1 a AC2, ovládání prstem: tlačítko jazyka, nabídka
 * a posouvání seznamu jazyků jako mřížka z #69. Menu se 40 hrami a 12
 * umělými jazyky (jen v testech).
 *
 * Navržené rozhraní (`src/menu/logic/menuTouch.ts`): dotyky jako v #69,
 * navíc `languageOffset()` o kolik px je seznam jazyků posunutý nahoru.
 * `pressed()` ukáže i jazyk zmáčknutý prstem (`{ kind: 'language' }`).
 */

const IPAD = findWindow('iPad 1180×820');
const PHONE_LANDSCAPE = findWindow('844×340');
const SMALLEST_LANDSCAPE = findWindow('744×296');
const PHONE_PORTRAIT = findWindow('390×844');

const WINDOWS = [IPAD, PHONE_LANDSCAPE, PHONE_PORTRAIT];
/** Okna, ve kterých se 12 jazyků do panelu nevejde. */
const SCROLL_WINDOWS = [IPAD, PHONE_LANDSCAPE, SMALLEST_LANDSCAPE];

function offsetBy(point: Point, dx: number, dy: number): Point {
  return { x: point.x + dx, y: point.y + dy };
}

function fingerMenu(window = IPAD): FingerMenu & { selections: string[] } {
  const languages = manyLanguages();
  const finger = new FingerMenu(window, MANY_GAMES, languages);
  return Object.assign(finger, { selections: languages.selections });
}

function openLanguages(finger: FingerMenu): void {
  finger.tap(finger.languageButtonCenter());
  expect(finger.menu.isLanguageMenuOpen()).toBe(true);
}

function currentLanguage(finger: FingerMenu): string | undefined {
  return finger.menu.languages().find((language) => language.selected)?.code;
}

/** Bod pod panelem nabídky: střed dlaždice, která pod panelem leží. */
function tileUnderPanel(finger: FingerMenu): { index: number; point: Point } {
  const layout = finger.layout();
  const panel = layout.languagePanel.panel;
  const index = layout.tiles.findIndex(
    (tile) =>
      tile.left < panel.right &&
      panel.left < tile.right &&
      tile.top < panel.bottom &&
      panel.top < tile.bottom,
  );
  const tile = layout.tiles[index];
  if (tile === undefined) {
    throw new Error('pod panelem není žádná dlaždice');
  }
  const point = {
    x: Math.min(Math.max((tile.left + tile.right) / 2, panel.left + 4), panel.right - 4),
    y: Math.min(Math.max((tile.top + tile.bottom) / 2, panel.top + 4), panel.bottom - 4),
  };
  return { index, point };
}

/** Bod na dlaždici, která je celá vidět, ale mimo panel nabídky. */
function tileOutsidePanel(finger: FingerMenu): Point {
  const layout = finger.layout();
  const panel = layout.languagePanel.panel;
  const viewport = layout.gridScroll.viewport;
  const isInPanel = (point: Point): boolean =>
    point.x >= panel.left &&
    point.x <= panel.right &&
    point.y >= panel.top &&
    point.y <= panel.bottom;
  for (const tile of layout.tiles) {
    if (tile.top < viewport.top || tile.bottom > viewport.bottom) {
      continue;
    }
    const middle = centerOf(tile);
    const candidates = [
      middle,
      { x: tile.left + 10, y: middle.y },
      { x: tile.right - 10, y: middle.y },
    ];
    const outside = candidates.find((point) => !isInPanel(point));
    if (outside !== undefined) {
      return outside;
    }
  }
  throw new Error('mimo panel není žádná dlaždice');
}

describe('#70 AC1: nabídka se otevře a zavře všemi třemi cestami', () => {
  for (const window of WINDOWS) {
    describe(window.name, () => {
      it('ťuknutí na tlačítko jazyka nabídku otevře', () => {
        const finger = fingerMenu(window);
        finger.tap(finger.languageButtonCenter());
        expect(finger.menu.isLanguageMenuOpen()).toBe(true);
      });

      it('druhé ťuknutí na tlačítko nabídku zavře beze změny jazyka', () => {
        const finger = fingerMenu(window);
        openLanguages(finger);
        finger.tap(finger.languageButtonCenter());
        expect(finger.menu.isLanguageMenuOpen()).toBe(false);
        expect(finger.selections).toEqual([]);
      });

      it('ťuknutí na jazyk ho vybere a nabídka se zavře', () => {
        const finger = fingerMenu(window);
        openLanguages(finger);
        finger.tap(finger.languageRowCenter(1));
        expect(currentLanguage(finger)).toBe('en');
        expect(finger.menu.isLanguageMenuOpen()).toBe(false);
      });

      it('ťuknutí mimo nabídku ji zavře beze změny jazyka', () => {
        const finger = fingerMenu(window);
        openLanguages(finger);
        finger.tap(tileOutsidePanel(finger));
        expect(finger.menu.isLanguageMenuOpen()).toBe(false);
        expect(finger.selections).toEqual([]);
        expect(finger.started).toEqual([]);
      });

      it('ťuknutí na okraj panelu mezi jazyky nabídku nezavře a nic nevybere', () => {
        const finger = fingerMenu(window);
        openLanguages(finger);
        const panel = finger.layout().languagePanel.panel;
        finger.tap({ x: (panel.left + panel.right) / 2, y: panel.top + 2 });
        expect(finger.menu.isLanguageMenuOpen()).toBe(true);
        expect(finger.selections).toEqual([]);
      });
    });
  }
});

describe('#70 AC1: ťuknutí pod nabídku nic nespustí', () => {
  for (const window of WINDOWS) {
    describe(window.name, () => {
      it('dlaždice pod otevřenou nabídkou hru nespustí ani nezmáčkne', async () => {
        const finger = fingerMenu(window);
        openLanguages(finger);
        // Řádek jazyka leží nad dlaždicí: ťuknutí vybere jazyk, ne hru.
        const { point } = tileUnderPanel(finger);
        finger.tap(point);
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(finger.started).toEqual([]);
        expect(finger.feedback.filter((event) => event.kind === 'press')).toEqual([]);
      });

      it('dlaždice mimo otevřenou nabídku hru nespustí, jen nabídku zavře', async () => {
        const finger = fingerMenu(window);
        openLanguages(finger);
        finger.tap(tileOutsidePanel(finger));
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(finger.started).toEqual([]);
        expect(finger.feedback.filter((event) => event.kind === 'press')).toEqual([]);
      });

      it('kategorie s otevřenou nabídkou se nevybere (na telefonu na výšku se neotevře výběr kategorie, #95)', () => {
        const finger = fingerMenu(window);
        openLanguages(finger);
        if (window === PHONE_PORTRAIT) {
          // Levý kraj tlačítka výběru, mimo panel nabídky jazyků vpravo.
          const button = finger.picker().button;
          finger.tap({ x: button.left + 20, y: (button.top + button.bottom) / 2 });
          expect(finger.menu.isCategoryMenuOpen()).toBe(false);
        } else {
          finger.tap(finger.categoryCenter(1));
        }
        expect(finger.selectedCategory()).toBe('all');
        expect(finger.feedback.filter((event) => event.kind === 'select')).toEqual([]);
      });

      it('zástupné tlačítko s otevřenou nabídkou se nezhoupne', () => {
        const finger = fingerMenu(window);
        openLanguages(finger);
        const placeholder = finger.layout().placeholders[0];
        expect(placeholder).toBeDefined();
        finger.tap(centerOf(placeholder ?? finger.layout().languageSlot));
        expect(finger.feedback.filter((event) => event.kind === 'wobble')).toEqual([]);
      });

      it('tah po mřížce s otevřenou nabídkou mřížku neposune', () => {
        const finger = fingerMenu(window);
        openLanguages(finger);
        const start = tileOutsidePanel(finger);
        finger.slowDrag(start, offsetBy(start, 0, -60));
        expect(finger.touch.gridOffset()).toBe(0);
      });

      it('s otevřenou nabídkou prst na dlaždici nic nezmáčkne', () => {
        const finger = fingerMenu(window);
        openLanguages(finger);
        finger.down(tileOutsidePanel(finger));
        expect(finger.touch.pressed()?.kind).not.toBe('tile');
        finger.up(tileOutsidePanel(finger));
      });

      it('po zavření nabídky dlaždice zase spustí hru', async () => {
        const finger = fingerMenu(window);
        openLanguages(finger);
        finger.tap(finger.languageButtonCenter());
        finger.tap(finger.tileCenter(0));
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(finger.started).toEqual([finger.menu.tiles()[0]?.gameId]);
      });
    });
  }
});

describe('#70 AC2: seznam jazyků se posouvá jako mřížka z #69', () => {
  for (const window of SCROLL_WINDOWS) {
    describe(window.name, () => {
      it('12 jazyků se do panelu nevejde', () => {
        expect(fingerMenu(window).layout().languagePanel.list.maxOffset).toBeGreaterThan(0);
      });

      it('po tažení prstem nahoru se seznam posune o stejný kus', () => {
        const finger = fingerMenu(window);
        openLanguages(finger);
        const start = finger.languageListCenter();
        finger.slowDrag(start, offsetBy(start, 0, -40));
        expect(finger.touch.languageOffset()).toBeCloseTo(40, 5);
      });

      it('tah delší než 10 px jazyk nevybere a nabídka zůstane otevřená', () => {
        const finger = fingerMenu(window);
        openLanguages(finger);
        const start = finger.languageRowCenter(0);
        finger.slowDrag(start, offsetBy(start, 0, -(DRAG_THRESHOLD_PX + 1)));
        expect(finger.selections).toEqual([]);
        expect(finger.menu.isLanguageMenuOpen()).toBe(true);
      });

      it('pohyb do 10 px je ještě ťuknutí a jazyk vybere', () => {
        const finger = fingerMenu(window);
        openLanguages(finger);
        const start = finger.languageRowCenter(1);
        finger.down(start);
        finger.move(offsetBy(start, 0, -DRAG_THRESHOLD_PX));
        finger.up(offsetBy(start, 0, -DRAG_THRESHOLD_PX));
        expect(currentLanguage(finger)).toBe('en');
      });

      it('na začátku se seznam zastaví, dál nahoru nejde', () => {
        const finger = fingerMenu(window);
        openLanguages(finger);
        const start = finger.languageListCenter();
        finger.slowDrag(start, offsetBy(start, 0, 80));
        expect(finger.touch.languageOffset()).toBe(0);
      });

      it('na konci se seznam zastaví u posledního jazyka', () => {
        const finger = fingerMenu(window);
        openLanguages(finger);
        const max = finger.layout().languagePanel.list.maxOffset;
        for (let attempt = 0; attempt < 10; attempt += 1) {
          const start = finger.languageListCenter();
          finger.slowDrag(start, offsetBy(start, 0, -80));
        }
        expect(finger.touch.languageOffset()).toBeCloseTo(max, 5);
      });

      it('posunutý poslední jazyk jde vybrat ťuknutím', () => {
        const finger = fingerMenu(window);
        openLanguages(finger);
        for (let attempt = 0; attempt < 10; attempt += 1) {
          const start = finger.languageListCenter();
          finger.slowDrag(start, offsetBy(start, 0, -80));
        }
        finger.tap(finger.languageRowCenter(11));
        expect(currentLanguage(finger)).toBe('uk');
      });

      it('druhý prst seznam neposouvá', () => {
        const finger = fingerMenu(window);
        openLanguages(finger);
        const start = finger.languageListCenter();
        finger.down(start, 1);
        finger.down(offsetBy(start, 20, 0), 2);
        finger.move(offsetBy(start, 20, -60), 2);
        finger.up(offsetBy(start, 20, -60), 2);
        expect(finger.touch.languageOffset()).toBe(0);
        finger.up(start, 1);
      });

      it('po rychlém tahu seznam dojede a do 1 s stojí', () => {
        const finger = fingerMenu(window);
        openLanguages(finger);
        const start = finger.languageListCenter();
        finger.drag(start, offsetBy(start, 0, -30), 50);
        const afterRelease = finger.touch.languageOffset();
        finger.wait(100);
        expect(finger.touch.languageOffset()).toBeGreaterThan(afterRelease);
        finger.wait(COAST_MAX_MS);
        const stopped = finger.touch.languageOffset();
        finger.wait(200);
        expect(finger.touch.languageOffset()).toBe(stopped);
      });

      it('dotyk během dojíždění seznam zastaví a jazyk nevybere', () => {
        const finger = fingerMenu(window);
        openLanguages(finger);
        const start = finger.languageListCenter();
        finger.drag(start, offsetBy(start, 0, -30), 50);
        finger.wait(32);
        finger.tap(finger.languageListCenter());
        expect(finger.selections).toEqual([]);
        expect(finger.menu.isLanguageMenuOpen()).toBe(true);
      });

      it('po novém otevření nabídky začíná seznam nahoře', () => {
        const finger = fingerMenu(window);
        openLanguages(finger);
        const start = finger.languageListCenter();
        finger.slowDrag(start, offsetBy(start, 0, -40));
        finger.tap(finger.languageButtonCenter());
        openLanguages(finger);
        expect(finger.touch.languageOffset()).toBe(0);
      });

      it('tah v seznamu jazyků mřížku ani kategorie neposune', () => {
        const finger = fingerMenu(window);
        openLanguages(finger);
        const start = finger.languageListCenter();
        finger.slowDrag(start, offsetBy(start, 0, -40));
        expect(finger.touch.gridOffset()).toBe(0);
        expect(finger.touch.categoryOffset()).toBe(0);
      });
    });
  }

  it('s dnešní češtinou se seznam nikde neposouvá ani tahem', () => {
    for (const window of WINDOWS) {
      const finger = new FingerMenu(window);
      openLanguages(finger);
      expect(finger.layout().languagePanel.list.maxOffset).toBe(0);
      const start = finger.languageListCenter();
      finger.slowDrag(start, offsetBy(start, 0, -40));
      expect(finger.touch.languageOffset()).toBe(0);
      expect(finger.menu.isLanguageMenuOpen()).toBe(true);
    }
  });
});

describe('#70 AC1: mřížka po zavření nabídky zůstane, jak byla', () => {
  it('posunutá mřížka zůstane posunutá po otevření a zavření nabídky', () => {
    const finger = fingerMenu(PHONE_LANDSCAPE);
    const start = finger.gridCenter();
    finger.slowDrag(start, offsetBy(start, 0, -60));
    const offset = finger.touch.gridOffset();
    openLanguages(finger);
    finger.tap(finger.languageButtonCenter());
    expect(finger.touch.gridOffset()).toBeCloseTo(offset, 5);
  });
});
