import { describe, expect, it } from 'vitest';

import { COMPARE_RUDY_LINES, compareRudyLines } from '../../../src/games/compare/logic/rudyLines';
import type { CompareRudyLine } from '../../../src/games/compare/logic/rudyLines';
import { PROFILE_COLORS } from '../../../src/shared/logic/profiles';
import { openProfiles } from '../../../src/shared/storage/profileStorage';
import type { ProfileStore } from '../../../src/shared/storage/profileStorage';
import { DeviceStorage, forbiddenStorage } from '../../shared/profileFixtures';

/**
 * Testy k #181 AC3 (od #186 jen oslava, pozdrav není) a #187 AC5: oslava
 * Rudyho v Porovnávání „kde je víc“ zmizela s otázkou víc/míň, zůstala
 * jediná oslava „Hurá! Máš deset hvězdiček!“. Střídání variant v profilu
 * (#176) s ní funguje dál a starší záznam s odebranou variantou nevadí.
 */

/** Úložiště hry aktivního profilu tak, jak ho stránka dá Porovnávání. */
function compareStorage(page: ProfileStore) {
  return page.gameStorage('compare');
}

/** Rudy oslaví po novém otevření hry; vrátí repliku. */
function openGameAndCelebrate(page: ProfileStore): CompareRudyLine {
  const lines = compareRudyLines(compareStorage(page));
  const line = lines.upcoming();
  lines.said(line);
  return line;
}

describe('#187 AC5: Rudy má v Porovnávání jen oslavu bez „víc“', () => {
  it('oslava je jediná a pozdravy nejsou', () => {
    expect(COMPARE_RUDY_LINES).toEqual(['celebration']);
  });

  it('po každé plné řadě Rudy řekne stejnou oslavu, i po dalším otevření hry', () => {
    const page = openProfiles(new DeviceStorage());
    const celebrations = [1, 2, 3].map(() => openGameAndCelebrate(page));
    expect(celebrations).toEqual(['celebration', 'celebration', 'celebration']);
  });

  it('profil, ve kterém naposledy zazněla odebraná oslava „kde je víc“, dostane oslavu bez chyby', () => {
    const device = new DeviceStorage();
    const page = openProfiles(device);
    compareStorage(page).setItem('rudyLine.celebration', 'celebrationMore');
    expect(openGameAndCelebrate(openProfiles(device))).toBe('celebration');
  });

  it('poslední oslava se pamatuje podle profilu, jen pod vnitřním označením', () => {
    const device = new DeviceStorage();
    const page = openProfiles(device);
    const ema = page.createProfile({ nickname: 'EMA', color: PROFILE_COLORS[1] });
    const ondra = page.createProfile({ nickname: 'ONDRA', color: PROFILE_COLORS[2] });
    page.selectProfile(ema.id);
    expect(openGameAndCelebrate(page)).toBe('celebration');
    page.selectProfile(ondra.id);
    expect(openGameAndCelebrate(page)).toBe('celebration');
    const keys = [...device.data.keys()].filter((key) => key.includes('rudyLine'));
    expect(keys.length).toBe(2);
    expect(keys.every((key) => !key.includes('EMA') && !key.includes('ONDRA'))).toBe(true);
  });

  it('zakázané úložiště: oslava zazní i po dalším otevření hry na stejné stránce', () => {
    const page = openProfiles(forbiddenStorage());
    const celebrations = [1, 2].map(() => openGameAndCelebrate(page));
    expect(celebrations).toEqual(['celebration', 'celebration']);
  });
});
