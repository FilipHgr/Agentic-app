/**
 * Rozmístění příkladu a tlačítek na obrazovce. Je tady, a ne ve scéně,
 * aby šlo bez prohlížeče ověřit, že tlačítka jsou dost velká na prst
 * a vejdou se na obrazovku.
 */

/** Strana čtvercového tlačítka s číslem v pixelech hry. */
export const ANSWER_BUTTON_SIZE = 180;

/** Mezera mezi tlačítky, aby se netrefilo vedlejší. */
export const ANSWER_BUTTON_GAP = 60;

/** Kde je příklad, poměr k výšce obrazovky. */
const PROBLEM_HEIGHT_RATIO = 0.32;

/** Kde je řada tlačítek, poměr k výšce obrazovky. */
const BUTTONS_HEIGHT_RATIO = 0.72;

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
  readonly answerButtons: readonly ButtonSlot[];
}

/** Rozmístí příklad nahoru a pod něj vodorovnou řadu tlačítek uprostřed. */
export function layoutScreen(
  screenWidth: number,
  screenHeight: number,
  buttonCount: number,
): ScreenLayout {
  const rowWidth = buttonCount * ANSWER_BUTTON_SIZE + (buttonCount - 1) * ANSWER_BUTTON_GAP;
  const firstCenterX = (screenWidth - rowWidth) / 2 + ANSWER_BUTTON_SIZE / 2;
  const buttonsY = screenHeight * BUTTONS_HEIGHT_RATIO;

  const answerButtons = Array.from({ length: buttonCount }, (_, index) => ({
    x: firstCenterX + index * (ANSWER_BUTTON_SIZE + ANSWER_BUTTON_GAP),
    y: buttonsY,
    size: ANSWER_BUTTON_SIZE,
  }));

  return {
    problem: { x: screenWidth / 2, y: screenHeight * PROBLEM_HEIGHT_RATIO },
    answerButtons,
  };
}
