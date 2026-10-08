# Pasek sesji

Karta nad promptem w Claude Code:

- wiersz 1: projekt · gałąź git · wiek sesji · liczba promptów · koszt | `last` (od ostatniej odpowiedzi) · model · `hit` (trafienie w prompt cache) · odliczanie cache
- wiersz 2: paski `ctx` (tokeny/okno), `5h` i `week` z czasem do resetu, oraz przyciski:
  - **Handoff** (`h`) — pojawia się, gdy kontekst przekroczy próg (domyślnie 35%), uruchamia skill `mattpocock-skills:handoff`
  - **Wytłumacz** (`w`) — uruchamia mod `wytlumacz` (`/wytlumacz`)

Opcje (`/config`): `progHandoff` (35), `skillHandoff` (`mattpocock-skills:handoff`), `cacheTtlMin` (60).

## Wymagania

Terminal: Claude Code 2.1.287+. Zakładka Code w aplikacji desktop: wbudowany Claude Code 2.1.286+ (`/status`). Po instalacji lub aktualizacji moda uruchom `/reload-plugins` albo otwórz nową sesję. Nie rysuje się w sesjach WSL ani w rozszerzeniu VS Code.

## Instalacja

```
/plugin marketplace add gawlik81/claude-mody
/plugin install pasek-sesji@pawel-mody
```

Lokalnie, z folderu: `claude --plugin-dir /ścieżka/do/pasek-sesji`.
