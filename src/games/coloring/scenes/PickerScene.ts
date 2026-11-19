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
import { albumPageEntries, ALBUM_PAGE_SIZE, readAlbum } from '../logic/album';
import type { AlbumContents, AlbumEntry, AlbumPicture } from '../logic/album';
import { settleAlbumSwap } from '../logic/albumSwap';
import { isBlankPaper } from '../logic/blankPaper';
import { COLORING_GAME_AREA_FIT } from '../logic/coloringLayout';
import { startColoringSession } from '../logic/coloringSession';
import type { ColoringPage } from '../logic/coloringSession';
import { TRASH_HOLD_MS, homeHoldDecision, startPictureChoice } from '../logic/pictureChoice';
import type {
  AlbumDirection,
  AlbumPointerResult,
  ContinueResult,
  PickerPointerResult,
  PictureChoice,
  PreviewTap,
  TrashFeedback,
  TrashResult,
} from '../logic/pictureChoice';
import type { PageMove } from '../logic/pageToAlbum';
import {
  albumArrowAt,
  albumPreviewAt,
  bigPictureContinueAt,
  bigPictureTrashAt,
  bookAt,
  layoutAlbum,
  layoutBigPicture,
  layoutPicker,
  pickerArrowAt,
  previewAt,
  trashHoldRingFor,
} from '../logic/pickerLayout';
import type { AlbumLayout, BigPictureLayout, PickerLayout } from '../logic/pickerLayout';
import { PICKER_PLACES } from '../logic/pickerLayout';
import { openPictureLocks, unlockPaintedPictures } from '../logic/pictureLocks';
import type { PictureLocks } from '../logic/pictureLocks';
import { loadPicturePreview, previewOfColors } from '../logic/picturePreview';
import { COLORING_PICTURES } from '../logic/pictureSet';
import type { PaintingOrigin, PictureIdentity } from '../logic/savedPicture';
import { ALBUM_ARROW_STYLE, BIG_PICTURE_STYLE } from '../logic/theme';
import { BOOK_ICON_FILE, CONTINUE_ICON_FILE, TRASH_ICON_FILE } from '../logic/toolIcons';
import { AlbumArrowView } from './AlbumArrowView';
import { ColoringScene, isGameArea } from './ColoringScene';
import { IconButtonView } from './IconButtonView';
import { KeyIndicatorView } from './KeyIndicatorView';
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

/** Rozestup odletů do knihy, když se přesunulo víc obrázků najednou (#141). */
const BOOK_FLIGHT_GAP_MS = 170;

/** Jak velký doletí náhled do knihy jako díl strany knihy (#141). */
const BOOK_FLIGHT_SHARE = 0.6;

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
 *
 * Od #129 otevře ťuknutí na náhled v albu velký obrázek: náhled se
 * zhoupne, zvětší se na místo velkého obrázku (`layoutBigPicture`) a vedle
 * je koš. Barvy velkého obrázku jsou pixel po pixelu vrstva barev
 * uloženého obrázku. Koš drží `pictureChoice.ts` (podržení 1 s, kolem
 * koše se plní bílý kroužek jako u „Smazat“ v menu); scéna mu předává
 * stisk, sjetí a zvednutí prstu a kreslí odezvu. Držení domečku hlásí
 * stránka háčkem `GameHost.onHomeHolding`. Tah po velkém obrázku nic nedělá.
 *
 * Od #131 je vedle koše štětec (malovat dál). Ťuknutí na něj předá výběru
 * (`tapContinue`), štětec se hned zhoupne s tónem náhledu a po výměně
 * stránky a obrázku z alba (`albumSwap.ts`) se otevře malování té
 * omalovánky jako po ťuknutí na náhled. Když se výměna nepovede, štětec se
 * zhoupne s tónem domečku. Při otevření Omalovánek se nejdřív dokončí nebo
 * vrátí výměna odložená z minula (`settleAlbumSwap`), teprve pak se čte album.
 *
 * Od #140 jsou některé omalovánky zamčené (`pictureLocks.ts`): náhled je
 * ztlumený se zámkem a vedle knihy je ukazatel klíčů z Počítání
 * (`GameHost.keyRewards`). Po přečtení alba se jednou odemknou zdarma
 * rozmalované omalovánky a obrázky z alba (`unlockPaintedPictures`); do té
 * doby se ťuknutí na zámek jen zhoupne a klíč se neutratí. Bez klíče se
 * zámek i ukazatel zhoupnou s tónem domečku, s klíčem se zámek otevře
 * a otevře se malování.
 *
 * Od #141 jde rozmalovaný obrázek do alba sám (`pageToAlbum.ts`): po
 * odemčení zdarma při otevření Omalovánek a po návratu z malování
 * domečkem. Náhled přesunuté omalovánky se překreslí na čistý obrys a jeho
 * kopie s barvami odletí do knihy, která poskočí (bez zvuku).
 *
 * Od #149 ukazuje album stránky po 12 obrázcích. Při víc stránkách jsou
 * vidět šipky ◀ ▶ (`layoutAlbum`); dotyky v albu scéna předá výběru
 * (`albumPointerDown`, `albumPointerUp`, `tapAlbumArrow`), který pozná
 * tah a ťuknutí. Velký obrázek se proto otevře až po zvednutí prstu.
 * Při listování stará stránka odjede do strany, nová přijede z druhé
 * strany a scéna pak zavolá `albumPageShown`. Na kraji se zhoupne šipka
 * nebo náhledy s tónem domečku.
 *
 * Od #150 se stejně listuje i na výběru (víc než 12 omalovánek): šipky
 * ◀ ▶ z `layoutPicker` a dotyky předané výběru (`pickerPointerDown`,
 * `pickerPointerUp`, `tapPickerArrow`, `pickerPageShown`). Omalovánka se
 * proto otevře až po zvednutí prstu. Dlaždice výběru ukazují stránku,
 * která je vidět (`pagePreviews`), podle místa na stránce.
 */
export class PickerScene extends Phaser.Scene {
  private gameArea: GameArea = gameAreaFor(undefined, COLORING_GAME_AREA_FIT);
  private layout: PickerLayout = layoutPicker(this.gameArea);
  private choice: PictureChoice = startPictureChoice(COLORING_PICTURES);
  private assets: readonly PictureAssets[] = [];
  /** Dlaždice stránky výběru, která je vidět (#150), podle místa na stránce. */
  private tiles: PreviewTileView[] = [];
  /** Dlaždice předchozí stránky výběru, které při listování odjíždějí (#150). */
  private leavingTiles: PreviewTileView[] = [];
  /** Číslo nakreslení stránky výběru, aby pozdní konec listování neohlásil starou stránku. */
  private pickerShowCount = 0;
  private readonly pickerPreviousArrow = new AlbumArrowView(this, 'previous');
  private readonly pickerNextArrow = new AlbumArrowView(this, 'next');
  /**
   * Prsty na výběru nebo v albu, které se dotkly a ještě se nezvedly: místo
   * náhledu, kde začaly, a zmáčknutá dlaždice (#150).
   */
  private readonly touches = new Map<
    number,
    { readonly place: number | null; readonly tile: PreviewTileView | undefined }
  >();
  private readonly bookView = new IconButtonView(this, BOOK_ICON_FILE);
  /** Zámky omalovánek a klíče aktivního profilu (#140). */
  private locks: PictureLocks = openPictureLocks({
    pictures: COLORING_PICTURES,
    storage: undefined,
    keyRewards: undefined,
  });
  /** Doběhlo odemčení zdarma (#140 AC2)? Do té doby se klíč neutratí. */
  private locksReady = false;
  private readonly keyIndicatorView = new KeyIndicatorView(this);
  /** Album, jak se naposledy přečetlo; `null`, dokud se čte (kniha se jen zhoupne). */
  private album: AlbumContents | null = null;
  /** Rozběhnuté čtení alba; malování ho počká. */
  private albumReading: Promise<AlbumContents> = Promise.resolve({ status: 'unavailable' });
  /** Číslo čtení alba, aby starší čtení nepřepsalo novější. */
  private albumReadCount = 0;
  private albumLayout: AlbumLayout = layoutAlbum(this.gameArea);
  /** Dlaždice stránky alba, která je vidět (#149), podle místa na stránce. */
  private albumTiles: PreviewTileView[] = [];
  /** Dlaždice předchozí stránky, které při listování odjíždějí (#149). */
  private leavingAlbumTiles: PreviewTileView[] = [];
  /** Číslo zobrazení stránky alba, aby pozdní konec listování neohlásil starou stránku. */
  private albumShowCount = 0;
  private readonly previousArrowView = new AlbumArrowView(this, 'previous');
  private readonly nextArrowView = new AlbumArrowView(this, 'next');
  private bigLayout: BigPictureLayout = layoutBigPicture(this.gameArea);
  /** Velký obrázek z alba (#129); `null` mimo velký obrázek. */
  private bigTile: PreviewTileView | null = null;
  private readonly trashView = new IconButtonView(this, TRASH_ICON_FILE);
  /** Štětec malovat dál na velkém obrázku (#131). */
  private readonly continueView = new IconButtonView(this, CONTINUE_ICON_FILE);
  /** Omalovánky sady s připraveným obrysem; doplní se, až jsou všechny připravené. */
  private albumPictures: readonly AlbumPicture[] = [];
  /** Dokončení nebo vrácení odložené výměny při otevření (#131); album se čte až po něm. */
  private settling: Promise<void> = Promise.resolve();
  /** Plní se kroužek podržení kolem koše? */
  private trashRingShown = false;
  /** Kdy se koš začal držet (ms podle `performance.now`). */
  private trashHoldStartedAt = 0;
  /** Prst, který stiskl koš a ještě z něj nesjel ani se nezvedl. */
  private trashPointer: number | null = null;
  /** Kopie náhledů, které právě letí do knihy (#141). */
  private flights: PreviewTileView[] = [];
  /** Číslo další kopie letící do knihy. */
  private flightCount = 0;
  /** Velký obrázek, který se právě zmenšuje zpátky do alba nebo po smazání. */
  private leavingTile: PreviewTileView | null = null;
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
    const host = this.readHost();
    this.locks = openPictureLocks({
      pictures: COLORING_PICTURES,
      storage: host?.storage,
      keyRewards: host?.keyRewards,
    });
    this.locksReady = false;
    this.choice = startPictureChoice(COLORING_PICTURES, {
      locks: this.choiceLocks(),
      records: host?.records,
      storage: host?.storage,
      albumPictures: () => this.albumPictures,
      onTrash: (feedback) => this.onTrashFeedback(feedback),
      onBroom: (feedback) => this.painting?.showBroomFeedback(feedback),
    });
    this.layout = this.pickerLayout();
    startColoringSession(host ?? NO_PAGE, () => this.stop());
    host?.onHomeHold?.(() => this.onHomeHold());
    host?.onHomeHolding?.((holding) => this.choice.homeHolding(holding));

    this.assets = this.loadPictures();
    this.albumPictures = [];
    this.settling = this.settleSwap();
    this.album = null;
    this.readAlbumAgain();
    void this.unlockPaintedOnce(this.albumReading);
    this.listen();
    const screen = this.choice.screen();
    if (screen.kind === 'opening') {
      // Jediná omalovánka v sadě: rovnou malování.
      this.openPainting(screen.picture);
      return;
    }
    this.drawTiles();
  }

  /**
   * Odemčení zdarma po prvním přečtení alba (#140 AC2), dřív než výběr
   * přijme ťuknutí na zámek. Dostane jen omalovánky s připraveným obrysem;
   * ostatní se zkontrolují při dalším otevření a klíč je do té doby neodemkne.
   */
  private async unlockPaintedOnce(reading: Promise<AlbumContents>): Promise<void> {
    const album = await reading;
    if (!this.running) {
      return;
    }
    unlockPaintedPictures({
      storage: this.readHost()?.storage,
      pictures: this.albumPictures,
      album,
    });
    this.locksReady = true;
    if (this.painting === null && this.choice.screen().kind === 'picker') {
      this.showLocks();
    }
    // Až po odemčení zdarma, aby se rozmalovaná stránka neschovala do alba nepřečtená (#141).
    void this.showMoves(this.choice.movePagesToAlbum());
  }

  /**
   * Zámky pro výběr: do odemčení zdarma (#140 AC2) se zamčená omalovánka
   * neodemkne klíčem (zámek se jen zhoupne a klíč se neutratí).
   */
  private choiceLocks(): PictureLocks {
    return {
      isLocked: (picture) => this.locks.isLocked(picture),
      keyIndicator: () => this.locks.keyIndicator(),
      unlock: (picture) => (this.locksReady ? this.locks.unlock(picture) : 'noKey'),
    };
  }

  /** Rozložení výběru se šipkami, když má sada víc stránek (#150). */
  private pickerLayout(): PickerLayout {
    return layoutPicker(this.gameArea, { pictureCount: this.choice.previews().length });
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

  /**
   * Nakreslí výběr: dlaždice jen pro omalovánky stránky, která je vidět
   * (prázdná místa se nekreslí), knihu, šipky a ukazatel klíčů.
   */
  private drawTiles(): void {
    this.createPageTiles();
    this.placeTiles();
  }

  /** Nové dlaždice pro omalovánky stránky výběru, která je vidět (#150); vrátí je. */
  private createPageTiles(): PreviewTileView[] {
    this.pickerShowCount += 1;
    const first = this.choice.pickerPage() * PICKER_PLACES;
    this.tiles = this.choice
      .pagePreviews()
      .map((_, place) => new PreviewTileView(this, `coloringPreview${first + place}`));
    return this.tiles;
  }

  /** Kniha, šipky a dlaždice na místa podle rozložení (po startu nebo změně okna). */
  private placeTiles(): void {
    if (this.leavingTiles.length > 0) {
      // Během listování (#150) by nové místo zastavilo příjezd dlaždic a listování by
      // nikdy neskončilo (po uložení obrázku, výměně s albem, změně okna): stránka se
      // nakreslí znovu a listování skončí hned.
      this.hidePicker();
      this.drawTiles();
      this.choice.pickerPageShown();
      return;
    }
    this.bookView.place(this.layout.book, this.gameArea.scale, BOOK_DEPTH);
    this.placePickerArrows();
    this.placePageTiles();
  }

  /** Dlaždice stránky na místa a jejich obrázky znovu, zámky a ukazatel klíčů. */
  private placePageTiles(): void {
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
    this.showLocks();
  }

  /** Šipky ◀ ▶ výběru, když má víc stránek (#150). */
  private placePickerArrows(): void {
    if (!this.layout.arrows) {
      return;
    }
    this.pickerPreviousArrow.place(this.layout.previousArrow, this.gameArea.scale);
    this.pickerNextArrow.place(this.layout.nextArrow, this.gameArea.scale);
  }

  /** Zámky na zamčených náhledech a ukazatel klíčů podle aktuálního stavu (#140). */
  private showLocks(): void {
    const previews = this.choice.pagePreviews();
    this.tiles.forEach((tile, index) => {
      const picture = previews[index];
      tile.setLocked(picture !== undefined && this.locks.isLocked(picture));
    });
    this.showKeyIndicator();
  }

  /** Ukazatel klíčů vedle knihy; bez zamčených omalovánek zmizí (#140 AC3). */
  private showKeyIndicator(): void {
    this.keyIndicatorView.show(
      this.locks.keyIndicator(),
      this.layout.keyIndicator,
      this.gameArea.scale,
      BOOK_DEPTH,
    );
  }

  /** Náhled na místě `index` stránky: hned s obrysem, s barvami dítěte, až je omalovánka připravená. */
  private async showPreview(index: number): Promise<void> {
    const tile = this.tiles[index];
    const picture = this.choice.pagePreviews()[index];
    const assets = picture === undefined ? undefined : this.assetsOf(picture);
    if (tile === undefined || picture === undefined || assets === undefined) {
      return;
    }
    const image = await assets.image;
    if (!this.isTileShown(tile)) {
      return;
    }
    const paperMark = isBlankPaper(picture);
    tile.show(image, null, paperMark);
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
    tile.show(image, preview, paperMark);
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
    await this.settling;
    return readAlbum(this.readHost()?.records, this.albumPictures, { pause: nextFrame });
  }

  /** Omalovánky sady s vykresleným obrysem, až jsou všechny připravené. */
  private async preparedAlbumPictures(): Promise<AlbumPicture[]> {
    const prepared = await Promise.all(this.assets.map((each) => each.prepared));
    return prepared
      .filter((each) => each.outline.drawn)
      .map((each) => ({ identity: each.picture, regions: each.regions }));
  }

  /**
   * Při otevření Omalovánek (#131 AC5): dokončí nebo vrátí výměnu odloženou
   * z minula. Když se tím změnila stránka, náhledy se nakreslí znovu.
   */
  private async settleSwap(): Promise<void> {
    this.albumPictures = await this.preparedAlbumPictures();
    const host = this.readHost();
    const settlement = await settleAlbumSwap({
      storage: host?.storage,
      records: host?.records,
      pictures: this.albumPictures,
    });
    const changed = settlement.kind === 'reverted' || settlement.kind === 'completed';
    if (
      changed &&
      this.running &&
      this.painting === null &&
      this.choice.screen().kind === 'picker'
    ) {
      this.placeTiles();
    }
  }

  /** Ťuknutí na knihu: otevře album, nebo se kniha jen zhoupne (AC4). */
  private onBookTapped(): void {
    const tap = this.choice.tapBook(this.album);
    switch (tap.kind) {
      case 'open':
        this.sounds.play(tap.tones);
        this.bookView.wobble(() => this.showAlbum());
        return;
      case 'wobble':
        this.sounds.play(tap.tones);
        this.bookView.wobble();
        return;
      case 'ignored':
        // Během listování výběru (#150) se kniha jen zhoupne, bez tónu.
        this.bookView.wobble();
        return;
    }
  }

  /**
   * Schová výběr a ukáže stránku alba, která je vidět: hned dlaždice
   * s obrysem, barvy postupně. Při víc stránkách i šipky ◀ ▶ (#149).
   * Vrátí dlaždice stránky.
   */
  private showAlbum(): PreviewTileView[] {
    const screen = this.choice.screen();
    if (!this.running || screen.kind !== 'album') {
      return [];
    }
    this.hidePicker();
    this.hideAlbum();
    this.albumShowCount += 1;
    this.albumLayout = layoutAlbum(this.gameArea, { pictureCount: screen.entries.length });
    if (this.albumLayout.arrows) {
      this.previousArrowView.place(this.albumLayout.previousArrow, this.gameArea.scale);
      this.nextArrowView.place(this.albumLayout.nextArrow, this.gameArea.scale);
    }
    const entries = albumPageEntries(screen.entries, screen.page);
    const first = screen.page * ALBUM_PAGE_SIZE;
    this.albumTiles = entries.map(
      (_, place) => new PreviewTileView(this, `coloringAlbum${first + place}`),
    );
    void this.drawAlbumTiles(entries);
    return this.albumTiles;
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

  /**
   * Prst se v albu zvedl (#149): tah nalistuje nebo na kraji zhoupne
   * náhledy, ťuknutí na náhled ho zhoupne s tónem a otevře velký obrázek
   * (#129 AC1).
   */
  private onAlbumPointerUp(pointer: Phaser.Input.Pointer): void {
    this.releaseTouch(pointer.id);
    const result: AlbumPointerResult = this.choice.albumPointerUp(
      pointer.id,
      this.cssPointOf(pointer),
    );
    switch (result.kind) {
      case 'open': {
        this.sounds.play(result.tones);
        const tile = this.albumTiles[result.index];
        if (tile === undefined) {
          this.openBigPicture(result.entry, result.index);
          return;
        }
        tile.wobble(() => this.openBigPicture(result.entry, result.index));
        return;
      }
      case 'turned':
        this.sounds.play(result.tones);
        this.turnAlbumPage(result.direction);
        return;
      case 'edge':
        this.sounds.play(result.tones);
        for (const tile of this.albumTiles) {
          tile.wobble(() => undefined);
        }
        return;
      case 'ignored':
        return;
    }
  }

  /** Ťuknutí na šipku v albu (#149): nalistuje, nebo se šipka na kraji zhoupne. */
  private onAlbumArrowTapped(direction: AlbumDirection): void {
    const turn = this.choice.tapAlbumArrow(direction);
    switch (turn.kind) {
      case 'turned':
        this.sounds.play(turn.tones);
        this.turnAlbumPage(turn.direction);
        return;
      case 'edge':
        this.sounds.play(turn.tones);
        (direction === 'next' ? this.nextArrowView : this.previousArrowView).wobble();
        return;
      case 'ignored':
        // Během listování se šipka aspoň zhoupne (bez šipek nic).
        (direction === 'next' ? this.nextArrowView : this.previousArrowView).wobble();
        return;
    }
  }

  /**
   * Listování (#149): dlaždice staré stránky odjedou proti směru listování
   * a zmizí, nové přijedou z druhé strany. Pak se výběr dozví, že je nová
   * stránka vidět.
   */
  private turnAlbumPage(direction: AlbumDirection): void {
    this.releaseAllTouches();
    const leaving = this.albumTiles;
    // Dlaždice staré stránky nezahodí `showAlbum`, odjedou a zmizí až po listování.
    this.albumTiles = [];
    const tiles = this.showAlbum();
    this.leavingAlbumTiles = leaving;
    const shownNumber = this.albumShowCount;
    this.slidePages(leaving, tiles, direction, () => {
      if (shownNumber !== this.albumShowCount) {
        return;
      }
      this.destroyLeavingAlbumTiles();
      this.choice.albumPageShown();
    });
  }

  /**
   * Listování (#149, #150): dlaždice `leaving` odjedou proti směru
   * listování, `arriving` přijedou z druhé strany a pak se zavolá `onShown`.
   */
  private slidePages(
    leaving: readonly PreviewTileView[],
    arriving: readonly PreviewTileView[],
    direction: AlbumDirection,
    onShown: () => void,
  ): void {
    const style = ALBUM_ARROW_STYLE;
    const shift = this.gameArea.width * style.turnShiftShare * (direction === 'next' ? -1 : 1);
    for (const tile of leaving) {
      tile.slideOut(shift, style.turnMs, () => undefined);
    }
    if (arriving.length === 0) {
      onShown();
      return;
    }
    let left = arriving.length;
    for (const tile of arriving) {
      tile.slideIn(-shift, style.turnMs, () => {
        left -= 1;
        if (left === 0) {
          onShown();
        }
      });
    }
  }

  private destroyLeavingAlbumTiles(): void {
    for (const tile of this.leavingAlbumTiles) {
      tile.destroy();
    }
    this.leavingAlbumTiles = [];
  }

  /** Bod dotyku v CSS px herní plochy (#149: tah se měří v CSS px). */
  private cssPointOf(pointer: Phaser.Input.Pointer): { readonly x: number; readonly y: number } {
    return { x: pointer.worldX * this.gameArea.scale, y: pointer.worldY * this.gameArea.scale };
  }

  // -------------------------------------------------------------------------
  // Velký obrázek a koš (#129)
  // -------------------------------------------------------------------------

  /**
   * Velký obrázek se zvětší z místa náhledu `index` v albu. Po zvětšení
   * náhledy alba zmizí a výběr se dozví, že je velký obrázek vidět.
   */
  private openBigPicture(entry: AlbumEntry, index: number): void {
    if (!this.running || this.choice.screen().kind !== 'openingBigPicture') {
      return;
    }
    const tile = this.drawBigPicture(entry);
    const from = this.albumLayout.previews[index];
    if (from === undefined) {
      this.bigPictureShown();
      return;
    }
    tile.growFrom(from, BIG_PICTURE_STYLE.growMs, () => this.bigPictureShown());
  }

  /** Velký obrázek je vidět: náhledy alba zmizí, ukáže se koš. */
  private bigPictureShown(): void {
    if (!this.running || this.bigTile === null) {
      return;
    }
    this.hideAlbum();
    this.placeBigPictureButtons();
    this.choice.bigPictureShown();
  }

  /** Koš a štětec na svá místa vedle velkého obrázku. */
  private placeBigPictureButtons(): void {
    const { scale } = this.gameArea;
    this.trashView.place(this.bigLayout.trash, scale, BIG_PICTURE_STYLE.trashDepth);
    this.continueView.place(this.bigLayout.continueButton, scale, BIG_PICTURE_STYLE.trashDepth);
  }

  /**
   * Nakreslí velký obrázek na jeho místo: obrys hned, barvy obrázku alba
   * pixel po pixelu (jeden pixel náhledu na pixel vrstvy barev).
   */
  private drawBigPicture(entry: AlbumEntry): PreviewTileView {
    this.bigTile?.destroy();
    this.bigLayout = layoutBigPicture(this.gameArea);
    const tile = new PreviewTileView(this, 'coloringBigPicture');
    tile.setDepth(BIG_PICTURE_STYLE.pictureDepth);
    tile.setPlace({ rect: this.bigLayout.picture, cornerRadius: 0, cssScale: this.gameArea.scale });
    this.bigTile = tile;
    void this.showBigPictureImage(tile, entry);
    return tile;
  }

  private async showBigPictureImage(tile: PreviewTileView, entry: AlbumEntry): Promise<void> {
    const assets = this.assetsOf(entry.picture);
    if (assets === undefined) {
      return;
    }
    const image = await assets.image;
    if (this.bigTile !== tile) {
      return;
    }
    tile.show(image, null);
    const prepared = await assets.prepared;
    if (this.bigTile !== tile) {
      return;
    }
    const colors = previewOfColors({
      colors: entry.colors,
      regions: prepared.regions,
      width: prepared.regions.width,
      height: prepared.regions.height,
    });
    tile.show(image, colors);
  }

  /** Zahodí velký obrázek, koš a kroužek. */
  private hideBigPicture(): void {
    this.bigTile?.destroy();
    this.bigTile = null;
    this.trashView.destroy();
    this.continueView.destroy();
    this.hideTrashRing();
    this.trashPointer = null;
  }

  /** Odezva koše z výběru: kroužek, zhoupnutí, nebo začátek mazání. */
  private onTrashFeedback(feedback: TrashFeedback): void {
    if (!this.running) {
      return;
    }
    switch (feedback.kind) {
      case 'trashHolding':
        if (feedback.holding) {
          this.showTrashRing();
        } else {
          this.hideTrashRing();
        }
        return;
      case 'trashWobble':
        this.sounds.play(feedback.tones);
        this.trashView.wobble();
        return;
      case 'deleting': {
        const { entry } = feedback;
        void feedback.done.then((result) => this.afterDeleting(result, entry));
        return;
      }
    }
  }

  /**
   * Konec mazání: po smazání se velký obrázek zmenší a zmizí a ukáže se
   * album bez něj (nebo výběr). Po selhání se koš zhoupne s tónem domečku
   * a velký obrázek zůstane, jen když se mezitím nedržel domeček (#129 AC4).
   */
  private afterDeleting(result: TrashResult, entry: AlbumEntry): void {
    if (!this.running) {
      return;
    }
    if (result.kind === 'deleted') {
      // Kniha a malování dostanou album bez smazaného obrázku.
      this.readAlbumAgain();
      this.leaveBigPicture(null, BIG_PICTURE_STYLE.deleteMs);
      return;
    }
    this.sounds.play(result.tones);
    if (this.choice.screen().kind === 'album') {
      // Domeček se podržel během mazání: zpět do alba i s obrázkem.
      this.leaveBigPicture(entry, BIG_PICTURE_STYLE.shrinkMs);
      return;
    }
    this.trashView.wobble();
  }

  /**
   * Z velkého obrázku zpět: pod ním se hned ukáže album (nebo s prázdným
   * albem výběr) a velký obrázek se zmenší na místo obrázku `entry`
   * v albu, nebo bez něj (smazaný obrázek) do ztracena.
   */
  private leaveBigPicture(entry: AlbumEntry | null, ms: number): void {
    const tile = this.bigTile;
    this.bigTile = null;
    this.hideBigPicture();
    const screen = this.choice.screen();
    if (screen.kind === 'album') {
      this.showAlbum();
    } else {
      this.hideAlbum();
      this.hidePicker();
      this.drawTiles();
    }
    if (tile === null) {
      return;
    }
    // Místo obrázku na stránce alba, která je vidět (#149); jinde se zmenší do ztracena.
    const index =
      entry === null || screen.kind !== 'album'
        ? -1
        : albumPageEntries(screen.entries, screen.page).findIndex(
            (each) => each.recordId === entry.recordId,
          );
    this.leavingTile?.destroy();
    this.leavingTile = tile;
    tile.shrinkTo(this.albumLayout.previews[index] ?? null, ms, () => {
      tile.destroy();
      if (this.leavingTile === tile) {
        this.leavingTile = null;
      }
    });
  }

  /** Velký obrázek po změně okna: na nové místo bez animace (i během otevírání). */
  private redrawBigPicture(): void {
    const screen = this.choice.screen();
    if (screen.kind !== 'bigPicture' && screen.kind !== 'openingBigPicture') {
      return;
    }
    this.drawBigPicture(screen.entry);
    if (screen.kind === 'openingBigPicture') {
      // Zhoupnutí nebo zvětšení se přerušilo: velký obrázek se ukáže hned.
      this.bigPictureShown();
      return;
    }
    this.placeBigPictureButtons();
  }

  /**
   * Ťuknutí na štětec (#131 AC1): hned tón náhledu a zhoupnutí; po
   * zhoupnutí a výměně se otevře malování, po nepovedené výměně se štětec
   * zhoupne s tónem domečku.
   */
  private onContinueTapped(): void {
    const tap = this.choice.tapContinue();
    switch (tap.kind) {
      case 'ignored':
        return;
      case 'wobble':
        this.sounds.play(tap.tones);
        this.continueView.wobble();
        return;
      case 'swapping': {
        this.sounds.play(tap.tones);
        const wobbled = new Promise<void>((resolve) => this.continueView.wobble(resolve));
        void Promise.all([tap.done, wobbled]).then(([result]) => this.afterSwap(result));
        return;
      }
    }
  }

  /** Konec výměny: malování obrázku z alba, nebo zhoupnutí štětce s tónem domečku. */
  private afterSwap(result: ContinueResult): void {
    if (!this.running) {
      return;
    }
    // Album se po výměně (i po vrácení obrázku) změnilo.
    this.readAlbumAgain();
    if (result.kind === 'failed') {
      this.sounds.play(result.tones);
      this.continueView.wobble();
      return;
    }
    if (this.choice.screen().kind !== 'opening') {
      return;
    }
    this.hideBigPicture();
    this.hideAlbum();
    // Po návratu domečkem z malování se ukáže výběr s náhledy.
    this.hidePicker();
    this.drawTiles();
    this.openPainting(result.picture, 'album');
  }

  /** Prst na koši (#129 AC3): stisk jen dotykem dolů, návrat prstu po sjetí není nový stisk. */
  private onTrashPointerDown(pointer: Phaser.Input.Pointer): void {
    if (
      this.choice.screen().kind !== 'bigPicture' ||
      !bigPictureTrashAt(this.bigLayout, pointer.worldX, pointer.worldY)
    ) {
      return;
    }
    this.trashPointer = pointer.id;
    this.choice.trashButton.press(pointer.id);
  }

  /** Prst, který koš stiskl, z něj sjel: podržení se zruší. */
  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (
      pointer.id === this.trashPointer &&
      !bigPictureTrashAt(this.bigLayout, pointer.worldX, pointer.worldY)
    ) {
      this.trashPointer = null;
      this.choice.trashButton.leave(pointer.id);
    }
  }

  /** Prst, který koš stiskl, se zvedl; v albu se pozná ťuknutí nebo tah (#149). */
  private onPointerUp(pointer: Phaser.Input.Pointer): void {
    // Phaser posílá zrušený dotyk (touchcancel) jako zvednutí prstu: není to ťuknutí.
    const eventType = pointer.event.type;
    if (eventType === 'touchcancel' || eventType === 'pointercancel') {
      this.cancelTouches(pointer.id);
      return;
    }
    const screen = this.choice.screen().kind;
    if (screen === 'album') {
      this.onAlbumPointerUp(pointer);
      return;
    }
    if (screen === 'picker') {
      this.onPickerPointerUp(pointer);
      return;
    }
    if (pointer.id === this.trashPointer) {
      this.trashPointer = null;
      this.choice.trashButton.release(pointer.id);
    }
  }

  /** Prst `pointerId` zmáčkl dlaždici `tile` na místě `place` (#150). */
  private pressTouch(
    pointerId: number,
    place: number | null,
    tile: PreviewTileView | undefined,
  ): void {
    this.touches.get(pointerId)?.tile?.release();
    tile?.press();
    this.touches.set(pointerId, { place, tile });
  }

  /** Prst se zvedl: zmáčknutá dlaždice se vrátí. Vrátí místo náhledu, kde prst začal. */
  private releaseTouch(pointerId: number): number | null {
    const touch = this.touches.get(pointerId);
    this.touches.delete(pointerId);
    touch?.tile?.release();
    return touch?.place ?? null;
  }

  /** Po nalistování nebo zrušení se všechny zmáčknuté dlaždice vrátí. */
  private releaseAllTouches(): void {
    for (const pointerId of [...this.touches.keys()]) {
      this.releaseTouch(pointerId);
    }
  }

  /**
   * Prohlížeč dotyk zrušil (pointercancel, touchcancel, odchod z okna,
   * schovaná stránka): prst `pointerId` (bez čísla všechny) se zapomene,
   * dlaždice se vrátí, nic se neotevře a koš přestane držet.
   */
  private cancelTouches(pointerId?: number): void {
    if (pointerId === undefined) {
      this.releaseAllTouches();
    } else {
      this.releaseTouch(pointerId);
    }
    this.choice.pickerPointerCancel(pointerId);
    this.choice.albumPointerCancel(pointerId);
    const trash = this.trashPointer;
    if (trash !== null && (pointerId === undefined || pointerId === trash)) {
      this.trashPointer = null;
      this.choice.trashButton.cancel(trash);
    }
  }

  private readonly onTouchCancel = (): void => this.cancelTouches();

  /** Bílý kroužek kolem koše se začne plnit. */
  private showTrashRing(): void {
    this.trashHoldStartedAt = performance.now();
    this.trashRingShown = true;
    this.drawTrashRing();
  }

  private hideTrashRing(): void {
    this.trashRingShown = false;
    this.trashView.setHoldProgress(null);
  }

  /** Kroužek kolem koše podle času od začátku podržení (v každém snímku). */
  private drawTrashRing(): void {
    if (!this.trashRingShown) {
      return;
    }
    const elapsed = performance.now() - this.trashHoldStartedAt;
    this.trashView.setHoldProgress(
      Math.min(1, elapsed / TRASH_HOLD_MS),
      trashHoldRingFor(this.bigLayout, this.gameArea),
    );
  }

  /** Zahodí dlaždice alba (i odjíždějící po listování) a šipky. */
  private hideAlbum(): void {
    for (const tile of this.albumTiles) {
      tile.destroy();
    }
    this.albumTiles = [];
    this.destroyLeavingAlbumTiles();
    this.previousArrowView.destroy();
    this.nextArrowView.destroy();
  }

  /** Zahodí dlaždice výběru a knihu (při otevření alba). */
  private hidePicker(): void {
    for (const tile of this.tiles) {
      tile.destroy();
    }
    this.tiles = [];
    this.destroyLeavingTiles();
    this.pickerPreviousArrow.destroy();
    this.pickerNextArrow.destroy();
    for (const flight of this.flights) {
      flight.destroy();
    }
    this.flights = [];
    this.bookView.destroy();
    this.keyIndicatorView.destroy();
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
    this.input.on(Phaser.Input.Events.POINTER_MOVE, (pointer: Phaser.Input.Pointer) =>
      this.onPointerMove(pointer),
    );
    for (const event of [Phaser.Input.Events.POINTER_UP, Phaser.Input.Events.POINTER_UP_OUTSIDE]) {
      this.input.on(event, (pointer: Phaser.Input.Pointer) => this.onPointerUp(pointer));
    }
    const canvas = this.game.canvas;
    canvas.addEventListener('pointercancel', this.onTouchCancel);
    canvas.addEventListener('touchcancel', this.onTouchCancel);
    this.game.events.on(Phaser.Core.Events.BLUR, this.onTouchCancel);
    this.game.events.on(Phaser.Core.Events.HIDDEN, this.onTouchCancel);
    this.registry.events.on(`changedata-${GAME_AREA_KEY}`, this.onGameAreaChanged, this);
    this.events.on(Phaser.Scenes.Events.UPDATE, this.drawTrashRing, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.running = false;
      canvas.removeEventListener('pointercancel', this.onTouchCancel);
      canvas.removeEventListener('touchcancel', this.onTouchCancel);
      this.game.events.off(Phaser.Core.Events.BLUR, this.onTouchCancel);
      this.game.events.off(Phaser.Core.Events.HIDDEN, this.onTouchCancel);
      this.touches.clear();
      this.registry.events.off(`changedata-${GAME_AREA_KEY}`, this.onGameAreaChanged, this);
      this.events.off(Phaser.Scenes.Events.UPDATE, this.drawTrashRing, this);
      this.choice.trashButton.dispose();
      this.choice.broomButton.dispose();
      this.stop();
      this.hidePicker();
      this.hideAlbum();
      this.hideBigPicture();
      this.leavingTile?.destroy();
      this.leavingTile = null;
    });
  }

  /**
   * Dotyk prstu: na velkém obrázku koš a štětec, v albu a na výběru šipky
   * hned a náhledy až po zvednutí prstu (#149, #150), na výběru kniha hned.
   */
  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    const { worldX: x, worldY: y } = pointer;
    const screen = this.choice.screen().kind;
    if (screen === 'bigPicture' || screen === 'openingBigPicture') {
      // Na velkém obrázku platí jen koš a štětec, tah po obrázku nic nedělá (#129 AC5).
      if (screen === 'bigPicture' && bigPictureContinueAt(this.bigLayout, x, y)) {
        this.onContinueTapped();
        return;
      }
      this.onTrashPointerDown(pointer);
      return;
    }
    if (screen === 'album') {
      const arrow = albumArrowAt(this.albumLayout, x, y);
      if (arrow !== null) {
        this.onAlbumArrowTapped(arrow);
        return;
      }
      // Ťuknutí nebo tah pozná výběr až po zvednutí prstu (#149), dlaždice se hned zmáčkne (#150).
      const albumPlace = albumPreviewAt(this.albumLayout, x, y);
      this.pressTouch(
        pointer.id,
        albumPlace,
        albumPlace === null ? undefined : this.albumTiles[albumPlace],
      );
      this.choice.albumPointerDown(pointer.id, this.cssPointOf(pointer), albumPlace);
      return;
    }
    if (screen !== 'picker') {
      return;
    }
    if (bookAt(this.layout, x, y)) {
      this.onBookTapped();
      return;
    }
    const arrow = pickerArrowAt(this.layout, x, y);
    if (arrow !== null) {
      this.onPickerArrowTapped(arrow);
      return;
    }
    // Ťuknutí nebo tah pozná výběr až po zvednutí prstu, dlaždice se hned zmáčkne (#150).
    const place = previewAt(this.layout, x, y);
    this.pressTouch(pointer.id, place, place === null ? undefined : this.tiles[place]);
    this.choice.pickerPointerDown(pointer.id, this.cssPointOf(pointer), place);
  }

  /**
   * Prst se na výběru zvedl (#150): tah nalistuje nebo na kraji zhoupne
   * náhledy, ťuknutí na náhled ho otevře (#124 AC1).
   */
  private onPickerPointerUp(pointer: Phaser.Input.Pointer): void {
    const place = this.releaseTouch(pointer.id);
    const result: PickerPointerResult = this.choice.pickerPointerUp(
      pointer.id,
      this.cssPointOf(pointer),
    );
    switch (result.kind) {
      case 'turned':
        this.sounds.play(result.tones);
        this.turnPickerPage(result.direction);
        return;
      case 'edge':
        this.sounds.play(result.tones);
        for (const tile of this.tiles) {
          tile.wobble(() => undefined);
        }
        return;
      default:
        if (place !== null) {
          this.onPreviewTap(result, place);
        }
    }
  }

  /** Ťuknutí na šipku na výběru (#150): nalistuje, nebo se šipka zhoupne. */
  private onPickerArrowTapped(direction: AlbumDirection): void {
    const turn = this.choice.tapPickerArrow(direction);
    if (turn.kind === 'turned') {
      this.sounds.play(turn.tones);
      this.turnPickerPage(turn.direction);
      return;
    }
    if (turn.kind === 'edge') {
      this.sounds.play(turn.tones);
    }
    // Na kraji s tónem domečku, během listování aspoň zhoupnutí.
    (direction === 'next' ? this.pickerNextArrow : this.pickerPreviousArrow).wobble();
  }

  /** Listování výběru (#150) jako v albu: stará stránka odjede, nová přijede. */
  private turnPickerPage(direction: AlbumDirection): void {
    this.releaseAllTouches();
    const leaving = this.tiles;
    this.tiles = [];
    this.destroyLeavingTiles();
    const tiles = this.createPageTiles();
    this.placePageTiles();
    this.leavingTiles = leaving;
    const shownNumber = this.pickerShowCount;
    this.slidePages(leaving, tiles, direction, () => {
      if (shownNumber !== this.pickerShowCount) {
        return;
      }
      this.destroyLeavingTiles();
      this.choice.pickerPageShown();
    });
  }

  private destroyLeavingTiles(): void {
    for (const tile of this.leavingTiles) {
      tile.destroy();
    }
    this.leavingTiles = [];
  }

  /** Je omalovánka na místě `place` stránky výběru zamčená (#140)? */
  private isLockedPlace(place: number): boolean {
    const picture = this.choice.pagePreviews()[place];
    return picture !== undefined && this.locks.isLocked(picture);
  }

  /**
   * Ťuknutí na náhled na místě `place` (#124 AC1): hned tón a zhoupnutí,
   * po zhoupnutí se otevře malování. Mimo náhledy, druhý prst a dvojí
   * ťuknutí nic (AC5).
   */
  private onPreviewTap(tap: PreviewTap, place: number): void {
    const tile = this.tiles[place];
    switch (tap.kind) {
      case 'wobble':
        this.sounds.play(tap.tones);
        if (!this.locksReady && this.isLockedPlace(place)) {
          // Odemčení zdarma ještě neproběhlo (#140 AC2): zamčená se zhoupne zámkem jako dřív.
          tile?.wobbleLock();
          this.keyIndicatorView.wobble();
          return;
        }
        // Stránka jde do alba (#141 AC4), nebo se výměna může vrátit (#131 AC5): náhled se zhoupne.
        tile?.wobble(() => undefined);
        return;
      case 'locked':
        // Bez celého klíče nebo před odemčením zdarma (#140 AC2, AC4): zámek a ukazatel se zhoupnou.
        this.sounds.play(tap.tones);
        tile?.wobbleLock();
        this.keyIndicatorView.wobble();
        return;
      case 'unlocked':
        // Klíč se utratil (#140 AC5): ukazatel ubere klíč, zámek se otevře a pak malování.
        this.sounds.play(tap.tones);
        this.showKeyIndicator();
        this.keyIndicatorView.pulse();
        if (tile === undefined) {
          this.openPainting(tap.picture);
          return;
        }
        tile.openLock(() => {
          // Zámek zmizí i se zrušenou dlaždicí (odchod ze hry): malování jen v běžící scéně.
          if (this.running) {
            this.openPainting(tap.picture);
          }
        });
        return;
      case 'open':
        this.sounds.play(tap.tones);
        if (tile === undefined) {
          this.openPainting(tap.picture);
          return;
        }
        tile.wobble(() => this.openPainting(tap.picture));
        return;
      case 'ignored':
        return;
    }
  }

  /**
   * Otevře malování omalovánky `picture` v nové scéně nad výběrem; výběr
   * usne. `origin` říká koštěti, kam stránku vrací (#142).
   */
  private openPainting(picture: PictureIdentity, origin: PaintingOrigin = 'picker'): void {
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
      pageSettled: () => this.choice.pageSettled(picture),
      origin,
      broomButton: this.choice.broomButton,
      onPainting: (game) => this.choice.attachPainting(game),
    });
    this.painting = painting;
    this.scene.add(key, painting, true);
    this.scene.sleep();
  }

  /**
   * Podržení domečku (#124 AC4): v malování návrat na výběr, na výběru
   * odchod do menu, z velkého obrázku do alba (#129 AC2). Podržení z doby
   * otevírání se nepočítá (AC5).
   */
  private onHomeHold(): HomeHoldDecision {
    const before = this.choice.screen();
    const fromAlbum = before.kind === 'album';
    const hold = this.choice.holdHome();
    if (
      hold === 'toAlbum' &&
      before.kind === 'bigPicture' &&
      this.choice.screen().kind === 'album'
    ) {
      // Během mazání se album ukáže až po mazání (afterDeleting).
      this.leaveBigPicture(before.entry, BIG_PICTURE_STYLE.shrinkMs);
    }
    if (hold === 'toMenu' && before.kind === 'painting') {
      // Jediná omalovánka: obrázek jde do alba i při odchodu rovnou do menu (#141).
      const game = this.painting?.savedColoring() ?? null;
      if (game !== null) {
        void this.choice.paintingLeft(game);
      }
    }
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
    const game = painting.savedColoring();
    // Malování se ukončí a uloží hned, přesun do alba doběhne potom (#141).
    const moving = game === null ? this.choice.movePagesToAlbum() : this.choice.paintingLeft(game);
    painting.finishPainting();
    const key = painting.sys.settings.key;
    this.scene.stop(key);
    this.scene.remove(key);
    this.scene.wake();
    // Obrázky dlaždic se nakreslí znovu z úložiště, rozmalovaná omalovánka s novými barvami.
    this.placeTiles();
    void this.showMoves(moving);
  }

  /**
   * Konec přesunu do alba (#141): album se přečte znovu a náhled každé
   * vyčištěné stránky odletí do knihy. Mimo výběr se náhledy nakreslí
   * znovu až při návratu na něj.
   */
  private async showMoves(moving: Promise<readonly PageMove[]>): Promise<void> {
    const moves = await moving;
    if (!this.running) {
      return;
    }
    if (moves.some((move) => move.result === 'added')) {
      this.readAlbumAgain();
    }
    if (this.painting !== null || this.choice.screen().kind !== 'picker') {
      return;
    }
    moves
      .filter((move) => move.pageCleared)
      .forEach((move, order) => {
        void this.flyToBook(move, order * BOOK_FLIGHT_GAP_MS);
      });
  }

  /** Počká `ms` podle hodin scény (po konci scény už nikdy neskončí). */
  private waitScene(ms: number): Promise<void> {
    return new Promise((resolve) => {
      this.time.delayedCall(ms, resolve);
    });
  }

  /** Kopie náhledu s barvami přesunutého obrázku odletí do knihy, náhled je čistý obrys. */
  private async flyToBook(move: PageMove, delayMs: number): Promise<void> {
    if (delayMs > 0) {
      await this.waitScene(delayMs);
    }
    // Odletí jen náhled ze stránky výběru, která je vidět (#150).
    const index = this.choice.pagePreviews().findIndex((each) => each.id === move.picture.id);
    const rect = this.layout.previews[index];
    const assets = this.assetsOf(move.picture);
    if (rect === undefined || assets === undefined) {
      return;
    }
    const [image, prepared] = await Promise.all([assets.image, assets.prepared]);
    const target = this.bookView.center();
    const side = this.bookView.side();
    if (
      !this.running ||
      this.choice.screen().kind !== 'picker' ||
      target === null ||
      side === null
    ) {
      return;
    }
    this.flightCount += 1;
    const flight = new PreviewTileView(this, `coloringFlight${this.flightCount}`);
    flight.setPlace({
      rect,
      cornerRadius: this.layout.cornerRadius,
      cssScale: this.gameArea.scale,
    });
    const size = flight.pixelSize();
    if (size !== null) {
      flight.show(
        image,
        previewOfColors({ colors: move.colors, regions: prepared.regions, ...size }),
      );
    }
    flight.setDepth(BOOK_DEPTH + 1);
    this.flights.push(flight);
    void this.showPreview(index);
    flight.flyInto(target, side * BOOK_FLIGHT_SHARE, () => {
      flight.destroy();
      this.flights = this.flights.filter((each) => each !== flight);
      this.bookView.bounce();
    });
  }

  private onGameAreaChanged(): void {
    this.gameArea = this.readGameArea();
    this.layout = this.pickerLayout();
    // Po otočení by kopie letěla do knihy na starém místě: zmizí a kniha jen poskočí (#141).
    const flightsCancelled = this.flights.length > 0;
    for (const flight of this.flights) {
      flight.destroy();
    }
    this.flights = [];
    if (flightsCancelled) {
      this.time.delayedCall(0, () => this.bookView.bounce());
    }
    const screen = this.choice.screen().kind;
    if (screen === 'bigPicture' || screen === 'openingBigPicture') {
      this.redrawBigPicture();
      return;
    }
    if (screen === 'album') {
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

  /** Album po změně okna: dlaždice na nová místa a obrázky znovu (listování se dokončí hned). */
  private redrawAlbum(): void {
    if (this.choice.screen().kind !== 'album') {
      return;
    }
    this.showAlbum();
    this.choice.albumPageShown();
  }

  /** Odchod z hry: malování uloží obrázek a zvuky ztichnou. */
  private stop(): void {
    this.painting?.finishPainting();
    this.sounds.stopAll();
  }
}
