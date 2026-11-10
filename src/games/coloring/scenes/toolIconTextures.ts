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
