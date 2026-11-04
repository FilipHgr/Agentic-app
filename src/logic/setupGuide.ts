/**
 * Průvodce nastavením pro rodiče při prvním spuštění (#49): otázka na třídu,
 * předvyplnění, tři kroky po řadách nastavení s radami a shrnutí. Čistý
 * TypeScript bez Phaseru; čas se předává jako číslo v ms.
 */

import type { Point } from './screenLayout';
import { DEFAULT_SETTINGS, answerInputOf } from './settings';
import type { GameSettings } from './settings';
import { layoutSettingsPanel } from './settingsLayout';
import type { SettingsRow, SettingsRowKind } from './settingsLayout';
import { CLOSED_SETTINGS, openSettings, pageAppearance } from './settingsSession';
import type { LaunchState, PageAppearance, SelectedOptions } from './settingsSession';

/** Odpovědi na úvodní otázku, zleva doprava. Odpověď se nikam neukládá. */
export const GRADE_OPTIONS = ['preschool', 'firstGrade', 'secondGradeOrHigher'] as const;
export type Grade = (typeof GRADE_OPTIONS)[number];

/** Krok 1 otázka, 2–4 řady nastavení, 5 shrnutí. */
export type GuideStep = 1 | 2 | 3 | 4 | 5;
const LAST_STEP: GuideStep = 5;

/** Jak dlouho je vybraná odpověď žlutě vidět, než průvodce přejde dál. */
export const ANSWER_HIGHLIGHT_MS = 300;

/** Pojistka: „Začít hrát“ po zobrazení shrnutí chvíli nereaguje (dvojí ťuknutí na „Další“). */
export const START_PLAYING_GUARD_MS = 500;

/** Doporučené nastavení podle třídy (#49 AC2). */
export const GRADE_PRESETS: Record<Grade, Required<GameSettings>> = {
  preschool: { maxNumber: 5, operations: 'plus', answerInput: 'keypad' },
  firstGrade: { maxNumber: 10, operations: 'mixed', answerInput: 'keypad' },
  secondGradeOrHigher: { maxNumber: 20, operations: 'mixed', answerInput: 'writing' },
};

/** Texty průvodce pro rodiče. */
export const GUIDE_TEXTS = {
  question: 'Do které třídy dítě chodí?',
  questionNote: 'Podle odpovědi hru předvyplníme. Odpověď se neukládá.',
  grades: { preschool: 'Školka', firstGrade: '1. třída', secondGradeOrHigher: '2. třída a výš' },
  rowExplanations: {
    maxNumber: 'Největší číslo, které se v příkladech objeví.',
    operations: 'Sčítání, odčítání, nebo obojí zamíchané.',
    answerInput: '123: dítě ťuká na čísla. Tužka: píše výsledek prstem.',
  },
  summary: [
    'Hotovo. Volby můžete ještě změnit ťuknutím.',
    'Později je změníte podržením kolečka vpravo nahoře.',
  ],
  buttons: { back: 'Zpět', next: 'Další', skip: 'Přeskočit', startPlaying: 'Začít hrát' },
} as const;

/** Rady k řadám podle třídy; jsou to doporučení, ne kontrola volby. */
export const ADVICE: Record<Grade, Record<SettingsRowKind, string>> = {
  preschool: {
    maxNumber: 'Doporučujeme 5. Ve školce dítě počítá na prstech ruky.',
    operations: 'Doporučujeme +. Přidávání je pro malé děti nejsnazší.',
    answerInput: 'Doporučujeme 123. Psát číslice se dítě teprve učí.',
  },
  firstGrade: {
    maxNumber: 'Doporučujeme 10. Ve 2. pololetí 1. třídy zkuste 20.',
    operations: 'Doporučujeme + −. V 1. třídě se učí obojí současně.',
    answerInput: 'Doporučujeme 123. Tužku zvolte, až dítě umí psát 0–9.',
  },
  secondGradeOrHigher: {
    maxNumber: 'Doporučujeme 20. Víc hra nemá, procvičí přechod přes 10.',
    operations: 'Doporučujeme + −. Dítě musí sledovat znaménko.',
    answerInput: 'Doporučujeme tužku. Dítě si procvičí i psaní číslic.',
  },
};

/** Barvy průvodce; písmo tlačítek má na všech pozadích kontrast aspoň 7 : 1. */
export const GUIDE_COLORS = {
  text: '#cfe8d6',
  buttonText: '#0f3d24',
  buttonBackground: '#ffffff',
  selectedAnswerBackground: '#ffd54f',
  startPlayingBackground: '#8be04e',
  frame: '#cfe8d6',
} as const;

export interface GuideState {
  readonly step: GuideStep;
  /** Odpověď z kroku 1, nebo `null`, když ještě žádná není (i po „Přeskočit“). */
  readonly grade: Grade | null;
  readonly choice: Required<GameSettings>;
  /** Kdy průvodce po vybrané odpovědi přejde na krok 2; `null`, když nic nečeká. */
  readonly advanceAtMs: number | null;
  /** Na shrnutí se přišlo přes „Přeskočit“ (Zpět pak vede na krok 1). */
  readonly cameBySkip: boolean;
  /** Kdy se naposledy zobrazilo shrnutí (pro pojistku „Začít hrát“). */
  readonly summaryShownAtMs: number | null;
}

/** Která řada nastavení patří ke kroku 2–4. */
const ROW_OF_STEP: Partial<Record<GuideStep, SettingsRowKind>> = {
  2: 'maxNumber',
  3: 'operations',
  4: 'answerInput',
};

/** Začátek průvodce: krok 1 bez odpovědi, výchozí 10 / + / 123. */
export function startGuide(): GuideState {
  return {
    step: 1,
    grade: null,
    choice: { ...DEFAULT_SETTINGS, answerInput: answerInputOf(DEFAULT_SETTINGS) },
    advanceAtMs: null,
    cameBySkip: false,
    summaryShownAtMs: null,
  };
}

function isWaitingForAnswer(state: GuideState): boolean {
  return state.advanceAtMs !== null;
}

/**
 * Ťuknutí na odpověď (krok 1). Jiná odpověď předvyplní všechny řady, stejná
 * nechá změny rodiče. Za `ANSWER_HIGHLIGHT_MS` průvodce přejde na krok 2.
 */
export function chooseGrade(state: GuideState, grade: Grade, nowMs: number): GuideState {
  if (state.step !== 1 || isWaitingForAnswer(state)) {
    return state;
  }
  const choice = grade === state.grade ? state.choice : GRADE_PRESETS[grade];
  return { ...state, grade, choice, advanceAtMs: nowMs + ANSWER_HIGHLIGHT_MS, cameBySkip: false };
}

/** Posune průvodce v čase: po zvýraznění odpovědi přejde na krok 2. */
export function tickGuide(state: GuideState, nowMs: number): GuideState {
  if (state.advanceAtMs === null || nowMs < state.advanceAtMs) {
    return state;
  }
  return { ...state, step: 2, advanceAtMs: null };
}

function goToStep(state: GuideState, step: GuideStep, nowMs: number): GuideState {
  const summaryShownAtMs = step === LAST_STEP ? nowMs : state.summaryShownAtMs;
  return { ...state, step, summaryShownAtMs };
}

/** „Další“: o jeden krok, nejdál na shrnutí. Na kroku 1 jen s vybranou odpovědí. */
export function next(state: GuideState, nowMs: number): GuideState {
  if (isWaitingForAnswer(state) || state.step === LAST_STEP) {
    return state;
  }
  if (state.step === 1 && state.grade === null) {
    return state;
  }
  return goToStep(state, (state.step + 1) as GuideStep, nowMs);
}

/** „Zpět“: o krok zpět; ze shrnutí po „Přeskočit“ na krok 1 bez odpovědi. */
export function back(state: GuideState): GuideState {
  if (state.step === 1) {
    return state;
  }
  if (state.step === LAST_STEP && state.cameBySkip) {
    return { ...state, step: 1, grade: null };
  }
  return { ...state, step: (state.step - 1) as GuideStep };
}

/** „Přeskočit“ (jen krok 1 bez odpovědi): rovnou na shrnutí, volby beze změny. */
export function skip(state: GuideState, nowMs: number): GuideState {
  if (state.step !== 1 || state.grade !== null || isWaitingForAnswer(state)) {
    return state;
  }
  return { ...goToStep(state, LAST_STEP, nowMs), cameBySkip: true };
}

/**
 * Ťuknutí na volbu. V krocích 2–4 jen ve zvýrazněné řadě, na shrnutí
 * kdekoli, na kroku 1 nikde.
 */
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

export function selectedGrade(state: GuideState): Grade | null {
  return state.grade;
}

/** Vybrané volby, jak je kreslí řady nastavení. */
export function guideSelection(state: GuideState): SelectedOptions {
  return { ...state.choice };
}

export function stepIndicatorText(state: GuideState): string {
  return `${state.step} / ${LAST_STEP}`;
}

/** Pravé tlačítko: „Přeskočit“ na kroku 1 bez odpovědi, „Začít hrát“ na shrnutí, jinak „Další“. */
export function rightButton(state: GuideState): 'skip' | 'next' | 'startPlaying' {
  if (state.step === LAST_STEP) {
    return 'startPlaying';
  }
  return state.step === 1 && state.grade === null ? 'skip' : 'next';
}

export function hasBackButton(state: GuideState): boolean {
  return state.step !== 1;
}

/** Dva řádky pod řadami: vysvětlení a rada (kroky 2–4), nebo shrnutí (krok 5). */
export function guideMessage(state: GuideState): readonly [string, string] | null {
  if (state.step === LAST_STEP) {
    return GUIDE_TEXTS.summary;
  }
  const row = ROW_OF_STEP[state.step];
  if (row === undefined || state.grade === null) {
    return null;
  }
  return [GUIDE_TEXTS.rowExplanations[row], ADVICE[state.grade][row]];
}

export interface GuideRowStyle {
  readonly visible: boolean;
  readonly opacity: number;
  readonly framed: boolean;
  readonly tappable: boolean;
}

/** Ztlumená řada v krocích 2–4. */
const DIMMED_ROW_OPACITY = 0.3;

/** Jak vypadá řada nastavení v daném kroku průvodce. */
export function guideRowStyle(state: GuideState, kind: SettingsRowKind): GuideRowStyle {
  if (state.step === 1) {
    return { visible: false, opacity: 0, framed: false, tappable: false };
  }
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

export interface GuideAnswerSlot extends GuideSlot {
  readonly grade: Grade;
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
  readonly heading: GuideSlot | null;
  readonly subheading: GuideSlot | null;
  readonly answers: readonly GuideAnswerSlot[];
  readonly message: GuideMessageSlot | null;
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

const HEADING = { top: 96, bottom: 140, fontSize: 36 };
const SUBHEADING = { top: 156, bottom: 192, fontSize: 28 };
const TEXT_BLOCK_WIDTH = 800;

const ANSWER_WIDTH = 280;
const ANSWER_HEIGHT = 160;
const ANSWER_GAP = 40;
const ANSWER_TOP = 264;
const ANSWER_FONT_SIZE = 32;

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

/** Odpovědi vedle sebe na středu plochy. */
function layoutAnswers(width: number): GuideAnswerSlot[] {
  const rowWidth = GRADE_OPTIONS.length * ANSWER_WIDTH + (GRADE_OPTIONS.length - 1) * ANSWER_GAP;
  const firstLeft = (width - rowWidth) / 2;
  return GRADE_OPTIONS.map((grade, index) => {
    const left = firstLeft + index * (ANSWER_WIDTH + ANSWER_GAP);
    return {
      ...slotFromEdges(
        left,
        left + ANSWER_WIDTH,
        ANSWER_TOP,
        ANSWER_TOP + ANSWER_HEIGHT,
        ANSWER_FONT_SIZE,
      ),
      grade,
    };
  });
}

/** Rozložení jednoho kroku průvodce. */
export function layoutGuideStep(step: GuideStep, width: number, height: number): GuideLayout {
  const centerX = width / 2;
  const isQuestion = step === 1;
  const focusedKind = ROW_OF_STEP[step];
  const focusedRow = layoutSettingsPanel(width, height).rows.find(
    (row) => row.kind === focusedKind,
  );
  const buttonBottom = BUTTON_TOP + BUTTON_HEIGHT;
  const textLeft = centerX - TEXT_BLOCK_WIDTH / 2;
  const textRight = centerX + TEXT_BLOCK_WIDTH / 2;

  return {
    heading: isQuestion
      ? slotFromEdges(textLeft, textRight, HEADING.top, HEADING.bottom, HEADING.fontSize)
      : null,
    subheading: isQuestion
      ? slotFromEdges(textLeft, textRight, SUBHEADING.top, SUBHEADING.bottom, SUBHEADING.fontSize)
      : null,
    answers: isQuestion ? layoutAnswers(width) : [],
    message: isQuestion
      ? null
      : {
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
    back: isQuestion
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
