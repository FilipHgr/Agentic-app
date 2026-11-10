/**
 * Vrstva barev omalovánky (#88) jako textura Phaseru v rozměrech mapy
 * oblastí (1024 × 768). Pixely drží scéna v paměti; po tahu se změní jen
 * zasažený obdélník a do grafické karty se pošle jen ten, nejvýš jednou
 * za snímek (`flush`). Pixely obrysu mají barvu obrysu, takže mezi barvou
 * a obrysem nad ní nezůstane bílý lem ani při zvětšení textury.
 */

import Phaser from 'phaser';

import { joinAreas } from '../logic/coloring';
import type { ChangedArea, Coloring } from '../logic/coloring';
import { OUTLINE_REGION } from '../logic/regionMap';
import type { RegionMap } from '../logic/regionMap';
import { PICTURE_STYLE, rgbOf } from '../logic/theme';
import { ALL_COLORS } from '../logic/toolColorSets';

const OPAQUE = 255;

/** Všechny barvy hry (i ze sad nástrojů, #116) jako RGB, ať se při malování nepřevádějí znovu. */
const COLOR_RGB = ALL_COLORS.map((color) => rgbOf(color.hex));

/** Bílá plocha pod barvami. */
const BACKGROUND_RGB = rgbOf(PICTURE_STYLE.background);

export class PaintLayer {
  private readonly texture: Phaser.Textures.CanvasTexture;
  private readonly pixels: ImageData;
  /** Co se od posledního snímku změnilo a ještě není v textuře. */
  private pending: ChangedArea | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    readonly textureKey: string,
    private readonly regions: RegionMap,
  ) {
    const texture = scene.textures.createCanvas(textureKey, regions.width, regions.height);
    if (texture === null) {
      throw new Error('vrstva barev nejde vytvořit');
    }
    this.texture = texture;
    this.pixels = new ImageData(regions.width, regions.height);
    this.fillEmptyPicture();
    texture.context.putImageData(this.pixels, 0, 0);
    texture.refresh();
  }

  /** Prázdná omalovánka: bílá plocha a tmavé pixely obrysu. */
  private fillEmptyPicture(): void {
    const outline = rgbOf(PICTURE_STYLE.outlineColor);
    const { regionIds } = this.regions;
    for (let index = 0; index < regionIds.length; index += 1) {
      this.setPixel(index, regionIds[index] === OUTLINE_REGION ? outline : BACKGROUND_RGB);
    }
  }

  private setPixel(index: number, [red, green, blue]: readonly [number, number, number]): void {
    const data = this.pixels.data;
    const offset = index * 4;
    data[offset] = red;
    data[offset + 1] = green;
    data[offset + 2] = blue;
    data[offset + 3] = OPAQUE;
  }

  /**
   * Přepíše pixely v obdélníku `area` podle barev omalovánky. Pixel bez
   * barvy (např. po vrácení tahu, #89) dostane zase bílou plochu.
   */
  paint(area: ChangedArea | null, coloring: Pick<Coloring, 'colorAt'>): void {
    if (area === null) {
      return;
    }
    const { regionIds, width } = this.regions;
    for (let y = area.top; y < area.bottom; y += 1) {
      for (let x = area.left; x < area.right; x += 1) {
        const index = y * width + x;
        if (regionIds[index] === OUTLINE_REGION) {
          continue;
        }
        const color = coloring.colorAt(x, y);
        this.setPixel(index, (color === null ? undefined : COLOR_RGB[color]) ?? BACKGROUND_RGB);
      }
    }
    this.pending = joinAreas(this.pending, area);
  }

  /** Překreslí celý obrázek, například po načtení uloženého (#92). */
  paintAll(coloring: Pick<Coloring, 'colorAt'>): void {
    this.paint(
      { left: 0, top: 0, right: this.regions.width, bottom: this.regions.height },
      coloring,
    );
  }

  /**
   * Kopie obrázku tak, jak je teď v pixelech (i s tím, co ještě není
   * v textuře), pro fotku při uložení do alba (#126). `null`, když
   * plátno nejde vytvořit.
   */
  snapshot(): HTMLCanvasElement | null {
    const canvas = document.createElement('canvas');
    canvas.width = this.regions.width;
    canvas.height = this.regions.height;
    const context = canvas.getContext('2d');
    if (context === null) {
      return null;
    }
    context.putImageData(this.pixels, 0, 0);
    return canvas;
  }

  /** Pošle změněný obdélník do textury. Volá se jednou za snímek. */
  flush(): void {
    const area = this.pending;
    if (area === null) {
      return;
    }
    this.pending = null;
    const width = area.right - area.left;
    const height = area.bottom - area.top;
    // Plátno textury drží pravdu i pro obnovu po ztrátě kontextu WebGL.
    this.texture.context.putImageData(this.pixels, 0, 0, area.left, area.top, width, height);
    if (!this.uploadToGpu(area, width, height)) {
      this.texture.refresh();
    }
  }

  /** Nahraje do textury WebGL jen obdélník `area`; bez WebGL vrátí `false`. */
  private uploadToGpu(area: ChangedArea, width: number, height: number): boolean {
    const renderer = this.scene.game.renderer;
    const glTexture = this.texture.source[0]?.glTexture;
    if (!(renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer) || !glTexture?.webGLTexture) {
      return false;
    }
    const gl = renderer.gl;
    if (gl.isContextLost()) {
      return true;
    }
    // Stejně jako Phaser při nahrání textury: jednotka 0 a pak vrátit původní texturu.
    gl.activeTexture(gl.TEXTURE0);
    const previous = gl.getParameter(gl.TEXTURE_BINDING_2D) as WebGLTexture | null;
    gl.bindTexture(gl.TEXTURE_2D, glTexture.webGLTexture);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, glTexture.pma);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texSubImage2D(
      gl.TEXTURE_2D,
      0,
      area.left,
      area.top,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      this.cutOut(area, width, height),
    );
    gl.bindTexture(gl.TEXTURE_2D, previous);
    return true;
  }

  /** Pixely obdélníku `area` jako samostatný snímek. */
  private cutOut(area: ChangedArea, width: number, height: number): ImageData {
    const part = new ImageData(width, height);
    const rowLength = width * 4;
    for (let row = 0; row < height; row += 1) {
      const start = ((area.top + row) * this.regions.width + area.left) * 4;
      part.data.set(this.pixels.data.subarray(start, start + rowLength), row * rowLength);
    }
    return part;
  }
}
