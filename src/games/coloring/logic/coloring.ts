/**
 * Malování prstem nebo tužkou do omalovánky (#88). Oblast tahu se určí při
 * jeho začátku a každé razítko štětce zapíše jen pixely této oblasti, takže
 * barva nikdy nepřeteče přes obrys (AC2). Mezi body tahu se razítka kladou
 * po kroku nejvýš W/4, čára je tak souvislá a dosáhne až k obrysu (AC3).
 *
 * Guma (#90) je stejný tah se stopou širokou 1,5 W, který pixely své oblasti
 * vrací do prázdna; obrys je v mapě oblastí, takže vygumovat nejde.
 *
 * Šířka W je díl šířky plochy podle velikosti čáry (#91): malá, střední
 * nebo velká. Velikost se volí pro celý tah při jeho začátku.
 *
 * Fix (#93) klade čtvercová razítka o straně 0,6 W se stranami podél os,
 * pastelka kulatá razítka 0,5 W, která barví jen mimo mezery zrna
 * (`crayonGrain.ts`). Ořez do oblasti a krok razítek jsou u všech nástrojů
 * stejné.
 *
 * Duhový štětec (#97) má stopu štětce (kulatá, 1,0 W), ale nekreslí se
 * razítky: každý úsek dráhy zabarví pixely do vzdálenosti W/2 barvou
 * duhy podle délky dráhy prstu v nejbližším bodě úseku. Pixel, na který
 * dosáhne víc míst dráhy, dostane barvu nejbližšího z nich (při stejné
 * vzdálenosti pozdějšího). Délka se měří od dotyku po celé dráze prstu,
 * i mimo oblast tahu, a každá barva zabere 2 W stř při každé velikosti.
 * Barva tak závisí jen na dráze, ne na rychlosti ani počtu bodů.
 *
 * Razítkový fix (#98) neklade souvislá razítka, ale plné pěticípé
 * hvězdičky barvy tahu se špičkou nahoru, vepsané do kruhu průměru 1,5 W.
 * První je v místě dotyku, další vždy po 2 W dráhy prstu. Dráha se měří
 * od dotyku po celé cestě prstu, i přes obrys a cizí oblast, takže ani
 * velmi rychlý tah žádnou nevynechá a pomalý je nepřekryje. Tah začatý
 * na obrysu klade hvězdičky, až prst vjede do oblasti. Pixel patří
 * hvězdičce, když v ní leží jeho střed.
 *
 * Puntíkový fix (#101) má stopu štětce (kulatá razítka 1,0 W), ale barví
 * jen pixely pravidelné čtvercové mřížky kulatých puntíků, mezery nechá,
 * jak byly. Puntík má průměr 1/3 W stř a středy jsou po 1/2 W stř, první
 * v levém horním rohu obrázku. Mřížka je pevná vůči obrázku a nezávisí na
 * velikosti ani na tahu, takže puntíky různých tahů leží na stejných
 * místech a opakovaný tah mezery nezaplní. Pixel je puntík, když jeho
 * střed leží v kruhu puntíku.
 *
 * Proužkový fix (#102) má také stopu štětce, ale barví jen pixely šikmých
 * proužků 45° ve směru „/“, mezery nechá, jak byly. Proužek i mezera jsou
 * kolmo na proužek široké 1/3 W stř, první proužek začíná v levém horním
 * rohu obrázku. Proužky jsou pevné vůči obrázku a nezávisí na velikosti
 * ani na tahu, takže proužky různých tahů na sebe navazují a opakovaný tah
 * mezery nezaplní. Pixel je proužek, když v proužku leží jeho střed.
 *
 * Třpytky (#103) mají kulatou stopu širokou 1,5 W, ale barví jen pixely
 * drobných čtyřcípých jisker ze vzoru pevného vůči obrázku
 * (`glitterSparkles.ts`), ostatní pixely nechají, jak byly. Jiskry nezávisí
 * na velikosti, tahu ani náhodě; lesk během tahu je jen animace scény
 * (`glitterShine.ts`) a do obrázku se nezapíše.
 *
 * Maluje jen první prst: další dotyky (druhý prst, dlaň, tužka) během tahu
 * nic nenamalují a po zvednutí prvního prstu tah skončí (AC5). Každé místo
 * má jen jednu barvu z palety, bez míchání a průhlednosti.
 *
 * Souřadnice jsou v pixelech vrstvy barev, která má rozměry mapy oblastí.
 * Čistý TypeScript bez Phaseru.
 */

import { isGrainGap } from './crayonGrain';
import { sparkleMask } from './glitterSparkles';
import { RAINBOW_COLORS } from './palette';
import { OUTLINE_REGION, regionAt } from './regionMap';
import type { RegionMap } from './regionMap';
import { createStrokeJournal } from './strokeHistory';
import type { StrokeChange } from './strokeHistory';
import type { LineSize, ToolId } from './toolPanel';

/** W jako díl šířky plochy podle velikosti čáry (#91 AC2); střední je W z #88. */
const BRUSH_WIDTH_SHARE: Readonly<Record<LineSize, number>> = {
  small: 1 / 50,
  medium: 1 / 30,
  large: 1 / 15,
};

/** Razítka po kroku nejvýš čtvrtiny šířky stopy, jinak by na okraji stopy zůstaly zuby. */
const STAMPS_PER_STROKE_WIDTH = 4;

/** Stopa gumy je o polovinu širší než stopa štětce (#90 AC2). */
const ERASER_WIDTH_FACTOR = 1.5;

/** Fix je široký 0,6 W (#93 AC2). */
const MARKER_WIDTH_FACTOR = 0.6;

/** Pastelka je široká 0,5 W (#93 AC2). */
const CRAYON_WIDTH_FACTOR = 0.5;

/** Každá barva duhy zabere úsek dráhy dlouhý 2 W stř (#97 AC2). */
const RAINBOW_BAND_WIDTHS = 2;

/** Hvězdička razítkového fixu je vepsaná do kruhu průměru 1,5 W (#98 AC2). */
const STAR_DIAMETER_FACTOR = 1.5;

/** Středy hvězdiček jsou od sebe 2 W po dráze prstu (#98 AC2). */
const STAR_SPACING_FACTOR = 2;

/** Počet cípů hvězdičky. */
const STAR_TIPS = 5;

/** Vnitřní poloměr hvězdičky (zářezy mezi cípy) jako díl vnějšího. */
const STAR_INNER_SHARE = 0.45;

/**
 * Střed hvězdičky se zaokrouhlí na 1/1024 px, aby drobná nepřesnost
 * součtu dráhy (rychlý a pomalý tah) nezměnila pixely (#98 AC3).
 */
const STAR_CENTER_GRID = 1024;

/** Rezerva při porovnání délky dráhy, aby hvězdička přesně na konci tahu nechyběla. */
const STAR_LENGTH_TOLERANCE = 1e-6;

/** Puntík puntíkového fixu má průměr 1/3 W stř (#101, otevřená otázka 1). */
const DOT_DIAMETER_SHARE = 1 / 3;

/** Středy puntíků puntíkového fixu jsou po 1/2 W stř (#101, otevřená otázka 1). */
const DOT_SPACING_SHARE = 1 / 2;

/** Proužek i mezera proužkového fixu jsou kolmo široké 1/3 W stř (#102, otevřená otázka 2). */
const STRIPE_WIDTH_SHARE = 1 / 3;

/** Stopa třpytek je široká 1,5 W (#103 AC2). */
const GLITTER_WIDTH_FACTOR = 1.5;

/** Krok v pixelech, po kterém se hledá oblast, do které prst vjel z obrysu. */
const REGION_SEARCH_STEP = 1;

/** Pixel vrstvy barev bez barvy (prázdné místo i obrys). */
export const NO_COLOR = 255;

export type PointerKind = 'touch' | 'pen' | 'mouse';

/** Jeden údaj o dotyku: číslo prstu a poloha v pixelech vrstvy barev. */
export interface PointerSample {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  /** Prst, tužka nebo myš; všechny barví stejně. */
  readonly kind?: PointerKind;
}

/** Obdélník pixelů, které se změnily (pravý a spodní okraj už do něj nepatří). */
export interface ChangedArea {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

export interface Coloring {
  /** Šířka stopy štětce W v pixelech, se kterou tah maluje, když nedostane jinou. */
  readonly brushWidth: number;
  /**
   * Prst se dotkl. Štětec, fix a pastelka malují barvou `colorIndex`, guma
   * vrací pixely do prázdna, duha maluje barvami duhy a `colorIndex`
   * nepoužije. Celý tah má šířku W `width` (#91), nástroje z ní mají svou
   * stopu. Vrátí, co se změnilo, nebo `null`.
   */
  pointerDown(
    pointer: PointerSample,
    colorIndex: number,
    tool?: ToolId,
    width?: number,
  ): ChangedArea | null;
  /** Prst se posunul. Vrátí, co se zabarvilo, nebo `null`. */
  pointerMove(pointer: PointerSample): ChangedArea | null;
  /** Prst se zvedl. */
  pointerUp(pointerId: number): void;
  /** Systém tah přerušil: namalované zůstane, nic se nedokreslí. */
  interrupt(): void;
  /** Index barvy palety v pixelu; `null` u prázdného pixelu, obrysu a mimo plochu. */
  colorAt(x: number, y: number): number | null;
  /**
   * Vrstva barev po řádcích (index barvy, `NO_COLOR` bez barvy) pro uložení
   * obrázku (#92). Jen ke čtení, malování ji dál mění.
   */
  colorLayer(): Uint8Array;
  /**
   * Co se od minula opravdu změnilo (obdélník a barvy před tím) pro Zpět
   * (#89), nebo `null`, když nic. Volá se po skončení tahu.
   */
  takeStrokeChange(): StrokeChange | null;
  /** Vrátí pixely v obdélníku změny na barvy před tahem (#89). */
  restore(change: StrokeChange): void;
}

interface Point {
  readonly x: number;
  readonly y: number;
}

/**
 * Co tah barví: nic (začal mimo plochu), zatím nic (začal na obrysu a čeká
 * na první oblast), nebo jednu oblast.
 */
type StrokeTarget =
  | { readonly kind: 'nothing' }
  | { readonly kind: 'waitingForRegion' }
  | { readonly kind: 'region'; readonly region: number };

/**
 * Jak tah klade barvu: souvislými razítky, duhou (#97), nebo hvězdičkami
 * po dráze (#98).
 */
type StrokeTrail = 'stamps' | 'rainbow' | 'stars';

/**
 * Které pixely razítka tah barví: všechny, jen mimo mezery zrna pastelky
 * (#93), jen puntíky mřížky puntíkového fixu (#101), jen šikmé
 * proužky proužkového fixu (#102), nebo jen jiskry třpytek (#103).
 */
type StrokePattern = 'solid' | 'grain' | 'dots' | 'stripes' | 'glitter';

/**
 * Čím tah barví: index barvy (u gumy `NO_COLOR`, u duhy se nepoužije),
 * poloměr razítka (u čtverce polovina strany, u hvězdičky poloměr kruhu),
 * tvar razítka, které pixely razítka barví a jak klade barvu.
 */
interface StrokeInk {
  readonly colorIndex: number;
  readonly radius: number;
  readonly shape: 'round' | 'square' | 'star';
  readonly pattern: StrokePattern;
  readonly trail: StrokeTrail;
}

interface Stroke {
  readonly pointerId: number;
  readonly ink: StrokeInk;
  target: StrokeTarget;
  /** Poslední bod tahu s platnými souřadnicemi. */
  last: Point | null;
  /** Délka dráhy prstu od dotyku do bodu `last` v pixelech (pro duhu a hvězdičky). */
  travelled: number;
  /** Rozestup hvězdiček razítkového fixu po dráze: 2 W tahu (#98). */
  readonly starSpacing: number;
  /** Délka dráhy, na které leží další hvězdička razítkového fixu (#98). */
  nextStar: number;
}

/** Šířka stopy štětce W velikosti `size` pro plochu široké `pictureWidth` pixelů. */
export function brushWidthFor(pictureWidth: number, size: LineSize = 'medium'): number {
  return pictureWidth * BRUSH_WIDTH_SHARE[size];
}

/** Střed hvězdičky zaokrouhlený na `STAR_CENTER_GRID`, aby stejný tah dal stejné pixely. */
function starCenter(x: number, y: number): Point {
  return {
    x: Math.round(x * STAR_CENTER_GRID) / STAR_CENTER_GRID,
    y: Math.round(y * STAR_CENTER_GRID) / STAR_CENTER_GRID,
  };
}

/**
 * Leží bod (`dx`, `dy`) od středu hvězdičky s poloměrem kruhu `radius`
 * v ní? Hvězdička má 5 cípů, první míří nahoru (y roste dolů), zářezy
 * leží na `STAR_INNER_SHARE` poloměru. Bod se otočí do výseče jednoho
 * cípu a porovná s hranou mezi špičkou a zářezem.
 */
function isInStar(dx: number, dy: number, radius: number): boolean {
  const distance = Math.hypot(dx, dy);
  if (distance > radius) {
    return false;
  }
  const sector = (2 * Math.PI) / STAR_TIPS;
  // Úhel od cípu nahoru, po směru hodinových ručiček, v rozmezí 0 až sector.
  const fromTop = Math.atan2(dx, -dy);
  const inSector = ((fromTop % sector) + sector) % sector;
  // Souměrně podle osy cípu: 0 je špička, sector/2 zářez.
  const angle = Math.min(inSector, sector - inSector);
  const pointX = distance * Math.cos(angle);
  const pointY = distance * Math.sin(angle);
  const inner = radius * STAR_INNER_SHARE;
  const notchX = inner * Math.cos(sector / 2);
  const notchY = inner * Math.sin(sector / 2);
  // Bod je uvnitř, když leží na straně středu od hrany špička (radius, 0) – zářez.
  const cross = (notchX - radius) * pointY - notchY * (pointX - radius);
  return cross >= 0;
}

/** Leží bod (`dx`, `dy`) od středu razítka `ink` v jeho tvaru? */
function isInShape(dx: number, dy: number, ink: StrokeInk): boolean {
  switch (ink.shape) {
    case 'square':
      return Math.abs(dx) <= ink.radius && Math.abs(dy) <= ink.radius;
    case 'star':
      return isInStar(dx, dy, ink.radius);
    case 'round':
      return Math.hypot(dx, dy) <= ink.radius;
  }
}

function isUsablePoint(pointer: PointerSample): boolean {
  return Number.isFinite(pointer.x) && Number.isFinite(pointer.y);
}

/** Co bude tah barvit podle místa, kde začal. */
function targetAt(regions: RegionMap, point: Point): StrokeTarget {
  const region = regionAt(regions, point.x, point.y);
  if (region === null) {
    return { kind: 'nothing' };
  }
  if (region === OUTLINE_REGION) {
    return { kind: 'waitingForRegion' };
  }
  return { kind: 'region', region };
}

/** První oblast na úsečce `from`–`to` (prst vjel z obrysu do oblasti), nebo `null`. */
function firstRegionOnSegment(regions: RegionMap, from: Point, to: Point): number | null {
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  const steps = Math.max(1, Math.ceil(length / REGION_SEARCH_STEP));
  for (let step = 0; step <= steps; step += 1) {
    const share = step / steps;
    const region = regionAt(
      regions,
      from.x + (to.x - from.x) * share,
      from.y + (to.y - from.y) * share,
    );
    if (region !== null && region !== OUTLINE_REGION) {
      return region;
    }
  }
  return null;
}

/** Sjednocení dvou změněných obdélníků. */
export function joinAreas(
  first: ChangedArea | null,
  second: ChangedArea | null,
): ChangedArea | null {
  if (first === null) {
    return second;
  }
  if (second === null) {
    return first;
  }
  return {
    left: Math.min(first.left, second.left),
    top: Math.min(first.top, second.top),
    right: Math.max(first.right, second.right),
    bottom: Math.max(first.bottom, second.bottom),
  };
}

/** Prázdná vrstva barev pro mapu oblastí `regions`. */
export function emptyColorLayer(regions: RegionMap): Uint8Array {
  return new Uint8Array(regions.width * regions.height).fill(NO_COLOR);
}

/**
 * Malování nad mapou oblastí. `colors` je rozmalovaný obrázek, ve kterém
 * se pokračuje (#92); musí mít rozměr mapy, jinak se začne s prázdným.
 */
export function createColoring(
  regions: RegionMap,
  options: { brushWidth?: number; colors?: Uint8Array } = {},
): Coloring {
  const brushWidth = options.brushWidth ?? brushWidthFor(regions.width);
  const colors =
    options.colors?.length === regions.width * regions.height
      ? options.colors.slice()
      : emptyColorLayer(regions);
  const journal = createStrokeJournal(regions.width, regions.height);
  let stroke: Stroke | null = null;
  /** Délka úseku jedné barvy duhy: 2 W stř podle šířky plochy, ne podle velikosti (#97 AC5). */
  const rainbowBand = RAINBOW_BAND_WIDTHS * brushWidthFor(regions.width, 'medium');
  /**
   * Vzdálenost každého pixelu od nejbližšího místa dráhy, které ho v tomto
   * tahu duhou zabarvilo (`Infinity`, když žádné). Založí se až při prvním
   * tahu duhou a před každým dalším se vymaže.
   */
  let rainbowNearest: Float32Array | null = null;
  /** Mřížka puntíků puntíkového fixu podle W stř, pevná vůči obrázku (#101). */
  const dotSpacing = DOT_SPACING_SHARE * brushWidthFor(regions.width, 'medium');
  const dotRadius = (DOT_DIAMETER_SHARE * brushWidthFor(regions.width, 'medium')) / 2;

  /** Leží střed pixelu (x, y) v puntíku mřížky? Středy puntíků jsou v násobcích rozestupu. */
  const isDotPixel = (x: number, y: number): boolean => {
    const centerX = x + 0.5;
    const centerY = y + 0.5;
    const dx = centerX - Math.round(centerX / dotSpacing) * dotSpacing;
    const dy = centerY - Math.round(centerY / dotSpacing) * dotSpacing;
    return dx * dx + dy * dy <= dotRadius * dotRadius;
  };

  /** Šířka proužku (i mezery) proužkového fixu kolmo na proužek, pevná vůči obrázku (#102). */
  const stripeWidth = STRIPE_WIDTH_SHARE * brushWidthFor(regions.width, 'medium');

  /**
   * Leží střed pixelu (x, y) v proužku? Proužky „/“ leží podél přímek
   * x + y = konst., vzdálenost kolmo na ně je (x + y) / √2. Proužky
   * a mezery se po `stripeWidth` střídají, první od rohu je proužek.
   */
  const isStripePixel = (x: number, y: number): boolean => {
    const across = (x + 0.5 + (y + 0.5)) / Math.SQRT2;
    return Math.floor(across / stripeWidth) % 2 === 0;
  };

  /**
   * Pixely jisker třpytek podle W stř, pevné vůči obrázku (#103). Spočítají
   * se až při prvním tahu třpytkami, jiné nástroje je nepotřebují.
   */
  let sparkles: Uint8Array | null = null;
  const isSparklePixel = (x: number, y: number): boolean => {
    sparkles ??= sparkleMask(regions.width, regions.height, brushWidthFor(regions.width, 'medium'));
    return sparkles[y * regions.width + x] === 1;
  };

  /** Stopa nástroje `tool` při šířce W `width`: šířka, tvar razítka a vzor (#90, #93, #101–#103). */
  const inkOf = (tool: ToolId, colorIndex: number, width: number): StrokeInk => {
    const brushRadius = width / 2;
    switch (tool) {
      case 'eraser':
        return {
          colorIndex: NO_COLOR,
          radius: brushRadius * ERASER_WIDTH_FACTOR,
          shape: 'round',
          pattern: 'solid',
          trail: 'stamps',
        };
      case 'marker':
        return {
          colorIndex,
          radius: brushRadius * MARKER_WIDTH_FACTOR,
          shape: 'square',
          pattern: 'solid',
          trail: 'stamps',
        };
      case 'crayon':
        return {
          colorIndex,
          radius: brushRadius * CRAYON_WIDTH_FACTOR,
          shape: 'round',
          pattern: 'grain',
          trail: 'stamps',
        };
      case 'brush':
        return {
          colorIndex,
          radius: brushRadius,
          shape: 'round',
          pattern: 'solid',
          trail: 'stamps',
        };
      case 'rainbow':
        return {
          colorIndex,
          radius: brushRadius,
          shape: 'round',
          pattern: 'solid',
          trail: 'rainbow',
        };
      case 'dots':
        return {
          colorIndex,
          radius: brushRadius,
          shape: 'round',
          pattern: 'dots',
          trail: 'stamps',
        };
      case 'stripes':
        return {
          colorIndex,
          radius: brushRadius,
          shape: 'round',
          pattern: 'stripes',
          trail: 'stamps',
        };
      case 'glitter':
        return {
          colorIndex,
          radius: brushRadius * GLITTER_WIDTH_FACTOR,
          shape: 'round',
          pattern: 'glitter',
          trail: 'stamps',
        };
      case 'stamp':
        return {
          colorIndex,
          radius: (width * STAR_DIAMETER_FACTOR) / 2,
          shape: 'star',
          pattern: 'solid',
          trail: 'stars',
        };
    }
  };

  /** Barví vzor `pattern` pixel (x, y)? Mezery zrna, mezi puntíky, proužky a jiskrami ne. */
  const isInPattern = (x: number, y: number, pattern: StrokePattern): boolean => {
    switch (pattern) {
      case 'solid':
        return true;
      case 'grain':
        return !isGrainGap(x, y);
      case 'dots':
        return isDotPixel(x, y);
      case 'stripes':
        return isStripePixel(x, y);
      case 'glitter':
        return isSparklePixel(x, y);
    }
  };

  /** Patří pixel (x, y) do razítka `ink` se středem `center`? */
  const isInStamp = (x: number, y: number, center: Point, ink: StrokeInk): boolean => {
    const dx = x + 0.5 - center.x;
    const dy = y + 0.5 - center.y;
    return isInShape(dx, dy, ink) && isInPattern(x, y, ink.pattern);
  };

  /** Razítko `ink` se středem `center`, jen do pixelů oblasti `region` (mezery vzoru nechá). */
  const stamp = (center: Point, region: number, ink: StrokeInk): ChangedArea | null => {
    const { colorIndex, radius } = ink;
    const left = Math.max(0, Math.floor(center.x - radius));
    const right = Math.min(regions.width - 1, Math.ceil(center.x + radius));
    const top = Math.max(0, Math.floor(center.y - radius));
    const bottom = Math.min(regions.height - 1, Math.ceil(center.y + radius));
    let paintedAny = false;
    for (let y = top; y <= bottom; y += 1) {
      for (let x = left; x <= right; x += 1) {
        const index = y * regions.width + x;
        if (regions.regionIds[index] === region && isInStamp(x, y, center, ink)) {
          const previous = colors[index] ?? NO_COLOR;
          if (previous !== colorIndex) {
            journal.note(index, previous);
            colors[index] = colorIndex;
          }
          paintedAny = true;
        }
      }
    }
    // Celý čtverec razítka stačí: textura se tak posílá po malých kouscích.
    return paintedAny ? { left, top, right: right + 1, bottom: bottom + 1 } : null;
  };

  /** Razítka po úsečce `from`–`to` po kroku nejvýš čtvrtiny šířky stopy. */
  const paintSegment = (
    from: Point,
    to: Point,
    region: number,
    ink: StrokeInk,
  ): ChangedArea | null => {
    const stampSpacing = (2 * ink.radius) / STAMPS_PER_STROKE_WIDTH;
    const length = Math.hypot(to.x - from.x, to.y - from.y);
    const steps = Math.max(1, Math.ceil(length / stampSpacing));
    let changed: ChangedArea | null = null;
    for (let step = 0; step <= steps; step += 1) {
      const share = step / steps;
      const center = { x: from.x + (to.x - from.x) * share, y: from.y + (to.y - from.y) * share };
      changed = joinAreas(changed, stamp(center, region, ink));
    }
    return changed;
  };

  /** Barva duhy (index palety) v místě dráhy, kam prst došel po `length` pixelech. */
  const rainbowColorAt = (length: number): number => {
    const band = Math.floor(length / rainbowBand) % RAINBOW_COLORS.length;
    return RAINBOW_COLORS[band] ?? NO_COLOR;
  };

  /** Nový tah duhou: žádný pixel zatím nemá nejbližší místo dráhy. */
  const startRainbow = (): void => {
    rainbowNearest ??= new Float32Array(regions.width * regions.height);
    rainbowNearest.fill(Number.POSITIVE_INFINITY);
  };

  /**
   * Úsek dráhy duhy `from`–`to`, který začíná po `startLength` pixelech
   * dráhy (#97 AC2). Pixel oblasti `region` do vzdálenosti `radius` od úseku
   * dostane barvu podle délky dráhy v nejbližším bodě úseku, když je mu
   * úsek blíž (nebo stejně blízko) než dřívější místa tahu.
   */
  const paintRainbowSegment = (
    from: Point,
    to: Point,
    startLength: number,
    region: number,
    radius: number,
  ): ChangedArea | null => {
    const nearest = rainbowNearest;
    if (nearest === null) {
      return null;
    }
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const segment = Math.hypot(dx, dy);
    const left = Math.max(0, Math.floor(Math.min(from.x, to.x) - radius));
    const right = Math.min(regions.width - 1, Math.ceil(Math.max(from.x, to.x) + radius));
    const top = Math.max(0, Math.floor(Math.min(from.y, to.y) - radius));
    const bottom = Math.min(regions.height - 1, Math.ceil(Math.max(from.y, to.y) + radius));
    let paintedAny = false;
    for (let y = top; y <= bottom; y += 1) {
      for (let x = left; x <= right; x += 1) {
        const index = y * regions.width + x;
        if (regions.regionIds[index] !== region) {
          continue;
        }
        const centerX = x + 0.5;
        const centerY = y + 0.5;
        const projected =
          segment === 0
            ? 0
            : ((centerX - from.x) * dx + (centerY - from.y) * dy) / (segment * segment);
        const share = Math.max(0, Math.min(1, projected));
        const distance = Math.hypot(
          centerX - (from.x + share * dx),
          centerY - (from.y + share * dy),
        );
        // Vzdálenost se ukládá jako float32, porovnává se proto taky zaokrouhlená.
        const rounded = Math.fround(distance);
        if (distance > radius || rounded > (nearest[index] ?? Number.POSITIVE_INFINITY)) {
          continue;
        }
        nearest[index] = rounded;
        const colorIndex = rainbowColorAt(startLength + share * segment);
        const previous = colors[index] ?? NO_COLOR;
        if (previous !== colorIndex) {
          journal.note(index, previous);
          colors[index] = colorIndex;
        }
        paintedAny = true;
      }
    }
    return paintedAny ? { left, top, right: right + 1, bottom: bottom + 1 } : null;
  };

  /**
   * Hvězdičky na úseku dráhy `from`–`to`, který začíná po `startLength`
   * pixelech dráhy (#98 AC2): každá, jejíž délka dráhy na úsek padne. Když
   * tah zatím nemá oblast (`region` je `null`), hvězdičky se jen odpočítají.
   */
  const paintStarSegment = (
    current: Stroke,
    from: Point,
    to: Point,
    startLength: number,
    region: number | null,
  ): ChangedArea | null => {
    const segment = Math.hypot(to.x - from.x, to.y - from.y);
    let changed: ChangedArea | null = null;
    while (segment > 0 && current.nextStar <= startLength + segment + STAR_LENGTH_TOLERANCE) {
      const share = (current.nextStar - startLength) / segment;
      const center = starCenter(from.x + (to.x - from.x) * share, from.y + (to.y - from.y) * share);
      if (region !== null) {
        changed = joinAreas(changed, stamp(center, region, current.ink));
      }
      current.nextStar += current.starSpacing;
    }
    return changed;
  };

  /** Úsek tahu `from`–`to` nástrojem tahu, jen do oblasti `region`. */
  const paintStrokeSegment = (
    current: Stroke,
    from: Point,
    to: Point,
    startLength: number,
    region: number,
  ): ChangedArea | null => {
    switch (current.ink.trail) {
      case 'rainbow':
        return paintRainbowSegment(from, to, startLength, region, current.ink.radius);
      case 'stars':
        return paintStarSegment(current, from, to, startLength, region);
      case 'stamps':
        return paintSegment(from, to, region, current.ink);
    }
  };

  return {
    brushWidth,

    pointerDown(pointer, colorIndex, tool = 'brush', width = brushWidth) {
      if (stroke !== null) {
        // Druhý prst nebo dlaň během tahu nic nenamaluje.
        return null;
      }
      const ink = inkOf(tool, colorIndex, width);
      if (!isUsablePoint(pointer)) {
        stroke = {
          pointerId: pointer.id,
          ink,
          target: { kind: 'nothing' },
          last: null,
          travelled: 0,
          starSpacing: 0,
          nextStar: 0,
        };
        return null;
      }
      if (ink.trail === 'rainbow') {
        startRainbow();
      }
      const point = { x: pointer.x, y: pointer.y };
      const target = targetAt(regions, point);
      // První hvězdička je v místě dotyku, další po rozestupu (#98 AC2).
      const starSpacing = width * STAR_SPACING_FACTOR;
      stroke = {
        pointerId: pointer.id,
        ink,
        target,
        last: point,
        travelled: 0,
        starSpacing,
        nextStar: starSpacing,
      };
      if (target.kind !== 'region') {
        return null;
      }
      switch (ink.trail) {
        case 'rainbow':
          return paintRainbowSegment(point, point, 0, target.region, ink.radius);
        case 'stars':
          return stamp(starCenter(point.x, point.y), target.region, ink);
        case 'stamps':
          return stamp(point, target.region, ink);
      }
    },

    pointerMove(pointer) {
      if (stroke === null || stroke.pointerId !== pointer.id || !isUsablePoint(pointer)) {
        return null;
      }
      const from = stroke.last;
      const to = { x: pointer.x, y: pointer.y };
      stroke.last = to;
      if (from === null) {
        return null;
      }
      // Délka dráhy se počítá od dotyku, i na obrysu a mimo oblast tahu (#97).
      const startLength = stroke.travelled;
      stroke.travelled += Math.hypot(to.x - from.x, to.y - from.y);
      if (stroke.target.kind === 'waitingForRegion') {
        const entered = firstRegionOnSegment(regions, from, to);
        if (entered !== null) {
          stroke.target = { kind: 'region', region: entered };
        }
      }
      if (stroke.target.kind !== 'region') {
        if (stroke.ink.trail === 'stars') {
          // Rozestup hvězdiček běží po dráze, i když tah zatím nic nebarví (#98).
          paintStarSegment(stroke, from, to, startLength, null);
        }
        return null;
      }
      return paintStrokeSegment(stroke, from, to, startLength, stroke.target.region);
    },

    pointerUp(pointerId) {
      if (stroke?.pointerId === pointerId) {
        stroke = null;
      }
    },

    interrupt() {
      stroke = null;
    },

    colorAt(x, y) {
      const region = regionAt(regions, x, y);
      if (region === null || region === OUTLINE_REGION) {
        return null;
      }
      const color = colors[Math.floor(y) * regions.width + Math.floor(x)] ?? NO_COLOR;
      return color === NO_COLOR ? null : color;
    },

    colorLayer: () => colors,

    takeStrokeChange: () => journal.finish(colors),

    restore({ area, previous }) {
      const areaWidth = area.right - area.left;
      for (let y = area.top; y < area.bottom; y += 1) {
        const start = (y - area.top) * areaWidth;
        colors.set(previous.subarray(start, start + areaWidth), y * regions.width + area.left);
      }
    },
  };
}
