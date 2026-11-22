import { createCompareSession } from '../../../src/games/compare/logic/compareSession';
import type {
  CompareChange,
  CompareQuestionVoice,
  CompareRudy,
  CompareRudyContext,
  CompareRudyEvents,
  CompareSession,
  CompareSoundName,
} from '../../../src/games/compare/logic/compareSession';
import { correctChoice } from '../../../src/games/compare/logic/compareProblems';
import type { CompareChoice } from '../../../src/games/compare/logic/compareProblems';
import type { CompareQuestion } from '../../../src/games/compare/logic/compareQuestion';
import type { RudyLineMove } from '../../../src/shared/logic/rudy';
import type { KeyValueStorage } from '../../../src/shared/storage/keyValueStorage';

/**
 * Pomůcky pro testy Porovnávání (#178): falešné hodiny, zvuky, úložiště
 * a náhoda s pevným seedem, aby testy dopadly pokaždé stejně.
 */

/** Generátor náhodných čísel [0, 1) s pevným seedem (mulberry32). */
export function seededRandom(seed = 20261121): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = state;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hodiny hry: naplánované akce proběhnou až po posunu času. */
export class FakeTimers {
  private nowMs = 0;
  private nextId = 0;
  private readonly pending = new Map<number, { dueMs: number; callback: () => void }>();

  readonly after = (ms: number, callback: () => void): (() => void) => {
    const id = this.nextId;
    this.nextId += 1;
    this.pending.set(id, { dueMs: this.nowMs + ms, callback });
    return () => {
      this.pending.delete(id);
    };
  };

  get count(): number {
    return this.pending.size;
  }

  /** Posune čas o `ms` a pustí všechno, co mezitím mělo proběhnout. */
  advance(ms: number): void {
    const endMs = this.nowMs + ms;
    for (;;) {
      const next = this.earliest();
      if (next === undefined || next.dueMs > endMs) {
        break;
      }
      this.pending.delete(next.id);
      this.nowMs = next.dueMs;
      next.callback();
    }
    this.nowMs = endMs;
  }

  /** Pustí všechno naplánované, dokud nic nečeká. */
  runAll(): void {
    for (let step = 0; step < 1000 && this.pending.size > 0; step += 1) {
      const next = this.earliest();
      if (next === undefined) {
        return;
      }
      this.advance(next.dueMs - this.nowMs);
    }
  }

  private earliest(): { id: number; dueMs: number; callback: () => void } | undefined {
    let found: { id: number; dueMs: number; callback: () => void } | undefined;
    for (const [id, entry] of this.pending) {
      if (found === undefined || entry.dueMs < found.dueMs) {
        found = { id, ...entry };
      }
    }
    return found;
  }
}

/** Zvuky hry: co zaznělo a kolikrát se všechno ztišilo. */
export class FakeSounds {
  readonly played: CompareSoundName[] = [];
  stopped = 0;

  readonly play = (name: CompareSoundName): void => {
    this.played.push(name);
  };

  readonly stopAll = (): void => {
    this.stopped += 1;
  };
}

/** Úložiště hry v paměti; umí selhat při čtení i zápisu. */
export class MemoryStorage implements KeyValueStorage {
  readonly data = new Map<string, string>();
  failReads = false;
  failWrites = false;

  getItem(key: string): string | null {
    if (this.failReads) {
      throw new Error('úložiště nejde číst');
    }
    return this.data.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    if (this.failWrites) {
      throw new Error('úložiště je plné');
    }
    this.data.set(key, value);
  }
}

/** Kolečko nastavení stránky: rodič ho podrží (`hold`), hra se na něj napojí. */
export class FakeGear {
  private opener: (() => void) | null = null;

  readonly attach = (open: () => void): (() => void) => {
    this.opener = open;
    return () => {
      if (this.opener === open) {
        this.opener = null;
      }
    };
  };

  get attached(): boolean {
    return this.opener !== null;
  }

  /** Rodič podržel kolečko 1 s. */
  hold(): void {
    this.opener?.();
  }
}

/**
 * Okno s pandou Rudym (#181): hra o něj požádá, test ho ukáže
 * (`openPending`), zavře (`close`) nebo nechá nestáhnout (`giveUp`).
 */
export class FakeRudy implements CompareRudy {
  /** Pohyby oken, o které hra požádala, v pořadí. */
  readonly requested: RudyLineMove[] = [];
  /** Pohyby, které hra chtěla stáhnout dopředu, v pořadí. */
  readonly prepared: RudyLineMove[] = [];
  private waiting: { move: RudyLineMove; events: CompareRudyEvents } | null = null;
  private shown: { move: RudyLineMove; events: CompareRudyEvents } | null = null;
  stopped = 0;

  /** Co hra ke každému oknu řekla (#182: smí se pozdrav ptát na víc). */
  readonly contexts: CompareRudyContext[] = [];

  readonly show = (
    move: RudyLineMove,
    events: CompareRudyEvents,
    context: CompareRudyContext,
  ): void => {
    this.requested.push(move);
    this.contexts.push(context);
    this.waiting = { move, events };
  };

  /** Co hra ke stahování dopředu řekla (#182). */
  readonly preparedContexts: CompareRudyContext[] = [];

  readonly prepare = (move: RudyLineMove, context: CompareRudyContext): void => {
    this.prepared.push(move);
    this.preparedContexts.push(context);
  };

  readonly stop = (): void => {
    this.stopped += 1;
    this.waiting = null;
    this.shown = null;
  };

  /** Pohyb okna, které je vidět, `null` bez okna. */
  openMove(): RudyLineMove | null {
    return this.shown?.move ?? null;
  }

  /** Pohyb okna, které čeká na stažení. */
  waitingMove(): RudyLineMove | null {
    return this.waiting?.move ?? null;
  }

  /** Okno se stáhlo a ukázalo; `askedMore`, když nahlas zazněl pozdrav „Kde je víc?“. */
  openPending(askedMore = false): void {
    const waiting = this.waiting;
    if (waiting === null) {
      return;
    }
    this.waiting = null;
    this.shown = waiting;
    waiting.events.onOpened({ askedMore });
  }

  /** Okno se zavřelo (samo nebo ťuknutím). */
  close(): void {
    const shown = this.shown;
    if (shown === null) {
      return;
    }
    this.shown = null;
    shown.events.onClosed();
  }

  /** Okno se nestáhlo včas: chvíle se vynechá a hra jde dál. */
  giveUp(): void {
    const waiting = this.waiting;
    if (waiting === null) {
      return;
    }
    this.waiting = null;
    waiting.events.onClosed();
  }
}

/** Hlas průvodce, který říká otázku (#182): co a kolikrát hra chtěla říct. */
export class FakeQuestionVoice implements CompareQuestionVoice {
  readonly said: CompareQuestion[] = [];
  stopped = 0;
  /** Hraje nahrávka opravdu? `false` jako zamčený zvuk nebo chybějící nahrávka. */
  plays = true;

  readonly say = (question: CompareQuestion): Promise<boolean> => {
    this.said.push(question);
    return Promise.resolve(this.plays);
  };

  readonly stop = (): void => {
    this.stopped += 1;
  };
}

export interface TestCompare {
  readonly session: CompareSession;
  readonly timers: FakeTimers;
  readonly sounds: FakeSounds;
  readonly changes: CompareChange[];
  readonly gear: FakeGear;
}

/**
 * Dítě otevře Porovnávání nad úložištěm `storage` (bez něj jen paměť).
 * S `rudy` hra ukazuje okna s pandou (#181), bez něj hraje bez nich.
 * S `voice` hlas průvodce říká otázku (#182), bez něj je hra bez hlasu.
 */
export function openCompare(
  storage?: KeyValueStorage,
  seed?: number,
  rudy?: CompareRudy,
  voice?: CompareQuestionVoice,
): TestCompare {
  const timers = new FakeTimers();
  const sounds = new FakeSounds();
  const changes: CompareChange[] = [];
  const gear = new FakeGear();
  const session = createCompareSession({
    storage,
    random: seededRandom(seed),
    sounds,
    timers,
    attachSettingsGear: gear.attach,
    rudy,
    voice,
    onChange: (change) => changes.push(change),
  });
  return { session, timers, sounds, changes, gear };
}

/** Kam má dítě v rozehraném příkladu ťuknout, podle otázky příkladu (#182). */
export function rightChoice(test: TestCompare): CompareChoice {
  return correctChoice(test.session.problem(), test.session.question());
}

/** Špatná volba v příkladu: druhá karta, nebo „=“ při různém počtu. */
export function wrongChoice(test: TestCompare): CompareChoice {
  const right = rightChoice(test);
  return right === 'equal' ? 'left' : 'equal';
}

/** Dítě ťukne správně a počká, až přijde další příklad (i po oslavě). */
export function solveProblem(test: TestCompare): void {
  test.session.tap(rightChoice(test));
  test.timers.runAll();
}

/** Vyřeší `count` příkladů za sebou. */
export function solveProblems(test: TestCompare, count: number): void {
  for (let index = 0; index < count; index += 1) {
    solveProblem(test);
  }
}
