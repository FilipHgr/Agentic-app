/**
 * Rozmístění zástupné mapy postupu (#87 AC7, #133 AC7) v herních
 * jednotkách: start, 2 zastávky a cíl na cestě, a kde stojí značka hráče.
 * Cesta vede od místa k místu po řadě oblouky (#146), které se střídavě
 * prohýbají na opačné strany. Na šířku jde vlnovkou zleva doprava, na
 * výšku klikatě zdola nahoru, takže se nikde nekříží. Prohnutí je co
 * největší do 18 % délky úsečky, ale pruh cesty široký jako značka nesmí
 * vyčnívat, zasahovat do vzdálených míst ani do cíle (nejméně 6 %).
 * Každá mapa má vlnovku jinak natočenou (začíná dole, nebo nahoře).
 * Mapa leží pod rohem kolečka a domečku a mimo výřez a lištu. Za cílem
 * (na šířku vpravo, na výšku nad ním) stojí symbol tématu (#134 AC2).
 * Místa a značka se měří i s okrajem a poskočením po dojití, aby se ani
 * nakreslené nepřekrývaly a nevyčnívaly (kontrola #133). Vedle slavícího
 * cíle je místo pro klíč (#139), které nepřekryje cíl, místa ani značku.
 * Čistý TypeScript bez Phaseru; vzhled kreslí scéna a dá se vyměnit bez
 * změny tohoto rozložení i logiky mapy.
 */

import type { GameArea } from '../../../shared/logic/viewportLayout';
import { MAP_GOAL_CELEBRATION_SCALE } from './mapAnimation';
import { MAP_STEPS, MAP_THEMES } from './progressMap';
import type { MapThemeId } from './progressMap';
import { pathLinePieces, pathLinePoints, pathPointAt, pathSamples } from './progressMapPath';
import type { MapPathShape } from './progressMapPath';
import { PROGRESS_MAP_SHAPE } from './theme';

export { pathLinePoints, pathPointAt };

export interface MapPoint {
  readonly x: number;
  readonly y: number;
}

/** Čtverec se středem `x`, `y` a stranou `size`. */
export interface MapSquare extends MapPoint {
  readonly size: number;
}

/** Obdélník se středem `x`, `y`, šířkou `width` a výškou `height`. */
export interface MapRect extends MapPoint {
  readonly width: number;
  readonly height: number;
}

export interface ProgressMapLayout extends MapPathShape {
  /** Střed místa podle kroku: 0 start, 1 a 2 zastávky, `MAP_STEPS` cíl. */
  readonly places: readonly MapPoint[];
  /**
   * Prohnutí oblouku úseku z místa `i` na místo `i + 1` (#146 AC1): díl
   * délky úsečky se znaménkem strany, sousední úseky mají opačná znaménka.
   */
  readonly pathBends: readonly number[];
  /** Průměr místa na mapě. */
  readonly placeSize: number;
  /** Průměr značky hráče. */
  readonly markerSize: number;
  /** Symbol tématu u cíle (#134 AC2) na světlém kruhovém podkladu, `size` je průměr podkladu. */
  readonly goalSymbol: MapSquare;
  /**
   * Kam se vejde celý slavící cíl (#135 AC3): podklad zvětšený 1,3× i se
   * zlatou září a prstencem, se středem ve středu symbolu cíle.
   */
  readonly goalCelebration: MapSquare;
  /**
   * Kam se u cíle vejde klíč (#139 AC2): vodorovný štítek s půlkou klíče,
   * nebo s oběma půlkami, které se k sobě přiblíží. Vedle slavícího cíle,
   * nepřekrývá ho, místa na cestě, značku v cíli ani okraj mapy.
   */
  readonly goalKey: MapRect;
}

/** Kolikrát se zastávka, cíl a značka po dojití značky krátce zvětší. */
export const MAP_ARRIVAL_PULSE_SCALE = 1.15;

/** Šířka čáry cesty jako díl průměru značky. */
export const MAP_PATH_WIDTH_SHARE = 0.18;

/** Kolikrát je nakreslená značka větší než její průměr: bílý okraj a poskočení. */
export const DRAWN_MARKER_SCALE =
  (1 + PROGRESS_MAP_SHAPE.markerBorderShare) * MAP_ARRIVAL_PULSE_SCALE;

/** Pás nahoře pro kolečko a domeček v CSS px (roh 88 px, iPad 12 + 76 px a stavový řádek). */
const CORNER_BAND_CSS = 100;

/** Odstup mapy od okrajů viditelné plochy v CSS px. */
const EDGE_MARGIN_CSS = 16;

/** Štítek klíče: výška jako díl průměru značky, poměr šířky k výšce a nejmenší výška v CSS px. */
const GOAL_KEY_HEIGHT_TO_MARKER = 0.62;
const GOAL_KEY_ASPECT = 2.4;
const GOAL_KEY_MIN_HEIGHT_CSS = 36;

/** Mezera mezi štítkem klíče a slavícím cílem nebo místem na cestě v CSS px. */
const GOAL_KEY_GAP_CSS = 8;

/** Mezera mezi štítkem klíče a pruhem cesty širokým jako značka v CSS px (#146 AC2). */
const GOAL_KEY_BAND_GAP_CSS = 1;

/** O kolik se štítek klíče zmenší, když se nikam nevejde. */
const GOAL_KEY_SHRINK = 0.92;

/** Rozestup mřížky v CSS px, ve které se hledá místo pro štítek, když se nevejde vedle cíle. */
const GOAL_KEY_SEARCH_STEP_CSS = 6;

/** Jak daleko od slavícího cíle v CSS px štítek klíče ještě stojí „u cíle“. */
const GOAL_KEY_NEAR_CSS = 40;

/** Jak málo rozhoduje vzdálenost od značky proti vzdálenosti od cíle (jen při shodě). */
const GOAL_KEY_MARKER_TIEBREAK = 0.001;

/** Na výšku leží místa střídavě v levém a pravém sloupci. */
const PORTRAIT_COLUMNS = 2;

/** Největší značka v CSS px, aby mapa se 4 místy nevypadala přerostle. */
const MAX_MARKER_CSS = 150;

/** Značka zabere nejvýš tento díl místa mezi zastávkami, aby nezakryla sousední. */
const MARKER_SHARE = 0.75;

/** Místo je menší než značka, aby značka stojící na něm byla dobře vidět. */
const PLACE_TO_MARKER = 0.7;

/**
 * Plocha, ve které se mapa rozloží: herní plocha (mapa přes celou
 * obrazovku), nebo karta nad ztmavenou hrou (#145, `insideCard`). Karta
 * leží mimo roh kolečka a domečku, proto se v ní pás pro ně nevyhrazuje.
 */
export interface MapArea extends GameArea {
  readonly insideCard?: boolean;
}

/** Plocha mapy v herních jednotkách: levý horní roh, šířka a výška. */
export interface ContentBox {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Plocha pro mapu: bez pásu kolečka a domečku, výřezu, lišty a s odstupem
 * od okraje. V kartě (#145) jen s odstupem od jejího okraje. Drží se jí
 * i pohyby prostředí (#136).
 */
export function mapContentBox(area: MapArea): ContentBox {
  const covered = area.coveredEdges ?? { top: 0, right: 0, bottom: 0, left: 0 };
  const margin = EDGE_MARGIN_CSS / area.scale;
  const topBand = area.insideCard === true ? EDGE_MARGIN_CSS : CORNER_BAND_CSS;
  const left = covered.left + margin;
  const top = covered.top + topBand / area.scale;
  const right = area.width - covered.right - margin;
  const bottom = area.height - covered.bottom - margin;
  return { left, top, width: right - left, height: bottom - top };
}

/** Začíná cesta této mapy vlnou dolů (na výšku vlevo)? Mapy se střídají. */
function startsLow(theme: MapThemeId): boolean {
  return MAP_THEMES.indexOf(theme) % 2 === 0;
}

/** Míst na cestě (start, zastávky, cíl) a za nimi jedno místo pro symbol cíle. */
const PLACE_COUNT = MAP_STEPS + 1;
const SLOT_COUNT = PLACE_COUNT + 1;

/**
 * Střed symbolu cíle měřený v rozestupech míst od začátku řady (na výšku
 * v řadách odspodu): stojí v posledním, pátém místě za cílem, tedy
 * o půl rozestupu dál než poslední hrana míst.
 */
const GOAL_SYMBOL_SLOT = PLACE_COUNT + 0.5;

/**
 * Na šířku: všechna místa v jedné řadě zleva doprava, střídavě výš a níž,
 * symbol cíle vpravo vedle cíle ve stejné výšce.
 */
function wavyRow(
  content: ContentBox,
  maxMarker: number,
  theme: MapThemeId,
  scale: number,
): ProgressMapLayout {
  const spacing = rowSpacing(content, maxMarker);
  const markerSize = rowMarkerSize(content, maxMarker, spacing);
  const amplitude = Math.min(
    (content.height - markerSize * DRAWN_MARKER_SCALE) / 2,
    markerSize * 0.8,
  );
  const middle = content.top + content.height / 2;
  const firstLow = startsLow(theme);
  const places = Array.from({ length: PLACE_COUNT }, (_, index) => {
    const low = index % 2 === 0 ? firstLow : !firstLow;
    return {
      x: content.left + spacing * (index + 0.5),
      y: middle + (low ? amplitude : -amplitude),
    };
  });
  const goal = lastPlace(places);
  return withGoal(content, places, markerSize, { x: goal.x + spacing, y: goal.y }, scale);
}

function rowMarkerSize(content: ContentBox, maxMarker: number, spacing: number): number {
  return Math.min(spacing * MARKER_SHARE, content.height / 2 / DRAWN_MARKER_SCALE, maxMarker);
}

/**
 * Rozestup míst v řadě. Symbol cíle stojí o rozestup za cílem; když by se
 * slavící cíl (#135) za ním nevešel, řada se zhustí, aby se symbol nemusel
 * posunout až k cíli.
 */
function rowSpacing(content: ContentBox, maxMarker: number): number {
  const even = content.width / SLOT_COUNT;
  const half = goalCelebrationSize(goalBadgeSize(rowMarkerSize(content, maxMarker, even))) / 2;
  if (GOAL_SYMBOL_SLOT * even + half <= content.width) {
    return even;
  }
  return (content.width - half) / GOAL_SYMBOL_SLOT;
}

/** Na výšku: místa zdola nahoru, střídavě vlevo a vpravo, symbol cíle nad cílem. */
function zigzagUp(
  content: ContentBox,
  maxMarker: number,
  theme: MapThemeId,
  scale: number,
): ProgressMapLayout {
  const cellWidth = content.width / PORTRAIT_COLUMNS;
  const cellHeight = columnCellHeight(content, maxMarker);
  const markerSize = columnMarkerSize(cellWidth, cellHeight, maxMarker);
  const firstColumn = startsLow(theme) ? 0 : 1;
  const places = Array.from({ length: PLACE_COUNT }, (_, index) => {
    const column = index % 2 === 0 ? firstColumn : 1 - firstColumn;
    return {
      x: content.left + cellWidth * (column + 0.5),
      // Řady se počítají odspodu: start dole, cíl nahoře.
      y: content.top + content.height - cellHeight * (index + 0.5),
    };
  });
  const goal = lastPlace(places);
  return withGoal(content, places, markerSize, { x: goal.x, y: goal.y - cellHeight }, scale);
}

/**
 * Rozložení se symbolem cíle na místě `wanted`. Symbol se posune dovnitř
 * tak, aby se slavící cíl i se září vešel celý do plochy mapy (#135 AC3).
 */
function withGoal(
  content: ContentBox,
  places: readonly MapPoint[],
  markerSize: number,
  wanted: MapPoint,
  scale: number,
): ProgressMapLayout {
  const size = goalBadgeSize(markerSize);
  const celebrationSize = goalCelebrationSize(size);
  const half = celebrationSize / 2;
  const center = {
    x: clampInto(wanted.x, content.left + half, content.left + content.width - half),
    y: clampInto(wanted.y, content.top + half, content.top + content.height - half),
  };
  const placeSize = markerSize * PLACE_TO_MARKER;
  const goalCelebration = { ...center, size: celebrationSize };
  const goalSymbol = { ...center, size };
  const bendOptions = pathBendOptions({
    content,
    places,
    placeSize,
    markerSize,
    goalSymbol,
    goalCelebration,
  });
  const keySpaceFor = (pathBends: readonly number[]): GoalKeySpace => ({
    content,
    goal: goalCelebration,
    goalPlace: lastPlace(places),
    obstacles: [
      squareRect(goalCelebration),
      ...places.map((place, step) =>
        squareRect({ ...place, size: drawnPlaceSize(step, placeSize, markerSize) }),
      ),
      // Klíč nepřekryje ani podložku místa (#147 AC3), ta je větší než místo.
      ...places.map((place) =>
        squareRect({ ...place, size: placeSize * PROGRESS_MAP_SHAPE.placePadMaxShare }),
      ),
    ],
    // Štítek drží odstup od čáry cesty po oblouku a nezasáhne do pruhu
    // širokého jako značka (#146 AC2).
    path: pathLinePieces({ places, pathBends }),
    pathClearance: Math.max(
      (markerSize * MAP_PATH_WIDTH_SHARE) / 2 + GOAL_KEY_GAP_CSS / scale,
      (markerSize * DRAWN_MARKER_SCALE) / 2 + GOAL_KEY_BAND_GAP_CSS / scale,
    ),
    gap: GOAL_KEY_GAP_CSS / scale,
    searchStep: GOAL_KEY_SEARCH_STEP_CSS / scale,
    nearGap: GOAL_KEY_NEAR_CSS / scale,
  });
  const { pathBends, goalKey } = placePathAndKey(
    bendOptions,
    keySpaceFor,
    markerSize * GOAL_KEY_HEIGHT_TO_MARKER,
    GOAL_KEY_MIN_HEIGHT_CSS / scale,
  );
  return {
    places,
    pathBends,
    placeSize,
    markerSize,
    goalSymbol,
    goalCelebration,
    goalKey,
  };
}

/**
 * Prohnutí cesty a štítek klíče spolu (#146 AC2, #139 AC2): první
 * prohnutí z `bendOptions` (od největšího), u kterého se štítek vejde
 * k cíli; když u žádného, první, u kterého se vejde kamkoli na mapu.
 * Klíč se tak smí posunout a cesta se kvůli němu méně prohne.
 */
function placePathAndKey(
  bendOptions: readonly (readonly number[])[],
  keySpaceFor: (pathBends: readonly number[]) => GoalKeySpace,
  maxHeight: number,
  minHeight: number,
): { pathBends: readonly number[]; goalKey: MapRect } {
  const spaces = bendOptions.map((pathBends) => ({ pathBends, space: keySpaceFor(pathBends) }));
  for (const nearOnly of [true, false]) {
    for (const { pathBends, space } of spaces) {
      const goalRect = squareRect(space.goal);
      const allowed = (rect: MapRect): boolean =>
        !nearOnly || rectDistance(rect, goalRect) <= space.nearGap;
      const goalKey = largestFitting(space, maxHeight, minHeight, allowed);
      if (goalKey !== undefined) {
        return { pathBends, goalKey };
      }
    }
  }
  const [first] = spaces;
  const pathBends = first?.pathBends ?? alternatingBends(smallestBend(), 1);
  return { pathBends, goalKey: placeGoalKey(keySpaceFor(pathBends), maxHeight, minHeight) };
}

/** Prohnutí oblouků, které se zkoušejí od největšího (#146 AC1: 12–25 %, v těsném okně od 6 %). */
const PATH_BEND_TRIES = [0.18, 0.16, 0.14, 0.12, 0.1, 0.08, 0.06];

/** Po kolika dílech délky úseku se pruh cesty kontroluje. */
const PATH_BAND_SAMPLES = 200;

/** Co pruh cesty po oblouku nesmí překrýt (#146 AC2). */
interface PathBendSpace {
  readonly content: ContentBox;
  readonly places: readonly MapPoint[];
  readonly placeSize: number;
  readonly markerSize: number;
  readonly goalSymbol: MapSquare;
  readonly goalCelebration: MapSquare;
}

/** Střídavá prohnutí úseků `bend`, první úsek na stranu `firstSide`. */
function alternatingBends(bend: number, firstSide: number): number[] {
  return Array.from({ length: MAP_STEPS }, (_, segment) =>
    segment % 2 === 0 ? bend * firstSide : -bend * firstSide,
  );
}

/**
 * Prohnutí oblouků cesty (#146 AC1, AC2), od největšího z `PATH_BEND_TRIES`
 * a v obou střídáních stran: jen ta, při kterých pruh široký jako značka
 * zůstane v ploše mapy a nezasáhne do vzdálených míst ani do cíle. Když
 * se nevejde ani nejmenší, cesta má nejmenší prohnutí.
 */
function pathBendOptions(space: PathBendSpace): number[][] {
  const options = PATH_BEND_TRIES.flatMap((bend) =>
    [1, -1].map((firstSide) => alternatingBends(bend, firstSide)),
  ).filter((bends) => isPathBandFree(space, bends));
  return options.length > 0 ? options : [alternatingBends(smallestBend(), 1)];
}

function smallestBend(): number {
  return PATH_BEND_TRIES[PATH_BEND_TRIES.length - 1] ?? 0;
}

/**
 * Vejde se v ploše `area` pruh cesty rozložení `layout` s prohnutím
 * `bends` bez překryvů (stejná kontrola, podle které se prohnutí vybírá)?
 * Pro testy upřesnění #146: kde je místo, prohnutí neklesne pod 12 %.
 */
export function pathBandFits(
  area: MapArea,
  layout: ProgressMapLayout,
  bends: readonly number[],
): boolean {
  return isPathBandFree(
    {
      content: mapContentBox(area),
      places: layout.places,
      placeSize: layout.placeSize,
      markerSize: layout.markerSize,
      goalSymbol: layout.goalSymbol,
      goalCelebration: layout.goalCelebration,
    },
    bends,
  );
}

/** Vejde se pruh cesty s prohnutím `bends` do plochy mapy bez překryvů? */
function isPathBandFree(space: PathBendSpace, bends: readonly number[]): boolean {
  const { content, places, placeSize, markerSize, goalSymbol, goalCelebration } = space;
  const shape = { places, pathBends: bends };
  const radius = (markerSize * DRAWN_MARKER_SCALE) / 2;
  const goal = lastPlace(places);
  for (let segment = 0; segment < MAP_STEPS; segment += 1) {
    const others = places
      .map((place, step) => ({ place, step }))
      .filter(({ step }) => step !== segment && step !== segment + 1);
    for (const point of pathSamples(shape, segment, PATH_BAND_SAMPLES)) {
      const inside =
        point.x - radius >= content.left &&
        point.x + radius <= content.left + content.width &&
        point.y - radius >= content.top &&
        point.y + radius <= content.top + content.height;
      if (!inside) {
        return false;
      }
      const hitsPlace = others.some(
        ({ place, step }) =>
          Math.hypot(point.x - place.x, point.y - place.y) <
          radius + drawnPlaceSize(step, placeSize, markerSize) / 2,
      );
      if (hitsPlace) {
        return false;
      }
      // Konec pruhu pod značkou v cíli smí slavící cíl překrýt jako značka (#135 AC3).
      const underGoalMarker =
        segment === MAP_STEPS - 1 && Math.hypot(point.x - goal.x, point.y - goal.y) <= radius;
      const hitsGoal = [goalSymbol, goalCelebration].some(
        (circle) => Math.hypot(point.x - circle.x, point.y - circle.y) < radius + circle.size / 2,
      );
      if (hitsGoal && !underGoalMarker) {
        return false;
      }
    }
  }
  return true;
}

/** Kolik zabere nakreslené místo: cíl i se značkou, která v něm stojí, ostatní s okrajem. */
function drawnPlaceSize(step: number, placeSize: number, markerSize: number): number {
  return step === MAP_STEPS
    ? markerSize * DRAWN_MARKER_SCALE
    : placeSize * (1 + PROGRESS_MAP_SHAPE.goalBorderShare) * MAP_ARRIVAL_PULSE_SCALE;
}

function squareRect(square: MapSquare): MapRect {
  return { x: square.x, y: square.y, width: square.size, height: square.size };
}

/** Překrývají se obdélníky, i s mezerou `gap` kolem? */
function rectsOverlap(first: MapRect, second: MapRect, gap: number): boolean {
  return (
    Math.abs(first.x - second.x) < (first.width + second.width) / 2 + gap &&
    Math.abs(first.y - second.y) < (first.height + second.height) / 2 + gap
  );
}

function isRectInside(rect: MapRect, content: ContentBox): boolean {
  return (
    rect.x - rect.width / 2 >= content.left &&
    rect.x + rect.width / 2 <= content.left + content.width &&
    rect.y - rect.height / 2 >= content.top &&
    rect.y + rect.height / 2 <= content.top + content.height
  );
}

/** Kde smí stát štítek klíče: plocha mapy, slavící cíl, čemu se vyhnout a mezera. */
interface GoalKeySpace {
  readonly content: ContentBox;
  readonly goal: MapSquare;
  /** Cíl na cestě, kde stojí značka. */
  readonly goalPlace: MapPoint;
  /** Slavící cíl a všechna nakreslená místa na cestě. */
  readonly obstacles: readonly MapRect[];
  /** Úseky cesty mezi místy; štítek od nich drží `pathClearance`. */
  readonly path: readonly (readonly [MapPoint, MapPoint])[];
  /** Nejmenší vzdálenost štítku od osy cesty: půl čáry a mezera. */
  readonly pathClearance: number;
  readonly gap: number;
  /** Rozestup mřížky, ve které se hledá místo pro štítek. */
  readonly searchStep: number;
  /** Jak daleko od slavícího cíle je štítek ještě „u cíle“. */
  readonly nearGap: number;
}

/**
 * Kam se dá štítek klíče výšky `height` postavit: těsně pod, nad, vlevo
 * a vpravo od slavícího cíle a navíc v mřížce po `GOAL_KEY_SEARCH_STEP_CSS`
 * přes celou plochu mapy (na malých oknech se vedle cíle nevejde).
 */
function goalKeyCandidates(space: GoalKeySpace, height: number): MapRect[] {
  const { content, goal, gap } = space;
  const width = height * GOAL_KEY_ASPECT;
  const reachX = goal.size / 2 + gap + width / 2;
  const reachY = goal.size / 2 + gap + height / 2;
  const minX = content.left + width / 2;
  const maxX = content.left + content.width - width / 2;
  const minY = content.top + height / 2;
  const maxY = content.top + content.height - height / 2;
  const alongX = clampInto(goal.x, minX, maxX);
  const alongY = clampInto(goal.y, minY, maxY);
  const candidates: MapRect[] = [
    { x: alongX, y: goal.y + reachY, width, height },
    { x: alongX, y: goal.y - reachY, width, height },
    { x: goal.x - reachX, y: alongY, width, height },
    { x: goal.x + reachX, y: alongY, width, height },
  ];
  for (let y = minY; y <= maxY; y += space.searchStep) {
    for (let x = minX; x <= maxX; x += space.searchStep) {
      candidates.push({ x, y, width, height });
    }
  }
  return candidates;
}

/**
 * Místo pro štítek klíče u slavícího cíle (#139 AC2): nejdřív jen místa
 * u cíle (nejvýš `nearGap` od slavícího cíle), co největší, ale nejvýš
 * `maxHeight`, a z nich to nejblíž cíli (při shodě dál od značky v cíli).
 * Teprve když se u cíle nevejde ani nejmenší (`minHeight`), hledá se
 * kdekoli na mapě; když ani tam, stojí pod cílem.
 */
function placeGoalKey(space: GoalKeySpace, maxHeight: number, minHeight: number): MapRect {
  const goalRect = squareRect(space.goal);
  const isNearGoal = (rect: MapRect): boolean => rectDistance(rect, goalRect) <= space.nearGap;
  return (
    largestFitting(space, maxHeight, minHeight, isNearGoal) ??
    largestFitting(space, maxHeight, minHeight, () => true) ??
    goalKeyCandidates(space, minHeight)[0] ?? {
      ...space.goalPlace,
      width: minHeight * GOAL_KEY_ASPECT,
      height: minHeight,
    }
  );
}

/** Největší štítek od `maxHeight` do `minHeight`, který se vejde a splní `allowed`. */
function largestFitting(
  space: GoalKeySpace,
  maxHeight: number,
  minHeight: number,
  allowed: (rect: MapRect) => boolean,
): MapRect | undefined {
  for (
    let height = Math.max(maxHeight, minHeight);
    height >= minHeight;
    height *= GOAL_KEY_SHRINK
  ) {
    const fitting = goalKeyCandidates(space, height).filter(
      (rect) =>
        allowed(rect) &&
        isRectInside(rect, space.content) &&
        space.obstacles.every((other) => !rectsOverlap(rect, other, space.gap)) &&
        isClearOfPath(rect, space),
    );
    const nearest = nearestToGoal(fitting, space);
    if (nearest !== undefined) {
      return nearest;
    }
  }
  return undefined;
}

/**
 * Drží štítek odstup `pathClearance` od všech dílků cesty? Dílky daleko
 * od štítku se vyřadí levným porovnáním obdélníků, přesně se měří jen
 * blízké (cesta po oblouku má mnoho dílků, #146).
 */
function isClearOfPath(rect: MapRect, space: GoalKeySpace): boolean {
  const reachX = rect.width / 2 + space.pathClearance;
  const reachY = rect.height / 2 + space.pathClearance;
  return space.path.every(([from, to]) => {
    const far =
      Math.min(from.x, to.x) > rect.x + reachX ||
      Math.max(from.x, to.x) < rect.x - reachX ||
      Math.min(from.y, to.y) > rect.y + reachY ||
      Math.max(from.y, to.y) < rect.y - reachY;
    return far || segmentRectDistance(from, to, rect) >= space.pathClearance;
  });
}

/** Vzdálenost bodu od obdélníku (0 uvnitř). */
function pointRectDistance(point: MapPoint, rect: MapRect): number {
  const dx = Math.max(Math.abs(point.x - rect.x) - rect.width / 2, 0);
  const dy = Math.max(Math.abs(point.y - rect.y) - rect.height / 2, 0);
  return Math.hypot(dx, dy);
}

/** Vzdálenost bodu od úsečky `from`–`to`. */
function pointSegmentDistance(point: MapPoint, from: MapPoint, to: MapPoint): number {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const lengthSquared = dx * dx + dy * dy;
  const share =
    lengthSquared === 0
      ? 0
      : clampInto(((point.x - from.x) * dx + (point.y - from.y) * dy) / lengthSquared, 0, 1);
  return Math.hypot(point.x - (from.x + dx * share), point.y - (from.y + dy * share));
}

/**
 * Vzdálenost úsečky od obdélníku. Úsečka, která obdélníkem prochází, má
 * vzdálenost 0; jinak je nejbližší bod buď konec úsečky, nebo roh obdélníku.
 */
function segmentRectDistance(from: MapPoint, to: MapPoint, rect: MapRect): number {
  const halfWidth = rect.width / 2;
  const halfHeight = rect.height / 2;
  const corners: MapPoint[] = [
    { x: rect.x - halfWidth, y: rect.y - halfHeight },
    { x: rect.x + halfWidth, y: rect.y - halfHeight },
    { x: rect.x + halfWidth, y: rect.y + halfHeight },
    { x: rect.x - halfWidth, y: rect.y + halfHeight },
  ];
  const crossesEdge = corners.some((corner, index) =>
    segmentsCross(from, to, corner, corners[(index + 1) % corners.length] ?? corner),
  );
  if (crossesEdge || pointRectDistance(from, rect) === 0) {
    return 0;
  }
  return Math.min(
    pointRectDistance(from, rect),
    pointRectDistance(to, rect),
    ...corners.map((corner) => pointSegmentDistance(corner, from, to)),
  );
}

/** Kříží se úsečky `a1`–`a2` a `b1`–`b2`? */
function segmentsCross(a1: MapPoint, a2: MapPoint, b1: MapPoint, b2: MapPoint): boolean {
  const side = (p: MapPoint, q: MapPoint, r: MapPoint): number =>
    (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  const d1 = side(b1, b2, a1);
  const d2 = side(b1, b2, a2);
  const d3 = side(a1, a2, b1);
  const d4 = side(a1, a2, b2);
  return d1 * d2 < 0 && d3 * d4 < 0;
}

/** Vzdálenost mezi okraji obdélníků (0, když se dotýkají nebo překrývají). */
function rectDistance(first: MapRect, second: MapRect): number {
  const dx = Math.abs(first.x - second.x) - (first.width + second.width) / 2;
  const dy = Math.abs(first.y - second.y) - (first.height + second.height) / 2;
  return Math.max(dx, dy, 0);
}

/** Štítek nejblíž slavícímu cíli, při shodě nejdál od značky v cíli; `undefined`, když žádný není. */
function nearestToGoal(rects: readonly MapRect[], space: GoalKeySpace): MapRect | undefined {
  let best: MapRect | undefined;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const rect of rects) {
    const toGoal = Math.hypot(rect.x - space.goal.x, rect.y - space.goal.y);
    const toMarker = Math.hypot(rect.x - space.goalPlace.x, rect.y - space.goalPlace.y);
    // Vzdálenost od značky rozhoduje jen při (skoro) stejné vzdálenosti od cíle.
    const score = toGoal - toMarker * GOAL_KEY_MARKER_TIEBREAK;
    if (score < bestScore) {
      best = rect;
      bestScore = score;
    }
  }
  return best;
}

function columnMarkerSize(cellWidth: number, cellHeight: number, maxMarker: number): number {
  return Math.min(cellWidth * MARKER_SHARE, cellHeight * MARKER_SHARE, maxMarker);
}

/**
 * Výška řady na výšku. Symbol cíle stojí o řadu nad cílem; když by se
 * slavící cíl (#135) nad ním nevešel, řady se zhustí.
 */
function columnCellHeight(content: ContentBox, maxMarker: number): number {
  const cellWidth = content.width / PORTRAIT_COLUMNS;
  const even = content.height / SLOT_COUNT;
  const marker = columnMarkerSize(cellWidth, even, maxMarker);
  const half = goalCelebrationSize(goalBadgeSize(marker)) / 2;
  if (GOAL_SYMBOL_SLOT * even + half <= content.height) {
    return even;
  }
  return (content.height - half) / GOAL_SYMBOL_SLOT;
}

/** Průměr slavícího cíle i se září. */
function goalCelebrationSize(badgeSize: number): number {
  return badgeSize * MAP_GOAL_CELEBRATION_SCALE * (1 + PROGRESS_MAP_SHAPE.goalGlowShare);
}

/** `value` posunutá do rozmezí `min` až `max`; když se rozmezí nevejde, jeho střed. */
function clampInto(value: number, min: number, max: number): number {
  if (min > max) {
    return (min + max) / 2;
  }
  return Math.min(Math.max(value, min), max);
}

/** Průměr světlého podkladu symbolu cíle i s okrajem; symbol leží uvnitř. */
function goalBadgeSize(markerSize: number): number {
  return markerSize * PROGRESS_MAP_SHAPE.goalBadgeToMarker;
}

function lastPlace(places: readonly MapPoint[]): MapPoint {
  return places[places.length - 1] ?? { x: 0, y: 0 };
}

/** Vede cesta zleva doprava (plocha na šířku), nebo zdola nahoru? */
function isRowArea(area: MapArea): boolean {
  return area.width > area.height;
}

/** Rozložení mapy `theme`; orientace cesty se řídí tvarem plochy (herní plochy, nebo karty). */
export function layoutProgressMap(area: MapArea, theme: MapThemeId): ProgressMapLayout {
  const content = mapContentBox(area);
  const maxMarker = MAX_MARKER_CSS / area.scale;
  return isRowArea(area)
    ? wavyRow(content, maxMarker, theme, area.scale)
    : zigzagUp(content, maxMarker, theme, area.scale);
}

/**
 * Průměr značky v ploše `area` v herních jednotkách, stejný jako
 * v `layoutProgressMap` (na tématu nezávisí), ale bez hledání místa pro
 * klíč. Podle něj se vybírá velikost karty (#145 AC2).
 */
export function progressMapMarkerSize(area: MapArea): number {
  const content = mapContentBox(area);
  const maxMarker = MAX_MARKER_CSS / area.scale;
  if (isRowArea(area)) {
    return rowMarkerSize(content, maxMarker, rowSpacing(content, maxMarker));
  }
  const cellWidth = content.width / PORTRAIT_COLUMNS;
  return columnMarkerSize(cellWidth, columnCellHeight(content, maxMarker), maxMarker);
}

/** Kde stojí značka na kroku `step` (mimo mapu se bere nejbližší konec). */
export function markerAt(layout: ProgressMapLayout, step: number): MapPoint {
  const last = layout.places.length - 1;
  const index = Math.min(Math.max(Math.round(step), 0), last);
  return layout.places[index] ?? { x: 0, y: 0 };
}
