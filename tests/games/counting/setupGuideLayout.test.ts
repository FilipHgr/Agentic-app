import { describe, expect, it } from 'vitest';

import { layoutSettingsPanel } from '../../../src/games/counting/logic/settingsLayout';
import type { SettingsRowKind } from '../../../src/games/counting/logic/settingsLayout';
import { GUIDE_SCRIPT } from '../../../src/games/counting/logic/guideScript';
import { GUIDE_TEXTS, layoutGuideStep } from '../../../src/games/counting/logic/setupGuide';
import type { GuideStep } from '../../../src/games/counting/logic/setupGuide';
import { CONFIRM_BUTTON_STYLE, GUIDE_STYLE } from '../../../src/games/counting/logic/theme';
import { PAGE_BACKGROUND } from '../../../src/shared/logic/theme';

/**
 * Testy k #49 AC5 (rozložení a čitelnost průvodce) na herní ploše
 * 1024 × 768 ve znění bez otázky na třídu: kroky 1–3 jsou řady, krok 4
 * shrnutí. Pásy textu a tlačítek, rámeček kolem zvýrazněné řady, velikost
 * dotykových ploch, délky textů a kontrast počítaný podle WCAG z barev. Že se text v Safari ani v Chromu neořízne,
 * je čitelný na iPadu, iPhonu na šířku a Samsungu a rámeček je dobře
 * vidět, se kontroluje ručně.
 */

const SCREEN_WIDTH = 1024;
const SCREEN_HEIGHT = 768;
const MAX_LINE_CHARACTERS = 56;
const MAX_BUTTON_CHARACTERS = 14;

const STEPS: readonly GuideStep[] = [1, 2, 3, 4];
const SUMMARY_STEP: GuideStep = 4;
const FOCUSED_ROW: Record<1 | 2 | 3, SettingsRowKind> = {
  1: 'maxNumber',
  2: 'operations',
  3: 'answerInput',
};

interface Box {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}

interface CenteredSlot {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

function centeredBox(slot: CenteredSlot): Box {
  return {
    left: slot.x - slot.width / 2,
    right: slot.x + slot.width / 2,
    top: slot.y - slot.height / 2,
    bottom: slot.y + slot.height / 2,
  };
}

function overlaps(first: Box, second: Box): boolean {
  return (
    first.left < second.right &&
    second.left < first.right &&
    first.top < second.bottom &&
    second.top < first.bottom
  );
}

function contains(outer: Box, inner: Box): boolean {
  return (
    inner.left >= outer.left &&
    inner.right <= outer.right &&
    inner.top >= outer.top &&
    inner.bottom <= outer.bottom
  );
}

function shrink(box: Box, by: number): Box {
  return {
    left: box.left + by,
    right: box.right - by,
    top: box.top + by,
    bottom: box.bottom - by,
  };
}

function grow(box: Box, by: number): Box {
  return shrink(box, -by);
}

function union(first: Box, second: Box): Box {
  return {
    left: Math.min(first.left, second.left),
    right: Math.max(first.right, second.right),
    top: Math.min(first.top, second.top),
    bottom: Math.max(first.bottom, second.bottom),
  };
}

/** Relativní jas barvy `#rrggbb` podle WCAG 2.x. */
function relativeLuminance(hex: string): number {
  const channels = [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16) / 255);
  const [red, green, blue] = channels.map((value) =>
    value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * (red ?? 0) + 0.7152 * (green ?? 0) + 0.0722 * (blue ?? 0);
}

/** Kontrast dvou barev podle WCAG 2.x (1 až 21). */
function contrastRatio(first: string, second: string): number {
  const lighter = Math.max(relativeLuminance(first), relativeLuminance(second));
  const darker = Math.min(relativeLuminance(first), relativeLuminance(second));
  return (lighter + 0.05) / (darker + 0.05);
}

const panel = layoutSettingsPanel(SCREEN_WIDTH, SCREEN_HEIGHT);
const panelBefore = structuredClone(panel);

function rowOf(kind: SettingsRowKind) {
  const row = panel.rows.find((candidate) => candidate.kind === kind);
  if (row === undefined) {
    throw new Error(`v rozložení #47 chybí řada ${kind}`);
  }
  return row;
}

/** Popisek a volby jedné řady z #47 jako jeden obdélník. */
function rowContentBox(kind: SettingsRowKind): Box {
  const row = rowOf(kind);
  return row.options.map(centeredBox).reduce(union, centeredBox(row.label));
}

/** Popisky a volby všech řad z #47, jak je průvodce ukazuje na všech krocích. */
function panelBoxes(): Box[] {
  return panel.rows.flatMap((row) => [centeredBox(row.label), ...row.options.map(centeredBox)]);
}

/** Všechny prvky kroku kromě rámečku (ten je jen obrys). */
function solidBoxes(step: GuideStep): Box[] {
  const layout = layoutGuideStep(step, SCREEN_WIDTH, SCREEN_HEIGHT);
  const own = [layout.message, layout.back, layout.indicator, layout.right]
    .filter((slot) => slot !== null)
    .map(centeredBox);
  return [...own, ...panelBoxes()];
}

describe('pás textu na všech krocích 1–4 (#49 AC5)', () => {
  it('na každém kroku je text v pásu x 24–1000, y 590–662: dva řádky po 36 px, písmo 28 px', () => {
    for (const step of STEPS) {
      const { message } = layoutGuideStep(step, SCREEN_WIDTH, SCREEN_HEIGHT);
      const where = `krok ${step}`;
      expect(message, where).not.toBeNull();
      if (message === null) continue;
      expect(centeredBox(message), where).toEqual({ left: 24, right: 1000, top: 590, bottom: 662 });
      expect(message.lineCount, where).toBe(2);
      expect(message.lineHeight, where).toBe(36);
      expect(message.fontSize, where).toBe(28);
    }
  });

  it('na každém kroku je text na středu, tmavý #1D1D1F (#53) a bez podkladu', () => {
    for (const step of STEPS) {
      const { message } = layoutGuideStep(step, SCREEN_WIDTH, SCREEN_HEIGHT);
      const where = `krok ${step}`;
      expect(message?.align, where).toBe('center');
      expect(message?.color.toLowerCase(), where).toBe('#1d1d1f');
      expect(message?.background, where).toBeNull();
    }
  });

  it('pás textu začíná 28 px pod poslední řadou z #47', () => {
    const lastRowBottom = rowContentBox('answerInput').bottom;
    expect(lastRowBottom).toBe(562);
    const { message } = layoutGuideStep(1, SCREEN_WIDTH, SCREEN_HEIGHT);
    expect(message && centeredBox(message).top - lastRowBottom).toBe(28);
  });
});

describe('pás tlačítek y 680–752 (#49 AC5)', () => {
  it('na krocích 2–4 je „Zpět“ v x 24–264, výška 72 px, písmo 32 px', () => {
    for (const step of [2, 3, 4] as const) {
      const { back } = layoutGuideStep(step, SCREEN_WIDTH, SCREEN_HEIGHT);
      const where = `krok ${step}`;
      expect(back, where).not.toBeNull();
      if (back === null) continue;
      expect(centeredBox(back), where).toEqual({ left: 24, right: 264, top: 680, bottom: 752 });
      expect(back.fontSize, where).toBe(32);
    }
  });

  it('na každém kroku je ukazatel kroku v x 452–572, písmo 28 px, barva #1D1D1F (#53)', () => {
    for (const step of STEPS) {
      const { indicator } = layoutGuideStep(step, SCREEN_WIDTH, SCREEN_HEIGHT);
      const where = `krok ${step}`;
      expect(centeredBox(indicator), where).toEqual({
        left: 452,
        right: 572,
        top: 680,
        bottom: 752,
      });
      expect(indicator.fontSize, where).toBe(28);
      expect(indicator.color.toLowerCase(), where).toBe('#1d1d1f');
    }
  });

  it('na každém kroku je pravé tlačítko v x 760–1000, výška 72 px, písmo 32 px', () => {
    for (const step of STEPS) {
      const { right } = layoutGuideStep(step, SCREEN_WIDTH, SCREEN_HEIGHT);
      const where = `krok ${step}`;
      expect(centeredBox(right), where).toEqual({ left: 760, right: 1000, top: 680, bottom: 752 });
      expect(right.fontSize, where).toBe(32);
    }
  });

  it('na kroku 1 „Zpět“ není, pravé tlačítko je na stejném místě jako na kroku 2', () => {
    const step1 = layoutGuideStep(1, SCREEN_WIDTH, SCREEN_HEIGHT);
    expect(step1.back).toBeNull();
    expect(step1.right).toEqual(layoutGuideStep(2, SCREEN_WIDTH, SCREEN_HEIGHT).right);
  });

  it('svisle se plocha skládá 562 + 28 + 72 + 18 + 72 + 16 = 768', () => {
    const layout = layoutGuideStep(3, SCREEN_WIDTH, SCREEN_HEIGHT);
    const message = layout.message ? centeredBox(layout.message) : null;
    const right = centeredBox(layout.right);
    expect(message?.top).toBe(562 + 28);
    expect(message?.bottom).toBe(590 + 72);
    expect(right.top).toBe(662 + 18);
    expect(right.bottom).toBe(680 + 72);
    expect(SCREEN_HEIGHT - right.bottom).toBe(16);
  });

  it('vodorovně se pás skládá 24 + 240 + 188 + 120 + 188 + 240 + 24 = 1024', () => {
    const layout = layoutGuideStep(3, SCREEN_WIDTH, SCREEN_HEIGHT);
    if (layout.back === null) throw new Error('na kroku 3 chybí „Zpět“');
    const back = centeredBox(layout.back);
    const indicator = centeredBox(layout.indicator);
    const right = centeredBox(layout.right);
    expect(back.left).toBe(24);
    expect(back.right - back.left).toBe(240);
    expect(indicator.left - back.right).toBe(188);
    expect(indicator.right - indicator.left).toBe(120);
    expect(right.left - indicator.right).toBe(188);
    expect(right.right - right.left).toBe(240);
    expect(SCREEN_WIDTH - right.right).toBe(24);
  });
});

describe('rámeček kolem zvýrazněné řady (#49 AC5)', () => {
  const expectedFrames: Record<1 | 2 | 3, Box> = {
    1: { left: 134, right: 890, top: 4, bottom: 190 },
    2: { left: 134, right: 890, top: 194, bottom: 380 },
    3: { left: 264, right: 760, top: 384, bottom: 570 },
  };
  const FRAMED_STEPS = [1, 2, 3] as const;

  it('na krocích 1–3 má rámeček pevnou vnější hranu a leží 8 px vně popisku i řady', () => {
    for (const step of FRAMED_STEPS) {
      const { frame } = layoutGuideStep(step, SCREEN_WIDTH, SCREEN_HEIGHT);
      const where = `krok ${step}`;
      expect(frame, where).not.toBeNull();
      expect(frame && centeredBox(frame), where).toEqual(expectedFrames[step]);
      expect(frame && centeredBox(frame), where).toEqual(grow(rowContentBox(FOCUSED_ROW[step]), 8));
    }
  });

  it('na krocích 1–3 má rámeček 4 px, modrou #0062CC (#53) a je bez výplně', () => {
    for (const step of FRAMED_STEPS) {
      const { frame } = layoutGuideStep(step, SCREEN_WIDTH, SCREEN_HEIGHT);
      const where = `krok ${step}`;
      expect(frame?.lineWidth, where).toBe(4);
      expect(frame?.color.toLowerCase(), where).toBe('#0062cc');
      expect(frame?.fill, where).toBeNull();
    }
  });

  it('na krocích 1–3 se rámeček nedotkne popisku, voleb ani jiného prvku', () => {
    for (const step of FRAMED_STEPS) {
      const { frame } = layoutGuideStep(step, SCREEN_WIDTH, SCREEN_HEIGHT);
      if (frame === null) throw new Error(`krok ${step}: chybí rámeček`);
      const outer = centeredBox(frame);
      const inner = shrink(outer, frame.lineWidth);
      for (const box of solidBoxes(step)) {
        const insideFrame = contains(inner, box);
        const outsideFrame = !overlaps(outer, box);
        expect(insideFrame || outsideFrame, `krok ${step}: ${JSON.stringify(box)}`).toBe(true);
      }
    }
  });

  it('na shrnutí rámeček není', () => {
    expect(layoutGuideStep(SUMMARY_STEP, SCREEN_WIDTH, SCREEN_HEIGHT).frame).toBeNull();
  });
});

// Že se na žádném kroku žádné dva prvky nepřekrývají (ani ukazatel kroku
// s tlačítky), vše je uvnitř plochy 1024 × 768 a každá dotyková plocha má
// aspoň 64 × 64 px, hlídají od #81 společná pravidla
// v `countingLayoutRules.test.ts`.

describe('místo ✓ a text v pásu (#49 AC5)', () => {
  it('žádná dotyková plocha průvodce neleží na místě ✓ z #47', () => {
    const confirm = centeredBox({
      x: panel.confirm.x,
      y: panel.confirm.y,
      width: panel.confirm.size,
      height: panel.confirm.size,
    });
    for (const step of STEPS) {
      const layout = layoutGuideStep(step, SCREEN_WIDTH, SCREEN_HEIGHT);
      const buttons = [layout.back, layout.right].filter((slot) => slot !== null);
      for (const button of buttons) {
        expect(overlaps(centeredBox(button), confirm), String(step)).toBe(false);
      }
    }
  });

  it('text se do svého pásu vejde: dva řádky po 36 px a písmo menší než řádek', () => {
    for (const step of STEPS) {
      const { message } = layoutGuideStep(step, SCREEN_WIDTH, SCREEN_HEIGHT);
      expect(message && message.lineCount * message.lineHeight, String(step)).toBe(message?.height);
      expect(message?.fontSize ?? Infinity, String(step)).toBeLessThanOrEqual(
        message?.lineHeight ?? 0,
      );
    }
  });
});

describe('délky textů (#49 AC5, věty podle scénáře z #50)', () => {
  const lines: string[] = GUIDE_SCRIPT.flatMap((line) => [...line.lines]);
  const buttonLabels: string[] = Object.values(GUIDE_TEXTS.buttons);

  it('každý řádek textu má nejvýš 56 znaků', () => {
    expect(lines.length).toBe(4 * 2);
    for (const line of lines) {
      expect([...line].length, line).toBeLessThanOrEqual(MAX_LINE_CHARACTERS);
    }
  });

  it('každý popisek tlačítka má nejvýš 14 znaků', () => {
    expect(buttonLabels.length).toBe(3);
    for (const label of buttonLabels) {
      expect([...label].length, label).toBeLessThanOrEqual(MAX_BUTTON_CHARACTERS);
    }
  });

  it('žádný text průvodce není prázdný', () => {
    for (const text of [...lines, ...buttonLabels]) {
      expect(text.trim()).not.toBe('');
    }
  });
});

describe('kontrast textů a tlačítek průvodce podle WCAG (#49 AC5, #53 AC3)', () => {
  it('„Zpět“ a „Další“ mají modré písmo #0062CC na světle modré #E5F0FF', () => {
    expect(GUIDE_STYLE.buttonTextColor.toLowerCase()).toBe('#0062cc');
    expect(GUIDE_STYLE.buttonBackground.toLowerCase()).toBe('#e5f0ff');
  });

  it('„Začít hrát“ má bílé písmo na stejné zelené jako ✓', () => {
    expect(GUIDE_STYLE.startPlayingTextColor.toLowerCase()).toBe('#ffffff');
    expect(GUIDE_STYLE.startPlayingBackground.toLowerCase()).toBe(
      CONFIRM_BUTTON_STYLE.background.toLowerCase(),
    );
  });

  // Rady a tlačítka jsou běžný text (4,5 : 1), „Začít hrát“ 32 px je velký
  // text, kterému stačí 3 : 1 (#53, otevřená otázka 3).
  const pairs: readonly [string, () => [string, string], number, number][] = [
    ['rada a ukazatel kroku na pozadí', () => [GUIDE_STYLE.textColor, PAGE_BACKGROUND], 4.5, 15.46],
    [
      '„Zpět“ a „Další“',
      () => [GUIDE_STYLE.buttonTextColor, GUIDE_STYLE.buttonBackground],
      4.5,
      5.04,
    ],
    [
      '„Začít hrát“',
      () => [GUIDE_STYLE.startPlayingTextColor, GUIDE_STYLE.startPlayingBackground],
      3,
      4.4,
    ],
  ];

  /** 4.5 → „4,5“, jak se v češtině píše desetinná čárka. */
  const czech = (value: number): string => String(value).replace('.', ',');

  it('rada, ukazatel a tlačítka mají kontrast aspoň 4,5 : 1, „Začít hrát“ aspoň 3 : 1', () => {
    for (const [name, colors, minimum, expected] of pairs) {
      const [text, background] = colors();
      const ratio = contrastRatio(text, background);
      const where = `${name}: aspoň ${czech(minimum)} : 1 (asi ${czech(expected)} : 1)`;
      expect(ratio, where).toBeGreaterThanOrEqual(minimum);
      expect(ratio, where).toBeCloseTo(expected, 1);
    }
  });
});

describe('rozložení z #47 se nemění (#49 AC5)', () => {
  it('výpočet rozložení průvodce nezmění řady, popisky ani ✓ z #47', () => {
    for (const step of STEPS) {
      layoutGuideStep(step, SCREEN_WIDTH, SCREEN_HEIGHT);
    }
    expect(layoutSettingsPanel(SCREEN_WIDTH, SCREEN_HEIGHT)).toEqual(panelBefore);
  });

  it('řady z #47 zůstávají na svých místech', () => {
    expect(rowContentBox('maxNumber')).toEqual({ left: 142, right: 882, top: 12, bottom: 182 });
    expect(rowContentBox('operations')).toEqual({ left: 142, right: 882, top: 202, bottom: 372 });
    expect(rowContentBox('answerInput')).toEqual({ left: 272, right: 752, top: 392, bottom: 562 });
  });
});
