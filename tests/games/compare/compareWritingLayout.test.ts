import { afterEach, describe, expect, it } from 'vitest';

import {
  MIN_WRITING_BOX_CSS,
  layoutCompareScreen,
} from '../../../src/games/compare/logic/compareLayout';
import type {
  CompareScreenLayout,
  CompareWritingLayout,
  EquationLayout,
  Rect,
  WritingButtonsLayout,
} from '../../../src/games/compare/logic/compareLayout';
import { allProblems } from '../../../src/games/compare/logic/compareProblems';
import type { CompareProblem } from '../../../src/games/compare/logic/compareProblems';
import { MAX_NUMBER_OPTIONS } from '../../../src/games/compare/logic/compareSettings';
import type { MaxNumber } from '../../../src/games/compare/logic/compareSettings';
import { homeButtonFor } from '../../../src/shared/logic/homeButton';
import { settingsGearFor } from '../../../src/shared/logic/settingsGear';
import { gameAreaFor } from '../../../src/shared/logic/viewportLayout';
import type { GameArea } from '../../../src/shared/logic/viewportLayout';
import { LANGUAGES, selectLanguage } from '../../../src/shared/texts/languages';
import type { Language } from '../../../src/shared/texts/languages';
import {
  IPAD_WINDOWS,
  JUST_ABOVE_LIMIT,
  NO_NOTCH,
  PHONE_PORTRAIT_EDGE_WINDOWS,
  PHONE_PORTRAIT_WINDOWS,
  PHONE_WINDOWS,
  gapBetween,
  isInside,
  overlaps,
  viewportOf,
} from '../../shared/viewportFixtures';
import type { Box, TestWindow } from '../../shared/viewportFixtures';

/**
 * Testy k #188 AC5: rozložení při odpovědi psaním na iPadu, telefonu na
 * šířku i na výšku jako pravidla v cyklu přes zkušební okna, oba jazyky,
 * oba rozsahy a všechny tvary příkladů. Vše v CSS px okna: plocha na psaní
 * aspoň 200 × 200 px, čísla příkladu na zařízeních aspoň 64 px (kde se
 * vedle okénka nevejdou, je plocha na psaní pod příkladem), smazání a ✓
 * aspoň 64 px s mezerou 8 px, nic se nepřekrývá ani neleží pod domečkem
 * a kolečkem a všechno je na obrazovce.
 */

const MIN_TOUCH_CSS = 64;
const MIN_GAP_CSS = 8;
/** Čísla příkladu na zařízeních při psaní (CSS px). */
const MIN_NUMBER_FONT_CSS = 64;
/**
 * Na úzkém telefonu na výšku se „20 − 10 = 10“ při 64 px nevejde na šířku
 * ani při ťukání; při psaní je pak příklad stejně velký jako při ťukání
 * a platí pravidlo ťukání (aspoň 56 px při rozsahu 20).
 */
const MIN_PORTRAIT_FONT_20_CSS = 56;
/** Ve zmenšeném zobrazení (žádné zařízení) jsou čísla aspoň vidět (CSS px). */
const MIN_SCALED_NUMBER_FONT_CSS = 16;
/** Na iPadu zůstanou čísla velká (CSS px). */
const MIN_TABLET_NUMBER_FONT_CSS = 96;
const DIGIT_WIDTH_RATIO = 0.62;
const EQUALS_WIDTH_RATIO = 0.62;

const SCALED_WINDOW: TestWindow = {
  name: '600×400 zmenšené zobrazení',
  width: 600,
  height: 400,
  safeArea: NO_NOTCH,
};
const PORTRAIT_WINDOWS: readonly TestWindow[] = [
  ...PHONE_PORTRAIT_WINDOWS,
  ...PHONE_PORTRAIT_EDGE_WINDOWS,
];
const ALL_WINDOWS: readonly TestWindow[] = [
  ...IPAD_WINDOWS,
  JUST_ABOVE_LIMIT,
  ...PHONE_WINDOWS,
  SCALED_WINDOW,
  ...PORTRAIT_WINDOWS,
];

interface Screen {
  readonly name: string;
  readonly window: TestWindow;
  readonly area: GameArea;
  readonly layout: CompareWritingLayout;
  readonly writing: WritingButtonsLayout;
  readonly problem: CompareProblem;
  readonly equation: EquationLayout;
  /** Plocha na psaní (okénko příkladu, nebo samostatná plocha pod příkladem). */
  readonly pad: Rect;
  /** Rozložení při ťukání v tomtéž okně a rozsahu. */
  readonly tapping: CompareScreenLayout;
}

afterEach(() => {
  selectLanguage('cs');
});

/** Jeden příklad za každý tvar (počet číslic čísel a znaménko) v rozsahu. */
function problemShapes(maxNumber: MaxNumber): CompareProblem[] {
  const byShape = new Map<string, CompareProblem>();
  for (const problem of allProblems(maxNumber)) {
    const shape = [problem.a, problem.b, problem.result]
      .map((value) => String(value).length)
      .concat(problem.a + problem.b === problem.result ? 1 : 0)
      .join(':');
    if (!byShape.has(shape)) {
      byShape.set(shape, problem);
    }
  }
  return [...byShape.values()];
}

function screensOf(window: TestWindow, language: Language): Screen[] {
  selectLanguage(language);
  const area = gameAreaFor(viewportOf(window), 'fullWindow');
  return MAX_NUMBER_OPTIONS.flatMap((maxNumber) => {
    const layout = layoutCompareScreen(area, maxNumber, 'writing');
    const writing = layout.writing;
    if (writing === null) {
      throw new Error(`${window.name}: při psaní chybí smazání a ✓`);
    }
    const tapping = layoutCompareScreen(area, maxNumber, 'tap');
    return problemShapes(maxNumber).map((problem) => ({
      name: `${language}, ${window.name}, do ${maxNumber}: ${problem.a} ☐ ${problem.b} = ${problem.result}`,
      window,
      area,
      layout,
      writing,
      problem,
      equation: layout.equationFor(problem),
      pad: writing.pad(problem),
      tapping,
    }));
  });
}

function screens(windows: readonly TestWindow[] = ALL_WINDOWS): Screen[] {
  return windows.flatMap((window) => LANGUAGES.flatMap((language) => screensOf(window, language)));
}

function cssOf(rect: Rect, area: GameArea): Box {
  return {
    left: area.offsetX + rect.left * area.scale,
    right: area.offsetX + (rect.left + rect.width) * area.scale,
    top: area.offsetY + rect.top * area.scale,
    bottom: area.offsetY + (rect.top + rect.height) * area.scale,
  };
}

function width(box: Box): number {
  return box.right - box.left;
}

function height(box: Box): number {
  return box.bottom - box.top;
}

function cornerButtons(window: TestWindow): Box[] {
  const home = homeButtonFor(viewportOf(window));
  const gear = settingsGearFor(viewportOf(window));
  return [
    {
      left: home.left,
      right: home.left + home.hitSize,
      top: home.top,
      bottom: home.top + home.hitSize,
    },
    {
      left: window.width - gear.right - gear.hitSize,
      right: window.width - gear.right,
      top: gear.top,
      bottom: gear.top + gear.hitSize,
    },
  ];
}

function equationParts({ equation, area }: Screen): Array<{ name: string; box: Box }> {
  return [
    { name: 'první číslo', box: cssOf(equation.first, area) },
    { name: 'okénko na psaní', box: cssOf(equation.box, area) },
    { name: 'druhé číslo', box: cssOf(equation.second, area) },
    { name: '„=“', box: cssOf(equation.equals, area) },
    { name: 'výsledek', box: cssOf(equation.result, area) },
  ];
}

function buttonParts({ writing, area }: Screen): Array<{ name: string; box: Box }> {
  return [
    { name: 'smazání', box: cssOf(writing.clear, area) },
    { name: '✓', box: cssOf(writing.confirm, area) },
  ];
}

function starBoxes({ layout, area }: Screen): Box[] {
  const size = layout.stars.starSize;
  return layout.stars.stars.map((star) =>
    cssOf({ left: star.x - size / 2, top: star.y - size / 2, width: size, height: size }, area),
  );
}

/** Samostatná plocha na psaní pod příkladem; při psaní do okénka žádná. */
function separatePad(screen: Screen): Array<{ name: string; box: Box }> {
  return screen.writing.padInProblem
    ? []
    : [{ name: 'plocha na psaní', box: cssOf(screen.pad, screen.area) }];
}

/** Nejmenší písmo čísel při psaní v okně obrazovky (CSS px). */
function minimumFont(screen: Screen): number {
  if (screen.window === SCALED_WINDOW) {
    return MIN_SCALED_NUMBER_FONT_CSS;
  }
  if (PORTRAIT_WINDOWS.includes(screen.window) && screen.layout.maxNumber === 20) {
    return MIN_PORTRAIT_FONT_20_CSS;
  }
  return MIN_NUMBER_FONT_CSS;
}

function namedParts(screen: Screen): Array<{ name: string; box: Box }> {
  return [
    ...equationParts(screen),
    ...separatePad(screen),
    ...buttonParts(screen),
    ...starBoxes(screen).map((box, index) => ({ name: `hvězdička ${index + 1}`, box })),
  ];
}

describe('#188 AC5: plocha na psaní je velká pro dětský prst', () => {
  it('v každém okně, jazyce a rozsahu má plocha na psaní aspoň 200 × 200 px', () => {
    for (const screen of screens()) {
      const box = cssOf(screen.pad, screen.area);
      expect(width(box), screen.name).toBeGreaterThanOrEqual(MIN_WRITING_BOX_CSS - 0.01);
      expect(height(box), screen.name).toBeGreaterThanOrEqual(MIN_WRITING_BOX_CSS - 0.01);
    }
  });

  it('plocha na psaní je stejně velká v celém rozsahu, aby mezi příklady neskákala', () => {
    for (const window of ALL_WINDOWS) {
      const area = gameAreaFor(viewportOf(window), 'fullWindow');
      for (const maxNumber of MAX_NUMBER_OPTIONS) {
        const layout = layoutCompareScreen(area, maxNumber, 'writing');
        const sizes = allProblems(maxNumber).map(
          (problem) => layout.writing?.pad(problem).width ?? 0,
        );
        expect(
          Math.max(...sizes) - Math.min(...sizes),
          `${window.name}, do ${maxNumber}`,
        ).toBeLessThan(0.001);
      }
    }
  });

  it('smazání a ✓ mají aspoň 64 × 64 px a mezi nimi i k příkladu je aspoň 8 px', () => {
    for (const screen of screens()) {
      const [clear, confirm] = buttonParts(screen).map((part) => part.box) as [Box, Box];
      for (const [name, button] of [
        ['smazání', clear],
        ['✓', confirm],
      ] as const) {
        expect(width(button), `${screen.name}: ${name}`).toBeGreaterThanOrEqual(MIN_TOUCH_CSS);
        expect(height(button), `${screen.name}: ${name}`).toBeGreaterThanOrEqual(MIN_TOUCH_CSS);
        for (const part of [...equationParts(screen), ...separatePad(screen)]) {
          expect(
            gapBetween(button, part.box),
            `${screen.name}: ${name} × ${part.name}`,
          ).toBeGreaterThanOrEqual(MIN_GAP_CSS - 0.01);
        }
        for (const star of starBoxes(screen)) {
          expect(
            gapBetween(button, star),
            `${screen.name}: ${name} × hvězdička`,
          ).toBeGreaterThanOrEqual(MIN_GAP_CSS - 0.01);
        }
      }
      expect(gapBetween(clear, confirm), `${screen.name}: smazání × ✓`).toBeGreaterThanOrEqual(
        MIN_GAP_CSS - 0.01,
      );
    }
  });

  it('smazání je vlevo a ✓ vpravo jako v Počítání', () => {
    for (const screen of screens()) {
      const [clear, confirm] = buttonParts(screen).map((part) => part.box) as [Box, Box];
      expect(clear.right, screen.name).toBeLessThanOrEqual(confirm.left);
    }
  });

  it('na telefonu na výšku je velký příklad nahoře, pod ním plocha na psaní a pod ní smazání a ✓ u palce', () => {
    for (const screen of screens(PORTRAIT_WINDOWS)) {
      expect(screen.writing.padInProblem, screen.name).toBe(false);
      const pad = cssOf(screen.pad, screen.area);
      const equation = cssOf(screen.equation.box, screen.area);
      expect(pad.top, screen.name).toBeGreaterThanOrEqual(equation.bottom + MIN_GAP_CSS - 0.01);
      for (const button of buttonParts(screen)) {
        expect(button.box.top, `${screen.name}: ${button.name}`).toBeGreaterThanOrEqual(pad.bottom);
        expect(button.box.top, `${screen.name}: ${button.name}`).toBeGreaterThan(
          (screen.window.height * 2) / 3,
        );
      }
    }
  });

  it('při psaní do okénka příkladu je plocha na psaní právě okénko příkladu', () => {
    for (const screen of screens()) {
      if (screen.writing.padInProblem) {
        expect(screen.pad, screen.name).toEqual(screen.equation.box);
      }
    }
  });
});

describe('#188 AC5: při psaní je všechno na obrazovce a nic se nepřekrývá', () => {
  it('příklad s okénkem, smazání, ✓ i hvězdičky jsou celé na herní ploše', () => {
    for (const screen of screens()) {
      const whole = cssOf(
        { left: 0, top: 0, width: screen.area.width, height: screen.area.height },
        screen.area,
      );
      for (const part of namedParts(screen)) {
        expect(isInside(part.box, whole), `${screen.name}: ${part.name}`).toBe(true);
      }
    }
  });

  it('nic se navzájem nepřekrývá a nic neleží pod domečkem ani kolečkem', () => {
    for (const screen of screens()) {
      const parts = namedParts(screen);
      for (const [index, part] of parts.entries()) {
        for (const corner of cornerButtons(screen.window)) {
          expect(overlaps(part.box, corner), `${screen.name}: ${part.name} v rohu`).toBe(false);
        }
        for (const other of parts.slice(index + 1)) {
          expect(
            overlaps(part.box, other.box),
            `${screen.name}: ${part.name} × ${other.name}`,
          ).toBe(false);
        }
      }
    }
  });
});

describe('#188 AC5: dítě dál čte příklad „a ☐ b = c“ zleva doprava', () => {
  it('čísla, okénko a „=“ jsou v jedné řadě za sebou', () => {
    for (const screen of screens()) {
      const parts = equationParts(screen).map((part) => part.box);
      for (let index = 1; index < parts.length; index += 1) {
        const previous = parts[index - 1]!;
        const current = parts[index]!;
        expect(previous.right, screen.name).toBeLessThanOrEqual(current.left);
        expect((current.top + current.bottom) / 2, screen.name).toBeCloseTo(
          (previous.top + previous.bottom) / 2,
          3,
        );
      }
    }
  });

  it('každé číslo a „=“ se celé vejdou do svého místa a jsou čitelně velké', () => {
    for (const screen of screens()) {
      const { equation, area } = screen;
      const numbers = [
        { slot: equation.first, value: screen.problem.a },
        { slot: equation.second, value: screen.problem.b },
        { slot: equation.result, value: screen.problem.result },
      ];
      for (const { slot, value } of numbers) {
        expect(
          String(value).length * DIGIT_WIDTH_RATIO * equation.fontSize,
          screen.name,
        ).toBeLessThanOrEqual(slot.width);
        expect(equation.fontSize, screen.name).toBeLessThanOrEqual(slot.height);
      }
      expect(EQUALS_WIDTH_RATIO * equation.fontSize, screen.name).toBeLessThanOrEqual(
        equation.equals.width,
      );
      expect(equation.fontSize * area.scale, screen.name).toBeGreaterThanOrEqual(
        minimumFont(screen),
      );
    }
  });

  it('na telefonu na výšku jsou čísla při psaní stejně velká jako při ťukání', () => {
    for (const screen of screens(PORTRAIT_WINDOWS)) {
      expect(screen.equation.fontSize, screen.name).toBeCloseTo(screen.tapping.equationFontSize, 6);
    }
  });

  it('na iPadu zůstanou čísla vedle okénka velká', () => {
    for (const screen of screens(IPAD_WINDOWS)) {
      expect(screen.equation.fontSize * screen.area.scale, screen.name).toBeGreaterThanOrEqual(
        MIN_TABLET_NUMBER_FONT_CSS,
      );
    }
  });

  it('znaménko po správné odpovědi se celé vejde do okénka', () => {
    for (const screen of screens()) {
      const { equation } = screen;
      expect(equation.signSize * DIGIT_WIDTH_RATIO, screen.name).toBeLessThanOrEqual(
        equation.box.width,
      );
      expect(equation.signSize, screen.name).toBeLessThanOrEqual(equation.box.height);
    }
  });

  it('při ťukání zůstane rozložení s tlačítky + a − beze změny', () => {
    for (const window of ALL_WINDOWS) {
      const area = gameAreaFor(viewportOf(window), 'fullWindow');
      for (const maxNumber of MAX_NUMBER_OPTIONS) {
        const tapping = layoutCompareScreen(area, maxNumber, 'tap');
        const byDefault = layoutCompareScreen(area, maxNumber);
        expect(tapping.writing, window.name).toBeNull();
        expect(tapping.signButtons, window.name).toEqual(byDefault.signButtons);
        for (const problem of problemShapes(maxNumber)) {
          expect(tapping.equationFor(problem), window.name).toEqual(byDefault.equationFor(problem));
        }
      }
    }
  });
});
