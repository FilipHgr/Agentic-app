---
name: novy-ukol
description: Navržení nového úkolu do hry jako GitHub issue (user story a akceptační kritéria ke schválení) a zahájení práce na schváleném úkolu. Použij, když vlastník chce nový úkol, další návrhy, nebo napíše, že issue schválil.
---

# Nový úkol

Úkoly vymýšlí Claude a dělá je rovnou bez schvalování vlastníkem
(rozhodnutí 2026-11-12); vlastník může kdykoli napsat připomínky. Nic z toho
nepiš do chatu jako hotové zadání, zadání žije v GitHub issue.

Když `gh` nefunguje (v cloudu je povolený jen na vyhledávání), dělej
všechno s issues GitHub nástroji (čtení, komentáře, štítky). Subagenti
GitHub nástroje nemají: předej jim v zadání text issue, případně seznam
issues.

## 1. Návrh

Návrh vzniká a kontroluje se v subagentech, ty ho jen předáváš a zakládáš.

1. Zavolej subagenta `issue-planner`. Když vlastník zadal téma nebo
   připomínky, předej mu je.
2. Celý návrh předej subagentovi `story-reviewer`.
   - VRÁTIT: předej `issue-planner` jeho návrh i nálezy a nech ho
     návrh upravit. Pak znovu `story-reviewer`.
   - Když po dvou kolech pořád něco blokuje, issue nezakládej a napiš
     vlastníkovi, v čem je problém.
3. Po SCHVÁLENO založ issue podle šablony
   `.github/ISSUE_TEMPLATE/user-story.md` rovnou se štítkem „schváleno“
   (bez „ke schválení“, sekce „Jak schválit“ se vynechá). Obsah vezmi
   z návrhu beze změn. Nevyřešená DOPORUČENÍ od `story-reviewer` přidej
   do issue jako komentář. Otevřené otázky rozhodni podle doporučení.
4. Pošli vlastníkovi odkaz na issue, v jedné větě o čem je a proč teď,
   a pokračuj prací (sekce 3) bez čekání na „ok“.
5. Vzhled se neschvaluje předem: obrázky a snímky ukaž po implementaci.
   Otázku, kterou opravdu musí rozhodnout vlastník (nejasné zadání,
   cizí služba, změna pravidel o soukromí), polož a úkol do odpovědi
   odlož. Před generováním v ElevenLabs napiš cenu; nad 1 000 kreditů
   na jeden úkol počkej na souhlas.

## 2. Připomínky vlastníka

Vlastník nemusí nic schvalovat. Když napíše připomínky v chatu (nebo
„připomínky v issue“), zapracuje je `issue-planner`, zkontroluje
`story-reviewer` a přepíšeš tělo issue; do issue přidej komentář, co se
změnilo.

## 3. Práce na úkolu

Výsledek každého subagenta ulož hned jako komentář do issue
(`gh issue comment <číslo> --body-file -`), nadpis „Výsledek: <agent>“.
Kontext se může kdykoli zkomprimovat a z issue se po komprimaci
výsledky automaticky načtou zpět, stejně jako v nové session. Co není v issue, může se ztratit.

1. Pokud běží sprint (větev `sprint-<číslo>` ještě není sloučená),
   pokračuj v ní. Jinak vytvoř novou větev `sprint-<další číslo>`
   ze `staging`.
2. Změň štítek issue ze „schváleno“ na „rozpracováno“
   (`gh issue edit <číslo> --remove-label schváleno --add-label rozpracováno`).
   Podle něj hook v nové session i po komprimaci najde rozpracovaný úkol.
   Rozpracovaný smí být vždy jen jeden úkol.
3. **Testy napřed:** zavolej subagenta `test-writer` s číslem issue
   a výsledek ulož do issue.
   - Když vrátí PROBLÉMY V ZADÁNÍ, zastav se a zeptej se vlastníka.
   - Jeho NAVRŽENÉ ROZHRANÍ použij při implementaci.
4. **Implementace:** dělej, dokud neprojdou testy dotčených částí
   (`npm run test:changed`), `npm run lint` a `npm run build`. Testy od
   `test-writer` neupravuj, aby prošly. Když je test podle tebe špatně,
   řekni proč a nech ho opravit subagentem `test-writer`.
5. **Kontroly:** zavolej s číslem issue subagenty `reviewer`,
   `security-auditor` a (pokud se měnilo cokoli ve `scenes/` některé hry
   (`src/games/<hra>/scenes/`) nebo
   vzhled) `ux-checker`. Každý výsledek ulož do issue.
   - Před `ux-checker` udělej snímky obrazovky: `npm run build`
     a `node tools/screenshots/take.mjs` (složka `snimky/`). Sám si je
     prohlédni a cesty k nim předej `ux-checker`, ať posoudí i vzhled.
   - Opravuj jen BLOKUJÍCÍ nálezy. DOPORUČENÍ zůstanou v komentářích.
   - Po opravách zavolej znovu jen ty agenty, kteří vrátili VRÁTIT,
     a nový výsledek také ulož.
   - Když po dvou kolech oprav pořád něco blokuje, nepokračuj a napiš
     vlastníkovi, co a proč.
6. **Commit:** jeden commit za úkol, zpráva začíná `#<číslo issue>`.
   Testy a lint před commitem kontroluje hook.
7. Pokračuj skillem `predani-ukolu`.

## 4. Připomínky k předanému úkolu

Když vlastník po předání chce úpravu hotového úkolu (velikost, poloha,
barva, drobná změna chování), jde to rychlou cestou bez `issue-planner`
a `story-reviewer`. Nová funkce je vždy nový úkol (sekce 1).

1. Do issue napiš komentář, co vlastník chce změnit. Když se tím mění
   akceptační kritérium, napiš jeho nové znění.
2. Když se mění chování, které hlídají testy, nech testy upravit
   subagenta `test-writer` podle nového znění. Testy sám neupravuj.
3. Uprav kód, aby prošly `npm run test:changed`, `npm run lint`
   a `npm run build`.
4. Zavolej jen `reviewer` a výsledek ulož do issue. Když se měnil
   vzhled, udělej snímky obrazovky a prohlédni si je.
5. Commit ve větvi sprintu, zpráva začíná `#<číslo issue>`.
6. Pošli vlastníkovi odkaz na náhled, co se změnilo a snímky.
   Štítek zůstává „předáno“.
