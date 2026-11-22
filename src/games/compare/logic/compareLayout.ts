/**
 * Rozložení obrazovky Porovnávání (#187) podle herní plochy: nahoře řada
 * hvězdiček mezi domečkem a kolečkem, pod ní velký příklad „a ☐ b = c“
 * v jedné řadě a pod příkladem dvě velká tlačítka + a − vedle sebe. Na
 * šířku jsou příklad i tlačítka spolu uprostřed volné plochy, na telefonu
 * na výšku jsou velká tlačítka dole u palce, příklad hned nad nimi
 * a hvězdičky ve 2 řadách po 5. Místo čísla odpovídá počtu jeho číslic,
 * písmo je v celém rozsahu stejné (podle nejširšího příkladu). Míry se
 * počítají z CSS px okna, aby tlačítka měla aspoň 64 px na každém
 * zařízení.
 *
 * Psaní prstem (#188): plocha na psaní má aspoň 200 × 200 px v každém
 * okně. Kde se vedle ní čísla vejdou aspoň 64 px velká, je to okénko
 * příkladu (iPad, telefon na šířku), jinak samostatná plocha pod velkým
 * příkladem (telefon na výšku). Smazání (vlevo) a ✓ (vpravo) jsou místo
 * + a − jako v Počítání: pod plochou, nebo vedle příkladu, kde se pod
 * něj nevejdou. Čistý TypeScript bez Phaseru.
 */

import { gearSizingFor } from '../../../shared/logic/settingsGear';
import {
  WRITING_AREA_CORNER_RADIUS,
  WRITTEN_LABEL_HEIGHT_SHARE,
} from '../../../shared/logic/writingBox';
import { isPhoneMode } from '../../../shared/logic/viewportLayout';
import type { GameArea, GameAreaFit } from '../../../shared/logic/viewportLayout';
import type { ArithmeticProblem, ProblemKind, RelationProblem } from './compareProblems';
import { DEFAULT_COMPARE_SETTINGS } from './compareSettings';
import type { AnswerInput, CompareSettings, MaxNumber } from './compareSettings';

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

/**
 * Smazání a ✓ u okénka na psaní (#188) pro příklady `P` („a ☐ b = c“,
 * od #191 i „a ☐ b“).
 */
export interface WritingButtonsLayout<P = ArithmeticProblem> {
  /**
   * Píše se přímo do okénka příkladu (`true`), nebo do samostatné plochy
   * pod příkladem, a rozpoznané znaménko se ukáže i v okénku příkladu.
   */
  readonly padInProblem: boolean;
  /** Plocha na psaní pro příklad (při psaní do okénka je to okénko příkladu). */
  pad(problem: P): Rect;
  readonly clear: Rect;
  readonly confirm: Rect;
  /** Herní jednotky na 1 CSS px pro tloušťku tahů a okrajů okénka. */
  readonly detailScale: number;
}

/** Co mají obě rozložení „a ☐ b = c“ společné (ťukání i psaní). */
interface CompareLayoutBase {
  /** Rozložení pro příklady „a ☐ b = c“ (#190: odlišení od „a ☐ b“). */
  readonly problemKind: 'arithmetic';
  /** Rozsah, pro který je písmo příkladu spočítané (podle nejširšího příkladu). */
  readonly maxNumber: MaxNumber;
  /** Písmo čísel příkladu, v celém rozsahu stejné, aby mezi příklady neskákalo. */
  readonly equationFontSize: number;
  /** Rozložení příkladu: čísla mají místo podle počtu svých číslic. */
  equationFor(problem: ArithmeticProblem): EquationLayout;
  readonly stars: {
    readonly stars: readonly Point[];
    readonly starSize: number;
    readonly detailScale: number;
  };
  /** Herní jednotky na 1 CSS px: tloušťka čar, konfety, zatřesení. */
  readonly unitsPerCssPx: number;
}

/** Rozložení při ťukání: pod příkladem tlačítka + a −. */
export interface CompareLayout extends CompareLayoutBase {
  readonly signButtons: SignButtonsLayout;
  readonly writing: null;
}

/** Rozložení při psaní (#188): plocha na psaní, smazání a ✓, žádná tlačítka + a −. */
export interface CompareWritingLayout extends CompareLayoutBase {
  readonly signButtons: null;
  readonly writing: WritingButtonsLayout;
}

/** Rozložení obrazovky podle způsobu odpovědi. */
export type CompareScreenLayout = CompareLayout | CompareWritingLayout;

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
const WIDEST_PROBLEM: Readonly<Record<MaxNumber, ArithmeticProblem>> = {
  10: { kind: 'arithmetic', a: 10, b: 10, result: 0 },
  20: { kind: 'arithmetic', a: 20, b: 10, result: 10 },
};

const BOX_CORNER_SHARE = 0.18;
const SIGN_IN_BOX_SHARE = 0.85;
const SYMBOL_IN_BUTTON_SHARE = 0.62;
const BUTTON_CORNER_SHARE = 0.22;

/** Okénko na psaní má v každém okně aspoň 200 × 200 CSS px (#188 AC5). */
export const MIN_WRITING_BOX_CSS = 200;

/**
 * Míry při psaní v CSS px: chtěná strana okénka, strana smazání a ✓,
 * mezera mezi nimi a mezera mezi příkladem a tlačítky. Při `beside` jsou
 * tlačítka vedle příkladu, jinak pod ním, když se tam vejdou.
 */
interface WritingSizes {
  readonly box: number;
  readonly button: number;
  readonly buttonGap: number;
  readonly equationGap: number;
  readonly beside: boolean;
}

const TABLET_WRITING: WritingSizes = {
  box: 300,
  button: 120,
  buttonGap: 64,
  equationGap: 40,
  beside: false,
};
const PHONE_LANDSCAPE_WRITING: WritingSizes = {
  box: 240,
  button: 72,
  buttonGap: 16,
  equationGap: 16,
  beside: true,
};
const PHONE_PORTRAIT_WRITING: WritingSizes = {
  box: MIN_WRITING_BOX_CSS,
  button: 104,
  buttonGap: 32,
  equationGap: 32,
  beside: false,
};

/** Šířka místa pro číslo podle počtu číslic. */
function numberSlotEm(value: number, em: EquationEm): number {
  return String(value).length > 1 ? em.twoDigits : em.oneDigit;
}

/** Šířka celé řady příkladu jako násobek písma. */
function equationWidthEm(problem: ArithmeticProblem, em: EquationEm): number {
  return numbersWidthEm(problem, em) + em.box;
}

/** Šířka řady příkladu bez okénka (čísla, „=“ a mezery) jako násobek písma. */
function numbersWidthEm(problem: ArithmeticProblem, em: EquationEm): number {
  const numbers = [problem.a, problem.b, problem.result].map((value) => numberSlotEm(value, em));
  return numbers.reduce((sum, width) => sum + width, 0) + em.equals + 4 * em.gap;
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
 * svislým středem `center.y`. Okénko je čtverec podle písma, při psaní
 * okénko na psaní o straně `writingBox`.
 */
function equationRow(
  problem: ArithmeticProblem,
  em: EquationEm,
  fontSize: number,
  unit: number,
  center: Point,
  writingBox: number | null = null,
): EquationLayout {
  const boxSize = writingBox ?? em.box * fontSize;
  const height = boxSize;
  const top = center.y - height / 2;
  let left = center.x - (numbersWidthEm(problem, em) * fontSize + boxSize) / 2;
  const slot = (width: number): Rect => {
    const rect = { left, top, width, height };
    left += width + em.gap * fontSize;
    return rect;
  };
  const first = slot(numberSlotEm(problem.a, em) * fontSize);
  const box = slot(boxSize);
  const second = slot(numberSlotEm(problem.b, em) * fontSize);
  const equals = slot(em.equals * fontSize);
  const result = slot(numberSlotEm(problem.result, em) * fontSize);
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
    // Při psaní je znaménko stejně velké jako rozpoznané znaménko v okénku.
    signSize: box.height * (writingBox === null ? SIGN_IN_BOX_SHARE : WRITTEN_LABEL_HEIGHT_SHARE),
    // Při psaní má zelené okénko stejné rohy jako plocha na psaní pod ním.
    boxCornerRadius:
      writingBox === null ? box.height * BOX_CORNER_SHARE : WRITING_AREA_CORNER_RADIUS * unit,
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
export function layoutCompareScreen(area: GameArea, maxNumber?: MaxNumber): CompareLayout;
export function layoutCompareScreen(
  area: GameArea,
  maxNumber: MaxNumber,
  answerInput: AnswerInput,
): CompareScreenLayout;
export function layoutCompareScreen(
  area: GameArea,
  maxNumber: MaxNumber = DEFAULT_COMPARE_SETTINGS.maxNumber,
  answerInput: AnswerInput = DEFAULT_COMPARE_SETTINGS.answerInput,
): CompareScreenLayout {
  const unit = 1 / area.scale;
  const portrait = area.height > area.width;
  const sizes = sizesFor(area);
  const corner = cornerSizeCss(area) * unit;
  const play = playArea(area, sizes, unit, corner);
  if (answerInput === 'writing') {
    return layoutWritingScreen(area, maxNumber, play, corner).arithmetic;
  }
  const { em } = sizes;
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
    problemKind: 'arithmetic',
    maxNumber,
    writing: null,
    equationFontSize: fontSize,
    equationFor: (problem) => equationRow(problem, em, fontSize, unit, equationCenter),
    signButtons: signButtonsRow(button, buttonGap, centerX, buttonsTop),
    stars: starRow(area, unit, corner, portrait),
    unitsPerCssPx: unit,
  };
}

/** Volná plocha pod rohy (domeček, hvězdičky, kolečko) s okrajem. */
function playArea(area: GameArea, sizes: Sizes, unit: number, corner: number): Rect {
  const margin = sizes.margin * unit;
  return {
    left: margin,
    top: corner + CORNER_GAP_CSS * unit,
    width: area.width - 2 * margin,
    height: area.height - corner - CORNER_GAP_CSS * unit - margin,
  };
}

function writingSizesFor(area: GameArea): WritingSizes {
  if (area.mode === 'phonePortrait') {
    return PHONE_PORTRAIT_WRITING;
  }
  return isPhoneMode(area.mode) ? PHONE_LANDSCAPE_WRITING : TABLET_WRITING;
}

/** Čtvercové tlačítko o straně `size` se středem `center`. */
function squareAt(center: Point, size: number): Rect {
  return { left: center.x - size / 2, top: center.y - size / 2, width: size, height: size };
}

/** Mezera mezi čísly a okénkem na psaní v řadě příkladu aspoň takhle velká (CSS px). */
export const MIN_NUMBER_GAP_CSS = 8;

/** Mezer v nejdelší řadě „a ☐ b = c“ (mezi pěti částmi). */
const ROW_GAP_COUNT = 4;

/** Čísla příkladu při psaní na zařízení aspoň takhle velká (CSS px), jinak přijde plocha pod příkladem. */
export const MIN_WRITING_NUMBER_FONT_CSS = 64;

/** Míry v herních jednotkách společné oběma rozložením psaní. */
interface WritingMetrics {
  readonly area: GameArea;
  readonly maxNumber: MaxNumber;
  readonly play: Rect;
  readonly corner: number;
  readonly unit: number;
  readonly portrait: boolean;
  readonly sizes: Sizes;
}

/**
 * Rozložení při psaní (#188 AC5). Když se čísla vedle okénka na psaní
 * vejdou aspoň 64 px velká (iPad, telefon na šířku), píše se přímo do
 * okénka příkladu. Na výšku, nebo když by čísla byla menší, je příklad
 * velký jako při ťukání a pod ním samostatná plocha na psaní aspoň
 * 200 px, jako v Počítání na výšku; smazání a ✓ jsou pod ní u palce.
 */
function layoutWritingScreen(
  area: GameArea,
  maxNumber: MaxNumber,
  play: Rect,
  corner: number,
): WritingScreens {
  const unit = 1 / area.scale;
  const metrics: WritingMetrics = {
    area,
    maxNumber,
    play,
    corner,
    unit,
    portrait: area.height > area.width,
    sizes: sizesFor(area),
  };
  // Na výšku je plocha pod příkladem vždy, když se vejde (jako v Počítání na výšku).
  const below = metrics.portrait ? layoutWritingBelow(metrics) : null;
  if (below !== null) {
    return below;
  }
  const inline = layoutWritingInBox(metrics);
  if (inline.arithmetic.equationFontSize >= MIN_WRITING_NUMBER_FONT_CSS * unit) {
    return inline;
  }
  return layoutWritingBelow(metrics) ?? inline;
}

/**
 * Psaní přímo do okénka příkladu: okénko aspoň 200 px, čísla podle zbylé
 * šířky, smazání vlevo a ✓ vpravo pod příkladem, nebo vedle něj, když se
 * pod něj nevejdou.
 */
function layoutWritingInBox(metrics: WritingMetrics): WritingScreens {
  const { area, maxNumber, play, corner, unit, portrait, sizes } = metrics;
  // Na telefonu těsnější mezery, aby čísla vedle velkého okénka zůstala velká.
  const baseEm = isPhoneMode(area.mode) ? TIGHT_EM : sizes.em;
  const minBox = MIN_WRITING_BOX_CSS * unit;
  const wanted = writingSizesFor(area);
  const fitsBelow =
    play.height >= minBox + (wanted.equationGap + Math.max(MIN_TOUCH_CSS, wanted.button)) * unit;
  // Malé okno, kam se tlačítka pod okénko nevejdou: menší tlačítka vedle jako na telefonu.
  const writing = wanted.beside || fitsBelow ? wanted : PHONE_LANDSCAPE_WRITING;
  const beside = writing.beside;
  const button = Math.ceil(Math.max(MIN_TOUCH_CSS * unit, writing.button * unit));
  const buttonGap = writing.buttonGap * unit;
  const equationGap = writing.equationGap * unit;
  const boxRoom = beside ? play.height : play.height - equationGap - button;
  const rowRoom = beside ? play.width - 2 * (button + equationGap) : play.width;
  const widest = WIDEST_PROBLEM[maxNumber];
  const numbersEm = numbersWidthEm(widest, baseEm);
  // Čísla bez mezer; mezery mají aspoň 8 px, aby se čísla nelepila na okénko.
  const slotsEm = numbersWidthEm(widest, { ...baseEm, gap: 0 });
  // Na telefonu jsou mezery těsné (TIGHT_EM): aspoň 8 px; jinde jsou volné podle písma.
  const minGap = isPhoneMode(area.mode) ? MIN_NUMBER_GAP_CSS * unit : 0;
  const gapsWidth = (fontSize: number) => ROW_GAP_COUNT * Math.max(baseEm.gap * fontSize, minGap);
  const minFont = MIN_WRITING_NUMBER_FONT_CSS * unit;
  // Okénko se zmenší (nejvýš na 200 px), aby čísla vedle něj zůstala čitelná.
  const roomForBox = rowRoom - slotsEm * minFont - gapsWidth(minFont);
  const box = Math.ceil(Math.max(minBox, Math.min(writing.box * unit, boxRoom, roomForBox)));
  const fontSize = Math.min(
    sizes.maxFont * unit,
    box / baseEm.box,
    (rowRoom - box) / numbersEm,
    (rowRoom - box - ROW_GAP_COUNT * minGap) / slotsEm,
  );
  const em: EquationEm = { ...baseEm, gap: Math.max(baseEm.gap, minGap / fontSize) };
  const centerX = play.left + play.width / 2;
  let rowCenterY: number;
  let buttonsCenterY: number;
  if (beside) {
    rowCenterY = play.top + play.height / 2;
    buttonsCenterY = rowCenterY;
  } else if (portrait) {
    // Tlačítka dole u palce a příklad hned nad nimi.
    buttonsCenterY = play.top + play.height - button / 2;
    rowCenterY = buttonsCenterY - button / 2 - equationGap - box / 2;
  } else {
    const groupHeight = box + equationGap + button;
    rowCenterY = play.top + (play.height - groupHeight) / 2 + box / 2;
    buttonsCenterY = rowCenterY + box / 2 + equationGap + button / 2;
  }
  const rowCenter = { x: centerX, y: rowCenterY };
  const equationFor = (problem: ArithmeticProblem): EquationLayout =>
    equationRow(problem, em, fontSize, unit, rowCenter, box);
  let clearCenter: Point;
  let confirmCenter: Point;
  if (beside) {
    // Vedle nejširšího příkladu, aby tlačítka mezi příklady neposkakovala.
    const widest = equationFor(WIDEST_PROBLEM[maxNumber]);
    const rowLeft = widest.first.left;
    const rowRight = widest.result.left + widest.result.width;
    clearCenter = { x: rowLeft - equationGap - button / 2, y: buttonsCenterY };
    confirmCenter = { x: rowRight + equationGap + button / 2, y: buttonsCenterY };
  } else {
    clearCenter = { x: centerX - buttonGap / 2 - button / 2, y: buttonsCenterY };
    confirmCenter = { x: centerX + buttonGap / 2 + button / 2, y: buttonsCenterY };
  }
  const clear = squareAt(clearCenter, button);
  const confirm = squareAt(confirmCenter, button);
  const stars = starRow(area, unit, corner, portrait);
  // „a ☐ b“ (#191): stejné okénko, písmo i tlačítka, jen bez „= c“.
  const relationFor = (problem: RelationProblem): RelationEquationLayout =>
    relationRow(problem, em, fontSize, unit, rowCenter, box);
  return {
    arithmetic: {
      problemKind: 'arithmetic',
      maxNumber,
      writing: {
        padInProblem: true,
        // Okénko příkladu je stejné pro všechny příklady rozsahu, jen se posouvá s čísly.
        pad: (problem) => equationFor(problem).box,
        clear,
        confirm,
        detailScale: unit,
      },
      equationFontSize: fontSize,
      equationFor,
      signButtons: null,
      stars,
      unitsPerCssPx: unit,
    },
    relation: {
      problemKind: 'relation',
      maxNumber,
      writing: {
        padInProblem: true,
        pad: (problem) => relationFor(problem).box,
        clear,
        confirm,
        detailScale: unit,
      },
      equationFontSize: fontSize,
      equationFor: relationFor,
      relationButtons: null,
      stars,
      unitsPerCssPx: unit,
    },
  };
}

/**
 * Příklad velký jako při ťukání, pod ním plocha na psaní a pod ní smazání
 * a ✓ u palce. `null`, když se pod sebe nevejdou s čísly aspoň 64 px.
 */
function layoutWritingBelow(metrics: WritingMetrics): WritingScreens | null {
  const { area, maxNumber, play, corner, unit, portrait, sizes } = metrics;
  const { em } = sizes;
  const writing = PHONE_PORTRAIT_WRITING;
  const button = Math.ceil(Math.max(MIN_TOUCH_CSS * unit, writing.button * unit));
  const buttonGap = writing.buttonGap * unit;
  const gap = writing.equationGap * unit;
  const minPad = MIN_WRITING_BOX_CSS * unit;
  const widthFont = Math.min(
    sizes.maxFont * unit,
    play.width / equationWidthEm(WIDEST_PROBLEM[maxNumber], em),
  );
  const heightFont = (play.height - button - minPad - 2 * gap) / em.box;
  const fontSize = Math.min(widthFont, heightFont);
  if (fontSize < Math.min(widthFont, MIN_WRITING_NUMBER_FONT_CSS * unit)) {
    return null;
  }
  const equationHeight = em.box * fontSize;
  // Plocha na psaní je čtverec, co největší: přes šířku plochy, nebo co zbude pod příkladem.
  const pad = Math.max(
    minPad,
    Math.min(play.width, play.height - button - equationHeight - 2 * gap),
  );
  const centerX = play.left + play.width / 2;
  const buttonsCenterY = play.top + play.height - button / 2;
  const padTop = buttonsCenterY - button / 2 - gap - pad;
  const padRect: Rect = { left: centerX - pad / 2, top: padTop, width: pad, height: pad };
  const rowCenter = { x: centerX, y: padTop - gap - equationHeight / 2 };
  const equationFor = (problem: ArithmeticProblem): EquationLayout =>
    equationRow(problem, em, fontSize, unit, rowCenter);
  const clear = squareAt({ x: centerX - buttonGap / 2 - button / 2, y: buttonsCenterY }, button);
  const confirm = squareAt({ x: centerX + buttonGap / 2 + button / 2, y: buttonsCenterY }, button);
  const stars = starRow(area, unit, corner, portrait);
  return {
    arithmetic: {
      problemKind: 'arithmetic',
      maxNumber,
      writing: { padInProblem: false, pad: () => padRect, clear, confirm, detailScale: unit },
      equationFontSize: fontSize,
      equationFor,
      signButtons: null,
      stars,
      unitsPerCssPx: unit,
    },
    // „a ☐ b“ (#191): stejná plocha, písmo i tlačítka, jen kratší řada příkladu.
    relation: {
      problemKind: 'relation',
      maxNumber,
      writing: { padInProblem: false, pad: () => padRect, clear, confirm, detailScale: unit },
      equationFontSize: fontSize,
      equationFor: (problem) => relationRow(problem, em, fontSize, unit, rowCenter),
      relationButtons: null,
      stars,
      unitsPerCssPx: unit,
    },
  };
}

/** Příklad „a ☐ b“ (#190): místa pro obě čísla a okénko mezi nimi. */
export interface RelationEquationLayout {
  readonly first: Rect;
  readonly box: Rect;
  /** Ťukací plocha okénka: okénko, nejméně ale 64 × 64 px kolem jeho středu. */
  readonly boxHit: Rect;
  readonly second: Rect;
  /** Písmo čísel, v jednom rozsahu pro všechny příklady stejné. */
  readonly fontSize: number;
  /** Písmo znaménka v okénku. */
  readonly signSize: number;
  readonly boxCornerRadius: number;
}

/** Tlačítka <, = a > vedle sebe pod příkladem (#190 AC4). */
export interface RelationButtonsLayout {
  readonly less: Rect;
  readonly equal: Rect;
  readonly greater: Rect;
  /** Písmo znaménka v tlačítku. */
  readonly symbolSize: number;
  readonly cornerRadius: number;
}

/** Co mají obě rozložení „a ☐ b“ společné (ťukání i psaní). */
interface RelationLayoutBase {
  readonly problemKind: 'relation';
  readonly maxNumber: MaxNumber;
  readonly equationFontSize: number;
  equationFor(problem: RelationProblem): RelationEquationLayout;
  readonly stars: CompareLayoutBase['stars'];
  readonly unitsPerCssPx: number;
}

/** Rozložení „a ☐ b“ při ťukání (#190): pod příkladem tlačítka <, = a >. */
export interface RelationLayout extends RelationLayoutBase {
  readonly relationButtons: RelationButtonsLayout;
  readonly writing: null;
}

/**
 * Rozložení „a ☐ b“ při psaní (#191): plocha na psaní, smazání a ✓ na
 * stejném místě a stejně velké jako u „a ☐ b = c“, žádná tlačítka < = >.
 */
export interface RelationWritingLayout extends RelationLayoutBase {
  readonly relationButtons: null;
  readonly writing: WritingButtonsLayout<RelationProblem>;
}

/** Rozložení „a ☐ b“ podle způsobu odpovědi. */
export type RelationScreenLayout = RelationLayout | RelationWritingLayout;

/** Rozložení obrazovky pro jeden příklad: „a ☐ b = c“, nebo „a ☐ b“. */
export type ProblemScreenLayout = CompareScreenLayout | RelationScreenLayout;

/** Rozložení při psaní pro oba druhy příkladů v jednom okně a rozsahu. */
interface WritingScreens {
  readonly arithmetic: CompareWritingLayout;
  readonly relation: RelationWritingLayout;
}

/** Nejširší „a ☐ b“ rozsahu (obě čísla dvoumístná při rozsahu 20). */
const WIDEST_RELATION: Readonly<Record<MaxNumber, RelationProblem>> = {
  10: { kind: 'relation', a: 10, b: 10 },
  20: { kind: 'relation', a: 20, b: 20 },
};

/** Tlačítka u „a ☐ b“ jsou tři. */
const RELATION_BUTTON_COUNT = 3;
/** Nejmenší mezera mezi tlačítky < = > (CSS px). */
const MIN_RELATION_BUTTON_GAP_CSS = 8;

/** Šířka řady „a ☐ b“ jako násobek písma (bez okénka). */
function relationNumbersWidthEm(problem: RelationProblem, em: EquationEm): number {
  return numberSlotEm(problem.a, em) + numberSlotEm(problem.b, em) + 2 * em.gap;
}

/**
 * Strana tlačítek < = > a mezera mezi nimi v herních jednotkách: jako
 * + a −, ale tři vedle sebe se musí vejít do šířky plochy. Strana nikdy
 * pod 64 px, mezera nikdy pod 8 px.
 */
function relationButtonSize(sizes: Sizes, play: Rect, unit: number): { size: number; gap: number } {
  const count = RELATION_BUTTON_COUNT;
  const minSize = Math.ceil(MIN_TOUCH_CSS * unit);
  const minGap = MIN_RELATION_BUTTON_GAP_CSS * unit;
  const fitsHeight = (play.height - sizes.equationGap * unit) / 2;
  const wantedGap = sizes.buttonGap * unit;
  const fitsWidth = (play.width - (count - 1) * wantedGap) / count;
  const size = Math.max(minSize, Math.floor(Math.min(sizes.button * unit, fitsHeight, fitsWidth)));
  // Když tři tlačítka nejmenší velikosti zabraly i mezeru, mezery se zúží (nejvýš na 8 px).
  const roomForGaps = (play.width - count * size) / (count - 1);
  return { size, gap: Math.max(minGap, Math.min(wantedGap, roomForGaps)) };
}

/**
 * Řada „a ☐ b“ s písmem `fontSize` na středu `center`. Okénko je čtverec
 * podle písma, při psaní do okénka (#191) okénko na psaní o straně `writingBox`.
 */
function relationRow(
  problem: RelationProblem,
  em: EquationEm,
  fontSize: number,
  unit: number,
  center: Point,
  writingBox: number | null = null,
): RelationEquationLayout {
  const boxSize = writingBox ?? em.box * fontSize;
  const top = center.y - boxSize / 2;
  let left = center.x - (relationNumbersWidthEm(problem, em) * fontSize + boxSize) / 2;
  const slot = (width: number): Rect => {
    const rect = { left, top, width, height: boxSize };
    left += width + em.gap * fontSize;
    return rect;
  };
  const first = slot(numberSlotEm(problem.a, em) * fontSize);
  const box = slot(boxSize);
  const second = slot(numberSlotEm(problem.b, em) * fontSize);
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
    fontSize,
    // Při psaní jako u „a ☐ b = c“: znaménko velké jako rozpoznané, rohy jako plocha na psaní.
    signSize: box.height * (writingBox === null ? SIGN_IN_BOX_SHARE : WRITTEN_LABEL_HEIGHT_SHARE),
    boxCornerRadius:
      writingBox === null ? box.height * BOX_CORNER_SHARE : WRITING_AREA_CORNER_RADIUS * unit,
  };
}

/** Tlačítka <, = a > vedle sebe na středu `centerX`, horní hranou v `top`. */
function relationButtonsRow(
  size: number,
  gap: number,
  centerX: number,
  top: number,
): RelationButtonsLayout {
  const square = (left: number): Rect => ({ left, top, width: size, height: size });
  return {
    less: square(centerX - size / 2 - gap - size),
    equal: square(centerX - size / 2),
    greater: square(centerX + size / 2 + gap),
    symbolSize: size * SYMBOL_IN_BUTTON_SHARE,
    cornerRadius: size * BUTTON_CORNER_SHARE,
  };
}

/**
 * Rozložení „a ☐ b“ (#190 AC4, AC6) pro herní plochu `area` a rozsah
 * `maxNumber`: stejné míry a umístění jako „a ☐ b = c“ s + − (na šířku
 * spolu na středu, na výšku tlačítka dole u palce), jen tři tlačítka
 * < = > a kratší řada příkladu. Tlačítka nejsou větší než + a −, řada je
 * užší, a tak jsou čísla vždy aspoň tak velká jako u + −.
 */
export function layoutRelationScreen(
  area: GameArea,
  maxNumber: MaxNumber = DEFAULT_COMPARE_SETTINGS.maxNumber,
): RelationLayout {
  const unit = 1 / area.scale;
  const portrait = area.height > area.width;
  const sizes = sizesFor(area);
  const corner = cornerSizeCss(area) * unit;
  const play = playArea(area, sizes, unit, corner);
  const { em } = sizes;
  const buttons = relationButtonSize(sizes, play, unit);
  const equationGap = sizes.equationGap * unit;
  const widest = WIDEST_RELATION[maxNumber];
  const fontSize = Math.min(
    sizes.maxFont * unit,
    play.width / (relationNumbersWidthEm(widest, em) + em.box),
    (play.height - buttons.size - equationGap) / em.box,
  );
  const equationHeight = em.box * fontSize;
  const centerX = play.left + play.width / 2;
  let buttonsTop: number;
  let equationTop: number;
  if (portrait) {
    buttonsTop = play.top + play.height - buttons.size;
    equationTop = buttonsTop - equationGap - equationHeight;
  } else {
    const groupHeight = equationHeight + equationGap + buttons.size;
    equationTop = play.top + (play.height - groupHeight) / 2;
    buttonsTop = equationTop + equationHeight + equationGap;
  }
  const equationCenter = { x: centerX, y: equationTop + equationHeight / 2 };
  return {
    problemKind: 'relation',
    maxNumber,
    equationFontSize: fontSize,
    equationFor: (problem) => relationRow(problem, em, fontSize, unit, equationCenter),
    relationButtons: relationButtonsRow(buttons.size, buttons.gap, centerX, buttonsTop),
    writing: null,
    stars: starRow(area, unit, corner, portrait),
    unitsPerCssPx: unit,
  };
}

/**
 * Rozložení „a ☐ b“ při psaní (#191) pro herní plochu `area` a rozsah
 * `maxNumber`: plocha na psaní, smazání a ✓ přesně jako u „a ☐ b = c“
 * (na iPadu a telefonu na šířku okénko příkladu, na výšku samostatná
 * plocha pod příkladem), písmo čísel stejné, jen řada bez „= c“. Při
 * „vše“ se tak mezi druhy příkladů nic neposune.
 */
export function layoutRelationWritingScreen(
  area: GameArea,
  maxNumber: MaxNumber = DEFAULT_COMPARE_SETTINGS.maxNumber,
): RelationWritingLayout {
  const unit = 1 / area.scale;
  const sizes = sizesFor(area);
  const corner = cornerSizeCss(area) * unit;
  const play = playArea(area, sizes, unit, corner);
  return layoutWritingScreen(area, maxNumber, play, corner).relation;
}

/**
 * Rozložení pro druh rozehraného příkladu (#190, #191): „a ☐ b“ tlačítka
 * < = >, „a ☐ b = c“ tlačítka + −, nebo u obou plochu na psaní podle
 * nastavení.
 */
export function layoutProblemScreen(
  area: GameArea,
  settings: Pick<CompareSettings, 'maxNumber' | 'answerInput'>,
  kind: 'relation',
): RelationScreenLayout;
export function layoutProblemScreen(
  area: GameArea,
  settings: Pick<CompareSettings, 'maxNumber' | 'answerInput'>,
  kind: 'arithmetic',
): CompareScreenLayout;
export function layoutProblemScreen(
  area: GameArea,
  settings: Pick<CompareSettings, 'maxNumber' | 'answerInput'>,
  kind: ProblemKind,
): ProblemScreenLayout;
export function layoutProblemScreen(
  area: GameArea,
  settings: Pick<CompareSettings, 'maxNumber' | 'answerInput'>,
  kind: ProblemKind,
): ProblemScreenLayout {
  if (kind === 'relation') {
    return settings.answerInput === 'writing'
      ? layoutRelationWritingScreen(area, settings.maxNumber)
      : layoutRelationScreen(area, settings.maxNumber);
  }
  return layoutCompareScreen(area, settings.maxNumber, settings.answerInput);
}
