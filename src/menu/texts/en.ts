/** Anglické texty menu (#137), zatím mimo seznam jazyků. */

import type { MenuTexts } from './menuTextsTypes';

export default {
  categories: {
    all: { title: 'All' },
    math: { title: 'Math' },
    create: { title: 'Create' },
  },
  profiles: {
    nicknameTitle: 'Nickname',
    colorTitle: 'Colour',
    deleteQuestion: 'Delete profile?',
    deleteConfirm: 'Delete',
    deleteCancel: 'Back',
  },
  overview: {
    title: 'Overview',
    back: 'Back',
    weekTab: '7 days',
    mistakesTab: 'Mistakes',
    weekTitle: 'Problems solved in the last 7 days',
    legendNotFirstTry: 'After a mistake or hint',
    legendAfterMistake: 'After a mistake',
    legendFirstTry: 'First try',
    totalSolved: 'Solved this week',
    totalFirstTry: 'On first try',
    empty: 'No problems yet',
    dayNames: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    mistakesTitle: 'Where mistakes happen (7 days)',
    firstTryHeading: 'Solved on first try',
    addition: 'Addition',
    subtraction: 'Subtraction',
    frequentHeading: 'Most frequent mistakes',
    frequentItem: '{problem} ({count}×)',
    noFrequent: 'No frequent mistakes',
    hintsUsed: 'Hints used this week',
  },
} satisfies MenuTexts;
