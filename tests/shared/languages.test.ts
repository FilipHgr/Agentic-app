/// <reference types="vite/client" />
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_LANGUAGE,
  LANGUAGES,
  chooseLanguage,
  currentLanguage,
} from '../../src/shared/texts/languages';
import { sharedTexts } from '../../src/shared/texts/sharedTexts';
import { dictionariesByLanguage, findTextProblems } from './textChecks';

/**
 * Testy k #65 AC3 (aktuální jazyk je zatím pevně čeština) a AC4 pro sdílené
 * texty (chybějící překlad zachytí test). Umělé jazyky jsou jen tady
 * v testu jako volné slovníky; do `src/` se žádný druhý jazyk nepřidává.
 */

/** Sdílené texty každého jazyka, který má soubor `src/shared/texts/<jazyk>.ts`. */
const SHARED_FILES = dictionariesByLanguage(
  import.meta.glob('../../src/shared/texts/*.ts', { eager: true }),
);

const SHARED_PART = 'sdílená část';

function checkShared(language: string, texts: Record<string, unknown>): string[] {
  return findTextProblems({
    language,
    part: SHARED_PART,
    reference: SHARED_FILES['cs'] ?? {},
    texts,
    mayBeEmptyList: (key) => key === 'oneLetterPrepositions',
  });
}

/** Úložiště v paměti místo `localStorage`, které si pamatuje každý zápis. */
function watchedLocalStorage(): { keys: () => string[] } {
  const data = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
    clear: () => data.clear(),
    key: (index: number) => [...data.keys()][index] ?? null,
    get length() {
      return data.size;
    },
  });
  return { keys: () => [...data.keys()] };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('#65 AC3: bez volby je jazyk čeština, platí jen přesný kód ze seznamu', () => {
  it('výchozí jazyk je čeština', () => {
    expect(DEFAULT_LANGUAGE).toBe('cs');
  });

  it('bez požadavku dostane hra češtinu', () => {
    expect(currentLanguage()).toBe('cs');
  });

  it('s požadavkem null dostane hra češtinu', () => {
    expect(currentLanguage(null)).toBe('cs');
  });

  it('s prázdným textem dostane hra češtinu', () => {
    expect(currentLanguage('')).toBe('cs');
  });

  it('s textem jen z mezer dostane hra češtinu', () => {
    expect(currentLanguage('   ')).toBe('cs');
  });

  it('s neznámým kódem „xx“ dostane hra češtinu a nespadne', () => {
    expect(() => currentLanguage('xx')).not.toThrow();
    expect(currentLanguage('xx')).toBe('cs');
  });

  // #138: angličtina je v seznamu jazyků, s požadavkem „en“ dostane hra angličtinu.
  it('s kódem „en“ dostane hra angličtinu (#138)', () => {
    expect(currentLanguage('en')).toBe('en');
  });

  it('s kódem „en-GB“ nebo „EN“ dostane hra výchozí češtinu (platí jen přesný kód)', () => {
    expect(currentLanguage('en-GB')).toBe('cs');
    expect(currentLanguage('EN')).toBe('cs');
  });

  it('s kódem velkými písmeny „CS“ dostane hra výchozí češtinu (platí jen přesný kód)', () => {
    expect(currentLanguage('CS')).toBe('cs');
  });

  it('s kódem i oblastí „cs-CZ“ dostane hra výchozí češtinu (platí jen přesný kód)', () => {
    expect(currentLanguage('cs-CZ')).toBe('cs');
  });

  it('s přesným kódem „cs“ dostane hra češtinu', () => {
    expect(currentLanguage('cs')).toBe('cs');
  });

  it('jazyk vždy patří do seznamu podporovaných jazyků', () => {
    for (const requested of [undefined, null, '', 'xx', 'en', 'CS', 'cs-CZ', 'cs']) {
      expect(LANGUAGES).toContain(currentLanguage(requested));
    }
  });
});

describe('#65 AC3: platí jen přesný kód ze seznamu (s umělým seznamem dvou jazyků)', () => {
  const supported = ['cs', 'en'];

  it('přesný kód jiného jazyka ze seznamu platí', () => {
    expect(chooseLanguage('en', supported, 'cs')).toBe('en');
  });

  it('kód velkými písmeny neplatí, hra dostane výchozí jazyk', () => {
    expect(chooseLanguage('EN', supported, 'cs')).toBe('cs');
  });

  it('kód s oblastí neplatí, hra dostane výchozí jazyk', () => {
    expect(chooseLanguage('en-GB', supported, 'cs')).toBe('cs');
  });

  it('kód s mezerami kolem neplatí, hra dostane výchozí jazyk', () => {
    expect(chooseLanguage(' en ', supported, 'cs')).toBe('cs');
  });

  it('kód mimo seznam neplatí, hra dostane výchozí jazyk', () => {
    expect(chooseLanguage('de', supported, 'cs')).toBe('cs');
  });

  it('bez požadavku hra dostane výchozí jazyk', () => {
    expect(chooseLanguage(undefined, supported, 'cs')).toBe('cs');
    expect(chooseLanguage(null, supported, 'cs')).toBe('cs');
    expect(chooseLanguage('', supported, 'cs')).toBe('cs');
  });
});

// #70: jazyk jde zvolit v menu a ukládá se, ale jen při výběru (testy
// v languageChoice.test.ts). Pouhé zjištění jazyka nic neuloží.
describe('#65 AC3 a #70: zjištění jazyka nic neuloží', () => {
  it('zjištění jazyka ani načtení textů nepřidá do localStorage žádný klíč', () => {
    const storage = watchedLocalStorage();
    for (const requested of [undefined, null, '', 'xx', 'en', 'CS', 'cs-CZ', 'cs']) {
      sharedTexts(currentLanguage(requested));
    }
    expect(storage.keys()).toEqual([]);
  });

  it('uložený jazyk mimo seznam nic nezmění, jazyk zůstane čeština', async () => {
    watchedLocalStorage();
    localStorage.setItem('language', 'de');
    localStorage.setItem('agentic-app.language', 'de');
    // Čerstvý modul, aby se uložená hodnota opravdu přečetla (jazyk se pamatuje).
    vi.resetModules();
    const fresh = await import('../../src/shared/texts/languages');
    expect(fresh.currentLanguage()).toBe('cs');
  });
});

describe('#65 AC1: sdílené české texty', () => {
  // #67 AC2: název stránky v menu je „Matematika“ (dřív „Počítání do 10“).
  it('název stránky je „Matematika“', () => {
    expect(sharedTexts('cs').pageTitle).toBe('Matematika');
  });

  it('popis kolečka pro čtečku obrazovky je „Nastavení pro rodiče“', () => {
    expect(sharedTexts('cs').settingsButtonLabel).toBe('Nastavení pro rodiče');
  });

  it('jednopísmenné předložky k, s, v, z, o, u jsou pravidlo češtiny ve sdílených textech', () => {
    expect([...sharedTexts('cs').oneLetterPrepositions].sort()).toEqual([
      'k',
      'o',
      's',
      'u',
      'v',
      'z',
    ]);
  });

  it('bez zadaného jazyka jsou sdílené texty v aktuálním jazyce, tedy česky', () => {
    expect(sharedTexts()).toEqual(sharedTexts('cs'));
  });

  it('soubor src/shared/texts/cs.ts obsahuje stejné texty, jaké hra dostane', () => {
    expect(SHARED_FILES['cs']).toEqual({ ...sharedTexts('cs') });
  });
});

describe('#65 AC4: každý jazyk se souborem má všechny sdílené texty', () => {
  it('soubor sdílených textů existuje aspoň pro češtinu', () => {
    expect(Object.keys(SHARED_FILES)).toContain('cs');
  });

  it('každý jazyk ze seznamu má soubor sdílených textů', () => {
    for (const language of LANGUAGES) {
      expect(SHARED_FILES[language], language).toBeDefined();
    }
  });

  for (const language of Object.keys(SHARED_FILES)) {
    it(`jazyk ${language}: sdílené texty mají stejné klíče jako čeština a žádný není prázdný`, () => {
      expect(checkShared(language, SHARED_FILES[language] ?? {})).toEqual([]);
    });
  }
});

describe('#65 AC4: kontrola sdílených textů opravdu najde chybu (umělé jazyky jen v testu)', () => {
  const complete = {
    pageTitle: 'Counting to 10',
    settingsButtonLabel: 'Settings for parents',
    languageName: 'English',
    oneLetterPrepositions: [],
  };

  it('úplný umělý jazyk s prázdným seznamem předložek projde', () => {
    expect(checkShared('en', complete)).toEqual([]);
  });

  it('chybějící klíč najde a napíše jazyk, část a klíč', () => {
    const problems = checkShared('en', {
      pageTitle: complete.pageTitle,
      languageName: complete.languageName,
      oneLetterPrepositions: complete.oneLetterPrepositions,
    });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('en');
    expect(problems[0]).toContain(SHARED_PART);
    expect(problems[0]).toContain('settingsButtonLabel');
  });

  it('chybějící název stránky najde u jakéhokoli jazyka, i mimo seznam', () => {
    const withoutTitle = {
      settingsButtonLabel: complete.settingsButtonLabel,
      languageName: complete.languageName,
      oneLetterPrepositions: complete.oneLetterPrepositions,
    };
    const problems = checkShared('xx', withoutTitle);
    expect(problems.join('\n')).toContain('pageTitle');
    expect(problems.join('\n')).toContain('xx');
  });

  it('klíč navíc najde a napíše jazyk, část a klíč', () => {
    const problems = checkShared('en', { ...complete, menuTitle: 'Menu' });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('en');
    expect(problems[0]).toContain(SHARED_PART);
    expect(problems[0]).toContain('menuTitle');
  });

  it('prázdný text najde', () => {
    const problems = checkShared('en', { ...complete, pageTitle: '' });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('pageTitle');
  });

  it('text jen z mezer najde jako prázdný', () => {
    const problems = checkShared('en', { ...complete, settingsButtonLabel: '   ' });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('settingsButtonLabel');
  });

  it('prázdná předložka v seznamu je chyba, prázdný seznam ne', () => {
    expect(checkShared('en', { ...complete, oneLetterPrepositions: [' '] })).toHaveLength(1);
  });
});
