/* global console */
/**
 * Vyrobí vzory číslic pro rozpoznávání psaní prstem (#41) z trénovací části
 * sady UCI Pen-Based Digits (data/pendigits/pendigits.tra, 30 pisatelů).
 * Testovací část (pendigits.tes) se tu záměrně nepoužívá.
 *
 * Spuštění: node tools/recognition/make_templates.mjs
 * Výstup: src/games/counting/logic/digitTemplates.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';

const SOURCE = 'data/pendigits/pendigits.tra';
const TARGET = 'src/games/counting/logic/digitTemplates.ts';
/** Kolik vzorů od každé číslice. Víc = přesnější, ale větší soubor ve hře. */
const TEMPLATES_PER_DIGIT = 200;

/** Hodnota 0–100 jako dva šestnáctkové znaky. */
function toHex(value) {
  return value.toString(16).padStart(2, '0');
}

/** Řádek sady: 16 souřadnic 0–100 a číslice 0–9. */
function isValidLine(values) {
  const coordinates = values.slice(0, 16);
  const digit = values[16];
  return (
    values.length === 17 &&
    coordinates.every((value) => Number.isInteger(value) && value >= 0 && value <= 100) &&
    Number.isInteger(digit) &&
    digit >= 0 &&
    digit <= 9
  );
}

// --- Vlastní vzory devítky s otevřeným kolečkem (#143) --------------------
//
// V sadě UCI skoro chybí devítky, jejichž kolečko nahoře není dotažené do
// konce. Proto se k nim přidají vlastní vzory vypočtené tady, bez náhody.
// Hodnoty (mezery, začátky oblouku, poměry, sklony) jsou záměrně jiné než
// v testech k #143 (tests/games/counting/openNineShapes.ts), aby testy
// měřily rozpoznání, ne zapamatování sady.

/** Mezera kolečka ve stupních, vpravo u začátku oblouku. */
const OPEN_NINE_GAPS = [15, 45, 75, 105, 135, 150];
/** Kde oblouk začíná (stupně, 0 = vpravo, proti směru hodinových ručiček). */
const OPEN_NINE_ARC_STARTS = [0, 10, 35, 50];
/** Výška kolečka jako část jeho šířky. */
const OPEN_NINE_LOOP_RATIOS = [0.2, 0.3, 0.45, 0.7, 0.9];
/** Šířka kolečka jako část výšky celé devítky. */
const OPEN_NINE_LOOP_WIDTHS = [0.33, 0.45, 0.6, 0.8];
/** Sklon nohy ve stupních, kladný dole doleva. */
const OPEN_NINE_LEG_TILTS = [-4, 6, 14];
/** Odkud jde noha: z konce oblouku, nebo z bodu kolečka vpravo dole (300°). */
const OPEN_NINE_LEG_STARTS = ['arcEnd', 'lowerRight'];
/** Úhel bodu kolečka, odkud jde noha při `lowerRight`. */
const LOWER_RIGHT_DEGREES = 300;
/** Krok oblouku ve stupních a body nohy, jen aby převzorkování mělo z čeho brát. */
const OPEN_NINE_ARC_STEP = 3;
const OPEN_NINE_LEG_POINTS = 12;
/** Bodů vzoru, stejně jako v sadě UCI. */
const TEMPLATE_POINTS = 8;

function radians(degrees) {
  return (degrees * Math.PI) / 180;
}

/** Bod kolečka na úhlu `degrees`; osa y míří dolů jako na obrazovce. */
function loopPoint(loop, degrees) {
  return {
    x: loop.centerX + loop.radiusX * Math.cos(radians(degrees)),
    y: loop.centerY - loop.radiusY * Math.sin(radians(degrees)),
  };
}

function straightLine(from, to, count) {
  return Array.from({ length: count }, (_, index) => {
    const t = index / (count - 1);
    return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
  });
}

/** Rozmístí `count` bodů rovnoměrně po délce lomené čáry (jako hra u zápisu). */
function resampleByLength(points, count) {
  const lengths = [0];
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const point = points[index];
    lengths.push(lengths[index - 1] + Math.hypot(point.x - previous.x, point.y - previous.y));
  }
  const total = lengths[lengths.length - 1];
  const result = [];
  let segment = 1;
  for (let step = 0; step < count; step += 1) {
    const target = (total * step) / (count - 1);
    while (segment < points.length - 1 && lengths[segment] < target) {
      segment += 1;
    }
    const start = points[segment - 1];
    const end = points[segment];
    const length = lengths[segment] - lengths[segment - 1];
    const t = length > 0 ? Math.min(Math.max((target - lengths[segment - 1]) / length, 0), 1) : 0;
    result.push({ x: start.x + (end.x - start.x) * t, y: start.y + (end.y - start.y) * t });
  }
  return result;
}

/** Body na souřadnice vzoru: každá osa zvlášť 0–100, osa y nahoru (jako UCI). */
function toTemplateValues(points) {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const left = Math.min(...xs);
  const top = Math.min(...ys);
  const width = Math.max(...xs) - left;
  const height = Math.max(...ys) - top;
  return points.flatMap((point) => [
    Math.round(((point.x - left) / width) * 100),
    Math.round(100 - ((point.y - top) / height) * 100),
  ]);
}

/** Jedna devítka s otevřeným kolečkem jako lomená čára (výška devítky 1). */
function openNinePoints(gap, arcStart, loopRatio, loopWidth, legTilt, legStart) {
  const radiusX = loopWidth / 2;
  const loop = {
    centerX: 0.5,
    centerY: radiusX * loopRatio,
    radiusX,
    radiusY: radiusX * loopRatio,
  };
  const arcEnd = arcStart + 360 - gap;
  const arc = [];
  for (let angle = arcStart; angle <= arcEnd; angle += OPEN_NINE_ARC_STEP) {
    arc.push(loopPoint(loop, angle));
  }
  const end = arc[arc.length - 1];
  const legTop = legStart === 'arcEnd' ? end : loopPoint(loop, LOWER_RIGHT_DEGREES);
  const legBottom = { x: legTop.x - (1 - legTop.y) * Math.tan(radians(legTilt)), y: 1 };
  const join = legStart === 'arcEnd' ? [] : [legTop];
  return [...arc, ...join, ...straightLine(legTop, legBottom, OPEN_NINE_LEG_POINTS).slice(1)];
}

/**
 * Vlastní vzor otevřené devítky musí být od každého vzoru jiné číslice
 * dál než tohle (součet čtverců rozdílů souřadnic, jako v rozpoznávání).
 */
const MIN_DISTANCE_FROM_OTHER_DIGITS = 2500;

/** Vlastní vzory blíž k sobě než tohle by jen zpomalily rozpoznávání, nechá se první. */
const MIN_DISTANCE_BETWEEN_OPEN_NINES = 300;

/** Vzor převzorkovaný po délce v souřadnicích vzoru, stejně jako ho vidí rozpoznávání. */
function evenlySpacedValues(values) {
  const points = [];
  for (let index = 0; index < values.length; index += 2) {
    points.push({ x: values[index], y: values[index + 1] });
  }
  return resampleByLength(points, TEMPLATE_POINTS).flatMap((point) => [point.x, point.y]);
}

function squaredDistance(a, b) {
  return a.reduce((sum, value, index) => sum + (value - b[index]) ** 2, 0);
}

function isNearAny(values, others, minDistance) {
  return others.some((other) => squaredDistance(values, other) < minDistance);
}

/** Všechny vlastní vzory otevřené devítky ve formátu vzorů UCI. */
function openNineTemplates() {
  const result = [];
  for (const gap of OPEN_NINE_GAPS) {
    for (const arcStart of OPEN_NINE_ARC_STARTS) {
      for (const loopRatio of OPEN_NINE_LOOP_RATIOS) {
        for (const loopWidth of OPEN_NINE_LOOP_WIDTHS) {
          for (const legTilt of OPEN_NINE_LEG_TILTS) {
            for (const legStart of OPEN_NINE_LEG_STARTS) {
              const points = openNinePoints(gap, arcStart, loopRatio, loopWidth, legTilt, legStart);
              result.push(toTemplateValues(resampleByLength(points, TEMPLATE_POINTS)));
            }
          }
        }
      }
    }
  }
  return result;
}

const templates = Array.from({ length: 10 }, () => []);
/** Všechny zápisy jiných číslic než 9 z trénovací části (i nad počet vzorů). */
const otherDigitSamples = [];
for (const line of readFileSync(SOURCE, 'utf8').split('\n')) {
  if (line.trim() === '') {
    continue;
  }
  const values = line.split(',').map((part) => Number(part.trim()));
  if (!isValidLine(values)) {
    console.warn(`Přeskakuji poškozený řádek: ${line}`);
    continue;
  }
  const digit = values[16];
  if (templates[digit].length < TEMPLATES_PER_DIGIT) {
    templates[digit].push(values.slice(0, 16).map(toHex).join(''));
  }
  if (digit !== 9) {
    otherDigitSamples.push(evenlySpacedValues(values.slice(0, 16)));
  }
}

// Vlastní vzor, který leží skoro na vzoru jiné číslice z UCI, se vynechá:
// skutečně napsaná jednička nebo sedmička by pak vypadala jako devítka.
const keptOpenNines = [];
for (const values of openNineTemplates()) {
  const spaced = evenlySpacedValues(values);
  if (isNearAny(spaced, otherDigitSamples, MIN_DISTANCE_FROM_OTHER_DIGITS)) {
    continue;
  }
  if (isNearAny(spaced, keptOpenNines.map(evenlySpacedValues), MIN_DISTANCE_BETWEEN_OPEN_NINES)) {
    continue;
  }
  keptOpenNines.push(values);
}
const openNines = keptOpenNines.map((values) => values.map(toHex).join(''));

const body = templates
  .map((list) => `  [\n${list.map((item) => `    '${item}',`).join('\n')}\n  ],`)
  .join('\n');

const output = `/**
 * Vzory číslic pro rozpoznávání psaní prstem. SOUBOR JE GENEROVANÝ, neupravuj ho
 * ručně: node tools/recognition/make_templates.mjs
 *
 * Upraveno z: E. Alpaydin, F. Alimoglu, Pen-Based Recognition of Handwritten
 * Digits, UCI Machine Learning Repository, https://doi.org/10.24432/C5MG6K,
 * licence CC BY 4.0. Použita jen trénovací část (30 pisatelů), prvních
 * ${TEMPLATES_PER_DIGIT} vzorů od každé číslice. Atribuce pro nasazenou hru je
 * v public/licence.txt.
 *
 * Index pole je číslice. Každý vzor je 8 bodů (x, y) po délce tahu, souřadnice
 * 0–100 (osa y nahoru), každé číslo jako dva šestnáctkové znaky.
 */
export const DIGIT_TEMPLATES: readonly (readonly string[])[] = [
${body}
];

/**
 * Vlastní vzory devítky s otevřeným kolečkem nahoře (#143), vypočtené
 * v make_templates.mjs, ne z UCI. Stejný formát jako \`DIGIT_TEMPLATES\`.
 */
export const OPEN_NINE_TEMPLATES: readonly string[] = [
${openNines.map((item) => `  '${item}',`).join('\n')}
];
`;

writeFileSync(TARGET, output);
console.log(
  `${TARGET}: ${templates.map((list) => list.length).join(', ')}, otevřené devítky ${openNines.length}`,
);
