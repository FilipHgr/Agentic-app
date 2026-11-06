import { describe, expect, it } from 'vitest';

import { gameAreaFor } from '../../../src/shared/logic/viewportLayout';
import {
  layoutDeviceScreen,
  layoutDeviceWritingScreen,
  layoutPhoneHint,
  layoutPhoneScreen,
  layoutPhoneWritingScreen,
} from '../../../src/games/counting/logic/deviceLayout';
import type { GameArea } from '../../../src/shared/logic/viewportLayout';
import type {
  PhoneScreenLayout,
  PhoneWritingLayout,
} from '../../../src/games/counting/logic/deviceLayout';
import { slotWidth } from '../../../src/games/counting/logic/screenLayout';
import type { HintDot } from '../../../src/games/counting/logic/screenLayout';
import type { MaxNumber, OperationMode } from '../../../src/games/counting/logic/settings';
import { STARS_PER_SET } from '../../../src/games/counting/logic/stars';
import {
  PORTRAIT_FONT_BEFORE,
  fontWithHintBefore,
  groupsName,
  hintGroupsInRange,
  landscapeFontsBefore,
} from './phoneProblemFont';
import {
  PHONE_PORTRAIT_EDGE_WINDOWS,
  PHONE_PORTRAIT_WINDOWS,
  PHONE_WINDOWS,
  box,
  boundsOf,
  freeAreaOf,
  toCss,
  viewportOf,
} from '../../shared/viewportFixtures';
import type { Box, TestWindow } from '../../shared/viewportFixtures';

/**
 * Testy k #63 (příklad bez nikoho vedle), AC3 (telefon na šířku, #54)
 * a AC4 (telefon na výšku, #56), v CSS px. Písmo „aspoň jako dnes“ se
 * porovnává s hodnotami zapsanými před změnou (`phoneProblemFont.ts`),
 * ne s tím, co spočítá nový kód.
 *
 * Ostatní pravidla z #54, #55 a #56 dál hlídají: tlačítka 64 px s mezerou
 * 8 px, ťukací tečky 48 px, roh s kolečkem, výřez a lišta, nic se
 * nepřekrývá a 4 px od okraje společná pravidla v
 * `countingLayoutRules.test.ts` (#81); okénka na psaní, hvězdičky 24 px,
 * ovládání u palce a nápověda nic neposune `phoneLandscapeLayout.test.ts`
 * a `phonePortraitLayout.test.ts`; otočení `resizeKeepsRound.test.ts`
 * a `phonePortraitResize.test.ts`.
 */

const RANGES: MaxNumber[] = [5, 10, 20];
const OPERATIONS: OperationMode[] = ['plus', 'minus', 'mixed'];

type Mode = 'keypad' | 'writing';
const MODES: Mode[] = ['keypad', 'writing'];

/** Prázdná řada i plná řada při oslavě. */
const STAR_COUNTS = [0, STARS_PER_SET];

/** Tolerance pro „uprostřed“ v CSS px. */
const CENTER_TOLERANCE = 1;

/** Tolerance na zaokrouhlení v CSS px. */
const TOLERANCE = 0.01;

/** Roh domečku na šířku (#68) a nejvíc kolik px jsou tečky od příkladu (vedle 12 px, pod ním 6 px). */
const HOME_CORNER_SIZE = 88;
const PROBLEM_DOTS_GAP = 12;
const MAX_PROBLEM_DOTS_GAP = PROBLEM_DOTS_GAP + 1;

/**
 * #68 (návrh C) vědomě mění AC3 u nápovědy: tečky jsou hned vedle příkladu
 * v horním pásu mezi rohem domečku a hvězdičkami u kolečka. Když se tam
 * příklad v dnešním písmu i s tečkami vedle sebe nevejde, dostane přednost
 * menší písmo, ale ne pod nejmenší písmo telefonu z #54 (32 px). Výjimka
 * se nevyjmenovává, ale počítá: platí jen pro varianty, kde by dvojice
 * v dnešním písmu byla širší než místo mezi rohem domečku a hvězdičkami.
 * Všechny ostatní varianty a všechny varianty bez nápovědy dál hlídá
 * „aspoň jako dnes“.
 */
const MIN_PHONE_FONT = 32;

/** Šířka dvojice příklad + mezera 12 px + tečky v písmu `font` (CSS px). */
function pairWidthAtFont(
  layout: PhoneLayout,
  area: GameArea,
  groups: readonly number[],
  font: number,
): number {
  const problemWidth = (layout.problemSize.width / layout.problemFontSize) * (font / area.scale);
  const dots = boundsOf(dotCellsCss(layout, layoutPhoneHint(layout, groups), area));
  return problemWidth * area.scale + PROBLEM_DOTS_GAP + (dots.right - dots.left);
}

/** Nejmenší povolené písmo s nápovědou: dnešní, nebo 32 px, když se dnešní nevejde (#68). */
function fontFloorWithHint(
  window: TestWindow,
  maxNumber: MaxNumber,
  mode: Mode,
  layout: PhoneLayout,
  area: GameArea,
  groups: readonly number[],
  before: number,
): number {
  const place = problemPlaceCss(window, maxNumber, mode);
  const fitsToday = pairWidthAtFont(layout, area, groups, before) <= place.right - place.left;
  return fitsToday ? before : MIN_PHONE_FONT;
}

/** iPhone 13–15 na výšku: písmo má být větší než dnes ve všech rozsazích (schválený obrázek). */
const IPHONE_PORTRAIT = '390×844 iPhone 13–15 (výřez 47, lišta 34)';

type PhoneLayout = PhoneScreenLayout | PhoneWritingLayout;

function landscapeLayout(
  area: GameArea,
  maxNumber: MaxNumber,
  mode: Mode,
  starCount: number,
  groups: readonly number[],
): PhoneLayout {
  return mode === 'keypad'
    ? layoutPhoneScreen(area, maxNumber + 1, starCount, groups)
    : layoutPhoneWritingScreen(area, maxNumber, starCount, groups);
}

function isWriting(layout: PhoneLayout): layout is PhoneWritingLayout {
  return 'writingAreas' in layout;
}

/** Písmo příkladu v CSS px. */
function fontCss(layout: { readonly problemFontSize: number }, area: GameArea): number {
  return layout.problemFontSize * area.scale;
}

function problemCss(layout: PhoneLayout, area: GameArea): Box {
  const { problem, problemSize } = layout;
  return toCss(box(problem.x, problem.y, problemSize.width, problemSize.height), area);
}

/** Plochy teček nápovědy (buňky mřížky), jak je rozložení rozvrhne vedle příkladu. */
function dotCellsCss(layout: PhoneLayout, dots: readonly HintDot[], area: GameArea): Box[] {
  const size = layout.hintDotHitSize;
  return dots.map((dot) => toCss(box(dot.x, dot.y, size, size), area));
}

function controlsCss(layout: PhoneLayout, area: GameArea): Box[] {
  if (isWriting(layout)) {
    return [
      ...layout.writingAreas.map((a) => toCss(box(a.x, a.y, a.width, a.height), area)),
      ...[layout.clearButton, layout.confirmButton].map((b) =>
        toCss(box(b.x, b.y, b.size, b.size), area),
      ),
    ];
  }
  return layout.answerButtons.map((b) => toCss(box(b.x, b.y, slotWidth(b), b.size), area));
}

function centerX(b: Box): number {
  return (b.left + b.right) / 2;
}

/**
 * Místo pro příklad v horním pásu (#68, návrh C): od rohu domečku 88 px
 * po levý okraj hvězdiček u kolečka, v CSS px okna.
 */
function problemPlaceCss(window: TestWindow, maxNumber: MaxNumber, mode: Mode): Box {
  const area = gameAreaFor(viewportOf(window));
  const free = freeAreaOf(window);
  // Místo je pro všech deset hvězdiček, i když jich zatím svítí méně.
  const layout = landscapeLayout(area, maxNumber, mode, STARS_PER_SET, []);
  const stars = boundsOf(
    layout.stars.map((star) => toCss(box(star.x, star.y, layout.starSize, layout.starSize), area)),
  );
  return {
    left: free.left + HOME_CORNER_SIZE,
    right: stars.left,
    top: free.top,
    bottom: stars.bottom,
  };
}

function landscapeCases(): Array<[string, TestWindow, MaxNumber, Mode]> {
  return PHONE_WINDOWS.flatMap((window) =>
    RANGES.flatMap((maxNumber) =>
      MODES.map((mode): [string, TestWindow, MaxNumber, Mode] => [
        `${window.name}, rozsah ${maxNumber}, ${mode === 'keypad' ? 'číselník' : 'psaní'}`,
        window,
        maxNumber,
        mode,
      ]),
    ),
  );
}

const LANDSCAPE_CASES = landscapeCases();

describe('#63 AC3: telefon na šířku', () => {
  it('dnešní písmo je zapsané pro všechna okna, rozsahy a ovládání a každá vyjmenovaná nápověda je v rozsahu jen jednou', () => {
    for (const [where, window, maxNumber, mode] of LANDSCAPE_CASES) {
      const before = landscapeFontsBefore(window.name, maxNumber, mode);
      expect(before, where).toBeDefined();
      const listed = Object.values(before?.except ?? {}).flatMap((names) => names.split(' '));
      const inRange = new Set(hintGroupsInRange(maxNumber).map(groupsName));
      expect(new Set(listed).size, `${where}: nápověda vyjmenovaná dvakrát`).toBe(listed.length);
      for (const name of listed) {
        expect(inRange.has(name), `${where}: nápověda ${name} mimo rozsah`).toBe(true);
      }
    }
  });

  /*
   * #68 (návrh C) vědomě mění AC3: příklad už není uprostřed volné plochy
   * pod hvězdičkami, ale v horním pásu mezi rohem domečku a hvězdičkami
   * u kolečka. Tečky nápovědy jsou hned vpravo vedle příkladu a dvojice je
   * uprostřed tohoto místa, nebo (když se vedle nevejdou) hned pod
   * příkladem. Číselník do 20 už není vpravo od příkladu.
   */
  it('bez nápovědy je příklad v horním pásu uprostřed mezi rohem domečku a hvězdičkami (#68)', () => {
    for (const [where, window, maxNumber, mode] of LANDSCAPE_CASES) {
      const area = gameAreaFor(viewportOf(window));
      for (const starCount of STAR_COUNTS) {
        const layout = landscapeLayout(area, maxNumber, mode, starCount, []);
        const problem = problemCss(layout, area);
        const place = problemPlaceCss(window, maxNumber, mode);
        const label = `${where}, ${starCount} hvězdiček`;

        expect(problem.left, label).toBeGreaterThanOrEqual(place.left - TOLERANCE);
        expect(problem.right, label).toBeLessThanOrEqual(place.right + TOLERANCE);
        expect(Math.abs(centerX(problem) - centerX(place)), label).toBeLessThanOrEqual(
          CENTER_TOLERANCE,
        );
      }
    }
  });

  it('s nápovědou jsou tečky hned vedle příkladu (dvojice uprostřed mezi domečkem a hvězdičkami), nebo hned pod ním (#68)', () => {
    for (const [label, window, maxNumber, mode] of LANDSCAPE_CASES) {
      const area = gameAreaFor(viewportOf(window));

      for (const groups of hintGroupsInRange(maxNumber)) {
        const layout = landscapeLayout(area, maxNumber, mode, STARS_PER_SET, groups);
        const problem = problemCss(layout, area);
        const dots = boundsOf(dotCellsCss(layout, layoutPhoneHint(layout, groups), area));
        const place = problemPlaceCss(window, maxNumber, mode);
        const where = `${label}, nápověda [${groups.join(', ')}]`;

        if (dots.left >= problem.right - TOLERANCE) {
          const pair = boundsOf([problem, dots]);
          expect(dots.left - problem.right, `${where}: hned vedle`).toBeLessThanOrEqual(
            MAX_PROBLEM_DOTS_GAP,
          );
          expect(Math.abs(centerX(pair) - centerX(place)), where).toBeLessThanOrEqual(
            CENTER_TOLERANCE,
          );
        } else {
          expect(dots.top, `${where}: pod příkladem`).toBeGreaterThanOrEqual(
            problem.bottom - TOLERANCE,
          );
          expect(dots.top - problem.bottom, `${where}: hned pod`).toBeLessThanOrEqual(
            MAX_PROBLEM_DOTS_GAP,
          );
          expect(Math.abs(centerX(dots) - centerX(problem)), where).toBeLessThanOrEqual(
            CENTER_TOLERANCE,
          );
        }
      }
    }
  });

  it('písmo příkladu je bez nápovědy i s každou nápovědou aspoň jako dnes (s nápovědou smí podle #68 klesnout na 32 px)', () => {
    for (const [label, window, maxNumber, mode] of LANDSCAPE_CASES) {
      const area = gameAreaFor(viewportOf(window));
      const before = landscapeFontsBefore(window.name, maxNumber, mode);
      expect(before, label).toBeDefined();
      if (!before) {
        continue;
      }

      for (const starCount of STAR_COUNTS) {
        const without = landscapeLayout(area, maxNumber, mode, starCount, []);
        expect(
          fontCss(without, area),
          `${label}, bez nápovědy, ${starCount} hvězdiček`,
        ).toBeGreaterThanOrEqual(before.withoutHint - TOLERANCE);
        for (const groups of hintGroupsInRange(maxNumber)) {
          const layout = landscapeLayout(area, maxNumber, mode, starCount, groups);
          expect(
            fontCss(layout, area),
            `${label}, nápověda [${groups.join(', ')}], ${starCount} hvězdiček`,
          ).toBeGreaterThanOrEqual(
            fontFloorWithHint(
              window,
              maxNumber,
              mode,
              layout,
              area,
              groups,
              fontWithHintBefore(before, groups),
            ) - TOLERANCE,
          );
        }
      }
    }
  });

  it('při oslavě (plná řada) se příklad ani ovládání neposunou', () => {
    for (const [label, window, maxNumber, mode] of LANDSCAPE_CASES) {
      const area = gameAreaFor(viewportOf(window));
      for (const groups of [[], [1], [maxNumber]]) {
        const before = landscapeLayout(area, maxNumber, mode, STARS_PER_SET - 1, groups);
        const during = landscapeLayout(area, maxNumber, mode, STARS_PER_SET, groups);
        const where = `${label}, nápověda [${groups.join(', ')}]`;

        expect(during.problem, where).toEqual(before.problem);
        expect(during.problemFontSize, where).toBe(before.problemFontSize);
        expect(controlsCss(during, area), where).toEqual(controlsCss(before, area));
      }
    }
  });
});

const PORTRAIT_WINDOWS: readonly TestWindow[] = [
  ...PHONE_PORTRAIT_WINDOWS,
  ...PHONE_PORTRAIT_EDGE_WINDOWS,
];

function portraitCases(): Array<[string, TestWindow, MaxNumber]> {
  return PORTRAIT_WINDOWS.flatMap((window) =>
    RANGES.map((maxNumber): [string, TestWindow, MaxNumber] => [
      `${window.name}, rozsah ${maxNumber}`,
      window,
      maxNumber,
    ]),
  );
}

describe('#63 AC4: telefon na výšku', () => {
  it('dnešní písmo je zapsané pro všechna okna na výšku', () => {
    for (const window of PORTRAIT_WINDOWS) {
      expect(PORTRAIT_FONT_BEFORE[window.name], window.name).toBeDefined();
    }
  });

  it('písmo příkladu je s číselníkem i s psaním a u všech druhů příkladů aspoň jako dnes a aspoň 40 px', () => {
    for (const [label, window, maxNumber] of portraitCases()) {
      const area = gameAreaFor(viewportOf(window));
      expect(area.mode, label).toBe('phonePortrait');
      const before = PORTRAIT_FONT_BEFORE[window.name]?.[maxNumber] ?? Infinity;

      for (const operations of OPERATIONS) {
        for (const starCount of STAR_COUNTS) {
          const where = `${label}, ${operations}, ${starCount} hvězdiček`;
          const keypad = layoutDeviceScreen(area, maxNumber + 1, starCount, [], operations);
          const writing = layoutDeviceWritingScreen(area, maxNumber, starCount, [], operations);
          for (const layout of [keypad, writing]) {
            expect(fontCss(layout, area), where).toBeGreaterThanOrEqual(before - TOLERANCE);
            expect(fontCss(layout, area), where).toBeGreaterThanOrEqual(40 - TOLERANCE);
          }
        }
      }
    }
  });

  it('390×844 (iPhone 13–15): písmo příkladu je ve všech rozsazích větší než dnes s číselníkem i s psaním', () => {
    const window = PHONE_PORTRAIT_WINDOWS.find((w) => w.name === IPHONE_PORTRAIT);
    expect(window).toBeDefined();
    const area = gameAreaFor(viewportOf(window as TestWindow));

    for (const maxNumber of RANGES) {
      const before = PORTRAIT_FONT_BEFORE[IPHONE_PORTRAIT]?.[maxNumber] ?? Infinity;
      for (const operations of OPERATIONS) {
        const keypad = layoutDeviceScreen(area, maxNumber + 1, 0, [], operations);
        const writing = layoutDeviceWritingScreen(area, maxNumber, 0, [], operations);
        const where = `rozsah ${maxNumber}, ${operations}`;
        expect(fontCss(keypad, area), `${where}, číselník`).toBeGreaterThan(before);
        expect(fontCss(writing, area), `${where}, psaní`).toBeGreaterThan(before);
      }
    }
  });

  it('střed příkladu je ve vodorovném středu volné plochy s číselníkem i s psaním', () => {
    for (const [label, window, maxNumber] of portraitCases()) {
      const area = gameAreaFor(viewportOf(window));
      const free = freeAreaOf(window);

      for (const operations of OPERATIONS) {
        for (const layout of [
          layoutDeviceScreen(area, maxNumber + 1, STARS_PER_SET, [], operations),
          layoutDeviceWritingScreen(area, maxNumber, STARS_PER_SET, [], operations),
        ]) {
          const { problem, problemSize } = layout;
          const css = toCss(box(problem.x, problem.y, problemSize.width, problemSize.height), area);
          expect(
            Math.abs(centerX(css) - centerX(free)),
            `${label}, ${operations}`,
          ).toBeLessThanOrEqual(CENTER_TOLERANCE);
        }
      }
    }
  });
});
