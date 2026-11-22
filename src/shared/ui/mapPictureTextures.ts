/**
 * Textury mapy postupu (#134), společné všem hrám s hvězdičkami (#193):
 * obrázek prostředí se stahuje až během hraní (`loadMapPicture`) a na
 * stránce jen jednou pro všechny hry a spuštění (`loadEachOnce`); každá
 * hra z něj udělá jen texturu. Symboly cíle a půlky klíče (#139) jsou
 * malé a načtou se se scénou (`preloadGoalSymbols`). Všechno jen ze stejné
 * stránky, adresy dává `logic/mapPictures.ts` a importy půlek klíče.
 */

import Phaser from 'phaser';

import keyBladeUrl from '../icons/key-blade.webp?no-inline';
import keyHeadUrl from '../icons/key-head.webp?no-inline';

import { loadEachOnce } from '../logic/loadOnce';
import type { MapPictureId } from '../logic/mapPictureLoading';
import { MAP_GOAL_SYMBOLS, mapPictureUrl } from '../logic/mapPictures';
import { MAP_THEMES } from '../logic/progressMap';
import type { MapThemeId } from '../logic/progressMap';

/** Velikost, ve které se SVG symbolu vykreslí (největší značka má 150 CSS px, tedy 300 bodů). */
const GOAL_SYMBOL_PIXELS = 300;

export function mapPictureTextureKey(picture: MapPictureId): string {
  return `progressMap:${picture.theme}-${picture.orientation}`;
}

export function goalSymbolTextureKey(theme: MapThemeId): string {
  return `progressMapGoal:${theme}`;
}

/**
 * Půlky vodorovného klíče (#139, návrh B z ElevenLabs): levá hlava s hvězdou
 * po spoj skládačky a pravý dřík se zuby. Oba obrázky mají stejný rozměr
 * celého klíče, takže položené přes sebe dají celý klíč.
 */
const KEY_HEAD_TEXTURE = 'progressMapKey:head';
const KEY_BLADE_TEXTURE = 'progressMapKey:blade';

/** Načte symboly cíle všech 5 map a půlky klíče; volá se v `preload` scény. */
export function preloadGoalSymbols(scene: Phaser.Scene): void {
  for (const theme of MAP_THEMES) {
    scene.load.svg(goalSymbolTextureKey(theme), MAP_GOAL_SYMBOLS[theme].url, {
      width: GOAL_SYMBOL_PIXELS,
      height: GOAL_SYMBOL_PIXELS,
    });
  }
  scene.load.image(KEY_HEAD_TEXTURE, keyHeadUrl);
  scene.load.image(KEY_BLADE_TEXTURE, keyBladeUrl);
}

/**
 * Klíče textur levé (hlava) a pravé (dřík) půlky klíče, nebo `null`, když
 * se některá nenačetla (klíč se pak ukáže jako emoji, viz `GoalKeyBadge`).
 */
export function keyHalfTextures(scene: Phaser.Scene): { head: string; blade: string } | null {
  if (!scene.textures.exists(KEY_HEAD_TEXTURE) || !scene.textures.exists(KEY_BLADE_TEXTURE)) {
    return null;
  }
  return { head: KEY_HEAD_TEXTURE, blade: KEY_BLADE_TEXTURE };
}

/** Stáhne obrázek ze stejné stránky; slib odmítne, když se nestáhl nebo nejde přečíst. */
function downloadImage(url: string): Promise<HTMLImageElement> {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`obrázek ${url} se nestáhl`));
    image.src = url;
  });
}

/** Obrázky map stažené na této stránce; další hra je už nestahuje (#193 AC5). */
const pagePictures = loadEachOnce(downloadImage);

/**
 * Stáhne obrázek mapy (jen poprvé na stránce) a udělá z něj texturu scény.
 * Slib se splní, až je textura připravená, a odmítne, když se soubor
 * nestáhl, nejde přečíst (výpadek sítě), nebo hra mezitím skončila.
 */
export function loadMapPicture(scene: Phaser.Scene, picture: MapPictureId): Promise<void> {
  const key = mapPictureTextureKey(picture);
  if (scene.textures.exists(key)) {
    return Promise.resolve();
  }
  return pagePictures(mapPictureUrl(picture.theme, picture.orientation)).then((image) => {
    // Hra mohla mezitím skončit (odchod domečkem): textura už nemá kam.
    const textures = scene.sys.game?.textures;
    if (textures === undefined || textures === null) {
      throw new Error(`obrázek mapy ${key} nemá hru`);
    }
    if (!textures.exists(key)) {
      textures.addImage(key, image);
    }
  });
}
