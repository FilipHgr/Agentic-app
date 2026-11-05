/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest';

import { gameAreaFor } from '../../../src/shared/logic/viewportLayout';
import type { LayoutMode } from '../../../src/shared/logic/viewportLayout';
import {
  layoutDeviceGuideStep,
  layoutDeviceSettingsPanel,
} from '../../../src/games/counting/logic/deviceLayout';
import { GUIDE_SCRIPT } from '../../../src/games/counting/logic/guideScript';
import type { GuideLineId } from '../../../src/games/counting/logic/guideScript';
import { wrapGuideMessage } from '../../../src/games/counting/logic/phoneGuideLayout';
import type { SettingsRowKind } from '../../../src/games/counting/logic/settingsLayout';
import type { GuideStep } from '../../../src/games/counting/logic/setupGuide';
import { panelCssPlacement } from './parentPanelSnapshot';
import { dictionariesByLanguage } from '../../shared/textChecks';
import {
  IPAD_WINDOWS,
  JUST_ABOVE_LIMIT,
  NO_NOTCH,
  PHONE_PORTRAIT_EDGE_WINDOWS,
  PHONE_PORTRAIT_WINDOWS,
  PHONE_WINDOWS,
  viewportOf,
} from '../../shared/viewportFixtures';
import type { TestWindow } from '../../shared/viewportFixtures';

/**
 * Testy k #65 AC5: texty každého jazyka, který má soubor textů, se vejdou
 * do rozložení nastavení a průvodce. Šířka textu se odhaduje stejně jako
 * v testech #59 a #60: počet znaků × 0,6 × velikost písma. Rozměry pruhů
 * se berou ze skutečného rozložení v každém zkušebním okně, takže čeština
 * prochází přesně s dnešními rozměry a polohami.
 *
 * - Popisek řady se vejde do svého pruhu.
 * - Tlačítko průvodce: odhad + 2 × 8 px okraje ≤ šířka tlačítka.
 * - Rada na iPadu: každý z obou řádků se vejde do pásu rady.
 * - Rada na telefonu: po zalomení podle předložek jazyka nejvýš 4 řádky,
 *   žádný řádek delší, než se vejde.
 *
 * Na iPadu a ve zmenšených oknech se měří v jednotkách panelu 1024 × 768
 * (jako v zadání: 740 px, 240 px, 976 px), na telefonu v CSS px.
 */

const CHARACTER_WIDTH_RATIO = 0.6;
const BUTTON_PADDING = 8;
const PHONE_MESSAGE_MAX_LINES = 4;
/** Plovoucí čárka: 9 × 0,6 × 16 = 86,4 nesmí vyjít o kousek víc. */
const ROUNDING = 1e-6;

/** Zmenšená okna z testů #59 a #60, kde zůstává rozložení iPadu. */
const SCALED_WINDOWS: readonly TestWindow[] = [
  { name: 'iPad na výšku 820×1180', width: 820, height: 1180, safeArea: NO_NOTCH },
  { name: '500×932 zmenšené (hranice)', width: 500, height: 932, safeArea: NO_NOTCH },
  { name: '360×619 zmenšené (hranice)', width: 360, height: 619, safeArea: NO_NOTCH },
  { name: 'zmenšené 667×320', width: 667, height: 320, safeArea: NO_NOTCH },
  { name: 'zmenšené 375×553', width: 375, height: 553, safeArea: NO_NOTCH },
];

/** Všechna okna z dnešních testů rozložení (#54, #56, #59, #60). */
const ALL_WINDOWS: readonly TestWindow[] = [
  ...IPAD_WINDOWS,
  JUST_ABOVE_LIMIT,
  ...SCALED_WINDOWS,
  ...PHONE_WINDOWS,
  ...PHONE_PORTRAIT_WINDOWS,
  ...PHONE_PORTRAIT_EDGE_WINDOWS,
];

const STEPS: readonly GuideStep[] = [1, 2, 3, 4];

/** Texty jazyka, které se kreslí do rozložení; volné, aby šly umělé jazyky. */
interface LayoutTexts {
  readonly rowLabels: Readonly<Record<SettingsRowKind, string>>;
  readonly guideButtons: {
    readonly back: string;
    readonly next: string;
    readonly startPlaying: string;
  };
  readonly guideLines: Readonly<Record<GuideLineId, readonly string[]>>;
  /** Jednopísmenné předložky jazyka ze sdílených textů. */
  readonly oneLetterPrepositions: readonly string[];
}

const COUNTING_FILES = dictionariesByLanguage(
  import.meta.glob('../../../src/games/counting/texts/*.ts', { eager: true }),
);
const SHARED_FILES = dictionariesByLanguage(
  import.meta.glob('../../../src/shared/texts/*.ts', { eager: true }),
);

/** Texty jazyka ze souborů; chybějící části (AC4) se tu berou jako prázdné. */
function layoutTextsOf(language: string): LayoutTexts {
  const counting = (COUNTING_FILES[language] ?? {}) as Partial<LayoutTexts>;
  const shared = (SHARED_FILES[language] ?? {}) as Partial<LayoutTexts>;
  return {
    rowLabels: counting.rowLabels ?? { maxNumber: '', operations: '', answerInput: '' },
    guideButtons: counting.guideButtons ?? { back: '', next: '', startPlaying: '' },
    guideLines: counting.guideLines ?? {
      maxNumber: [],
      operations: [],
      answerInput: [],
      summary: [],
    },
    oneLetterPrepositions: shared.oneLetterPrepositions ?? [],
  };
}

function estimatedWidth(text: string, fontSize: number): number {
  return text.length * CHARACTER_WIDTH_RATIO * fontSize;
}

function px(value: number): string {
  return `${Math.round(value * 10) / 10} px`;
}

function isPhone(mode: LayoutMode): boolean {
  return mode === 'phoneLandscape' || mode === 'phonePortrait';
}

interface TextSlot {
  readonly what: string;
  readonly text: string;
  readonly width: number;
  readonly fontSize: number;
  readonly padding: number;
}

function overflow(slot: TextSlot): number {
  return estimatedWidth(slot.text, slot.fontSize) + 2 * slot.padding - slot.width;
}

function lineOfStep(step: GuideStep): GuideLineId {
  return GUIDE_SCRIPT.find((line) => line.step === step)?.id ?? 'summary';
}

/**
 * Všechna přetečení textů jazyka v jednom okně. Zpráva obsahuje jazyk,
 * rozložení (okno a druh), text a o kolik px přetéká.
 */
function overflowsIn(language: string, texts: LayoutTexts, window: TestWindow): string[] {
  const area = gameAreaFor(viewportOf(window));
  const settings = layoutDeviceSettingsPanel(area);
  const mode = settings.mode;
  const phone = isPhone(mode);
  /** Na telefonu CSS px, jinde jednotky panelu 1024 × 768. */
  const scale = phone ? panelCssPlacement(area, settings.placement).scale : 1;
  const where = `jazyk ${language}, rozložení ${window.name} (${mode})`;
  const problems: string[] = [];
  const slots: TextSlot[] = [];

  const addLabels = (rows: typeof settings.rows, panel: string): void => {
    for (const row of rows) {
      slots.push({
        what: `${panel}: popisek řady ${row.kind}`,
        text: texts.rowLabels[row.kind] ?? '',
        width: row.label.width * scale,
        fontSize: row.label.fontSize * scale,
        padding: 0,
      });
    }
  };
  addLabels(settings.rows, 'nastavení');

  for (const step of STEPS) {
    const guide = layoutDeviceGuideStep(area, step);
    const guideScale = phone ? panelCssPlacement(area, guide.placement).scale : 1;
    addLabels(guide.rows, `průvodce, krok ${step}`);

    if (guide.back !== null) {
      slots.push({
        what: `průvodce, krok ${step}: tlačítko Zpět`,
        text: texts.guideButtons.back,
        width: guide.back.width * guideScale,
        fontSize: guide.back.fontSize * guideScale,
        padding: BUTTON_PADDING,
      });
    }
    const rightKey = step === 4 ? 'startPlaying' : 'next';
    slots.push({
      what: `průvodce, krok ${step}: tlačítko ${rightKey}`,
      text: texts.guideButtons[rightKey],
      width: guide.right.width * guideScale,
      fontSize: guide.right.fontSize * guideScale,
      padding: BUTTON_PADDING,
    });

    const lines = texts.guideLines[lineOfStep(step)] ?? [];
    const messageWidth = guide.message.width * guideScale;
    const messageFont = guide.message.fontSize * guideScale;
    if (phone) {
      const wrapped = wrapGuideMessage(lines, messageWidth, texts.oneLetterPrepositions);
      if (wrapped.length > PHONE_MESSAGE_MAX_LINES) {
        problems.push(
          `${where}, průvodce, krok ${step}: rada „${lines.join(' ')}“ má ${wrapped.length} řádků, nejvýš ${PHONE_MESSAGE_MAX_LINES}`,
        );
      }
      wrapped.forEach((line, index) => {
        slots.push({
          what: `průvodce, krok ${step}: ${index + 1}. řádek rady`,
          text: line,
          width: messageWidth,
          fontSize: messageFont,
          padding: 0,
        });
      });
    } else {
      lines.forEach((line, index) => {
        slots.push({
          what: `průvodce, krok ${step}: ${index + 1}. řádek rady`,
          text: line,
          width: messageWidth,
          fontSize: messageFont,
          padding: 0,
        });
      });
    }
  }

  for (const slot of slots) {
    const by = overflow(slot);
    if (by > ROUNDING) {
      problems.push(`${where}, ${slot.what}: „${slot.text}“ přetéká o ${px(by)}`);
    }
  }
  return problems;
}

function overflowsEverywhere(language: string, texts: LayoutTexts): string[] {
  return ALL_WINDOWS.flatMap((window) => overflowsIn(language, texts, window));
}

/** Okno podle jména ze seznamu. */
function windowNamed(fragment: string): TestWindow {
  const found = ALL_WINDOWS.find((window) => window.name.includes(fragment));
  if (found === undefined) {
    throw new Error(`okno ${fragment} v seznamu není`);
  }
  return found;
}

describe('#65 AC5: texty každého jazyka se vejdou do rozložení', () => {
  it('kontrola má co měřit: Počítání má aspoň soubor českých textů', () => {
    expect(Object.keys(COUNTING_FILES)).toContain('cs');
  });

  it('zkušební okna pokrývají iPad, zmenšené okno, telefon na šířku i na výšku', () => {
    const modes = new Set(
      ALL_WINDOWS.map((window) => gameAreaFor(viewportOf(window)).mode as LayoutMode),
    );
    expect([...modes].sort()).toEqual(['phoneLandscape', 'phonePortrait', 'scaled', 'tablet']);
  });

  for (const language of Object.keys(COUNTING_FILES)) {
    it(`jazyk ${language}: popisky řad, tlačítka i rada průvodce se vejdou ve všech oknech`, () => {
      expect(overflowsEverywhere(language, layoutTextsOf(language))).toEqual([]);
    });
  }
});

describe('#65 AC5: rozměry pruhů, do kterých se texty měří (čeština beze změny)', () => {
  const ipad = windowNamed('iPad 1180×820');
  const landscape = windowNamed('844×340');
  const portrait = windowNamed('390×844');

  it('na iPadu mají popisky řad pruhy 740, 740 a 480 px při písmu 28 px', () => {
    const settings = layoutDeviceSettingsPanel(gameAreaFor(viewportOf(ipad)));
    expect(settings.rows.map((row) => row.label.width)).toEqual([740, 740, 480]);
    expect(settings.rows.map((row) => row.label.fontSize)).toEqual([28, 28, 28]);
  });

  it('na iPadu mají tlačítka průvodce 240 px při písmu 32 px a rada pás 976 px při 28 px', () => {
    const guide = layoutDeviceGuideStep(gameAreaFor(viewportOf(ipad)), 2);
    expect([guide.back?.width, guide.right.width]).toEqual([240, 240]);
    expect([guide.back?.fontSize, guide.right.fontSize]).toEqual([32, 32]);
    expect(guide.message.width).toBe(976);
    expect(guide.message.fontSize).toBe(28);
  });

  it('na telefonu na šířku je pruh popisku 88 px při 16 px, „Do kolika“ (9 znaků) se vejde právě tak', () => {
    const area = gameAreaFor(viewportOf(landscape));
    const settings = layoutDeviceSettingsPanel(area);
    const scale = panelCssPlacement(area, settings.placement).scale;
    for (const row of settings.rows) {
      expect(row.label.width * scale).toBeCloseTo(88, 1);
      expect(row.label.fontSize * scale).toBeCloseTo(16, 1);
    }
    expect(estimatedWidth('Do kolika', 16)).toBeLessThanOrEqual(88);
    expect(estimatedWidth('Do kolika!', 16)).toBeGreaterThan(88);
  });

  it('na telefonu má Zpět 80 px a Další i Začít hrát 128 px při písmu 18 px', () => {
    for (const window of [landscape, portrait]) {
      const area = gameAreaFor(viewportOf(window));
      const guide = layoutDeviceGuideStep(area, 2);
      const scale = panelCssPlacement(area, guide.placement).scale;
      expect((guide.back?.width ?? 0) * scale).toBeCloseTo(80, 1);
      expect(guide.right.width * scale).toBeCloseTo(128, 1);
      expect(guide.right.fontSize * scale).toBeCloseTo(18, 1);
    }
  });
});

describe('#65 AC5: kontrola přetečení opravdu zachytí dlouhý překlad (umělý jazyk jen v testu)', () => {
  const czech = layoutTextsOf('cs');

  function longLanguage(change: Partial<LayoutTexts>): LayoutTexts {
    return { ...czech, ...change };
  }

  it('dlouhý popisek řady zachytí na telefonu na šířku a zpráva ukáže jazyk, rozložení, text a px', () => {
    const texts = longLanguage({
      rowLabels: { ...czech.rowLabels, maxNumber: 'Bis zu welcher Zahl' },
    });
    const problems = overflowsIn('xx', texts, windowNamed('844×340'));
    const problem = problems.find((line) => line.includes('Bis zu welcher Zahl'));
    expect(problem).toBeDefined();
    expect(problem).toContain('xx');
    expect(problem).toContain('844×340');
    expect(problem).toContain('phoneLandscape');
    // 19 × 0,6 × 16 = 182,4 px v pruhu 88 px: přetéká asi o 94,4 px.
    const by = Number(/přetéká o ([\d.]+) px/.exec(problem ?? '')?.[1]);
    expect(by).toBeCloseTo(94.4, 0);
  });

  it('popisek o znak delší než „Do kolika“ na telefonu na šířku už nepřejde', () => {
    const texts = longLanguage({ rowLabels: { ...czech.rowLabels, operations: 'Příkladyyy' } });
    expect(overflowsIn('xx', texts, windowNamed('844×340')).join('\n')).toContain('Příkladyyy');
  });

  it('dlouhé tlačítko zachytí na telefonu: okraje 2 × 8 px se počítají', () => {
    // „Zpátky!“ má 7 znaků: 7 × 10,8 + 16 = 91,6 px > 80 px.
    const texts = longLanguage({ guideButtons: { ...czech.guideButtons, back: 'Zpátky!' } });
    const problems = overflowsIn('xx', texts, windowNamed('390×844'));
    expect(problems.join('\n')).toContain('Zpátky!');
    expect(problems.join('\n')).toContain('phonePortrait');
  });

  it('tlačítko, které se vejde jen bez okrajů, zachytí', () => {
    // 6 znaků: 6 × 10,8 = 64,8 px se do 80 px vejde, s okraji 80,8 px ne.
    const texts = longLanguage({ guideButtons: { ...czech.guideButtons, back: 'Zpět12' } });
    expect(overflowsIn('xx', texts, windowNamed('390×844')).join('\n')).toContain('Zpět12');
  });

  it('dlouhé tlačítko „Začít hrát“ zachytí i na iPadu', () => {
    const texts = longLanguage({
      guideButtons: { ...czech.guideButtons, startPlaying: 'Jetzt fängt das Spiel an' },
    });
    const problems = overflowsIn('xx', texts, windowNamed('iPad 1180×820'));
    expect(problems.join('\n')).toContain('Jetzt fängt das Spiel an');
    expect(problems.join('\n')).toContain('tablet');
  });

  it('řádek rady delší než 58 znaků zachytí na iPadu', () => {
    const long = 'A'.repeat(59);
    const texts = longLanguage({
      guideLines: { ...czech.guideLines, operations: [long, 'Krátký řádek.'] },
    });
    const problems = overflowsIn('xx', texts, windowNamed('iPad 1180×820'));
    expect(problems.some((line) => line.includes(long))).toBe(true);
  });

  it('řádek rady s právě 58 znaky na iPadu projde', () => {
    const texts = longLanguage({
      guideLines: { ...czech.guideLines, operations: ['A'.repeat(58), 'Krátký řádek.'] },
    });
    expect(overflowsIn('xx', texts, windowNamed('iPad 1180×820'))).toEqual([]);
  });

  it('rada, která se na telefonu zalomí na víc než 4 řádky, se zachytí', () => {
    const sentence = 'Slovo '.repeat(30).trim();
    const texts = longLanguage({
      guideLines: { ...czech.guideLines, summary: [sentence, sentence] },
    });
    const problems = overflowsIn('xx', texts, windowNamed('390×844'));
    expect(problems.some((line) => line.includes('řádků'))).toBe(true);
  });

  it('slovo delší než pruh rady se na telefonu zachytí jako přetečení řádku', () => {
    const word = 'Nejnejnejnejnejnejnejnejnejnejnejdelší';
    const texts = longLanguage({
      guideLines: { ...czech.guideLines, maxNumber: [word, 'Krátce.'] },
    });
    const problems = overflowsIn('xx', texts, windowNamed('360×620'));
    expect(problems.some((line) => line.includes(word) && line.includes('přetéká o'))).toBe(true);
  });

  it('zalomení na telefonu bere předložky umělého jazyka, ne češtiny', () => {
    // Jazyk bez předložek smí nechat „s“ na konci řádku, a tak se vejde jinak než čeština.
    const sentence = 'Vyberte číselník nebo tužku s velkým písmem pro dítě.';
    const withRule = wrapGuideMessage([sentence], 153.6, ['s']);
    const withoutRule = wrapGuideMessage([sentence], 153.6, []);
    expect(withRule).not.toEqual(withoutRule);
  });
});
