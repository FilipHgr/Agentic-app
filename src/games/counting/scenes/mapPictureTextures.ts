/**
 * Textury mapy postupu (#134): obrázek prostředí se stahuje Phaser
 * loaderem až během hraní (`loadMapPicture`), symboly cíle a klíč (#139)
 * jsou malé a načtou se se scénou (`preloadGoalSymbols`). Všechno jen ze
 * stejné stránky, adresy dává `logic/mapPictures.ts` a import klíče.
 */

import Phaser from 'phaser';

import keySymbolUrl from '../icons/key.svg?no-inline';

import type { MapPictureId } from '../logic/mapPictureLoading';
import { MAP_GOAL_SYMBOLS, mapPictureUrl } from '../logic/mapPictures';
import { MAP_THEMES } from '../logic/progressMap';
import type { MapThemeId } from '../logic/progressMap';

/** Velikost, ve které se SVG symbolu vykreslí (největší značka má 150 CSS px, tedy 300 bodů). */
const GOAL_SYMBOL_PIXELS = 300;

export function mapPictureTextureKey(picture: MapPictureId): string {
  return `countingMap:${picture.theme}-${picture.orientation}`;
}

export function goalSymbolTextureKey(theme: MapThemeId): string {
  return `countingGoal:${theme}`;
}

/** Klíč 🔑 ze sady Noto (#139), jak ho načte loader: šikmo, hlavou vpravo nahoře. */
const KEY_SYMBOL_TEXTURE = 'countingKey:symbol';

/** Klíč otočený vodorovně (hlavou vpravo), z něj se ořezávají půlky. */
const FLAT_KEY_TEXTURE = 'countingKey:flat';

/** Načte symboly cíle všech 5 map a klíč; volá se v `preload` scény. */
export function preloadGoalSymbols(scene: Phaser.Scene): void {
  for (const theme of MAP_THEMES) {
    scene.load.svg(goalSymbolTextureKey(theme), MAP_GOAL_SYMBOLS[theme].url, {
      width: GOAL_SYMBOL_PIXELS,
      height: GOAL_SYMBOL_PIXELS,
    });
  }
  scene.load.svg(KEY_SYMBOL_TEXTURE, keySymbolUrl, {
    width: GOAL_SYMBOL_PIXELS,
    height: GOAL_SYMBOL_PIXELS,
  });
}

/**
 * Vodorovný klíč (#139): šikmý klíč z Noto otočený o 45° po směru
 * hodinových ručiček do čtverce o straně úhlopříčky, střed zůstane ve
 * středu. Kresba se nemění, jen se otočí. Vrátí klíč textury a stranu
 * původního obrázku v bodech, nebo `null`, když se klíč nenačetl.
 */
export function flatKeyTexture(scene: Phaser.Scene): { key: string; symbolPixels: number } | null {
  const flat = { key: FLAT_KEY_TEXTURE, symbolPixels: GOAL_SYMBOL_PIXELS };
  if (scene.textures.exists(FLAT_KEY_TEXTURE)) {
    return flat;
  }
  if (!scene.textures.exists(KEY_SYMBOL_TEXTURE)) {
    return null;
  }
  const source = scene.textures.get(KEY_SYMBOL_TEXTURE).getSourceImage();
  if (source instanceof Phaser.GameObjects.RenderTexture) {
    return null;
  }
  const side = Math.ceil(GOAL_SYMBOL_PIXELS * Math.SQRT2);
  const canvas = scene.textures.createCanvas(FLAT_KEY_TEXTURE, side, side);
  const context = canvas?.getContext();
  if (!canvas || !context) {
    // Bez kreslení do plátna se klíč ukáže jako emoji (viz `GoalKeyBadge`).
    scene.textures.remove(FLAT_KEY_TEXTURE);
    return null;
  }
  context.translate(side / 2, side / 2);
  context.rotate(Math.PI / 4);
  context.drawImage(
    source,
    -GOAL_SYMBOL_PIXELS / 2,
    -GOAL_SYMBOL_PIXELS / 2,
    GOAL_SYMBOL_PIXELS,
    GOAL_SYMBOL_PIXELS,
  );
  canvas.refresh();
  return flat;
}

/**
 * Stáhne obrázek mapy do textury. Slib se splní, až je textura připravená,
 * a odmítne, když se soubor nestáhl nebo nejde přečíst (výpadek sítě).
 */
export function loadMapPicture(scene: Phaser.Scene, picture: MapPictureId): Promise<void> {
  const key = mapPictureTextureKey(picture);
  if (scene.textures.exists(key)) {
    return Promise.resolve();
  }
  const loader = scene.load;
  return new Promise<void>((resolve, reject) => {
    const stopListening = (): void => {
      loader.off(Phaser.Loader.Events.FILE_COMPLETE, onFileComplete);
      loader.off(Phaser.Loader.Events.FILE_LOAD_ERROR, onFileError);
      loader.off(Phaser.Loader.Events.COMPLETE, onLoaderComplete);
    };
    const finish = (): void => {
      stopListening();
      if (scene.textures.exists(key)) {
        resolve();
      } else {
        reject(new Error(`obrázek mapy ${key} se nenačetl`));
      }
    };
    const onFileComplete = (fileKey: string): void => {
      if (fileKey === key) {
        finish();
      }
    };
    const onFileError = (file: Phaser.Loader.File): void => {
      if (file.key === key) {
        finish();
      }
    };
    // Soubor, který se stáhne, ale nejde dekódovat, chybu načtení nehlásí
    // (jako u dlaždic menu, #122); po konci načítání se rozhodne podle textury.
    const onLoaderComplete = (): void => finish();
    loader.on(Phaser.Loader.Events.FILE_COMPLETE, onFileComplete);
    loader.on(Phaser.Loader.Events.FILE_LOAD_ERROR, onFileError);
    loader.on(Phaser.Loader.Events.COMPLETE, onLoaderComplete);
    loader.image(key, mapPictureUrl(picture.theme, picture.orientation));
    loader.start();
  });
}
