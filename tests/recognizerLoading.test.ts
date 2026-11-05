import { describe, expect, it } from 'vitest';

import { createAnswerRound, tapAnswer } from '../src/logic/answerRound';
import type { Stroke } from '../src/logic/digitRecognition';
import { createRecognizerLoading } from '../src/logic/recognizerLoading';
import type { LoadRecognizer, RecognizerLoadStatus } from '../src/logic/recognizerLoading';
import { answerInputOf, parseSettings, serializeSettings } from '../src/logic/settings';
import type { GameSettings } from '../src/logic/settings';
import type { DigitRecognizer } from '../src/logic/writingRound';

import { seededRandom } from './seededRandom';

/**
 * Testy k #58 (rychlejší načtení): kdy se stáhne rozpoznávání psaní, kolikrát
 * a co dítě uvidí, když stahování ještě běží nebo selže. Stahování je
 * podvržené: každé zavolání načítání vrátí slib, který test sám splní nebo
 * odmítne, takže se nic skutečně nestahuje a nic se nečasuje.
 */

const KEYPAD: GameSettings = { maxNumber: 10, operations: 'plus', answerInput: 'keypad' };
const WRITING: GameSettings = { maxNumber: 10, operations: 'plus', answerInput: 'writing' };

/** Podvržené rozpoznávání, které vždy přečte sedmičku. */
const alwaysSeven: DigitRecognizer = () => 7;

interface PendingLoad {
  readonly succeed: (recognize?: DigitRecognizer) => void;
  readonly fail: () => void;
}

interface FakeLoader {
  readonly load: LoadRecognizer;
  /** Kolikrát hra začala stahovat. */
  readonly count: () => number;
  /** Poslední zahájené stahování, které test splní nebo odmítne. */
  readonly latest: () => PendingLoad;
}

/** Načítání, které čeká, dokud ho test nesplní nebo neodmítne. */
function fakeLoader(): FakeLoader {
  const pending: PendingLoad[] = [];
  const load: LoadRecognizer = () =>
    new Promise<DigitRecognizer>((resolve, reject) => {
      pending.push({
        succeed: (recognize = alwaysSeven) => resolve(recognize),
        fail: () => reject(new TypeError('Failed to fetch dynamically imported module')),
      });
    });
  return {
    load,
    count: () => pending.length,
    latest: () => {
      const last = pending[pending.length - 1];
      if (last === undefined) {
        throw new Error('stahování ještě nezačalo');
      }
      return last;
    },
  };
}

/** Nechá doběhnout splněné a odmítnuté slíby. */
function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('rozpoznávání se stahuje až po prvním příkladu (AC2)', () => {
  it('rozpoznávání se začne načítat až po prvním vykreslení příkladu', () => {
    const loader = fakeLoader();
    const loading = createRecognizerLoading(loader.load);

    expect(loader.count()).toBe(0);
    expect(loading.status()).toBe('notStarted');

    loading.problemDrawn();

    expect(loader.count()).toBe(1);
    expect(loading.status()).toBe('loading');
  });

  it('s číselníkem se rozpoznávání po prvním příkladu stáhne na pozadí taky', () => {
    const loader = fakeLoader();
    const loading = createRecognizerLoading(loader.load);

    loading.problemDrawn();

    expect(loader.count()).toBe(1);
    expect(loading.answerInput(KEYPAD)).toBe('keypad');
  });

  it('s číselníkem se hraje, i když se rozpoznávání ještě stahuje', () => {
    const loader = fakeLoader();
    const loading = createRecognizerLoading(loader.load);
    const round = createAnswerRound(KEYPAD, seededRandom());

    loading.problemDrawn();
    const result = tapAnswer(round, round.problem.result);

    expect(loading.status()).toBe('loading');
    expect(loading.answerInput(KEYPAD)).toBe('keypad');
    expect(result.outcome).toBe('correct');
  });

  it('další příklady už stahování znovu nespustí', async () => {
    const loader = fakeLoader();
    const loading = createRecognizerLoading(loader.load);

    loading.problemDrawn();
    loading.problemDrawn();
    loader.latest().succeed();
    await settle();
    loading.problemDrawn();

    expect(loader.count()).toBe(1);
    expect(loading.status()).toBe('ready');
  });

  it('po stažení má hra rozpoznávání, které dostala ze stahování', async () => {
    const loader = fakeLoader();
    const loading = createRecognizerLoading(loader.load);
    const recognizeNine: DigitRecognizer = () => 9;

    loading.problemDrawn();
    expect(loading.recognizer()).toBeNull();
    loader.latest().succeed(recognizeNine);
    await settle();

    const strokes: Stroke[] = [];
    expect(loading.recognizer()?.(strokes, { width: 280, height: 280 })).toBe(9);
  });
});

describe('se zapnutým psaním a prázdnou mezipamětí (AC3)', () => {
  it('okénko na psaní se ukáže hned, i když se rozpoznávání ještě stahuje', () => {
    const loader = fakeLoader();
    const loading = createRecognizerLoading(loader.load);

    expect(loading.answerInput(WRITING)).toBe('writing');
    loading.problemDrawn();
    expect(loading.answerInput(WRITING)).toBe('writing');
  });

  it('okénko zůstane i při rozsahu do 5 a do 20', () => {
    const loading = createRecognizerLoading(fakeLoader().load);
    loading.problemDrawn();

    expect(loading.answerInput({ ...WRITING, maxNumber: 5 })).toBe('writing');
    expect(loading.answerInput({ ...WRITING, maxNumber: 20 })).toBe('writing');
  });

  it('na stažení se čeká bez časového limitu', async () => {
    const loader = fakeLoader();
    const loading = createRecognizerLoading(loader.load);

    loading.problemDrawn();
    for (let i = 0; i < 5; i += 1) {
      await settle();
    }

    expect(loading.status()).toBe('loading');
    expect(loading.answerInput(WRITING)).toBe('writing');
    loader.latest().succeed();
    await settle();
    expect(loading.status()).toBe('ready');
  });
});

describe('zapnutí psaní v nastavení (AC4)', () => {
  it('psaní zapnuté během stahování na pozadí rozpoznávání nestáhne podruhé', async () => {
    const loader = fakeLoader();
    const loading = createRecognizerLoading(loader.load);

    loading.problemDrawn();
    loading.writingEnabled();

    expect(loader.count()).toBe(1);
    expect(loading.answerInput(WRITING)).toBe('writing');
    loader.latest().succeed();
    await settle();
    expect(loading.status()).toBe('ready');
    expect(loader.count()).toBe(1);
  });

  it('opakované zapínání a vypínání psaní stáhne rozpoznávání jen jednou', async () => {
    const loader = fakeLoader();
    const loading = createRecognizerLoading(loader.load);

    loading.problemDrawn();
    for (let i = 0; i < 4; i += 1) {
      loading.writingEnabled();
      expect(loading.answerInput(KEYPAD)).toBe('keypad');
      loading.problemDrawn();
    }
    loader.latest().succeed();
    await settle();
    for (let i = 0; i < 4; i += 1) {
      loading.writingEnabled();
      loading.problemDrawn();
    }

    expect(loader.count()).toBe(1);
    expect(loading.answerInput(WRITING)).toBe('writing');
  });

  it('psaní zapnuté ještě před prvním příkladem rozpoznávání stáhne', async () => {
    const loader = fakeLoader();
    const loading = createRecognizerLoading(loader.load);

    loading.writingEnabled();
    loading.problemDrawn();

    expect(loader.count()).toBe(1);
    loader.latest().succeed();
    await settle();
    expect(loading.recognizer()).not.toBeNull();
  });
});

describe('rozpoznávání se nepodaří stáhnout (AC5)', () => {
  it('po nepovedeném stažení dostane dítě místo okénka číselník', async () => {
    const loader = fakeLoader();
    const loading = createRecognizerLoading(loader.load);

    loading.problemDrawn();
    loader.latest().fail();
    await settle();

    expect(loading.status()).toBe('failed');
    expect(loading.recognizer()).toBeNull();
    expect(loading.answerInput(WRITING)).toBe('keypad');
  });

  it('chyba hned při spuštění stahování hru neshodí, dítě dostane číselník', async () => {
    const loading = createRecognizerLoading(() => {
      throw new TypeError('import selhal');
    });

    expect(() => loading.problemDrawn()).not.toThrow();
    await settle();

    expect(loading.status()).toBe('failed');
    expect(loading.answerInput(WRITING)).toBe('keypad');
  });

  it('hra se dozví, že stahování selhalo, aby mohla okénko vyměnit za číselník', async () => {
    const loader = fakeLoader();
    const loading = createRecognizerLoading(loader.load);
    const seen: RecognizerLoadStatus[] = [];
    loading.onChange((status) => seen.push(status));

    loading.problemDrawn();
    loader.latest().fail();
    await settle();

    expect(seen).toContain('failed');
  });

  it('uložené nastavení psaní zůstane po nepovedeném stažení zapnuté', async () => {
    const loader = fakeLoader();
    const loading = createRecognizerLoading(loader.load);
    const saved = serializeSettings(WRITING);

    loading.problemDrawn();
    loader.latest().fail();
    await settle();
    loading.answerInput(WRITING);

    expect(answerInputOf(parseSettings(saved))).toBe('writing');
    expect(answerInputOf(WRITING)).toBe('writing');
  });

  it('u dalšího příkladu se hra pokusí stáhnout znovu a po úspěchu se objeví okénko', async () => {
    const loader = fakeLoader();
    const loading = createRecognizerLoading(loader.load);
    const seen: RecognizerLoadStatus[] = [];
    loading.onChange((status) => seen.push(status));

    loading.problemDrawn();
    loader.latest().fail();
    await settle();
    expect(loading.answerInput(WRITING)).toBe('keypad');

    loading.problemDrawn();
    expect(loader.count()).toBe(2);
    // Dokud se znovu nestáhne, zůstane číselník, aby okénko nebylo k ničemu.
    expect(loading.answerInput(WRITING)).toBe('keypad');

    loader.latest().succeed();
    await settle();
    expect(loading.status()).toBe('ready');
    expect(loading.recognizer()).not.toBeNull();
    expect(loading.answerInput(WRITING)).toBe('writing');
    expect(seen[seen.length - 1]).toBe('ready');
  });

  it('překreslení téhož příkladu po selhání stahování znovu nespustí', async () => {
    const loader = fakeLoader();
    const loading = createRecognizerLoading(loader.load);

    loading.problemDrawn();
    loader.latest().fail();
    await settle();
    loading.answerInput(WRITING);
    loading.answerInput(WRITING);

    expect(loader.count()).toBe(1);
  });

  it('opakované selhání hru nezastaví, každý další příklad zkusí stáhnout znovu', async () => {
    const loader = fakeLoader();
    const loading = createRecognizerLoading(loader.load);

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      loading.problemDrawn();
      expect(loader.count()).toBe(attempt);
      loader.latest().fail();
      await settle();
      expect(loading.answerInput(WRITING)).toBe('keypad');
    }
  });

  it('odhlášená hra už o změnách stahování nedostává zprávy', async () => {
    const loader = fakeLoader();
    const loading = createRecognizerLoading(loader.load);
    const seen: RecognizerLoadStatus[] = [];
    const stop = loading.onChange((status) => seen.push(status));

    stop();
    loading.problemDrawn();
    loader.latest().succeed();
    await settle();

    expect(seen).toEqual([]);
  });
});
