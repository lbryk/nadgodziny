# Zasady obliczeń

Dokument opisuje dokładnie to, co robi `packages/core/src/engine.ts`. Wszystkie obliczenia są wykonywane w
`decimal.js` (bez błędów zmiennoprzecinkowych typu `0.9 × 7 = 6.300000000000001`), a do ekranu zaokrąglane
do dwóch miejsc po przecinku.

## Wymiar (pensum) i etat

`pensum = godziny z umowy`. Pełny etat to 18, 20, 22 lub 30 godz. (lista konfigurowana przez admina), niepełny —
dowolna liczba godzin (3/4, 1/2, 1/4 lub wpisana). Nadgodziny liczy się od tego wymiaru.

## Wariant 1 — godziny uśrednione

```
ważone        = k12 × w12 + k34 × w34 + k5 × w5      (+ indywidualne × w, gdy wliczone do etatu)
tygodniowo    = max(0, ważone − pensum)
miesięcznie   = zaokrąglij(tygodniowo × 4,16)         (domyślnie: do najbliższej godziny)
```

Wagi domyślne: kl. 1–2 = **1**, kl. 3–4 = **0,9**, kl. 5 = **0,8**. Każdy miesiąc (wrzesień–czerwiec)
dostaje te same nadgodziny — „czy pracuje się więcej czy mniej, dostaje się uśrednione nadgodziny zawsze”.

**Nieobecność w miesiącu** (przykład dyrektora, wrzesień 2026, 3 dni):

```
16 : 22 (dni robocze)  = 0,73
0,73 × 3               = 2,18   → zaokrąglenie → 2
16 − 2                 = 14     godzin do wypłaty
```

Dni nieobecności biorą się z wydarzeń (wycieczka, szkolenie, nieobecność) albo są wpisane ręcznie. Wydarzenie na
część dnia liczy się ułamkiem (`odpadające godziny ÷ godziny tego dnia`).

Zastępstwa, nauczanie indywidualne, wycieczki i egzaminy ustne są **dodawane oddzielnie** i nie wchodzą do uśredniania.

## Wariant 2 — według realnego przydziału

Tabela ma 48 wierszy: tygodnie pn–pt **przecięte granicą miesiąca** (księgowość rozlicza pełne miesiące). Dla każdego
dnia kalkulator ustala godziny z przydziału:

1. godziny z rozkładu tygodniowego (osobno kl. 1–2, 3–4, 5, indywidualne);
2. klasy 5 znikają po dacie końca zajęć (30.04.2027);
3. wydarzenia: praktyki zerują wybrane grupy klas, wycieczka/szkolenie/nieobecność zerują dzień lub odejmują godziny;
4. ręczna wartość komórki (`3`, `3+1`) wygrywa nad wszystkim.

Dni wolne (szare) nie mają godzin i nie wchodzą do obowiązku. **Dni egzaminów** (żółte) są neutralne — „w dni
przeznaczone na egzaminy nadgodziny nie są płacone”.

### Pensum uśrednione

Pensum trzeba wypracować średnio w całym roku. Dla wiersza `r` z `d_r` dniami zajęć: `waga_r = d_r / 5`,
`godziny_r` — godziny w wierszu. Obowiązek roczny `O = pensum × Σ waga_r`, nadwyżka `A = Σ godziny_r − O`.

Pensum uśrednione `p̄` to próg tygodniowy spełniający:

```
Σ max(0, godziny_r − p̄ × waga_r) = A
```

Funkcja jest wypukła i kawałkami liniowa, więc rozwiązujemy ją dokładnie (bez iteracji), idąc od najbardziej
obciążonego tygodnia. Efekt: tygodnie z praktykami lub bez klas 5 nie dają nadgodzin, a nadwyżka z pozostałych
tygodni jest dokładnie tą, która faktycznie przekracza pensum w skali roku — stąd „21 zamiast 18”.

```
nadgodziny wiersza = max(0, godziny_r − p̄ × waga_r)
miesięcznie        = zaokrąglij(Σ nadgodziny wierszy miesiąca)
```

Gdy rok nie ma nadwyżki, `p̄` nie istnieje i nadgodzin nie ma. Pensum można też wpisać ręcznie.

## Pozycje rozliczane odrębnie

| Pozycja                                      | Skąd                                                                                                   |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Zastępstwa                                   | wydarzenia „Zastępstwo” (płatne) + ręczny dopisek w miesiącu; „w okienku” → niepłatne                  |
| Nauczanie indywidualne                       | komórki `3+1` / rozkład (wariant 2 i 1) lub ręcznie; **wliczone do etatu** → nie jest płatne dodatkowo |
| Wycieczki, egzaminy ustne, asystent/operator | wydarzenia z godzinami „rozliczane odrębnie” (miesiąc rozpoczęcia)                                     |

## Zaokrąglanie

Domyślnie do najbliższej pełnej godziny (połówka w górę). Admin może wybrać „w górę” lub „w dół”.
