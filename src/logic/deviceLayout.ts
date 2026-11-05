/**
 * Rozložení podle velikosti okna (#54, #56): telefon na šířku i na výšku
 * dostane vlastní rozložení s tlačítky aspoň 64 CSS px, iPad dnešní
 * rozložení beze změny a ostatní okna (iPad na výšku, malá nebo nesmyslná)
 * dnešní zmenšené zobrazení. Herní plocha telefonu vyplní okno bez výřezu
 * a lišty domů.
 *
 * Rozložení telefonu se počítá v CSS px (px na skutečném displeji) a na
 * konci převede na herní jednotky; na telefonu jsou 2 herní jednotky na
 * 1 CSS px, aby byla hra ostrá i na Retina displeji.
 * Čistý TypeScript bez Phaseru.
 */

import type { AnswerRound } from './answerRound';
import type { WritingAreaSize } from './digitRecognition';
import { canCountDots } from './dotCounting';
import type { DotCounting } from './dotCounting';
import { visibleGroups } from './phoneHint';
import { planPhoneScreen } from './phoneLayout';
import { layoutPhoneLandscapeSettings, layoutPhonePortraitSettings } from './phoneSettingsLayout';
import type { PhonePlanRequest } from './phoneLayout';
import {
  isPortraitLayout,
  layoutPhonePortraitHint,
  layoutPhonePortraitScreen,
  layoutPhonePortraitWritingScreen,
} from './phonePortraitLayout';
import {
  PHONE_UNITS_PER_CSS_PX,
  areaInUnits,
  cssSizeOf,
  dotInUnits,
  phoneParts,
  slotInUnits,
} from './phoneScreenParts';
import type { PhoneParts } from './phoneScreenParts';
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
} from './screenLayout';
import type { ButtonSlot, HintDot, ScreenLayout, WritingLayout } from './screenLayout';
import type { GameSettings, MaxNumber, OperationMode } from './settings';
import { layoutSettingsPanel } from './settingsLayout';
import type { SettingsLayout } from './settingsLayout';
import type { SettingsSession } from './settingsSession';
import type { GuideState } from './setupGuide';
import type { TwoBoxRound } from './twoBoxWriting';
import { clearWriting } from './writingRound';
import type { WritingRound } from './writingRound';

export type { Region } from './phoneHint';
export {
  isPortraitLayout,
  layoutPhonePortraitHint,
  layoutPhonePortraitScreen,
  layoutPhonePortraitWritingScreen,
} from './phonePortraitLayout';
export type {
  PhonePortraitLayout,
  PhonePortraitScreenLayout,
  PhonePortraitWritingLayout,
  PortraitLayoutSettings,
} from './phonePortraitLayout';

// ---------------------------------------------------------------------------
// Okno a herní plocha
// ---------------------------------------------------------------------------

/** Telefon na šířku nebo na výšku, dnešní iPad, nebo dnešní zmenšené zobrazení. */
export type LayoutMode = 'tablet' | 'phoneLandscape' | 'phonePortrait' | 'scaled';

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

/** Okno na výšku užší než 500 px je telefon (širší je iPad, #56). */
const PORTRAIT_PHONE_MAX_WINDOW_WIDTH = 500;
/** Nejmenší volná plocha na výšku, kde se rozložení P2 vejde (#56). */
const PORTRAIT_PHONE_MIN_FREE_WIDTH = 360;
const PORTRAIT_PHONE_MIN_FREE_HEIGHT = 620;

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
 * O iPadu rozhoduje velikost celého okna, ne volné plochy (#54 AC5).
 */
export function chooseLayoutMode(viewport: Viewport | undefined): LayoutMode {
  if (!isValidViewport(viewport)) {
    return 'scaled';
  }
  if (viewport.width <= viewport.height) {
    return portraitLayoutMode(viewport);
  }
  if (viewport.height >= TABLET_MIN_WINDOW_HEIGHT) {
    return 'tablet';
  }
  const free = freeSizeOf(viewport);
  const phoneFits = free.width >= PHONE_MIN_FREE_WIDTH && free.height >= PHONE_MIN_FREE_HEIGHT;
  return phoneFits ? 'phoneLandscape' : 'scaled';
}

/**
 * Okno na výšku: telefon (užší než 500 px s dost velkou volnou plochou),
 * jinak dnešní zmenšené zobrazení. Úzký iPad ve Split View je záměrně
 * telefon, stejně jako u kolečka (#55).
 */
function portraitLayoutMode(viewport: Viewport): LayoutMode {
  const free = freeSizeOf(viewport);
  const phoneFits =
    viewport.width < PORTRAIT_PHONE_MAX_WINDOW_WIDTH &&
    free.width >= PORTRAIT_PHONE_MIN_FREE_WIDTH &&
    free.height >= PORTRAIT_PHONE_MIN_FREE_HEIGHT;
  return phoneFits ? 'phonePortrait' : 'scaled';
}

/** Je to telefonní rozložení (na šířku nebo na výšku) přes volnou plochu? */
export function isPhoneMode(mode: LayoutMode): mode is 'phoneLandscape' | 'phonePortrait' {
  return mode === 'phoneLandscape' || mode === 'phonePortrait';
}

/** Telefon: herní plocha přesně přes volnou plochu, 2 jednotky na CSS px. */
function phoneGameArea(viewport: Viewport, mode: 'phoneLandscape' | 'phonePortrait'): GameArea {
  const free = freeSizeOf(viewport);
  return {
    mode,
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
  const mode = chooseLayoutMode(viewport);
  if (isValidViewport(viewport) && isPhoneMode(mode)) {
    return phoneGameArea(viewport, mode);
  }
  return todayGameArea(mode, windowSizeOf(viewport));
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
  /** Jde na tečky nápovědy ťukat a počítat je (#43)? */
  readonly hintDotsCountable: boolean;
  /** Písmo čísla ve spočítané tečce. */
  readonly dotNumberFontSize: number;
  /** Násobek tloušťky čar, okrajů a drobných posunů proti iPadu. */
  readonly detailScale: number;
}

/** Písmo čísla ve spočítané tečce na iPadu. */
const TABLET_DOT_NUMBER_FONT_SIZE = 30;

/** Na iPadu beze změny (AC5): ťukat jde na tečky do 5 a do 10. */
function tabletSizes(maxNumber: number): DeviceSizes {
  return {
    starSize: STAR_SIZE,
    mascotSize: MASCOT_SIZE,
    mascotJumpHeight: MASCOT_JUMP_HEIGHT,
    mascotDanceSway: MASCOT_DANCE_SWAY,
    hintDotHitSize: HINT_DOT_HIT_SIZE,
    hintDotsCountable: canCountDots(maxNumber),
    dotNumberFontSize: TABLET_DOT_NUMBER_FONT_SIZE,
    detailScale: 1,
  };
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
// Telefon na šířku (V2, #54); převod na herní jednotky je v `phoneScreenParts.ts`
// ---------------------------------------------------------------------------

/**
 * Telefon na šířku s číselníkem (rozložení V2).
 *
 * @param buttonCount Počet tlačítek číselníku (rozsah + 1).
 * @param hintGroups Skupinky teček nápovědy; prázdné = bez nápovědy.
 */
export function layoutPhoneScreen(
  area: GameSize,
  buttonCount: number,
  starCount = 0,
  hintGroups: readonly number[] = [],
): PhoneScreenLayout {
  const request: PhonePlanRequest = {
    free: cssSizeOf(area),
    maxNumber: maxNumberForButtons(buttonCount),
    answerInput: 'keypad',
    starCount,
    hintGroups: visibleGroups(hintGroups),
  };
  const plan = planPhoneScreen(request);
  return { ...phoneParts(plan, request), answerButtons: plan.answerButtons.map(slotInUnits) };
}

/** Rozsah podle počtu tlačítek číselníku (0 až rozsah). */
function maxNumberForButtons(buttonCount: number): MaxNumber {
  if (buttonCount <= 6) {
    return 5;
  }
  return buttonCount <= 11 ? 10 : 20;
}

/**
 * Telefon na šířku s psaním (rozložení V2): smazání vlevo, okénka
 * uprostřed pod příkladem, ✓ vpravo.
 *
 * @param hintGroups Skupinky teček nápovědy; prázdné = bez nápovědy.
 */
export function layoutPhoneWritingScreen(
  area: GameSize,
  maxNumber: MaxNumber,
  starCount = 0,
  hintGroups: readonly number[] = [],
): PhoneWritingLayout {
  const request: PhonePlanRequest = {
    free: cssSizeOf(area),
    maxNumber,
    answerInput: 'writing',
    starCount,
    hintGroups: visibleGroups(hintGroups),
  };
  const plan = planPhoneScreen(request);
  const writing = plan.writing;
  const noButton: ButtonSlot = { x: 0, y: 0, size: 0 };
  return {
    ...phoneParts(plan, request),
    writingAreas: (writing?.areas ?? []).map(areaInUnits),
    clearButton: slotInUnits(writing?.clear ?? noButton),
    confirmButton: slotInUnits(writing?.confirm ?? noButton),
  };
}

function sameGroups(first: readonly number[], second: readonly number[]): boolean {
  return first.length === second.length && first.every((count, i) => count === second[i]);
}

/**
 * Tečky nápovědy na telefonu. Rozložení počítané pro tytéž skupinky je
 * už má; pro jiné skupinky se rozložení spočítá znovu.
 */
export function layoutPhoneHint(
  layout: PhoneScreenLayout | PhoneWritingLayout,
  groups: readonly number[],
): HintDot[] {
  const visible = visibleGroups(groups);
  if (sameGroups(visible, layout.request.hintGroups)) {
    return [...layout.hintDots];
  }
  const plan = planPhoneScreen({ ...layout.request, hintGroups: visible });
  return plan.hintDots.map(dotInUnits);
}

// ---------------------------------------------------------------------------
// Rozložení pro scénu podle druhu herní plochy
// ---------------------------------------------------------------------------

/**
 * Rozložení s číselníkem pro herní plochu `area` (telefon, nebo dnešní).
 * Na telefonu na šířku udělá místo pro nápovědu `hintGroups`; na výšku je
 * místo vyhrazené podle druhu příkladů `operations` a iPad ho nepotřebuje.
 */
export function layoutDeviceScreen(
  area: GameArea,
  buttonCount: number,
  starCount = 0,
  hintGroups: readonly number[] = [],
  operations: OperationMode = 'mixed',
): DeviceScreenLayout {
  if (area.mode === 'phonePortrait') {
    const settings = { maxNumber: maxNumberForButtons(buttonCount), operations };
    return layoutPhonePortraitScreen(area, settings, starCount);
  }
  if (area.mode === 'phoneLandscape') {
    return layoutPhoneScreen(area, buttonCount, starCount, hintGroups);
  }
  return {
    ...layoutScreen(area.width, area.height, buttonCount, starCount),
    ...tabletSizes(buttonCount - 1),
    device: 'tablet',
  };
}

/** Rozložení s okénky na psaní pro herní plochu `area`. */
export function layoutDeviceWritingScreen(
  area: GameArea,
  maxNumber: MaxNumber,
  starCount = 0,
  hintGroups: readonly number[] = [],
  operations: OperationMode = 'mixed',
): DeviceWritingLayout {
  if (area.mode === 'phonePortrait') {
    return layoutPhonePortraitWritingScreen(area, { maxNumber, operations }, starCount);
  }
  if (area.mode === 'phoneLandscape') {
    return layoutPhoneWritingScreen(area, maxNumber, starCount, hintGroups);
  }
  return {
    ...layoutWritingScreen(area.width, area.height, maxNumber, starCount),
    ...tabletSizes(maxNumber),
    device: 'tablet',
  };
}

/** Tečky nápovědy podle druhu rozložení. */
export function layoutDeviceHint(
  layout: DeviceScreenLayout | DeviceWritingLayout,
  groups: readonly number[],
): HintDot[] {
  if (isPortraitLayout(layout)) {
    return layoutPhonePortraitHint(layout, groups);
  }
  if (layout.device === 'phone') {
    return layoutPhoneHint(layout, groups);
  }
  return layoutHint(layout, groups);
}

/**
 * Posune nápověda rozložení? Na telefonu na šířku ano (#54), proto se po
 * jejím ukázání rozložení přepočítá. Na výšku má nápověda místo vyhrazené
 * (#56) a na iPadu má místo vždy.
 */
export function hintMovesLayout(layout: DeviceScreenLayout | DeviceWritingLayout): boolean {
  return layout.device === 'phone' && !isPortraitLayout(layout);
}

/**
 * Rozložení, ze kterého se kreslí hvězdičky, postavička a příklad. Na
 * telefonu (na šířku #54 i na výšku #56) se psaní rozvrhne jinak než
 * číselník, proto se bere rozložení se skutečným ovládáním `answerLayout`,
 * aby příklad ani postavička nezasahovaly do okének a teček nápovědy. Na
 * iPadu a ve zmenšeném zobrazení zůstává rozložení s číselníkem.
 */
export function sceneryLayoutFor(
  mode: LayoutMode,
  keypadLayout: DeviceScreenLayout,
  answerLayout: DeviceScreenLayout | DeviceWritingLayout,
): DeviceScreenLayout | DeviceWritingLayout {
  return isPhoneMode(mode) ? answerLayout : keypadLayout;
}

/** Kde a jak zmenšený je panel nastavení a průvodce (navržené na 1024 × 768). */
export interface PanelPlacement {
  readonly scale: number;
  readonly x: number;
  readonly y: number;
}

/**
 * Průvodce (a nastavení mimo telefon) se navrhuje na 1024 × 768 a na menší
 * plochu se celý zmenší; na iPadu zůstane beze změny (měřítko 1).
 */
export function panelPlacement(area: GameSize): PanelPlacement {
  const scale = Math.min(area.width / TABLET_GAME_WIDTH, area.height / TABLET_GAME_HEIGHT);
  return {
    scale,
    x: (area.width - TABLET_GAME_WIDTH * scale) / 2,
    y: (area.height - TABLET_GAME_HEIGHT * scale) / 2,
  };
}

/** Nastavení otevřené kolečkem pro danou herní plochu (#59). */
export interface DeviceSettingsLayout extends SettingsLayout {
  readonly mode: LayoutMode;
  /** Kam a jak zmenšené se rozložení na herní plochu dá. */
  readonly placement: PanelPlacement;
}

/** Telefonní rozložení je přímo v jednotkách herní plochy, nic se nezmenšuje. */
const PHONE_SETTINGS_PLACEMENT: PanelPlacement = { scale: 1, x: 0, y: 0 };

/**
 * Nastavení pro rodiče: na telefonu na šířku a na výšku vlastní rozložení
 * s velkými volbami (#59), jinde dnešní panel 1024 × 768 zmenšený na
 * herní plochu (iPad beze změny).
 */
export function layoutDeviceSettingsPanel(area: GameArea): DeviceSettingsLayout {
  if (area.mode === 'phoneLandscape') {
    return {
      ...layoutPhoneLandscapeSettings(area),
      mode: area.mode,
      placement: PHONE_SETTINGS_PLACEMENT,
    };
  }
  if (area.mode === 'phonePortrait') {
    return {
      ...layoutPhonePortraitSettings(area),
      mode: area.mode,
      placement: PHONE_SETTINGS_PLACEMENT,
    };
  }
  return {
    ...layoutSettingsPanel(TABLET_GAME_WIDTH, TABLET_GAME_HEIGHT),
    mode: area.mode,
    placement: panelPlacement(area),
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

// ---------------------------------------------------------------------------
// Kolečko nastavení pro rodiče (#55). Je to prvek stránky mimo herní plochu.
// ---------------------------------------------------------------------------

/** Kolečko nastavení v CSS px: kreslené kolečko, plocha pro prst a kroužek podržení. */
export interface SettingsGear {
  readonly gearSize: number;
  readonly hitSize: number;
  /** Horní okraj plochy pro prst od horního okraje okna, i s výřezem. */
  readonly top: number;
  /** Pravý okraj plochy pro prst od pravého okraje okna, i s výřezem. */
  readonly right: number;
  /** Průměr středové čáry kroužku, který se při podržení plní. */
  readonly ringDiameter: number;
  readonly ringStrokeWidth: number;
}

/** Telefon pro kolečko: kratší strana okna pod 500 px (i úzký iPad ve Split View). */
const PHONE_GEAR_MAX_SHORT_SIDE = 500;

/** Na telefonu malé kolečko 48 px, prst má dál plochu 64 px. */
const PHONE_GEAR: Omit<SettingsGear, 'top' | 'right'> = {
  gearSize: 48,
  hitSize: 64,
  ringDiameter: 60,
  ringStrokeWidth: 4,
};
const PHONE_GEAR_INSET = 8;

/** iPad jako dnes (#36): kolečko 76 px, kroužek uvnitř (r 29 a čára 5 ve viewBoxu 64). */
const TABLET_GEAR: Omit<SettingsGear, 'top' | 'right'> = {
  gearSize: 76,
  hitSize: 76,
  ringDiameter: (2 * 29 * 76) / 64,
  ringStrokeWidth: (5 * 76) / 64,
};
const TABLET_GEAR_INSET = 12;

export function settingsGearFor(viewport: Viewport | undefined): SettingsGear {
  if (!isValidViewport(viewport)) {
    return { ...TABLET_GEAR, top: TABLET_GEAR_INSET, right: TABLET_GEAR_INSET };
  }
  const isPhone = Math.min(viewport.width, viewport.height) < PHONE_GEAR_MAX_SHORT_SIDE;
  const sizes = isPhone ? PHONE_GEAR : TABLET_GEAR;
  const inset = isPhone ? PHONE_GEAR_INSET : TABLET_GEAR_INSET;
  return {
    ...sizes,
    top: viewport.safeArea.top + inset,
    right: viewport.safeArea.right + inset,
  };
}
