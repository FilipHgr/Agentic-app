import { describe, expect, it } from 'vitest';

import { TABLET_GAME_HEIGHT, TABLET_GAME_WIDTH } from '../../../src/shared/logic/viewportLayout';
import { layoutSettingsPanel } from '../../../src/games/counting/logic/settingsLayout';
import { layoutGuideStep } from '../../../src/games/counting/logic/setupGuide';
import { GUIDE_STEPS, todayPanelCssPlacement } from './parentPanelCss';
import { NO_NOTCH } from '../../shared/viewportFixtures';
import type { TestWindow } from '../../shared/viewportFixtures';

/**
 * Testy k #59 (nastavení na telefonu, část a), AC6, od #81 s pevnými body
 * místo snapshotu: na iPadu (1180×820, 1180×760, 932×500, 820×1180)
 * a ve zmenšených oknech (667×320, 375×553) jsou nastavení i všechny čtyři
 * kroky průvodce jako dnes.
 *
 * Panel je plocha 1024 × 768 zmenšená na herní plochu (`panelFit`). Poloha
 * prvku v okně v CSS px je posun panelu + jednotky panelu × měřítko. Pevné
 * jsou obě části: místo a měřítko panelu v každém ze 6 oken a polohy všech
 * prvků v jednotkách panelu (popisky řad, volby a ✓ nastavení; v průvodci
 * řady, rada, Zpět, ukazatel kroku, Další / Začít hrát, reproduktor
 * a rámeček). Porovnává se přesně, bez tolerance. Hodnoty jsou z dřívějšího
 * snapshotu (ověřeno jednorázovým skriptem při #81).
 *
 * Že nové nastavení a průvodce dají těmto oknům právě tohle, ověřují
 * `phoneSettingsLayout.test.ts` a `phoneGuideLayout.test.ts`. Polohy
 * průvodce v telefonních oknech (#60, AC4 a AC5) hlídá `phoneGuideLayout.test.ts`.
 */

/** iPad a zmenšená okna, kde se nastavení ani průvodce nemění (AC6). */
const UNCHANGED_WINDOWS: readonly TestWindow[] = [
  { name: 'iPad 1180×820', width: 1180, height: 820, safeArea: NO_NOTCH },
  { name: 'iPad 1180×760', width: 1180, height: 760, safeArea: NO_NOTCH },
  { name: '932×500 těsně nad hranicí', width: 932, height: 500, safeArea: NO_NOTCH },
  { name: 'iPad na výšku 820×1180', width: 820, height: 1180, safeArea: NO_NOTCH },
  { name: 'zmenšené 667×320', width: 667, height: 320, safeArea: NO_NOTCH },
  { name: 'zmenšené 375×553', width: 375, height: 553, safeArea: NO_NOTCH },
];

/** Kde je panel v okně: posun levého horního rohu v CSS px a CSS px na jednotku panelu. */
const PLACEMENTS: Readonly<Record<string, object>> = {
  'iPad 1180×820': { scale: 1.0677083333333333, offsetX: 43.33333333333337, offsetY: 0 },
  'iPad 1180×760': { scale: 0.9895833333333334, offsetX: 83.33333333333331, offsetY: 0 },
  '932×500 těsně nad hranicí': {
    scale: 0.6510416666666666,
    offsetX: 132.66666666666669,
    offsetY: 0,
  },
  'iPad na výšku 820×1180': { scale: 0.80078125, offsetX: 0, offsetY: 282.5 },
  'zmenšené 667×320': { scale: 0.4166666666666667, offsetX: 120.16666666666666, offsetY: 0 },
  'zmenšené 375×553': { scale: 0.3662109375, offsetX: 0, offsetY: 135.875 },
};

/** Obdélník v jednotkách panelu: [vlevo, nahoře, vpravo, dole]. */
type Box = [left: number, top: number, right: number, bottom: number];

/** Řady nastavení: popisek a volby [hodnota, vlevo, nahoře, vpravo, dole]. */
const SETTINGS_ROWS = [
  {
    kind: 'maxNumber',
    label: { text: 'Do kolika', box: [142, 12, 882, 44], fontSize: 28 },
    options: [
      [5, 142, 52, 362, 182],
      [10, 402, 52, 622, 182],
      [20, 662, 52, 882, 182],
    ],
  },
  {
    kind: 'operations',
    label: { text: 'Příklady', box: [142, 202, 882, 234], fontSize: 28 },
    options: [
      ['plus', 142, 242, 362, 372],
      ['minus', 402, 242, 622, 372],
      ['mixed', 662, 242, 882, 372],
    ],
  },
  {
    kind: 'answerInput',
    label: { text: 'Odpověď', box: [272, 392, 752, 424], fontSize: 28 },
    options: [
      ['keypad', 272, 432, 492, 562],
      ['writing', 532, 432, 752, 562],
    ],
  },
];

const SETTINGS_CONFIRM: Box = [437, 594, 587, 744];

/** Kroky průvodce (řady jsou stejné jako v nastavení). */
const GUIDE_STEP_POINTS: Readonly<Record<number, object>> = {
  1: {
    message: {
      box: [24, 590, 1000, 662],
      fontSize: 28,
      lineHeight: 36,
      lineCount: 2,
      align: 'center',
    },
    back: null,
    indicator: { box: [452, 680, 572, 752], fontSize: 28 },
    right: { box: [760, 680, 1000, 752], fontSize: 32 },
    speaker: [322, 680, 394, 752],
    frame: { box: [134, 4, 890, 190], lineWidth: 4 },
  },
  2: {
    message: {
      box: [24, 590, 1000, 662],
      fontSize: 28,
      lineHeight: 36,
      lineCount: 2,
      align: 'center',
    },
    back: { box: [24, 680, 264, 752], fontSize: 32 },
    indicator: { box: [452, 680, 572, 752], fontSize: 28 },
    right: { box: [760, 680, 1000, 752], fontSize: 32 },
    speaker: [322, 680, 394, 752],
    frame: { box: [134, 194, 890, 380], lineWidth: 4 },
  },
  3: {
    message: {
      box: [24, 590, 1000, 662],
      fontSize: 28,
      lineHeight: 36,
      lineCount: 2,
      align: 'center',
    },
    back: { box: [24, 680, 264, 752], fontSize: 32 },
    indicator: { box: [452, 680, 572, 752], fontSize: 28 },
    right: { box: [760, 680, 1000, 752], fontSize: 32 },
    speaker: [322, 680, 394, 752],
    frame: { box: [264, 384, 760, 570], lineWidth: 4 },
  },
  4: {
    message: {
      box: [24, 590, 1000, 662],
      fontSize: 28,
      lineHeight: 36,
      lineCount: 2,
      align: 'center',
    },
    back: { box: [24, 680, 264, 752], fontSize: 32 },
    indicator: { box: [452, 680, 572, 752], fontSize: 28 },
    right: { box: [760, 680, 1000, 752], fontSize: 32 },
    speaker: [322, 680, 394, 752],
    frame: null,
  },
};

interface CenteredSlot {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

function boxOf(slot: CenteredSlot): Box {
  return [
    slot.x - slot.width / 2,
    slot.y - slot.height / 2,
    slot.x + slot.width / 2,
    slot.y + slot.height / 2,
  ];
}

function todaySettingsRows(): object[] {
  return layoutSettingsPanel(TABLET_GAME_WIDTH, TABLET_GAME_HEIGHT).rows.map((row) => ({
    kind: row.kind,
    label: { text: row.label.text, box: boxOf(row.label), fontSize: row.label.fontSize },
    options: row.options.map((option) => [option.value, ...boxOf(option)]),
  }));
}

function todayGuideStep(step: (typeof GUIDE_STEPS)[number]): object {
  const layout = layoutGuideStep(step, TABLET_GAME_WIDTH, TABLET_GAME_HEIGHT);
  const { message, back, indicator, right, frame } = layout;
  return {
    message: {
      box: boxOf(message),
      fontSize: message.fontSize,
      lineHeight: message.lineHeight,
      lineCount: message.lineCount,
      align: message.align,
    },
    back: back ? { box: boxOf(back), fontSize: back.fontSize } : null,
    indicator: { box: boxOf(indicator), fontSize: indicator.fontSize },
    right: { box: boxOf(right), fontSize: right.fontSize },
    speaker: boxOf(layout.speaker),
    frame: frame ? { box: boxOf(frame), lineWidth: frame.lineWidth } : null,
  };
}

describe('AC6: na iPadu a ve zmenšených oknech jsou nastavení a průvodce jako dnes', () => {
  it('ve všech 6 oknech je panel nastavení a průvodce na pevném místě a v pevném měřítku', () => {
    for (const window of UNCHANGED_WINDOWS) {
      expect(todayPanelCssPlacement(window), window.name).toEqual(PLACEMENTS[window.name]);
    }
  });

  it('popisky řad, volby a ✓ nastavení mají pevné polohy a velikosti', () => {
    const settings = layoutSettingsPanel(TABLET_GAME_WIDTH, TABLET_GAME_HEIGHT);
    const { confirm } = settings;

    expect(todaySettingsRows()).toEqual(SETTINGS_ROWS);
    expect(boxOf({ ...confirm, width: confirm.size, height: confirm.size }), '✓').toEqual(
      SETTINGS_CONFIRM,
    );
  });

  it('všechny čtyři kroky průvodce mají řady, rámeček, radu, ukazatel, tlačítka a reproduktor na pevných místech', () => {
    for (const step of GUIDE_STEPS) {
      expect(todayGuideStep(step), `krok ${step}`).toEqual(GUIDE_STEP_POINTS[step]);
    }
    // Průvodce ukazuje na každém kroku stejné řady jako nastavení.
    expect(todaySettingsRows(), 'řady průvodce').toEqual(SETTINGS_ROWS);
  });
});
