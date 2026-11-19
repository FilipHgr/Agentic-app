/**
 * Odezva na špatnou odpověď (#155): tlačítko číselníku na chvíli zešedne
 * a zmenší se, „?“ v příkladu poskočí a po 1. chybě se rozzáří žárovka
 * nápovědy. Jen průběh v čase, scéna ho každý snímek přečte a nakreslí.
 * Čistý TypeScript bez Phaseru.
 */

import type { DeviceScreenLayout, DeviceWritingLayout } from './deviceLayout';
import { units } from './phoneScreenParts';
import { slotWidth } from './screenLayout';
import type { ButtonSlot } from './screenLayout';
import type { AnswerButtonState } from './theme';

// ---------------------------------------------------------------------------
// Tlačítko číselníku (AC1, AC5)
// ---------------------------------------------------------------------------

/** Jak dlouho je tlačítko po špatném ťuknutí zešedlé a zmenšené (ms). */
export const WRONG_BUTTON_FEEDBACK_MS = 320;

/** Nejmenší velikost tlačítka během odezvy (nejvýš na 90 %). */
export const WRONG_BUTTON_MIN_SCALE = 0.9;

/** Za jak dlouho od ťuknutí je tlačítko nejmenší (ms); pak se pomaleji vrací. */
const WRONG_BUTTON_PRESS_MS = 80;

export interface WrongButtonFrame {
  /** Velikost proti klidu, mění se kolem středu tlačítka. */
  readonly scale: number;
  readonly state: AnswerButtonState;
}

const RESTING_BUTTON: WrongButtonFrame = { scale: 1, state: 'idle' };

/**
 * Jak vypadá tlačítko v čase `nowMs`, když na něj dítě špatně ťuklo
 * v časech `wrongTapsMs` (vzestupně). Každé další ťuknutí začne odezvu
 * od začátku, takže se tlačítko nikdy nezmenší víc.
 */
export function wrongButtonFrame(wrongTapsMs: readonly number[], nowMs: number): WrongButtonFrame {
  const lastTap = wrongTapsMs[wrongTapsMs.length - 1];
  if (lastTap === undefined) {
    return RESTING_BUTTON;
  }
  const elapsed = nowMs - lastTap;
  if (elapsed < 0 || elapsed >= WRONG_BUTTON_FEEDBACK_MS) {
    return RESTING_BUTTON;
  }
  return { scale: 1 - (1 - WRONG_BUTTON_MIN_SCALE) * pressDepth(elapsed), state: 'wrong' };
}

/** Jak moc je tlačítko stisknuté: 0 v klidu, 1 nejmenší. */
function pressDepth(elapsedMs: number): number {
  if (elapsedMs < WRONG_BUTTON_PRESS_MS) {
    return easeOut(elapsedMs / WRONG_BUTTON_PRESS_MS);
  }
  const release =
    (elapsedMs - WRONG_BUTTON_PRESS_MS) / (WRONG_BUTTON_FEEDBACK_MS - WRONG_BUTTON_PRESS_MS);
  return 1 - easeInOut(release);
}

// ---------------------------------------------------------------------------
// Poskok „?“ (AC2)
// ---------------------------------------------------------------------------

/** Jak dlouho trvá poskok „?“ po špatné odpovědi (ms). */
export const QUESTION_MARK_HOP_MS = 300;

/** Výška poskoku jako část velikosti písma příkladu. */
const HOP_HEIGHT_RATIO = 0.12;

/**
 * Nad příkladem nechávají rozložení telefonu jen 4 CSS px k okraji nebo
 * ke kolečku a domečku (na šířku `BAND_TOP`, na výšku `GEAR_GAP`), proto
 * je tam poskok menší, aby „?“ nic nepřekryl a nevyjel z obrazovky.
 * Aby byl i tak dobře vidět, „?“ se tam navíc zvětší (`questionMarkScaleAt`).
 */
const PHONE_HOP_LIMIT_CSS_PX = 4;

/** Jak vysoko „?“ nejvýš poskočí v rozložení `layout` (herní jednotky). */
function hopHeight(layout: DeviceScreenLayout | DeviceWritingLayout): number {
  const height = layout.problemFontSize * HOP_HEIGHT_RATIO;
  if (layout.device === 'phone') {
    return Math.min(height, units(PHONE_HOP_LIMIT_CSS_PX));
  }
  return height;
}

/**
 * O kolik je „?“ v čase `elapsedMs` od špatné odpovědi výš než v klidu
 * (herní jednotky, 0 = v klidu). Jeden oblouk nahoru a zpět.
 */
export function questionMarkLiftAt(
  elapsedMs: number,
  layout: DeviceScreenLayout | DeviceWritingLayout,
): number {
  if (elapsedMs <= 0 || elapsedMs >= QUESTION_MARK_HOP_MS) {
    return 0;
  }
  return hopHeight(layout) * Math.sin((Math.PI * elapsedMs) / QUESTION_MARK_HOP_MS);
}

/** Kolikrát se „?“ nejvýš zvětší tam, kde na poskok není místo (telefon). */
const QUESTION_MARK_GROW_SCALE = 1.15;

/**
 * Kolikrát je „?“ v čase `elapsedMs` od špatné odpovědi větší než v klidu,
 * kolem svého středu. Na iPadu má poskok místo a „?“ se nezvětšuje; na
 * telefonu, kde je poskok jen malý, se „?“ zvětší a zase zmenší.
 */
export function questionMarkScaleAt(
  elapsedMs: number,
  layout: DeviceScreenLayout | DeviceWritingLayout,
): number {
  if (layout.device !== 'phone' || elapsedMs <= 0 || elapsedMs >= QUESTION_MARK_HOP_MS) {
    return 1;
  }
  const wave = Math.sin((Math.PI * elapsedMs) / QUESTION_MARK_HOP_MS);
  return 1 + (QUESTION_MARK_GROW_SCALE - 1) * wave;
}

/**
 * Výška viditelného „?“ (i ostatních znaků příkladu) jako část velikosti písma. Znak systémového písma
 * je vysoký asi 0,72 písma a leží uprostřed boxu textu (1,2 písma), tady
 * s rezervou. Zvětšuje se kolem středu textu, tedy i kolem středu znaku.
 */
const QUESTION_MARK_HEIGHT_RATIO = 0.8;

/** Šířka „?“ jako část velikosti písma, s rezervou proti skutečnému znaku. */
const QUESTION_MARK_WIDTH_RATIO = 0.6;

/** Obdélník se středem `x`, `y` (herní jednotky). */
export interface CenteredBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Viditelné znaky příkladu (číslice, znaménka, „?“) v klidu: přes celé
 * místo pro příklad, svisle jen výška znaků. Místo pro příklad je vyšší
 * než znaky a žárovka se ho smí dotýkat.
 */
export function problemGlyphsBox(layout: DeviceScreenLayout | DeviceWritingLayout): CenteredBox {
  return {
    x: layout.problem.x,
    y: layout.problem.y,
    width: layout.problemSize.width,
    height: layout.problemFontSize * QUESTION_MARK_HEIGHT_RATIO,
  };
}

/**
 * Kde nejdál může v klidu ležet „?“ (herní jednotky): svisle uprostřed
 * příkladu a vodorovně u pravého okraje místa pro příklad, kam sahá
 * nejdelší příklad rozsahu. Kratší příklad má „?“ blíž středu.
 */
export function questionMarkBox(layout: DeviceScreenLayout | DeviceWritingLayout): CenteredBox {
  const width = layout.problemFontSize * QUESTION_MARK_WIDTH_RATIO;
  return {
    x: layout.problem.x + layout.problemSize.width / 2 - width / 2,
    y: layout.problem.y,
    width,
    height: layout.problemFontSize * QUESTION_MARK_HEIGHT_RATIO,
  };
}

// ---------------------------------------------------------------------------
// Rozzářená žárovka (AC3)
// ---------------------------------------------------------------------------

/** Délka jednoho pulzu záře kolem žárovky (ms). */
export const HINT_GLOW_PULSE_MS = 1400;

/** Nejslabší záře během pulzu (nejsilnější je 1). */
const HINT_GLOW_MIN = 0.45;

export interface HintGlowFrame {
  /** Velikost tlačítka; pulzuje jen záře, tlačítko zůstává stejné. */
  readonly scale: number;
  /** Síla záře kolem tlačítka, 0 až 1. */
  readonly glow: number;
}

/** Jak svítí žárovka v čase `elapsedMs` od rozsvícení; pulz se opakuje. */
export function hintGlowFrameAt(elapsedMs: number): HintGlowFrame {
  const phase = positiveModulo(elapsedMs, HINT_GLOW_PULSE_MS) / HINT_GLOW_PULSE_MS;
  const wave = (1 - Math.cos(2 * Math.PI * phase)) / 2;
  return { scale: 1, glow: 1 - (1 - HINT_GLOW_MIN) * wave };
}

/** Nejširší záře kolem žárovky na iPadu (herní jednotky). */
const TABLET_GLOW_LIMIT = 22;

/**
 * Nejširší záře na telefonu (CSS px). Domeček a kolečko rozložení hry
 * nezná, od nich má žárovka zaručeně aspoň 8 px (#84 AC7), proto záře
 * zůstane o kus užší.
 */
const PHONE_GLOW_LIMIT_CSS_PX = 6;

/** Jak daleko od ostatních ploch záře vždy skončí (CSS px). */
const GLOW_CLEARANCE_CSS_PX = 2;

/**
 * O kolik herních jednotek záře přesahuje žárovku `slot` (#155): co
 * nejvíc, ale vždy kousek před číselníkem, okénky, smazáním, ✓ a
 * příkladem, aby nic nepřekryla. Žárovka sama se nezvětšuje.
 */
export function hintGlowSpread(
  layout: DeviceScreenLayout | DeviceWritingLayout,
  slot: ButtonSlot,
): number {
  const bulb = boxOfSlot(slot);
  const nearest = Math.min(
    ...neighboursOfBulb(layout).map((other) => gapBetweenBoxes(bulb, other)),
  );
  const clearance = GLOW_CLEARANCE_CSS_PX * layout.detailScale;
  const limit = layout.device === 'phone' ? units(PHONE_GLOW_LIMIT_CSS_PX) : TABLET_GLOW_LIMIT;
  return Math.max(0, Math.min(limit, nearest - clearance));
}

/** Plochy, ke kterým záře nesmí dosáhnout: ovládání a znaky příkladu. */
function neighboursOfBulb(layout: DeviceScreenLayout | DeviceWritingLayout): CenteredBox[] {
  const problem = problemGlyphsBox(layout);
  if ('answerButtons' in layout) {
    return [problem, ...layout.answerButtons.map(boxOfSlot)];
  }
  return [
    problem,
    ...layout.writingAreas,
    boxOfSlot(layout.confirmButton),
    boxOfSlot(layout.clearButton),
  ];
}

function boxOfSlot(slot: ButtonSlot): CenteredBox {
  return { x: slot.x, y: slot.y, width: slotWidth(slot), height: slot.size };
}

/** Nejkratší vzdálenost mezi okraji dvou obdélníků (0, když se dotýkají nebo překrývají). */
function gapBetweenBoxes(first: CenteredBox, second: CenteredBox): number {
  const gapX = Math.abs(first.x - second.x) - (first.width + second.width) / 2;
  const gapY = Math.abs(first.y - second.y) - (first.height + second.height) / 2;
  return Math.max(0, Math.max(gapX, gapY));
}

// ---------------------------------------------------------------------------
// Pomůcky
// ---------------------------------------------------------------------------

function easeOut(progress: number): number {
  return 1 - (1 - progress) * (1 - progress);
}

function easeInOut(progress: number): number {
  return (1 - Math.cos(Math.PI * progress)) / 2;
}

function positiveModulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}
