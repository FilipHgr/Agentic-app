import { describe, expect, it } from 'vitest';

import { tapAnswer } from '../src/logic/answerRound';
import type { AnswerRound } from '../src/logic/answerRound';
import { SOUNDS, soundForOutcome, soundLengthSeconds } from '../src/logic/answerSounds';
import { createTonePlayer } from '../src/audio/tonePlayer';
import type {
  AudioContextLike,
  AudioNodeLike,
  AudioParamLike,
  GainLike,
  OscillatorLike,
} from '../src/audio/tonePlayer';

/** Kolo s pevným příkladem 3 + 4, aby testy nezávisely na náhodě. */
function roundThreePlusFour(): AnswerRound {
  return {
    problem: { first: 3, second: 4, result: 7 },
    choices: [2, 7, 9],
    rejected: [],
    solved: false,
  };
}

/** Zvuk, který hráč uslyší po ťuknutí na číslo. */
function soundAfterTap(round: AnswerRound, tappedNumber: number) {
  return soundForOutcome(tapAnswer(round, tappedNumber).outcome);
}

/** Napodobený tón, který si pamatuje, kdy začal a jestli byl zastaven. */
class FakeOscillator implements OscillatorLike {
  readonly frequency: AudioParamLike = fakeParam();
  onended: ((event: Event) => unknown) | null = null;
  startedAt: number | undefined;
  stoppedEarly = false;

  connect(destination: AudioNodeLike): AudioNodeLike {
    return destination;
  }

  start(time: number): void {
    this.startedAt = time;
  }

  stop(time?: number): void {
    if (time === undefined) {
      this.stoppedEarly = true;
    }
  }
}

function fakeParam(): AudioParamLike {
  return {
    setValueAtTime: () => undefined,
    linearRampToValueAtTime: () => undefined,
    exponentialRampToValueAtTime: () => undefined,
  };
}

/** Napodobený zvukový kontext prohlížeče. */
class FakeAudioContext implements AudioContextLike {
  readonly destination: AudioNodeLike = { connect: (node) => node };
  readonly oscillators: FakeOscillator[] = [];
  state = 'running';
  currentTime = 5;

  resume(): Promise<void> {
    this.state = 'running';
    return Promise.resolve();
  }

  createOscillator(): FakeOscillator {
    const oscillator = new FakeOscillator();
    this.oscillators.push(oscillator);
    return oscillator;
  }

  createGain(): GainLike {
    return { gain: fakeParam(), connect: (node) => node };
  }
}

describe('AC1: po správné odpovědi zazní veselý zvuk', () => {
  it('ťuknutí na správné číslo zahraje veselý zvuk', () => {
    expect(soundAfterTap(roundThreePlusFour(), 7)).toBe('correct');
  });

  it('veselý zvuk je stoupající melodie', () => {
    const frequencies = SOUNDS.correct.map((tone) => tone.frequencyHz);

    expect(frequencies.length).toBeGreaterThan(1);
    for (let index = 1; index < frequencies.length; index += 1) {
      expect(frequencies[index]).toBeGreaterThan(frequencies[index - 1] ?? Infinity);
    }
  });
});

describe('AC2: po špatné odpovědi zazní jemný zvuk, který netrestá', () => {
  it('ťuknutí na špatné číslo zahraje jemný zvuk', () => {
    expect(soundAfterTap(roundThreePlusFour(), 2)).toBe('wrong');
  });

  it('jemný zvuk je tišší a kratší než veselý', () => {
    const loudestWrong = Math.max(...SOUNDS.wrong.map((tone) => tone.volume));
    const loudestCorrect = Math.max(...SOUNDS.correct.map((tone) => tone.volume));

    expect(loudestWrong).toBeLessThan(loudestCorrect);
    expect(soundLengthSeconds(SOUNDS.wrong)).toBeLessThan(soundLengthSeconds(SOUNDS.correct));
  });

  it('jemný zvuk je jediný hluboký tón, ne bzučák', () => {
    expect(SOUNDS.wrong).toHaveLength(1);
    for (const tone of SOUNDS.wrong) {
      expect(tone.frequencyHz).toBeLessThan(Math.min(...SOUNDS.correct.map((t) => t.frequencyHz)));
    }
  });
});

describe('AC3: ťuknutí, které nic nedělá, je potichu', () => {
  it('ťuknutí na zešedlé číslo nevydá zvuk', () => {
    const afterWrong = tapAnswer(roundThreePlusFour(), 2).round;

    expect(soundAfterTap(afterWrong, 2)).toBeNull();
  });

  it('ťuknutí po správné odpovědi nevydá zvuk', () => {
    const solved = tapAnswer(roundThreePlusFour(), 7).round;

    expect(soundAfterTap(solved, 7)).toBeNull();
    expect(soundAfterTap(solved, 9)).toBeNull();
  });
});

describe('AC4: zvuk zazní hned s ťuknutím', () => {
  it('první tón začne ve chvíli ťuknutí', () => {
    const audio = new FakeAudioContext();
    createTonePlayer(() => audio).play(SOUNDS.correct);

    expect(audio.oscillators[0]?.startedAt).toBe(audio.currentTime);
  });

  it('oba zvuky začínají bez prodlevy', () => {
    expect(SOUNDS.correct[0]?.startSeconds).toBe(0);
    expect(SOUNDS.wrong[0]?.startSeconds).toBe(0);
  });

  it('zvuky jsou krátké, aby nezdržovaly další příklad', () => {
    expect(soundLengthSeconds(SOUNDS.correct)).toBeLessThanOrEqual(0.5);
    expect(soundLengthSeconds(SOUNDS.wrong)).toBeLessThanOrEqual(0.5);
  });

  it('pozastavený zvuk prohlížeče se při ťuknutí znovu zapne', () => {
    const audio = new FakeAudioContext();
    audio.state = 'suspended';
    createTonePlayer(() => audio).play(SOUNDS.wrong);

    expect(audio.state).toBe('running');
  });
});

describe('AC5: když zvuk nejde přehrát, hra běží dál bez chyby', () => {
  it('prohlížeč bez zvuku nezpůsobí chybu', () => {
    const player = createTonePlayer(() => undefined);

    expect(() => player.play(SOUNDS.correct)).not.toThrow();
  });

  it('selhání při zapnutí zvuku nezpůsobí chybu', () => {
    const player = createTonePlayer(() => {
      throw new Error('zvuk není povolen');
    });

    expect(() => player.play(SOUNDS.correct)).not.toThrow();
    expect(() => player.play(SOUNDS.wrong)).not.toThrow();
  });

  it('selhání při přehrávání tónu nezpůsobí chybu', () => {
    const audio = new FakeAudioContext();
    audio.createOscillator = () => {
      throw new Error('přehrávání selhalo');
    };
    const player = createTonePlayer(() => audio);

    expect(() => player.play(SOUNDS.correct)).not.toThrow();
  });

  it('odmítnuté zapnutí zvuku nezpůsobí chybu', async () => {
    const audio = new FakeAudioContext();
    audio.state = 'suspended';
    audio.resume = () => Promise.reject(new Error('zvuk není povolen'));
    const player = createTonePlayer(() => audio);

    expect(() => player.play(SOUNDS.correct)).not.toThrow();
    await Promise.resolve();
    expect(() => player.play(SOUNDS.correct)).not.toThrow();
  });
});

describe('AC6: rychlé ťukání nevytvoří hluk', () => {
  it('nový zvuk utne ten předchozí, takže se nevrství', () => {
    const audio = new FakeAudioContext();
    const player = createTonePlayer(() => audio);

    player.play(SOUNDS.wrong);
    const firstSound = [...audio.oscillators];
    player.play(SOUNDS.correct);

    expect(firstSound.every((oscillator) => oscillator.stoppedEarly)).toBe(true);
    const secondSound = audio.oscillators.slice(firstSound.length);
    expect(secondSound.some((oscillator) => oscillator.stoppedEarly)).toBe(false);
  });

  it('dohraný zvuk se už znovu nezastavuje', () => {
    const audio = new FakeAudioContext();
    const player = createTonePlayer(() => audio);

    player.play(SOUNDS.wrong);
    const finished = audio.oscillators[0];
    finished?.onended?.(new Event('ended'));
    player.play(SOUNDS.wrong);

    expect(finished?.stoppedEarly).toBe(false);
  });

  it('desítky ťuknutí rychle za sebou zahrají vždy jen poslední zvuk', () => {
    const audio = new FakeAudioContext();
    const player = createTonePlayer(() => audio);

    for (let tap = 0; tap < 30; tap += 1) {
      player.play(SOUNDS.wrong);
    }

    const stillPlaying = audio.oscillators.filter((oscillator) => !oscillator.stoppedEarly);
    expect(stillPlaying).toHaveLength(SOUNDS.wrong.length);
  });
});
