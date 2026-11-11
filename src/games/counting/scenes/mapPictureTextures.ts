/**
 * Textury mapy postupu (#134): obrázek prostředí se stahuje Phaser
 * loaderem až během hraní (`loadMapPicture`), symboly cíle jsou malé
 * a načtou se se scénou (`preloadGoalSymbols`). Všechno jen ze stejné
 * stránky, adresy dává `logic/mapPictures.ts`.
 */

import Phaser from 'phaser';

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

/** Načte symboly cíle všech 5 map; volá se v `preload` scény. */
export function preloadGoalSymbols(scene: Phaser.Scene): void {
  for (const theme of MAP_THEMES) {
    scene.load.svg(goalSymbolTextureKey(theme), MAP_GOAL_SYMBOLS[theme].url, {
      width: GOAL_SYMBOL_PIXELS,
      height: GOAL_SYMBOL_PIXELS,
    });
  }
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
