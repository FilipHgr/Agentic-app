import { describe, expect, it } from 'vitest';

import { todayGuideCss, todaySettingsCss } from './parentPanelSnapshot';
import { STEPS, expectLandscapeGuideSpec, expectPortraitGuideSpec } from './phoneGuideFixtures';
import { IPHONE_PORTRAIT_NOTCH, NO_NOTCH } from './viewportFixtures';
import type { TestWindow } from './viewportFixtures';

/**
 * Testy k #59 (nastavení na telefonu, část a): zafixování dnešního stavu.
 *
 * AC6: velikosti a polohy všech prvků nastavení a všech čtyř kroků
 * průvodce na iPadu (1180×820, 1180×760, 932×500, 820×1180) a ve zmenšených
 * oknech (667×320, 375×553) v CSS px.
 *
 * Rozdělení (a) zafixovalo průvodce i v telefonních oknech 744×296, 844×340
 * (výřez 47/47/21), 932×499, 360×620, 390×844 (výřez 47 nahoře, 34 dole)
 * a 499×932. Část (b, #60) tyto hodnoty nahradila polohami z AC4 a AC5.
 *
 * Hodnoty jsou snapshot vytvořený z dnešního kódu před změnou (plocha
 * 1024 × 768 zmenšená na herní plochu jako `panelFit`). Že nové nastavení
 * dá iPadu a zmenšeným oknům právě tohle, ověřuje phoneSettingsLayout.test.ts.
 */

const IPHONE_LANDSCAPE_NOTCH = { top: 0, right: 47, bottom: 21, left: 47 };

/** iPad a zmenšená okna, kde se nastavení ani průvodce nemění (AC6). */
const UNCHANGED_WINDOWS: readonly TestWindow[] = [
  { name: 'iPad 1180×820', width: 1180, height: 820, safeArea: NO_NOTCH },
  { name: 'iPad 1180×760', width: 1180, height: 760, safeArea: NO_NOTCH },
  { name: '932×500 těsně nad hranicí', width: 932, height: 500, safeArea: NO_NOTCH },
  { name: 'iPad na výšku 820×1180', width: 820, height: 1180, safeArea: NO_NOTCH },
  { name: 'zmenšené 667×320', width: 667, height: 320, safeArea: NO_NOTCH },
  { name: 'zmenšené 375×553', width: 375, height: 553, safeArea: NO_NOTCH },
];

/** Telefonní okna, kde průvodce dostal v části (b) vlastní rozložení (AC4, AC5). */
const PHONE_GUIDE_WINDOWS: readonly TestWindow[] = [
  { name: '744×296 nejmenší na šířku', width: 744, height: 296, safeArea: NO_NOTCH },
  {
    name: '844×340 iPhone (výřez 47/47, lišta 21)',
    width: 844,
    height: 340,
    safeArea: IPHONE_LANDSCAPE_NOTCH,
  },
  { name: '932×499 hranice na šířku', width: 932, height: 499, safeArea: NO_NOTCH },
  { name: '360×620 nejmenší na výšku', width: 360, height: 620, safeArea: NO_NOTCH },
  {
    name: '390×844 iPhone (výřez 47, lišta 34)',
    width: 390,
    height: 844,
    safeArea: IPHONE_PORTRAIT_NOTCH,
  },
  { name: '499×932 hranice na výšku', width: 499, height: 932, safeArea: NO_NOTCH },
];

describe('AC6: na iPadu a ve zmenšených oknech je nastavení jako dnes', () => {
  it.each(UNCHANGED_WINDOWS)(
    '$name: popisky řad, volby a ✓ mají stejnou velikost a polohu jako před změnou',
    (window) => {
      expect(todaySettingsCss(window)).toMatchSnapshot();
    },
  );
});

describe('AC6: na iPadu a ve zmenšených oknech je průvodce jako dnes', () => {
  it.each(UNCHANGED_WINDOWS)(
    '$name: všechny čtyři kroky průvodce mají řady, rámeček, radu, ukazatel, tlačítka a reproduktor jako před změnou',
    (window) => {
      expect(todayGuideCss(window)).toMatchSnapshot();
    },
  );
});

describe('#60 (část b): průvodce v telefonních oknech má polohy z AC4 a AC5', () => {
  it.each(PHONE_GUIDE_WINDOWS.filter((window) => window.width > window.height))(
    '$name: všechny čtyři kroky průvodce mají řady, rámeček, radu, ukazatel a tlačítka podle AC4',
    (window) => {
      for (const step of STEPS) {
        expectLandscapeGuideSpec(window, step);
      }
    },
  );

  it.each(PHONE_GUIDE_WINDOWS.filter((window) => window.width < window.height))(
    '$name: všechny čtyři kroky průvodce mají řady, rámeček, radu a tlačítka podle AC5',
    (window) => {
      for (const step of STEPS) {
        expectPortraitGuideSpec(window, step);
      }
    },
  );
});
