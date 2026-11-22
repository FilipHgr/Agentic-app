import { describe, expect, it } from 'vitest';

import { hintPicture } from '../../../src/games/compare/logic/compareHint';
import { layoutCompareScreen } from '../../../src/games/compare/logic/compareLayout';
import { correctChoice, signOf } from '../../../src/games/compare/logic/compareProblems';
import type { CompareProblem } from '../../../src/games/compare/logic/compareProblems';
import {
  createQuestionVoice,
  nextQuestion,
} from '../../../src/games/compare/logic/compareQuestion';
import type {
  CompareQuestion,
  QuestionVoicePlayer,
} from '../../../src/games/compare/logic/compareQuestion';
import { NEXT_PROBLEM_MS } from '../../../src/games/compare/logic/compareSession';
import {
  DEFAULT_COMPARE_SETTINGS,
  QUESTION_OPTIONS,
  parseCompareSettings,
} from '../../../src/games/compare/logic/compareSettings';
import type { CompareSettings } from '../../../src/games/compare/logic/compareSettings';
import { compareRudyLines } from '../../../src/games/compare/logic/rudyLines';
import type { CompareRudyLine } from '../../../src/games/compare/logic/rudyLines';
import { COMPARE_SETTINGS_KEY } from '../../../src/games/compare/storage/settingsStorage';
import { compareTexts } from '../../../src/games/compare/texts/compareTexts';
import { selectLanguage } from '../../../src/shared/texts/languages';
import { gameAreaFor } from '../../../src/shared/logic/viewportLayout';
import { IPAD_WINDOWS, viewportOf } from '../../shared/viewportFixtures';
import {
  FakeQuestionVoice,
  FakeRudy,
  MemoryStorage,
  openCompare,
  rightChoice,
  seededRandom,
  solveProblems,
  wrongChoice,
} from './compareFakes';
import type { TestCompare } from './compareFakes';

/**
 * Testy k #182: otázka „kde je míň?“ v Porovnávání. Rodič v nastavení
 * volí otázku víc, míň, nebo střídat (výchozí víc). Při „míň“ je správně
 * karta s menším počtem, „=“ platí jako dosud. Otázku dítě pozná podle
 * symbolu nad kartami (rozložení v `questionSymbolLayout.test.ts`)
 * a dospělý hlas průvodce ji řekne vždy, když se změní. Při „střídat“
 * vychází „míň“ asi v polovině příkladů a otázka se nemění uprostřed
 * příkladu ani po chybě. Bez odemčeného zvuku hlas mlčí.
 */

interface VoiceCompare extends TestCompare {
  readonly voice: FakeQuestionVoice;
}

function openWithVoice(storage?: MemoryStorage, seed?: number, rudy?: FakeRudy): VoiceCompare {
  const voice = new FakeQuestionVoice();
  return { ...openCompare(storage, seed, rudy, voice), voice };
}

/** Rodič podrží kolečko, zvolí `change` a ťukne na ✓. */
function confirmChoice(test: TestCompare, change: Partial<CompareSettings>): void {
  test.gear.hold();
  test.session.chooseSetting(change);
  test.session.confirmSettings();
}

/** Dítě ťukne správně a počká na další příklad. */
function solveOne(test: TestCompare): void {
  test.session.tap(rightChoice(test));
  test.timers.advance(NEXT_PROBLEM_MS);
}

/** Vyřeší příklady, dokud nepřijde příklad s různými počty. */
function untilDifferentCounts(test: TestCompare): CompareProblem {
  for (let step = 0; step < 50; step += 1) {
    const problem = test.session.problem();
    if (problem.left !== problem.right) {
      return problem;
    }
    solveProblems(test, 1);
  }
  throw new Error('příklad s různými počty nepřišel');
}

/** Vyřeší příklady, dokud nepřijde příklad se stejným počtem. */
function untilEqualCounts(test: TestCompare): CompareProblem {
  for (let step = 0; step < 200; step += 1) {
    const problem = test.session.problem();
    if (problem.left === problem.right) {
      return problem;
    }
    solveProblems(test, 1);
  }
  throw new Error('příklad se stejným počtem nepřišel');
}

/** Karta s menším počtem v příkladu s různými počty. */
function fewerCard(problem: CompareProblem): 'left' | 'right' {
  return problem.left < problem.right ? 'left' : 'right';
}

function moreCard(problem: CompareProblem): 'left' | 'right' {
  return problem.left > problem.right ? 'left' : 'right';
}

/** Nechá doběhnout přehrávání otázky (sliby hlasu). */
async function settle(): Promise<void> {
  for (let round = 0; round < 3; round += 1) {
    await new Promise((done) => setTimeout(done, 0));
  }
}

/** Po sobě jdoucí stejné otázky jako jedna (kdy se otázka změnila). */
function changesOf(questions: readonly CompareQuestion[]): CompareQuestion[] {
  return questions.filter((question, index) => index === 0 || questions[index - 1] !== question);
}

describe('#182 AC1: v nastavení volba „Otázka“ víc, míň, střídat, výchozí „víc“', () => {
  it('rodič vybírá otázku víc, míň, nebo střídat a výchozí je „víc“', () => {
    expect([...QUESTION_OPTIONS]).toEqual(['more', 'less', 'alternate']);
    expect(DEFAULT_COMPARE_SETTINGS.question).toBe('more');
  });

  it('po prvním otevření hry se dítě ptá „kde je víc“ a zůstane to tak v každém příkladu', () => {
    const test = openCompare();
    expect(test.session.settings().question).toBe('more');
    for (let index = 0; index < 50; index += 1) {
      expect(test.session.question()).toBe('more');
      solveProblems(test, 1);
    }
  });

  it('zvolená otázka se uloží v profilu a platí i po novém otevření hry', () => {
    const storage = new MemoryStorage();
    confirmChoice(openCompare(storage), { question: 'less' });
    const again = openCompare(storage);
    expect(again.session.settings().question).toBe('less');
    expect(again.session.question()).toBe('less');
    again.gear.hold();
    expect(again.session.settingsChoice()?.question).toBe('less');
  });

  it('nastavení uložené dřív bez otázky, nebo s neznámou otázkou, dá „víc“ a ostatní volby zůstanou', () => {
    expect(parseCompareSettings('{"maxNumber":20,"show":"both"}')).toEqual({
      maxNumber: 20,
      show: 'both',
      question: 'more',
    });
    expect(parseCompareSettings('{"maxNumber":5,"show":"numbers","question":"most"}')).toEqual({
      maxNumber: 5,
      show: 'numbers',
      question: 'more',
    });
    expect(parseCompareSettings('{"question":"alternate"}')).toEqual({
      ...DEFAULT_COMPARE_SETTINGS,
      question: 'alternate',
    });
    const storage = new MemoryStorage();
    storage.data.set(COMPARE_SETTINGS_KEY, '{"maxNumber":10,"show":"dots","question":7}');
    const test = openCompare(storage);
    expect(test.session.question()).toBe('more');
    expect(test.session.tap(rightChoice(test))).toBe('correct');
  });

  it('změna otázky po ✓ přinese hned nový příklad s novou otázkou, hvězdičky zůstanou', () => {
    const test = openCompare();
    solveProblems(test, 3);
    const before = test.session.problem();
    confirmChoice(test, { question: 'less' });
    expect(test.session.question()).toBe('less');
    expect(test.session.problem()).not.toBe(before);
    expect(test.session.starCount()).toBe(3);
  });
});

describe('#182 AC2: při „míň“ je správně karta s menším počtem, „=“ platí jako dosud', () => {
  it('karta s menším počtem je při „míň“ správně, při „víc“ ta druhá', () => {
    expect(correctChoice({ left: 3, right: 7 }, 'less')).toBe('left');
    expect(correctChoice({ left: 9, right: 2 }, 'less')).toBe('right');
    expect(correctChoice({ left: 3, right: 7 }, 'more')).toBe('right');
    expect(correctChoice({ left: 3, right: 7 })).toBe('right');
  });

  it('při stejném počtu je správně „=“ při „víc“ i „míň“', () => {
    for (const count of [1, 4, 10, 20]) {
      expect(correctChoice({ left: count, right: count }, 'less')).toBe('equal');
      expect(correctChoice({ left: count, right: count }, 'more')).toBe('equal');
    }
  });

  it('při „míň“ dá ťuknutí na kartu s menším počtem hvězdičku', () => {
    const test = openCompare();
    confirmChoice(test, { question: 'less' });
    for (let round = 0; round < 5; round += 1) {
      const problem = untilDifferentCounts(test);
      const stars = test.session.starCount();
      expect(test.session.tap(fewerCard(problem))).toBe('correct');
      expect(test.session.starCount()).toBe(stars + 1);
      test.timers.advance(NEXT_PROBLEM_MS);
    }
  });

  it('při „míň“ je ťuknutí na kartu s víc tečkami chyba: karta se zatřese a hvězdička nepřibude', () => {
    const test = openCompare();
    confirmChoice(test, { question: 'less' });
    const problem = untilDifferentCounts(test);
    const stars = test.session.starCount();
    expect(test.session.tap(moreCard(problem))).toBe('wrong');
    expect(test.changes.at(-1)).toEqual({ kind: 'wrong', choice: moreCard(problem) });
    expect(test.session.starCount()).toBe(stars);
    expect(test.session.tap('equal')).toBe('wrong');
  });

  it('při „míň“ a stejném počtu dá hvězdičku „=“ a ťuknutí na kartu je chyba', () => {
    const test = openCompare(undefined, 7);
    confirmChoice(test, { question: 'less' });
    untilEqualCounts(test);
    expect(test.session.tap('left')).toBe('wrong');
    expect(test.session.tap('equal')).toBe('correct');
    expect(test.session.shownSign()).toBe('=');
  });

  it('znak po správné odpovědi při „míň“ porovná levou kartu s pravou jako dřív', () => {
    const test = openCompare();
    confirmChoice(test, { question: 'less' });
    const problem = untilDifferentCounts(test);
    test.session.tap(fewerCard(problem));
    expect(test.session.shownSign()).toBe(signOf(problem));
    expect(test.changes.at(-1)).toEqual({
      kind: 'solved',
      choice: fewerCard(problem),
      sign: signOf(problem),
    });
  });
});

describe('#182 AC3: hlas průvodce řekne otázku vždy, když se změní', () => {
  it('po otevření hry hlas jednou řekne otázku', () => {
    const test = openWithVoice();
    expect(test.voice.said).toEqual(['more']);
  });

  it('stejná otázka v dalších příkladech ani po chybě hlas neopakuje', () => {
    const test = openWithVoice();
    test.session.tap(wrongChoice(test));
    test.session.tap(wrongChoice(test));
    solveProblems(test, 12);
    expect(test.voice.said).toEqual(['more']);
  });

  it('po změně otázky v nastavení ji hlas řekne hned s novým příkladem', () => {
    const test = openWithVoice();
    test.gear.hold();
    test.session.chooseSetting({ question: 'less' });
    expect(test.voice.said, 'dokud je nastavení otevřené, hlas mlčí').toEqual(['more']);
    test.session.confirmSettings();
    expect(test.voice.said).toEqual(['more', 'less']);
    solveProblems(test, 5);
    expect(test.voice.said).toEqual(['more', 'less']);
  });

  it('✓ beze změny otázky hlas neopakuje, když už otázka zazněla', async () => {
    const test = openWithVoice();
    await settle();
    confirmChoice(test, { maxNumber: 20 });
    confirmChoice(test, {});
    expect(test.voice.said).toEqual(['more']);
  });

  it('při „střídat“ řekne hlas otázku přesně u příkladů, ve kterých se změnila', () => {
    const test = openWithVoice(undefined, 11);
    confirmChoice(test, { question: 'alternate' });
    const asked: CompareQuestion[] = ['more'];
    for (let index = 0; index < 200; index += 1) {
      asked.push(test.session.question());
      solveProblems(test, 1);
    }
    asked.push(test.session.question());
    expect(test.voice.said).toEqual(changesOf(asked));
    expect(test.voice.said.length).toBeGreaterThan(20);
  });

  it('dokud Rudy zdraví, hlas otázku neříká, po zavření okna ji řekne', () => {
    const rudy = new FakeRudy();
    const test = openWithVoice(undefined, undefined, rudy);
    expect(test.voice.said).toEqual([]);
    rudy.openPending();
    expect(test.voice.said).toEqual([]);
    rudy.close();
    expect(test.voice.said).toEqual(['more']);
  });

  it('pozdrav, který se nestáhne, otázku nezdrží', () => {
    const rudy = new FakeRudy();
    const test = openWithVoice(undefined, undefined, rudy);
    rudy.giveUp();
    expect(test.voice.said).toEqual(['more']);
  });

  it('když dítě ťukne dřív, než se pozdrav stáhne, otázka zazní hned', () => {
    const rudy = new FakeRudy();
    const test = openWithVoice(undefined, undefined, rudy);
    test.session.tap(wrongChoice(test));
    expect(test.voice.said).toEqual(['more']);
  });

  it('nastavení otevřené před pozdravem: po ✓ beze změny otázka zazní, protože ji dítě ještě neslyšelo', () => {
    const rudy = new FakeRudy();
    const test = openWithVoice(undefined, undefined, rudy);
    confirmChoice(test, {});
    expect(test.voice.said).toEqual(['more']);
  });

  it('při oslavě 10. hvězdičky s Rudym hlas mlčí a otázku po ní neopakuje', () => {
    const rudy = new FakeRudy();
    const test = openWithVoice(undefined, undefined, rudy);
    rudy.openPending();
    rudy.close();
    for (let star = 0; star < 10; star += 1) {
      solveOne(test);
    }
    expect(rudy.openMove() ?? rudy.waitingMove()).toBe('celebrate');
    rudy.openPending();
    rudy.close();
    test.timers.runAll();
    expect(test.voice.said).toEqual(['more']);
  });

  it('otevření nastavení a odchod z hry rozehranou otázku zastaví', () => {
    const test = openWithVoice();
    test.gear.hold();
    expect(test.voice.stopped).toBe(1);
    test.session.confirmSettings();
    test.session.leave();
    expect(test.voice.stopped).toBe(2);
  });
});

describe('#182 AC3 a AC5: otázka se počítá za řečenou, až když opravdu zazněla', () => {
  it('když otázka nezazněla (zamčený zvuk, chybějící nahrávka), hlas ji zkusí u dalšího příkladu znovu', async () => {
    const voice = new FakeQuestionVoice();
    voice.plays = false;
    const test = openCompare(undefined, undefined, undefined, voice);
    await settle();
    expect(voice.said).toEqual(['more']);
    solveProblems(test, 1);
    expect(voice.said).toEqual(['more', 'more']);
  });

  it('po prvním opravdu přehraném pokusu se stejná otázka už sama neopakuje', async () => {
    const voice = new FakeQuestionVoice();
    voice.plays = false;
    const test = openCompare(undefined, undefined, undefined, voice);
    await settle();
    solveProblems(test, 1);
    await settle();
    expect(voice.said).toEqual(['more', 'more']);
    voice.plays = true;
    solveProblems(test, 1);
    await settle();
    expect(voice.said).toEqual(['more', 'more', 'more']);
    solveProblems(test, 5);
    await settle();
    expect(voice.said).toEqual(['more', 'more', 'more']);
  });

  it('když Rudy v pozdravu nahlas řekl „Kde je víc?“, hlas průvodce to hned neopakuje', async () => {
    const rudy = new FakeRudy();
    const test = openWithVoice(undefined, undefined, rudy);
    rudy.openPending(true);
    rudy.close();
    expect(test.voice.said).toEqual([]);
    solveProblems(test, 3);
    await settle();
    expect(test.voice.said).toEqual([]);
  });

  it('když pozdrav otázku neřekl (jiná varianta nebo bez hlasu), hlas ji řekne po zavření okna', () => {
    const rudy = new FakeRudy();
    const test = openWithVoice(undefined, undefined, rudy);
    rudy.openPending(false);
    rudy.close();
    expect(test.voice.said).toEqual(['more']);
  });
});

describe('#182: ťuknutí na symbol otázky ji zopakuje', () => {
  it('po ťuknutí na symbol hlas otázku řekne znovu a symbol zareaguje', async () => {
    const test = openWithVoice();
    await settle();
    expect(test.session.tapQuestion()).toBe(true);
    expect(test.voice.said).toEqual(['more', 'more']);
    confirmChoice(test, { question: 'less' });
    expect(test.session.tapQuestion()).toBe(true);
    expect(test.voice.said).toEqual(['more', 'more', 'less', 'less']);
  });

  it('ťuknutí na symbol není odpověď: hvězdičky ani chyby se nemění a nápověda nepřijde', () => {
    const test = openWithVoice();
    const problem = test.session.problem();
    for (let tap = 0; tap < 3; tap += 1) {
      test.session.tapQuestion();
    }
    expect(test.session.starCount()).toBe(0);
    expect(test.session.hintShown()).toBe(false);
    expect(test.session.problem()).toBe(problem);
    expect(test.changes).toEqual([]);
    expect(test.session.tap(rightChoice(test))).toBe('correct');
  });

  it('při otevřeném nastavení, během okna s Rudym, při oslavě a po odchodu symbol nereaguje', () => {
    const settingsOpen = openWithVoice();
    settingsOpen.gear.hold();
    expect(settingsOpen.session.tapQuestion()).toBe(false);

    const rudy = new FakeRudy();
    const withRudy = openWithVoice(undefined, undefined, rudy);
    rudy.openPending();
    expect(withRudy.session.tapQuestion()).toBe(false);
    expect(withRudy.voice.said).toEqual([]);

    const celebrating = openWithVoice();
    for (let star = 0; star < 10; star += 1) {
      solveOne(celebrating);
    }
    expect(celebrating.session.isCelebrating()).toBe(true);
    expect(celebrating.session.tapQuestion()).toBe(false);

    const left = openWithVoice();
    left.session.leave();
    expect(left.session.tapQuestion()).toBe(false);
  });

  it('ťuknutí na symbol, než se pozdrav stáhne, pozdrav vynechá a otázka zazní jednou', () => {
    const rudy = new FakeRudy();
    const test = openWithVoice(undefined, undefined, rudy);
    expect(test.session.tapQuestion()).toBe(true);
    expect(rudy.waitingMove()).toBeNull();
    expect(test.voice.said).toEqual(['more']);
  });
});

describe('#182 AC4: při „střídat“ je „míň“ asi v polovině příkladů a otázka se nemění v příkladu', () => {
  it('v 1 000 příkladech je „míň“ ve 40–60 % příkladů', () => {
    const random = seededRandom(182);
    let less = 0;
    for (let index = 0; index < 1000; index += 1) {
      if (nextQuestion('alternate', random) === 'less') {
        less += 1;
      }
    }
    expect(less).toBeGreaterThanOrEqual(400);
    expect(less).toBeLessThanOrEqual(600);
  });

  it('ve hře se „střídat“ objeví obě otázky a „míň“ je asi v polovině příkladů', () => {
    const test = openCompare(undefined, 5);
    confirmChoice(test, { question: 'alternate' });
    let less = 0;
    for (let index = 0; index < 400; index += 1) {
      less += test.session.question() === 'less' ? 1 : 0;
      solveProblems(test, 1);
    }
    expect(less).toBeGreaterThanOrEqual(160);
    expect(less).toBeLessThanOrEqual(240);
  });

  it('pevná otázka „víc“ nebo „míň“ se nestřídá', () => {
    const random = seededRandom(3);
    for (let index = 0; index < 100; index += 1) {
      expect(nextQuestion('more', random)).toBe('more');
      expect(nextQuestion('less', random)).toBe('less');
    }
  });

  it('po chybách (i po nápovědě) zůstane otázka stejná až do vyřešení příkladu', () => {
    const test = openCompare(undefined, 9);
    confirmChoice(test, { question: 'alternate' });
    for (let round = 0; round < 40; round += 1) {
      const problem = test.session.problem();
      const question = test.session.question();
      test.session.tap(wrongChoice(test));
      expect(test.session.question()).toBe(question);
      test.session.tap(wrongChoice(test));
      expect(test.session.hintShown()).toBe(true);
      expect(test.session.question()).toBe(question);
      test.timers.advance(5000);
      expect(test.session.problem()).toBe(problem);
      expect(test.session.question()).toBe(question);
      expect(test.session.tap(correctChoice(problem, question))).toBe('correct');
      expect(test.session.question(), 'ani se znakem po správné odpovědi').toBe(question);
      // Další příklad (po 10. hvězdičce až po oslavě).
      test.timers.runAll();
    }
  });

  it('nastavení otevřené uprostřed příkladu otázku nezmění, když se po ✓ nic nezměnilo', () => {
    const test = openCompare(undefined, 4);
    confirmChoice(test, { question: 'alternate' });
    for (let round = 0; round < 20; round += 1) {
      const problem = test.session.problem();
      const question = test.session.question();
      confirmChoice(test, {});
      expect(test.session.problem()).toBe(problem);
      expect(test.session.question()).toBe(question);
      solveProblems(test, 1);
    }
  });
});

describe('#182 AC5: bez odemčeného zvuku se otázka pozná jen podle symbolu', () => {
  /** Přehrávač nahrávek bez sítě: co se stahovalo a hrálo. */
  class FakePlayer implements QuestionVoicePlayer {
    readonly loaded: string[] = [];
    readonly played: string[] = [];
    stopped = 0;
    private readonly waiting: Array<{ url: string; done: (ok: boolean) => void }> = [];
    constructor(private readonly missing = false) {}

    load(url: string): Promise<number> {
      this.loaded.push(url);
      return new Promise((resolve, reject) => {
        this.waiting.push({
          url,
          done: (ok) => (ok ? resolve(900) : reject(new Error('nahrávka chybí'))),
        });
      });
    }

    play(url: string): void {
      this.played.push(url);
    }

    stop(): void {
      this.stopped += 1;
    }

    /** Doběhnou všechna stahování. */
    async finishLoads(): Promise<void> {
      for (const entry of this.waiting.splice(0)) {
        entry.done(!this.missing);
      }
      await new Promise((done) => setTimeout(done, 0));
    }
  }

  it('bez odemčeného zvuku hlas nic nestahuje ani nehraje a hra jde dál', async () => {
    const player = new FakePlayer();
    const voice = createQuestionVoice({ player, isUnlocked: () => false });
    voice.say('less');
    await player.finishLoads();
    expect(player.loaded).toEqual([]);
    expect(player.played).toEqual([]);
  });

  it('se zvukem hlas stáhne otázku v jazyce menu a přehraje ji', async () => {
    const player = new FakePlayer();
    const voice = createQuestionVoice({ player, isUnlocked: () => true });
    voice.say('less');
    await player.finishLoads();
    expect(player.played).toEqual(['voice/cs/compare/guide/questionLess.mp3']);
    selectLanguage('en');
    try {
      voice.say('more');
      await player.finishLoads();
      expect(player.played.at(-1)).toBe('voice/en/compare/guide/questionMore.mp3');
    } finally {
      selectLanguage('cs');
    }
  });

  it('nahrávka stažená už jednou se příště přehraje hned', async () => {
    const player = new FakePlayer();
    const voice = createQuestionVoice({ player, isUnlocked: () => true });
    voice.say('more');
    await player.finishLoads();
    voice.say('less');
    await player.finishLoads();
    voice.say('more');
    expect(player.played).toEqual([
      'voice/cs/compare/guide/questionMore.mp3',
      'voice/cs/compare/guide/questionLess.mp3',
      'voice/cs/compare/guide/questionMore.mp3',
    ]);
    expect(player.loaded).toHaveLength(2);
  });

  it('otázka, která se mezitím změnila nebo zastavila, se po stažení nepřehraje', async () => {
    const player = new FakePlayer();
    const voice = createQuestionVoice({ player, isUnlocked: () => true });
    voice.say('more');
    voice.say('less');
    await player.finishLoads();
    expect(player.played).toEqual(['voice/cs/compare/guide/questionLess.mp3']);
    const stoppedPlayer = new FakePlayer();
    const stoppedVoice = createQuestionVoice({ player: stoppedPlayer, isUnlocked: () => true });
    stoppedVoice.say('more');
    stoppedVoice.stop();
    await stoppedPlayer.finishLoads();
    expect(stoppedPlayer.played).toEqual([]);
    expect(stoppedPlayer.stopped).toBe(1);
  });

  it('když nahrávka chybí, hlas mlčí a nic nevyhodí', async () => {
    const player = new FakePlayer(true);
    const voice = createQuestionVoice({ player, isUnlocked: () => true });
    expect(() => voice.say('less')).not.toThrow();
    await player.finishLoads();
    expect(player.played).toEqual([]);
  });

  it('hra bez hlasu jde hrát: otázka je známá od začátku a správné ťuknutí dá hvězdičku', () => {
    const test = openCompare();
    confirmChoice(test, { question: 'less' });
    expect(test.session.question()).toBe('less');
    expect(test.session.tap(rightChoice(test))).toBe('correct');
  });
});

describe('#182: nápověda párováním dává smysl i při „míň“', () => {
  it('při „míň“ svítí tečky bez dvojice na kartě s víc a správná je karta, kde má dvojici každá tečka', () => {
    const area = gameAreaFor(viewportOf(IPAD_WINDOWS[0]!), 'fullWindow');
    const layout = layoutCompareScreen(area);
    for (const problem of [
      { left: 3, right: 7 },
      { left: 9, right: 1 },
      { left: 5, right: 6 },
    ]) {
      const picture = hintPicture(layout, problem, DEFAULT_COMPARE_SETTINGS);
      const right = correctChoice(problem, 'less');
      const sideOfRight = right === 'left' ? 0 : 1;
      const sideOfOther = sideOfRight === 0 ? 1 : 0;
      const name = `${problem.left} : ${problem.right}`;
      expect(
        picture.cards[sideOfRight].every((dot) => dot.role === 'paired'),
        name,
      ).toBe(true);
      expect(
        picture.cards[sideOfOther].some((dot) => dot.role === 'extra'),
        name,
      ).toBe(true);
    }
  });

  it('po 2. chybě při „míň“ se nápověda ukáže jako při „víc“', () => {
    const test = openCompare();
    confirmChoice(test, { question: 'less' });
    untilDifferentCounts(test);
    test.session.tap(wrongChoice(test));
    test.session.tap(wrongChoice(test));
    expect(test.session.hintShown()).toBe(true);
    expect(test.session.tap(rightChoice(test))).toBe('correct');
  });
});

describe('#182: Rudy se při otázce „míň“ ani při střídání v pozdravu neptá „Kde je víc?“', () => {
  /** Dítě otevře hru s Rudym nad úložištěm; vrátí, co Rudy v pozdravu řekne. */
  function greetingOnOpen(storage: MemoryStorage, seed?: number): CompareRudyLine {
    const rudy = new FakeRudy();
    const test = openCompare(storage, seed, rudy);
    const lines = compareRudyLines(storage);
    const context = rudy.contexts[0];
    const line = lines.upcoming('wave', context);
    // Okno se ukázalo: příště zazní další varianta.
    lines.said('wave', line);
    test.session.leave();
    return line;
  }

  it('s otázkou „víc“ se pozdravy střídají a Rudy se jednou zeptá „Kde je víc?“', () => {
    const storage = new MemoryStorage();
    const said = [greetingOnOpen(storage), greetingOnOpen(storage), greetingOnOpen(storage)];
    expect(said).toEqual(['greeting', 'greetingAgain', 'greeting']);
  });

  it('s otázkou „míň“ Rudy po každém otevření řekne jen „Jdeme porovnávat!“', () => {
    const storage = new MemoryStorage();
    confirmChoice(openCompare(storage), { question: 'less' });
    for (let open = 0; open < 4; open += 1) {
      expect(greetingOnOpen(storage), `otevření ${open + 1}`).toBe('greetingAgain');
    }
  });

  it('se „střídat“ Rudy vždy řekne „Jdeme porovnávat!“, ať první příklad začne „víc“, nebo „míň“', () => {
    const storage = new MemoryStorage();
    confirmChoice(openCompare(storage), { question: 'alternate' });
    const firstQuestions = new Set<CompareQuestion>();
    for (let seed = 1; seed <= 12; seed += 1) {
      firstQuestions.add(openCompare(storage, seed).session.question());
      expect(greetingOnOpen(storage, seed), `seed ${seed}`).toBe('greetingAgain');
    }
    expect([...firstQuestions].sort()).toEqual(['less', 'more']);
  });

  it('česky ani anglicky pozdrav, který Rudy při „míň“ řekne, neobsahuje otázku na víc', () => {
    const storage = new MemoryStorage();
    confirmChoice(openCompare(storage), { question: 'less' });
    const line = greetingOnOpen(storage);
    expect(compareTexts('cs').rudyLines[line]).not.toMatch(/víc/i);
    expect(compareTexts('en').rudyLines[line]).not.toMatch(/more/i);
  });
});

describe('#182: při „míň“ ani při střídání Rudy v oslavě neříká „Vždycky poznáš, kde je víc!“', () => {
  /**
   * Dítě s Rudym vyplní `rows` řad hvězdiček; vrátí, co Rudy řekl v každém
   * okně s oslavou a co hra stahovala dopředu.
   */
  function celebrations(storage: MemoryStorage, rows: number) {
    const rudy = new FakeRudy();
    const test = openCompare(storage, 3, rudy);
    rudy.giveUp();
    const lines = compareRudyLines(storage);
    const said: CompareRudyLine[] = [];
    for (let row = 0; row < rows; row += 1) {
      for (let star = 0; star < 10; star += 1) {
        test.session.tap(rightChoice(test));
        test.timers.advance(NEXT_PROBLEM_MS);
      }
      expect(rudy.waitingMove()).toBe('celebrate');
      const line = lines.upcoming('celebrate', rudy.contexts.at(-1));
      lines.said('celebrate', line);
      said.push(line);
      rudy.openPending();
      rudy.close();
      test.timers.runAll();
    }
    const prepared = rudy.preparedContexts.map((context) =>
      compareRudyLines(storage).upcoming('celebrate', context),
    );
    test.session.leave();
    return { said, prepared };
  }

  it('s otázkou „víc“ se oslavy střídají včetně „Vždycky poznáš, kde je víc!“', () => {
    const { said } = celebrations(new MemoryStorage(), 3);
    expect(said).toEqual(['celebration', 'celebrationMore', 'celebration']);
  });

  for (const question of ['less', 'alternate'] as const) {
    it(`s otázkou „${question === 'less' ? 'míň' : 'střídat'}“ Rudy po každé plné řadě řekne jen „Hurá! Máš deset hvězdiček!“`, () => {
      const storage = new MemoryStorage();
      confirmChoice(openCompare(storage), { question });
      const { said, prepared } = celebrations(storage, 4);
      expect(said).toEqual(['celebration', 'celebration', 'celebration', 'celebration']);
      expect(prepared.length).toBeGreaterThan(0);
      expect(prepared.every((line) => line === 'celebration')).toBe(true);
      expect(compareTexts('cs').rudyLines.celebration).not.toMatch(/víc/i);
      expect(compareTexts('en').rudyLines.celebration).not.toMatch(/more/i);
    });
  }
});
