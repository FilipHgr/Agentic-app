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
const PROBLEM_HEIGHT_RATIO = 0.2;

/** Kde je řada teček nápovědy, poměr k výšce obrazovky. */
const HINT_HEIGHT_RATIO = 0.43;

/** Průměr jedné tečky nápovědy. */
export const HINT_DOT_SIZE = 30;

/** Vzdálenost středů teček v jedné skupince. */
const HINT_DOT_SPACING = 40;

/** Mezera mezi skupinkami teček navíc k běžné vzdálenosti teček. */
const HINT_GROUP_GAP = 50;

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
 * Nahoře příklad, pod ním místo pro nápovědu a dole číselník ve dvou řadách.
 * Horní řada má o tlačítko víc, pokud je počet lichý (0–5 a 6–10).
 */
export function layoutScreen(
  screenWidth: number,
  screenHeight: number,
  buttonCount: number,
): ScreenLayout {
  const topRowCount = Math.ceil(buttonCount / 2);
  const bottomRowCount = buttonCount - topRowCount;

  const bottomRowY = screenHeight - BOTTOM_MARGIN - ANSWER_BUTTON_SIZE / 2;
  const topRowY = bottomRowY - ANSWER_BUTTON_SIZE - ANSWER_BUTTON_GAP;
  const centerX = screenWidth / 2;

  return {
    problem: { x: centerX, y: screenHeight * PROBLEM_HEIGHT_RATIO },
    hint: { x: centerX, y: screenHeight * HINT_HEIGHT_RATIO },
    answerButtons: [
      ...layoutRow(topRowCount, centerX, topRowY),
      ...layoutRow(bottomRowCount, centerX, bottomRowY),
    ],
  };
}

/**
 * Středy teček nápovědy v jedné řadě, skupinky oddělené mezerou,
 * celé vycentrované kolem `center`.
 */
export function layoutHintDots(groups: readonly number[], center: Point): Point[] {
  const offsets: number[] = [];
  let x = 0;

  groups.forEach((count, groupIndex) => {
    if (groupIndex > 0) {
      x += HINT_GROUP_GAP;
    }
    for (let dot = 0; dot < count; dot += 1) {
      offsets.push(x);
      x += HINT_DOT_SPACING;
    }
  });

  const rowWidth = x - HINT_DOT_SPACING;
  return offsets.map((offset) => ({ x: center.x - rowWidth / 2 + offset, y: center.y }));
}
