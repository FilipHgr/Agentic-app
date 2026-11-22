import { describe, expect, it } from 'vitest';

import { CELEBRATION_MS, NEXT_PROBLEM_MS } from '../../../src/games/compare/logic/compareSession';
import { correctSign } from '../../../src/games/compare/logic/compareProblems';
import { COMPARE_META } from '../../../src/games/compare/meta';
import { COMPARE_PROGRESS_KEY } from '../../../src/games/compare/storage/progressStorage';
import { PROFILE_COLORS } from '../../../src/shared/logic/profiles';
import { openProfiles } from '../../../src/shared/storage/profileStorage';
import { DeviceStorage } from '../../shared/profileFixtures';
import { MemoryStorage, openCompare, solveProblems } from './compareFakes';
import type { TestCompare } from './compareFakes';

/**
 * Testy k #178 AC6, #187 AC4: po 10. hvězdičce oslava s konfetami a nová prázdná
 * řada; hvězdičky se pamatují podle profilu, po zavření uprostřed oslavy
 * začíná prázdná řada a profily se neovlivňují.
 */

/** Vyřeší 9 příkladů a 10. jen ťukne (oslava ještě nezačala). */
function tapTenthStar(test: TestCompare): void {
  solveProblems(test, 9);
  test.session.tap(correctSign(test.session.problem()));
}

describe('#178 AC6, #187 AC4: po 10. hvězdičce oslava a nová prázdná řada', () => {
  it('10. hvězdička spustí oslavu s konfetami a slavnostní melodií', () => {
    const test = openCompare();
    tapTenthStar(test);
    expect(test.session.starCount()).toBe(10);
    test.timers.advance(NEXT_PROBLEM_MS);
    expect(test.changes).toContainEqual({ kind: 'celebrationStarted' });
    expect(test.sounds.played).toContain('celebration');
  });

  it('po oslavě je řada prázdná a přijde nový příklad', () => {
    const test = openCompare();
    tapTenthStar(test);
    const problem = test.session.problem();
    test.timers.advance(NEXT_PROBLEM_MS + CELEBRATION_MS);
    expect(test.changes).toContainEqual({ kind: 'celebrationEnded' });
    expect(test.session.starCount()).toBe(0);
    expect(test.session.isCelebrating()).toBe(false);
    expect(test.session.problem()).not.toEqual(problem);
  });

  it('po oslavě se sbírá nová řada od první hvězdičky', () => {
    const test = openCompare();
    solveProblems(test, 10);
    solveProblems(test, 3);
    expect(test.session.starCount()).toBe(3);
  });

  it('před 10. hvězdičkou oslava nepřijde', () => {
    const test = openCompare();
    solveProblems(test, 9);
    expect(test.changes).not.toContainEqual({ kind: 'celebrationStarted' });
    expect(test.sounds.played).not.toContain('celebration');
  });
});

describe('#178 AC6, #187 AC4: hvězdičky se pamatují', () => {
  it('po zavření a novém otevření hry svítí stejně hvězdiček', () => {
    const storage = new MemoryStorage();
    solveProblems(openCompare(storage), 4);
    expect(openCompare(storage).session.starCount()).toBe(4);
  });

  it('po zavření uprostřed oslavy začíná prázdná řada a oslava se neopakuje', () => {
    const storage = new MemoryStorage();
    const first = openCompare(storage);
    tapTenthStar(first);
    first.timers.advance(NEXT_PROBLEM_MS);
    expect(first.session.isCelebrating()).toBe(true);
    first.session.leave();

    const again = openCompare(storage);
    expect(again.session.starCount()).toBe(0);
    expect(again.session.isCelebrating()).toBe(false);
    expect(again.changes).not.toContainEqual({ kind: 'celebrationStarted' });
  });

  it('poškozený nebo nesmyslný záznam dá prázdnou řadu, hra jde dál', () => {
    for (const saved of ['{', 'null', '{"earned":-1}', '{"earned":11}', '{"earned":2.5}', '[]']) {
      const storage = new MemoryStorage();
      storage.data.set(COMPARE_PROGRESS_KEY, saved);
      const test = openCompare(storage);
      expect(test.session.starCount(), saved).toBe(0);
      expect(test.session.tap(correctSign(test.session.problem())), saved).toBe('correct');
    }
  });

  it('když úložiště nejde číst ani zapsat, hra jede dál s hvězdičkami v paměti', () => {
    const storage = new MemoryStorage();
    storage.failReads = true;
    storage.failWrites = true;
    const test = openCompare(storage);
    solveProblems(test, 3);
    expect(test.session.starCount()).toBe(3);
  });
});

describe('#178 AC6, #187 AC4: profily se neovlivňují', () => {
  it('hvězdičky jednoho profilu nejsou vidět v druhém a po návratu jsou zpátky', () => {
    const device = new DeviceStorage();
    const store = openProfiles(device);
    const first = store.activeProfile();
    const second = store.createProfile({ nickname: 'EMA', color: PROFILE_COLORS[1] });

    solveProblems(openCompare(store.gameStorage(COMPARE_META.id)), 6);

    store.selectProfile(second.id);
    const other = openCompare(store.gameStorage(COMPARE_META.id));
    expect(other.session.starCount()).toBe(0);
    solveProblems(other, 2);

    store.selectProfile(first.id);
    expect(openCompare(store.gameStorage(COMPARE_META.id)).session.starCount()).toBe(6);
    store.selectProfile(second.id);
    expect(openCompare(store.gameStorage(COMPARE_META.id)).session.starCount()).toBe(2);
  });

  it('po novém načtení stránky má každý profil své hvězdičky', () => {
    const device = new DeviceStorage();
    const store = openProfiles(device);
    const second = store.createProfile({ nickname: 'OTA', color: PROFILE_COLORS[2] });
    solveProblems(openCompare(store.gameStorage(COMPARE_META.id)), 5);

    const reloaded = openProfiles(device);
    expect(openCompare(reloaded.gameStorage(COMPARE_META.id)).session.starCount()).toBe(5);
    reloaded.selectProfile(second.id);
    expect(openCompare(reloaded.gameStorage(COMPARE_META.id)).session.starCount()).toBe(0);
  });
});
