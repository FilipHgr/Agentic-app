import { describe, expect, it } from 'vitest';

import { createLanguageChoice } from '../../src/shared/logic/languageChoice';
import type { LanguageChoice } from '../../src/shared/logic/languageChoice';
import type { KeyValueStorage } from '../../src/shared/storage/keyValueStorage';
import {
  DEFAULT_LANGUAGE,
  LANGUAGES,
  LANGUAGE_STORAGE_KEY,
  currentLanguage,
  selectLanguage,
} from '../../src/shared/texts/languages';
import type { Language } from '../../src/shared/texts/languages';
import { sharedTexts } from '../../src/shared/texts/sharedTexts';

/**
 * Testy k #70 AC3: zvolený jazyk platí pro celé zařízení, uloží se jen
 * lokálně a po obnovení stránky platí dál. Od #138 AC3 běží se skutečným
 * seznamem jazyků hry (čeština a angličtina), umělý jazyk už není potřeba.
 *
 * Navržené rozhraní (`src/shared/logic/languageChoice.ts`, čistý TypeScript):
 * - `createLanguageChoice({ supported, fallback, storage })` volba jazyka
 *   jednoho načtení stránky; `storage` vrací úložiště, nebo `undefined`,
 * - `current(requested?)` aktuální jazyk (s požadavkem jako dřív
 *   `currentLanguage(požadavek)`),
 * - `select(language)` zvolí jazyk; vrátí `true`, jen když se jazyk změnil.
 */

/** Úložiště v paměti; přežije „obnovení stránky“ (novou volbu jazyka). */
class MemoryStorage implements KeyValueStorage {
  readonly data = new Map<string, string>();
  readonly writes: Array<[string, string]> = [];
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
    this.writes.push([key, value]);
    this.data.set(key, value);
  }
}

/** Jedno načtení stránky nad úložištěm `storage`. */
function pageLoad(storage: KeyValueStorage | undefined): LanguageChoice<Language> {
  return createLanguageChoice({
    supported: LANGUAGES,
    fallback: DEFAULT_LANGUAGE,
    storage: () => storage,
  });
}

describe('#70 AC3: volba jazyka platí hned a pamatuje se', () => {
  it('bez uložené volby je jazyk čeština', () => {
    expect(pageLoad(new MemoryStorage()).current()).toBe('cs');
  });

  it('po výběru platí nový jazyk hned', () => {
    const choice = pageLoad(new MemoryStorage());
    expect(choice.select('en')).toBe(true);
    expect(choice.current()).toBe('en');
  });

  it('výběr se uloží a po obnovení stránky platí', () => {
    const storage = new MemoryStorage();
    pageLoad(storage).select('en');
    expect(pageLoad(storage).current()).toBe('en');
  });

  it('do zařízení se uloží jen kód jazyka pod jedním klíčem', () => {
    const storage = new MemoryStorage();
    pageLoad(storage).select('en');
    expect(storage.writes).toEqual([[LANGUAGE_STORAGE_KEY, 'en']]);
  });

  it('klíč úložiště patří této stránce („agentic-app.language“)', () => {
    expect(LANGUAGE_STORAGE_KEY).toBe('agentic-app.language');
  });

  it('návrat zpět na češtinu se taky uloží a po obnovení platí', () => {
    const storage = new MemoryStorage();
    pageLoad(storage).select('en');
    pageLoad(storage).select('cs');
    expect(pageLoad(storage).current()).toBe('cs');
  });

  it('zjištění jazyka nic neuloží', () => {
    const storage = new MemoryStorage();
    const choice = pageLoad(storage);
    choice.current();
    choice.current('en');
    expect(storage.writes).toEqual([]);
  });
});

describe('#70 AC3: výběr stejného jazyka nic nezmění', () => {
  it('výběr aktuálního jazyka vrátí, že se nic nezměnilo, a nic neuloží', () => {
    const storage = new MemoryStorage();
    const choice = pageLoad(storage);
    expect(choice.select('cs')).toBe(false);
    expect(choice.current()).toBe('cs');
    expect(storage.writes).toEqual([]);
  });

  it('po výběru „en“ jeho další výběr nic nezmění ani neuloží znovu', () => {
    const storage = new MemoryStorage();
    const choice = pageLoad(storage);
    choice.select('en');
    expect(choice.select('en')).toBe(false);
    expect(storage.writes).toHaveLength(1);
  });

  it('jazyk mimo seznam nejde vybrat, jazyk zůstane a nic se neuloží', () => {
    const storage = new MemoryStorage();
    const choice = pageLoad(storage);
    for (const requested of ['de', 'EN', 'en-GB', ' en ', '']) {
      expect(choice.select(requested), requested).toBe(false);
    }
    expect(choice.current()).toBe('cs');
    expect(storage.writes).toEqual([]);
  });
});

describe('#70 AC3: uložený neznámý nebo poškozený jazyk znamená češtinu', () => {
  const broken = ['de', 'EN', 'en-GB', ' en ', '', '{"language":"en"}', '"en"', 'null', '\u0000'];

  for (const stored of broken) {
    it(`uložené ${JSON.stringify(stored)} dá češtinu`, () => {
      const storage = new MemoryStorage();
      storage.data.set(LANGUAGE_STORAGE_KEY, stored);
      expect(pageLoad(storage).current()).toBe('cs');
    });
  }

  it('velmi dlouhá uložená hodnota dá češtinu a nespadne', () => {
    const storage = new MemoryStorage();
    storage.data.set(LANGUAGE_STORAGE_KEY, 'e'.repeat(100_000));
    expect(pageLoad(storage).current()).toBe('cs');
  });

  it('po poškozené hodnotě jde jazyk zase vybrat a uloží se správně', () => {
    const storage = new MemoryStorage();
    storage.data.set(LANGUAGE_STORAGE_KEY, '###');
    pageLoad(storage).select('en');
    expect(pageLoad(storage).current()).toBe('en');
  });
});

describe('#70 AC3: když úložiště nejde, volba platí aspoň do zavření stránky', () => {
  it('bez úložiště je jazyk čeština a výběr platí na této stránce', () => {
    const choice = pageLoad(undefined);
    expect(choice.current()).toBe('cs');
    expect(choice.select('en')).toBe(true);
    expect(choice.current()).toBe('en');
  });

  it('když úložiště nejde číst, je jazyk čeština a nic nespadne', () => {
    const storage = new MemoryStorage();
    storage.failReads = true;
    const choice = pageLoad(storage);
    expect(() => choice.current()).not.toThrow();
    expect(choice.current()).toBe('cs');
  });

  it('když se volba nedá uložit, platí dál na této stránce, po obnovení je čeština', () => {
    const storage = new MemoryStorage();
    storage.failWrites = true;
    const choice = pageLoad(storage);
    expect(() => choice.select('en')).not.toThrow();
    expect(choice.current()).toBe('en');
    expect(pageLoad(storage).current()).toBe('cs');
  });

  it('když úložiště nejde číst, výběr na této stránce přesto platí', () => {
    const storage = new MemoryStorage();
    storage.failReads = true;
    const choice = pageLoad(storage);
    choice.select('en');
    expect(choice.current()).toBe('en');
  });
});

describe('#70 AC3: s požadavkem platí jazyk podle požadavku jako dřív (#65)', () => {
  it('přesný kód ze seznamu platí, i když je zvolený jiný jazyk', () => {
    const choice = pageLoad(new MemoryStorage());
    choice.select('en');
    expect(choice.current('cs')).toBe('cs');
  });

  it('požadavek mimo seznam dá výchozí češtinu', () => {
    const choice = pageLoad(new MemoryStorage());
    choice.select('en');
    expect(choice.current('de')).toBe('cs');
    expect(choice.current(null)).toBe('cs');
  });
});

describe('#70 a #138: skutečný seznam jazyků hry', () => {
  it('v seznamu je čeština a angličtina', () => {
    expect(LANGUAGES).toEqual(['cs', 'en']);
  });

  it('jazyk zařízení je bez volby čeština a výběr češtiny nic nezmění', () => {
    expect(currentLanguage()).toBe('cs');
    expect(selectLanguage('cs')).toBe(false);
    expect(currentLanguage()).toBe('cs');
  });

  it('jazyk mimo seznam nejde vybrat ani na skutečné stránce', () => {
    expect(selectLanguage('xx')).toBe(false);
    expect(currentLanguage()).toBe('cs');
  });

  it('čeština se v nabídce jmenuje svým vlastním názvem „Čeština“', () => {
    expect(sharedTexts('cs').languageName).toBe('Čeština');
  });

  it('angličtina se v nabídce jmenuje svým vlastním názvem „English“', () => {
    expect(sharedTexts('en').languageName).toBe('English');
  });
});
