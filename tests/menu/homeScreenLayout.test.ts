import { describe, expect, it } from 'vitest';

import { HOME_SCREEN_WINDOWS } from '../shared/layoutRules';
import type { LayoutScene } from '../shared/layoutRules';
import { MENU_LAYOUT_RULES, menuScenesIn } from './menuLayoutScenes';

/**
 * Testy k #78 AC3: menu spuštěné z plochy jen skryje lištu Safari,
 * rozložení zůstává stejné jako v záložce. Na každé obrazovce menu
 * (mřížka, posouvání, jazyky, výběr profilu, formulář, smazání) platí
 * v oknech z plochy (`HOME_SCREEN_WINDOWS`) společná pravidla z #67–#73:
 * 64 px, 8 px mezi plochami, nic pod výřezem, stavovým řádkem ani lištou
 * domů a 4 px od okraje (a „text se vejde“ z #82). Výjimky menu jsou stejné
 * jako v záložce (`menuLayoutScenes.ts`). Jeden test na pravidlo, popis
 * případu (obrazovka, okno, stav) je ve zprávě `expect`.
 */

const HOME_SCREENS = menuScenesIn(HOME_SCREEN_WINDOWS);

for (const [screenTitle, buildScenes] of Object.entries(HOME_SCREENS)) {
  describe(`#78 AC3: ${screenTitle} v aplikaci z plochy dodrží společná pravidla`, () => {
    let cached: LayoutScene[] | undefined;
    const scenes = (): LayoutScene[] => {
      cached ??= buildScenes();
      return cached;
    };

    it('zkouší se všechna okna z plochy ze zadání', () => {
      for (const window of HOME_SCREEN_WINDOWS) {
        expect(
          scenes().some((scene) => scene.label.includes(window.name)),
          window.name,
        ).toBe(true);
      }
    });

    for (const [ruleName, rule] of Object.entries(MENU_LAYOUT_RULES)) {
      it(`${ruleName} ve všech oknech z plochy`, () => {
        for (const scene of scenes()) {
          expect(rule(scene), scene.label).toEqual([]);
        }
      });
    }
  });
}
