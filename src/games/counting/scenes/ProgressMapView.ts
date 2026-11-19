import Phaser from 'phaser';

import type { KeyReward } from '../../../shared/logic/keyRewards';
import { FONT_FAMILY, colorNumber } from '../../../shared/logic/theme';
import type { GameArea, GameSize } from '../../../shared/logic/viewportLayout';
import type { MapLook } from '../logic/mapPictureLoading';
import { MAP_GOAL_SYMBOLS } from '../logic/mapPictures';
import type { PictureRect } from '../logic/mapPictures';
import { mapCardPictureCover } from '../logic/progressMapCard';
import type { ProgressMapCard } from '../logic/progressMapCard';
import { MAP_STEPS } from '../logic/progressMap';
import type { MapMarker, MapMove } from '../logic/progressMap';
import {
  MAP_GOAL_CELEBRATION_SCALE,
  MARKER_ARRIVAL_MS,
  goalCelebrationAt,
  isPlaceLitAt,
  markerPointAt,
  markerTrailAt,
} from '../logic/mapAnimation';
import { layoutMapFootprints, mapFootprintStyleFor } from '../logic/mapFootprints';
import { layoutMapPlacePads, mapPlacePadStyleFor } from '../logic/mapPlacePads';
import { layoutMapScenery } from '../logic/mapScenery';
import {
  MAP_ARRIVAL_PULSE_SCALE,
  layoutProgressMap,
  markerAt,
  pathLinePoints,
} from '../logic/progressMapLayout';
import type { MapPoint, ProgressMapLayout } from '../logic/progressMapLayout';
import {
  CONFETTI_COLORS,
  PROGRESS_MAP_BACKGROUNDS,
  PROGRESS_MAP_CARD_STYLE,
  PROGRESS_MAP_EFFECTS,
  PROGRESS_MAP_SHAPE,
  PROGRESS_MAP_STYLE,
  progressMapStyleFor,
} from '../logic/theme';
import type { ProgressMapStyle } from '../logic/theme';
import { GoalKeyBadge } from './GoalKeyBadge';
import { drawFootprints } from './MapFootprintPieces';
import type { DrawnFootprints } from './MapFootprintPieces';
import { drawPlacePads } from './MapPlacePadPieces';
import { drawScenery, moveScenery } from './MapSceneryPieces';
import type { DrawnSceneryPiece } from './MapSceneryPieces';
import { goalSymbolTextureKey, mapPictureTextureKey } from './mapPictureTextures';

/** Mapa leží nad příkladem i řadou hvězdiček, pod panely rodičů. */
const MAP_DEPTH = 20;

/**
 * Nad kartou s mapou: konfety oslavy doběhnou přes okno a hvězdičky
 * z řady do něj přiletí (#154 AC1, AC3). Pořád pod panely rodičů.
 */
export const ABOVE_MAP_DEPTH = MAP_DEPTH + 5;

/**
 * Předčasné ťuknutí kartu krátce zhoupne do stran (#145 AC4): jak daleko
 * v CSS px, kolikrát tam a zpět a jak dlouho celkem (do 250 ms).
 */
const CARD_WOBBLE_CSS = 8;
const CARD_WOBBLE_SWINGS = 2;
const CARD_WOBBLE_MS = 240;

/** Zastávka a značka po dojití krátce poskočí (zvětšení a skok nahoru). */
const ARRIVAL_PULSE_MS = 180;
const ARRIVAL_HOP_MS = 280;
const ARRIVAL_HOP_SHARE = 0.12;

/**
 * Jemná čára cesty pod stopami (#144, UX kontrola): stopy cestu tvoří,
 * čára jen spojí jejich řady přes místa, aby se cesta četla jako jedna.
 * Šířka jako díl průměru značky a krytí.
 */
const FAINT_PATH_WIDTH_SHARE = 0.06;
const FAINT_PATH_ALPHA = 0.2;

/** Jiskřičky za značkou (kde jsou, určuje `markerTrailAt`): jak velké a jak rychle mihotají. */
const TRAIL_SPARKLE_SIZE = 0.15;
const TRAIL_SPARKLE_TWINKLE_MS = 70;
const TRAIL_SPARKLE_ALPHA = 0.95;
/** Mihotání jiskřičky: nejmenší velikost a o kolik naroste. */
const TWINKLE_MIN = 0.6;
const TWINKLE_SWING = 0.4;

/** Čtyřcípá jiskřička: vnitřní poloměr a obrys jako díl jejího poloměru. */
const SPARKLE_INNER_SHARE = 0.38;
const SPARKLE_OUTLINE_SHARE = 0.12;

/** Modrá svatozář při zastavení: poloměr a šířka (díl průměru značky), krytí, růst a délka. */
const HALO_RADIUS_SHARE = 0.56;
const HALO_WIDTH_SHARE = 0.14;
const HALO_ALPHA = 0.8;
const HALO_MS = 520;
const HALO_GROWTH = 1.7;

/** Jiskřičky při zastavení: kolik, jak velké a jak daleko doletí (v průměrech značky). */
const ARRIVAL_SPARKLES = 8;
const ARRIVAL_SPARKLE_SIZE = 0.12;
const ARRIVAL_SPARKLE_MS = 560;
const ARRIVAL_SPARKLE_REACH = 1.0;
const ARRIVAL_SPARKLE_END_SCALE = 0.6;

/** Záře slavícího cíle: z kolika vrstev, jak krytá a jak rychle a silně pulzuje. */
const GOAL_GLOW_LAYERS = 4;
const GOAL_GLOW_ALPHA = 0.65;
const GOAL_GLOW_PULSE_MS = 260;
const GOAL_GLOW_PULSE_BASE = 0.8;
const GOAL_GLOW_PULSE_SWING = 0.2;
const GOAL_RING_WIDTH_SHARE = 0.07;

/**
 * Jiskřičky v rozích slavícího cíle: kolik, jak daleko od středu (díl
 * poloviny slavícího čtverce, aby zůstaly uvnitř), jak velké (díl průměru
 * značky) a jak mihotají (rychlost, posun mezi jiskřičkami, velikost).
 */
const GOAL_SPARKLES = 4;
const GOAL_SPARKLE_REACH = 0.82;
const GOAL_SPARKLE_SIZE = 0.11;
const GOAL_SPARKLE_TWINKLE_MS = 180;
const GOAL_SPARKLE_PHASE = 1.3;
const GOAL_SPARKLE_SCALE_MIN = 0.7;
const GOAL_SPARKLE_SCALE_SWING = 0.4;

/**
 * Konfety v cíli (návrh 3-cil): vyletí ze symbolu cíle daleko do mapy
 * (díl šířky okna), pak padají přes celé okno pod jeho spodní okraj a mizí.
 */
const GOAL_CONFETTI_COUNT = 48;
const GOAL_CONFETTI_REACH = { min: 0.12, max: 0.6 };
const GOAL_CONFETTI_BURST_MS = { min: 450, max: 650 };
const GOAL_CONFETTI_FALL_MS = { min: 1500, max: 2300 };
const GOAL_CONFETTI_DRIFT = 0.08;
const GOAL_CONFETTI_ANGLE_JITTER = 0.3;
const GOAL_CONFETTI_SPIN = { min: 180, max: 540 };
/** Velikost konfety jako díl průměru značky. */
const GOAL_CONFETTI_WIDTH = 0.1;
const GOAL_CONFETTI_HEIGHT = 0.16;

const LETTER_SIZE_SHARE = 0.55;

const CONFETTI_COLOR_NUMBERS = CONFETTI_COLORS.map(colorNumber);

/** Barvy efektů převedené na čísla jednou, ne v každém snímku. */
const EFFECT_COLORS = {
  sparkles: PROGRESS_MAP_EFFECTS.sparkleColors.map(colorNumber),
  sparkleOutline: colorNumber(PROGRESS_MAP_EFFECTS.sparkleOutlineColor),
  halo: colorNumber(PROGRESS_MAP_EFFECTS.haloColor),
  goalGlow: colorNumber(PROGRESS_MAP_EFFECTS.goalGlowColor),
  goalRing: colorNumber(PROGRESS_MAP_EFFECTS.goalRingColor),
};

function sparkleColor(index: number): number {
  return EFFECT_COLORS.sparkles[index % EFFECT_COLORS.sparkles.length] ?? EFFECT_COLORS.goalRing;
}

/**
 * Kde a jak mapu nakreslit: herní plocha pod kartou, okno v CSS px, karta
 * s mapou (#145) a vzhled tohoto ukázání.
 */
export interface MapScreen {
  readonly area: GameArea;
  readonly window: GameSize;
  readonly card: ProgressMapCard;
  readonly look: MapLook;
}

/**
 * Karta nad ztmavenou hrou (#145): ztmavení přes celé okno, stín s bílým
 * okrajem, maska se zaoblenými rohy a plocha, která chytá ťuknutí.
 * Stín, okraj, maska i obsah mapy se při zhoupnutí posunou spolu.
 */
interface CardFrame {
  readonly dim: Phaser.GameObjects.Graphics;
  readonly frame: Phaser.GameObjects.Graphics;
  readonly maskShape: Phaser.GameObjects.Graphics;
  readonly mask: Phaser.Display.Masks.GeometryMask;
  readonly tapZone: Phaser.GameObjects.Zone;
  /** Levý horní roh karty v herních jednotkách herní plochy. */
  readonly left: number;
  readonly top: number;
}

/** Nakreslená mapa jednoho ukázání a co už z jednorázových efektů proběhlo. */
interface MapDrawing {
  readonly container: Phaser.GameObjects.Container;
  readonly layout: ProgressMapLayout;
  readonly style: ProgressMapStyle;
  readonly move: MapMove;
  readonly marker: Phaser.GameObjects.Container;
  readonly target: Phaser.GameObjects.Arc | undefined;
  /** Jiskřičky za jdoucí značkou. */
  readonly trail: Phaser.GameObjects.Graphics;
  /** Stopy na cestě (#144), rozsvěcují se za značkou. */
  readonly footprints: DrawnFootprints;
  readonly goal: Phaser.GameObjects.Container;
  readonly goalGlow: Phaser.GameObjects.Graphics;
  readonly goalSparkles: readonly Phaser.GameObjects.Star[];
  /** Pohyblivé kousky prostředí pod cestou (#136). */
  readonly scenery: readonly DrawnSceneryPiece[];
  /** Půlka klíče u cíle (#139), když cíl nějakou dal. */
  readonly goalKey: GoalKeyBadge | null;
  /** Značka už zastavila na novém místě (svatozář a jiskřičky proběhly). */
  arrived: boolean;
  /** Konfety v cíli už vyletěly. */
  confettiThrown: boolean;
  /** Značka stojí a doskákala: jiskřičky, stopy a poloha se už nepočítají. */
  settled: boolean;
  /** Cíl je plně zvětšený: velikost se už nepočítá. */
  goalGrown: boolean;
  /** Spodní okraj karty v herních jednotkách: konfety padají až pod něj. */
  readonly windowBottom: number;
  /** Šířka karty v herních jednotkách: jak daleko konfety vyletí. */
  readonly windowWidth: number;
  readonly card: CardFrame;
  /** Zhoupnutí karty po předčasném ťuknutí, dokud běží. */
  wobble: Phaser.Tweens.Tween | null;
}

/**
 * Mapa postupu (#87, #133, #134, #135) v kartě nad ztmavenou hrou (#145,
 * varianta V2): karta má bílý okraj, stín a zaoblené rohy, které obsah
 * mapy (i konfety cíle) oříznou. Obrázek prostředí přes celou kartu,
 * nad ním cesta ze stop podle tématu (#144) na jemné čáře, start, 2 zastávky, cíl se
 * symbolem tématu a značka hráče. Místa leží na podložkách podle tématu (#147).
 * Bez staženého obrázku zástupný vzhled v barvě mapy (#134 AC4).
 * Nad pozadím (obrázkem i zástupným) a pod cestou se jemně hýbe prostředí
 * podle tématu (#136, `logic/mapScenery.ts`).
 * Značka jde po cestě, stopy se za ní rozsvěcují a poskočí, nové místo
 * se rozsvítí až při zastavení (svatozář, jiskřičky, poskočení) a v cíli
 * se symbol zvětší a zazáří a přijdou konfety. Po melodii cíle se vedle cíle objeví půlka
 * klíče, případně se spojí s druhou v celý klíč (#139). Kde co je, řídí časová osa
 * `logic/mapAnimation.ts` podle času od ukázání, takže po otočení se mapa
 * překreslí ve stejném okamžiku. Ťuknutí kamkoli na plátno (na kartu
 * i na ztmavení) předá `onTap` a pod kartu nepropustí; zavření nebo
 * zhoupnutí rozhoduje sezení (#145 AC4, AC5). Kolečko a domeček jsou prvky
 * stránky, leží nad plátnem, a tedy i nad ztmavením.
 */
export class ProgressMapView {
  private drawing: MapDrawing | null = null;
  private shown: MapMove | null = null;
  /** Co dal ukázaný cíl (#139); `null` na zastávce a když cíl nic nedal. */
  private shownKeyReward: KeyReward | null = null;
  /** Kdy se mapa ukázala (čas scény); po otočení se zachová. */
  private shownAt = 0;

  /** CSS px na herní jednotku nakreslené karty. */
  private drawnScale = 1;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly marker: () => MapMarker,
    private readonly onTap: () => void,
  ) {}

  /**
   * Ukáže mapu se značkou na `move.from`; značka pak jde na `move.to`.
   * V cíli s `keyReward` se po melodii cíle objeví půlka klíče (#139).
   */
  show(screen: MapScreen, move: MapMove, keyReward: KeyReward | null): void {
    this.hide();
    this.shown = move;
    this.shownKeyReward = move.reachedGoal ? keyReward : null;
    this.shownAt = this.scene.time.now;
    this.scene.events.on(Phaser.Scenes.Events.UPDATE, this.tick, this);
    this.scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.hide, this);
    this.draw(screen, move);
  }

  /** Otočení zařízení: mapa se překreslí a animace pokračuje ze stejného okamžiku. */
  redraw(screen: MapScreen): void {
    const move = this.shown;
    if (move === null) {
      return;
    }
    this.destroyDrawing();
    this.draw(screen, move);
  }

  /** Mapa zmizí i uprostřed animace: efekty se zastaví a nic dalšího se nestane. */
  hide(): void {
    this.shown = null;
    this.shownKeyReward = null;
    this.scene.events.off(Phaser.Scenes.Events.UPDATE, this.tick, this);
    this.scene.events.off(Phaser.Scenes.Events.SHUTDOWN, this.hide, this);
    this.destroyDrawing();
  }

  /** Kolik ms uběhlo od ukázání mapy (po otočení se nezmění, #135 AC4). */
  elapsedMs(): number {
    return Math.max(0, this.scene.time.now - this.shownAt);
  }

  /**
   * Kde je teď značka v herních jednotkách herní plochy (i se zhoupnutím
   * karty); `null`, když mapa není vidět. Sem letí hvězdičky z řady (#154).
   */
  markerPosition(): MapPoint | null {
    const drawing = this.drawing;
    if (drawing === null) {
      return null;
    }
    return {
      x: drawing.container.x + drawing.marker.x,
      y: drawing.container.y + drawing.marker.y,
    };
  }

  /**
   * Předčasné ťuknutí (#145 AC4): karta se krátce zhoupne do stran a vrátí
   * se na místo. Nic jiného se nemění, odpočet běží dál v sezení.
   */
  wobble(): void {
    const drawing = this.drawing;
    if (drawing === null || drawing.wobble !== null) {
      return;
    }
    const swing = { share: 0 };
    const reach = CARD_WOBBLE_CSS / this.drawnScale;
    drawing.wobble = this.scene.tweens.add({
      targets: swing,
      share: 1,
      duration: CARD_WOBBLE_MS,
      onUpdate: () => {
        const fade = 1 - swing.share;
        const offset = Math.sin(swing.share * Math.PI * 2 * CARD_WOBBLE_SWINGS) * fade * reach;
        placeCard(drawing, offset);
      },
      onComplete: () => {
        placeCard(drawing, 0);
        drawing.wobble = null;
      },
    });
  }

  private destroyDrawing(): void {
    const drawing = this.drawing;
    this.drawing = null;
    if (drawing) {
      drawing.wobble?.remove();
      this.scene.tweens.killTweensOf(drawing.container.list);
      drawing.goalKey?.stopAnimations();
      drawing.footprints.destroy();
      drawing.container.clearMask();
      drawing.container.destroy(true);
      const { dim, frame, maskShape, mask, tapZone } = drawing.card;
      mask.destroy();
      [dim, frame, maskShape, tapZone].forEach((object) => object.destroy());
    }
  }

  /**
   * Ztmavení přes celé okno, stín a bílý okraj karty, maska zaoblených
   * rohů a plocha přes celé okno, která chytá ťuknutí (#145).
   */
  private drawCardFrame(screen: MapScreen): CardFrame {
    const { area, card } = screen;
    const style = PROGRESS_MAP_CARD_STYLE;
    const units = (css: number): number => css / (area.scale > 0 ? area.scale : 1);
    const windowRect = toGameUnits({ left: 0, top: 0, ...screen.window }, area);
    const cardRect = toGameUnits(card.rect, area);
    const dim = this.scene.add
      .graphics()
      .fillStyle(colorNumber(style.dimColor), style.dimAlpha)
      .fillRect(windowRect.left, windowRect.top, windowRect.width, windowRect.height)
      .setDepth(MAP_DEPTH);
    const radius = units(style.cornerRadiusCss);
    const border = units(style.borderCss);
    const frame = this.scene.add.graphics().setDepth(MAP_DEPTH);
    for (let layer = style.shadowLayers; layer >= 1; layer -= 1) {
      const spread = border + units(style.shadowSpreadCss * layer);
      frame
        .fillStyle(colorNumber(style.shadowColor), style.shadowLayerAlpha)
        .fillRoundedRect(
          -spread,
          -spread + units(style.shadowOffsetCss),
          cardRect.width + spread * 2,
          cardRect.height + spread * 2,
          radius + spread,
        );
    }
    frame
      .fillStyle(colorNumber(style.borderColor), 1)
      .fillRoundedRect(
        -border,
        -border,
        cardRect.width + border * 2,
        cardRect.height + border * 2,
        radius + border,
      );
    const maskShape = this.scene.make.graphics({}, false);
    maskShape.fillStyle(0xffffff, 1).fillRoundedRect(0, 0, cardRect.width, cardRect.height, radius);
    // Ťuknutí kamkoli na plátno patří kartě, pod ni se nedostane (#145 AC5).
    // Ochrana stojí na dvou věcech: Phaser má `input.topOnly` (výchozí true),
    // takže ťuknutí dostane jen nejvyšší ťukací plocha, tedy tato nad
    // číselníkem, nápovědou i okénky; a sezení během karty i chvíli po jejím
    // zavření žádnou odpověď nepřijme (`acceptsAnswers`).
    const tapZone = this.scene.add
      .zone(windowRect.left, windowRect.top, windowRect.width, windowRect.height)
      .setOrigin(0, 0)
      .setDepth(MAP_DEPTH + 1)
      .setInteractive();
    tapZone.on('pointerdown', () => this.onTap());
    return {
      dim,
      frame,
      maskShape,
      mask: maskShape.createGeometryMask(),
      tapZone,
      left: cardRect.left,
      top: cardRect.top,
    };
  }

  private draw(screen: MapScreen, move: MapMove): void {
    const { look } = screen;
    // Mapa se rozloží v ploše karty; souřadnice jsou od levého horního rohu karty.
    const area = screen.card.area;
    this.drawnScale = area.scale > 0 ? area.scale : 1;
    const elapsed = this.elapsedMs();
    const cardFrame = this.drawCardFrame(screen);
    const windowRect = { left: 0, top: 0, width: area.width, height: area.height };
    const layout = layoutProgressMap(area, move.theme);
    const style = progressMapStyleFor(move.theme, look);
    const background = this.drawBackground(screen, move);
    const scenery = drawScenery(this.scene, layoutMapScenery(area, move.theme, layout));
    const path = this.drawFaintPath(layout, style);
    const footprints = drawFootprints(
      this.scene,
      layout,
      move,
      layoutMapFootprints(area, move.theme, layout),
      mapFootprintStyleFor(move.theme, look),
      this.scene.cameras.main.zoom,
    );
    const pads = drawPlacePads(
      this.scene,
      move.theme,
      layoutMapPlacePads(area, move.theme, layout),
      mapPlacePadStyleFor(move.theme, look),
    );
    const trail = this.scene.add.graphics();
    const places = layout.places.map((_, step) =>
      this.drawPlace(layout, style, step, isPlaceLitAt(move, step, elapsed)),
    );
    const goalGlow = this.scene.add.graphics();
    const goal = this.drawGoalSymbol(layout, style, move, goalGlow);
    const goalSparkles = this.drawGoalSparkles(layout);
    const goalKey =
      this.shownKeyReward === null
        ? null
        : new GoalKeyBadge(this.scene, layout.goalKey, style, this.shownKeyReward, elapsed);
    const markerPoint = markerPointAt(layout, move, elapsed);
    const marker = this.drawMarker(layout, markerPoint.x, markerPoint.y);
    const container = this.scene.add
      .container(0, 0, [
        ...background,
        ...scenery.map(({ graphics }) => graphics),
        path,
        ...footprints.objects,
        pads,
        ...places,
        trail,
        goal,
        ...goalSparkles,
        ...(goalKey === null ? [] : [goalKey.container]),
        marker,
      ])
      .setDepth(MAP_DEPTH)
      .setMask(cardFrame.mask);
    this.drawing = {
      container,
      layout,
      style,
      move,
      marker,
      target: places[move.to],
      trail,
      footprints,
      goal,
      goalGlow,
      goalSparkles,
      scenery,
      goalKey,
      // Po otočení se jednorázové efekty, které už proběhly, neopakují.
      arrived: isPlaceLitAt(move, move.to, elapsed),
      confettiThrown: goalCelebrationAt(move, elapsed).confetti,
      settled: false,
      goalGrown: false,
      windowBottom: windowRect.top + windowRect.height,
      windowWidth: windowRect.width,
      card: cardFrame,
      wobble: null,
    };
    placeCard(this.drawing, 0);
    this.tick();
  }

  /**
   * Každý snímek: kousky prostředí, značka, jiskřičky, stopy, rozsvícení
   * nového místa a slavící cíl podle času.
   */
  private tick(): void {
    const drawing = this.drawing;
    if (drawing === null) {
      return;
    }
    const elapsed = this.elapsedMs();
    const { layout, move, marker } = drawing;
    moveScenery(drawing.scenery, elapsed);
    if (!drawing.settled) {
      const point = markerPointAt(layout, move, elapsed);
      marker.setPosition(point.x, point.y - arrivalHop(elapsed) * layout.markerSize);
      this.drawTrail(drawing, elapsed);
      drawing.footprints.update(elapsed);
      // Značka stojí a doskákala: poloha, jiskřičky ani stopy se už nemění.
      drawing.settled = elapsed >= MARKER_ARRIVAL_MS + ARRIVAL_HOP_MS;
    }
    if (!drawing.arrived && isPlaceLitAt(move, move.to, elapsed)) {
      drawing.arrived = true;
      this.celebrateArrival(drawing);
    }
    if (move.reachedGoal) {
      this.paintGoal(drawing, elapsed);
    }
    drawing.goalKey?.update(elapsed);
  }

  /**
   * Zástupná barva přes celou kartu a nad ní obrázek, když je v tomto
   * ukázání (AC1, AC4); obrázek zakryje celou kartu a orientace se řídí
   * jejím tvarem (#145 AC2). Co přečnívá, ořízne maska karty.
   */
  private drawBackground(screen: MapScreen, move: MapMove): Phaser.GameObjects.GameObject[] {
    const { card, look } = screen;
    const area = card.area;
    const backdrop = this.scene.add
      .rectangle(0, 0, area.width, area.height, colorNumber(PROGRESS_MAP_BACKGROUNDS[move.theme]))
      .setOrigin(0, 0);
    const { orientation, rect } = mapCardPictureCover(card);
    const key = mapPictureTextureKey({ theme: move.theme, orientation });
    if (look !== 'picture' || !this.scene.textures.exists(key)) {
      return [backdrop];
    }
    // Obrázek je v CSS px od rohu karty; plocha karty začíná v jejím rohu.
    const cover = toGameUnits(rect, { ...area, offsetX: 0, offsetY: 0 });
    const picture = this.scene.add
      .image(cover.left, cover.top, key)
      .setOrigin(0, 0)
      .setDisplaySize(cover.width, cover.height);
    return [backdrop, picture];
  }

  /** Jemná čára po oblouku cesty (#146) pod stopami, v barvě cesty mapy (`pathColor`). */
  private drawFaintPath(
    layout: ProgressMapLayout,
    style: ProgressMapStyle,
  ): Phaser.GameObjects.Graphics {
    const graphics = this.scene.add.graphics();
    graphics.fillStyle(colorNumber(style.pathColor), FAINT_PATH_ALPHA);
    // Každý úsek je jeden vyplněný pás: tahy lomené čáry by se v kloubech
    // překrývaly a poloprůhledná čára by měla tmavší tečky.
    for (let segment = 0; segment + 1 < layout.places.length; segment += 1) {
      const halfWidth = (layout.markerSize * FAINT_PATH_WIDTH_SHARE) / 2;
      graphics.fillPoints(bandPolygon(pathLinePoints(layout, segment), halfWidth), true);
    }
    return graphics;
  }

  private drawPlace(
    layout: ProgressMapLayout,
    style: ProgressMapStyle,
    step: number,
    visited: boolean,
  ): Phaser.GameObjects.Arc {
    const point = markerAt(layout, step);
    const place = this.scene.add.circle(point.x, point.y, layout.placeSize / 2);
    paintPlace(place, layout, style, step, visited);
    return place;
  }

  /**
   * Symbol tématu u cíle (AC2) na světlém kruhovém podkladu s okrajem, aby
   * nesplýval s obrázkem pod ním. Bez načteného SVG systémové emoji
   * (symbol, ne text jazyka). Pod podkladem je skrytá zlatá záře
   * s prstencem, která se ukáže, až cíl slaví (#135 AC3).
   */
  private drawGoalSymbol(
    layout: ProgressMapLayout,
    style: ProgressMapStyle,
    move: MapMove,
    glow: Phaser.GameObjects.Graphics,
  ): Phaser.GameObjects.Container {
    const { x, y, size } = layout.goalSymbol;
    paintGoalGlow(glow, size);
    glow.setVisible(false);
    const border = size * PROGRESS_MAP_SHAPE.goalBadgeBorderShare;
    // Okraj leží na hraně kruhu napůl venku: celý podklad má průměr `size`.
    const badge = this.scene.add
      .circle(0, 0, (size - border) / 2, colorNumber(style.goalBadgeColor))
      .setStrokeStyle(border, colorNumber(style.goalBadgeBorderColor));
    const symbolSize = size * PROGRESS_MAP_SHAPE.goalSymbolShare;
    const key = goalSymbolTextureKey(move.theme);
    const symbol = this.scene.textures.exists(key)
      ? this.scene.add.image(0, 0, key).setDisplaySize(symbolSize, symbolSize)
      : this.scene.add
          .text(0, 0, MAP_GOAL_SYMBOLS[move.theme].emoji, {
            fontFamily: FONT_FAMILY,
            fontSize: `${Math.round(symbolSize)}px`,
          })
          .setOrigin(0.5);
    return this.scene.add.container(x, y, [glow, badge, symbol]);
  }

  /** Jiskřičky v rozích slavícího cíle, skryté, dokud cíl neslaví. */
  private drawGoalSparkles(layout: ProgressMapLayout): Phaser.GameObjects.Star[] {
    const { x, y, size } = layout.goalCelebration;
    const reach = (size / 2) * GOAL_SPARKLE_REACH;
    return Array.from({ length: GOAL_SPARKLES }, (_, index) => {
      const angle = Math.PI / 4 + (index * Math.PI) / 2;
      return this.sparkle(
        x + Math.cos(angle) * reach,
        y + Math.sin(angle) * reach,
        layout.markerSize * GOAL_SPARKLE_SIZE,
        index,
      ).setVisible(false);
    });
  }

  private drawMarker(
    layout: ProgressMapLayout,
    x: number,
    y: number,
  ): Phaser.GameObjects.Container {
    const { color, letter } = this.marker();
    const radius = layout.markerSize / 2;
    const circle = this.scene.add
      .circle(0, 0, radius, colorNumber(color))
      .setStrokeStyle(
        layout.markerSize * PROGRESS_MAP_SHAPE.markerBorderShare,
        colorNumber(PROGRESS_MAP_STYLE.markerBorderColor),
      );
    const parts: Phaser.GameObjects.GameObject[] = [circle];
    if (letter !== null) {
      parts.push(
        this.scene.add
          .text(0, 0, letter, {
            fontFamily: FONT_FAMILY,
            fontSize: `${Math.round(layout.markerSize * LETTER_SIZE_SHARE)}px`,
            fontStyle: String(PROGRESS_MAP_STYLE.markerLetterWeight),
            color: PROGRESS_MAP_STYLE.markerLetterColor,
          })
          .setOrigin(0.5),
      );
    }
    return this.scene.add.container(x, y, parts);
  }

  /** Bílá nebo zlatá čtyřcípá jiskřička se zlatým obrysem. */
  private sparkle(x: number, y: number, radius: number, index: number): Phaser.GameObjects.Star {
    return this.scene.add
      .star(x, y, 4, radius * SPARKLE_INNER_SHARE, radius, sparkleColor(index))
      .setStrokeStyle(Math.max(1, radius * SPARKLE_OUTLINE_SHARE), EFFECT_COLORS.sparkleOutline);
  }

  /**
   * Mihotající se jiskřičky za jdoucí značkou po oblouku cesty (#146 AC5).
   * Zlatou čáru z #135 nahradily rozsvěcující se stopy (#144 AC4).
   * Po zastavení zmizí.
   */
  private drawTrail(drawing: MapDrawing, elapsed: number): void {
    const { trail, layout, move } = drawing;
    trail.clear();
    const shape = markerTrailAt(layout, move, elapsed);
    if (shape === null) {
      return;
    }
    shape.sparkles.forEach((sparkle, index) => {
      const twinkle =
        TWINKLE_MIN + TWINKLE_SWING * Math.sin(elapsed / TRAIL_SPARKLE_TWINKLE_MS + index * 2);
      const radius = layout.markerSize * TRAIL_SPARKLE_SIZE * twinkle;
      trail.fillStyle(sparkleColor(index), TRAIL_SPARKLE_ALPHA);
      trail.fillPoints(starPoints(sparkle.x, sparkle.y, radius), true);
    });
  }

  /**
   * Značka zastavila: nové místo se rozsvítí, místo i značka poskočí,
   * kolem značky se rozplyne modrá svatozář a rozletí 8 jiskřiček (AC2).
   * Efekty po doběhnutí samy zmizí.
   */
  private celebrateArrival(drawing: MapDrawing): void {
    const { layout, style, move, marker, target, container } = drawing;
    const point = markerAt(layout, move.to);
    if (target) {
      paintPlace(target, layout, style, move.to, true);
    }
    this.scene.tweens.add({
      targets: target ? [target, marker] : [marker],
      scale: MAP_ARRIVAL_PULSE_SCALE,
      duration: ARRIVAL_PULSE_MS,
      yoyo: true,
      ease: 'Sine.easeOut',
    });
    const halo = this.scene.add
      .circle(point.x, point.y, layout.markerSize * HALO_RADIUS_SHARE)
      .setStrokeStyle(layout.markerSize * HALO_WIDTH_SHARE, EFFECT_COLORS.halo, HALO_ALPHA);
    container.addAt(halo, container.getIndex(marker));
    this.scene.tweens.add({
      targets: halo,
      scale: HALO_GROWTH,
      alpha: 0,
      duration: HALO_MS,
      ease: 'Sine.easeOut',
      onComplete: () => halo.destroy(),
    });
    for (let index = 0; index < ARRIVAL_SPARKLES; index += 1) {
      const angle = (index / ARRIVAL_SPARKLES) * Math.PI * 2;
      const star = this.sparkle(point.x, point.y, layout.markerSize * ARRIVAL_SPARKLE_SIZE, index);
      container.add(star);
      const reach = layout.markerSize * ARRIVAL_SPARKLE_REACH;
      this.scene.tweens.add({
        targets: star,
        x: point.x + Math.cos(angle) * reach,
        y: point.y + Math.sin(angle) * reach,
        scale: ARRIVAL_SPARKLE_END_SCALE,
        // Jiskřička nejdřív doletí a teprve ke konci zmizí.
        alpha: { value: 0, ease: 'Quart.easeIn' },
        angle: 90,
        duration: ARRIVAL_SPARKLE_MS,
        ease: 'Cubic.easeOut',
        onComplete: () => star.destroy(),
      });
    }
  }

  /** Slavící cíl: zvětšení, pulzující záře, jiskřičky a jednou konfety (AC3). */
  private paintGoal(drawing: MapDrawing, elapsed: number): void {
    const moment = goalCelebrationAt(drawing.move, elapsed);
    if (!drawing.goalGrown) {
      drawing.goal.setScale(moment.scale);
      drawing.goalGrown = moment.scale >= MAP_GOAL_CELEBRATION_SCALE;
    }
    drawing.goalGlow.setVisible(moment.glowing);
    drawing.goalSparkles.forEach((star) => star.setVisible(moment.glowing));
    if (moment.glowing) {
      drawing.goalGlow.setAlpha(
        GOAL_GLOW_PULSE_BASE + GOAL_GLOW_PULSE_SWING * Math.sin(elapsed / GOAL_GLOW_PULSE_MS),
      );
      drawing.goalSparkles.forEach((star, index) => {
        const twinkle = Math.sin(elapsed / GOAL_SPARKLE_TWINKLE_MS + index * GOAL_SPARKLE_PHASE);
        star.setScale(GOAL_SPARKLE_SCALE_MIN + GOAL_SPARKLE_SCALE_SWING * Math.abs(twinkle));
      });
    }
    if (moment.confetti && !drawing.confettiThrown) {
      drawing.confettiThrown = true;
      this.throwGoalConfetti(drawing);
      // Půlka klíče zůstane nad konfetami, aby ji nezakryly (#139).
      if (drawing.goalKey) {
        drawing.container.bringToTop(drawing.goalKey.container);
      }
    }
  }

  /**
   * Konfety vyletí ze symbolu cíle na všechny strany daleko do mapy, pak
   * padají přes celé okno pod jeho spodní okraj a mizí. Druhý tween
   * (pád) začne až po prvním (výletu), oba se ruší se zbytkem mapy.
   */
  private throwGoalConfetti(drawing: MapDrawing): void {
    const { layout, container, windowBottom, windowWidth } = drawing;
    const { x, y } = layout.goalSymbol;
    const unit = layout.markerSize;
    const fallTo = windowBottom + unit * GOAL_CONFETTI_HEIGHT * 2;
    for (let index = 0; index < GOAL_CONFETTI_COUNT; index += 1) {
      const color = CONFETTI_COLOR_NUMBERS[index % CONFETTI_COLOR_NUMBERS.length];
      const piece = this.scene.add
        .rectangle(x, y, unit * GOAL_CONFETTI_WIDTH, unit * GOAL_CONFETTI_HEIGHT, color)
        .setAngle(Phaser.Math.Between(0, 360));
      container.add(piece);
      const angle =
        (index / GOAL_CONFETTI_COUNT) * Math.PI * 2 +
        Phaser.Math.FloatBetween(0, GOAL_CONFETTI_ANGLE_JITTER);
      const reach =
        windowWidth * Phaser.Math.FloatBetween(GOAL_CONFETTI_REACH.min, GOAL_CONFETTI_REACH.max);
      const burstX = x + Math.cos(angle) * reach;
      const burstMs = Phaser.Math.Between(GOAL_CONFETTI_BURST_MS.min, GOAL_CONFETTI_BURST_MS.max);
      const fallMs = Phaser.Math.Between(GOAL_CONFETTI_FALL_MS.min, GOAL_CONFETTI_FALL_MS.max);
      const spin = Phaser.Math.Between(GOAL_CONFETTI_SPIN.min, GOAL_CONFETTI_SPIN.max);
      this.scene.tweens.add({
        targets: piece,
        x: burstX,
        y: y + Math.sin(angle) * reach,
        angle: piece.angle + spin / 2,
        duration: burstMs,
        ease: 'Cubic.easeOut',
      });
      const drift = windowWidth * GOAL_CONFETTI_DRIFT;
      this.scene.tweens.add({
        targets: piece,
        x: burstX + Phaser.Math.FloatBetween(-drift, drift),
        y: fallTo,
        angle: piece.angle + spin,
        delay: burstMs,
        duration: fallMs,
        ease: 'Sine.easeIn',
        onComplete: () => piece.destroy(),
      });
    }
  }
}

/** Karta posunutá o `offset` herních jednotek do strany: stín, okraj, maska i obsah spolu. */
function placeCard(drawing: MapDrawing, offset: number): void {
  const { card, container } = drawing;
  const x = card.left + offset;
  container.setPosition(x, card.top);
  card.frame.setPosition(x, card.top);
  card.maskShape.setPosition(x, card.top);
}

/** Jak vysoko (v průměrech značky) značka po zastavení zrovna poskočila. */
function arrivalHop(elapsed: number): number {
  const sinceArrival = elapsed - MARKER_ARRIVAL_MS;
  if (sinceArrival <= 0 || sinceArrival >= ARRIVAL_HOP_MS) {
    return 0;
  }
  return Math.sin((Math.PI * sinceArrival) / ARRIVAL_HOP_MS) * ARRIVAL_HOP_SHARE;
}

/**
 * Obrys pásu šířky `2 × halfWidth` podél lomené čáry `points`: body po
 * jedné straně tam a po druhé zpátky, jako jeden mnohoúhelník bez
 * překrývajících se dílků. Kolmice v bodě je průměr směrů sousedních dílků.
 */
function bandPolygon(points: readonly MapPoint[], halfWidth: number): Phaser.Math.Vector2[] {
  const left: Phaser.Math.Vector2[] = [];
  const right: Phaser.Math.Vector2[] = [];
  points.forEach((point, index) => {
    const before = points[Math.max(index - 1, 0)] ?? point;
    const after = points[Math.min(index + 1, points.length - 1)] ?? point;
    const dx = after.x - before.x;
    const dy = after.y - before.y;
    const length = Math.hypot(dx, dy) || 1;
    const nx = (-dy / length) * halfWidth;
    const ny = (dx / length) * halfWidth;
    left.push(new Phaser.Math.Vector2(point.x + nx, point.y + ny));
    right.push(new Phaser.Math.Vector2(point.x - nx, point.y - ny));
  });
  return [...left, ...right.reverse()];
}

/** Body čtyřcípé jiskřičky se středem `x`, `y`. */
function starPoints(x: number, y: number, radius: number): Phaser.Math.Vector2[] {
  const inner = radius * SPARKLE_INNER_SHARE;
  return Array.from({ length: 8 }, (_, index) => {
    const angle = (index * Math.PI) / 4 - Math.PI / 2;
    const reach = index % 2 === 0 ? radius : inner;
    return new Phaser.Math.Vector2(x + Math.cos(angle) * reach, y + Math.sin(angle) * reach);
  });
}

/**
 * Zlatá záře a prstenec kolem podkladu symbolu cíle o průměru `size`
 * (v souřadnicích symbolu, zvětší se s ním). Záře sahá o `goalGlowShare`
 * průměru za podklad, jak s ní počítá rozložení (`goalCelebration`).
 */
function paintGoalGlow(glow: Phaser.GameObjects.Graphics, size: number): void {
  const radius = size / 2;
  const reach = radius * PROGRESS_MAP_SHAPE.goalGlowShare;
  for (let layer = GOAL_GLOW_LAYERS; layer >= 1; layer -= 1) {
    glow.fillStyle(EFFECT_COLORS.goalGlow, GOAL_GLOW_ALPHA);
    glow.fillCircle(0, 0, radius + (reach * layer) / GOAL_GLOW_LAYERS);
  }
  const ringWidth = size * GOAL_RING_WIDTH_SHARE;
  glow.lineStyle(ringWidth, EFFECT_COLORS.goalRing, 1);
  glow.strokeCircle(0, 0, radius + ringWidth / 2);
}

/** Obdélník v CSS px okna převedený do herních jednotek plochy `area`. */
function toGameUnits(rect: PictureRect, area: GameArea): PictureRect {
  const scale = area.scale > 0 ? area.scale : 1;
  return {
    left: (rect.left - area.offsetX) / scale,
    top: (rect.top - area.offsetY) / scale,
    width: rect.width / scale,
    height: rect.height / scale,
  };
}

/** Barva místa: prošlé plné modré, ostatní světlé; cíl se zeleným okrajem. */
function paintPlace(
  place: Phaser.GameObjects.Arc,
  layout: ProgressMapLayout,
  style: ProgressMapStyle,
  step: number,
  visited: boolean,
): void {
  const isGoal = step === MAP_STEPS;
  const fill = visited ? PROGRESS_MAP_STYLE.visitedColor : PROGRESS_MAP_STYLE.placeColor;
  const borderShare = isGoal
    ? PROGRESS_MAP_SHAPE.goalBorderShare
    : PROGRESS_MAP_SHAPE.placeBorderShare;
  place.setFillStyle(colorNumber(fill));
  place.setStrokeStyle(
    layout.placeSize * borderShare,
    colorNumber(placeBorder(style, isGoal, visited)),
  );
}

function placeBorder(style: ProgressMapStyle, isGoal: boolean, visited: boolean): string {
  if (isGoal) {
    return style.goalBorderColor;
  }
  return visited ? PROGRESS_MAP_STYLE.visitedBorderColor : style.placeBorderColor;
}
