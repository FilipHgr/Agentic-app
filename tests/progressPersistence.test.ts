import { describe, expect, it } from 'vitest';

import { createAnswerRound, tapAnswer } from '../src/logic/answerRound';
import type { TapOutcome } from '../src/logic/answerRound';
import { CHARACTERS, FIRST_CHARACTER, nextCharacter } from '../src/logic/characters';
import { START_PROGRESS, parseProgress, serializeProgress } from '../src/logic/progress';
import type { GameProgress } from '../src/logic/progress';
import { DEFAULT_SETTINGS } from '../src/logic/settings';
import type { GameSettings } from '../src/logic/settings';
import { STARS_PER_SET, startNewStarSet, starsAfterTap } from '../src/logic/stars';
import { loadProgress, saveProgress } from '../src/storage/progressStorage';
import { loadSettings, saveSettings } from '../src/storage/settingsStorage';
import type { KeyValueStorage } from '../src/storage/settingsStorage';

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

/** Uložený záznam tak, jak by ho mohl nechat starší nebo poškozený stav hry. */
function savedRecord(record: unknown): string {
  return JSON.stringify(record);
}

/** Stav po jednom ťuknutí tak, jak ho hra počítá: hvězdičky a po oslavě další postavička. */
function progressAfterTap(progress: GameProgress, outcome: TapOutcome): GameProgress {
  const stars = starsAfterTap(progress, outcome);
  if (stars.setCompleted) {
    return { ...startNewStarSet(), character: nextCharacter(progress.character) };
  }
  return { ...stars.progress, character: progress.character };
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
      for (const character of CHARACTERS) {
        const progress: GameProgress = { earned, character };
        expect(closeAndReopen(progress)).toEqual(progress);
        expect(parseProgress(serializeProgress(progress))).toEqual(progress);
      }
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

describe('AC2: vystřídaná postavička vydrží zavření hry', () => {
  it('po první oslavě je na obrazovce Robík i po znovuotevření hry', () => {
    const afterCelebration = progressAfter(correctAnswers(STARS_PER_SET), START_PROGRESS);
    expect(afterCelebration.character).toBe('robik');

    const afterReopen = closeAndReopen(afterCelebration);

    expect(afterReopen.character).toBe('robik');
    expect(afterReopen.earned).toBe(0);
  });

  it('po další oslavě po znovuotevření přijde Plamínek', () => {
    const afterReopen = closeAndReopen({ earned: 0, character: 'robik' });

    const afterNextCelebration = progressAfter(correctAnswers(STARS_PER_SET), afterReopen);

    expect(afterNextCelebration.character).toBe('plaminek');
  });

  it('každá postavička se po znovuotevření vrátí ta samá', () => {
    for (const character of CHARACTERS) {
      expect(closeAndReopen({ earned: 3, character }).character).toBe(character);
    }
  });
});

describe('AC3: hra zavřená uprostřed oslavy začne prázdnou řadou s další postavičkou', () => {
  it('plná řada s Robíkem se po znovuotevření změní na prázdnou řadu s Plamínkem', () => {
    const afterReopen = closeAndReopen({ earned: STARS_PER_SET, character: 'robik' });

    expect(afterReopen).toEqual({ earned: 0, character: 'plaminek' });
  });

  it('po Plamínkovi s plnou řadou přijde znovu Hvězdík', () => {
    const afterReopen = closeAndReopen({ earned: STARS_PER_SET, character: 'plaminek' });

    expect(afterReopen).toEqual({ earned: 0, character: 'hvezdik' });
  });

  it('oslava se po znovuotevření nezopakuje a další správná odpověď dá 1 hvězdičku', () => {
    const afterReopen = closeAndReopen({ earned: STARS_PER_SET, character: 'hvezdik' });

    const next = starsAfterTap(afterReopen, 'correct');

    expect(next.progress.earned).toBe(1);
    expect(next.setCompleted).toBe(false);
  });

  it('hvězdička se neztratí ani nepřidá: další oslava přijde přesně po 10 správných odpovědích', () => {
    let progress = closeAndReopen({ earned: STARS_PER_SET, character: 'hvezdik' });

    for (let answer = 1; answer < STARS_PER_SET; answer += 1) {
      const result = starsAfterTap(progress, 'correct');
      expect(result.setCompleted).toBe(false);
      progress = { ...result.progress, character: progress.character };
    }

    expect(starsAfterTap(progress, 'correct').setCompleted).toBe(true);
  });

  it('přesně 10 hvězdiček je platný záznam, ne poškozený (postavička se posune, nezačne se Hvězdíkem)', () => {
    expect(parseProgress(savedRecord({ earned: 10, character: 'robik' }))).toEqual({
      earned: 0,
      character: 'plaminek',
    });
  });
});

describe('AC4: špatná odpověď ani nápověda uložený stav nezmění', () => {
  it('po chybách a nápovědě má hráč po znovuotevření stejně hvězdiček jako před chybou', () => {
    const storage = memoryStorage();
    const beforeMistake: GameProgress = { earned: 4, character: 'robik' };
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
    const before: GameProgress = { earned: 7, character: 'plaminek' };

    expect(closeAndReopen(progressAfterTap(before, 'ignored'))).toEqual(before);
  });

  it('správná odpověď po nápovědě hvězdičku přidá a ta se uloží', () => {
    const afterHint = progressAfter(['wrong', 'wrong', 'correct'], {
      earned: 4,
      character: 'robik',
    });

    expect(closeAndReopen(afterHint)).toEqual({ earned: 5, character: 'robik' });
  });
});

describe('AC5: chybějící nebo poškozený záznam: hra začne normálně s Hvězdíkem', () => {
  it('začátek hry je prázdná řada a Hvězdík', () => {
    expect(START_PROGRESS).toEqual({ earned: 0, character: FIRST_CHARACTER });
    expect(FIRST_CHARACTER).toBe('hvezdik');
  });

  it('při prvním spuštění bez uloženého záznamu začne hra od začátku', () => {
    expect(loadProgress(memoryStorage())).toEqual(START_PROGRESS);
    expect(parseProgress(null)).toEqual(START_PROGRESS);
    expect(parseProgress(undefined)).toEqual(START_PROGRESS);
  });

  it('bez úložiště prohlížeče začne hra od začátku', () => {
    expect(loadProgress(undefined)).toEqual(START_PROGRESS);
  });

  it('poškozený záznam hra nerozbije a začne od začátku', () => {
    for (const saved of ['', 'nesmysl', '{', 'null', '42', '"4"', '[]', '[4,"robik"]', '{}']) {
      expect(parseProgress(saved)).toEqual(START_PROGRESS);
    }
  });

  it('nesmyslný počet hvězdiček (záporný, víc než 10, necelý, jiný typ) se zahodí', () => {
    const badCounts: unknown[] = [-1, 11, 100, 2.5, '4', null, true, undefined];
    for (const earned of badCounts) {
      expect(parseProgress(savedRecord({ earned, character: 'robik' }))).toEqual(START_PROGRESS);
    }
    // Příliš velké číslo se v JSON přečte jako nekonečno.
    expect(parseProgress('{"earned":1e999,"character":"robik"}')).toEqual(START_PROGRESS);
  });

  it('neznámá postavička nebo jiný typ se zahodí', () => {
    const badCharacters: unknown[] = [
      'sovicka',
      '',
      'Robik',
      'ROBIK',
      1,
      null,
      ['robik'],
      undefined,
    ];
    for (const character of badCharacters) {
      expect(parseProgress(savedRecord({ earned: 4, character }))).toEqual(START_PROGRESS);
    }
  });

  it('jedna špatná položka zahodí celý záznam, ani platná část se nepoužije', () => {
    expect(parseProgress(savedRecord({ earned: 4, character: 'sovicka' }))).toEqual(START_PROGRESS);
    expect(parseProgress(savedRecord({ earned: -3, character: 'plaminek' }))).toEqual(
      START_PROGRESS,
    );
  });

  it('poškozený záznam v úložišti hra po otevření nahradí začátkem', () => {
    const storage = memoryStorage();
    saveProgress(storage, { earned: 4, character: 'robik' });
    for (const key of storage.data.keys()) {
      storage.data.set(key, '{"earned":');
    }

    expect(loadProgress(storage)).toEqual(START_PROGRESS);
  });

  it('zakázané nebo plné úložiště hru nerozbije, hra běží dál', () => {
    const storage = brokenStorage();

    expect(() => loadProgress(storage)).not.toThrow();
    expect(loadProgress(storage)).toEqual(START_PROGRESS);
    expect(() => saveProgress(storage, { earned: 4, character: 'robik' })).not.toThrow();
    expect(saveProgress(storage, { earned: 4, character: 'robik' })).toBe(false);
  });

  it('uložení bez úložiště prohlížeče jen vrátí, že se neuložilo', () => {
    expect(saveProgress(undefined, { earned: 4, character: 'robik' })).toBe(false);
  });

  it('úspěšné uložení to ohlásí', () => {
    expect(saveProgress(memoryStorage(), { earned: 4, character: 'robik' })).toBe(true);
  });
});

describe('AC6: změna nastavení nezmění hvězdičky ani postavičku', () => {
  const changedSettings: GameSettings = { maxNumber: 20, operations: 'mixed' };

  it('po změně rozsahu a druhu příkladů zůstanou hvězdičky i postavička', () => {
    const storage = memoryStorage();
    const progress: GameProgress = { earned: 6, character: 'plaminek' };
    saveProgress(storage, progress);

    saveSettings(storage, changedSettings);
    saveSettings(storage, { maxNumber: 5, operations: 'minus' });

    expect(loadProgress(storage)).toEqual(progress);
  });

  it('uložení hvězdiček nezmění nastavení rodiče', () => {
    const storage = memoryStorage();
    saveSettings(storage, changedSettings);

    saveProgress(storage, { earned: 9, character: 'robik' });

    expect(loadSettings(storage)).toEqual(changedSettings);
  });
});
