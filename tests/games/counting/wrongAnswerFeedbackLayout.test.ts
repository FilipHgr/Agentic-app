import { beforeAll, describe, expect, it } from 'vitest';

import {
  QUESTION_MARK_HOP_MS,
  HINT_GLOW_PULSE_MS,
  WRONG_BUTTON_FEEDBACK_MS,
  hintGlowFrameAt,
  hintGlowSpread,
  problemGlyphsBox,
  questionMarkBox,
  questionMarkLiftAt,
  questionMarkScaleAt,
  wrongButtonFrame,
} from '../../../src/games/counting/logic/wrongAnswerFeedback';
import { hintDotGroups } from '../../../src/games/counting/logic/answerRound';
import { layoutDeviceHintButton } from '../../../src/games/counting/logic/deviceLayout';
import {
  HOME_SCREEN_WINDOWS,
  LAYOUT_RULES,
  MIN_TAP_GAP,
  MIN_TAP_SIDE,
} from '../../shared/layoutRules';
import type { LayoutItem, LayoutScene } from '../../shared/layoutRules';
import {
  box,
  gapBetween,
  heightOf,
  isInside,
  overlaps,
  toCss,
  widthOf,
} from '../../shared/viewportFixtures';
import type { Box, TestWindow } from '../../shared/viewportFixtures';
import {
  HINT_BUTTON_NAME,
  PLAY_WINDOWS,
  gearHitOf,
  hintButtonScene,
  homeHitOf,
  playCasesWithHint,
  playCasesWithoutHint,
  playLayoutOf,
  playScene,
} from './layoutScenes';
import type { PlayCase } from './layoutScenes';

/**
 * Testy k #155 AC6: rozložení odezvy na špatnou odpověď jako pravidla
 * v cyklu (#81, rozhodnutí 2026-11-06). Každé pravidlo je jeden test, který
 * projde všechna okna (iPad, telefon na šířku a na výšku, hranice,
 * aplikace z plochy), rozsahy 5, 10, 20, číselník i psaní, počty hvězdiček
 * a obrazovky po 1. chybě (žárovka) i po 2. chybě (tečky); popis případu
 * je ve zprávě `expect`.
 *
 * Odezva se měří v nejkrajnějších chvílích svého průběhu
 * (`wrongAnswerFeedback.ts`): tlačítko číselníku v největší i nejmenší
 * velikosti během zešednutí, „?“ v nejvyšším bodě poskoku a žárovka
 * v nejmenší i největší velikosti pulzu. Tlačítko i žárovka se mění kolem
 * svého středu.
 *
 * „?“ leží v boxu příkladu (`problem`, `problemSize`); poskočený „?“ se
 * hlídá jako box „?“ (`questionMarkBox`, s rezervou u pravého okraje místa
 * pro příklad) zvětšený o nejvyšší zvětšení (`questionMarkScaleAt`) kolem
 * středu a posunutý o nejvyšší poskok nahoru.
 * Na nejmenším telefonu 744×296 (do 5, číselník) jsou nad boxem příkladu
 * dnes jen 4 CSS px k okraji, proto výška poskoku dostává rozložení
 * (`questionMarkLiftAt(elapsedMs, layout)`) a smí se mu přizpůsobit;
 * na telefonu se „?“ místo vyššího poskoku zvětší.
 *
 * Případů jsou desítky tisíc, proto pravidla sbírají porušení do seznamu
 * a ověří ho jedním `expect` (prázdný seznam, jinak popis každého případu),
 * a stejné výpočty (rozložení, obrazovky, průběhy) se dělají jen jednou (#194).
 */

const WINDOWS: readonly TestWindow[] = [...PLAY_WINDOWS, ...HOME_SCREEN_WINDOWS];

/** Krok, po kterém se průběh odezvy prochází (ms). */
const FRAME_STEP_MS = 5;

/** Spočítat všechny scény trvá pár sekund, déle než běžný test. */
const SCENES_TIMEOUT_MS = 60_000;

const KEYPAD_BUTTON = /^tlačítko \d+$/;

function isKeypadButton(item: LayoutItem): boolean {
  return KEYPAD_BUTTON.test(item.name);
}

function timesUpTo(endMs: number): number[] {
  const times: number[] = [];
  for (let time = 0; time <= endMs; time += FRAME_STEP_MS) {
    times.push(time);
  }
  return times;
}

/** Nejmenší a největší velikost tlačítka během odezvy po špatném ťuknutí. */
function wrongButtonScales(): number[] {
  const scales = timesUpTo(WRONG_BUTTON_FEEDBACK_MS).map(
    (time) => wrongButtonFrame([0], time).scale,
  );
  return [Math.min(...scales), Math.max(...scales)];
}

/** Nejmenší a největší velikost rozzářené žárovky během pulzu. */
function glowScales(): number[] {
  const scales = timesUpTo(HINT_GLOW_PULSE_MS).map((time) => hintGlowFrameAt(time).scale);
  return [Math.min(...scales), Math.max(...scales)];
}

/** Porušení pravidla `ruleName` na všech obrazovkách, s popisem obrazovky. */
function ruleViolations(ruleName: string, scenes: readonly LayoutScene[]): string[] {
  const rule = LAYOUT_RULES[ruleName];
  if (!rule) {
    return [`pravidlo „${ruleName}“ chybí`];
  }
  return scenes.flatMap((scene) => rule(scene).map((violation) => `${scene.label}: ${violation}`));
}

/** Obdélník zvětšený nebo zmenšený `scale`krát kolem svého středu. */
function scaleBox(b: Box, scale: number): Box {
  const centerX = (b.left + b.right) / 2;
  const centerY = (b.top + b.bottom) / 2;
  const halfWidth = (widthOf(b) * scale) / 2;
  const halfHeight = (heightOf(b) * scale) / 2;
  return {
    left: centerX - halfWidth,
    right: centerX + halfWidth,
    top: centerY - halfHeight,
    bottom: centerY + halfHeight,
  };
}

/** Obrazovka, na které jsou tlačítka nebo žárovka v jiné velikosti. */
function withScaled(
  scene: LayoutScene,
  which: (item: LayoutItem) => boolean,
  scale: number,
  note: string,
): LayoutScene {
  return {
    ...scene,
    label: `${scene.label}, ${note} ${String(Math.round(scale * 1000) / 10).replace('.', ',')} %`,
    items: scene.items.map((item) =>
      which(item) ? { ...item, box: scaleBox(item.box, scale) } : item,
    ),
  };
}

// ---------------------------------------------------------------------------
// Obrazovky po chybě
// ---------------------------------------------------------------------------

interface FeedbackCase {
  readonly testCase: PlayCase;
  /** Obrazovka v chvíli odezvy: po 1. chybě se žárovkou, nebo po 2. s tečkami. */
  readonly scene: LayoutScene;
}

let cachedCases: FeedbackCase[] | undefined;
/**
 * Všechny obrazovky, na kterých může přijít špatná odpověď: bez teček
 * (0 + 0, 0 − 0 nebo příklad bez nápovědy), po 1. chybě s žárovkou a po
 * 2. chybě s tečkami.
 */
function feedbackCases(): FeedbackCase[] {
  if (cachedCases) {
    return cachedCases;
  }
  const withoutHint = [
    ...playCasesWithoutHint('číselník', WINDOWS),
    ...playCasesWithoutHint('psaní', WINDOWS),
  ].map((testCase) => ({ testCase, scene: playScene(testCase) }));
  const withHint = hintCases().flatMap((testCase) => [
    { testCase, scene: hintButtonScene(testCase) },
    { testCase, scene: playScene(testCase) },
  ]);
  cachedCases = [...withoutHint, ...withHint];
  return cachedCases;
}

interface BulbCase {
  readonly window: TestWindow;
  readonly scene: LayoutScene;
}

let cachedHintCases: PlayCase[] | undefined;
/** Všechna zadání s nápovědou; stejné objekty, aby se jejich rozložení počítalo jednou. */
function hintCases(): PlayCase[] {
  cachedHintCases ??= playCasesWithHint(WINDOWS);
  return cachedHintCases;
}

let cachedBulbCases: BulbCase[] | undefined;
/** Obrazovky po 1. chybě s rozzářenou žárovkou (příklady s tečkami). */
function bulbCases(): BulbCase[] {
  cachedBulbCases ??= hintCases()
    .map((testCase) => ({ window: testCase.window, scene: hintButtonScene(testCase) }))
    .filter(({ scene }) => scene.items.some((item) => item.name === HINT_BUTTON_NAME));
  return cachedBulbCases;
}

let cachedKeypadScenes: LayoutScene[] | undefined;
/** Obrazovky s číselníkem s tlačítky v nejmenší i největší velikosti odezvy. */
function keypadScenes(): LayoutScene[] {
  cachedKeypadScenes ??= feedbackCases()
    .filter(({ testCase }) => testCase.mode === 'číselník')
    .flatMap(({ scene }) =>
      wrongButtonScales().map((scale) => withScaled(scene, isKeypadButton, scale, 'tlačítko na')),
    );
  return cachedKeypadScenes;
}

beforeAll(() => {
  feedbackCases();
  bulbCases();
  keypadScenes();
}, SCENES_TIMEOUT_MS);

/** Ťukací plochy obrazovky a plochy domečku a kolečka v CSS px. */
function tapAreasOf(scene: LayoutScene, window: TestWindow): LayoutItem[] {
  return [
    ...scene.items.filter((item) => item.tappable === true && !item.reserved),
    { name: 'plocha domečku', box: homeHitOf(window), tappable: true },
    { name: 'plocha kolečka', box: gearHitOf(window), tappable: true },
  ];
}

/** Časy, ve kterých se prochází poskok „?“. */
const HOP_TIMES = timesUpTo(QUESTION_MARK_HOP_MS);

/** Nejvyšší bod poskoku „?“ v herních jednotkách v daném rozložení. */
function highestLift(layout: ReturnType<typeof playLayoutOf>['layout']): number {
  return Math.max(...HOP_TIMES.map((time) => questionMarkLiftAt(time, layout)));
}

/** Největší zvětšení „?“ během poskoku v daném rozložení. */
function largestScale(layout: ReturnType<typeof playLayoutOf>['layout']): number {
  return Math.max(...HOP_TIMES.map((time) => questionMarkScaleAt(time, layout)));
}

const hoppedBoxes = new WeakMap<PlayCase, Box>();
/** Box „?“ v nejvyšším bodě poskoku a v největším zvětšení, v CSS px okna. */
function hoppedProblemBox(testCase: PlayCase): Box {
  const cached = hoppedBoxes.get(testCase);
  if (cached) {
    return cached;
  }
  const { area, layout } = playLayoutOf(testCase);
  const mark = questionMarkBox(layout);
  const scale = largestScale(layout);
  const hopped = toCss(
    box(mark.x, mark.y - highestLift(layout), mark.width * scale, mark.height * scale),
    area,
  );
  hoppedBoxes.set(testCase, hopped);
  return hopped;
}

// ---------------------------------------------------------------------------
// Zmenšené tlačítko číselníku
// ---------------------------------------------------------------------------

describe('AC6: zmenšené tlačítko číselníku nic nepřekryje a zůstane na obrazovce', () => {
  it('zmenšené tlačítko nepřekryje jinou plochu ve všech oknech, rozsazích a obrazovkách', () => {
    expect(ruleViolations('nic se nepřekrývá', keypadScenes())).toEqual([]);
  });

  it('zmenšené tlačítko zůstane celé na obrazovce ve všech oknech, rozsazích a obrazovkách', () => {
    expect(ruleViolations('vejde se do okna i mimo výřez', keypadScenes())).toEqual([]);
  });

  it('zmenšené tlačítko zůstane na svém místě uvnitř své plochy', () => {
    const outside: string[] = [];
    for (const { scene } of feedbackCases().filter(
      ({ testCase }) => testCase.mode === 'číselník',
    )) {
      for (const scale of wrongButtonScales()) {
        for (const button of scene.items.filter(isKeypadButton)) {
          if (!isInside(scaleBox(button.box, scale), button.box)) {
            outside.push(`${scene.label}: ${button.name} na ${scale}`);
          }
        }
      }
    }
    expect(outside).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Poskočený „?“
// ---------------------------------------------------------------------------

describe('AC6: poskočený „?“ nepřekryje ťukací plochu a zůstane na obrazovce', () => {
  it('poskočený „?“ nepřekryje žádnou ťukací plochu ve všech oknech, rozsazích, ovládáních a obrazovkách', () => {
    const overlapping: string[] = [];
    for (const { testCase, scene } of feedbackCases()) {
      const hopped = hoppedProblemBox(testCase);
      for (const other of tapAreasOf(scene, testCase.window)) {
        if (overlaps(hopped, other.box)) {
          overlapping.push(`${scene.label}: poskočený „?“ a ${other.name}`);
        }
      }
    }
    expect(overlapping).toEqual([]);
  });

  it('„?“ se zvětší nejvýš na 1,15× a nikdy nezmenší', () => {
    const wrongScales: string[] = [];
    for (const { testCase, scene } of feedbackCases()) {
      const { layout } = playLayoutOf(testCase);
      for (const time of timesUpTo(QUESTION_MARK_HOP_MS + 100)) {
        const scale = questionMarkScaleAt(time, layout);
        if (!(scale >= 1 && scale <= 1.15 + 0.0001)) {
          wrongScales.push(`${scene.label}, ${time} ms: ${scale}`);
        }
      }
      const restingScale = questionMarkScaleAt(QUESTION_MARK_HOP_MS, layout);
      if (restingScale !== 1) {
        wrongScales.push(`${scene.label}, po poskoku: ${restingScale}`);
      }
    }
    expect(wrongScales).toEqual([]);
  });

  it('poskočený „?“ zůstane celý na obrazovce ve všech oknech, rozsazích, ovládáních a obrazovkách', () => {
    const outside = feedbackCases()
      .filter(({ testCase, scene }) => !isInside(hoppedProblemBox(testCase), scene.free))
      .map(({ scene }) => scene.label);
    expect(outside).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Rozzářená žárovka
// ---------------------------------------------------------------------------

describe('AC6: rozzářená žárovka zůstane v místě a velikosti podle #84 AC7', () => {
  function isBulb(item: LayoutItem): boolean {
    return item.name === HINT_BUTTON_NAME;
  }

  function pulsingScenes(): LayoutScene[] {
    return bulbCases().flatMap(({ scene }) =>
      glowScales().map((scale) => withScaled(scene, isBulb, scale, 'žárovka na')),
    );
  }

  it('žárovka po 1. chybě je ve všech oknech, rozsazích a ovládáních', () => {
    expect(bulbCases().length).toBeGreaterThan(0);
  });

  it('pulzující žárovka má pořád aspoň 64 × 64 px (v okně 932×500 u číselníku do 20 aspoň 60 px)', () => {
    const tooSmall: string[] = [];
    for (const scene of pulsingScenes()) {
      const bulb = scene.items.find(isBulb);
      const minSide = bulb?.minSide ?? MIN_TAP_SIDE;
      const size = bulb ? `${widthOf(bulb.box)} × ${heightOf(bulb.box)}` : 'chybí';
      const bigEnough =
        bulb !== undefined &&
        widthOf(bulb.box) >= minSide - 0.01 &&
        heightOf(bulb.box) >= minSide - 0.01;
      if (!bigEnough) {
        tooSmall.push(`${scene.label}: žárovka ${size}`);
      }
    }
    expect(tooSmall).toEqual([]);
  });

  it('pulzující žárovka je aspoň 8 px od číselníku, okének, smazání, ✓, domečku i kolečka', () => {
    const tooClose: string[] = [];
    for (const { window, scene: base } of bulbCases()) {
      for (const scale of glowScales()) {
        const scene = withScaled(base, isBulb, scale, 'žárovka na');
        const bulb = scene.items.find(isBulb);
        if (!bulb) {
          throw new Error(`${scene.label}: chybí žárovka`);
        }
        const others = [
          ...tapAreasOf(scene, window).filter((item) => !isBulb(item)),
          ...scene.items.filter((item) => item.name.startsWith('okénko')),
        ];
        for (const other of others) {
          const gap = gapBetween(bulb.box, other.box);
          if (!(gap >= MIN_TAP_GAP - 0.01)) {
            tooClose.push(`${scene.label}: mezi žárovkou a ${other.name} ${gap} px`);
          }
        }
      }
    }
    expect(tooClose).toEqual([]);
  });

  it('záře kolem žárovky nepřekryje žádnou ťukací plochu, okénko ani znaky příkladu', () => {
    const problems: string[] = [];
    for (const testCase of hintCases()) {
      const { area, layout } = playLayoutOf(testCase);
      const slot = testCase.hint
        ? layoutDeviceHintButton(layout, hintDotGroups(testCase.hint))
        : null;
      if (!slot) {
        continue;
      }
      const scene = hintButtonScene(testCase);
      const spread = hintGlowSpread(layout, slot);
      const side = slot.size + 2 * spread;
      const glow = toCss(box(slot.x, slot.y, side, side), area);
      const glyphs = problemGlyphsBox(layout);
      const problem = toCss(box(glyphs.x, glyphs.y, glyphs.width, glyphs.height), area);
      const others = [
        ...tapAreasOf(scene, testCase.window).filter((item) => item.name !== HINT_BUTTON_NAME),
        ...scene.items.filter((item) => item.name.startsWith('okénko')),
        { name: 'znaky příkladu', box: problem },
      ];
      if (!(spread > 0)) {
        problems.push(`${scene.label}: záře není vidět (${spread})`);
      }
      for (const other of others) {
        if (overlaps(glow, other.box)) {
          problems.push(`${scene.label}: záře a ${other.name}`);
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it('pulzující žárovka je celá na obrazovce', () => {
    const outside = pulsingScenes()
      .filter((scene) => {
        const bulb = scene.items.find(isBulb);
        return !(bulb !== undefined && isInside(bulb.box, scene.free));
      })
      .map((scene) => scene.label);
    expect(outside).toEqual([]);
  });

  it('pulzující žárovka nepřekryje nic jiného', () => {
    expect(ruleViolations('nic se nepřekrývá', pulsingScenes())).toEqual([]);
  });
});
