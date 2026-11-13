import { describe, expect, it } from 'vitest';

import { shownSceneFor, showOnlyScene } from '../../src/menu/logic/menuSceneVisibility';
import type {
  MenuSceneName,
  MenuSceneState,
  MenuSceneSwitch,
} from '../../src/menu/logic/menuSceneVisibility';

/**
 * Chyba z PC: při startu se dvěma profily bylo vidět zároveň menu i výběr
 * profilu. Obě scény si načítají vlajky (#138) a když se výběr profilu
 * dokončil dřív, uspání ještě načítaného menu se ztratilo. Scény tu
 * zastupuje náhrada, která se chová jako Phaser: načítanou scénu uspat ani
 * probudit nejde, po načtení scéna běží (je vidět). Stránka volá
 * `showOnlyScene` po vytvoření každé scény a po otevření a zavření výběru.
 */

const SCENES: readonly MenuSceneName[] = ['menu', 'profiles'];

interface FakeScenes extends MenuSceneSwitch {
  /** Scéna dokončila načítání a vytvořila se (běží). */
  create(scene: MenuSceneName): void;
  visible(): MenuSceneName[];
}

function fakeScenes(): FakeScenes {
  const states: Record<MenuSceneName, MenuSceneState> = { menu: 'loading', profiles: 'loading' };
  return {
    state: (scene) => states[scene],
    sleep: (scene) => {
      if (states[scene] === 'running') {
        states[scene] = 'sleeping';
      }
    },
    wake: (scene) => {
      if (states[scene] === 'sleeping') {
        states[scene] = 'running';
      }
    },
    create: (scene) => {
      states[scene] = 'running';
    },
    visible: () => SCENES.filter((scene) => states[scene] === 'running'),
  };
}

/** Start stránky: scény se vytvoří v daném pořadí, po každé se uplatní viditelnost. */
function startPage(order: readonly MenuSceneName[], profilesOpen: () => boolean): FakeScenes {
  const scenes = fakeScenes();
  for (const scene of order) {
    scenes.create(scene);
    showOnlyScene(shownSceneFor(profilesOpen()), scenes);
  }
  return scenes;
}

const ORDERS: readonly (readonly MenuSceneName[])[] = [
  ['menu', 'profiles'],
  ['profiles', 'menu'],
];

describe('viditelnost menu a výběru profilu', () => {
  it('při startu se dvěma profily je vidět jen výběr profilu, ať se dřív načte kterákoli scéna', () => {
    for (const order of ORDERS) {
      const scenes = startPage(order, () => true);
      expect(scenes.visible(), `pořadí načtení ${order.join(' → ')}`).toEqual(['profiles']);
    }
  });

  it('při startu s jedním profilem je vidět jen menu, ať se dřív načte kterákoli scéna', () => {
    for (const order of ORDERS) {
      const scenes = startPage(order, () => false);
      expect(scenes.visible(), `pořadí načtení ${order.join(' → ')}`).toEqual(['menu']);
    }
  });

  it('po výběru profilu je vidět jen menu', () => {
    for (const order of ORDERS) {
      let profilesOpen = true;
      const scenes = startPage(order, () => profilesOpen);
      profilesOpen = false;
      showOnlyScene(shownSceneFor(profilesOpen), scenes);
      expect(scenes.visible(), `pořadí načtení ${order.join(' → ')}`).toEqual(['menu']);
    }
  });

  it('po výběru profilu dřív, než se menu načte, je po načtení vidět jen menu', () => {
    let profilesOpen = true;
    const scenes = fakeScenes();
    scenes.create('profiles');
    showOnlyScene(shownSceneFor(profilesOpen), scenes);
    profilesOpen = false;
    showOnlyScene(shownSceneFor(profilesOpen), scenes);
    scenes.create('menu');
    showOnlyScene(shownSceneFor(profilesOpen), scenes);
    expect(scenes.visible()).toEqual(['menu']);
  });

  it('po ťuknutí na kolečko profilu v menu je vidět jen výběr profilu', () => {
    let profilesOpen = false;
    const scenes = startPage(['menu', 'profiles'], () => profilesOpen);
    profilesOpen = true;
    showOnlyScene(shownSceneFor(profilesOpen), scenes);
    expect(scenes.visible()).toEqual(['profiles']);
  });
});
