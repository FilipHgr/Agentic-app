/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest';

import { letterKeys } from '../../src/menu/logic/letterGrid';
import type { LetterLayer } from '../../src/menu/logic/letterGrid';
import type { MenuBox } from '../../src/menu/logic/menuLayout';
import { menuText } from '../../src/menu/logic/menuTexts';
import { colorStepLayoutFor, nicknameStepLayoutFor } from '../../src/menu/logic/profileLayout';
import type { ColorStepLayout, NicknameStepLayout } from '../../src/menu/logic/profileLayout';
import { PROFILE_COLORS } from '../../src/shared/logic/profiles';
import { LANGUAGES } from '../../src/shared/texts/languages';
import { findWindow, MENU_WINDOWS } from './manyGamesFixtures';
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
import { dictionariesByLanguage, findTextProblems } from '../shared/textChecks';

/**
 * Testy k #72 AC2, AC3 a AC4, rozložení formuláře nového profilu
 * (obrázky „5 · Mřížka písmen“ a „6 · Formulář profilu, 2. krok“) ve všech
 * zkušebních oknech, a texty formuláře ve všech jazycích.
 *
 * Navržené rozhraní (`src/menu/logic/profileLayout.ts`), vše v CSS px okna:
 * - `nicknameStepLayoutFor(okno, { layer })` vrátí `NicknameStepLayout`:
 *   `keys` (ťukací plochy kláves ve stejném pořadí jako `letterKeys(layer)`),
 *   `keyFontSize`, `field` a `fieldFontSize` (pole s přezdívkou), `back`
 *   (zpět), `next` (→), `title` a `titleFontSize` (nadpis „Přezdívka“,
 *   `null`, kde na něj podle obrázku není místo),
 * - `colorStepLayoutFor(okno)` vrátí `ColorStepLayout`: `preview`
 *   (náhled kolečka) a `previewSymbolFontSize`, `nickname` a
 *   `nicknameFontSize` (přezdívka u náhledu), `swatches` (8 barev v pořadí
 *   palety), `back`, `save` (✓), `title` a `titleFontSize` (nadpis
 *   „Barva“, nebo `null`).
 * - Texty menu (`src/menu/texts/<jazyk>.ts`): `profiles.nicknameTitle`
 *   („Přezdívka“) a `profiles.colorTitle` („Barva“). Šipky, ✓, ⌫, „ÁČ“,
 *   „AB“, písmena a „1 / 2“ jsou symboly v kódu.
 *
 * Šířka textu se odhaduje jako v #65 (znaky × 0,6 × písmo), přezdívka
 * „WWWWWWWWWWWW“ jako 1,0 × písmo na písmeno. Háčky a kroužky nad
 * velkými písmeny se kontrolují ručně.
 */

const MIN_TAP = 64;
const MIN_GAP = 8;
const EDGE_MARGIN = 4;
const ROUNDING = 1e-6;
const CHARACTER_WIDTH_RATIO = 0.6;
const TEXT_PADDING = 8;
const MIN_FIELD_FONT = 24;
const WIDEST_NICKNAME = 'WWWWWWWWWWWW';
const LAYERS: readonly LetterLayer[] = ['base', 'accents'];

const NICKNAME_TITLE_KEY = 'profiles.nicknameTitle';
const COLOR_TITLE_KEY = 'profiles.colorTitle';

/** Texty menu každého jazyka, který má soubor `src/menu/texts/<jazyk>.ts`. */
const MENU_FILES = dictionariesByLanguage(
  import.meta.glob('../../src/menu/texts/*.ts', { eager: true }),
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

function nicknameLayout(window: TestWindow, layer: LetterLayer): NicknameStepLayout {
  return nicknameStepLayoutFor(viewportOf(window), { layer });
}

function colorLayout(window: TestWindow): ColorStepLayout {
  return colorStepLayoutFor(viewportOf(window));
}

/** Každé dvě plochy jsou od sebe aspoň 8 px. */
function expectGaps(boxes: readonly MenuBox[]): void {
  boxes.forEach((a, i) => {
    boxes.slice(i + 1).forEach((b) => {
      expect(gapBetween(a, b)).toBeGreaterThanOrEqual(MIN_GAP - ROUNDING);
    });
  });
}

function expectTapSize(box: MenuBox): void {
  expect(widthOf(box)).toBeGreaterThanOrEqual(MIN_TAP - ROUNDING);
  expect(heightOf(box)).toBeGreaterThanOrEqual(MIN_TAP - ROUNDING);
}

function indexOfKind(layer: LetterLayer, kind: 'switch' | 'backspace'): number {
  return letterKeys(layer).findIndex((key) => key.kind === kind);
}

describe('#72 AC3: 1. krok s mřížkou písmen se vejde do všech zkušebních oken', () => {
  for (const layer of LAYERS) {
    for (const window of MENU_WINDOWS) {
      describe(`${layer === 'base' ? 'základní vrstva' : 'diakritika'}, ${window.name}`, () => {
        const layout = nicknameLayout(window, layer);
        const free = insetBox(freeAreaOf(window), EDGE_MARGIN);
        const taps = [...layout.keys, layout.back, layout.next];

        it('každá klávesa vrstvy má ťukací plochu', () => {
          expect(layout.keys).toHaveLength(letterKeys(layer).length);
        });

        it('každé písmeno, přepínač, ⌫, zpět i → má aspoň 64 × 64 px', () => {
          for (const box of taps) {
            expectTapSize(box);
          }
        });

        it('mezi klávesami, polem, zpět a → je mezera aspoň 8 px', () => {
          expectGaps([...taps, layout.field]);
        });

        it('celý 1. krok je ve volné ploše 4 px od okraje, bez posouvání', () => {
          for (const box of [...taps, layout.field]) {
            expect(isInside(box, free)).toBe(true);
          }
          if (layout.title !== null) {
            expect(isInside(layout.title, free)).toBe(true);
            for (const box of [...taps, layout.field]) {
              expect(overlaps(layout.title, box)).toBe(false);
            }
          }
        });

        it('písmeno se vejde do klávesy', () => {
          for (const key of layout.keys) {
            expect(textWidth('W', layout.keyFontSize, 1) + 2 * TEXT_PADDING).toBeLessThanOrEqual(
              widthOf(key) + ROUNDING,
            );
            expect(textWidth('ÁČ', layout.keyFontSize) + 2 * TEXT_PADDING).toBeLessThanOrEqual(
              widthOf(key) + ROUNDING,
            );
          }
        });
      });
    }
  }

  for (const window of MENU_WINDOWS) {
    it(`${window.name}: přepínač a ⌫ jsou v obou vrstvách na stejném místě`, () => {
      const base = nicknameLayout(window, 'base');
      const accents = nicknameLayout(window, 'accents');
      for (const kind of ['switch', 'backspace'] as const) {
        expect(accents.keys[indexOfKind('accents', kind)]).toEqual(
          base.keys[indexOfKind('base', kind)],
        );
      }
    });

    it(`${window.name}: pole, zpět a → se při přepnutí vrstvy nepohnou`, () => {
      const base = nicknameLayout(window, 'base');
      const accents = nicknameLayout(window, 'accents');
      expect(accents.field).toEqual(base.field);
      expect(accents.back).toEqual(base.back);
      expect(accents.next).toEqual(base.next);
    });
  }

  it('na nejmenších oknech 360×620 a 744×296 se 1. krok vejde také', () => {
    for (const name of ['360×620', '744×296']) {
      const window = findWindow(name);
      const free = insetBox(freeAreaOf(window), EDGE_MARGIN);
      const layout = nicknameLayout(window, 'base');
      for (const box of [...layout.keys, layout.field, layout.back, layout.next]) {
        expect(isInside(box, free), name).toBe(true);
      }
    }
  });
});

describe('#72 AC4: pole s přezdívkou v 1. kroku', () => {
  for (const window of MENU_WINDOWS) {
    it(`${window.name}: písmo aspoň 24 px a „${WIDEST_NICKNAME}“ se vejde`, () => {
      for (const layer of LAYERS) {
        const layout = nicknameLayout(window, layer);
        expect(layout.fieldFontSize).toBeGreaterThanOrEqual(MIN_FIELD_FONT);
        expect(
          textWidth(WIDEST_NICKNAME, layout.fieldFontSize, 1) + 2 * TEXT_PADDING,
        ).toBeLessThanOrEqual(widthOf(layout.field) + ROUNDING);
        expect(layout.fieldFontSize + 2 * TEXT_PADDING).toBeLessThanOrEqual(
          heightOf(layout.field) + ROUNDING,
        );
      }
    });
  }
});

describe('#72 AC2: 2. krok „Barva“ se vejde do všech zkušebních oken', () => {
  for (const window of MENU_WINDOWS) {
    describe(window.name, () => {
      const layout = colorLayout(window);
      const free = insetBox(freeAreaOf(window), EDGE_MARGIN);
      const taps = [...layout.swatches, layout.back, layout.save];

      it('paleta má 8 koleček barev, každé aspoň 64 × 64 px', () => {
        expect(layout.swatches).toHaveLength(PROFILE_COLORS.length);
        for (const swatch of layout.swatches) {
          expectTapSize(swatch);
        }
      });

      it('zpět a ✓ mají aspoň 64 × 64 px', () => {
        expectTapSize(layout.back);
        expectTapSize(layout.save);
      });

      it('mezi barvami, zpět a ✓ je mezera aspoň 8 px', () => {
        expectGaps(taps);
      });

      it('náhled kolečka a přezdívka nic nepřekrývají', () => {
        for (const box of taps) {
          expect(overlaps(layout.preview, box)).toBe(false);
          expect(overlaps(layout.nickname, box)).toBe(false);
        }
        expect(overlaps(layout.preview, layout.nickname)).toBe(false);
      });

      it('celý 2. krok je ve volné ploše 4 px od okraje', () => {
        for (const box of [...taps, layout.preview, layout.nickname]) {
          expect(isInside(box, free)).toBe(true);
        }
        if (layout.title !== null) {
          expect(isInside(layout.title, free)).toBe(true);
        }
      });

      it('písmeno se vejde do náhledu kolečka a „WWWWWWWWWWWW“ vedle něj', () => {
        expect(
          textWidth('W', layout.previewSymbolFontSize, 1) + 2 * TEXT_PADDING,
        ).toBeLessThanOrEqual(widthOf(layout.preview) + ROUNDING);
        expect(
          textWidth(WIDEST_NICKNAME, layout.nicknameFontSize, 1) + 2 * TEXT_PADDING,
        ).toBeLessThanOrEqual(widthOf(layout.nickname) + ROUNDING);
      });
    });
  }
});

describe('#72: texty formuláře nového profilu ve všech jazycích', () => {
  it('čeština má nadpisy kroků „Přezdívka“ a „Barva“', () => {
    expect(menuText(NICKNAME_TITLE_KEY, 'cs')).toBe('Přezdívka');
    expect(menuText(COLOR_TITLE_KEY, 'cs')).toBe('Barva');
  });

  it('každý soubor textů menu má stejné klíče jako čeština a žádný text není prázdný', () => {
    for (const [language, texts] of Object.entries(MENU_FILES)) {
      expect(
        findTextProblems({ language, part: 'menu', reference: MENU_FILES['cs'] ?? {}, texts }),
      ).toEqual([]);
    }
  });

  for (const language of LANGUAGES) {
    for (const window of MENU_WINDOWS) {
      it(`${language}, ${window.name}: nadpisy kroků se vejdou do svého místa`, () => {
        const steps: ReadonlyArray<{
          key: string;
          title: MenuBox | null;
          fontSize: number;
        }> = [
          { key: NICKNAME_TITLE_KEY, ...titleOf(nicknameLayout(window, 'base')) },
          { key: COLOR_TITLE_KEY, ...titleOf(colorLayout(window)) },
        ];
        for (const step of steps) {
          const text = menuText(step.key, language);
          expect(text?.trim(), step.key).toBeTruthy();
          if (step.title === null) {
            continue;
          }
          expect(textWidth(text ?? '', step.fontSize) + 2 * TEXT_PADDING).toBeLessThanOrEqual(
            widthOf(step.title) + ROUNDING,
          );
          expect(step.fontSize).toBeLessThanOrEqual(heightOf(step.title) + ROUNDING);
        }
      });
    }
  }
});

function titleOf(layout: { title: MenuBox | null; titleFontSize: number }): {
  title: MenuBox | null;
  fontSize: number;
} {
  return { title: layout.title, fontSize: layout.titleFontSize };
}
