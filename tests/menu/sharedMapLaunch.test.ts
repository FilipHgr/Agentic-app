import { afterEach, describe, expect, it, vi } from 'vitest';

import { GAMES } from '../../src/gameList';
import { launchGame } from '../../src/menu/ui/launchGame';
import type { GameEntry } from '../../src/shared/logic/gameRegistry';
import { isGameHost } from '../../src/shared/logic/gameHost';
import { serializeMapProgress } from '../../src/shared/logic/progressMap';
import type { MapProgressStore } from '../../src/shared/logic/progressMap';
import {
  LEGACY_MAP_GAME_ID,
  MAP_PROGRESS_AREA,
  MAP_PROGRESS_KEY,
} from '../../src/shared/storage/mapProgressStorage';
import { openProfiles } from '../../src/shared/storage/profileStorage';
import type { ProfileStore } from '../../src/shared/storage/profileStorage';
import { runGame } from '../../src/shared/ui/gameRunner';
import { ACTIVE_SOURCE } from '../shared/subscriptionFixtures';
import { DeviceStorage } from '../shared/profileFixtures';

/**
 * Testy k #193 AC1 a AC3 při spuštění hry z menu: každá hra dostane od
 * stránky mapu postupu aktivního profilu (`mapProgress`) ze společné oblasti
 * `MAP_PROGRESS_AREA`, ne ze svého úložiště, a při prvním spuštění se do ní
 * převede mapa, kterou do #193 ukládalo Počítání. Phaser hra (`runGame`)
 * je nahrazená záznamem spuštění.
 */

vi.mock('../../src/shared/ui/gameRunner', () => ({
  isGameModule: (value: unknown) =>
    typeof value === 'object' && value !== null && 'scenes' in value,
  runGame: vi.fn(),
}));

const LOADED_GAME = { scenes: ['ZkusebniScena'] };

function testGame(id: string): GameEntry {
  return {
    id,
    titleKey: `games.${id}.title`,
    categoryId: 'adding',
    symbol: '1+1',
    access: 'free',
    load: () => Promise.resolve(LOADED_GAME),
  };
}

/** Spustí hru `id` z menu v aktivním profilu stránky `page`; vrátí mapu, kterou hra dostala. */
function launch(page: ProfileStore, id: string): MapProgressStore {
  vi.mocked(runGame).mockClear();
  launchGame(testGame(id), LOADED_GAME, {
    closeMenu: () => undefined,
    returnToMenu: () => undefined,
    subscription: ACTIVE_SOURCE,
    gameStorage: (gameId) => page.gameStorage(gameId),
  });
  const options = vi.mocked(runGame).mock.calls[0]?.[1];
  if (options?.mapProgress === undefined) {
    throw new Error('hra nedostala mapu postupu');
  }
  return options.mapProgress;
}

afterEach(() => {
  vi.mocked(runGame).mockClear();
});

describe('#193 AC1: každá hra dostane jednu mapu profilu', () => {
  it('Počítání i Znaménka dostanou stejnou mapu: krok v jedné hře vidí druhá', () => {
    const page = openProfiles(new DeviceStorage());
    launch(page, 'compare').save({ step: 1, completedMaps: 0 });
    expect(launch(page, 'counting').load()).toEqual({ step: 1, completedMaps: 0 });
    launch(page, 'counting').save({ step: 2, completedMaps: 0 });
    expect(launch(page, 'compare').load()).toEqual({ step: 2, completedMaps: 0 });
  });

  it('mapa se uloží ve společné oblasti profilu, ne v úložišti hry', () => {
    const page = openProfiles(new DeviceStorage());
    launch(page, 'compare').save({ step: 1, completedMaps: 0 });
    expect(page.gameStorage(MAP_PROGRESS_AREA).getItem(MAP_PROGRESS_KEY)).not.toBeNull();
    expect(page.gameStorage('compare').getItem(MAP_PROGRESS_KEY)).toBeNull();
  });

  it('mapa od stránky má tvar, který hra přijme od hostitele', () => {
    const page = openProfiles(new DeviceStorage());
    const host = {
      attachSettingsGear: () => () => undefined,
      setHomeAvailable: () => undefined,
      onLeave: () => undefined,
      storage: undefined,
      mapProgress: launch(page, 'compare'),
    };
    expect(isGameHost(host)).toBe(true);
    expect(isGameHost({ ...host, mapProgress: { load: 'ne' } }), 'poškozená mapa').toBe(false);
  });

  it('žádná hra v seznamu her nemá označení oblasti mapy, aby si mapu nepřepsala jako svá data', () => {
    for (const game of GAMES) {
      expect(game.id, game.id).not.toBe(MAP_PROGRESS_AREA);
    }
  });
});

describe('#193 AC3: při prvním spuštění kterékoli hry se převede mapa Počítání', () => {
  it('první spuštěná hra po aktualizaci jsou Znaménka a pokračují z mapy Počítání', () => {
    const page = openProfiles(new DeviceStorage());
    page
      .gameStorage(LEGACY_MAP_GAME_ID)
      .setItem(MAP_PROGRESS_KEY, serializeMapProgress({ step: 2, completedMaps: 3 }));
    expect(launch(page, 'compare').load()).toEqual({ step: 2, completedMaps: 3 });
    expect(launch(page, 'counting').load()).toEqual({ step: 2, completedMaps: 3 });
  });

  it('po převodu se mapa Počítání už nečte: další kroky se neztratí ani nezdvojí', () => {
    const page = openProfiles(new DeviceStorage());
    page
      .gameStorage(LEGACY_MAP_GAME_ID)
      .setItem(MAP_PROGRESS_KEY, serializeMapProgress({ step: 1, completedMaps: 0 }));
    launch(page, 'counting').save({ step: 2, completedMaps: 0 });
    expect(launch(page, 'compare').load()).toEqual({ step: 2, completedMaps: 0 });
  });
});
