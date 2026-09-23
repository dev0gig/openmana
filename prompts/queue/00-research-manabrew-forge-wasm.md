# 00 — Research: ManaBrew / Forge WebAssembly

## Ziel

Noch **nichts implementieren**. Untersuche, wie OpenMana Forge vollständig browserlokal betreiben kann, ohne Odin/Tailscale und ohne eigenen Forge-Server.

Lies zuerst:
- `README.md`
- `docs/BIBLE.md`
- `docs/ANVIL_LESSONS.md`

Nutze außerdem das bestehende Repository `dev0gig/anvil` als Referenz, insbesondere `PROTOKOLL.md` und – soweit zugänglich – den bisherigen `forge-anvil`-Ansatz.

## Research

Untersuche den **aktuellen** Stand von:
1. ManaBrew: Wie wird Forge im Browser/WASM ausgeführt?
2. Forge upstream: Welche Module, Card Scripts, Editions, Tokens und Ressourcen braucht ein vollständiges Spiel?
3. Buildchain: GraalVM/Web Image/WASM, benötigte Versionen, Build-Schritte und relevante Einschränkungen.
4. Browser-Integration: JS/TS ↔ Forge, Worker/Main Thread, Speicher, Startup, Dateisystem/Ressourcen.
5. OpenMana-Bridge: Kann der vorhandene Anvil-Protokollgedanke bzw. `forge-anvil` sinnvoll weiterverwendet werden? Was muss angepasst werden, wenn kein WebSocket/Server mehr dazwischenliegt?
6. Updates: Wie kann Forge als klar getrennte, gepinnte Engine aktualisiert und neu gebaut werden, ohne OpenMana-UI-Code anzufassen?
7. Vercel/PWA: Kann das resultierende WASM samt Ressourcen sinnvoll statisch ausgeliefert/gecached werden? Relevante Größen-/Header-/Caching-Probleme nennen.
8. Android-Browser/Foldable: erkennbare WASM-/Memory-/Performance-Risiken.
9. Lizenzen/Attribution: Forge, ManaBrew und unmittelbar übernommene relevante Komponenten. Keine Vermutungen – konkrete Lizenzdateien/Quellen prüfen.
10. Risiken: Was könnte das Vorhaben technisch verhindern oder erheblich erschweren?

## Wichtig

- **Keinen OpenMana-Client bauen.**
- Keine UI-Komponenten erstellen.
- Keine Architektur aus Bequemlichkeit ändern.
- Forge bleibt die Regel- und KI-Engine.
- Scryfall/IndexedDB/Arena-Import sind hier nur relevant, wenn sie die Forge-WASM-Architektur direkt beeinflussen.
- Bevorzuge Primärquellen: aktuelle Repositories, Build-Dateien, Dokumentation und Lizenzdateien.
- Wenn ManaBrew etwas anders löst als unsere Bible vorsieht, dokumentiere den Unterschied statt die Bible still zu ändern.
- Research kompakt halten: Wir brauchen belastbare Entscheidungen, keine allgemeine Einführung in WebAssembly.

## Ergebnisse

Erstelle:

### `docs/research/MANABREW_WASM.md`
Konkreter technischer Ablauf von ManaBrew: Forge → Browser/WASM, relevante Dateien/Module/Buildschritte und was davon für OpenMana nützlich ist.

### `docs/research/FORGE_BUILD.md`
Welche Forge-Komponenten/Ressourcen OpenMana braucht, wie sie gebaut/gepackt werden und wie ein Forge-Update später isoliert ablaufen kann.

### `docs/research/LICENSES.md`
Geprüfte Lizenzen und daraus erkennbare Pflichten für Forge, ManaBrew und konkret relevante übernommene Komponenten. Quellen/Dateipfade angeben.

### `docs/research/OPENMANA_ENGINE_PLAN.md`
Kurzer, konkreter Architekturentscheid für OpenMana:
- empfohlene Buildchain
- Repo-/Submodule-Struktur
- Bridge Forge ↔ TypeScript
- Worker/Main-Thread-Entscheidung
- Ressourcen/Card-Scripts
- Updatepfad
- Vercel/PWA-Auslieferung
- bekannte Risiken
- klare Aussage: **Go / Go mit Bedingungen / Blockiert**

Am Ende eine kleine Tabelle **„Offene Fragen vor Implementierung“**. Nur echte Blocker/Entscheidungen aufnehmen.

## Abschluss

Keine Implementierung beginnen. Committe ausschließlich die Research-Dokumentation. Der nächste Queue-Prompt wird erst anhand dieser Ergebnisse erstellt.
