import { describe, expect, it } from 'vitest';

import {
  CELEBRATION_TO_MAP_MS,
  MAP_CLOSE_ANSWER_PAUSE_MS,
  NEXT_PROBLEM_MS,
} from '../../../src/games/compare/logic/compareSession';
import { correctSign } from '../../../src/games/compare/logic/compareProblems';
import type { KeyReward } from '../../../src/shared/logic/keyRewards';
import {
  KEY_REWARD_APPEAR_MS,
  MARKER_ARRIVAL_MS,
  STARS_LANDED_MS,
  mapClosableFromMs,
} from '../../../src/shared/logic/mapAnimation';
import { MAP_GOAL_SHOW_MS, MAP_SHOW_MS, MAP_STEPS } from '../../../src/shared/logic/progressMap';
import type { MapProgress } from '../../../src/shared/logic/progressMap';
import { STARS_PER_SET } from '../../../src/shared/logic/stars';
import { KEY_REWARDS_AREA, openKeyRewards } from '../../../src/shared/storage/keyRewardsStorage';
import {
  LEGACY_MAP_GAME_ID,
  MAP_PROGRESS_AREA,
  openMapProgress,
} from '../../../src/shared/storage/mapProgressStorage';
import { openProfiles } from '../../../src/shared/storage/profileStorage';
import type { ProfileStore } from '../../../src/shared/storage/profileStorage';
import { DeviceStorage } from '../../shared/profileFixtures';
import { FakeRudy, openCompare } from './compareFakes';
import type { TestCompare } from './compareFakes';

/**
 * Testy k #193 AC1, AC2 a AC4 ve Znaménkách: po 10. hvězdičce přiskočí
 * Rudy, po jeho odchodu melodie s konfetami a karta se společnou mapou
 * profilu se stejným chováním a časy jako v Počítání (#145, #154): řada
 * odletí do karty, značka dojde o krok dál, v cíli půlka klíče, karta se
 * zavře ťuknutím po doběhnutí animace nebo sama po 7 s a teprve potom
 * přijde nový příklad. Mapu a klíče dá hře stránka z úložiště aktivního
 * profilu (`openMapProgress`, `openKeyRewards`), jako při spuštění z menu.
 */

const COMPARE = 'compare';

interface MapCompare extends TestCompare {
  readonly rudy: FakeRudy;
  readonly page: ProfileStore;
}

/** Mapa aktivního profilu, jak ji stránka dá hře při spuštění. */
function mapOf(page: ProfileStore) {
  return openMapProgress(page.gameStorage(MAP_PROGRESS_AREA), page.gameStorage(LEGACY_MAP_GAME_ID));
}

function keysOf(page: ProfileStore) {
  return openKeyRewards(page.gameStorage(KEY_REWARDS_AREA));
}

/** Dítě otevře Znaménka z menu v profilu stránky `page` (s mapou `map` uloženou dřív). */
function openOn(page: ProfileStore, map?: MapProgress): MapCompare {
  if (map !== undefined) {
    openMapProgress(page.gameStorage(MAP_PROGRESS_AREA)).save(map);
  }
  const rudy = new FakeRudy();
  const test = openCompare(page.gameStorage(COMPARE), undefined, rudy, undefined, {
    keyRewards: keysOf(page),
    mapProgress: mapOf(page),
  });
  return { ...test, rudy, page };
}

function freshPage(): ProfileStore {
  return openProfiles(new DeviceStorage());
}

function tapRight(game: TestCompare) {
  return game.session.tap(correctSign(game.session.problem()));
}

/** Dítě vyřeší 9 příkladů a ťukne správně na 10.: řada je plná, Rudy čeká na stažení. */
function fillRow(game: MapCompare): void {
  for (let solved = 0; solved < STARS_PER_SET - 1; solved += 1) {
    tapRight(game);
    game.timers.advance(NEXT_PROBLEM_MS);
  }
  tapRight(game);
  game.timers.advance(NEXT_PROBLEM_MS);
}

/** Plná řada, Rudy přiskočí a odejde: začne oslava. Změny a zvuky se smažou. */
function celebrate(game: MapCompare): void {
  fillRow(game);
  game.rudy.openPending();
  game.changes.length = 0;
  game.sounds.played.length = 0;
  game.rudy.close();
}

/** Posouvá čas po 1 ms, dokud nenastane `done`; vrátí, kolik ms uběhlo. */
function waitUntil(game: TestCompare, done: () => boolean, limitMs = 20_000): number {
  for (let elapsed = 0; elapsed <= limitMs; elapsed += 1) {
    if (done()) {
      return elapsed;
    }
    game.timers.advance(1);
  }
  throw new Error('nenastalo včas');
}

/** Oslava a karta: vrátí, co dal cíl. Karta se pak sama zavře. */
function celebrateAndShowMap(game: MapCompare): KeyReward | null {
  celebrate(game);
  waitUntil(game, () => game.session.shownMap() !== null);
  return game.session.goalKeyReward();
}

function kinds(game: TestCompare): string[] {
  return game.changes.map((change) => change.kind);
}

describe('#193 AC2: po 10. hvězdičce Rudy, konfety a karta s mapou jako v Počítání', () => {
  it('nejdřív Rudy, po jeho odchodu konfety a karta s mapou za stejnou dobu jako v Počítání', () => {
    const game = openOn(freshPage());
    fillRow(game);
    expect(game.rudy.isWaiting(), 'Rudy přiskočí').toBe(true);
    expect(game.session.shownMap(), 'karta až po Rudym').toBeNull();
    game.rudy.openPending();
    game.timers.advance(5000);
    expect(game.session.shownMap(), 'Rudy je vidět, karta ne').toBeNull();

    game.changes.length = 0;
    game.rudy.close();
    expect(kinds(game), 'konfety hned po Rudym').toEqual(['celebrationStarted']);
    expect(game.sounds.played.at(-1)).toBe('celebration');
    expect(waitUntil(game, () => game.session.shownMap() !== null)).toBe(CELEBRATION_TO_MAP_MS);
    expect(kinds(game)).toEqual(['celebrationStarted', 'mapShown']);
  });

  it('karta se ukáže stejně, i když se Rudy nestáhne', () => {
    const game = openOn(freshPage());
    fillRow(game);
    game.changes.length = 0;
    game.rudy.giveUp();
    expect(kinds(game)).toEqual(['celebrationStarted']);
    expect(waitUntil(game, () => game.session.shownMap() !== null)).toBe(CELEBRATION_TO_MAP_MS);
  });

  it('hvězdičky z řady odletí do karty: řada je prázdná, až když doletí', () => {
    const game = openOn(freshPage());
    celebrateAndShowMap(game);
    expect(game.session.starCount(), 'hvězdičky teprve letí').toBe(STARS_PER_SET);
    game.timers.advance(STARS_LANDED_MS - 1);
    expect(game.session.starCount()).toBe(STARS_PER_SET);
    game.timers.advance(1);
    expect(game.session.starCount(), 'doletěly').toBe(0);
    expect(kinds(game).at(-1)).toBe('celebrationEnded');
    expect(game.session.shownMap(), 'karta je dál vidět').not.toBeNull();
  });

  it('značka jde ze startu na 1. zastávku a zvuk zastávky zazní, až dojde', () => {
    const game = openOn(freshPage());
    celebrateAndShowMap(game);
    expect(game.session.shownMap()).toMatchObject({ from: 0, to: 1, reachedGoal: false });
    game.sounds.played.length = 0;
    game.timers.advance(MARKER_ARRIVAL_MS - 1);
    expect(game.sounds.played).toEqual([]);
    game.timers.advance(1);
    expect(game.sounds.played).toEqual(['mapStep']);
  });

  it('karta se sama zavře po 7 s a teprve potom přijde nový příklad', () => {
    const game = openOn(freshPage());
    celebrateAndShowMap(game);
    const problem = game.session.problem();
    game.timers.advance(MAP_SHOW_MS - 1);
    expect(game.session.shownMap()).not.toBeNull();
    expect(game.session.isCelebrating()).toBe(true);
    game.timers.advance(1);
    expect(game.session.shownMap()).toBeNull();
    expect(kinds(game).slice(-2)).toEqual(['mapHidden', 'problemStarted']);
    expect(game.session.problem()).not.toBe(problem);
    expect(game.session.isCelebrating()).toBe(false);
    expect(tapRight(game), 'dítě hned odpovídá').toBe('correct');
  });

  it('v cíli zazní melodie cíle a u cíle je půlka klíče, další mapa dokončí celý klíč', () => {
    const page = freshPage();
    const first = openOn(page, { step: MAP_STEPS - 1, completedMaps: 0 });
    expect(celebrateAndShowMap(first), 'cíl 1. mapy').toBe('half');
    expect(first.session.shownMap()).toMatchObject({ to: MAP_STEPS, reachedGoal: true });
    first.sounds.played.length = 0;
    first.timers.advance(MAP_GOAL_SHOW_MS);
    expect(first.sounds.played).toEqual(['mapGoal', 'keyReward']);
    expect(keysOf(page).balance()).toMatchObject({ halves: 1, wholeKeys: 0, hasHalf: true });
    first.session.leave();

    const second = openOn(page, { step: MAP_STEPS - 1, completedMaps: 1 });
    expect(celebrateAndShowMap(second), 'cíl 2. mapy').toBe('wholeKey');
    expect(keysOf(page).balance()).toMatchObject({ halves: 2, wholeKeys: 1, hasHalf: false });
  });

  it('melodie cíle a tón půlky klíče zazní ve stejných časech jako v Počítání', () => {
    const game = openOn(freshPage(), { step: MAP_STEPS - 1, completedMaps: 0 });
    celebrateAndShowMap(game);
    game.sounds.played.length = 0;
    game.timers.advance(MARKER_ARRIVAL_MS);
    expect(game.sounds.played).toEqual(['mapGoal']);
    game.timers.advance(KEY_REWARD_APPEAR_MS - MARKER_ARRIVAL_MS - 1);
    expect(game.sounds.played).toEqual(['mapGoal']);
    game.timers.advance(1);
    expect(game.sounds.played).toEqual(['mapGoal', 'keyReward']);
  });
});

describe('#193 AC6: příklad a ovládání nevyčnívají po stranách karty s mapou', () => {
  it('dokud je karta vidět, příklad i tlačítka nebo plocha na psaní jsou schované', () => {
    const game = openOn(freshPage());
    expect(game.session.problemHidden(), 'při hraní').toBe(false);
    fillRow(game);
    game.rudy.openPending();
    expect(game.session.problemHidden(), 's Rudym').toBe(false);
    game.rudy.close();
    expect(game.session.problemHidden(), 'během konfet před kartou').toBe(false);
    waitUntil(game, () => game.session.shownMap() !== null);
    expect(game.session.problemHidden(), 'karta').toBe(true);
    game.timers.advance(MAP_SHOW_MS - 1);
    expect(game.session.problemHidden(), 'těsně před zavřením').toBe(true);
    game.timers.advance(1);
    expect(game.session.problemHidden(), 'karta se sama zavřela').toBe(false);
  });

  it('po zavření ťuknutím nebo nastavením se příklad hned zase ukáže', () => {
    const tapped = openOn(freshPage());
    celebrateAndShowMap(tapped);
    tapped.timers.advance(MARKER_ARRIVAL_MS);
    tapped.session.tapMap();
    expect(tapped.session.problemHidden(), 'po ťuknutí').toBe(false);

    const interrupted = openOn(freshPage());
    celebrateAndShowMap(interrupted);
    interrupted.gear.hold();
    expect(interrupted.session.problemHidden(), 'pod nastavením').toBe(false);
  });
});

describe('#193 AC2: ťuknutí na kartu jako v Počítání (#145 AC4, AC5)', () => {
  it('předčasné ťuknutí kartu nezavře a nic nebere, po doběhnutí animace ji zavře', () => {
    const game = openOn(freshPage(), { step: MAP_STEPS - 1, completedMaps: 0 });
    celebrateAndShowMap(game);
    const move = game.session.shownMap();
    if (move === null) {
      throw new Error('karta se neukázala');
    }
    expect(game.session.tapMap(), 'hned').toBe('tooEarly');
    game.timers.advance(mapClosableFromMs(move, 'half') - 1);
    expect(game.session.tapMap(), 'těsně před koncem animace').toBe('tooEarly');
    expect(game.sounds.played).not.toContain('wrong');
    game.timers.advance(1);
    expect(game.session.tapMap(), 'po doběhnutí animace').toBe('closed');
    expect(game.session.shownMap()).toBeNull();
    expect(kinds(game).slice(-2)).toEqual(['mapHidden', 'problemStarted']);
    expect(game.session.mapProgress()).toEqual({ step: MAP_STEPS, completedMaps: 1 });
  });

  it('chvíli po zavření ťuknutím se znaménko nepočítá, aby rychlé druhé ťuknutí nic nezadalo', () => {
    const game = openOn(freshPage());
    celebrateAndShowMap(game);
    game.timers.advance(MARKER_ARRIVAL_MS);
    expect(game.session.tapMap()).toBe('closed');
    expect(tapRight(game), 'hned po zavření').toBe('ignored');
    expect(game.session.tapBox()).toBe(false);
    game.timers.advance(MAP_CLOSE_ANSWER_PAUSE_MS);
    expect(tapRight(game)).toBe('correct');
  });

  it('po zavření ťuknutím se karta po 7 s nezavře podruhé a nový příklad přijde jen jednou', () => {
    const game = openOn(freshPage());
    celebrateAndShowMap(game);
    game.timers.advance(MARKER_ARRIVAL_MS);
    game.session.tapMap();
    game.timers.advance(MAP_SHOW_MS);
    expect(kinds(game).filter((kind) => kind === 'mapHidden')).toHaveLength(1);
    expect(kinds(game).filter((kind) => kind === 'problemStarted')).toHaveLength(1);
  });

  it('během karty se ťuknutí na znaménko ani na okénko nepočítá', () => {
    const game = openOn(freshPage());
    celebrateAndShowMap(game);
    expect(tapRight(game)).toBe('ignored');
    expect(game.session.tapBox()).toBe(false);
    expect(game.session.writingRejected()).toBe(false);
  });

  it('bez karty ťuknutí na kartu nic nedělá', () => {
    const game = openOn(freshPage());
    expect(game.session.tapMap()).toBe('ignored');
  });
});

describe('#193 AC2: přerušení karty nastavením a domečkem', () => {
  it('nastavení během karty: karta zmizí, krok zůstane a po ✓ přijde nový příklad bez karty', () => {
    const game = openOn(freshPage());
    celebrateAndShowMap(game);
    game.timers.advance(STARS_LANDED_MS);
    game.gear.hold();
    expect(kinds(game)).toContain('mapStopped');
    expect(game.session.shownMap()).toBeNull();
    game.sounds.played.length = 0;
    game.timers.advance(MAP_SHOW_MS);
    expect(game.sounds.played, 'pod nastavením nic nezazní').toEqual([]);

    game.session.confirmSettings();
    expect(game.session.shownMap(), 'karta se po ✓ neukáže').toBeNull();
    expect(game.session.isCelebrating()).toBe(false);
    expect(game.session.mapProgress()).toEqual({ step: 1, completedMaps: 0 });
    expect(tapRight(game)).toBe('correct');
  });

  it('nastavení dřív, než hvězdičky doletí: po ✓ oslava i karta znovu a krok se nepřičte dvakrát', () => {
    const page = freshPage();
    const game = openOn(page);
    celebrateAndShowMap(game);
    game.gear.hold();
    game.session.confirmSettings();
    expect(kinds(game).at(-1), 'oslava znovu').toBe('celebrationStarted');
    waitUntil(game, () => game.session.shownMap() !== null);
    expect(game.session.shownMap()).toMatchObject({ from: 0, to: 1 });
    game.timers.advance(MAP_SHOW_MS);
    expect(mapOf(page).load()).toEqual({ step: 1, completedMaps: 0 });
  });

  it('odchod domečkem během karty: nic se nedohraje, krok zůstane a příště se karta neukáže', () => {
    const page = freshPage();
    const game = openOn(page);
    celebrateAndShowMap(game);
    game.session.leave();
    game.sounds.played.length = 0;
    game.timers.advance(MAP_SHOW_MS);
    expect(game.sounds.played).toEqual([]);

    const again = openOn(page);
    again.timers.advance(MAP_SHOW_MS);
    expect(again.session.shownMap()).toBeNull();
    expect(again.session.mapProgress()).toEqual({ step: 1, completedMaps: 0 });
  });

  it('krok se uloží hned po 10. hvězdičce, i když dítě odejde ještě před Rudym', () => {
    const page = freshPage();
    const game = openOn(page);
    fillRow(game);
    game.session.leave();
    expect(mapOf(page).load()).toEqual({ step: 1, completedMaps: 0 });
  });
});

describe('#193 AC1, AC4: Znaménka posouvají mapu profilu a dávají klíče jen jednou za mapu', () => {
  it('krok ze Znamének je na mapě profilu, odkud ho vezme Počítání', () => {
    const storage = new DeviceStorage();
    const game = openOn(openProfiles(storage));
    celebrateAndShowMap(game);
    expect(mapOf(openProfiles(storage)).load()).toEqual({ step: 1, completedMaps: 0 });
  });

  it('Znaménka pokračují z kroku, který dítě získalo v Počítání', () => {
    const page = freshPage();
    // Počítání uložilo mapu profilu.
    mapOf(page).save({ step: 2, completedMaps: 3 });
    const game = openOn(page);
    expect(game.session.mapProgress()).toEqual({ step: 2, completedMaps: 3 });
    celebrateAndShowMap(game);
    expect(game.session.shownMap()).toMatchObject({ from: 2, to: MAP_STEPS, reachedGoal: true });
  });

  it('mapa dokončená v Počítání půlku ve Znaménkách znovu nedá', () => {
    const page = freshPage();
    // Počítání dokončilo 1. mapu a nahlásilo ji klíčům.
    mapOf(page).save({ step: MAP_STEPS, completedMaps: 1 });
    keysOf(page).reportCompletedMaps(1);
    const game = openOn(page);
    expect(keysOf(page).balance().halves, 'otevření Znamének nic nepřidá').toBe(1);
    for (let row = 1; row < MAP_STEPS; row += 1) {
      expect(celebrateAndShowMap(game), `${row}. řada 2. mapy`).toBeNull();
      game.timers.advance(MAP_SHOW_MS);
    }
    expect(celebrateAndShowMap(game), 'cíl 2. mapy').toBe('wholeKey');
    expect(keysOf(page).balance().halves).toBe(2);
  });

  it('mapy dokončené dřív v jiné hře se ve Znaménkách započtou jednou a bez karty', () => {
    const page = freshPage();
    mapOf(page).save({ step: 1, completedMaps: 3 });
    const game = openOn(page);
    expect(keysOf(page).balance().halves).toBe(3);
    game.timers.advance(MAP_GOAL_SHOW_MS);
    expect(game.session.shownMap()).toBeNull();
    openOn(page);
    expect(keysOf(page).balance().halves).toBe(3);
  });

  it('bez klíčů od stránky mapa dojde do cíle bez půlky a bez chyby', () => {
    const rudy = new FakeRudy();
    const game = openCompare(undefined, undefined, rudy);
    for (let row = 0; row < MAP_STEPS; row += 1) {
      fillRow({ ...game, rudy, page: freshPage() });
      rudy.giveUp();
      waitUntil(game, () => game.session.shownMap() !== null);
      expect(game.session.goalKeyReward()).toBeNull();
      game.timers.advance(MAP_GOAL_SHOW_MS);
    }
    expect(game.session.mapProgress()).toEqual({ step: MAP_STEPS, completedMaps: 1 });
    expect(game.sounds.played).not.toContain('keyReward');
  });
});
