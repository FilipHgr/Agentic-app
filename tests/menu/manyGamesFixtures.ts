import { createMenu } from '../../src/menu/logic/menu';
import type { Menu, MenuFeedback, MenuLanguageSource } from '../../src/menu/logic/menu';
import { menuLayoutFor } from '../../src/menu/logic/menuLayout';
import type { MenuBox, MenuLayout } from '../../src/menu/logic/menuLayout';
import { DRAG_THRESHOLD_PX } from '../../src/menu/logic/menuScroll';
import { createMenuTouch } from '../../src/menu/logic/menuTouch';
import type { MenuTouch } from '../../src/menu/logic/menuTouch';
import type { GameCategory, GameEntry } from '../../src/shared/logic/gameRegistry';
import {
  IPAD_WINDOWS,
  NO_NOTCH,
  PHONE_PORTRAIT_EDGE_WINDOWS,
  PHONE_PORTRAIT_WINDOWS,
  PHONE_WINDOWS,
  viewportOf,
} from '../shared/viewportFixtures';
import type { TestWindow } from '../shared/viewportFixtures';

/**
 * Zkušební menu pro hodně her (#69), jen v testech: 40 her ve 12
 * kategoriích (s „Vše“ je jich v menu 13). Hry se nestahují doopravdy,
 * spuštění jen zaznamená, kterou hru dítě spustilo.
 */

export const MANY_CATEGORY_TITLES: readonly string[] = [
  'Sčítání a odčítání',
  'Násobení',
  'Dělení',
  'Tvary',
  'Hodiny',
  'Peníze',
  'Zlomky',
  'Porovnávání',
  'Logika',
  'Měření',
  'Slovní úlohy',
  'Geometrie',
];

export const MANY_CATEGORIES: readonly GameCategory[] = MANY_CATEGORY_TITLES.map((_, index) => ({
  id: `category${index + 1}`,
  titleKey: `categories.category${index + 1}.title`,
}));

const SYMBOLS = ['2+3', '△○', '3·4', '◷', '1<2', '½', '10+', '◫', '7−3', '★'];

export const MANY_GAMES_COUNT = 40;

export const MANY_GAMES: readonly GameEntry[] = Array.from(
  { length: MANY_GAMES_COUNT },
  (_, index) => ({
    id: `game${index + 1}`,
    titleKey: `games.game${index + 1}.title`,
    categoryId: `category${(index % MANY_CATEGORIES.length) + 1}`,
    symbol: SYMBOLS[index % SYMBOLS.length] ?? '?',
    access: 'free' as const,
    load: () => Promise.resolve({}),
  }),
);

/** Umělá čeština zkušebního menu. */
export const MANY_TEXTS_CS: Readonly<Record<string, string>> = Object.fromEntries([
  ['categories.all.title', 'Vše'],
  ...MANY_CATEGORY_TITLES.map((title, index) => [`categories.category${index + 1}.title`, title]),
  ...MANY_GAMES.map((game, index) => [game.titleKey, `Hra ${index + 1}`]),
]);

/** Všechny názvy kategorií v menu včetně „Vše“, v pořadí menu. */
export const MANY_MENU_CATEGORY_TITLES: readonly string[] = ['Vše', ...MANY_CATEGORY_TITLES];

const SCALED_IPAD: TestWindow = {
  name: 'zmenšené zobrazení 820×1180',
  width: 820,
  height: 1180,
  safeArea: NO_NOTCH,
};

/** Zkušební okna ze společných pravidel menu M1–M7. */
export const MENU_WINDOWS: readonly TestWindow[] = [
  ...IPAD_WINDOWS,
  SCALED_IPAD,
  ...PHONE_WINDOWS,
  ...PHONE_PORTRAIT_WINDOWS,
  ...PHONE_PORTRAIT_EDGE_WINDOWS,
];

export function findWindow(name: string): TestWindow {
  const found = MENU_WINDOWS.find((window) => window.name.startsWith(name));
  if (found === undefined) {
    throw new Error(`zkušební okno ${name} neexistuje`);
  }
  return found;
}

/**
 * Dvanáct umělých jazyků (#70 AC2), jen v testech, včetně dlouhého názvu
 * („Português do Brasil“). Kód je zkratka na tlačítku, název je vlastní
 * název jazyka v nabídce.
 */
export const MANY_LANGUAGE_NAMES: Readonly<Record<string, string>> = {
  cs: 'Čeština',
  en: 'English',
  de: 'Deutsch',
  fr: 'Français',
  es: 'Español',
  it: 'Italiano',
  pl: 'Polski',
  sk: 'Slovenčina',
  hu: 'Magyar',
  nl: 'Nederlands',
  pt: 'Português do Brasil',
  uk: 'Українська',
};

export const MANY_LANGUAGE_CODES: readonly string[] = Object.keys(MANY_LANGUAGE_NAMES);

/** Nejdelší název jazyka ze zkušebních jazyků. */
export const LONGEST_LANGUAGE_NAME = 'Português do Brasil';

/** Zkušební jazyky menu: pamatují si zvolený jazyk, nic neukládají. */
export function manyLanguages(initial = 'cs'): MenuLanguageSource & { selections: string[] } {
  let chosen = initial;
  const selections: string[] = [];
  return {
    supported: MANY_LANGUAGE_CODES,
    selections,
    current: () => chosen,
    select(language: string): boolean {
      selections.push(language);
      if (language === chosen || !MANY_LANGUAGE_CODES.includes(language)) {
        return false;
      }
      chosen = language;
      return true;
    },
    nameOf: (language) => MANY_LANGUAGE_NAMES[language] ?? language,
  };
}

/** Rozložení zkušebního menu s hrami vybrané kategorie. */
export function manyGamesLayout(
  window: TestWindow,
  tileCount = MANY_GAMES_COUNT,
  languageNames: readonly string[] = [],
): MenuLayout {
  return menuLayoutFor(viewportOf(window), {
    categoryTitles: MANY_MENU_CATEGORY_TITLES,
    tileCount,
    allTileCount: MANY_GAMES_COUNT,
    languageNames,
  });
}

export interface Point {
  readonly x: number;
  readonly y: number;
}

export function centerOf(box: MenuBox): Point {
  return { x: (box.left + box.right) / 2, y: (box.top + box.bottom) / 2 };
}

/**
 * Menu se 40 hrami ovládané prstem: logika menu, posouvání a rozložení
 * pro zvolené okno. Čas běží jen tak, jak ho test posune.
 */
export class FingerMenu {
  readonly menu: Menu;
  readonly touch: MenuTouch;
  readonly started: string[] = [];
  readonly feedback: MenuFeedback[] = [];
  /** Počet her v „Vše“: podle něj se volí výška dlaždic. */
  readonly gameCount: number;
  window: TestWindow;
  now = 0;

  constructor(
    window: TestWindow,
    games: readonly GameEntry[] = MANY_GAMES,
    languages?: MenuLanguageSource,
  ) {
    this.window = window;
    this.gameCount = games.length;
    this.menu = createMenu({
      games,
      categories: MANY_CATEGORIES,
      translate: (key) => MANY_TEXTS_CS[key] ?? key,
      start: (game) => {
        this.started.push(game.id);
      },
      feedback: (event) => this.feedback.push(event),
      languages,
    });
    this.touch = createMenuTouch({ menu: this.menu });
    this.relayout();
  }

  /** Rozložení pro současné okno a vybranou kategorii (jako překreslení scény). */
  layout(): MenuLayout {
    const categoryTitles = this.menu.categories().map((category) => category.title);
    return menuLayoutFor(viewportOf(this.window), {
      categoryTitles,
      tileCount: this.menu.tiles().length,
      allTileCount: this.gameCount,
      languageNames: this.menu.languages().map((language) => language.name),
    });
  }

  relayout(): void {
    this.touch.setLayout(this.layout());
  }

  /** Otočení zařízení nebo změna okna. */
  rotateTo(window: TestWindow): void {
    this.window = window;
    this.relayout();
  }

  /** Posune čas a nechá proběhnout snímky po 16 ms. */
  wait(ms: number): void {
    const end = this.now + ms;
    while (this.now < end) {
      this.now = Math.min(end, this.now + 16);
      this.touch.frame(this.now);
    }
  }

  down(point: Point, pointerId = 1): void {
    this.touch.pointerDown(pointerId, point, this.now);
  }

  move(point: Point, pointerId = 1): void {
    this.touch.pointerMove(pointerId, point, this.now);
  }

  up(point: Point, pointerId = 1): void {
    this.touch.pointerUp(pointerId, point, this.now);
    // Scéna po zvednutí prstu překreslí menu pro vybranou kategorii.
    this.relayout();
  }

  tap(point: Point, pointerId = 1): void {
    this.down(point, pointerId);
    this.wait(80);
    this.up(point, pointerId);
  }

  /** Tah prstem z `from` do `to` za `durationMs` po snímcích 16 ms, pak puštění. */
  drag(from: Point, to: Point, durationMs: number, pointerId = 1): void {
    this.down(from, pointerId);
    const steps = Math.max(1, Math.round(durationMs / 16));
    for (let step = 1; step <= steps; step += 1) {
      this.wait(durationMs / steps);
      const ratio = step / steps;
      this.move(
        { x: from.x + (to.x - from.x) * ratio, y: from.y + (to.y - from.y) * ratio },
        pointerId,
      );
    }
    this.up(to, pointerId);
  }

  /**
   * Pomalý tah, po kterém prst chvíli stojí a pak se zvedne (bez
   * setrvačnosti). Prst nejdřív překročí práh 10 px, od toho místa se
   * obsah posune přesně o vzdálenost z `from` do `to`.
   */
  slowDrag(from: Point, to: Point): void {
    const length = Math.hypot(to.x - from.x, to.y - from.y);
    const unit =
      length === 0 ? { x: 0, y: 0 } : { x: (to.x - from.x) / length, y: (to.y - from.y) / length };
    const lead = DRAG_THRESHOLD_PX + 1;
    this.down(from);
    this.wait(40);
    const start = { x: from.x + unit.x * lead, y: from.y + unit.y * lead };
    this.move(start);
    const steps = 50;
    for (let step = 1; step <= steps; step += 1) {
      this.wait(40);
      const ratio = step / steps;
      this.move({ x: start.x + (to.x - from.x) * ratio, y: start.y + (to.y - from.y) * ratio });
    }
    this.wait(200);
    this.up({ x: to.x + unit.x * lead, y: to.y + unit.y * lead });
  }

  /** Střed dlaždice na obrazovce, jak je teď posunutá. */
  tileCenter(index: number): Point {
    const box = this.layout().tiles[index];
    if (box === undefined) {
      throw new Error(`dlaždice ${index} v mřížce není`);
    }
    const center = centerOf(box);
    return { x: center.x, y: center.y - this.touch.gridOffset() };
  }

  /** Střed kategorie na obrazovce, jak je teď posunutá. */
  categoryCenter(index: number): Point {
    const layout = this.layout();
    const slot = layout.categories[index];
    if (slot === undefined) {
      throw new Error(`kategorie ${index} v menu není`);
    }
    const center = centerOf(slot.hit);
    const offset = this.touch.categoryOffset();
    return layout.categoryDirection === 'row'
      ? { x: center.x - offset, y: center.y }
      : { x: center.x, y: center.y - offset };
  }

  /** Střed viditelné plochy mřížky. */
  gridCenter(): Point {
    return centerOf(this.layout().gridScroll.viewport);
  }

  /** Střed tlačítka jazyka (#70). */
  languageButtonCenter(): Point {
    return centerOf(this.layout().languageSlot);
  }

  /** Střed řádku jazyka v nabídce, jak je teď posunutý (#70). */
  languageRowCenter(index: number): Point {
    const row = this.layout().languagePanel.rows[index];
    if (row === undefined) {
      throw new Error(`jazyk ${index} v nabídce není`);
    }
    const center = centerOf(row);
    return { x: center.x, y: center.y - this.touch.languageOffset() };
  }

  /** Střed viditelné plochy seznamu jazyků (#70). */
  languageListCenter(): Point {
    return centerOf(this.layout().languagePanel.list.viewport);
  }

  selectedCategory(): string | undefined {
    return this.menu.categories().find((category) => category.selected)?.id;
  }

  /** Index první dlaždice, která je celá vidět. */
  firstFullyVisibleTile(): number {
    const layout = this.layout();
    const viewport = layout.gridScroll.viewport;
    const offset = this.touch.gridOffset();
    return layout.tiles.findIndex(
      (tile) =>
        tile.top - offset >= viewport.top - 0.01 && tile.bottom - offset <= viewport.bottom + 0.01,
    );
  }
}
