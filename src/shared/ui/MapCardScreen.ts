import Phaser from 'phaser';

import type { KeyReward } from '../logic/keyRewards';
import type { GameHost } from '../logic/gameHost';
import type { MapLook, MapPictureId } from '../logic/mapPictureLoading';
import { createMapPictureLoading } from '../logic/mapPictureLoading';
import type { MapTapOutcome } from '../logic/mapCardFlow';
import { mapMarkerFor, upcomingMapTheme } from '../logic/progressMap';
import type { MapMarker, MapMove, MapProgress, MapThemeId } from '../logic/progressMap';
import {
  layoutProgressMapCard,
  mapCardPageBackdrop,
  mapCardPictureCover,
} from '../logic/progressMapCard';
import { DEFAULT_PROFILE_COLOR } from '../logic/profiles';
import type { GameArea, GameAreaFit } from '../logic/viewportLayout';
import type { MapStarRow } from './MapStarRow';
import { loadMapPicture, preloadGoalSymbols } from './mapPictureTextures';
import { ProgressMapView } from './ProgressMapView';
import type { MapScreen } from './ProgressMapView';
import { readViewport } from './viewport';

/** Co karta potřebuje vědět od sezení hry (sdílené `mapCardFlow.ts`). */
export interface MapCardSource {
  shownMove(): MapMove | null;
  goalKeyReward(): KeyReward | null;
  mapProgress(): MapProgress;
  tap(): MapTapOutcome;
}

export interface MapCardScreenOptions {
  /** Herní plocha, ve které hra kreslí (čte se při každém kreslení). */
  readonly gameArea: () => GameArea;
  /** Jak hra kreslí herní plochu (Počítání pevně, Znaménka přes celé okno). */
  readonly fit: GameAreaFit;
  /** Stránka kolem hry (značka profilu a okraje stránky); bez ní výchozí. */
  readonly host: () => GameHost | undefined;
  /** Sezení hry; vznikne až v `create` scény, proto se čte až při použití. */
  readonly source: () => MapCardSource;
}

/**
 * Karta s mapou postupu ve scéně hry (#145, #154), společná všem hrám
 * s hvězdičkami (#193): kreslí `ProgressMapView` podle kroku ze sezení,
 * pošle do ní plnou řadu hvězdiček (`MapStarRow`), ztmaví okraje stránky
 * a ťuknutí předá sezení. Obrázky map se stahují postupně, jen obrázek
 * mapy, kterou ukáže příští plná řada (#134), a na stránce jen jednou pro
 * všechny hry (`mapPictureTextures.ts`).
 */
export class MapCardScreen {
  private readonly view: ProgressMapView;
  private readonly pictures = createMapPictureLoading((picture) =>
    loadMapPicture(this.scene, picture),
  );

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly options: MapCardScreenOptions,
  ) {
    this.view = new ProgressMapView(
      scene,
      () => this.profileMarker(),
      () => this.onTapped(),
    );
  }

  /** Symboly cíle map a půlky klíče jsou malé, načtou se hned se scénou (#134 AC2). */
  preload(): void {
    preloadGoalSymbols(this.scene);
  }

  /** Sezení ukázalo kartu: nakreslí ji a plná řada do ní odletí (#154 AC3). */
  show(starRow: MapStarRow): void {
    const source = this.options.source();
    const move = source.shownMove();
    if (move === null) {
      return;
    }
    const look = this.pictures.mapShown(this.pictureOf(move.theme));
    this.view.show(this.screen(look), move, source.goalKeyReward());
    this.showPageBackdrop();
    starRow.flyToMap(
      () => this.view.markerPosition(),
      () => this.view.elapsedMs(),
    );
  }

  /** Karta zmizela (sama, ťuknutím nebo kvůli nastavení). */
  hide(): void {
    this.view.hide();
    this.pictures.mapHidden();
    this.options.host()?.setPageBackdrop?.(null);
  }

  /**
   * Otočení zařízení: ukázaná mapa dostane vzhled pro novou orientaci
   * (obrázek jen když je stažený, #134 AC4), jinak se připraví obrázek další mapy.
   */
  relayout(): void {
    const move = this.options.source().shownMove();
    if (move === null) {
      this.prepare();
      return;
    }
    const look = this.pictures.orientationChanged(this.pictureOf(move.theme));
    this.view.redraw(this.screen(look));
    this.showPageBackdrop();
  }

  /** Během hraní se na pozadí stáhne obrázek mapy, kterou ukáže příští plná řada. */
  prepare(): void {
    this.pictures.prepare(this.pictureOf(upcomingMapTheme(this.options.source().mapProgress())));
  }

  /**
   * Ťuknutí na kartu s mapou nebo na ztmavení (#145 AC4): po doběhnutí
   * animace ji sezení zavře, dřív se karta jen zhoupne.
   */
  private onTapped(): void {
    if (this.options.source().tap() === 'tooEarly') {
      this.view.wobble();
    }
  }

  /** Značka hráče na mapě v barvě profilu od stránky (#87); bez stránky výchozí barva. */
  private profileMarker(): MapMarker {
    const marker = this.options.host()?.profileMarker;
    return mapMarkerFor({
      nickname: marker?.letter,
      color: marker?.color ?? DEFAULT_PROFILE_COLOR,
    });
  }

  /** Obrázek mapy `theme` v orientaci karty (#145 AC2: řídí se tvarem karty). */
  private pictureOf(theme: MapThemeId): MapPictureId {
    return {
      theme,
      orientation: mapCardPictureCover(layoutProgressMapCard(readViewport(), this.options.fit))
        .orientation,
    };
  }

  /** Karta s mapou v dnešním okně (#145): poloha a velikost podle okna, výřezu a rohů. */
  private screen(look: MapLook): MapScreen {
    const viewport = readViewport();
    const card = layoutProgressMapCard(viewport, this.options.fit);
    // Ztmavení přes celé okno v CSS px, ne jen přes herní plochu.
    const window = { width: viewport.width, height: viewport.height };
    return { area: this.options.gameArea(), window, card, look };
  }

  /** Okraje okna kolem plátna jsou během karty ztmavené stejně jako hra (#145 AC2). */
  private showPageBackdrop(): void {
    this.options.host()?.setPageBackdrop?.(mapCardPageBackdrop());
  }
}
