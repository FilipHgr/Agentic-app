import { describe, expect, it } from 'vitest';

import { GUIDE_SCRIPT } from '../src/logic/guideScript';
import type { GuideLineId } from '../src/logic/guideScript';
import { createGuideVoice, handleGuideVoice, speakerPulses } from '../src/logic/guideVoice';
import type {
  GuideVoiceCommand,
  GuideVoiceEvent,
  GuideVoiceState,
  GuideVoiceTapTarget,
} from '../src/logic/guideVoice';
import type { GameSettings } from '../src/logic/settings';
import {
  START_PLAYING_GUARD_MS,
  back,
  chooseOption,
  finishGuide,
  guideStep,
  next,
  startGuide,
} from '../src/logic/setupGuide';
import type { GuideState, GuideStep } from '../src/logic/setupGuide';

/**
 * Testy k #51 (dabing průvodce nastavením): kdy hlas zazní, kdy skončí a co
 * se stáhne. Hlas je čistý stavový automat: dostává události (otevření,
 * ťuknutí, načteno, chyba načtení, pozadí a návrat) a vrací příkazy
 * „odemkni“, „stáhni“, „hraj“ a „zastav“. Testy ho ovládají jako rodič přes
 * skutečnou logiku průvodce (`setupGuide.ts`) a příkazy přehrávají na
 * napodobeném reproduktoru, který slyší jen načtené nahrávky. Přehrávač
 * nahrávek je v `voicePlayer.test.ts`, místo reproduktoru
 * v `guideSpeakerLayout.test.ts`.
 */

const T0 = 10_000;
const ALL_IDS: readonly GuideLineId[] = GUIDE_SCRIPT.map((line) => line.id);

/** Věta, která patří ke kroku průvodce (podle scénáře z #50). */
function lineOfStep(step: GuideStep): GuideLineId {
  const line = GUIDE_SCRIPT.find((candidate) => candidate.step === step);
  if (line === undefined) {
    throw new Error(`ve scénáři chybí věta kroku ${step}`);
  }
  return line.id;
}

const STEP_1 = lineOfStep(1);
const STEP_2 = lineOfStep(2);
const STEP_3 = lineOfStep(3);
const STEP_4 = lineOfStep(4);

/**
 * Rodič v průvodci. Ťuká jako ve scéně: nejdřív se změní krok podle logiky
 * průvodce, pak se hlasu pošle ťuknutí s krokem, na kterém rodič je.
 * Příkazy hlasu přehrává napodobený reproduktor.
 */
class Parent {
  guide: GuideState = startGuide();
  voice: GuideVoiceState = createGuideVoice();
  now = T0;
  guideOpen = false;

  /** Nahrávky, které už dorazily ze sítě. */
  readonly arrived = new Set<GuideLineId>();
  /** Stahování, která ještě neskončila. */
  readonly inFlight = new Set<GuideLineId>();
  /** Všechna stahování v pořadí, jak začala. */
  readonly downloads: GuideLineId[] = [];
  /** Každé zaznění věty od začátku. */
  readonly heard: GuideLineId[] = [];
  /** Co právě zní, nebo `null` pro ticho. */
  sounding: GuideLineId | null = null;
  unlocks = 0;

  send(event: GuideVoiceEvent): void {
    const result = handleGuideVoice(this.voice, event);
    this.voice = result.state;
    for (const command of result.commands) {
      this.perform(command);
    }
  }

  private perform(command: GuideVoiceCommand): void {
    switch (command.kind) {
      case 'unlock':
        this.unlocks += 1;
        break;
      case 'load':
        this.downloads.push(command.id);
        this.inFlight.add(command.id);
        break;
      case 'play':
        // Přehrávač zastaví předchozí větu; nenačtená nahrávka je ticho.
        if (this.arrived.has(command.id)) {
          this.sounding = command.id;
          this.heard.push(command.id);
        } else {
          this.sounding = null;
        }
        break;
      case 'stop':
        this.sounding = null;
        break;
    }
  }

  get step(): GuideStep {
    return guideStep(this.guide);
  }

  open(): this {
    this.guideOpen = true;
    this.send({ kind: 'opened' });
    return this;
  }

  private tap(target: GuideVoiceTapTarget): void {
    this.send({ kind: 'tapped', target, step: this.step });
  }

  tapNext(): this {
    this.guide = next(this.guide, this.now);
    this.tap('next');
    return this;
  }

  tapBack(): this {
    this.guide = back(this.guide);
    this.tap('back');
    return this;
  }

  tapSpeaker(): this {
    this.tap('speaker');
    return this;
  }

  tapOption(change: Partial<GameSettings>): this {
    this.guide = chooseOption(this.guide, change);
    this.tap('option');
    return this;
  }

  /** Ťuknutí na ztlumenou řadu nebo prázdné místo. */
  tapElsewhere(): this {
    this.tap('elsewhere');
    return this;
  }

  /** „Začít hrát“: během pojistky nic, jinak se průvodce zavře. */
  tapStartPlaying(): this {
    this.tap('startPlaying');
    if (finishGuide(this.guide, this.now) !== null) {
      this.guideOpen = false;
      this.send({ kind: 'closed' });
    }
    return this;
  }

  wait(ms: number): this {
    this.now += ms;
    return this;
  }

  /** Nahrávka dorazí ze sítě a dekóduje se. */
  arrive(id: GuideLineId): this {
    this.arrived.add(id);
    this.inFlight.delete(id);
    this.send({ kind: 'loaded', id });
    return this;
  }

  /** Všechna rozběhnutá stahování skončí úspěšně. */
  arriveAll(): this {
    for (const id of [...this.inFlight]) {
      this.arrive(id);
    }
    return this;
  }

  fail(id: GuideLineId): this {
    this.inFlight.delete(id);
    this.send({ kind: 'loadFailed', id });
    return this;
  }

  goToBackground(): this {
    this.send({ kind: 'hidden' });
    return this;
  }

  comeBack(): this {
    this.send({ kind: 'shown' });
    return this;
  }

  downloadsOf(id: GuideLineId): number {
    return this.downloads.filter((downloaded) => downloaded === id).length;
  }

  /** Kolikrát věta zazněla od začátku. */
  heardCount(id: GuideLineId): number {
    return this.heard.filter((line) => line === id).length;
  }
}

/** Rodič s otevřeným průvodcem, obě první nahrávky už dorazily. */
function openedWithFirstTwoLoaded(): Parent {
  return new Parent().open().arriveAll();
}

/** Rodič, který už jednou ťukl na prázdné místo, takže je zvuk odemčený. */
function unlockedOnStep1(): Parent {
  return openedWithFirstTwoLoaded().tapElsewhere();
}

/** Rodič došel na shrnutí, všechny nahrávky dorazily. */
function onSummary(): Parent {
  const parent = unlockedOnStep1();
  for (let tap = 0; tap < 3; tap += 1) {
    parent.tapNext().arriveAll();
  }
  return parent;
}

describe('AC1: reproduktor přehraje větu aktuálního kroku', () => {
  it('ťuknutí na reproduktor na kroku 1 přehraje větu kroku 1', () => {
    const parent = unlockedOnStep1().tapSpeaker();
    expect(parent.sounding).toBe(STEP_1);
  });

  for (const step of [1, 2, 3, 4] as const) {
    it(`ťuknutí na reproduktor na kroku ${step} přehraje větu právě kroku ${step}`, () => {
      const parent = unlockedOnStep1();
      while (parent.step < step) {
        parent.tapNext().arriveAll();
      }
      parent.tapSpeaker();
      expect(parent.sounding).toBe(lineOfStep(step));
    });
  }

  it('ťuknutí na reproduktor, když věta už hraje, ji pustí znovu od začátku', () => {
    const parent = unlockedOnStep1().tapSpeaker();
    parent.tapSpeaker();
    expect(parent.heardCount(STEP_1)).toBe(2);
    expect(parent.sounding).toBe(STEP_1);
  });

  it('opakované ťukání na reproduktor pustí větu pokaždé znovu, nic dalšího nezazní', () => {
    const parent = unlockedOnStep1();
    for (let tap = 0; tap < 5; tap += 1) {
      parent.tapSpeaker();
    }
    expect(parent.heard).toEqual([STEP_1, STEP_1, STEP_1, STEP_1, STEP_1]);
  });
});

describe('AC2: po otevření se krok 1 sám neozve', () => {
  it('po otevření průvodce nic nezazní, ani když nahrávky dorazí', () => {
    const parent = openedWithFirstTwoLoaded();
    expect(parent.heard).toEqual([]);
    expect(parent.sounding).toBeNull();
  });

  it('po otevření reproduktor na kroku 1 pulzuje', () => {
    expect(speakerPulses(new Parent().open().voice)).toBe(true);
  });

  it('reproduktor pulzuje i dlouho po otevření, dokud rodič neťukne', () => {
    const parent = openedWithFirstTwoLoaded().wait(60_000);
    expect(speakerPulses(parent.voice)).toBe(true);
  });

  const firstTaps: readonly [string, (parent: Parent) => void][] = [
    ['na reproduktor', (parent) => parent.tapSpeaker()],
    ['na Další', (parent) => parent.tapNext()],
    ['na volbu', (parent) => parent.tapOption({ maxNumber: 20 })],
    ['na ztlumenou řadu nebo prázdné místo', (parent) => parent.tapElsewhere()],
  ];

  for (const [where, tap] of firstTaps) {
    it(`po prvním ťuknutí ${where} reproduktor přestane pulzovat`, () => {
      const parent = openedWithFirstTwoLoaded();
      tap(parent);
      expect(speakerPulses(parent.voice)).toBe(false);
    });

    it(`první ťuknutí ${where} odemkne zvuk`, () => {
      const parent = openedWithFirstTwoLoaded();
      tap(parent);
      expect(parent.unlocks).toBe(1);
    });
  }

  it('reproduktor po prvním ťuknutí už nezačne pulzovat znovu', () => {
    const parent = openedWithFirstTwoLoaded().tapElsewhere().tapNext().arriveAll().tapBack();
    parent.goToBackground().comeBack();
    expect(speakerPulses(parent.voice)).toBe(false);
  });

  it('když první ťuknutí míří na reproduktor, věta kroku 1 zazní hned', () => {
    const parent = openedWithFirstTwoLoaded().tapSpeaker();
    expect(parent.sounding).toBe(STEP_1);
  });

  it('když první ťuknutí míří na Další, hned zazní věta kroku 2', () => {
    const parent = openedWithFirstTwoLoaded().tapNext();
    expect(parent.step).toBe(2);
    expect(parent.heard).toEqual([STEP_2]);
    expect(parent.sounding).toBe(STEP_2);
  });

  it('první ťuknutí na prázdné místo zvuk jen odemkne a nic nezazní', () => {
    const parent = openedWithFirstTwoLoaded().tapElsewhere();
    expect(parent.heard).toEqual([]);
    expect(parent.sounding).toBeNull();
  });

  it('první ťuknutí na volbu zvuk jen odemkne a nic nezazní', () => {
    const parent = openedWithFirstTwoLoaded().tapOption({ maxNumber: 20 });
    expect(parent.heard).toEqual([]);
  });

  it('po prvním ťuknutí na prázdné místo další ťuknutí na reproduktor větu přehraje', () => {
    const parent = openedWithFirstTwoLoaded().tapElsewhere().tapSpeaker();
    expect(parent.sounding).toBe(STEP_1);
  });
});

describe('AC3: přechody mezi kroky', () => {
  it('Další ukončí rozehranou větu a hned začne věta nového kroku', () => {
    const parent = unlockedOnStep1().tapSpeaker().tapNext();
    expect(parent.sounding).toBe(STEP_2);
    expect(parent.heard).toEqual([STEP_1, STEP_2]);
  });

  it('Zpět ukončí rozehranou větu a hned začne věta předchozího kroku', () => {
    const parent = unlockedOnStep1().tapNext().arriveAll().tapNext().arriveAll();
    expect(parent.sounding).toBe(STEP_3);
    parent.tapBack();
    expect(parent.sounding).toBe(STEP_2);
  });

  it('Zpět ze shrnutí přehraje větu kroku 3', () => {
    const parent = onSummary().tapBack();
    expect(parent.step).toBe(3);
    expect(parent.sounding).toBe(STEP_3);
  });

  it('každý příchod na krok, i opakovaný, přehraje jeho větu', () => {
    const parent = unlockedOnStep1().tapNext().arriveAll().tapBack().tapNext();
    expect(parent.heard).toEqual([STEP_2, STEP_1, STEP_2]);
  });

  it('dvě rychlá Další: věta kroku 2 skončí nejpozději druhým ťuknutím a hraje jen krok 3', () => {
    const parent = new Parent().open();
    parent.arrive(STEP_1).arrive(STEP_2);
    parent.tapElsewhere().tapNext();
    expect(parent.sounding).toBe(STEP_2);
    parent.tapNext().arriveAll();
    expect(parent.step).toBe(3);
    expect(parent.sounding).toBe(STEP_3);
    expect(parent.heard).toEqual([STEP_2, STEP_3]);
  });

  it('dvě rychlá Další: pozdě načtená věta kroku 2 se po druhém ťuknutí už nespustí', () => {
    const parent = new Parent().open().tapElsewhere();
    parent.tapNext().tapNext();
    parent.arrive(STEP_2);
    expect(parent.heard).toEqual([]);
    parent.arrive(STEP_3);
    expect(parent.heard).toEqual([STEP_3]);
    parent.arriveAll();
    expect(parent.heard).toEqual([STEP_3]);
    expect(parent.sounding).toBe(STEP_3);
  });

  it('ťuknutí na volbu v řadě větu nepřeruší', () => {
    const parent = unlockedOnStep1().tapSpeaker().tapOption({ maxNumber: 20 });
    expect(parent.sounding).toBe(STEP_1);
    expect(parent.heard).toEqual([STEP_1]);
  });

  it('ťuknutí na volbu na shrnutí větu nepřeruší ani nespustí znovu', () => {
    const parent = onSummary();
    const heardBefore = [...parent.heard];
    parent.tapOption({ operations: 'minus' }).tapOption({ answerInput: 'writing' });
    expect(parent.heard).toEqual(heardBefore);
    expect(parent.sounding).toBe(STEP_4);
  });

  it('ťuknutí na volbu, když nic nehraje, nic nespustí', () => {
    const parent = unlockedOnStep1().tapOption({ maxNumber: 5 });
    expect(parent.heard).toEqual([]);
    expect(parent.sounding).toBeNull();
  });

  it('ťuknutí na ztlumenou řadu nebo prázdné místo větu nepřeruší', () => {
    const parent = unlockedOnStep1().tapSpeaker().tapElsewhere();
    expect(parent.sounding).toBe(STEP_1);
  });

  it('po „Začít hrát“ hlas hned skončí', () => {
    const parent = onSummary().wait(START_PLAYING_GUARD_MS).tapSpeaker().tapStartPlaying();
    expect(parent.guideOpen).toBe(false);
    expect(parent.sounding).toBeNull();
  });

  it('po „Začít hrát“ se hlas ve hře už neozve, ani když dorazí nahrávka', () => {
    const parent = new Parent().open().tapElsewhere();
    parent.arrive(STEP_1).tapNext().tapNext().tapNext();
    parent.wait(START_PLAYING_GUARD_MS).tapStartPlaying();
    expect(parent.guideOpen).toBe(false);
    const heardAtFinish = [...parent.heard];
    parent.arrive(STEP_2).arrive(STEP_3).arrive(STEP_4);
    expect(parent.heard).toEqual(heardAtFinish);
    expect(parent.sounding).toBeNull();
  });

  it('po „Začít hrát“ už se nic dalšího nestahuje', () => {
    const parent = onSummary().wait(START_PLAYING_GUARD_MS).tapStartPlaying();
    const downloadsAtFinish = parent.downloads.length;
    parent.goToBackground().comeBack();
    expect(parent.downloads).toHaveLength(downloadsAtFinish);
  });

  it('„Začít hrát“ během pojistky 500 ms větu shrnutí nepřeruší', () => {
    const parent = onSummary();
    expect(parent.sounding).toBe(STEP_4);
    parent.wait(START_PLAYING_GUARD_MS - 1).tapStartPlaying();
    expect(parent.guideOpen).toBe(true);
    expect(parent.sounding).toBe(STEP_4);
    expect(parent.heardCount(STEP_4)).toBe(1);
  });

  it('„Začít hrát“ během pojistky nic nespustí ani nestáhne', () => {
    const parent = onSummary().tapSpeaker();
    const heardBefore = [...parent.heard];
    const downloadsBefore = [...parent.downloads];
    parent.tapStartPlaying().tapStartPlaying();
    expect(parent.heard).toEqual(heardBefore);
    expect(parent.downloads).toEqual(downloadsBefore);
  });

  it('„Začít hrát“ po pojistce hlas ukončí, i když rodič předtím ťukl během pojistky', () => {
    const parent = onSummary().tapStartPlaying().wait(START_PLAYING_GUARD_MS).tapStartPlaying();
    expect(parent.guideOpen).toBe(false);
    expect(parent.sounding).toBeNull();
  });
});

describe('AC4: postupné načítání nahrávek', () => {
  it('při otevření se začne stahovat nahrávka kroku 1 a přednačte se nahrávka kroku 2', () => {
    const parent = new Parent().open();
    expect([...parent.downloads].sort()).toEqual([STEP_1, STEP_2].sort());
  });

  it('nahrávka kroku 1 se při otevření začne stahovat dřív než nahrávka kroku 2', () => {
    expect(new Parent().open().downloads[0]).toBe(STEP_1);
  });

  it('před otevřením průvodce se nic nestahuje', () => {
    const parent = new Parent();
    expect(parent.downloads).toEqual([]);
  });

  it('příchod na krok 2 přednačte nahrávku kroku 3', () => {
    const parent = unlockedOnStep1().tapNext();
    expect(parent.downloads).toContain(STEP_3);
    expect(parent.downloads).not.toContain(STEP_4);
  });

  it('příchod na krok 3 přednačte nahrávku shrnutí', () => {
    const parent = unlockedOnStep1().tapNext().arriveAll().tapNext();
    expect(parent.downloads).toContain(STEP_4);
  });

  it('za shrnutím se nepřednačítá nic, stáhnou se jen čtyři nahrávky průvodce', () => {
    const parent = onSummary();
    expect([...new Set(parent.downloads)].sort()).toEqual([...ALL_IDS].sort());
    expect(parent.downloads).toHaveLength(ALL_IDS.length);
  });

  it('rychlé proťukání na krok 3 před dokončením stahování rozběhne nahrávky kroků 3 a 4', () => {
    const parent = new Parent().open().tapElsewhere().tapNext().tapNext();
    expect(parent.downloads).toContain(STEP_3);
    expect(parent.downloads).toContain(STEP_4);
  });

  it('úspěšně stažená nahrávka se při chození tam a zpět už znovu nestahuje', () => {
    const parent = unlockedOnStep1();
    for (let round = 0; round < 3; round += 1) {
      parent.tapNext().arriveAll().tapNext().arriveAll().tapNext().arriveAll();
      parent.tapBack().tapBack().tapBack();
    }
    parent.tapSpeaker();
    for (const id of ALL_IDS) {
      expect(parent.downloadsOf(id), id).toBe(1);
    }
  });

  it('úspěšně stažená nahrávka se znovu nestahuje ani po ťuknutí na reproduktor', () => {
    const parent = unlockedOnStep1().tapSpeaker().tapSpeaker();
    expect(parent.downloadsOf(STEP_1)).toBe(1);
  });

  it('dokud stahování běží, další stahování stejné nahrávky nezačne', () => {
    const parent = new Parent().open().tapElsewhere();
    parent.tapSpeaker().tapSpeaker();
    parent.tapNext().tapBack().tapNext().tapBack();
    parent.tapSpeaker();
    expect(parent.downloadsOf(STEP_1)).toBe(1);
    expect(parent.downloadsOf(STEP_2)).toBe(1);
    expect(parent.downloadsOf(STEP_3)).toBe(1);
  });

  it('nepovedená nahrávka se sama hned znovu nestahuje', () => {
    const parent = new Parent().open().fail(STEP_1).fail(STEP_2);
    expect(parent.downloadsOf(STEP_1)).toBe(1);
    expect(parent.downloadsOf(STEP_2)).toBe(1);
  });

  it('nepovedená nahrávka se nestahuje znovu po ťuknutí na volbu ani na prázdné místo', () => {
    const parent = new Parent().open().fail(STEP_1);
    parent.tapOption({ maxNumber: 20 }).tapElsewhere().tapOption({ maxNumber: 5 });
    expect(parent.downloadsOf(STEP_1)).toBe(1);
  });

  it('nepovedená nahrávka se nestahuje znovu po návratu z pozadí', () => {
    const parent = new Parent().open().tapElsewhere().fail(STEP_1);
    parent.goToBackground().comeBack();
    expect(parent.downloadsOf(STEP_1)).toBe(1);
  });

  it('nepovedená nahrávka se zkusí znovu při dalším příchodu na její krok', () => {
    const parent = new Parent().open().tapElsewhere().arrive(STEP_1).fail(STEP_2);
    parent.tapNext();
    expect(parent.downloadsOf(STEP_2)).toBe(2);
  });

  it('nepovedená nahrávka kroku 1 se zkusí znovu po návratu na krok 1', () => {
    const parent = new Parent().open().tapElsewhere().fail(STEP_1).arrive(STEP_2);
    parent.tapNext().tapBack();
    expect(parent.downloadsOf(STEP_1)).toBe(2);
  });

  it('nepovedená nahrávka se zkusí znovu při ťuknutí na reproduktor na jejím kroku', () => {
    const parent = new Parent().open().tapElsewhere().fail(STEP_1);
    parent.tapSpeaker();
    expect(parent.downloadsOf(STEP_1)).toBe(2);
  });

  it('reproduktor na jiném kroku nepovedenou nahrávku nestahuje', () => {
    const parent = new Parent().open().tapElsewhere().arrive(STEP_1).fail(STEP_2);
    parent.tapSpeaker();
    expect(parent.downloadsOf(STEP_2)).toBe(1);
  });

  it('nepovedená nahrávka se zkusí znovu, když se přednačítá z kroku před ní', () => {
    // Přednačtení kroku 3 z kroku 2 selže, rodič se vrátí a znovu přijde na krok 2.
    const parent = unlockedOnStep1().tapNext().fail(STEP_3);
    parent.tapBack().tapNext();
    expect(parent.downloadsOf(STEP_3)).toBe(2);
  });

  it('přednačtení kroku 2 při otevření se po chybě zkusí znovu při příchodu na krok 2', () => {
    const parent = new Parent().open().arrive(STEP_1).fail(STEP_2).tapElsewhere().tapNext();
    expect(parent.downloadsOf(STEP_2)).toBe(2);
  });

  it('nepovedená nahrávka, která se napodruhé povede, se potřetí nestahuje', () => {
    const parent = new Parent().open().tapElsewhere().fail(STEP_1);
    parent.tapSpeaker().arrive(STEP_1).tapSpeaker().tapNext().arriveAll().tapBack();
    expect(parent.downloadsOf(STEP_1)).toBe(2);
  });

  it('při opakovaném pokusu o nepovedenou nahrávku se během stahování nezačne další', () => {
    const parent = new Parent().open().tapElsewhere().fail(STEP_1);
    parent.tapSpeaker().tapSpeaker().tapSpeaker();
    expect(parent.downloadsOf(STEP_1)).toBe(2);
  });

  it('stahují se jen nahrávky ze scénáře průvodce', () => {
    const parent = onSummary();
    for (const id of parent.downloads) {
      expect(ALL_IDS).toContain(id);
    }
  });
});

describe('AC5: pozdě načtená a chybějící nahrávka', () => {
  it('reproduktor před načtením: věta zazní, jakmile nahrávka dorazí', () => {
    const parent = new Parent().open().tapElsewhere().tapSpeaker();
    expect(parent.sounding).toBeNull();
    parent.arrive(STEP_1);
    expect(parent.sounding).toBe(STEP_1);
    expect(parent.heard).toEqual([STEP_1]);
  });

  it('Další před načtením: věta nového kroku zazní, jakmile nahrávka dorazí', () => {
    const parent = new Parent().open().tapNext();
    expect(parent.sounding).toBeNull();
    parent.arrive(STEP_2);
    expect(parent.sounding).toBe(STEP_2);
  });

  it('Zpět před načtením: věta kroku zazní, jakmile nahrávka dorazí', () => {
    const parent = new Parent().open().arrive(STEP_2).tapNext().tapBack();
    parent.arrive(STEP_1);
    expect(parent.sounding).toBe(STEP_1);
  });

  it('pozdě načtená věta zazní i po dlouhé době, když je rodič pořád na stejném kroku', () => {
    const parent = new Parent()
      .open()
      .tapElsewhere()
      .tapSpeaker()
      .wait(5 * 60_000);
    parent.arrive(STEP_1);
    expect(parent.sounding).toBe(STEP_1);
  });

  it('volby během čekání na nahrávku nevadí, věta po načtení zazní', () => {
    const parent = new Parent().open().tapElsewhere().tapSpeaker();
    parent.tapOption({ maxNumber: 20 }).tapOption({ maxNumber: 5 }).tapElsewhere();
    parent.arrive(STEP_1);
    expect(parent.sounding).toBe(STEP_1);
  });

  it('pozdě načtená věta zazní jen jednou', () => {
    const parent = new Parent().open().tapElsewhere().tapSpeaker();
    parent.arrive(STEP_1);
    parent.arrive(STEP_2);
    expect(parent.heard).toEqual([STEP_1]);
  });

  it('když rodič mezitím přešel jinam, pozdě načtená nahrávka se sama nespustí', () => {
    const parent = new Parent().open().tapElsewhere().tapSpeaker();
    parent.arrive(STEP_2).tapNext();
    parent.arrive(STEP_1);
    expect(parent.sounding).toBe(STEP_2);
    expect(parent.heard).toEqual([STEP_2]);
  });

  it('když rodič přešel jinam a vrátil se Zpět, zazní věta z návratu, ne dvakrát', () => {
    const parent = new Parent().open().tapElsewhere().tapSpeaker();
    parent.tapNext().tapBack();
    parent.arrive(STEP_1);
    expect(parent.heard).toEqual([STEP_1]);
    parent.arrive(STEP_2);
    expect(parent.heard).toEqual([STEP_1]);
  });

  it('když rodič průvodce zavřel, pozdě načtená nahrávka se sama nespustí', () => {
    const parent = new Parent().open().tapElsewhere().arrive(STEP_1).arrive(STEP_2);
    parent.tapNext().arrive(STEP_3).tapNext().tapNext();
    parent.wait(START_PLAYING_GUARD_MS).tapStartPlaying();
    parent.arrive(STEP_4);
    expect(parent.heard).not.toContain(STEP_4);
    expect(parent.sounding).toBeNull();
  });

  it('nenačtená nahrávka znamená ticho a průvodce jde dál', () => {
    const parent = new Parent().open().tapElsewhere().tapSpeaker().fail(STEP_1);
    expect(parent.sounding).toBeNull();
    parent.arrive(STEP_2).tapNext();
    expect(parent.step).toBe(2);
    expect(parent.sounding).toBe(STEP_2);
  });

  it('když žádná nahrávka nejde stáhnout, rodič projde celý průvodce v tichu až do hry', () => {
    const parent = new Parent().open();
    const failAll = (): void => {
      for (const id of [...parent.inFlight]) {
        parent.fail(id);
      }
    };
    failAll();
    for (let tap = 0; tap < 3; tap += 1) {
      parent.tapSpeaker().tapNext();
      failAll();
    }
    parent.tapBack().tapNext().tapSpeaker().wait(START_PLAYING_GUARD_MS).tapStartPlaying();
    expect(parent.heard).toEqual([]);
    expect(parent.guideOpen).toBe(false);
  });

  it('chyba načtení nahrávky, na kterou se čeká, zruší čekání a nic nezazní', () => {
    const parent = new Parent().open().tapElsewhere().tapSpeaker().fail(STEP_1);
    expect(parent.sounding).toBeNull();
    expect(parent.heard).toEqual([]);
  });

  it('po chybě a novém pokusu reproduktorem věta zazní, jakmile nahrávka dorazí', () => {
    const parent = new Parent().open().tapElsewhere().fail(STEP_1).tapSpeaker();
    parent.arrive(STEP_1);
    expect(parent.sounding).toBe(STEP_1);
  });

  it('když nahrávka dorazí, když je stránka v pozadí, nespustí se', () => {
    const parent = new Parent().open().tapElsewhere().tapSpeaker().goToBackground();
    parent.arrive(STEP_1);
    expect(parent.sounding).toBeNull();
  });

  it('když nahrávka dorazila v pozadí, nespustí se ani po návratu', () => {
    const parent = new Parent().open().tapElsewhere().tapSpeaker().goToBackground();
    parent.arrive(STEP_1).comeBack();
    expect(parent.heard).toEqual([]);
    expect(parent.sounding).toBeNull();
  });

  it('nahrávka, která dorazila v pozadí, zazní po návratu ťuknutím na reproduktor bez stahování', () => {
    const parent = new Parent().open().tapElsewhere().tapSpeaker().goToBackground();
    parent.arrive(STEP_1).comeBack().tapSpeaker();
    expect(parent.sounding).toBe(STEP_1);
    expect(parent.downloadsOf(STEP_1)).toBe(1);
  });
});

describe('AC6: pozadí a návrat', () => {
  it('když stránka přejde do pozadí, věta skončí', () => {
    const parent = unlockedOnStep1().tapSpeaker().goToBackground();
    expect(parent.sounding).toBeNull();
  });

  it('po návratu z pozadí se věta sama neozve', () => {
    const parent = unlockedOnStep1().tapSpeaker().goToBackground().comeBack();
    expect(parent.sounding).toBeNull();
    expect(parent.heard).toEqual([STEP_1]);
  });

  it('po návratu z pozadí se neozve ani věta, na jejíž nahrávku se čekalo', () => {
    const parent = new Parent().open().tapElsewhere().tapSpeaker().goToBackground().comeBack();
    parent.arrive(STEP_1);
    expect(parent.heard).toEqual([]);
  });

  it('po návratu z pozadí reproduktor větu přehraje', () => {
    const parent = unlockedOnStep1().tapSpeaker().goToBackground().comeBack().tapSpeaker();
    expect(parent.sounding).toBe(STEP_1);
  });

  it('po návratu z pozadí Další přehraje větu nového kroku', () => {
    const parent = unlockedOnStep1().goToBackground().comeBack().tapNext();
    expect(parent.sounding).toBe(STEP_2);
  });

  it('po návratu z pozadí Zpět přehraje větu předchozího kroku', () => {
    const parent = unlockedOnStep1().tapNext().arriveAll().goToBackground().comeBack().tapBack();
    expect(parent.sounding).toBe(STEP_1);
  });

  it('pozadí před prvním ťuknutím nic nespustí a po návratu reproduktor pořád pulzuje', () => {
    const parent = openedWithFirstTwoLoaded().goToBackground().comeBack();
    expect(parent.heard).toEqual([]);
    expect(speakerPulses(parent.voice)).toBe(true);
  });

  it('pozadí v tichu nic nerozbije, po návratu průvodce jde dál', () => {
    const parent = unlockedOnStep1().goToBackground().goToBackground().comeBack().comeBack();
    parent.tapNext();
    expect(parent.step).toBe(2);
    expect(parent.sounding).toBe(STEP_2);
  });
});
