import { describe, expect, it } from 'vitest';

import type { MenuBox } from '../../src/menu/logic/menuLayout';
import type { ProfilePickerLayout } from '../../src/menu/logic/profileLayout';
import { MAX_PROFILES } from '../../src/menu/logic/profileScreens';
import { chooseLayoutMode } from '../../src/shared/logic/viewportLayout';
import { LANGUAGES } from '../../src/shared/texts/languages';
import type { LayoutItem, LayoutScene } from '../shared/layoutRules';
import { freeAreaOf, gapBetween, heightOf, viewportOf, widthOf } from '../shared/viewportFixtures';
import type { TestWindow } from '../shared/viewportFixtures';
import { MENU_WINDOWS, findWindow } from './manyGamesFixtures';
import { MENU_LAYOUT_RULES, WIDEST_NICKNAME, pickerLayout } from './menuLayoutScenes';

/**
 * Testy k #107 AC3 a AC4: rozložení tužky u profilu na výběru profilu
 * ve všech zkušebních oknech menu (iPad i telefon, na šířku i na výšku)
 * a pro 1 až 6 profilů bez „+“ a 1 až 5 profilů s „+“ (se 6 profily se
 * „+“ neukáže). Podle obrázků schválených vlastníkem (tuzka-ipad.png,
 * tuzka-telefon-sirka.png, tuzka-telefon-vyska.png):
 * - tužka je kulaté tlačítko 64 px vpravo od kolečka, horním okrajem
 *   zarovnaná s kolečkem, mezera 8 px,
 * - 6 koleček (6 profilů, nebo 5 a „+“) je na iPadu a telefonu na šířku
 *   ve 2 řadách po 3, na telefonu na výšku ve 2 sloupcích,
 * - na menších oknech se kolečka zmenší, v nejmenším okně (744 × 296) až
 *   na 92 px; nikde se neposouvá, všechno se vejde do okna.
 *
 * Navržené rozhraní (`src/menu/logic/profileLayout.ts`): `ProfilePickerSlot`
 * dostane `pencil: MenuBox`, ťukací plochu tužky u profilu. „+“ zůstává
 * jen `add: MenuBox | null` bez tužky.
 *
 * Každé pravidlo je jeden test, který v cyklu projde všechny případy;
 * zpráva při selhání řekne okno a počet profilů. Vzhled tužky (AC6) se
 * kontroluje ručně.
 */

const ROUNDING = 1e-6;
const TOLERANCE = 0.01;
const PENCIL_SIZE = 64;
const PENCIL_GAP = 8;
const TABLET_CIRCLE = 140;
const PHONE_CIRCLE = 110;
/** Nejmenší kolečko podle schválených obrázků (744 × 296, 6 koleček). */
const SMALLEST_CIRCLE = 92;
/** Písmeno „W“ a přezdívka se měří jako 1,0 × písmo na písmeno (#72 AC4). */
const WIDE_LETTER = 1;
const NICKNAME_LINE_HEIGHT = 20;

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

/** Obrazovka výběru profilu s tužkami pro společná pravidla (`tests/shared/layoutRules.ts`). */
function pencilScene(window: TestWindow, pencilCase: PencilCase): LayoutScene {
  const layout = pickerLayout(window, pencilCase.count, pencilCase.add);
  const symbol = { text: 'W', fontSize: layout.symbolFontSize, charWidth: WIDE_LETTER };
  const items: LayoutItem[] = [
    {
      name: 'tlačítko jazyka',
      box: layout.languageSlot,
      tappable: true,
      texts: LANGUAGES.map((code) => ({
        text: code.toUpperCase(),
        fontSize: layout.languageButtonFontSize,
      })),
    },
    ...layout.profiles.flatMap((slot, index): LayoutItem[] => [
      { name: `kolečko ${index + 1}`, box: slot.circle, tappable: true, texts: [symbol] },
      {
        name: `přezdívka ${index + 1}`,
        box: slot.nickname,
        texts: [
          {
            text: WIDEST_NICKNAME,
            fontSize: layout.nicknameFontSize,
            charWidth: WIDE_LETTER,
            maxLines: layout.nicknameMaxLines,
            lineHeight: NICKNAME_LINE_HEIGHT,
            padding: 0,
          },
        ],
      },
      // AC4: tužku dělí od okraje plochy aspoň 8 px (ne jen 4 px jako ostatní).
      { name: `tužka ${index + 1}`, box: slot.pencil, tappable: true, minEdge: PENCIL_GAP },
    ]),
  ];
  if (layout.add !== null) {
    items.push({ name: '„+“', box: layout.add, tappable: true, texts: [symbol] });
  }
  return {
    label: `výběr profilu s tužkami, ${labelOf(window, pencilCase)}`,
    free: freeAreaOf(window),
    items,
  };
}

function pencilScenes(): LayoutScene[] {
  return PENCIL_CASES.flatMap((pencilCase) =>
    MENU_WINDOWS.map((window) => pencilScene(window, pencilCase)),
  );
}

/** Mezery tužek od všech ostatních prvků (kolečko, přezdívka, „+“, sousední profil, jazyk). */
function pencilGapViolations(scene: LayoutScene): string[] {
  const pencils = scene.items.filter((item) => item.name.startsWith('tužka'));
  return pencils.flatMap((pencil) =>
    scene.items
      .filter((other) => other !== pencil)
      .filter((other) => gapBetween(pencil.box, other.box) < PENCIL_GAP - TOLERANCE)
      .map(
        (other) =>
          `${scene.label}: mezi ${pencil.name} a ${other.name} je jen ${Math.round(gapBetween(pencil.box, other.box) * 100) / 100} px`,
      ),
  );
}

describe('#107 AC3: tužka je u každého profilu, u „+“ není', () => {
  it('každý profil má svou tužku, i jediný profil, a tužek je stejně jako profilů', () => {
    eachCase((label, layout) => {
      const pencils = layout.profiles.map((slot) => slot.pencil);
      expect(
        pencils.every((pencil) => pencil !== undefined),
        label,
      ).toBe(true);
      expect(pencils, label).toHaveLength(layout.profiles.length);
    });
  });

  it('u „+“ tužka není: vpravo vedle „+“ v jeho výšce není žádná tužka', () => {
    eachCase((label, layout, _window, add) => {
      if (!add || layout.add === null) {
        return;
      }
      const plus = layout.add;
      const nextToPlus = layout.profiles.filter(
        (slot) =>
          Math.abs(slot.pencil.top - plus.top) < TOLERANCE &&
          Math.abs(slot.pencil.left - (plus.right + PENCIL_GAP)) < TOLERANCE,
      );
      expect(nextToPlus, label).toHaveLength(0);
    });
  });
});

describe('#107 AC4: tužka podle schváleného obrázku', () => {
  it(`tužka má ${PENCIL_SIZE} × ${PENCIL_SIZE} px, je vpravo od kolečka ${PENCIL_GAP} px a horním okrajem zarovnaná`, () => {
    eachCase((label, layout) => {
      layout.profiles.forEach((slot, index) => {
        const where = `${label}: tužka ${index + 1}`;
        expect(widthOf(slot.pencil), where).toBeCloseTo(PENCIL_SIZE, 5);
        expect(heightOf(slot.pencil), where).toBeCloseTo(PENCIL_SIZE, 5);
        expect(slot.pencil.left - slot.circle.right, where).toBeCloseTo(PENCIL_GAP, 5);
        expect(slot.pencil.top, where).toBeCloseTo(slot.circle.top, 5);
      });
    });
  });

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

  it('kolečka se zmenší jen tam, kde je málo místa: na iPhonu 390×844 na výšku zůstanou 110 px', () => {
    const window = findWindow('390×844');
    for (const pencilCase of PENCIL_CASES) {
      const circles = circlesOf(pickerLayout(window, pencilCase.count, pencilCase.add));
      for (const circle of circles) {
        expect(widthOf(circle), labelOf(window, pencilCase)).toBeCloseTo(PHONE_CIRCLE, 5);
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

  it('tužku dělí od kolečka, přezdívky, „+“, sousedního profilu i tlačítka jazyka aspoň 8 px', () => {
    for (const scene of pencilScenes()) {
      expect(pencilGapViolations(scene), scene.label).toEqual([]);
    }
  });
});

describe('#107 AC4: výběr profilu s tužkami dodrží společná pravidla v každém okně a pro 1–6 profilů', () => {
  for (const [ruleName, rule] of Object.entries(MENU_LAYOUT_RULES)) {
    it(`${ruleName}`, () => {
      for (const scene of pencilScenes()) {
        expect(rule(scene), scene.label).toEqual([]);
      }
    });
  }

  it('případy pokrývají všechna okna menu a 11 kombinací počtu profilů a „+“', () => {
    expect(PENCIL_CASES).toHaveLength(11);
    expect(pencilScenes()).toHaveLength(PENCIL_CASES.length * MENU_WINDOWS.length);
  });
});
