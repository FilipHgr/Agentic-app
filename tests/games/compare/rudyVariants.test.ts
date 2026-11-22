import { describe, expect, it } from 'vitest';

import {
  COMPARE_RUDY_CELEBRATIONS,
  COMPARE_RUDY_GREETINGS,
  compareRudyLines,
} from '../../../src/games/compare/logic/rudyLines';
import type { CompareRudyLine } from '../../../src/games/compare/logic/rudyLines';
import type { RudyLineMove } from '../../../src/shared/logic/rudy';
import { PROFILE_COLORS } from '../../../src/shared/logic/profiles';
import { openProfiles } from '../../../src/shared/storage/profileStorage';
import type { ProfileStore } from '../../../src/shared/storage/profileStorage';
import { DeviceStorage, forbiddenStorage } from '../../shared/profileFixtures';

/**
 * Testy k #181 AC3: pozdrav i oslava Rudyho v Porovnávání mají po 2
 * variantách, které se v profilu střídají jako v #176, takže stejná
 * replika nikdy nezazní dvakrát po sobě.
 */

/** Úložiště hry aktivního profilu tak, jak ho stránka dá Porovnávání. */
function compareStorage(page: ProfileStore) {
  return page.gameStorage('compare');
}

/** Rudy ukáže okno k pohybu `move` po novém otevření hry; vrátí repliku. */
function openGameAndShow(page: ProfileStore, move: RudyLineMove): CompareRudyLine {
  const lines = compareRudyLines(compareStorage(page));
  const line = lines.upcoming(move);
  lines.said(move, line);
  return line;
}

describe('#181 AC3: Rudy má v Porovnávání po 2 variantách pozdravu a oslavy', () => {
  it('pozdrav i oslava mají 2 varianty', () => {
    expect(COMPARE_RUDY_GREETINGS).toEqual(['greeting', 'greetingAgain']);
    expect(COMPARE_RUDY_CELEBRATIONS).toEqual(['celebration', 'celebrationMore']);
  });
});

describe('#181 AC3: Rudy v Porovnávání neřekne stejnou repliku dvakrát po sobě', () => {
  it('po sobě jdoucí pozdravy i oslavy se střídají a neopakují', () => {
    const page = openProfiles(new DeviceStorage());
    const greetings = [1, 2, 3].map(() => openGameAndShow(page, 'wave'));
    const celebrations = [1, 2, 3].map(() => openGameAndShow(page, 'celebrate'));
    expect(greetings).toEqual(['greeting', 'greetingAgain', 'greeting']);
    expect(celebrations).toEqual(['celebration', 'celebrationMore', 'celebration']);
  });

  it('pozdrav a oslava se střídají každý zvlášť', () => {
    const page = openProfiles(new DeviceStorage());
    openGameAndShow(page, 'wave');
    expect(openGameAndShow(page, 'celebrate')).toBe('celebration');
    expect(openGameAndShow(page, 'wave')).toBe('greetingAgain');
  });

  it('poslední varianta se pamatuje podle profilu, jen pod vnitřním označením', () => {
    const device = new DeviceStorage();
    const page = openProfiles(device);
    const ema = page.createProfile({ nickname: 'EMA', color: PROFILE_COLORS[1] });
    const ondra = page.createProfile({ nickname: 'ONDRA', color: PROFILE_COLORS[2] });
    page.selectProfile(ema.id);
    expect(openGameAndShow(page, 'wave')).toBe('greeting');
    page.selectProfile(ondra.id);
    expect(openGameAndShow(page, 'wave'), 'jiný profil začíná první').toBe('greeting');
    const reloaded = openProfiles(device);
    reloaded.selectProfile(ema.id);
    expect(openGameAndShow(reloaded, 'wave')).toBe('greetingAgain');
    const keys = [...device.data.keys()].filter((key) => key.includes('rudyLine'));
    expect(keys.length).toBe(2);
    expect(keys.every((key) => !key.includes('EMA') && !key.includes('ONDRA'))).toBe(true);
  });

  it('okno, které se neukázalo, se nepočítá: příště přijde stejná replika', () => {
    const page = openProfiles(new DeviceStorage());
    const lines = compareRudyLines(compareStorage(page));
    expect(lines.upcoming('celebrate')).toBe('celebration');
    expect(lines.upcoming('celebrate')).toBe('celebration');
  });

  it('zakázané úložiště: pozdravy se střídají i po dalším otevření hry na stejné stránce', () => {
    const page = openProfiles(forbiddenStorage());
    const greetings = [1, 2, 3].map(() => openGameAndShow(page, 'wave'));
    expect(greetings).toEqual(['greeting', 'greetingAgain', 'greeting']);
  });
});
