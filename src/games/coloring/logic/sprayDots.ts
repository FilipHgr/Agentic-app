/**
 * Vzor teček spreje (#104): drobné kulaté tečky pevně umístěné vůči
 * obrázku, každá s pevným prahem. Tah sprejem (`coloring.ts`) zabarví
 * pixel tečky, když hustota v jeho vzdálenosti od čáry tahu práh
 * přesáhne. Blízko čáry tak projde víc teček než u okraje pásu, opakovaný
 * tah nic nepřidá a kde se tahy překrývají, rozhoduje bližší z nich.
 *
 * - Obrázek se dělí na čtverce o straně `SPACING_SHARE` W stř od levého
 *   horního rohu, v každém je jedna tečka na pseudonáhodném místě. Tečky
 *   se smějí překrývat, aby vzor nevypadal jako mřížka.
 * - Prahy jsou rozložené po blocích `BLOCK_SIDE` × `BLOCK_SIDE` čtverců:
 *   v bloku má každá tečka jiný díl rozsahu prahů, takže při jakékoli
 *   hustotě jsou zabarvené tečky rozprostřené rovnoměrně a i malý obláček
 *   má hustotu podle zadání.
 * - Pixel pod více tečkami má nejnižší práh z nich (stačí, aby prošla
 *   jedna). Práh se nakonec převede na pořadí: díl pixelů obrázku s nižším
 *   prahem. Hustota tak přímo říká, jaký díl pixelů se zabarví.
 *
 * „Pseudonáhoda“ je jen míchání čísel čtverce, ne `Math.random`: vzor
 * závisí jen na rozměru obrázku (W stř je díl jeho šířky), ne na tahu,
 * velikosti čáry ani čase. Čistý TypeScript bez Phaseru.
 */

/** Poloměr tečky jako díl W stř (na ploše s kratší stranou 240 px průměr asi 3 CSS px, #104 AC6). */
const DOT_RADIUS_SHARE = 0.16;

/** Strana čtverce s jednou tečkou jako díl W stř; tečky pokryjí asi 80 % obrázku. */
const SPACING_SHARE = 0.24;

/** Počet čtverců v řadě bloku, ve kterém mají tečky rozprostřené prahy. */
const BLOCK_SIDE = 4;

/** Pořadí pixelu, který žádná tečka nepokrývá: nezabarví se nikdy. */
export const NEVER_SPRAYED = 0xffff;

/** Nejvyšší pořadí pixelu tečky; pořadí jsou 0 až `RANK_SCALE` − 1. */
export const RANK_SCALE = 0xffff;

/** Rozsah prahů teček před převodem na pořadí. */
const THRESHOLD_LEVELS = 0xffff;

/** Odlišné „semínko“ pro každé číslo, které se ze čtverce míchá. */
const SALT_X = 1;
const SALT_Y = 2;
const SALT_THRESHOLD = 3;
const SALT_ORDER = 4;

/**
 * Pseudonáhodné číslo 0 až 1 (bez 1) pro čtverec (`column`, `row`)
 * a semínko `salt`. Míchání bitů po vzoru hashe MurmurHash3, stejný vstup
 * dá vždy stejné číslo.
 */
function mix(column: number, row: number, salt: number): number {
  let hash = Math.imul(column, 0x27d4eb2d) ^ Math.imul(row, 0x165667b1);
  hash ^= Math.imul(salt, 0x9e3779b1);
  hash = Math.imul(hash ^ (hash >>> 15), 0x85ebca6b);
  hash = Math.imul(hash ^ (hash >>> 13), 0xc2b2ae35);
  hash ^= hash >>> 16;
  return (hash >>> 0) / 0x100000000;
}

/**
 * Pořadí čtverce v jeho bloku (0 až `BLOCK_SIDE`² − 1): každý blok má
 * vlastní zamíchání, aby se bloky neopakovaly.
 */
function orderInBlock(column: number, row: number): number {
  const blockColumn = Math.floor(column / BLOCK_SIDE);
  const blockRow = Math.floor(row / BLOCK_SIDE);
  const cells = BLOCK_SIDE * BLOCK_SIDE;
  const order = Array.from({ length: cells }, (_, index) => index);
  // Zamíchání Fisher–Yates s čísly bloku místo náhody.
  for (let index = cells - 1; index > 0; index -= 1) {
    const other = Math.floor(mix(blockColumn, blockRow, SALT_ORDER + index) * (index + 1));
    const kept = order[index] ?? 0;
    order[index] = order[other] ?? 0;
    order[other] = kept;
  }
  const inBlock = (row - blockRow * BLOCK_SIDE) * BLOCK_SIDE + (column - blockColumn * BLOCK_SIDE);
  return order[inBlock] ?? 0;
}

/** Práh tečky čtverce (`column`, `row`), 0 až `THRESHOLD_LEVELS` − 1. */
function thresholdOf(column: number, row: number): number {
  const cells = BLOCK_SIDE * BLOCK_SIDE;
  const share = (orderInBlock(column, row) + mix(column, row, SALT_THRESHOLD)) / cells;
  return Math.min(THRESHOLD_LEVELS - 1, Math.floor(share * THRESHOLD_LEVELS));
}

/**
 * Posuny pixelů jedné tečky od jejího středu. Tvar je pro všechny tečky
 * stejný, proto se spočítá jen jednou a tečky ho jen kopírují.
 */
function dotShape(radius: number): Array<{ dx: number; dy: number }> {
  const reach = Math.floor(radius);
  const offsets: Array<{ dx: number; dy: number }> = [];
  for (let dy = -reach; dy <= reach; dy += 1) {
    for (let dx = -reach; dx <= reach; dx += 1) {
      if (dx * dx + dy * dy <= radius * radius) {
        offsets.push({ dx, dy });
      }
    }
  }
  return offsets;
}

/** Nejnižší práh teček v každém pixelu obrázku (`THRESHOLD_LEVELS` bez tečky). */
function lowestThresholds(width: number, height: number, midWidth: number): Uint16Array {
  const lowest = new Uint16Array(width * height).fill(THRESHOLD_LEVELS);
  const spacing = SPACING_SHARE * midWidth;
  const shape = dotShape(DOT_RADIUS_SHARE * midWidth);
  // Čtverce o jeden přes okraj, aby i tečky u okraje měly sousedy za ním.
  const columns = Math.ceil(width / spacing) + 1;
  const rows = Math.ceil(height / spacing) + 1;
  for (let row = -1; row < rows; row += 1) {
    for (let column = -1; column < columns; column += 1) {
      // Střed tečky na středu pixelu, aby byla souměrná.
      const centerX = Math.floor((column + mix(column, row, SALT_X)) * spacing);
      const centerY = Math.floor((row + mix(column, row, SALT_Y)) * spacing);
      const threshold = thresholdOf(column, row);
      for (const { dx, dy } of shape) {
        const x = centerX + dx;
        const y = centerY + dy;
        if (x < 0 || y < 0 || x >= width || y >= height) {
          continue;
        }
        const index = y * width + x;
        if (threshold < (lowest[index] ?? THRESHOLD_LEVELS)) {
          lowest[index] = threshold;
        }
      }
    }
  }
  return lowest;
}

/**
 * Pořadí pixelů vzoru spreje po řádcích: 0 až `RANK_SCALE` − 1 jako díl
 * pixelů obrázku s nižším prahem, `NEVER_SPRAYED` mimo tečky. Pixel se
 * zabarví, když je jeho pořadí menší než hustota × `RANK_SCALE`.
 */
export function sprayRanks(width: number, height: number, midWidth: number): Uint16Array {
  const lowest = lowestThresholds(width, height, midWidth);
  const counts = new Float64Array(THRESHOLD_LEVELS + 1);
  for (const threshold of lowest) {
    counts[threshold] = (counts[threshold] ?? 0) + 1;
  }
  // Kolik pixelů má práh nižší než daný.
  const below = new Float64Array(THRESHOLD_LEVELS + 1);
  for (let threshold = 1; threshold <= THRESHOLD_LEVELS; threshold += 1) {
    below[threshold] = (below[threshold - 1] ?? 0) + (counts[threshold - 1] ?? 0);
  }
  const total = lowest.length;
  const ranks = new Uint16Array(total);
  for (let index = 0; index < total; index += 1) {
    const threshold = lowest[index] ?? THRESHOLD_LEVELS;
    ranks[index] =
      threshold === THRESHOLD_LEVELS
        ? NEVER_SPRAYED
        : Math.floor(((below[threshold] ?? 0) / total) * RANK_SCALE);
  }
  return ranks;
}
