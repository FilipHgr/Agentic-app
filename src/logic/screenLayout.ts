/**
 * Rozmístění hvězdiček, příkladu, nápovědy a číselníku na herní
 * ploše. Je tady, a ne ve scéně, aby šlo bez prohlížeče ověřit, že tlačítka
 * jsou dost velká na prst a všechno se vejde. Kolečko nastavení je mimo herní
 * plochu, v rohu stránky (index.html, src/ui/settingsButton.ts).
 *
 * Rozložení se mění podle počtu tlačítek číselníku (rozsah z nastavení):
 * 0–5 jedna řada, 0–10 dvě řady, 0–20 tři menší řady a menší nápověda.
 */

import { writingBoxCount } from './settings';
import type { MaxNumber } from './settings';
import type { WritingBox } from './twoBoxWriting';

/** Strana tlačítka s číslem při rozsahu do 5 a do 10. */
export const ANSWER_BUTTON_SIZE = 140;

/** Strana tlačítka s číslem při rozsahu do 20 (21 tlačítek ve třech řadách). */
export const SMALL_ANSWER_BUTTON_SIZE = 116;

/** Vodorovná mezera mezi tlačítky v řadě, aby se netrefilo vedlejší (svislá je ANSWER_ROW_GAP). */
export const ANSWER_BUTTON_GAP = 24;
const SMALL_ANSWER_BUTTON_GAP = 20;

/** Svislá mezera mezi řadami číselníku; větší by ubrala místo nápovědě (#44, #46). */
const ANSWER_ROW_GAP = 20;
const SMALL_ANSWER_ROW_GAP = 14;

/** Víc tlačítek než tolik se nevejde do dvou běžných řad. */
const MAX_BUTTONS_IN_TWO_ROWS = 11;

/** Okraj pod spodní řadou tlačítek. */
const BOTTOM_MARGIN = 24;

/** Odhadová velikost písma pro PROBLEM_TEXT_HEIGHT a PROBLEM_MAX_WIDTH. */
export const PROBLEM_FONT_SIZE = 140;

/** Při rozsahu do 5 je pod příkladem nejvíc místa, příklad je největší (#44, #63). */
const PROBLEM_FONT_SIZE_LARGE = 184;

/** Počet tlačítek číselníku při rozsahu do 5 (0–5). */
const BUTTONS_UP_TO_FIVE = 6;

/** Písmo příkladu, když se v něm může objevit dvakrát dvouciferné číslo („10 − 10 = ?“, #63). */
const PROBLEM_FONT_SIZE_TWO_DIGITS = 150;

/**
 * Písmo příkladu při rozsahu do 20, aby se vešly tři řady tlačítek a nad
 * i pod nápovědou zůstala mezera aspoň 14 (#63).
 */
const PROBLEM_FONT_SIZE_SMALL = 116;

/** Výška, kterou text příkladu zabere (písmo i s rezervou nad a pod). */
export function problemTextHeight(fontSize: number): number {
  return Math.round(fontSize * 1.2);
}

/** Šířky znaků v písmu Arial jako část velikosti písma. */
const DIGIT_WIDTH = 0.56;
const SPACE_WIDTH = 0.28;
const SIGN_WIDTH = 0.59;

/** Rezerva navíc k odhadu šířky, aby se text vešel i s drobnou odchylkou písma. */
const WIDTH_RESERVE = 1.03;

function digitCount(value: number): number {
  return String(value).length;
}

/**
 * Nejvíc číslic, které má vyřešený příklad v rozsahu do `maxNumber`
 * (obě čísla i výsledek, sčítání i odčítání). Například do 20 je to
 * „10 + 10 = 20“ se šesti číslicemi.
 */
function mostDigitsInSolvedProblem(maxNumber: number): number {
  let most = 0;
  for (let first = 0; first <= maxNumber; first += 1) {
    for (let second = 0; second <= maxNumber; second += 1) {
      const sum = first + second;
      const difference = first - second;
      const digits = digitCount(first) + digitCount(second);
      if (sum <= maxNumber) {
        most = Math.max(most, digits + digitCount(sum));
      }
      if (difference >= 0) {
        most = Math.max(most, digits + digitCount(difference));
      }
    }
  }
  return most;
}

/**
 * Šířka nejdelšího vyřešeného příkladu (třeba „10 + 10 = 20“) v písmu Arial
 * i s rezervou. Příklad má čtyři mezery a dvě znaménka.
 *
 * @param maxNumber Největší číslo, které se v příkladu může objevit.
 */
export function problemMaxWidth(fontSize: number, maxNumber = 10): number {
  const digits = mostDigitsInSolvedProblem(maxNumber);
  const widthInFontSizes = digits * DIGIT_WIDTH + 4 * SPACE_WIDTH + 2 * SIGN_WIDTH;
  return Math.round(fontSize * widthInFontSizes * WIDTH_RESERVE);
}

/** Výška textu příkladu při největším písmu (horní odhad pro všechny rozsahy). */
export const PROBLEM_TEXT_HEIGHT = problemTextHeight(PROBLEM_FONT_SIZE);

/** Šířka nejdelšího příkladu při výchozím rozsahu do 10. */
export const PROBLEM_MAX_WIDTH = problemMaxWidth(PROBLEM_FONT_SIZE_TWO_DIGITS);

/** Kde je příklad, poměr k výšce obrazovky. */
const PROBLEM_HEIGHT_RATIO = 0.26;

/** Při rozsahu do 20 je příklad o kousek výš, aby se vešly tři řady tlačítek. */
const PROBLEM_Y_SMALL = 194;

/** Vzhled teček nápovědy. */
export interface HintStyle {
  /** Průměr jedné tečky. */
  readonly dotSize: number;
  /** Vzdálenost středů sousedních teček ve skupince (vodorovně i svisle). */
  readonly spacing: number;
  /** Nejvíc teček v jedné řadě skupinky. */
  readonly dotsPerRow: number;
  /** Mezera navíc za pátou tečkou v řadě, aby šla pětka poznat i v řadě po deseti. */
  readonly fiveGap: number;
  /** Mezera mezi skupinkami navíc k běžné vzdálenosti teček. */
  readonly groupGap: number;
}

/** Tečky po pěti v řadě jako na počítadle: 7 = 5 + 2. */
export const HINT_STYLE: HintStyle = {
  dotSize: 50,
  spacing: 64,
  dotsPerRow: 5,
  fiveGap: 0,
  groupGap: 60,
};

/** Při rozsahu do 20: menší tečky po deseti v řadě s mezerou za pětkou. */
export const SMALL_HINT_STYLE: HintStyle = {
  dotSize: 34,
  spacing: 42,
  dotsPerRow: 10,
  fiveGap: 10,
  groupGap: 40,
};

/** Při rozsahu do 5: větší tečky, je na ně dost místa (#44). */
export const LARGE_HINT_STYLE: HintStyle = {
  dotSize: 60,
  spacing: 76,
  dotsPerRow: 5,
  fiveGap: 0,
  groupGap: 60,
};

/** Vzhled teček podle počtu tlačítek číselníku (rozsahu). */
function hintStyleFor(buttonCount: number): HintStyle {
  if (buttonCount > MAX_BUTTONS_IN_TWO_ROWS) {
    return SMALL_HINT_STYLE;
  }
  return buttonCount <= BUTTONS_UP_TO_FIVE ? LARGE_HINT_STYLE : HINT_STYLE;
}

/** Průměr jedné tečky nápovědy při rozsahu do 10. */
export const HINT_DOT_SIZE = HINT_STYLE.dotSize;

/** Nejvíc teček v jedné řadě skupinky při rozsahu do 5 a do 10. */
export const HINT_DOTS_PER_ROW = HINT_STYLE.dotsPerRow;

/** Velikost jedné hvězdičky v řadě nahoře. */
export const STAR_SIZE = 30;

/** Vzdálenost středů sousedních hvězdiček. */
const STAR_SPACING = 44;

/** Svislá poloha středu řady hvězdiček. */
const STARS_Y = 52;

export interface Point {
  readonly x: number;
  readonly y: number;
}

/** Čtvercové tlačítko; `x` a `y` je jeho střed. */
export interface ButtonSlot extends Point {
  readonly size: number;
}

export interface ScreenLayout {
  readonly problem: Point;
  /** Velikost písma příkladu. */
  readonly problemFontSize: number;
  /** Prostor, který zabere i ten nejdelší příklad v tomto rozsahu. */
  readonly problemSize: { readonly width: number; readonly height: number };
  readonly hintStyle: HintStyle;
  /** Místa hvězdiček nahoře, zleva doprava. */
  readonly stars: readonly Point[];
  /** Místa tlačítek ve stejném pořadí, v jakém jsou čísla na číselníku. */
  readonly answerButtons: readonly ButtonSlot[];
}

/** Vodorovná řada tlačítek se středem `centerX`. */
function layoutRow(
  count: number,
  centerX: number,
  y: number,
  size: number,
  gap: number,
): ButtonSlot[] {
  const rowWidth = count * size + (count - 1) * gap;
  const firstX = centerX - rowWidth / 2 + size / 2;

  return Array.from({ length: count }, (_, index) => ({
    x: firstX + index * (size + gap),
    y,
    size,
  }));
}

/**
 * Rozdělí tlačítka do řad. Do 6 tlačítek jedna řada, do 11 dvě řady s delší
 * horní (0–5 a 6–10), víc tlačítek po sedmi (0–6, 7–13, 14–20).
 */
function keypadRows(buttonCount: number): number[] {
  if (buttonCount <= 6) {
    return [buttonCount];
  }
  if (buttonCount <= MAX_BUTTONS_IN_TWO_ROWS) {
    const topRow = Math.ceil(buttonCount / 2);
    return [topRow, buttonCount - topRow];
  }

  const rows: number[] = [];
  for (let left = buttonCount; left > 0; left -= 7) {
    rows.push(Math.min(7, left));
  }
  return rows;
}

/** Rozmístí číselník do řad shora dolů, spodní řada je u spodního okraje. */
function layoutKeypad(
  buttonCount: number,
  centerX: number,
  screenHeight: number,
  size: number,
  gap: number,
  rowGap: number,
): ButtonSlot[] {
  const rows = keypadRows(buttonCount);
  const rowStep = size + rowGap;
  const lastRowY = screenHeight - BOTTOM_MARGIN - size / 2;
  const firstRowY = lastRowY - (rows.length - 1) * rowStep;

  return rows.flatMap((count, row) =>
    layoutRow(count, centerX, firstRowY + row * rowStep, size, gap),
  );
}

/** Písmo příkladu podle toho, jak velká čísla se v něm mohou objevit. */
function problemFontSizeFor(buttonCount: number): number {
  if (buttonCount > MAX_BUTTONS_IN_TWO_ROWS) {
    return PROBLEM_FONT_SIZE_SMALL;
  }
  if (buttonCount <= BUTTONS_UP_TO_FIVE) {
    return PROBLEM_FONT_SIZE_LARGE;
  }
  return buttonCount > 10 ? PROBLEM_FONT_SIZE_TWO_DIGITS : PROBLEM_FONT_SIZE;
}

/**
 * Úplně nahoře hvězdičky, pod nimi uprostřed příklad, pod příkladem
 * nápověda a dole číselník.
 *
 * @param buttonCount Počet tlačítek číselníku (rozsah + 1).
 */
export function layoutScreen(
  screenWidth: number,
  screenHeight: number,
  buttonCount: number,
  starCount = 0,
): ScreenLayout {
  const small = buttonCount > MAX_BUTTONS_IN_TWO_ROWS;
  const centerX = screenWidth / 2;
  const problemY = small ? PROBLEM_Y_SMALL : screenHeight * PROBLEM_HEIGHT_RATIO;
  const problemFontSize = problemFontSizeFor(buttonCount);

  return {
    problem: { x: centerX, y: problemY },
    problemFontSize,
    problemSize: {
      width: problemMaxWidth(problemFontSize, buttonCount - 1),
      height: problemTextHeight(problemFontSize),
    },
    hintStyle: hintStyleFor(buttonCount),
    stars: layoutStars(starCount, centerX),
    answerButtons: layoutKeypad(
      buttonCount,
      centerX,
      screenHeight,
      small ? SMALL_ANSWER_BUTTON_SIZE : ANSWER_BUTTON_SIZE,
      small ? SMALL_ANSWER_BUTTON_GAP : ANSWER_BUTTON_GAP,
      small ? SMALL_ANSWER_ROW_GAP : ANSWER_ROW_GAP,
    ),
  };
}

/** Řada hvězdiček nahoře, vycentrovaná kolem `centerX`. */
function layoutStars(count: number, centerX: number): Point[] {
  const firstX = centerX - ((count - 1) * STAR_SPACING) / 2;

  return Array.from({ length: count }, (_, index) => ({
    x: firstX + index * STAR_SPACING,
    y: STARS_Y,
  }));
}

/** Tečka nápovědy; `group` říká, ke kterému číslu z příkladu patří. */
export interface HintDot extends Point {
  readonly group: number;
}

/** Vodorovný odstup tečky ve sloupci `column` od první tečky v řadě. */
function columnOffset(column: number, style: HintStyle): number {
  return column * style.spacing + (column >= 5 ? style.fiveGap : 0);
}

/** Šířka skupinky teček od středu první k středu poslední tečky v řadě. */
function groupWidth(count: number, style: HintStyle): number {
  return columnOffset(Math.min(count, style.dotsPerRow) - 1, style);
}

/**
 * Rozmístí tečky nápovědy. Skupinka má nejvýš `dotsPerRow` teček v řadě,
 * další pokračují v řadě pod ní. Skupinky jsou vedle sebe, oddělené
 * mezerou, a celé je to vycentrované kolem `center`.
 */
export function layoutHintDots(
  groups: readonly number[],
  center: Point,
  style: HintStyle = HINT_STYLE,
): HintDot[] {
  const groupLefts: number[] = [];
  let x = 0;

  groups.forEach((count, groupIndex) => {
    if (groupIndex > 0) {
      x += style.spacing + style.groupGap;
    }
    groupLefts.push(x);
    x += groupWidth(count, style);
  });

  const totalWidth = x;
  const dots: HintDot[] = [];

  groups.forEach((count, groupIndex) => {
    const rowCount = Math.ceil(count / style.dotsPerRow);
    const firstRowY = center.y - ((rowCount - 1) * style.spacing) / 2;
    const left = center.x - totalWidth / 2 + (groupLefts[groupIndex] ?? 0);

    for (let dot = 0; dot < count; dot += 1) {
      const column = dot % style.dotsPerRow;
      const row = Math.floor(dot / style.dotsPerRow);
      dots.push({
        x: left + columnOffset(column, style),
        y: firstRowY + row * style.spacing,
        group: groupIndex,
      });
    }
  });

  return dots;
}

/** Strana jediného okénka na psaní při rozsahu 5 (#41). */
export const WRITING_AREA_SIZE = 320;

/** Strana každého ze dvou okének (desítky a jednotky) při rozsahu 10 a 20 (#42). */
export const TWO_BOX_AREA_SIZE = 280;

/** Mezera mezi okénkem desítek a jednotek. */
const TWO_BOX_GAP = 32;

/** Velikost tlačítek ✓ a smazání vedle okének. */
export const WRITING_BUTTON_SIZE = ANSWER_BUTTON_SIZE;

/** Mezera mezi okénky a tlačítky. */
const WRITING_BUTTON_GAP = 48;

/** Při dvou okénkách je místa méně, tlačítka jsou blíž. */
const TWO_BOX_BUTTON_GAP = 32;

/** Okénko na psaní; `x` a `y` je jeho střed. */
export interface WritingAreaSlot extends Point {
  readonly width: number;
  readonly height: number;
}

export interface WritingLayout extends Omit<ScreenLayout, 'answerButtons'> {
  /** Při rozsahu 5 jedno okénko, při 10 a 20 desítky (vlevo) a jednotky (vpravo). */
  readonly writingAreas: readonly WritingAreaSlot[];
  /** ✓ vpravo od okének. */
  readonly confirmButton: ButtonSlot;
  /** Smazání vlevo od okének. */
  readonly clearButton: ButtonSlot;
}

/**
 * Rozložení při psaní: nahoře stejné jako s číselníkem (hvězdičky,
 * příklad, nápověda), dole místo číselníku okénka na psaní,
 * vlevo od nich smazání a vpravo ✓.
 */
export function layoutWritingScreen(
  screenWidth: number,
  screenHeight: number,
  maxNumber: MaxNumber,
  starCount = 0,
): WritingLayout {
  const keypadLayout = layoutScreen(screenWidth, screenHeight, maxNumber + 1, starCount);
  const top: Omit<ScreenLayout, 'answerButtons'> = {
    problem: keypadLayout.problem,
    problemFontSize: keypadLayout.problemFontSize,
    problemSize: keypadLayout.problemSize,
    hintStyle: keypadLayout.hintStyle,
    stars: keypadLayout.stars,
  };
  const twoBoxes = writingBoxCount(maxNumber) === 2;
  const side = twoBoxes ? TWO_BOX_AREA_SIZE : WRITING_AREA_SIZE;
  const centerX = screenWidth / 2;
  const centerY = screenHeight - BOTTOM_MARGIN - side / 2;
  const boxesWidth = twoBoxes ? side * 2 + TWO_BOX_GAP : side;
  const buttonGap = twoBoxes ? TWO_BOX_BUTTON_GAP : WRITING_BUTTON_GAP;
  const buttonOffset = boxesWidth / 2 + buttonGap + WRITING_BUTTON_SIZE / 2;
  const boxOffset = (side + TWO_BOX_GAP) / 2;

  const writingAreas = twoBoxes
    ? [centerX - boxOffset, centerX + boxOffset].map((x) => ({
        x,
        y: centerY,
        width: side,
        height: side,
      }))
    : [{ x: centerX, y: centerY, width: side, height: side }];

  return {
    ...top,
    writingAreas,
    confirmButton: { x: centerX + buttonOffset, y: centerY, size: WRITING_BUTTON_SIZE },
    clearButton: { x: centerX - buttonOffset, y: centerY, size: WRITING_BUTTON_SIZE },
  };
}

/**
 * Ve kterém okénku dotyk začal. Při jednom okénku jsou to jednotky.
 * Dotyk v mezeře mezi okénky nebo mimo ně vrátí `null`.
 */
export function writingAreaAt(layout: WritingLayout, point: Point): WritingBox | null {
  const index = layout.writingAreas.findIndex(
    (area) =>
      Math.abs(point.x - area.x) <= area.width / 2 && Math.abs(point.y - area.y) <= area.height / 2,
  );
  if (index < 0) {
    return null;
  }
  return layout.writingAreas.length === 2 && index === 0 ? 'tens' : 'ones';
}

/** Plocha pro ťuknutí na tečku nápovědy (#43): aspoň 64 px, i když je tečka menší. */
export const HINT_DOT_HIT_SIZE = 64;

/** Čtvercová plocha pro ťuknutí se středem v tečce. */
export function hintDotHitArea(dot: HintDot): ButtonSlot {
  return { x: dot.x, y: dot.y, size: HINT_DOT_HIT_SIZE };
}

/** Index tečky, do jejíž plochy dotyk padl, nebo `null`, když žádné. */
export function hintDotAt(dots: readonly HintDot[], point: Point): number | null {
  const index = dots.findIndex((dot) => {
    const half = hintDotHitArea(dot).size / 2;
    return Math.abs(point.x - dot.x) <= half && Math.abs(point.y - dot.y) <= half;
  });
  return index < 0 ? null : index;
}

/** Výška boxu textu příkladu jako část velikosti písma (stejně jako `problemTextHeight`). */
const TEXT_BOX_RATIO = 1.2;

/**
 * Tečky nápovědy pro skupinky `groups` (#44, #63). Všechny skupinky začínají
 * stejnou horní řadou, vodorovně jsou pod středem příkladu a svisle
 * uprostřed mezi spodkem boxu textu příkladu a horní hranou ovládání
 * (číselník nebo okénka na psaní), podle skutečného počtu řad.
 */
export function layoutHint(
  layout: ScreenLayout | WritingLayout,
  groups: readonly number[],
): HintDot[] {
  const visibleGroups = groups.filter((count) => count > 0);
  if (visibleGroups.length === 0) {
    return [];
  }

  const style = layout.hintStyle;
  const rowCount = Math.max(...visibleGroups.map((count) => Math.ceil(count / style.dotsPerRow)));
  const height = (rowCount - 1) * style.spacing + style.dotSize;
  const textBottom = layout.problem.y + (TEXT_BOX_RATIO * layout.problemFontSize) / 2;
  const controlsTop = controlsTopOf(layout);
  const top = textBottom + (controlsTop - textBottom - height) / 2;

  const dots = layoutHintDots(visibleGroups, { x: layout.problem.x, y: 0 }, style);
  return alignRowsToTop(dots, visibleGroups, style, top + style.dotSize / 2);
}

/** Horní hrana ovládání: horní řada číselníku, nebo okénka na psaní. */
function controlsTopOf(layout: ScreenLayout | WritingLayout): number {
  const tops =
    'answerButtons' in layout
      ? layout.answerButtons.map((button) => button.y - button.size / 2)
      : layout.writingAreas.map((area) => area.y - area.height / 2);
  return Math.min(...tops);
}

/** Řady všech skupinek pod sebou od stejné horní řady se středem `firstRowY`. */
function alignRowsToTop(
  dots: readonly HintDot[],
  groups: readonly number[],
  style: HintStyle,
  firstRowY: number,
): HintDot[] {
  const result: HintDot[] = [];
  let index = 0;
  groups.forEach((count) => {
    for (let dot = 0; dot < count; dot += 1) {
      const source = dots[index];
      if (source) {
        const row = Math.floor(dot / style.dotsPerRow);
        result.push({ ...source, y: firstRowY + row * style.spacing });
      }
      index += 1;
    }
  });
  return result;
}
