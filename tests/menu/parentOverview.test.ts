import { describe, expect, it } from 'vitest';

import { GAMES } from '../../src/gameList';
import { COMPARE_META, COMPARE_OVERVIEW } from '../../src/games/compare/meta';
import { COUNTING_META, COUNTING_OVERVIEW } from '../../src/games/counting/meta';
import { shownSceneFor } from '../../src/menu/logic/menuSceneVisibility';
import { menuText, overviewTexts } from '../../src/menu/logic/menuTexts';
import { mistakeSections, weekLines } from '../../src/menu/logic/overviewLines';
import { createParentOverview, overviewGames } from '../../src/menu/logic/parentOverview';
import type { OverviewFeedback, ParentOverview } from '../../src/menu/logic/parentOverview';
import {
  comparisonKey,
  equationKey,
  missingSignKey,
} from '../../src/shared/logic/overviewProblems';
import { PROFILE_COLORS } from '../../src/shared/logic/profiles';
import {
  ACTIVITY_KEY,
  MISTAKES_KEY,
  createActivityLog,
} from '../../src/shared/storage/activityStorage';
import { openProfiles } from '../../src/shared/storage/profileStorage';
import type { ProfileStore } from '../../src/shared/storage/profileStorage';
import type { Language } from '../../src/shared/texts/languages';
import { DeviceStorage, profileDataKeys } from '../shared/profileFixtures';

/**
 * Testy k #192 AC2 a AC3: přehled pro rodiče v menu. Je za aktivní profil,
 * má záložky her, které přehled mají (Počítání a Znaménka, Omalovánky ne),
 * a u každé hry stránky 7 dní a Chyby. Zpět vrátí do menu. Záznamy her
 * zapisuje do úložiště hry aktivního profilu sdílená logika (stejně jako
 * hry, `createActivityLog` s popisem z `meta.ts`), menu je čte bez kódu her.
 */

const SUNDAY = new Date(2026, 10, 22, 12, 0, 0);

function translate(language: Language): (key: string) => string {
  return (key) => menuText(key, language) ?? key;
}

interface TestOverview {
  readonly overview: ParentOverview;
  readonly feedback: OverviewFeedback[];
  closed(): number;
}

function overviewOf(store: ProfileStore, language: Language = 'cs'): TestOverview {
  const feedback: OverviewFeedback[] = [];
  let closed = 0;
  const overview = createParentOverview({
    games: GAMES,
    translate: translate(language),
    gameStorage: (gameId) => store.gameStorage(gameId),
    today: () => SUNDAY,
    feedback: (event) => feedback.push(event),
    onClosed: () => {
      closed += 1;
    },
  });
  return { overview, feedback, closed: () => closed };
}

/** Dítě v aktivním profilu vyřeší v Počítání `solved` příkladů a u 8 + 5 se dvakrát splete. */
function playCounting(store: ProfileStore, solved: number): void {
  const log = createActivityLog({
    storage: store.gameStorage(COUNTING_META.id),
    spec: COUNTING_OVERVIEW,
    today: () => SUNDAY,
  });
  log.mistake(equationKey(8, 'plus', 5));
  log.mistake(equationKey(8, 'plus', 5));
  for (let index = 0; index < solved; index += 1) {
    log.solved(index > 0, 'plus');
  }
}

/** Dítě v aktivním profilu vyřeší ve Znaménkách `solved` příkladů a u „7 ☐ 5“ se dvakrát splete. */
function playCompare(store: ProfileStore, solved: number): void {
  const log = createActivityLog({
    storage: store.gameStorage(COMPARE_META.id),
    spec: COMPARE_OVERVIEW,
    today: () => SUNDAY,
  });
  log.mistake(comparisonKey(7, 5));
  log.mistake(comparisonKey(7, 5));
  log.mistake(missingSignKey(9, 4, 5));
  for (let index = 0; index < solved; index += 1) {
    log.solved(index % 2 === 0);
  }
}

describe('#192 AC2: přehled má záložky po hrách', () => {
  it('záložky jsou Počítání a Znaménka v pořadí menu, Omalovánky přehled nemají', () => {
    const { overview } = overviewOf(openProfiles(new DeviceStorage()));
    overview.open();
    expect(overview.games().map((game) => game.id)).toEqual(['counting', 'compare']);
    expect(overview.games().map((game) => game.title)).toEqual(['Počítání', 'Znaménka']);
    expect(overviewGames(GAMES).map((game) => game.id)).not.toContain('coloring');
  });

  it('anglicky jsou záložky „Counting“ a „Signs“', () => {
    const { overview } = overviewOf(openProfiles(new DeviceStorage()), 'en');
    expect(overview.games().map((game) => game.title)).toEqual(['Counting', 'Signs']);
  });

  it('po otevření je vybrané Počítání a stránka 7 dní', () => {
    const { overview } = overviewOf(openProfiles(new DeviceStorage()));
    overview.open();
    expect(overview.isOpen()).toBe(true);
    expect(overview.games().map((game) => game.selected)).toEqual([true, false]);
    expect(overview.page()).toBe('week');
  });

  it('ťuknutí na Znaménka a na Chyby přepne hru a stránku s tichým tónem', () => {
    const test = overviewOf(openProfiles(new DeviceStorage()));
    test.overview.open();
    test.overview.tapGame(1);
    expect(test.overview.games().map((game) => game.selected)).toEqual([false, true]);
    expect(test.overview.spec()).toBe(COMPARE_OVERVIEW);
    test.overview.tapPage('mistakes');
    expect(test.overview.page()).toBe('mistakes');
    expect(test.feedback).toEqual([{ kind: 'select' }, { kind: 'select' }]);
  });

  it('ťuknutí na už vybranou záložku ji jen zhoupne', () => {
    const test = overviewOf(openProfiles(new DeviceStorage()));
    test.overview.open();
    test.overview.tapGame(0);
    test.overview.tapPage('week');
    expect(test.feedback).toEqual([
      { kind: 'wobble', target: 'game', index: 0 },
      { kind: 'wobble', target: 'page', index: 0 },
    ]);
    expect(test.overview.page()).toBe('week');
  });

  it('Zpět přehled zavře a vrátí do menu; po dalším otevření je zase Počítání a 7 dní', () => {
    const test = overviewOf(openProfiles(new DeviceStorage()));
    test.overview.open();
    test.overview.tapGame(1);
    test.overview.tapPage('mistakes');
    test.overview.tapBack();
    expect(test.overview.isOpen()).toBe(false);
    expect(test.closed()).toBe(1);
    expect(test.feedback.at(-1)).toEqual({ kind: 'back' });
    test.overview.open();
    expect(test.overview.games()[0]?.selected).toBe(true);
    expect(test.overview.page()).toBe('week');
  });

  it('se zavřeným přehledem ťuknutí nic nedělají', () => {
    const test = overviewOf(openProfiles(new DeviceStorage()));
    test.overview.tapGame(1);
    test.overview.tapPage('mistakes');
    test.overview.tapBack();
    expect(test.feedback).toEqual([]);
    expect(test.closed()).toBe(0);
  });

  it('dokud je přehled otevřený, je vidět jen on; výběr profilu má přednost', () => {
    expect(shownSceneFor(false, true)).toBe('overview');
    expect(shownSceneFor(false, false)).toBe('menu');
    expect(shownSceneFor(true, true)).toBe('profiles');
  });
});

describe('#192 AC2: co rodič na stránkách uvidí', () => {
  it('Počítání: 7 dní jako dřív a Chyby s podílem napoprvé, častými chybami a nápovědou', () => {
    const store = openProfiles(new DeviceStorage());
    playCounting(store, 4);
    const { overview } = overviewOf(store);
    overview.open();
    const data = overview.data();
    expect(data.week.totalSolved).toBe(4);
    expect(data.week.totalFirstTry).toBe(3);
    const texts = overviewTexts('cs');
    expect(weekLines(data.week, overview.spec(), texts).totals).toEqual([
      'Za týden vyřešeno: 4',
      'Z toho napoprvé: 3',
    ]);
    const sections = mistakeSections(data.mistakes, overview.spec(), texts, 'cs');
    expect(sections.map((section) => section.map((line) => line.text))).toEqual([
      ['Vyřešeno napoprvé', 'Sčítání: 75 % (3/4)'],
      ['Nejčastější chyby', '8 + 5 (2×)'],
      ['Nápověda za týden: 0'],
    ]);
  });

  it('Znaménka: 7 dní vyřešeno a z toho napoprvé, nejčastější chyby ve tvaru „7 ☐ 5 (2×)“', () => {
    const store = openProfiles(new DeviceStorage());
    playCompare(store, 5);
    const { overview } = overviewOf(store);
    overview.open();
    overview.tapGame(1);
    const data = overview.data();
    const texts = overviewTexts('cs');
    const week = weekLines(data.week, overview.spec(), texts);
    expect(week.totals).toEqual(['Za týden vyřešeno: 5', 'Z toho napoprvé: 3']);
    // Znaménka nemají nápovědu: světlejší část sloupečku je jen „Po chybě“.
    expect(week.legend).toEqual(['Po chybě', 'Napoprvé']);
    const sections = mistakeSections(data.mistakes, overview.spec(), texts, 'cs');
    expect(sections.map((section) => section.map((line) => line.text))).toEqual([
      ['Nejčastější chyby', '7 ☐ 5 (2×)'],
    ]);
    expect(sections[0]?.map((line) => line.heading)).toEqual([true, false]);
  });

  it('bez dat je u obou her „Zatím žádné příklady“ a „Bez častých chyb“', () => {
    const { overview } = overviewOf(openProfiles(new DeviceStorage()));
    overview.open();
    const texts = overviewTexts('cs');
    for (const index of [0, 1]) {
      overview.tapGame(index);
      const data = overview.data();
      expect(weekLines(data.week, overview.spec(), texts).empty).toBe('Zatím žádné příklady');
      const lines = mistakeSections(data.mistakes, overview.spec(), texts, 'cs').flatMap(
        (section) => section.map((line) => line.text),
      );
      expect(lines).toContain('Bez častých chyb');
    }
  });

  it('podívat se do přehledu nic neuloží', () => {
    const device = new DeviceStorage();
    const store = openProfiles(device);
    playCounting(store, 2);
    playCompare(store, 2);
    const before = new Map(device.data);
    const { overview } = overviewOf(store);
    overview.open();
    overview.data();
    overview.tapGame(1);
    overview.data();
    expect(device.data).toEqual(before);
  });
});

describe('#192 AC3: přehled je za aktivní profil a jen v zařízení', () => {
  it('rodič vidí záznamy aktivního profilu; po výběru jiného profilu jeho záznamy', () => {
    const store = openProfiles(new DeviceStorage());
    const first = store.activeProfile();
    const second = store.createProfile({ nickname: 'BETA', color: PROFILE_COLORS[1] });
    playCounting(store, 4);
    store.selectProfile(second.id);
    playCompare(store, 1);

    const { overview } = overviewOf(store);
    overview.open();
    expect(overview.data().week.isEmpty).toBe(true);
    overview.tapGame(1);
    expect(overview.data().week.totalSolved).toBe(1);

    store.selectProfile(first.id);
    expect(overview.data().week.isEmpty).toBe(true);
    overview.tapGame(0);
    expect(overview.data().week.totalSolved).toBe(4);
  });

  it('záznamy jsou pod vnitřním označením profilu, nikdy s přezdívkou', () => {
    const device = new DeviceStorage();
    const store = openProfiles(device);
    const child = store.createProfile({ nickname: 'ZUZANA', color: PROFILE_COLORS[2] });
    store.selectProfile(child.id);
    playCounting(store, 1);
    playCompare(store, 1);
    const keys = [...device.data.keys()].filter(
      (key) => key.endsWith(ACTIVITY_KEY) || key.endsWith(MISTAKES_KEY),
    );
    expect(keys).toHaveLength(4);
    for (const key of keys) {
      expect(profileDataKeys(device, child.id)).toContain(key);
      expect(key).not.toContain('ZUZANA');
      expect(device.data.get(key)).not.toContain('ZUZANA');
    }
  });

  it('po smazání profilu jeho přehled zmizí a nový profil se stejnou přezdívkou začíná prázdný', () => {
    const device = new DeviceStorage();
    const store = openProfiles(device);
    const keeper = store.activeProfile();
    const child = store.createProfile({ nickname: 'ALFA', color: PROFILE_COLORS[3] });
    store.selectProfile(child.id);
    playCounting(store, 3);
    playCompare(store, 3);

    store.selectProfile(keeper.id);
    expect(store.deleteProfile(child.id)).toBe(true);
    expect(profileDataKeys(device, child.id)).toEqual([]);
    expect(
      [...device.data.keys()].some(
        (key) => key.endsWith(ACTIVITY_KEY) || key.endsWith(MISTAKES_KEY),
      ),
    ).toBe(false);

    const again = store.createProfile({ nickname: 'ALFA', color: PROFILE_COLORS[3] });
    store.selectProfile(again.id);
    const { overview } = overviewOf(store);
    overview.open();
    for (const index of [0, 1]) {
      overview.tapGame(index);
      expect(overview.data().week.isEmpty, `hra ${index + 1}`).toBe(true);
      expect(overview.data().mistakes.frequent, `hra ${index + 1}`).toEqual([]);
    }
  });

  it('seznam her bez přehledu nic nečte a nic neshodí', () => {
    const overview = createParentOverview({
      games: GAMES.filter((game) => game.overview === undefined),
      translate: translate('cs'),
      gameStorage: () => {
        throw new Error('menu nemá číst úložiště hry bez přehledu');
      },
      today: () => SUNDAY,
    });
    overview.open();
    expect(overview.games()).toEqual([]);
    expect(overview.data().week.isEmpty).toBe(true);
  });
});
