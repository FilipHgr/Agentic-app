/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest';

import type { MenuBox } from '../../src/menu/logic/menuLayout';
import { menuText } from '../../src/menu/logic/menuTexts';
import { colorStepLayoutFor, deleteConfirmLayoutFor } from '../../src/menu/logic/profileLayout';
import { MIN_TAP_SIDE } from '../shared/layoutRules';
import { gapBetween, isInside, overlaps, viewportOf } from '../shared/viewportFixtures';
import { dictionariesByLanguage, findTextProblems } from '../shared/textChecks';
import { MENU_WINDOWS } from './manyGamesFixtures';
import { deleteScenes, describeLayoutRules } from './menuLayoutScenes';

/**
 * Testy k #73 AC2: koš ve 2. kroku úpravy (obrázek „6 · Formulář profilu,
 * 2. krok“) a potvrzení smazání (obrázek „8 · Potvrzení smazání profilu“)
 * ve všech zkušebních oknech, a texty potvrzení ve všech jazycích.
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
 * Společná pravidla na potvrzení smazání (i texty v každém jazyce, odhad
 * šířky podle #65) hlídá
 * `describeLayoutRules` (#82), pro koš na formuláři ve stavu „barva
 * s košem“ v `profileFormLayout.test.ts`. Tady zůstávají kontroly podle
 * obrázků, každá v cyklu přes okna. Barvy (červený koš a „Smazat“, šedé
 * „Zpět“) a ztmavení formuláře se kontrolují ručně.
 */

const ROUNDING = 1e-6;
/** Koš je „daleko od ✓“: mezi nimi je aspoň šířka jednoho prstu. */
const TRASH_DISTANCE_FROM_SAVE = MIN_TAP_SIDE;

const QUESTION_KEY = 'profiles.deleteQuestion';
const CONFIRM_KEY = 'profiles.deleteConfirm';
const CANCEL_KEY = 'profiles.deleteCancel';

/** Texty menu každého jazyka, který má soubor `src/menu/texts/<jazyk>.ts`. */
const MENU_FILES = dictionariesByLanguage(
  import.meta.glob('../../src/menu/texts/*.ts', { eager: true }),
);

/**
 * Kolik různých kombinací (okno × jazyk) pravidlo na potvrzení smazání
 * hlídalo před #82: 17 oken v češtině, spočítáno jednorázově z testů
 * před #82.
 */
const TODAY_COMBINATIONS: Readonly<Record<string, number>> = {
  'vejde se do okna i mimo výřez': 17,
  'nic se nepřekrývá': 17,
  'ťukací plocha aspoň 64 px': 17,
  'mezera mezi plochami aspoň 8 px': 17,
  'aspoň 4 px od okraje': 17,
  'text se vejde do své plochy': 17,
};

describeLayoutRules('potvrzení smazání profilu', deleteScenes, TODAY_COMBINATIONS);

function centerX(box: MenuBox): number {
  return (box.left + box.right) / 2;
}

describe('#73 AC2: koš ve 2. kroku úpravy ve všech zkušebních oknech', () => {
  it('u nového profilu ani u posledního profilu koš není, při úpravě ano', () => {
    for (const window of MENU_WINDOWS) {
      const viewport = viewportOf(window);
      expect(colorStepLayoutFor(viewport).trash, window.name).toBeNull();
      expect(colorStepLayoutFor(viewport, { withTrash: false }).trash, window.name).toBeNull();
      expect(colorStepLayoutFor(viewport, { withTrash: true }).trash, window.name).not.toBeNull();
    }
  });

  it('koš je vpravo vedle náhledu kolečka a daleko od ✓', () => {
    for (const window of MENU_WINDOWS) {
      const edit = colorStepLayoutFor(viewportOf(window), { withTrash: true });
      const trash = edit.trash ?? edit.preview;
      expect(trash.left, window.name).toBeGreaterThanOrEqual(edit.preview.right - ROUNDING);
      expect(trash.top, window.name).toBeLessThan(edit.preview.bottom);
      expect(trash.bottom, window.name).toBeGreaterThan(edit.preview.top);
      expect(gapBetween(trash, edit.save), window.name).toBeGreaterThanOrEqual(
        TRASH_DISTANCE_FROM_SAVE - ROUNDING,
      );
    }
  });

  it('s košem zůstane náhled, paleta, zpět i ✓ na stejném místě jako bez něj', () => {
    for (const window of MENU_WINDOWS) {
      const viewport = viewportOf(window);
      const plain = colorStepLayoutFor(viewport);
      const edit = colorStepLayoutFor(viewport, { withTrash: true });
      expect(edit.preview, window.name).toEqual(plain.preview);
      expect(edit.nickname, window.name).toEqual(plain.nickname);
      expect(edit.swatches, window.name).toEqual(plain.swatches);
      expect(edit.back, window.name).toEqual(plain.back);
      expect(edit.save, window.name).toEqual(plain.save);
    }
  });
});

describe('#73 AC2: potvrzení smazání ve všech zkušebních oknech', () => {
  it('obsah potvrzení je v rámečku a otázka je nad „Smazat“ i „Zpět“', () => {
    for (const window of MENU_WINDOWS) {
      const layout = deleteConfirmLayoutFor(viewportOf(window));
      const content = [
        layout.preview,
        layout.nickname,
        layout.question,
        layout.confirm,
        layout.cancel,
      ];
      for (const box of content) {
        expect(isInside(box, layout.panel), window.name).toBe(true);
      }
      expect(layout.question.bottom, window.name).toBeLessThanOrEqual(
        layout.confirm.top + ROUNDING,
      );
      expect(layout.question.bottom, window.name).toBeLessThanOrEqual(layout.cancel.top + ROUNDING);
    }
  });

  it('„Zpět“ je vpravo, na místě ✓, a „Smazat“ není na místě ✓ ani koše', () => {
    for (const window of MENU_WINDOWS) {
      const viewport = viewportOf(window);
      const layout = deleteConfirmLayoutFor(viewport);
      const form = colorStepLayoutFor(viewport, { withTrash: true });
      expect(layout.cancel.left, window.name).toBeGreaterThanOrEqual(
        layout.confirm.right - ROUNDING,
      );
      expect(Math.abs(centerX(layout.cancel) - centerX(form.save)), window.name).toBeLessThan(
        Math.abs(centerX(layout.confirm) - centerX(form.save)),
      );
      expect(overlaps(layout.confirm, form.save), window.name).toBe(false);
      if (form.trash !== null) {
        expect(overlaps(layout.confirm, form.trash), window.name).toBe(false);
      }
    }
  });
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
});
