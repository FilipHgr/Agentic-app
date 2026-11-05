import { describe, expect, it } from 'vitest';

import { createAnswerRound } from '../../../src/games/counting/logic/answerRound';
import { chooseLayoutMode, gameAreaFor } from '../../../src/shared/logic/viewportLayout';
import {
  layoutDeviceGuideStep,
  playStateAfterResize,
} from '../../../src/games/counting/logic/deviceLayout';
import type { DeviceGuideLayout, PlayState } from '../../../src/games/counting/logic/deviceLayout';
import type { LayoutMode } from '../../../src/shared/logic/viewportLayout';
import { startDotCounting } from '../../../src/games/counting/logic/dotCounting';
import { scriptLines } from '../../../src/games/counting/logic/guideScript';
import type { GuideLineId } from '../../../src/games/counting/logic/guideScript';
import type { GameSettings } from '../../../src/games/counting/logic/settings';
import type { SettingsRow } from '../../../src/games/counting/logic/settingsLayout';
import { CLOSED_SETTINGS } from '../../../src/games/counting/logic/settingsSession';
import {
  GUIDE_TEXTS,
  chooseOption,
  finishGuide,
  guideMessage,
  guideRowStyle,
  guideSelection,
  next,
  startGuide,
  stepIndicatorText,
  stepMessage,
} from '../../../src/games/counting/logic/setupGuide';
import { wrapGuideMessage } from '../../../src/games/counting/logic/phoneGuideLayout';
import type { GuideState, GuideStep } from '../../../src/games/counting/logic/setupGuide';
import { cssBoxOf, panelCssPlacement, todayGuideCss } from './parentPanelSnapshot';
import {
  CENTER_TOLERANCE,
  STEPS,
  backBox,
  cssSize,
  expectLandscapeGuideSpec,
  expectNear,
  expectPortraitGuideSpec,
  expectSpan,
  frameBox,
  guideFor,
  indicatorBox,
  labelBox,
  landscapeRowSpans,
  messageBox,
  optionBoxes,
  rightBox,
  rowBox,
  speakerBox,
  tapBoxes,
  textBoxes,
} from './phoneGuideFixtures';
import type { PhoneGuide } from './phoneGuideFixtures';
import { seededRandom } from './seededRandom';
import {
  NO_NOTCH,
  PHONE_PORTRAIT_EDGE_WINDOWS,
  PHONE_PORTRAIT_WINDOWS,
  PHONE_WINDOWS,
  gapBetween,
  heightOf,
  isInside,
  overlaps,
  viewportOf,
  widthOf,
} from '../../shared/viewportFixtures';
import type { Box, Placement, TestWindow } from '../../shared/viewportFixtures';

/**
 * Testy k #60 (průvodce nastavením na telefonu, část b z #59): AC1 pro
 * průvodce, pravidla průvodce z AC2, AC4 (průvodce na šířku podle
 * S-sirka-pruvodce), průvodce z AC5 (S-vyska-pruvodce), AC6 přes novou
 * funkci a AC7 pro průvodce. Nastavení z kolečka je v
 * `phoneSettingsLayout.test.ts` (část a).
 *
 * Navržené rozhraní (viz `phoneGuideFixtures.ts`):
 * `layoutDeviceGuideStep(area, step): DeviceGuideLayout` v `deviceLayout.ts`.
 * Na iPadu a ve zmenšených oknech jsou řady z `layoutSettingsPanel(1024, 768)`,
 * zbytek z `layoutGuideStep(step, 1024, 768)` a `placement` je
 * `panelPlacement(area)`. Na telefonu je rozložení přímo v jednotkách
 * plochy (`placement` { scale 1, x 0, y 0 }). Rada nese navíc `lines`
 * (zalomené řádky k vykreslení) a `align` 'left' nebo 'center'; na iPadu
 * jsou `lines` dva řádky ze scénáře beze změny.
 *
 * Ručně: výřez, lišta, otočení s otevřeným průvodcem, ořezání rad
 * a popisků, viditelnost rámečku 3 px, pulzování reproduktoru a hraná věta
 * při otočení (hlas je stav panelu, ne `PlayState`).
 */

const LANDSCAPE_WINDOWS: readonly TestWindow[] = PHONE_WINDOWS;
const PORTRAIT_WINDOWS: readonly TestWindow[] = [
  ...PHONE_PORTRAIT_WINDOWS,
  ...PHONE_PORTRAIT_EDGE_WINDOWS,
];
const ALL_PHONE_WINDOWS: readonly TestWindow[] = [...LANDSCAPE_WINDOWS, ...PORTRAIT_WINDOWS];

/** Okna, kde průvodce zůstane jako dnes (AC1, AC6). */
const IPAD_1180x820: TestWindow = {
  name: 'iPad 1180×820',
  width: 1180,
  height: 820,
  safeArea: NO_NOTCH,
};
const IPAD_932x500: TestWindow = {
  name: '932×500 iPad (hranice)',
  width: 932,
  height: 500,
  safeArea: NO_NOTCH,
};
const SCALED_500x932: TestWindow = {
  name: '500×932 zmenšené (hranice)',
  width: 500,
  height: 932,
  safeArea: NO_NOTCH,
};
const SCALED_360x619: TestWindow = {
  name: '360×619 zmenšené (hranice)',
  width: 360,
  height: 619,
  safeArea: NO_NOTCH,
};
const SCALED_667x320: TestWindow = {
  name: 'zmenšené 667×320',
  width: 667,
  height: 320,
  safeArea: NO_NOTCH,
};
const UNCHANGED_WINDOWS: readonly TestWindow[] = [
  IPAD_1180x820,
  { name: 'iPad 1180×760', width: 1180, height: 760, safeArea: NO_NOTCH },
  IPAD_932x500,
  { name: 'iPad na výšku 820×1180', width: 820, height: 1180, safeArea: NO_NOTCH },
  SCALED_500x932,
  SCALED_360x619,
  SCALED_667x320,
  { name: 'zmenšené 375×553', width: 375, height: 553, safeArea: NO_NOTCH },
];

const BORDER_LANDSCAPE = PHONE_WINDOWS.find(
  (w) => w.width === 932 && w.height === 499 && w.safeArea.left === 0,
) as TestWindow;
const BORDER_PORTRAIT_WIDTH = PHONE_PORTRAIT_EDGE_WINDOWS.find(
  (w) => w.width === 499,
) as TestWindow;
const SMALLEST_LANDSCAPE = PHONE_WINDOWS[0] as TestWindow;
const SMALLEST_PORTRAIT = PHONE_PORTRAIT_WINDOWS.find(
  (w) => w.width === 360 && w.height === 620,
) as TestWindow;
const LANDSCAPE_IPHONE = PHONE_WINDOWS.find((w) => w.width === 844) as TestWindow;
const PORTRAIT_IPHONE = PHONE_PORTRAIT_WINDOWS.find(
  (w) => w.width === 390 && w.height === 844,
) as TestWindow;
const PORTRAIT_WITH_BAR = PHONE_PORTRAIT_WINDOWS.find(
  (w) => w.width === 390 && w.height === 664,
) as TestWindow;

const MIN_TOUCH_SIDE = 64;
const MIN_TOUCH_GAP = 8;
const MIN_TOUCH_EDGE = 8;
const MIN_FRAME_EDGE = 4;
/** Roh kolečka: x > W − 80 a y < 80 (AC2). */
const GEAR_CORNER = 80;
const TEXT_FONT_SIZE = 16;
const MESSAGE_LINE_HEIGHT = 22;
const MESSAGE_MAX_LINES = 4;
const BUTTON_FONT_SIZE = 18;
const BUTTON_LABEL_MARGIN = 8;
const LANDSCAPE_OPTION_FONT_SIZE = 28;
const PORTRAIT_OPTION_FONT_SIZE = 32;
const MIN_PENCIL_SIZE = 48;
const PENCIL_MARGIN = 4;
const FRAME_LINE_WIDTH = 3;
const FRAME_COLOR = '#0062CC';
/** Odhad délky textu: počet znaků × 0,6 × velikost písma. */
const CHARACTER_WIDTH_RATIO = 0.6;
/** Na řádek rady se vejde floor(šířka rady / 9,6) znaků (AC2). */
const MESSAGE_CHARACTER_WIDTH = 9.6;

const ROW_OF_STEP: Record<GuideStep, GuideLineId> = {
  1: 'maxNumber',
  2: 'operations',
  3: 'answerInput',
  4: 'summary',
};

function textWidthEstimate(text: string, fontSize: number): number {
  return text.length * CHARACTER_WIDTH_RATIO * fontSize;
}

function freeBox(guide: PhoneGuide): Box {
  return { left: 0, right: guide.width, top: 0, bottom: guide.height };
}

function gearCorner(guide: PhoneGuide): Box {
  return { left: guide.width - GEAR_CORNER, right: guide.width, top: 0, bottom: GEAR_CORNER };
}

/** Kolik znaků se vejde na řádek rady podle jejího pruhu. */
function maxCharactersPerLine(guide: PhoneGuide): number {
  return Math.floor(widthOf(messageBox(guide)) / MESSAGE_CHARACTER_WIDTH + 1e-9);
}

function* stepsInWindows(
  windows: readonly TestWindow[],
): Generator<{ name: string; window: TestWindow; step: GuideStep }> {
  for (const window of windows) {
    for (const step of STEPS) {
      yield { name: `${window.name}, krok ${step}`, window, step };
    }
  }
}

const ALL_PHONE_STEPS = [...stepsInWindows(ALL_PHONE_WINDOWS)];
const LANDSCAPE_STEPS = [...stepsInWindows(LANDSCAPE_WINDOWS)];
const PORTRAIT_STEPS = [...stepsInWindows(PORTRAIT_WINDOWS)];

// ---------------------------------------------------------------------------
// Průvodce v CSS px okna ve stejném tvaru jako zafixování z části (a)
// ---------------------------------------------------------------------------

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function cssRow(row: SettingsRow, placement: Placement): object {
  return {
    kind: row.kind,
    label: {
      text: row.label.text,
      ...cssBoxOf(row.label, placement),
      fontSize: round(row.label.fontSize * placement.scale),
    },
    options: row.options.map((option) => ({
      value: option.value,
      ...cssBoxOf(option, placement),
    })),
  };
}

function cssStep(layout: DeviceGuideLayout, placement: Placement): object {
  const size = (value: number): number => round(value * placement.scale);
  const { message, frame } = layout;
  return {
    rows: layout.rows.map((row) => cssRow(row, placement)),
    message: {
      ...cssBoxOf(message, placement),
      fontSize: size(message.fontSize),
      lineHeight: size(message.lineHeight),
      lineCount: message.lineCount,
      align: message.align,
    },
    back: layout.back
      ? { ...cssBoxOf(layout.back, placement), fontSize: size(layout.back.fontSize) }
      : null,
    indicator: {
      ...cssBoxOf(layout.indicator, placement),
      fontSize: size(layout.indicator.fontSize),
    },
    right: { ...cssBoxOf(layout.right, placement), fontSize: size(layout.right.fontSize) },
    speaker: cssBoxOf(layout.speaker, placement),
    frame: frame ? { ...cssBoxOf(frame, placement), lineWidth: size(frame.lineWidth) } : null,
  };
}

/** Všechny čtyři kroky průvodce z nové funkce v CSS px okna. */
function deviceGuideCss(window: TestWindow | undefined): Record<string, object> {
  const area = gameAreaFor(window ? viewportOf(window) : undefined);
  const steps: Record<string, object> = {};
  for (const step of STEPS) {
    const layout = layoutDeviceGuideStep(area, step);
    steps[`krok ${step}`] = cssStep(layout, panelCssPlacement(area, layout.placement));
  }
  return steps;
}

// ---------------------------------------------------------------------------
// AC1: kdy se použije které rozložení
// ---------------------------------------------------------------------------

describe('AC1: průvodce dostane rozložení na šířku tam, kde se hra hraje na telefonu na šířku', () => {
  it.each(LANDSCAPE_WINDOWS)(
    '$name: průvodce je na šířku, řady vlevo a rada s tlačítky ve sloupci vpravo',
    (window) => {
      for (const step of STEPS) {
        const guide = guideFor(window, step);

        expect(chooseLayoutMode(viewportOf(window))).toBe('phoneLandscape');
        expect(guide.mode).toBe('phoneLandscape');
        const rows = rowBox(guide, 0);
        expect(messageBox(guide).left).toBeGreaterThan(rows.right);
        expect(rightBox(guide).left).toBeGreaterThan(rows.right);
      }
    },
  );
});

describe('AC1: průvodce dostane rozložení na výšku tam, kde se hra hraje na telefonu na výšku', () => {
  it.each(PORTRAIT_WINDOWS)(
    '$name: průvodce je na výšku, řady pod sebou, pod nimi rada a dole tlačítka',
    (window) => {
      for (const step of STEPS) {
        const guide = guideFor(window, step);

        expect(chooseLayoutMode(viewportOf(window))).toBe('phonePortrait');
        expect(guide.mode).toBe('phonePortrait');
        expect(messageBox(guide).top).toBeGreaterThan(rowBox(guide, 2).bottom);
        expect(rightBox(guide).top).toBeGreaterThan(messageBox(guide).bottom);
      }
    },
  );
});

describe('AC1: ostatní okna mají průvodce jako dnes', () => {
  it.each(UNCHANGED_WINDOWS)(
    '$name: všechny čtyři kroky průvodce mají řady, rámeček, radu, ukazatel, tlačítka a reproduktor jako dnes',
    (window) => {
      expect(deviceGuideCss(window)).toEqual(todayGuideCss(window));
    },
  );

  it.each(UNCHANGED_WINDOWS)(
    '$name: rada má dva řádky ze scénáře beze změny, na středu',
    (window) => {
      const area = gameAreaFor(viewportOf(window));
      for (const step of STEPS) {
        const { message } = layoutDeviceGuideStep(area, step);
        expect(message.lines).toEqual([...scriptLines(ROW_OF_STEP[step])]);
        expect(message.align).toBe('center');
      }
    },
  );

  it('hranice na šířku: 932×499 má telefonního průvodce, 932×500 průvodce iPadu', () => {
    expect(guideFor(BORDER_LANDSCAPE, 1).mode).toBe('phoneLandscape');
    expect(guideFor(IPAD_932x500, 1).mode).toBe('tablet');
  });

  it('hranice na výšku: 499×932 má telefonního průvodce, 500×932 zmenšeného jako dnes', () => {
    expect(guideFor(BORDER_PORTRAIT_WIDTH, 1).mode).toBe('phonePortrait');
    expect(guideFor(SCALED_500x932, 1).mode).toBe('scaled');
  });

  it('hranice na výšku: 360×620 má telefonního průvodce, 360×619 zmenšeného jako dnes', () => {
    expect(guideFor(SMALLEST_PORTRAIT, 1).mode).toBe('phonePortrait');
    expect(guideFor(SCALED_360x619, 1).mode).toBe('scaled');
  });

  it.each([
    { name: 'okno 0 × 0', viewport: { width: 0, height: 0, safeArea: NO_NOTCH } },
    { name: 'záporná šířka', viewport: { width: -390, height: 844, safeArea: NO_NOTCH } },
    { name: 'chybějící údaj o okně', viewport: undefined },
  ])('$name: hra nespadne a průvodce je jako dnes', ({ viewport }) => {
    const area = gameAreaFor(viewport);

    for (const step of STEPS) {
      expect(() => layoutDeviceGuideStep(area, step)).not.toThrow();
      expect(layoutDeviceGuideStep(area, step).mode).toBe('scaled');
    }
    expect(deviceGuideCss(undefined)).toEqual(
      todayGuideCss({ name: '0 × 0', width: 0, height: 0, safeArea: NO_NOTCH }),
    );
  });
});

// ---------------------------------------------------------------------------
// AC2: pravidla průvodce a společná pravidla na telefonu
// ---------------------------------------------------------------------------

describe('AC2: na telefonu se průvodce pohodlně ovládá prstem', () => {
  it.each(ALL_PHONE_STEPS)(
    '$name: volby, Zpět, reproduktor a Další / Začít hrát mají aspoň 64 × 64 px',
    ({ window, step }) => {
      for (const tap of tapBoxes(guideFor(window, step))) {
        expect(widthOf(tap)).toBeGreaterThanOrEqual(MIN_TOUCH_SIDE - 0.01);
        expect(heightOf(tap)).toBeGreaterThanOrEqual(MIN_TOUCH_SIDE - 0.01);
      }
    },
  );

  it.each(ALL_PHONE_STEPS)(
    '$name: mezi sousedními ťukacími plochami je aspoň 8 px',
    ({ window, step }) => {
      const taps = tapBoxes(guideFor(window, step));
      taps.forEach((first, i) => {
        taps.slice(i + 1).forEach((second) => {
          expect(gapBetween(first, second)).toBeGreaterThanOrEqual(MIN_TOUCH_GAP - 0.01);
        });
      });
    },
  );

  it.each(ALL_PHONE_STEPS)(
    '$name: ťukací plochy jsou aspoň 8 px od okraje volné plochy',
    ({ window, step }) => {
      const guide = guideFor(window, step);
      const inner: Box = {
        left: MIN_TOUCH_EDGE,
        right: guide.width - MIN_TOUCH_EDGE,
        top: MIN_TOUCH_EDGE,
        bottom: guide.height - MIN_TOUCH_EDGE,
      };
      for (const tap of tapBoxes(guide)) {
        expect(isInside(tap, inner)).toBe(true);
      }
    },
  );

  it.each(ALL_PHONE_STEPS)(
    '$name: tužka ve volbě má delší stranu aspoň 48 px a do volby se vejde s okrajem 4 px',
    ({ window, step }) => {
      const guide = guideFor(window, step);
      const pencil = cssSize(guide.layout.optionLook.pencilSize, guide);
      const options = [0, 1, 2].flatMap((index) => optionBoxes(guide, index));

      expect(pencil).toBeGreaterThanOrEqual(MIN_PENCIL_SIZE - 0.01);
      for (const option of options) {
        expect(pencil + 2 * PENCIL_MARGIN).toBeLessThanOrEqual(
          Math.min(widthOf(option), heightOf(option)) + 0.01,
        );
      }
    },
  );
});

describe('AC2: na telefonu je průvodce čitelný', () => {
  it.each(ALL_PHONE_STEPS)(
    '$name: popisky řad, rada a ukazatel kroku mají písmo 16 px',
    ({ window, step }) => {
      const guide = guideFor(window, step);
      for (const row of guide.layout.rows) {
        expectNear(cssSize(row.label.fontSize, guide), TEXT_FONT_SIZE, 0.01);
      }
      expectNear(cssSize(guide.layout.message.fontSize, guide), TEXT_FONT_SIZE, 0.01);
      expectNear(cssSize(guide.layout.indicator.fontSize, guide), TEXT_FONT_SIZE, 0.01);
    },
  );

  it.each(LANDSCAPE_STEPS)('$name: volby mají na šířku písmo 28 px', ({ window, step }) => {
    const guide = guideFor(window, step);
    for (const option of guide.layout.rows.flatMap((row) => row.options)) {
      expectNear(cssSize(option.fontSize, guide), LANDSCAPE_OPTION_FONT_SIZE, 0.01);
    }
  });

  it.each(PORTRAIT_STEPS)('$name: volby mají na výšku písmo 32 px', ({ window, step }) => {
    const guide = guideFor(window, step);
    for (const option of guide.layout.rows.flatMap((row) => row.options)) {
      expectNear(cssSize(option.fontSize, guide), PORTRAIT_OPTION_FONT_SIZE, 0.01);
    }
  });

  it.each(ALL_PHONE_STEPS)(
    '$name: popisky Zpět a Další / Začít hrát mají 18 px a okraj aspoň 8 px na obou stranách',
    ({ window, step }) => {
      const guide = guideFor(window, step);
      const rightText = step === 4 ? GUIDE_TEXTS.buttons.startPlaying : GUIDE_TEXTS.buttons.next;
      const buttons: { text: string; box: Box; fontSize: number }[] = [
        { text: rightText, box: rightBox(guide), fontSize: guide.layout.right.fontSize },
      ];
      const back = backBox(guide);
      if (back && guide.layout.back) {
        buttons.push({
          text: GUIDE_TEXTS.buttons.back,
          box: back,
          fontSize: guide.layout.back.fontSize,
        });
      }
      for (const button of buttons) {
        expectNear(cssSize(button.fontSize, guide), BUTTON_FONT_SIZE, 0.01);
        const estimate = textWidthEstimate(button.text, BUTTON_FONT_SIZE);
        expect(estimate + 2 * BUTTON_LABEL_MARGIN).toBeLessThanOrEqual(widthOf(button.box) + 0.01);
      }
    },
  );

  it.each(ALL_PHONE_STEPS)(
    '$name: ukazatel kroku a popisky řad se podle odhadu délky vejdou do svého pruhu',
    ({ window, step }) => {
      const guide = guideFor(window, step);
      const indicatorText = stepIndicatorText({ ...startGuide(), step });

      expect(textWidthEstimate(indicatorText, TEXT_FONT_SIZE)).toBeLessThanOrEqual(
        widthOf(indicatorBox(guide)) + 0.01,
      );
      expect(heightOf(indicatorBox(guide))).toBeGreaterThanOrEqual(TEXT_FONT_SIZE);
      guide.layout.rows.forEach((row, index) => {
        expect(textWidthEstimate(row.label.text, TEXT_FONT_SIZE)).toBeLessThanOrEqual(
          widthOf(labelBox(guide, index)) + 0.01,
        );
      });
    },
  );

  it('na šířku se na řádek rady vejde 30 znaků', () => {
    for (const window of LANDSCAPE_WINDOWS) {
      expect(maxCharactersPerLine(guideFor(window, 1))).toBe(30);
    }
  });

  it.each([
    { width: 360, characters: 34 },
    { width: 375, characters: 35 },
    { width: 390, characters: 37 },
    { width: 430, characters: 41 },
    { width: 499, characters: 48 },
  ])('na výšku při šířce $width px se na řádek rady vejde $characters znaků', (expected) => {
    for (const window of PORTRAIT_WINDOWS.filter((w) => w.width === expected.width)) {
      expect(maxCharactersPerLine(guideFor(window, 1))).toBe(expected.characters);
    }
  });

  it.each(ALL_PHONE_STEPS)(
    '$name: rada má obě věty ze scénáře, každou od nového řádku, zalomené jen mezi slovy',
    ({ window, step }) => {
      const { message } = guideFor(window, step).layout;
      const [first, second] = guideMessage({ ...startGuide(), step });
      const lines = message.lines;

      expect(lines.length).toBeGreaterThanOrEqual(2);
      for (const line of lines) {
        expect(line).toBe(line.trim());
        expect(line).not.toBe('');
      }
      // Některý řádek končí první větou a další začíná druhou: věty se nesmíchají.
      const splitAt = lines.findIndex((_, index) => lines.slice(0, index + 1).join(' ') === first);
      expect(splitAt).toBeGreaterThanOrEqual(0);
      expect(lines.slice(splitAt + 1).join(' ')).toBe(second);
      // Zalomeno jen mezi slovy: žádné slovo není rozdělené na dva řádky.
      const words = `${first} ${second}`.split(' ');
      expect(lines.flatMap((line) => line.split(' '))).toEqual(words);
    },
  );

  it.each(ALL_PHONE_STEPS)(
    '$name: rada má nejvýš 4 řádky po 22 px a žádný řádek není delší, než se vejde',
    ({ window, step }) => {
      const guide = guideFor(window, step);
      const { message } = guide.layout;
      const limit = maxCharactersPerLine(guide);

      expect(message.lines.length).toBeLessThanOrEqual(MESSAGE_MAX_LINES);
      expect(message.lineCount).toBe(message.lines.length);
      expectNear(cssSize(message.lineHeight, guide), MESSAGE_LINE_HEIGHT, 0.01);
      expect(MESSAGE_MAX_LINES * MESSAGE_LINE_HEIGHT).toBeLessThanOrEqual(
        heightOf(messageBox(guide)) + 0.01,
      );
      for (const line of message.lines) {
        expect(line.length).toBeLessThanOrEqual(limit);
      }
    },
  );
});

describe('AC2: na telefonu v průvodci nic nepřekáží', () => {
  it.each(ALL_PHONE_STEPS)(
    '$name: nic není pod výřezem ani lištou domů, všechno je ve volné ploše',
    ({ window, step }) => {
      const guide = guideFor(window, step);
      const frame = frameBox(guide);
      for (const item of [...textBoxes(guide), ...tapBoxes(guide), ...(frame ? [frame] : [])]) {
        expect(isInside(item, freeBox(guide))).toBe(true);
      }
    },
  );

  it.each(ALL_PHONE_STEPS)(
    '$name: popisky, volby, rada, ukazatel a tlačítka se nepřekrývají',
    ({ window, step }) => {
      const guide = guideFor(window, step);
      const items = [...textBoxes(guide), ...tapBoxes(guide)];
      items.forEach((first, i) => {
        items.slice(i + 1).forEach((second) => {
          expect(overlaps(first, second)).toBe(false);
        });
      });
    },
  );

  it.each(ALL_PHONE_STEPS)(
    '$name: rámeček obepíná jen zvýrazněnou řadu a nezasahuje do nic jiného',
    ({ window, step }) => {
      const guide = guideFor(window, step);
      const frame = frameBox(guide);
      if (step === 4) {
        expect(frame).toBeNull();
        return;
      }
      if (frame === null) {
        throw new Error('Rámeček chybí');
      }
      const focused = step - 1;
      expect(isInside(labelBox(guide, focused), frame)).toBe(true);
      expect(isInside(rowBox(guide, focused), frame)).toBe(true);
      const others = [
        ...[0, 1, 2]
          .filter((index) => index !== focused)
          .flatMap((index) => [labelBox(guide, index), ...optionBoxes(guide, index)]),
        messageBox(guide),
        indicatorBox(guide),
        speakerBox(guide),
        rightBox(guide),
        ...(backBox(guide) ? [backBox(guide) as Box] : []),
      ];
      for (const other of others) {
        expect(overlaps(frame, other)).toBe(false);
      }
    },
  );

  it.each(ALL_PHONE_STEPS)(
    '$name: rámeček je aspoň 4 px od okraje volné plochy',
    ({ window, step }) => {
      const guide = guideFor(window, step);
      const frame = frameBox(guide);
      if (frame === null) {
        expect(step).toBe(4);
        return;
      }
      const inner: Box = {
        left: MIN_FRAME_EDGE,
        right: guide.width - MIN_FRAME_EDGE,
        top: MIN_FRAME_EDGE,
        bottom: guide.height - MIN_FRAME_EDGE,
      };
      expect(isInside(frame, inner)).toBe(true);
    },
  );

  it.each(ALL_PHONE_STEPS)(
    '$name: do rohu kolečka (x > W − 80, y < 80) nezasahuje nic, ani rámeček ani rada',
    ({ window, step }) => {
      const guide = guideFor(window, step);
      const frame = frameBox(guide);
      for (const item of [...textBoxes(guide), ...tapBoxes(guide), ...(frame ? [frame] : [])]) {
        expect(overlaps(item, gearCorner(guide))).toBe(false);
      }
    },
  );

  it.each(ALL_PHONE_STEPS)(
    '$name: rada, ukazatel kroku a popisky neleží na žádném tlačítku ani volbě, ťuknutí na ně nic nespustí',
    ({ window, step }) => {
      const guide = guideFor(window, step);
      for (const text of textBoxes(guide)) {
        for (const tap of tapBoxes(guide)) {
          expect(overlaps(text, tap)).toBe(false);
        }
      }
    },
  );

  it('ťuknutí na ztlumenou řadu nic nezmění', () => {
    const atStepOne = startGuide();
    const atStepTwo = next(atStepOne, 0);

    expect(chooseOption(atStepOne, { operations: 'minus' })).toEqual(atStepOne);
    expect(chooseOption(atStepOne, { answerInput: 'writing' })).toEqual(atStepOne);
    expect(chooseOption(atStepTwo, { maxNumber: 20 })).toEqual(atStepTwo);
    expect(guideRowStyle(atStepOne, 'operations').tappable).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// AC4: průvodce na šířku (S-sirka-pruvodce)
// ---------------------------------------------------------------------------

describe('AC4: na telefonu na šířku jsou řady vlevo a rada s tlačítky ve sloupci vpravo', () => {
  it.each(LANDSCAPE_WINDOWS)(
    '$name: řady jsou na stejných místech na všech čtyřech krocích',
    (window) => {
      const first = guideFor(window, 1).layout.rows;
      for (const step of STEPS) {
        expect(guideFor(window, step).layout.rows).toEqual(first);
      }
    },
  );

  it.each(LANDSCAPE_STEPS)('$name: popisek je v pruhu x 12–100', ({ window, step }) => {
    const guide = guideFor(window, step);
    for (const index of [0, 1, 2]) {
      expectSpan(labelBox(guide, index), [12, 100], null);
    }
  });

  it.each(LANDSCAPE_STEPS)(
    '$name: volby mají 96 × 68 px a jsou na x 112–208, 216–312 a 320–416',
    ({ window, step }) => {
      const guide = guideFor(window, step);
      const columns: [number, number][] = [
        [112, 208],
        [216, 312],
        [320, 416],
      ];
      for (const index of [0, 1, 2]) {
        const boxes = optionBoxes(guide, index);
        expect(boxes).toHaveLength(index === 2 ? 2 : 3);
        boxes.forEach((option, column) => {
          expectNear(widthOf(option), 96);
          expectNear(heightOf(option), 68);
          expectSpan(option, columns[column] ?? null, null);
        });
      }
    },
  );

  it.each(LANDSCAPE_STEPS)(
    '$name: řady jsou na y T až T + 68, T + 84 až T + 152 a T + 168 až T + 236, T = (H − 236) / 2',
    ({ window, step }) => {
      const guide = guideFor(window, step);
      landscapeRowSpans(guide.height).forEach((span, index) => {
        expectSpan(rowBox(guide, index), null, span, CENTER_TOLERANCE);
      });
    },
  );

  it.each(LANDSCAPE_STEPS.filter(({ step }) => step !== 4))(
    '$name: rámeček kolem zvýrazněné řady je na x 4–424 a 8 px nad a pod řadou, 3 px, modrý #0062CC',
    ({ window, step }) => {
      const guide = guideFor(window, step);
      const span = landscapeRowSpans(guide.height)[step - 1] as [number, number];
      const frame = guide.layout.frame;

      expectSpan(frameBox(guide), [4, 424], [span[0] - 8, span[1] + 8], CENTER_TOLERANCE);
      expectNear(cssSize(frame?.lineWidth ?? 0, guide), FRAME_LINE_WIDTH, 0.01);
      expect(frame?.color.toUpperCase()).toBe(FRAME_COLOR);
      expect(frame?.fill).toBeNull();
    },
  );

  it.each(LANDSCAPE_STEPS)(
    '$name: rada je ve sloupci x W − 304 až W − 16 na y 80–168, zarovnaná vlevo',
    ({ window, step }) => {
      const guide = guideFor(window, step);

      expectSpan(messageBox(guide), [guide.width - 304, guide.width - 16], [80, 168]);
      expect(guide.layout.message.align).toBe('left');
    },
  );

  it.each(LANDSCAPE_STEPS)(
    '$name: ukazatel kroku je na y H − 108 až H − 88, na středu sloupce',
    ({ window, step }) => {
      const guide = guideFor(window, step);
      const indicator = indicatorBox(guide);

      expectSpan(indicator, null, [guide.height - 108, guide.height - 88]);
      expectNear((indicator.left + indicator.right) / 2, guide.width - 160, CENTER_TOLERANCE);
    },
  );

  it.each(LANDSCAPE_STEPS)(
    '$name: tlačítka jsou na y H − 80 až H − 16: Zpět W − 304 až W − 224, reproduktor W − 216 až W − 152, Další W − 144 až W − 16',
    ({ window, step }) => {
      const guide = guideFor(window, step);
      const { width: w, height: h } = guide;
      const buttons: [number, number] = [h - 80, h - 16];

      if (step !== 1) {
        expectSpan(backBox(guide), [w - 304, w - 224], buttons);
      }
      expectSpan(speakerBox(guide), [w - 216, w - 152], buttons);
      expectSpan(rightBox(guide), [w - 144, w - 16], buttons);
    },
  );

  it.each(LANDSCAPE_WINDOWS)(
    '$name: na 1. kroku Zpět chybí a reproduktor i Další zůstanou na svém místě',
    (window) => {
      const first = guideFor(window, 1);
      const second = guideFor(window, 2);

      expect(backBox(first)).toBeNull();
      expect(speakerBox(first)).toEqual(speakerBox(second));
      expect(rightBox(first)).toEqual(rightBox(second));
    },
  );

  it.each(LANDSCAPE_WINDOWS)(
    '$name: na shrnutí jsou všechny řady plné, bez rámečku, jdou měnit a ✓ v průvodci není',
    (window) => {
      const guide = guideFor(window, 4);
      const summary = { ...startGuide(), step: 4 as GuideStep };

      expect(guide.layout.frame).toBeNull();
      expect(guide.layout).not.toHaveProperty('confirm');
      for (const kind of ['maxNumber', 'operations', 'answerInput'] as const) {
        expect(guideRowStyle(summary, kind)).toMatchObject({ opacity: 1, tappable: true });
      }
    },
  );

  it.each(LANDSCAPE_STEPS)('$name: všechny polohy odpovídají AC4', ({ window, step }) => {
    expectLandscapeGuideSpec(window, step);
  });

  it('vypočtené hodnoty 744×296: řady y 30–266, rámeček y 22–274, sloupec x 440–728', () => {
    const guide = guideFor(SMALLEST_LANDSCAPE, 1);

    expectSpan(rowBox(guide, 0), null, [30, 98], CENTER_TOLERANCE);
    expectSpan(rowBox(guide, 2), null, [198, 266], CENTER_TOLERANCE);
    expectSpan(frameBox(guide), null, [22, 106], CENTER_TOLERANCE);
    expectSpan(frameBox(guideFor(SMALLEST_LANDSCAPE, 3)), null, [190, 274], CENTER_TOLERANCE);
    expectSpan(messageBox(guide), [440, 728], null);
    expectSpan(rightBox(guide), [600, 728], null);
  });

  it('vypočtené hodnoty 744×296: mezera k rámečku 16 px, ukazatel y 188–208, tlačítka y 216–280, mezera rada–ukazatel 20 px', () => {
    const guide = guideFor(SMALLEST_LANDSCAPE, 2);
    const frame = frameBox(guide) as Box;

    expectNear(messageBox(guide).left - frame.right, 16);
    expectSpan(indicatorBox(guide), null, [188, 208]);
    expectSpan(backBox(guide), [440, 520], [216, 280]);
    expectSpan(speakerBox(guide), [528, 592], [216, 280]);
    expectNear(indicatorBox(guide).top - messageBox(guide).bottom, 20);
  });

  it('vypočtené hodnoty 932×499: řady na y 131,5–367,5 a tlačítka na y 419–483', () => {
    const guide = guideFor(BORDER_LANDSCAPE, 2);

    expectSpan(rowBox(guide, 0), null, [131.5, 199.5], CENTER_TOLERANCE);
    expectSpan(rowBox(guide, 2), null, [299.5, 367.5], CENTER_TOLERANCE);
    expectSpan(rightBox(guide), null, [419, 483]);
    expectSpan(backBox(guide), null, [419, 483]);
  });
});

// ---------------------------------------------------------------------------
// AC5: průvodce na výšku (S-vyska-pruvodce)
// ---------------------------------------------------------------------------

describe('AC5: na telefonu na výšku jsou řady pod sebou, pod nimi rada a dole tlačítka u palce', () => {
  it.each(PORTRAIT_WINDOWS)(
    '$name: řady jsou na stejných místech na všech čtyřech krocích',
    (window) => {
      const first = guideFor(window, 1).layout.rows;
      for (const step of STEPS) {
        expect(guideFor(window, step).layout.rows).toEqual(first);
      }
    },
  );

  it.each(PORTRAIT_STEPS)(
    '$name: volby mají 104 × 72 px s mezerou 8 px, řada tří voleb má 328 px, řady i Odpověď jsou na středu',
    ({ window, step }) => {
      const guide = guideFor(window, step);
      for (const index of [0, 1, 2]) {
        const boxes = optionBoxes(guide, index);
        expect(boxes).toHaveLength(index === 2 ? 2 : 3);
        for (const option of boxes) {
          expectNear(widthOf(option), 104);
          expectNear(heightOf(option), 72);
        }
        boxes.slice(1).forEach((option, i) => {
          expectNear(option.left - (boxes[i] as Box).right, 8);
        });
        const row = rowBox(guide, index);
        expectNear(widthOf(row), index === 2 ? 216 : 328);
        expectNear((row.left + row.right) / 2, guide.width / 2, CENTER_TOLERANCE);
      }
    },
  );

  it.each(PORTRAIT_STEPS)(
    '$name: řady jsou na y 114–186, 228–300 a 342–414',
    ({ window, step }) => {
      const guide = guideFor(window, step);
      const spans: [number, number][] = [
        [114, 186],
        [228, 300],
        [342, 414],
      ];
      spans.forEach((span, index) => {
        expectSpan(rowBox(guide, index), null, span);
      });
    },
  );

  it.each(PORTRAIT_STEPS)(
    '$name: popisky jsou v pruhu 20 px na y 88–108, 202–222 a 316–336, na středu 6 px nad řadou',
    ({ window, step }) => {
      const guide = guideFor(window, step);
      const spans: [number, number][] = [
        [88, 108],
        [202, 222],
        [316, 336],
      ];
      guide.layout.rows.forEach((row, index) => {
        const label = labelBox(guide, index);
        expectSpan(label, null, spans[index] ?? null);
        expectNear(rowBox(guide, index).top - label.bottom, 6);
        expectNear((label.left + label.right) / 2, guide.width / 2, CENTER_TOLERANCE);
        expect(row.label.align).toBe('center');
      });
    },
  );

  it.each(PORTRAIT_STEPS.filter(({ step }) => step !== 4))(
    '$name: rámeček je na y 80–194, 194–308 nebo 308–422, 8 px vně řady, 3 px, modrý #0062CC',
    ({ window, step }) => {
      const guide = guideFor(window, step);
      const spans: [number, number][] = [
        [80, 194],
        [194, 308],
        [308, 422],
      ];
      const row = rowBox(guide, step - 1);
      const frame = guide.layout.frame;

      expectSpan(frameBox(guide), [row.left - 8, row.right + 8], spans[step - 1] ?? null);
      expectNear(cssSize(frame?.lineWidth ?? 0, guide), FRAME_LINE_WIDTH, 0.01);
      expect(frame?.color.toUpperCase()).toBe(FRAME_COLOR);
    },
  );

  it.each(PORTRAIT_STEPS)(
    '$name: rada je na y H − 180 až H − 92 a na x 16 až W − 16, text na středu',
    ({ window, step }) => {
      const guide = guideFor(window, step);

      expectSpan(
        messageBox(guide),
        [16, guide.width - 16],
        [guide.height - 180, guide.height - 92],
      );
      expect(guide.layout.message.align).toBe('center');
    },
  );

  it.each(PORTRAIT_STEPS)(
    '$name: dole je řada široká 344 px na středu, y H − 80 až H − 16: Zpět 80, reproduktor 64, ukazatel 48, Další 128, mezery 8',
    ({ window, step }) => {
      expectPortraitGuideSpec(window, step);
    },
  );

  it.each(PORTRAIT_WINDOWS)(
    '$name: na 1. kroku Zpět chybí a reproduktor, ukazatel i Další zůstanou na místě',
    (window) => {
      const first = guideFor(window, 1);
      const second = guideFor(window, 2);

      expect(backBox(first)).toBeNull();
      expect(speakerBox(first)).toEqual(speakerBox(second));
      expect(indicatorBox(first)).toEqual(indicatorBox(second));
      expect(rightBox(first)).toEqual(rightBox(second));
    },
  );

  it.each(PORTRAIT_WINDOWS)('$name: na shrnutí není rámeček ani ✓', (window) => {
    const guide = guideFor(window, 4);

    expect(guide.layout.frame).toBeNull();
    expect(guide.layout).not.toHaveProperty('confirm');
  });

  it('vypočtené hodnoty 360×620: rámeček x 8–352, rada y 440–528 (18 px pod rámečkem), tlačítka x 8–352 a y 540–604', () => {
    const atStepThree = guideFor(SMALLEST_PORTRAIT, 3);
    const atStepTwo = guideFor(SMALLEST_PORTRAIT, 2);
    const back = backBox(atStepTwo) as Box;

    expectSpan(frameBox(guideFor(SMALLEST_PORTRAIT, 1)), [8, 352], [80, 194]);
    expectSpan(messageBox(atStepThree), [16, 344], [440, 528]);
    expectNear(messageBox(atStepThree).top - (frameBox(atStepThree) as Box).bottom, 18);
    expectSpan(back, [8, 88], [540, 604], CENTER_TOLERANCE);
    expectSpan(rightBox(atStepTwo), [224, 352], [540, 604], CENTER_TOLERANCE);
  });

  it('vypočtené hodnoty 390×844 s výřezem (volná plocha 390×763): rada y 583–671, tlačítka y 683–747', () => {
    const guide = guideFor(PORTRAIT_IPHONE, 2);

    expectSpan(messageBox(guide), null, [583, 671]);
    expectSpan(rightBox(guide), null, [683, 747]);
    expectSpan(speakerBox(guide), null, [683, 747]);
  });
});

// ---------------------------------------------------------------------------
// AC6: chování průvodce, hlas a iPad se nemění
// ---------------------------------------------------------------------------

describe('AC6: na telefonu se chování průvodce nemění', () => {
  it('kroky, ztlumení řad 0,5 a rámeček jen u zvýrazněné řady jsou stejné jako na iPadu', () => {
    const state = startGuide();

    expect(guideRowStyle(state, 'maxNumber')).toMatchObject({ opacity: 1, framed: true });
    expect(guideRowStyle(state, 'operations')).toMatchObject({ opacity: 0.5, framed: false });
    for (const step of STEPS) {
      const hasFrame = guideFor(PORTRAIT_IPHONE, step).layout.frame !== null;
      expect(hasFrame).toBe(step !== 4);
    }
  });

  it('pojistka „Začít hrát“ 500 ms platí i na telefonu', () => {
    const summary = next(next(next(startGuide(), 0), 0), 1000);

    expect(finishGuide(summary, 1499)).toBeNull();
    expect(finishGuide(summary, 1500)).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// AC7: otočení, lišta a okrajové případy (průvodce)
// ---------------------------------------------------------------------------

function guideCssOf(window: TestWindow, step: GuideStep): object {
  const guide = guideFor(window, step);
  return cssStep(guide.layout, guide.placement);
}

const SAVED: GameSettings = { maxNumber: 10, operations: 'plus', answerInput: 'keypad' };

function stateWithOpenGuide(guide: GuideState): PlayState {
  const round = createAnswerRound(SAVED, seededRandom());
  return {
    round,
    settings: SAVED,
    progress: { earned: 0 },
    counting: startDotCounting(round.problem),
    writing: null,
    settingsSession: CLOSED_SETTINGS,
    guide,
  };
}

describe('AC7: po otočení nebo změně lišty se průvodce přepočítá', () => {
  it('při přechodu šířka → výška → zmenšené → iPad → šířka dostane každé okno své rozložení', () => {
    const sequence = [
      LANDSCAPE_IPHONE,
      PORTRAIT_IPHONE,
      SCALED_667x320,
      IPAD_1180x820,
      LANDSCAPE_IPHONE,
    ];
    const expectedModes: LayoutMode[] = [
      'phoneLandscape',
      'phonePortrait',
      'scaled',
      'tablet',
      'phoneLandscape',
    ];

    expect(sequence.map((window) => guideFor(window, 2).mode)).toEqual(expectedModes);
  });

  it('po otočení na výšku, zmenšení a zpět na šířku je průvodce stejný jako před otočením', () => {
    for (const step of STEPS) {
      const before = guideCssOf(LANDSCAPE_IPHONE, step);
      guideCssOf(PORTRAIT_IPHONE, step);
      guideCssOf(SCALED_667x320, step);

      expect(guideCssOf(LANDSCAPE_IPHONE, step)).toEqual(before);
    }
  });

  it('po změně lišty (390×844 s výřezem → 390×664) zůstane rada i tlačítka u spodního okraje volné plochy', () => {
    for (const window of [PORTRAIT_IPHONE, PORTRAIT_WITH_BAR]) {
      const guide = guideFor(window, 2);
      expectSpan(messageBox(guide), null, [guide.height - 180, guide.height - 92]);
      expectSpan(rightBox(guide), null, [guide.height - 80, guide.height - 16]);
    }
  });

  it('po návratu do zmenšeného zobrazení a na iPad je průvodce jako dnes', () => {
    guideCssOf(PORTRAIT_IPHONE, 1);

    expect(deviceGuideCss(SCALED_667x320)).toEqual(todayGuideCss(SCALED_667x320));
    expect(deviceGuideCss(IPAD_1180x820)).toEqual(todayGuideCss(IPAD_1180x820));
  });
});

describe('AC7: otočení s otevřeným průvodcem nic neztratí', () => {
  it('zůstane krok, zvýrazněná řada i vybrané volby a nic se neuloží', () => {
    const onStepThree = chooseOption(next(next(startGuide(), 0), 0), { answerInput: 'writing' });
    const state = stateWithOpenGuide(onStepThree);
    const before = structuredClone(state);

    const after = playStateAfterResize(state, { width: 300, height: 300 });

    expect(after.guide).toEqual(before.guide);
    expect(after.settings).toEqual(before.settings);
    const guide = after.guide as GuideState;
    expect(guideSelection(guide)).toEqual(guideSelection(onStepThree));
    for (const kind of ['maxNumber', 'operations', 'answerInput'] as const) {
      expect(guideRowStyle(guide, kind)).toEqual(guideRowStyle(onStepThree, kind));
    }
  });

  it('po otočení je rámeček pořád kolem řady Odpověď, na šířku i na výšku', () => {
    for (const window of [LANDSCAPE_IPHONE, PORTRAIT_IPHONE]) {
      const guide = guideFor(window, 3);
      const frame = frameBox(guide) as Box;
      expect(isInside(rowBox(guide, 2), frame)).toBe(true);
      expect(overlaps(rowBox(guide, 1), frame)).toBe(false);
    }
  });

  it('rozpracované shrnutí po otočení dál drží pojistku „Začít hrát“ od původního zobrazení', () => {
    const summary = next(next(next(startGuide(), 0), 0), 2000);
    const after = playStateAfterResize(stateWithOpenGuide(summary), { width: 300, height: 300 });

    expect(finishGuide(after.guide as GuideState, 2499)).toBeNull();
    expect(finishGuide(after.guide as GuideState, 2500)).not.toBeNull();
  });

  it('rychlé dvojí ťuknutí na Další posune o dva kroky, nejdál na shrnutí, jako dnes', () => {
    const fromFirst = next(next(startGuide(), 100), 120);
    const onStepThree = next(next(startGuide(), 0), 0);
    const fromThird = next(next(onStepThree, 100), 120);

    expect(fromFirst.step).toBe(3);
    expect(fromThird.step).toBe(4);
    expect(finishGuide(fromThird, 120)).toBeNull();
  });

  it('opakovaný výpočet průvodce pro stejné okno dá pokaždé stejné rozložení', () => {
    for (const step of STEPS) {
      const first = guideCssOf(PORTRAIT_IPHONE, step);
      for (let attempt = 0; attempt < 5; attempt += 1) {
        expect(guideCssOf(PORTRAIT_IPHONE, step)).toEqual(first);
      }
    }
  });
});

describe('rada se v češtině zalamuje správně', () => {
  it.each([288, 328, 343, 358, 398, 467])(
    'jednopísmenná předložka nezůstane na konci řádku rady (šířka %i px)',
    (width) => {
      for (const step of [1, 2, 3, 4] as const) {
        const lines = wrapGuideMessage(stepMessage(step), width);
        for (const line of lines) {
          expect(line, line).not.toMatch(/(^|\s)[kszvouKSZVOU]$/);
        }
        expect(lines.length).toBeLessThanOrEqual(4);
      }
    },
  );
});
