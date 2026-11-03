/**
 * Rozmístění hvězdiček, postavičky, příkladu, nápovědy, číselníku a kolečka
 * nastavení na obrazovce. Je tady, a ne ve scéně, aby šlo bez prohlížeče
 * ověřit, že tlačítka jsou dost velká na prst a všechno se vejde.
 *
 * Rozložení se mění podle počtu tlačítek číselníku (rozsah z nastavení):
 * 0–5 jedna řada, 0–10 dvě řady, 0–20 tři menší řady a menší nápověda.
 */

/** Strana tlačítka s číslem při rozsahu do 5 a do 10. */
export const ANSWER_BUTTON_SIZE = 140;

/** Strana tlačítka s číslem při rozsahu do 20 (21 tlačítek ve třech řadách). */
export const SMALL_ANSWER_BUTTON_SIZE = 116;

/** Mezera mezi tlačítky, aby se netrefilo vedlejší. */
export const ANSWER_BUTTON_GAP = 20;
const SMALL_ANSWER_BUTTON_GAP = 14;

/** Víc tlačítek než tolik se nevejde do dvou běžných řad. */
const MAX_BUTTONS_IN_TWO_ROWS = 11;

/** Okraj pod spodní řadou tlačítek. */
const BOTTOM_MARGIN = 24;

/** Výchozí velikost písma příkladu (rozsah do 5, jednociferná čísla). */
export const PROBLEM_FONT_SIZE = 140;

/** Písmo příkladu, když se v něm může objevit dvakrát dvouciferné číslo („10 − 10 = ?“). */
const PROBLEM_FONT_SIZE_TWO_DIGITS = 130;

/** Písmo příkladu při rozsahu do 20, aby se vešly tři řady tlačítek. */
const PROBLEM_FONT_SIZE_SMALL = 110;

/** Výška, kterou text příkladu zabere (písmo i s rezervou nad a pod). */
export function problemTextHeight(fontSize: number): number {
  return Math.round(fontSize * 1.2);
}

/**
 * Šířka nejdelšího příkladu v písmu Arial i s rezervou. Číslice mají asi
 * 0,56 velikosti písma: „5 − 5 = ?“ zabere asi 4 velikosti písma,
 * „10 − 10 = ?“ nebo „20 − 10 = ?“ asi 5,06.
 *
 * @param maxNumber Největší číslo, které se v příkladu může objevit.
 */
export function problemMaxWidth(fontSize: number, maxNumber = 10): number {
  const widthInFontSizes = maxNumber >= 10 ? 5.1 : 4.1;
  return Math.round(fontSize * widthInFontSizes);
}

/** Výška textu příkladu při největším písmu (horní odhad pro všechny rozsahy). */
export const PROBLEM_TEXT_HEIGHT = problemTextHeight(PROBLEM_FONT_SIZE);

/** Šířka nejdelšího příkladu při výchozím rozsahu do 10. */
export const PROBLEM_MAX_WIDTH = problemMaxWidth(PROBLEM_FONT_SIZE_TWO_DIGITS);

/** Kde je příklad, poměr k výšce obrazovky. */
const PROBLEM_HEIGHT_RATIO = 0.26;

/** Při rozsahu do 20 je příklad o kousek výš, aby se vešly tři řady tlačítek. */
const PROBLEM_Y_SMALL = 190;

/** Velikost maskota (šířka i výška čtverce, do kterého se vejde). */
export const MASCOT_SIZE = 160;

/** Jak vysoko maskot vyskočí radostí. */
export const MASCOT_JUMP_HEIGHT = 30;

/** Jak daleko do stran se maskot pohne při tanci. */
export const MASCOT_DANCE_SWAY = 12;

/** Odstup maskota od levého okraje obrazovky. */
const MASCOT_LEFT_MARGIN = 20;

/** O kolik je příklad posunutý doprava od středu, aby se vlevo vešel maskot. */
const PROBLEM_SHIFT_RIGHT = 40;

/** Kde je střed nápovědy s tečkami, poměr k výšce obrazovky. */
const HINT_HEIGHT_RATIO = 0.47;

/** Při rozsahu do 20 je nápověda výš a menší. */
const HINT_Y_SMALL = 320;

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

/** Průměr jedné tečky nápovědy při rozsahu do 5 a do 10. */
export const HINT_DOT_SIZE = HINT_STYLE.dotSize;

/** Nejvíc teček v jedné řadě skupinky při rozsahu do 5 a do 10. */
export const HINT_DOTS_PER_ROW = HINT_STYLE.dotsPerRow;

/** Velikost jedné hvězdičky v řadě nahoře. */
export const STAR_SIZE = 64;

/** Vzdálenost středů sousedních hvězdiček. */
const STAR_SPACING = 80;

/** Svislá poloha středu řady hvězdiček. */
const STARS_Y = 46;

/** Velikost ozubeného kolečka nastavení vpravo nahoře. */
export const SETTINGS_BUTTON_SIZE = 80;

/** Odstup kolečka nastavení od pravého okraje. */
const SETTINGS_BUTTON_MARGIN = 16;

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
  readonly hint: Point;
  readonly hintStyle: HintStyle;
  /** Místa hvězdiček nahoře, zleva doprava. */
  readonly stars: readonly Point[];
  /** Střed maskota vlevo vedle příkladu. */
  readonly mascot: Point;
  /** Místa tlačítek ve stejném pořadí, v jakém jsou čísla na číselníku. */
  readonly answerButtons: readonly ButtonSlot[];
  /** Ozubené kolečko nastavení vpravo nahoře. */
  readonly settingsButton: ButtonSlot;
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
): ButtonSlot[] {
  const rows = keypadRows(buttonCount);
  const rowStep = size + gap;
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
  return buttonCount > 10 ? PROBLEM_FONT_SIZE_TWO_DIGITS : PROBLEM_FONT_SIZE;
}

/**
 * Úplně nahoře hvězdičky a vpravo od nich kolečko nastavení, pod nimi
 * vlevo postavička vedle příkladu, pod příkladem nápověda a dole číselník.
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
    problem: { x: centerX + PROBLEM_SHIFT_RIGHT, y: problemY },
    problemFontSize,
    problemSize: {
      width: problemMaxWidth(problemFontSize, buttonCount - 1),
      height: problemTextHeight(problemFontSize),
    },
    hint: { x: centerX, y: small ? HINT_Y_SMALL : screenHeight * HINT_HEIGHT_RATIO },
    hintStyle: small ? SMALL_HINT_STYLE : HINT_STYLE,
    stars: layoutStars(starCount, centerX),
    mascot: {
      x: MASCOT_LEFT_MARGIN + MASCOT_DANCE_SWAY + MASCOT_SIZE / 2,
      y: screenHeight * PROBLEM_HEIGHT_RATIO,
    },
    answerButtons: layoutKeypad(
      buttonCount,
      centerX,
      screenHeight,
      small ? SMALL_ANSWER_BUTTON_SIZE : ANSWER_BUTTON_SIZE,
      small ? SMALL_ANSWER_BUTTON_GAP : ANSWER_BUTTON_GAP,
    ),
    settingsButton: {
      x: screenWidth - SETTINGS_BUTTON_MARGIN - SETTINGS_BUTTON_SIZE / 2,
      y: STARS_Y,
      size: SETTINGS_BUTTON_SIZE,
    },
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
