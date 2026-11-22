import { describe, expect, it } from 'vitest';

import {
  COUNTING_RUDY_LINES,
  countingRudyLines,
} from '../../../src/games/counting/logic/rudyLines';
import type { CountingRudyLine } from '../../../src/games/counting/logic/rudyLines';
import { PROFILE_COLORS } from '../../../src/shared/logic/profiles';
import { openProfiles } from '../../../src/shared/storage/profileStorage';
import type { ProfileStore } from '../../../src/shared/storage/profileStorage';
import { DeviceStorage, forbiddenStorage } from '../../shared/profileFixtures';

/**
 * Testy k #176 AC1 a AC2 pro Počítání (od #186 jen oslava, pozdrav není):
 * oslava má 3 varianty, střídají se v rámci profilu, takže stejná replika
 * nikdy nezazní dvakrát po sobě, a první v profilu je ta z #171.
 */

/** Úložiště hry aktivního profilu tak, jak ho stránka dá Počítání. */
function countingStorage(page: ProfileStore) {
  return page.gameStorage('counting');
}

/** Rudy oslaví po novém otevření hry; vrátí repliku. */
function openGameAndCelebrate(page: ProfileStore): CountingRudyLine {
  const lines = countingRudyLines(countingStorage(page));
  const line = lines.upcoming();
  lines.said(line);
  return line;
}

describe('#176 AC1, #186 AC5: Rudy má v Počítání 3 repliky oslavy', () => {
  it('oslava má 3 varianty, první je ta z #171; pozdravy nejsou', () => {
    expect(COUNTING_RUDY_LINES).toEqual(['celebration', 'celebrationStars', 'celebrationStar']);
  });
});

describe('#176 AC2: Rudy v Počítání neřekne stejnou repliku dvakrát po sobě', () => {
  it('první oslava v profilu je ta dnešní', () => {
    const page = openProfiles(new DeviceStorage());
    expect(openGameAndCelebrate(page)).toBe('celebration');
  });

  it('po sobě jdoucí oslavy se střídají a neopakují', () => {
    const page = openProfiles(new DeviceStorage());
    const celebrations = [1, 2, 3, 4].map(() => openGameAndCelebrate(page));
    expect(celebrations).toEqual([
      'celebration',
      'celebrationStars',
      'celebrationStar',
      'celebration',
    ]);
  });

  it('poslední varianta se pamatuje podle profilu: jiný profil začíná první', () => {
    const device = new DeviceStorage();
    const page = openProfiles(device);
    const ema = page.createProfile({ nickname: 'EMA', color: PROFILE_COLORS[1] });
    const ondra = page.createProfile({ nickname: 'ONDRA', color: PROFILE_COLORS[2] });
    page.selectProfile(ema.id);
    expect(openGameAndCelebrate(page)).toBe('celebration');
    page.selectProfile(ondra.id);
    expect(openGameAndCelebrate(page)).toBe('celebration');
    // Po novém načtení stránky si Ema pamatuje svou poslední oslavu.
    const reloaded = openProfiles(device);
    reloaded.selectProfile(ema.id);
    expect(openGameAndCelebrate(reloaded)).toBe('celebrationStars');
    // Záznam leží pod vnitřním označením profilu, nikdy s přezdívkou.
    const keys = [...device.data.keys()].filter((key) => key.includes('rudyLine'));
    expect(keys.length).toBe(2);
    expect(keys.every((key) => !key.includes('EMA') && !key.includes('ONDRA'))).toBe(true);
  });

  it('Rudy, který se neukázal, se nepočítá: příště přijde stejná replika', () => {
    const page = openProfiles(new DeviceStorage());
    const lines = countingRudyLines(countingStorage(page));
    expect(lines.upcoming()).toBe('celebration');
    // Stažení dopředu a Rudy řeknou totéž, dokud se Rudy neukáže.
    expect(lines.upcoming()).toBe('celebration');
  });

  it('poškozený záznam v profilu znamená první variantu', () => {
    const page = openProfiles(new DeviceStorage());
    countingStorage(page).setItem('rudyLine.celebration', 'nesmysl');
    expect(openGameAndCelebrate(page)).toBe('celebration');
  });

  it('zakázané úložiště: oslavy se střídají i po dalším otevření hry na stejné stránce', () => {
    const page = openProfiles(forbiddenStorage());
    const celebrations = [1, 2, 3].map(() => openGameAndCelebrate(page));
    expect(celebrations).toEqual(['celebration', 'celebrationStars', 'celebrationStar']);
  });

  it('plné úložiště: oslavy se střídají v paměti do zavření stránky, podle profilu', () => {
    const device = new DeviceStorage();
    const page = openProfiles(device);
    const ema = page.createProfile({ nickname: 'EMA', color: PROFILE_COLORS[1] });
    const ondra = page.createProfile({ nickname: 'ONDRA', color: PROFILE_COLORS[2] });
    device.failWrite = () => true;
    page.selectProfile(ema.id);
    expect(openGameAndCelebrate(page)).toBe('celebration');
    page.selectProfile(ondra.id);
    expect(openGameAndCelebrate(page)).toBe('celebration');
    page.selectProfile(ema.id);
    expect(openGameAndCelebrate(page)).toBe('celebrationStars');
  });
});
