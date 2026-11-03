---
name: novy-ukol
description: Navržení nového úkolu do hry jako GitHub issue (user story a akceptační kritéria ke schválení) a zahájení práce na schváleném úkolu. Použij, když vlastník chce nový úkol, další návrhy, nebo napíše, že issue schválil.
---

# Nový úkol

Úkoly vymýšlí Claude, vlastník je jen schvaluje nebo upravuje. Nic z toho
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
   `.github/ISSUE_TEMPLATE/user-story.md` se štítkem „ke schválení“.
   Obsah vezmi z návrhu beze změn. Nevyřešená DOPORUČENÍ od
   `story-reviewer` přidej do issue jako komentář.
4. Najednou navrhni jeden úkol, pokud vlastník nechce víc.
5. Pošli vlastníkovi odkaz na issue, v jedné větě o čem je a proč teď.

## 2. Schválení

Claude nesleduje issues sám, o schválení se dozví jen z chatu. Vlastník
nemusí psát „ok“ na dvě místa:

- „ok“ (nebo „ok #číslo“) v chatu = schváleno bez připomínek,
- připomínky v chatu = zapracuj je do těla issue,
- „připomínky v issue“ v chatu = přečti si komentáře v issue
  a zapracuj je do těla issue.

Připomínky zapracovává `issue-planner` a upravený návrh znovu
kontroluje `story-reviewer`, stejně jako v kroku 1. Pak teprve
přepiš tělo issue a pošli vlastníkovi, co se změnilo.

Po schválení:

1. Nezodpovězená otevřená otázka znamená, že platí doporučení. Napiš
   to vlastníkovi.
2. Do issue přidej komentář, že vlastník úkol schválil v chatu, a co
   z připomínek bylo zapracováno.
3. Změň štítek na „schváleno“.

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
4. **Implementace:** dělej, dokud neprojdou všechny testy. Testy od
   `test-writer` neupravuj, aby prošly. Když je test podle tebe špatně,
   řekni proč a nech ho opravit subagentem `test-writer`.
5. **Kontroly:** zavolej s číslem issue subagenty `reviewer`,
   `security-auditor` a (pokud se měnilo cokoli v `src/scenes/` nebo
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
