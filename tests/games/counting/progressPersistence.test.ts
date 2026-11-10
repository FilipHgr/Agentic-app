import { describe, expect, it } from 'vitest';

import { createAnswerRound, tapAnswer } from '../../../src/games/counting/logic/answerRound';
import type { TapOutcome } from '../../../src/games/counting/logic/answerRound';
import {
  START_PROGRESS,
  parseProgress,
  serializeProgress,
} from '../../../src/games/counting/logic/progress';
import type { GameProgress } from '../../../src/games/counting/logic/progress';
import { DEFAULT_SETTINGS } from '../../../src/games/counting/logic/settings';
import type { GameSettings } from '../../../src/games/counting/logic/settings';
import {
  STARS_PER_SET,
  startNewStarSet,
  starsAfterTap,
} from '../../../src/games/counting/logic/stars';
import { loadProgress, saveProgress } from '../../../src/games/counting/storage/progressStorage';
import { loadSettings, saveSettings } from '../../../src/games/counting/storage/settingsStorage';
import type { KeyValueStorage } from '../../../src/shared/storage/keyValueStorage';

import { seededRandom } from './seededRandom';

/** Úložiště v paměti, jako localStorage v prohlížeči. Přežije „zavření hry“. */
function memoryStorage(): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
  };
}

/** Úložiště, které prohlížeč zakázal nebo je plné: každé čtení i zápis selže. */
function brokenStorage(): KeyValueStorage {
  return {
    getItem: () => {
      throw new Error('úložiště zakázáno');
    },
    setItem: () => {
      throw new Error('úložiště plné');
    },
  };
}

/** Klíč, pod kterým hra ukládá postup v zařízení (stejný před #63 i po něm). */
const PROGRESS_KEY = 'agentic-app.progress';

/** Uložený záznam tak, jak by ho mohl nechat starší nebo poškozený stav hry. */
function savedRecord(record: unknown): string {
  return JSON.stringify(record);
}

/** Stav po jednom ťuknutí tak, jak ho hra počítá: hvězdičky a po oslavě prázdná řada. */
function progressAfterTap(progress: GameProgress, outcome: TapOutcome): GameProgress {
  const stars = starsAfterTap(progress, outcome);
  return stars.setCompleted ? startNewStarSet() : stars.progress;
}

/** Stav po řadě ťuknutí od zadaného začátku. */
function progressAfter(outcomes: readonly TapOutcome[], start: GameProgress): GameProgress {
  return outcomes.reduce(progressAfterTap, start);
}

function correctAnswers(count: number): TapOutcome[] {
  return Array.from({ length: count }, () => 'correct');
}

/** Hráč hru zavře (stav se uloží) a znovu otevře (stav se načte). */
function closeAndReopen(progress: GameProgress, storage = memoryStorage()): GameProgress {
  saveProgress(storage, progress);
  return loadProgress(storage);
}

describe('AC1: rozsvícené hvězdičky vydrží zavření hry', () => {
  it('po 4 hvězdičkách a znovuotevření hry svítí 4 hvězdičky', () => {
    const beforeClose = progressAfter(correctAnswers(4), START_PROGRESS);

    const afterReopen = closeAndReopen(beforeClose);

    expect(afterReopen.earned).toBe(4);
  });

  it('další správná odpověď po znovuotevření rozsvítí pátou hvězdičku', () => {
    const afterReopen = closeAndReopen(progressAfter(correctAnswers(4), START_PROGRESS));

    const next = starsAfterTap(afterReopen, 'correct');

    expect(next.progress.earned).toBe(5);
    expect(next.starEarned).toBe(true);
    expect(next.setCompleted).toBe(false);
  });

  it('každý rozpracovaný počet hvězdiček 0 až 9 se po znovuotevření vrátí stejný', () => {
    for (let earned = 0; earned < STARS_PER_SET; earned += 1) {
      const progress: GameProgress = { earned };
      expect(closeAndReopen(progress)).toEqual(progress);
      expect(parseProgress(serializeProgress(progress))).toEqual(progress);
    }
  });

  it('hvězdičky vydrží i několik zavření a otevření za sebou', () => {
    const storage = memoryStorage();
    let progress = loadProgress(storage);

    for (let session = 0; session < 3; session += 1) {
      progress = progressAfter(correctAnswers(2), progress);
      saveProgress(storage, progress);
      progress = loadProgress(storage);
    }

    expect(progress.earned).toBe(6);
  });
});

describe('AC3: hra zavřená uprostřed oslavy začne prázdnou řadou', () => {
  it('plná řada se po znovuotevření změní na prázdnou řadu', () => {
    const afterReopen = closeAndReopen({ earned: STARS_PER_SET });

    expect(afterReopen).toEqual({ earned: 0 });
  });

  it('oslava se po znovuotevření nezopakuje a další správná odpověď dá 1 hvězdičku', () => {
    const afterReopen = closeAndReopen({ earned: STARS_PER_SET });

    const next = starsAfterTap(afterReopen, 'correct');

    expect(next.progress.earned).toBe(1);
    expect(next.setCompleted).toBe(false);
  });

  it('hvězdička se neztratí ani nepřidá: další oslava přijde přesně po 10 správných odpovědích', () => {
    let progress = closeAndReopen({ earned: STARS_PER_SET });

    for (let answer = 1; answer < STARS_PER_SET; answer += 1) {
      const result = starsAfterTap(progress, 'correct');
      expect(result.setCompleted).toBe(false);
      progress = result.progress;
    }

    expect(starsAfterTap(progress, 'correct').setCompleted).toBe(true);
  });

  it('přesně 10 hvězdiček je platný záznam, ne poškozený: dá prázdnou řadu', () => {
    expect(parseProgress(savedRecord({ earned: 10 }))).toEqual({ earned: 0 });
  });
});

describe('AC4: špatná odpověď ani nápověda uložený stav nezmění', () => {
  it('po chybách a nápovědě má hráč po znovuotevření stejně hvězdiček jako před chybou', () => {
    const storage = memoryStorage();
    const beforeMistake: GameProgress = { earned: 4 };
    saveProgress(storage, beforeMistake);
    const savedBefore = storage.data.get([...storage.data.keys()][0] ?? '');

    // Dvě chyby za sebou ukážou nápovědu s tečkami; ani jedna nic nemění.
    let round = createAnswerRound(DEFAULT_SETTINGS, seededRandom());
    let progress = beforeMistake;
    const wrongAnswer = round.problem.result === 0 ? 1 : 0;
    for (let mistake = 0; mistake < 3; mistake += 1) {
      const tap = tapAnswer(round, wrongAnswer);
      expect(tap.outcome).toBe('wrong');
      round = tap.round;
      progress = progressAfterTap(progress, tap.outcome);
      saveProgress(storage, progress);
    }

    expect(storage.data.get([...storage.data.keys()][0] ?? '')).toBe(savedBefore);
    expect(loadProgress(storage)).toEqual(beforeMistake);
  });

  it('ťuknutí, které nic nedělá, uložený stav nezmění', () => {
    const before: GameProgress = { earned: 7 };

    expect(closeAndReopen(progressAfterTap(before, 'ignored'))).toEqual(before);
  });

  it('správná odpověď po nápovědě hvězdičku přidá a ta se uloží', () => {
    const afterHint = progressAfter(['wrong', 'wrong', 'correct'], { earned: 4 });

    expect(closeAndReopen(afterHint)).toEqual({ earned: 5 });
  });
});

describe('AC5: chybějící nebo poškozený záznam: hra začne normálně', () => {
  it('začátek hry je prázdná řada hvězdiček', () => {
    expect(START_PROGRESS).toEqual({ earned: 0 });
  });

  it('při prvním spuštění bez uloženého záznamu začne hra od začátku', () => {
    expect(loadProgress(memoryStorage())).toEqual(START_PROGRESS);
    expect(parseProgress(null)).toEqual(START_PROGRESS);
    expect(parseProgress(undefined)).toEqual(START_PROGRESS);
  });

  it('bez úložiště prohlížeče začne hra od začátku', () => {
    expect(loadProgress(undefined)).toEqual(START_PROGRESS);
  });

  it('poškozený záznam hru nerozbije a začne od začátku', () => {
    for (const saved of ['', 'nesmysl', '{', 'null', '42', '"4"', '[]', '[4,"robik"]', '{}']) {
      expect(parseProgress(saved)).toEqual(START_PROGRESS);
    }
  });

  it('nesmyslný počet hvězdiček (záporný, víc než 10, necelý, jiný typ) se zahodí', () => {
    const badCounts: unknown[] = [-1, 11, 100, 2.5, '4', null, true, undefined];
    for (const earned of badCounts) {
      expect(parseProgress(savedRecord({ earned }))).toEqual(START_PROGRESS);
    }
    // Příliš velké číslo se v JSON přečte jako nekonečno.
    expect(parseProgress('{"earned":1e999}')).toEqual(START_PROGRESS);
  });

  it('poškozený záznam v úložišti hra po otevření nahradí začátkem', () => {
    const storage = memoryStorage();
    saveProgress(storage, { earned: 4 });
    for (const key of storage.data.keys()) {
      storage.data.set(key, '{"earned":');
    }

    expect(loadProgress(storage)).toEqual(START_PROGRESS);
  });

  it('zakázané nebo plné úložiště hru nerozbije, hra běží dál', () => {
    const storage = brokenStorage();

    expect(() => loadProgress(storage)).not.toThrow();
    expect(loadProgress(storage)).toEqual(START_PROGRESS);
    expect(() => saveProgress(storage, { earned: 4 })).not.toThrow();
    expect(saveProgress(storage, { earned: 4 })).toBe(false);
  });

  it('uložení bez úložiště prohlížeče jen vrátí, že se neuložilo', () => {
    expect(saveProgress(undefined, { earned: 4 })).toBe(false);
  });

  it('úspěšné uložení to ohlásí', () => {
    expect(saveProgress(memoryStorage(), { earned: 4 })).toBe(true);
  });
});

describe('AC6: změna nastavení nezmění hvězdičky', () => {
  const changedSettings: GameSettings = { maxNumber: 20, operations: 'mixed' };

  it('po změně rozsahu a druhu příkladů zůstanou hvězdičky', () => {
    const storage = memoryStorage();
    const progress: GameProgress = { earned: 6 };
    saveProgress(storage, progress);

    saveSettings(storage, changedSettings);
    saveSettings(storage, { maxNumber: 5, operations: 'minus' });

    expect(loadProgress(storage)).toEqual(progress);
  });

  it('uložení hvězdiček nezmění nastavení rodiče', () => {
    const storage = memoryStorage();
    saveSettings(storage, changedSettings);

    saveProgress(storage, { earned: 9 });

    expect(loadSettings(storage)).toEqual(changedSettings);
  });
});

/**
 * #63, AC6: postup uložený hrou s postavičkami. Jen tady smí zůstat pole
 * `character` a jména postaviček (#63, AC7), protože tak vypadají záznamy,
 * které hráči v zařízení už mají.
 */
describe('#63 AC6: starý uložený postup s postavičkou se načte', () => {
  /** Úložiště, ve kterém je postup uložený starší verzí hry. */
  function storageWithOldRecord(record: unknown): ReturnType<typeof memoryStorage> {
    const storage = memoryStorage();
    storage.data.set(PROGRESS_KEY, savedRecord(record));
    return storage;
  }

  it('záznam {"earned":4,"character":"robik"} se načte se 4 hvězdičkami a postavička se ignoruje', () => {
    const storage = storageWithOldRecord({ earned: 4, character: 'robik' });

    expect(() => loadProgress(storage)).not.toThrow();
    expect(loadProgress(storage)).toEqual({ earned: 4 });
    expect(parseProgress('{"earned":4,"character":"robik"}')).toEqual({ earned: 4 });
  });

  it('hvězdičky se nezahodí kvůli postavičce: platné jméno, neznámé jméno, číslo, null i chybějící pole', () => {
    const oldCharacters: unknown[] = [
      'hvezdik',
      'robik',
      'plaminek',
      'sovicka',
      '',
      'ROBIK',
      1,
      0,
      null,
      ['robik'],
      { name: 'robik' },
    ];
    for (const character of oldCharacters) {
      const label = JSON.stringify(character);
      expect(parseProgress(savedRecord({ earned: 4, character })), label).toEqual({ earned: 4 });
      expect(loadProgress(storageWithOldRecord({ earned: 4, character })), label).toEqual({
        earned: 4,
      });
    }
    expect(parseProgress(savedRecord({ earned: 4 }))).toEqual({ earned: 4 });
  });

  it('každý rozpracovaný počet 0 až 9 se starou postavičkou se načte celý', () => {
    for (let earned = 0; earned < STARS_PER_SET; earned += 1) {
      for (const character of ['hvezdik', 'robik', 'plaminek']) {
        expect(parseProgress(savedRecord({ earned, character }))).toEqual({ earned });
      }
    }
  });

  it('starý záznam s 10 hvězdičkami dá prázdnou řadu bez oslavy', () => {
    for (const character of ['hvezdik', 'robik', 'plaminek', 'sovicka', null]) {
      const afterReopen = loadProgress(storageWithOldRecord({ earned: 10, character }));

      expect(afterReopen, String(character)).toEqual({ earned: 0 });
      expect(starsAfterTap(afterReopen, 'correct').setCompleted).toBe(false);
    }
  });

  it('chybějící, poškozený nebo nesmyslný počet hvězdiček u starého záznamu dá začátek hry', () => {
    const badCounts: unknown[] = [-1, -3, 2.5, 11, 100, '4', 'čtyři', null, true, undefined];
    for (const earned of badCounts) {
      expect(parseProgress(savedRecord({ earned, character: 'robik' })), String(earned)).toEqual(
        START_PROGRESS,
      );
    }
    expect(parseProgress(savedRecord({ character: 'robik' }))).toEqual(START_PROGRESS);
    expect(parseProgress('{"earned":1e999,"character":"robik"}')).toEqual(START_PROGRESS);
    expect(parseProgress('{"earned":4,"character":')).toEqual(START_PROGRESS);
  });

  it('nově uložený postup obsahuje jen hvězdičky', () => {
    const storage = storageWithOldRecord({ earned: 4, character: 'robik' });

    saveProgress(storage, progressAfterTap(loadProgress(storage), 'correct'));

    const saved = storage.data.get(PROGRESS_KEY) ?? '';
    expect(JSON.parse(saved)).toEqual({ earned: 5 });
    expect(JSON.parse(serializeProgress({ earned: 3 }))).toEqual({ earned: 3 });
  });

  it('postup se ukládá pod stejným klíčem jako dřív, takže hráč o hvězdičky nepřijde', () => {
    const storage = storageWithOldRecord({ earned: 7, character: 'plaminek' });

    expect(loadProgress(storage).earned).toBe(7);
    saveProgress(storage, { earned: 8 });

    expect([...storage.data.keys()]).toEqual([PROGRESS_KEY]);
    expect(loadProgress(storage)).toEqual({ earned: 8 });
  });
});
