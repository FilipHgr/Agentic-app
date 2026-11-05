import { createCountingSession } from '../../../src/games/counting/logic/countingSession';
import type {
  CountingSession,
  SessionPage,
  SessionSounds,
  SessionTimers,
  SessionVoice,
} from '../../../src/games/counting/logic/countingSession';
import type { LoadRecognizer } from '../../../src/games/counting/logic/recognizerLoading';
import { serializeSettings } from '../../../src/games/counting/logic/settings';
import type { GameSettings } from '../../../src/games/counting/logic/settings';
import type { DigitRecognizer } from '../../../src/games/counting/logic/writingRound';
import type { Tone } from '../../../src/shared/audio/tonePlayer';
import type { KeyValueStorage } from '../../../src/shared/storage/keyValueStorage';

import { seededRandom } from './seededRandom';
import { memoryStorage } from './storageFakes';

/**
 * Falešné objekty pro testy sezení hry Počítání (#68 AC2, AC3 a AC5):
 * časovače hry, zvuky, věta průvodce, kolečko nastavení na stránce
 * a stahování rozpoznávání psaní. Nic se nekreslí, nehraje ani nestahuje.
 */

/** Časovače hry (místo Phaser `time.delayedCall`), čas posouvá test. */
export class FakeTimers implements SessionTimers {
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

  /** Kolik naplánovaných akcí ještě čeká. */
  get count(): number {
    return this.pending.size;
  }

  /** Posune čas o `ms` a pustí všechno, co mezitím mělo proběhnout (i nově naplánované). */
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

  /** Pustí všechno naplánované, dokud nic nečeká (nejvýš 1000 kroků). */
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
export class FakeSounds implements SessionSounds {
  readonly played: Array<readonly Tone[]> = [];
  stopped = 0;

  readonly play = (tones: readonly Tone[]): void => {
    this.played.push(tones);
  };

  readonly stopAll = (): void => {
    this.stopped += 1;
  };
}

/** Věta průvodce nastavením. */
export class FakeVoice implements SessionVoice {
  stopped = 0;

  readonly stop = (): void => {
    this.stopped += 1;
  };
}

/**
 * Stránka s kolečkem nastavení. Kolečko je jedno pro všechny vstupy do hry,
 * takže každé napojení, které hra neodpojí, by po podržení otevřelo
 * nastavení znovu (jako zapomenutý posluchač na tlačítku stránky).
 */
export class FakePage implements SessionPage {
  private readonly gearHandlers = new Set<() => void>();

  readonly attachSettingsGear = (open: () => void): (() => void) => {
    const handler = (): void => open();
    this.gearHandlers.add(handler);
    return () => {
      this.gearHandlers.delete(handler);
    };
  };

  /** Kolik napojení na kolečko je teď aktivních. */
  get gearListeners(): number {
    return this.gearHandlers.size;
  }

  /** Rodič podrží kolečko 1 s (samotné podržení testuje `tests/shared`). */
  holdGear(): void {
    for (const handler of [...this.gearHandlers]) {
      handler();
    }
  }
}

interface PendingLoad {
  succeed(recognizer?: DigitRecognizer): void;
  fail(): void;
}

/** Stahování rozpoznávání psaní, které dokončí nebo shodí test. */
export class FakeRecognizerLoader {
  readonly attempts: PendingLoad[] = [];

  readonly load: LoadRecognizer = () =>
    new Promise<DigitRecognizer>((resolve, reject) => {
      this.attempts.push({
        succeed: (recognizer = () => 7) => resolve(recognizer),
        fail: () => reject(new Error('stahování selhalo')),
      });
    });

  get count(): number {
    return this.attempts.length;
  }

  last(): PendingLoad {
    const attempt = this.attempts[this.attempts.length - 1];
    if (attempt === undefined) {
      throw new Error('stahování nezačalo');
    }
    return attempt;
  }
}

/** Nastavení rodiče, uložené dřív (hra se tak nespouští poprvé a průvodce se neukáže). */
export const KEYPAD_SETTINGS: GameSettings = {
  maxNumber: 10,
  operations: 'plus',
  answerInput: 'keypad',
};

export const WRITING_SETTINGS: GameSettings = {
  maxNumber: 10,
  operations: 'plus',
  answerInput: 'writing',
};

/** Všechno, co sezení hry potřebuje; společné části (úložiště, stránka) přežijí odchod. */
export interface TestDevice {
  readonly storage: KeyValueStorage & { readonly data: Map<string, string> };
  readonly page: FakePage;
  readonly sounds: FakeSounds;
  readonly voice: FakeVoice;
}

/** Zařízení s uloženým nastavením; bez nastavení je to první spuštění (průvodce). */
export function testDevice(settings: GameSettings | null = KEYPAD_SETTINGS): TestDevice {
  return {
    storage: memoryStorage(settings === null ? undefined : serializeSettings(settings)),
    page: new FakePage(),
    sounds: new FakeSounds(),
    voice: new FakeVoice(),
  };
}

export interface TestSession {
  readonly session: CountingSession;
  readonly timers: FakeTimers;
  readonly recognizer: FakeRecognizerLoader;
  /** Kolikrát hra chtěla překreslit obrazovku. */
  changes(): number;
}

/** Jeden vstup do Počítání na zařízení `device`. */
export function enterCounting(device: TestDevice, seed?: number): TestSession {
  const timers = new FakeTimers();
  const recognizer = new FakeRecognizerLoader();
  let changes = 0;
  const session = createCountingSession({
    storage: device.storage,
    random: seededRandom(seed),
    sounds: device.sounds,
    voice: device.voice,
    timers,
    page: device.page,
    loadRecognizer: recognizer.load,
    onChange: () => {
      changes += 1;
    },
  });
  return { session, timers, recognizer, changes: () => changes };
}

/** Správná odpověď na rozehraný příklad. */
export function correctAnswerOf(session: CountingSession): number {
  return session.problem().result;
}

/** Špatná odpověď, která je na číselníku. */
export function wrongAnswerOf(session: CountingSession): number {
  return session.problem().result === 0 ? 1 : 0;
}

/**
 * Dítě vyřeší `count` příkladů za sebou: ťukne správně a počká na další
 * příklad (nebo na konec oslavy).
 */
export function solveProblems(test: TestSession, count: number): void {
  for (let solved = 0; solved < count; solved += 1) {
    test.session.tapAnswer(correctAnswerOf(test.session));
    test.timers.runAll();
  }
}
