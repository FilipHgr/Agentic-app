# Pen-Based Recognition of Handwritten Digits

Zdroj: E. Alpaydin, F. Alimoglu, _Pen-Based Recognition of Handwritten Digits_,
UCI Machine Learning Repository, https://doi.org/10.24432/C5MG6K
Licence: CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/).

- `pendigits.tra`: 30 pisatelů, 7 494 číslic. Jen z nich se připravují vzory
  pro rozpoznávání ve hře (upravené dílo podle CC BY 4.0).
- `pendigits.tes`: dalších 14 pisatelů, 3 498 číslic. Jen pro testy (#41),
  do buildu hry se nedostanou.

Formát: každý řádek je jedna číslice, 8 bodů (x, y) rovnoměrně po délce tahu,
souřadnice 0–100, osa y míří nahoru, poslední číslo je číslice 0–9.
Soubory jsou beze změn tak, jak je vydala UCI.
