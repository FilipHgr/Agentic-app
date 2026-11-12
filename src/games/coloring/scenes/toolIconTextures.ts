/**
 * Ikony nástrojů (#106), fotoaparátu a knihy (#126): hotová SVG z Google Noto Emoji ze složky
 * `src/games/coloring/icons/`. Vite je přibalí ke hře jako samostatné
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

/** Velikost, ve které Phaser SVG načte; ostré velikosti se z něj kreslí znovu. */
const SOURCE_SIZE_PX = 128;

function sourceKey(file: string): string {
  return `coloringIcon:${file}`;
}

/** Načte SVG všech ikon; volá se v `preload` scény. */
export function preloadToolIcons(scene: Phaser.Scene): void {
  for (const [file, url] of Object.entries(ICON_URLS)) {
    scene.load.svg(sourceKey(file), url, { width: SOURCE_SIZE_PX, height: SOURCE_SIZE_PX });
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
  // SVG obrázek se v plátně vykreslí vektorově přímo ve velikosti textury.
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

/** Jak se ikona překreslí: jen obrys tvaru (#140, 0 klíčů), nebo jen hlava klíče (půlka). */
export type IconVariant = 'outline' | 'keyHead';

/** Tloušťka obrysu jako díl strany ikony a kolik posunů ho skládá. */
const OUTLINE_WIDTH_SHARE = 0.035;
const OUTLINE_STEPS = 16;

/**
 * Naposledy vytvořená textura každé podoby ikony (soubor, podoba, barva):
 * po změně velikosti (otočení) se stará smaže, aby se textury nehromadily.
 * Volající ji musí přestat používat dřív, než si vyžádá novou velikost.
 */
const latestVariantKeys = new Map<string, string>();

/** Alfa, od které bod půlky klíče patří kresbě (ořez hlavy podle obsahu). */
const OPAQUE_ALPHA = 8;

/**
 * Klíč ostré textury ikony `file` překreslené jako `variant` pro čtverec
 * o straně `sideCss` CSS px, nebo `null`, když se SVG nenačetlo:
 * - `'outline'` jen obrys tvaru ikony v barvě `color` (ukazatel s 0 klíči),
 * - `'keyHead'` jen pravá horní polovina šikmého klíče Noto, hlava s očkem
 *   (půlka klíče jako u cíle mapy v Počítání, #139).
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
  if (variant === 'outline') {
    drawOutline(texture.context, source, color);
  } else {
    drawKeyHead(texture.context, source);
  }
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

/**
 * Hlava šikmého klíče: část ikony nad úhlopříčkou z levého horního do
 * pravého dolního rohu, oříznutá podle kresby a zvětšená na celý čtverec
 * (se zachovaným poměrem stran, uprostřed).
 */
function drawKeyHead(context: CanvasRenderingContext2D, source: HTMLCanvasElement): void {
  const pixels = source.width;
  const half = document.createElement('canvas');
  half.width = pixels;
  half.height = pixels;
  const halfContext = half.getContext('2d');
  if (halfContext === null) {
    return;
  }
  halfContext.beginPath();
  halfContext.moveTo(0, 0);
  halfContext.lineTo(pixels, 0);
  halfContext.lineTo(pixels, pixels);
  halfContext.closePath();
  halfContext.clip();
  halfContext.drawImage(source, 0, 0);
  const bounds = opaqueBounds(halfContext, pixels);
  if (bounds === null) {
    return;
  }
  const scale = pixels / Math.max(bounds.width, bounds.height);
  const width = bounds.width * scale;
  const height = bounds.height * scale;
  context.drawImage(
    half,
    bounds.left,
    bounds.top,
    bounds.width,
    bounds.height,
    (pixels - width) / 2,
    (pixels - height) / 2,
    width,
    height,
  );
}

/** Nejmenší obdélník s kresbou v plátně o straně `pixels`; `null` u prázdného. */
function opaqueBounds(
  context: CanvasRenderingContext2D,
  pixels: number,
): { left: number; top: number; width: number; height: number } | null {
  const data = context.getImageData(0, 0, pixels, pixels).data;
  let left = pixels;
  let top = pixels;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < pixels; y += 1) {
    for (let x = 0; x < pixels; x += 1) {
      if ((data[(y * pixels + x) * 4 + 3] ?? 0) >= OPAQUE_ALPHA) {
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
    }
  }
  return right < 0 ? null : { left, top, width: right - left + 1, height: bottom - top + 1 };
}
