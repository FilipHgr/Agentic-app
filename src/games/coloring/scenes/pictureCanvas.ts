/// <reference types="vite/client" />
/**
 * Obrysy omalovánek sady (#88, #124) vykreslené do plátna. Ze stejného
 * plátna se spočítá mapa oblastí (`getImageData`) a nakreslí obrys nad
 * vrstvou barev, takže obrys na obrazovce přesně sedí s hranicemi oblastí.
 * SVG jsou v repozitáři a přibalí se ke hře, nic se nestahuje z cizích serverů.
 * Při změně obrysu se v `logic/pictureSet.ts` zvýší verze omalovánky (#92).
 */

import { buildRegionMap, outlineFromImage } from '../logic/regionMap';
import type { RegionMap } from '../logic/regionMap';
import type { PictureIdentity } from '../logic/savedPicture';
import circlesSvg from '../pictures/circles.svg?raw';
import houseSvg from '../pictures/house.svg?raw';
import starSvg from '../pictures/star.svg?raw';

/** SVG obrysu podle označení omalovánky ze sady. */
const OUTLINE_SVGS: Readonly<Record<string, string>> = {
  house: houseSvg,
  circles: circlesSvg,
  star: starSvg,
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
  if (svg === undefined) {
    console.warn('omalovánka nemá obrys', picture.id);
    return null;
  }
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return image;
  } catch (error) {
    // Obrázek se nenačetl: plocha zůstane bez obrysu jako jedna oblast, hrát jde dál.
    console.warn('obrys omalovánky se nenačetl', error);
    return null;
  } finally {
    URL.revokeObjectURL(url);
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
