import { describe, expect, it } from 'vitest';

import { createTonePlayer } from '../../src/shared/audio/tonePlayer';
import type { AudioContextLike, OscillatorLike } from '../../src/shared/audio/tonePlayer';

/**
 * Testy k #196 pro přehrávač tónů: přerušený kontext (iOS po přepnutí
 * aplikace) se rozběhne a odmítnutý zvuk tóny natrvalo nevypne.
 */

const TONE = [{ frequencyHz: 440, startSeconds: 0, durationSeconds: 0.1, volume: 0.3 }];

function fakeParam() {
  return {
    setValueAtTime: () => undefined,
    linearRampToValueAtTime: () => undefined,
    exponentialRampToValueAtTime: () => undefined,
  };
}

class FakeToneContext implements AudioContextLike {
  readonly destination = { connect: (node: unknown) => node };
  readonly currentTime = 1;
  state: string;
  resumeCalls = 0;
  rejectResume = false;
  oscillators = 0;

  constructor(state: string) {
    this.state = state;
  }

  resume(): Promise<void> {
    this.resumeCalls += 1;
    if (this.rejectResume) {
      return Promise.reject(new Error('NotAllowedError'));
    }
    this.state = 'running';
    return Promise.resolve();
  }

  createOscillator(): OscillatorLike {
    this.oscillators += 1;
    return {
      frequency: fakeParam(),
      onended: null,
      connect: (node) => node,
      start: () => undefined,
      stop: () => undefined,
    };
  }

  createGain() {
    return { gain: fakeParam(), connect: (node: unknown) => node };
  }
}

describe('#196: tóny v Safari na iPadu a iPhonu', () => {
  it('po návratu z jiné aplikace (kontext přerušený) ťuknutí tón zase rozběhne', () => {
    const context = new FakeToneContext('interrupted');
    createTonePlayer(() => context).play(TONE);
    expect(context.resumeCalls).toBe(1);
    expect(context.state).toBe('running');
  });

  it('když prohlížeč zvuk jednou odmítne, další ťuknutí tón zahraje', async () => {
    const context = new FakeToneContext('suspended');
    context.rejectResume = true;
    const player = createTonePlayer(() => context);

    expect(() => player.play(TONE)).not.toThrow();
    await Promise.resolve();
    await Promise.resolve();
    const tonesBefore = context.oscillators;

    context.rejectResume = false;
    player.play(TONE);

    expect(context.oscillators).toBeGreaterThan(tonesBefore);
    expect(context.state).toBe('running');
  });
});
