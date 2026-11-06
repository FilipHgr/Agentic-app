import { describe, expect, it } from 'vitest';

import { MAX_PROFILES, createProfileScreens } from '../../src/menu/logic/profileScreens';
import { PROFILE_COLORS } from '../../src/shared/logic/profiles';
import { openProfiles } from '../../src/shared/storage/profileStorage';
import type { ProfileStore } from '../../src/shared/storage/profileStorage';
import { DeviceStorage } from '../shared/profileFixtures';

/**
 * Test k #75 AC7: když dva panely dohromady založí víc než 6 profilů,
 * „+“ se na výběru profilu neukáže. Dva panely jsou dvě volání
 * `openProfiles` nad jedním úložištěm, další `openProfiles` je nové
 * načtení stránky. Jak se víc než 6 profilů zobrazí, řeší samostatný úkol.
 */

function canAddProfile(store: ProfileStore): boolean {
  const screens = createProfileScreens({
    profiles: store,
    feedback: () => undefined,
    onProfileChosen: () => undefined,
  });
  screens.open();
  return screens.canAddProfile();
}

/** Zařízení se 4 profily a dva panely otevřené nad ním. */
function twoPanelsWithFourProfiles(): {
  storage: DeviceStorage;
  panel1: ProfileStore;
  panel2: ProfileStore;
} {
  const storage = new DeviceStorage();
  const setup = openProfiles(storage);
  for (const nickname of ['EMA', 'TOM', 'ANA']) {
    setup.createProfile({ nickname, color: PROFILE_COLORS[1] });
  }
  return { storage, panel1: openProfiles(storage), panel2: openProfiles(storage) };
}

describe('#75 AC7: „+“ nad limitem 6 profilů ze dvou panelů', () => {
  it('po novém načtení se 7 profily ze dvou panelů se „+“ neukáže', () => {
    const { storage, panel1, panel2 } = twoPanelsWithFourProfiles();

    panel1.createProfile({ nickname: 'BEA', color: PROFILE_COLORS[2] });
    panel1.createProfile({ nickname: 'CYRIL', color: PROFILE_COLORS[3] });
    panel2.createProfile({ nickname: 'DAN', color: PROFILE_COLORS[4] });

    const reloaded = openProfiles(storage);
    expect(reloaded.profiles().length).toBeGreaterThan(MAX_PROFILES);
    expect(canAddProfile(reloaded)).toBe(false);
  });

  it('v panelu, který limit překročil, se po jeho vlastní změně „+“ neukáže', () => {
    const { panel1, panel2 } = twoPanelsWithFourProfiles();

    panel1.createProfile({ nickname: 'BEA', color: PROFILE_COLORS[2] });
    panel1.createProfile({ nickname: 'CYRIL', color: PROFILE_COLORS[3] });
    panel2.createProfile({ nickname: 'DAN', color: PROFILE_COLORS[4] });

    expect(canAddProfile(panel2)).toBe(false);
  });
});
