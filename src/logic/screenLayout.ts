/**
 * Velikost hry a rozmístění příkladu, nápovědy a číselníku na obrazovce.
 * Je tady, a ne ve scéně, aby šlo bez prohlížeče ověřit, že tlačítka jsou
 * dost velká na prst a všechno se vejde na obrazovku na šířku i na výšku.
 */

/** Nejmenší herní plocha na šířku; menší obrazovku hra zvětší do tohoto rozměru. */
export const MIN_LANDSCAPE_SIZE = { width: 1024, height: 768 } as const;

/** Nejmenší herní plocha na výšku. */
export const MIN_PORTRAIT_SIZE = { width: 768, height: 1240 } as const;

export interface GameSize {
  readonly width: number;
  readonly height: number;
}

/**
 * Velikost herní plochy se stejným poměrem stran jako obrazovka, aby hra
 * vyplnila celou obrazovku bez prázdných pruhů. Kratší strana nikdy neklesne
 * pod nejmenší rozměr, takže se všechno vejde.
 */
export function gameSizeFor(viewWidth: number, viewHeight: number): GameSize {
  const validView =
    Number.isFinite(viewWidth) && Number.isFinite(viewHeight) && viewWidth > 0 && viewHeight > 0;
  if (!validView) {
    return MIN_LANDSCAPE_SIZE;
  }

  const aspect = viewWidth / viewHeight;
  if (aspect >= 1) {
    const height = Math.max(MIN_LANDSCAPE_SIZE.height, MIN_LANDSCAPE_SIZE.width / aspect);
    return { width: Math.round(height * aspect), height: Math.round(height) };
  }

  const width = Math.max(MIN_PORTRAIT_SIZE.width, MIN_PORTRAIT_SIZE.height * aspect);
  return { width: Math.round(width), height: Math.round(width / aspect) };
}

/** Strana čtvercového tlačítka s číslem v pixelech hry. */
export const ANSWER_BUTTON_SIZE = 140;

/** Mezera mezi tlačítky, aby se netrefilo vedlejší. */
export const ANSWER_BUTTON_GAP = 20;

/** Okraj pod spodní řadou tlačítek. */
const BOTTOM_MARGIN = 24;

/** Na výšku: tlačítka jsou větší a v řadě jich jsou nejvýš čtyři. */
const PORTRAIT_BUTTON_SIZE = 160;
const PORTRAIT_BUTTONS_PER_ROW = 4;
const PORTRAIT_BOTTOM_MARGIN = 40;
const PORTRAIT_SIDE_MARGIN = 24;

/** Na výšku: svislé mezery mezi hvězdičkami, postavičkou, příkladem a nápovědou. */
const PORTRAIT_GAP = 24;

/** Kde je příklad, poměr k výšce obrazovky. */
const PROBLEM_HEIGHT_RATIO = 0.26;

/** Velikost písma příkladu. */
export const PROBLEM_FONT_SIZE = 140;

/** Výška, kterou text příkladu zabere (písmo i s rezervou nad a pod). */
export const PROBLEM_TEXT_HEIGHT = Math.round(PROBLEM_FONT_SIZE * 1.2);

/**
 * Šířka nejdelšího příkladu „10 + 0 = ?“ v písmu Arial i s rezervou.
 * Číslice mají asi 0,56 velikosti písma, celý příklad asi 4,5.
 */
export const PROBLEM_MAX_WIDTH = Math.round(PROBLEM_FONT_SIZE * 4.7);

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

/** Průměr jedné tečky nápovědy, dost velký na počítání prstem i okem. */
export const HINT_DOT_SIZE = 50;

/** Vzdálenost středů sousedních teček ve skupince (vodorovně i svisle). */
const HINT_DOT_SPACING = 64;

/** Nejvíc teček v jedné řadě skupinky, jako na počítadle: 7 = 5 + 2. */
export const HINT_DOTS_PER_ROW = 5;

/** Mezera mezi skupinkami navíc k běžné vzdálenosti teček. */
const HINT_GROUP_GAP = 60;

/** Velikost jedné hvězdičky v řadě nahoře. */
export const STAR_SIZE = 64;

/** Vzdálenost středů sousedních hvězdiček. */
const STAR_SPACING = 80;

/** Svislá poloha středu řady hvězdiček. */
const STARS_Y = 46;

/** Polovina výšky nápovědy se dvěma řadami teček. */
const HINT_HALF_HEIGHT = HINT_DOT_SPACING / 2 + HINT_DOT_SIZE / 2;

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
  readonly hint: Point;
  /** Místa hvězdiček nahoře, zleva doprava. */
  readonly stars: readonly Point[];
  /** Střed postavičky: na šířku vlevo vedle příkladu, na výšku nad ním. */
  readonly mascot: Point;
  /** Místa tlačítek ve stejném pořadí, v jakém jsou čísla na číselníku. */
  readonly answerButtons: readonly ButtonSlot[];
}

/** Vodorovná řada tlačítek se středem `centerX`. */
function layoutRow(count: number, centerX: number, y: number, size: number): ButtonSlot[] {
  const rowWidth = count * size + (count - 1) * ANSWER_BUTTON_GAP;
  const firstX = centerX - rowWidth / 2 + size / 2;

  return Array.from({ length: count }, (_, index) => ({
    x: firstX + index * (size + ANSWER_BUTTON_GAP),
    y,
    size,
  }));
}

/**
 * Rozmístí číselník do řad shora dolů, poslední řada je u spodního okraje.
 * `rowSizes` říká, kolik tlačítek je v které řadě.
 */
function layoutKeypad(
  rowSizes: readonly number[],
  centerX: number,
  bottomY: number,
  size: number,
): ButtonSlot[] {
  const rowStep = size + ANSWER_BUTTON_GAP;
  const firstRowY = bottomY - size / 2 - (rowSizes.length - 1) * rowStep;

  return rowSizes.flatMap((count, row) =>
    layoutRow(count, centerX, firstRowY + row * rowStep, size),
  );
}

/** Rozdělí tlačítka do řad po nejvýš `perRow` kusech, plné řady jsou nahoře. */
function rowsOf(buttonCount: number, perRow: number): number[] {
  const rows: number[] = [];
  for (let left = buttonCount; left > 0; left -= perRow) {
    rows.push(Math.min(perRow, left));
  }
  return rows;
}

/**
 * Rozmístí vše na obrazovce. Na šířku: nahoře hvězdičky, vlevo postavička
 * vedle příkladu, pod nimi nápověda a dole číselník ve dvou řadách (0–5
 * a 6–10). Na výšku: hvězdičky, postavička, příklad a nápověda pod sebou
 * a dole číselník ve třech řadách (0–3, 4–7, 8–10).
 */
export function layoutScreen(
  screenWidth: number,
  screenHeight: number,
  buttonCount: number,
  starCount = 0,
): ScreenLayout {
  return screenWidth >= screenHeight
    ? layoutLandscape(screenWidth, screenHeight, buttonCount, starCount)
    : layoutPortrait(screenWidth, screenHeight, buttonCount, starCount);
}

function layoutLandscape(
  screenWidth: number,
  screenHeight: number,
  buttonCount: number,
  starCount: number,
): ScreenLayout {
  const centerX = screenWidth / 2;
  const topRowCount = Math.ceil(buttonCount / 2);

  return {
    problem: { x: centerX + PROBLEM_SHIFT_RIGHT, y: screenHeight * PROBLEM_HEIGHT_RATIO },
    hint: { x: centerX, y: screenHeight * HINT_HEIGHT_RATIO },
    stars: layoutStars(starCount, centerX, STAR_SPACING),
    mascot: {
      x: MASCOT_LEFT_MARGIN + MASCOT_DANCE_SWAY + MASCOT_SIZE / 2,
      y: screenHeight * PROBLEM_HEIGHT_RATIO,
    },
    answerButtons: layoutKeypad(
      [topRowCount, buttonCount - topRowCount],
      centerX,
      screenHeight - BOTTOM_MARGIN,
      ANSWER_BUTTON_SIZE,
    ),
  };
}

function layoutPortrait(
  screenWidth: number,
  screenHeight: number,
  buttonCount: number,
  starCount: number,
): ScreenLayout {
  const centerX = screenWidth / 2;
  const usableWidth = screenWidth - 2 * PORTRAIT_SIDE_MARGIN;
  const buttonSize = Math.min(
    PORTRAIT_BUTTON_SIZE,
    (usableWidth - (PORTRAIT_BUTTONS_PER_ROW - 1) * ANSWER_BUTTON_GAP) / PORTRAIT_BUTTONS_PER_ROW,
  );
  const starSpacing = Math.min(STAR_SPACING, usableWidth / Math.max(starCount, 1));

  const mascotY = STARS_Y + STAR_SIZE / 2 + MASCOT_JUMP_HEIGHT + MASCOT_SIZE / 2 + PORTRAIT_GAP;
  const problemY = mascotY + MASCOT_SIZE / 2 + PORTRAIT_GAP + PROBLEM_TEXT_HEIGHT / 2;
  const hintY = problemY + PROBLEM_TEXT_HEIGHT / 2 + PORTRAIT_GAP + HINT_HALF_HEIGHT;

  return {
    problem: { x: centerX, y: problemY },
    hint: { x: centerX, y: hintY },
    stars: layoutStars(starCount, centerX, starSpacing),
    mascot: { x: centerX, y: mascotY },
    answerButtons: layoutKeypad(
      rowsOf(buttonCount, PORTRAIT_BUTTONS_PER_ROW),
      centerX,
      screenHeight - PORTRAIT_BOTTOM_MARGIN,
      buttonSize,
    ),
  };
}

/** Řada hvězdiček nahoře, vycentrovaná kolem `centerX`. */
function layoutStars(count: number, centerX: number, spacing: number): Point[] {
  const firstX = centerX - ((count - 1) * spacing) / 2;

  return Array.from({ length: count }, (_, index) => ({
    x: firstX + index * spacing,
    y: STARS_Y,
  }));
}

/** Tečka nápovědy; `group` říká, ke kterému sčítanému číslu patří. */
export interface HintDot extends Point {
  readonly group: number;
}

/** Šířka skupinky teček od středu první k středu poslední tečky v řadě. */
function groupWidth(count: number): number {
  return (Math.min(count, HINT_DOTS_PER_ROW) - 1) * HINT_DOT_SPACING;
}

/**
 * Rozmístí tečky nápovědy. Každá skupinka má nejvýš 5 teček v řadě,
 * další pokračují v řadě pod ní. Skupinky jsou vedle sebe, oddělené
 * mezerou, a celé je to vycentrované kolem `center`.
 */
export function layoutHintDots(groups: readonly number[], center: Point): HintDot[] {
  const groupLefts: number[] = [];
  let x = 0;

  groups.forEach((count, groupIndex) => {
    if (groupIndex > 0) {
      x += HINT_DOT_SPACING + HINT_GROUP_GAP;
    }
    groupLefts.push(x);
    x += groupWidth(count);
  });

  const totalWidth = x;
  const dots: HintDot[] = [];

  groups.forEach((count, groupIndex) => {
    const rowCount = Math.ceil(count / HINT_DOTS_PER_ROW);
    const firstRowY = center.y - ((rowCount - 1) * HINT_DOT_SPACING) / 2;
    const left = center.x - totalWidth / 2 + (groupLefts[groupIndex] ?? 0);

    for (let dot = 0; dot < count; dot += 1) {
      const column = dot % HINT_DOTS_PER_ROW;
      const row = Math.floor(dot / HINT_DOTS_PER_ROW);
      dots.push({
        x: left + column * HINT_DOT_SPACING,
        y: firstRowY + row * HINT_DOT_SPACING,
        group: groupIndex,
      });
    }
  });

  return dots;
}
