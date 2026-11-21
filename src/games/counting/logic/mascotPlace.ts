/**
 * Kde v Počítání stojí panda (#167). Čistý TypeScript bez Phaseru.
 *
 * Panda je ozdoba: nic dnešního kvůli ní neustoupí ani se nezmenší (AC2).
 * Dostane jen místo, které je volné ve všech stavech jedné hry v daném
 * okně, rozsahu, ovládání a druhu příkladů (0–10 hvězdiček, bez nápovědy,
 * s tlačítkem nápovědy i s tečkami libovolného příkladu), aby se během hry
 * nikam neposouvala (AC3). Místo je aspoň 96 CSS px vysoké, šířka podle
 * poměru snímku pandy, a aspoň 4 CSS px od všech prvků i od okraje (AC1).
 * Když takové místo není, panda není vidět vůbec.
 *
 * První verze je jen na iPadu (rozložení `tablet`); telefony dostanou
 * pandu s vlastním rozložením v dalším úkolu (#167 mimo rozsah).
 *
 * Všechno se počítá v CSS px okna a výsledek se převede na herní
 * jednotky plochy, ve kterých scéna kreslí.
 */

import { MASCOT_FRAME_SIZE } from '../../../shared/logic/mascot';
import type { MascotArea } from '../../../shared/logic/mascot';
import { homeButtonFor } from '../../../shared/logic/homeButton';
import { settingsGearFor } from '../../../shared/logic/settingsGear';
import type { GameArea, Viewport } from '../../../shared/logic/viewportLayout';
import { answerChoices, hintDotGroups } from './answerRound';
import { layoutDeviceHint, layoutDeviceScreen, layoutDeviceWritingScreen } from './deviceLayout';
import type { DeviceScreenLayout, DeviceWritingLayout } from './deviceLayout';
import { problemsOf } from './problems';
import type { Problem } from './problems';
import { layoutHintButton, slotWidth } from './screenLayout';
import type { ButtonSlot } from './screenLayout';
import { isWritingActive } from './settings';
import type { GameSettings, Operation, OperationMode } from './settings';
import { STARS_PER_SET } from './stars';
import { hintGlowSpread } from './wrongAnswerFeedback';

/** Nejmenší výška pandy v CSS px; menší by na obrazovce nebyla k poznání (AC1). */
export const MASCOT_MIN_HEIGHT_CSS_PX = 96;

/**
 * Největší výška pandy v CSS px: větší by na iPadu při rozsahu do 5
 * přebila příklad. V menším místě je panda menší.
 */
export const MASCOT_MAX_HEIGHT_CSS_PX = 180;

/** Odstup pandy od všech prvků hry a od okraje v CSS px (AC1). */
export const MASCOT_GAP_CSS_PX = 4;

/** Obdélník v CSS px okna. */
export interface MascotBox {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

/** Poměr šířky a výšky snímku pandy. */
const MASCOT_ASPECT = MASCOT_FRAME_SIZE.width / MASCOT_FRAME_SIZE.height;

type PlayLayout = DeviceScreenLayout | DeviceWritingLayout;

/**
 * Místo pandy v CSS px okna, nebo `null`, když panda nemá být vidět.
 * Místo je co největší volné (panda nejvýš 180 px); ze stejně velkých
 * vyhraje to nejvíc vlevo a pak nejvýš, aby bylo pokaždé stejné.
 */
export function countingMascotBox(
  area: GameArea,
  viewport: Viewport,
  settings: GameSettings,
): MascotBox | null {
  if (area.mode !== 'tablet') {
    return null;
  }
  const free = shrink(visibleArea(area, viewport), MASCOT_GAP_CSS_PX);
  const obstacles = occupiedBoxes(area, viewport, settings).map((box) =>
    grow(box, MASCOT_GAP_CSS_PX),
  );
  const found = largestFreeBox(free, obstacles);
  if (found === null || found.bottom - found.top < MASCOT_MIN_HEIGHT_CSS_PX) {
    return null;
  }
  return limitHeight(found, MASCOT_MAX_HEIGHT_CSS_PX);
}

/** Menší panda ve velkém místě stojí dole uprostřed něj (nohy na spodní hraně). */
function limitHeight(box: MascotBox, maxHeight: number): MascotBox {
  const height = Math.min(box.bottom - box.top, maxHeight);
  const width = height * MASCOT_ASPECT;
  const centerX = (box.left + box.right) / 2;
  return {
    left: centerX - width / 2,
    top: box.bottom - height,
    right: centerX + width / 2,
    bottom: box.bottom,
  };
}

/**
 * Místo pandy v herních jednotkách plochy pro `Mascot.place`, nebo `null`,
 * když panda nemá být vidět.
 */
export function countingMascotArea(
  area: GameArea,
  viewport: Viewport,
  settings: GameSettings,
): MascotArea | null {
  const box = countingMascotBox(area, viewport, settings);
  if (box === null) {
    return null;
  }
  return {
    x: (box.left - area.offsetX) / area.scale,
    y: (box.top - area.offsetY) / area.scale,
    width: (box.right - box.left) / area.scale,
    height: (box.bottom - box.top) / area.scale,
  };
}

// ---------------------------------------------------------------------------
// Co hra na obrazovce zabírá
// ---------------------------------------------------------------------------

/** Kde je hra vidět: volná plocha okna (bez výřezu a lišt) a zároveň herní plocha. */
function visibleArea(area: GameArea, viewport: Viewport): MascotBox {
  const { safeArea } = viewport;
  return {
    left: Math.max(safeArea.left, area.offsetX),
    top: Math.max(safeArea.top, area.offsetY),
    right: Math.min(viewport.width - safeArea.right, area.offsetX + area.width * area.scale),
    bottom: Math.min(viewport.height - safeArea.bottom, area.offsetY + area.height * area.scale),
  };
}

/** Všechno, co hra v některém stavu nakreslí, v CSS px okna. */
function occupiedBoxes(area: GameArea, viewport: Viewport, settings: GameSettings): MascotBox[] {
  const toCss = (box: MascotBox): MascotBox => ({
    left: area.offsetX + box.left * area.scale,
    right: area.offsetX + box.right * area.scale,
    top: area.offsetY + box.top * area.scale,
    bottom: area.offsetY + box.bottom * area.scale,
  });
  const problems = problemsFor(settings.maxNumber, settings.operations);
  const unitBoxes = playLayoutsFor(area, settings).flatMap((layout) => [
    ...layoutBoxes(layout),
    ...hintBoxes(layout, problems),
  ]);
  return [...pageButtons(viewport), ...unitBoxes.map(toCss)];
}

/**
 * Rozložení, ve kterých se hra může ukázat. Při psaní i číselník: když se
 * rozpoznávání nestáhne, příklad se dohraje číselníkem (#58) a panda kvůli
 * tomu nesmí uhnout.
 */
function playLayoutsFor(area: GameArea, settings: GameSettings): PlayLayout[] {
  const { maxNumber, operations } = settings;
  const keypad = layoutDeviceScreen(
    area,
    answerChoices(maxNumber).length,
    STARS_PER_SET,
    [],
    operations,
  );
  if (!isWritingActive(settings)) {
    return [keypad];
  }
  return [keypad, layoutDeviceWritingScreen(area, maxNumber, STARS_PER_SET, [], operations)];
}

/** Domeček a kolečko nastavení na stránce (CSS px). */
function pageButtons(viewport: Viewport): MascotBox[] {
  const home = homeButtonFor(viewport);
  const gear = settingsGearFor(viewport);
  const gearRight = viewport.width - gear.right;
  return [
    {
      left: home.left,
      top: home.top,
      right: home.left + home.hitSize,
      bottom: home.top + home.hitSize,
    },
    {
      left: gearRight - gear.hitSize,
      top: gear.top,
      right: gearRight,
      bottom: gear.top + gear.hitSize,
    },
  ];
}

function centeredBox(x: number, y: number, width: number, height: number): MascotBox {
  return { left: x - width / 2, top: y - height / 2, right: x + width / 2, bottom: y + height / 2 };
}

function slotBox(slot: ButtonSlot, spread = 0): MascotBox {
  return centeredBox(slot.x, slot.y, slotWidth(slot) + 2 * spread, slot.size + 2 * spread);
}

/** Plná řada hvězdiček, příklad a ovládání (herní jednotky). */
function layoutBoxes(layout: PlayLayout): MascotBox[] {
  const stars = layout.stars.map((star) =>
    centeredBox(star.x, star.y, layout.starSize, layout.starSize),
  );
  const problem = centeredBox(
    layout.problem.x,
    layout.problem.y,
    layout.problemSize.width,
    layout.problemSize.height,
  );
  return [...stars, problem, ...controlBoxes(layout)];
}

function controlBoxes(layout: PlayLayout): MascotBox[] {
  if ('answerButtons' in layout) {
    return layout.answerButtons.map((slot) => slotBox(slot));
  }
  return [
    ...layout.writingAreas.map((slot) => centeredBox(slot.x, slot.y, slot.width, slot.height)),
    slotBox(layout.clearButton),
    slotBox(layout.confirmButton),
  ];
}

/**
 * Tlačítko nápovědy i se září po chybě (#84, #155) a obdélník kolem teček
 * nápovědy všech příkladů, které v nastavení mohou přijít (herní jednotky).
 */
function hintBoxes(layout: PlayLayout, problems: readonly Problem[]): MascotBox[] {
  const button = layoutHintButton(layout);
  const boxes = [slotBox(button, hintGlowSpread(layout, button))];
  const dotSide = Math.max(layout.hintDotHitSize, layout.hintStyle.dotSize);
  const dots = distinctGroups(problems).flatMap((groups) => layoutDeviceHint(layout, groups));
  if (dots.length > 0) {
    boxes.push(boundsOf(dots.map((dot) => centeredBox(dot.x, dot.y, dotSide, dotSide))));
  }
  return boxes;
}

function problemsFor(maxNumber: number, operations: OperationMode): Problem[] {
  const kinds: Operation[] = operations === 'mixed' ? ['plus', 'minus'] : [operations];
  return kinds.flatMap((operation) => problemsOf(operation, maxNumber));
}

/** Skupinky teček nápovědy bez opakování (rozložení teček závisí jen na nich). */
function distinctGroups(problems: readonly Problem[]): number[][] {
  const unique = new Map<string, number[]>();
  for (const problem of problems) {
    const groups = hintDotGroups(problem);
    if (groups.length > 0) {
      unique.set(groups.join('+'), groups);
    }
  }
  return [...unique.values()];
}

// ---------------------------------------------------------------------------
// Největší volné místo
// ---------------------------------------------------------------------------

function grow(box: MascotBox, by: number): MascotBox {
  return { left: box.left - by, top: box.top - by, right: box.right + by, bottom: box.bottom + by };
}

function shrink(box: MascotBox, by: number): MascotBox {
  return grow(box, -by);
}

function boundsOf(boxes: readonly MascotBox[]): MascotBox {
  return {
    left: Math.min(...boxes.map((box) => box.left)),
    top: Math.min(...boxes.map((box) => box.top)),
    right: Math.max(...boxes.map((box) => box.right)),
    bottom: Math.max(...boxes.map((box) => box.bottom)),
  };
}

/**
 * Nejvyšší obdélník s poměrem stran pandy uvnitř `free`, který se nedotkne
 * žádné překážky. Největší obdélník jde vždy posunout doleva a nahoru, až
 * narazí na okraj nebo překážku, proto stačí zkusit levé horní rohy na
 * okraji a za pravými a spodními hranami překážek.
 */
function largestFreeBox(free: MascotBox, obstacles: readonly MascotBox[]): MascotBox | null {
  const lefts = sortedUnique([free.left, ...obstacles.map((box) => box.right)]).filter(
    (x) => x >= free.left && x < free.right,
  );
  const tops = sortedUnique([free.top, ...obstacles.map((box) => box.bottom)]).filter(
    (y) => y >= free.top && y < free.bottom,
  );
  let best: MascotBox | null = null;
  let bestHeight = 0;
  for (const left of lefts) {
    for (const top of tops) {
      const height = tallestAt(left, top, free, obstacles);
      if (height > bestHeight) {
        bestHeight = height;
        best = { left, top, right: left + height * MASCOT_ASPECT, bottom: top + height };
      }
    }
  }
  return best;
}

/** Nejvyšší obdélník s levým horním rohem v `left`, `top`, který nic nepřekryje. */
function tallestAt(
  left: number,
  top: number,
  free: MascotBox,
  obstacles: readonly MascotBox[],
): number {
  let height = Math.min((free.right - left) / MASCOT_ASPECT, free.bottom - top);
  for (const box of obstacles) {
    const covers =
      box.right > left &&
      box.bottom > top &&
      box.left < left + height * MASCOT_ASPECT &&
      box.top < top + height;
    if (covers) {
      // Obdélník musí skončit před překážkou zleva, nebo shora.
      height = Math.min(height, Math.max((box.left - left) / MASCOT_ASPECT, box.top - top));
    }
  }
  return Math.max(0, height);
}

function sortedUnique(values: readonly number[]): number[] {
  return [...new Set(values)].sort((first, second) => first - second);
}
