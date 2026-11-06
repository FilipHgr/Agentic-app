/**
 * Ostré vykreslení hry (#77), společné pro všechny hry: plátno má pevně
 * 2 obrazové body na zobrazený CSS px (`src/shared/logic/canvasResolution.ts`)
 * a hlavní kamera scény herní jednotky zvětší na obrazové body. Scéna dál
 * kreslí v herních jednotkách a dotyk (`pointer.worldX`, `worldY`) přepočítá
 * Phaser přes kameru, takže rozložení i ťukání zůstanou stejné.
 *
 * Texty Phaser kreslí do vlastního malého plátna v rozlišení 1, kamera by
 * je jen roztáhla a byly by rozmazané. Proto dostanou rozlišení podle
 * zvětšení kamery, nové texty hned po vzniku a dosavadní po změně okna.
 */

import Phaser from 'phaser';

import type { CanvasResolution } from '../logic/canvasResolution';

/** Klíč v `game.registry`, pod kterým scéna najde rozlišení plátna. */
export const CANVAS_RESOLUTION_KEY = 'canvasResolution';

function hasUsableZoom(value: unknown): value is CanvasResolution {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const zoom = (value as { zoom?: unknown }).zoom;
  return typeof zoom === 'number' && Number.isFinite(zoom) && zoom > 0;
}

/** Zvětšení kamery z registru; bez stránky (hra spuštěná jinak) 1 jako dřív. */
function zoomFromRegistry(scene: Phaser.Scene): number {
  const stored: unknown = scene.registry.get(CANVAS_RESOLUTION_KEY);
  return hasUsableZoom(stored) ? stored.zoom : 1;
}

/** Všechny texty scény, i ty uvnitř kontejnerů. */
function textsIn(objects: readonly Phaser.GameObjects.GameObject[]): Phaser.GameObjects.Text[] {
  const texts: Phaser.GameObjects.Text[] = [];
  for (const object of objects) {
    if (object instanceof Phaser.GameObjects.Text) {
      texts.push(object);
    } else if (object instanceof Phaser.GameObjects.Container) {
      texts.push(...textsIn(object.list));
    }
  }
  return texts;
}

/** Text se překreslí jen při jiném rozlišení (překreslení textu něco stojí). */
function sharpenText(text: Phaser.GameObjects.Text, zoom: number): void {
  if (text.style.resolution !== zoom) {
    text.setResolution(zoom);
  }
}

/**
 * Scéna se bude kreslit ostře podle rozlišení plátna od stránky a po změně
 * okna se přizpůsobí. Volá se na začátku `create`; sledování skončí se scénou.
 */
export function followCanvasResolution(scene: Phaser.Scene): void {
  let zoom = zoomFromRegistry(scene);

  const applyZoom = (): void => {
    // Zvětšení od levého horního rohu: herní bod (x, y) je na plátně (x · zoom, y · zoom).
    scene.cameras.main.setOrigin(0, 0).setZoom(zoom);
  };
  const onResolutionChanged = (): void => {
    zoom = zoomFromRegistry(scene);
    applyZoom();
    for (const text of textsIn(scene.children.list)) {
      sharpenText(text, zoom);
    }
  };
  const onObjectAdded = (object: Phaser.GameObjects.GameObject): void => {
    if (object instanceof Phaser.GameObjects.Text) {
      sharpenText(object, zoom);
    }
  };

  applyZoom();
  const changeEvent = `changedata-${CANVAS_RESOLUTION_KEY}`;
  scene.registry.events.on(changeEvent, onResolutionChanged);
  scene.events.on(Phaser.Scenes.Events.ADDED_TO_SCENE, onObjectAdded);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.registry.events.off(changeEvent, onResolutionChanged);
    scene.events.off(Phaser.Scenes.Events.ADDED_TO_SCENE, onObjectAdded);
  });
}
