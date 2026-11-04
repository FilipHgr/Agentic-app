import { describe, expect, it } from 'vitest';

import { hintDotGroups } from '../src/logic/answerRound';
import { canCountDots } from '../src/logic/dotCounting';
import {
  gameAreaFor,
  layoutPhoneHint,
  layoutPhoneScreen,
  layoutPhoneWritingScreen,
} from '../src/logic/deviceLayout';
import type { GameArea, PhoneScreenLayout, PhoneWritingLayout } from '../src/logic/deviceLayout';
import type { Problem } from '../src/logic/problems';
import {
  MASCOT_DANCE_SWAY,
  MASCOT_JUMP_HEIGHT,
  MASCOT_SIZE,
  layoutScreen,
  layoutWritingScreen,
  writingAreaAt,
} from '../src/logic/screenLayout';
import type { ButtonSlot, HintDot, WritingAreaSlot } from '../src/logic/screenLayout';
import type { MaxNumber } from '../src/logic/settings';
import { STARS_PER_SET } from '../src/logic/stars';
import {
  JUST_ABOVE_LIMIT,
  PHONE_WINDOWS,
  box,
  boundsOf,
  freeAreaOf,
  gapBetween,
  gearCornerOf,
  heightOf,
  isInside,
  overlaps,
  toCss,
  viewportOf,
  widthOf,
} from './viewportFixtures';
import type { Box, TestWindow } from './viewportFixtures';

/**
 * Testy k #54 (hra na telefonu na šířku), AC1 až AC4 a AC6 (okno těsně
 * pod a nad hranicí 500 px). Všechny velikosti se přepočítají z herních
 * jednotek na CSS px (px na skutečném displeji) a ověří na zkušebních
 * oknech 744×296, 800×300, 844×340 (výřez 47/47/21), 932×430 (výřez
 * 59/59/21) a 932×499, pro rozsahy 5, 10 a 20, s číselníkem i s psaním.
 * Oslava (konfety, tanec) a skok postavičky se kontrolují i ručně
 * v náhledu na iPhonu a Samsungu.
 */

const RANGES: MaxNumber[] = [5, 10, 20];
const TWO_BOX_RANGES: MaxNumber[] = [10, 20];

type Mode = 'číselník' | 'psaní';
const MODES: Mode[] = ['číselník', 'psaní'];

/** Plná řada hvězdiček (oslava po deseti) i prázdná řada. */
const STAR_COUNTS = [0, STARS_PER_SET];

/** Nejmenší tlačítko a nejmenší mezera mezi tlačítky v CSS px (AC1). */
const MIN_BUTTON_SIDE = 64;
const MIN_BUTTON_GAP = 8;

/** AC3 v CSS px. */
const MIN_STAR_SIZE = 24;
const MIN_MASCOT_SIZE = 64;
const MIN_PROBLEM_FONT_SIZE = 32;

/** AC4 v CSS px. */
const MIN_SINGLE_BOX_SIDE = 200;
const MIN_TWO_BOX_SIDE = 150;

/** Ťukací plocha tečky u rozsahu 5 a 10 (AC2) a nejmenší tečka u rozsahu 20 v CSS px. */
const MIN_DOT_HIT_SIDE = 64;
const MIN_DOT_SIZE_RANGE_20 = 20;

/** Tolerance na zaokrouhlení v CSS px. */
const TOLERANCE = 0.01;

type PhoneLayout = PhoneScreenLayout | PhoneWritingLayout;

interface PhoneVariant {
  readonly window: TestWindow;
  readonly maxNumber: MaxNumber;
  readonly mode: Mode;
  readonly area: GameArea;
  readonly layout: PhoneLayout;
}

interface Element {
  readonly name: string;
  readonly css: Box;
}

function plus(first: number, second: number): Problem {
  return { first, second, operation: 'plus', result: first + second };
}

function minus(first: number, second: number): Problem {
  return { first, second, operation: 'minus', result: first - second };
}

/** Všechny příklady, které v rozsahu mohou přijít (sčítání i odčítání). */
function allProblems(maxNumber: number): Problem[] {
  const problems: Problem[] = [];
  for (let first = 0; first <= maxNumber; first += 1) {
    for (let second = 0; first + second <= maxNumber; second += 1) {
      problems.push(plus(first, second));
    }
    for (let second = 0; second <= first; second += 1) {
      problems.push(minus(first, second));
    }
  }
  return problems;
}

/** Příklady, u kterých se po 2. chybě ukáže aspoň jedna tečka. */
function problemsWithDots(maxNumber: number): Problem[] {
  return allProblems(maxNumber).filter((problem) => hintDotGroups(problem).length > 0);
}

function problemName(problem: Problem): string {
  const sign = problem.operation === 'plus' ? '+' : '−';
  return `${problem.first} ${sign} ${problem.second}`;
}

function phoneVariant(
  window: TestWindow,
  maxNumber: MaxNumber,
  mode: Mode,
  starCount = STARS_PER_SET,
): PhoneVariant {
  const area = gameAreaFor(viewportOf(window));
  const layout =
    mode === 'číselník'
      ? layoutPhoneScreen(area, maxNumber + 1, starCount)
      : layoutPhoneWritingScreen(area, maxNumber, starCount);
  return { window, maxNumber, mode, area, layout };
}

function isWriting(layout: PhoneLayout): layout is PhoneWritingLayout {
  return 'writingAreas' in layout;
}

function css(variant: PhoneVariant, b: Box): Box {
  return toCss(b, variant.area);
}

function slotCss(variant: PhoneVariant, slot: ButtonSlot): Box {
  return css(variant, box(slot.x, slot.y, slot.size, slot.size));
}

function areaCss(variant: PhoneVariant, area: WritingAreaSlot): Box {
  return css(variant, box(area.x, area.y, area.width, area.height));
}

/** Tlačítka s čísly, nebo smazání a ✓. */
function buttonsOf(variant: PhoneVariant): ButtonSlot[] {
  const { layout } = variant;
  return isWriting(layout)
    ? [layout.clearButton, layout.confirmButton]
    : [...(layout as PhoneScreenLayout).answerButtons];
}

/** Postavička i se skokem nahoru a tancem do stran (viz src/scenes/Mascot.ts). */
function mascotCss(variant: PhoneVariant): Box {
  const { mascot, mascotSize, mascotJumpHeight, mascotDanceSway } = variant.layout;
  return css(variant, {
    left: mascot.x - mascotSize / 2 - mascotDanceSway,
    right: mascot.x + mascotSize / 2 + mascotDanceSway,
    top: mascot.y - mascotSize / 2 - mascotJumpHeight,
    bottom: mascot.y + mascotSize / 2,
  });
}

/** Místo pro nejdelší příklad v rozsahu. */
function problemCss(variant: PhoneVariant): Box {
  const { problem, problemSize } = variant.layout;
  return css(variant, box(problem.x, problem.y, problemSize.width, problemSize.height));
}

function starsCss(variant: PhoneVariant): Box[] {
  const { stars, starSize } = variant.layout;
  return stars.map((star) => css(variant, box(star.x, star.y, starSize, starSize)));
}

/** Ovládání: tlačítka číselníku, nebo okénka, smazání a ✓. */
function controlsCss(variant: PhoneVariant): Box[] {
  const { layout } = variant;
  const areas = isWriting(layout) ? layout.writingAreas.map((a) => areaCss(variant, a)) : [];
  return [...areas, ...buttonsOf(variant).map((slot) => slotCss(variant, slot))];
}

/** Všechno, co je na obrazovce bez nápovědy. */
function fixedElements(variant: PhoneVariant): Element[] {
  const { layout } = variant;
  const elements: Element[] = [
    ...starsCss(variant).map((css, index) => ({ name: `hvězdička ${index + 1}`, css })),
    { name: 'postavička i se skokem a tancem', css: mascotCss(variant) },
    { name: 'příklad', css: problemCss(variant) },
  ];
  if (isWriting(layout)) {
    layout.writingAreas.forEach((area, index) =>
      elements.push({ name: `okénko ${index + 1}`, css: areaCss(variant, area) }),
    );
    elements.push({ name: 'smazání', css: slotCss(variant, layout.clearButton) });
    elements.push({ name: '✓', css: slotCss(variant, layout.confirmButton) });
  } else {
    (layout as PhoneScreenLayout).answerButtons.forEach((slot, index) =>
      elements.push({ name: `tlačítko ${index}`, css: slotCss(variant, slot) }),
    );
  }
  return elements;
}

function hintFor(variant: PhoneVariant, problem: Problem): HintDot[] {
  return layoutPhoneHint(variant.layout, hintDotGroups(problem));
}

function dotCss(variant: PhoneVariant, dot: HintDot): Box {
  const size = variant.layout.hintStyle.dotSize;
  return css(variant, box(dot.x, dot.y, size, size));
}

function dotHitCss(variant: PhoneVariant, dot: HintDot): Box {
  const size = variant.layout.hintDotHitSize;
  return css(variant, box(dot.x, dot.y, size, size));
}

function label(variant: PhoneVariant, detail = ''): string {
  return `${variant.window.name}, rozsah ${variant.maxNumber}, ${variant.mode}${detail}`;
}

/** Všechny kombinace okna, rozsahu a způsobu odpovídání. */
const ALL_VARIANTS: Array<[string, MaxNumber, Mode, TestWindow]> = PHONE_WINDOWS.flatMap((window) =>
  RANGES.flatMap((maxNumber) =>
    MODES.map((mode): [string, MaxNumber, Mode, TestWindow] => [
      window.name,
      maxNumber,
      mode,
      window,
    ]),
  ),
);

const WRITING_VARIANTS = ALL_VARIANTS.filter(([, , mode]) => mode === 'psaní');
const KEYPAD_VARIANTS = ALL_VARIANTS.filter(([, , mode]) => mode === 'číselník');

describe('AC1: tlačítka na telefonu na šířku jsou dost velká na prst', () => {
  it.each(ALL_VARIANTS)(
    '%s, rozsah %i (%s): každé tlačítko má aspoň 64 × 64 px',
    (_, maxNumber, mode, window) => {
      const variant = phoneVariant(window, maxNumber, mode);

      for (const slot of buttonsOf(variant)) {
        const button = slotCss(variant, slot);
        expect(widthOf(button), label(variant)).toBeGreaterThanOrEqual(MIN_BUTTON_SIDE - TOLERANCE);
        expect(heightOf(button), label(variant)).toBeGreaterThanOrEqual(
          MIN_BUTTON_SIDE - TOLERANCE,
        );
      }
    },
  );

  it.each(ALL_VARIANTS)(
    '%s, rozsah %i (%s): mezi sousedními tlačítky je aspoň 8 px',
    (_, maxNumber, mode, window) => {
      const variant = phoneVariant(window, maxNumber, mode);
      const buttons = buttonsOf(variant).map((slot) => slotCss(variant, slot));

      buttons.forEach((first, i) => {
        buttons.slice(i + 1).forEach((second, offset) => {
          expect(
            gapBetween(first, second),
            label(variant, `, tlačítka ${i} a ${i + offset + 1}`),
          ).toBeGreaterThanOrEqual(MIN_BUTTON_GAP - TOLERANCE);
        });
      });
    },
  );

  it('na číselníku je každé číslo od 0 do rozsahu právě jednou', () => {
    for (const window of PHONE_WINDOWS) {
      for (const maxNumber of RANGES) {
        const layout = layoutPhoneScreen(gameAreaFor(viewportOf(window)), maxNumber + 1);
        expect(layout.answerButtons, `${window.name}, rozsah ${maxNumber}`).toHaveLength(
          maxNumber + 1,
        );
      }
    }
  });
});

describe('AC2: rozložení na telefonu na šířku', () => {
  it.each(ALL_VARIANTS)(
    '%s, rozsah %i (%s): nahoře jsou zleva hvězdičky, postavička a příklad',
    (_, maxNumber, mode, window) => {
      const variant = phoneVariant(window, maxNumber, mode);
      const stars = boundsOf(starsCss(variant));
      const mascot = mascotCss(variant);
      const problem = problemCss(variant);

      expect(stars.right, label(variant)).toBeLessThanOrEqual(mascot.left + TOLERANCE);
      expect(mascot.right, label(variant)).toBeLessThanOrEqual(problem.left + TOLERANCE);
    },
  );

  it.each(ALL_VARIANTS)(
    '%s, rozsah %i (%s): ovládání je vpravo dole pod hvězdičkami, postavičkou a příkladem',
    (_, maxNumber, mode, window) => {
      const variant = phoneVariant(window, maxNumber, mode);
      const free = freeAreaOf(window);
      const controls = boundsOf(controlsCss(variant));
      const topRow = [boundsOf(starsCss(variant)), mascotCss(variant), problemCss(variant)];

      expect((controls.left + controls.right) / 2, label(variant)).toBeGreaterThan(
        (free.left + free.right) / 2,
      );
      expect((controls.top + controls.bottom) / 2, label(variant)).toBeGreaterThan(
        (free.top + free.bottom) / 2,
      );
      for (const item of topRow) {
        expect((item.top + item.bottom) / 2, label(variant)).toBeLessThan(controls.top);
      }
    },
  );

  it.each(KEYPAD_VARIANTS)(
    '%s, rozsah %i (%s): čísla na číselníku jdou zleva doprava a shora dolů od 0',
    (_, maxNumber, mode, window) => {
      const variant = phoneVariant(window, maxNumber, mode);
      const buttons = (variant.layout as PhoneScreenLayout).answerButtons;

      for (let number = 1; number < buttons.length; number += 1) {
        const previous = buttons[number - 1];
        const current = buttons[number];
        if (!previous || !current) {
          throw new Error(`chybí tlačítko ${number}`);
        }
        const sameRow = Math.abs(previous.y - current.y) < TOLERANCE;
        const nextRow = current.y > previous.y + TOLERANCE;
        const message = label(variant, `, čísla ${number - 1} a ${number}`);
        expect(sameRow || nextRow, message).toBe(true);
        if (sameRow) {
          expect(current.x, message).toBeGreaterThan(previous.x);
        }
      }
    },
  );

  for (const starCount of STAR_COUNTS) {
    it.each(ALL_VARIANTS)(
      `%s, rozsah %i (%s), ${starCount} hvězdiček: pravý horní roh 88 × 88 px pro kolečko zůstane prázdný`,
      (_, maxNumber, mode, window) => {
        const variant = phoneVariant(window, maxNumber, mode, starCount);
        const corner = gearCornerOf(window);

        for (const element of fixedElements(variant)) {
          expect(overlaps(element.css, corner), label(variant, `, ${element.name}`)).toBe(false);
        }
        for (const problem of problemsWithDots(maxNumber)) {
          for (const dot of hintFor(variant, problem)) {
            const where = label(variant, `, nápověda ${problemName(problem)}`);
            expect(overlaps(dotCss(variant, dot), corner), where).toBe(false);
            if (canCountDots(maxNumber)) {
              expect(overlaps(dotHitCss(variant, dot), corner), where).toBe(false);
            }
          }
        }
      },
    );

    it.each(ALL_VARIANTS)(
      `%s, rozsah %i (%s), ${starCount} hvězdiček: nic nevyčnívá z obrazovky ani není pod výřezem a lištou`,
      (_, maxNumber, mode, window) => {
        const variant = phoneVariant(window, maxNumber, mode, starCount);
        const free = freeAreaOf(window);

        for (const element of fixedElements(variant)) {
          expect(isInside(element.css, free), label(variant, `, ${element.name}`)).toBe(true);
        }
        for (const problem of problemsWithDots(maxNumber)) {
          for (const dot of hintFor(variant, problem)) {
            const where = label(variant, `, nápověda ${problemName(problem)}`);
            expect(isInside(dotCss(variant, dot), free), where).toBe(true);
            if (canCountDots(maxNumber)) {
              expect(isInside(dotHitCss(variant, dot), free), where).toBe(true);
            }
          }
        }
      },
    );

    it.each(ALL_VARIANTS)(
      `%s, rozsah %i (%s), ${starCount} hvězdiček: hvězdičky, postavička při skoku i tanci, příklad a ovládání se nepřekrývají`,
      (_, maxNumber, mode, window) => {
        const variant = phoneVariant(window, maxNumber, mode, starCount);
        const elements = fixedElements(variant);

        elements.forEach((first, i) => {
          elements.slice(i + 1).forEach((second) => {
            expect(
              overlaps(first.css, second.css),
              label(variant, `, ${first.name} a ${second.name}`),
            ).toBe(false);
          });
        });
      },
    );
  }

  it.each(ALL_VARIANTS)(
    '%s, rozsah %i (%s): nápověda po 2. chybě je vlevo a nepřekryje nic jiného u žádného příkladu',
    (_, maxNumber, mode, window) => {
      const variant = phoneVariant(window, maxNumber, mode);
      const elements = fixedElements(variant);
      const controls = boundsOf(controlsCss(variant));

      for (const problem of problemsWithDots(maxNumber)) {
        const dots = hintFor(variant, problem).map((dot) => dotCss(variant, dot));
        const where = label(variant, `, nápověda ${problemName(problem)}`);
        const hint = boundsOf(dots);

        expect(dots.length, where).toBe(hintDotGroups(problem).reduce((a, b) => a + b, 0));
        expect((hint.left + hint.right) / 2, where).toBeLessThan(
          (controls.left + controls.right) / 2,
        );
        for (const dot of dots) {
          for (const element of elements) {
            expect(overlaps(dot, element.css), `${where} a ${element.name}`).toBe(false);
          }
        }
        dots.forEach((first, i) => {
          dots.slice(i + 1).forEach((second) => {
            expect(overlaps(first, second), `${where}, tečky ${i} a ${i + 1}`).toBe(false);
          });
        });
      }
    },
  );

  it.each(ALL_VARIANTS.filter(([, maxNumber]) => canCountDots(maxNumber)))(
    '%s, rozsah %i (%s): každá ťukací tečka má vlastní plochu aspoň 64 × 64 px mimo ovládání',
    (_, maxNumber, mode, window) => {
      const variant = phoneVariant(window, maxNumber, mode);
      const controls = controlsCss(variant);

      for (const problem of problemsWithDots(maxNumber)) {
        const hits = hintFor(variant, problem).map((dot) => dotHitCss(variant, dot));
        const where = label(variant, `, nápověda ${problemName(problem)}`);

        for (const hit of hits) {
          expect(widthOf(hit), where).toBeGreaterThanOrEqual(MIN_DOT_HIT_SIDE - TOLERANCE);
          expect(heightOf(hit), where).toBeGreaterThanOrEqual(MIN_DOT_HIT_SIDE - TOLERANCE);
          for (const control of controls) {
            expect(overlaps(hit, control), where).toBe(false);
          }
        }
        hits.forEach((first, i) => {
          hits.slice(i + 1).forEach((second) => {
            expect(overlaps(first, second), `${where}, plochy teček ${i} a ${i + 1}`).toBe(false);
          });
        });
      }
    },
  );

  it.each(ALL_VARIANTS.filter(([, maxNumber]) => maxNumber === 20))(
    '%s, rozsah %i (%s): tečka nápovědy má aspoň 20 px',
    (_, maxNumber, mode, window) => {
      const variant = phoneVariant(window, maxNumber, mode);
      const dotSize = variant.layout.hintStyle.dotSize * variant.area.scale;

      expect(dotSize, label(variant)).toBeGreaterThanOrEqual(MIN_DOT_SIZE_RANGE_20 - TOLERANCE);
    },
  );

  it.each(ALL_VARIANTS)(
    '%s, rozsah %i (%s): postavička skáče a tančí aspoň tak výrazně jako na iPadu',
    (_, maxNumber, mode, window) => {
      const { layout } = phoneVariant(window, maxNumber, mode);

      expect(layout.mascotJumpHeight / layout.mascotSize).toBeGreaterThanOrEqual(
        MASCOT_JUMP_HEIGHT / MASCOT_SIZE - TOLERANCE,
      );
      expect(layout.mascotDanceSway / layout.mascotSize).toBeGreaterThanOrEqual(
        MASCOT_DANCE_SWAY / MASCOT_SIZE - TOLERANCE,
      );
    },
  );
});

describe('AC3: hvězdičky, postavička a příklad jsou na telefonu dobře vidět', () => {
  it.each(ALL_VARIANTS)(
    '%s, rozsah %i (%s): hvězdička má aspoň 24 px a všech deset je v jedné řadě',
    (_, maxNumber, mode, window) => {
      const variant = phoneVariant(window, maxNumber, mode, STARS_PER_SET);
      const stars = starsCss(variant);

      expect(stars).toHaveLength(STARS_PER_SET);
      for (const star of stars) {
        expect(widthOf(star), label(variant)).toBeGreaterThanOrEqual(MIN_STAR_SIZE - TOLERANCE);
      }
      const rowY = new Set(variant.layout.stars.map((star) => star.y));
      expect(rowY.size, label(variant)).toBe(1);
      stars.forEach((star, index) => {
        const next = stars[index + 1];
        if (next) {
          expect(star.right, label(variant)).toBeLessThanOrEqual(next.left + TOLERANCE);
        }
      });
    },
  );

  it.each(ALL_VARIANTS)(
    '%s, rozsah %i (%s): postavička má aspoň 64 px',
    (_, maxNumber, mode, window) => {
      const variant = phoneVariant(window, maxNumber, mode);

      expect(variant.layout.mascotSize * variant.area.scale, label(variant)).toBeGreaterThanOrEqual(
        MIN_MASCOT_SIZE - TOLERANCE,
      );
    },
  );

  it.each(ALL_VARIANTS)(
    '%s, rozsah %i (%s): písmo příkladu má aspoň 32 px a vejde se i nejdelší příklad',
    (_, maxNumber, mode, window) => {
      const variant = phoneVariant(window, maxNumber, mode);
      const { layout } = variant;

      expect(layout.problemFontSize * variant.area.scale, label(variant)).toBeGreaterThanOrEqual(
        MIN_PROBLEM_FONT_SIZE - TOLERANCE,
      );
      // Místo pro příklad je stejné jako na iPadu: odhad šířky nejdelšího příkladu při tomto písmu.
      const ipad = layoutScreen(1024, 768, maxNumber + 1);
      const widthPerFontSize = ipad.problemSize.width / ipad.problemFontSize;
      expect(
        layout.problemSize.width / layout.problemFontSize,
        label(variant),
      ).toBeGreaterThanOrEqual(widthPerFontSize - TOLERANCE);
    },
  );
});

describe('AC4: psaní prstem na telefonu na šířku', () => {
  it.each(WRITING_VARIANTS.filter(([, maxNumber]) => maxNumber === 5))(
    '%s, rozsah %i (%s): jediné okénko má aspoň 200 × 200 px',
    (_, maxNumber, mode, window) => {
      const variant = phoneVariant(window, maxNumber, mode);
      const layout = variant.layout as PhoneWritingLayout;

      expect(layout.writingAreas).toHaveLength(1);
      const area = areaCss(variant, layout.writingAreas[0] as WritingAreaSlot);
      expect(widthOf(area), label(variant)).toBeGreaterThanOrEqual(MIN_SINGLE_BOX_SIDE - TOLERANCE);
      expect(heightOf(area), label(variant)).toBeGreaterThanOrEqual(
        MIN_SINGLE_BOX_SIDE - TOLERANCE,
      );
    },
  );

  it.each(WRITING_VARIANTS.filter(([, maxNumber]) => TWO_BOX_RANGES.includes(maxNumber)))(
    '%s, rozsah %i (%s): každé ze dvou okének má aspoň 150 × 150 px a nepřekrývají se',
    (_, maxNumber, mode, window) => {
      const variant = phoneVariant(window, maxNumber, mode);
      const layout = variant.layout as PhoneWritingLayout;

      expect(layout.writingAreas).toHaveLength(2);
      const areas = layout.writingAreas.map((area) => areaCss(variant, area));
      for (const area of areas) {
        expect(widthOf(area), label(variant)).toBeGreaterThanOrEqual(MIN_TWO_BOX_SIDE - TOLERANCE);
        expect(heightOf(area), label(variant)).toBeGreaterThanOrEqual(MIN_TWO_BOX_SIDE - TOLERANCE);
      }
      const [tens, ones] = areas as [Box, Box];
      expect(overlaps(tens, ones), label(variant)).toBe(false);
      expect(tens.right, label(variant, ': desítky jsou vlevo')).toBeLessThanOrEqual(
        ones.left + TOLERANCE,
      );
    },
  );

  it.each(WRITING_VARIANTS)(
    '%s, rozsah %i (%s): smazání a ✓ jsou pod sebou vpravo od okének, smazání nahoře',
    (_, maxNumber, mode, window) => {
      const variant = phoneVariant(window, maxNumber, mode);
      const layout = variant.layout as PhoneWritingLayout;
      const boxesRight = Math.max(
        ...layout.writingAreas.map((area) => areaCss(variant, area).right),
      );
      const clear = slotCss(variant, layout.clearButton);
      const confirm = slotCss(variant, layout.confirmButton);

      expect(clear.left, label(variant)).toBeGreaterThanOrEqual(boxesRight - TOLERANCE);
      expect(confirm.left, label(variant)).toBeGreaterThanOrEqual(boxesRight - TOLERANCE);
      expect(clear.bottom, label(variant)).toBeLessThanOrEqual(confirm.top + TOLERANCE);
      // Pod sebou: tlačítka se vodorovně kryjí aspoň z poloviny.
      expect(Math.abs(layout.clearButton.x - layout.confirmButton.x), label(variant)).toBeLessThan(
        layout.confirmButton.size / 2,
      );
    },
  );

  it.each(WRITING_VARIANTS)(
    '%s, rozsah %i (%s): dotyk mimo okénka se nezapočítá jako tah, dotyk v okénku ano',
    (_, maxNumber, mode, window) => {
      const variant = phoneVariant(window, maxNumber, mode);
      const layout = variant.layout as PhoneWritingLayout;
      const step = 1;

      layout.writingAreas.forEach((area, index) => {
        const expected = layout.writingAreas.length === 2 && index === 0 ? 'tens' : 'ones';
        const halfWidth = area.width / 2;
        const halfHeight = area.height / 2;

        expect(writingAreaAt(layout, area), label(variant)).toBe(expected);
        expect(
          writingAreaAt(layout, { x: area.x - halfWidth + step, y: area.y - halfHeight + step }),
        ).toBe(expected);
        for (const outside of [
          { x: area.x, y: area.y - halfHeight - step },
          { x: area.x, y: area.y + halfHeight + step },
          { x: area.x - halfWidth - step, y: area.y },
          { x: area.x + halfWidth + step, y: area.y },
        ]) {
          const owner = writingAreaAt(layout, outside);
          // Dotyk těsně vedle okénka smí patřit jen sousednímu okénku, ne tomuto.
          expect(owner === expected, label(variant, ` mimo okénko ${index + 1}`)).toBe(false);
        }
      });

      for (const button of [layout.clearButton, layout.confirmButton]) {
        expect(writingAreaAt(layout, button), label(variant, ', dotyk na tlačítko')).toBeNull();
      }
      expect(
        writingAreaAt(layout, layout.problem),
        label(variant, ', dotyk na příklad'),
      ).toBeNull();
      expect(
        writingAreaAt(layout, layout.mascot),
        label(variant, ', dotyk na postavičku'),
      ).toBeNull();
    },
  );

  it.each(WRITING_VARIANTS.filter(([, maxNumber]) => TWO_BOX_RANGES.includes(maxNumber)))(
    '%s, rozsah %i (%s): dotyk v mezeře mezi okénky se nezapočítá jako tah',
    (_, maxNumber, mode, window) => {
      const variant = phoneVariant(window, maxNumber, mode);
      const layout = variant.layout as PhoneWritingLayout;
      const [tens, ones] = layout.writingAreas as [WritingAreaSlot, WritingAreaSlot];
      const gapMiddle = (tens.x + tens.width / 2 + (ones.x - ones.width / 2)) / 2;

      expect(writingAreaAt(layout, { x: gapMiddle, y: tens.y }), label(variant)).toBeNull();
    },
  );
});

describe('AC6: okno těsně pod a nad hranicí 500 px', () => {
  const below = PHONE_WINDOWS.filter((window) => window.height === 499);

  it.each(below)('$name: dostane telefonní rozložení a tlačítka mají aspoň 64 px', (window) => {
    for (const maxNumber of RANGES) {
      for (const mode of MODES) {
        const variant = phoneVariant(window, maxNumber, mode);
        expect(variant.area.mode).toBe('phoneLandscape');
        for (const slot of buttonsOf(variant)) {
          expect(widthOf(slotCss(variant, slot)), label(variant)).toBeGreaterThanOrEqual(
            MIN_BUTTON_SIDE - TOLERANCE,
          );
        }
      }
    }
  });

  it('932×500: dnešní rozložení iPadu má tlačítka aspoň 64 × 64 px a mezery aspoň 8 px', () => {
    const area = gameAreaFor(viewportOf(JUST_ABOVE_LIMIT));
    expect(area.mode).toBe('tablet');

    for (const maxNumber of RANGES) {
      const keypad = layoutScreen(area.width, area.height, maxNumber + 1, STARS_PER_SET);
      const writing = layoutWritingScreen(area.width, area.height, maxNumber, STARS_PER_SET);
      const groups: Array<[string, ButtonSlot[]]> = [
        ['číselník', [...keypad.answerButtons]],
        ['psaní', [writing.clearButton, writing.confirmButton]],
      ];

      for (const [mode, slots] of groups) {
        const where = `rozsah ${maxNumber}, ${mode}`;
        const buttons = slots.map((slot) => toCss(box(slot.x, slot.y, slot.size, slot.size), area));
        for (const button of buttons) {
          expect(widthOf(button), where).toBeGreaterThanOrEqual(MIN_BUTTON_SIDE - TOLERANCE);
        }
        buttons.forEach((first, i) => {
          buttons.slice(i + 1).forEach((second) => {
            expect(gapBetween(first, second), where).toBeGreaterThanOrEqual(
              MIN_BUTTON_GAP - TOLERANCE,
            );
          });
        });
      }
    }
  });
});
