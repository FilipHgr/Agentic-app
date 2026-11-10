/// <reference types="vite/client" />
/**
 * Obrysy omalovánek sady (#88, #124) vykreslené do plátna. Ze stejného
 * plátna se spočítá mapa oblastí (`getImageData`) a nakreslí obrys nad
 * vrstvou barev, takže obrys na obrazovce přesně sedí s hranicemi oblastí.
 * Obrys domku je SVG, obrysy skutečných omalovánek (#128) jsou PNG z nástroje
 * `tools/design/outline-from-image.mjs`. Všechny jsou v repozitáři a stáhnou
 * se až s hrou z vlastního serveru, nic se nestahuje z cizích serverů.
 * Při změně obrysu se v `logic/pictureSet.ts` zvýší verze omalovánky (#92).
 */

import { buildRegionMap, outlineFromImage } from '../logic/regionMap';
import type { RegionMap } from '../logic/regionMap';
import type { PictureIdentity } from '../logic/savedPicture';
import butterflyUrl from '../pictures/butterfly.png';
import carUrl from '../pictures/car.png';
import catUrl from '../pictures/cat.png';
import dogUrl from '../pictures/dog.png';
import fishUrl from '../pictures/fish.png';
import houseSvg from '../pictures/house.svg?raw';

/** SVG obrysu podle označení omalovánky ze sady (domek). */
const OUTLINE_SVGS: Readonly<Record<string, string>> = {
  house: houseSvg,
};

/** Adresa PNG obrysu podle označení omalovánky ze sady (#128). */
const OUTLINE_PNG_URLS: Readonly<Record<string, string>> = {
  cat: catUrl,
  dog: dogUrl,
  car: carUrl,
  butterfly: butterflyUrl,
  fish: fishUrl,
};

/** Plátno s obrysem a jestli se obrys opravdu vykreslil. */
export interface PictureOutline {
  readonly canvas: HTMLCanvasElement;
  readonly drawn: boolean;
}

/** Omalovánka připravená k malování i k náhledu: obrázek obrysu, plátno a mapa oblastí. */
export interface PreparedPicture {
  readonly picture: PictureIdentity;
  /** Načtený obrys pro ostré zmenšení v náhledu; `null`, když se nenačetl. */
  readonly image: HTMLImageElement | null;
  readonly outline: PictureOutline;
  readonly regions: RegionMap;
}

/** Načte obrázek obrysu omalovánky; `null`, když nejde načíst. */
export async function loadOutlineImage(picture: PictureIdentity): Promise<HTMLImageElement | null> {
  const svg = OUTLINE_SVGS[picture.id];
  if (svg !== undefined) {
    return loadSvgOutline(svg);
  }
  const pngUrl = OUTLINE_PNG_URLS[picture.id];
  if (pngUrl !== undefined) {
    return loadImageFrom(pngUrl);
  }
  console.warn('omalovánka nemá obrys', picture.id);
  return null;
}

/** SVG obrysu se načte z dočasné adresy v paměti, která se pak hned uvolní. */
async function loadSvgOutline(svg: string): Promise<HTMLImageElement | null> {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    return await loadImageFrom(url);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Obrázek z adresy; `null`, když se nenačte. */
async function loadImageFrom(url: string): Promise<HTMLImageElement | null> {
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return image;
  } catch (error) {
    // Obrázek se nenačetl: plocha zůstane bez obrysu jako jedna oblast, hrát jde dál.
    console.warn('obrys omalovánky se nenačetl', error);
    return null;
  }
}

/** Plátno s obrysem v rozměrech vrstvy barev. */
export function drawPictureOutline(
  image: HTMLImageElement | null,
  width: number,
  height: number,
): PictureOutline {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (context === null || image === null) {
    return { canvas, drawn: false };
  }
  context.drawImage(image, 0, 0, width, height);
  return { canvas, drawn: true };
}

/** RGBA snímek celého plátna pro mapu oblastí. */
export function snapshotOf(canvas: HTMLCanvasElement): ImageData {
  const context = canvas.getContext('2d');
  if (context === null) {
    return new ImageData(canvas.width, canvas.height);
  }
  return context.getImageData(0, 0, canvas.width, canvas.height);
}

/** Vykreslí načtený obrys omalovánky do plátna a spočítá z něj mapu oblastí. */
export function preparePicture(
  picture: PictureIdentity,
  image: HTMLImageElement | null,
  width: number,
  height: number,
): PreparedPicture {
  const outline = drawPictureOutline(image, width, height);
  const regions = buildRegionMap(outlineFromImage(snapshotOf(outline.canvas)));
  return { picture, image, outline, regions };
}
