import { describe, expect, it } from 'vitest';

import type { MenuBox } from '../../src/menu/logic/menuLayout';
import type { ProfilePickerLayout } from '../../src/menu/logic/profileLayout';
import { MAX_PROFILES } from '../../src/menu/logic/profileScreens';
import { chooseLayoutMode } from '../../src/shared/logic/viewportLayout';
import { heightOf, viewportOf, widthOf } from '../shared/viewportFixtures';
import type { TestWindow } from '../shared/viewportFixtures';
import { MENU_WINDOWS, findWindow } from './manyGamesFixtures';
import { pickerLayout } from './menuLayoutScenes';

/**
 * Testy k #107 AC3 a AC4: rozložení výběru profilu ve všech zkušebních
 * oknech menu (iPad i telefon, na šířku i na výšku) a pro 1 až 6 profilů
 * bez „+“ a 1 až 5 profilů s „+“ (se 6 profily se „+“ neukáže). Podle
 * obrázků schválených vlastníkem (tuzka-ipad.png, tuzka-telefon-sirka.png,
 * tuzka-telefon-vyska.png):
 * - 6 koleček (6 profilů, nebo 5 a „+“) je na iPadu a telefonu na šířku
 *   ve 2 řadách po 3, na telefonu na výšku ve 2 sloupcích,
 * - na menších oknech se kolečka zmenší, v nejmenším okně (744 × 296) až
 *   na 92 px; nikde se neposouvá, všechno se vejde do okna.
 *
 * #160: tužka u každého kolečka (64 px vpravo od kolečka, 8 px od ostatních
 * prvků a od okraje) je nahrazená jedinou tužkou v liště vlevo od jazyka
 * a odznaky na kolečkách v režimu úprav. Pravidla tužky u kolečka níž jsou
 * proto nahrazená testy v `tests/menu/profileEditModeLayout.test.ts`
 * (u každého je komentář, čím), pravidla koleček a přezdívek zůstávají.
 *
 * Každé pravidlo je jeden test, který v cyklu projde všechny případy;
 * zpráva při selhání řekne okno a počet profilů.
 */

const ROUNDING = 1e-6;
const TABLET_CIRCLE = 140;
const PHONE_CIRCLE = 110;
/**
 * Kolečka ve 2 sloupcích na šířce 390 px po zvětšení mezery u tužky
 * (#113 AC4). Od #160 tužka u kolečka není, kolečka smí být větší, tohle
 * je nejmenší velikost.
 */
const TWO_COLUMN_390_CIRCLE = 99;
/** Nejmenší kolečko podle schválených obrázků (744 × 296, 6 koleček). */
const SMALLEST_CIRCLE = 92;

interface PencilCase {
  readonly name: string;
  readonly count: number;
  readonly add: boolean;
}

/** 1 až 6 profilů bez „+“ a 1 až 5 profilů s „+“. */
const PENCIL_CASES: readonly PencilCase[] = Array.from({ length: MAX_PROFILES }, (_, index) => {
  const count = index + 1;
  const cases: PencilCase[] = [{ name: `${count} bez „+“`, count, add: false }];
  if (count < MAX_PROFILES) {
    cases.push({ name: `${count} a „+“`, count, add: true });
  }
  return cases;
}).flat();

function labelOf(window: TestWindow, pencilCase: PencilCase): string {
  return `${window.name}, ${pencilCase.name}`;
}

/** Každý případ: okno a počet profilů, s rozložením a popisem pro zprávu. */
function eachCase(
  check: (label: string, layout: ProfilePickerLayout, window: TestWindow, add: boolean) => void,
): void {
  for (const pencilCase of PENCIL_CASES) {
    for (const window of MENU_WINDOWS) {
      const layout = pickerLayout(window, pencilCase.count, pencilCase.add);
      check(labelOf(window, pencilCase), layout, window, pencilCase.add);
    }
  }
}

function modeOf(window: TestWindow) {
  return chooseLayoutMode(viewportOf(window));
}

function isPhone(window: TestWindow): boolean {
  const mode = modeOf(window);
  return mode === 'phoneLandscape' || mode === 'phonePortrait';
}

/** Všechna kolečka (profily a „+“) v pořadí. */
function circlesOf(layout: ProfilePickerLayout): MenuBox[] {
  const circles = layout.profiles.map((slot) => slot.circle);
  return layout.add === null ? circles : [...circles, layout.add];
}

// #160 AC1 nahrazuje #107 AC3 (tužka u každého profilu, u „+“ ne): u koleček ani u „+“
// tužka není, je jedna v liště pro všechny profily, viz `profileEditModeLayout.test.ts`
// („u koleček profilů ani u „+“ není žádná tužka“, „tužka v liště je v každém okně…“).

describe('#107 AC4: kolečka podle schváleného obrázku', () => {
  // #160 AC1 nahrazuje „tužka má 64 × 64 px, je vpravo od kolečka a horním okrajem
  // zarovnaná“: tužka je jedna v liště vlevo od jazyka, aspoň 64 × 64 px
  // (`profileEditModeLayout.test.ts`).

  it('6 koleček je na iPadu i na telefonu na šířku ve 2 řadách po 3, na výšku ve 2 sloupcích', () => {
    for (const pencilCase of PENCIL_CASES.filter((item) => item.count + (item.add ? 1 : 0) === 6)) {
      for (const window of MENU_WINDOWS) {
        const label = labelOf(window, pencilCase);
        const circles = circlesOf(pickerLayout(window, pencilCase.count, pencilCase.add));
        const rows = new Set(circles.map((circle) => Math.round(circle.top)));
        const columns = new Set(circles.map((circle) => Math.round(circle.left)));
        if (modeOf(window) === 'phonePortrait') {
          expect(columns.size, `${label}: sloupce`).toBe(2);
        } else {
          expect(rows.size, `${label}: řady`).toBe(2);
          expect(columns.size, `${label}: kolečka v řadě`).toBe(3);
        }
      }
    }
  });

  it(`kolečka mají na iPadu ${TABLET_CIRCLE} px, na telefonu nejvýš ${PHONE_CIRCLE} px a nikde méně než ${SMALLEST_CIRCLE} px`, () => {
    eachCase((label, layout, window) => {
      const circles = circlesOf(layout);
      const size = widthOf(circles[0] ?? { left: 0, right: 0, top: 0, bottom: 0 });
      for (const circle of circles) {
        expect(widthOf(circle), `${label}: všechna kolečka i „+“ stejně velká`).toBeCloseTo(
          size,
          5,
        );
        expect(heightOf(circle), `${label}: kolečko je kulaté`).toBeCloseTo(size, 5);
      }
      if (isPhone(window)) {
        expect(size, label).toBeLessThanOrEqual(PHONE_CIRCLE + ROUNDING);
        expect(size, label).toBeGreaterThanOrEqual(SMALLEST_CIRCLE - ROUNDING);
      } else {
        expect(size, label).toBeCloseTo(TABLET_CIRCLE, 5);
      }
    });
  });

  // #113 AC4: ve 2 sloupcích měla mezera u tužky přednost, kolečka na 390×844 měla 99 px.
  // #160: tužka u kolečka není, 99 px je teď nejmenší velikost, ne přesná.
  it('kolečka se zmenší jen tam, kde je málo místa: na iPhonu 390×844 na výšku mají v jednom sloupci 110 px, ve dvou aspoň 99 px', () => {
    const window = findWindow('390×844');
    for (const pencilCase of PENCIL_CASES) {
      const circles = circlesOf(pickerLayout(window, pencilCase.count, pencilCase.add));
      const columns = new Set(circles.map((circle) => Math.round(circle.left))).size;
      for (const circle of circles) {
        const where = `${labelOf(window, pencilCase)}, sloupce ${columns}`;
        if (columns === 1) {
          expect(widthOf(circle), where).toBeCloseTo(PHONE_CIRCLE, 5);
        } else {
          expect(widthOf(circle), where).toBeGreaterThanOrEqual(TWO_COLUMN_390_CIRCLE - ROUNDING);
          expect(widthOf(circle), where).toBeLessThanOrEqual(PHONE_CIRCLE + ROUNDING);
        }
      }
    }
  });

  it('přezdívka zůstane pod svým kolečkem', () => {
    eachCase((label, layout) => {
      layout.profiles.forEach((slot, index) => {
        expect(slot.nickname.top, `${label}: profil ${index + 1}`).toBeGreaterThanOrEqual(
          slot.circle.bottom - ROUNDING,
        );
      });
    });
  });

  // #160 AC4 nahrazuje „tužku dělí od kolečka, přezdívky, „+“, sousedního profilu i tlačítka
  // jazyka aspoň 8 px“: tužka v liště je aspoň 8 px od jazyka, okraje bezpečné plochy,
  // koleček, přezdívek a „+“ (`profileEditModeLayout.test.ts`).
});

// #160 AC4 nahrazuje společná pravidla výběru s tužkami u koleček: stejná pravidla
// (`MENU_LAYOUT_RULES`) v cyklu pro všechna okna a 11 kombinací profilů a „+“ hlídá
// `profileEditModeLayout.test.ts` s tužkou v liště.
