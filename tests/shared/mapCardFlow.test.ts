import { describe, expect, it } from 'vitest';

import type { KeyReward } from '../../src/shared/logic/keyRewards';
import {
  KEY_REWARD_APPEAR_MS,
  MARKER_ARRIVAL_MS,
  STARS_LANDED_MS,
} from '../../src/shared/logic/mapAnimation';
import { MAP_CLOSE_ANSWER_PAUSE_MS, createMapCardFlow } from '../../src/shared/logic/mapCardFlow';
import type { MapCardFlow } from '../../src/shared/logic/mapCardFlow';
import type { MapSoundName } from '../../src/shared/logic/mapSounds';
import { MAP_SHOW_MS, MAP_STEPS } from '../../src/shared/logic/progressMap';
import type { MapProgress } from '../../src/shared/logic/progressMap';
import { KEY_REWARDS_AREA, openKeyRewards } from '../../src/shared/storage/keyRewardsStorage';
import {
  LEGACY_MAP_GAME_ID,
  MAP_PROGRESS_AREA,
  openMapProgress,
} from '../../src/shared/storage/mapProgressStorage';
import { openProfiles } from '../../src/shared/storage/profileStorage';
import type { ProfileStore } from '../../src/shared/storage/profileStorage';
import { DeviceStorage } from './profileFixtures';

/**
 * Testy k #193 AC1, AC2 a AC4: karta s mapou po plné řadě je společná
 * všem hrám s hvězdičkami (`mapCardFlow.ts`). Každá „hra“ je tu jedno
 * sezení karty nad mapou a klíči aktivního profilu, jak je stránka dá hře
 * při spuštění; časy jsou stejné jako v Počítání (#145, #154), chování
 * Počítání a Znamének ověřují testy her.
 */

class Clock {
  private nowMs = 0;
  private nextId = 0;
  private readonly pending = new Map<number, { dueMs: number; callback: () => void }>();

  readonly after = (ms: number, callback: () => void): (() => void) => {
    const id = this.nextId;
    this.nextId += 1;
    this.pending.set(id, { dueMs: this.nowMs + ms, callback });
    return () => {
      this.pending.delete(id);
    };
  };

  advance(ms: number): void {
    const endMs = this.nowMs + ms;
    for (;;) {
      const next = [...this.pending.entries()]
        .map(([id, entry]) => ({ id, ...entry }))
        .sort((a, b) => a.dueMs - b.dueMs || a.id - b.id)[0];
      if (next === undefined || next.dueMs > endMs) {
        break;
      }
      this.pending.delete(next.id);
      this.nowMs = next.dueMs;
      next.callback();
    }
    this.nowMs = endMs;
  }

  now(): number {
    return this.nowMs;
  }
}

interface GameCard {
  readonly flow: MapCardFlow;
  readonly clock: Clock;
  readonly sounds: Array<{ readonly name: MapSoundName; readonly atMs: number }>;
  readonly events: string[];
}

/** Jedno spuštění hry s kartou mapy nad mapou a klíči aktivního profilu stránky `page`. */
function launchGame(page: ProfileStore): GameCard {
  const clock = new Clock();
  const sounds: Array<{ readonly name: MapSoundName; readonly atMs: number }> = [];
  const events: string[] = [];
  const flow = createMapCardFlow({
    mapProgress: openMapProgress(
      page.gameStorage(MAP_PROGRESS_AREA),
      page.gameStorage(LEGACY_MAP_GAME_ID),
    ),
    keyRewards: openKeyRewards(page.gameStorage(KEY_REWARDS_AREA)),
    timers: clock,
    playSound: (name) => sounds.push({ name, atMs: clock.now() }),
    events: {
      onShown: () => events.push('shown'),
      onStarsLanded: () => events.push('landed'),
      onHidden: () => events.push('hidden'),
    },
  });
  return { flow, clock, sounds, events };
}

/** Plná řada: krok, karta a karta se po 7 s sama zavře; vrátí, co dal cíl. */
function fullRow(game: GameCard): KeyReward | null {
  game.flow.step();
  game.flow.show();
  const reward = game.flow.goalKeyReward();
  game.clock.advance(MAP_SHOW_MS);
  return reward;
}

function halves(page: ProfileStore): number {
  return openKeyRewards(page.gameStorage(KEY_REWARDS_AREA)).balance().halves;
}

describe('#193 AC1: krok v jedné hře pokračuje v druhé', () => {
  it('plná řada ve Znaménkách posune značku a Počítání pokračuje o krok dál', () => {
    const page = openProfiles(new DeviceStorage());
    const compare = launchGame(page);
    fullRow(compare);
    expect(compare.flow.mapProgress()).toEqual({ step: 1, completedMaps: 0 });

    const counting = launchGame(page);
    expect(counting.flow.mapProgress(), 'Počítání začne na kroku ze Znamének').toEqual({
      step: 1,
      completedMaps: 0,
    });
    counting.flow.step();
    expect(counting.flow.shownMove(), 'karta ještě není').toBeNull();
    counting.flow.show();
    expect(counting.flow.shownMove()).toMatchObject({ from: 1, to: 2, reachedGoal: false });
  });

  it('dvě rozehrané hry vedle sebe sdílí mapu: řada v jedné posune i druhou', () => {
    const page = openProfiles(new DeviceStorage());
    const counting = launchGame(page);
    const compare = launchGame(page);
    fullRow(counting);
    compare.flow.step();
    compare.flow.show();
    expect(compare.flow.shownMove()).toMatchObject({ from: 1, to: 2 });
    expect(counting.flow.mapProgress(), 'mapa Počítání se přečte při další řadě').toEqual({
      step: 1,
      completedMaps: 0,
    });
    counting.clock.advance(MAP_SHOW_MS);
    counting.flow.step();
    counting.flow.show();
    expect(counting.flow.shownMove(), 'další řada v Počítání jde do cíle').toMatchObject({
      from: 2,
      to: MAP_STEPS,
      reachedGoal: true,
    });
  });
});

describe('#193 AC4: půlka klíče za každou dokončenou mapu, ať ji dokončila kterákoli hra', () => {
  it('mapy dokončené střídavě v obou hrách dají půlku za každou a cíl ukáže, co přibylo', () => {
    const page = openProfiles(new DeviceStorage());
    const rewards: Array<KeyReward | null> = [];
    for (let row = 0; row < 2 * MAP_STEPS; row += 1) {
      // Hry se střídají po každé řadě.
      rewards.push(fullRow(launchGame(page)));
    }
    expect(rewards).toEqual([null, null, 'half', null, null, 'wholeKey']);
    expect(halves(page)).toBe(2);
  });

  it('za stejnou mapu je půlka jen jednou, i když hra otevřená vedle ji vidí taky', () => {
    const page = openProfiles(new DeviceStorage());
    const first = launchGame(page);
    fullRow(first);
    fullRow(first);
    const other = launchGame(page);
    expect(fullRow(first), 'cíl v první hře').toBe('half');
    const again = launchGame(page);
    expect(halves(page), 'otevření další hry půlku nepřidá').toBe(1);
    expect(fullRow(other), 'druhá hra pokračuje další mapou').toBeNull();
    expect(fullRow(again)).toBeNull();
    expect(halves(page)).toBe(1);
  });

  it('mapy dokončené před #139 a v jiné hře se započtou jednou při otevření kterékoli hry', () => {
    const page = openProfiles(new DeviceStorage());
    const progress: MapProgress = { step: 1, completedMaps: 3 };
    openMapProgress(page.gameStorage(MAP_PROGRESS_AREA)).save(progress);
    launchGame(page);
    expect(halves(page)).toBe(3);
    launchGame(page);
    expect(halves(page), 'další otevření nic nepřidá').toBe(3);
  });
});

describe('#193 AC2: karta má v každé hře stejné časy jako v Počítání (#145, #154)', () => {
  /** Hra s mapou těsně před cílem. */
  function beforeGoal(): GameCard {
    const page = openProfiles(new DeviceStorage());
    openMapProgress(page.gameStorage(MAP_PROGRESS_AREA)).save({ step: 2, completedMaps: 0 });
    return launchGame(page);
  }

  it('hvězdičky doletí, značka dojde a v cíli zazní melodie a tón půlky klíče', () => {
    const game = beforeGoal();
    game.flow.step();
    game.flow.show();
    expect(game.flow.goalKeyReward()).toBe('half');
    game.clock.advance(MAP_SHOW_MS);
    expect(game.events).toEqual(['shown', 'landed', 'hidden']);
    expect(game.sounds).toEqual([
      { name: 'mapGoal', atMs: MARKER_ARRIVAL_MS },
      { name: 'keyReward', atMs: KEY_REWARD_APPEAR_MS },
    ]);
  });

  it('řada je prázdná, až když hvězdičky doletí do karty', () => {
    const game = beforeGoal();
    game.flow.step();
    game.flow.show();
    game.clock.advance(STARS_LANDED_MS - 1);
    expect(game.events).toEqual(['shown']);
    game.clock.advance(1);
    expect(game.events).toEqual(['shown', 'landed']);
  });

  it('předčasné ťuknutí kartu nezavře, po doběhnutí animace ji ťuknutí zavře', () => {
    const game = beforeGoal();
    game.flow.step();
    game.flow.show();
    expect(game.flow.tap()).toBe('tooEarly');
    game.clock.advance(MAP_SHOW_MS - 1);
    expect(game.flow.tap()).toBe('closed');
    expect(game.events.at(-1)).toBe('hidden');
    game.clock.advance(MAP_SHOW_MS);
    expect(
      game.events.filter((event) => event === 'hidden'),
      'zavře se jen jednou',
    ).toHaveLength(1);
  });

  it('chvíli po zavření ťuknutím se neodpovídá, pak hned ano', () => {
    const game = beforeGoal();
    game.flow.step();
    game.flow.show();
    expect(game.flow.blocksAnswers(), 'během karty').toBe(true);
    game.clock.advance(MAP_SHOW_MS - 1);
    game.flow.tap();
    expect(game.flow.blocksAnswers(), 'hned po zavření').toBe(true);
    game.clock.advance(MAP_CLOSE_ANSWER_PAUSE_MS);
    expect(game.flow.blocksAnswers()).toBe(false);
  });

  it('přerušení před doletem hvězdiček nechá krok čekat na nové ukázání, po doletu ne', () => {
    const early = beforeGoal();
    early.flow.step();
    early.flow.show();
    expect(early.flow.stop()).toBe(true);
    expect(early.flow.hasMoveToShow(), 'hvězdičky ještě nedoletěly').toBe(true);
    early.clock.advance(MAP_SHOW_MS);
    expect(early.sounds, 'po přerušení nic nezazní').toEqual([]);

    const late = beforeGoal();
    late.flow.step();
    late.flow.show();
    late.clock.advance(STARS_LANDED_MS);
    late.flow.stop();
    expect(late.flow.hasMoveToShow(), 'hvězdičky už doletěly').toBe(false);
    expect(late.flow.mapProgress(), 'krok zůstal započtený').toEqual({
      step: MAP_STEPS,
      completedMaps: 1,
    });
  });

  it('po odchodu z hry se nic nedohraje ani neukáže', () => {
    const game = beforeGoal();
    game.flow.step();
    game.flow.leave();
    expect(game.flow.show()).toBe(false);
    game.clock.advance(MAP_SHOW_MS);
    expect(game.events).toEqual([]);
    expect(game.sounds).toEqual([]);
  });
});
