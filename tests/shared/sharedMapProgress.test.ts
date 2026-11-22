import { describe, expect, it } from 'vitest';

import { MAP_STEPS, START_MAP, serializeMapProgress } from '../../src/shared/logic/progressMap';
import type { MapProgress } from '../../src/shared/logic/progressMap';
import { PROFILE_COLORS } from '../../src/shared/logic/profiles';
import {
  LEGACY_MAP_GAME_ID,
  MAP_PROGRESS_AREA,
  MAP_PROGRESS_KEY,
  loadMapProgress,
  openMapProgress,
} from '../../src/shared/storage/mapProgressStorage';
import type { MapProgressStore } from '../../src/shared/storage/mapProgressStorage';
import { openProfiles } from '../../src/shared/storage/profileStorage';
import type { ProfileStore } from '../../src/shared/storage/profileStorage';
import { DeviceStorage, forbiddenStorage, profileDataKeys } from './profileFixtures';

/**
 * Testy k #193 AC1 a AC3: mapa postupu patří profilu, ne hře. Stránka dá
 * každé hře mapu aktivního profilu ze společné oblasti `MAP_PROGRESS_AREA`
 * (`openMapProgress`, jako při spuštění z menu) a při prvním otevření do ní
 * převede mapu, kterou do #193 ukládalo Počítání ve svém úložišti hry.
 * Jedno „načtení stránky“ je `openProfiles(storage)`, jedno spuštění hry
 * je nové `openMapProgress`.
 */

/** Mapa aktivního profilu, jak ji stránka dá hře při spuštění. */
function launchMap(page: ProfileStore): MapProgressStore {
  return openMapProgress(page.gameStorage(MAP_PROGRESS_AREA), page.gameStorage(LEGACY_MAP_GAME_ID));
}

/** Postup, který Počítání uložilo do #193 ve svém úložišti hry. */
function saveCountingMap(page: ProfileStore, map: MapProgress): void {
  page.gameStorage(LEGACY_MAP_GAME_ID).setItem(MAP_PROGRESS_KEY, serializeMapProgress(map));
}

/** Jedna plná řada v kterékoli hře: krok na mapě profilu (jako `stepOnMap` ve hře). */
function stepIn(page: ProfileStore): MapProgress {
  const map = launchMap(page);
  const now = map.load();
  const from = now.step >= MAP_STEPS ? 0 : now.step;
  const next = {
    step: from + 1,
    completedMaps: from + 1 === MAP_STEPS ? now.completedMaps + 1 : now.completedMaps,
  };
  map.save(next);
  return next;
}

const SAVED_MAPS: readonly MapProgress[] = [
  { step: 1, completedMaps: 0 },
  { step: 2, completedMaps: 0 },
  { step: MAP_STEPS, completedMaps: 1 },
  { step: 1, completedMaps: 4 },
  { step: 2, completedMaps: 13 },
];

describe('#193 AC3: mapa z Počítání se převede do mapy profilu beze ztráty', () => {
  it('po aktualizaci stojí značka na stejném kroku a s dokončenými mapami jako dřív v Počítání', () => {
    for (const saved of SAVED_MAPS) {
      const page = openProfiles(new DeviceStorage());
      saveCountingMap(page, saved);
      expect(launchMap(page).load(), JSON.stringify(saved)).toEqual(saved);
    }
  });

  it('mapa ve starém tvaru z #87 (8 kroků) se převede na 3 kroky s dokončenými mapami', () => {
    const page = openProfiles(new DeviceStorage());
    page
      .gameStorage(LEGACY_MAP_GAME_ID)
      .setItem(MAP_PROGRESS_KEY, JSON.stringify({ step: 5, completedMaps: 2 }));
    expect(launchMap(page).load()).toEqual({ step: 2, completedMaps: 2 });
  });

  it('převod se uloží hned při prvním spuštění kterékoli hry, i když dítě nic nevyřeší', () => {
    const storage = new DeviceStorage();
    const page = openProfiles(storage);
    saveCountingMap(page, { step: 2, completedMaps: 3 });
    launchMap(page).load();

    const reloaded = openProfiles(storage);
    expect(loadMapProgress(reloaded.gameStorage(MAP_PROGRESS_AREA))).toEqual({
      step: 2,
      completedMaps: 3,
    });
  });

  it('převod proběhne jen jednou: další spuštění ani obnovení stránky krok nezdvojí', () => {
    const storage = new DeviceStorage();
    saveCountingMap(openProfiles(storage), { step: 2, completedMaps: 3 });
    for (let launch = 1; launch <= 4; launch += 1) {
      expect(launchMap(openProfiles(storage)).load(), `${launch}. spuštění`).toEqual({
        step: 2,
        completedMaps: 3,
      });
    }
  });

  it('po převodu jde dítě dál z převedeného kroku a krok se při dalším spuštění nepřevede znovu', () => {
    const storage = new DeviceStorage();
    saveCountingMap(openProfiles(storage), { step: 2, completedMaps: 3 });
    expect(stepIn(openProfiles(storage)), 'cíl 4. mapy').toEqual({
      step: MAP_STEPS,
      completedMaps: 4,
    });
    expect(stepIn(openProfiles(storage)), '1. zastávka 5. mapy').toEqual({
      step: 1,
      completedMaps: 4,
    });
    expect(launchMap(openProfiles(storage)).load()).toEqual({ step: 1, completedMaps: 4 });
  });

  it('krok ve Znaménkách hned po aktualizaci pokračuje z mapy Počítání, nic se neztratí', () => {
    const page = openProfiles(new DeviceStorage());
    saveCountingMap(page, { step: 1, completedMaps: 2 });
    // První spuštěná hra po aktualizaci jsou Znaménka.
    expect(stepIn(page)).toEqual({ step: 2, completedMaps: 2 });
    expect(launchMap(page).load(), 'Počítání potom').toEqual({ step: 2, completedMaps: 2 });
  });

  it('profil bez mapy v Počítání začíná na startu první mapy', () => {
    const page = openProfiles(new DeviceStorage());
    expect(launchMap(page).load()).toEqual(START_MAP);
  });

  it('každý profil se převádí zvlášť ze své mapy Počítání', () => {
    const storage = new DeviceStorage();
    const page = openProfiles(storage);
    const first = page.activeProfile();
    saveCountingMap(page, { step: 1, completedMaps: 2 });
    const second = page.createProfile({ nickname: 'BETA', color: PROFILE_COLORS[1] });
    page.selectProfile(second.id);
    saveCountingMap(page, { step: 2, completedMaps: 5 });

    page.selectProfile(first.id);
    expect(launchMap(page).load(), 'první profil').toEqual({ step: 1, completedMaps: 2 });
    page.selectProfile(second.id);
    expect(launchMap(page).load(), 'druhý profil').toEqual({ step: 2, completedMaps: 5 });
  });
});

describe('#193 AC1: jedna mapa postupu patří profilu, ne hře', () => {
  it('krok získaný v jedné hře pokračuje v druhé hře a naopak', () => {
    const storage = new DeviceStorage();
    const page = openProfiles(storage);
    const compareMap = launchMap(page);
    const countingMap = launchMap(page);

    compareMap.save({ step: 1, completedMaps: 0 });
    expect(countingMap.load(), 'Počítání vidí krok ze Znamének').toEqual({
      step: 1,
      completedMaps: 0,
    });
    countingMap.save({ step: 2, completedMaps: 0 });
    expect(compareMap.load(), 'Znaménka vidí krok z Počítání').toEqual({
      step: 2,
      completedMaps: 0,
    });
    expect(launchMap(openProfiles(storage)).load(), 'po obnovení stránky').toEqual({
      step: 2,
      completedMaps: 0,
    });
  });

  it('mapa profilu neleží v úložišti žádné hry, jen ve společné oblasti profilu', () => {
    const storage = new DeviceStorage();
    const page = openProfiles(storage);
    stepIn(page);
    const profileId = page.activeProfile().id;
    const mapKeys = profileDataKeys(storage, profileId).filter((key) =>
      key.endsWith(MAP_PROGRESS_KEY),
    );
    expect(mapKeys).toEqual([
      `agentic-app.profile.${profileId}.${MAP_PROGRESS_AREA}.${MAP_PROGRESS_KEY}`,
    ]);
  });

  it('jiný profil má vlastní mapu a jeho kroky mapu prvního profilu nezmění', () => {
    const storage = new DeviceStorage();
    const page = openProfiles(storage);
    const first = page.activeProfile();
    stepIn(page);
    const second = page.createProfile({ nickname: 'GAMA', color: PROFILE_COLORS[2] });
    page.selectProfile(second.id);
    expect(launchMap(page).load(), 'nový profil na startu').toEqual(START_MAP);
    stepIn(page);
    stepIn(page);

    page.selectProfile(first.id);
    expect(launchMap(page).load()).toEqual({ step: 1, completedMaps: 0 });
  });

  it('smazáním profilu zmizí i jeho mapa', () => {
    const storage = new DeviceStorage();
    const page = openProfiles(storage);
    const keeper = page.activeProfile();
    const removed = page.createProfile({ nickname: 'EMA', color: PROFILE_COLORS[3] });
    page.selectProfile(removed.id);
    stepIn(page);
    page.selectProfile(keeper.id);
    expect(page.deleteProfile(removed.id)).toBe(true);
    expect(profileDataKeys(storage, removed.id)).toEqual([]);
  });

  it('přezdívka se s mapou nikde neuloží', () => {
    const storage = new DeviceStorage();
    const page = openProfiles(storage);
    page.updateProfile(page.activeProfile().id, { nickname: 'ZORKA', color: PROFILE_COLORS[0] });
    stepIn(page);
    const mapEntries = [...storage.data.entries()].filter(([key]) =>
      key.includes(MAP_PROGRESS_AREA),
    );
    expect(mapEntries.length).toBeGreaterThan(0);
    for (const [key, value] of mapEntries) {
      expect(key, key).not.toContain('ZORKA');
      expect(value, key).not.toContain('ZORKA');
    }
  });

  it('dva panely se stejným profilem vidí stejnou mapu, mapa nikdy necouvne', () => {
    const storage = new DeviceStorage();
    const firstPanel = launchMap(openProfiles(storage));
    const secondPanel = launchMap(openProfiles(storage));
    firstPanel.save({ step: 2, completedMaps: 1 });
    expect(secondPanel.load()).toEqual({ step: 2, completedMaps: 1 });
  });
});

describe('#193 AC1: mapa bez úložiště nebo s plným úložištěm hru nezastaví', () => {
  it('krok, který se nepodaří uložit, platí do návratu do menu a hra nevidí chybu', () => {
    const storage = new DeviceStorage();
    const page = openProfiles(storage);
    storage.failWrite = (key) => key.includes(MAP_PROGRESS_AREA);
    const map = launchMap(page);
    expect(() => map.save({ step: 1, completedMaps: 0 })).not.toThrow();
    expect(map.load()).toEqual({ step: 1, completedMaps: 0 });
    expect(launchMap(page).load(), 'další spuštění do zavření stránky').toEqual({
      step: 1,
      completedMaps: 0,
    });
  });

  it('zakázané úložiště dá start a mapa jede v paměti', () => {
    const map = openMapProgress(forbiddenStorage(), forbiddenStorage());
    expect(() => map.load()).not.toThrow();
    expect(map.load()).toEqual(START_MAP);
    map.save({ step: 2, completedMaps: 0 });
    expect(map.load()).toEqual({ step: 2, completedMaps: 0 });
  });

  it('hra spuštěná bez stránky má mapu jen v paměti', () => {
    const map = openMapProgress(undefined);
    expect(map.load()).toEqual(START_MAP);
    expect(map.save({ step: 1, completedMaps: 0 })).toBe(false);
    expect(map.load()).toEqual({ step: 1, completedMaps: 0 });
  });
});
