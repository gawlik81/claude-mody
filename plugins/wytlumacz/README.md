# Wytłumacz

Mod do Claude Code (terminal i zakładka Code w aplikacji desktop), który po polsku i prostym językiem wyjaśnia, co Claude właśnie zrobił. Na bazie [explain-it](https://github.com/ruthannbravo/explain-it) (Ruth-Ann Bravo, MIT).

Panel „Wytłumacz mi” pokazuje sekcje: **W SKRÓCIE**, **CO SIĘ STAŁO**, **DLACZEGO**, **SŁÓWKA** (2–4 terminy, zapamiętuje już poznane), **TERAZ ZRÓB**.

| Komenda | Co robi |
| --- | --- |
| `/wytlumacz` | Wyjaśnia ostatnią pracę w tej sesji |
| `/wytlumacz ostatnie` | Podsumowuje poprzednią sesję |
| `/wytlumacz historia` | Zapisane wyjaśnienia (◀ Starsze / Nowsze ▶) |

Opcja `pasek` (domyślnie wyłączona): propozycja „Wytłumacz” nad promptem po turze, która coś zmieniła. Przy modzie `pasek-sesji` zostaw wyłączoną — tam jest przycisk **Wytłumacz** (`w`).

## Instalacja

```
/plugin marketplace add gawlik81/claude-mody
/plugin install wytlumacz@pawel-mody
```

Lokalnie, z folderu: `claude --plugin-dir /ścieżka/do/wytlumacz`.

Wszystko zostaje lokalnie: dziennik tur i poznane słówka trzyma lokalny magazyn pluginu.
