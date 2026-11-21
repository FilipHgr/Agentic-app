import { describe, expect, it } from 'vitest';

import {
  COUNTING_RUDY_CELEBRATIONS,
  COUNTING_RUDY_GREETINGS,
  countingRudyLines,
} from '../../../src/games/counting/logic/rudyLines';
import type { CountingRudyLine } from '../../../src/games/counting/logic/rudyLines';
import type { RudyLineMove } from '../../../src/shared/logic/rudy';
import { PROFILE_COLORS } from '../../../src/shared/logic/profiles';
import { openProfiles } from '../../../src/shared/storage/profileStorage';
import type { ProfileStore } from '../../../src/shared/storage/profileStorage';
import { DeviceStorage, forbiddenStorage } from '../../shared/profileFixtures';

/**
 * Testy k #176 AC1 a AC2 pro Počítání: pozdrav má 2 varianty, oslava 3,
 * střídají se v rámci profilu a druhu chvíle, takže stejná replika nikdy
 * nezazní dvakrát po sobě, a první v profilu je ta z #171.
 */

/** Úložiště hry aktivního profilu tak, jak ho stránka dá Počítání. */
function countingStorage(page: ProfileStore) {
  return page.gameStorage('counting');
}

/** Rudy ukáže okno k pohybu `move` po novém otevření hry; vrátí repliku. */
function openGameAndShow(page: ProfileStore, move: RudyLineMove): CountingRudyLine {
  const lines = countingRudyLines(countingStorage(page));
  const line = lines.upcoming(move);
  lines.said(move, line);
  return line;
}

describe('#176 AC1: Rudy má v Počítání víc replik', () => {
  it('pozdrav má 2 varianty a oslava 3, první jsou ty z #171', () => {
    expect(COUNTING_RUDY_GREETINGS).toEqual(['greeting', 'greetingAgain']);
    expect(COUNTING_RUDY_CELEBRATIONS).toEqual([
      'celebration',
      'celebrationStars',
      'celebrationStar',
    ]);
  });
});

describe('#176 AC2: Rudy v Počítání neřekne stejnou repliku dvakrát po sobě', () => {
  it('první pozdrav a první oslava v profilu jsou ty dnešní', () => {
    const page = openProfiles(new DeviceStorage());
    expect(openGameAndShow(page, 'wave')).toBe('greeting');
    expect(openGameAndShow(page, 'celebrate')).toBe('celebration');
  });

  it('po sobě jdoucí pozdravy i oslavy se střídají a neopakují', () => {
    const page = openProfiles(new DeviceStorage());
    const greetings = [1, 2, 3, 4].map(() => openGameAndShow(page, 'wave'));
    const celebrations = [1, 2, 3, 4].map(() => openGameAndShow(page, 'celebrate'));
    expect(greetings).toEqual(['greeting', 'greetingAgain', 'greeting', 'greetingAgain']);
    expect(celebrations).toEqual([
      'celebration',
      'celebrationStars',
      'celebrationStar',
      'celebration',
    ]);
  });

  it('pozdrav a oslava se střídají každý zvlášť (druh chvíle)', () => {
    const page = openProfiles(new DeviceStorage());
    openGameAndShow(page, 'wave');
    expect(openGameAndShow(page, 'celebrate')).toBe('celebration');
    expect(openGameAndShow(page, 'wave')).toBe('greetingAgain');
  });

  it('poslední varianta se pamatuje podle profilu: jiný profil začíná první', () => {
    const device = new DeviceStorage();
    const page = openProfiles(device);
    const ema = page.createProfile({ nickname: 'EMA', color: PROFILE_COLORS[1] });
    const ondra = page.createProfile({ nickname: 'ONDRA', color: PROFILE_COLORS[2] });
    page.selectProfile(ema.id);
    expect(openGameAndShow(page, 'wave')).toBe('greeting');
    page.selectProfile(ondra.id);
    expect(openGameAndShow(page, 'wave')).toBe('greeting');
    // Po novém načtení stránky si Ema pamatuje svůj poslední pozdrav.
    const reloaded = openProfiles(device);
    reloaded.selectProfile(ema.id);
    expect(openGameAndShow(reloaded, 'wave')).toBe('greetingAgain');
    // Záznam leží pod vnitřním označením profilu, nikdy s přezdívkou.
    const keys = [...device.data.keys()].filter((key) => key.includes('rudyLine'));
    expect(keys.length).toBe(2);
    expect(keys.every((key) => !key.includes('EMA') && !key.includes('ONDRA'))).toBe(true);
  });

  it('okno, které se neukázalo, se nepočítá: příště přijde stejná replika', () => {
    const page = openProfiles(new DeviceStorage());
    const lines = countingRudyLines(countingStorage(page));
    expect(lines.upcoming('celebrate')).toBe('celebration');
    // Stažení dopředu a okno řeknou totéž, dokud se okno neukáže.
    expect(lines.upcoming('celebrate')).toBe('celebration');
  });

  it('poškozený záznam v profilu znamená první variantu', () => {
    const page = openProfiles(new DeviceStorage());
    countingStorage(page).setItem('rudyLine.celebration', 'nesmysl');
    expect(openGameAndShow(page, 'celebrate')).toBe('celebration');
  });

  it('zakázané úložiště: pozdravy se střídají i po dalším otevření hry na stejné stránce', () => {
    const page = openProfiles(forbiddenStorage());
    const greetings = [1, 2, 3].map(() => openGameAndShow(page, 'wave'));
    expect(greetings).toEqual(['greeting', 'greetingAgain', 'greeting']);
  });

  it('plné úložiště: oslavy se střídají v paměti do zavření stránky, podle profilu', () => {
    const device = new DeviceStorage();
    const page = openProfiles(device);
    const ema = page.createProfile({ nickname: 'EMA', color: PROFILE_COLORS[1] });
    const ondra = page.createProfile({ nickname: 'ONDRA', color: PROFILE_COLORS[2] });
    device.failWrite = () => true;
    page.selectProfile(ema.id);
    expect(openGameAndShow(page, 'celebrate')).toBe('celebration');
    page.selectProfile(ondra.id);
    expect(openGameAndShow(page, 'celebrate')).toBe('celebration');
    page.selectProfile(ema.id);
    expect(openGameAndShow(page, 'celebrate')).toBe('celebrationStars');
  });
});
