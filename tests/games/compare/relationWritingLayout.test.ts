import { afterEach, describe, expect, it } from 'vitest';

import {
  MIN_WRITING_BOX_CSS,
  layoutProblemScreen,
  layoutRelationScreen,
} from '../../../src/games/compare/logic/compareLayout';
import type { Rect } from '../../../src/games/compare/logic/compareLayout';
import { allProblems, allRelationProblems } from '../../../src/games/compare/logic/compareProblems';
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
 * Testy k #191 AC1: rozložení při odpovědi psaním pro oba druhy příkladů
 * („a ☐ b = c“ i „a ☐ b“) jako pravidla v cyklu přes všechna zkušební
 * okna, oba jazyky, oba rozsahy a oba druhy. U „a ☐ b“ je plocha na
 * psaní, smazání a ✓ přesně tam a stejně velké jako u + −: na iPadu
 * a telefonu na šířku je plochou okénko příkladu, na výšku samostatná
 * plocha pod příkladem. Vše v CSS px okna: plocha aspoň 200 × 200 px,
 * tlačítka aspoň 64 px a 8 px od ostatního, nic se nepřekrývá, nic
 * neleží pod domečkem a kolečkem a všechno je na obrazovce.
 */

const MIN_TOUCH_CSS = 64;
const MIN_GAP_CSS = 8;
/** Čísla příkladu na zařízeních při psaní (CSS px), jako u + − (#188 AC5). */
const MIN_NUMBER_FONT_CSS = 64;
/** Na úzkém telefonu na výšku při rozsahu 20 jako u + − (příklad velký jako při ťukání). */
const MIN_PORTRAIT_FONT_20_CSS = 56;
/** Ve zmenšeném zobrazení (žádné zařízení) jsou čísla aspoň vidět (CSS px). */
const MIN_SCALED_NUMBER_FONT_CSS = 16;
const DIGIT_WIDTH_RATIO = 0.62;

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
const LANDSCAPE_DEVICE_WINDOWS: readonly TestWindow[] = [
  ...IPAD_WINDOWS,
  JUST_ABOVE_LIMIT,
  ...PHONE_WINDOWS,
];
const ALL_WINDOWS: readonly TestWindow[] = [
  ...LANDSCAPE_DEVICE_WINDOWS,
  SCALED_WINDOW,
  ...PORTRAIT_WINDOWS,
];

type Kind = CompareProblem['kind'];
const KINDS: readonly Kind[] = ['arithmetic', 'relation'];

interface Part {
  readonly name: string;
  readonly box: Box;
}

/** Obrazovka při psaní: okno, jazyk, rozsah, druh a jeden příklad. */
interface Screen {
  readonly name: string;
  readonly window: TestWindow;
  readonly language: Language;
  readonly area: GameArea;
  readonly maxNumber: MaxNumber;
  readonly kind: Kind;
  readonly padInProblem: boolean;
  readonly pad: Rect;
  readonly clear: Rect;
  readonly confirm: Rect;
  /** Tlačítka znamének (při psaní nemají být žádná). */
  readonly signButtonCount: number;
  readonly box: Rect;
  readonly fontSize: number;
  readonly signSize: number;
  /** Části příkladu zleva doprava. */
  readonly equation: readonly Part[];
  readonly numbers: ReadonlyArray<{ readonly slot: Rect; readonly value: number }>;
  readonly stars: readonly Part[];
}

afterEach(() => {
  selectLanguage('cs');
});

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

/** Jeden příklad za každý tvar (počet číslic čísel) v rozsahu a druhu. */
function problemShapes(maxNumber: MaxNumber, kind: Kind): CompareProblem[] {
  const problems: readonly CompareProblem[] =
    kind === 'relation' ? allRelationProblems(maxNumber) : allProblems(maxNumber);
  const byShape = new Map<string, CompareProblem>();
  for (const problem of problems) {
    const numbers =
      problem.kind === 'relation' ? [problem.a, problem.b] : [problem.a, problem.b, problem.result];
    const shape = numbers.map((value) => String(value).length).join(':');
    if (!byShape.has(shape)) {
      byShape.set(shape, problem);
    }
  }
  return [...byShape.values()];
}

function nameOf(problem: CompareProblem): string {
  return problem.kind === 'relation'
    ? `${problem.a} ☐ ${problem.b}`
    : `${problem.a} ☐ ${problem.b} = ${problem.result}`;
}

/** Obrazovka při psaní pro příklad `problem`. */
function screenOf(
  window: TestWindow,
  language: Language,
  area: GameArea,
  maxNumber: MaxNumber,
  problem: CompareProblem,
): Screen {
  const name = `${language}, ${window.name}, do ${maxNumber}: ${nameOf(problem)}`;
  const settings = { maxNumber, answerInput: 'writing' } as const;
  const base = { name, window, language, area, maxNumber, kind: problem.kind };
  if (problem.kind === 'relation') {
    const layout = layoutProblemScreen(area, settings, 'relation');
    if (layout.writing === null) {
      throw new Error(`${name}: při psaní chybí plocha na psaní`);
    }
    const row = layout.equationFor(problem);
    return {
      ...base,
      ...layout.writing,
      pad: layout.writing.pad(problem),
      signButtonCount: layout.relationButtons === null ? 0 : 3,
      box: row.box,
      fontSize: row.fontSize,
      signSize: row.signSize,
      equation: [
        { name: 'první číslo', box: cssOf(row.first, area) },
        { name: 'okénko', box: cssOf(row.box, area) },
        { name: 'druhé číslo', box: cssOf(row.second, area) },
      ],
      numbers: [
        { slot: row.first, value: problem.a },
        { slot: row.second, value: problem.b },
      ],
      stars: starParts(layout.stars, area),
    };
  }
  const layout = layoutProblemScreen(area, settings, 'arithmetic');
  if (layout.writing === null) {
    throw new Error(`${name}: při psaní chybí plocha na psaní`);
  }
  const row = layout.equationFor(problem);
  return {
    ...base,
    ...layout.writing,
    pad: layout.writing.pad(problem),
    signButtonCount: layout.signButtons === null ? 0 : 2,
    box: row.box,
    fontSize: row.fontSize,
    signSize: row.signSize,
    equation: [
      { name: 'první číslo', box: cssOf(row.first, area) },
      { name: 'okénko', box: cssOf(row.box, area) },
      { name: 'druhé číslo', box: cssOf(row.second, area) },
      { name: '„=“', box: cssOf(row.equals, area) },
      { name: 'výsledek', box: cssOf(row.result, area) },
    ],
    numbers: [
      { slot: row.first, value: problem.a },
      { slot: row.second, value: problem.b },
      { slot: row.result, value: problem.result },
    ],
    stars: starParts(layout.stars, area),
  };
}

function starParts(
  stars: { readonly stars: readonly { x: number; y: number }[]; readonly starSize: number },
  area: GameArea,
): Part[] {
  const size = stars.starSize;
  return stars.stars.map((star, index) => ({
    name: `hvězdička ${index + 1}`,
    box: cssOf(
      { left: star.x - size / 2, top: star.y - size / 2, width: size, height: size },
      area,
    ),
  }));
}

function screensOf(window: TestWindow, language: Language): Screen[] {
  selectLanguage(language);
  const area = gameAreaFor(viewportOf(window), 'fullWindow');
  return MAX_NUMBER_OPTIONS.flatMap((maxNumber) =>
    KINDS.flatMap((kind) =>
      problemShapes(maxNumber, kind).map((problem) =>
        screenOf(window, language, area, maxNumber, problem),
      ),
    ),
  );
}

function screens(windows: readonly TestWindow[] = ALL_WINDOWS): Screen[] {
  return windows.flatMap((window) => LANGUAGES.flatMap((language) => screensOf(window, language)));
}

function buttonParts(screen: Screen): Part[] {
  return [
    { name: 'smazání', box: cssOf(screen.clear, screen.area) },
    { name: '✓', box: cssOf(screen.confirm, screen.area) },
  ];
}

/** Samostatná plocha na psaní pod příkladem; při psaní do okénka žádná. */
function separatePad(screen: Screen): Part[] {
  return screen.padInProblem
    ? []
    : [{ name: 'plocha na psaní', box: cssOf(screen.pad, screen.area) }];
}

function allParts(screen: Screen): Part[] {
  return [...screen.equation, ...separatePad(screen), ...buttonParts(screen), ...screen.stars];
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

/** Nejmenší písmo čísel při psaní v okně obrazovky (CSS px), stejné jako u + −. */
function minimumFont(screen: Screen): number {
  if (screen.window === SCALED_WINDOW) {
    return MIN_SCALED_NUMBER_FONT_CSS;
  }
  if (PORTRAIT_WINDOWS.includes(screen.window) && screen.maxNumber === 20) {
    return MIN_PORTRAIT_FONT_20_CSS;
  }
  return MIN_NUMBER_FONT_CSS;
}

/** Obrazovka „a ☐ b = c“ ve stejném okně, jazyce a rozsahu jako `screen`. */
function arithmeticTwin(screen: Screen, all: readonly Screen[]): Screen {
  const twin = all.find(
    (other) =>
      other.kind === 'arithmetic' &&
      other.window === screen.window &&
      other.maxNumber === screen.maxNumber &&
      other.language === screen.language,
  );
  if (twin === undefined) {
    throw new Error(`${screen.name}: chybí obrazovka „a ☐ b = c“`);
  }
  return twin;
}

describe('#191 AC1: u „a ☐ b“ se píše stejně jako u „a ☐ b = c“', () => {
  it('při psaní nejsou u žádného druhu příkladu tlačítka znamének, jen plocha na psaní, smazání a ✓', () => {
    for (const screen of screens()) {
      expect(screen.signButtonCount, screen.name).toBe(0);
    }
  });

  it('plocha na psaní, smazání a ✓ jsou u „a ☐ b“ na stejném místě a stejně velké jako u + −', () => {
    const all = screens();
    for (const screen of all.filter((item) => item.kind === 'relation')) {
      const twin = arithmeticTwin(screen, all);
      expect(screen.padInProblem, screen.name).toBe(twin.padInProblem);
      expect(screen.clear, `${screen.name}: smazání`).toEqual(twin.clear);
      expect(screen.confirm, `${screen.name}: ✓`).toEqual(twin.confirm);
      expect(screen.pad.width, `${screen.name}: plocha`).toBeCloseTo(twin.pad.width, 6);
      expect(screen.pad.height, `${screen.name}: plocha`).toBeCloseTo(twin.pad.height, 6);
      expect(screen.pad.top, `${screen.name}: plocha`).toBeCloseTo(twin.pad.top, 6);
      expect(screen.fontSize, `${screen.name}: písmo čísel`).toBeCloseTo(twin.fontSize, 6);
    }
  });

  it('na iPadu a telefonu na šířku se píše přímo do okénka příkladu', () => {
    for (const screen of screens(LANDSCAPE_DEVICE_WINDOWS)) {
      expect(screen.padInProblem, screen.name).toBe(true);
      expect(screen.pad, screen.name).toEqual(screen.box);
    }
  });

  it('na iPadu a telefonu na šířku jsou čísla od okénka na psaní aspoň 8 px', () => {
    for (const screen of screens(LANDSCAPE_DEVICE_WINDOWS)) {
      const box = cssOf(screen.box, screen.area);
      for (const part of screen.equation.filter((item) => item.name !== 'okénko')) {
        expect(gapBetween(part.box, box), `${screen.name}: ${part.name}`).toBeGreaterThanOrEqual(
          MIN_GAP_CSS - 0.01,
        );
      }
      for (let index = 1; index < screen.equation.length; index += 1) {
        const previous = screen.equation[index - 1] as Part;
        const current = screen.equation[index] as Part;
        expect(current.box.left - previous.box.right, screen.name).toBeGreaterThanOrEqual(
          MIN_GAP_CSS - 0.01,
        );
      }
    }
  });

  it('na telefonu na výšku je velký příklad nahoře, pod ním plocha na psaní a pod ní smazání a ✓ u palce', () => {
    for (const screen of screens(PORTRAIT_WINDOWS)) {
      expect(screen.padInProblem, screen.name).toBe(false);
      const pad = cssOf(screen.pad, screen.area);
      const box = cssOf(screen.box, screen.area);
      expect(pad.top, screen.name).toBeGreaterThanOrEqual(box.bottom + MIN_GAP_CSS - 0.01);
      for (const button of buttonParts(screen)) {
        expect(button.box.top, `${screen.name}: ${button.name}`).toBeGreaterThanOrEqual(pad.bottom);
        expect(button.box.top, `${screen.name}: ${button.name}`).toBeGreaterThan(
          (screen.window.height * 2) / 3,
        );
      }
    }
  });

  it('plocha na psaní má aspoň 200 × 200 px a v celém rozsahu je stejně velká', () => {
    for (const screen of screens()) {
      const pad = cssOf(screen.pad, screen.area);
      expect(width(pad), screen.name).toBeGreaterThanOrEqual(MIN_WRITING_BOX_CSS - 0.01);
      expect(height(pad), screen.name).toBeGreaterThanOrEqual(MIN_WRITING_BOX_CSS - 0.01);
    }
    for (const window of ALL_WINDOWS) {
      const area = gameAreaFor(viewportOf(window), 'fullWindow');
      for (const maxNumber of MAX_NUMBER_OPTIONS) {
        const layout = layoutProblemScreen(area, { maxNumber, answerInput: 'writing' }, 'relation');
        const sizes = allRelationProblems(maxNumber).map(
          (problem) => layout.writing?.pad(problem).width ?? 0,
        );
        expect(
          Math.max(...sizes) - Math.min(...sizes),
          `${window.name}, do ${maxNumber}`,
        ).toBeLessThan(0.001);
      }
    }
  });

  it('smazání a ✓ mají aspoň 64 × 64 px, smazání je vlevo a od všeho ostatního jsou aspoň 8 px', () => {
    for (const screen of screens()) {
      const [clear, confirm] = buttonParts(screen) as [Part, Part];
      expect(clear.box.right, screen.name).toBeLessThanOrEqual(confirm.box.left);
      expect(
        gapBetween(clear.box, confirm.box),
        `${screen.name}: smazání × ✓`,
      ).toBeGreaterThanOrEqual(MIN_GAP_CSS - 0.01);
      for (const button of [clear, confirm]) {
        const name = `${screen.name}: ${button.name}`;
        expect(width(button.box), name).toBeGreaterThanOrEqual(MIN_TOUCH_CSS);
        expect(height(button.box), name).toBeGreaterThanOrEqual(MIN_TOUCH_CSS);
        for (const part of [...screen.equation, ...separatePad(screen), ...screen.stars]) {
          expect(gapBetween(button.box, part.box), `${name} × ${part.name}`).toBeGreaterThanOrEqual(
            MIN_GAP_CSS - 0.01,
          );
        }
      }
    }
  });
});

describe('#191 AC1: při psaní je všechno na obrazovce a nic se nepřekrývá', () => {
  it('příklad, plocha na psaní, smazání, ✓ i hvězdičky jsou celé na herní ploše', () => {
    for (const screen of screens()) {
      const whole = cssOf(
        { left: 0, top: 0, width: screen.area.width, height: screen.area.height },
        screen.area,
      );
      for (const part of allParts(screen)) {
        expect(isInside(part.box, whole), `${screen.name}: ${part.name}`).toBe(true);
      }
    }
  });

  it('nic se navzájem nepřekrývá a nic neleží pod domečkem ani kolečkem', () => {
    for (const screen of screens()) {
      const parts = allParts(screen);
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

  it('čísla a okénko jsou v jedné řadě za sebou, čísla se vejdou do svého místa a jsou čitelně velká', () => {
    for (const screen of screens()) {
      for (let index = 1; index < screen.equation.length; index += 1) {
        const previous = screen.equation[index - 1] as Part;
        const current = screen.equation[index] as Part;
        expect(previous.box.right, screen.name).toBeLessThanOrEqual(current.box.left);
        expect((current.box.top + current.box.bottom) / 2, screen.name).toBeCloseTo(
          (previous.box.top + previous.box.bottom) / 2,
          3,
        );
      }
      for (const { slot, value } of screen.numbers) {
        expect(
          String(value).length * DIGIT_WIDTH_RATIO * screen.fontSize,
          screen.name,
        ).toBeLessThanOrEqual(slot.width);
        expect(screen.fontSize, screen.name).toBeLessThanOrEqual(slot.height);
      }
      expect(screen.fontSize * screen.area.scale, screen.name).toBeGreaterThanOrEqual(
        minimumFont(screen),
      );
    }
  });

  it('napsané i potvrzené znaménko se celé vejde do okénka', () => {
    for (const screen of screens()) {
      expect(screen.signSize, screen.name).toBeGreaterThan(0);
      expect(screen.signSize * DIGIT_WIDTH_RATIO, screen.name).toBeLessThanOrEqual(
        screen.box.width,
      );
      expect(screen.signSize, screen.name).toBeLessThanOrEqual(screen.box.height);
    }
  });

  it('při ťukání zůstanou u „a ☐ b“ tlačítka <, = a > beze změny', () => {
    for (const window of ALL_WINDOWS) {
      const area = gameAreaFor(viewportOf(window), 'fullWindow');
      for (const maxNumber of MAX_NUMBER_OPTIONS) {
        const tapping = layoutProblemScreen(area, { maxNumber, answerInput: 'tap' }, 'relation');
        const tapped = layoutRelationScreen(area, maxNumber);
        expect(tapping.writing, window.name).toBeNull();
        expect(tapping.relationButtons, window.name).toEqual(tapped.relationButtons);
        for (const problem of problemShapes(maxNumber, 'relation')) {
          if (problem.kind === 'relation') {
            expect(tapping.equationFor(problem), window.name).toEqual(tapped.equationFor(problem));
          }
        }
      }
    }
  });
});
