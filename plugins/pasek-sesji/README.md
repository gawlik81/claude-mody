# Pasek sesji

Karta nad promptem w Claude Code:

- wiersz 1: projekt · gałąź git · wiek sesji · liczba promptów · koszt | `last` (od ostatniej odpowiedzi) · model · `hit` (trafienie w prompt cache) · odliczanie cache
- wiersz 2: paski `ctx` (tokeny/okno), `5h` i `week` z czasem do resetu, oraz przyciski:
  - **Handoff** (`h`) — pojawia się, gdy kontekst przekroczy próg (domyślnie 35%), uruchamia skill `session-handoff-prompt`
  - **Wytłumacz** (`w`) — uruchamia mod `wytlumacz` (`/wytlumacz`)

Opcje (`/config`): `progHandoff` (35), `skillHandoff` (`session-handoff-prompt`), `cacheTtlMin` (60).

## Instalacja

```
/plugin marketplace add OWNER/REPO
/plugin install pasek-sesji@pawel-mody
```

Lokalnie, z folderu: `claude --plugin-dir /ścieżka/do/pasek-sesji`.
