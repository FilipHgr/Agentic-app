import { afterEach, describe, expect, it } from 'vitest';

import { layoutCompareScreen } from '../../../src/games/compare/logic/compareLayout';
import type {
  CompareLayout,
  EquationLayout,
  Rect,
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
 * Testy k #187 AC2 a AC6: rozložení „a ☐ b = c“ s tlačítky + a − pod
 * příkladem na iPadu, telefonu na šířku i na výšku jako pravidla v cyklu
 * přes zkušební okna a oba jazyky (obrazovka hry texty nemá, symboly
 * + − = ☐ jsou v kódu, rozložení musí v každém jazyce vyjít stejně).
 * Všechno se měří v CSS px okna: tlačítka aspoň 64 px, mezi ťukacími
 * plochami a příkladem aspoň 8 px, nic se nepřekrývá (ani s domečkem
 * a kolečkem v rozích) a všechno se vejde na obrazovku, i dvoumístná čísla
 * při rozsahu 20.
 */

const MIN_TOUCH_CSS = 64;
const MIN_GAP_CSS = 8;
/** Čísla příkladu na zařízeních aspoň takhle velká (CSS px). */
const MIN_NUMBER_FONT_CSS = 48;
/** Odhad šířky číslice a „=“ jako díl velikosti písma (bez měření v prohlížeči). */
const DIGIT_WIDTH_RATIO = 0.62;
const EQUALS_WIDTH_RATIO = 0.62;
/** Nejvíc číslic jednoho čísla (rozsah 20). */
const MAX_DIGITS = 2;
/** Na telefonu na výšku: nejmenší písmo čísel podle rozsahu, tlačítka a mezera k nim (CSS px). */
const MIN_PORTRAIT_FONT_10_CSS = 64;
const MIN_PORTRAIT_FONT_20_CSS = 56;
const MIN_PORTRAIT_BUTTON_CSS = 140;
const MAX_PORTRAIT_EQUATION_GAP_CSS = 64;

/** Okno mimo telefon i iPad: dnešní zmenšené zobrazení. */
const SCALED_WINDOW: TestWindow = {
  name: '600×400 zmenšené zobrazení',
  width: 600,
  height: 400,
  safeArea: NO_NOTCH,
};

const LANDSCAPE_WINDOWS: readonly TestWindow[] = [
  ...IPAD_WINDOWS,
  JUST_ABOVE_LIMIT,
  ...PHONE_WINDOWS,
  SCALED_WINDOW,
];
const PORTRAIT_WINDOWS: readonly TestWindow[] = [
  ...PHONE_PORTRAIT_WINDOWS,
  ...PHONE_PORTRAIT_EDGE_WINDOWS,
];
const ALL_WINDOWS = [...LANDSCAPE_WINDOWS, ...PORTRAIT_WINDOWS];
const DEVICE_WINDOWS = ALL_WINDOWS.filter((window) => window !== SCALED_WINDOW);

interface Screen {
  readonly name: string;
  readonly window: TestWindow;
  readonly area: GameArea;
  readonly maxNumber: MaxNumber;
  readonly layout: CompareLayout;
  readonly problem: CompareProblem;
  readonly equation: EquationLayout;
}

afterEach(() => {
  selectLanguage('cs');
});

/**
 * Příklady, přes které jdou pravidla: v každém rozsahu jeden za každý tvar
 * (kolik číslic má které číslo a jaké je znaménko), tedy i ten nejširší
 * („10 − 10 = 0“, „20 − 10 = 10“), podle kterého se počítá písmo.
 */
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

/** Obrazovky hry v okně a jazyce pro všechny rozsahy a tvary příkladů. */
function screensOf(window: TestWindow, language: Language): Screen[] {
  selectLanguage(language);
  const area = gameAreaFor(viewportOf(window), 'fullWindow');
  return MAX_NUMBER_OPTIONS.flatMap((maxNumber) => {
    const layout = layoutCompareScreen(area, maxNumber);
    return problemShapes(maxNumber).map((problem) => ({
      name: `${language}, ${window.name}, do ${maxNumber}: ${problem.a} ☐ ${problem.b} = ${problem.result}`,
      window,
      area,
      maxNumber,
      layout,
      problem,
      equation: layout.equationFor(problem),
    }));
  });
}

/** Všechny kombinace okno × jazyk × rozsah × tvar příkladu, přes které jdou pravidla. */
function screens(windows: readonly TestWindow[] = ALL_WINDOWS): Screen[] {
  return windows.flatMap((window) => LANGUAGES.flatMap((language) => screensOf(window, language)));
}

/** Obdélník herní plochy v CSS px okna. */
function cssOf(rect: Rect, area: GameArea): Box {
  return {
    left: area.offsetX + rect.left * area.scale,
    right: area.offsetX + (rect.left + rect.width) * area.scale,
    top: area.offsetY + rect.top * area.scale,
    bottom: area.offsetY + (rect.top + rect.height) * area.scale,
  };
}

function areaBox(area: GameArea): Box {
  return cssOf({ left: 0, top: 0, width: area.width, height: area.height }, area);
}

/** Plocha pro prst u domečku a u kolečka v CSS px okna. */
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

/** Hvězdičky jako čtverce o straně průměru, v CSS px. */
function starBoxes({ layout, area }: Screen): Box[] {
  const size = layout.stars.starSize;
  return layout.stars.stars.map((star) =>
    cssOf({ left: star.x - size / 2, top: star.y - size / 2, width: size, height: size }, area),
  );
}

/** Části příkladu zleva doprava v CSS px. */
function equationParts({ equation, area }: Screen): Array<{ name: string; box: Box }> {
  return [
    { name: 'první číslo', box: cssOf(equation.first, area) },
    { name: 'okénko', box: cssOf(equation.box, area) },
    { name: 'druhé číslo', box: cssOf(equation.second, area) },
    { name: '„=“', box: cssOf(equation.equals, area) },
    { name: 'výsledek', box: cssOf(equation.result, area) },
  ];
}

function buttonParts({ layout, area }: Screen): Array<{ name: string; box: Box }> {
  return [
    { name: 'tlačítko +', box: cssOf(layout.signButtons.plus, area) },
    { name: 'tlačítko −', box: cssOf(layout.signButtons.minus, area) },
  ];
}

/** Všechny prvky obrazovky v CSS px. */
function namedParts(screen: Screen): Array<{ name: string; box: Box }> {
  return [
    ...equationParts(screen),
    ...buttonParts(screen),
    ...starBoxes(screen).map((box, index) => ({ name: `hvězdička ${index + 1}`, box })),
  ];
}

function width(box: Box): number {
  return box.right - box.left;
}

function height(box: Box): number {
  return box.bottom - box.top;
}

/** Celý příklad jako jeden obdélník. */
function equationBounds(screen: Screen): Box {
  const parts = equationParts(screen).map((part) => part.box);
  return {
    left: Math.min(...parts.map((part) => part.left)),
    right: Math.max(...parts.map((part) => part.right)),
    top: Math.min(...parts.map((part) => part.top)),
    bottom: Math.max(...parts.map((part) => part.bottom)),
  };
}

describe('#187 AC2, AC6: tlačítka + a − jsou velká pro dětský prst', () => {
  it('dítě trefí prstem + i −: v každém okně a jazyce mají aspoň 64 × 64 px', () => {
    for (const screen of screens()) {
      for (const part of buttonParts(screen)) {
        expect(width(part.box), `${screen.name}: ${part.name}`).toBeGreaterThanOrEqual(
          MIN_TOUCH_CSS,
        );
        expect(height(part.box), `${screen.name}: ${part.name}`).toBeGreaterThanOrEqual(
          MIN_TOUCH_CSS,
        );
      }
    }
  });

  it('mezi + a − je aspoň 8 px a mezi tlačítky a příkladem taky', () => {
    for (const screen of screens()) {
      const [plus, minus] = buttonParts(screen).map((part) => part.box) as [Box, Box];
      const equation = equationBounds(screen);
      expect(gapBetween(plus, minus), `${screen.name}: + × −`).toBeGreaterThanOrEqual(
        MIN_GAP_CSS - 0.01,
      );
      for (const button of [plus, minus]) {
        expect(
          gapBetween(button, equation),
          `${screen.name}: tlačítko × příklad`,
        ).toBeGreaterThanOrEqual(MIN_GAP_CSS - 0.01);
      }
    }
  });

  it('tlačítka jsou pod příkladem vedle sebe, + vlevo a − vpravo', () => {
    for (const screen of screens()) {
      const [plus, minus] = buttonParts(screen).map((part) => part.box) as [Box, Box];
      const equation = equationBounds(screen);
      expect(plus.top, screen.name).toBeGreaterThanOrEqual(equation.bottom);
      expect(minus.top, screen.name).toBeCloseTo(plus.top, 3);
      expect(plus.right, screen.name).toBeLessThanOrEqual(minus.left);
      expect(width(plus), screen.name).toBeCloseTo(width(minus), 3);
      expect(height(plus), screen.name).toBeCloseTo(height(minus), 3);
    }
  });
});

describe('#187 AC6: všechno je na obrazovce a nic se nepřekrývá', () => {
  it('dítě vidí celý příklad, tlačítka i hvězdičky, nic nepřečnívá z herní plochy', () => {
    for (const screen of screens()) {
      for (const part of namedParts(screen)) {
        expect(isInside(part.box, areaBox(screen.area)), `${screen.name}: ${part.name}`).toBe(true);
      }
    }
  });

  it('části příkladu, tlačítka a hvězdičky se navzájem nepřekrývají', () => {
    for (const screen of screens()) {
      const parts = namedParts(screen);
      for (const [index, part] of parts.entries()) {
        for (const other of parts.slice(index + 1)) {
          expect(
            overlaps(part.box, other.box),
            `${screen.name}: ${part.name} × ${other.name}`,
          ).toBe(false);
        }
      }
    }
  });

  it('nic ze hry neleží pod domečkem ani pod kolečkem v horních rozích', () => {
    for (const screen of screens()) {
      for (const part of namedParts(screen)) {
        for (const corner of cornerButtons(screen.window)) {
          expect(overlaps(part.box, corner), `${screen.name}: ${part.name}`).toBe(false);
        }
      }
    }
  });

  it('tlačítka + a − jsou od hvězdiček aspoň 8 px', () => {
    for (const screen of screens()) {
      for (const button of buttonParts(screen)) {
        for (const star of starBoxes(screen)) {
          expect(
            gapBetween(button.box, star),
            `${screen.name}: ${button.name}`,
          ).toBeGreaterThanOrEqual(MIN_GAP_CSS - 0.01);
        }
      }
    }
  });
});

describe('#187 AC1, AC6: dítě čte velký příklad „a ☐ b = c“ zleva doprava', () => {
  it('první číslo, okénko, druhé číslo, „=“ a výsledek jsou v jedné řadě za sebou', () => {
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

  it('každé číslo (i dvoumístné při rozsahu 20) a „=“ se celé vejdou do svého místa', () => {
    for (const screen of screens()) {
      const { equation } = screen;
      const fontSize = equation.fontSize;
      const numbers = [
        { slot: equation.first, value: screen.problem.a },
        { slot: equation.second, value: screen.problem.b },
        { slot: equation.result, value: screen.problem.result },
      ];
      for (const { slot, value } of numbers) {
        const digits = String(value).length;
        expect(digits, screen.name).toBeLessThanOrEqual(MAX_DIGITS);
        expect(digits * DIGIT_WIDTH_RATIO * fontSize, screen.name).toBeLessThanOrEqual(slot.width);
        expect(fontSize, screen.name).toBeLessThanOrEqual(slot.height);
      }
      expect(EQUALS_WIDTH_RATIO * fontSize, screen.name).toBeLessThanOrEqual(equation.equals.width);
    }
  });

  it('znaménko v okénku se do okénka celé vejde', () => {
    for (const screen of screens()) {
      const { equation } = screen;
      expect(equation.signSize * DIGIT_WIDTH_RATIO, screen.name).toBeLessThanOrEqual(
        equation.box.width,
      );
      expect(equation.signSize, screen.name).toBeLessThanOrEqual(equation.box.height);
    }
  });

  it('čísla příkladu jsou na každém zařízení velká (aspoň 48 px) a okénko je vidět jako čtverec', () => {
    for (const screen of screens(DEVICE_WINDOWS)) {
      const { equation } = screen;
      expect(equation.fontSize * screen.area.scale, screen.name).toBeGreaterThanOrEqual(
        MIN_NUMBER_FONT_CSS,
      );
      expect(equation.box.width, screen.name).toBeCloseTo(equation.box.height, 3);
    }
  });

  it('znaménka v tlačítkách jsou velká a celá uvnitř tlačítek', () => {
    for (const screen of screens()) {
      const { signButtons } = screen.layout;
      expect(signButtons.symbolSize, screen.name).toBeGreaterThan(0);
      expect(signButtons.symbolSize, screen.name).toBeLessThanOrEqual(signButtons.plus.height);
      expect(signButtons.symbolSize * DIGIT_WIDTH_RATIO, screen.name).toBeLessThanOrEqual(
        signButtons.plus.width,
      );
    }
  });
});

describe('#187 AC6: na telefonu na výšku je příklad velký a u tlačítek', () => {
  it('čísla na výšku mají aspoň 64 px při rozsahu 10 a aspoň 56 px při rozsahu 20', () => {
    for (const screen of screens(PORTRAIT_WINDOWS)) {
      const minimum = screen.maxNumber === 10 ? MIN_PORTRAIT_FONT_10_CSS : MIN_PORTRAIT_FONT_20_CSS;
      expect(screen.equation.fontSize * screen.area.scale, screen.name).toBeGreaterThanOrEqual(
        minimum,
      );
    }
  });

  it('na iPhonu 390 × 844 při rozsahu 10 mají čísla aspoň 70 px', () => {
    const iphone = PHONE_PORTRAIT_WINDOWS.find(
      (window) => window.width === 390 && window.height === 844,
    );
    expect(iphone).toBeDefined();
    for (const screen of screens(iphone ? [iphone] : [])) {
      if (screen.maxNumber === 10) {
        expect(screen.equation.fontSize * screen.area.scale, screen.name).toBeGreaterThanOrEqual(
          70,
        );
      }
    }
  });

  it('tlačítka + a − na výšku mají aspoň 140 px a příklad je od nich nejvýš 64 px', () => {
    for (const screen of screens(PORTRAIT_WINDOWS)) {
      const [plus] = buttonParts(screen).map((part) => part.box) as [Box, Box];
      expect(width(plus), screen.name).toBeGreaterThanOrEqual(MIN_PORTRAIT_BUTTON_CSS);
      expect(plus.top - equationBounds(screen).bottom, screen.name).toBeLessThanOrEqual(
        MAX_PORTRAIT_EQUATION_GAP_CSS,
      );
    }
  });

  it('v jednom rozsahu mají všechny příklady stejně velká čísla, nic mezi příklady neskáče', () => {
    for (const window of ALL_WINDOWS) {
      for (const maxNumber of MAX_NUMBER_OPTIONS) {
        const layout = layoutCompareScreen(
          gameAreaFor(viewportOf(window), 'fullWindow'),
          maxNumber,
        );
        const sizes = new Set(
          allProblems(maxNumber).map((problem) => layout.equationFor(problem).fontSize),
        );
        expect(sizes.size, `${window.name}, do ${maxNumber}`).toBe(1);
      }
    }
  });
});

describe('#187: ťuknutí na okénko', () => {
  it('okénko jde trefit prstem (aspoň 64 × 64 px), je kolem okénka a od tlačítek aspoň 8 px', () => {
    for (const screen of screens()) {
      const hit = cssOf(screen.equation.boxHit, screen.area);
      const box = cssOf(screen.equation.box, screen.area);
      expect(width(hit), screen.name).toBeGreaterThanOrEqual(MIN_TOUCH_CSS - 0.01);
      expect(height(hit), screen.name).toBeGreaterThanOrEqual(MIN_TOUCH_CSS - 0.01);
      expect(isInside(box, hit), screen.name).toBe(true);
      expect(isInside(hit, areaBox(screen.area)), screen.name).toBe(true);
      for (const button of buttonParts(screen)) {
        expect(
          gapBetween(hit, button.box),
          `${screen.name}: ${button.name}`,
        ).toBeGreaterThanOrEqual(MIN_GAP_CSS - 0.01);
      }
      for (const corner of cornerButtons(screen.window)) {
        expect(overlaps(hit, corner), screen.name).toBe(false);
      }
    }
  });
});

describe('#187 AC4: hvězdičky zůstávají', () => {
  it('dítě sbírá 10 hvězdiček: na šířku v jedné řadě, na telefonu na výšku ve 2 řadách po 5', () => {
    for (const screen of screens(LANDSCAPE_WINDOWS)) {
      const stars = screen.layout.stars.stars;
      expect(stars, screen.name).toHaveLength(10);
      expect(new Set(stars.map((star) => star.y)).size, screen.name).toBe(1);
    }
    for (const screen of screens(PORTRAIT_WINDOWS)) {
      const stars = screen.layout.stars.stars;
      expect(stars, screen.name).toHaveLength(10);
      expect(new Set(stars.map((star) => star.y)).size, screen.name).toBe(2);
    }
  });
});
