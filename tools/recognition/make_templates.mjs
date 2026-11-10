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

const templates = Array.from({ length: 10 }, () => []);
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
}

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
`;

writeFileSync(TARGET, output);
console.log(`${TARGET}: ${templates.map((list) => list.length).join(', ')}`);
