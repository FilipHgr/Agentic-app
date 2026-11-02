import Phaser from 'phaser';

import {
  CHARACTERS,
  CHARACTER_MOODS,
  characterImageKey,
  characterImagePath,
} from '../logic/characters';
import type { CharacterId, CharacterMood } from '../logic/characters';
import { moodForReaction } from '../logic/mascot';
import type { MascotReaction } from '../logic/mascot';
import { MASCOT_DANCE_SWAY, MASCOT_JUMP_HEIGHT, MASCOT_SIZE } from '../logic/screenLayout';
import type { Point } from '../logic/screenLayout';

/** Obrázky se načtou dvakrát větší, než se zobrazí, aby byly ostré i na Retina displeji. */
const TEXTURE_SIZE = MASCOT_SIZE * 2;

/** Jak dlouho postavička ukazuje radost nebo povzbuzení, než se vrátí do klidu. */
const MOOD_MS = 700;

/** Mrknutí přijde náhodně jednou za tuto dobu a trvá krátce. */
const BLINK_MIN_MS = 2500;
const BLINK_MAX_MS = 5000;
const BLINK_MS = 140;

/** Jak dlouho trvá odskok staré postavičky a přískok nové. */
const SWITCH_MS = 220;

/**
 * Postavička vlevo vedle příkladu. Jen se dívá a reaguje, na dotyk nereaguje.
 * Vnější kontejner skáče, tančí a střídá postavičky, vnitřní se pohupuje
 * a kývá, aby se pohyby nepraly.
 */
export class Mascot {
  private readonly outer: Phaser.GameObjects.Container;
  private readonly body: Phaser.GameObjects.Container;
  private readonly image: Phaser.GameObjects.Image;
  private readonly home: Point;
  private character: CharacterId;
  private mood: CharacterMood = 'klid';
  private backToCalm: Phaser.Time.TimerEvent | undefined;

  /** Zařadí obrázky všech postaviček do načítání scény. */
  static preload(scene: Phaser.Scene): void {
    for (const character of CHARACTERS) {
      for (const mood of CHARACTER_MOODS) {
        scene.load.svg(characterImageKey(character, mood), characterImagePath(character, mood), {
          width: TEXTURE_SIZE,
          height: TEXTURE_SIZE,
        });
      }
    }
  }

  constructor(
    private readonly scene: Phaser.Scene,
    position: Point,
    character: CharacterId,
  ) {
    this.home = position;
    this.character = character;

    this.image = scene.add.image(0, 0, '__MISSING').setDisplaySize(MASCOT_SIZE, MASCOT_SIZE);
    this.body = scene.add.container(0, 0, [this.image]);
    this.outer = scene.add.container(position.x, position.y, [this.body]);

    this.showMood('klid');
    this.startIdleBobbing();
    this.scheduleBlink();
  }

  /** Spustí animaci podle reakce z logiky hry. */
  react(reaction: MascotReaction, durationMs = 0): void {
    switch (reaction) {
      case 'idle':
        this.showMood('klid');
        return;
      case 'joy':
        this.jumpForJoy();
        return;
      case 'encourage':
        this.nodEncouragingly();
        return;
      case 'dance':
        this.dance(durationMs);
        return;
    }
  }

  /**
   * Stará postavička se zmenší a nová vyskočí s radostí. Postavička se vymění
   * hned, aby ji neodložilo ani rychlé ťukání; animace běží na vnitřním
   * kontejneru, který reakce na ťuknutí nezastavují.
   */
  switchTo(character: CharacterId): void {
    this.character = character;
    this.scene.tweens.add({
      targets: this.body,
      scale: 0,
      duration: SWITCH_MS,
      ease: 'Back.easeIn',
      onComplete: () => {
        this.showMood('radost');
        this.calmDownLater();
        this.scene.tweens.add({
          targets: this.body,
          scale: 1,
          duration: SWITCH_MS * 1.5,
          ease: 'Back.easeOut',
        });
      },
    });
  }

  /**
   * Ukáže obrázek nálady. Když se obrázek nenačetl, postavička se jen skryje
   * a hra běží dál.
   */
  private showMood(mood: CharacterMood): void {
    this.mood = mood;
    const key = characterImageKey(this.character, mood);

    if (!this.scene.textures.exists(key)) {
      this.image.setVisible(false);
      return;
    }
    this.image.setTexture(key).setDisplaySize(MASCOT_SIZE, MASCOT_SIZE).setVisible(true);
  }

  /** Po chvíli vrátí postavičku z radosti nebo povzbuzení do klidu. */
  private calmDownLater(): void {
    this.backToCalm?.remove();
    this.backToCalm = this.scene.time.delayedCall(MOOD_MS, () => this.showMood('klid'));
  }

  private startIdleBobbing(): void {
    this.scene.tweens.add({
      targets: this.body,
      y: 4,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private scheduleBlink(): void {
    this.scene.time.delayedCall(Phaser.Math.Between(BLINK_MIN_MS, BLINK_MAX_MS), () => {
      // Mrká jen v klidu, aby nepřerušila radost nebo oslavu.
      if (this.mood === 'klid') {
        this.showMood('mrknuti');
        this.scene.time.delayedCall(BLINK_MS, () => {
          if (this.mood === 'mrknuti') {
            this.showMood('klid');
          }
        });
      }
      this.scheduleBlink();
    });
  }

  /** Zastaví předchozí pohyb a vrátí postavičku na její místo. */
  private resetPose(): void {
    this.backToCalm?.remove();
    this.scene.tweens.killTweensOf(this.outer);
    this.outer.setPosition(this.home.x, this.home.y).setAngle(0).setScale(1);
  }

  private jumpForJoy(): void {
    this.resetPose();
    this.showMood(moodForReaction('joy'));
    this.scene.tweens.add({
      targets: this.outer,
      y: this.home.y - MASCOT_JUMP_HEIGHT,
      duration: 180,
      yoyo: true,
      ease: 'Quad.easeOut',
    });
    this.calmDownLater();
  }

  private nodEncouragingly(): void {
    this.resetPose();
    this.showMood(moodForReaction('encourage'));
    this.scene.tweens.add({
      targets: this.outer,
      y: this.home.y + 8,
      duration: 140,
      yoyo: true,
      repeat: 1,
      ease: 'Sine.easeInOut',
    });
    this.calmDownLater();
  }

  private dance(durationMs: number): void {
    this.resetPose();
    this.showMood(moodForReaction('dance'));
    const stepMs = 220;
    const steps = Math.max(1, Math.floor(durationMs / (stepMs * 2)));

    this.scene.tweens.add({
      targets: this.outer,
      x: { from: this.home.x - MASCOT_DANCE_SWAY, to: this.home.x + MASCOT_DANCE_SWAY },
      angle: { from: -8, to: 8 },
      duration: stepMs,
      yoyo: true,
      repeat: steps - 1,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        this.resetPose();
        this.showMood('klid');
      },
    });
  }
}
