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
import { strokeWidthFor } from '../logic/coloring';
import type { PointerSample } from '../logic/coloring';
import {
  COLORING_GAME_AREA_FIT,
  layoutColoring,
  pictureLayerPoint,
  pictureLayerSize,
  pictureScreenPoint,
  touchTargetAt,
} from '../logic/coloringLayout';
import type { ColoringLayout } from '../logic/coloringLayout';
import { tapColor } from '../logic/palette';
import type { PaletteState } from '../logic/palette';
import { noRecentColors } from '../logic/recentColors';
import { RECENT_COLOR_WOBBLE_TONES, UNDO_WOBBLE_TONES, openColoring } from '../logic/savedPicture';
import type {
  PictureIdentity,
  RecentColorTap,
  SavedColoring,
  UndoResult,
} from '../logic/savedPicture';
import { PICTURE_STYLE } from '../logic/theme';
import { ALL_COLOR_COUNT, TOOL_COLOR_SETS, placeInSet } from '../logic/toolColorSets';
import { DEFAULT_TOOL_COLORS, isColorTool, toolReceivingColor } from '../logic/toolColors';
import { handleColorDotFill } from '../logic/toolIcons';
import {
  INITIAL_LINE_SIZE,
  INITIAL_TOOL,
  PANEL_CLOSE_TONES,
  PANEL_OPEN_TONES,
  PANEL_TOOLS,
  lineSizeWaveLook,
  markedTools,
} from '../logic/toolPanel';
import type { HandleView, LineSize, PanelView, ToolId } from '../logic/toolPanel';
import { GlitterShineView } from './GlitterShineView';
import { HandleButtonView } from './HandleButtonView';
import { PaintLayer } from './PaintLayer';
import { RecentColorsView } from './RecentColorsView';
import type { PreparedPicture } from './pictureCanvas';
import { preloadToolIcons } from './toolIconTextures';
import { ToolPanelView } from './ToolPanelView';
import type { PanelSelection } from './ToolPanelView';
import { UndoButtonView } from './UndoButtonView';

/** Nástroj, který dostane barvu, dokud se obrázek připravuje (štětec). */
const INITIAL_COLOR_TOOL = toolReceivingColor(INITIAL_TOOL);

/** Vrstva barev a obrys mají 1024 × 768 pixelů (poměr plochy 4 : 3). */
const PICTURE_PIXEL_WIDTH = TABLET_GAME_WIDTH;
const PICTURE_PIXEL_HEIGHT = TABLET_GAME_HEIGHT;
const PICTURE_LAYER = { width: PICTURE_PIXEL_WIDTH, height: PICTURE_PIXEL_HEIGHT } as const;

/**
 * Hloubky: obrázek dole (bílá plocha, vrstva barev 1, obrys 2), nad ním
 * rámeček, lesk třpytek, panel, pozadí pruhu a nahoře pruh ovládání.
 */
const PICTURE_FRAME_DEPTH = 3;
const SHINE_DEPTH = 4;
const PANEL_DEPTH = 10;
const STRIP_DEPTH = 20;

/** Kolik dotyků Phaser sleduje: první prst maluje, další (dlaň, druhý prst) se jen přeskočí. */
const TRACKED_TOUCHES = 4;

/** Co scéna malování dostane od výběru omalovánky (#124). */
export interface ColoringSceneOptions {
  /** Klíč scény; každé otevření omalovánky má novou scénu. */
  readonly key: string;
  readonly picture: PictureIdentity;
  /** Obrys a mapa oblastí omalovánky, které výběr připravuje i pro náhled. */
  readonly prepared: Promise<PreparedPicture>;
  /** Malování je vidět: od teď se počítá podržení domečku (#124 AC5). */
  readonly onShown: () => void;
}

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
 *
 * Od #105 je panel ve dvou krocích (nástroje, pak barva), krok drží také
 * `savedPicture.ts`. Ťuknutí se vyhodnotí hned při dotyku (`POINTER_DOWN`)
 * podle kroku, který byl vidět; zvednutí prstu už nic nevybírá, takže
 * nově ukázaný krok tentýž dotyk nedostane a jedno ťuknutí udělá jen
 * jednu věc.
 *
 * Od #111 je obrázek na výšku otočený o 90° po směru hodinových ručiček.
 * Otáčí se jen zobrazení vrstvy barev a obrysu; dotyk převede na bod
 * vrstvy `pictureLayerPoint`, takže logika i uložený obrázek se nemění.
 *
 * Od #124 scénu spouští výběr omalovánky (`PickerScene.ts`) s vybranou
 * omalovánkou, každé otevření novou scénou. Domeček a odchod z hry řídí
 * výběr; při návratu na výběr nebo do menu se tah ukončí a obrázek uloží.
 */
export class ColoringScene extends Phaser.Scene {
  private gameArea: GameArea = gameAreaFor(undefined, COLORING_GAME_AREA_FIT);
  private layout: ColoringLayout = layoutColoring(this.gameArea);
  /**
   * Barva štětce, dokud se obrázek připravuje (pak paletu i barvy nástrojů
   * drží `coloring`, #110).
   */
  private paletteBeforeReady: PaletteState = { selected: DEFAULT_TOOL_COLORS.brush };
  /** Krok panelu, dokud se obrázek připravuje (pak ho drží `coloring`). */
  private panelViewBeforeReady: PanelView = 'closed';
  /**
   * Malování s ukládáním podle profilu (#92); vznikne, až se vykreslí obrys
   * a spočítá mapa oblastí.
   */
  private coloring: SavedColoring | null = null;
  private paintLayer: PaintLayer | null = null;
  private pictureBackground: Phaser.GameObjects.Rectangle | null = null;
  private pictureFrame: Phaser.GameObjects.Rectangle | null = null;
  private paintImage: Phaser.GameObjects.Image | null = null;
  private outlineImage: Phaser.GameObjects.Image | null = null;
  private readonly panelView = new ToolPanelView(this);
  private readonly handleView = new HandleButtonView(this);
  private readonly undoView = new UndoButtonView(this);
  private readonly recentView = new RecentColorsView(this);
  /** Lesk během tahu třpytkami (#103 AC3), do obrázku se nezapíše. */
  private readonly shineView = new GlitterShineView(this, SHINE_DEPTH);
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

  private readonly paintTextureKey: string;
  private readonly outlineTextureKey: string;

  constructor(private readonly options: ColoringSceneOptions) {
    super(options.key);
    this.paintTextureKey = `${options.key}:paint`;
    this.outlineTextureKey = `${options.key}:outline`;
  }

  /** Návrat na výběr nebo odchod z hry: tah skončí, kam došel, obrázek se uloží. */
  finishPainting(): void {
    this.stop();
  }

  /** Ikony nástrojů (#106) jsou SVG přibalená ke hře, načtou se před startem scény. */
  preload(): void {
    preloadToolIcons(this);
  }

  create(): void {
    // Ostré plátno na iPadu a ve zmenšeném zobrazení (#77); kreslí se dál v herních jednotkách.
    followCanvasResolution(this);
    this.gameArea = this.readGameArea();
    this.layout = layoutColoring(this.gameArea);

    this.drawScreen();
    this.listenForTouches();
    this.listenForInterruptions();
    void this.preparePicture();
  }

  override update(): void {
    this.paintLayer?.flush();
    const { layout } = this;
    this.shineView.draw({
      toScreen: (point) => pictureScreenPoint(layout, PICTURE_LAYER, point.x, point.y),
      unitsPerLayerPixel: this.unitsPerLayerPixel(),
      cssScale: this.gameArea.scale,
    });
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

  /** Počká na obrys a mapu oblastí od výběru a připraví vrstvu barev. */
  private async preparePicture(): Promise<void> {
    const { outline, regions } = await this.options.prepared;
    if (!this.sys.isActive()) {
      // Dítě odešlo dřív, než se obrázek připravil.
      return;
    }
    this.coloring = openColoring({
      regions,
      picture: this.options.picture,
      // Bez obrysu se maluje jen v paměti, aby se uložený obrázek nepřepsal prázdnou plochou.
      storage: outline.drawn ? this.readHost()?.storage : undefined,
    });
    this.showSelection();
    this.showPanel();
    this.paintLayer = new PaintLayer(this, this.paintTextureKey, regions);
    this.paintLayer.paintAll(this.coloring);
    this.textures.addCanvas(this.outlineTextureKey, outline.canvas);
    this.paintImage = this.add.image(0, 0, this.paintTextureKey);
    this.outlineImage = this.add.image(0, 0, this.outlineTextureKey);
    this.placePicture();
    this.options.onShown();
  }

  // -------------------------------------------------------------------------
  // Kreslení obrazovky
  // -------------------------------------------------------------------------

  private drawScreen(): void {
    this.pictureBackground?.destroy();
    this.pictureBackground = this.add
      .rectangle(0, 0, 0, 0, colorNumber(PICTURE_STYLE.background))
      .setOrigin(0, 0);
    this.pictureFrame?.destroy();
    this.pictureFrame = this.add
      .rectangle(0, 0, 0, 0)
      .setOrigin(0, 0)
      .setStrokeStyle(
        PICTURE_STYLE.frameWidthCss / this.gameArea.scale,
        colorNumber(PICTURE_STYLE.frameColor),
      )
      .setDepth(PICTURE_FRAME_DEPTH);
    this.placePicture();
    const view = this.currentPanelView();
    this.panelView.place(
      {
        layout: this.layout,
        cssScale: this.gameArea.scale,
        areaWidth: this.gameArea.width,
        areaHeight: this.gameArea.height,
        depth: PANEL_DEPTH,
      },
      this.panelSelection(),
      view,
    );
    this.handleView.place(this.layout, this.gameArea.scale, STRIP_DEPTH);
    this.showHandle(view !== 'closed');
    this.undoView.place(this.layout.undoButton, this.gameArea.scale, STRIP_DEPTH);
    this.recentView.place(this.layout.recentColors, this.gameArea.scale, STRIP_DEPTH);
    this.showRecentColors();
  }

  /**
   * Bílá plocha, vrstva barev, obrys a rámeček přesně na místo omalovánky.
   * Bílá plocha leží neotočená na obdélníku obrázku na obrazovce. Rámeček
   * je nad obrysem celý uvnitř obdélníku (obrázek na šířku sahá k okraji
   * plochy a rámeček na hraně by byl vidět jen napůl). Vrstva barev a obrys
   * se otočí kolem středu obrázku (#111), jejich rozměr před otočením dává
   * `pictureLayerSize`.
   */
  private placePicture(): void {
    const { picture, pictureTurn } = this.layout;
    const frameInset = PICTURE_STYLE.frameWidthCss / this.gameArea.scale / 2;
    this.pictureBackground
      ?.setPosition(picture.left, picture.top)
      .setSize(picture.width, picture.height);
    this.pictureFrame
      ?.setPosition(picture.left + frameInset, picture.top + frameInset)
      .setSize(picture.width - 2 * frameInset, picture.height - 2 * frameInset);
    const layerSize = pictureLayerSize(this.layout);
    const centerX = picture.left + picture.width / 2;
    const centerY = picture.top + picture.height / 2;
    // Vrstva barev nad bílou plochou, obrys nad vrstvou barev.
    for (const [depth, image] of [
      [1, this.paintImage],
      [2, this.outlineImage],
    ] as const) {
      image
        ?.setPosition(centerX, centerY)
        .setAngle(pictureTurn)
        .setDisplaySize(layerSize.width, layerSize.height)
        .setDepth(depth);
    }
  }

  /** Kolik herních jednotek na obrazovce je jeden pixel vrstvy barev. */
  private unitsPerLayerPixel(): number {
    return pictureLayerSize(this.layout).width / PICTURE_PIXEL_WIDTH;
  }

  private onGameAreaChanged(): void {
    this.gameArea = this.readGameArea();
    this.layout = layoutColoring(this.gameArea);
    // Otočení telefonu: rozpracovaný tah se ukončí, namalované zůstane a další
    // tah se převede už podle nového rozložení (#111 AC5).
    this.interruptStroke();
    this.drawScreen();
  }

  // -------------------------------------------------------------------------
  // Panel nástrojů a úchyt
  // -------------------------------------------------------------------------

  private currentPanelView(): PanelView {
    return this.coloring?.panelView() ?? this.panelViewBeforeReady;
  }

  private isPanelOpen(): boolean {
    return this.currentPanelView() !== 'closed';
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
   * Barvy kroku barev v pořadí míst: sada nástroje, který by výběr dostal
   * (#116 AC1); dokud se obrázek připravuje, sada štětce.
   */
  private colorStep(): readonly number[] {
    return this.coloring?.colorStep() ?? TOOL_COLOR_SETS[INITIAL_COLOR_TOOL];
  }

  /**
   * Označené místo kroku barev, `null` když barvu nástroje jeho sada nemá
   * (#116 AC5); dokud se obrázek připravuje, místo barvy štětce.
   */
  private markedColorPlace(): number | null {
    if (this.coloring !== null) {
      return this.coloring.markedColorPlace();
    }
    return placeInSet(INITIAL_COLOR_TOOL, this.paletteBeforeReady.selected);
  }

  /**
   * Barva malovacího nástroje (#110); dokud se obrázek připravuje, má
   * štětec barvu z `paletteBeforeReady` a ostatní nástroje výchozí barvy.
   */
  private toolColor(tool: ToolId): number | null {
    if (this.coloring !== null) {
      return this.coloring.toolColor(tool);
    }
    if (tool === INITIAL_TOOL) {
      return this.paletteBeforeReady.selected;
    }
    return isColorTool(tool) ? DEFAULT_TOOL_COLORS[tool] : null;
  }

  /**
   * Co je v panelu označené; každý nástroj má kolečko své barvy (#110 AC2),
   * guma bílé čárkované a duha duhové. Vlnky tlačítek tloušťky jsou
   * v barvě vybraného nástroje (#112 AC1).
   */
  private panelSelection(): PanelSelection {
    const markedPlace = this.markedColorPlace();
    return {
      stepColors: this.colorStep(),
      markedColors: this.colorStep().map((_, place) => place === markedPlace),
      markedTools: markedTools(this.selectedTool()),
      lineSize: this.lineSize(),
      waveLook: lineSizeWaveLook({
        tool: this.selectedTool(),
        color: this.toolColor(this.selectedTool()),
      }),
      selectedTool: this.selectedTool(),
      toolColorDots: PANEL_TOOLS.map((tool) =>
        handleColorDotFill({ tool, color: this.toolColor(tool), size: this.lineSize() }),
      ),
    };
  }

  /**
   * Úchyt ukazuje vybraný nástroj v jeho barvě, gumu bez barvy
   * a tečku velikosti (#96 AC5, #90 AC1, #91 AC1).
   */
  private showHandle(open: boolean): void {
    const view: HandleView = this.coloring?.handleView() ?? {
      tool: INITIAL_TOOL,
      color: this.paletteBeforeReady.selected,
      size: INITIAL_LINE_SIZE,
    };
    this.handleView.show(view, open);
  }

  /**
   * Panel a šipka úchytu podle kroku v logice: panel se vysune nebo
   * zasune animací, v otevřeném panelu se kroky prolnou (#105).
   */
  private showPanel(): void {
    this.panelView.setView(this.currentPanelView());
    this.showHandle(this.isPanelOpen());
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

  /**
   * Ťuknutí na úchyt: panel se otevře na kroku nástrojů nebo zavře s tónem;
   * během tahu nic (#96 AC2, #105 AC1).
   */
  private onHandleTapped(): void {
    if (this.coloring === null) {
      const opening = this.panelViewBeforeReady === 'closed';
      this.panelViewBeforeReady = opening ? 'tools' : 'closed';
      this.sounds.play(opening ? PANEL_OPEN_TONES : PANEL_CLOSE_TONES);
    } else {
      this.sounds.play(this.coloring.tapHandle());
    }
    this.showPanel();
  }

  /**
   * Ťuknutí na nástroj (#90 AC1): vybere ho s tónem, i když už vybraný
   * byl. Nástroj s barvou přepne panel na krok barev, guma a duha panel
   * zavřou (#105 AC2, AC4). Prázdná místa a druhý prst během tahu nic
   * nedělají; dokud se obrázek připravuje, zůstává štětec.
   */
  private onToolTapped(index: number): void {
    if (this.coloring === null) {
      return;
    }
    const tones = this.coloring.tapTool(index);
    if (tones.length === 0) {
      return;
    }
    this.sounds.play(tones);
    this.showSelection();
    this.showPanel();
  }

  /**
   * Ťuknutí na vybraný nástroj v hlavičce kroku barev (#105 AC4): panel se
   * s tónem vrátí na krok nástrojů, výběr se nezmění. Druhý prst během tahu
   * nic nedělá.
   */
  private onBackToToolsTapped(): void {
    const tones = this.coloring?.tapBackToTools() ?? [];
    if (tones.length === 0) {
      return;
    }
    this.sounds.play(tones);
    this.showPanel();
  }

  /**
   * Ťuknutí na tlačítko tloušťky (#112 AC2): vybere ji s tónem a krátkým
   * zhoupnutím tlačítka, panel zůstane na kroku nástrojů. Druhý prst
   * během tahu nic nedělá; dokud se obrázek připravuje, zůstává střední.
   */
  private onLineSizeTapped(size: LineSize): void {
    const tones = this.coloring?.tapLineSize(size) ?? [];
    if (tones.length === 0) {
      return;
    }
    this.sounds.play(tones);
    this.panelView.wobbleLineSize(size);
    this.showSelection();
  }

  // -------------------------------------------------------------------------
  // Paleta
  // -------------------------------------------------------------------------

  /**
   * Ťuknutí na místo `place` kroku barev: vybere barvu, kterou místo
   * ukazuje (ze sady nástroje, #116), s tónem a panel zavře (#105 AC3).
   */
  private onColorTapped(place: number): void {
    const color = this.colorStep()[place];
    if (color === undefined) {
      return;
    }
    if (this.coloring === null) {
      // Obrázek se ještě připravuje: barva se jen vybere, uloží se až s obrázkem.
      const { state, tones } = tapColor(this.paletteBeforeReady, color, ALL_COLOR_COUNT);
      this.paletteBeforeReady = state;
      this.panelViewBeforeReady = 'closed';
      this.sounds.play(tones);
    } else {
      this.sounds.play(this.coloring.tapColor(color));
    }
    this.showSelection();
    this.showPanel();
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
        const sample = this.sampleOf(pointer);
        this.paintLayer?.paint(this.coloring.pointerMove(sample), this.coloring);
        this.shineView.move(sample.id, sample);
      }
    });
    const onUp = (pointer: Phaser.Input.Pointer): void => {
      this.coloring?.pointerUp(pointer.id);
      this.shineView.end(pointer.id);
    };
    this.input.on(Phaser.Input.Events.POINTER_UP, onUp);
    this.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, onUp);
  }

  /** Kam dotyk patří, rozhodne `touchTargetAt` (#96 AC4); malovat se smí jen na obrázku. */
  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    const target = touchTargetAt(
      this.layout,
      this.currentPanelView(),
      pointer.worldX,
      pointer.worldY,
    );
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
      case 'lineSize':
        this.onLineSizeTapped(target.size);
        return;
      case 'backToTools':
        this.onBackToToolsTapped();
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
      this.panelViewBeforeReady = 'closed';
    } else {
      const sample = this.sampleOf(pointer);
      this.paintLayer?.paint(this.coloring.pointerDown(sample), this.coloring);
      this.startShine(sample);
    }
    this.showPanel();
  }

  /**
   * Tah třpytkami se během malování leskne (#103 AC3). Lesk kreslí jen
   * první prst, stejně jako malování.
   */
  private startShine(sample: PointerSample): void {
    if (this.selectedTool() !== 'glitter') {
      return;
    }
    // Třpytky malují u nejtenčí stejně široce jako u malé (#118 AC2), lesk taky.
    const brushWidth = strokeWidthFor('glitter', PICTURE_PIXEL_WIDTH, this.lineSize());
    this.shineView.start(sample.id, brushWidth, sample);
  }

  /**
   * Dotyk v pixelech vrstvy barev, i na otočeném obrázku přesně pod prstem
   * (#111 AC2); bod mimo omalovánku je mimo plochu.
   */
  private sampleOf(pointer: Phaser.Input.Pointer): PointerSample {
    const point = pictureLayerPoint(this.layout, PICTURE_LAYER, pointer.worldX, pointer.worldY);
    return {
      id: pointer.id,
      x: point.x,
      y: point.y,
      kind: pointer.wasTouch ? 'touch' : 'mouse',
    };
  }

  private interruptStroke(): void {
    this.coloring?.interrupt();
    this.shineView.end();
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
    // Textury patří jen této scéně; další otevření omalovánky má vlastní.
    this.events.once(Phaser.Scenes.Events.DESTROY, () => {
      this.textures.remove(this.paintTextureKey);
      this.textures.remove(this.outlineTextureKey);
    });
  }

  /** Odchod z hry: tah skončí tam, kam došel, obrázek se uloží (#92) a zvuky ztichnou. */
  private stop(): void {
    this.shineView.end();
    this.coloring?.suspend();
    this.sounds.stopAll();
  }
}

/** Je hodnota z registru herní plocha? */
export function isGameArea(value: unknown): value is GameArea {
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
