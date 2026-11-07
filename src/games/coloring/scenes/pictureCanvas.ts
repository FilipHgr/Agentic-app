/// <reference types="vite/client" />
/**
 * Obrys testovací omalovánky (#88) vykreslený do plátna. Ze stejného plátna
 * se spočítá mapa oblastí (`getImageData`) a nakreslí obrys nad vrstvou
 * barev, takže obrys na obrazovce přesně sedí s hranicemi oblastí.
 * SVG je v repozitáři a přibalí se ke hře, nic se nestahuje z cizích serverů.
 */

import type { PictureIdentity } from '../logic/savedPicture';
import pictureSvg from '../pictures/house.svg?raw';

/** Testovací omalovánka; při změně obrysu v `house.svg` se zvýší verze (#92). */
export const PICTURE: PictureIdentity = { id: 'house', version: 1 };

/** Plátno s obrysem a jestli se obrys opravdu vykreslil. */
export interface PictureOutline {
  readonly canvas: HTMLCanvasElement;
  readonly drawn: boolean;
}

/** Plátno s obrysem v rozměrech vrstvy barev. */
export async function drawPictureOutline(width: number, height: number): Promise<PictureOutline> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (context === null) {
    return { canvas, drawn: false };
  }
  const url = URL.createObjectURL(new Blob([pictureSvg], { type: 'image/svg+xml' }));
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    context.drawImage(image, 0, 0, width, height);
    return { canvas, drawn: true };
  } catch (error) {
    // Obrázek se nevykreslil: plocha zůstane bez obrysu jako jedna oblast, hrát jde dál.
    console.warn('obrys omalovánky se nevykreslil', error);
    return { canvas, drawn: false };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** RGBA snímek celého plátna pro mapu oblastí. */
export function snapshotOf(canvas: HTMLCanvasElement): ImageData {
  const context = canvas.getContext('2d');
  if (context === null) {
    return new ImageData(canvas.width, canvas.height);
  }
  return context.getImageData(0, 0, canvas.width, canvas.height);
}
