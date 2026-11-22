import { afterEach, describe, expect, it, vi } from 'vitest';

import { GAMES } from '../../src/gameList';
import { menuLayoutFor } from '../../src/menu/logic/menuLayout';
import type { MenuBox, MenuLayout } from '../../src/menu/logic/menuLayout';
import { createMenuTouch } from '../../src/menu/logic/menuTouch';
import type { MenuTouch } from '../../src/menu/logic/menuTouch';
import { overlaps, viewportOf } from '../shared/viewportFixtures';
import type { TestWindow } from '../shared/viewportFixtures';
import { MANY_LANGUAGE_NAMES, manyGamesLayout } from './manyGamesFixtures';
import { TestLanguages, testMenu, watchedLocalStorage } from './menuFixtures';
import type { TestMenu } from './menuFixtures';
import {
  FEW_GAMES_WINDOWS,
  PICKER_CASES,
  WIDEST_NICKNAME,
  pickerLayout,
  todayCategoryTitles,
  todayLayout,
} from './menuLayoutScenes';

/**
 * Testy k #157: zástupná kolečka „…“ v liště menu se schovají, jejich
 * místo zůstává vyhrazené a tlačítko jazyka i profil zůstanou, kde byly.
 *
 * Navržené rozhraní:
 * - `MenuLayout` už nemá `placeholders` ani `placeholderFontSize` (scéna
 *   nemá co kreslit). Místo nich `reservedSlots: readonly MenuBox[]`:
 *   místa v liště vyhrazená pro budoucí volby (iPad 2, telefon 1). Nic se
 *   tam nekreslí a ťuknutí na ně nic nedělá; jiné části menu do nich nesmí.
 * - Po UX kontrole #157 (AC4, rozhodnutí koordinátora podle doporučení) se
 *   pořadí obrátilo: tlačítko jazyka je úplně vpravo, kde dřív bylo
 *   poslední „…“, a vyhrazená místa jsou mezi profilem a jazykem (na místě
 *   dřívějšího jazyka a ostatních „…“). Vpravo od jazyka tak není díra.
 *   Výška lišty a všechno pod ní zůstávají stejné.
 * - `Menu` už nemá `tapPlaceholder` a odezva `wobble` nemá cíl
 *   `placeholder`. `menuTouch` ťuknutí na vyhrazené místo bere jako ťuknutí
 *   na prázdné místo (nic nevybere, nic nezhoupne, stahování nezruší;
 *   otevřenou nabídku jazyků nebo seznam kategorií zavře jako jinde mimo).
 * - Výběr profilu (`profilePickerLayoutFor`) žádná zástupná tlačítka nemá.
 *
 * Polohy v tabulce jsou spočítané jednorázově z HEAD 7181f4a (před #157)
 * pro všechna okna testů menu (okna menu a okna z plochy, #78), v CSS px
 * okna jako [vlevo, nahoře, vpravo, dole]. Ťuká se na středy míst, kde
 * jsou vyhrazená místa po obrácení pořadí, spočítané z tabulky, ne podle
 * nového rozložení.
 *
 * Ruční kontrola (AC4): lišta ve WebKitu nemá prázdnou díru, která by
 * vypadala rozbitě.
 */

type Edges = readonly [number, number, number, number];

interface BarBefore157 {
  readonly window: string;
  /** Místo pro profil (#71). */
  readonly profile: Edges;
  /** Kolečko profilu bez přezdívky. */
  readonly profileCircle: Edges;
  readonly language: Edges;
  /** Kde byla zástupná kolečka „…“. */
  readonly reserved: readonly Edges[];
  /** Horní kraj viditelné plochy mřížky her. */
  readonly gridTop: number;
  /** Horní kraj viditelné plochy kategorií. */
  readonly categoryTop: number;
  /** Horní kraj tlačítka výběru kategorie (#95), jen na telefonu na výšku. */
  readonly pickerTop: number | null;
  /** Tlačítko jazyka na výběru profilu. */
  readonly pickerLanguage: Edges;
}

/** Lišta menu na HEAD 7181f4a (před #157), dnešní hry a kategorie v češtině. */
const BAR_BEFORE_157: readonly BarBefore157[] = [
  {
    window: 'iPad 1180×820',
    profile: [24, 12, 264, 76],
    profileCircle: [24, 12, 88, 76],
    language: [932, 12, 996, 76],
    reserved: [
      [1012, 12, 1076, 76],
      [1092, 12, 1156, 76],
    ],
    gridTop: 80,
    categoryTop: 100,
    pickerTop: null,
    pickerLanguage: [1092, 12, 1168, 88],
  },
  {
    window: 'iPad 1180×760',
    profile: [24, 12, 264, 76],
    profileCircle: [24, 12, 88, 76],
    language: [932, 12, 996, 76],
    reserved: [
      [1012, 12, 1076, 76],
      [1092, 12, 1156, 76],
    ],
    gridTop: 80,
    categoryTop: 100,
    pickerTop: null,
    pickerLanguage: [1092, 12, 1168, 88],
  },
  {
    window: 'zmenšené zobrazení 820×1180',
    profile: [24, 12, 264, 76],
    profileCircle: [24, 12, 88, 76],
    language: [572, 12, 636, 76],
    reserved: [
      [652, 12, 716, 76],
      [732, 12, 796, 76],
    ],
    gridTop: 80,
    categoryTop: 100,
    pickerTop: null,
    pickerLanguage: [732, 12, 808, 88],
  },
  {
    window: '744×296 nejmenší telefon',
    profile: [8, 8, 228, 72],
    profileCircle: [8, 8, 72, 72],
    language: [600, 8, 664, 72],
    reserved: [[672, 8, 736, 72]],
    gridTop: 76,
    categoryTop: 76,
    pickerTop: null,
    pickerLanguage: [672, 8, 736, 72],
  },
  {
    window: '800×300 Samsung s Chromem',
    profile: [8, 8, 228, 72],
    profileCircle: [8, 8, 72, 72],
    language: [656, 8, 720, 72],
    reserved: [[728, 8, 792, 72]],
    gridTop: 76,
    categoryTop: 76,
    pickerTop: null,
    pickerLanguage: [728, 8, 792, 72],
  },
  {
    window: '844×340 iPhone se Safari',
    profile: [55, 8, 275, 72],
    profileCircle: [55, 8, 119, 72],
    language: [653, 8, 717, 72],
    reserved: [[725, 8, 789, 72]],
    gridTop: 76,
    categoryTop: 76,
    pickerTop: null,
    pickerLanguage: [725, 8, 789, 72],
  },
  {
    window: '932×430 iPhone Pro Max',
    profile: [67, 8, 287, 72],
    profileCircle: [67, 8, 131, 72],
    language: [729, 8, 793, 72],
    reserved: [[801, 8, 865, 72]],
    gridTop: 76,
    categoryTop: 76,
    pickerTop: null,
    pickerLanguage: [801, 8, 865, 72],
  },
  {
    window: '932×499 těsně pod hranicí',
    profile: [8, 8, 228, 72],
    profileCircle: [8, 8, 72, 72],
    language: [788, 8, 852, 72],
    reserved: [[860, 8, 924, 72]],
    gridTop: 76,
    categoryTop: 76,
    pickerTop: null,
    pickerLanguage: [860, 8, 924, 72],
  },
  {
    window: '932×499 těsně pod hranicí s výřezem',
    profile: [67, 8, 287, 72],
    profileCircle: [67, 8, 131, 72],
    language: [729, 8, 793, 72],
    reserved: [[801, 8, 865, 72]],
    gridTop: 76,
    categoryTop: 76,
    pickerTop: null,
    pickerLanguage: [801, 8, 865, 72],
  },
  {
    window: '390×844 iPhone 13–15 (výřez 47, lišta 34)',
    profile: [16, 59, 92, 123],
    profileCircle: [16, 59, 80, 123],
    language: [230, 59, 294, 123],
    reserved: [[310, 59, 374, 123]],
    gridTop: 203,
    categoryTop: 131,
    pickerTop: 135,
    pickerLanguage: [318, 55, 382, 119],
  },
  {
    window: '390×664 iPhone v Safari s lištou',
    profile: [16, 12, 92, 76],
    profileCircle: [16, 12, 80, 76],
    language: [230, 12, 294, 76],
    reserved: [[310, 12, 374, 76]],
    gridTop: 156,
    categoryTop: 84,
    pickerTop: 88,
    pickerLanguage: [318, 8, 382, 72],
  },
  {
    window: '360×780 Samsung s Chromem',
    profile: [16, 12, 92, 76],
    profileCircle: [16, 12, 80, 76],
    language: [200, 12, 264, 76],
    reserved: [[280, 12, 344, 76]],
    gridTop: 156,
    categoryTop: 84,
    pickerTop: 88,
    pickerLanguage: [288, 8, 352, 72],
  },
  {
    window: '375×667 iPhone SE',
    profile: [16, 12, 92, 76],
    profileCircle: [16, 12, 80, 76],
    language: [215, 12, 279, 76],
    reserved: [[295, 12, 359, 76]],
    gridTop: 156,
    categoryTop: 84,
    pickerTop: 88,
    pickerLanguage: [303, 8, 367, 72],
  },
  {
    window: '430×932 iPhone Pro Max (výřez 59, lišta 34)',
    profile: [16, 71, 92, 135],
    profileCircle: [16, 71, 80, 135],
    language: [270, 71, 334, 135],
    reserved: [[350, 71, 414, 135]],
    gridTop: 215,
    categoryTop: 143,
    pickerTop: 147,
    pickerLanguage: [358, 67, 422, 131],
  },
  {
    window: '360×620 nejmenší telefon na výšku',
    profile: [16, 12, 92, 76],
    profileCircle: [16, 12, 80, 76],
    language: [200, 12, 264, 76],
    reserved: [[280, 12, 344, 76]],
    gridTop: 156,
    categoryTop: 84,
    pickerTop: 88,
    pickerLanguage: [288, 8, 352, 72],
  },
  {
    window: '499×932 těsně pod hranicí šířky',
    profile: [16, 12, 92, 76],
    profileCircle: [16, 12, 80, 76],
    language: [339, 12, 403, 76],
    reserved: [[419, 12, 483, 76]],
    gridTop: 156,
    categoryTop: 84,
    pickerTop: 88,
    pickerLanguage: [427, 8, 491, 72],
  },
  {
    window: '375×1180 úzký iPad (Split View)',
    profile: [16, 12, 92, 76],
    profileCircle: [16, 12, 80, 76],
    language: [215, 12, 279, 76],
    reserved: [[295, 12, 359, 76]],
    gridTop: 156,
    categoryTop: 84,
    pickerTop: 88,
    pickerLanguage: [303, 8, 367, 72],
  },
  {
    window: 'iPad na šířku z plochy (stavový řádek 24, lišta 20)',
    profile: [24, 36, 264, 100],
    profileCircle: [24, 36, 88, 100],
    language: [932, 36, 996, 100],
    reserved: [
      [1012, 36, 1076, 100],
      [1092, 36, 1156, 100],
    ],
    gridTop: 104,
    categoryTop: 124,
    pickerTop: null,
    pickerLanguage: [1092, 36, 1168, 112],
  },
  {
    window: 'iPhone 430×932 na výšku z plochy (výřez 59, lišta 34)',
    profile: [16, 71, 92, 135],
    profileCircle: [16, 71, 80, 135],
    language: [270, 71, 334, 135],
    reserved: [[350, 71, 414, 135]],
    gridTop: 215,
    categoryTop: 143,
    pickerTop: 147,
    pickerLanguage: [358, 67, 422, 131],
  },
  {
    window: 'iPhone 393×852 na výšku z plochy (výřez 59, lišta 34)',
    profile: [16, 71, 92, 135],
    profileCircle: [16, 71, 80, 135],
    language: [233, 71, 297, 135],
    reserved: [[313, 71, 377, 135]],
    gridTop: 215,
    categoryTop: 143,
    pickerTop: 147,
    pickerLanguage: [321, 67, 385, 131],
  },
  {
    window: 'iPhone 932×430 na šířku z plochy (výřez 59, lišta 21)',
    profile: [67, 8, 287, 72],
    profileCircle: [67, 8, 131, 72],
    language: [729, 8, 793, 72],
    reserved: [[801, 8, 865, 72]],
    gridTop: 76,
    categoryTop: 76,
    pickerTop: null,
    pickerLanguage: [801, 8, 865, 72],
  },
];

function edgesOf(box: MenuBox): Edges {
  return [box.left, box.top, box.right, box.bottom];
}

function boxOf(edges: Edges): MenuBox {
  const [left, top, right, bottom] = edges;
  return { left, top, right, bottom };
}

function centerOf(edges: Edges): { x: number; y: number } {
  const [left, top, right, bottom] = edges;
  return { x: (left + right) / 2, y: (top + bottom) / 2 };
}

function windowOf(row: BarBefore157): TestWindow {
  const found = FEW_GAMES_WINDOWS.find((window) => window.name === row.window);
  if (found === undefined) {
    throw new Error(`zkušební okno ${row.window} neexistuje`);
  }
  return found;
}

/** Rozdíl dvou poloh jako věta, nebo prázdný seznam, když se shodují. */
function moved(label: string, actual: Edges, before: Edges): string[] {
  const same = actual.every((value, index) => Math.abs(value - (before[index] ?? NaN)) < 0.01);
  return same ? [] : [`${label}: je na [${actual.join(', ')}], dřív [${before.join(', ')}]`];
}

/**
 * Menu se zkušebními hrami ovládané prstem (falešné stahování a hra
 * z `menuFixtures.ts`), rozložení podle okna jako po překreslení scény.
 */
class FingerTestMenu {
  readonly test: TestMenu;
  readonly touch: MenuTouch;
  private now = 0;

  constructor(private readonly window: TestWindow) {
    this.test = testMenu({ languages: new TestLanguages() });
    this.touch = createMenuTouch({ menu: this.test.menu });
    this.relayout();
  }

  layout(): MenuLayout {
    const menu = this.test.menu;
    return menuLayoutFor(viewportOf(this.window), {
      categoryTitles: menu.categories().map((category) => category.title),
      tileCount: menu.tiles().length,
      languageNames: menu.languages().map((language) => language.name),
    });
  }

  relayout(): void {
    this.touch.setLayout(this.layout());
  }

  down(point: { x: number; y: number }): void {
    this.touch.pointerDown(1, point, this.now);
  }

  up(point: { x: number; y: number }): void {
    this.now += 80;
    this.touch.frame(this.now);
    this.touch.pointerUp(1, point, this.now);
    this.relayout();
  }

  tap(point: { x: number; y: number }): void {
    this.down(point);
    this.up(point);
  }

  selectedCategory(): string | undefined {
    return this.test.menu.categories().find((category) => category.selected)?.id;
  }
}

/**
 * #157 po UX kontrole: jazyk jde úplně vpravo na místo posledního „…“.
 * Kde má být tlačítko jazyka podle tabulky z doby před #157.
 */
function languageAfter157(row: BarBefore157): Edges {
  const last = row.reserved[row.reserved.length - 1];
  if (last === undefined) {
    throw new Error(`${row.window}: v tabulce chybí místo „…“`);
  }
  return last;
}

/**
 * #157 po UX kontrole: vyhrazená místa jsou mezi profilem a jazykem, na
 * místě dřívějšího jazyka a všech „…“ kromě posledního, zleva doprava.
 */
function reservedAfter157(row: BarBefore157): readonly Edges[] {
  return [row.language, ...row.reserved.slice(0, -1)];
}

/** Každé vyhrazené místo v liště v každém okně testů menu. */
function reservedPlaces(): Array<{ label: string; window: TestWindow; place: Edges }> {
  return BAR_BEFORE_157.flatMap((row) =>
    reservedAfter157(row).map((place, index) => ({
      label: `${row.window}, místo ${index + 1}`,
      window: windowOf(row),
      place,
    })),
  );
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('#157 AC1: zástupná kolečka „…“ nejsou vidět ani nereagují', () => {
  it('tabulka pokrývá všechna okna testů menu', () => {
    expect(BAR_BEFORE_157.map((row) => row.window)).toEqual(
      FEW_GAMES_WINDOWS.map((window) => window.name),
    );
  });

  it('v menu nejsou v žádném okně vidět žádná zástupná kolečka „…“', () => {
    const shown = FEW_GAMES_WINDOWS.filter((window) => 'placeholders' in todayLayout(window)).map(
      (window) => `${window.name}: rozložení má zástupná tlačítka`,
    );
    expect(shown).toEqual([]);
  });

  it('na výběru profilu nejsou v žádném okně vidět žádná zástupná kolečka „…“', () => {
    const shown = FEW_GAMES_WINDOWS.flatMap((window) =>
      PICKER_CASES.filter(
        ({ count, add }) => 'placeholders' in pickerLayout(window, count, add),
      ).map(({ name }) => `${window.name}, ${name}: výběr profilu má zástupná tlačítka`),
    );
    expect(shown).toEqual([]);
  });

  it('menu nemá žádné ťuknutí na zástupné kolečko', () => {
    expect(testMenu().menu).not.toHaveProperty('tapPlaceholder');
  });

  it('ťuknutí na vyhrazené místo v liště, nic nezhoupne, nezazní, nevybere ani nespustí', () => {
    const problems = reservedPlaces().flatMap(({ label, window, place }) => {
      const finger = new FingerTestMenu(window);
      finger.tap(centerOf(place));
      const { test } = finger;
      return [
        ...(test.feedback.length === 0 ? [] : [`${label}: odezva ${test.kinds().join(', ')}`]),
        ...(test.sounds().length === 0 ? [] : [`${label}: zazní ${test.sounds().join(', ')}`]),
        ...(test.download.count === 0 ? [] : [`${label}: stahuje se hra`]),
        ...(test.game.started.length === 0 ? [] : [`${label}: spustí se hra`]),
        ...(test.profileOpened() === 0 ? [] : [`${label}: otevře se výběr profilu`]),
        ...(test.menu.isLanguageMenuOpen() ? [`${label}: otevře se nabídka jazyků`] : []),
        ...(test.menu.isCategoryMenuOpen() ? [`${label}: otevře se seznam kategorií`] : []),
        ...(finger.selectedCategory() === 'all' ? [] : [`${label}: změní se kategorie`]),
      ];
    });
    expect(problems).toEqual([]);
  });

  it('prst na vyhrazeném místě v liště, nic nezmáčkne', () => {
    const problems = reservedPlaces().flatMap(({ label, window, place }) => {
      const finger = new FingerTestMenu(window);
      finger.down(centerOf(place));
      const pressed = finger.touch.pressed();
      return pressed === undefined ? [] : [`${label}: zmáčkne se ${pressed.kind}`];
    });
    expect(problems).toEqual([]);
  });

  it('ťuknutí na vyhrazené místo v liště, nic neuloží', () => {
    const storage = watchedLocalStorage();
    for (const { window, place } of reservedPlaces()) {
      new FingerTestMenu(window).tap(centerOf(place));
    }
    expect(storage.writes).toEqual([]);
  });

  it('rychlé dvojí ťuknutí na vyhrazené místo v liště, nic neshodí ani nezhoupne', () => {
    const problems = reservedPlaces().flatMap(({ label, window, place }) => {
      const finger = new FingerTestMenu(window);
      try {
        finger.tap(centerOf(place));
        finger.tap(centerOf(place));
      } catch (error) {
        return [`${label}: spadne (${String(error)})`];
      }
      return finger.test.feedback.length === 0
        ? []
        : [`${label}: odezva ${finger.test.kinds().join(', ')}`];
    });
    expect(problems).toEqual([]);
  });

  // Dřív ťuknutí na „…“ stahování hry zrušilo (#67 AC5). Schované „…“ je
  // prázdné místo: ťuknutí na něj nic nedělá, hra se stáhne a naběhne.
  it('ťuknutí na vyhrazené místo v liště, během stahování hru nezruší a hra po stažení naběhne', async () => {
    vi.useFakeTimers();
    const problems: string[] = [];
    for (const { label, window, place } of reservedPlaces()) {
      const finger = new FingerTestMenu(window);
      finger.test.menu.tapTile('zebra');
      await vi.advanceTimersByTimeAsync(1000);
      finger.tap(centerOf(place));
      finger.test.download.succeed();
      await vi.advanceTimersByTimeAsync(1000);
      if (finger.test.menu.runningGame()?.id !== 'zebra') {
        problems.push(`${label}: hra nenaběhla`);
      }
      if (finger.test.kinds().includes('wobble')) {
        problems.push(`${label}: něco se zhouplo`);
      }
    }
    expect(problems).toEqual([]);
  });
});

describe('#157 AC2: místo v liště zůstává, profil se neposune, jazyk je úplně vpravo', () => {
  // #157 po UX kontrole: jazyk je úplně vpravo, kde bylo poslední „…“,
  // ve stejné výšce jako dřív (dřív hlídal „na stejném místě jako dřív“).
  it('tlačítko jazyka je v menu úplně vpravo na místě posledního „…“, i se 40 hrami a 12 jazyky', () => {
    const manyNames = Object.values(MANY_LANGUAGE_NAMES);
    const problems = BAR_BEFORE_157.flatMap((row) => {
      const window = windowOf(row);
      return [
        ...moved(
          `${row.window}, dnešní menu`,
          edgesOf(todayLayout(window).languageSlot),
          languageAfter157(row),
        ),
        ...moved(
          `${row.window}, 40 her a 12 jazyků`,
          edgesOf(manyGamesLayout(window, undefined, manyNames).languageSlot),
          languageAfter157(row),
        ),
      ];
    });
    expect(problems).toEqual([]);
  });

  it('profil (místo i kolečko) je v menu na stejném místě jako dřív', () => {
    const problems = BAR_BEFORE_157.flatMap((row) => {
      const layout = todayLayout(windowOf(row));
      return [
        ...moved(`${row.window}: místo pro profil`, edgesOf(layout.profileSlot), row.profile),
        ...moved(
          `${row.window}: kolečko profilu`,
          edgesOf(layout.profileBadge.circle),
          row.profileCircle,
        ),
      ];
    });
    expect(problems).toEqual([]);
  });

  // #157 po UX kontrole: vyhrazená místa jsou mezi profilem a jazykem.
  it('místo pro budoucí volby zůstává v liště vyhrazené mezi profilem a jazykem (iPad 2, telefon 1)', () => {
    const problems = BAR_BEFORE_157.flatMap((row) => {
      const reserved = todayLayout(windowOf(row)).reservedSlots ?? [];
      const expected = reservedAfter157(row);
      if (reserved.length !== row.reserved.length) {
        return [`${row.window}: ${reserved.length} vyhrazených míst místo ${row.reserved.length}`];
      }
      return reserved.flatMap((box, index) =>
        moved(`${row.window}, místo ${index + 1}`, edgesOf(box), expected[index] ?? [0, 0, 0, 0]),
      );
    });
    expect(problems).toEqual([]);
  });

  /** Počet kategorií v době #157: Vše, Sčítání a odčítání, Kreslení. */
  const CATEGORIES_AT_157 = 3;

  // Kategorie jako v době #157 (bez Čísel z #178): čtvrtá kategorie
  // nahradí na nízkém telefonu na šířku sloupec výběrem, to s lištou nesouvisí.
  it('lišta se neposunula: kategorie, výběr kategorie a mřížka začínají na stejném místě', () => {
    const problems = BAR_BEFORE_157.flatMap((row) => {
      const layout = menuLayoutFor(viewportOf(windowOf(row)), {
        categoryTitles: todayCategoryTitles().slice(0, CATEGORIES_AT_157),
        tileCount: GAMES.length,
      });
      const pickerTop = layout.categoryPicker?.button.top ?? null;
      const tops: Array<[string, number | null, number | null]> = [
        ['mřížka', layout.gridScroll.viewport.top, row.gridTop],
        ['kategorie', layout.categoryScroll.viewport.top, row.categoryTop],
        ['výběr kategorie', pickerTop, row.pickerTop],
      ];
      return tops
        .filter(([, actual, before]) => actual !== before)
        .map(([name, actual, before]) => `${row.window}: ${name} nahoře ${actual}, dřív ${before}`);
    });
    expect(problems).toEqual([]);
  });

  it('do vyhrazeného místa nezasahuje kategorie, dlaždice, výběr kategorie ani nejdelší přezdívka', () => {
    const problems = BAR_BEFORE_157.flatMap((row) => {
      const layout = menuLayoutFor(viewportOf(windowOf(row)), {
        categoryTitles: todayCategoryTitles(),
        tileCount: todayLayout(windowOf(row)).tiles.length,
        profileNickname: WIDEST_NICKNAME,
      });
      const others: Array<[string, MenuBox]> = [
        ['místo pro profil', layout.profileSlot],
        ['tlačítko jazyka', layout.languageSlot],
        ...layout.categories.map((category, index): [string, MenuBox] => [
          `kategorie ${index + 1}`,
          category.hit,
        ]),
        ...layout.tiles.map((tile, index): [string, MenuBox] => [`dlaždice ${index + 1}`, tile]),
        ...(layout.categoryPicker === null
          ? []
          : [['výběr kategorie', layout.categoryPicker.button] as [string, MenuBox]]),
        ...(layout.profileBadge.label === null
          ? []
          : [['přezdívka', layout.profileBadge.label] as [string, MenuBox]]),
      ];
      return reservedAfter157(row).flatMap((place, index) =>
        others
          .filter(([, box]) => overlaps(box, boxOf(place)))
          .map(([name]) => `${row.window}: ${name} zasahuje do místa ${index + 1}`),
      );
    });
    expect(problems).toEqual([]);
  });

  it('tlačítko jazyka je na výběru profilu na stejném místě jako dřív', () => {
    const problems = BAR_BEFORE_157.flatMap((row) =>
      PICKER_CASES.flatMap(({ name, count, add }) =>
        moved(
          `${row.window}, ${name}`,
          edgesOf(pickerLayout(windowOf(row), count, add).languageSlot),
          row.pickerLanguage,
        ),
      ),
    );
    expect(problems).toEqual([]);
  });
});
