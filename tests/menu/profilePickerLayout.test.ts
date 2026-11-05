import { describe, expect, it } from 'vitest';

import { profilePickerLayoutFor } from '../../src/menu/logic/profileLayout';
import type { ProfilePickerLayout } from '../../src/menu/logic/profileLayout';
import type { MenuBox } from '../../src/menu/logic/menuLayout';
import { chooseLayoutMode } from '../../src/shared/logic/viewportLayout';
import { LANGUAGES } from '../../src/shared/texts/languages';
import { sharedTexts } from '../../src/shared/texts/sharedTexts';
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
import { MENU_WINDOWS } from './manyGamesFixtures';

/**
 * Testy k #72 AC1 a AC4, rozložení výběru profilu (obrázek P a obrázek
 * „4 · Výběr profilu se 6 profily na telefonu“) ve všech zkušebních oknech:
 * 6 profilů bez „+“ a 5 profilů s „+“ se vejde bez posouvání.
 *
 * Navržené rozhraní (`src/menu/logic/profileLayout.ts`):
 * `profilePickerLayoutFor(okno, { profileCount, showAdd, languageNames })`
 * vrátí `ProfilePickerLayout` v CSS px okna:
 * - `profiles`: pro každý profil v pořadí založení `{ circle, nickname }`,
 *   kolečko je zároveň ťukací plocha, pod ním plocha přezdívky,
 * - `add`: kolečko „+“ za profily, `null` bez „+“,
 * - `symbolFontSize`, `nicknameFontSize` (16 px), `nicknameMaxLines` (2),
 * - `languageSlot`, `languageButtonFontSize` a `languagePanel` jako
 *   v menu (#70), tlačítko jazyka vpravo nahoře.
 *
 * Šířka textu se odhaduje jako v #65 (znaky × 0,6 × písmo), přezdívka pod
 * kolečkem podle AC4 jako 1,0 × písmo na písmeno. Vzhled (plné „CS“,
 * barvy, háčky nad písmeny) se kontroluje ručně.
 */

const MIN_TAP = 64;
const MIN_GAP = 8;
const EDGE_MARGIN = 4;
const ROUNDING = 1e-6;
const CHARACTER_WIDTH_RATIO = 0.6;
const TEXT_PADDING = 8;
/** Písmena přezdívky pod kolečkem se počítají jako 1,0 × písmo (AC4). */
const NICKNAME_LETTER_RATIO = 1;
/** Dva řádky přezdívky 16 px mají 40 px (výpočet v #72). */
const NICKNAME_LINE_HEIGHT_RATIO = 1.25;
const WIDEST_NICKNAME = 'WWWWWWWWWWWW';

const TABLET_CIRCLE = 140;
const PHONE_CIRCLE = 110;

const TODAY_LANGUAGE_NAMES: readonly string[] = LANGUAGES.map(
  (language) => sharedTexts(language).languageName,
);

function insetBox(outer: MenuBox, margin: number): MenuBox {
  return {
    left: outer.left + margin,
    right: outer.right - margin,
    top: outer.top + margin,
    bottom: outer.bottom - margin,
  };
}

function textWidth(text: string, fontSize: number, ratio = CHARACTER_WIDTH_RATIO): number {
  return [...text].length * ratio * fontSize;
}

function isPhone(window: TestWindow): boolean {
  const mode = chooseLayoutMode(viewportOf(window));
  return mode === 'phoneLandscape' || mode === 'phonePortrait';
}

function layoutWith(
  window: TestWindow,
  profileCount: number,
  showAdd: boolean,
): ProfilePickerLayout {
  return profilePickerLayoutFor(viewportOf(window), {
    profileCount,
    showAdd,
    languageNames: TODAY_LANGUAGE_NAMES,
  });
}

/** Všechna kolečka (profily a „+“) v pořadí, jak jdou za sebou. */
function circlesOf(layout: ProfilePickerLayout): MenuBox[] {
  const circles = layout.profiles.map((slot) => slot.circle);
  return layout.add === null ? circles : [...circles, layout.add];
}

/** Je `next` v pořadí čtení za `previous` (vpravo ve stejné řadě, nebo v nižší řadě)? */
function comesAfter(previous: MenuBox, next: MenuBox): boolean {
  const sameRow = Math.abs(previous.top - next.top) < ROUNDING;
  return sameRow ? next.left >= previous.right - ROUNDING : next.top >= previous.bottom - ROUNDING;
}

const CASES: ReadonlyArray<{
  readonly name: string;
  readonly count: number;
  readonly add: boolean;
}> = [
  { name: '6 profilů bez „+“', count: 6, add: false },
  { name: '5 profilů a „+“', count: 5, add: true },
  { name: '2 profily a „+“', count: 2, add: true },
];

describe('#72 AC1: výběr profilu se vejde do všech zkušebních oken bez posouvání', () => {
  for (const { name, count, add } of CASES) {
    for (const window of MENU_WINDOWS) {
      describe(`${name}, ${window.name}`, () => {
        const layout = layoutWith(window, count, add);
        const free = insetBox(freeAreaOf(window), EDGE_MARGIN);
        const circles = circlesOf(layout);

        it('každý profil má kolečko a „+“ je jen tam, kde má být', () => {
          expect(layout.profiles).toHaveLength(count);
          expect(layout.add === null).toBe(!add);
        });

        it(`kolečka mají ${isPhone(window) ? PHONE_CIRCLE : TABLET_CIRCLE} px a „+“ je stejně velké`, () => {
          const size = isPhone(window) ? PHONE_CIRCLE : TABLET_CIRCLE;
          for (const circle of circles) {
            expect(widthOf(circle)).toBeCloseTo(size, 5);
            expect(heightOf(circle)).toBeCloseTo(size, 5);
          }
        });

        it('kolečka, přezdívky i tlačítko jazyka jsou celé ve volné ploše a 4 px od okraje', () => {
          for (const box of [
            ...circles,
            ...layout.profiles.map((slot) => slot.nickname),
            layout.languageSlot,
          ]) {
            expect(isInside(box, free)).toBe(true);
          }
        });

        it('mezi kolečky a tlačítkem jazyka je mezera aspoň 8 px', () => {
          const taps = [...circles, layout.languageSlot];
          taps.forEach((a, i) => {
            taps.slice(i + 1).forEach((b) => {
              expect(gapBetween(a, b)).toBeGreaterThanOrEqual(MIN_GAP - ROUNDING);
            });
          });
        });

        it('přezdívky nepřekrývají kolečka, jiné přezdívky ani tlačítko jazyka', () => {
          layout.profiles.forEach((slot, index) => {
            expect(slot.nickname.top).toBeGreaterThanOrEqual(slot.circle.bottom - ROUNDING);
            const others = [
              ...circles,
              ...layout.profiles.filter((_, other) => other !== index).map((s) => s.nickname),
              layout.languageSlot,
            ];
            for (const other of others) {
              expect(overlaps(slot.nickname, other)).toBe(false);
            }
          });
        });

        it('kolečka jdou v pořadí založení profilů a „+“ je za nimi', () => {
          circles.slice(1).forEach((circle, index) => {
            const previous = circles[index];
            expect(previous).toBeDefined();
            expect(comesAfter(previous ?? circle, circle)).toBe(true);
          });
        });

        it('tlačítko jazyka je vpravo nahoře a má aspoň 64 × 64 px', () => {
          const area = freeAreaOf(window);
          expect(widthOf(layout.languageSlot)).toBeGreaterThanOrEqual(MIN_TAP - ROUNDING);
          expect(heightOf(layout.languageSlot)).toBeGreaterThanOrEqual(MIN_TAP - ROUNDING);
          for (const circle of circles) {
            expect(layout.languageSlot.top).toBeLessThan(circle.top);
          }
          expect(area.right - layout.languageSlot.right).toBeLessThan(
            layout.languageSlot.left - area.left,
          );
        });

        it('zkratka jazyka se vejde do tlačítka a nabídka jazyků do volné plochy', () => {
          for (const language of LANGUAGES) {
            expect(
              textWidth(language.toUpperCase(), layout.languageButtonFontSize) + 2 * TEXT_PADDING,
            ).toBeLessThanOrEqual(widthOf(layout.languageSlot) + ROUNDING);
          }
          expect(isInside(layout.languagePanel.panel, free)).toBe(true);
          expect(layout.languagePanel.rows).toHaveLength(TODAY_LANGUAGE_NAMES.length);
        });

        it('písmeno nebo hvězdička se vejde do kolečka', () => {
          for (const circle of circles) {
            expect(textWidth('W', layout.symbolFontSize, 1) + 2 * TEXT_PADDING).toBeLessThanOrEqual(
              widthOf(circle) + ROUNDING,
            );
          }
        });
      });
    }
  }
});

describe('#72 AC1: rozložení koleček na telefonu podle obrázku', () => {
  for (const window of MENU_WINDOWS) {
    const mode = chooseLayoutMode(viewportOf(window));
    if (mode === 'phoneLandscape') {
      it(`${window.name}: na šířku je 6 profilů v jedné řadě bez zalomení`, () => {
        const circles = circlesOf(layoutWith(window, 6, false));
        const tops = new Set(circles.map((circle) => Math.round(circle.top)));
        expect(tops.size).toBe(1);
      });

      it(`${window.name}: na šířku je i 5 profilů s „+“ v jedné řadě`, () => {
        const circles = circlesOf(layoutWith(window, 5, true));
        const tops = new Set(circles.map((circle) => Math.round(circle.top)));
        expect(tops.size).toBe(1);
      });
    }
    if (mode === 'phonePortrait') {
      it(`${window.name}: na výšku je 6 profilů ve 2 sloupcích`, () => {
        const circles = circlesOf(layoutWith(window, 6, false));
        const lefts = new Set(circles.map((circle) => Math.round(circle.left)));
        expect(lefts.size).toBe(2);
      });

      it(`${window.name}: na výšku je 5 profilů s „+“ ve 2 sloupcích, „+“ na konci`, () => {
        const layout = layoutWith(window, 5, true);
        const lefts = new Set(circlesOf(layout).map((circle) => Math.round(circle.left)));
        expect(lefts.size).toBe(2);
        const last = layout.profiles[4]?.circle;
        expect(last).toBeDefined();
        expect(layout.add?.top).toBeCloseTo(last?.top ?? -1, 5);
      });
    }
  }
});

describe('#72 AC4: přezdívka pod kolečkem se vejde do sloupce', () => {
  for (const window of MENU_WINDOWS) {
    it(`${window.name}: písmo 16 px, nejvýš dva řádky a „${WIDEST_NICKNAME}“ se vejde`, () => {
      const layout = layoutWith(window, 6, false);

      expect(layout.nicknameFontSize).toBe(16);
      expect(layout.nicknameMaxLines).toBe(2);
      const halfLength = Math.ceil([...WIDEST_NICKNAME].length / layout.nicknameMaxLines);
      for (const slot of layout.profiles) {
        // Každý ze dvou řádků má půlku přezdívky, písmena po 1,0 × písmo.
        expect(
          textWidth('W'.repeat(halfLength), layout.nicknameFontSize, NICKNAME_LETTER_RATIO),
        ).toBeLessThanOrEqual(widthOf(slot.nickname) + ROUNDING);
        expect(
          layout.nicknameMaxLines * layout.nicknameFontSize * NICKNAME_LINE_HEIGHT_RATIO,
        ).toBeLessThanOrEqual(heightOf(slot.nickname) + ROUNDING);
      }
    });
  }
});
