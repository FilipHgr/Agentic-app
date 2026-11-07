/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest';

import { letterKeys } from '../../src/menu/logic/letterGrid';
import type { LetterLayer } from '../../src/menu/logic/letterGrid';
import { menuText } from '../../src/menu/logic/menuTexts';
import { PROFILE_COLORS } from '../../src/shared/logic/profiles';
import { MIN_TAP_GAP, TEXT_PADDING } from '../shared/layoutRules';
import { gapBetween, heightOf } from '../shared/viewportFixtures';
import { dictionariesByLanguage, findTextProblems } from '../shared/textChecks';
import { MENU_WINDOWS } from './manyGamesFixtures';
import { colorLayout, describeLayoutRules, formScenes, nicknameLayout } from './menuLayoutScenes';

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
 * Společná pravidla na obou krocích (i s košem z #73 AC2) a texty
 * (písmeno v klávese, přezdívka v poli i u náhledu, nadpisy v každém
 * jazyce, odhad šířky podle #65) hlídá `describeLayoutRules` (#82). Tady zůstávají kontroly
 * podle obrázků, každá v cyklu přes okna. Háčky a kroužky nad velkými
 * písmeny se kontrolují ručně.
 */

const ROUNDING = 1e-6;
const MIN_FIELD_FONT = 24;
const LAYERS: readonly LetterLayer[] = ['base', 'accents'];

const NICKNAME_TITLE_KEY = 'profiles.nicknameTitle';
const COLOR_TITLE_KEY = 'profiles.colorTitle';

/** Texty menu každého jazyka, který má soubor `src/menu/texts/<jazyk>.ts`. */
const MENU_FILES = dictionariesByLanguage(
  import.meta.glob('../../src/menu/texts/*.ts', { eager: true }),
);

/**
 * Kolik různých kombinací (okno × krok) pravidlo na formuláři hlídalo
 * před #82: 1. krok ve 2 vrstvách, 2. krok a 2. krok s košem (#73 AC2) v 17
 * oknech; texty jen v 1. kroku ve 2 vrstvách a ve 2. kroku bez koše.
 * Spočítáno jednorázově z testů před #82.
 */
const TODAY_COMBINATIONS: Readonly<Record<string, number>> = {
  'vejde se do okna i mimo výřez': 68,
  'nic se nepřekrývá': 68,
  'ťukací plocha aspoň 64 px': 68,
  'mezera mezi plochami aspoň 8 px': 68,
  'aspoň 4 px od okraje': 68,
  'text se vejde do své plochy': 51,
};

describeLayoutRules('formulář profilu', formScenes, TODAY_COMBINATIONS);

function indexOfKind(layer: LetterLayer, kind: 'switch' | 'backspace'): number {
  return letterKeys(layer).findIndex((key) => key.kind === kind);
}

describe('#72 AC3: 1. krok s mřížkou písmen ve všech zkušebních oknech', () => {
  it('každá klávesa vrstvy má ťukací plochu', () => {
    for (const layer of LAYERS) {
      for (const window of MENU_WINDOWS) {
        expect(nicknameLayout(window, layer).keys, `${layer}, ${window.name}`).toHaveLength(
          letterKeys(layer).length,
        );
      }
    }
  });

  it('pole s přezdívkou je od kláves, zpět a → aspoň 8 px', () => {
    for (const layer of LAYERS) {
      for (const window of MENU_WINDOWS) {
        const layout = nicknameLayout(window, layer);
        for (const box of [...layout.keys, layout.back, layout.next]) {
          expect(gapBetween(layout.field, box), `${layer}, ${window.name}`).toBeGreaterThanOrEqual(
            MIN_TAP_GAP - ROUNDING,
          );
        }
      }
    }
  });

  it('přepínač a ⌫ jsou v obou vrstvách na stejném místě, pole, zpět a → se nepohnou', () => {
    for (const window of MENU_WINDOWS) {
      const base = nicknameLayout(window, 'base');
      const accents = nicknameLayout(window, 'accents');
      for (const kind of ['switch', 'backspace'] as const) {
        expect(accents.keys[indexOfKind('accents', kind)], `${window.name}: ${kind}`).toEqual(
          base.keys[indexOfKind('base', kind)],
        );
      }
      expect(accents.field, window.name).toEqual(base.field);
      expect(accents.back, window.name).toEqual(base.back);
      expect(accents.next, window.name).toEqual(base.next);
    }
  });
});

describe('#72 AC4: pole s přezdívkou v 1. kroku', () => {
  it('písmo je aspoň 24 px a pole je vyšší než písmo s rezervou 8 px nahoře i dole', () => {
    for (const layer of LAYERS) {
      for (const window of MENU_WINDOWS) {
        const layout = nicknameLayout(window, layer);
        const label = `${layer}, ${window.name}`;
        expect(layout.fieldFontSize, label).toBeGreaterThanOrEqual(MIN_FIELD_FONT);
        expect(layout.fieldFontSize + 2 * TEXT_PADDING, label).toBeLessThanOrEqual(
          heightOf(layout.field) + ROUNDING,
        );
      }
    }
  });
});

describe('#72 AC2: 2. krok „Barva“ ve všech zkušebních oknech', () => {
  it('paleta má 8 koleček barev', () => {
    for (const window of MENU_WINDOWS) {
      expect(colorLayout(window).swatches, window.name).toHaveLength(PROFILE_COLORS.length);
    }
  });
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
});
