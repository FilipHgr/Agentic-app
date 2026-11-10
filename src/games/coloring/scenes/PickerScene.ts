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
import { readAlbum } from '../logic/album';
import type { AlbumContents, AlbumEntry, AlbumPicture } from '../logic/album';
import { COLORING_GAME_AREA_FIT } from '../logic/coloringLayout';
import { startColoringSession } from '../logic/coloringSession';
import type { ColoringPage } from '../logic/coloringSession';
import { homeHoldDecision, startPictureChoice } from '../logic/pictureChoice';
import type { PictureChoice } from '../logic/pictureChoice';
import {
  albumPreviewAt,
  bookAt,
  layoutAlbum,
  layoutPicker,
  previewAt,
} from '../logic/pickerLayout';
import type { AlbumLayout, PickerLayout } from '../logic/pickerLayout';
import { loadPicturePreview, previewOfColors } from '../logic/picturePreview';
import { COLORING_PICTURES } from '../logic/pictureSet';
import type { PictureIdentity } from '../logic/savedPicture';
import { BOOK_ICON_FILE } from '../logic/toolIcons';
import { ColoringScene, isGameArea } from './ColoringScene';
import { IconButtonView } from './IconButtonView';
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

/** Kniha je nad dlaždicemi výběru. */
const BOOK_DEPTH = 5;

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
 *
 * Od #126 je vpravo nahoře kniha, která otevře album aktivního profilu
 * (obrazovka `album` v `pictureChoice.ts`). Album se čte ze záznamů hry
 * na začátku a po každém uložení obrázku fotoaparátem, po jednom záznamu
 * za snímek; malování dostane stejné přečtené album. Náhledy alba se
 * ukážou hned s obrysem a barvy se dokreslí po jednom za snímek (AC7).
 * Na obrazovkách alba není žádný text.
 */
export class PickerScene extends Phaser.Scene {
  private gameArea: GameArea = gameAreaFor(undefined, COLORING_GAME_AREA_FIT);
  private layout: PickerLayout = layoutPicker(this.gameArea);
  private choice: PictureChoice = startPictureChoice(COLORING_PICTURES);
  private assets: readonly PictureAssets[] = [];
  private tiles: PreviewTileView[] = [];
  private readonly bookView = new IconButtonView(this, BOOK_ICON_FILE);
  /** Album, jak se naposledy přečetlo; `null`, dokud se čte (kniha se jen zhoupne). */
  private album: AlbumContents | null = null;
  /** Rozběhnuté čtení alba; malování ho počká. */
  private albumReading: Promise<AlbumContents> = Promise.resolve({ status: 'unavailable' });
  /** Číslo čtení alba, aby starší čtení nepřepsalo novější. */
  private albumReadCount = 0;
  private albumLayout: AlbumLayout = layoutAlbum(this.gameArea);
  private albumTiles: PreviewTileView[] = [];
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
    this.album = null;
    this.readAlbumAgain();
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
    this.bookView.place(this.layout.book, this.gameArea.scale, BOOK_DEPTH);
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
  // Album (#126)
  // -------------------------------------------------------------------------

  /**
   * Přečte album znovu (na začátku a po uložení obrázku). Do konce čtení
   * kniha album neotevře (rozhodnutí koordinátora 2).
   */
  private readAlbumAgain(): void {
    this.albumReadCount += 1;
    const readNumber = this.albumReadCount;
    this.album = null;
    this.albumReading = this.readAlbumOfProfile();
    void this.albumReading.then((album) => {
      if (readNumber === this.albumReadCount) {
        this.album = album;
      }
    });
  }

  /**
   * Album ze záznamů aktivního profilu. Obrázky se čtou podle obrysů
   * všech omalovánek sady; omalovánka bez vykresleného obrysu do alba
   * nepatří (jako v malování, kde se bez obrysu nic neukládá).
   */
  private async readAlbumOfProfile(): Promise<AlbumContents> {
    const prepared = await Promise.all(this.assets.map((each) => each.prepared));
    const pictures: AlbumPicture[] = prepared
      .filter((each) => each.outline.drawn)
      .map((each) => ({ identity: each.picture, regions: each.regions }));
    return readAlbum(this.readHost()?.records, pictures, { pause: nextFrame });
  }

  /** Ťuknutí na knihu: otevře album, nebo se kniha jen zhoupne (AC4). */
  private onBookTapped(): void {
    const tap = this.choice.tapBook(this.album);
    switch (tap.kind) {
      case 'open':
        this.sounds.play(tap.tones);
        this.bookView.wobble(() => this.showAlbum(tap.entries));
        return;
      case 'wobble':
        this.sounds.play(tap.tones);
        this.bookView.wobble();
        return;
      case 'ignored':
        return;
    }
  }

  /** Schová výběr a ukáže album: hned dlaždice s obrysem, barvy postupně. */
  private showAlbum(entries: readonly AlbumEntry[]): void {
    if (!this.running || this.choice.screen().kind !== 'album') {
      return;
    }
    this.hidePicker();
    this.albumLayout = layoutAlbum(this.gameArea);
    this.albumTiles = entries.map((_, index) => new PreviewTileView(this, `coloringAlbum${index}`));
    void this.drawAlbumTiles(entries);
  }

  /** Dlaždice alba na místa a jejich obrázky: nejdřív všechny obrysy, pak po snímku barvy. */
  private async drawAlbumTiles(entries: readonly AlbumEntry[]): Promise<void> {
    const tiles = this.albumTiles;
    const images = await Promise.all(
      entries.map((entry) => this.assetsOf(entry.picture)?.image ?? Promise.resolve(null)),
    );
    tiles.forEach((tile, index) => {
      const rect = this.albumLayout.previews[index];
      if (rect === undefined) {
        return;
      }
      tile.setPlace({
        rect,
        cornerRadius: this.albumLayout.cornerRadius,
        cssScale: this.gameArea.scale,
      });
      tile.show(images[index] ?? null, null);
    });
    for (const [index, tile] of tiles.entries()) {
      await nextFrame();
      const entry = entries[index];
      const prepared =
        entry === undefined ? undefined : await this.assetsOf(entry.picture)?.prepared;
      const size = tile.pixelSize();
      if (
        !this.isAlbumTileShown(tile) ||
        entry === undefined ||
        prepared === undefined ||
        size === null
      ) {
        continue;
      }
      const preview = previewOfColors({
        colors: entry.colors,
        regions: prepared.regions,
        width: size.width,
        height: size.height,
      });
      tile.show(images[index] ?? null, preview);
    }
  }

  private isAlbumTileShown(tile: PreviewTileView): boolean {
    return this.running && this.albumTiles.includes(tile);
  }

  /** Ťuknutí na obrázek v albu: zatím se jen zhoupne s tónem domečku (AC4). */
  private onAlbumPreviewTapped(index: number): void {
    const tile = this.albumTiles[index];
    if (tile === undefined) {
      return;
    }
    const tap = this.choice.tapAlbumPreview(index);
    if (tap.kind === 'ignored') {
      return;
    }
    this.sounds.play(tap.tones);
    tile.wobble(() => undefined);
  }

  /** Zahodí dlaždice alba. */
  private hideAlbum(): void {
    for (const tile of this.albumTiles) {
      tile.destroy();
    }
    this.albumTiles = [];
  }

  /** Zahodí dlaždice výběru a knihu (při otevření alba). */
  private hidePicker(): void {
    for (const tile of this.tiles) {
      tile.destroy();
    }
    this.tiles = [];
    this.bookView.destroy();
  }

  /** Domeček z alba: album zmizí a výběr se ukáže znovu s aktuálními náhledy. */
  private albumToPicker(): void {
    this.hideAlbum();
    // Kniha se mohla ještě houpat a výběr ještě nezmizel: zahodí se a nakreslí znovu.
    this.hidePicker();
    this.drawTiles();
  }

  /** Obrázek se uložil do alba (i po odchodu z malování): album a náhledy znovu. */
  private onAlbumSaved(): void {
    if (!this.running) {
      return;
    }
    this.readAlbumAgain();
    if (this.painting === null && this.choice.screen().kind === 'picker') {
      // Podržení domečku během ukládání: náhled ukáže výsledek (AC3).
      this.placeTiles();
    }
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
      this.hidePicker();
      this.hideAlbum();
    });
  }

  /**
   * Ťuknutí na náhled (#124 AC1): hned tón a zhoupnutí, po zhoupnutí se
   * otevře malování. Mimo náhledy, druhý prst a dvojí ťuknutí nic (AC5).
   */
  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    const { worldX: x, worldY: y } = pointer;
    const screen = this.choice.screen().kind;
    if (screen === 'album') {
      const place = albumPreviewAt(this.albumLayout, x, y);
      if (place !== null) {
        this.onAlbumPreviewTapped(place);
      }
      return;
    }
    if (screen === 'picker' && bookAt(this.layout, x, y)) {
      this.onBookTapped();
      return;
    }
    const index = previewAt(this.layout, x, y);
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
      album: () => this.albumReading,
      onAlbumSaved: () => this.onAlbumSaved(),
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
    const fromAlbum = this.choice.screen().kind === 'album';
    const hold = this.choice.holdHome();
    if (hold === 'toPicker') {
      if (fromAlbum) {
        this.albumToPicker();
      } else {
        this.backToPicker();
      }
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
    if (this.choice.screen().kind === 'album') {
      this.redrawAlbum();
      return;
    }
    // Během malování výběr spí a není vidět; dlaždice se přeskládají
    // až při návratu na výběr (backToPicker), ne při každém otočení.
    if (this.painting !== null) {
      return;
    }
    this.placeTiles();
  }

  /** Album po změně okna: dlaždice na nová místa a obrázky znovu. */
  private redrawAlbum(): void {
    const screen = this.choice.screen();
    if (screen.kind !== 'album') {
      return;
    }
    this.hideAlbum();
    this.showAlbum(screen.entries);
  }

  /** Odchod z hry: malování uloží obrázek a zvuky ztichnou. */
  private stop(): void {
    this.painting?.finishPainting();
    this.sounds.stopAll();
  }
}
