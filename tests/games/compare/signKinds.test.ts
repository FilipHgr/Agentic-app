import { describe, expect, it } from 'vitest';

import { GAMES } from '../../../src/gameList';
import {
  RELATION_SIGNS,
  correctSign,
  holds,
  isSameProblem,
  nextProblem,
  signsFor,
} from '../../../src/games/compare/logic/compareProblems';
import type { CompareProblem } from '../../../src/games/compare/logic/compareProblems';
import {
  DEFAULT_COMPARE_SETTINGS,
  MAX_NUMBER_OPTIONS,
  SIGN_KIND_OPTIONS,
  parseCompareSettings,
} from '../../../src/games/compare/logic/compareSettings';
import type { CompareSettings, SignKind } from '../../../src/games/compare/logic/compareSettings';
import { COMPARE_META } from '../../../src/games/compare/meta';
import { COMPARE_PROGRESS_KEY } from '../../../src/games/compare/storage/progressStorage';
import { COMPARE_SETTINGS_KEY } from '../../../src/games/compare/storage/settingsStorage';
import { compareTexts } from '../../../src/games/compare/texts/compareTexts';
import { menuText } from '../../../src/menu/logic/menuTexts';
import { PROFILE_COLORS } from '../../../src/shared/logic/profiles';
import { openProfiles } from '../../../src/shared/storage/profileStorage';
import { DeviceStorage } from '../../shared/profileFixtures';
import {
  FakeRudy,
  MemoryStorage,
  openCompare,
  rightSign,
  seededRandom,
  solveProblem,
  wrongSign,
} from './compareFakes';
import type { TestCompare } from './compareFakes';

/**
 * Testy k #190: hra se jmenuje Znaménka a v nastavení má řadu „Znaménka“
 * (+ −, < = >, vše). Při < = > dítě doplní do „a ☐ b“ znaménko <, = nebo >
 * ťuknutím (psaní < = > je od #191 v `relationWriting.test.ts`) a hvězdičky,
 * oslava s Rudym i chyby fungují stejně jako u + −. Rozložení je
 * v `signKindsLayout.test.ts`.
 */

const PROBLEM_COUNT = 2000;
const SEEDS = [1, 7, 20261122, 424242];

/** Rodič podrží kolečko, zvolí `change` a ťukne na ✓. */
function confirmChoice(test: TestCompare, change: Partial<CompareSettings>): void {
  test.gear.hold();
  test.session.chooseSetting(change);
  test.session.confirmSettings();
}

/** Hra otevřená s druhem znamének `signKind` (a dalšími volbami). */
function openWithSigns(
  signKind: SignKind,
  more: Partial<CompareSettings> = {},
  seed?: number,
): TestCompare {
  const storage = new MemoryStorage();
  storage.data.set(
    COMPARE_SETTINGS_KEY,
    JSON.stringify({ ...DEFAULT_COMPARE_SETTINGS, ...more, signKind }),
  );
  return openCompare(storage, seed);
}

function nameOf(problem: CompareProblem): string {
  return problem.kind === 'relation'
    ? `${problem.a} ☐ ${problem.b}`
    : `${problem.a} ☐ ${problem.b} = ${problem.result}`;
}

/** Příklady, které dítě uvidí, když jich vyřeší `count` za sebou. */
function playedProblems(test: TestCompare, count = PROBLEM_COUNT): CompareProblem[] {
  const problems: CompareProblem[] = [];
  for (let index = 0; index < count; index += 1) {
    problems.push(test.session.problem());
    solveProblem(test);
  }
  return problems;
}

describe('#190 AC1: hra se jmenuje Znaménka', () => {
  it('v menu i ve hře se hra jmenuje česky „Znaménka“ a anglicky „Signs“', () => {
    expect(compareTexts('cs').title).toBe('Znaménka');
    expect(compareTexts('en').title).toBe('Signs');
    expect(COMPARE_META.titles).toEqual({ cs: 'Znaménka', en: 'Signs' });
    expect(menuText('games.compare.title', 'cs')).toBe('Znaménka');
    expect(menuText('games.compare.title', 'en')).toBe('Signs');
  });

  it('hra má dál vnitřní id „compare“, takže uložené hvězdičky a nastavení zůstanou', () => {
    expect(COMPARE_META.id).toBe('compare');
    expect(GAMES.map((game) => game.id)).toContain('compare');
    expect(COMPARE_PROGRESS_KEY).toBe('compare.progress');
    expect(COMPARE_SETTINGS_KEY).toBe('compare.settings');

    const storage = new MemoryStorage();
    const first = openCompare(storage);
    solveProblem(first);
    solveProblem(first);
    confirmChoice(first, { maxNumber: 20 });
    const again = openCompare(storage);
    expect(again.session.starCount()).toBe(2);
    expect(again.session.settings().maxNumber).toBe(20);
  });
});

describe('#190 AC2: řada „Znaménka“ v nastavení', () => {
  it('rodič vybírá + −, < = > nebo vše, výchozí je + −', () => {
    expect([...SIGN_KIND_OPTIONS]).toEqual(['plusMinus', 'comparison', 'all']);
    expect(DEFAULT_COMPARE_SETTINGS.signKind).toBe('plusMinus');
    expect(openCompare().session.settings().signKind).toBe('plusMinus');
  });

  it('řada „Znaménka“ má popisek v každém jazyce', () => {
    expect(compareTexts('cs').rowLabels.signKind).toBe('Znaménka');
    expect(compareTexts('en').rowLabels.signKind).toBe('Signs');
  });

  it('staré nastavení bez řady „Znaménka“ dá + − bez chyby a dítě hraje dál', () => {
    const older = [
      '{"maxNumber":20,"answerInput":"writing"}',
      '{"maxNumber":10}',
      '{"maxNumber":5,"show":"dots","question":"more"}',
    ];
    for (const saved of older) {
      const storage = new MemoryStorage();
      storage.data.set(COMPARE_SETTINGS_KEY, saved);
      const test = openCompare(storage);
      expect(test.session.settings().signKind, saved).toBe('plusMinus');
      expect(test.session.problem().kind, saved).toBe('arithmetic');
      expect(test.session.tap(rightSign(test)), saved).toBe('correct');
    }
  });

  it('poškozená nebo neznámá hodnota řady dá + − a ostatní volby zůstanou', () => {
    for (const value of ['"vše"', '"<>"', '1', 'null', '["all"]']) {
      const saved = `{"maxNumber":20,"answerInput":"writing","signKind":${value}}`;
      expect(parseCompareSettings(saved), saved).toEqual({
        maxNumber: 20,
        answerInput: 'writing',
        signKind: 'plusMinus',
      });
    }
  });

  it('zvolená znaménka se uloží a po novém otevření hry platí', () => {
    for (const signKind of SIGN_KIND_OPTIONS) {
      const storage = new MemoryStorage();
      confirmChoice(openCompare(storage), { signKind });
      expect(openCompare(storage).session.settings().signKind, signKind).toBe(signKind);
    }
  });

  it('každý profil má vlastní volbu znamének', () => {
    const device = new DeviceStorage();
    const store = openProfiles(device);
    const first = store.activeProfile();
    const second = store.createProfile({ nickname: 'EMA', color: PROFILE_COLORS[1] });

    confirmChoice(openCompare(store.gameStorage(COMPARE_META.id)), { signKind: 'comparison' });
    store.selectProfile(second.id);
    expect(openCompare(store.gameStorage(COMPARE_META.id)).session.settings().signKind).toBe(
      'plusMinus',
    );

    const reloaded = openProfiles(device);
    reloaded.selectProfile(first.id);
    expect(openCompare(reloaded.gameStorage(COMPARE_META.id)).session.settings().signKind).toBe(
      'comparison',
    );
  });

  it('po ✓ se změnou znamének přijde hned nový příklad zvoleného druhu', () => {
    const test = openCompare();
    const problem = test.session.problem();
    confirmChoice(test, { signKind: 'comparison' });
    expect(test.session.problem()).not.toEqual(problem);
    expect(test.session.problem().kind).toBe('relation');
    expect(test.changes.at(-1)).toEqual({ kind: 'problemStarted' });
    confirmChoice(test, { signKind: 'plusMinus' });
    expect(test.session.problem().kind).toBe('arithmetic');
  });

  it('dokud rodič neťukne na ✓, rozehraný příklad zůstane', () => {
    const test = openCompare();
    const problem = test.session.problem();
    test.gear.hold();
    test.session.chooseSetting({ signKind: 'comparison' });
    expect(test.session.problem()).toBe(problem);
    expect(test.session.settings().signKind).toBe('plusMinus');
  });
});

describe('#190 AC3: příklady „a ☐ b“ při < = >', () => {
  it('při < = > dostává dítě jen příklady „a ☐ b“ s čísly 0 až rozsah', () => {
    for (const maxNumber of MAX_NUMBER_OPTIONS) {
      const test = openWithSigns('comparison', { maxNumber }, maxNumber);
      for (const problem of playedProblems(test, 600)) {
        const name = `do ${maxNumber}: ${nameOf(problem)}`;
        expect(problem.kind, name).toBe('relation');
        for (const number of [problem.a, problem.b]) {
          expect(Number.isInteger(number), name).toBe(true);
          expect(number, name).toBeGreaterThanOrEqual(0);
          expect(number, name).toBeLessThanOrEqual(maxNumber);
        }
      }
    }
  });

  it('do okénka patří <, když je první číslo menší, > když větší, a = když jsou stejná', () => {
    const test = openWithSigns('comparison');
    for (const problem of playedProblems(test, 300)) {
      if (problem.kind !== 'relation') {
        throw new Error(`čekal se příklad „a ☐ b“: ${nameOf(problem)}`);
      }
      const expected = problem.a < problem.b ? '<' : problem.a > problem.b ? '>' : '=';
      expect(correctSign(problem), nameOf(problem)).toBe(expected);
      const holding = RELATION_SIGNS.filter((sign) => holds(problem, sign));
      expect(holding, nameOf(problem)).toEqual([expected]);
    }
  });

  it('„=“ patří do okénka zhruba ve čtvrtině příkladů, < i > přijdou zhruba stejně často', () => {
    for (const seed of SEEDS) {
      const signs = playedProblems(openWithSigns('comparison', {}, seed)).map(correctSign);
      const share = (sign: string): number =>
        signs.filter((each) => each === sign).length / signs.length;
      expect(share('='), `seed ${seed}`).toBeGreaterThan(0.2);
      expect(share('='), `seed ${seed}`).toBeLessThan(0.3);
      expect(share('<'), `seed ${seed}`).toBeGreaterThan(0.3);
      expect(share('>'), `seed ${seed}`).toBeGreaterThan(0.3);
    }
  });

  it('stejný příklad „a ☐ b“ nepřijde dvakrát po sobě, ani u „=“', () => {
    for (const maxNumber of MAX_NUMBER_OPTIONS) {
      const random = seededRandom(maxNumber);
      let previous: CompareProblem | null = null;
      for (let index = 0; index < 5000; index += 1) {
        const problem = nextProblem(previous, random, maxNumber, 'comparison');
        if (previous !== null) {
          expect(isSameProblem(previous, problem), nameOf(problem)).toBe(false);
        }
        previous = problem;
      }
    }
  });

  it('při < = > přijdou všechny dvojice čísel v rozsahu', () => {
    for (const maxNumber of MAX_NUMBER_OPTIONS) {
      const random = seededRandom(maxNumber + 3);
      const seen = new Set<string>();
      let previous: CompareProblem | null = null;
      for (let index = 0; index < 40000; index += 1) {
        const problem = nextProblem(previous, random, maxNumber, 'comparison');
        seen.add(`${problem.a}:${problem.b}`);
        previous = problem;
      }
      for (let a = 0; a <= maxNumber; a += 1) {
        for (let b = 0; b <= maxNumber; b += 1) {
          expect(seen.has(`${a}:${b}`), `do ${maxNumber}: ${a} ☐ ${b}`).toBe(true);
        }
      }
    }
  });

  it('při „vše“ se střídají oba druhy příkladů zhruba napůl a nic se neopakuje dvakrát po sobě', () => {
    for (const seed of SEEDS) {
      const problems = playedProblems(openWithSigns('all', {}, seed));
      const relations = problems.filter((problem) => problem.kind === 'relation').length;
      expect(relations / problems.length, `seed ${seed}`).toBeGreaterThan(0.4);
      expect(relations / problems.length, `seed ${seed}`).toBeLessThan(0.6);
      for (let index = 1; index < problems.length; index += 1) {
        expect(
          isSameProblem(problems[index - 1]!, problems[index]!),
          `seed ${seed}: ${nameOf(problems[index]!)}`,
        ).toBe(false);
      }
    }
  });

  it('při + − nepřijde žádný příklad „a ☐ b“', () => {
    for (const problem of playedProblems(openCompare(), 500)) {
      expect(problem.kind, nameOf(problem)).toBe('arithmetic');
    }
  });
});

describe('#190 AC4: dítě odpovídá ťuknutím na tlačítka podle druhu příkladu', () => {
  it('u „a ☐ b“ jsou na výběr <, = a >, u „a ☐ b = c“ + a −', () => {
    const test = openWithSigns('all');
    const seen = new Set<string>();
    for (const problem of playedProblems(test, 100)) {
      const signs = signsFor(problem);
      expect(signs, nameOf(problem)).toEqual(
        problem.kind === 'relation' ? ['<', '=', '>'] : ['+', '−'],
      );
      expect(signs, nameOf(problem)).toContain(correctSign(problem));
      seen.add(problem.kind);
    }
    expect([...seen].sort()).toEqual(['arithmetic', 'relation']);
  });

  it('při psaní a < = > hra vyhodnotí potvrzené znaménko <, = nebo > u „a ☐ b“', () => {
    const test = openWithSigns('comparison', { answerInput: 'writing' });
    expect(test.session.problem().kind).toBe('relation');
    expect(test.session.tap(rightSign(test))).toBe('correct');
    expect(test.session.starCount()).toBe(1);
  });

  it('znaménko + nebo − u „a ☐ b“ (třeba pozdě potvrzené psaní) nic neudělá', () => {
    const test = openWithSigns('comparison');
    expect(test.session.tap('+')).toBe('ignored');
    expect(test.session.tap('−')).toBe('ignored');
    expect(test.sounds.played).toEqual([]);
    expect(test.session.tap(rightSign(test))).toBe('correct');
  });
});

describe('#190 AC5: u < = > hvězdičky, chyby i oslava jako u + −', () => {
  it('po správném znaménku zůstane znaménko v zeleném okénku, přičte se hvězdička a přijde další příklad', () => {
    const test = openWithSigns('comparison');
    const problem = test.session.problem();
    const sign = rightSign(test);
    expect(test.session.tap(sign)).toBe('correct');
    expect(test.session.filledSign()).toBe(sign);
    expect(test.session.starCount()).toBe(1);
    expect(test.sounds.played).toEqual(['correct']);
    expect(test.changes.at(-1)).toEqual({ kind: 'solved', sign });
    test.timers.runAll();
    expect(test.session.problem()).not.toEqual(problem);
    expect(test.session.filledSign()).toBeNull();
  });

  it('špatné znaménko nic nebere: zazní tichý tón, okénko se zatřese a dítě zkouší dál', () => {
    const test = openWithSigns('comparison');
    const problem = test.session.problem();
    const wrong = wrongSign(test);
    expect(RELATION_SIGNS).toContain(wrong);
    expect(test.session.tap(wrong)).toBe('wrong');
    expect(test.sounds.played).toEqual(['wrong']);
    expect(test.changes.at(-1)).toEqual({ kind: 'wrong', sign: wrong });
    expect(test.session.starCount()).toBe(0);
    expect(test.session.filledSign()).toBeNull();
    expect(test.session.problem()).toBe(problem);
    expect(test.session.tap(rightSign(test))).toBe('correct');
  });

  it('ťuknutí na prázdné okénko není odpověď, okénko se zhoupne', () => {
    const test = openWithSigns('comparison');
    expect(test.session.tapBox()).toBe(true);
    expect(test.changes.at(-1)).toEqual({ kind: 'boxTapped' });
    expect(test.session.starCount()).toBe(0);
  });

  it('po 10 hvězdičkách přiskočí Rudy a po něm oslava s konfetami a prázdná řada', () => {
    for (const signKind of ['comparison', 'all'] as const) {
      const rudy = new FakeRudy();
      const storage = new MemoryStorage();
      storage.data.set(
        COMPARE_SETTINGS_KEY,
        JSON.stringify({ ...DEFAULT_COMPARE_SETTINGS, signKind }),
      );
      const test = openCompare(storage, undefined, rudy);
      for (let index = 0; index < 9; index += 1) {
        solveProblem(test);
      }
      test.session.tap(rightSign(test));
      test.timers.runAll();
      expect(rudy.requested, signKind).toBe(1);
      expect(test.changes, signKind).not.toContainEqual({ kind: 'celebrationStarted' });
      rudy.openPending();
      rudy.close();
      expect(test.changes, signKind).toContainEqual({ kind: 'celebrationStarted' });
      test.timers.runAll();
      expect(test.session.starCount(), signKind).toBe(0);
      expect(test.session.tap(rightSign(test)), signKind).toBe('correct');
    }
  });
});
