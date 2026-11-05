/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest';

import type { MenuBox } from '../../src/menu/logic/menuLayout';
import { menuText } from '../../src/menu/logic/menuTexts';
import { colorStepLayoutFor, deleteConfirmLayoutFor } from '../../src/menu/logic/profileLayout';
import { LANGUAGES } from '../../src/shared/texts/languages';
import { MENU_WINDOWS } from './manyGamesFixtures';
import {
  freeAreaOf,
  gapBetween,
  heightOf,
  isInside,
  overlaps,
  viewportOf,
  widthOf,
} from '../shared/viewportFixtures';
import { dictionariesByLanguage, findTextProblems } from '../shared/textChecks';

/**
 * Testy k #73 AC2 a společným pravidlům: koš ve 2. kroku úpravy (obrázek
 * „6 · Formulář profilu, 2. krok“) a potvrzení smazání (obrázek „8 ·
 * Potvrzení smazání profilu“) ve všech zkušebních oknech, a texty
 * potvrzení ve všech jazycích.
 *
 * Navržené rozhraní (`src/menu/logic/profileLayout.ts`), vše v CSS px okna:
 * - `colorStepLayoutFor(okno, { withTrash })` vrátí navíc `trash`
 *   (ťukací plocha koše vpravo vedle náhledu kolečka, 64 px), bez
 *   `withTrash` (nový profil, poslední profil) `null`. Ostatní plochy
 *   zůstanou na stejném místě jako bez koše.
 * - `deleteConfirmLayoutFor(okno)` vrátí `DeleteConfirmLayout`: `panel`
 *   (bílý rámeček nad formulářem), `preview` a `previewSymbolFontSize`
 *   (kolečko profilu), `nickname` a `nicknameFontSize`, `question`
 *   a `questionFontSize` („Smazat profil?“), `confirm` („Smazat“,
 *   červené), `cancel` („Zpět“) a `buttonFontSize`.
 * - Texty menu (`src/menu/texts/<jazyk>.ts`): `profiles.deleteQuestion`
 *   („Smazat profil?“), `profiles.deleteConfirm` („Smazat“) a
 *   `profiles.deleteCancel` („Zpět“). Koš je symbol v kódu.
 *
 * Šířka textu se odhaduje jako v #65 (znaky × 0,6 × písmo), přezdívka
 * „WWWWWWWWWWWW“ jako 1,0 × písmo na písmeno. Barvy (červený koš
 * a „Smazat“, šedé „Zpět“) a ztmavení formuláře se kontrolují ručně.
 */

const MIN_TAP = 64;
const MIN_GAP = 8;
const EDGE_MARGIN = 4;
const ROUNDING = 1e-6;
const CHARACTER_WIDTH_RATIO = 0.6;
const TEXT_PADDING = 8;
const WIDEST_NICKNAME = 'WWWWWWWWWWWW';
/** Koš je „daleko od ✓“: mezi nimi je aspoň šířka jednoho prstu. */
const TRASH_DISTANCE_FROM_SAVE = 64;

const QUESTION_KEY = 'profiles.deleteQuestion';
const CONFIRM_KEY = 'profiles.deleteConfirm';
const CANCEL_KEY = 'profiles.deleteCancel';

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

function centerX(box: MenuBox): number {
  return (box.left + box.right) / 2;
}

function expectTapSize(box: MenuBox): void {
  expect(widthOf(box)).toBeGreaterThanOrEqual(MIN_TAP - ROUNDING);
  expect(heightOf(box)).toBeGreaterThanOrEqual(MIN_TAP - ROUNDING);
}

/** Text se vejde do plochy na šířku i na výšku. */
function expectTextFits(text: string, fontSize: number, box: MenuBox, ratio?: number): void {
  expect(textWidth(text, fontSize, ratio) + 2 * TEXT_PADDING).toBeLessThanOrEqual(
    widthOf(box) + ROUNDING,
  );
  expect(fontSize).toBeLessThanOrEqual(heightOf(box) + ROUNDING);
}

describe('#73 AC2: koš ve 2. kroku úpravy ve všech zkušebních oknech', () => {
  for (const window of MENU_WINDOWS) {
    describe(window.name, () => {
      const viewport = viewportOf(window);
      const plain = colorStepLayoutFor(viewport);
      const edit = colorStepLayoutFor(viewport, { withTrash: true });
      const free = insetBox(freeAreaOf(window), EDGE_MARGIN);

      it('u nového profilu ani u posledního profilu koš není', () => {
        expect(plain.trash).toBeNull();
        expect(colorStepLayoutFor(viewport, { withTrash: false }).trash).toBeNull();
      });

      it('koš má aspoň 64 × 64 px a je ve volné ploše 4 px od okraje', () => {
        expect(edit.trash).not.toBeNull();
        const trash = edit.trash ?? plain.preview;
        expectTapSize(trash);
        expect(isInside(trash, free)).toBe(true);
      });

      it('koš je od barev, zpět a ✓ aspoň 8 px a nic nepřekrývá', () => {
        const trash = edit.trash ?? plain.preview;
        for (const box of [...edit.swatches, edit.back, edit.save]) {
          expect(gapBetween(trash, box)).toBeGreaterThanOrEqual(MIN_GAP - ROUNDING);
        }
        for (const box of [edit.preview, edit.nickname, edit.title, edit.stepCounter]) {
          if (box !== null) {
            expect(overlaps(trash, box)).toBe(false);
          }
        }
      });

      it('koš nepřeteče za pravý okraj volné plochy (4 px od okraje)', () => {
        const trash = edit.trash ?? plain.preview;
        expect(trash.right).toBeLessThanOrEqual(free.right + ROUNDING);
      });

      it('koš je vpravo vedle náhledu kolečka a daleko od ✓', () => {
        const trash = edit.trash ?? plain.preview;
        expect(trash.left).toBeGreaterThanOrEqual(edit.preview.right - ROUNDING);
        expect(trash.top).toBeLessThan(edit.preview.bottom);
        expect(trash.bottom).toBeGreaterThan(edit.preview.top);
        expect(gapBetween(trash, edit.save)).toBeGreaterThanOrEqual(
          TRASH_DISTANCE_FROM_SAVE - ROUNDING,
        );
      });

      it('s košem zůstane náhled, paleta, zpět i ✓ na stejném místě jako bez něj', () => {
        expect(edit.preview).toEqual(plain.preview);
        expect(edit.nickname).toEqual(plain.nickname);
        expect(edit.swatches).toEqual(plain.swatches);
        expect(edit.back).toEqual(plain.back);
        expect(edit.save).toEqual(plain.save);
      });
    });
  }
});

describe('#73 AC2: potvrzení smazání ve všech zkušebních oknech', () => {
  for (const window of MENU_WINDOWS) {
    describe(window.name, () => {
      const viewport = viewportOf(window);
      const layout = deleteConfirmLayoutFor(viewport);
      const form = colorStepLayoutFor(viewport, { withTrash: true });
      const free = insetBox(freeAreaOf(window), EDGE_MARGIN);
      const content = [
        layout.preview,
        layout.nickname,
        layout.question,
        layout.confirm,
        layout.cancel,
      ];

      it('potvrzení je celé ve volné ploše 4 px od okraje a obsah je v rámečku', () => {
        expect(isInside(layout.panel, free)).toBe(true);
        for (const box of content) {
          expect(isInside(box, layout.panel)).toBe(true);
        }
      });

      it('„Smazat“ a „Zpět“ mají aspoň 64 × 64 px a mezi nimi je aspoň 8 px', () => {
        expectTapSize(layout.confirm);
        expectTapSize(layout.cancel);
        expect(gapBetween(layout.confirm, layout.cancel)).toBeGreaterThanOrEqual(
          MIN_GAP - ROUNDING,
        );
      });

      it('otázka je nad „Smazat“ i „Zpět“', () => {
        expect(layout.question.bottom).toBeLessThanOrEqual(layout.confirm.top + ROUNDING);
        expect(layout.question.bottom).toBeLessThanOrEqual(layout.cancel.top + ROUNDING);
      });

      it('kolečko, přezdívka, otázka a tlačítka se nepřekrývají', () => {
        content.forEach((a, i) => {
          content.slice(i + 1).forEach((b) => {
            expect(overlaps(a, b)).toBe(false);
          });
        });
      });

      it('„Zpět“ je vpravo, na straně ✓, a „Smazat“ není na místě ✓ ani koše', () => {
        expect(layout.cancel.left).toBeGreaterThanOrEqual(layout.confirm.right - ROUNDING);
        expect(Math.abs(centerX(layout.cancel) - centerX(form.save))).toBeLessThan(
          Math.abs(centerX(layout.confirm) - centerX(form.save)),
        );
        expect(overlaps(layout.confirm, form.save)).toBe(false);
        if (form.trash !== null) {
          expect(overlaps(layout.confirm, form.trash)).toBe(false);
        }
      });

      it('písmeno se vejde do kolečka a „WWWWWWWWWWWW“ pod něj', () => {
        expectTextFits('W', layout.previewSymbolFontSize, layout.preview, 1);
        expectTextFits(WIDEST_NICKNAME, layout.nicknameFontSize, layout.nickname, 1);
      });
    });
  }
});

describe('#73 AC2: texty potvrzení smazání ve všech jazycích', () => {
  it('čeština má „Smazat profil?“, „Smazat“ a „Zpět“', () => {
    expect(menuText(QUESTION_KEY, 'cs')).toBe('Smazat profil?');
    expect(menuText(CONFIRM_KEY, 'cs')).toBe('Smazat');
    expect(menuText(CANCEL_KEY, 'cs')).toBe('Zpět');
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
      it(`${language}, ${window.name}: otázka a obě tlačítka se vejdou`, () => {
        const layout = deleteConfirmLayoutFor(viewportOf(window));
        const texts: ReadonlyArray<{ key: string; box: MenuBox; fontSize: number }> = [
          { key: QUESTION_KEY, box: layout.question, fontSize: layout.questionFontSize },
          { key: CONFIRM_KEY, box: layout.confirm, fontSize: layout.buttonFontSize },
          { key: CANCEL_KEY, box: layout.cancel, fontSize: layout.buttonFontSize },
        ];
        for (const { key, box, fontSize } of texts) {
          const text = menuText(key, language);
          expect(text?.trim(), key).toBeTruthy();
          expectTextFits(text ?? '', fontSize, box);
        }
      });
    }
  }
});
