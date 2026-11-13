/**
 * Která ze dvou scén menu je vidět: menu, nebo výběr profilu (#72).
 * Čistý TypeScript bez Phaseru; stránka předá, v jakém stavu scény jsou,
 * a jak je uspat a probudit.
 *
 * Obě scény si při startu načítají vlajky nabídky jazyků (#138), a která
 * se dřív dokončí, záleží na síti. Scénu, která se ještě načítá, uspat ani
 * probudit nejde (uspání by se ztratilo a probuzení by načítání přeskočilo),
 * proto se ji `showOnlyScene` nedotkne. Stránka ho volá po vytvoření každé
 * scény a po otevření nebo zavření výběru profilu, takže nakonec je vždy
 * vidět jen jedna scéna, ať se dřív dokončí kterákoli.
 */

/** Scéna na plátně menu. */
export type MenuSceneName = 'menu' | 'profiles';

/** Stav scény: načítá se, běží (je vidět), nebo spí (není vidět). */
export type MenuSceneState = 'loading' | 'running' | 'sleeping';

/** Jak stránka zjistí stav scény a jak ji uspí nebo probudí. */
export interface MenuSceneSwitch {
  state(scene: MenuSceneName): MenuSceneState;
  sleep(scene: MenuSceneName): void;
  wake(scene: MenuSceneName): void;
}

const MENU_SCENES: readonly MenuSceneName[] = ['menu', 'profiles'];

/** Dokud je výběr profilu nebo formulář otevřený, je vidět jen on. */
export function shownSceneFor(profilesOpen: boolean): MenuSceneName {
  return profilesOpen ? 'profiles' : 'menu';
}

/**
 * Probudí scénu `shown` a uspí tu druhou. Scény, které se ještě načítají,
 * nechá být; až se vytvoří, stránka zavolá tuhle funkci znovu.
 */
export function showOnlyScene(shown: MenuSceneName, scenes: MenuSceneSwitch): void {
  for (const scene of MENU_SCENES) {
    const state = scenes.state(scene);
    if (scene === shown && state === 'sleeping') {
      scenes.wake(scene);
    } else if (scene !== shown && state === 'running') {
      scenes.sleep(scene);
    }
  }
}
