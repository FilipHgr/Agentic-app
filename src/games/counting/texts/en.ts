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
  rudyLines: {
    greeting: "Hi, I'm Rudy! Let's count together.",
    greetingAgain: "Hi, it's me, Rudy, again! Let's count!",
    celebration: 'Hooray! Ten stars, great job!',
    celebrationStars: 'Awesome! You got all ten stars!',
    celebrationStar: "Yippee! You're a counting star!",
  },
  overview: {
    button: 'Overview',
    title: 'Problems solved in the last 7 days',
    legendNotFirstTry: 'After a mistake or hint',
    legendFirstTry: 'First try',
    totalSolved: 'Solved this week',
    totalFirstTry: 'On first try',
    empty: 'No problems yet',
    back: 'Back',
    dayNames: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  },
  mistakes: {
    button: 'Mistakes',
    title: 'Where mistakes happen (7 days)',
    firstTryHeading: 'Solved on first try',
    addition: 'Addition',
    subtraction: 'Subtraction',
    frequentHeading: 'Most frequent mistakes',
    frequentItem: '{problem} ({count}×)',
    noFrequent: 'No frequent mistakes',
    hintsUsed: 'Hints used this week',
  },
} satisfies CountingTexts;
