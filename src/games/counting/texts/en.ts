/** Anglické texty hry Počítání (#137), zatím mimo seznam jazyků. */

import type { CountingTexts } from './countingTexts';

export default {
  title: 'Counting',
  rowLabels: {
    maxNumber: 'Up to',
    operations: 'Sums',
    answerInput: 'Answer',
  },
  guideButtons: {
    back: 'Back',
    next: 'Next',
    startPlaying: "Let's play",
  },
  guideLines: {
    maxNumber: [
      'The biggest number that will appear in the sums.',
      'Start small and go higher once your child finds it easy.',
    ],
    operations: [
      'Adding, subtracting, or both mixed together.',
      'Start with adding. Mix in subtracting once that is easy.',
    ],
    answerInput: [
      'Your child taps the keypad or writes with the pencil.',
      'Choose the pencil once your child can write every digit.',
    ],
    summary: [
      'All done. You can still change any choice with a tap.',
      'Later, change them by holding the gear in the top right.',
    ],
  },
} satisfies CountingTexts;
