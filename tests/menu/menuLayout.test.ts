import { describe, expect, it } from 'vitest';

import { GAMES } from '../../src/gameList';
import { chooseLayoutMode } from '../../src/shared/logic/viewportLayout';
import type { MenuBox, MenuLayout } from '../../src/menu/logic/menuLayout';
import { PHONE_WINDOWS, isInside, viewportOf } from '../shared/viewportFixtures';
import type { TestWindow } from '../shared/viewportFixtures';
import { MENU_WINDOWS, manyGamesLayout } from './manyGamesFixtures';
import {
  describeLayoutRules,
  gridScenes,
  todayCategoryTitles,
  todayLayout,
  todayUsesPicker,
} from './menuLayoutScenes';

/**
 * Testy k #67 AC1: rozložení menu podle obrázku B ve všech zkušebních
 * oknech. `menuLayoutFor` dostane okno a obsah (názvy viditelných
 * kategorií v jazyce a počet dlaždic) a vrátí polohy v CSS px okna, i s
 * výřezem. Dnes jsou v menu kategorie „Vše“ a „Sčítání a odčítání“
 * a jedna dlaždice (Počítání).
 *
 * Na telefonu na výšku je místo řady kategorií tlačítko výběru kategorie
 * (#95, `layout.categoryPicker`, jinde `null`) a `layout.categories` je
 * tam prázdné. Řádky seznamu a jejich rozložení hlídá
 * `categoryPickerLayout.test.ts`.
 *
 * Společná pravidla (vejde se, 4 px od okraje, nic se nepřekrývá, 64 px,
 * 8 px, text se vejde podle odhadu z #65) hlídá `describeLayoutRules` nad obrazovkami
 * z `menuLayoutScenes.ts` (#82). Tady zůstávají kontroly podle obrázku B,
 * každá jako jeden test v cyklu přes okna. Vzhled proti obrázku se
 * kontroluje ručně.
 */

/**
 * Kolik různých kombinací (okno × jazyk) pravidlo na mřížce her
 * a kategoriích hlídalo před #82: 17 oken menu v češtině, spočítáno
 * jednorázově z testů před #82.
 */
const TODAY_COMBINATIONS: Readonly<Record<string, number>> = {
  'vejde se do okna i mimo výřez': 17,
  'nic se nepřekrývá': 17,
  'ťukací plocha aspoň 64 px': 17,
  'mezera mezi plochami aspoň 8 px': 17,
  'aspoň 4 px od okraje': 17,
  'text se vejde do své plochy': 17,
};

describeLayoutRules('mřížka her a kategorie', gridScenes, TODAY_COMBINATIONS);

function isPhone(window: TestWindow): boolean {
  const mode = chooseLayoutMode(viewportOf(window));
  return mode === 'phoneLandscape' || mode === 'phonePortrait';
}

function isPhonePortrait(window: TestWindow): boolean {
  return chooseLayoutMode(viewportOf(window)) === 'phonePortrait';
}

/** Tlačítko výběru kategorie (#95), jen na telefonu na výšku. */
function pickerBoxes(layout: MenuLayout): MenuBox[] {
  const picker = layout.categoryPicker;
  return picker === null || picker === undefined ? [] : [picker.button];
}

/**
 * Všechno v menu i s místy pro profil (#71) a jazyk (#70). #157: místo
 * schovaných zástupných tlačítek „…“ zůstává vyhrazené (`reservedSlots`).
 */
function allBoxes(layout: MenuLayout): MenuBox[] {
  return [
    layout.profileSlot,
    layout.languageSlot,
    ...layout.reservedSlots,
    ...pickerBoxes(layout),
    ...layout.categories.map((category) => category.hit),
    ...layout.tiles,
  ];
}

/**
 * Plochy, které jsou na začátku vidět celé. Kategorie uříznutá okrajem
 * posouvaného sloupce se nepočítá, její viditelnou část hlídá pravidlo
 * 4 px od okraje.
 */
function wholeVisibleBoxes(layout: MenuLayout): MenuBox[] {
  const viewport = layout.categoryScroll.viewport;
  const categories = layout.categories
    .map((category) => category.hit)
    .filter((hit) => layout.categoryScroll.maxOffset === 0 || isInside(hit, viewport));
  return [
    layout.profileSlot,
    layout.languageSlot,
    // #157: vyhrazené místo po schovaných „…“.
    ...layout.reservedSlots,
    ...pickerBoxes(layout),
    ...categories,
    ...layout.tiles,
  ];
}

/** Sousední dvojice v pořadí: [1., 2.], [2., 3.], … */
function neighbours<T>(items: readonly T[]): Array<[T, T]> {
  return items.slice(1).map((next, index): [T, T] => [items[index] as T, next]);
}

describe('#67 AC1: rozložení podle obrázku B ve všech zkušebních oknech', () => {
  it('menu má jednu dlaždici na hru (žádné šedé „?“) a každá kategorie svou ťukací plochu (na telefonu na výšku a když se sloupec nevejde řádek seznamu, #95, #178)', () => {
    for (const window of MENU_WINDOWS) {
      const layout = todayLayout(window);
      const count = todayCategoryTitles('cs').length;
      expect(layout.tiles, window.name).toHaveLength(GAMES.length);
      if (todayUsesPicker(window)) {
        expect(layout.categories, window.name).toHaveLength(0);
        expect(layout.categoryPicker?.rows, window.name).toHaveLength(count);
      } else {
        expect(layout.categories, window.name).toHaveLength(count);
        expect(layout.categoryPicker ?? null, window.name).toBeNull();
      }
    }
  });

  it('pilulka kategorie je uvnitř ťukací plochy, i když je nižší než 64 px', () => {
    for (const window of MENU_WINDOWS) {
      todayLayout(window).categories.forEach((category, index) => {
        expect(isInside(category.pill, category.hit), `${window.name}: kategorie ${index}`).toBe(
          true,
        );
      });
    }
  });

  // #157: zástupná tlačítka „…“ jsou schovaná, jejich místo zůstává
  // vyhrazené (na telefonu jedno, na iPadu dvě místa po 64 px). Po UX
  // kontrole #157 je jazyk úplně vpravo a vyhrazená místa mezi profilem
  // a jazykem, aby vpravo od jazyka nebyla díra. Že nejsou vidět a lišta
  // se neposunula, hlídá hiddenPlaceholders.test.ts.
  it('vpravo nahoře je jazyk úplně vpravo a vlevo od něj na telefonu jedno a na iPadu dvě vyhrazená místa', () => {
    for (const window of MENU_WINDOWS) {
      const layout = todayLayout(window);
      expect(layout.reservedSlots, window.name).toHaveLength(isPhone(window) ? 1 : 2);
      const rightmost = Math.max(...wholeVisibleBoxes(layout).map((box) => box.right));
      expect(layout.languageSlot.right, window.name).toBeCloseTo(rightmost, 5);
      for (const reserved of layout.reservedSlots) {
        expect(reserved.right, window.name).toBeLessThanOrEqual(layout.languageSlot.left);
        expect(reserved.left, window.name).toBeGreaterThanOrEqual(layout.profileSlot.right);
      }
    }
  });

  it('místo pro profil je vlevo nahoře, vlevo od místa pro jazyk', () => {
    for (const window of MENU_WINDOWS) {
      const layout = todayLayout(window);
      const boxes = allBoxes(layout);
      expect(layout.profileSlot.left, window.name).toBeCloseTo(
        Math.min(...boxes.map((box) => box.left)),
        5,
      );
      expect(layout.profileSlot.top, window.name).toBeCloseTo(
        Math.min(...boxes.map((box) => box.top)),
        5,
      );
      expect(layout.profileSlot.right, window.name).toBeLessThanOrEqual(layout.languageSlot.left);
    }
  });

  it('horní lišta je celá nad kategoriemi i dlaždicemi', () => {
    for (const window of MENU_WINDOWS) {
      const layout = todayLayout(window);
      const barBottom = Math.max(
        layout.profileSlot.bottom,
        layout.languageSlot.bottom,
        // #157: vyhrazené místo po schovaných „…“ patří k liště.
        ...layout.reservedSlots.map((box) => box.bottom),
      );
      // #178: když se sloupec nevejde, je tlačítko výběru na telefonu na
      // šířku v liště mezi profilem a vyhrazeným místem, ne pod ní.
      const pickerInBar = !isPhonePortrait(window) && todayUsesPicker(window);
      for (const box of [
        ...(pickerInBar ? [] : pickerBoxes(layout)),
        ...layout.categories.map((c) => c.hit),
        ...layout.tiles,
      ]) {
        expect(box.top, window.name).toBeGreaterThanOrEqual(barBottom);
      }
      const button = layout.categoryPicker?.button;
      if (pickerInBar && button !== undefined) {
        const firstReserved = Math.min(
          layout.languageSlot.left,
          ...layout.reservedSlots.map((box) => box.left),
        );
        expect(button.top, window.name).toBeGreaterThanOrEqual(layout.profileSlot.top);
        expect(button.bottom, window.name).toBeLessThanOrEqual(barBottom);
        expect(button.left, window.name).toBeGreaterThanOrEqual(layout.profileSlot.right);
        expect(button.right, window.name).toBeLessThanOrEqual(firstReserved);
      }
    }
  });

  it('kategorie jdou v pořadí: v seznamu výběru shora dolů (na výšku #95, když se sloupec nevejde #178), jinak ve sloupci shora dolů', () => {
    for (const window of MENU_WINDOWS) {
      const layout = todayLayout(window);
      const hits = layout.categories.map((category) => category.hit);
      if (todayUsesPicker(window)) {
        const rows = layout.categoryPicker?.rows ?? [];
        expect(rows, window.name).toHaveLength(todayCategoryTitles('cs').length);
        for (const [previous, next] of neighbours(rows)) {
          expect(next.left, window.name).toBeCloseTo(previous.left, 5);
          expect(next.top, window.name).toBeGreaterThanOrEqual(previous.bottom);
        }
      } else {
        expect(layout.categoryDirection, window.name).toBe('column');
        for (const [previous, next] of neighbours(hits)) {
          expect(next.left, window.name).toBeCloseTo(previous.left, 5);
          expect(next.top, window.name).toBeGreaterThanOrEqual(previous.bottom);
        }
      }
    }
  });

  it('mřížka dlaždic je pod tlačítkem výběru kategorie (na výšku #95, když se sloupec nevejde #178), jinak vpravo vedle sloupce', () => {
    for (const window of MENU_WINDOWS) {
      const layout = todayLayout(window);
      const hits = layout.categories.map((category) => category.hit);
      for (const tile of layout.tiles) {
        if (todayUsesPicker(window)) {
          expect(pickerBoxes(layout), window.name).toHaveLength(1);
          expect(tile.top, window.name).toBeGreaterThanOrEqual(
            Math.max(...pickerBoxes(layout).map((box) => box.bottom)),
          );
        } else {
          expect(tile.left, window.name).toBeGreaterThanOrEqual(
            Math.max(...hits.map((hit) => hit.right)),
          );
        }
      }
    }
  });

  it('první dlaždice (Počítání) je v levém horním rohu mřížky', () => {
    for (const window of MENU_WINDOWS) {
      const layout = todayLayout(window);
      const first = layout.tiles[0];
      expect(first, window.name).toBeDefined();
      for (const tile of layout.tiles) {
        expect(first?.top, window.name).toBeLessThanOrEqual(tile.top);
        expect(first?.left, window.name).toBeLessThanOrEqual(tile.left);
      }
    }
  });
});

describe('#67 AC1: telefon na šířku podle obrázku (sloupec kategorií a mřížka o 3 až 4 sloupcích)', () => {
  // #156: když se dlaždice všech her vejdou bez posouvání (dnes 2 hry), jsou
  // větší a uprostřed a sloupců smí být méně. 3 až 4 sloupce platí dál, když
  // se dlaždice nevejdou (#156 AC2, zkušebních 40 her). Že se dnešní menu na
  // telefonu na šířku nezmění k horšímu, hlídá fewGamesLayout.test.ts
  // (dlaždice nikdy menší než dnes).
  it('na každém telefonu na šířku má posouvaná mřížka (40 her) 3 nebo 4 sloupce', () => {
    for (const window of PHONE_WINDOWS) {
      const columns = manyGamesLayout(window).gridColumns;
      expect(columns, window.name).toBeGreaterThanOrEqual(3);
      expect(columns, window.name).toBeLessThanOrEqual(4);
    }
  });
});

describe('#67 AC1: místa pro profil a jazyk drží dlaždice na místě', () => {
  it('stejný obsah ve stejném okně dá vždy stejné rozložení', () => {
    for (const window of MENU_WINDOWS) {
      expect(todayLayout(window), window.name).toEqual(todayLayout(window));
    }
  });
});
