/**
 * Ikony nástrojů (#106): hotová SVG z Google Noto Emoji ze složky
 * `src/games/coloring/icons/`, klíč (#139/#140) a ikony tlačítek alba a malování (#153) jako
 * obrázky WebP. Vite je přibalí ke hře jako samostatné
 * soubory (`?no-inline`, nikdy ne z cizího serveru) a scéna je načte
 * v `preload`. Pro každou zobrazenou velikost se SVG vykreslí do vlastní
 * textury v obrazových bodech plátna, aby byla ikona ostrá i na retině
 * a nebyla rozmazaná zvětšením ani zmenšením malé bitmapy.
 */

import type Phaser from 'phaser';

import { CANVAS_PIXELS_PER_CSS_PX } from '../../../shared/logic/canvasResolution';
import { toolIconAsset } from '../logic/toolIcons';
import type { ToolId } from '../logic/toolPanel';

/** Adresy SVG ikon v sestavené hře podle jména souboru. */
const ICON_URLS: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(
    import.meta.glob<string>('../icons/*.svg', {
      query: '?no-inline',
      import: 'default',
      eager: true,
    }),
  ).map(([path, url]) => [path.replace('../icons/', ''), url]),
);

/** Adresy obrázků WebP (klíč z #139/#140, tlačítka z #153) podle jména souboru. */
const BITMAP_ICON_URLS: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(
    import.meta.glob<string>('../icons/*.webp', {
      query: '?no-inline',
      import: 'default',
      eager: true,
    }),
  ).map(([path, url]) => [path.replace('../icons/', ''), url]),
);

/** Velikost, ve které Phaser SVG načte; ostré velikosti se z něj kreslí znovu. */
const SOURCE_SIZE_PX = 128;

function sourceKey(file: string): string {
  return `coloringIcon:${file}`;
}

/** Načte SVG a obrázky WebP všech ikon; volá se v `preload` scény. */
export function preloadToolIcons(scene: Phaser.Scene): void {
  for (const [file, url] of Object.entries(ICON_URLS)) {
    scene.load.svg(sourceKey(file), url, { width: SOURCE_SIZE_PX, height: SOURCE_SIZE_PX });
  }
  for (const [file, url] of Object.entries(BITMAP_ICON_URLS)) {
    scene.load.image(sourceKey(file), url);
  }
}

/**
 * Klíč textury ikony nástroje `tool` pro čtverec o straně `sideCss` CSS px,
 * nebo `null`, když se SVG nenačetlo (např. výpadek sítě): úchyt i panel
 * pak fungují dál, jen bez obrázku.
 */
export function toolIconTexture(scene: Phaser.Scene, tool: ToolId, sideCss: number): string | null {
  return iconFileTexture(scene, toolIconAsset(tool).file, sideCss);
}

/**
 * Klíč ostré textury ikony ze souboru `file` ve složce `icons/` (nástroje,
 * fotoaparát a kniha z #126) pro čtverec o straně `sideCss` CSS px, nebo
 * `null`, když se SVG nenačetlo.
 */
export function iconFileTexture(scene: Phaser.Scene, file: string, sideCss: number): string | null {
  const source = sourceKey(file);
  if (!scene.textures.exists(source)) {
    return null;
  }
  const pixels = Math.max(1, Math.ceil(sideCss * CANVAS_PIXELS_PER_CSS_PX));
  const key = `${source}@${pixels}`;
  if (scene.textures.exists(key)) {
    return key;
  }
  // Zdroj se ověří dřív, než vznikne textura, aby v paměti nezůstala prázdná.
  const image = scene.textures.get(source).getSourceImage();
  if (!(image instanceof HTMLImageElement)) {
    return null;
  }
  const texture = scene.textures.createCanvas(key, pixels, pixels);
  if (texture === null) {
    return null;
  }
  // SVG obrázek se v plátně vykreslí vektorově přímo ve velikosti textury,
  // WebP se zmenší (čtvercový obrázek, poměr stran zůstane).
  texture.context.imageSmoothingQuality = 'high';
  texture.context.drawImage(image, 0, 0, pixels, pixels);
  texture.refresh();
  return key;
}

/**
 * Ukáže v obrázku `image` ikonu nástroje přes čtverec `icon` (herní
 * jednotky v souřadnicích rodiče obrázku); bez načteného SVG ho schová.
 */
export function showToolIcon(
  image: Phaser.GameObjects.Image,
  tool: ToolId,
  icon: { readonly left: number; readonly top: number; readonly width: number },
  cssScale: number,
): void {
  const key = toolIconTexture(image.scene, tool, icon.width * cssScale);
  if (key === null) {
    image.setVisible(false);
    return;
  }
  image
    .setTexture(key)
    .setOrigin(0, 0)
    .setPosition(icon.left, icon.top)
    .setDisplaySize(icon.width, icon.width)
    .setVisible(true);
}

/** Naposledy vytvořená textura ikony s obrysem podle souboru a barvy (po otočení se stará smaže). */
const latestOutlinedKeys = new Map<string, string>();

/** Kolik posunů siluety skládá obrys ikony s obrysem a na kolika vzdálenostech. */
const OUTLINED_STEPS = 24;
const OUTLINED_RINGS = 4;

/**
 * Klíč ostré textury ikony `file` s tmavým obrysem vně tvaru (#164 AC5),
 * nebo `null`, když se SVG nenačetlo. Ikona má stranu `sideCss` CSS px,
 * obrys šířku `outlineCss` CSS px v barvě `color`; textura je o obrys
 * větší na každé straně, ikona je v ní uprostřed beze změny kresby.
 */
export function iconWithOutlineTexture(
  scene: Phaser.Scene,
  file: string,
  sideCss: number,
  outlineCss: number,
  color: string,
): string | null {
  const plain = iconFileTexture(scene, file, sideCss);
  if (plain === null) {
    return null;
  }
  const outlinePixels = Math.max(1, Math.round(outlineCss * CANVAS_PIXELS_PER_CSS_PX));
  const key = `${plain}:outlined:${outlinePixels}:${color}`;
  if (scene.textures.exists(key)) {
    return key;
  }
  const family = `${file}:outlined:${color}`;
  const previous = latestOutlinedKeys.get(family);
  if (previous !== undefined && scene.textures.exists(previous)) {
    scene.textures.remove(previous);
  }
  const source = scene.textures.get(plain).getSourceImage();
  if (!(source instanceof HTMLCanvasElement)) {
    return null;
  }
  const pixels = source.width + 2 * outlinePixels;
  const texture = scene.textures.createCanvas(key, pixels, pixels);
  if (texture === null) {
    return null;
  }
  drawWithOutline(texture.context, source, outlinePixels, color);
  texture.refresh();
  latestOutlinedKeys.set(family, key);
  return key;
}

/** Silueta ikony v barvě `color` posunutá dokola do vzdálenosti `width`, nahoře ikona. */
function drawWithOutline(
  context: CanvasRenderingContext2D,
  source: HTMLCanvasElement,
  width: number,
  color: string,
): void {
  const silhouette = document.createElement('canvas');
  silhouette.width = source.width;
  silhouette.height = source.height;
  const shape = silhouette.getContext('2d');
  if (shape === null) {
    return;
  }
  shape.drawImage(source, 0, 0);
  shape.globalCompositeOperation = 'source-in';
  shape.fillStyle = color;
  shape.fillRect(0, 0, silhouette.width, silhouette.height);
  for (let ring = 1; ring <= OUTLINED_RINGS; ring += 1) {
    const distance = (width * ring) / OUTLINED_RINGS;
    for (let step = 0; step < OUTLINED_STEPS; step += 1) {
      const angle = (step / OUTLINED_STEPS) * 2 * Math.PI;
      context.drawImage(
        silhouette,
        width + Math.cos(angle) * distance,
        width + Math.sin(angle) * distance,
      );
    }
  }
  context.drawImage(source, width, width);
}

/** Jak se ikona překreslí: jen obrys tvaru (#140 ukazatel s 0 klíči, #159 obrys celého klíče). */
export type IconVariant = 'outline';

/** Tloušťka obrysu jako díl strany ikony a kolik posunů ho skládá. */
const OUTLINE_WIDTH_SHARE = 0.05;
const OUTLINE_STEPS = 16;

/**
 * Naposledy vytvořená textura každé podoby ikony (soubor, podoba, barva):
 * po změně velikosti (otočení) se stará smaže, aby se textury nehromadily.
 * Volající ji musí přestat používat dřív, než si vyžádá novou velikost.
 */
const latestVariantKeys = new Map<string, string>();

/**
 * Klíč ostré textury ikony `file` překreslené jako `variant` pro čtverec
 * o straně `sideCss` CSS px, nebo `null`, když se SVG nenačetlo:
 * `'outline'` jen obrys tvaru ikony v barvě `color` (ukazatel klíčů).
 */
export function iconVariantTexture(
  scene: Phaser.Scene,
  file: string,
  sideCss: number,
  variant: IconVariant,
  color: string,
): string | null {
  const plain = iconFileTexture(scene, file, sideCss);
  if (plain === null) {
    return null;
  }
  const key = `${plain}:${variant}:${color}`;
  if (scene.textures.exists(key)) {
    return key;
  }
  const family = `${file}:${variant}:${color}`;
  const previous = latestVariantKeys.get(family);
  if (previous !== undefined && scene.textures.exists(previous)) {
    scene.textures.remove(previous);
  }
  const source = scene.textures.get(plain).getSourceImage();
  if (!(source instanceof HTMLCanvasElement)) {
    return null;
  }
  const pixels = source.width;
  const texture = scene.textures.createCanvas(key, pixels, pixels);
  if (texture === null) {
    return null;
  }
  drawOutline(texture.context, source, color);
  texture.refresh();
  latestVariantKeys.set(family, key);
  return key;
}

/** Obrys tvaru: silueta posunutá dokola a vnitřek vyříznutý. */
function drawOutline(
  context: CanvasRenderingContext2D,
  source: HTMLCanvasElement,
  color: string,
): void {
  const pixels = source.width;
  const silhouette = document.createElement('canvas');
  silhouette.width = pixels;
  silhouette.height = pixels;
  const shape = silhouette.getContext('2d');
  if (shape === null) {
    return;
  }
  shape.drawImage(source, 0, 0);
  shape.globalCompositeOperation = 'source-in';
  shape.fillStyle = color;
  shape.fillRect(0, 0, pixels, pixels);
  const width = Math.max(1, pixels * OUTLINE_WIDTH_SHARE);
  for (let step = 0; step < OUTLINE_STEPS; step += 1) {
    const angle = (step / OUTLINE_STEPS) * 2 * Math.PI;
    context.drawImage(silhouette, Math.cos(angle) * width, Math.sin(angle) * width);
  }
  context.globalCompositeOperation = 'destination-out';
  context.drawImage(silhouette, 0, 0);
  context.globalCompositeOperation = 'source-over';
}
