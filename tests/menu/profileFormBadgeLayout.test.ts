import { describe, expect, it } from 'vitest';

import { LANGUAGES } from '../../src/shared/texts/languages';
import type { Language } from '../../src/shared/texts/languages';
import { MIN_EDGE_DISTANCE, MIN_TAP_GAP } from '../shared/layoutRules';
import type { LayoutItem, LayoutScene } from '../shared/layoutRules';
import { freeAreaOf, gapBetween, isInside, overlaps } from '../shared/viewportFixtures';
import type { Box, TestWindow } from '../shared/viewportFixtures';
import { MENU_WINDOWS } from './manyGamesFixtures';
import { MENU_LAYOUT_RULES, colorLayout, formStepItems, nicknameLayout } from './menuLayoutScenes';
import type { FormStep } from './menuLayoutScenes';

/**
 * Testy k #161 AC4: rozložení kolečka upravovaného profilu nahoře ve
 * formuláři. Každé pravidlo je jeden test, který v cyklu projde všechna
 * zkušební okna menu, oba jazyky menu a všechny stavy formuláře: nový
 * profil (1. krok v obou vrstvách písmen, 2. krok) i úpravu (navíc 2. krok
 * s košem). Zpráva při selhání řekne okno, stav a prvek.
 *
 * Navržené rozhraní (`src/menu/logic/profileLayout.ts`), v CSS px okna:
 * - `NicknameStepLayout.badge` kolečko profilu v 1. kroku a
 *   `NicknameStepLayout.badgeSymbolFontSize` písmo písmene v něm; kolečko
 *   je na stejném místě v obou vrstvách,
 * - ve 2. kroku je kolečkem profilu dnešní náhled `ColorStepLayout.preview`
 *   (`previewSymbolFontSize`), druhé kolečko se nepřidává.
 *
 * Kolečko je jen obrázek (ťuknutí na něj nic nedělá), společné pravidlo
 * 8 px mezi ťukacími plochami ho proto nehlídá; mezeru 8 px od všech
 * ostatních prvků hlídá vlastní test níž. Písmeno se měří jako široké „W“
 * (1,0 × písmo) jako v #72 AC4.
 */

const ROUNDING = 1e-6;
const BADGE = 'kolečko profilu';
/** Název náhledu kolečka ve 2. kroku ve společných případech (#72). */
const COLOR_STEP_BADGE = 'náhled kolečka';

type FormMode = 'nový profil' | 'úprava';

/** Stavy formuláře: koš je jen u úpravy (když nejde o poslední profil). */
const MODE_STEPS: ReadonlyArray<readonly [FormMode, readonly FormStep[]]> = [
  ['nový profil', ['základní vrstva', 'diakritika', 'barva']],
  ['úprava', ['základní vrstva', 'diakritika', 'barva', 'barva s košem']],
];

interface BadgeCase {
  readonly scene: LayoutScene;
  readonly step: FormStep;
  readonly window: TestWindow;
}

function badgeCase(window: TestWindow, mode: FormMode, step: FormStep, language: Language) {
  return {
    step,
    window,
    scene: {
      label: `formulář profilu, ${window.name}, ${mode}, ${step}, ${language}`,
      free: freeAreaOf(window),
      // Kolečko 1. kroku je ve společných případech formuláře (`formStepItems`).
      items: formStepItems(window, step, language),
    },
  };
}

function allCases(): BadgeCase[] {
  return LANGUAGES.flatMap((language) =>
    MODE_STEPS.flatMap(([mode, steps]) =>
      steps.flatMap((step) =>
        MENU_WINDOWS.map((window) => badgeCase(window, mode, step, language)),
      ),
    ),
  );
}

const CASES = allCases();

function badgeOf(scene: LayoutScene): LayoutItem | undefined {
  return scene.items.find((item) => item.name === BADGE || item.name === COLOR_STEP_BADGE);
}

function othersOf(scene: LayoutScene): LayoutItem[] {
  const badge = badgeOf(scene);
  return scene.items.filter((item) => item !== badge);
}

/** Horní okraj mřížky písmen (1. krok) nebo palety (2. krok). */
function mainContentTop(scene: LayoutScene): number {
  const tops = scene.items
    .filter((item) => item.name.startsWith('klávesa') || item.name.startsWith('barva '))
    .map((item) => item.box.top);
  return Math.min(...tops);
}

describe('#161 AC4: kolečko profilu ve formuláři ve všech oknech a stavech', () => {
  it('kolečko je v každém kroku formuláře, nového profilu i úpravy', () => {
    for (const { scene } of CASES) {
      expect(badgeOf(scene)?.box, scene.label).toBeDefined();
    }
  });

  it('kolečko nepřekrývá pole, mřížku písmen, barvy, koš ani tlačítka', () => {
    for (const { scene } of CASES) {
      const badge = badgeOf(scene);
      for (const other of othersOf(scene)) {
        const hit = badge !== undefined && overlaps(badge.box, other.box);
        expect(hit, `${scene.label}: ${other.name}`).toBe(false);
      }
    }
  });

  it('kolečko leží v bezpečné ploše, aspoň 4 px od jejího okraje', () => {
    for (const { scene } of CASES) {
      const badge = badgeOf(scene);
      const safe: Box = {
        left: scene.free.left + MIN_EDGE_DISTANCE,
        right: scene.free.right - MIN_EDGE_DISTANCE,
        top: scene.free.top + MIN_EDGE_DISTANCE,
        bottom: scene.free.bottom - MIN_EDGE_DISTANCE,
      };
      expect(badge !== undefined && isInside(badge.box, safe), scene.label).toBe(true);
    }
  });

  it('kolečko je od všech ostatních prvků aspoň 8 px', () => {
    for (const { scene } of CASES) {
      const badge = badgeOf(scene);
      for (const other of othersOf(scene)) {
        const gap = badge === undefined ? -Infinity : gapBetween(badge.box, other.box);
        expect(gap, `${scene.label}: ${other.name}`).toBeGreaterThanOrEqual(MIN_TAP_GAP - ROUNDING);
      }
    }
  });

  it('kolečko je nahoře: nad mřížkou písmen, ve 2. kroku nad paletou', () => {
    for (const { scene } of CASES) {
      const badge = badgeOf(scene);
      expect(badge?.box.bottom ?? Infinity, scene.label).toBeLessThanOrEqual(
        mainContentTop(scene) + ROUNDING,
      );
    }
  });

  it('kolečko je v obou vrstvách písmen na stejném místě, aby při přepnutí neposkočilo', () => {
    for (const window of MENU_WINDOWS) {
      expect(nicknameLayout(window, 'accents').badge, window.name).toEqual(
        nicknameLayout(window, 'base').badge,
      );
    }
  });

  it('kolečko ve 2. kroku je stejně velké s košem i bez něj (úprava i nový profil)', () => {
    for (const window of MENU_WINDOWS) {
      expect(colorLayout(window, true).preview, window.name).toEqual(
        colorLayout(window, false).preview,
      );
    }
  });
});

/** Kolečko na telefonu je menší než klávesy (64 px) a od „‹“ v jedné řadě aspoň 16 px. */
const PHONE_KEY = 64;
const BADGE_BACK_GAP = 16;
/**
 * Velké písmeno s háčkem (Š, Č, Ž) se měří s rezervou: výška 1,0 × písmo
 * (písmeno i háček), šířka 1,0 × písmo, posunuté o 0,04 × písmo dolů jako
 * ve scéně, aby se háček neořízl.
 */
const ACCENTED_HEIGHT = 1;
const ACCENTED_WIDTH = 1;
const LABEL_SHIFT = 0.04;

function sharesRow(first: Box, second: Box): boolean {
  return first.top < second.bottom && second.top < first.bottom;
}

/** Leží celé písmeno s háčkem uvnitř kolečka `circle`? */
function accentedLetterInside(circle: Box, fontSize: number): boolean {
  const radius = (circle.right - circle.left) / 2;
  const halfWidth = (ACCENTED_WIDTH * fontSize) / 2;
  const top = LABEL_SHIFT * fontSize - (ACCENTED_HEIGHT * fontSize) / 2;
  const bottom = LABEL_SHIFT * fontSize + (ACCENTED_HEIGHT * fontSize) / 2;
  const farthestY = Math.max(Math.abs(top), Math.abs(bottom));
  return Math.hypot(halfWidth, farthestY) <= radius + ROUNDING;
}

describe('#161: kolečko nevypadá jako tlačítko a háčky se neoříznou', () => {
  it('na telefonu je kolečko menší než klávesy a od „‹“ v jedné řadě aspoň 16 px', () => {
    for (const window of MENU_WINDOWS) {
      const layout = nicknameLayout(window, 'base');
      const keySize = (layout.keys[0]?.right ?? 0) - (layout.keys[0]?.left ?? 0);
      if (keySize > PHONE_KEY) {
        continue;
      }
      expect(layout.badge.right - layout.badge.left, window.name).toBeLessThan(PHONE_KEY);
      if (sharesRow(layout.badge, layout.back)) {
        expect(gapBetween(layout.badge, layout.back), window.name).toBeGreaterThanOrEqual(
          BADGE_BACK_GAP - ROUNDING,
        );
      }
    }
  });

  it('velké písmeno s háčkem (Š, Č, Ž) se celé vejde do kolečka v 1. i 2. kroku', () => {
    for (const window of MENU_WINDOWS) {
      const nickname = nicknameLayout(window, 'base');
      const color = colorLayout(window, true);
      expect(accentedLetterInside(nickname.badge, nickname.badgeSymbolFontSize), window.name).toBe(
        true,
      );
      expect(accentedLetterInside(color.preview, color.previewSymbolFontSize), window.name).toBe(
        true,
      );
    }
  });
});

describe('#161 AC4: s kolečkem dál platí společná pravidla menu (#82)', () => {
  for (const [ruleName, rule] of Object.entries(MENU_LAYOUT_RULES)) {
    it(`${ruleName}`, () => {
      for (const { scene } of CASES) {
        expect(rule(scene), scene.label).toEqual([]);
      }
    });
  }
});
