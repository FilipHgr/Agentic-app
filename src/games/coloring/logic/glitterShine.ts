/**
 * Lesk třpytek během tahu (#103 AC3): lesklé jiskry, které odlétají od
 * prstu. Jsou jen animace pro scénu, do obrázku se nezapíšou. Po zvednutí
 * prstu nové nepřibývají a do 1 s zmizí všechny.
 *
 * Každá jiskra vznikne u prstu, odletí náhodným směrem na vzdálenost
 * 0,6 až 1,4 W (zpomaluje, jako by ji brzdil vzduch), přitom se zmenší
 * a v druhé polovině života vybledne. Jisker přibývá stále stejně rychle, takže při dlouhém tahu
 * se nehromadí. Náhoda jde jen z předaného generátoru, se stejnou řadou
 * čísel dopadne lesk stejně. Čas je v milisekundách od libovolného
 * začátku, souřadnice v pixelech vrstvy barev. Čistý TypeScript bez Phaseru.
 */

/** Jedna lesklá jiskra k vykreslení. */
export interface ShineSpark {
  /** Střed v pixelech vrstvy barev. */
  readonly x: number;
  readonly y: number;
  /** Velikost jako díl největší jiskry lesku, z (0, 1]. */
  readonly size: number;
  /** Neprůhlednost z (0, 1]. */
  readonly opacity: number;
}

export interface GlitterShine {
  /** Prst s třpytkami je během tahu v bodě `point`. */
  fingerAt(point: { readonly x: number; readonly y: number }, timeMs: number): void;
  /** Tah skončil (zvednutí, přerušení, schování stránky): nové jiskry nepřibývají. */
  fingerLifted(timeMs: number): void;
  /** Lesklé jiskry v čase `timeMs`; prázdný seznam, když není co kreslit. */
  sparksAt(timeMs: number): ShineSpark[];
}

export interface GlitterShineOptions {
  /** Náhodná čísla z [0, 1). */
  readonly random: () => number;
  /** W tahu v pixelech vrstvy barev: podle něj jiskry odletí. */
  readonly brushWidth: number;
}

/** Po kolika milisekundách tahu přibude nová jiskra (asi 30 za sekundu). */
const SPAWN_INTERVAL_MS = 33;

/** Kolik jisker přibude nejvýš naráz, když snímek přijde pozdě. */
const MAX_SPAWN_AT_ONCE = 3;

/** Jak dlouho jiskra žije: od `MIN_LIFE_MS` do `MIN_LIFE_MS + LIFE_SPREAD_MS`. */
const MIN_LIFE_MS = 450;
const LIFE_SPREAD_MS = 350;

/** Jak daleko jiskra odletí za celý život, v násobcích W. */
const MIN_FLIGHT = 0.6;
const FLIGHT_SPREAD = 0.8;

/** Jak daleko od prstu jiskra vznikne, nejvýš v násobcích W. */
const START_SPREAD = 0.3;

/** Velikost nové jiskry jako díl největší: od `MIN_SIZE` do 1. */
const MIN_SIZE = 0.55;

/** Na jaký díl se jiskra do konce života zmenší. */
const END_SIZE_SHARE = 0.4;

/** Jiskra svítí naplno a bledne až v posledním tomto dílu života. */
const FADE_SHARE = 0.5;

interface FlyingSpark {
  readonly bornMs: number;
  readonly lifeMs: number;
  readonly fromX: number;
  readonly fromY: number;
  readonly toX: number;
  readonly toY: number;
  readonly size: number;
}

/** Lesk třpytek; viz úvod souboru. */
export function createGlitterShine({ random, brushWidth }: GlitterShineOptions): GlitterShine {
  let sparks: FlyingSpark[] = [];
  /** Kdy přibude další jiskra; `null`, když prst nemaluje. */
  let nextSpawnMs: number | null = null;

  const spawn = (point: { readonly x: number; readonly y: number }, timeMs: number): void => {
    const startAngle = random() * 2 * Math.PI;
    const startDistance = random() * START_SPREAD * brushWidth;
    const fromX = point.x + Math.cos(startAngle) * startDistance;
    const fromY = point.y + Math.sin(startAngle) * startDistance;
    const flightAngle = random() * 2 * Math.PI;
    const flight = (MIN_FLIGHT + random() * FLIGHT_SPREAD) * brushWidth;
    sparks.push({
      bornMs: timeMs,
      lifeMs: MIN_LIFE_MS + random() * LIFE_SPREAD_MS,
      fromX,
      fromY,
      toX: fromX + Math.cos(flightAngle) * flight,
      toY: fromY + Math.sin(flightAngle) * flight,
      size: MIN_SIZE + random() * (1 - MIN_SIZE),
    });
  };

  const isAlive = (spark: FlyingSpark, timeMs: number): boolean =>
    timeMs >= spark.bornMs && timeMs < spark.bornMs + spark.lifeMs;

  return {
    fingerAt(point, timeMs) {
      sparks = sparks.filter((spark) => timeMs < spark.bornMs + spark.lifeMs);
      if (nextSpawnMs === null) {
        // Začátek tahu: první jiskra hned u prstu.
        spawn(point, timeMs);
        nextSpawnMs = timeMs + SPAWN_INTERVAL_MS;
        return;
      }
      let spawned = 0;
      while (nextSpawnMs <= timeMs && spawned < MAX_SPAWN_AT_ONCE) {
        spawn(point, timeMs);
        nextSpawnMs += SPAWN_INTERVAL_MS;
        spawned += 1;
      }
      // Po dlouhém snímku se nedohání: další jiskra až za obvyklou chvíli.
      nextSpawnMs = Math.max(nextSpawnMs, timeMs + SPAWN_INTERVAL_MS / 2);
    },

    fingerLifted() {
      nextSpawnMs = null;
    },

    sparksAt(timeMs) {
      return sparks
        .filter((spark) => isAlive(spark, timeMs))
        .map((spark) => {
          const progress = (timeMs - spark.bornMs) / spark.lifeMs;
          // Zpomalování: na začátku letí rychle, ke konci skoro stojí.
          const flown = 1 - (1 - progress) ** 2;
          return {
            x: spark.fromX + (spark.toX - spark.fromX) * flown,
            y: spark.fromY + (spark.toY - spark.fromY) * flown,
            size: spark.size * (1 - (1 - END_SIZE_SHARE) * progress),
            opacity: Math.min(1, (1 - progress) / FADE_SHARE),
          };
        });
    },
  };
}

/** Bod tvaru jiskry v pixelech. */
export interface SparkPoint {
  readonly x: number;
  readonly y: number;
}

/** Hvězdicový tvar jiskry: střed, počet cípů, poloměry a natočení prvního cípu. */
export interface SparkShape {
  readonly x: number;
  readonly y: number;
  readonly tips: number;
  readonly outerRadius: number;
  readonly innerRadius: number;
  /** Natočení prvního cípu v radiánech od směru nahoru po směru hodinových ručiček. */
  readonly rotation: number;
}

/** Vrcholy jiskry: střídavě vnější a vnitřní poloměr, první cíp natočený o `rotation`. */
export function starPoints(star: SparkShape): SparkPoint[] {
  const count = 2 * star.tips;
  return Array.from({ length: count }, (_, index) => {
    const angle = star.rotation + (index * Math.PI) / star.tips;
    const radius = index % 2 === 0 ? star.outerRadius : star.innerRadius;
    return { x: star.x + radius * Math.sin(angle), y: star.y - radius * Math.cos(angle) };
  });
}
