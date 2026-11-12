/**
 * Světlý vzhled hlavní obrazovky ve stylu Apple (#52, varianta A3).
 * Všechny barvy a písmo hlavní obrazovky na jednom místě, aby šly hlídat
 * testy (přesné hodnoty a kontrast podle WCAG). Scény je jen používají.
 */

import type { TapOutcome } from './answerRound';
import { STARS_PER_SET } from './stars';
import type { StarProgress } from './stars';
import type { MapLook } from './mapPictureLoading';
import type { MapThemeId } from './progressMap';
import {
  BLUE,
  PAGE_BACKGROUND,
  SECONDARY,
  SUCCESS_GREEN,
  TEXT,
  WHITE,
} from '../../../shared/logic/theme';

export const PROBLEM_STYLE = {
  color: TEXT,
  fontWeight: 300,
  questionMarkColor: SECONDARY,
  revealedAnswerColor: SUCCESS_GREEN,
  writtenDigitColor: BLUE,
} as const;

export const KEYPAD_BUTTON_STYLE = {
  background: '#E5F0FF',
  borderColor: '#B8D6FF',
  borderWidth: 2,
  digitColor: BLUE,
  digitFontWeight: 700,
} as const;

/**
 * Tlačítko nápovědy (#84, varianta C): světle žlutý kruh se žlutým okrajem
 * a uvnitř žárovka (žlutá baňka s paprsky, šedá patice) s malým tmavým „?“.
 * Na první pohled se liší od modrého číselníku.
 */
export const HINT_BUTTON_STYLE = {
  background: '#FFF6D6',
  borderColor: '#FFD60A',
  borderWidth: 2,
  bulbColor: '#FFCC00',
  rayColor: '#FFCC00',
  baseColor: '#8E8E93',
  symbolColor: TEXT,
  symbolFontWeight: 700,
  shadowAlpha: 0.08,
} as const;

export type AnswerButtonState = 'idle' | TapOutcome;

export interface AnswerButtonLook {
  readonly background: string;
  readonly borderColor: string;
  readonly borderWidth: number;
  readonly digitColor: string;
  readonly interactive: boolean;
}

const IDLE_BUTTON: AnswerButtonLook = {
  background: KEYPAD_BUTTON_STYLE.background,
  borderColor: KEYPAD_BUTTON_STYLE.borderColor,
  borderWidth: KEYPAD_BUTTON_STYLE.borderWidth,
  digitColor: KEYPAD_BUTTON_STYLE.digitColor,
  interactive: true,
};

const CORRECT_BUTTON: AnswerButtonLook = {
  background: SUCCESS_GREEN,
  borderColor: SUCCESS_GREEN,
  borderWidth: KEYPAD_BUTTON_STYLE.borderWidth,
  digitColor: WHITE,
  interactive: true,
};

/** Vzhled tlačítka číselníku; chyba nic nebarví, tlačítko se jen zatřese. */
export function answerButtonLook(state: AnswerButtonState): AnswerButtonLook {
  return state === 'correct' ? CORRECT_BUTTON : IDLE_BUTTON;
}

export const STAR_STYLE = {
  earnedColor: '#FFCC00',
  earnedOutlineColor: '#A67C00',
  earnedOutlineWidth: 1.5,
  emptyColor: '#D2D2D7',
} as const;

export interface StarLook {
  readonly fill: string;
  readonly outlineColor: string | null;
  readonly outlineWidth: number;
}

/** Hvězdičky v řadě zleva: získané zlaté s obrysem, ostatní šedé. */
export function starLooks(progress: StarProgress): readonly StarLook[] {
  return Array.from({ length: STARS_PER_SET }, (_, index) =>
    index < progress.earned
      ? {
          fill: STAR_STYLE.earnedColor,
          outlineColor: STAR_STYLE.earnedOutlineColor,
          outlineWidth: STAR_STYLE.earnedOutlineWidth,
        }
      : { fill: STAR_STYLE.emptyColor, outlineColor: null, outlineWidth: 0 },
  );
}

export const HINT_DOT_STYLE = {
  /** Každé číslo příkladu má svou barvu (#30). */
  groupColors: ['#FFCC00', '#5AC8FA'],
  crossedOutColor: '#D2D2D7',
  crossColor: TEXT,
  countedRingColor: TEXT,
  countedNumberColor: TEXT,
} as const;

export const WRITING_PAD_STYLE = {
  background: WHITE,
  borderColor: SECONDARY,
  borderWidth: 2,
  inkColor: TEXT,
} as const;

export const CONFIRM_BUTTON_STYLE = {
  background: SUCCESS_GREEN,
  tickColor: WHITE,
  disabledAlpha: 0.35,
} as const;

export const CLEAR_ICON_COLOR = SECONDARY;

// ---------------------------------------------------------------------------
// Nastavení, průvodce a oslava (#53, část b světlého vzhledu).
// ---------------------------------------------------------------------------

/** Pozadí panelu nastavení i průvodce: stejné jako hra, neprůhledné. */
export const SETTINGS_PANEL_STYLE = { background: PAGE_BACKGROUND, backgroundAlpha: 1 } as const;

export interface SettingsOptionLook {
  readonly background: string;
  readonly borderColor: string;
  readonly borderWidth: number;
  readonly textColor: string;
  readonly iconColor: string;
}

/** Nevybraná volba jako číselník, vybraná plná modrá s bílým textem. */
export const SETTINGS_OPTION_STYLE: {
  readonly unselected: SettingsOptionLook;
  readonly selected: SettingsOptionLook;
} = {
  unselected: {
    background: KEYPAD_BUTTON_STYLE.background,
    borderColor: KEYPAD_BUTTON_STYLE.borderColor,
    borderWidth: KEYPAD_BUTTON_STYLE.borderWidth,
    textColor: BLUE,
    iconColor: BLUE,
  },
  selected: {
    background: BLUE,
    borderColor: BLUE,
    borderWidth: KEYPAD_BUTTON_STYLE.borderWidth,
    textColor: WHITE,
    iconColor: WHITE,
  },
};

export function settingsOptionLook(selected: boolean): SettingsOptionLook {
  return selected ? SETTINGS_OPTION_STYLE.selected : SETTINGS_OPTION_STYLE.unselected;
}

/** Popisky řad nastavení: druhotná šedá jako popisky skupin v iOS. */
export const SETTINGS_LABEL_COLOR = '#6E6E73';

export const GUIDE_STYLE = {
  textColor: TEXT,
  buttonBackground: KEYPAD_BUTTON_STYLE.background,
  buttonBorderColor: KEYPAD_BUTTON_STYLE.borderColor,
  buttonBorderWidth: KEYPAD_BUTTON_STYLE.borderWidth,
  buttonTextColor: BLUE,
  speakerIconColor: BLUE,
  startPlayingBackground: SUCCESS_GREEN,
  startPlayingTextColor: WHITE,
  frameColor: BLUE,
  frameLineWidth: 4,
} as const;

/** Konfety oslavy: každá barva je na světlém pozadí vidět (aspoň 3 : 1). */
export const CONFETTI_COLORS: readonly string[] = [
  BLUE,
  SUCCESS_GREEN,
  '#FF3B30',
  '#AF52DE',
  '#C93400',
  STAR_STYLE.earnedOutlineColor,
];

// ---------------------------------------------------------------------------
// Mapa postupu (#87, #133, #134): obrázek prostředí, bez něj zástupný vzhled.
// ---------------------------------------------------------------------------

/**
 * Pozadí každé z 5 map (#133 AC6): jemné pastelové barvy podle prostředí,
 * aby dítě poznalo, že přišla jiná mapa, a značka i místa byly dobře vidět.
 * S obrázkem (#134) je to zástupný vzhled, když obrázek ještě není stažený.
 */
export const PROGRESS_MAP_BACKGROUNDS: Readonly<Record<MapThemeId, string>> = {
  /** Ostrov s pokladem: písek. */
  island: '#FBEFCF',
  /** Les: světle zelená. */
  forest: '#DCEFD6',
  /** Hrad: světle růžová. */
  castle: '#F5E1E4',
  /** Podmořský svět: světle tyrkysová. */
  underwater: '#D4ECF4',
  /** Vesmír: světle fialová. */
  space: '#E4DFF5',
};

export const PROGRESS_MAP_STYLE = {
  /** Zastávka, kam značka ještě nedošla: jako tlačítko číselníku (okraj podle mapy). */
  placeColor: KEYPAD_BUTTON_STYLE.background,
  /** Prošlá zastávka: plná modrá. */
  visitedColor: BLUE,
  visitedBorderColor: BLUE,
  markerBorderColor: WHITE,
  markerLetterColor: WHITE,
  markerLetterWeight: 700,
} as const;

/**
 * Efekty animace mapy (#135, schválené obrázky): zlatá zářící stopa za
 * značkou s jiskřičkami, modrá svatozář při zastavení a zlatá záře
 * s prstencem kolem slavícího cíle. Jiskřičky jsou bílé a zlaté.
 */
export const PROGRESS_MAP_EFFECTS = {
  trailGlowColor: '#FFD633',
  trailCoreColor: '#FFF3A6',
  sparkleColors: [WHITE, STAR_STYLE.earnedColor],
  sparkleOutlineColor: STAR_STYLE.earnedOutlineColor,
  haloColor: BLUE,
  /** Světlejší zlatá, aby záře nezšedla ani na tmavém vesmíru. */
  goalGlowColor: '#FFE45C',
  goalRingColor: '#F5B800',
} as const;

/** Šířka okraje jako díl průměru: místo, cíl a značka hráče. */
export const PROGRESS_MAP_SHAPE = {
  placeBorderShare: 0.08,
  goalBorderShare: 0.14,
  markerBorderShare: 0.07,
  /**
   * Symbol cíle stojí na světlém kruhovém podkladu (kontrola UX #134), aby
   * nesplýval s obrázkem. Podklad je o tolik větší než značka, symbol
   * zabere tento díl jeho průměru a okraj tento díl průměru podkladu.
   */
  goalBadgeToMarker: 1.2,
  goalSymbolShare: 0.75,
  goalBadgeBorderShare: 0.06,
  /**
   * Slavící cíl (#135 AC3): kolem zvětšeného podkladu zlatý prstenec a záře.
   * O tento díl průměru zvětšeného podkladu je slavící cíl i se září větší.
   */
  goalGlowShare: 0.3,
} as const;

/** Barvy cesty a okraje místa, kam značka ještě nedošla (#134). */
export interface ProgressMapStyle {
  readonly pathColor: string;
  readonly placeBorderColor: string;
  /** Cíl má zelený okraj, aby byl vidět i před dojitím; na obrázku tmavší nebo světlejší. */
  readonly goalBorderColor: string;
  /** Světlý kruhový podklad symbolu cíle a jeho okraj. */
  readonly goalBadgeColor: string;
  readonly goalBadgeBorderColor: string;
}

/** Na zástupném pastelovém pozadí stačí šedá cesta a modrošedý okraj míst. */
const PLACEHOLDER_MAP_STYLE: ProgressMapStyle = {
  pathColor: '#6E6E73',
  placeBorderColor: '#4A6A99',
  goalBorderColor: SUCCESS_GREEN,
  goalBadgeColor: WHITE,
  goalBadgeBorderColor: '#4A6A99',
};

/** Na světlých a pestrých obrázcích je cesta i okraj tmavá, zelená cíle tmavší. */
const DARK_ON_PICTURE: ProgressMapStyle = {
  pathColor: TEXT,
  placeBorderColor: TEXT,
  goalBorderColor: '#146C2E',
  goalBadgeColor: WHITE,
  goalBadgeBorderColor: TEXT,
};

/** Na tmavém obrázku vesmíru je cesta i okraj bílá, zelená cíle světlejší. */
const LIGHT_ON_PICTURE: ProgressMapStyle = {
  pathColor: WHITE,
  placeBorderColor: WHITE,
  goalBorderColor: '#34C759',
  goalBadgeColor: WHITE,
  goalBadgeBorderColor: WHITE,
};

/** Obrázky, na kterých je potřeba světlá cesta, protože jsou tmavé. */
const DARK_PICTURES: ReadonlySet<MapThemeId> = new Set<MapThemeId>(['space']);

/**
 * Barvy mapy `theme` podle vzhledu: cesta a okraj nenavštívených míst mají
 * vůči obrázku i zástupné barvě kontrast aspoň 3 : 1 (kontrola #133).
 */
export function progressMapStyleFor(theme: MapThemeId, look: MapLook): ProgressMapStyle {
  if (look === 'placeholder') {
    return PLACEHOLDER_MAP_STYLE;
  }
  return DARK_PICTURES.has(theme) ? LIGHT_ON_PICTURE : DARK_ON_PICTURE;
}
