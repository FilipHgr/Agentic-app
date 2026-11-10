import { describe, expect, it } from 'vitest';

import {
  createAnswerRound,
  hintDotGroups,
  isHintVisible,
  tapAnswer,
} from '../../../src/games/counting/logic/answerRound';
import type { AnswerRound } from '../../../src/games/counting/logic/answerRound';
import {
  layoutDeviceGuideStep,
  layoutDeviceHint,
  layoutDeviceScreen,
  layoutDeviceSettingsPanel,
  layoutDeviceWritingScreen,
  playStateAfterResize,
} from '../../../src/games/counting/logic/deviceLayout';
import type { PanelPlacement, PlayState } from '../../../src/games/counting/logic/deviceLayout';
import { recognizeDigit } from '../../../src/games/counting/logic/digitRecognition';
import type { Stroke, WritingAreaSize } from '../../../src/games/counting/logic/digitRecognition';
import { startDotCounting } from '../../../src/games/counting/logic/dotCounting';
import type { Problem } from '../../../src/games/counting/logic/problems';
import { STAR_SIZE, slotWidth } from '../../../src/games/counting/logic/screenLayout';
import type { ButtonSlot } from '../../../src/games/counting/logic/screenLayout';
import type { GameSettings, MaxNumber } from '../../../src/games/counting/logic/settings';
import { CLOSED_SETTINGS } from '../../../src/games/counting/logic/settingsSession';
import { GUIDE_STEPS } from './parentPanelCss';
import {
  createWritingRound,
  finishStroke,
  startStroke,
  writtenStrokes,
} from '../../../src/games/counting/logic/writingRound';
import type { WritingRound } from '../../../src/games/counting/logic/writingRound';
import { STARS_PER_SET } from '../../../src/games/counting/logic/stars';
import {
  CANVAS_PIXELS_PER_CSS_PX,
  canvasResolutionFor,
  windowToGamePoint,
} from '../../../src/shared/logic/canvasResolution';
import type { CanvasResolution } from '../../../src/shared/logic/canvasResolution';
import { gameAreaFor } from '../../../src/shared/logic/viewportLayout';
import type { GameArea } from '../../../src/shared/logic/viewportLayout';
import { seededRandom } from './seededRandom';
import { tabletCssLayouts } from './tabletCss';
import { NOT_DIGITS } from './notDigitStrokes';
import { placeStroke, uciTestSamples } from './penDigits';
import {
  IPAD_WINDOWS,
  JUST_ABOVE_LIMIT,
  NO_NOTCH,
  PHONE_PORTRAIT_WINDOWS,
  PHONE_WINDOWS,
  TODAY_GAME_HEIGHT,
  TODAY_GAME_WIDTH,
  viewportOf,
} from '../../shared/viewportFixtures';
import type { Box, Placement, TestWindow } from '../../shared/viewportFixtures';

/**
 * Testy k #77 (ostré číslice a tlačítka v Počítání na iPadu a ve
 * zmenšeném zobrazení): plátno se kreslí ve 2 obrazových bodech na CSS px,
 * herní souřadnice prvků se nemění.
 *
 * „Dnes“ je hra 1024 × 768 zobrazená přes Phaser Scale.FIT: herní bod
 * (x, y) je v okně na `offset + x · scale` CSS px. „Nově“ je stejný bod
 * na plátně ve 2× na `offset + x · zoom / 2` CSS px (`canvasResolutionFor`)
 * a dotyk se do herních jednotek převede přes `windowToGamePoint`.
 *
 * AC2: pevné body dnešního rozložení (`tabletLayoutUnchanged.test.ts`,
 * `parentPanelsUnchanged.test.ts`, do #81 snapshoty) musí dál projít.
 * Tady se navíc ověří, že nové plátno ukáže každý prvek na stejném místě
 * v okně jako dnes (s tolerancí půl CSS px na zaokrouhlení plátna).
 * Konfety oslavy nemají rozložení v logice, jejich ostrost je ruční kontrola.
 */

/** Tolerance v CSS px: plátno má celé obrazové body, okno může mít liché rozměry. */
const CSS_TOLERANCE = 0.5;

/** O kolik CSS px dovnitř od hrany tlačítka dítě ťukne. */
const EDGE_INSET_CSS = 1;

/** Rozpoznání vzorků ve všech okénkách trvá déle než běžný test (dřív 60 s na jedno okénko). */
const SLOW_TEST_TIMEOUT_MS = 120_000;

/** Ze sady tahů stačí každý 20. vzorek na každé rozložení. */
const SAMPLE_STEP = 20;

const RANGES: MaxNumber[] = [5, 10, 20];

function windowOf(name: string, width: number, height: number): TestWindow {
  return { name, width, height, safeArea: NO_NOTCH };
}

/** iPad, počítač a zmenšené zobrazení (Split View, malé okno). */
const SHARP_WINDOWS: readonly TestWindow[] = [
  ...IPAD_WINDOWS,
  JUST_ABOVE_LIMIT,
  windowOf('počítač 1920×1080', 1920, 1080),
  windowOf('iPad na výšku 820×1180', 820, 1180),
  windowOf('iPad ve Split View 678×820', 678, 820),
  windowOf('malé okno počítače 800×600', 800, 600),
  windowOf('nízké okno 667×320', 667, 320),
  windowOf('iPhone SE s lištami 375×553', 375, 553),
];

function areaOf(window: TestWindow): GameArea {
  return gameAreaFor(viewportOf(window));
}

/** Dnešní umístění herní plochy v okně (Phaser Scale.FIT). */
function todayPlacementOf(area: GameArea): Placement {
  return { scale: area.scale, offsetX: area.offsetX, offsetY: area.offsetY };
}

/** Umístění herní plochy na ostrém plátně: kamera zvětší jednotky na obrazové body. */
function sharpPlacementOf(resolution: CanvasResolution): Placement {
  return {
    scale: resolution.zoom / CANVAS_PIXELS_PER_CSS_PX,
    offsetX: resolution.offsetX,
    offsetY: resolution.offsetY,
  };
}

/** Dnes: dotyk v okně (CSS px) na herní souřadnice. */
function todayGamePoint(area: GameArea, css: { x: number; y: number }): { x: number; y: number } {
  return { x: (css.x - area.offsetX) / area.scale, y: (css.y - area.offsetY) / area.scale };
}

function toCssPoint(placement: Placement, x: number, y: number): { x: number; y: number } {
  return { x: placement.offsetX + x * placement.scale, y: placement.offsetY + y * placement.scale };
}

/** Porovná dvě stejně stavěná rozložení v CSS px; čísla smí lišit nejvýš o `tolerance`. */
function expectSamePlaces(
  actual: unknown,
  expected: unknown,
  path: string,
  tolerance: number,
): void {
  if (typeof expected === 'number') {
    expect(typeof actual, path).toBe('number');
    expect(Math.abs((actual as number) - expected), path).toBeLessThanOrEqual(tolerance);
    return;
  }
  if (expected !== null && typeof expected === 'object') {
    expect(actual !== null && typeof actual === 'object', path).toBe(true);
    const actualRecord = actual as Record<string, unknown>;
    const expectedRecord = expected as Record<string, unknown>;
    expect(Object.keys(actualRecord).sort(), path).toEqual(Object.keys(expectedRecord).sort());
    for (const key of Object.keys(expectedRecord)) {
      expectSamePlaces(actualRecord[key], expectedRecord[key], `${path}.${key}`, tolerance);
    }
    return;
  }
  expect(actual, path).toEqual(expected);
}

// ---------------------------------------------------------------------------
// Prvky, na které jde ťuknout, v herních jednotkách
// ---------------------------------------------------------------------------

interface Target {
  readonly name: string;
  readonly box: Box;
}

function centeredBox(x: number, y: number, width: number, height: number): Box {
  return { left: x - width / 2, right: x + width / 2, top: y - height / 2, bottom: y + height / 2 };
}

function buttonBox(slot: ButtonSlot): Box {
  return centeredBox(slot.x, slot.y, slotWidth(slot), slot.size);
}

/** Obdélník panelu (nastavení, průvodce) přepočtený na herní jednotky. */
function panelBox(box: Box, placement: PanelPlacement): Box {
  return {
    left: placement.x + box.left * placement.scale,
    right: placement.x + box.right * placement.scale,
    top: placement.y + box.top * placement.scale,
    bottom: placement.y + box.bottom * placement.scale,
  };
}

function plus(first: number, second: number): Problem {
  return { first, second, operation: 'plus', result: first + second };
}

/** Příklad s nejvíc tečkami nápovědy v rozsahu. */
function fullHintProblem(maxNumber: MaxNumber): Problem {
  return plus(Math.floor(maxNumber / 2), Math.ceil(maxNumber / 2));
}

function keypadTargets(area: GameArea, maxNumber: MaxNumber): Target[] {
  const layout = layoutDeviceScreen(area, maxNumber + 1, STARS_PER_SET);
  return layout.answerButtons.map((slot, index) => ({
    name: `číslo ${index}`,
    box: buttonBox(slot),
  }));
}

function writingTargets(area: GameArea, maxNumber: MaxNumber): Target[] {
  const layout = layoutDeviceWritingScreen(area, maxNumber, STARS_PER_SET);
  return [
    { name: '✓', box: buttonBox(layout.confirmButton) },
    { name: 'smazat', box: buttonBox(layout.clearButton) },
    ...layout.writingAreas.map((slot, index) => ({
      name: `okénko ${index + 1}`,
      box: centeredBox(slot.x, slot.y, slot.width, slot.height),
    })),
  ];
}

/** Tečky nápovědy, na které jde ťukat a počítat je (na iPadu do 5 a do 10, #43). */
function hintDotTargets(area: GameArea, maxNumber: MaxNumber): Target[] {
  const layout = layoutDeviceScreen(area, maxNumber + 1, STARS_PER_SET);
  if (!layout.hintDotsCountable) {
    return [];
  }
  return layoutDeviceHint(layout, hintDotGroups(fullHintProblem(maxNumber))).map((dot, index) => ({
    name: `tečka ${index + 1}`,
    box: centeredBox(dot.x, dot.y, layout.hintDotHitSize, layout.hintDotHitSize),
  }));
}

function settingsTargets(area: GameArea): Target[] {
  const layout = layoutDeviceSettingsPanel(area);
  const options = layout.rows.flatMap((row) =>
    row.options.map((option) => ({
      name: `${row.kind} ${String(option.value)}`,
      box: panelBox(centeredBox(option.x, option.y, option.width, option.height), layout.placement),
    })),
  );
  return [
    ...options,
    { name: '✓ nastavení', box: panelBox(buttonBox(layout.confirm), layout.placement) },
  ];
}

function guideTargets(area: GameArea): Target[] {
  const targets: Target[] = [];
  for (const step of GUIDE_STEPS) {
    const layout = layoutDeviceGuideStep(area, step);
    const slots = [
      ['Další', layout.right],
      ['Zpět', layout.back],
      ['reproduktor', layout.speaker],
    ] as const;
    const buttons: Target[] = [];
    for (const [name, slot] of slots) {
      if (slot) {
        buttons.push({
          name: `krok ${step} ${name}`,
          box: panelBox(centeredBox(slot.x, slot.y, slot.width, slot.height), layout.placement),
        });
      }
    }
    targets.push(...buttons);
  }
  return targets;
}

/** Tlačítka, která jsou na obrazovce současně (aby šlo hlídat i souseda). */
function screensOf(area: GameArea): Array<{ name: string; targets: Target[] }> {
  const screens: Array<{ name: string; targets: Target[] }> = [];
  for (const maxNumber of RANGES) {
    screens.push({ name: `číselník do ${maxNumber}`, targets: keypadTargets(area, maxNumber) });
    screens.push({ name: `psaní do ${maxNumber}`, targets: writingTargets(area, maxNumber) });
    screens.push({ name: `tečky do ${maxNumber}`, targets: hintDotTargets(area, maxNumber) });
  }
  screens.push({ name: 'nastavení', targets: settingsTargets(area) });
  for (const step of GUIDE_STEPS) {
    screens.push({
      name: `průvodce krok ${step}`,
      targets: guideTargets(area).filter((target) => target.name.startsWith(`krok ${step} `)),
    });
  }
  return screens;
}

/** Index prvního prvku, do kterého bod padl, nebo -1. */
function hitIndex(targets: readonly Target[], point: { x: number; y: number }): number {
  return targets.findIndex(
    (target) =>
      point.x >= target.box.left &&
      point.x <= target.box.right &&
      point.y >= target.box.top &&
      point.y <= target.box.bottom,
  );
}

/** Body 1 CSS px uvnitř od každé hrany a rohu prvku, v CSS px okna podle dnešního zobrazení. */
function edgeTapsOf(target: Target, placement: Placement): Array<{ x: number; y: number }> {
  const inset = EDGE_INSET_CSS / placement.scale;
  const left = target.box.left + inset;
  const right = target.box.right - inset;
  const top = target.box.top + inset;
  const bottom = target.box.bottom - inset;
  const midX = (target.box.left + target.box.right) / 2;
  const midY = (target.box.top + target.box.bottom) / 2;
  return [
    [left, midY],
    [right, midY],
    [midX, top],
    [midX, bottom],
    [left, top],
    [right, top],
    [left, bottom],
    [right, bottom],
    [midX, midY],
  ].map(([x, y]) => toCssPoint(placement, x ?? 0, y ?? 0));
}

// ---------------------------------------------------------------------------
// AC2
// ---------------------------------------------------------------------------

describe('AC2: na ostrém plátně je všechno na stejném místě a stejně velké jako dnes', () => {
  it('příklad, hvězdičky, číselník, tečky nápovědy a okénka na psaní jsou tam, kde dnes', () => {
    for (const window of SHARP_WINDOWS) {
      const area = areaOf(window);
      const resolution = canvasResolutionFor(area);

      expectSamePlaces(
        tabletCssLayouts(TODAY_GAME_WIDTH, TODAY_GAME_HEIGHT, sharpPlacementOf(resolution)),
        tabletCssLayouts(TODAY_GAME_WIDTH, TODAY_GAME_HEIGHT, todayPlacementOf(area)),
        window.name,
        CSS_TOLERANCE,
      );
    }
  });

  it('nastavení pro rodiče a všechny kroky průvodce jsou tam, kde dnes', () => {
    for (const window of SHARP_WINDOWS) {
      const area = areaOf(window);
      const today = todayPlacementOf(area);
      const sharp = sharpPlacementOf(canvasResolutionFor(area));
      const targets = [...settingsTargets(area), ...guideTargets(area)];

      for (const target of targets) {
        const { box } = target;
        for (const [x, y] of [
          [box.left, box.top],
          [box.right, box.bottom],
        ] as const) {
          const todayPoint = toCssPoint(today, x, y);
          const sharpPoint = toCssPoint(sharp, x, y);
          const where = `${window.name}, ${target.name}`;
          expect(Math.abs(sharpPoint.x - todayPoint.x), where).toBeLessThanOrEqual(CSS_TOLERANCE);
          expect(Math.abs(sharpPoint.y - todayPoint.y), where).toBeLessThanOrEqual(CSS_TOLERANCE);
        }
      }
    }
  });

  it('hvězdička i tlačítko mají na ostrém plátně stejnou velikost jako dnes', () => {
    for (const window of SHARP_WINDOWS) {
      const area = areaOf(window);
      const sharp = sharpPlacementOf(canvasResolutionFor(area));
      const buttonSize = keypadTargets(area, 10)[0]?.box;
      if (!buttonSize) {
        throw new Error('číselník nemá tlačítka');
      }
      const width = buttonSize.right - buttonSize.left;

      expect(
        Math.abs(STAR_SIZE * sharp.scale - STAR_SIZE * area.scale),
        `${window.name}, hvězdička`,
      ).toBeLessThanOrEqual(CSS_TOLERANCE);
      expect(
        Math.abs(width * sharp.scale - width * area.scale),
        `${window.name}, tlačítko`,
      ).toBeLessThanOrEqual(CSS_TOLERANCE);
    }
  });

  it('rozložení v herních jednotkách se nemění', () => {
    for (const window of SHARP_WINDOWS) {
      const area = areaOf(window);

      expect(area.width, window.name).toBe(TODAY_GAME_WIDTH);
      expect(area.height, window.name).toBe(TODAY_GAME_HEIGHT);
      expect(['tablet', 'scaled'], window.name).toContain(area.mode);
    }
  });
});

// ---------------------------------------------------------------------------
// AC3 a AC6 (ťuknutí)
// ---------------------------------------------------------------------------

describe('AC3: ťuknutí trefí stejné tlačítko jako dnes, i na kraji', () => {
  it('ťuknutí na kraj čísla, ✓, smazat, tečky, řady nastavení i tlačítka průvodce trefí stejný prvek', () => {
    for (const window of SHARP_WINDOWS) {
      const area = areaOf(window);
      const resolution = canvasResolutionFor(area);
      const today = todayPlacementOf(area);

      for (const screen of screensOf(area)) {
        screen.targets.forEach((target, index) => {
          for (const tap of edgeTapsOf(target, today)) {
            const todayHit = hitIndex(screen.targets, todayGamePoint(area, tap));
            const sharpHit = hitIndex(screen.targets, windowToGamePoint(resolution, tap));
            const label = `${window.name}, ${screen.name}, ${target.name}`;
            expect(todayHit, `${label} dnes`).toBe(index);
            expect(sharpHit, label).toBe(todayHit);
          }
        });
      }
    }
  });

  it('ťuknutí do mezery mezi čísly nic netrefí jako dnes', () => {
    for (const window of SHARP_WINDOWS) {
      const area = areaOf(window);
      const resolution = canvasResolutionFor(area);
      const today = todayPlacementOf(area);
      const targets = keypadTargets(area, 10);

      for (let index = 0; index + 1 < targets.length; index += 1) {
        const current = targets[index];
        const following = targets[index + 1];
        if (!current || !following || following.box.left <= current.box.right) {
          continue;
        }
        if (Math.abs(following.box.top - current.box.top) > 0.01) {
          continue;
        }
        const gapX = (current.box.right + following.box.left) / 2;
        const midY = (current.box.top + current.box.bottom) / 2;
        const tap = toCssPoint(today, gapX, midY);

        const where = `${window.name}, mezi ${current.name} a ${following.name}`;
        expect(hitIndex(targets, todayGamePoint(area, tap)), `${where} dnes`).toBe(-1);
        expect(hitIndex(targets, windowToGamePoint(resolution, tap)), where).toBe(-1);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// AC4
// ---------------------------------------------------------------------------

interface WritingCase {
  readonly name: string;
  readonly area: GameArea;
  readonly box: { x: number; y: number; width: number; height: number };
}

/** Okénka na psaní z každého rozložení (iPad, zmenšené, telefon na šířku i na výšku). */
function writingCases(): WritingCase[] {
  const windows: TestWindow[] = [
    ...IPAD_WINDOWS,
    windowOf('malé okno počítače 800×600', 800, 600),
    windowOf('iPad na výšku 820×1180', 820, 1180),
    ...PHONE_WINDOWS.slice(0, 2),
    ...PHONE_PORTRAIT_WINDOWS.slice(0, 2),
  ];
  const cases: WritingCase[] = [];
  for (const window of windows) {
    const area = areaOf(window);
    for (const maxNumber of RANGES) {
      const layout = layoutDeviceWritingScreen(area, maxNumber, STARS_PER_SET);
      const box = layout.writingAreas[layout.writingAreas.length - 1];
      if (box) {
        cases.push({ name: `${window.name}, do ${maxNumber}`, area, box });
      }
    }
  }
  return cases;
}

/** Tahy v okénku (v jednotkách okénka) tak, jak je dnes prst nakreslí v okně (CSS px). */
function cssStrokesOf(strokes: readonly Stroke[], testCase: WritingCase): Stroke[] {
  const left = testCase.box.x - testCase.box.width / 2;
  const top = testCase.box.y - testCase.box.height / 2;
  const today = todayPlacementOf(testCase.area);
  return strokes.map((stroke) =>
    stroke.map((point) => toCssPoint(today, left + point.x, top + point.y)),
  );
}

/** Tahy z okna přes ostré plátno zpátky do jednotek okénka (jako `pointer.worldX` ve WritingPad). */
function sharpPadStrokesOf(cssStrokes: readonly Stroke[], testCase: WritingCase): Stroke[] {
  const resolution = canvasResolutionFor(testCase.area);
  const left = testCase.box.x - testCase.box.width / 2;
  const top = testCase.box.y - testCase.box.height / 2;
  return cssStrokes.map((stroke) =>
    stroke.map((point) => {
      const game = windowToGamePoint(resolution, point);
      return { x: game.x - left, y: game.y - top };
    }),
  );
}

/** Vzorky sady (a nečíslice) zvětšené do okénka, jako je dnes dostane rozpoznávání. */
function attemptsFor(box: WritingAreaSize): Stroke[][] {
  const side = Math.min(box.width, box.height);
  const dx = (box.width - side) / 2;
  const dy = (box.height - side) / 2;
  const digits = uciTestSamples({ width: side, height: side })
    .filter((_, index) => index % SAMPLE_STEP === 0)
    .map((sample) => [sample.stroke]);
  const notDigits = NOT_DIGITS.map((strokes) =>
    strokes.map((stroke) => placeStroke(stroke, side / 320, 0, 0)),
  );
  return [...digits, ...notDigits].map((strokes) =>
    strokes.map((stroke) => placeStroke(stroke, 1, dx, dy)),
  );
}

describe('AC4: psaní prstem se na ostrém plátně rozpozná stejně jako dnes', () => {
  it(
    'stejná sada tahů dá na iPadu, ve zmenšeném zobrazení i na telefonu stejné číslice jako dnes',
    () => {
      for (const testCase of writingCases()) {
        const boxSize = { width: testCase.box.width, height: testCase.box.height };
        const differences: string[] = [];
        attemptsFor(boxSize).forEach((strokes, index) => {
          const today = recognizeDigit(strokes, boxSize);
          const sharp = recognizeDigit(
            sharpPadStrokesOf(cssStrokesOf(strokes, testCase), testCase),
            boxSize,
          );
          if (today !== sharp) {
            differences.push(`vzorek ${index}: dnes ${String(today)}, nově ${String(sharp)}`);
          }
        });

        expect(differences, testCase.name).toEqual([]);
      }
    },
    SLOW_TEST_TIMEOUT_MS,
  );

  it('tah padne do okénka na stejné místo jako dnes', () => {
    for (const testCase of writingCases()) {
      const corners: Stroke = [
        { x: 0, y: 0 },
        { x: testCase.box.width, y: testCase.box.height },
        { x: testCase.box.width / 2, y: testCase.box.height / 3 },
      ];
      const [sharp] = sharpPadStrokesOf(cssStrokesOf([corners], testCase), testCase);
      const unitTolerance = CSS_TOLERANCE / testCase.area.scale;

      corners.forEach((point, index) => {
        const moved = sharp?.[index];
        const where = `${testCase.name}, bod ${index + 1}`;
        expect(moved, where).toBeDefined();
        expect(Math.abs((moved?.x ?? Number.NaN) - point.x), where).toBeLessThanOrEqual(
          unitTolerance,
        );
        expect(Math.abs((moved?.y ?? Number.NaN) - point.y), where).toBeLessThanOrEqual(
          unitTolerance,
        );
      });
    }
  });
});

// ---------------------------------------------------------------------------
// AC7
// ---------------------------------------------------------------------------

const WRITING_10: GameSettings = { maxNumber: 10, operations: 'plus', answerInput: 'writing' };

/** Kolo po dvou chybách: nápověda je vidět. */
function roundWithHint(): AnswerRound {
  const round = createAnswerRound(WRITING_10, seededRandom());
  const wrong = round.problem.result === 0 ? 1 : 0;
  return tapAnswer(tapAnswer(round, wrong).round, wrong).round;
}

describe('AC7: po otočení iPadu zůstane rozehrané kolo a hra je ostrá podle nového okna', () => {
  const ipad = windowOf('iPad na šířku 1180×820', 1180, 820);
  const ipadPortrait = windowOf('iPad na výšku 820×1180', 820, 1180);

  it('příklad, chyby, nápověda i hvězdičky zůstanou, rozepsaný tah se smaže', () => {
    const round = roundWithHint();
    const before = layoutDeviceWritingScreen(areaOf(ipad), 10, STARS_PER_SET);
    const box = before.writingAreas[0];
    if (!box) {
      throw new Error('chybí okénko na psaní');
    }
    let writing: WritingRound = createWritingRound(round, box, () => 7);
    writing = startStroke(writing, 0);
    writing = finishStroke(
      writing,
      [
        { x: 10, y: 10 },
        { x: 100, y: 200 },
      ],
      50,
    );
    writing = startStroke(writing, 100);
    const state: PlayState = {
      round,
      settings: WRITING_10,
      progress: { earned: 7 },
      counting: startDotCounting(round.problem),
      writing,
      settingsSession: CLOSED_SETTINGS,
      guide: null,
    };

    const after = layoutDeviceWritingScreen(areaOf(ipadPortrait), 10, STARS_PER_SET);
    const newBox = after.writingAreas[0];
    if (!newBox) {
      throw new Error('chybí okénko na psaní');
    }
    const resized = playStateAfterResize(state, newBox);

    expect(resized.round).toEqual(round);
    expect(resized.round.wrongAnswers).toBe(round.wrongAnswers);
    expect(isHintVisible(resized.round)).toBe(true);
    expect(resized.progress).toEqual({ earned: 7 });
    expect(writtenStrokes(resized.writing as WritingRound)).toEqual([]);
    expect(resized.round.solved).toBe(false);
  });

  it('po otočení má plátno 2 obrazové body na CSS px nového okna a prvky jsou tam, kde dnes', () => {
    const area = areaOf(ipadPortrait);
    const resolution = canvasResolutionFor(area);

    expect(resolution.pixelWidth).toBe(resolution.cssWidth * CANVAS_PIXELS_PER_CSS_PX);
    expectSamePlaces(
      tabletCssLayouts(TODAY_GAME_WIDTH, TODAY_GAME_HEIGHT, sharpPlacementOf(resolution)),
      tabletCssLayouts(TODAY_GAME_WIDTH, TODAY_GAME_HEIGHT, todayPlacementOf(area)),
      ipadPortrait.name,
      CSS_TOLERANCE,
    );
  });
});

// ---------------------------------------------------------------------------
// AC8
// ---------------------------------------------------------------------------

describe('AC8: po návratu z menu je hra ostrá a rozložení se nezmění', () => {
  it('nové spuštění dá stejné plátno i stejné polohy prvků', () => {
    for (const window of SHARP_WINDOWS) {
      const firstRun = canvasResolutionFor(areaOf(window));
      const firstLayouts = tabletCssLayouts(
        TODAY_GAME_WIDTH,
        TODAY_GAME_HEIGHT,
        sharpPlacementOf(firstRun),
      );

      const secondRun = canvasResolutionFor(areaOf(window));

      expect(secondRun, window.name).toEqual(firstRun);
      expect(
        tabletCssLayouts(TODAY_GAME_WIDTH, TODAY_GAME_HEIGHT, sharpPlacementOf(secondRun)),
        window.name,
      ).toEqual(firstLayouts);
    }
  });
});
