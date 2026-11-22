import { describe, expect, it } from 'vitest';

import { createAudioUnlock, listenForAudioUnlock } from '../../src/shared/audio/sharedAudio';
import type {
  AudioSessionLike,
  AudioUnlockDocument,
  AudioUnlockPage,
  UnlockableAudioContext,
} from '../../src/shared/audio/sharedAudio';

/**
 * Testy k #196: zvuk v Safari na iPadu a iPhonu. Zvukový kontext, zvuková
 * relace, okno i dokument stránky jsou napodobené.
 */

type ResumeAnswer = 'runs' | 'rejects' | 'throws' | 'waits';

class FakeContext implements UnlockableAudioContext {
  readonly destination = { name: 'reproduktor' };
  state: string;
  resumeCalls = 0;
  silentStarts = 0;
  answer: ResumeAnswer = 'runs';

  constructor(state: string) {
    this.state = state;
  }

  resume(): Promise<void> {
    this.resumeCalls += 1;
    switch (this.answer) {
      case 'runs':
        this.state = 'running';
        return Promise.resolve();
      case 'rejects':
        return Promise.reject(new Error('NotAllowedError'));
      case 'throws':
        throw new Error('InvalidStateError');
      case 'waits':
        return new Promise<void>(() => undefined);
    }
  }

  createBuffer(): unknown {
    return { length: 1 };
  }

  createBufferSource(): { buffer: unknown; connect(node: unknown): unknown; start(): void } {
    return {
      buffer: null,
      connect: (node) => node,
      start: () => {
        this.silentStarts += 1;
      },
    };
  }
}

function unlockWith(context: FakeContext | undefined, session?: AudioSessionLike) {
  return createAudioUnlock({ createContext: () => context, audioSession: () => session });
}

/** Napodobená stránka, na které jde „ťuknout“ a „vrátit se“ z jiné aplikace. */
function fakePage() {
  const pageListeners = new Map<string, Array<() => void>>();
  const documentListeners = new Map<string, Array<() => void>>();
  const page: AudioUnlockPage = {
    addEventListener(type, listener, options) {
      expect(options, `posluchač ${type} je ve fázi zachycení`).toMatchObject({ capture: true });
      pageListeners.set(type, [...(pageListeners.get(type) ?? []), listener]);
    },
  };
  const pageDocument: AudioUnlockDocument & { visibilityState: string } = {
    visibilityState: 'visible',
    addEventListener(type, listener) {
      documentListeners.set(type, [...(documentListeners.get(type) ?? []), listener]);
    },
  };
  return {
    page,
    pageDocument,
    fire(type: string) {
      for (const listener of pageListeners.get(type) ?? []) listener();
    },
    fireDocument(type: string) {
      for (const listener of documentListeners.get(type) ?? []) listener();
    },
  };
}

async function settle(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe('#196 AC3: zvuk se rozběhne při ťuknutí v každém stavu kontextu', () => {
  for (const state of ['suspended', 'interrupted']) {
    it(`kontext ve stavu ${state} se po ťuknutí rozběhne a zvuk je odemčený`, async () => {
      const context = new FakeContext(state);
      const audio = unlockWith(context);
      audio.context();
      expect(audio.isUnlocked(), `před ťuknutím (${state}) zvuk odemčený není`).toBe(false);

      audio.unlock();
      await settle();

      expect(context.resumeCalls, `ťuknutí rozběhne kontext ve stavu ${state}`).toBe(1);
      expect(audio.isUnlocked(), `po ťuknutí (${state}) zvuk odemčený je`).toBe(true);
    });
  }

  it('při ťuknutí zazní krátký tichý zvuk, který Safari kontext opravdu pustí', () => {
    const context = new FakeContext('suspended');
    unlockWith(context).unlock();
    expect(context.silentStarts).toBe(1);
  });

  it('běžící kontext se při dalším ťuknutí už znovu nerozbíhá', () => {
    const context = new FakeContext('running');
    const audio = unlockWith(context);
    audio.unlock();
    expect(context.resumeCalls).toBe(0);
    expect(context.silentStarts).toBe(0);
    expect(audio.isUnlocked()).toBe(true);
  });

  it('zvuk se hlásí jako odemčený jen tehdy, když kontext opravdu běží', async () => {
    for (const state of ['suspended', 'interrupted', 'closed']) {
      const context = new FakeContext(state);
      context.answer = 'waits';
      const audio = unlockWith(context);
      audio.unlock();
      await settle();
      expect(audio.isUnlocked(), `kontext ve stavu ${state} není odemčený`).toBe(false);
    }
  });

  it('bez kontextu ještě nevytvořeného zvuk odemčený není', () => {
    expect(unlockWith(new FakeContext('running')).isUnlocked()).toBe(false);
  });
});

describe('#196 AC2: zvuková relace přehrávání kvůli tichému režimu', () => {
  it('stránka přepne relaci na přehrávání dřív, než vznikne kontext', () => {
    const session = { type: 'auto' };
    let typeWhenCreated = '';
    const audio = createAudioUnlock({
      createContext: () => {
        typeWhenCreated = session.type;
        return new FakeContext('suspended');
      },
      audioSession: () => session,
    });
    audio.context();
    expect(typeWhenCreated).toBe('playback');
  });

  it('ťuknutí vrátí relaci na přehrávání, i když ji mezitím něco změnilo', () => {
    const session = { type: 'playback' };
    const audio = unlockWith(new FakeContext('suspended'), session);
    audio.context();
    session.type = 'ambient';
    audio.unlock();
    expect(session.type).toBe('playback');
  });

  it('prohlížeč bez zvukové relace zvuk odemkne a nic nespadne', async () => {
    const context = new FakeContext('suspended');
    const audio = unlockWith(context, undefined);
    expect(() => audio.unlock()).not.toThrow();
    await settle();
    expect(audio.isUnlocked()).toBe(true);
  });

  it('relace, kterou prohlížeč nedovolí změnit, hráči chybu neukáže', async () => {
    const session: AudioSessionLike = {
      get type() {
        return 'auto';
      },
      set type(_value: string) {
        throw new Error('TypeError');
      },
    };
    const context = new FakeContext('suspended');
    const audio = unlockWith(context, session);
    expect(() => audio.unlock()).not.toThrow();
    expect(() => audio.preparePlayback()).not.toThrow();
    await settle();
    expect(audio.isUnlocked()).toBe(true);
  });
});

describe('#196 AC4: odmítnutý zvuk hráč nikdy neuvidí', () => {
  for (const answer of ['rejects', 'throws'] as const) {
    it(`rozběhnutí, které prohlížeč odmítne (${answer}), nezpůsobí chybu a zkusí se znovu`, async () => {
      const context = new FakeContext('suspended');
      context.answer = answer;
      const audio = unlockWith(context);

      expect(() => audio.unlock(), `první ťuknutí (${answer})`).not.toThrow();
      await settle();
      expect(audio.isUnlocked(), `po odmítnutí (${answer}) zvuk neběží`).toBe(false);

      context.answer = 'runs';
      audio.unlock();
      await settle();
      expect(audio.isUnlocked(), `další ťuknutí po odmítnutí (${answer}) zvuk pustí`).toBe(true);
    });
  }

  it('prohlížeč, který kontext nevytvoří, zůstane potichu bez chyby', () => {
    const audio = createAudioUnlock({
      createContext: () => {
        throw new Error('bez Web Audio');
      },
      audioSession: () => undefined,
    });
    expect(() => audio.unlock()).not.toThrow();
    expect(audio.context()).toBeUndefined();
    expect(audio.isUnlocked()).toBe(false);
  });

  it('tichý zvuk, který nejde spustit, odemčení nezastaví', async () => {
    const context = new FakeContext('suspended');
    context.createBufferSource = () => {
      throw new Error('NotSupportedError');
    };
    const audio = unlockWith(context);
    expect(() => audio.unlock()).not.toThrow();
    await settle();
    expect(audio.isUnlocked()).toBe(true);
  });
});

describe('#196 AC3: zvuk po návratu stránky do popředí', () => {
  it('po návratu z jiné aplikace se přerušený kontext rozběhne sám', async () => {
    const context = new FakeContext('suspended');
    const audio = unlockWith(context);
    const page = fakePage();
    listenForAudioUnlock(audio, page.page, page.pageDocument);
    page.fire('touchend');
    await settle();
    expect(audio.isUnlocked()).toBe(true);

    context.state = 'interrupted';
    page.pageDocument.visibilityState = 'visible';
    page.fireDocument('visibilitychange');
    await settle();

    expect(audio.isUnlocked()).toBe(true);
  });

  it('návrat stránky z mezipaměti prohlížeče (pageshow) zvuk zase rozběhne', async () => {
    const context = new FakeContext('suspended');
    const audio = unlockWith(context);
    const page = fakePage();
    listenForAudioUnlock(audio, page.page, page.pageDocument);
    page.fire('pointerup');
    await settle();
    context.state = 'interrupted';

    page.fire('pageshow');
    await settle();

    expect(audio.isUnlocked()).toBe(true);
  });

  it('když prohlížeč po návratu bez dotyku zvuk nepustí, rozběhne ho další ťuknutí', async () => {
    const context = new FakeContext('suspended');
    const audio = unlockWith(context);
    const page = fakePage();
    listenForAudioUnlock(audio, page.page, page.pageDocument);
    page.fire('touchend');
    await settle();

    context.state = 'interrupted';
    context.answer = 'rejects';
    expect(() => page.fireDocument('visibilitychange')).not.toThrow();
    await settle();
    expect(audio.isUnlocked(), 'bez dotyku zvuk zatím neběží').toBe(false);

    context.answer = 'runs';
    page.fire('touchend');
    await settle();
    expect(audio.isUnlocked(), 'ťuknutí po návratu zvuk pustí').toBe(true);
  });

  it('schování stránky kontext nerozbíhá', () => {
    const context = new FakeContext('suspended');
    const audio = unlockWith(context);
    audio.context();
    const page = fakePage();
    listenForAudioUnlock(audio, page.page, page.pageDocument);
    page.pageDocument.visibilityState = 'hidden';
    page.fireDocument('visibilitychange');
    expect(context.resumeCalls).toBe(0);
  });

  it('každé gesto, které Safari bere jako dotyk hráče, zvuk odemkne', async () => {
    for (const type of ['touchend', 'pointerup', 'click']) {
      const context = new FakeContext('suspended');
      const audio = unlockWith(context);
      const page = fakePage();
      listenForAudioUnlock(audio, page.page, page.pageDocument);
      page.fire(type);
      await settle();
      expect(audio.isUnlocked(), `gesto ${type} odemkne zvuk`).toBe(true);
    }
  });
});
