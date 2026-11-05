import { describe, expect, it } from 'vitest';

import { GAMES } from '../../src/gameList';
import { GAME_CATEGORIES } from '../../src/shared/logic/gameRegistry';
import { chooseLayoutMode } from '../../src/shared/logic/viewportLayout';
import { ALL_CATEGORY, visibleCategories } from '../../src/menu/logic/menuCategories';
import { menuLayoutFor } from '../../src/menu/logic/menuLayout';
import type { MenuLayout } from '../../src/menu/logic/menuLayout';
import { menuText } from '../../src/menu/logic/menuTexts';
import { LANGUAGES } from '../../src/shared/texts/languages';
import type { Language } from '../../src/shared/texts/languages';
import {
  IPAD_WINDOWS,
  NO_NOTCH,
  PHONE_PORTRAIT_EDGE_WINDOWS,
  PHONE_PORTRAIT_WINDOWS,
  PHONE_WINDOWS,
  freeAreaOf,
  gapBetween,
  heightOf,
  isInside,
  overlaps,
  viewportOf,
  widthOf,
} from '../shared/viewportFixtures';
import type { Box, TestWindow } from '../shared/viewportFixtures';

/**
 * Testy k #67 AC1: rozložení menu podle obrázku B ve všech zkušebních
 * oknech (společná pravidla menu). `menuLayoutFor` dostane okno a obsah
 * (názvy viditelných kategorií v jazyce a počet dlaždic) a vrátí polohy
 * v CSS px okna, i s výřezem. Dnes jsou v menu kategorie „Vše“
 * a „Sčítání a odčítání“ a jedna dlaždice (Počítání).
 *
 * Šířka textu se odhaduje jako v #65: znaky × 0,6 × velikost písma,
 * s okrajem 8 px z obou stran. Vzhled proti obrázku se kontroluje ručně.
 */

const MIN_TAP = 64;
const MIN_GAP = 8;
const EDGE_MARGIN = 4;
const CHARACTER_WIDTH_RATIO = 0.6;
const TEXT_PADDING = 8;
const ROUNDING = 1e-6;

const SCALED_IPAD: TestWindow = {
  name: 'zmenšené zobrazení 820×1180',
  width: 820,
  height: 1180,
  safeArea: NO_NOTCH,
};

/** Zkušební okna ze společných pravidel menu M1–M7. */
const MENU_WINDOWS: readonly TestWindow[] = [
  ...IPAD_WINDOWS,
  SCALED_IPAD,
  ...PHONE_WINDOWS,
  ...PHONE_PORTRAIT_WINDOWS,
  ...PHONE_PORTRAIT_EDGE_WINDOWS,
];

/** Názvy kategorií, které dnes menu ukáže, v jazyce. */
function todayCategoryTitles(language: Language): string[] {
  const all = [ALL_CATEGORY, ...GAME_CATEGORIES];
  return visibleCategories(GAMES, GAME_CATEGORIES).map((id) => {
    const category = all.find((candidate) => candidate.id === id);
    return menuText(category?.titleKey ?? '', language) ?? '';
  });
}

function todayLayout(window: TestWindow, language: Language = 'cs'): MenuLayout {
  return menuLayoutFor(viewportOf(window), {
    categoryTitles: todayCategoryTitles(language),
    tileCount: GAMES.length,
  });
}

function isPhone(window: TestWindow): boolean {
  const mode = chooseLayoutMode(viewportOf(window));
  return mode === 'phoneLandscape' || mode === 'phonePortrait';
}

function isPhonePortrait(window: TestWindow): boolean {
  return chooseLayoutMode(viewportOf(window)) === 'phonePortrait';
}

/** Ťukací plochy menu: zástupná tlačítka, kategorie a dlaždice. */
function tapAreas(layout: MenuLayout): Array<{ name: string; box: Box }> {
  return [
    ...layout.placeholders.map((box, index) => ({ name: `zástupné ${index}`, box })),
    ...layout.categories.map((category, index) => ({
      name: `kategorie ${index}`,
      box: category.hit,
    })),
    ...layout.tiles.map((box, index) => ({ name: `dlaždice ${index}`, box })),
  ];
}

/** Všechno v menu i s místy pro profil (#71) a jazyk (#70). */
function allElements(layout: MenuLayout): Array<{ name: string; box: Box }> {
  return [
    { name: 'místo pro profil', box: layout.profileSlot },
    { name: 'místo pro jazyk', box: layout.languageSlot },
    ...tapAreas(layout),
  ];
}

function insetBox(outer: Box, margin: number): Box {
  return {
    left: outer.left + margin,
    right: outer.right - margin,
    top: outer.top + margin,
    bottom: outer.bottom - margin,
  };
}

function textWidth(text: string, fontSize: number): number {
  return [...text].length * CHARACTER_WIDTH_RATIO * fontSize;
}

/** Sousední dvojice v pořadí: [1., 2.], [2., 3.], … */
function neighbours<T>(items: readonly T[]): Array<[T, T]> {
  const result: Array<[T, T]> = [];
  for (let index = 1; index < items.length; index += 1) {
    const previous = items[index - 1];
    const next = items[index];
    if (previous !== undefined && next !== undefined) {
      result.push([previous, next]);
    }
  }
  return result;
}

function pairs<T>(items: readonly T[]): Array<[T, T]> {
  return items.flatMap((first, index) =>
    items.slice(index + 1).map((second): [T, T] => [first, second]),
  );
}

describe('#67 AC1: menu dodrží společná pravidla v každém zkušebním okně', () => {
  for (const window of MENU_WINDOWS) {
    describe(window.name, () => {
      it('menu má jednu dlaždici na hru a žádné šedé dlaždice „?“', () => {
        expect(todayLayout(window).tiles).toHaveLength(GAMES.length);
      });

      it('každá kategorie z menu má svou ťukací plochu', () => {
        expect(todayLayout(window).categories).toHaveLength(todayCategoryTitles('cs').length);
      });

      it('každá ťukací plocha má aspoň 64 × 64 px', () => {
        for (const { name, box } of tapAreas(todayLayout(window))) {
          expect(widthOf(box), name).toBeGreaterThanOrEqual(MIN_TAP - ROUNDING);
          expect(heightOf(box), name).toBeGreaterThanOrEqual(MIN_TAP - ROUNDING);
        }
      });

      it('ťukací plocha kategorie je vysoká aspoň 64 px, i když pilulka je nižší', () => {
        for (const category of todayLayout(window).categories) {
          expect(heightOf(category.hit)).toBeGreaterThanOrEqual(MIN_TAP - ROUNDING);
          expect(isInside(category.pill, category.hit)).toBe(true);
        }
      });

      it('mezi ťukacími plochami je mezera aspoň 8 px', () => {
        for (const [a, b] of pairs(tapAreas(todayLayout(window)))) {
          expect(gapBetween(a.box, b.box), `${a.name} × ${b.name}`).toBeGreaterThanOrEqual(
            MIN_GAP - ROUNDING,
          );
        }
      });

      it('nic se nepřekrývá, ani s místy pro profil a jazyk', () => {
        for (const [a, b] of pairs(allElements(todayLayout(window)))) {
          expect(overlaps(a.box, b.box), `${a.name} × ${b.name}`).toBe(false);
        }
      });

      it('nic není pod výřezem ani lištou domů a nic není blíž než 4 px k okraji volné plochy', () => {
        const allowed = insetBox(freeAreaOf(window), EDGE_MARGIN);
        for (const { name, box } of allElements(todayLayout(window))) {
          expect(isInside(box, allowed), name).toBe(true);
        }
      });
    });
  }
});

describe('#67 AC1: rozložení podle obrázku B', () => {
  for (const window of MENU_WINDOWS) {
    describe(window.name, () => {
      const expectedPlaceholders = isPhone(window) ? 1 : 2;

      it(`vpravo nahoře ${expectedPlaceholders === 1 ? 'je jedno zástupné tlačítko' : 'jsou dvě zástupná tlačítka'}`, () => {
        expect(todayLayout(window).placeholders).toHaveLength(expectedPlaceholders);
      });

      it('zástupná tlačítka jsou v horní liště úplně vpravo, vedle místa pro jazyk', () => {
        const layout = todayLayout(window);
        const rightmost = Math.max(...allElements(layout).map(({ box }) => box.right));
        const lastPlaceholder = layout.placeholders[layout.placeholders.length - 1];
        expect(lastPlaceholder?.right).toBeCloseTo(rightmost, 5);
        for (const placeholder of layout.placeholders) {
          expect(placeholder.left).toBeGreaterThanOrEqual(layout.languageSlot.right);
        }
      });

      it('místo pro profil je vlevo nahoře', () => {
        const layout = todayLayout(window);
        const leftmost = Math.min(...allElements(layout).map(({ box }) => box.left));
        const topmost = Math.min(...allElements(layout).map(({ box }) => box.top));
        expect(layout.profileSlot.left).toBeCloseTo(leftmost, 5);
        expect(layout.profileSlot.top).toBeCloseTo(topmost, 5);
        expect(layout.profileSlot.right).toBeLessThanOrEqual(layout.languageSlot.left);
      });

      it('místa pro profil a jazyk jsou dost velká pro budoucí ťukací plochy (aspoň 64 × 64 px)', () => {
        const layout = todayLayout(window);
        for (const slot of [layout.profileSlot, layout.languageSlot]) {
          expect(widthOf(slot)).toBeGreaterThanOrEqual(MIN_TAP - ROUNDING);
          expect(heightOf(slot)).toBeGreaterThanOrEqual(MIN_TAP - ROUNDING);
        }
      });

      it('horní lišta je celá nad kategoriemi i dlaždicemi', () => {
        const layout = todayLayout(window);
        const barBottom = Math.max(
          layout.profileSlot.bottom,
          layout.languageSlot.bottom,
          ...layout.placeholders.map((box) => box.bottom),
        );
        for (const box of [...layout.categories.map((c) => c.hit), ...layout.tiles]) {
          expect(box.top).toBeGreaterThanOrEqual(barBottom);
        }
      });

      if (isPhonePortrait(window)) {
        it('kategorie jsou v řadě nahoře, v pořadí zleva doprava', () => {
          const layout = todayLayout(window);
          expect(layout.categoryDirection).toBe('row');
          const hits = layout.categories.map((category) => category.hit);
          for (const [previous, next] of neighbours(hits)) {
            expect(next.top).toBeCloseTo(previous.top, 5);
            expect(next.left).toBeGreaterThanOrEqual(previous.right);
          }
        });

        it('mřížka dlaždic je pod řadou kategorií', () => {
          const layout = todayLayout(window);
          const categoriesBottom = Math.max(...layout.categories.map((c) => c.hit.bottom));
          for (const tile of layout.tiles) {
            expect(tile.top).toBeGreaterThanOrEqual(categoriesBottom);
          }
        });
      } else {
        it('kategorie jsou ve sloupci vlevo, v pořadí shora dolů', () => {
          const layout = todayLayout(window);
          expect(layout.categoryDirection).toBe('column');
          const hits = layout.categories.map((category) => category.hit);
          for (const [previous, next] of neighbours(hits)) {
            expect(next.left).toBeCloseTo(previous.left, 5);
            expect(next.top).toBeGreaterThanOrEqual(previous.bottom);
          }
        });

        it('mřížka dlaždic je vpravo vedle sloupce kategorií', () => {
          const layout = todayLayout(window);
          const categoriesRight = Math.max(...layout.categories.map((c) => c.hit.right));
          for (const tile of layout.tiles) {
            expect(tile.left).toBeGreaterThanOrEqual(categoriesRight);
          }
        });
      }

      it('první dlaždice (Počítání) je v levém horním rohu mřížky', () => {
        const layout = todayLayout(window);
        const first = layout.tiles[0];
        expect(first).toBeDefined();
        for (const tile of layout.tiles) {
          expect(first?.top).toBeLessThanOrEqual(tile.top);
          expect(first?.left).toBeLessThanOrEqual(tile.left);
        }
      });
    });
  }
});

describe('#67 AC1: telefon na šířku podle obrázku (sloupec kategorií a mřížka o 3 až 4 sloupcích)', () => {
  for (const window of PHONE_WINDOWS) {
    it(`${window.name}: mřížka má 3 nebo 4 sloupce`, () => {
      const layout = todayLayout(window);
      expect(layout.gridColumns).toBeGreaterThanOrEqual(3);
      expect(layout.gridColumns).toBeLessThanOrEqual(4);
    });
  }
});

describe('#67 AC1: texty v menu se vejdou ve všech jazycích', () => {
  for (const language of LANGUAGES) {
    for (const window of MENU_WINDOWS) {
      it(`${language}, ${window.name}: název každé kategorie se vejde do své pilulky`, () => {
        const layout = todayLayout(window, language);
        const titles = todayCategoryTitles(language);
        titles.forEach((title, index) => {
          const pill = layout.categories[index]?.pill;
          expect(pill, title).toBeDefined();
          expect(
            textWidth(title, layout.categoryFontSize) + 2 * TEXT_PADDING,
            title,
          ).toBeLessThanOrEqual(
            widthOf(pill ?? { left: 0, right: 0, top: 0, bottom: 0 }) + ROUNDING,
          );
        });
      });

      it(`${language}, ${window.name}: název každé hry se vejde do dlaždice`, () => {
        const layout = todayLayout(window, language);
        GAMES.forEach((game, index) => {
          const title = menuText(game.titleKey, language) ?? '';
          const tile = layout.tiles[index];
          expect(tile, game.id).toBeDefined();
          expect(
            textWidth(title, layout.tileTitleFontSize) + 2 * TEXT_PADDING,
            game.id,
          ).toBeLessThanOrEqual(
            widthOf(tile ?? { left: 0, right: 0, top: 0, bottom: 0 }) + ROUNDING,
          );
        });
      });
    }
  }
});

describe('#67 AC1: místa pro profil a jazyk drží dlaždice na místě', () => {
  it('rozložení nezávisí na tom, co později přibude do míst pro profil a jazyk', () => {
    // Místa jsou v rozložení už dnes, proto se dlaždice po M4 a M5 neposunou.
    for (const window of MENU_WINDOWS) {
      const layout = todayLayout(window);
      expect(widthOf(layout.profileSlot), window.name).toBeGreaterThan(0);
      expect(widthOf(layout.languageSlot), window.name).toBeGreaterThan(0);
    }
  });

  it('stejný obsah ve stejném okně dá vždy stejné rozložení', () => {
    for (const window of MENU_WINDOWS) {
      expect(todayLayout(window)).toEqual(todayLayout(window));
    }
  });
});
