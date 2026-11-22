import { createCompareSession } from '../../../src/games/compare/logic/compareSession';
import type {
  CompareChange,
  CompareRudy,
  CompareRudyEvents,
  CompareSession,
  CompareSoundName,
} from '../../../src/games/compare/logic/compareSession';
import { correctSign, otherSign } from '../../../src/games/compare/logic/compareProblems';
import type {
  ArithmeticProblem,
  CompareProblem,
  CompareSign,
} from '../../../src/games/compare/logic/compareProblems';
import type { KeyValueStorage } from '../../../src/shared/storage/keyValueStorage';

/**
 * Pomůcky pro testy Porovnávání (#178, od #187 doplň znaménko): falešné hodiny, zvuky, úložiště
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
 * Panda Rudy (#181, #186): hra o něj požádá, test ho ukáže
 * (`openPending`), pošle pryč (`close`) nebo nechá nestáhnout (`giveUp`).
 */
export class FakeRudy implements CompareRudy {
  /** Kolikrát hra chtěla Rudyho s oslavou. */
  requested = 0;
  /** Kolikrát hra chtěla oslavu stáhnout dopředu. */
  prepared = 0;
  private waiting: CompareRudyEvents | null = null;
  private shown: CompareRudyEvents | null = null;
  stopped = 0;

  readonly celebrate = (events: CompareRudyEvents): void => {
    this.requested += 1;
    this.waiting = events;
  };

  readonly prepare = (): void => {
    this.prepared += 1;
  };

  readonly stop = (): void => {
    this.stopped += 1;
    this.waiting = null;
    this.shown = null;
  };

  /** Je Rudy vidět? */
  isShown(): boolean {
    return this.shown !== null;
  }

  /** Čeká Rudy na stažení? */
  isWaiting(): boolean {
    return this.waiting !== null;
  }

  /** Rudy se stáhl a ukázal. */
  openPending(): void {
    const waiting = this.waiting;
    if (waiting === null) {
      return;
    }
    this.waiting = null;
    this.shown = waiting;
    waiting.onOpened();
  }

  /** Rudy odešel (sám nebo po ťuknutí). */
  close(): void {
    const shown = this.shown;
    if (shown === null) {
      return;
    }
    this.shown = null;
    shown.onClosed();
  }

  /** Rudy se nestáhl včas: chvíle se vynechá a oslava jde dál. */
  giveUp(): void {
    const waiting = this.waiting;
    if (waiting === null) {
      return;
    }
    this.waiting = null;
    waiting.onClosed();
  }
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
 * S `rudy` hra ukazuje Rudyho po 10. hvězdičce (#181, #186), bez něj hraje bez něj.
 */
export function openCompare(
  storage?: KeyValueStorage,
  seed?: number,
  rudy?: CompareRudy,
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
    onChange: (change) => changes.push(change),
  });
  return { session, timers, sounds, changes, gear };
}

/** Znaménko, které do okénka rozehraného příkladu patří (#187). */
export function rightSign(test: TestCompare): CompareSign {
  return correctSign(test.session.problem());
}

/** Znaménko, které do okénka nepatří. */
export function wrongSign(test: TestCompare): CompareSign {
  return otherSign(rightSign(test));
}

/** Dítě ťukne na správné znaménko a počká, až přijde další příklad (i po oslavě). */
export function solveProblem(test: TestCompare): void {
  test.session.tap(rightSign(test));
  test.timers.runAll();
}

/** Vyřeší `count` příkladů za sebou. */
export function solveProblems(test: TestCompare, count: number): void {
  for (let index = 0; index < count; index += 1) {
    solveProblem(test);
  }
}

/**
 * Příklad „a ☐ b = c“: při výchozích znaménkách + − (#190) jiný nepřijde.
 * Kdyby přišel příklad „a ☐ b“, test spadne.
 */
export function arithmeticOf(problem: CompareProblem): ArithmeticProblem {
  if (problem.kind !== 'arithmetic') {
    throw new Error(`při + − přišel příklad „${problem.a} ☐ ${problem.b}“`);
  }
  return problem;
}
