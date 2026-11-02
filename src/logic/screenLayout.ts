/**
 * Rozmístění příkladu, nápovědy a číselníku na obrazovce. Je tady, a ne ve
 * scéně, aby šlo bez prohlížeče ověřit, že tlačítka jsou dost velká na prst
 * a všechno se vejde na obrazovku.
 */

/** Strana čtvercového tlačítka s číslem v pixelech hry. */
export const ANSWER_BUTTON_SIZE = 140;

/** Mezera mezi tlačítky, aby se netrefilo vedlejší. */
export const ANSWER_BUTTON_GAP = 20;

/** Okraj pod spodní řadou tlačítek. */
const BOTTOM_MARGIN = 24;

/** Kde je příklad, poměr k výšce obrazovky. */
const PROBLEM_HEIGHT_RATIO = 0.24;

/** Kde je střed nápovědy s tečkami, poměr k výšce obrazovky. */
const HINT_HEIGHT_RATIO = 0.45;

/** Průměr jedné tečky nápovědy, dost velký na počítání prstem i okem. */
export const HINT_DOT_SIZE = 50;

/** Vzdálenost středů sousedních teček ve skupince (vodorovně i svisle). */
const HINT_DOT_SPACING = 64;

/** Nejvíc teček v jedné řadě skupinky, jako na počítadle: 7 = 5 + 2. */
export const HINT_DOTS_PER_ROW = 5;

/** Mezera mezi skupinkami navíc k běžné vzdálenosti teček. */
const HINT_GROUP_GAP = 60;

/** Velikost jedné hvězdičky v řadě nahoře. */
export const STAR_SIZE = 48;

/** Vzdálenost středů sousedních hvězdiček. */
const STAR_SPACING = 60;

/** Svislá poloha středu řady hvězdiček. */
const STARS_Y = 40;

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
  /** Místa tlačítek ve stejném pořadí, v jakém jsou čísla na číselníku. */
  readonly answerButtons: readonly ButtonSlot[];
}

/** Vodorovná řada tlačítek se středem `centerX`. */
function layoutRow(count: number, centerX: number, y: number): ButtonSlot[] {
  const rowWidth = count * ANSWER_BUTTON_SIZE + (count - 1) * ANSWER_BUTTON_GAP;
  const firstX = centerX - rowWidth / 2 + ANSWER_BUTTON_SIZE / 2;

  return Array.from({ length: count }, (_, index) => ({
    x: firstX + index * (ANSWER_BUTTON_SIZE + ANSWER_BUTTON_GAP),
    y,
    size: ANSWER_BUTTON_SIZE,
  }));
}

/**
 * Úplně nahoře hvězdičky, pod nimi příklad, pod ním místo pro nápovědu a dole číselník ve dvou řadách.
 * Horní řada má o tlačítko víc, pokud je počet lichý (0–5 a 6–10).
 */
export function layoutScreen(
  screenWidth: number,
  screenHeight: number,
  buttonCount: number,
  starCount = 0,
): ScreenLayout {
  const topRowCount = Math.ceil(buttonCount / 2);
  const bottomRowCount = buttonCount - topRowCount;

  const bottomRowY = screenHeight - BOTTOM_MARGIN - ANSWER_BUTTON_SIZE / 2;
  const topRowY = bottomRowY - ANSWER_BUTTON_SIZE - ANSWER_BUTTON_GAP;
  const centerX = screenWidth / 2;

  return {
    problem: { x: centerX, y: screenHeight * PROBLEM_HEIGHT_RATIO },
    hint: { x: centerX, y: screenHeight * HINT_HEIGHT_RATIO },
    stars: layoutStars(starCount, centerX),
    answerButtons: [
      ...layoutRow(topRowCount, centerX, topRowY),
      ...layoutRow(bottomRowCount, centerX, bottomRowY),
    ],
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
