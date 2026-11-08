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
import { COLORING_GAME_AREA_FIT, layoutColoring, touchTargetAt } from '../logic/coloringLayout';
import type { ColoringLayout } from '../logic/coloringLayout';
import { startColoringSession } from '../logic/coloringSession';
import type { ColoringPage } from '../logic/coloringSession';
import { PALETTE, initialPalette, markedColors, tapColor } from '../logic/palette';
import type { PaletteState } from '../logic/palette';
import { buildRegionMap, outlineFromImage } from '../logic/regionMap';
import { noRecentColors } from '../logic/recentColors';
import { RECENT_COLOR_WOBBLE_TONES, UNDO_WOBBLE_TONES, openColoring } from '../logic/savedPicture';
import type { RecentColorTap, SavedColoring, UndoResult } from '../logic/savedPicture';
import { PICTURE_STYLE } from '../logic/theme';
import {
  INITIAL_LINE_SIZE,
  INITIAL_TOOL,
  PANEL_CLOSE_TONES,
  PANEL_OPEN_TONES,
  markedTools,
  toolAtSlot,
} from '../logic/toolPanel';
import type { HandleView, LineSize, ToolId } from '../logic/toolPanel';
import { HandleButtonView } from './HandleButtonView';
import { PaintLayer } from './PaintLayer';
import { RecentColorsView } from './RecentColorsView';
import { PICTURE, drawPictureOutline, snapshotOf } from './pictureCanvas';
import { ToolPanelView } from './ToolPanelView';
import type { PanelSelection } from './ToolPanelView';
import { UndoButtonView } from './UndoButtonView';

/** Vrstva barev a obrys mají 1024 × 768 pixelů (poměr plochy 4 : 3). */
const PICTURE_PIXEL_WIDTH = TABLET_GAME_WIDTH;
const PICTURE_PIXEL_HEIGHT = TABLET_GAME_HEIGHT;

/** Hloubky: obrázek dole, nad ním panel, pozadí pruhu a nahoře pruh ovládání. */
const PANEL_DEPTH = 10;
const STRIP_DEPTH = 20;

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
 * Omalovánky (#88): jedna testovací omalovánka a paleta 12 barev (#100). Scéna
 * kreslí a předává dotyky; co se zabarví (ořez do oblasti, souvislá čára,
 * první prst) řeší logika `coloring.ts`, výběr barvy `palette.ts`
 * a rozložení `coloringLayout.ts`. Obrys se vykreslí do plátna při startu,
 * z něj se spočítá mapa oblastí a nakreslí se nad vrstvou barev.
 * Rozmalovaný obrázek a vybranou barvu ukládá podle profilu
 * `savedPicture.ts` (#92). Tlačítko Zpět vrací tahy (#89); co se vrátí,
 * řeší také `savedPicture.ts`.
 *
 * Od #96 je obrázek přes celou obrazovku a nástroje jsou ve vysouvacím
 * panelu, který otevře a zavře úchyt v pruhu ovládání. Kam dotyk patří
 * (úchyt, Zpět, panel, obrázek), rozhoduje `touchTargetAt`; malovat se
 * smí jen u dotyku na obrázku. Stav panelu, vybraný nástroj (štětec nebo
 * guma, #90) i velikost čáry (#91) drží `savedPicture.ts`. Vedle úchytu
 * jsou dvě nedávné barvy (#99), jejich pořadí řídí také `savedPicture.ts`.
 */
export class ColoringScene extends Phaser.Scene {
  private gameArea: GameArea = gameAreaFor(undefined, COLORING_GAME_AREA_FIT);
  private layout: ColoringLayout = layoutColoring(this.gameArea);
  private palette: PaletteState = initialPalette();
  /** Panel, dokud se obrázek připravuje (pak ho drží `coloring`). */
  private panelOpenBeforeReady = false;
  /**
   * Malování s ukládáním podle profilu (#92); vznikne, až se vykreslí obrys
   * a spočítá mapa oblastí.
   */
  private coloring: SavedColoring | null = null;
  private paintLayer: PaintLayer | null = null;
  private pictureBackground: Phaser.GameObjects.Rectangle | null = null;
  private paintImage: Phaser.GameObjects.Image | null = null;
  private outlineImage: Phaser.GameObjects.Image | null = null;
  private readonly panelView = new ToolPanelView(this);
  private readonly handleView = new HandleButtonView(this);
  private readonly undoView = new UndoButtonView(this);
  private readonly recentView = new RecentColorsView(this);
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
    return isGameArea(stored) ? stored : gameAreaFor(undefined, COLORING_GAME_AREA_FIT);
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
    this.showSelection();
    this.showPanel();
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
    const open = this.isPanelOpen();
    this.panelView.place(
      {
        layout: this.layout,
        cssScale: this.gameArea.scale,
        areaWidth: this.gameArea.width,
        areaHeight: this.gameArea.height,
        depth: PANEL_DEPTH,
      },
      this.panelSelection(),
      open,
    );
    this.handleView.place(this.layout, this.gameArea.scale, STRIP_DEPTH);
    this.showHandle(open);
    this.undoView.place(this.layout.undoButton, this.gameArea.scale, STRIP_DEPTH);
    this.recentView.place(this.layout.recentColors, this.gameArea.scale, STRIP_DEPTH);
    this.showRecentColors();
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
  // Panel nástrojů a úchyt
  // -------------------------------------------------------------------------

  private isPanelOpen(): boolean {
    return this.coloring?.panelOpen() ?? this.panelOpenBeforeReady;
  }

  /** Vybraný nástroj; dokud se obrázek připravuje, je to štětec. */
  private selectedTool(): ToolId {
    return this.coloring?.selectedTool() ?? INITIAL_TOOL;
  }

  /** Vybraná velikost čáry; dokud se obrázek připravuje, je to střední. */
  private lineSize(): LineSize {
    return this.coloring?.lineSize() ?? INITIAL_LINE_SIZE;
  }

  /**
   * Co je v panelu označené; štětec, fix, pastelka, razítkový a puntíkový
   * fix jsou vždy ve vybrané barvě, duha v duhových.
   */
  private panelSelection(): PanelSelection {
    return {
      markedColors: markedColors(this.palette),
      markedTools: markedTools(this.selectedTool()),
      paintHex: hexOf(this.palette.selected),
      lineSize: this.lineSize(),
    };
  }

  /**
   * Úchyt ukazuje vybraný nástroj ve vybrané barvě, gumu bez barvy
   * a tečku velikosti (#96 AC5, #90 AC1, #91 AC1).
   */
  private showHandle(open: boolean): void {
    const view: HandleView = this.coloring?.handleView() ?? {
      tool: INITIAL_TOOL,
      color: this.palette.selected,
      size: INITIAL_LINE_SIZE,
    };
    this.handleView.show(view, view.color === null ? null : hexOf(view.color), open);
  }

  /** Panel a šipka úchytu podle stavu v logice; panel se vysune nebo zasune animací. */
  private showPanel(): void {
    const open = this.isPanelOpen();
    this.panelView.setOpen(open);
    this.showHandle(open);
  }

  /** Vybraná barva, nástroj a velikost v panelu i v úchytu, nedávné barvy v pruhu. */
  private showSelection(): void {
    this.panelView.mark(this.panelSelection());
    this.showHandle(this.isPanelOpen());
    this.showRecentColors();
  }

  /** Nedávné barvy v pruhu; dokud se obrázek připravuje, jsou místa prázdná. */
  private showRecentColors(): void {
    this.recentView.show(this.coloring?.recentColors() ?? noRecentColors());
  }

  /** Ťuknutí na úchyt: panel se otevře nebo zavře s tónem; během tahu nic (#96 AC2). */
  private onHandleTapped(): void {
    if (this.coloring === null) {
      this.panelOpenBeforeReady = !this.panelOpenBeforeReady;
      this.sounds.play(this.panelOpenBeforeReady ? PANEL_OPEN_TONES : PANEL_CLOSE_TONES);
    } else {
      this.sounds.play(this.coloring.tapHandle());
    }
    this.showPanel();
  }

  /**
   * Ťuknutí na nástroj (#90 AC1): vybere ho s tónem, už vybraný nástroj se
   * navíc zhoupne. Prázdná místa a druhý prst během tahu nic nedělají;
   * dokud se obrázek připravuje, zůstává štětec.
   */
  private onToolTapped(index: number): void {
    if (this.coloring === null) {
      return;
    }
    const wasSelected = toolAtSlot(index) === this.coloring.selectedTool();
    const tones = this.coloring.tapTool(index);
    if (tones.length === 0) {
      return;
    }
    this.sounds.play(tones);
    if (wasSelected) {
      this.panelView.wobbleTool(index);
    }
    this.showSelection();
  }

  /**
   * Ťuknutí na přepínač velikosti (#91 AC1): další velikost s tónem
   * a krátkým zhoupnutím přepínače. Druhý prst během tahu nic nedělá;
   * dokud se obrázek připravuje, zůstává střední velikost.
   */
  private onSizeToggleTapped(): void {
    const tones = this.coloring?.tapSizeToggle() ?? [];
    if (tones.length === 0) {
      return;
    }
    this.sounds.play(tones);
    this.panelView.wobbleSizeToggle();
    this.showSelection();
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
    this.showSelection();
  }

  /**
   * Ťuknutí na nedávnou barvu (#99 AC1): vybere ji s tónem a panel nechá,
   * jak byl. Prázdné místo se jen zhoupne s tichým tónem, druhý prst během
   * tahu nic nedělá. Dokud se obrázek připravuje, jsou místa prázdná.
   */
  private onRecentColorTapped(index: number): void {
    const result: RecentColorTap = this.coloring?.tapRecentColor(index) ?? {
      kind: 'wobble',
      tones: RECENT_COLOR_WOBBLE_TONES,
    };
    switch (result.kind) {
      case 'picked':
        if (this.coloring !== null) {
          this.palette = this.coloring.palette();
        }
        this.sounds.play(result.tones);
        this.showSelection();
        return;
      case 'wobble':
        this.recentView.wobble(index);
        this.sounds.play(result.tones);
        return;
      case 'ignored':
        return;
    }
  }

  // -------------------------------------------------------------------------
  // Zpět
  // -------------------------------------------------------------------------

  /**
   * Ťuknutí na Zpět (#89). Druhý prst během tahu logika přeskočí
   * (`ignored`), tah pokračuje. Dokud se obrázek připravuje, není co vracet.
   */
  private onUndoTapped(): void {
    const result: UndoResult = this.coloring?.tapUndo() ?? {
      kind: 'wobble',
      tones: UNDO_WOBBLE_TONES,
    };
    switch (result.kind) {
      case 'undone':
        if (this.coloring !== null) {
          this.paintLayer?.paint(result.changed, this.coloring);
        }
        this.sounds.play(result.tones);
        return;
      case 'wobble':
        this.undoView.wobble();
        this.sounds.play(result.tones);
        return;
      case 'ignored':
        return;
    }
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
    this.input.on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer) =>
      this.onPointerDown(pointer),
    );
    this.input.on(Phaser.Input.Events.POINTER_MOVE, (pointer: Phaser.Input.Pointer) => {
      if (this.coloring !== null) {
        this.paintLayer?.paint(this.coloring.pointerMove(this.sampleOf(pointer)), this.coloring);
      }
    });
    const onUp = (pointer: Phaser.Input.Pointer): void => this.coloring?.pointerUp(pointer.id);
    this.input.on(Phaser.Input.Events.POINTER_UP, onUp);
    this.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, onUp);
  }

  /** Kam dotyk patří, rozhodne `touchTargetAt` (#96 AC4); malovat se smí jen na obrázku. */
  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    const target = touchTargetAt(this.layout, this.isPanelOpen(), pointer.worldX, pointer.worldY);
    switch (target.kind) {
      case 'picture':
        this.paintFrom(pointer);
        return;
      case 'handle':
        this.onHandleTapped();
        return;
      case 'undo':
        this.onUndoTapped();
        return;
      case 'color':
        this.onColorTapped(target.index);
        return;
      case 'tool':
        this.onToolTapped(target.index);
        return;
      case 'sizeToggle':
        this.onSizeToggleTapped();
        return;
      case 'recentColor':
        this.onRecentColorTapped(target.index);
        return;
      case 'panel':
      case 'none':
        // Prázdné místo, pozadí panelu nebo místo vedle: nic se nestane a nemaluje se.
        return;
    }
  }

  /** Tah začatý na obrázku maluje a otevřený panel zavře (#96 AC4). */
  private paintFrom(pointer: Phaser.Input.Pointer): void {
    if (this.coloring === null) {
      this.panelOpenBeforeReady = false;
    } else {
      this.paintLayer?.paint(this.coloring.pointerDown(this.sampleOf(pointer)), this.coloring);
    }
    this.showPanel();
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

/** Odstín barvy palety `index`, nebo `null` mimo paletu. */
function hexOf(index: number): string | null {
  return PALETTE[index]?.hex ?? null;
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
