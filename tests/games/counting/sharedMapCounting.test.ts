import { describe, expect, it } from 'vitest';

import { MAP_STEPS } from '../../../src/shared/logic/progressMap';
import { DeviceStorage } from '../../shared/profileFixtures';
import {
  completeRow,
  enterCountingOn,
  keysOf,
  mapOf,
  openPage,
  waitForMap,
  fillRow,
} from './keyRewardFakes';

/**
 * Testy k #193 AC1, AC3 a AC4 v Počítání: mapa postupu patří profilu,
 * ne hře. Počítání dostane od stránky mapu aktivního profilu (`mapOf`, jako
 * při spuštění z menu), pokračuje na ní z kroku, který dítě získalo v jiné
 * hře (Znaménka), a jeho kroky tam uvidí jiné hry. Zbytek chování mapy
 * v Počítání hlídají dřívější testy mapy (#87–#159), které se nezměnily.
 */

describe('#193 AC1: Počítání pokračuje na společné mapě profilu', () => {
  it('krok získaný ve Znaménkách pokračuje v Počítání o krok dál', () => {
    const page = openPage(new DeviceStorage());
    // Znaménka posunula mapu profilu na 1. zastávku 3. mapy.
    mapOf(page).save({ step: 1, completedMaps: 2 });

    const test = enterCountingOn(page);
    expect(test.session.mapProgress()).toEqual({ step: 1, completedMaps: 2 });
    fillRow(test);
    waitForMap(test);
    expect(test.session.shownMap()).toMatchObject({ from: 1, to: 2, theme: 'castle' });
  });

  it('krok z Počítání je na mapě profilu, odkud ho vezmou Znaménka', () => {
    const storage = new DeviceStorage();
    const test = enterCountingOn(openPage(storage));
    completeRow(test);
    test.session.leave();
    expect(mapOf(openPage(storage)).load()).toEqual({ step: 1, completedMaps: 0 });
  });

  it('krok ze Znamének během rozehraného Počítání se při další řadě započte', () => {
    const page = openPage(new DeviceStorage());
    const test = enterCountingOn(page);
    // Znaménka vedle (druhý panel) posunula mapu na 2. zastávku.
    mapOf(page).save({ step: 2, completedMaps: 0 });
    fillRow(test);
    waitForMap(test);
    expect(test.session.shownMap()).toMatchObject({ from: 2, to: MAP_STEPS, reachedGoal: true });
  });
});

describe('#193 AC3: Počítání po aktualizaci pokračuje ze své dřívější mapy', () => {
  it('mapa, kterou Počítání uložilo do #193, se převede a nic se neztratí ani nezdvojí', () => {
    const storage = new DeviceStorage();
    const first = enterCountingOn(openPage(storage), { step: 2, completedMaps: 4 });
    expect(first.session.mapProgress()).toEqual({ step: 2, completedMaps: 4 });
    first.session.leave();

    for (let entry = 1; entry <= 3; entry += 1) {
      const again = enterCountingOn(openPage(storage));
      expect(again.session.mapProgress(), `${entry}. otevření`).toEqual({
        step: 2,
        completedMaps: 4,
      });
      again.session.leave();
    }
    expect(keysOf(openPage(storage)).balance().halves, 'půlky za dřívější mapy').toBe(4);
  });
});

describe('#193 AC4: Počítání nedá půlku za mapu dokončenou v jiné hře', () => {
  it('mapa dokončená ve Znaménkách se v Počítání nezapočte znovu, další cíl dá další půlku', () => {
    const page = openPage(new DeviceStorage());
    // Znaménka dokončila 1. mapu a nahlásila ji klíčům.
    mapOf(page).save({ step: MAP_STEPS, completedMaps: 1 });
    keysOf(page).reportCompletedMaps(1);

    const test = enterCountingOn(page);
    expect(keysOf(page).balance().halves).toBe(1);
    completeRow(test);
    completeRow(test);
    fillRow(test);
    waitForMap(test);
    expect(test.session.goalKeyReward()).toBe('wholeKey');
    expect(keysOf(page).balance().halves).toBe(2);
  });
});
