/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest';

import { LANGUAGES } from '../../../src/shared/texts/languages';
import { countingTexts } from '../../../src/games/counting/texts/countingTexts';
import { GUIDE_SCRIPT, voiceSentences } from '../../../src/games/counting/logic/guideScript';
import { layoutSettingsPanel } from '../../../src/games/counting/logic/settingsLayout';
import { stepMessage } from '../../../src/games/counting/logic/setupGuide';
import { wrapGuideMessage } from '../../../src/games/counting/logic/phoneGuideLayout';
import type { GuideStep } from '../../../src/games/counting/logic/setupGuide';
import { dictionariesByLanguage, findTextProblems, leavesOf } from '../../shared/textChecks';

/**
 * Testy k #65 pro texty Počítání: AC1 (texty hry jsou ve vlastní složce
 * `src/games/counting/texts/`, jeden soubor na jazyk, obrazovka i nahrávky
 * berou věty ze stejného místa), AC2 (název hry `title`) a AC4 (chybějící
 * překlad zachytí test). Umělé jazyky jsou jen tady jako volné slovníky.
 */

/** Texty Počítání každého jazyka, který má soubor `src/games/counting/texts/<jazyk>.ts`. */
const COUNTING_FILES = dictionariesByLanguage(
  import.meta.glob('../../../src/games/counting/texts/*.ts', { eager: true }),
);

const GAME_PART = 'Počítání';

function checkCounting(language: string, texts: Record<string, unknown>): string[] {
  return findTextProblems({
    language,
    part: GAME_PART,
    reference: COUNTING_FILES['cs'] ?? {},
    texts,
    isTwoLineKey: (key) => key.startsWith('guideLines.'),
  });
}

const STEPS: readonly GuideStep[] = [1, 2, 3, 4];

describe('#65 AC1: české texty Počítání', () => {
  const texts = countingTexts('cs');

  it('popisky řad jsou „Do kolika“, „Příklady“ a „Odpověď“', () => {
    expect(texts.rowLabels).toEqual({
      maxNumber: 'Do kolika',
      operations: 'Příklady',
      answerInput: 'Odpověď',
    });
  });

  it('tlačítka průvodce jsou „Zpět“, „Další“ a „Začít hrát“', () => {
    expect(texts.guideButtons).toEqual({
      back: 'Zpět',
      next: 'Další',
      startPlaying: 'Začít hrát',
    });
  });

  it('průvodce má čtyři věty, každou jako dva řádky (#50)', () => {
    expect(Object.keys(texts.guideLines).sort()).toEqual(
      ['answerInput', 'maxNumber', 'operations', 'summary'].sort(),
    );
    for (const lines of Object.values(texts.guideLines)) {
      expect(lines).toHaveLength(2);
    }
  });

  it('věty průvodce jsou beze změny ty ze scénáře #50', () => {
    expect(texts.guideLines.maxNumber).toEqual([
      'Největší číslo, které se v příkladech objeví.',
      'Začněte menším číslem a přidávejte, až to dítě zvládá.',
    ]);
    expect(texts.guideLines.operations).toEqual([
      'Sčítání, odčítání, nebo obojí zamíchané.',
      'Začněte sčítáním. Obojí, až dítě zvládne odčítat.',
    ]);
    expect(texts.guideLines.answerInput).toEqual([
      'S číselníkem dítě ťuká na čísla, s tužkou píše prstem.',
      'Tužku zvolte, až dítě umí psát všechny číslice.',
    ]);
    expect(texts.guideLines.summary).toEqual([
      'Hotovo. Volby můžete ještě změnit ťuknutím.',
      'Později je změníte podržením kolečka vpravo nahoře.',
    ]);
  });

  it('bez zadaného jazyka jsou texty v aktuálním jazyce, tedy česky', () => {
    expect(countingTexts()).toEqual(countingTexts('cs'));
  });

  it('soubor src/games/counting/texts/cs.ts obsahuje stejné texty, jaké hra dostane', () => {
    expect(COUNTING_FILES['cs']).toEqual(JSON.parse(JSON.stringify(texts)));
  });
});

describe('#65 AC1: obrazovka i nahrávky berou texty ze stejného místa', () => {
  const texts = countingTexts('cs');

  it('popisky řad nastavení na obrazovce jsou z textů Počítání', () => {
    const layout = layoutSettingsPanel(1024, 768);
    for (const row of layout.rows) {
      expect(row.label.text).toBe(texts.rowLabels[row.kind]);
    }
  });

  for (const step of STEPS) {
    it(`věta na kroku ${step} průvodce je z textů Počítání`, () => {
      const line = GUIDE_SCRIPT.find((candidate) => candidate.step === step);
      expect(line).toBeDefined();
      if (line === undefined) {
        return;
      }
      expect(stepMessage(step)).toEqual(texts.guideLines[line.id]);
    });
  }

  it('skript na nahrávky dostane oba řádky každé věty z textů Počítání za sebou', () => {
    for (const sentence of voiceSentences()) {
      const lines = texts.guideLines[sentence.id];
      expect(sentence.text).toBe(`${lines[0]} ${lines[1]}`);
    }
  });

  it('scénář průvodce má přesně věty z textů Počítání, nic navíc', () => {
    expect(GUIDE_SCRIPT.map((line) => line.id).sort()).toEqual(
      Object.keys(texts.guideLines).sort(),
    );
    for (const line of GUIDE_SCRIPT) {
      expect(line.lines).toEqual(texts.guideLines[line.id]);
    }
  });
});

describe('#65 AC1: pravidlo předložek patří jazyku, ne hře', () => {
  it('s českým pravidlem zůstane „s“ na řádku se slovem za ním', () => {
    // 16 znaků na řádek (153,6 px): „Volba s tužkou“ by se bez pravidla zalomilo za „s“.
    const lines = wrapGuideMessage(['Tady je volba s tužkou.'], 153.6, ['s']);
    expect(lines.some((line) => line.endsWith(' s'))).toBe(false);
  });

  it('jazyk bez jednopísmenných předložek zalomí řádek kdekoli mezi slovy', () => {
    const lines = wrapGuideMessage(['Tady je volba s tužkou.'], 153.6, []);
    expect(lines).toEqual(['Tady je volba s', 'tužkou.']);
  });

  it('bez zadaného pravidla se použijí předložky aktuálního jazyka (češtiny)', () => {
    expect(wrapGuideMessage(['Tady je volba s tužkou.'], 153.6)).toEqual(
      wrapGuideMessage(['Tady je volba s tužkou.'], 153.6, ['k', 's', 'v', 'z', 'o', 'u']),
    );
  });
});

describe('#65 AC1: symboly nejsou texty jazyka a zůstávají v kódu', () => {
  const symbols = ['0', '1', '2', '3', '4', '5', '+', '−', '123', '✓', '?', '1 / 4'];

  for (const language of Object.keys(COUNTING_FILES)) {
    it(`jazyk ${language}: v textech Počítání nejsou číslice, +, −, „123“, ✓, otazník ani „1 / 4“`, () => {
      const values = [...leavesOf(COUNTING_FILES[language] ?? {}).values()].flat();
      for (const symbol of symbols) {
        expect(values, symbol).not.toContain(symbol);
      }
    });
  }
});

describe('#65 AC2: název hry pro menu', () => {
  it('hra Počítání má název v každém jazyce', () => {
    const languages = new Set([...LANGUAGES, ...Object.keys(COUNTING_FILES)]);
    for (const language of languages) {
      const title = COUNTING_FILES[language]?.['title'];
      expect(typeof title, language).toBe('string');
      expect(String(title).trim(), language).not.toBe('');
    }
  });

  it('česky se hra jmenuje „Počítání“', () => {
    expect(countingTexts('cs').title).toBe('Počítání');
  });
});

describe('#65 AC4: každý jazyk se souborem má všechny texty Počítání', () => {
  it('soubor textů Počítání existuje aspoň pro češtinu', () => {
    expect(Object.keys(COUNTING_FILES)).toContain('cs');
  });

  it('každý jazyk ze seznamu má soubor textů Počítání', () => {
    for (const language of LANGUAGES) {
      expect(COUNTING_FILES[language], language).toBeDefined();
    }
  });

  for (const language of Object.keys(COUNTING_FILES)) {
    it(`jazyk ${language}: texty Počítání mají stejné klíče jako čeština, žádný není prázdný a věty mají dva řádky`, () => {
      expect(checkCounting(language, COUNTING_FILES[language] ?? {})).toEqual([]);
    });
  }
});

describe('#65 AC4: kontrola textů Počítání opravdu najde chybu (umělé jazyky jen v testu)', () => {
  /** Úplný umělý jazyk: stejné klíče jako čeština, jiné texty. */
  function completeLanguage(): Record<string, unknown> {
    return {
      title: 'Counting',
      rowLabels: { maxNumber: 'Up to', operations: 'Problems', answerInput: 'Answer' },
      guideButtons: { back: 'Back', next: 'Next', startPlaying: 'Play' },
      guideLines: {
        maxNumber: ['Largest number.', 'Start small.'],
        operations: ['Adding or taking away.', 'Start with adding.'],
        answerInput: ['Keypad or pencil.', 'Pencil once they can write.'],
        summary: ['Done.', 'Hold the gear to change it later.'],
      },
    };
  }

  function expectReport(problems: string[], language: string, key: string): void {
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain(language);
    expect(problems[0]).toContain(GAME_PART);
    expect(problems[0]).toContain(key);
  }

  it('úplný umělý jazyk projde', () => {
    expect(checkCounting('en', completeLanguage())).toEqual([]);
  });

  it('chybějící název hry najde a napíše jazyk, část a klíč', () => {
    const texts = completeLanguage();
    delete texts['title'];
    expectReport(checkCounting('en', texts), 'en', 'title');
  });

  it('chybějící popisek řady najde i ve vnořeném klíči', () => {
    const texts = completeLanguage();
    texts['rowLabels'] = { maxNumber: 'Up to', operations: 'Problems' };
    expectReport(checkCounting('xx', texts), 'xx', 'rowLabels.answerInput');
  });

  it('klíč navíc najde a napíše jazyk, část a klíč', () => {
    const texts = { ...completeLanguage(), subtitle: 'Fun with numbers' };
    expectReport(checkCounting('en', texts), 'en', 'subtitle');
  });

  it('prázdný text tlačítka najde', () => {
    const texts = completeLanguage();
    texts['guideButtons'] = { back: 'Back', next: '', startPlaying: 'Play' };
    expectReport(checkCounting('en', texts), 'en', 'guideButtons.next');
  });

  it('text jen z mezer najde jako prázdný', () => {
    const texts = { ...completeLanguage(), title: '  ' };
    expectReport(checkCounting('en', texts), 'en', 'title');
  });

  it('větu průvodce s jedním řádkem najde', () => {
    const texts = completeLanguage();
    texts['guideLines'] = {
      ...(texts['guideLines'] as Record<string, unknown>),
      summary: ['Done.'],
    };
    expectReport(checkCounting('en', texts), 'en', 'guideLines.summary');
  });

  it('větu průvodce s prázdným druhým řádkem najde', () => {
    const texts = completeLanguage();
    texts['guideLines'] = {
      ...(texts['guideLines'] as Record<string, unknown>),
      operations: ['Adding or taking away.', ' '],
    };
    expectReport(checkCounting('en', texts), 'en', 'guideLines.operations');
  });

  it('větu průvodce se třemi řádky najde', () => {
    const texts = completeLanguage();
    texts['guideLines'] = {
      ...(texts['guideLines'] as Record<string, unknown>),
      maxNumber: ['One.', 'Two.', 'Three.'],
    };
    expectReport(checkCounting('en', texts), 'en', 'guideLines.maxNumber');
  });
});
