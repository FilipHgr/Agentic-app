import { describe, expect, it } from 'vitest';

import { COMPARE_RUDY_LINES, compareRudyLines } from '../../../src/games/compare/logic/rudyLines';
import type { CompareRudyLine } from '../../../src/games/compare/logic/rudyLines';
import { PROFILE_COLORS } from '../../../src/shared/logic/profiles';
import { openProfiles } from '../../../src/shared/storage/profileStorage';
import type { ProfileStore } from '../../../src/shared/storage/profileStorage';
import { DeviceStorage, forbiddenStorage } from '../../shared/profileFixtures';

/**
 * Testy k #181 AC3 (od #186 jen oslava, pozdrav není): oslava Rudyho
 * v Porovnávání má 2 varianty, které se v profilu střídají jako v #176,
 * takže stejná replika nikdy nezazní dvakrát po sobě.
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

describe('#181 AC3, #186 AC5: Rudy má v Porovnávání 2 varianty oslavy', () => {
  it('oslava má 2 varianty, pozdravy nejsou', () => {
    expect(COMPARE_RUDY_LINES).toEqual(['celebration', 'celebrationMore']);
  });
});

describe('#181 AC3: Rudy v Porovnávání neřekne stejnou repliku dvakrát po sobě', () => {
  it('po sobě jdoucí oslavy se střídají a neopakují', () => {
    const page = openProfiles(new DeviceStorage());
    const celebrations = [1, 2, 3].map(() => openGameAndCelebrate(page));
    expect(celebrations).toEqual(['celebration', 'celebrationMore', 'celebration']);
  });

  it('poslední varianta se pamatuje podle profilu, jen pod vnitřním označením', () => {
    const device = new DeviceStorage();
    const page = openProfiles(device);
    const ema = page.createProfile({ nickname: 'EMA', color: PROFILE_COLORS[1] });
    const ondra = page.createProfile({ nickname: 'ONDRA', color: PROFILE_COLORS[2] });
    page.selectProfile(ema.id);
    expect(openGameAndCelebrate(page)).toBe('celebration');
    page.selectProfile(ondra.id);
    expect(openGameAndCelebrate(page), 'jiný profil začíná první').toBe('celebration');
    const reloaded = openProfiles(device);
    reloaded.selectProfile(ema.id);
    expect(openGameAndCelebrate(reloaded)).toBe('celebrationMore');
    const keys = [...device.data.keys()].filter((key) => key.includes('rudyLine'));
    expect(keys.length).toBe(2);
    expect(keys.every((key) => !key.includes('EMA') && !key.includes('ONDRA'))).toBe(true);
  });

  it('Rudy, který se neukázal, se nepočítá: příště přijde stejná replika', () => {
    const page = openProfiles(new DeviceStorage());
    const lines = compareRudyLines(compareStorage(page));
    expect(lines.upcoming()).toBe('celebration');
    expect(lines.upcoming()).toBe('celebration');
  });

  it('zakázané úložiště: oslavy se střídají i po dalším otevření hry na stejné stránce', () => {
    const page = openProfiles(forbiddenStorage());
    const celebrations = [1, 2, 3].map(() => openGameAndCelebrate(page));
    expect(celebrations).toEqual(['celebration', 'celebrationMore', 'celebration']);
  });
});
