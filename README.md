# pawel-mody

Marketplace modów do Claude Code (terminal i zakładka Code w aplikacji desktop).

| Mod | Co robi |
| --- | --- |
| [`pasek-sesji`](plugins/pasek-sesji) | Karta nad promptem: kontekst, limity 5h/tydzień, koszt, cache; przycisk **Handoff** powyżej 35% kontekstu i **Wytłumacz** |
| [`wytlumacz`](plugins/wytlumacz) | `/wytlumacz` — po polsku i prostym językiem wyjaśnia, co Claude właśnie zrobił |

## Wymagania

Mody działają w terminalu od Claude Code 2.1.287 i w zakładce Code aplikacji desktop od wbudowanego Claude Code 2.1.286 (sprawdź `/status`, wiersz **Claude Code**). Starsza wersja ładuje wtyczkę, ale nie uruchamia moda, więc nic się nie pojawia. Mody nie działają w sesjach WSL ani w rozszerzeniu VS Code (hooki tak, rysowanie nie).

### Przycisk Handoff

Przycisk **Handoff** w `pasek-sesji` korzysta ze skilla `handoff` z [mattpocock/skills](https://github.com/mattpocock/skills) (`/mattpocock-skills:handoff`). Bez tej wtyczki przycisk nie zadziała, więc zainstaluj ją:

```
/plugin install mattpocock-skills@claude-plugins-official
```

## Instalacja

```
/plugin marketplace add gawlik81/claude-mody
/plugin install pasek-sesji@gawlik81-claude-mody
/plugin install wytlumacz@gawlik81-claude-mody
/reload-plugins
```

Albo z terminala:

```
claude plugin marketplace add gawlik81/claude-mody
claude plugin install pasek-sesji@gawlik81-claude-mody
claude plugin install wytlumacz@gawlik81-claude-mody
```

Aktualizacja po nowym commicie: `claude plugin marketplace update gawlik81-claude-mody`, potem `claude plugin update <mod>@gawlik81-claude-mody`.

## Rozwój

```
claude plugin validate .
claude plugin validate plugins/<mod>
claude plugin test plugins/<mod>
claude --plugin-dir plugins/<mod>     # uruchomienie z folderu
```

Nowy mod: folder w `plugins/` + wpis w `.claude-plugin/marketplace.json`. Przy zmianie podbij `version` w jego `plugin.json`.
