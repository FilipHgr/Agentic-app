/** Anglické texty hry Porovnávání (#178, #179, #181, #182). */

import type { CompareTexts } from './compareTexts';

export default {
  title: 'Compare',
  rowLabels: {
    maxNumber: 'Up to',
    show: 'Show',
    question: 'Question',
  },
  rudyLines: {
    greeting: "Hi, I'm Rudy! Where are there more?",
    greetingAgain: "It's me, Rudy, again! Let's compare!",
    celebration: 'Hooray! You got ten stars!',
    celebrationMore: 'Great job! You always know where there are more!',
  },
  guideLines: {
    questionMore: 'Where are there more?',
    questionLess: 'Where are there fewer?',
  },
} satisfies CompareTexts;
