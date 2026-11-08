/**
 * Vzor jisker třpytek (#103): drobné čtyřcípé jiskry ✦ pevně umístěné
 * vůči obrázku. Tah třpytkami barví jen pixely jisker (`coloring.ts`),
 * ostatní pixely stopy nechá, jak byly.
 *
 * - Středy jisker leží na čtvercové mřížce s roztečí `SPACING_SHARE` W stř,
 *   která začíná v levém horním rohu obrázku a je pootočená o
 *   `LATTICE_TURN`. Díky pootočení leží jiskry v každém vodorovném pásu
 *   v různých výškách, takže i úzký vodorovný tah zabarví zhruba stejný díl
 *   stopy, ať jde kterýmkoli řádkem.
 * - Střed jiskry se posune na střed nejbližšího pixelu, aby byly cípy
 *   souměrné.
 * - Jiskra má cípy nahoru, dolů, doleva a doprava, dlouhé `TIP_SHARE` W stř
 *   od středu, a hluboké zářezy mezi nimi (astroida). Pixel patří jiskře,
 *   když v ní leží jeho střed.
 *
 * Jiskry závisí jen na rozměru obrázku (W stř je díl jeho šířky), ne na
 * tahu, velikosti čáry ani náhodě. Čistý TypeScript bez Phaseru.
 */

/** Rozteč mřížky středů jisker jako díl W stř. */
const SPACING_SHARE = 1.2;

/** Délka cípu od středu jiskry jako díl W stř (rozpětí je dvojnásobek). */
const TIP_SHARE = 0.4;

/** Pootočení mřížky v radiánech (asi 23°), aby jiskry nebyly v řadách. */
const LATTICE_TURN = 0.4;

/**
 * Mocnina tvaru jiskry: pixel je v jiskře, když
 * |dx|^p + |dy|^p ≤ cíp^p. S p = 2/3 je to astroida se čtyřmi
 * ostrými cípy a zářezy v polovině délky cípu.
 */
const SHAPE_POWER = 2 / 3;

/** Pixely jisker obrázku po řádcích: 1 u pixelu jiskry, 0 jinde. */
export function sparkleMask(width: number, height: number, midWidth: number): Uint8Array {
  const mask = new Uint8Array(width * height);
  const spacing = SPACING_SHARE * midWidth;
  const tip = TIP_SHARE * midWidth;
  const reach = Math.floor(tip);
  const shape = sparkleShape(reach, tip ** SHAPE_POWER);
  const stepX = { x: spacing * Math.cos(LATTICE_TURN), y: spacing * Math.sin(LATTICE_TURN) };
  const stepY = { x: -stepX.y, y: stepX.x };
  // Mřížka pootočená kolem rohu obrázku: stačí indexy do úhlopříčky obrázku.
  const indexReach = Math.ceil(Math.hypot(width, height) / spacing) + 1;
  for (let row = -indexReach; row <= indexReach; row += 1) {
    for (let column = -indexReach; column <= indexReach; column += 1) {
      const centerX = Math.floor(column * stepX.x + row * stepY.x);
      const centerY = Math.floor(column * stepX.y + row * stepY.y);
      if (
        centerX < -reach ||
        centerY < -reach ||
        centerX > width + reach ||
        centerY > height + reach
      ) {
        continue;
      }
      drawSparkle(mask, width, height, centerX, centerY, shape);
    }
  }
  return mask;
}

/**
 * Posuny pixelů jedné jiskry od jejího středu. Tvar je pro všechny jiskry
 * stejný, proto se spočítá jen jednou a jiskry ho jen kopírují (rychlejší
 * první tah třpytkami na pomalém tabletu).
 */
function sparkleShape(reach: number, limit: number): Array<{ dx: number; dy: number }> {
  const offsets: Array<{ dx: number; dy: number }> = [];
  for (let dy = -reach; dy <= reach; dy += 1) {
    const rest = limit - Math.abs(dy) ** SHAPE_POWER;
    for (let dx = -reach; dx <= reach; dx += 1) {
      if (Math.abs(dx) ** SHAPE_POWER <= rest) {
        offsets.push({ dx, dy });
      }
    }
  }
  return offsets;
}

/** Jiskra tvaru `shape` se středem v pixelu (`centerX`, `centerY`). */
function drawSparkle(
  mask: Uint8Array,
  width: number,
  height: number,
  centerX: number,
  centerY: number,
  shape: ReadonlyArray<{ dx: number; dy: number }>,
): void {
  for (const { dx, dy } of shape) {
    const x = centerX + dx;
    const y = centerY + dy;
    if (x >= 0 && x < width && y >= 0 && y < height) {
      mask[y * width + x] = 1;
    }
  }
}
