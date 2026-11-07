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
import { layoutPhoneLandscapeGuide, layoutPhonePortraitGuide } from './phoneGuideLayout';
import type { GuideStepParts } from './phoneGuideLayout';
import { layoutPhoneLandscapeSettings, layoutPhonePortraitSettings } from './phoneSettingsLayout';
import type { PhonePlanRequest } from './phoneLayout';
import {
  isPortraitLayout,
  layoutPhonePortraitHint,
  layoutPhonePortraitScreen,
  layoutPhonePortraitWritingScreen,
} from './phonePortraitLayout';
import { areaInUnits, cssSizeOf, dotInUnits, phoneParts, slotInUnits } from './phoneScreenParts';
import type { PhoneParts } from './phoneScreenParts';
import type { GameProgress } from './progress';
import {
  HINT_DOT_HIT_SIZE,
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
import { layoutGuideStep, stepMessage } from './setupGuide';
import type { GuideState, GuideStep } from './setupGuide';
import type { TwoBoxRound } from './twoBoxWriting';
import { clearWriting } from './writingRound';
import type { WritingRound } from './writingRound';
import {
  TABLET_GAME_HEIGHT,
  TABLET_GAME_WIDTH,
  isPhoneMode,
} from '../../../shared/logic/viewportLayout';
import type { GameArea, GameSize, LayoutMode } from '../../../shared/logic/viewportLayout';

export type { Region } from './phoneHint';
export type { DeviceGuideMessage } from './phoneGuideLayout';
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
// Velikosti prvků, které se liší mezi iPadem a telefonem
// ---------------------------------------------------------------------------

/** Velikosti, které scéna potřebuje k rozložení navíc (v herních jednotkách). */
export interface DeviceSizes {
  readonly starSize: number;
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
 * Rozložení, ze kterého se kreslí hvězdičky a příklad. Na telefonu (na
 * šířku #54 i na výšku #56) se psaní rozvrhne jinak než číselník, proto
 * se bere rozložení se skutečným ovládáním `answerLayout`, aby příklad
 * nezasahoval do okének a teček nápovědy. Na
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

/**
 * Panel na iPadu (#78): když část plochy leží pod stavovým řádkem nebo
 * lištou domů (aplikace spuštěná z plochy), panel se zmenší a dá na střed
 * zbylé části. Bez zakrytých okrajů (záložka Safari, ostatní okna) je to
 * přesně `panelPlacement`, rozložení se nemění. Telefon má vlastní
 * rozložení ve volné ploše a zmenšené zobrazení se nemění.
 */
function tabletPanelPlacement(area: GameArea): PanelPlacement {
  const covered = area.coveredEdges;
  if (area.mode !== 'tablet' || covered === undefined) {
    return panelPlacement(area);
  }
  const free = {
    width: area.width - covered.left - covered.right,
    height: area.height - covered.top - covered.bottom,
  };
  const inFree = panelPlacement(free);
  return { scale: inFree.scale, x: covered.left + inFree.x, y: covered.top + inFree.y };
}

/** Nastavení otevřené kolečkem pro danou herní plochu (#59). */
export interface DeviceSettingsLayout extends SettingsLayout {
  readonly mode: LayoutMode;
  /** Kam a jak zmenšené se rozložení na herní plochu dá. */
  readonly placement: PanelPlacement;
}

/** Telefonní rozložení (nastavení i průvodce) je přímo v jednotkách herní plochy, nic se nezmenšuje. */
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
    placement: tabletPanelPlacement(area),
  };
}

/** Krok průvodce nastavením pro danou herní plochu (#60). */
export interface DeviceGuideLayout extends GuideStepParts {
  readonly mode: LayoutMode;
  /** Kam a jak zmenšené se rozložení na herní plochu dá. */
  readonly placement: PanelPlacement;
}

/**
 * Průvodce nastavením: na telefonu na šířku a na výšku vlastní rozložení
 * s velkými volbami a zalomenou radou (#60), jinde dnešní průvodce
 * 1024 × 768 zmenšený na herní plochu (iPad beze změny).
 */
export function layoutDeviceGuideStep(area: GameArea, step: GuideStep): DeviceGuideLayout {
  if (area.mode === 'phoneLandscape') {
    return {
      ...layoutPhoneLandscapeGuide(area, step),
      mode: area.mode,
      placement: PHONE_SETTINGS_PLACEMENT,
    };
  }
  if (area.mode === 'phonePortrait') {
    return {
      ...layoutPhonePortraitGuide(area, step),
      mode: area.mode,
      placement: PHONE_SETTINGS_PLACEMENT,
    };
  }
  return { ...todayGuideStep(step), mode: area.mode, placement: tabletPanelPlacement(area) };
}

/** Dnešní krok průvodce na ploše 1024 × 768: rada dva řádky ze scénáře na středu. */
function todayGuideStep(step: GuideStep): GuideStepParts {
  const settings = layoutSettingsPanel(TABLET_GAME_WIDTH, TABLET_GAME_HEIGHT);
  const guide = layoutGuideStep(step, TABLET_GAME_WIDTH, TABLET_GAME_HEIGHT);
  return {
    ...guide,
    rows: settings.rows,
    optionLook: settings.optionLook,
    message: {
      ...guide.message,
      lines: [...stepMessage(step)],
      exactLineHeight: false,
      verticalAlign: 'middle',
    },
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
 * nastavení i průvodce zůstanou. Okénka na psaní se vyprázdní
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
