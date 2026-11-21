import { describe, expect, it } from 'vitest';

import {
  MENU_RUDY_AREA,
  MENU_RUDY_LINES,
  menuGreetingLines,
} from '../../src/menu/logic/menuRudyVoice';
import type { MenuRudyLine } from '../../src/menu/logic/menuRudyVoice';
import { PROFILE_COLORS } from '../../src/shared/logic/profiles';
import { openProfiles } from '../../src/shared/storage/profileStorage';
import type { ProfileStore } from '../../src/shared/storage/profileStorage';
import { DeviceStorage, forbiddenStorage } from '../shared/profileFixtures';

/**
 * Testy k #176 AC1 a AC2 pro menu: pozdrav má 2 varianty, které se
 * v profilu střídají, první je ta z #171 a zopakovaný tichý pozdrav (#173)
 * řekne tutéž repliku.
 */

function linesOf(page: ProfileStore) {
  return menuGreetingLines(page);
}

/** Menu po novém načtení stránky pozdraví a okno se ukáže. */
function greetAfterReload(page: ProfileStore): MenuRudyLine {
  const lines = linesOf(page);
  const line = lines.next();
  lines.said(line);
  return line;
}

describe('#176 AC1: Rudy má v menu dva pozdravy', () => {
  it('pozdrav má 2 varianty, první je ten z #171', () => {
    expect(MENU_RUDY_LINES).toEqual(['greeting', 'greetingWhat']);
  });
});

describe('#176 AC2: Rudy v menu nepozdraví stejně dvakrát po sobě', () => {
  it('první pozdrav v profilu je ten dnešní, pak se pozdravy střídají', () => {
    const page = openProfiles(new DeviceStorage());
    const spoken = [1, 2, 3].map(() => greetAfterReload(page));
    expect(spoken).toEqual(['greeting', 'greetingWhat', 'greeting']);
  });

  it('po návratu ze hry na stejné stránce přijde druhý pozdrav', () => {
    const page = openProfiles(new DeviceStorage());
    const lines = linesOf(page);
    lines.said(lines.next());
    expect(lines.next()).toBe('greetingWhat');
  });

  it('zopakovaný tichý pozdrav (#173) a jeho stažení dopředu řeknou tutéž repliku', () => {
    const page = openProfiles(new DeviceStorage());
    const lines = linesOf(page);
    const silent = lines.next();
    lines.said(silent);
    expect(lines.replay()).toBe(silent);
  });

  it('poslední pozdrav se pamatuje podle profilu', () => {
    const device = new DeviceStorage();
    const page = openProfiles(device);
    const ema = page.createProfile({ nickname: 'EMA', color: PROFILE_COLORS[1] });
    const ondra = page.createProfile({ nickname: 'ONDRA', color: PROFILE_COLORS[2] });
    const lines = linesOf(page);
    page.selectProfile(ema.id);
    lines.said(lines.next());
    // Jiný profil vybraný na stejné stránce začíná prvním pozdravem.
    page.selectProfile(ondra.id);
    expect(lines.next()).toBe('greeting');
    const reloaded = openProfiles(device);
    reloaded.selectProfile(ema.id);
    expect(greetAfterReload(reloaded)).toBe('greetingWhat');
  });

  it('poškozený záznam znamená první pozdrav', () => {
    const page = openProfiles(new DeviceStorage());
    page.gameStorage(MENU_RUDY_AREA).setItem('rudyLine.greeting', '{"rozbite":');
    expect(greetAfterReload(page)).toBe('greeting');
  });

  it('zakázané úložiště: pozdravy se na stránce střídají až do jejího zavření', () => {
    const page = openProfiles(forbiddenStorage());
    const lines = linesOf(page);
    const spoken = [1, 2, 3].map(() => {
      const line = lines.next();
      lines.said(line);
      return line;
    });
    expect(spoken).toEqual(['greeting', 'greetingWhat', 'greeting']);
  });

  it('plné úložiště: každý profil si pamatuje svůj pozdrav i po přepnutí profilů', () => {
    const device = new DeviceStorage();
    const page = openProfiles(device);
    const ema = page.createProfile({ nickname: 'EMA', color: PROFILE_COLORS[1] });
    const ondra = page.createProfile({ nickname: 'ONDRA', color: PROFILE_COLORS[2] });
    device.failWrite = () => true;
    const lines = linesOf(page);
    page.selectProfile(ema.id);
    lines.said(lines.next());
    page.selectProfile(ondra.id);
    expect(lines.next()).toBe('greeting');
    page.selectProfile(ema.id);
    expect(lines.next()).toBe('greetingWhat');
  });
});
