/// <reference types="vite/client" />
/**
 * Obrys testovací omalovánky (#88) vykreslený do plátna. Ze stejného plátna
 * se spočítá mapa oblastí (`getImageData`) a nakreslí obrys nad vrstvou
 * barev, takže obrys na obrazovce přesně sedí s hranicemi oblastí.
 * SVG je v repozitáři a přibalí se ke hře, nic se nestahuje z cizích serverů.
 */

import pictureSvg from '../pictures/house.svg?raw';

/** Plátno s obrysem v rozměrech vrstvy barev. */
export async function drawPictureOutline(
  width: number,
  height: number,
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (context === null) {
    return canvas;
  }
  const url = URL.createObjectURL(new Blob([pictureSvg], { type: 'image/svg+xml' }));
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    context.drawImage(image, 0, 0, width, height);
  } catch (error) {
    // Obrázek se nevykreslil: plocha zůstane bez obrysu jako jedna oblast, hrát jde dál.
    console.warn('obrys omalovánky se nevykreslil', error);
  } finally {
    URL.revokeObjectURL(url);
  }
  return canvas;
}

/** RGBA snímek celého plátna pro mapu oblastí. */
export function snapshotOf(canvas: HTMLCanvasElement): ImageData {
  const context = canvas.getContext('2d');
  if (context === null) {
    return new ImageData(canvas.width, canvas.height);
  }
  return context.getImageData(0, 0, canvas.width, canvas.height);
}
