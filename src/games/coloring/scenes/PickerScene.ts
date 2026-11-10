import Phaser from 'phaser';

import { sharedToneContext } from '../../../shared/audio/sharedAudio';
import { createTonePlayer } from '../../../shared/audio/tonePlayer';
import { GAME_HOST_KEY, isGameHost } from '../../../shared/logic/gameHost';
import type { GameHost, HomeHoldDecision } from '../../../shared/logic/gameHost';
import {
  TABLET_GAME_HEIGHT,
  TABLET_GAME_WIDTH,
  gameAreaFor,
} from '../../../shared/logic/viewportLayout';
import type { GameArea } from '../../../shared/logic/viewportLayout';
import { followCanvasResolution } from '../../../shared/ui/sharpCanvas';
import { GAME_AREA_KEY } from '../../../shared/ui/viewport';
import { COLORING_GAME_AREA_FIT } from '../logic/coloringLayout';
import { startColoringSession } from '../logic/coloringSession';
import type { ColoringPage } from '../logic/coloringSession';
import { homeHoldDecision, startPictureChoice } from '../logic/pictureChoice';
import type { PictureChoice } from '../logic/pictureChoice';
import { layoutPicker, previewAt } from '../logic/pickerLayout';
import type { PickerLayout } from '../logic/pickerLayout';
import { loadPicturePreview } from '../logic/picturePreview';
import { COLORING_PICTURES } from '../logic/pictureSet';
import type { PictureIdentity } from '../logic/savedPicture';
import { ColoringScene, isGameArea } from './ColoringScene';
import { loadOutlineImage, preparePicture } from './pictureCanvas';
import type { PreparedPicture } from './pictureCanvas';
import { PreviewTileView } from './PreviewTileView';
import { preloadToolIcons } from './toolIconTextures';

/** Obrys a vrstva barev mají 1024 × 768 pixelů jako v malování. */
const PICTURE_PIXEL_WIDTH = TABLET_GAME_WIDTH;
const PICTURE_PIXEL_HEIGHT = TABLET_GAME_HEIGHT;

/** Bez stránky (hra spuštěná jinak než z menu) domeček ani odchod nejsou. */
const NO_PAGE: ColoringPage = {
  setHomeAvailable: () => undefined,
  attachSettingsGear: () => () => undefined,
  onLeave: () => undefined,
};

/** Počká na další snímek, aby příprava omalovánek nezdržela vykreslení. */
function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

/** Omalovánka sady: načtený obrys hned, mapa oblastí postupně. */
interface PictureAssets {
  readonly picture: PictureIdentity;
  readonly image: Promise<HTMLImageElement | null>;
  readonly prepared: Promise<PreparedPicture>;
}

/**
 * Výběr omalovánky ze sady (#124), první scéna Omalovánek. Ukáže mřížku
 * náhledů (`pickerLayout.ts`) a po ťuknutí na náhled zahraje tón, náhled
 * zhoupne a otevře malování té omalovánky v nové scéně `ColoringScene`.
 * Co je vidět a kam vede domeček, rozhoduje `pictureChoice.ts`; scéna se
 * na podržení domečku napojí háčkem stránky (`GameHost.onHomeHold`).
 *
 * Náhledy se ukážou hned s obrysem a barvy doběhnou postupně (AC7):
 * obrysy se načtou najednou, mapy oblastí se počítají po jedné omalovánce
 * po snímcích. Stejnou připravenou omalovánku pak dostane malování.
 * Při jediné omalovánce v sadě se výběr přeskočí a otevře se rovnou malování.
 */
export class PickerScene extends Phaser.Scene {
  private gameArea: GameArea = gameAreaFor(undefined, COLORING_GAME_AREA_FIT);
  private layout: PickerLayout = layoutPicker(this.gameArea);
  private choice: PictureChoice = startPictureChoice(COLORING_PICTURES);
  private assets: readonly PictureAssets[] = [];
  private tiles: PreviewTileView[] = [];
  /** Otevřené malování; `null` na výběru. */
  private painting: ColoringScene | null = null;
  /** Číslo další scény malování, každé otevření má vlastní. */
  private paintingCount = 0;
  /** Běží scéna (od `create` do konce)? Pozdě připravený náhled se pak nekreslí. */
  private running = false;
  // Společný zvukový kontext stránky, odemčený už ťuknutím v menu (#67 AC6).
  private readonly sounds = createTonePlayer(sharedToneContext);

  constructor() {
    super('coloringPicker');
  }

  /** Ikony nástrojů se načtou už tady, aby se malování otevřelo hned. */
  preload(): void {
    preloadToolIcons(this);
  }

  create(): void {
    this.running = true;
    followCanvasResolution(this);
    this.gameArea = this.readGameArea();
    this.layout = layoutPicker(this.gameArea);
    this.choice = startPictureChoice(COLORING_PICTURES);
    const host = this.readHost();
    startColoringSession(host ?? NO_PAGE, () => this.stop());
    host?.onHomeHold?.(() => this.onHomeHold());

    this.assets = this.loadPictures();
    this.listen();
    const screen = this.choice.screen();
    if (screen.kind === 'opening') {
      // Jediná omalovánka v sadě: rovnou malování.
      this.openPainting(screen.picture);
      return;
    }
    this.drawTiles();
  }

  private readHost(): GameHost | undefined {
    const stored: unknown = this.registry.get(GAME_HOST_KEY);
    return isGameHost(stored) ? stored : undefined;
  }

  private readGameArea(): GameArea {
    const stored: unknown = this.registry.get(GAME_AREA_KEY);
    return isGameArea(stored) ? stored : gameAreaFor(undefined, COLORING_GAME_AREA_FIT);
  }

  /**
   * Obrysy všech omalovánek se začnou načítat hned, mapy oblastí se
   * spočítají po jedné, každá v dalším snímku.
   */
  private loadPictures(): PictureAssets[] {
    let previous: Promise<unknown> = Promise.resolve();
    return COLORING_PICTURES.map((picture) => {
      const image = loadOutlineImage(picture);
      const prepared = previous
        .then(nextFrame)
        .then(() => image)
        .then((loaded) =>
          preparePicture(picture, loaded, PICTURE_PIXEL_WIDTH, PICTURE_PIXEL_HEIGHT),
        );
      previous = prepared;
      return { picture, image, prepared };
    });
  }

  private assetsOf(picture: PictureIdentity): PictureAssets | undefined {
    return this.assets.find((each) => each.picture.id === picture.id);
  }

  // -------------------------------------------------------------------------
  // Náhledy
  // -------------------------------------------------------------------------

  /** Dlaždice jen pro omalovánky sady, prázdná místa se nekreslí. */
  private drawTiles(): void {
    this.tiles = this.choice
      .previews()
      .map((_, index) => new PreviewTileView(this, `coloringPreview${index}`));
    this.placeTiles();
  }

  /** Dlaždice na místa podle rozložení a jejich obrázky znovu (po startu nebo změně okna). */
  private placeTiles(): void {
    this.tiles.forEach((tile, index) => {
      const rect = this.layout.previews[index];
      if (rect === undefined) {
        return;
      }
      tile.setPlace({
        rect,
        cornerRadius: this.layout.cornerRadius,
        cssScale: this.gameArea.scale,
      });
      void this.showPreview(index);
    });
  }

  /** Náhled `index`: hned s obrysem, s barvami dítěte, až je omalovánka připravená. */
  private async showPreview(index: number): Promise<void> {
    const tile = this.tiles[index];
    const picture = this.choice.previews()[index];
    const assets = picture === undefined ? undefined : this.assetsOf(picture);
    if (tile === undefined || picture === undefined || assets === undefined) {
      return;
    }
    const image = await assets.image;
    if (!this.isTileShown(tile)) {
      return;
    }
    tile.show(image, null);
    const prepared = await assets.prepared;
    const size = tile.pixelSize();
    if (!this.isTileShown(tile) || size === null) {
      return;
    }
    const preview = loadPicturePreview({
      // Bez obrysu se maluje jen v paměti (jako v malování), náhled ukáže prázdnou dlaždici.
      storage: prepared.outline.drawn ? this.readHost()?.storage : undefined,
      picture,
      regions: prepared.regions,
      width: size.width,
      height: size.height,
    });
    tile.show(image, preview);
  }

  /** Je dlaždice pořád na výběru (scéna neskončila a dlaždice se nezahodila)? */
  private isTileShown(tile: PreviewTileView): boolean {
    return this.running && this.tiles.includes(tile);
  }

  // -------------------------------------------------------------------------
  // Ťuknutí a domeček
  // -------------------------------------------------------------------------

  private listen(): void {
    this.input.on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer) =>
      this.onPointerDown(pointer),
    );
    this.registry.events.on(`changedata-${GAME_AREA_KEY}`, this.onGameAreaChanged, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.running = false;
      this.registry.events.off(`changedata-${GAME_AREA_KEY}`, this.onGameAreaChanged, this);
      this.stop();
      for (const tile of this.tiles) {
        tile.destroy();
      }
      this.tiles = [];
    });
  }

  /**
   * Ťuknutí na náhled (#124 AC1): hned tón a zhoupnutí, po zhoupnutí se
   * otevře malování. Mimo náhledy, druhý prst a dvojí ťuknutí nic (AC5).
   */
  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    const index = previewAt(this.layout, pointer.worldX, pointer.worldY);
    if (index === null) {
      return;
    }
    const tap = this.choice.tapPreview(index);
    if (tap.kind !== 'open') {
      return;
    }
    this.sounds.play(tap.tones);
    const tile = this.tiles[index];
    if (tile === undefined) {
      this.openPainting(tap.picture);
      return;
    }
    tile.wobble(() => this.openPainting(tap.picture));
  }

  /** Otevře malování omalovánky `picture` v nové scéně nad výběrem; výběr usne. */
  private openPainting(picture: PictureIdentity): void {
    const assets = this.assetsOf(picture);
    if (assets === undefined) {
      return;
    }
    this.paintingCount += 1;
    const key = `coloring${this.paintingCount}`;
    const painting = new ColoringScene({
      key,
      picture,
      prepared: assets.prepared,
      onShown: () => this.choice.paintingShown(),
    });
    this.painting = painting;
    this.scene.add(key, painting, true);
    this.scene.sleep();
  }

  /**
   * Podržení domečku (#124 AC4): v malování návrat na výběr, na výběru
   * odchod do menu. Podržení z doby otevírání se nepočítá (AC5).
   */
  private onHomeHold(): HomeHoldDecision {
    const hold = this.choice.holdHome();
    if (hold === 'toPicker') {
      this.backToPicker();
    }
    return homeHoldDecision(hold);
  }

  /** Malování skončí s uloženým obrázkem a výběr se ukáže s novým náhledem. */
  private backToPicker(): void {
    const painting = this.painting;
    if (painting === null) {
      return;
    }
    this.painting = null;
    painting.finishPainting();
    const key = painting.sys.settings.key;
    this.scene.stop(key);
    this.scene.remove(key);
    this.scene.wake();
    // Obrázky dlaždic se nakreslí znovu z úložiště, rozmalovaná omalovánka s novými barvami.
    this.placeTiles();
  }

  private onGameAreaChanged(): void {
    this.gameArea = this.readGameArea();
    this.layout = layoutPicker(this.gameArea);
    // Během malování výběr spí a není vidět; dlaždice se přeskládají
    // až při návratu na výběr (backToPicker), ne při každém otočení.
    if (this.painting !== null) {
      return;
    }
    this.placeTiles();
  }

  /** Odchod z hry: malování uloží obrázek a zvuky ztichnou. */
  private stop(): void {
    this.painting?.finishPainting();
    this.sounds.stopAll();
  }
}
