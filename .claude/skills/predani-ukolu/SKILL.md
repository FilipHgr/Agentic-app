---
name: predani-ukolu
description: Předání hotového úkolu vlastníkovi – kontroly, push, odkaz na náhled na Cloudflare a PR na konci sprintu. Použij vždy, když je úkol ze sprintu hotový, nebo když se sprint uzavírá.
---

# Předání úkolu

## 1. Kontroly před pushem

1. Spusť `npm test`, `npm run lint` a `npm run build`. Všechno musí projít.
2. Přečti si vlastní diff: žádné ladicí výpisy, nepoužité importy ani
   změny mimo úkol.
3. Spusť `npm audit` a poznamenej si vysoké a kritické nálezy.

## 2. Push a náhled

1. Pushni větev sprintu: `git push -u origin sprint-<číslo>`.
2. Cloudflare Workers Builds po pushi postaví náhled sám. Nikdy nespouštěj
   `npm run deploy`, `wrangler deploy` ani `wrangler preview`.
3. Pošli vlastníkovi:
   - odkaz na náhled
     `https://sprint-<číslo>-agentic-app.hegerfilip027.workers.dev`
     (název větve malými písmeny),
   - co je hotové (číslo a název issue),
   - co má ve hře zkontrolovat, hlavně to, co testy neověřují
     (animace, vzhled, chování na iPadu),
   - tabulku: akceptační kritérium → test.
4. Pokud kontrola „Workers Builds“ selže nebo náhled nejde ověřit, řekni
   to na rovinu.

## 3. Konec sprintu a PR

Sprint končí jen tehdy, když to výslovně řekne vlastník. Uzavření sprintu
ani PR sám nenavrhuj, ani když jsou všechny úkoly hotové. Po pokynu
vlastníka hned otevři PR:

1. Z `sprint-<číslo>` do `staging`, nikdy do `main`.
2. Vyplň šablonu `.github/pull_request_template.md`: `Closes #…` pro každý
   úkol, co se změnilo, odkaz na náhled, tabulka kritérií a testů, nové
   závislosti, výsledek `npm audit` a drobnosti mimo úkoly.
3. Pošli vlastníkovi odkaz na PR. Slučuje vlastník.
4. Po otevření PR přidá bot Cloudflare do PR komentář s výsledkem
   nasazení náhledu. Zkontroluj, že je tam „Success“, a jinak to řekni.

## 4. Po sloučení

`Closes #…` zavírá issue jen při sloučení do `main`, ne do `staging`.
Až vlastník napíše, že PR sloučil:

1. Ověř, že PR je opravdu sloučený.
2. Zavři issues sprintu ručně jako dokončené.
