/**
 * Rozložení podle velikosti okna (#54): telefon na šířku dostane vlastní
 * rozložení s tlačítky aspoň 64 CSS px, iPad dnešní rozložení beze změny
 * a ostatní okna (na výšku, malá nebo nesmyslná) dnešní zmenšené
 * zobrazení. Herní plocha telefonu vyplní okno bez výřezu a lišty domů.
 *
 * Rozložení telefonu se počítá v CSS px (px na skutečném displeji) a na
 * konci převede na herní jednotky; na telefonu jsou 2 herní jednotky na
 * 1 CSS px, aby byla hra ostrá i na Retina displeji.
 * Čistý TypeScript bez Phaseru.
 */

import type { AnswerRound } from './answerRound';
import type { WritingAreaSize } from './digitRecognition';
import type { DotCounting } from './dotCounting';
import { arrangeHintDots } from './phoneHint';
import type { HintGrid, Region } from './phoneHint';
import type { GameProgress } from './progress';
import {
  HINT_DOT_HIT_SIZE,
  MASCOT_DANCE_SWAY,
  MASCOT_JUMP_HEIGHT,
  MASCOT_SIZE,
  STAR_SIZE,
  layoutHint,
  layoutScreen,
  layoutWritingScreen,
  problemMaxWidth,
  problemTextHeight,
} from './screenLayout';
import type {
  ButtonSlot,
  HintDot,
  HintStyle,
  Point,
  ScreenLayout,
  WritingAreaSlot,
  WritingLayout,
} from './screenLayout';
import { writingBoxCount } from './settings';
import type { GameSettings, MaxNumber } from './settings';
import type { SettingsSession } from './settingsSession';
import type { GuideState } from './setupGuide';
import { STARS_PER_SET } from './stars';
import type { TwoBoxRound } from './twoBoxWriting';
import { clearWriting } from './writingRound';
import type { WritingRound } from './writingRound';

export type { Region } from './phoneHint';

// ---------------------------------------------------------------------------
// Okno a herní plocha
// ---------------------------------------------------------------------------

/** Telefon na šířku, dnešní iPad, nebo dnešní zmenšené zobrazení. */
export type LayoutMode = 'tablet' | 'phoneLandscape' | 'scaled';

/** Výřez a lišta domů v CSS px (`env(safe-area-inset-*)`). */
export interface SafeArea {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

/** Okno prohlížeče v CSS px. */
export interface Viewport {
  readonly width: number;
  readonly height: number;
  readonly safeArea: SafeArea;
}

export interface GameSize {
  readonly width: number;
  readonly height: number;
}

/**
 * Herní plocha: velikost v herních jednotkách, CSS px na jednotku
 * a levý horní roh v okně v CSS px.
 */
export interface GameArea extends GameSize {
  readonly mode: LayoutMode;
  readonly scale: number;
  readonly offsetX: number;
  readonly offsetY: number;
}

/** Dnešní herní plocha 4:3 (iPad na šířku). */
export const TABLET_GAME_WIDTH = 1024;
export const TABLET_GAME_HEIGHT = 768;

/** Okno na šířku aspoň takhle vysoké je iPad. */
const TABLET_MIN_WINDOW_HEIGHT = 500;

/** Nejmenší volná plocha (bez výřezu a lišty), kde se telefonní rozložení vejde. */
const PHONE_MIN_FREE_WIDTH = 744;
const PHONE_MIN_FREE_HEIGHT = 296;

/** Herní jednotky na 1 CSS px na telefonu. */
const PHONE_UNITS_PER_CSS_PX = 2;

const NO_SAFE_AREA: SafeArea = { top: 0, right: 0, bottom: 0, left: 0 };

function isPositiveSize(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function isInset(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isValidSafeArea(safeArea: SafeArea | undefined): safeArea is SafeArea {
  return (
    safeArea !== undefined &&
    safeArea !== null &&
    [safeArea.top, safeArea.right, safeArea.bottom, safeArea.left].every(isInset)
  );
}

/** Má okno použitelnou velikost i výřez? Prohlížeč může na chvíli poslat nesmysl. */
function isValidViewport(viewport: Viewport | undefined): viewport is Viewport {
  return (
    viewport !== undefined &&
    isPositiveSize(viewport.width) &&
    isPositiveSize(viewport.height) &&
    isValidSafeArea(viewport.safeArea)
  );
}

/** Volná plocha okna v CSS px: bez výřezu a lišty domů. */
function freeSizeOf(viewport: Viewport): GameSize {
  const { safeArea } = viewport;
  return {
    width: viewport.width - safeArea.left - safeArea.right,
    height: viewport.height - safeArea.top - safeArea.bottom,
  };
}

/**
 * Které rozložení okno dostane. Čtverec se bere jako okno na výšku.
 * O iPadu rozhoduje výška celého okna, ne volné plochy (AC5).
 */
export function chooseLayoutMode(viewport: Viewport | undefined): LayoutMode {
  if (!isValidViewport(viewport) || viewport.width <= viewport.height) {
    return 'scaled';
  }
  if (viewport.height >= TABLET_MIN_WINDOW_HEIGHT) {
    return 'tablet';
  }
  const free = freeSizeOf(viewport);
  const phoneFits = free.width >= PHONE_MIN_FREE_WIDTH && free.height >= PHONE_MIN_FREE_HEIGHT;
  return phoneFits ? 'phoneLandscape' : 'scaled';
}

/** Telefon: herní plocha přesně přes volnou plochu, 2 jednotky na CSS px. */
function phoneGameArea(viewport: Viewport): GameArea {
  const free = freeSizeOf(viewport);
  return {
    mode: 'phoneLandscape',
    // Celé jednotky, aby plátno mělo celé pixely; ubere nejvýš čtvrt CSS px.
    width: Math.floor(free.width * PHONE_UNITS_PER_CSS_PX),
    height: Math.floor(free.height * PHONE_UNITS_PER_CSS_PX),
    scale: 1 / PHONE_UNITS_PER_CSS_PX,
    offsetX: viewport.safeArea.left,
    offsetY: viewport.safeArea.top,
  };
}

/** Dnešní zobrazení: 1024 × 768 celé v okně, co největší a na středu. */
function todayGameArea(mode: LayoutMode, window: GameSize): GameArea {
  const scale = Math.min(window.width / TABLET_GAME_WIDTH, window.height / TABLET_GAME_HEIGHT);
  return {
    mode,
    width: TABLET_GAME_WIDTH,
    height: TABLET_GAME_HEIGHT,
    scale,
    offsetX: (window.width - TABLET_GAME_WIDTH * scale) / 2,
    offsetY: (window.height - TABLET_GAME_HEIGHT * scale) / 2,
  };
}

/** Velikost okna; nesmyslný údaj se bere jako okno 0 × 0. */
function windowSizeOf(viewport: Viewport | undefined): GameSize {
  if (!viewport || !isPositiveSize(viewport.width) || !isPositiveSize(viewport.height)) {
    return { width: 0, height: 0 };
  }
  return { width: viewport.width, height: viewport.height };
}

/** Kam a jak velká se herní plocha v okně dá. */
export function gameAreaFor(viewport: Viewport | undefined): GameArea {
  if (isValidViewport(viewport) && chooseLayoutMode(viewport) === 'phoneLandscape') {
    return phoneGameArea(viewport);
  }
  return todayGameArea(chooseLayoutMode(viewport), windowSizeOf(viewport));
}

/** Okno bez výřezu, když výřez chybí nebo je nesmyslný. */
export function safeAreaOrNone(safeArea: SafeArea | undefined): SafeArea {
  return isValidSafeArea(safeArea) ? safeArea : NO_SAFE_AREA;
}

// ---------------------------------------------------------------------------
// Velikosti prvků, které se liší mezi iPadem a telefonem
// ---------------------------------------------------------------------------

/** Velikosti, které scéna potřebuje k rozložení navíc (v herních jednotkách). */
export interface DeviceSizes {
  readonly starSize: number;
  readonly mascotSize: number;
  /** Jak vysoko postavička vyskočí radostí. */
  readonly mascotJumpHeight: number;
  /** Jak daleko do stran se postavička pohne při tanci. */
  readonly mascotDanceSway: number;
  /** Strana plochy pro ťuknutí na tečku nápovědy. */
  readonly hintDotHitSize: number;
  /** Písmo čísla ve spočítané tečce. */
  readonly dotNumberFontSize: number;
  /** Násobek tloušťky čar, okrajů a drobných posunů proti iPadu. */
  readonly detailScale: number;
}

/** Písmo čísla ve spočítané tečce na iPadu. */
const TABLET_DOT_NUMBER_FONT_SIZE = 30;

const TABLET_SIZES: DeviceSizes = {
  starSize: STAR_SIZE,
  mascotSize: MASCOT_SIZE,
  mascotJumpHeight: MASCOT_JUMP_HEIGHT,
  mascotDanceSway: MASCOT_DANCE_SWAY,
  hintDotHitSize: HINT_DOT_HIT_SIZE,
  dotNumberFontSize: TABLET_DOT_NUMBER_FONT_SIZE,
  detailScale: 1,
};

interface PhoneParts extends DeviceSizes {
  readonly device: 'phone';
  /** Obdélník vlevo od ovládání, kam se dávají tečky nápovědy. */
  readonly hintRegion: Region;
  readonly hintGrid: HintGrid;
}

interface TabletParts extends DeviceSizes {
  readonly device: 'tablet';
}

export interface PhoneScreenLayout extends ScreenLayout, PhoneParts {}
export interface PhoneWritingLayout extends WritingLayout, PhoneParts {}
export interface TabletScreenLayout extends ScreenLayout, TabletParts {}
export interface TabletWritingLayout extends WritingLayout, TabletParts {}

export type DeviceScreenLayout = PhoneScreenLayout | TabletScreenLayout;
export type DeviceWritingLayout = PhoneWritingLayout | TabletWritingLayout;

// ---------------------------------------------------------------------------
// Telefon na šířku: rozměry v CSS px
// ---------------------------------------------------------------------------

/** Okraj od kraje volné plochy. */
const EDGE_MARGIN = 8;

/** Pravý horní roh pro kolečko nastavení; zároveň výška horního pruhu. */
const GEAR_CORNER_SIZE = 88;

/** Mezera mezi hvězdičkami, postavičkou a příkladem. */
const TOP_ROW_GAP = 8;

const PHONE_STAR_SIZE = 24;
const PHONE_STAR_SPACING = 28;
const PHONE_MASCOT_SIZE = 64;
const PHONE_PROBLEM_FONT_SIZE = 44;

/** Postavička skáče a tančí ve stejném poměru ke své velikosti jako na iPadu. */
const PHONE_MASCOT_JUMP = (PHONE_MASCOT_SIZE * MASCOT_JUMP_HEIGHT) / MASCOT_SIZE;
const PHONE_MASCOT_SWAY = (PHONE_MASCOT_SIZE * MASCOT_DANCE_SWAY) / MASCOT_SIZE;

/** Číselník: počet sloupců, strana tlačítka a mezera mezi tlačítky. */
interface KeypadSpec {
  readonly columns: number;
  readonly buttonSize: number;
  readonly gap: number;
}

/** Do 5: 3 × 2 velká tlačítka, do 10: 6 + 5 jako na iPadu, do 20: 3 řady po 7. */
function keypadSpecFor(buttonCount: number): KeypadSpec {
  if (buttonCount <= 6) {
    return { columns: 3, buttonSize: 80, gap: 12 };
  }
  if (buttonCount <= 11) {
    return { columns: 6, buttonSize: 64, gap: 8 };
  }
  return { columns: 7, buttonSize: 64, gap: 8 };
}

/** Tečka nápovědy a její buňka (plocha pro prst) podle rozsahu. */
interface HintDotSpec {
  readonly cell: number;
  readonly dotSize: number;
  readonly groupGap: number;
  readonly maxColumns: number;
}

function hintDotSpecFor(maxNumber: number): HintDotSpec {
  if (maxNumber <= 5) {
    return { cell: 72, dotSize: 56, groupGap: 16, maxColumns: 5 };
  }
  if (maxNumber <= 10) {
    return { cell: 64, dotSize: 44, groupGap: 16, maxColumns: 5 };
  }
  // Do 20 se na tečky neťuká (#43), stačí menší.
  return { cell: 30, dotSize: 24, groupGap: 12, maxColumns: 10 };
}

/** Okénka na psaní a tlačítka smazání a ✓ vpravo od nich. */
const SINGLE_BOX_MAX_SIDE = 240;
const TWO_BOX_MAX_SIDE = 200;
const TWO_BOX_GAP = 12;
const WRITING_BUTTON_SIZE = 72;
const WRITING_BUTTON_GAP = 12;

/**
 * Nejmenší šířka nápovědy vedle dvou okének: čtyři sloupce teček do 10
 * ve třech řadách a mezera mezi skupinkami (třeba 3 + 7 jako 1 + 3 sloupce).
 */
const HINT_MIN_WIDTH = 4 * 64 + 16;

/** Číslo ve spočítané tečce jako část průměru tečky. */
const DOT_NUMBER_RATIO = 0.6;

function units(cssPx: number): number {
  return cssPx * PHONE_UNITS_PER_CSS_PX;
}

function cssSizeOf(area: GameSize): GameSize {
  return {
    width: area.width / PHONE_UNITS_PER_CSS_PX,
    height: area.height / PHONE_UNITS_PER_CSS_PX,
  };
}

function pointInUnits(point: Point): Point {
  return { x: units(point.x), y: units(point.y) };
}

function slotInUnits(slot: ButtonSlot): ButtonSlot {
  return { x: units(slot.x), y: units(slot.y), size: units(slot.size) };
}

function areaInUnits(area: WritingAreaSlot): WritingAreaSlot {
  return {
    x: units(area.x),
    y: units(area.y),
    width: units(area.width),
    height: units(area.height),
  };
}

/** Horní pruh: všech deset hvězdiček, postavička a příklad (v CSS px). */
interface TopRow {
  readonly stars: readonly Point[];
  readonly mascot: Point;
  readonly problem: Point;
  readonly problemWidth: number;
  readonly problemHeight: number;
}

/**
 * Zleva hvězdičky, postavička a příklad, všechno nad spodní hranou rohu
 * s kolečkem. Místo pro hvězdičky je vždy pro celou řadu, aby se
 * postavička s přibývajícími hvězdičkami neposouvala.
 */
function layoutTopRow(freeWidth: number, maxNumber: number, starCount: number): TopRow {
  const rowY = EDGE_MARGIN + PHONE_MASCOT_JUMP + PHONE_MASCOT_SIZE / 2;
  const firstStarX = EDGE_MARGIN + PHONE_STAR_SIZE / 2;
  const starsRight = EDGE_MARGIN + (STARS_PER_SET - 1) * PHONE_STAR_SPACING + PHONE_STAR_SIZE;
  const mascotX = starsRight + TOP_ROW_GAP + PHONE_MASCOT_SWAY + PHONE_MASCOT_SIZE / 2;
  const problemLeft = mascotX + PHONE_MASCOT_SIZE / 2 + PHONE_MASCOT_SWAY + TOP_ROW_GAP;
  const problemRight = freeWidth - GEAR_CORNER_SIZE - TOP_ROW_GAP;
  const fontInUnits = units(PHONE_PROBLEM_FONT_SIZE);
  const problemWidth = problemMaxWidth(fontInUnits, maxNumber) / PHONE_UNITS_PER_CSS_PX;

  return {
    stars: Array.from({ length: starCount }, (_, index) => ({
      x: firstStarX + index * PHONE_STAR_SPACING,
      y: rowY,
    })),
    mascot: { x: mascotX, y: rowY },
    // Příklad je uprostřed místa mezi postavičkou a rohem s kolečkem.
    problem: { x: problemLeft + Math.max(problemWidth, problemRight - problemLeft) / 2, y: rowY },
    problemWidth,
    problemHeight: problemTextHeight(fontInUnits) / PHONE_UNITS_PER_CSS_PX,
  };
}

function hintStyleOf(spec: HintDotSpec): HintStyle {
  return {
    dotSize: units(spec.dotSize),
    spacing: units(spec.cell),
    dotsPerRow: spec.maxColumns,
    fiveGap: 0,
    groupGap: units(spec.groupGap),
  };
}

/** Společná část rozložení telefonu: horní pruh, nápověda a velikosti (v jednotkách). */
function phoneCommonParts(
  free: GameSize,
  maxNumber: number,
  starCount: number,
  controlsLeft: number,
): Omit<ScreenLayout, 'answerButtons'> & PhoneParts {
  const top = layoutTopRow(free.width, maxNumber, starCount);
  const dots = hintDotSpecFor(maxNumber);

  return {
    device: 'phone',
    problem: pointInUnits(top.problem),
    problemFontSize: units(PHONE_PROBLEM_FONT_SIZE),
    problemSize: { width: units(top.problemWidth), height: units(top.problemHeight) },
    hintStyle: hintStyleOf(dots),
    stars: top.stars.map(pointInUnits),
    mascot: pointInUnits(top.mascot),
    starSize: units(PHONE_STAR_SIZE),
    mascotSize: units(PHONE_MASCOT_SIZE),
    mascotJumpHeight: units(PHONE_MASCOT_JUMP),
    mascotDanceSway: units(PHONE_MASCOT_SWAY),
    hintDotHitSize: units(dots.cell),
    dotNumberFontSize: units(Math.round(dots.dotSize * DOT_NUMBER_RATIO)),
    detailScale: PHONE_UNITS_PER_CSS_PX,
    hintRegion: {
      left: units(EDGE_MARGIN),
      top: units(GEAR_CORNER_SIZE),
      right: units(controlsLeft - EDGE_MARGIN),
      bottom: units(free.height - EDGE_MARGIN),
    },
    hintGrid: {
      cell: units(dots.cell),
      groupGap: units(dots.groupGap),
      maxColumns: dots.maxColumns,
    },
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Číselník vpravo dole, čísla po řadách od 0 (v CSS px). Pod spodní řadou
 * je okraj, jen když se vejde pod horní pruh. Číselník, který by zasáhl
 * do rohu s kolečkem, se posune doleva.
 */
function layoutPhoneKeypad(buttonCount: number, free: GameSize): ButtonSlot[] {
  const { columns, buttonSize, gap } = keypadSpecFor(buttonCount);
  const rows = Math.ceil(buttonCount / columns);
  const pitch = buttonSize + gap;
  const width = columns * pitch - gap;
  const height = rows * pitch - gap;
  const bottomMargin = clamp(free.height - GEAR_CORNER_SIZE - height, 0, EDGE_MARGIN);
  const top = free.height - bottomMargin - height;
  const right = top < GEAR_CORNER_SIZE ? free.width - GEAR_CORNER_SIZE : free.width - EDGE_MARGIN;
  const left = right - width;

  return Array.from({ length: buttonCount }, (_, index) => ({
    x: left + (index % columns) * pitch + buttonSize / 2,
    y: top + Math.floor(index / columns) * pitch + buttonSize / 2,
    size: buttonSize,
  }));
}

/**
 * Telefon na šířku s číselníkem: nahoře zleva hvězdičky, postavička
 * a příklad, vlevo dole nápověda, vpravo dole číselník.
 *
 * @param buttonCount Počet tlačítek číselníku (rozsah + 1).
 */
export function layoutPhoneScreen(
  area: GameSize,
  buttonCount: number,
  starCount = 0,
): PhoneScreenLayout {
  const free = cssSizeOf(area);
  const keypad = layoutPhoneKeypad(buttonCount, free);
  const keypadLeft = Math.min(...keypad.map((slot) => slot.x - slot.size / 2));

  return {
    ...phoneCommonParts(free, buttonCount - 1, starCount, keypadLeft),
    answerButtons: keypad.map(slotInUnits),
  };
}

/** Strana okénka: co nejvíc pod horní pruh, u dvou okének s místem pro nápovědu vlevo. */
function writingBoxSide(free: GameSize, twoBoxes: boolean): number {
  const heightLeft = free.height - GEAR_CORNER_SIZE - EDGE_MARGIN;
  if (!twoBoxes) {
    return Math.min(SINGLE_BOX_MAX_SIDE, heightLeft);
  }
  const fixedWidth =
    EDGE_MARGIN +
    HINT_MIN_WIDTH +
    EDGE_MARGIN +
    TWO_BOX_GAP +
    WRITING_BUTTON_GAP +
    WRITING_BUTTON_SIZE +
    EDGE_MARGIN;
  return Math.min(TWO_BOX_MAX_SIDE, heightLeft, (free.width - fixedWidth) / 2);
}

/**
 * Telefon na šířku s psaním: vpravo dole okénka (desítky vlevo, jednotky
 * vpravo), vpravo od nich pod sebou smazání a ✓, smazání nahoře.
 */
export function layoutPhoneWritingScreen(
  area: GameSize,
  maxNumber: MaxNumber,
  starCount = 0,
): PhoneWritingLayout {
  const free = cssSizeOf(area);
  const twoBoxes = writingBoxCount(maxNumber) === 2;
  const side = writingBoxSide(free, twoBoxes);
  const buttonsX = free.width - EDGE_MARGIN - WRITING_BUTTON_SIZE / 2;
  const boxesRight = free.width - EDGE_MARGIN - WRITING_BUTTON_SIZE - WRITING_BUTTON_GAP;
  const centerY = free.height - EDGE_MARGIN - side / 2;
  const onesX = boxesRight - side / 2;
  const boxCenters = twoBoxes ? [onesX - side - TWO_BOX_GAP, onesX] : [onesX];
  const writingAreas = boxCenters.map((x) => ({ x, y: centerY, width: side, height: side }));
  const boxesLeft = Math.min(...writingAreas.map((box) => box.x - side / 2));
  const buttonOffset = (WRITING_BUTTON_SIZE + WRITING_BUTTON_GAP) / 2;

  return {
    ...phoneCommonParts(free, maxNumber, starCount, boxesLeft),
    writingAreas: writingAreas.map(areaInUnits),
    clearButton: slotInUnits({
      x: buttonsX,
      y: centerY - buttonOffset,
      size: WRITING_BUTTON_SIZE,
    }),
    confirmButton: slotInUnits({
      x: buttonsX,
      y: centerY + buttonOffset,
      size: WRITING_BUTTON_SIZE,
    }),
  };
}

/** Tečky nápovědy na telefonu: v obdélníku vlevo od ovládání. */
export function layoutPhoneHint(
  layout: PhoneScreenLayout | PhoneWritingLayout,
  groups: readonly number[],
): HintDot[] {
  return arrangeHintDots(groups, layout.hintRegion, layout.hintGrid);
}

// ---------------------------------------------------------------------------
// Rozložení pro scénu podle druhu herní plochy
// ---------------------------------------------------------------------------

/** Rozložení s číselníkem pro herní plochu `area` (telefon, nebo dnešní). */
export function layoutDeviceScreen(
  area: GameArea,
  buttonCount: number,
  starCount = 0,
): DeviceScreenLayout {
  if (area.mode === 'phoneLandscape') {
    return layoutPhoneScreen(area, buttonCount, starCount);
  }
  return {
    ...layoutScreen(area.width, area.height, buttonCount, starCount),
    ...TABLET_SIZES,
    device: 'tablet',
  };
}

/** Rozložení s okénky na psaní pro herní plochu `area`. */
export function layoutDeviceWritingScreen(
  area: GameArea,
  maxNumber: MaxNumber,
  starCount = 0,
): DeviceWritingLayout {
  if (area.mode === 'phoneLandscape') {
    return layoutPhoneWritingScreen(area, maxNumber, starCount);
  }
  return {
    ...layoutWritingScreen(area.width, area.height, maxNumber, starCount),
    ...TABLET_SIZES,
    device: 'tablet',
  };
}

/** Tečky nápovědy podle druhu rozložení. */
export function layoutDeviceHint(
  layout: DeviceScreenLayout | DeviceWritingLayout,
  groups: readonly number[],
): HintDot[] {
  if (layout.device === 'phone') {
    return layoutPhoneHint(layout, groups);
  }
  return layoutHint(layout, groups);
}

/** Kde a jak zmenšený je panel nastavení a průvodce (navržené na 1024 × 768). */
export interface PanelPlacement {
  readonly scale: number;
  readonly x: number;
  readonly y: number;
}

/**
 * Nastavení a průvodce na telefonu zatím jen zmenší celé (úkol c),
 * na iPadu zůstanou beze změny (měřítko 1).
 */
export function panelPlacement(area: GameSize): PanelPlacement {
  const scale = Math.min(area.width / TABLET_GAME_WIDTH, area.height / TABLET_GAME_HEIGHT);
  return {
    scale,
    x: (area.width - TABLET_GAME_WIDTH * scale) / 2,
    y: (area.height - TABLET_GAME_HEIGHT * scale) / 2,
  };
}

// ---------------------------------------------------------------------------
// Stav hry při změně velikosti okna (AC7)
// ---------------------------------------------------------------------------

/** Všechno, co je rozehrané a má přežít otočení telefonu. */
export interface PlayState {
  readonly round: AnswerRound;
  readonly settings: GameSettings;
  readonly progress: GameProgress;
  readonly counting: DotCounting;
  /** Okénka na psaní, nebo `null` u číselníku. */
  readonly writing: WritingRound | TwoBoxRound | null;
  readonly settingsSession: SettingsSession;
  readonly guide: GuideState | null;
}

/** Prázdné okénko nové velikosti: rozepsané tahy, číslice i blednoucí zápis zmizí. */
function emptyWritingRound(round: WritingRound, area: WritingAreaSize): WritingRound {
  return { ...clearWriting(round), fading: [], area };
}

export function isTwoBoxRound(writing: WritingRound | TwoBoxRound): writing is TwoBoxRound {
  return 'tens' in writing;
}

/**
 * Stav po změně velikosti okna. Příklad, chyby, nápověda, hvězdičky,
 * postavička, nastavení i průvodce zůstanou. Okénka na psaní se vyprázdní
 * a dostanou novou velikost `writingArea`; není to chyba ani odpověď.
 */
export function playStateAfterResize(state: PlayState, writingArea: WritingAreaSize): PlayState {
  const { writing } = state;
  if (writing === null) {
    return state;
  }
  if (isTwoBoxRound(writing)) {
    return {
      ...state,
      writing: {
        ...writing,
        tens: emptyWritingRound(writing.tens, writingArea),
        ones: emptyWritingRound(writing.ones, writingArea),
        activeBox: null,
      },
    };
  }
  return { ...state, writing: emptyWritingRound(writing, writingArea) };
}
