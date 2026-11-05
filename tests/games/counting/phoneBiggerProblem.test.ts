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
  LANDSCAPE_FONT_BEFORE,
  PORTRAIT_FONT_BEFORE,
  hintGroupsInRange,
} from './phoneFontBefore63';
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
 * porovnává s hodnotami zapsanými před změnou (`phoneFontBefore63.ts`),
 * ne s tím, co spočítá nový kód.
 *
 * Ostatní pravidla z #54, #55 a #56 (tlačítka 64 px s mezerou 8 px, ťukací
 * tečky 48 px, okénka na psaní, hvězdičky 24 px, roh s kolečkem, výřez
 * a lišta, nic se nepřekrývá, 4 px od okraje, ovládání u palce, nápověda
 * nic neposune, otočení) dál hlídají `phoneLandscapeLayout.test.ts`,
 * `phonePortraitLayout.test.ts`, `resizeKeepsRound.test.ts`
 * a `phonePortraitResize.test.ts`, upravené pro rozložení bez postavy.
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
  it('dnešní písmo je zapsané pro všechna okna, rozsahy, ovládání i nápovědy', () => {
    for (const [where, window, maxNumber, mode] of LANDSCAPE_CASES) {
      const before = LANDSCAPE_FONT_BEFORE[window.name]?.[maxNumber][mode];
      expect(before, where).toBeDefined();
      expect(before?.withHint, where).toHaveLength(hintGroupsInRange(maxNumber).length);
    }
  });

  /*
   * #68 (návrh C) vědomě mění AC3: příklad už není uprostřed volné plochy
   * pod hvězdičkami, ale v horním pásu mezi rohem domečku a hvězdičkami
   * u kolečka. Tečky nápovědy jsou hned vpravo vedle příkladu a dvojice je
   * uprostřed tohoto místa, nebo (když se vedle nevejdou) hned pod
   * příkladem. Číselník do 20 už není vpravo od příkladu.
   */
  it.each(LANDSCAPE_CASES)(
    '%s: bez nápovědy je příklad v horním pásu uprostřed mezi rohem domečku a hvězdičkami (#68)',
    (_, window, maxNumber, mode) => {
      const area = gameAreaFor(viewportOf(window));
      for (const starCount of STAR_COUNTS) {
        const layout = landscapeLayout(area, maxNumber, mode, starCount, []);
        const problem = problemCss(layout, area);
        const place = problemPlaceCss(window, maxNumber, mode);

        expect(problem.left, `${starCount} hvězdiček`).toBeGreaterThanOrEqual(
          place.left - TOLERANCE,
        );
        expect(problem.right, `${starCount} hvězdiček`).toBeLessThanOrEqual(
          place.right + TOLERANCE,
        );
        expect(
          Math.abs(centerX(problem) - centerX(place)),
          `${starCount} hvězdiček`,
        ).toBeLessThanOrEqual(CENTER_TOLERANCE);
      }
    },
  );

  it.each(LANDSCAPE_CASES)(
    '%s: s nápovědou jsou tečky hned vedle příkladu (dvojice uprostřed mezi domečkem a hvězdičkami), nebo hned pod ním (#68)',
    (_, window, maxNumber, mode) => {
      const area = gameAreaFor(viewportOf(window));

      for (const groups of hintGroupsInRange(maxNumber)) {
        const layout = landscapeLayout(area, maxNumber, mode, STARS_PER_SET, groups);
        const problem = problemCss(layout, area);
        const dots = boundsOf(dotCellsCss(layout, layoutPhoneHint(layout, groups), area));
        const place = problemPlaceCss(window, maxNumber, mode);
        const where = `nápověda [${groups.join(', ')}]`;

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
    },
  );

  it.each(LANDSCAPE_CASES)(
    '%s: písmo příkladu je bez nápovědy i s každou nápovědou aspoň jako dnes',
    (_, window, maxNumber, mode) => {
      const area = gameAreaFor(viewportOf(window));
      const before = LANDSCAPE_FONT_BEFORE[window.name]?.[maxNumber][mode];
      expect(before).toBeDefined();
      if (!before) {
        return;
      }

      for (const starCount of STAR_COUNTS) {
        const without = landscapeLayout(area, maxNumber, mode, starCount, []);
        expect(
          fontCss(without, area),
          `bez nápovědy, ${starCount} hvězdiček`,
        ).toBeGreaterThanOrEqual(before.withoutHint - TOLERANCE);
        hintGroupsInRange(maxNumber).forEach((groups, index) => {
          const layout = landscapeLayout(area, maxNumber, mode, starCount, groups);
          expect(
            fontCss(layout, area),
            `nápověda [${groups.join(', ')}], ${starCount} hvězdiček`,
          ).toBeGreaterThanOrEqual(
            fontFloorWithHint(
              window,
              maxNumber,
              mode,
              layout,
              area,
              groups,
              before.withHint[index] ?? Infinity,
            ) - TOLERANCE,
          );
        });
      }
    },
  );

  it.each(LANDSCAPE_CASES)(
    '%s: při oslavě (plná řada) se příklad ani ovládání neposunou',
    (_, window, maxNumber, mode) => {
      const area = gameAreaFor(viewportOf(window));
      for (const groups of [[], [1], [maxNumber]]) {
        const before = landscapeLayout(area, maxNumber, mode, STARS_PER_SET - 1, groups);
        const during = landscapeLayout(area, maxNumber, mode, STARS_PER_SET, groups);

        expect(during.problem, `nápověda [${groups.join(', ')}]`).toEqual(before.problem);
        expect(during.problemFontSize).toBe(before.problemFontSize);
        expect(controlsCss(during, area)).toEqual(controlsCss(before, area));
      }
    },
  );
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

  it.each(portraitCases())(
    '%s: písmo příkladu je s číselníkem i s psaním a u všech druhů příkladů aspoň jako dnes a aspoň 40 px',
    (_, window, maxNumber) => {
      const area = gameAreaFor(viewportOf(window));
      expect(area.mode).toBe('phonePortrait');
      const before = PORTRAIT_FONT_BEFORE[window.name]?.[maxNumber] ?? Infinity;

      for (const operations of OPERATIONS) {
        for (const starCount of STAR_COUNTS) {
          const where = `${operations}, ${starCount} hvězdiček`;
          const keypad = layoutDeviceScreen(area, maxNumber + 1, starCount, [], operations);
          const writing = layoutDeviceWritingScreen(area, maxNumber, starCount, [], operations);
          for (const layout of [keypad, writing]) {
            expect(fontCss(layout, area), where).toBeGreaterThanOrEqual(before - TOLERANCE);
            expect(fontCss(layout, area), where).toBeGreaterThanOrEqual(40 - TOLERANCE);
          }
        }
      }
    },
  );

  it.each(RANGES)(
    '390×844 (iPhone 13–15), rozsah %i: písmo příkladu je větší než dnes s číselníkem i s psaním',
    (maxNumber) => {
      const window = PHONE_PORTRAIT_WINDOWS.find((w) => w.name === IPHONE_PORTRAIT);
      expect(window).toBeDefined();
      const area = gameAreaFor(viewportOf(window as TestWindow));
      const before = PORTRAIT_FONT_BEFORE[IPHONE_PORTRAIT]?.[maxNumber] ?? Infinity;

      for (const operations of OPERATIONS) {
        const keypad = layoutDeviceScreen(area, maxNumber + 1, 0, [], operations);
        const writing = layoutDeviceWritingScreen(area, maxNumber, 0, [], operations);
        expect(fontCss(keypad, area), `číselník, ${operations}`).toBeGreaterThan(before);
        expect(fontCss(writing, area), `psaní, ${operations}`).toBeGreaterThan(before);
      }
    },
  );

  it.each(portraitCases())(
    '%s: střed příkladu je ve vodorovném středu volné plochy s číselníkem i s psaním',
    (_, window, maxNumber) => {
      const area = gameAreaFor(viewportOf(window));
      const free = freeAreaOf(window);

      for (const operations of OPERATIONS) {
        for (const layout of [
          layoutDeviceScreen(area, maxNumber + 1, STARS_PER_SET, [], operations),
          layoutDeviceWritingScreen(area, maxNumber, STARS_PER_SET, [], operations),
        ]) {
          const { problem, problemSize } = layout;
          const css = toCss(box(problem.x, problem.y, problemSize.width, problemSize.height), area);
          expect(Math.abs(centerX(css) - centerX(free)), operations).toBeLessThanOrEqual(
            CENTER_TOLERANCE,
          );
        }
      }
    },
  );
});
