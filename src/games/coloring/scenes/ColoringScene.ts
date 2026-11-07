import Phaser from 'phaser';

import { sharedToneContext } from '../../../shared/audio/sharedAudio';
import { createTonePlayer } from '../../../shared/audio/tonePlayer';
import { GAME_HOST_KEY, isGameHost } from '../../../shared/logic/gameHost';
import type { GameHost } from '../../../shared/logic/gameHost';
import {
  TABLET_GAME_HEIGHT,
  TABLET_GAME_WIDTH,
  gameAreaFor,
} from '../../../shared/logic/viewportLayout';
import type { GameArea } from '../../../shared/logic/viewportLayout';
import { colorNumber } from '../../../shared/logic/theme';
import { followCanvasResolution } from '../../../shared/ui/sharpCanvas';
import { GAME_AREA_KEY } from '../../../shared/ui/viewport';
import type { PointerSample } from '../logic/coloring';
import { layoutColoring } from '../logic/coloringLayout';
import type { ColoringLayout } from '../logic/coloringLayout';
import { startColoringSession } from '../logic/coloringSession';
import type { ColoringPage } from '../logic/coloringSession';
import { initialPalette, markedColors, tapColor } from '../logic/palette';
import type { PaletteState } from '../logic/palette';
import { buildRegionMap, outlineFromImage } from '../logic/regionMap';
import { openColoring } from '../logic/savedPicture';
import type { SavedColoring } from '../logic/savedPicture';
import { PICTURE_STYLE } from '../logic/theme';
import { PaintLayer } from './PaintLayer';
import { PaletteView } from './PaletteView';
import { PICTURE, drawPictureOutline, snapshotOf } from './pictureCanvas';

/** Vrstva barev a obrys mají 1024 × 768 pixelů (poměr plochy 4 : 3). */
const PICTURE_PIXEL_WIDTH = TABLET_GAME_WIDTH;
const PICTURE_PIXEL_HEIGHT = TABLET_GAME_HEIGHT;

const PAINT_TEXTURE_KEY = 'coloringPaint';
const OUTLINE_TEXTURE_KEY = 'coloringOutline';

/** Kolik dotyků Phaser sleduje: první prst maluje, další (dlaň, druhý prst) se jen přeskočí. */
const TRACKED_TOUCHES = 4;

/** Bez stránky (hra spuštěná jinak než z menu) domeček ani odchod nejsou. */
const NO_PAGE: ColoringPage = {
  setHomeAvailable: () => undefined,
  attachSettingsGear: () => () => undefined,
  onLeave: () => undefined,
};

/**
 * Omalovánky (#88): jedna testovací omalovánka a paleta 8 barev. Scéna
 * kreslí a předává dotyky; co se zabarví (ořez do oblasti, souvislá čára,
 * první prst) řeší logika `coloring.ts`, výběr barvy `palette.ts`
 * a rozložení `coloringLayout.ts`. Obrys se vykreslí do plátna při startu,
 * z něj se spočítá mapa oblastí a nakreslí se nad vrstvou barev.
 * Rozmalovaný obrázek a vybranou barvu ukládá podle profilu
 * `savedPicture.ts` (#92).
 */
export class ColoringScene extends Phaser.Scene {
  private gameArea: GameArea = gameAreaFor(undefined);
  private layout: ColoringLayout = layoutColoring(this.gameArea);
  private palette: PaletteState = initialPalette();
  /**
   * Malování s ukládáním podle profilu (#92); vznikne, až se vykreslí obrys
   * a spočítá mapa oblastí.
   */
  private coloring: SavedColoring | null = null;
  private paintLayer: PaintLayer | null = null;
  private pictureBackground: Phaser.GameObjects.Rectangle | null = null;
  private paintImage: Phaser.GameObjects.Image | null = null;
  private outlineImage: Phaser.GameObjects.Image | null = null;
  private readonly paletteView = new PaletteView(this, (index) => this.onColorTapped(index));
  // Společný zvukový kontext stránky, odemčený už ťuknutím v menu (#67 AC6).
  private readonly sounds = createTonePlayer(sharedToneContext);
  /** Přerušení tahu systémem (hovor, gesto systému) hlásí prohlížeč jako zrušený dotyk. */
  private readonly onPointerCancel = (): void => this.interruptStroke();
  /** Schovaná stránka (přepnutí aplikace, zamčení iPadu) obrázek uloží (#92). */
  private readonly onVisibilityChange = (): void => {
    if (document.visibilityState === 'hidden') {
      this.coloring?.suspend();
    }
  };
  /** Zavíraná nebo obnovovaná stránka obrázek uloží (#92). */
  private readonly onPageHide = (): void => this.coloring?.suspend();

  constructor() {
    super('coloring');
  }

  create(): void {
    // Ostré plátno na iPadu a ve zmenšeném zobrazení (#77); kreslí se dál v herních jednotkách.
    followCanvasResolution(this);
    this.gameArea = this.readGameArea();
    this.layout = layoutColoring(this.gameArea);
    startColoringSession(this.readHost() ?? NO_PAGE, () => this.stop());

    this.drawScreen();
    this.listenForTouches();
    this.listenForInterruptions();
    void this.preparePicture();
  }

  override update(): void {
    this.paintLayer?.flush();
  }

  /** Stránka s domečkem z registru; bez ní hra běží bez domečku. */
  private readHost(): GameHost | undefined {
    const stored: unknown = this.registry.get(GAME_HOST_KEY);
    return isGameHost(stored) ? stored : undefined;
  }

  private readGameArea(): GameArea {
    const stored: unknown = this.registry.get(GAME_AREA_KEY);
    return isGameArea(stored) ? stored : gameAreaFor(undefined);
  }

  /** Vykreslí obrys, spočítá z něj mapu oblastí a připraví vrstvu barev. */
  private async preparePicture(): Promise<void> {
    const outline = await drawPictureOutline(PICTURE_PIXEL_WIDTH, PICTURE_PIXEL_HEIGHT);
    if (!this.sys.isActive()) {
      // Dítě odešlo dřív, než se obrázek připravil.
      return;
    }
    const outlineCanvas = outline.canvas;
    const regions = buildRegionMap(outlineFromImage(snapshotOf(outlineCanvas)));
    this.coloring = openColoring({
      regions,
      picture: PICTURE,
      // Bez obrysu se maluje jen v paměti, aby se uložený obrázek nepřepsal prázdnou plochou.
      storage: outline.drawn ? this.readHost()?.storage : undefined,
    });
    this.palette = this.coloring.palette();
    this.paletteView.mark(markedColors(this.palette));
    this.paintLayer = new PaintLayer(this, PAINT_TEXTURE_KEY, regions);
    this.paintLayer.paintAll(this.coloring);
    this.textures.addCanvas(OUTLINE_TEXTURE_KEY, outlineCanvas);
    this.paintImage = this.add.image(0, 0, PAINT_TEXTURE_KEY).setOrigin(0, 0);
    this.outlineImage = this.add.image(0, 0, OUTLINE_TEXTURE_KEY).setOrigin(0, 0);
    this.placePicture();
  }

  // -------------------------------------------------------------------------
  // Kreslení obrazovky
  // -------------------------------------------------------------------------

  private drawScreen(): void {
    this.pictureBackground?.destroy();
    this.pictureBackground = this.add
      .rectangle(0, 0, 0, 0, colorNumber(PICTURE_STYLE.background))
      .setOrigin(0, 0)
      .setStrokeStyle(
        PICTURE_STYLE.frameWidthCss / this.gameArea.scale,
        colorNumber(PICTURE_STYLE.frameColor),
      );
    this.placePicture();
    this.paletteView.place(
      this.layout.paletteColors,
      markedColors(this.palette),
      this.gameArea.scale,
    );
  }

  /** Bílá plocha s rámečkem, vrstva barev a obrys přesně na místo omalovánky. */
  private placePicture(): void {
    const { picture } = this.layout;
    this.pictureBackground
      ?.setPosition(picture.left, picture.top)
      .setSize(picture.width, picture.height);
    // Vrstva barev nad bílou plochou, obrys nad vrstvou barev.
    for (const [depth, image] of [
      [1, this.paintImage],
      [2, this.outlineImage],
    ] as const) {
      image
        ?.setPosition(picture.left, picture.top)
        .setDisplaySize(picture.width, picture.height)
        .setDepth(depth);
    }
  }

  private onGameAreaChanged(): void {
    this.gameArea = this.readGameArea();
    this.layout = layoutColoring(this.gameArea);
    // Otočení telefonu: rozpracovaný tah se ukončí, namalované zůstane.
    this.interruptStroke();
    this.drawScreen();
  }

  // -------------------------------------------------------------------------
  // Paleta
  // -------------------------------------------------------------------------

  private onColorTapped(index: number): void {
    if (this.coloring === null) {
      // Obrázek se ještě připravuje: barva se jen vybere, uloží se až s obrázkem.
      const { state, tones } = tapColor(this.palette, index);
      this.palette = state;
      this.sounds.play(tones);
    } else {
      this.sounds.play(this.coloring.tapColor(index));
      this.palette = this.coloring.palette();
    }
    this.paletteView.mark(markedColors(this.palette));
  }

  // -------------------------------------------------------------------------
  // Malování
  // -------------------------------------------------------------------------

  private listenForTouches(): void {
    // Phaser má vždy ukazatel myši navíc k dotykům.
    const trackedTouches = this.input.manager.pointersTotal - 1;
    if (trackedTouches < TRACKED_TOUCHES) {
      this.input.addPointer(TRACKED_TOUCHES - trackedTouches);
    }
    this.input.on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer) => {
      if (this.coloring !== null) {
        this.paintLayer?.paint(this.coloring.pointerDown(this.sampleOf(pointer)), this.coloring);
      }
    });
    this.input.on(Phaser.Input.Events.POINTER_MOVE, (pointer: Phaser.Input.Pointer) => {
      if (this.coloring !== null) {
        this.paintLayer?.paint(this.coloring.pointerMove(this.sampleOf(pointer)), this.coloring);
      }
    });
    const onUp = (pointer: Phaser.Input.Pointer): void => this.coloring?.pointerUp(pointer.id);
    this.input.on(Phaser.Input.Events.POINTER_UP, onUp);
    this.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, onUp);
  }

  /** Dotyk v pixelech vrstvy barev; bod mimo omalovánku je mimo plochu. */
  private sampleOf(pointer: Phaser.Input.Pointer): PointerSample {
    const { picture } = this.layout;
    return {
      id: pointer.id,
      x: ((pointer.worldX - picture.left) * PICTURE_PIXEL_WIDTH) / picture.width,
      y: ((pointer.worldY - picture.top) * PICTURE_PIXEL_HEIGHT) / picture.height,
      kind: pointer.wasTouch ? 'touch' : 'mouse',
    };
  }

  private interruptStroke(): void {
    this.coloring?.interrupt();
  }

  /**
   * Systémové přerušení (zrušený dotyk, skrytá stránka, odchod z okna)
   * ukončí tah tam, kam došel (#88 AC5). Schování a zavření stránky
   * obrázek synchronně uloží (#92 AC1, AC3).
   */
  private listenForInterruptions(): void {
    const canvas = this.game.canvas;
    canvas.addEventListener('pointercancel', this.onPointerCancel);
    canvas.addEventListener('touchcancel', this.onPointerCancel);
    this.game.events.on(Phaser.Core.Events.HIDDEN, this.onPointerCancel);
    this.game.events.on(Phaser.Core.Events.BLUR, this.onPointerCancel);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    window.addEventListener('pagehide', this.onPageHide);
    this.registry.events.on(`changedata-${GAME_AREA_KEY}`, this.onGameAreaChanged, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      canvas.removeEventListener('pointercancel', this.onPointerCancel);
      canvas.removeEventListener('touchcancel', this.onPointerCancel);
      this.game.events.off(Phaser.Core.Events.HIDDEN, this.onPointerCancel);
      this.game.events.off(Phaser.Core.Events.BLUR, this.onPointerCancel);
      document.removeEventListener('visibilitychange', this.onVisibilityChange);
      window.removeEventListener('pagehide', this.onPageHide);
      this.registry.events.off(`changedata-${GAME_AREA_KEY}`, this.onGameAreaChanged, this);
      this.stop();
    });
  }

  /** Odchod z hry: tah skončí tam, kam došel, obrázek se uloží (#92) a zvuky ztichnou. */
  private stop(): void {
    this.coloring?.suspend();
    this.sounds.stopAll();
  }
}

/** Je hodnota z registru herní plocha? */
function isGameArea(value: unknown): value is GameArea {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const area = value as Partial<GameArea>;
  return (
    typeof area.mode === 'string' &&
    typeof area.width === 'number' &&
    typeof area.height === 'number' &&
    typeof area.scale === 'number'
  );
}
