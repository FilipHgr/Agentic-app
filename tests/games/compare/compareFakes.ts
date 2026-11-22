import { createCompareSession } from '../../../src/games/compare/logic/compareSession';
import type {
  CompareChange,
  CompareSession,
  CompareSoundName,
} from '../../../src/games/compare/logic/compareSession';
import { correctChoice } from '../../../src/games/compare/logic/compareProblems';
import type { CompareChoice } from '../../../src/games/compare/logic/compareProblems';
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

export interface TestCompare {
  readonly session: CompareSession;
  readonly timers: FakeTimers;
  readonly sounds: FakeSounds;
  readonly changes: CompareChange[];
}

/** Dítě otevře Porovnávání nad úložištěm `storage` (bez něj jen paměť). */
export function openCompare(storage?: KeyValueStorage, seed?: number): TestCompare {
  const timers = new FakeTimers();
  const sounds = new FakeSounds();
  const changes: CompareChange[] = [];
  const session = createCompareSession({
    storage,
    random: seededRandom(seed),
    sounds,
    timers,
    onChange: (change) => changes.push(change),
  });
  return { session, timers, sounds, changes };
}

/** Špatná volba v příkladu: karta s méně tečkami, nebo „=“ při různém počtu. */
export function wrongChoice(test: TestCompare): CompareChoice {
  const right = correctChoice(test.session.problem());
  return right === 'equal' ? 'left' : 'equal';
}

/** Dítě ťukne správně a počká, až přijde další příklad (i po oslavě). */
export function solveProblem(test: TestCompare): void {
  test.session.tap(correctChoice(test.session.problem()));
  test.timers.runAll();
}

/** Vyřeší `count` příkladů za sebou. */
export function solveProblems(test: TestCompare, count: number): void {
  for (let index = 0; index < count; index += 1) {
    solveProblem(test);
  }
}
