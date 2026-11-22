import { describe, expect, it } from 'vitest';

import { GAMES } from '../../src/gameList';
import { menuText, overviewTexts } from '../../src/menu/logic/menuTexts';
import type { MenuBox } from '../../src/menu/logic/menuLayout';
import {
  estimatedTextWidth,
  overviewBars,
  overviewLayoutFor,
} from '../../src/menu/logic/overviewLayout';
import { OVERVIEW_STYLE } from '../../src/menu/logic/menuTheme';
import { PAGE_BACKGROUND, contrastRatio } from '../../src/shared/logic/theme';
import type { OverviewScreenLayout, OverviewText } from '../../src/menu/logic/overviewLayout';
import {
  afterMistakeLegend,
  mistakeSectionSizes,
  mistakeSections,
  weekLines,
} from '../../src/menu/logic/overviewLines';
import { overviewGames } from '../../src/menu/logic/parentOverview';
import type { OverviewGame } from '../../src/menu/logic/parentOverview';
import {
  EMPTY_MISTAKES,
  MAX_MISTAKES_PER_PROBLEM,
  mistakeOverview,
  recordHintUsed,
  recordMistake,
  recordSolvedOperation,
} from '../../src/shared/logic/mistakeActivity';
import type { MistakeOverview, MistakeRecord } from '../../src/shared/logic/mistakeActivity';
import {
  comparisonKey,
  equationKey,
  missingSignKey,
} from '../../src/shared/logic/overviewProblems';
import type { GameOverviewSpec } from '../../src/shared/logic/overviewProblems';
import {
  EMPTY_ACTIVITY,
  MAX_SOLVED_PER_DAY,
  dayKeyOf,
  weekOverview,
} from '../../src/shared/logic/weekActivity';
import type { ActivityRecord, WeekOverview } from '../../src/shared/logic/weekActivity';
import { LANGUAGES } from '../../src/shared/texts/languages';
import type { Language } from '../../src/shared/texts/languages';
import type { LayoutItem, LayoutScene, LayoutText } from '../shared/layoutRules';
import { freeAreaOf, viewportOf } from '../shared/viewportFixtures';
import type { TestWindow } from '../shared/viewportFixtures';
import { FEW_GAMES_WINDOWS, MENU_LAYOUT_RULES } from './menuLayoutScenes';

/**
 * Testy k #192 AC6: rozložení přehledu pro rodiče v menu dodrží společná
 * pravidla (vejde se do okna i mimo výřez, nic se nepřekrývá, ťukací
 * plocha 64 px, mezera 8 px, 4 px od okraje, text se vejde) jako pravidla
 * v cyklu: všechna okna menu (iPad, telefon na šířku i na výšku, okna
 * z plochy), čeština i angličtina, obě hry, obě stránky a zkušební data
 * od nejdelších textů po prázdný přehled. Prvky jsou v CSS px okna tak,
 * jak je kreslí scéna přehledu (`OverviewScene.ts`).
 */

const SUNDAY = new Date(2026, 10, 22, 12, 0, 0);

/** Den `index` přehledu (0 = pondělí 16. 11., 6 = dnešní neděle). */
function dayOf(index: number): Date {
  return new Date(2026, 10, 16 + index, 12, 0, 0);
}

function activityOf(counts: readonly (readonly [number, number])[]): ActivityRecord {
  const record: Record<string, { solved: number; firstTry: number }> = {};
  counts.forEach(([solved, firstTry], index) => {
    record[dayKeyOf(dayOf(index))] = { solved, firstTry };
  });
  return record;
}

/** Týdny: nejvíc příkladů každý den (nejdelší čísla), běžný týden a prázdný přehled. */
const WEEKS: Readonly<Record<string, WeekOverview>> = {
  'plný týden': weekOverview(
    activityOf(Array.from({ length: 7 }, () => [MAX_SOLVED_PER_DAY, MAX_SOLVED_PER_DAY] as const)),
    SUNDAY,
  ),
  'běžný týden': weekOverview(
    activityOf([
      [12, 9],
      [0, 0],
      [25, 25],
      [3, 0],
      [0, 0],
      [40, 31],
      [7, 2],
    ]),
    SUNDAY,
  ),
  prázdný: weekOverview(EMPTY_ACTIVITY, SUNDAY),
};

/** Nejvíc možného: všechny druhy, 3 časté chyby s nejdelším zápisem a nejvyššími počty. */
function fullMistakes(spec: GameOverviewSpec, longest: readonly string[]): MistakeOverview {
  let record: MistakeRecord = EMPTY_MISTAKES;
  for (let day = 0; day < 7; day += 1) {
    for (let index = 0; index < MAX_SOLVED_PER_DAY; index += 1) {
      for (const operation of spec.operations) {
        record = recordSolvedOperation(record, dayOf(day), operation, index % 3 === 0, spec);
      }
      record = recordHintUsed(record, dayOf(day), spec);
    }
    for (const problem of longest) {
      for (let mistake = 0; mistake < MAX_MISTAKES_PER_PROBLEM; mistake += 1) {
        record = recordMistake(record, dayOf(day), problem, spec);
      }
    }
  }
  return mistakeOverview(record, SUNDAY, spec);
}

/** Nejdelší zápisy příkladů každé hry. */
const LONGEST: Readonly<Record<string, readonly string[]>> = {
  counting: [
    equationKey(20, 'minus', 10),
    equationKey(20, 'minus', 11),
    equationKey(10, 'plus', 10),
  ],
  compare: [missingSignKey(10, 10, 20), missingSignKey(20, 10, 10), comparisonKey(20, 20)],
};

const SAMPLE_CACHE = new Map<string, Readonly<Record<string, MistakeOverview>>>();

/** Přehledy chyb hry (spočítají se jednou): nejdelší texty, jedna častá chyba a prázdný. */
function mistakeSamples(game: OverviewGame): Readonly<Record<string, MistakeOverview>> {
  const cached = SAMPLE_CACHE.get(game.id);
  if (cached !== undefined) {
    return cached;
  }
  const samples = computeMistakeSamples(game);
  SAMPLE_CACHE.set(game.id, samples);
  return samples;
}

function computeMistakeSamples(game: OverviewGame): Readonly<Record<string, MistakeOverview>> {
  const longest = LONGEST[game.id] ?? [];
  const first = longest[0] ?? '';
  const one = recordMistake(
    recordMistake(EMPTY_MISTAKES, SUNDAY, first, game.spec),
    SUNDAY,
    first,
    game.spec,
  );
  return {
    'nejdelší texty': fullMistakes(game.spec, longest),
    'jedna častá chyba': mistakeOverview(one, SUNDAY, game.spec),
    prázdný: mistakeOverview(EMPTY_MISTAKES, SUNDAY, game.spec),
  };
}

const GAMES_WITH_OVERVIEW = overviewGames(GAMES);

/** Rozložení přehledu, jak ho stránka spočítá pro okno, jazyk a vybranou hru. */
function layoutOf(
  window: TestWindow,
  language: Language,
  game: OverviewGame,
): OverviewScreenLayout {
  return overviewLayoutFor(viewportOf(window), {
    gameCount: GAMES_WITH_OVERVIEW.length,
    sectionSizes: mistakeSectionSizes(game.spec),
    firstLegendLabel: afterMistakeLegend(game.spec, overviewTexts(language)),
  });
}

interface OverviewCase {
  readonly where: string;
  readonly language: Language;
  readonly game: OverviewGame;
  readonly layout: OverviewScreenLayout;
}

/** Každé okno × jazyk × hra s popisem pro zprávu. */
function cases(): OverviewCase[] {
  return FEW_GAMES_WINDOWS.flatMap((window) =>
    LANGUAGES.flatMap((language) =>
      GAMES_WITH_OVERVIEW.map((game) => ({
        where: `${window.name}, ${language}, ${game.id}`,
        language,
        game,
        layout: layoutOf(window, language, game),
      })),
    ),
  );
}

const ROUNDING = 0.01;

function textItem(name: string, slot: OverviewText, text: string): LayoutItem {
  return { name, box: slot.box, texts: [{ text, fontSize: slot.fontSize }] };
}

/** Lišta přehledu: Zpět, kolečko profilu, nadpis a záložky her a stránek. */
function barItems(layout: OverviewScreenLayout, language: Language): LayoutItem[] {
  const texts = overviewTexts(language);
  const tabText = (text: string, pill: MenuBox): LayoutText => ({
    text,
    fontSize: layout.tabFontSize,
    box: pill,
  });
  const items: LayoutItem[] = [
    {
      name: 'Zpět',
      box: layout.back,
      tappable: true,
      texts: [{ text: texts.back, fontSize: layout.buttonFontSize }],
    },
    // Kolečko profilu s nejširším písmenem „W“ (#72 AC4).
    {
      name: 'kolečko profilu',
      box: layout.profile,
      texts: [{ text: 'W', fontSize: layout.profileSymbolFontSize, charWidth: 1 }],
    },
    ...GAMES_WITH_OVERVIEW.map((game, index): LayoutItem => {
      const tab = layout.gameTabs[index];
      if (tab === undefined) {
        throw new Error(`chybí záložka hry ${game.id}`);
      }
      return {
        name: `záložka ${game.id}`,
        box: tab.hit,
        tappable: true,
        texts: [tabText(menuText(game.titleKey, language) ?? '', tab.pill)],
      };
    }),
    {
      name: 'záložka 7 dní',
      box: layout.pageTabs[0].hit,
      tappable: true,
      texts: [tabText(texts.weekTab, layout.pageTabs[0].pill)],
    },
    {
      name: 'záložka Chyby',
      box: layout.pageTabs[1].hit,
      tappable: true,
      texts: [tabText(texts.mistakesTab, layout.pageTabs[1].pill)],
    },
  ];
  if (layout.title !== null) {
    items.push(textItem('nadpis', layout.title, texts.title));
  }
  return items;
}

function weekItems(
  layout: OverviewScreenLayout,
  week: WeekOverview,
  spec: GameOverviewSpec,
  language: Language,
): LayoutItem[] {
  const lines = weekLines(week, spec, overviewTexts(language));
  const page = layout.week;
  const items: LayoutItem[] = [textItem('nadpis stránky', page.title, lines.title)];
  page.days.forEach((slot, index) => {
    items.push(textItem(`den ${index + 1}`, slot, lines.days[index] ?? ''));
  });
  page.legend.forEach((entry, index) => {
    items.push({ name: `odstín ${index + 1}`, box: entry.swatch });
    items.push(textItem(`vysvětlivka ${index + 1}`, entry.label, lines.legend[index] ?? ''));
  });
  items.push(textItem('součet za týden', page.totals[0], lines.totals[0]));
  items.push(textItem('součet napoprvé', page.totals[1], lines.totals[1]));
  if (lines.empty !== null) {
    items.push(textItem('bez dat', page.empty, lines.empty));
    return items;
  }
  overviewBars(page, week).forEach((bar, index) => {
    if (bar.solved.bottom > bar.solved.top) {
      items.push({ name: `sloupeček ${index + 1}`, box: bar.solved });
    }
    if (bar.firstTry.bottom > bar.firstTry.top) {
      items.push({ name: `napoprvé ${index + 1}`, box: bar.firstTry });
    }
    items.push(textItem(`počet ${index + 1}`, bar.value, String(week.days[index]?.solved ?? 0)));
  });
  return items;
}

function mistakeItems(
  layout: OverviewScreenLayout,
  mistakes: MistakeOverview,
  spec: GameOverviewSpec,
  language: Language,
): LayoutItem[] {
  const texts = overviewTexts(language);
  const page = layout.mistakes;
  const items: LayoutItem[] = [textItem('nadpis stránky', page.title, texts.mistakesTitle)];
  mistakeSections(mistakes, spec, texts, language).forEach((section, sectionIndex) => {
    const slots = page.sections[sectionIndex] ?? [];
    section.forEach((line, index) => {
      const slot = slots[index];
      if (slot === undefined) {
        throw new Error(`oddíl ${sectionIndex + 1}: chybí řádek ${index + 1}`);
      }
      const fitted = line.heading ? { ...slot, fontSize: page.headingFontSize } : slot;
      items.push(textItem(`oddíl ${sectionIndex + 1} řádek ${index + 1}`, fitted, line.text));
    });
  });
  return items;
}

/** Tmavší sloupeček „napoprvé“ je částí sloupečku vyřešených téhož dne. */
function sameDayBars(first: LayoutItem, second: LayoutItem): boolean {
  const day = (item: LayoutItem): string | null => {
    const match = /^(sloupeček|napoprvé) (\d)$/.exec(item.name);
    return match ? (match[2] ?? null) : null;
  };
  const firstDay = day(first);
  return firstDay !== null && firstDay === day(second) && first.name !== second.name;
}

function overviewScenes(): LayoutScene[] {
  return FEW_GAMES_WINDOWS.flatMap((window: TestWindow) =>
    LANGUAGES.flatMap((language) =>
      GAMES_WITH_OVERVIEW.flatMap((game) => {
        const layout = layoutOf(window, language, game);
        const label = (page: string, sample: string): string =>
          `${window.width}×${window.height} (${window.name}), ${language}, ${game.id}, ${page}, ${sample}`;
        const free = freeAreaOf(window);
        const bar = barItems(layout, language);
        const weeks = Object.entries(WEEKS).map(([sample, week]): LayoutScene => ({
          label: label('7 dní', sample),
          free,
          items: [...bar, ...weekItems(layout, week, game.spec, language)],
          mayOverlap: sameDayBars,
        }));
        const mistakes = Object.entries(mistakeSamples(game)).map(
          ([sample, overview]): LayoutScene => ({
            label: label('Chyby', sample),
            free,
            items: [...bar, ...mistakeItems(layout, overview, game.spec, language)],
          }),
        );
        return [...weeks, ...mistakes];
      }),
    ),
  );
}

const SCENES = overviewScenes();

describe('#192 AC6: přehled pro rodiče dodrží společná pravidla v každém okně, jazyce a stavu', () => {
  for (const [ruleName, rule] of Object.entries(MENU_LAYOUT_RULES)) {
    it(ruleName, () => {
      for (const scene of SCENES) {
        expect(rule(scene), scene.label).toEqual([]);
      }
    });
  }

  it('zkouší se všechna okna menu, oba jazyky, obě hry, obě stránky, data i prázdný přehled', () => {
    expect(GAMES_WITH_OVERVIEW.map((game) => game.id)).toEqual(['counting', 'compare']);
    expect(LANGUAGES).toEqual(expect.arrayContaining(['cs', 'en']));
    const modes = new Set(
      FEW_GAMES_WINDOWS.map(
        (window) => overviewLayoutFor(viewportOf(window), { gameCount: 2, sectionSizes: [] }).mode,
      ),
    );
    expect([...modes]).toEqual(
      expect.arrayContaining(['phoneLandscape', 'phonePortrait', 'tablet']),
    );
    expect(SCENES).toHaveLength(FEW_GAMES_WINDOWS.length * LANGUAGES.length * 2 * 6);
    expect(SCENES.some((scene) => scene.items.some((item) => item.name === 'bez dat'))).toBe(true);
    expect(SCENES.some((scene) => scene.items.some((item) => item.name === 'sloupeček 7'))).toBe(
      true,
    );
  });

  it('stránka Chyby ukáže u Znamének jen časté chyby, u Počítání i podíl napoprvé a nápovědu', () => {
    const sizes = (id: string): number[] => {
      const game = GAMES_WITH_OVERVIEW.find((candidate) => candidate.id === id);
      return game === undefined ? [] : mistakeSectionSizes(game.spec);
    };
    expect(sizes('counting')).toEqual([3, 4, 1]);
    expect(sizes('compare')).toEqual([4]);
  });
});

describe('#192 AC6 (dřív #183): graf 7 dní v každém okně, jazyce a hře', () => {
  const week = WEEKS['běžný týden'] as WeekOverview;

  it('výška sloupečku odpovídá počtu, tmavší část napoprvé je uvnitř sloupečku vyřešených na stejné základně', () => {
    const most = Math.max(...week.days.map((day) => day.solved));
    for (const { where, layout } of cases()) {
      const { chart } = layout.week;
      overviewBars(layout.week, week).forEach((bar, index) => {
        const day = week.days[index] as { solved: number; firstTry: number };
        const at = `${where}, den ${index + 1}`;
        const solvedHeight = bar.solved.bottom - bar.solved.top;
        const firstTryHeight = bar.firstTry.bottom - bar.firstTry.top;
        expect(solvedHeight, at).toBeCloseTo((chart.maxBarHeight * day.solved) / most, 5);
        expect(firstTryHeight, at).toBeCloseTo((chart.maxBarHeight * day.firstTry) / most, 5);
        expect(bar.solved.bottom, at).toBeCloseTo(chart.baseline, 5);
        expect(bar.firstTry.bottom, at).toBeCloseTo(chart.baseline, 5);
        expect(bar.firstTry.top, at).toBeGreaterThanOrEqual(bar.solved.top - ROUNDING);
        expect(bar.firstTry.left, at).toBeCloseTo(bar.solved.left, 5);
        expect(bar.firstTry.right, at).toBeCloseTo(bar.solved.right, 5);
      });
    }
  });

  it('sloupečky jdou zleva od nejstaršího dne po dnešek, pod každým je jeho zkratka', () => {
    expect(week.days.map((day) => day.key)).toEqual([...week.days.map((day) => day.key)].sort());
    expect(week.days.at(-1)?.isToday).toBe(true);
    for (const { where, layout } of cases()) {
      const bars = overviewBars(layout.week, week);
      bars.forEach((bar, index) => {
        const day = layout.week.days[index] as OverviewText;
        expect((bar.solved.left + bar.solved.right) / 2, `${where}, den ${index + 1}`).toBeCloseTo(
          (day.box.left + day.box.right) / 2,
          5,
        );
        const previous = bars[index - 1];
        if (previous !== undefined) {
          expect(bar.solved.left, where).toBeGreaterThanOrEqual(previous.solved.right);
        }
      });
    }
  });

  it('den s 0 příklady nemá sloupeček, jen počet „0“ nad základnou', () => {
    const empty = week.days.findIndex((day) => day.solved === 0);
    expect(empty).toBeGreaterThanOrEqual(0);
    for (const { where, layout, game, language } of cases()) {
      const bar = overviewBars(layout.week, week)[empty];
      expect(bar?.solved.bottom, where).toBe(bar?.solved.top);
      expect(bar?.firstTry.bottom, where).toBe(bar?.firstTry.top);
      expect(bar?.value.box.bottom, where).toBeCloseTo(layout.week.chart.baseline, 5);
      const items = weekItems(layout, week, game.spec, language);
      const value = items.find((item) => item.name === `počet ${empty + 1}`);
      expect(value?.texts?.[0]?.text, where).toBe('0');
      expect(
        items.some((item) => item.name === `sloupeček ${empty + 1}`),
        where,
      ).toBe(false);
    }
  });

  it('oba odstíny jsou vidět na pozadí stránky (aspoň 3 : 1) a jdou od sebe rozeznat (aspoň 1,5 : 1)', () => {
    expect(contrastRatio(OVERVIEW_STYLE.solved, PAGE_BACKGROUND)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(OVERVIEW_STYLE.firstTry, PAGE_BACKGROUND)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(OVERVIEW_STYLE.solved, OVERVIEW_STYLE.firstTry)).toBeGreaterThanOrEqual(
      1.5,
    );
  });

  it('bez dat je nápis „Zatím žádné příklady“ na středu grafu', () => {
    for (const { where, layout } of cases()) {
      const { chart, empty } = layout.week;
      expect((empty.box.left + empty.box.right) / 2, where).toBeCloseTo(
        (chart.left + chart.right) / 2,
        5,
      );
      expect((empty.box.top + empty.box.bottom) / 2, where).toBeCloseTo(
        (chart.top + chart.baseline) / 2,
        5,
      );
      expect(empty.align, where).toBe('center');
    }
  });

  it('nadpis je hned nad grafem (nejvýš 8 px) a součty pod zkratkami dnů', () => {
    for (const { where, layout } of cases()) {
      const gap = layout.week.chart.top - layout.week.title.box.bottom;
      expect(gap, where).toBeGreaterThanOrEqual(0);
      expect(gap, where).toBeLessThanOrEqual(8);
      // Součty jsou pod zkratkami dnů; na telefonu na šířku ve sloupci vpravo od grafu.
      const daysBottom = Math.max(...layout.week.days.map((day) => day.box.bottom));
      for (const total of layout.week.totals) {
        if (layout.mode === 'phoneLandscape') {
          expect(total.box.left, where).toBeGreaterThanOrEqual(layout.week.chart.right);
        } else {
          expect(total.box.top, where).toBeGreaterThanOrEqual(daysBottom);
        }
      }
    }
  });

  it('na iPadu je „Napoprvé“ 8–16 px za koncem textu první vysvětlivky', () => {
    const tablets = cases().filter(
      ({ layout }) => layout.mode === 'tablet' || layout.mode === 'scaled',
    );
    expect(tablets.length).toBeGreaterThan(0);
    for (const { where, layout, game, language } of tablets) {
      const [first, second] = layout.week.legend;
      const text = afterMistakeLegend(game.spec, overviewTexts(language));
      const textEnd =
        first.label.box.left +
        (first.label.inset ?? 0) +
        estimatedTextWidth(text, first.label.fontSize);
      const gap = second.swatch.left - textEnd;
      expect(second.swatch.top, where).toBeCloseTo(first.swatch.top, 5);
      expect(gap, where).toBeGreaterThanOrEqual(8);
      expect(gap, where).toBeLessThanOrEqual(16);
    }
  });
});

describe('#192 AC6 (dřív #184): stránka Chyby se čte shora dolů', () => {
  it('nadpis, napoprvé, časté chyby a nápověda jdou za sebou; řádky oddílu pod sebou', () => {
    for (const { where, layout, game, language } of cases()) {
      const texts = overviewTexts(language);
      const overview = mistakeSamples(game)['nejdelší texty'] as MistakeOverview;
      const sections = mistakeSections(overview, game.spec, texts, language);
      const expectedStarts = [
        ...(game.spec.operations.length > 0 ? [texts.firstTryHeading] : []),
        texts.frequentHeading,
        ...(game.spec.hints ? [texts.hintsUsed] : []),
      ];
      expect(
        sections.map((section) => section[0]?.text.split(':')[0]),
        where,
      ).toEqual(expectedStarts);
      for (const rows of layout.mistakes.sections) {
        rows.forEach((row, index) => {
          const previous = rows[index - 1];
          if (previous !== undefined) {
            expect(row.box.top, where).toBeGreaterThanOrEqual(previous.box.bottom);
          }
        });
      }
      const boxes = layout.mistakes.sections.map((rows) => ({
        left: Math.min(...rows.map((row) => row.box.left)),
        right: Math.max(...rows.map((row) => row.box.right)),
        top: Math.min(...rows.map((row) => row.box.top)),
        bottom: Math.max(...rows.map((row) => row.box.bottom)),
      }));
      boxes.forEach((box, index) => {
        expect(box.top, where).toBeGreaterThanOrEqual(layout.mistakes.title.box.bottom);
        const previous = boxes[index - 1];
        if (previous === undefined) {
          return;
        }
        // Další oddíl je pod předchozím, nebo (telefon na šířku) ve sloupci vpravo nahoře.
        const below = box.top >= previous.bottom - ROUNDING;
        const nextColumn =
          box.left >= previous.right - ROUNDING && Math.abs(box.top - previous.top) < ROUNDING;
        expect(below || nextColumn, `${where}, oddíl ${index + 1}`).toBe(true);
      });
    }
  });
});
