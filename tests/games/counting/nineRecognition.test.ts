import { describe, expect, it } from 'vitest';

import { recognizeDigit } from '../../../src/games/counting/logic/digitRecognition';
import type { Stroke, StrokePoint } from '../../../src/games/counting/logic/digitRecognition';

/**
 * Připomínka vlastníka k #41: „vyhodnocuje mi to tu devítku jako 4“.
 * Devítku hra pozná, ať dítě začne smyčku kdekoli a píše ji po směru,
 * nebo proti směru hodinových ručiček, jedním tahem i dvěma tahy.
 * Devítky jsou generované z pevných hodnot, žádná náhoda.
 */

const AREA = { width: 320, height: 320 };

/** Smyčka zabírá zhruba horní polovinu plochy. */
const LOOP_CENTER: StrokePoint = { x: 170, y: 95 };
const LOOP_RADIUS_X = 65;
const LOOP_RADIUS_Y = 60;

/** Noha jde z pravé strany smyčky dolů. */
const LEG_END: StrokePoint = { x: 225, y: 300 };
const LEG_POINTS = 30;

/** Krok mezi body smyčky ve stupních (Phaser posílá body hustě). */
const LOOP_STEP_DEGREES = 5;

/** Začátky smyčky po 30° od 0 do 330°. Úhel 0° je pravá strana, 90° vršek. */
const START_ANGLES = Array.from({ length: 12 }, (_, index) => index * 30);

type Direction = 'po směru' | 'proti směru';
const DIRECTIONS: Direction[] = ['po směru', 'proti směru'];

/** Bod smyčky pro úhel ve stupních (osa y míří dolů, proto minus). */
function loopPoint(angleDegrees: number): StrokePoint {
  const angle = (angleDegrees * Math.PI) / 180;
  return {
    x: LOOP_CENTER.x + LOOP_RADIUS_X * Math.cos(angle),
    y: LOOP_CENTER.y - LOOP_RADIUS_Y * Math.sin(angle),
  };
}

/** Body smyčky od úhlu `from` o `sweep` stupňů (kladný = proti směru hodinových ručiček). */
function loopArc(from: number, sweep: number): StrokePoint[] {
  const steps = Math.max(1, Math.round(Math.abs(sweep) / LOOP_STEP_DEGREES));
  return Array.from({ length: steps + 1 }, (_, index) => loopPoint(from + (sweep * index) / steps));
}

/** Rovná čára z `from` do `to`, `points` bodů včetně konců. */
function line(from: StrokePoint, to: StrokePoint, points: number): StrokePoint[] {
  return Array.from({ length: points }, (_, index) => {
    const t = index / (points - 1);
    return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
  });
}

/** Proti směru hodinových ručiček úhel roste, po směru klesá. */
function directionSign(direction: Direction): number {
  return direction === 'proti směru' ? 1 : -1;
}

/**
 * Celá smyčka od začátku zpátky na začátek (360°), pak ještě dál
 * na pravou stranu (0°), odkud jde noha.
 */
function loopEndingOnRight(startAngle: number, direction: Direction): StrokePoint[] {
  const sign = directionSign(direction);
  const toRight = sign > 0 ? (360 - startAngle) % 360 : startAngle;
  return loopArc(startAngle, sign * (360 + toRight));
}

function leg(): StrokePoint[] {
  return line(loopPoint(0), LEG_END, LEG_POINTS);
}

/** Devítka jedním tahem: smyčka a bez zvednutí prstu noha dolů. */
function nineInOneStroke(startAngle: number, direction: Direction): Stroke[] {
  return [[...loopEndingOnRight(startAngle, direction), ...leg().slice(1)]];
}

/** Devítka dvěma tahy: nejdřív uzavřená smyčka, pak zvlášť noha. */
function nineInTwoStrokes(startAngle: number, direction: Direction): Stroke[] {
  const loop = loopArc(startAngle, directionSign(direction) * 360);
  return [loop, leg()];
}

/** Popisy devítek, které hra nepoznala jako 9 (s tím, co poznala). */
function unrecognizedNines(
  write: (startAngle: number, direction: Direction) => Stroke[],
): string[] {
  const failures: string[] = [];
  for (const direction of DIRECTIONS) {
    for (const startAngle of START_ANGLES) {
      const recognized = recognizeDigit(write(startAngle, direction), AREA);
      if (recognized !== 9) {
        failures.push(`začátek ${startAngle}°, ${direction}: ${String(recognized)}`);
      }
    }
  }
  return failures;
}

describe('#41 připomínka: hra pozná devítku, ať ji dítě píše jakkoli', () => {
  it('generované devítky leží v ploše, smyčka nahoře a noha dolů', () => {
    for (const startAngle of START_ANGLES) {
      for (const direction of DIRECTIONS) {
        for (const strokes of [
          nineInOneStroke(startAngle, direction),
          nineInTwoStrokes(startAngle, direction),
        ]) {
          for (const point of strokes.flat()) {
            expect(point.x).toBeGreaterThanOrEqual(0);
            expect(point.x).toBeLessThanOrEqual(AREA.width);
            expect(point.y).toBeGreaterThanOrEqual(0);
            expect(point.y).toBeLessThanOrEqual(AREA.height);
          }
        }
      }
    }
    expect(LOOP_CENTER.y + LOOP_RADIUS_Y).toBeLessThanOrEqual(AREA.height * 0.5 + 5);
    expect(LEG_END.y).toBeGreaterThan(AREA.height * 0.85);
  });

  it('devítku jedním tahem pozná, ať dítě začne smyčku kdekoli a píše ji kterýmkoli směrem', () => {
    expect(unrecognizedNines(nineInOneStroke)).toEqual([]);
  });

  it('devítku dvěma tahy (smyčka, pak noha) pozná, ať dítě začne smyčku kdekoli a píše ji kterýmkoli směrem', () => {
    expect(unrecognizedNines(nineInTwoStrokes)).toEqual([]);
  });
});
