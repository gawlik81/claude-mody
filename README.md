# pawel-mody

Marketplace modów do Claude Code (terminal i zakładka Code w aplikacji desktop).

| Mod | Co robi |
| --- | --- |
| [`pasek-sesji`](plugins/pasek-sesji) | Karta nad promptem: kontekst, limity 5h/tydzień, koszt, cache; przycisk **Handoff** powyżej 35% kontekstu i **Wytłumacz** |
| [`wytlumacz`](plugins/wytlumacz) | `/wytlumacz` — po polsku i prostym językiem wyjaśnia, co Claude właśnie zrobił |

## Instalacja

```
/plugin marketplace add OWNER/REPO
/plugin install pasek-sesji@pawel-mody
/plugin install wytlumacz@pawel-mody
/reload-plugins
```

Albo z terminala:

```
claude plugin marketplace add OWNER/REPO
claude plugin install pasek-sesji@pawel-mody
claude plugin install wytlumacz@pawel-mody
```

Aktualizacja po nowym commicie: `claude plugin marketplace update pawel-mody`, potem `claude plugin update <mod>@pawel-mody`.

## Rozwój

```
claude plugin validate .
claude plugin validate plugins/<mod>
claude plugin test plugins/<mod>
claude --plugin-dir plugins/<mod>     # uruchomienie z folderu
```

Nowy mod: folder w `plugins/` + wpis w `.claude-plugin/marketplace.json`. Przy zmianie podbij `version` w jego `plugin.json`.
