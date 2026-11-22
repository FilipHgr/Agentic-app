/**
 * Vzhled mapy postupu (#87, #133–#147), společný všem hrám s hvězdičkami
 * (#193): pozadí map, místa, stopy, pohyby prostředí, podložky zastávek
 * a karta s mapou. Barvy na jednom místě, aby šly hlídat testy (kontrast
 * podle WCAG). Čistý TypeScript bez Phaseru.
 */

import { STAR_STYLE } from './stars';
import { BLUE, SUCCESS_GREEN, TEXT, WHITE } from './theme';
import type { MapLook } from './mapPictureLoading';
import type { MapThemeId } from './progressMap';

/**
 * Zastávka, kam značka ještě nedošla: světle modrá jako tlačítka čísel
 * v Počítání (#52, varianta A3).
 */
export const MAP_PLACE_COLOR = '#E5F0FF';

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
  placeColor: MAP_PLACE_COLOR,
  /** Prošlá zastávka: plná modrá. */
  visitedColor: BLUE,
  visitedBorderColor: BLUE,
  markerBorderColor: WHITE,
  markerLetterColor: WHITE,
  markerLetterWeight: 700,
} as const;

/**
 * Efekty animace mapy (#135, schválené obrázky): jiskřičky za značkou
 * (zlatou stopu nahradily stopy na cestě, #144), modrá svatozář při
 * zastavení a zlatá záře s prstencem kolem slavícího cíle. Jiskřičky jsou bílé a zlaté.
 */
export const PROGRESS_MAP_EFFECTS = {
  sparkleColors: [WHITE, STAR_STYLE.earnedColor],
  sparkleOutlineColor: STAR_STYLE.earnedOutlineColor,
  haloColor: BLUE,
  /** Světlejší zlatá, aby záře nezšedla ani na tmavém vesmíru. */
  goalGlowColor: '#FFE45C',
  goalRingColor: '#F5B800',
} as const;

/**
 * Stopy na cestě mapy (#144, styl A): prošlé zlaté s tmavě hnědým obrysem,
 * neprošlé bílé a poloprůhledné s tmavým obrysem, aby byly vidět i na
 * trávě a písku. Hvězdičky ve vesmíru leží v tmavém kroužku (obrys), aby
 * nesplývaly s hvězdami obrázku.
 */
export const MAP_FOOTPRINT_COLORS = {
  litFill: '#FFD633',
  litOutline: '#3D2600',
  unlitFill: WHITE,
  unlitOutline: TEXT,
  unlitAlpha: 0.6,
  /** Na tmavém vesmíru je bílá výraznější, stačí menší krytí (prošlé pak víc vyniknou). */
  unlitAlphaOnDark: 0.45,
} as const;

/**
 * Pohyby prostředí na mapách (#136): jemné kousky v barvách obrázků map.
 * Kde je víc barev, střídají se po kouscích.
 */
export const MAP_SCENERY_COLORS = {
  wave: WHITE,
  gull: WHITE,
  leaves: ['#E8892B', '#D9502F', '#F2C230', '#B5651D'],
  leafVein: '#7A4A1E',
  butterflyWings: ['#FF7EB6', '#8E7CFF'],
  butterflySpots: '#FFE45C',
  butterflyBody: '#3A3A3C',
  flagPole: '#6B4A2B',
  flagCloths: ['#E5484D', '#2F7DE1'],
  cloud: WHITE,
  bubble: WHITE,
  fish: ['#FF8A3D', '#FFD23F'],
  fishFin: '#E0662A',
  fishEye: TEXT,
  stars: ['#FFE45C', WHITE],
  cometHead: '#FFF3A6',
  cometTail: '#FFD633',
} as const;

/** Barvy podložky místa (#147): plocha, na které leží kruh místa, a okraj. */
interface PlacePadColors {
  readonly fillColor: string;
  readonly outlineColor: string;
}

/**
 * Podložky zastávek podle mapy (#147): s obrázkem a v zástupném vzhledu.
 * Plocha je světlá, aby na ní byl vidět tmavý okraj zhasnutého místa
 * i modré rozsvícené místo; tmavý okraj odliší podložku od obrázku. Ve
 * vesmíru je na tmavém obrázku planetka tmavá s bílým okrajem (bílý okraj
 * míst na ní je vidět). `details` jsou barvy kresby (letokruhy, řasa,
 * krátery), na kontrastu nezávisí.
 */
export const MAP_PLACE_PAD_COLORS: Readonly<
  Record<
    MapThemeId,
    {
      readonly picture: PlacePadColors;
      readonly placeholder: PlacePadColors;
      readonly details: readonly string[];
    }
  >
> = {
  /** Pařez: světlé dřevo řezu, tmavá kůra, letokruhy a kořeny. */
  forest: {
    picture: { fillColor: '#F0D6B0', outlineColor: '#3D2600' },
    placeholder: { fillColor: '#F0D6B0', outlineColor: '#3D2600' },
    details: ['#C49A6C', '#8A5A2B'],
  },
  /** Písečný kopeček: světlý písek s hnědým okrajem, zrnka a šedé kamínky. */
  island: {
    picture: { fillColor: '#FFF0C8', outlineColor: '#5A3A10' },
    placeholder: { fillColor: '#FFF0C8', outlineColor: '#5A3A10' },
    details: ['#E3C27E', '#B8B2A6'],
  },
  /** Kamenná dlaždice: světle šedý kámen se spárou. */
  castle: {
    picture: { fillColor: '#E4E4EA', outlineColor: '#2E2E36' },
    placeholder: { fillColor: '#E4E4EA', outlineColor: '#2E2E36' },
    details: ['#A9A9B4'],
  },
  /** Kámen s řasou: světlý modrošedý kámen, za ním zelené řasy. */
  underwater: {
    picture: { fillColor: '#DCEBEF', outlineColor: '#1F2A36' },
    placeholder: { fillColor: '#DCEBEF', outlineColor: '#1F2A36' },
    details: ['#2E8B57', '#A7C4CC'],
  },
  /**
   * Planetka: na tmavém vesmíru nejsvětlejší fialová, na které je modré
   * rozsvícené místo vidět aspoň 3 : 1 (#3A2D63 by mělo jen 2,1 : 1),
   * s bílým okrajem; bez obrázku světlá. Krátery a zlatý prstenec.
   */
  space: {
    picture: { fillColor: '#1B0E3B', outlineColor: '#FFFFFF' },
    placeholder: { fillColor: '#EFE9FF', outlineColor: '#3A2D63' },
    details: ['#A898E0', '#F5B800'],
  },
};

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
  /**
   * Podložka místa (#147 AC2): největší vnější rozměr jako násobek
   * průměru místa. Klíč u cíle drží odstup od celé podložky.
   */
  placePadMaxShare: 1.5,
} as const;

/**
 * Karta s mapou nad ztmavenou hrou (#145, varianta V2): hra pod kartou
 * ztmavne černou na 40 %, karta má bílý okraj 6 px, zaoblené rohy a jemný
 * stín pod sebou. Míry v CSS px.
 */
export const PROGRESS_MAP_CARD_STYLE = {
  dimColor: '#000000',
  dimAlpha: 0.4,
  borderCss: 6,
  borderColor: WHITE,
  cornerRadiusCss: 24,
  shadowColor: '#000000',
  /** Stín z několika vrstev: každá o `shadowSpreadCss` širší, s krytím `shadowLayerAlpha`. */
  shadowLayers: 6,
  shadowSpreadCss: 3,
  shadowLayerAlpha: 0.06,
  /** O kolik je stín posunutý dolů. */
  shadowOffsetCss: 8,
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
