/**
 * Rozložení obrazovky Porovnávání (#187) podle herní plochy: nahoře řada
 * hvězdiček mezi domečkem a kolečkem, pod ní velký příklad „a ☐ b = c“
 * v jedné řadě a pod příkladem dvě velká tlačítka + a − vedle sebe. Na
 * šířku jsou příklad i tlačítka spolu uprostřed volné plochy, na telefonu
 * na výšku jsou velká tlačítka dole u palce, příklad hned nad nimi
 * a hvězdičky ve 2 řadách po 5. Místo čísla odpovídá počtu jeho číslic,
 * písmo je v celém rozsahu stejné (podle nejširšího příkladu). Míry se
 * počítají z CSS px okna, aby tlačítka měla aspoň 64 px na každém
 * zařízení. Čistý TypeScript bez Phaseru.
 */

import { gearSizingFor } from '../../../shared/logic/settingsGear';
import { isPhoneMode } from '../../../shared/logic/viewportLayout';
import type { GameArea, GameAreaFit } from '../../../shared/logic/viewportLayout';
import type { CompareProblem } from './compareProblems';
import { DEFAULT_COMPARE_SETTINGS } from './compareSettings';
import type { MaxNumber } from './compareSettings';

/** Příklad přes celou volnou plochu okna, i na iPadu. */
export const COMPARE_GAME_AREA_FIT: GameAreaFit = 'fullWindow';

/** Obdélník v herních jednotkách: levý horní roh a velikost. */
export interface Rect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

export interface Point {
  readonly x: number;
  readonly y: number;
}

/** Příklad „a ☐ b = c“: místa pro čísla a „=“ (text na středu) a okénko. */
export interface EquationLayout {
  readonly first: Rect;
  readonly box: Rect;
  /**
   * Ťukací plocha okénka (#187: ťuknutí okénko zhoupne a ukáže tlačítka):
   * okénko, nejméně ale 64 × 64 px kolem jeho středu.
   */
  readonly boxHit: Rect;
  readonly second: Rect;
  readonly equals: Rect;
  readonly result: Rect;
  /** Písmo čísel a „=“, v jednom rozsahu pro všechny příklady stejné. */
  readonly fontSize: number;
  /** Písmo znaménka v okénku. */
  readonly signSize: number;
  readonly boxCornerRadius: number;
}

export interface SignButtonsLayout {
  readonly plus: Rect;
  readonly minus: Rect;
  /** Písmo znaménka v tlačítku. */
  readonly symbolSize: number;
  readonly cornerRadius: number;
}

export interface CompareLayout {
  /** Rozsah, pro který je písmo příkladu spočítané (podle nejširšího příkladu). */
  readonly maxNumber: MaxNumber;
  /** Písmo čísel příkladu, v celém rozsahu stejné, aby mezi příklady neskákalo. */
  readonly equationFontSize: number;
  /** Rozložení příkladu: čísla mají místo podle počtu svých číslic. */
  equationFor(problem: CompareProblem): EquationLayout;
  readonly signButtons: SignButtonsLayout;
  readonly stars: {
    readonly stars: readonly Point[];
    readonly starSize: number;
    readonly detailScale: number;
  };
  /** Herní jednotky na 1 CSS px: tloušťka čar, konfety, zatřesení. */
  readonly unitsPerCssPx: number;
}

/** Mezera mezi rohovým tlačítkem a hrou v CSS px. */
const CORNER_GAP_CSS = 4;
const STARS_PER_ROW_LANDSCAPE = 10;
const STARS_PER_ROW_PORTRAIT = 5;
const STAR_SLOT_FILL = 0.8;
const MAX_STAR_CSS = 48;

/**
 * Míry v CSS px: okraj plochy, strana tlačítka + a −, mezera mezi nimi,
 * mezera mezi příkladem a tlačítky, největší písmo čísel a šířky v řadě
 * příkladu.
 */
interface Sizes {
  readonly margin: number;
  readonly button: number;
  readonly buttonGap: number;
  readonly equationGap: number;
  readonly maxFont: number;
  readonly em: EquationEm;
}

/**
 * Šířky v řadě příkladu jako násobek písma: místo jednomístného
 * a dvoumístného čísla, okénko (čtverec), „=“ a mezera mezi nimi. Výška
 * řady je výška okénka.
 */
interface EquationEm {
  readonly oneDigit: number;
  readonly twoDigits: number;
  readonly box: number;
  readonly equals: number;
  readonly gap: number;
}

/** Na šířku je místa dost: okénko větší a mezery volnější. */
const ROOMY_EM: EquationEm = { oneDigit: 0.8, twoDigits: 1.35, box: 1.2, equals: 0.8, gap: 0.25 };
/** Na výšku je úzko: místa čísel jen o kousek širší než číslice, mezery těsné. */
const TIGHT_EM: EquationEm = { oneDigit: 0.68, twoDigits: 1.28, box: 1.0, equals: 0.66, gap: 0.1 };

const PHONE_LANDSCAPE: Sizes = {
  margin: 8,
  button: 88,
  buttonGap: 32,
  equationGap: 16,
  maxFont: 120,
  em: ROOMY_EM,
};
const PHONE_PORTRAIT: Sizes = {
  margin: 8,
  button: 156,
  buttonGap: 24,
  equationGap: 48,
  maxFont: 120,
  em: TIGHT_EM,
};
const TABLET: Sizes = {
  margin: 24,
  button: 170,
  buttonGap: 64,
  equationGap: 48,
  maxFont: 200,
  em: ROOMY_EM,
};

/** Nejmenší ťukací plocha pro dětský prst (CSS px). */
const MIN_TOUCH_CSS = 64;

/**
 * Nejširší příklad rozsahu: podle něj se počítá písmo, aby se vešel každý
 * příklad a písmo mezi příklady neskákalo („10 − 10 = 0“, „20 − 10 = 10“).
 */
const WIDEST_PROBLEM: Readonly<Record<MaxNumber, CompareProblem>> = {
  10: { a: 10, b: 10, result: 0 },
  20: { a: 20, b: 10, result: 10 },
};

const BOX_CORNER_SHARE = 0.18;
const SIGN_IN_BOX_SHARE = 0.85;
const SYMBOL_IN_BUTTON_SHARE = 0.62;
const BUTTON_CORNER_SHARE = 0.22;

/** Šířka místa pro číslo podle počtu číslic. */
function numberSlotEm(value: number, em: EquationEm): number {
  return String(value).length > 1 ? em.twoDigits : em.oneDigit;
}

/** Šířka celé řady příkladu jako násobek písma. */
function equationWidthEm(problem: CompareProblem, em: EquationEm): number {
  const numbers = [problem.a, problem.b, problem.result].map((value) => numberSlotEm(value, em));
  return numbers.reduce((sum, width) => sum + width, 0) + em.box + em.equals + 4 * em.gap;
}

function sizesFor(area: GameArea): Sizes {
  if (area.mode === 'phonePortrait') {
    return PHONE_PORTRAIT;
  }
  return isPhoneMode(area.mode) ? PHONE_LANDSCAPE : TABLET;
}

/** Strana čtverce v horních rozích, kde je domeček a kolečko (i s mezerou), v CSS px. */
function cornerSizeCss(area: GameArea): number {
  // Mimo telefon se počítá s větším kolečkem iPadu, i když okno může mít menší.
  const { sizes, inset } = gearSizingFor(isPhoneMode(area.mode));
  return inset + sizes.hitSize + CORNER_GAP_CSS;
}

function starRow(area: GameArea, unit: number, corner: number, portrait: boolean) {
  const available = area.width - 2 * corner;
  const perRow = portrait ? STARS_PER_ROW_PORTRAIT : STARS_PER_ROW_LANDSCAPE;
  const rows = portrait ? 2 : 1;
  const slot = available / perRow;
  const rowHeight = corner / rows;
  const starSize = Math.min(slot * STAR_SLOT_FILL, rowHeight * STAR_SLOT_FILL, MAX_STAR_CSS * unit);
  const stars: Point[] = [];
  for (let index = 0; index < STARS_PER_ROW_LANDSCAPE; index += 1) {
    const row = Math.floor(index / perRow);
    const column = index % perRow;
    stars.push({ x: corner + (column + 0.5) * slot, y: (row + 0.5) * rowHeight });
  }
  return { stars, starSize, detailScale: unit };
}

/**
 * Strana tlačítka v herních jednotkách: podle zařízení, v malé ploše
 * menší, ale nikdy pod 64 px. Zaokrouhlí se nahoru na celé jednotky, aby
 * po přepočtu na CSS px nevyšlo kvůli zaokrouhlení méně než 64 px.
 */
function buttonSize(sizes: Sizes, play: Rect, unit: number): number {
  const fitsHeight = (play.height - sizes.equationGap * unit) / 2;
  const fitsWidth = (play.width - sizes.buttonGap * unit) / 2;
  const wanted = Math.min(sizes.button * unit, fitsHeight, fitsWidth);
  return Math.ceil(Math.max(MIN_TOUCH_CSS * unit, wanted));
}

/**
 * Řada příkladu `problem` s písmem `fontSize`, na středu `center.x` a se
 * svislým středem `center.y`.
 */
function equationRow(
  problem: CompareProblem,
  em: EquationEm,
  fontSize: number,
  unit: number,
  center: Point,
): EquationLayout {
  const height = em.box * fontSize;
  const top = center.y - height / 2;
  let left = center.x - (equationWidthEm(problem, em) * fontSize) / 2;
  const slot = (widthEm: number): Rect => {
    const rect = { left, top, width: widthEm * fontSize, height };
    left += (widthEm + em.gap) * fontSize;
    return rect;
  };
  const first = slot(numberSlotEm(problem.a, em));
  const box = slot(em.box);
  const second = slot(numberSlotEm(problem.b, em));
  const equals = slot(em.equals);
  const result = slot(numberSlotEm(problem.result, em));
  const hitSize = Math.max(box.width, MIN_TOUCH_CSS * unit);
  return {
    first,
    box,
    boxHit: {
      left: box.left + (box.width - hitSize) / 2,
      top: box.top + (box.height - hitSize) / 2,
      width: hitSize,
      height: hitSize,
    },
    second,
    equals,
    result,
    fontSize,
    signSize: box.height * SIGN_IN_BOX_SHARE,
    boxCornerRadius: box.height * BOX_CORNER_SHARE,
  };
}

/** Tlačítka + a − vedle sebe na středu `centerX`, horní hranou v `top`. */
function signButtonsRow(
  size: number,
  gap: number,
  centerX: number,
  top: number,
): SignButtonsLayout {
  return {
    plus: { left: centerX - gap / 2 - size, top, width: size, height: size },
    minus: { left: centerX + gap / 2, top, width: size, height: size },
    symbolSize: size * SYMBOL_IN_BUTTON_SHARE,
    cornerRadius: size * BUTTON_CORNER_SHARE,
  };
}

/**
 * Rozložení obrazovky pro herní plochu `area` a rozsah `maxNumber`. Písmo
 * příkladu se počítá podle nejširšího příkladu rozsahu.
 */
export function layoutCompareScreen(
  area: GameArea,
  maxNumber: MaxNumber = DEFAULT_COMPARE_SETTINGS.maxNumber,
): CompareLayout {
  const unit = 1 / area.scale;
  const portrait = area.height > area.width;
  const sizes = sizesFor(area);
  const { em } = sizes;
  const margin = sizes.margin * unit;
  const corner = cornerSizeCss(area) * unit;
  const play: Rect = {
    left: margin,
    top: corner + CORNER_GAP_CSS * unit,
    width: area.width - 2 * margin,
    height: area.height - corner - CORNER_GAP_CSS * unit - margin,
  };
  const button = buttonSize(sizes, play, unit);
  const buttonGap = sizes.buttonGap * unit;
  const equationGap = sizes.equationGap * unit;
  const fontSize = Math.min(
    sizes.maxFont * unit,
    play.width / equationWidthEm(WIDEST_PROBLEM[maxNumber], em),
    (play.height - button - equationGap) / em.box,
  );
  const equationHeight = em.box * fontSize;
  const centerX = play.left + play.width / 2;
  let buttonsTop: number;
  let equationTop: number;
  if (portrait) {
    // Tlačítka dole u palce a příklad hned nad nimi.
    buttonsTop = play.top + play.height - button;
    equationTop = buttonsTop - equationGap - equationHeight;
  } else {
    // Příklad a tlačítka spolu na středu volné plochy.
    const groupHeight = equationHeight + equationGap + button;
    equationTop = play.top + (play.height - groupHeight) / 2;
    buttonsTop = equationTop + equationHeight + equationGap;
  }
  const equationCenter = { x: centerX, y: equationTop + equationHeight / 2 };
  return {
    maxNumber,
    equationFontSize: fontSize,
    equationFor: (problem) => equationRow(problem, em, fontSize, unit, equationCenter),
    signButtons: signButtonsRow(button, buttonGap, centerX, buttonsTop),
    stars: starRow(area, unit, corner, portrait),
    unitsPerCssPx: unit,
  };
}
