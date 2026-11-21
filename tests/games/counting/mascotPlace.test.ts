import { describe, expect, it } from 'vitest';

import {
  MASCOT_GAP_CSS_PX,
  MASCOT_MIN_HEIGHT_CSS_PX,
  countingMascotArea,
  countingMascotBox,
} from '../../../src/games/counting/logic/mascotPlace';
import type { MascotBox } from '../../../src/games/counting/logic/mascotPlace';
import type { Problem } from '../../../src/games/counting/logic/problems';
import type {
  AnswerInput,
  GameSettings,
  MaxNumber,
  OperationMode,
} from '../../../src/games/counting/logic/settings';
import { STARS_PER_SET } from '../../../src/games/counting/logic/stars';
import { MASCOT_FRAME_SIZE } from '../../../src/shared/logic/mascot';
import { gameAreaFor } from '../../../src/shared/logic/viewportLayout';
import { HOME_SCREEN_WINDOWS } from '../../shared/layoutRules';
import type { LayoutScene } from '../../shared/layoutRules';
import {
  IPAD_WINDOWS,
  gapBetween,
  isInside,
  overlaps,
  viewportOf,
} from '../../shared/viewportFixtures';
import type { Box, TestWindow } from '../../shared/viewportFixtures';
import {
  HINT_BUTTON_NAME,
  OPERATIONS,
  PLAY_WINDOWS,
  RANGES,
  gearHitOf,
  hintButtonScene,
  homeHitOf,
  isDot,
  playCasesWithHint,
  playCasesWithoutHint,
  playScene,
  plus,
  visibleAreaOf,
  windowSize,
} from './layoutScenes';
import type { Mode, PlayCase } from './layoutScenes';
import {
  KEYPAD_SETTINGS,
  WRITING_SETTINGS,
  correctAnswerOf,
  enterCounting,
  solveProblems,
  testDevice,
  wrongAnswerOf,
} from './sessionFakes';

/**
 * Testy k #167 AC1–AC3: kde v Počítání stojí panda.
 *
 * AC1: panda je vidět, jen když pro okno, rozsah, ovládání a druh příkladů
 * existuje jedno místo aspoň 96 px vysoké (šířka podle poměru snímku),
 * aspoň 4 px od všech prvků a okraje ve všech stavech hry (0–10 hvězdiček,
 * bez nápovědy, s tlačítkem nápovědy i s tečkami). Jinak není vidět vůbec.
 * Na iPadu 1180×820 a 1180×760 (i z plochy) je vidět vždy. Telefony jsou
 * mimo rozsah (panda tam zatím není).
 * AC2: nic se nezmenšuje ani neposouvá (tabulka dnešních rozměrů).
 * AC3: během jedné hry v jednom okně se poloha ani velikost nemění.
 *
 * Pravidla se zkouší v cyklu přes všechna zkušební okna hry a okna z plochy;
 * obrazovky jsou stejné jako u pravidel rozložení (`layoutScenes.ts`).
 */

const WINDOWS: readonly TestWindow[] = [...PLAY_WINDOWS, ...HOME_SCREEN_WINDOWS];
const ANSWER_INPUTS: readonly AnswerInput[] = ['keypad', 'writing'];

/** Okna, kde panda musí být vidět vždy (AC1): iPad na šířku i z plochy. */
const ALWAYS_SHOWN: readonly TestWindow[] = [
  ...IPAD_WINDOWS,
  ...HOME_SCREEN_WINDOWS.filter((window) => window.width === 1180),
];

interface Config {
  readonly window: TestWindow;
  readonly settings: GameSettings;
}

function configs(windows: readonly TestWindow[] = WINDOWS): Config[] {
  return windows.flatMap((window) =>
    ANSWER_INPUTS.flatMap((answerInput) =>
      RANGES.flatMap((maxNumber) =>
        OPERATIONS.map((operations) => ({
          window,
          settings: { maxNumber, operations, answerInput },
        })),
      ),
    ),
  );
}

function configLabel(config: Config): string {
  const { maxNumber, operations, answerInput } = config.settings;
  return `${windowSize(config.window)} (${config.window.name}), do ${maxNumber}, ${
    answerInput === 'writing' ? 'psaní' : 'číselník'
  }, ${operations}`;
}

function pandaOf(config: Config): MascotBox | null {
  const viewport = viewportOf(config.window);
  return countingMascotBox(gameAreaFor(viewport), viewport, config.settings);
}

function includesProblem(operations: OperationMode, problem: Problem): boolean {
  return operations === 'mixed' || operations === problem.operation;
}

/**
 * Všechny obrazovky jedné hry: 0 i 10 hvězdiček, bez nápovědy, s tlačítkem
 * nápovědy a s tečkami každého příkladu, který v nastavení může přijít. Při
 * psaní i s číselníkem, kterým se příklad dohraje, když se rozpoznávání
 * nestáhne (#58).
 */
function scenesOfGame(config: Config): LayoutScene[] {
  const { maxNumber, operations, answerInput } = config.settings;
  const modes: readonly Mode[] = answerInput === 'writing' ? ['psaní', 'číselník'] : ['číselník'];
  const sameGame = (testCase: PlayCase): boolean =>
    testCase.maxNumber === maxNumber && modes.includes(testCase.mode);
  const withoutHint = modes
    .flatMap((mode) => playCasesWithoutHint(mode, [config.window]))
    .filter((testCase) => sameGame(testCase) && testCase.operations === operations);
  const withHint = playCasesWithHint([config.window]).filter(
    (testCase) =>
      sameGame(testCase) &&
      testCase.hint !== null &&
      includesProblem(operations, testCase.hint) &&
      (testCase.operations === operations || testCase.operations === 'mixed'),
  );
  return [
    ...withoutHint.map(playScene),
    ...withHint.map(playScene),
    ...withHint.map(hintButtonScene),
  ];
}

function heightOfBox(box: MascotBox): number {
  return box.bottom - box.top;
}

function widthOfBox(box: MascotBox): number {
  return box.right - box.left;
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

function shrinkBox(box: Box, by: number): Box {
  return { left: box.left + by, right: box.right - by, top: box.top + by, bottom: box.bottom - by };
}

describe('#167 AC1: panda je vidět jen tam, kde má místo', () => {
  it('kde je panda vidět, je aspoň 96 px vysoká a má poměr stran snímku', () => {
    const problems = configs().flatMap((config) => {
      const panda = pandaOf(config);
      if (panda === null) {
        return [];
      }
      const ratio = widthOfBox(panda) / heightOfBox(panda);
      const expected = MASCOT_FRAME_SIZE.width / MASCOT_FRAME_SIZE.height;
      return [
        ...(heightOfBox(panda) >= MASCOT_MIN_HEIGHT_CSS_PX
          ? []
          : [`${configLabel(config)}: panda je vysoká ${round(heightOfBox(panda))} px`]),
        ...(Math.abs(ratio - expected) < 1e-9
          ? []
          : [`${configLabel(config)}: poměr stran ${ratio} místo ${expected}`]),
      ];
    });
    expect(problems, problems.join('\n')).toEqual([]);
  });

  it('panda je aspoň 4 px od okraje viditelné hry (bez stavového řádku a lišty)', () => {
    const problems = configs().flatMap((config) => {
      const panda = pandaOf(config);
      if (panda === null) {
        return [];
      }
      const area = gameAreaFor(viewportOf(config.window));
      const visible = shrinkBox(visibleAreaOf(config.window, area), MASCOT_GAP_CSS_PX);
      return isInside(panda, visible)
        ? []
        : [
            `${configLabel(config)}: panda ${JSON.stringify(panda)} mimo ${JSON.stringify(visible)}`,
          ];
    });
    expect(problems, problems.join('\n')).toEqual([]);
  });

  it('panda je ve všech stavech hry aspoň 4 px od všech prvků, kolečka a domečku', () => {
    const problems = configs().flatMap((config) => {
      const panda = pandaOf(config);
      if (panda === null) {
        return [];
      }
      const pageButtons = [
        { name: 'kolečko', box: gearHitOf(config.window) },
        { name: 'domeček', box: homeHitOf(config.window) },
      ];
      return scenesOfGame(config).flatMap((scene) =>
        [...scene.items, ...pageButtons]
          .filter(
            (item) =>
              overlaps(panda, item.box) || gapBetween(panda, item.box) < MASCOT_GAP_CSS_PX - 0.01,
          )
          .map(
            (item) =>
              `${scene.label}: panda je ${round(gapBetween(panda, item.box))} px od „${item.name}“` +
              (overlaps(panda, item.box) ? ' (překryv)' : ''),
          ),
      );
    });
    expect(problems.slice(0, 20), problems.slice(0, 20).join('\n')).toEqual([]);
  });

  it('na iPadu 1180×820 a 1180×760 (i z plochy) je panda vidět ve všech rozsazích a ovládáních', () => {
    const hidden = configs(ALWAYS_SHOWN).filter((config) => pandaOf(config) === null);
    expect(hidden.map(configLabel)).toEqual([]);
  });

  /**
   * Tabulka očekávání pro dnešní okna: ve kterých rozsazích je panda vidět
   * (stejně pro všechny druhy příkladů). Telefony pandu zatím nemají (mimo
   * rozsah #167). V okně 932×500 se při rozsahu do 10 místo 96 px nenajde.
   */
  const EXPECTED_RANGES: Readonly<Record<string, Readonly<Record<AnswerInput, MaxNumber[]>>>> = {
    'iPad 1180×820': { keypad: [5, 10, 20], writing: [5, 10, 20] },
    'iPad 1180×760': { keypad: [5, 10, 20], writing: [5, 10, 20] },
    'iPad na šířku z plochy (stavový řádek 24, lišta 20)': {
      keypad: [5, 10, 20],
      writing: [5, 10, 20],
    },
    '932×500 těsně nad hranicí': { keypad: [5, 20], writing: [5, 20] },
  };

  it('ve dnešních oknech je panda vidět podle tabulky očekávání', () => {
    const problems = configs().flatMap((config) => {
      const expected =
        EXPECTED_RANGES[config.window.name]?.[config.settings.answerInput ?? 'keypad'] ?? [];
      const shouldShow = expected.includes(config.settings.maxNumber);
      const shown = pandaOf(config) !== null;
      return shown === shouldShow
        ? []
        : [
            `${configLabel(config)}: panda ${shown ? 'je' : 'není'} vidět, čekáno ${shouldShow ? 'vidět' : 'skrytá'}`,
          ];
    });
    expect(problems, problems.join('\n')).toEqual([]);
  });
});

describe('#167 AC3: panda se během hry nehýbe', () => {
  it('odpovědi, nápověda ani oslava s mapou místo pandy nezmění, změní ho až nastavení', () => {
    // Místo se počítá jen z okna a nastavení sezení (`session.settings()`),
    // proto se hraje skutečné sezení a místo se přepočítá po každém kroku.
    const problems: string[] = [];
    for (const window of ALWAYS_SHOWN) {
      const viewport = viewportOf(window);
      const area = gameAreaFor(viewport);
      for (const settings of [KEYPAD_SETTINGS, WRITING_SETTINGS]) {
        const test = enterCounting(testDevice(settings));
        const placeNow = (): string =>
          JSON.stringify(countingMascotArea(area, viewport, test.session.settings()));
        const start = placeNow();
        const steps: readonly (readonly [string, () => void])[] = [
          ['chybná odpověď', () => test.session.tapAnswer(wrongAnswerOf(test.session))],
          ['ťuknutí na nápovědu', () => test.session.tapHintButton()],
          ['správná odpověď', () => test.session.tapAnswer(correctAnswerOf(test.session))],
          ['další příklad', () => test.timers.runAll()],
          ['oslava a karta s mapou', () => solveProblems(test, STARS_PER_SET)],
        ];
        for (const [name, step] of steps) {
          step();
          if (placeNow() !== start) {
            problems.push(
              `${windowSize(window)}, ${settings.answerInput}: místo se změnilo po kroku „${name}“`,
            );
          }
        }
        expect(start, `${windowSize(window)}: panda je vidět`).not.toBe('null');
      }
    }
    expect(problems, problems.join('\n')).toEqual([]);
  });

  it('jiný rozsah v nastavení může pandu přesunout (místo se počítá znovu)', () => {
    const viewport = viewportOf(IPAD_WINDOWS[0] as TestWindow);
    const area = gameAreaFor(viewport);
    const toTen = countingMascotArea(area, viewport, KEYPAD_SETTINGS);
    const toTwenty = countingMascotArea(area, viewport, { ...KEYPAD_SETTINGS, maxNumber: 20 });
    expect(toTwenty).not.toEqual(toTen);
  });

  it('při psaní stojí panda tam, kde nepřekáží ani číselníku po výpadku rozpoznávání', () => {
    const problems = configs(ALWAYS_SHOWN)
      .filter((config) => config.settings.answerInput === 'writing')
      .flatMap((config) => {
        const panda = pandaOf(config);
        const keypadScenes = playCasesWithoutHint('číselník', [config.window])
          .filter((testCase) => testCase.maxNumber === config.settings.maxNumber)
          .map(playScene);
        return panda === null
          ? [`${configLabel(config)}: panda chybí`]
          : keypadScenes.flatMap((scene) =>
              scene.items
                .filter((item) => gapBetween(panda, item.box) < MASCOT_GAP_CSS_PX - 0.01)
                .map((item) => `${scene.label}: panda u „${item.name}“`),
            );
      });
    expect(problems).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// AC2: tabulka dnešních rozměrů
// ---------------------------------------------------------------------------

function boundsText(boxes: readonly Box[]): string {
  if (boxes.length === 0) {
    return '-';
  }
  const left = Math.min(...boxes.map((b) => b.left));
  const top = Math.min(...boxes.map((b) => b.top));
  const right = Math.max(...boxes.map((b) => b.right));
  const bottom = Math.max(...boxes.map((b) => b.bottom));
  return [left, top, right, bottom].map(round).join(',');
}

/** Velký příklad s nápovědou v rozsahu: nejvíc teček, které jsou vidět. */
const HINT_FOR: Readonly<Record<MaxNumber, Problem>> = {
  5: plus(2, 3),
  10: plus(5, 5),
  20: plus(10, 10),
};

/** Šířka × výška obdélníku v CSS px. */
function sizeText(box: Box | undefined): string {
  return box === undefined ? '-' : `${round(box.right - box.left)}×${round(box.bottom - box.top)}`;
}

/** Nejmenší kladný rozdíl hodnot (krok mřížky), nebo „-“. */
function smallestStep(values: readonly number[]): string {
  const sorted = [...new Set(values.map(round))].sort((first, second) => first - second);
  const steps = sorted.slice(1).map((value, index) => value - (sorted[index] ?? value));
  return steps.length === 0 ? '-' : String(round(Math.min(...steps)));
}

/** Nejmenší ťukací plocha a krok mřížky ovládání (vodorovně × svisle) v CSS px. */
function tapGridText(controls: readonly Box[]): string {
  const smallest = [...controls].sort(
    (first, second) =>
      Math.min(first.right - first.left, first.bottom - first.top) -
      Math.min(second.right - second.left, second.bottom - second.top),
  )[0];
  const centersX = controls.map((b) => (b.left + b.right) / 2);
  const centersY = controls.map((b) => (b.top + b.bottom) / 2);
  return `nejmenší ${sizeText(smallest)} krok ${smallestStep(centersX)}×${smallestStep(centersY)}`;
}

/**
 * Rozměry dnešních prvků v CSS px (vlevo, nahoře, vpravo, dole): příklad,
 * řada hvězdiček, ovládání s nejmenší ťukací plochou a krokem mřížky,
 * tečky nápovědy, tlačítko nápovědy s velikostí, domeček a kolečko.
 */
function todaySizes(
  window: TestWindow,
  maxNumber: MaxNumber,
  mode: Mode,
  starCount: number,
): string {
  const testCase: PlayCase = {
    window,
    maxNumber,
    mode,
    operations: 'mixed',
    starCount,
    hint: HINT_FOR[maxNumber],
  };
  const withDots = playScene(testCase).items;
  const withButton = hintButtonScene(testCase).items;
  const named = (prefix: string): Box[] =>
    withDots.filter((item) => item.name.startsWith(prefix)).map((item) => item.box);
  const controls = withDots
    .filter((item) => /^(tlačítko \d|okénko|smazání|✓)/.test(item.name))
    .map((item) => item.box);
  const tappableControls = withDots
    .filter((item) => item.tappable === true && /^(tlačítko \d|smazání|✓)/.test(item.name))
    .map((item) => item.box);
  const hintButton = withButton.find((item) => item.name === HINT_BUTTON_NAME)?.box;
  return [
    `příklad ${boundsText(named('příklad'))}`,
    `hvězdičky ${boundsText(named('hvězdička'))}`,
    `ovládání ${boundsText(controls)}`,
    tapGridText(tappableControls),
    `tečky ${boundsText(withDots.filter(isDot).map((item) => item.box))}`,
    `nápověda ${hintButton === undefined ? '-' : boundsText([hintButton])} ${sizeText(hintButton)}`,
    `domeček ${boundsText([homeHitOf(window)])}`,
    `kolečko ${boundsText([gearHitOf(window)])}`,
  ].join(' | ');
}

/**
 * Dnešní rozměry (z kódu před #167): okna s rozložením iPadu ve všech
 * rozsazích, telefony v rozsahu do 10, číselník i psaní, 0 i 10
 * hvězdiček, nápověda s největší skupinkou teček v rozsahu.
 */
const TODAY_SIZES: readonly (readonly [string, MaxNumber, Mode, number, string])[] = [
  [
    'iPad 1180×820',
    5,
    'číselník',
    0,
    'příklad 187.5,95.2,992.5,331.2 | hvězdičky - | ovládání 77.5,644.9,1102.5,794.4 | nejmenší 149.5×149.5 krok 175.1×- | tečky 361.5,453.8,818.5,522.2 | nápověda 530.2,421.6,649.8,541.2 119.6×119.6 | domeček 12,12,88,88 | kolečko 1092,12,1168,88',
  ],
  [
    'iPad 1180×820',
    5,
    'číselník',
    10,
    'příklad 187.5,95.2,992.5,331.2 | hvězdičky 362.6,39.5,817.4,71.5 | ovládání 77.5,644.9,1102.5,794.4 | nejmenší 149.5×149.5 krok 175.1×- | tečky 361.5,453.8,818.5,522.2 | nápověda 530.2,421.6,649.8,541.2 119.6×119.6 | domeček 12,12,88,88 | kolečko 1092,12,1168,88',
  ],
  [
    'iPad 1180×820',
    5,
    'psaní',
    0,
    'příklad 187.5,95.2,992.5,331.2 | hvězdičky - | ovládání 218.4,452.7,961.6,794.4 | nejmenší 149.5×149.5 krok 593.6×- | tečky 361.5,357.7,818.5,426.1 | nápověda 535.9,331.2,644.1,439.4 108.2×108.2 | domeček 12,12,88,88 | kolečko 1092,12,1168,88',
  ],
  [
    'iPad 1180×820',
    5,
    'psaní',
    10,
    'příklad 187.5,95.2,992.5,331.2 | hvězdičky 362.6,39.5,817.4,71.5 | ovládání 218.4,452.7,961.6,794.4 | nejmenší 149.5×149.5 krok 593.6×- | tečky 361.5,357.7,818.5,426.1 | nápověda 535.9,331.2,644.1,439.4 108.2×108.2 | domeček 12,12,88,88 | kolečko 1092,12,1168,88',
  ],
  [
    'iPad 1180×820',
    10,
    'číselník',
    0,
    'příklad 169.3,117.1,1010.7,309.3 | hvězdičky - | ovládání 77.5,474.1,1102.5,794.4 | nejmenší 149.5×149.5 krok 87.5×170.8 | tečky 216.3,357.5,963.7,425.8 | nápověda 530.2,325.2,649.8,444.8 119.6×119.6 | domeček 12,12,88,88 | kolečko 1092,12,1168,88',
  ],
  [
    'iPad 1180×820',
    10,
    'číselník',
    10,
    'příklad 169.3,117.1,1010.7,309.3 | hvězdičky 362.6,39.5,817.4,71.5 | ovládání 77.5,474.1,1102.5,794.4 | nejmenší 149.5×149.5 krok 87.5×170.8 | tečky 216.3,357.5,963.7,425.8 | nápověda 530.2,325.2,649.8,444.8 119.6×119.6 | domeček 12,12,88,88 | kolečko 1092,12,1168,88',
  ],
  [
    'iPad 1180×820',
    10,
    'psaní',
    0,
    'příklad 169.3,117.1,1010.7,309.3 | hvězdičky - | ovládání 90.3,495.4,1089.7,794.4 | nejmenší 149.5×149.5 krok 849.8×- | tečky 216.3,368.2,963.7,436.5 | nápověda 530.2,335.9,649.8,455.5 119.6×119.6 | domeček 12,12,88,88 | kolečko 1092,12,1168,88',
  ],
  [
    'iPad 1180×820',
    10,
    'psaní',
    10,
    'příklad 169.3,117.1,1010.7,309.3 | hvězdičky 362.6,39.5,817.4,71.5 | ovládání 90.3,495.4,1089.7,794.4 | nejmenší 149.5×149.5 krok 849.8×- | tečky 216.3,368.2,963.7,436.5 | nápověda 530.2,335.9,649.8,455.5 119.6×119.6 | domeček 12,12,88,88 | kolečko 1092,12,1168,88',
  ],
  [
    'iPad 1180×820',
    20,
    'číselník',
    0,
    'příklad 229.1,132.9,950.9,281.3 | hvězdičky - | ovládání 92.4,392.9,1087.6,794.4 | nejmenší 123.9×123.9 krok 145.2×138.8 | tečky 113.8,319,1066.2,355.3 | nápověda 540.9,281.4,639.1,379.6 98.1×98.1 | domeček 12,12,88,88 | kolečko 1092,12,1168,88',
  ],
  [
    'iPad 1180×820',
    20,
    'číselník',
    10,
    'příklad 229.1,132.9,950.9,281.3 | hvězdičky 362.6,39.5,817.4,71.5 | ovládání 92.4,392.9,1087.6,794.4 | nejmenší 123.9×123.9 krok 145.2×138.8 | tečky 113.8,319,1066.2,355.3 | nápověda 540.9,281.4,639.1,379.6 98.1×98.1 | domeček 12,12,88,88 | kolečko 1092,12,1168,88',
  ],
  [
    'iPad 1180×820',
    20,
    'psaní',
    0,
    'příklad 229.1,132.9,950.9,281.3 | hvězdičky - | ovládání 90.3,495.4,1089.7,794.4 | nejmenší 149.5×149.5 krok 849.8×- | tečky 113.8,370.3,1066.2,406.6 | nápověda 530.2,322,649.8,441.6 119.6×119.6 | domeček 12,12,88,88 | kolečko 1092,12,1168,88',
  ],
  [
    'iPad 1180×820',
    20,
    'psaní',
    10,
    'příklad 229.1,132.9,950.9,281.3 | hvězdičky 362.6,39.5,817.4,71.5 | ovládání 90.3,495.4,1089.7,794.4 | nejmenší 149.5×149.5 krok 849.8×- | tečky 113.8,370.3,1066.2,406.6 | nápověda 530.2,322,649.8,441.6 119.6×119.6 | domeček 12,12,88,88 | kolečko 1092,12,1168,88',
  ],
  [
    'iPad 1180×760',
    5,
    'číselník',
    0,
    'příklad 216.9,88.3,963.1,306.9 | hvězdičky - | ovládání 115,597.7,1065,736.3 | nejmenší 138.5×138.5 krok 162.2×- | tečky 378.2,420.6,801.8,483.9 | nápověda 534.6,390.7,645.4,501.6 110.8×110.8 | domeček 12,12,88,88 | kolečko 1092,12,1168,88',
  ],
  [
    'iPad 1180×760',
    5,
    'číselník',
    10,
    'příklad 216.9,88.3,963.1,306.9 | hvězdičky 379.2,36.6,800.8,66.3 | ovládání 115,597.7,1065,736.3 | nejmenší 138.5×138.5 krok 162.2×- | tečky 378.2,420.6,801.8,483.9 | nápověda 534.6,390.7,645.4,501.6 110.8×110.8 | domeček 12,12,88,88 | kolečko 1092,12,1168,88',
  ],
  [
    'iPad 1180×760',
    5,
    'psaní',
    0,
    'příklad 216.9,88.3,963.1,306.9 | hvězdičky - | ovládání 245.6,419.6,934.4,736.3 | nejmenší 138.5×138.5 krok 550.2×- | tečky 378.2,331.5,801.8,394.9 | nápověda 539.9,306.9,640.1,407.2 100.3×100.3 | domeček 12,12,88,88 | kolečko 1092,12,1168,88',
  ],
  [
    'iPad 1180×760',
    5,
    'psaní',
    10,
    'příklad 216.9,88.3,963.1,306.9 | hvězdičky 379.2,36.6,800.8,66.3 | ovládání 245.6,419.6,934.4,736.3 | nejmenší 138.5×138.5 krok 550.2×- | tečky 378.2,331.5,801.8,394.9 | nápověda 539.9,306.9,640.1,407.2 100.3×100.3 | domeček 12,12,88,88 | kolečko 1092,12,1168,88',
  ],
  [
    'iPad 1180×760',
    10,
    'číselník',
    0,
    'příklad 200.1,108.5,979.9,286.7 | hvězdičky - | ovládání 115,439.4,1065,736.3 | nejmenší 138.5×138.5 krok 81.1×158.4 | tečky 243.6,331.4,936.4,394.7 | nápověda 534.6,301.4,645.4,412.3 110.8×110.8 | domeček 12,12,88,88 | kolečko 1092,12,1168,88',
  ],
  [
    'iPad 1180×760',
    10,
    'číselník',
    10,
    'příklad 200.1,108.5,979.9,286.7 | hvězdičky 379.2,36.6,800.8,66.3 | ovládání 115,439.4,1065,736.3 | nejmenší 138.5×138.5 krok 81.1×158.4 | tečky 243.6,331.4,936.4,394.7 | nápověda 534.6,301.4,645.4,412.3 110.8×110.8 | domeček 12,12,88,88 | kolečko 1092,12,1168,88',
  ],
  [
    'iPad 1180×760',
    10,
    'psaní',
    0,
    'příklad 200.1,108.5,979.9,286.7 | hvězdičky - | ovládání 126.9,459.2,1053.1,736.3 | nejmenší 138.5×138.5 krok 787.8×- | tečky 243.6,341.2,936.4,404.6 | nápověda 534.6,311.3,645.4,422.1 110.8×110.8 | domeček 12,12,88,88 | kolečko 1092,12,1168,88',
  ],
  [
    'iPad 1180×760',
    10,
    'psaní',
    10,
    'příklad 200.1,108.5,979.9,286.7 | hvězdičky 379.2,36.6,800.8,66.3 | ovládání 126.9,459.2,1053.1,736.3 | nejmenší 138.5×138.5 krok 787.8×- | tečky 243.6,341.2,936.4,404.6 | nápověda 534.6,311.3,645.4,422.1 110.8×110.8 | domeček 12,12,88,88 | kolečko 1092,12,1168,88',
  ],
  [
    'iPad 1180×760',
    20,
    'číselník',
    0,
    'příklad 255.5,123.2,924.5,260.8 | hvězdičky - | ovládání 128.9,364.2,1051.1,736.3 | nejmenší 114.8×114.8 krok 134.5×128.6 | tečky 148.6,295.7,1031.4,329.3 | nápověda 544.5,260.9,635.5,351.8 90.9×90.9 | domeček 12,12,88,88 | kolečko 1092,12,1168,88',
  ],
  [
    'iPad 1180×760',
    20,
    'číselník',
    10,
    'příklad 255.5,123.2,924.5,260.8 | hvězdičky 379.2,36.6,800.8,66.3 | ovládání 128.9,364.2,1051.1,736.3 | nejmenší 114.8×114.8 krok 134.5×128.6 | tečky 148.6,295.7,1031.4,329.3 | nápověda 544.5,260.9,635.5,351.8 90.9×90.9 | domeček 12,12,88,88 | kolečko 1092,12,1168,88',
  ],
  [
    'iPad 1180×760',
    20,
    'psaní',
    0,
    'příklad 255.5,123.2,924.5,260.8 | hvězdičky - | ovládání 126.9,459.2,1053.1,736.3 | nejmenší 138.5×138.5 krok 787.8×- | tečky 148.6,343.2,1031.4,376.8 | nápověda 534.6,298.4,645.4,409.2 110.8×110.8 | domeček 12,12,88,88 | kolečko 1092,12,1168,88',
  ],
  [
    'iPad 1180×760',
    20,
    'psaní',
    10,
    'příklad 255.5,123.2,924.5,260.8 | hvězdičky 379.2,36.6,800.8,66.3 | ovládání 126.9,459.2,1053.1,736.3 | nejmenší 138.5×138.5 krok 787.8×- | tečky 148.6,343.2,1031.4,376.8 | nápověda 534.6,298.4,645.4,409.2 110.8×110.8 | domeček 12,12,88,88 | kolečko 1092,12,1168,88',
  ],
  [
    '932×500 těsně nad hranicí',
    5,
    'číselník',
    0,
    'příklad 220.6,58.1,711.4,201.9 | hvězdičky - | ovládání 153.5,393.2,778.5,484.4 | nejmenší 91.1×91.1 krok 106.7×- | tečky 326.7,276.7,605.3,318.4 | nápověda 429.5,257.1,502.5,330 72.9×72.9 | domeček 12,12,88,88 | kolečko 844,12,920,88',
  ],
  [
    '932×500 těsně nad hranicí',
    5,
    'číselník',
    10,
    'příklad 220.6,58.1,711.4,201.9 | hvězdičky 327.3,24.1,604.7,43.6 | ovládání 153.5,393.2,778.5,484.4 | nejmenší 91.1×91.1 krok 106.7×- | tečky 326.7,276.7,605.3,318.4 | nápověda 429.5,257.1,502.5,330 72.9×72.9 | domeček 12,12,88,88 | kolečko 844,12,920,88',
  ],
  [
    '932×500 těsně nad hranicí',
    5,
    'psaní',
    0,
    'příklad 220.6,58.1,711.4,201.9 | hvězdičky - | ovládání 239.4,276,692.6,484.4 | nejmenší 91.1×91.1 krok 362×- | tečky 326.7,218.1,605.3,259.8 | nápověda 433,201.9,499,267.9 66×66 | domeček 12,12,88,88 | kolečko 844,12,920,88',
  ],
  [
    '932×500 těsně nad hranicí',
    5,
    'psaní',
    10,
    'příklad 220.6,58.1,711.4,201.9 | hvězdičky 327.3,24.1,604.7,43.6 | ovládání 239.4,276,692.6,484.4 | nejmenší 91.1×91.1 krok 362×- | tečky 326.7,218.1,605.3,259.8 | nápověda 433,201.9,499,267.9 66×66 | domeček 12,12,88,88 | kolečko 844,12,920,88',
  ],
  [
    '932×500 těsně nad hranicí',
    10,
    'číselník',
    0,
    'příklad 209.5,71.4,722.5,188.6 | hvězdičky - | ovládání 153.5,289.1,778.5,484.4 | nejmenší 91.1×91.1 krok 53.3×104.2 | tečky 238.1,218,693.9,259.7 | nápověda 429.5,198.3,502.5,271.2 72.9×72.9 | domeček 12,12,88,88 | kolečko 844,12,920,88',
  ],
  [
    '932×500 těsně nad hranicí',
    10,
    'číselník',
    10,
    'příklad 209.5,71.4,722.5,188.6 | hvězdičky 327.3,24.1,604.7,43.6 | ovládání 153.5,289.1,778.5,484.4 | nejmenší 91.1×91.1 krok 53.3×104.2 | tečky 238.1,218,693.9,259.7 | nápověda 429.5,198.3,502.5,271.2 72.9×72.9 | domeček 12,12,88,88 | kolečko 844,12,920,88',
  ],
  [
    '932×500 těsně nad hranicí',
    10,
    'psaní',
    0,
    'příklad 209.5,71.4,722.5,188.6 | hvězdičky - | ovládání 161.3,302.1,770.7,484.4 | nejmenší 91.1×91.1 krok 518.2×- | tečky 238.1,224.5,693.9,266.2 | nápověda 429.5,204.8,502.5,277.7 72.9×72.9 | domeček 12,12,88,88 | kolečko 844,12,920,88',
  ],
  [
    '932×500 těsně nad hranicí',
    10,
    'psaní',
    10,
    'příklad 209.5,71.4,722.5,188.6 | hvězdičky 327.3,24.1,604.7,43.6 | ovládání 161.3,302.1,770.7,484.4 | nejmenší 91.1×91.1 krok 518.2×- | tečky 238.1,224.5,693.9,266.2 | nápověda 429.5,204.8,502.5,277.7 72.9×72.9 | domeček 12,12,88,88 | kolečko 844,12,920,88',
  ],
  [
    '932×500 těsně nad hranicí',
    20,
    'číselník',
    0,
    'příklad 245.9,81.1,686.1,171.5 | hvězdičky - | ovládání 162.6,239.6,769.4,484.4 | nejmenší 75.5×75.5 krok 88.5×84.6 | tečky 175.6,194.5,756.4,216.7 | nápověda 436.1,171.6,495.9,231.4 59.8×59.8 | domeček 12,12,88,88 | kolečko 844,12,920,88',
  ],
  [
    '932×500 těsně nad hranicí',
    20,
    'číselník',
    10,
    'příklad 245.9,81.1,686.1,171.5 | hvězdičky 327.3,24.1,604.7,43.6 | ovládání 162.6,239.6,769.4,484.4 | nejmenší 75.5×75.5 krok 88.5×84.6 | tečky 175.6,194.5,756.4,216.7 | nápověda 436.1,171.6,495.9,231.4 59.8×59.8 | domeček 12,12,88,88 | kolečko 844,12,920,88',
  ],
  [
    '932×500 těsně nad hranicí',
    20,
    'psaní',
    0,
    'příklad 245.9,81.1,686.1,171.5 | hvězdičky - | ovládání 161.3,302.1,770.7,484.4 | nejmenší 91.1×91.1 krok 518.2×- | tečky 175.6,225.8,756.4,247.9 | nápověda 429.5,196.3,502.5,269.2 72.9×72.9 | domeček 12,12,88,88 | kolečko 844,12,920,88',
  ],
  [
    '932×500 těsně nad hranicí',
    20,
    'psaní',
    10,
    'příklad 245.9,81.1,686.1,171.5 | hvězdičky 327.3,24.1,604.7,43.6 | ovládání 161.3,302.1,770.7,484.4 | nejmenší 91.1×91.1 krok 518.2×- | tečky 175.6,225.8,756.4,247.9 | nápověda 429.5,196.3,502.5,269.2 72.9×72.9 | domeček 12,12,88,88 | kolečko 844,12,920,88',
  ],
  [
    '744×296 nejmenší telefon',
    10,
    'číselník',
    0,
    'příklad 216,4,384,42.5 | hvězdičky - | ovládání 10,156,734,292 | nejmenší 114×64 krok 122×72 | tečky 180,49,420,145 | nápověda 264,61,336,133 72×72 | domeček 8,8,72,72 | kolečko 672,8,736,72',
  ],
  [
    '744×296 nejmenší telefon',
    10,
    'číselník',
    10,
    'příklad 216,4,384,42.5 | hvězdičky 512,14,652,67 | ovládání 10,156,734,292 | nejmenší 114×64 krok 122×72 | tečky 180,49,420,145 | nápověda 264,61,336,133 72×72 | domeček 8,8,72,72 | kolečko 672,8,736,72',
  ],
  [
    '744×296 nejmenší telefon',
    10,
    'psaní',
    0,
    'příklad 97,6.5,391,73.5 | hvězdičky - | ovládání 82,92,662,292 | nejmenší 72×72 krok 508×- | tečky 403,20,503,60 | nápověda 417,4,489,76 72×72 | domeček 8,8,72,72 | kolečko 672,8,736,72',
  ],
  [
    '744×296 nejmenší telefon',
    10,
    'psaní',
    10,
    'příklad 97,6.5,391,73.5 | hvězdičky 512,14,652,67 | ovládání 82,92,662,292 | nejmenší 72×72 krok 508×- | tečky 403,20,503,60 | nápověda 417,4,489,76 72×72 | domeček 8,8,72,72 | kolečko 672,8,736,72',
  ],
  [
    '800×300 Samsung s Chromem',
    10,
    'číselník',
    0,
    'příklad 97,28,307,76 | hvězdičky - | ovládání 8,128,792,296 | nejmenší 124×80 krok 132×88 | tečky 319,4,559,100 | nápověda 403,16,475,88 72×72 | domeček 8,8,72,72 | kolečko 728,8,792,72',
  ],
  [
    '800×300 Samsung s Chromem',
    10,
    'číselník',
    10,
    'příklad 97,28,307,76 | hvězdičky 568,14,708,67 | ovládání 8,128,792,296 | nejmenší 124×80 krok 132×88 | tečky 319,4,559,100 | nápověda 403,16,475,88 72×72 | domeček 8,8,72,72 | kolečko 728,8,792,72',
  ],
  [
    '800×300 Samsung s Chromem',
    10,
    'psaní',
    0,
    'příklad 94,4,430,81 | hvězdičky - | ovládání 110,96,690,296 | nejmenší 72×72 krok 508×- | tečky 444,21,560,65 | nápověda 466,7,538,79 72×72 | domeček 8,8,72,72 | kolečko 728,8,792,72',
  ],
  [
    '800×300 Samsung s Chromem',
    10,
    'psaní',
    10,
    'příklad 94,4,430,81 | hvězdičky 568,14,708,67 | ovládání 110,96,690,296 | nejmenší 72×72 krok 508×- | tečky 444,21,560,65 | nápověda 466,7,538,79 72×72 | domeček 8,8,72,72 | kolečko 728,8,792,72',
  ],
  [
    '844×340 iPhone se Safari',
    10,
    'číselník',
    0,
    'příklad 224,4,476,61.5 | hvězdičky - | ovládání 57,179,787,315 | nejmenší 115×64 krok 123×72 | tečky 230,68,470,164 | nápověda 314,80,386,152 72×72 | domeček 55,8,119,72 | kolečko 725,8,789,72',
  ],
  [
    '844×340 iPhone se Safari',
    10,
    'číselník',
    10,
    'příklad 224,4,476,61.5 | hvězdičky 565,14,705,67 | ovládání 57,179,787,315 | nejmenší 115×64 krok 123×72 | tečky 230,68,470,164 | nápověda 314,80,386,152 72×72 | domeček 55,8,119,72 | kolečko 725,8,789,72',
  ],
  [
    '844×340 iPhone se Safari',
    10,
    'psaní',
    0,
    'příklad 142,6.5,436,73.5 | hvězdičky - | ovládání 112,95,732,315 | nejmenší 72×72 krok 548×- | tečky 449,19,557,61 | nápověda 467,4,539,76 72×72 | domeček 55,8,119,72 | kolečko 725,8,789,72',
  ],
  [
    '844×340 iPhone se Safari',
    10,
    'psaní',
    10,
    'příklad 142,6.5,436,73.5 | hvězdičky 565,14,705,67 | ovládání 112,95,732,315 | nejmenší 72×72 krok 548×- | tečky 449,19,557,61 | nápověda 467,4,539,76 72×72 | domeček 55,8,119,72 | kolečko 725,8,789,72',
  ],
  [
    '932×430 iPhone Pro Max',
    10,
    'číselník',
    0,
    'příklad 205,4,583,90.5 | hvězdičky - | ovládání 68,237,864,405 | nejmenší 126×80 krok 134×88 | tečky 254,97,534,209 | nápověda 358,117,430,189 72×72 | domeček 67,8,131,72 | kolečko 801,8,865,72',
  ],
  [
    '932×430 iPhone Pro Max',
    10,
    'číselník',
    10,
    'příklad 205,4,583,90.5 | hvězdičky 641,14,781,67 | ovládání 68,237,864,405 | nejmenší 126×80 krok 134×88 | tečky 254,97,534,209 | nápověda 358,117,430,189 72×72 | domeček 67,8,131,72 | kolečko 801,8,865,72',
  ],
  [
    '932×430 iPhone Pro Max',
    10,
    'psaní',
    0,
    'příklad 205,4,583,90.5 | hvězdičky - | ovládání 156,185,776,405 | nejmenší 72×72 krok 548×- | tečky 317,100,471,158 | nápověda 358,96.5,430,168.5 72×72 | domeček 67,8,131,72 | kolečko 801,8,865,72',
  ],
  [
    '932×430 iPhone Pro Max',
    10,
    'psaní',
    10,
    'příklad 205,4,583,90.5 | hvězdičky 641,14,781,67 | ovládání 156,185,776,405 | nejmenší 72×72 krok 548×- | tečky 317,100,471,158 | nápověda 358,96.5,430,168.5 72×72 | domeček 67,8,131,72 | kolečko 801,8,865,72',
  ],
  [
    '932×499 těsně pod hranicí',
    10,
    'číselník',
    0,
    'příklad 205,4,583,90.5 | hvězdičky - | ovládání 8,327,924,495 | nejmenší 146×80 krok 154×88 | tečky 254,97,534,209 | nápověda 358,117,430,189 72×72 | domeček 8,8,72,72 | kolečko 860,8,924,72',
  ],
  [
    '932×499 těsně pod hranicí',
    10,
    'číselník',
    10,
    'příklad 205,4,583,90.5 | hvězdičky 700,14,840,67 | ovládání 8,327,924,495 | nejmenší 146×80 krok 154×88 | tečky 254,97,534,209 | nápověda 358,117,430,189 72×72 | domeček 8,8,72,72 | kolečko 860,8,924,72',
  ],
  [
    '932×499 těsně pod hranicí',
    10,
    'psaní',
    0,
    'příklad 119,4,497,90.5 | hvězdičky - | ovládání 156,275,776,495 | nejmenší 72×72 krok 548×- | tečky 512,19,666,77 | nápověda 553,12,625,84 72×72 | domeček 8,8,72,72 | kolečko 860,8,924,72',
  ],
  [
    '932×499 těsně pod hranicí',
    10,
    'psaní',
    10,
    'příklad 119,4,497,90.5 | hvězdičky 700,14,840,67 | ovládání 156,275,776,495 | nejmenší 72×72 krok 548×- | tečky 512,19,666,77 | nápověda 553,12,625,84 72×72 | domeček 8,8,72,72 | kolečko 860,8,924,72',
  ],
  [
    '932×499 těsně pod hranicí s výřezem',
    10,
    'číselník',
    0,
    'příklad 205,4,583,90.5 | hvězdičky - | ovládání 68,306,864,474 | nejmenší 126×80 krok 134×88 | tečky 254,97,534,209 | nápověda 358,117,430,189 72×72 | domeček 67,8,131,72 | kolečko 801,8,865,72',
  ],
  [
    '932×499 těsně pod hranicí s výřezem',
    10,
    'číselník',
    10,
    'příklad 205,4,583,90.5 | hvězdičky 641,14,781,67 | ovládání 68,306,864,474 | nejmenší 126×80 krok 134×88 | tečky 254,97,534,209 | nápověda 358,117,430,189 72×72 | domeček 67,8,131,72 | kolečko 801,8,865,72',
  ],
  [
    '932×499 těsně pod hranicí s výřezem',
    10,
    'psaní',
    0,
    'příklad 205,4,583,90.5 | hvězdičky - | ovládání 156,254,776,474 | nejmenší 72×72 krok 548×- | tečky 317,100,471,158 | nápověda 358,96.5,430,168.5 72×72 | domeček 67,8,131,72 | kolečko 801,8,865,72',
  ],
  [
    '932×499 těsně pod hranicí s výřezem',
    10,
    'psaní',
    10,
    'příklad 205,4,583,90.5 | hvězdičky 641,14,781,67 | ovládání 156,254,776,474 | nejmenší 72×72 krok 548×- | tečky 317,100,471,158 | nápověda 358,96.5,430,168.5 72×72 | domeček 67,8,131,72 | kolečko 801,8,865,72',
  ],
  [
    '390×844 iPhone 13–15 (výřez 47, lišta 34)',
    10,
    'číselník',
    0,
    'příklad 6,123,384,209.5 | hvězdičky - | ovládání 51,406,339,794 | nejmenší 88×88 krok 50×100 | tečky 55,218,335,338 | nápověda 159,242,231,314 72×72 | domeček 8,55,72,119 | kolečko 318,55,382,119',
  ],
  [
    '390×844 iPhone 13–15 (výřez 47, lišta 34)',
    10,
    'číselník',
    10,
    'příklad 6,123,384,209.5 | hvězdičky 119,61,271,113 | ovládání 51,406,339,794 | nejmenší 88×88 krok 50×100 | tečky 55,218,335,338 | nápověda 159,242,231,314 72×72 | domeček 8,55,72,119 | kolečko 318,55,382,119',
  ],
  [
    '390×844 iPhone 13–15 (výřez 47, lišta 34)',
    10,
    'psaní',
    0,
    'příklad 6,123,384,209.5 | hvězdičky - | ovládání 9,418,381,794 | nejmenší 72×72 krok 300×- | tečky 34,221,356,247 | nápověda 159,209.5,231,281.5 72×72 | domeček 8,55,72,119 | kolečko 318,55,382,119',
  ],
  [
    '390×844 iPhone 13–15 (výřez 47, lišta 34)',
    10,
    'psaní',
    10,
    'příklad 6,123,384,209.5 | hvězdičky 119,61,271,113 | ovládání 9,418,381,794 | nejmenší 72×72 krok 300×- | tečky 34,221,356,247 | nápověda 159,209.5,231,281.5 72×72 | domeček 8,55,72,119 | kolečko 318,55,382,119',
  ],
  [
    '390×664 iPhone v Safari s lištou',
    10,
    'číselník',
    0,
    'příklad 6,76,384,162.5 | hvězdičky - | ovládání 91,368,299,648 | nejmenší 64×64 krok 36×72 | tečky 55,171,335,291 | nápověda 159,195,231,267 72×72 | domeček 8,8,72,72 | kolečko 318,8,382,72',
  ],
  [
    '390×664 iPhone v Safari s lištou',
    10,
    'číselník',
    10,
    'příklad 6,76,384,162.5 | hvězdičky 119,14,271,66 | ovládání 91,368,299,648 | nejmenší 64×64 krok 36×72 | tečky 55,171,335,291 | nápověda 159,195,231,267 72×72 | domeček 8,8,72,72 | kolečko 318,8,382,72',
  ],
  [
    '390×664 iPhone v Safari s lištou',
    10,
    'psaní',
    0,
    'příklad 6,76,384,162.5 | hvězdičky - | ovládání 9,272,381,648 | nejmenší 72×72 krok 300×- | tečky 34,174,356,200 | nápověda 159,162.5,231,234.5 72×72 | domeček 8,8,72,72 | kolečko 318,8,382,72',
  ],
  [
    '390×664 iPhone v Safari s lištou',
    10,
    'psaní',
    10,
    'příklad 6,76,384,162.5 | hvězdičky 119,14,271,66 | ovládání 9,272,381,648 | nejmenší 72×72 krok 300×- | tečky 34,174,356,200 | nápověda 159,162.5,231,234.5 72×72 | domeček 8,8,72,72 | kolečko 318,8,382,72',
  ],
  [
    '360×780 Samsung s Chromem',
    10,
    'číselník',
    0,
    'příklad 12,76,348,153 | hvězdičky - | ovládání 36,376,324,764 | nejmenší 88×88 krok 50×100 | tečky 40,161,320,281 | nápověda 144,185,216,257 72×72 | domeček 8,8,72,72 | kolečko 288,8,352,72',
  ],
  [
    '360×780 Samsung s Chromem',
    10,
    'číselník',
    10,
    'příklad 12,76,348,153 | hvězdičky 104,14,256,66 | ovládání 36,376,324,764 | nejmenší 88×88 krok 50×100 | tečky 40,161,320,281 | nápověda 144,185,216,257 72×72 | domeček 8,8,72,72 | kolečko 288,8,352,72',
  ],
  [
    '360×780 Samsung s Chromem',
    10,
    'psaní',
    0,
    'příklad 12,76,348,153 | hvězdičky - | ovládání 4,404,356,764 | nejmenší 72×72 krok 280×- | tečky 19,164,341,190 | nápověda 144,153,216,225 72×72 | domeček 8,8,72,72 | kolečko 288,8,352,72',
  ],
  [
    '360×780 Samsung s Chromem',
    10,
    'psaní',
    10,
    'příklad 12,76,348,153 | hvězdičky 104,14,256,66 | ovládání 4,404,356,764 | nejmenší 72×72 krok 280×- | tečky 19,164,341,190 | nápověda 144,153,216,225 72×72 | domeček 8,8,72,72 | kolečko 288,8,352,72',
  ],
  [
    '375×667 iPhone SE',
    10,
    'číselník',
    0,
    'příklad 19.5,76,355.5,153 | hvězdičky - | ovládání 83.5,371,291.5,651 | nejmenší 64×64 krok 36×72 | tečky 47.5,161,327.5,281 | nápověda 151.5,185,223.5,257 72×72 | domeček 8,8,72,72 | kolečko 303,8,367,72',
  ],
  [
    '375×667 iPhone SE',
    10,
    'číselník',
    10,
    'příklad 19.5,76,355.5,153 | hvězdičky 111.5,14,263.5,66 | ovládání 83.5,371,291.5,651 | nejmenší 64×64 krok 36×72 | tečky 47.5,161,327.5,281 | nápověda 151.5,185,223.5,257 72×72 | domeček 8,8,72,72 | kolečko 303,8,367,72',
  ],
  [
    '375×667 iPhone SE',
    10,
    'psaní',
    0,
    'příklad 19.5,76,355.5,153 | hvězdičky - | ovládání 11.5,291,363.5,651 | nejmenší 72×72 krok 280×- | tečky 26.5,164,348.5,190 | nápověda 151.5,153,223.5,225 72×72 | domeček 8,8,72,72 | kolečko 303,8,367,72',
  ],
  [
    '375×667 iPhone SE',
    10,
    'psaní',
    10,
    'příklad 19.5,76,355.5,153 | hvězdičky 111.5,14,263.5,66 | ovládání 11.5,291,363.5,651 | nejmenší 72×72 krok 280×- | tečky 26.5,164,348.5,190 | nápověda 151.5,153,223.5,225 72×72 | domeček 8,8,72,72 | kolečko 303,8,367,72',
  ],
  [
    '430×932 iPhone Pro Max (výřez 59, lišta 34)',
    10,
    'číselník',
    0,
    'příklad 26,135,404,221.5 | hvězdičky - | ovládání 45,424,385,882 | nejmenší 104×104 krok 59×118 | tečky 75,230,355,350 | nápověda 179,254,251,326 72×72 | domeček 8,67,72,131 | kolečko 358,67,422,131',
  ],
  [
    '430×932 iPhone Pro Max (výřez 59, lišta 34)',
    10,
    'číselník',
    10,
    'příklad 26,135,404,221.5 | hvězdičky 139,73,291,125 | ovládání 45,424,385,882 | nejmenší 104×104 krok 59×118 | tečky 75,230,355,350 | nápověda 179,254,251,326 72×72 | domeček 8,67,72,131 | kolečko 358,67,422,131',
  ],
  [
    '430×932 iPhone Pro Max (výřez 59, lišta 34)',
    10,
    'psaní',
    0,
    'příklad 26,135,404,221.5 | hvězdičky - | ovládání 9,474,421,882 | nejmenší 72×72 krok 340×- | tečky 54,233,376,259 | nápověda 179,221.5,251,293.5 72×72 | domeček 8,67,72,131 | kolečko 358,67,422,131',
  ],
  [
    '430×932 iPhone Pro Max (výřez 59, lišta 34)',
    10,
    'psaní',
    10,
    'příklad 26,135,404,221.5 | hvězdičky 139,73,291,125 | ovládání 9,474,421,882 | nejmenší 72×72 krok 340×- | tečky 54,233,376,259 | nápověda 179,221.5,251,293.5 72×72 | domeček 8,67,72,131 | kolečko 358,67,422,131',
  ],
  [
    '360×620 nejmenší telefon na výšku',
    10,
    'číselník',
    0,
    'příklad 12,76,348,153 | hvězdičky - | ovládání 76,324,284,604 | nejmenší 64×64 krok 36×72 | tečky 60,161,300,265 | nápověda 144,177,216,249 72×72 | domeček 8,8,72,72 | kolečko 288,8,352,72',
  ],
  [
    '360×620 nejmenší telefon na výšku',
    10,
    'číselník',
    10,
    'příklad 12,76,348,153 | hvězdičky 104,14,256,66 | ovládání 76,324,284,604 | nejmenší 64×64 krok 36×72 | tečky 60,161,300,265 | nápověda 144,177,216,249 72×72 | domeček 8,8,72,72 | kolečko 288,8,352,72',
  ],
  [
    '360×620 nejmenší telefon na výšku',
    10,
    'psaní',
    0,
    'příklad 12,76,348,153 | hvězdičky - | ovládání 4,244,356,604 | nejmenší 72×72 krok 280×- | tečky 19,164,341,190 | nápověda 144,153,216,225 72×72 | domeček 8,8,72,72 | kolečko 288,8,352,72',
  ],
  [
    '360×620 nejmenší telefon na výšku',
    10,
    'psaní',
    10,
    'příklad 12,76,348,153 | hvězdičky 104,14,256,66 | ovládání 4,244,356,604 | nejmenší 72×72 krok 280×- | tečky 19,164,341,190 | nápověda 144,153,216,225 72×72 | domeček 8,8,72,72 | kolečko 288,8,352,72',
  ],
  [
    '499×932 těsně pod hranicí šířky',
    10,
    'číselník',
    0,
    'příklad 60.5,76,438.5,162.5 | hvězdičky - | ovládání 79.5,458,419.5,916 | nejmenší 104×104 krok 59×118 | tečky 109.5,171,389.5,291 | nápověda 213.5,195,285.5,267 72×72 | domeček 8,8,72,72 | kolečko 427,8,491,72',
  ],
  [
    '499×932 těsně pod hranicí šířky',
    10,
    'číselník',
    10,
    'příklad 60.5,76,438.5,162.5 | hvězdičky 173.5,14,325.5,66 | ovládání 79.5,458,419.5,916 | nejmenší 104×104 krok 59×118 | tečky 109.5,171,389.5,291 | nápověda 213.5,195,285.5,267 72×72 | domeček 8,8,72,72 | kolečko 427,8,491,72',
  ],
  [
    '499×932 těsně pod hranicí šířky',
    10,
    'psaní',
    0,
    'příklad 60.5,76,438.5,162.5 | hvězdičky - | ovládání 43.5,508,455.5,916 | nejmenší 72×72 krok 340×- | tečky 88.5,174,410.5,200 | nápověda 213.5,162.5,285.5,234.5 72×72 | domeček 8,8,72,72 | kolečko 427,8,491,72',
  ],
  [
    '499×932 těsně pod hranicí šířky',
    10,
    'psaní',
    10,
    'příklad 60.5,76,438.5,162.5 | hvězdičky 173.5,14,325.5,66 | ovládání 43.5,508,455.5,916 | nejmenší 72×72 krok 340×- | tečky 88.5,174,410.5,200 | nápověda 213.5,162.5,285.5,234.5 72×72 | domeček 8,8,72,72 | kolečko 427,8,491,72',
  ],
  [
    '375×1180 úzký iPad (Split View)',
    10,
    'číselník',
    0,
    'příklad 19.5,76,355.5,153 | hvězdičky - | ovládání 17.5,706,357.5,1164 | nejmenší 104×104 krok 59×118 | tečky 47.5,161,327.5,281 | nápověda 151.5,185,223.5,257 72×72 | domeček 8,8,72,72 | kolečko 303,8,367,72',
  ],
  [
    '375×1180 úzký iPad (Split View)',
    10,
    'číselník',
    10,
    'příklad 19.5,76,355.5,153 | hvězdičky 111.5,14,263.5,66 | ovládání 17.5,706,357.5,1164 | nejmenší 104×104 krok 59×118 | tečky 47.5,161,327.5,281 | nápověda 151.5,185,223.5,257 72×72 | domeček 8,8,72,72 | kolečko 303,8,367,72',
  ],
  [
    '375×1180 úzký iPad (Split View)',
    10,
    'psaní',
    0,
    'příklad 19.5,76,355.5,153 | hvězdičky - | ovládání 11.5,804,363.5,1164 | nejmenší 72×72 krok 280×- | tečky 26.5,164,348.5,190 | nápověda 151.5,153,223.5,225 72×72 | domeček 8,8,72,72 | kolečko 303,8,367,72',
  ],
  [
    '375×1180 úzký iPad (Split View)',
    10,
    'psaní',
    10,
    'příklad 19.5,76,355.5,153 | hvězdičky 111.5,14,263.5,66 | ovládání 11.5,804,363.5,1164 | nejmenší 72×72 krok 280×- | tečky 26.5,164,348.5,190 | nápověda 151.5,153,223.5,225 72×72 | domeček 8,8,72,72 | kolečko 303,8,367,72',
  ],
  [
    'iPad na šířku z plochy (stavový řádek 24, lišta 20)',
    5,
    'číselník',
    0,
    'příklad 187.5,95.2,992.5,331.2 | hvězdičky - | ovládání 77.5,644.9,1102.5,794.4 | nejmenší 149.5×149.5 krok 175.1×- | tečky 361.5,453.8,818.5,522.2 | nápověda 530.2,421.6,649.8,541.2 119.6×119.6 | domeček 12,36,88,112 | kolečko 1092,36,1168,112',
  ],
  [
    'iPad na šířku z plochy (stavový řádek 24, lišta 20)',
    5,
    'číselník',
    10,
    'příklad 187.5,95.2,992.5,331.2 | hvězdičky 362.6,39.5,817.4,71.5 | ovládání 77.5,644.9,1102.5,794.4 | nejmenší 149.5×149.5 krok 175.1×- | tečky 361.5,453.8,818.5,522.2 | nápověda 530.2,421.6,649.8,541.2 119.6×119.6 | domeček 12,36,88,112 | kolečko 1092,36,1168,112',
  ],
  [
    'iPad na šířku z plochy (stavový řádek 24, lišta 20)',
    5,
    'psaní',
    0,
    'příklad 187.5,95.2,992.5,331.2 | hvězdičky - | ovládání 218.4,452.7,961.6,794.4 | nejmenší 149.5×149.5 krok 593.6×- | tečky 361.5,357.7,818.5,426.1 | nápověda 535.9,331.2,644.1,439.4 108.2×108.2 | domeček 12,36,88,112 | kolečko 1092,36,1168,112',
  ],
  [
    'iPad na šířku z plochy (stavový řádek 24, lišta 20)',
    5,
    'psaní',
    10,
    'příklad 187.5,95.2,992.5,331.2 | hvězdičky 362.6,39.5,817.4,71.5 | ovládání 218.4,452.7,961.6,794.4 | nejmenší 149.5×149.5 krok 593.6×- | tečky 361.5,357.7,818.5,426.1 | nápověda 535.9,331.2,644.1,439.4 108.2×108.2 | domeček 12,36,88,112 | kolečko 1092,36,1168,112',
  ],
  [
    'iPad na šířku z plochy (stavový řádek 24, lišta 20)',
    10,
    'číselník',
    0,
    'příklad 169.3,117.1,1010.7,309.3 | hvězdičky - | ovládání 77.5,474.1,1102.5,794.4 | nejmenší 149.5×149.5 krok 87.5×170.8 | tečky 216.3,357.5,963.7,425.8 | nápověda 530.2,325.2,649.8,444.8 119.6×119.6 | domeček 12,36,88,112 | kolečko 1092,36,1168,112',
  ],
  [
    'iPad na šířku z plochy (stavový řádek 24, lišta 20)',
    10,
    'číselník',
    10,
    'příklad 169.3,117.1,1010.7,309.3 | hvězdičky 362.6,39.5,817.4,71.5 | ovládání 77.5,474.1,1102.5,794.4 | nejmenší 149.5×149.5 krok 87.5×170.8 | tečky 216.3,357.5,963.7,425.8 | nápověda 530.2,325.2,649.8,444.8 119.6×119.6 | domeček 12,36,88,112 | kolečko 1092,36,1168,112',
  ],
  [
    'iPad na šířku z plochy (stavový řádek 24, lišta 20)',
    10,
    'psaní',
    0,
    'příklad 169.3,117.1,1010.7,309.3 | hvězdičky - | ovládání 90.3,495.4,1089.7,794.4 | nejmenší 149.5×149.5 krok 849.8×- | tečky 216.3,368.2,963.7,436.5 | nápověda 530.2,335.9,649.8,455.5 119.6×119.6 | domeček 12,36,88,112 | kolečko 1092,36,1168,112',
  ],
  [
    'iPad na šířku z plochy (stavový řádek 24, lišta 20)',
    10,
    'psaní',
    10,
    'příklad 169.3,117.1,1010.7,309.3 | hvězdičky 362.6,39.5,817.4,71.5 | ovládání 90.3,495.4,1089.7,794.4 | nejmenší 149.5×149.5 krok 849.8×- | tečky 216.3,368.2,963.7,436.5 | nápověda 530.2,335.9,649.8,455.5 119.6×119.6 | domeček 12,36,88,112 | kolečko 1092,36,1168,112',
  ],
  [
    'iPad na šířku z plochy (stavový řádek 24, lišta 20)',
    20,
    'číselník',
    0,
    'příklad 229.1,132.9,950.9,281.3 | hvězdičky - | ovládání 92.4,392.9,1087.6,794.4 | nejmenší 123.9×123.9 krok 145.2×138.8 | tečky 113.8,319,1066.2,355.3 | nápověda 540.9,281.4,639.1,379.6 98.1×98.1 | domeček 12,36,88,112 | kolečko 1092,36,1168,112',
  ],
  [
    'iPad na šířku z plochy (stavový řádek 24, lišta 20)',
    20,
    'číselník',
    10,
    'příklad 229.1,132.9,950.9,281.3 | hvězdičky 362.6,39.5,817.4,71.5 | ovládání 92.4,392.9,1087.6,794.4 | nejmenší 123.9×123.9 krok 145.2×138.8 | tečky 113.8,319,1066.2,355.3 | nápověda 540.9,281.4,639.1,379.6 98.1×98.1 | domeček 12,36,88,112 | kolečko 1092,36,1168,112',
  ],
  [
    'iPad na šířku z plochy (stavový řádek 24, lišta 20)',
    20,
    'psaní',
    0,
    'příklad 229.1,132.9,950.9,281.3 | hvězdičky - | ovládání 90.3,495.4,1089.7,794.4 | nejmenší 149.5×149.5 krok 849.8×- | tečky 113.8,370.3,1066.2,406.6 | nápověda 530.2,322,649.8,441.6 119.6×119.6 | domeček 12,36,88,112 | kolečko 1092,36,1168,112',
  ],
  [
    'iPad na šířku z plochy (stavový řádek 24, lišta 20)',
    20,
    'psaní',
    10,
    'příklad 229.1,132.9,950.9,281.3 | hvězdičky 362.6,39.5,817.4,71.5 | ovládání 90.3,495.4,1089.7,794.4 | nejmenší 149.5×149.5 krok 849.8×- | tečky 113.8,370.3,1066.2,406.6 | nápověda 530.2,322,649.8,441.6 119.6×119.6 | domeček 12,36,88,112 | kolečko 1092,36,1168,112',
  ],
  [
    'iPhone 430×932 na výšku z plochy (výřez 59, lišta 34)',
    10,
    'číselník',
    0,
    'příklad 26,135,404,221.5 | hvězdičky - | ovládání 45,424,385,882 | nejmenší 104×104 krok 59×118 | tečky 75,230,355,350 | nápověda 179,254,251,326 72×72 | domeček 8,67,72,131 | kolečko 358,67,422,131',
  ],
  [
    'iPhone 430×932 na výšku z plochy (výřez 59, lišta 34)',
    10,
    'číselník',
    10,
    'příklad 26,135,404,221.5 | hvězdičky 139,73,291,125 | ovládání 45,424,385,882 | nejmenší 104×104 krok 59×118 | tečky 75,230,355,350 | nápověda 179,254,251,326 72×72 | domeček 8,67,72,131 | kolečko 358,67,422,131',
  ],
  [
    'iPhone 430×932 na výšku z plochy (výřez 59, lišta 34)',
    10,
    'psaní',
    0,
    'příklad 26,135,404,221.5 | hvězdičky - | ovládání 9,474,421,882 | nejmenší 72×72 krok 340×- | tečky 54,233,376,259 | nápověda 179,221.5,251,293.5 72×72 | domeček 8,67,72,131 | kolečko 358,67,422,131',
  ],
  [
    'iPhone 430×932 na výšku z plochy (výřez 59, lišta 34)',
    10,
    'psaní',
    10,
    'příklad 26,135,404,221.5 | hvězdičky 139,73,291,125 | ovládání 9,474,421,882 | nejmenší 72×72 krok 340×- | tečky 54,233,376,259 | nápověda 179,221.5,251,293.5 72×72 | domeček 8,67,72,131 | kolečko 358,67,422,131',
  ],
  [
    'iPhone 393×852 na výšku z plochy (výřez 59, lišta 34)',
    10,
    'číselník',
    0,
    'příklad 7.5,135,385.5,221.5 | hvězdičky - | ovládání 52.5,414,340.5,802 | nejmenší 88×88 krok 50×100 | tečky 56.5,230,336.5,350 | nápověda 160.5,254,232.5,326 72×72 | domeček 8,67,72,131 | kolečko 321,67,385,131',
  ],
  [
    'iPhone 393×852 na výšku z plochy (výřez 59, lišta 34)',
    10,
    'číselník',
    10,
    'příklad 7.5,135,385.5,221.5 | hvězdičky 120.5,73,272.5,125 | ovládání 52.5,414,340.5,802 | nejmenší 88×88 krok 50×100 | tečky 56.5,230,336.5,350 | nápověda 160.5,254,232.5,326 72×72 | domeček 8,67,72,131 | kolečko 321,67,385,131',
  ],
  [
    'iPhone 393×852 na výšku z plochy (výřez 59, lišta 34)',
    10,
    'psaní',
    0,
    'příklad 7.5,135,385.5,221.5 | hvězdičky - | ovládání 10.5,426,382.5,802 | nejmenší 72×72 krok 300×- | tečky 35.5,233,357.5,259 | nápověda 160.5,221.5,232.5,293.5 72×72 | domeček 8,67,72,131 | kolečko 321,67,385,131',
  ],
  [
    'iPhone 393×852 na výšku z plochy (výřez 59, lišta 34)',
    10,
    'psaní',
    10,
    'příklad 7.5,135,385.5,221.5 | hvězdičky 120.5,73,272.5,125 | ovládání 10.5,426,382.5,802 | nejmenší 72×72 krok 300×- | tečky 35.5,233,357.5,259 | nápověda 160.5,221.5,232.5,293.5 72×72 | domeček 8,67,72,131 | kolečko 321,67,385,131',
  ],
  [
    'iPhone 932×430 na šířku z plochy (výřez 59, lišta 21)',
    10,
    'číselník',
    0,
    'příklad 205,4,583,90.5 | hvězdičky - | ovládání 68,237,864,405 | nejmenší 126×80 krok 134×88 | tečky 254,97,534,209 | nápověda 358,117,430,189 72×72 | domeček 67,8,131,72 | kolečko 801,8,865,72',
  ],
  [
    'iPhone 932×430 na šířku z plochy (výřez 59, lišta 21)',
    10,
    'číselník',
    10,
    'příklad 205,4,583,90.5 | hvězdičky 641,14,781,67 | ovládání 68,237,864,405 | nejmenší 126×80 krok 134×88 | tečky 254,97,534,209 | nápověda 358,117,430,189 72×72 | domeček 67,8,131,72 | kolečko 801,8,865,72',
  ],
  [
    'iPhone 932×430 na šířku z plochy (výřez 59, lišta 21)',
    10,
    'psaní',
    0,
    'příklad 205,4,583,90.5 | hvězdičky - | ovládání 156,185,776,405 | nejmenší 72×72 krok 548×- | tečky 317,100,471,158 | nápověda 358,96.5,430,168.5 72×72 | domeček 67,8,131,72 | kolečko 801,8,865,72',
  ],
  [
    'iPhone 932×430 na šířku z plochy (výřez 59, lišta 21)',
    10,
    'psaní',
    10,
    'příklad 205,4,583,90.5 | hvězdičky 641,14,781,67 | ovládání 156,185,776,405 | nejmenší 72×72 krok 548×- | tečky 317,100,471,158 | nápověda 358,96.5,430,168.5 72×72 | domeček 67,8,131,72 | kolečko 801,8,865,72',
  ],
];

describe('#167 AC2: kvůli pandě se nic nezmenšuje ani neposouvá', () => {
  it('ťukací plochy, příklad, hvězdičky, nápověda, domeček a kolečko mají dnešní místo a velikost', () => {
    const problems = TODAY_SIZES.flatMap(([windowName, maxNumber, mode, stars, expected]) => {
      const window = WINDOWS.find((each) => each.name === windowName);
      if (!window) {
        return [`okno ${windowName} chybí`];
      }
      const actual = todaySizes(window, maxNumber, mode, stars);
      return actual === expected
        ? []
        : [
            `${windowName}, do ${maxNumber}, ${mode}, ${stars} hvězdiček:\n  dnes   ${expected}\n  teď    ${actual}`,
          ];
    });
    expect(TODAY_SIZES.length).toBeGreaterThan(0);
    expect(problems, problems.join('\n')).toEqual([]);
  });
});
