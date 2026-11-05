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
  gearCornerOf,
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

/** Odstup od rohu s kolečkem a od kraje volné plochy, když se řada s nápovědou posune doleva (#54). */
const GEAR_CORNER_GAP = 4;
const EDGE_MARGIN = 8;

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
  return layout.answerButtons.map((b) => toCss(box(b.x, b.y, b.size, b.size), area));
}

function centerX(b: Box): number {
  return (b.left + b.right) / 2;
}

/** U rozsahu 20 s číselníkem je číselník vpravo a příklad ve sloupci vlevo od něj (V2). */
function isWideKeypad(maxNumber: MaxNumber, mode: Mode): boolean {
  return maxNumber === 20 && mode === 'keypad';
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

  it.each(LANDSCAPE_CASES.filter(([, , maxNumber, mode]) => !isWideKeypad(maxNumber, mode)))(
    '%s: bez nápovědy je střed příkladu ve vodorovném středu volné plochy',
    (_, window, maxNumber, mode) => {
      const area = gameAreaFor(viewportOf(window));
      const free = freeAreaOf(window);
      for (const starCount of STAR_COUNTS) {
        const layout = landscapeLayout(area, maxNumber, mode, starCount, []);
        expect(
          Math.abs(centerX(problemCss(layout, area)) - centerX(free)),
          `${starCount} hvězdiček`,
        ).toBeLessThanOrEqual(CENTER_TOLERANCE);
      }
    },
  );

  it.each(LANDSCAPE_CASES.filter(([, , maxNumber, mode]) => isWideKeypad(maxNumber, mode)))(
    '%s: bez nápovědy je příklad ve středu volného sloupce vlevo od číselníku',
    (_, window, maxNumber, mode) => {
      const area = gameAreaFor(viewportOf(window));
      const free = freeAreaOf(window);
      for (const starCount of STAR_COUNTS) {
        const layout = landscapeLayout(area, maxNumber, mode, starCount, []);
        const keypad = boundsOf(controlsCss(layout, area));
        const columnCenter = (free.left + keypad.left) / 2;
        const problem = problemCss(layout, area);

        expect(problem.right, `${starCount} hvězdiček`).toBeLessThanOrEqual(
          keypad.left + TOLERANCE,
        );
        expect(
          Math.abs(centerX(problem) - columnCenter),
          `${starCount} hvězdiček`,
        ).toBeLessThanOrEqual(CENTER_TOLERANCE);
      }
    },
  );

  it.each(LANDSCAPE_CASES.filter(([, , maxNumber, mode]) => !isWideKeypad(maxNumber, mode)))(
    '%s: s nápovědou je dvojice příklad + tečky uprostřed jako dnes (doleva jen kvůli rohu s kolečkem)',
    (_, window, maxNumber, mode) => {
      const area = gameAreaFor(viewportOf(window));
      const free = freeAreaOf(window);
      const gear = gearCornerOf(window);

      for (const groups of hintGroupsInRange(maxNumber)) {
        const layout = landscapeLayout(area, maxNumber, mode, STARS_PER_SET, groups);
        const dots = layoutPhoneHint(layout, groups);
        const problem = problemCss(layout, area);
        const pair = boundsOf([problem, ...dotCellsCss(layout, dots, area)]);
        const where = `nápověda [${groups.join(', ')}]`;

        expect(boundsOf(dotCellsCss(layout, dots, area)).left, where).toBeGreaterThanOrEqual(
          problem.right - TOLERANCE,
        );
        const offCenter = Math.abs(centerX(pair) - centerX(free));
        if (offCenter > CENTER_TOLERANCE) {
          // Jako dnes (#54): vycentrovaná řada by zasáhla do rohu s kolečkem, tak je vlevo od něj.
          const centeredRight = centerX(free) + (pair.right - pair.left) / 2;
          expect(pair.top, `${where}: posun jen u řady v rohu s kolečkem`).toBeLessThan(
            gear.bottom,
          );
          expect(centeredRight, `${where}: uprostřed by zasáhla do rohu`).toBeGreaterThan(
            gear.left - GEAR_CORNER_GAP,
          );
          expect(centerX(pair), `${where}: posun jen doleva`).toBeLessThan(centerX(free));
          const atGear = pair.right <= gear.left - GEAR_CORNER_GAP + CENTER_TOLERANCE;
          const atEdge = pair.left <= free.left + EDGE_MARGIN + CENTER_TOLERANCE;
          expect(atGear || atEdge, `${where}: posun jen o tolik, kolik je potřeba`).toBe(true);
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
          ).toBeGreaterThanOrEqual((before.withHint[index] ?? Infinity) - TOLERANCE);
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
