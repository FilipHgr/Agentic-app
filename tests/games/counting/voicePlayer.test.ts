import { describe, expect, it } from 'vitest';

import { createVoicePlayer } from '../../../src/games/counting/audio/voicePlayer';
import type {
  AudioBufferLike,
  AudioBufferSourceLike,
  VoiceAudioContextLike,
  VoiceFetch,
  VoicePlayer,
} from '../../../src/games/counting/audio/voicePlayer';
import type { AudioNodeLike } from '../../../src/shared/audio/tonePlayer';
import { GUIDE_SCRIPT } from '../../../src/games/counting/logic/guideScript';
import type { GuideLineId } from '../../../src/games/counting/logic/guideScript';
import { guideVoiceUrl } from '../../../src/games/counting/logic/guideVoice';
import { guideAtStart } from '../../../src/games/counting/logic/setupGuide';

/**
 * Testy k #51 pro přehrávač nahrávek průvodce: stahuje jen vlastní soubory
 * hry, dvě věty nikdy nehrají přes sebe a každá chyba (chybějící soubor,
 * výpadek sítě, poškozená nahrávka, prohlížeč bez zvuku) vede k tichu bez
 * výjimky. Síť i Web Audio jsou napodobené, skutečně se nic nestahuje
 * ani nepřehrává. Kdy co zaznít má, řeší `guideVoice.test.ts`.
 */

const ALL_IDS: readonly GuideLineId[] = GUIDE_SCRIPT.map((line) => line.id);

/** Nahrávky, které jsou v projektu, podle cesty v `public/`. */
const VOICE_FILES: readonly string[] = Object.keys(
  import.meta.glob('../../../public/voice/guide/*.mp3'),
).map((path) => path.replace('../../../public/', ''));

/** Nahrávka v paměti; délka dat prozradí, ke které větě patří. */
const BYTES_OF: Record<GuideLineId, number> = {
  maxNumber: 101,
  operations: 102,
  answerInput: 103,
  summary: 104,
};

class FakeBuffer implements AudioBufferLike {
  readonly duration = 4;
  constructor(readonly bytes: number) {}
}

/** Napodobený zdroj zvuku, který si pamatuje, jestli hrál a jestli byl zastaven. */
class FakeSource implements AudioBufferSourceLike {
  buffer: AudioBufferLike | null = null;
  onended: ((event: Event) => unknown) | null = null;
  started = false;
  startOffset: number | undefined;
  stopped = false;
  connected = false;

  connect(destination: AudioNodeLike): AudioNodeLike {
    this.connected = true;
    return destination;
  }

  start(_when?: number, offset?: number): void {
    this.started = true;
    this.startOffset = offset;
  }

  stop(): void {
    this.stopped = true;
  }

  /** Která věta v tomto zdroji zní. */
  get line(): GuideLineId | undefined {
    const bytes = (this.buffer as FakeBuffer | null)?.bytes;
    return ALL_IDS.find((id) => BYTES_OF[id] === bytes);
  }

  get sounding(): boolean {
    return this.started && !this.stopped;
  }
}

/** Napodobený zvukový kontext prohlížeče. */
class FakeVoiceContext implements VoiceAudioContextLike {
  readonly destination: AudioNodeLike = { connect: (node) => node };
  readonly sources: FakeSource[] = [];
  state = 'suspended';
  currentTime = 2;
  resumeCalls = 0;
  failDecoding = false;
  failResume = false;

  resume(): Promise<void> {
    this.resumeCalls += 1;
    if (this.failResume) {
      return Promise.reject(new Error('NotAllowedError'));
    }
    this.state = 'running';
    return Promise.resolve();
  }

  decodeAudioData(data: ArrayBuffer): Promise<AudioBufferLike> {
    if (this.failDecoding) {
      return Promise.reject(new Error('EncodingError'));
    }
    return Promise.resolve(new FakeBuffer(data.byteLength));
  }

  createBufferSource(): FakeSource {
    const source = new FakeSource();
    this.sources.push(source);
    return source;
  }

  /** Zdroje, které právě zní. */
  sounding(): FakeSource[] {
    return this.sources.filter((source) => source.sounding);
  }
}

type Reply = 'ok' | 'missing' | 'networkError' | 'wait';

/** Napodobená síť: odpovědi podle id, `wait` čeká na ruční uvolnění. */
class FakeNetwork {
  readonly urls: string[] = [];
  private readonly waiting = new Map<string, () => void>();

  constructor(private readonly reply: (url: string) => Reply = () => 'ok') {}

  readonly fetch: VoiceFetch = (url) => {
    this.urls.push(url);
    const id = ALL_IDS.find((candidate) => url === guideVoiceUrl(candidate));
    const body = new Uint8Array(id === undefined ? 1 : BYTES_OF[id]);
    switch (this.reply(url)) {
      case 'ok':
        return Promise.resolve(new Response(body, { status: 200 }));
      case 'missing':
        return Promise.resolve(new Response('Not Found', { status: 404 }));
      case 'networkError':
        return Promise.reject(new TypeError('Load failed'));
      case 'wait':
        return new Promise((resolveFetch) => {
          this.waiting.set(url, () => resolveFetch(new Response(body, { status: 200 })));
        });
    }
  };

  /** Pozdržená odpověď dorazí. */
  release(id: GuideLineId): void {
    this.waiting.get(guideVoiceUrl(id))?.();
  }
}

interface Harness {
  readonly player: VoicePlayer;
  readonly audio: FakeVoiceContext;
  readonly network: FakeNetwork;
  readonly loaded: GuideLineId[];
  readonly failed: GuideLineId[];
}

function harness(
  options: {
    reply?: (url: string) => Reply;
    createContext?: () => VoiceAudioContextLike | undefined;
  } = {},
): Harness {
  const audio = new FakeVoiceContext();
  const network = new FakeNetwork(options.reply);
  const loaded: GuideLineId[] = [];
  const failed: GuideLineId[] = [];
  const player = createVoicePlayer({
    fetch: network.fetch,
    createContext: options.createContext ?? (() => audio),
    events: {
      onLoaded: (id) => loaded.push(id),
      onLoadFailed: (id) => failed.push(id),
    },
  });
  return { player, audio, network, loaded, failed };
}

/** Nechá doběhnout stahování a dekódování. */
async function settle(): Promise<void> {
  for (let round = 0; round < 5; round += 1) {
    await new Promise((done) => setTimeout(done, 0));
  }
}

/** Přehrávač s odemčeným zvukem a načtenými nahrávkami. */
async function readyWith(ids: readonly GuideLineId[]): Promise<Harness> {
  const setup = harness();
  setup.player.unlock();
  for (const id of ids) {
    setup.player.load(id);
  }
  await settle();
  return setup;
}

describe('AC4: stahují se jen vlastní soubory hry', () => {
  for (const id of ALL_IDS) {
    it(`nahrávka „${id}“ se stahuje z vlastního souboru hry voice/guide/${id}.mp3`, () => {
      expect(guideVoiceUrl(id)).toBe(`voice/guide/${id}.mp3`);
    });

    it(`soubor nahrávky „${id}“ je v repozitáři`, () => {
      expect(VOICE_FILES).toContain(guideVoiceUrl(id));
    });
  }

  it('adresa nahrávky nikdy nevede na cizí server', () => {
    for (const id of ALL_IDS) {
      const url = guideVoiceUrl(id);
      expect(url).not.toMatch(/^[a-z]+:/i);
      expect(url.startsWith('//')).toBe(false);
    }
  });

  it('přehrávač stahuje přesně z adresy nahrávky a nic jiného', async () => {
    const { player, network } = harness();
    player.load('operations');
    await settle();
    expect(network.urls).toEqual([guideVoiceUrl('operations')]);
  });

  it('vytvořený přehrávač sám nic nestáhne', async () => {
    const { player, network } = harness();
    player.unlock();
    player.play('maxNumber');
    player.stop();
    await settle();
    expect(network.urls).toEqual([]);
  });

  it('při běžném spuštění se průvodce neotevře, a tak se nestáhne žádná nahrávka', async () => {
    const { network } = harness();
    expect(guideAtStart({ helpPending: false })).toBeNull();
    await settle();
    expect(network.urls).toEqual([]);
  });

  it('po stažení přehrávač dá vědět, že je nahrávka načtená', async () => {
    const { player, loaded, failed } = harness();
    player.load('summary');
    await settle();
    expect(loaded).toEqual(['summary']);
    expect(failed).toEqual([]);
  });

  it('načtená nahrávka se sama nespustí', async () => {
    const { audio } = await readyWith(['maxNumber', 'operations']);
    expect(audio.sounding()).toEqual([]);
  });
});

describe('AC1 a AC3: dvě věty nikdy nehrají přes sebe', () => {
  it('načtená věta po pokynu zazní', async () => {
    const { player, audio } = await readyWith(['maxNumber']);
    player.play('maxNumber');
    expect(audio.sounding().map((source) => source.line)).toEqual(['maxNumber']);
    expect(audio.sounding()[0]?.connected).toBe(true);
  });

  it('nová věta utne tu předchozí', async () => {
    const { player, audio } = await readyWith(['maxNumber', 'operations']);
    player.play('maxNumber');
    player.play('operations');
    expect(audio.sounding().map((source) => source.line)).toEqual(['operations']);
  });

  it('stejná věta pustěná znovu začne od začátku a stará skončí', async () => {
    const { player, audio } = await readyWith(['maxNumber']);
    player.play('maxNumber');
    player.play('maxNumber');
    const sounding = audio.sounding();
    expect(sounding).toHaveLength(1);
    expect(sounding[0]?.startOffset ?? 0).toBe(0);
    expect(audio.sources.filter((source) => source.started)).toHaveLength(2);
  });

  it('desítky rychlých ťuknutí nechají znít vždy jen jednu větu', async () => {
    const { player, audio } = await readyWith(ALL_IDS);
    for (let tap = 0; tap < 40; tap += 1) {
      player.play(ALL_IDS[tap % ALL_IDS.length] ?? 'maxNumber');
      expect(audio.sounding().length).toBeLessThanOrEqual(1);
    }
    expect(audio.sounding()).toHaveLength(1);
  });

  it('zastavení ukončí rozehranou větu', async () => {
    const { player, audio } = await readyWith(['summary']);
    player.play('summary');
    player.stop();
    expect(audio.sounding()).toEqual([]);
  });

  it('zastavení, když nic nehraje, nezpůsobí chybu', async () => {
    const { player } = await readyWith([]);
    expect(() => player.stop()).not.toThrow();
  });

  it('po zastavení jde větu znovu přehrát', async () => {
    const { player, audio } = await readyWith(['answerInput']);
    player.play('answerInput');
    player.stop();
    player.play('answerInput');
    expect(audio.sounding().map((source) => source.line)).toEqual(['answerInput']);
  });

  it('dohraná věta se už znovu nezastavuje', async () => {
    const { player, audio } = await readyWith(['maxNumber', 'operations']);
    player.play('maxNumber');
    const finished = audio.sounding()[0];
    finished?.onended?.(new Event('ended'));
    const stoppedBefore = finished?.stopped;
    player.play('operations');
    expect(finished?.stopped).toBe(stoppedBefore);
  });

  it('pokyn přehrát nenačtenou větu je ticho, ne chyba', async () => {
    const { player, audio } = await readyWith([]);
    expect(() => player.play('operations')).not.toThrow();
    expect(audio.sounding()).toEqual([]);
  });

  it('pozdě dorazivší nahrávka nezačne hrát přes větu, která už zní', async () => {
    const setup = harness({ reply: (url) => (url.includes('operations') ? 'wait' : 'ok') });
    setup.player.unlock();
    setup.player.load('maxNumber');
    setup.player.load('operations');
    await settle();
    setup.player.play('maxNumber');
    setup.network.release('operations');
    await settle();
    expect(setup.loaded).toContain('operations');
    expect(setup.audio.sounding().map((source) => source.line)).toEqual(['maxNumber']);
  });
});

describe('AC2: odemčení zvuku prvním ťuknutím', () => {
  it('odemčení zapne pozastavený zvuk prohlížeče', () => {
    const { player, audio } = harness();
    player.unlock();
    expect(audio.resumeCalls).toBeGreaterThanOrEqual(1);
    expect(audio.state).toBe('running');
  });

  it('odmítnuté zapnutí zvuku nezpůsobí chybu', async () => {
    const { player, audio } = harness();
    audio.failResume = true;
    expect(() => player.unlock()).not.toThrow();
    await settle();
  });
});

describe('AC5: chybějící nebo nenačtená nahrávka znamená ticho', () => {
  const failures: readonly [string, Reply][] = [
    ['chybějící soubor', 'missing'],
    ['výpadek sítě', 'networkError'],
  ];

  for (const [name, reply] of failures) {
    it(`${name} se ohlásí jako nepovedené načtení, ne jako chyba`, async () => {
      const { player, loaded, failed } = harness({ reply: () => reply });
      expect(() => player.load('maxNumber')).not.toThrow();
      await settle();
      expect(failed).toEqual(['maxNumber']);
      expect(loaded).toEqual([]);
    });

    it(`po chybě „${name}“ je pokyn přehrát větu ticho`, async () => {
      const { player, audio } = harness({ reply: () => reply });
      player.unlock();
      player.load('maxNumber');
      await settle();
      expect(() => player.play('maxNumber')).not.toThrow();
      expect(audio.sounding()).toEqual([]);
    });
  }

  it('poškozená nahrávka, kterou prohlížeč neumí přečíst, se ohlásí jako nepovedené načtení', async () => {
    const { player, audio, loaded, failed } = harness();
    audio.failDecoding = true;
    player.load('summary');
    await settle();
    expect(failed).toEqual(['summary']);
    expect(loaded).toEqual([]);
  });

  it('nepovedenou nahrávku jde stáhnout znovu a pak zazní', async () => {
    let attempts = 0;
    const { player, audio, loaded } = harness({
      reply: () => {
        attempts += 1;
        return attempts === 1 ? 'networkError' : 'ok';
      },
    });
    player.unlock();
    player.load('operations');
    await settle();
    player.load('operations');
    await settle();
    expect(loaded).toEqual(['operations']);
    player.play('operations');
    expect(audio.sounding().map((source) => source.line)).toEqual(['operations']);
  });

  it('jedna nepovedená nahrávka nevadí ostatním', async () => {
    const { player, audio, loaded, failed } = harness({
      reply: (url) => (url.includes('operations') ? 'missing' : 'ok'),
    });
    player.unlock();
    player.load('maxNumber');
    player.load('operations');
    await settle();
    expect(failed).toEqual(['operations']);
    expect(loaded).toEqual(['maxNumber']);
    player.play('maxNumber');
    expect(audio.sounding()).toHaveLength(1);
  });

  it('prohlížeč bez zvuku nezpůsobí chybu, průvodce je jen potichu', async () => {
    const { player } = harness({ createContext: () => undefined });
    expect(() => {
      player.unlock();
      player.load('maxNumber');
      player.play('maxNumber');
      player.stop();
    }).not.toThrow();
    await settle();
  });

  it('selhání při vytváření zvuku nezpůsobí chybu', async () => {
    const { player } = harness({
      createContext: () => {
        throw new Error('AudioContext není k dispozici');
      },
    });
    expect(() => {
      player.unlock();
      player.load('maxNumber');
      player.play('maxNumber');
      player.stop();
    }).not.toThrow();
    await settle();
  });

  it('selhání při spuštění věty nezpůsobí chybu', async () => {
    const setup = await readyWith(['maxNumber']);
    setup.audio.createBufferSource = () => {
      throw new Error('InvalidStateError');
    };
    expect(() => setup.player.play('maxNumber')).not.toThrow();
  });
});
