/**
 * Průvodce nastavením pro rodiče při prvním spuštění (#49): tři kroky po
 * řadách nastavení s radami a shrnutí, předvyplněné výchozí volby. Čistý
 * TypeScript bez Phaseru; čas se předává jako číslo v ms.
 */

import { scriptLines } from './guideScript';
import type { Point } from './screenLayout';
import { DEFAULT_SETTINGS, answerInputOf } from './settings';
import type { GameSettings } from './settings';
import { layoutSettingsPanel } from './settingsLayout';
import type { SettingsRow, SettingsRowKind } from './settingsLayout';
import { CLOSED_SETTINGS, openSettings, pageAppearance } from './settingsSession';
import type { LaunchState, PageAppearance, SelectedOptions } from './settingsSession';

/** Kroky 1–3 jsou řady nastavení, 4 shrnutí (#49, bez otázky na třídu). */
export type GuideStep = 1 | 2 | 3 | 4;
const LAST_STEP: GuideStep = 4;

/** Pojistka: „Začít hrát“ po zobrazení shrnutí chvíli nereaguje (dvojí ťuknutí na „Další“). */
export const START_PLAYING_GUARD_MS = 500;

/** Texty tlačítek; věty pod řadami jsou ve scénáři `guideScript.ts` (#50). */
export const GUIDE_TEXTS = {
  buttons: { back: 'Zpět', next: 'Další', startPlaying: 'Začít hrát' },
} as const;

/** Barvy průvodce; písmo tlačítek má na všech pozadích kontrast aspoň 7 : 1. */
export const GUIDE_COLORS = {
  text: '#cfe8d6',
  buttonText: '#0f3d24',
  buttonBackground: '#ffffff',
  startPlayingBackground: '#8be04e',
  frame: '#cfe8d6',
} as const;

export interface GuideState {
  readonly step: GuideStep;
  readonly choice: Required<GameSettings>;
  /** Kdy se naposledy zobrazilo shrnutí (pro pojistku „Začít hrát“). */
  readonly summaryShownAtMs: number | null;
}

/** Která řada nastavení patří ke kroku 1–3. */
const ROW_OF_STEP: Partial<Record<GuideStep, SettingsRowKind>> = {
  1: 'maxNumber',
  2: 'operations',
  3: 'answerInput',
};

/** Začátek průvodce: řada „Do kolika“, předvyplněno 10 / + / 123. */
export function startGuide(): GuideState {
  return {
    step: 1,
    choice: { ...DEFAULT_SETTINGS, answerInput: answerInputOf(DEFAULT_SETTINGS) },
    summaryShownAtMs: null,
  };
}

/** „Další“: o jeden krok, nejdál na shrnutí. */
export function next(state: GuideState, nowMs: number): GuideState {
  if (state.step === LAST_STEP) {
    return state;
  }
  const step = (state.step + 1) as GuideStep;
  const summaryShownAtMs = step === LAST_STEP ? nowMs : state.summaryShownAtMs;
  return { ...state, step, summaryShownAtMs };
}

/** „Zpět“: o krok zpět; na kroku 1 nic. */
export function back(state: GuideState): GuideState {
  if (state.step === 1) {
    return state;
  }
  return { ...state, step: (state.step - 1) as GuideStep };
}

/** Ťuknutí na volbu: v krocích 1–3 jen ve zvýrazněné řadě, na shrnutí kdekoli. */
export function chooseOption(state: GuideState, change: Partial<GameSettings>): GuideState {
  if (state.step === LAST_STEP) {
    return { ...state, choice: { ...state.choice, ...change } };
  }
  const row = ROW_OF_STEP[state.step];
  if (row === undefined) {
    return state;
  }
  const value = change[row];
  if (value === undefined) {
    return state;
  }
  return { ...state, choice: { ...state.choice, [row]: value } };
}

export function guideStep(state: GuideState): GuideStep {
  return state.step;
}

/** Vybrané volby, jak je kreslí řady nastavení. */
export function guideSelection(state: GuideState): SelectedOptions {
  return { ...state.choice };
}

export function stepIndicatorText(state: GuideState): string {
  return `${state.step} / ${LAST_STEP}`;
}

/** Pravé tlačítko: „Začít hrát“ na shrnutí, jinak „Další“. */
export function rightButton(state: GuideState): 'next' | 'startPlaying' {
  return state.step === LAST_STEP ? 'startPlaying' : 'next';
}

export function hasBackButton(state: GuideState): boolean {
  return state.step !== 1;
}

/** Dva řádky pod řadami ze scénáře: vysvětlení a rada (kroky 1–3), nebo shrnutí. */
export function guideMessage(state: GuideState): readonly [string, string] {
  return scriptLines(ROW_OF_STEP[state.step] ?? 'summary');
}

export interface GuideRowStyle {
  readonly visible: boolean;
  readonly opacity: number;
  readonly framed: boolean;
  readonly tappable: boolean;
}

/** Ztlumená řada v krocích 1–3. */
const DIMMED_ROW_OPACITY = 0.3;

/** Jak vypadá řada nastavení v daném kroku průvodce. */
export function guideRowStyle(state: GuideState, kind: SettingsRowKind): GuideRowStyle {
  if (state.step === LAST_STEP) {
    return { visible: true, opacity: 1, framed: false, tappable: true };
  }
  const focused = ROW_OF_STEP[state.step] === kind;
  return {
    visible: true,
    opacity: focused ? 1 : DIMMED_ROW_OPACITY,
    framed: focused,
    tappable: focused,
  };
}

/** Jde už ťuknout na „Začít hrát“? */
export function canStartPlaying(state: GuideState, nowMs: number): boolean {
  return (
    state.step === LAST_STEP &&
    state.summaryShownAtMs !== null &&
    nowMs - state.summaryShownAtMs >= START_PLAYING_GUARD_MS
  );
}

/** „Začít hrát“: celé nastavení k uložení, nebo `null`, když ještě nejde. */
export function finishGuide(state: GuideState, nowMs: number): Required<GameSettings> | null {
  return canStartPlaying(state, nowMs) ? { ...state.choice } : null;
}

/** Během průvodce podržení kolečka nic neudělá (#45 AC7). */
export function canOpenSettingsByHold(guide: GuideState | null): boolean {
  return guide === null;
}

/** Na začátku hry: při prvním spuštění průvodce, jinak nic. */
export function guideAtStart(launch: LaunchState): GuideState | null {
  return launch.helpPending ? startGuide() : null;
}

/** Po „Začít hrát“ se průvodce v témže načtení stránky znovu neotevře. */
export function launchAfterGuide(launch: LaunchState): LaunchState {
  return launch.helpPending ? { helpPending: false } : launch;
}

/** Stránka a kolečko vypadají jako při otevřeném nastavení. */
export function guidePageAppearance(): PageAppearance {
  return pageAppearance(openSettings(CLOSED_SETTINGS, DEFAULT_SETTINGS));
}

// ---------------------------------------------------------------------------
// Rozložení (#49 AC5), herní plocha 1024 × 768. Sloty mají `x` a `y` ve středu.
// ---------------------------------------------------------------------------

export interface GuideSlot extends Point {
  readonly width: number;
  readonly height: number;
  readonly fontSize: number;
}

export interface GuideMessageSlot extends GuideSlot {
  readonly lineCount: 2;
  readonly lineHeight: number;
  readonly align: 'center';
  readonly color: string;
  readonly background: null;
}

export interface GuideFrame extends Point {
  readonly width: number;
  readonly height: number;
  readonly lineWidth: number;
  readonly color: string;
  readonly fill: null;
}

export interface GuideLayout {
  readonly message: GuideMessageSlot;
  readonly back: GuideSlot | null;
  readonly indicator: GuideSlot & { readonly color: string };
  readonly right: GuideSlot;
  readonly frame: GuideFrame | null;
}

const EDGE_MARGIN = 24;
const BUTTON_WIDTH = 240;
const INDICATOR_WIDTH = 120;
const BUTTON_TOP = 680;
const BUTTON_HEIGHT = 72;
const BUTTON_FONT_SIZE = 32;
const INDICATOR_FONT_SIZE = 28;

const MESSAGE_TOP = 590;
const MESSAGE_LINE_HEIGHT = 36;
const MESSAGE_FONT_SIZE = 28;

/** Rámeček zvýrazněné řady: 8 px vně popisku a řady, čára 4 px. */
const FRAME_PADDING = 8;
const FRAME_LINE_WIDTH = 4;

/** Slot z hran (vlevo, vpravo, nahoře, dole). */
function slotFromEdges(
  left: number,
  right: number,
  top: number,
  bottom: number,
  fontSize: number,
): GuideSlot {
  return {
    x: (left + right) / 2,
    y: (top + bottom) / 2,
    width: right - left,
    height: bottom - top,
    fontSize,
  };
}

/** Rámeček kolem popisku a řady voleb; souřadnice jsou jeho vnější hrana. */
function frameAround(row: SettingsRow): GuideFrame {
  const firstOption = row.options[0];
  const optionHeight = firstOption?.height ?? 0;
  const left = row.label.x - row.label.width / 2 - FRAME_PADDING;
  const right = row.label.x + row.label.width / 2 + FRAME_PADDING;
  const top = row.label.y - row.label.height / 2 - FRAME_PADDING;
  const bottom = row.y + optionHeight / 2 + FRAME_PADDING;
  return {
    x: (left + right) / 2,
    y: (top + bottom) / 2,
    width: right - left,
    height: bottom - top,
    lineWidth: FRAME_LINE_WIDTH,
    color: GUIDE_COLORS.frame,
    fill: null,
  };
}

/** Rozložení jednoho kroku průvodce. */
export function layoutGuideStep(step: GuideStep, width: number, height: number): GuideLayout {
  const centerX = width / 2;
  const isFirstStep = step === 1;
  const focusedKind = ROW_OF_STEP[step];
  const focusedRow = layoutSettingsPanel(width, height).rows.find(
    (row) => row.kind === focusedKind,
  );
  const buttonBottom = BUTTON_TOP + BUTTON_HEIGHT;

  return {
    message: {
      ...slotFromEdges(
        EDGE_MARGIN,
        width - EDGE_MARGIN,
        MESSAGE_TOP,
        MESSAGE_TOP + 2 * MESSAGE_LINE_HEIGHT,
        MESSAGE_FONT_SIZE,
      ),
      lineCount: 2,
      lineHeight: MESSAGE_LINE_HEIGHT,
      align: 'center',
      color: GUIDE_COLORS.text,
      background: null,
    },
    back: isFirstStep
      ? null
      : slotFromEdges(
          EDGE_MARGIN,
          EDGE_MARGIN + BUTTON_WIDTH,
          BUTTON_TOP,
          buttonBottom,
          BUTTON_FONT_SIZE,
        ),
    indicator: {
      ...slotFromEdges(
        centerX - INDICATOR_WIDTH / 2,
        centerX + INDICATOR_WIDTH / 2,
        BUTTON_TOP,
        buttonBottom,
        INDICATOR_FONT_SIZE,
      ),
      color: GUIDE_COLORS.text,
    },
    right: slotFromEdges(
      width - EDGE_MARGIN - BUTTON_WIDTH,
      width - EDGE_MARGIN,
      BUTTON_TOP,
      buttonBottom,
      BUTTON_FONT_SIZE,
    ),
    frame: focusedRow ? frameAround(focusedRow) : null,
  };
}
