/**
 * Vlajky jazyků (#138): v nabídce jazyků a pod kódem na tlačítku jazyka.
 * SVG ze složky `src/menu/flags/` Vite přibalí k menu jako samostatné
 * soubory (`?no-inline`, nikdy ne z cizího serveru), scéna je načte
 * v `preload`. Pro každou zobrazenou velikost se SVG vykreslí do vlastní
 * textury v bodech plátna se zaoblenými rohy, aby byla vlajka ostrá i na
 * retině iPadu a nebyla rozmazaná zvětšením malé bitmapy.
 */

import type Phaser from 'phaser';

import { fitFlag, svgAspectRatio } from '../logic/languageFlags';
import type { FlagFit, LanguageFlag } from '../logic/languageFlags';
import type { MenuBox } from '../logic/menuLayout';
import { MENU_STYLE } from '../logic/menuTheme';

/** Adresy SVG vlajek v sestavené hře podle jména souboru. */
const FLAG_URLS: Readonly<Record<string, string>> = filesByName(
  import.meta.glob<string>('../flags/*.svg', {
    query: '?no-inline',
    import: 'default',
    eager: true,
  }),
);

/** Text SVG vlajek podle jména souboru, jen kvůli poměru stran z `viewBox`. */
const FLAG_SOURCES: Readonly<Record<string, string>> = filesByName(
  import.meta.glob<string>('../flags/*.svg', {
    query: '?raw',
    import: 'default',
    eager: true,
  }),
);

/** Výška, ve které Phaser SVG načte; ostré velikosti se z něj kreslí znovu. */
const SOURCE_HEIGHT_PX = 128;
/** Zaoblení rohů vlajky vůči její výšce (3 px u vlajky 20 px, schválený obrázek). */
const CORNER_RADIUS_SHARE = 3 / 20;
/** Šířka vnitřního obrysu vlajky v px okna. */
const OUTLINE_WIDTH = 1;

function filesByName(files: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(files).map(([path, value]) => [path.replace('../flags/', ''), value]),
  );
}

function sourceKey(file: string): string {
  return `menuFlag:${file}`;
}

/** Poměr stran vlajky ze souboru; bez platného `viewBox` 3 : 2. */
function aspectRatioOf(file: string): number {
  return svgAspectRatio(FLAG_SOURCES[file] ?? '') ?? 3 / 2;
}

/** Načte SVG všech vlajek; volá se v `preload` scény. */
export function preloadLanguageFlags(scene: Phaser.Scene): void {
  for (const [file, url] of Object.entries(FLAG_URLS)) {
    if (scene.textures.exists(sourceKey(file))) {
      continue;
    }
    scene.load.svg(sourceKey(file), url, {
      width: Math.round(SOURCE_HEIGHT_PX * aspectRatioOf(file)),
      height: SOURCE_HEIGHT_PX,
    });
  }
}

/**
 * Obrázek vlajky `flag` vepsaný se zachovaným poměrem stran do rámečku
 * `frame` (px okna). `origin` je bod v px okna, který je počátkem
 * kontejneru obrázku. Bez vlajky nebo bez načteného SVG (výpadek sítě)
 * vrátí `null` a tlačítko či řádek fungují dál bez vlajky.
 */
export function languageFlagImage(
  scene: Phaser.Scene,
  flag: LanguageFlag | null,
  frame: MenuBox,
  origin: { readonly x: number; readonly y: number },
  unit: number,
): Phaser.GameObjects.Image | null {
  if (flag === null) {
    return null;
  }
  const fit = fitFlag(frame.right - frame.left, frame.bottom - frame.top, aspectRatioOf(flag.file));
  const key = roundedTexture(scene, flag.file, fit, unit);
  if (key === null) {
    return null;
  }
  return scene.add
    .image((frame.left + fit.left - origin.x) * unit, (frame.top + fit.top - origin.y) * unit, key)
    .setOrigin(0, 0)
    .setDisplaySize(fit.width * unit, fit.height * unit);
}

/** Textura vlajky se zaoblenými rohy ve velikosti kreslení; vznikne jednou. */
function roundedTexture(
  scene: Phaser.Scene,
  file: string,
  fit: FlagFit,
  unit: number,
): string | null {
  const source = sourceKey(file);
  if (!scene.textures.exists(source)) {
    return null;
  }
  const width = Math.max(1, Math.round(fit.width * unit));
  const height = Math.max(1, Math.round(fit.height * unit));
  const key = `${source}@${width}x${height}`;
  if (scene.textures.exists(key)) {
    return key;
  }
  // Zdroj se ověří dřív, než vznikne textura, aby v paměti nezůstala prázdná.
  const image = scene.textures.get(source).getSourceImage();
  if (!(image instanceof HTMLImageElement)) {
    return null;
  }
  const texture = scene.textures.createCanvas(key, width, height);
  if (texture === null) {
    return null;
  }
  const context = texture.context;
  const drawnWidth = fit.drawnWidth * (width / fit.width);
  roundedRectPath(context, width, height, height * CORNER_RADIUS_SHARE);
  context.clip();
  // SVG obrázek se v plátně vykreslí vektorově; širší vlajka je vycentrovaná
  // a její kraje ořízne zaoblená cesta.
  context.drawImage(image, (width - drawnWidth) / 2, 0, drawnWidth, height);
  // Obrys po zaoblené cestě: díky ořezu je vidět jen jeho vnitřní polovina.
  context.strokeStyle = MENU_STYLE.languageFlagOutline;
  context.lineWidth = 2 * OUTLINE_WIDTH * unit;
  context.stroke();
  texture.refresh();
  return key;
}

/** Cesta obdélníku se zaoblenými rohy (bez `roundRect`, který starší Safari nemá). */
function roundedRectPath(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  radius: number,
): void {
  context.beginPath();
  context.moveTo(radius, 0);
  context.arcTo(width, 0, width, height, radius);
  context.arcTo(width, height, 0, height, radius);
  context.arcTo(0, height, 0, 0, radius);
  context.arcTo(0, 0, width, 0, radius);
  context.closePath();
}
