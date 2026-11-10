/**
 * Průvodce nastavením na telefonu (#60): na šířku podle obrázku
 * S-sirka-pruvodce (řady vlevo, rada a tlačítka ve sloupci vpravo), na
 * výšku podle S-vyska-pruvodce (řady pod sebou, pod nimi rada a dole
 * tlačítka u palce). Rozměry jsou v CSS px a na konci se převedou na
 * herní jednotky telefonu. Čistý TypeScript.
 */

import type { GameSize } from '../../../shared/logic/viewportLayout';
import { sharedTexts } from '../../../shared/texts/sharedTexts';
import { cssSizeOf, units } from './phoneScreenParts';
import { PHONE_OPTION_LOOK, phoneRowWidth, phoneRows } from './phoneSettingsLayout';
import type { SettingsLayout } from './settingsLayout';
import type { GuideFrame, GuideSlot, GuideStep } from './setupGuide';
import { stepMessage } from './setupGuide';
import { GUIDE_STYLE } from './theme';

/** Jak je rada zarovnaná vodorovně a svisle ve svém pruhu. */
export type GuideMessageAlign = 'left' | 'center';
export type GuideMessageVerticalAlign = 'top' | 'middle';

/** Rada kroku: pruh, zalomené řádky k vykreslení a jejich zarovnání. */
export interface DeviceGuideMessage extends GuideSlot {
  /** Řádky rady; každá věta začíná na novém řádku. */
  readonly lines: readonly string[];
  readonly lineCount: number;
  readonly lineHeight: number;
  /**
   * Řádky přesně po `lineHeight` (telefon, #60). Jinak jako dnes na iPadu:
   * mezi řádky je navíc `lineHeight − fontSize` k výšce písma.
   */
  readonly exactLineHeight: boolean;
  readonly align: GuideMessageAlign;
  readonly verticalAlign: GuideMessageVerticalAlign;
  readonly color: string;
  readonly background: null;
}

/** Krok průvodce bez údajů o umístění na herní ploše (v jednotkách panelu). */
export interface GuideStepParts {
  readonly rows: SettingsLayout['rows'];
  readonly optionLook: SettingsLayout['optionLook'];
  readonly message: DeviceGuideMessage;
  /** Zpět, na 1. kroku chybí. */
  readonly back: GuideSlot | null;
  readonly indicator: GuideSlot & { readonly color: string };
  /** Další, nebo Začít hrát na shrnutí. */
  readonly right: GuideSlot;
  readonly speaker: { x: number; y: number; width: number; height: number };
  /** Rámeček kolem zvýrazněné řady, na shrnutí chybí. */
  readonly frame: GuideFrame | null;
}

/** Společné rozměry průvodce na telefonu (CSS px, AC2 v #59). */
const TEXT_FONT_SIZE = 16;
const MESSAGE_LINE_HEIGHT = 22;
const MESSAGE_MAX_LINES = 4;
/** Odhad šířky znaku rady: 0,6 × 16 px. */
const MESSAGE_CHARACTER_WIDTH = 9.6;
const BUTTON_FONT_SIZE = 18;
const BUTTON_HEIGHT = 64;
const BACK_WIDTH = 80;
const SPEAKER_SIZE = 64;
const RIGHT_WIDTH = 128;
const BUTTON_GAP = 8;
const INDICATOR_WIDTH = 48;
const INDICATOR_HEIGHT = 20;
const BOTTOM_MARGIN = 16;
const LABEL_HEIGHT = 20;
/** Rámeček: čára 3 px, vnější hrana 8 px vně řady (AC4, AC5). */
const FRAME_LINE_WIDTH = 3;
const FRAME_PADDING = 8;

/** Na šířku (AC4). */
const LANDSCAPE = {
  labelLeft: 12,
  labelRight: 100,
  optionsLeft: 112,
  optionWidth: 96,
  optionHeight: 68,
  rowStep: 84,
  rowsHeight: 236,
  optionFontSize: 28,
  frameLeft: 4,
  frameRight: 424,
  columnLeftFromRight: 304,
  columnRightMargin: 16,
  messageTop: 80,
  indicatorTopFromBottom: 108,
} as const;

/** Na výšku (AC5). */
const PORTRAIT = {
  firstRowTop: 114,
  optionWidth: 104,
  optionHeight: 72,
  rowStep: 114,
  labelToRowGap: 6,
  optionFontSize: 32,
  messageSideMargin: 16,
  messageTopFromBottom: 180,
} as const;

const MESSAGE_HEIGHT = MESSAGE_MAX_LINES * MESSAGE_LINE_HEIGHT;
const BUTTON_ROW_WIDTH = BACK_WIDTH + SPEAKER_SIZE + INDICATOR_WIDTH + RIGHT_WIDTH + 3 * BUTTON_GAP;

/** Obdélník v CSS px z hran. */
interface CssEdges {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}

/** Slot se středem v jednotkách z hran v CSS px. */
function slotInUnits(edges: CssEdges, fontSize: number): GuideSlot {
  return {
    x: units((edges.left + edges.right) / 2),
    y: units((edges.top + edges.bottom) / 2),
    width: units(edges.right - edges.left),
    height: units(edges.bottom - edges.top),
    fontSize: units(fontSize),
  };
}

function frameInUnits(edges: CssEdges): GuideFrame {
  const { x, y, width, height } = slotInUnits(edges, 0);
  return {
    x,
    y,
    width,
    height,
    lineWidth: units(FRAME_LINE_WIDTH),
    color: GUIDE_STYLE.frameColor,
    fill: null,
  };
}

/**
 * Slova věty, ve kterých je jednopísmenná předložka spojená s dalším slovem.
 * Které předložky to jsou, je pravidlo jazyka ve sdílených textech (#65).
 */
function wrapUnits(sentence: string, prepositions: ReadonlySet<string>): string[] {
  const wrapped: string[] = [];
  let preposition: string | null = null;
  for (const word of sentence.split(' ').filter((part) => part !== '')) {
    const unit = preposition === null ? word : `${preposition} ${word}`;
    if (prepositions.has(word.toLowerCase()) && preposition === null) {
      preposition = word;
      continue;
    }
    wrapped.push(unit);
    preposition = null;
  }
  if (preposition !== null) {
    wrapped.push(preposition);
  }
  return wrapped;
}

/**
 * Zalomí větu jen mezi slovy na řádky nejvýš `maxCharacters` znaků.
 * Jednopísmenná předložka zůstane na řádku se slovem za ní.
 */
function wrapSentence(
  sentence: string,
  maxCharacters: number,
  prepositions: ReadonlySet<string>,
): string[] {
  const lines: string[] = [];
  let current = '';
  for (const word of wrapUnits(sentence, prepositions)) {
    const candidate = current === '' ? word : `${current} ${word}`;
    if (candidate.length <= maxCharacters || current === '') {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current !== '') {
    lines.push(current);
  }
  return lines;
}

/**
 * Řádky rady: každá věta od nového řádku, zalomená jen mezi slovy, na řádek
 * nejvýš floor(šířka / 9,6) znaků (AC2 v #59). Jednopísmenné předložky
 * jsou pravidlo jazyka; bez zadání se vezmou z aktuálního jazyka (#65).
 */
export function wrapGuideMessage(
  sentences: readonly string[],
  widthCssPx: number,
  oneLetterPrepositions: readonly string[] = sharedTexts().oneLetterPrepositions,
): readonly string[] {
  const prepositions = new Set(oneLetterPrepositions);
  // Malá rezerva, aby 288 / 9,6 dalo přesně 30 i při chybě v plovoucí čárce.
  const maxCharacters = Math.floor(widthCssPx / MESSAGE_CHARACTER_WIDTH + 1e-9);
  return sentences.flatMap((sentence) => wrapSentence(sentence, maxCharacters, prepositions));
}

function messageInUnits(
  step: GuideStep,
  edges: CssEdges,
  align: GuideMessageAlign,
  verticalAlign: GuideMessageVerticalAlign,
): DeviceGuideMessage {
  const lines = wrapGuideMessage(stepMessage(step), edges.right - edges.left);
  return {
    ...slotInUnits(edges, TEXT_FONT_SIZE),
    lines,
    lineCount: lines.length,
    lineHeight: units(MESSAGE_LINE_HEIGHT),
    exactLineHeight: true,
    align,
    verticalAlign,
    color: GUIDE_STYLE.textColor,
    background: null,
  };
}

/** Index zvýrazněné řady v krocích 1–3, na shrnutí žádná. */
function focusedRowIndex(step: GuideStep): number | null {
  return step === 4 ? null : step - 1;
}

/** Tlačítka a ukazatel kroku v CSS px; Zpět na 1. kroku chybí. */
interface ButtonEdges {
  readonly back: CssEdges;
  readonly speaker: CssEdges;
  readonly indicator: CssEdges;
  readonly right: CssEdges;
}

function buttonsInUnits(
  step: GuideStep,
  edges: ButtonEdges,
): Omit<GuideStepParts, 'rows' | 'optionLook' | 'message' | 'frame'> {
  const speaker = slotInUnits(edges.speaker, 0);
  return {
    back: step === 1 ? null : slotInUnits(edges.back, BUTTON_FONT_SIZE),
    indicator: { ...slotInUnits(edges.indicator, TEXT_FONT_SIZE), color: GUIDE_STYLE.textColor },
    right: slotInUnits(edges.right, BUTTON_FONT_SIZE),
    speaker: { x: speaker.x, y: speaker.y, width: speaker.width, height: speaker.height },
  };
}

/**
 * Na šířku (S-sirka-pruvodce, AC4): tři řady vlevo svisle na středu,
 * popisek zarovnaný vpravo před řadou; vpravo sloupec s radou nahoře,
 * ukazatelem kroku a tlačítky Zpět, reproduktor a Další dole.
 */
export function layoutPhoneLandscapeGuide(area: GameSize, step: GuideStep): GuideStepParts {
  const { width, height } = cssSizeOf(area);
  const top = (height - LANDSCAPE.rowsHeight) / 2;
  const rowTop = (index: number): number => top + index * LANDSCAPE.rowStep;
  const labelWidth = LANDSCAPE.labelRight - LANDSCAPE.labelLeft;
  const rows = phoneRows((kind, index) => {
    const centerY = rowTop(index) + LANDSCAPE.optionHeight / 2;
    return {
      kind,
      optionsLeft: LANDSCAPE.optionsLeft,
      centerY,
      optionWidth: LANDSCAPE.optionWidth,
      optionHeight: LANDSCAPE.optionHeight,
      optionFontSize: LANDSCAPE.optionFontSize,
      label: {
        x: LANDSCAPE.labelLeft + labelWidth / 2,
        y: centerY,
        width: labelWidth,
        align: 'right',
      },
    };
  });

  const focused = focusedRowIndex(step);
  const frame =
    focused === null
      ? null
      : frameInUnits({
          left: LANDSCAPE.frameLeft,
          right: LANDSCAPE.frameRight,
          top: rowTop(focused) - FRAME_PADDING,
          bottom: rowTop(focused) + LANDSCAPE.optionHeight + FRAME_PADDING,
        });

  const columnLeft = width - LANDSCAPE.columnLeftFromRight;
  const columnRight = width - LANDSCAPE.columnRightMargin;
  const columnCenter = (columnLeft + columnRight) / 2;
  const indicatorTop = height - LANDSCAPE.indicatorTopFromBottom;
  const buttonBottom = height - BOTTOM_MARGIN;
  const buttonTop = buttonBottom - BUTTON_HEIGHT;
  const backRight = columnLeft + BACK_WIDTH;
  const speakerLeft = backRight + BUTTON_GAP;

  return {
    rows,
    optionLook: PHONE_OPTION_LOOK,
    message: messageInUnits(
      step,
      {
        left: columnLeft,
        right: columnRight,
        top: LANDSCAPE.messageTop,
        bottom: LANDSCAPE.messageTop + MESSAGE_HEIGHT,
      },
      'left',
      'top',
    ),
    ...buttonsInUnits(step, {
      back: { left: columnLeft, right: backRight, top: buttonTop, bottom: buttonBottom },
      speaker: {
        left: speakerLeft,
        right: speakerLeft + SPEAKER_SIZE,
        top: buttonTop,
        bottom: buttonBottom,
      },
      indicator: {
        left: columnCenter - INDICATOR_WIDTH / 2,
        right: columnCenter + INDICATOR_WIDTH / 2,
        top: indicatorTop,
        bottom: indicatorTop + INDICATOR_HEIGHT,
      },
      right: {
        left: columnRight - RIGHT_WIDTH,
        right: columnRight,
        top: buttonTop,
        bottom: buttonBottom,
      },
    }),
    frame,
  };
}

/** Rámeček na výšku: 8 px vně popisku a řady široké `rowWidth` na středu. */
function portraitFrameEdges(
  centerX: number,
  rowWidth: number,
  labelTop: number,
  rowBottom: number,
): CssEdges {
  return {
    left: centerX - rowWidth / 2 - FRAME_PADDING,
    right: centerX + rowWidth / 2 + FRAME_PADDING,
    top: labelTop - FRAME_PADDING,
    bottom: rowBottom + FRAME_PADDING,
  };
}

/**
 * Na výšku (S-vyska-pruvodce, AC5): řady pod sebou vodorovně na středu,
 * popisek na středu nad řadou, pod řadami rada na středu a dole řada
 * Zpět, reproduktor, ukazatel kroku a Další u palce.
 */
export function layoutPhonePortraitGuide(area: GameSize, step: GuideStep): GuideStepParts {
  const { width, height } = cssSizeOf(area);
  const centerX = width / 2;
  const rowTop = (index: number): number => PORTRAIT.firstRowTop + index * PORTRAIT.rowStep;
  const labelTop = (index: number): number => rowTop(index) - PORTRAIT.labelToRowGap - LABEL_HEIGHT;
  const rows = phoneRows((kind, index) => {
    const rowWidth = phoneRowWidth(kind, PORTRAIT.optionWidth);
    return {
      kind,
      optionsLeft: centerX - rowWidth / 2,
      centerY: rowTop(index) + PORTRAIT.optionHeight / 2,
      optionWidth: PORTRAIT.optionWidth,
      optionHeight: PORTRAIT.optionHeight,
      optionFontSize: PORTRAIT.optionFontSize,
      label: {
        x: centerX,
        y: labelTop(index) + LABEL_HEIGHT / 2,
        width: rowWidth,
        align: 'center',
      },
    };
  });

  const focused = focusedRowIndex(step);
  const focusedKind = focused === null ? undefined : rows[focused]?.kind;
  const frame =
    focused === null || focusedKind === undefined
      ? null
      : frameInUnits(
          portraitFrameEdges(
            centerX,
            phoneRowWidth(focusedKind, PORTRAIT.optionWidth),
            labelTop(focused),
            rowTop(focused) + PORTRAIT.optionHeight,
          ),
        );

  const messageTop = height - PORTRAIT.messageTopFromBottom;
  const buttonBottom = height - BOTTOM_MARGIN;
  const buttonTop = buttonBottom - BUTTON_HEIGHT;
  const buttonCenterY = (buttonTop + buttonBottom) / 2;
  const backLeft = centerX - BUTTON_ROW_WIDTH / 2;
  const speakerLeft = backLeft + BACK_WIDTH + BUTTON_GAP;
  const indicatorLeft = speakerLeft + SPEAKER_SIZE + BUTTON_GAP;
  const rightLeft = indicatorLeft + INDICATOR_WIDTH + BUTTON_GAP;

  return {
    rows,
    optionLook: PHONE_OPTION_LOOK,
    message: messageInUnits(
      step,
      {
        left: PORTRAIT.messageSideMargin,
        right: width - PORTRAIT.messageSideMargin,
        top: messageTop,
        bottom: messageTop + MESSAGE_HEIGHT,
      },
      'center',
      'middle',
    ),
    ...buttonsInUnits(step, {
      back: { left: backLeft, right: backLeft + BACK_WIDTH, top: buttonTop, bottom: buttonBottom },
      speaker: {
        left: speakerLeft,
        right: speakerLeft + SPEAKER_SIZE,
        top: buttonTop,
        bottom: buttonBottom,
      },
      indicator: {
        left: indicatorLeft,
        right: indicatorLeft + INDICATOR_WIDTH,
        top: buttonCenterY - INDICATOR_HEIGHT / 2,
        bottom: buttonCenterY + INDICATOR_HEIGHT / 2,
      },
      right: {
        left: rightLeft,
        right: rightLeft + RIGHT_WIDTH,
        top: buttonTop,
        bottom: buttonBottom,
      },
    }),
    frame,
  };
}
