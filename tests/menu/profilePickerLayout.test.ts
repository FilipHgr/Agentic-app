import { describe, expect, it } from 'vitest';

import type { MenuBox } from '../../src/menu/logic/menuLayout';
import type { ProfilePickerLayout } from '../../src/menu/logic/profileLayout';
import { chooseLayoutMode } from '../../src/shared/logic/viewportLayout';
import {
  edgeViolations,
  fitViolations,
  overlapViolations,
  tapGapViolations,
  tapSizeViolations,
  textFitViolations,
} from '../shared/layoutRules';
import type { LayoutItem, LayoutRule, LayoutScene } from '../shared/layoutRules';
import { freeAreaOf, heightOf, viewportOf, widthOf } from '../shared/viewportFixtures';
import type { TestWindow } from '../shared/viewportFixtures';
import { MENU_WINDOWS, findWindow } from './manyGamesFixtures';
import {
  PICKER_CASES,
  TODAY_LANGUAGE_NAMES,
  describeLayoutRules,
  pickerLayout,
  pickerScenes,
} from './menuLayoutScenes';

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
 * Společná pravidla (odhad šířky textu podle #65, i písmeno v kolečku, přezdívka „WWWWWWWWWWWW“ na dva
 * řádky a otevřená nabídka jazyků) hlídá `describeLayoutRules` (#82). Tady
 * zůstávají kontroly podle obrázku, každá v cyklu přes okna, a test zprávy
 * při selhání (#82 AC5). Vzhled (plné „CS“, barvy, háčky nad písmeny) se
 * kontroluje ručně.
 */

const ROUNDING = 1e-6;
const TABLET_CIRCLE = 140;
const PHONE_CIRCLE = 110;

/**
 * Kolik různých kombinací (okno × počet profilů) pravidlo na výběru
 * profilu hlídalo před #82: 17 oken a 3 počty profilů, spočítáno
 * jednorázově z testů před #82.
 */
const TODAY_COMBINATIONS: Readonly<Record<string, number>> = {
  'vejde se do okna i mimo výřez': 51,
  'nic se nepřekrývá': 51,
  'ťukací plocha aspoň 64 px': 51,
  'mezera mezi plochami aspoň 8 px': 51,
  'aspoň 4 px od okraje': 51,
  'text se vejde do své plochy': 51,
};

describeLayoutRules('výběr profilu', pickerScenes, TODAY_COMBINATIONS);

function isPhone(window: TestWindow): boolean {
  const mode = chooseLayoutMode(viewportOf(window));
  return mode === 'phoneLandscape' || mode === 'phonePortrait';
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

/** Každý případ: počet profilů a okno, s rozložením a popisem pro zprávu. */
function eachCase(
  check: (label: string, layout: ProfilePickerLayout, window: TestWindow, add: boolean) => void,
): void {
  for (const { name, count, add } of PICKER_CASES) {
    for (const window of MENU_WINDOWS) {
      check(`${name}, ${window.name}`, pickerLayout(window, count, add), window, add);
    }
  }
}

describe('#72 AC1: výběr profilu podle obrázku P ve všech zkušebních oknech', () => {
  it('každý profil má kolečko, „+“ je jen tam, kde má být, a nabídka jazyků má řádek na jazyk', () => {
    for (const { name, count, add } of PICKER_CASES) {
      for (const window of MENU_WINDOWS) {
        const label = `${name}, ${window.name}`;
        const layout = pickerLayout(window, count, add);
        expect(layout.profiles, label).toHaveLength(count);
        expect(layout.add === null, label).toBe(!add);
        expect(layout.languagePanel.rows, label).toHaveLength(TODAY_LANGUAGE_NAMES.length);
      }
    }
  });

  it(`kolečka mají na telefonu ${PHONE_CIRCLE} px, na iPadu ${TABLET_CIRCLE} px a „+“ je stejně velké`, () => {
    eachCase((label, layout, window) => {
      const size = isPhone(window) ? PHONE_CIRCLE : TABLET_CIRCLE;
      for (const circle of circlesOf(layout)) {
        expect(widthOf(circle), label).toBeCloseTo(size, 5);
        expect(heightOf(circle), label).toBeCloseTo(size, 5);
      }
    });
  });

  it('přezdívka je pod svým kolečkem', () => {
    eachCase((label, layout) => {
      layout.profiles.forEach((slot, index) => {
        expect(slot.nickname.top, `${label}: profil ${index + 1}`).toBeGreaterThanOrEqual(
          slot.circle.bottom - ROUNDING,
        );
      });
    });
  });

  it('kolečka jdou v pořadí založení profilů a „+“ je za nimi', () => {
    eachCase((label, layout) => {
      const circles = circlesOf(layout);
      circles.slice(1).forEach((circle, index) => {
        const previous = circles[index] ?? circle;
        expect(comesAfter(previous, circle), `${label}: kolečko ${index + 2}`).toBe(true);
      });
    });
  });

  it('tlačítko jazyka je vpravo nahoře nad kolečky', () => {
    eachCase((label, layout, window) => {
      const area = freeAreaOf(window);
      const button = layout.languageSlot;
      for (const circle of circlesOf(layout)) {
        expect(button.top, label).toBeLessThan(circle.top);
      }
      expect(area.right - button.right, label).toBeLessThan(button.left - area.left);
    });
  });
});

describe('#72 AC1: rozložení koleček na telefonu podle obrázku', () => {
  it('na šířku je 6 profilů i 5 profilů s „+“ v 1 řadě, na výšku ve 2 sloupcích s „+“ na konci', () => {
    for (const window of MENU_WINDOWS) {
      const mode = chooseLayoutMode(viewportOf(window));
      for (const { count, add } of PICKER_CASES.slice(0, 2)) {
        const layout = pickerLayout(window, count, add);
        const circles = circlesOf(layout);
        const label = `${window.name}, ${count} profilů${add ? ' a „+“' : ''}`;
        if (mode === 'phoneLandscape') {
          expect(new Set(circles.map((circle) => Math.round(circle.top))).size, label).toBe(1);
        }
        if (mode === 'phonePortrait') {
          expect(new Set(circles.map((circle) => Math.round(circle.left))).size, label).toBe(2);
          if (add) {
            const last = layout.profiles[count - 1]?.circle;
            expect(last, label).toBeDefined();
            expect(layout.add?.top, label).toBeCloseTo(last?.top ?? -1, 5);
          }
        }
      }
    }
  });
});

describe('#72 AC4: přezdívka pod kolečkem', () => {
  it('přezdívka má písmo 16 px a nejvýš dva řádky', () => {
    for (const window of MENU_WINDOWS) {
      const layout = pickerLayout(window, 6, false);
      expect(layout.nicknameFontSize, window.name).toBe(16);
      expect(layout.nicknameMaxLines, window.name).toBe(2);
    }
  });
});

// ---------------------------------------------------------------------------
// #82 AC5: zpráva při selhání
// ---------------------------------------------------------------------------

function sceneOf(label: string): LayoutScene {
  const scene = pickerScenes().find((candidate) => candidate.label === label);
  if (scene === undefined) {
    throw new Error(`případ ${label} neexistuje`);
  }
  return scene;
}

function itemOf(scene: LayoutScene, name: string): LayoutItem {
  const item = scene.items.find((candidate) => candidate.name === name);
  if (item === undefined) {
    throw new Error(`${scene.label}: chybí ${name}`);
  }
  return item;
}

function withItem(
  scene: LayoutScene,
  name: string,
  change: (item: LayoutItem) => LayoutItem,
): LayoutScene {
  itemOf(scene, name);
  return {
    ...scene,
    items: scene.items.map((item) => (item.name === name ? change(item) : item)),
  };
}

function moved(item: LayoutItem, dx: number, dy: number): LayoutItem {
  const { box } = item;
  return {
    ...item,
    box: { left: box.left + dx, right: box.right + dx, top: box.top + dy, bottom: box.bottom + dy },
  };
}

describe('#82 AC5: zpráva o porušeném pravidle řekne obrazovku, okno, stav a prvek', () => {
  it('úmyslně chybný výběr profilu 844×340 se 6 profily: každé pravidlo uvede, kde se co stalo', () => {
    const window = findWindow('844×340');
    const scene = sceneOf(`výběr profilu, ${window.name}, 6 profilů bez „+“`);
    const free = scene.free;
    const sixth = itemOf(scene, 'kolečko 6');
    const fifth = itemOf(scene, 'kolečko 5');
    const broken: Array<[string, LayoutRule, LayoutScene, string]> = [
      [
        'kolečko za pravým okrajem',
        fitViolations,
        withItem(scene, 'kolečko 6', (item) => moved(item, free.right - item.box.left - 20, 0)),
        'kolečko 6 přesahuje pravý okraj',
      ],
      [
        'kolečko u okraje',
        edgeViolations,
        withItem(scene, 'kolečko 6', (item) => moved(item, free.right - 2 - item.box.right, 0)),
        'kolečko 6 je blíž než 4 px k okraji',
      ],
      [
        'kolečko na přezdívce',
        overlapViolations,
        withItem(scene, 'kolečko 6', (item) => moved(item, 0, 20)),
        'kolečko 6 se překrývá s přezdívka 6',
      ],
      [
        'malé kolečko',
        tapSizeViolations,
        withItem(scene, 'kolečko 6', (item) => ({
          ...item,
          box: { ...item.box, right: item.box.left + 40, bottom: item.box.top + 40 },
        })),
        'kolečko 6 má jen 40 px × 40 px',
      ],
      [
        'kolečko těsně u vedlejšího',
        tapGapViolations,
        withItem(scene, 'kolečko 6', (item) =>
          moved(item, fifth.box.right + 2 - sixth.box.left, fifth.box.top - sixth.box.top),
        ),
        'mezi kolečko 5 a kolečko 6 je jen 2 px',
      ],
      [
        'velké písmeno v kolečku',
        textFitViolations,
        withItem(scene, 'kolečko 6', (item) => ({
          ...item,
          texts: [{ text: 'W', fontSize: 200, charWidth: 1 }],
        })),
        'text „W“ v kolečko 6 potřebuje šířku',
      ],
    ];

    for (const [what, rule, brokenScene, expectedPart] of broken) {
      const messages = rule(brokenScene);
      const message = messages.find((text) => text.includes(expectedPart)) ?? '';
      expect(message, `${what}: ${messages.join(' | ')}`).toContain(expectedPart);
      for (const part of ['výběr profilu', '844×340', '6 profilů']) {
        expect(message, `${what}: ${part}`).toContain(part);
      }
    }
  });
});
