/** Anglické texty menu (#137), zatím mimo seznam jazyků. */

import type { MenuTexts } from './menuTextsTypes';

export default {
  categories: {
    all: { title: 'All' },
    // „Adding and subtracting“ se do sloupce kategorií nevejde, platí záloha z #137.
    addingSubtracting: { title: 'Plus and minus' },
    drawing: { title: 'Drawing' },
  },
  profiles: {
    nicknameTitle: 'Nickname',
    colorTitle: 'Colour',
    deleteQuestion: 'Delete profile?',
    deleteConfirm: 'Delete',
    deleteCancel: 'Back',
  },
} satisfies MenuTexts;
