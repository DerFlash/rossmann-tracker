# Saubere Grenze für das öffentliche Repository

Die bisherigen Repositorys bleiben private Entwicklungsarchive. Sie werden nicht öffentlich geschaltet, und ihre Historien werden nicht in das Veröffentlichungsrepository importiert.

## Warum kein Force-Push?

Ein Squash oder Force-Push entfernt alte Commits nicht zuverlässig aus GitHub. Bereits bekannte Commit-SHAs, Caches, Klone, Forks und insbesondere nicht überschreibbare Pull-Request-Refs können weiterhin auf ältere Objekte verweisen. GitHub beschreibt diese Grenzen in der Anleitung zum [Entfernen sensibler Daten aus einer Repository-Historie](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository).

Beim Wechsel eines privaten Repositorys zu „public“ werden außerdem vorhandene Actions-Verläufe und Logs öffentlich. Deshalb bildet ein neues Repository die eindeutigere technische Veröffentlichungsgrenze. Siehe [GitHub-Dokumentation zur Repository-Sichtbarkeit](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/managing-repository-settings/setting-repository-visibility).

## Zielbild

- Die bisherigen Entwicklungsrepositorys bleiben privat und werden nicht als öffentliches Projekt verlinkt.
- `DerFlash/rossmann-tracker` wird das einzige offizielle öffentliche Repository.
- Das Veröffentlichungsrepository erhält keine Commits, Pull-Request-Refs, Releases, Packages, Workflow-Artefakte oder Caches aus den Entwicklungsarchiven.
- Seine Historie beginnt mit einem neutralen, codefreien Startpunkt und genau einem vollständig geprüften Projekt-Snapshot.
- Die im neuen privaten Repository selbst entstehenden Review- und CI-Metadaten müssen vor der Freigabe vollständig veröffentlichbar sein.

## Ablauf

### 1. Entwicklungsstand festhalten

1. Alle vorgesehenen Vorarbeiten in den privaten Entwicklungsrepositorys abschließen.
2. Den finalen geprüften Quellstand eindeutig festhalten.
3. Repository-spezifische Links, OCI-Metadaten und Release-Gates auf `DerFlash/rossmann-tracker` umstellen.
4. Sicherstellen, dass aus den Entwicklungsarchiven kein Release-Workflow mehr als offizielles Projekt veröffentlicht.
5. Keine Branches, Tags, Releases, Packages oder Git-Historie aus den Entwicklungsarchiven übertragen.

### 2. Finalen Snapshot erzeugen

1. Die Git-basierte Veröffentlichungshygiene muss vor dem Export laufen und die mit `git ls-files` ermittelte Dateiliste vollständig prüfen.
2. Ausschließlich den festgehaltenen Git-Baum exportieren, nicht ein veränderliches Arbeitsverzeichnis.
3. Alle Dateien vor dem ersten Projekt-Commit auf Klarname, personenbezogene Werte, lokale Pfade, Secrets und alte Repository-Zielkennungen prüfen.
4. Repository-Verweise und Release-Ziele auf das neue Veröffentlichungsrepository anpassen.
5. Die exportierte Dateiliste und ihre Inhalte erneut prüfen.

### 3. Neues Repository zunächst privat prüfen

1. Das neue Repository `DerFlash/rossmann-tracker` privat und ohne importierte Historie anlegen.
2. Auf `main` einen neutralen Root-Commit anlegen, der ausschließlich `PUBLICATION_BASE.md` enthält und keinen Projektcode.
3. Vom Root-Commit einen Kandidaten-Branch erstellen und dort den vollständigen geprüften Snapshot hinzufügen.
4. Einen Pull Request gegen `main` öffnen. Dadurch umfassen Diff, CI und Copilot-Review den gesamten später öffentlichen Projektstand.
5. Findings beheben und den Review-Zyklus wiederholen, bis CI, Copilot, Threads und manueller Abschlussreview vollständig grün sind.
6. Den Kandidaten per Squash mergen.

### 4. Öffentliche Freigabe vorbereiten

1. Prüfen, dass keine unerwarteten Branches, Tags, Releases, Packages oder Artefakte existieren.
2. Sämtliche Pull-Request-Metadaten, Actions-Läufe und Logs des neuen Repositorys auf veröffentlichbare Inhalte prüfen.
3. Branch-Schutz, Private Vulnerability Reporting, Discussions und das geschützte Environment `stable-release` konfigurieren.
4. Repository-Beschreibung, Themen, Ko-fi-Link und offizielle Projektverweise kontrollieren.
5. Einen letzten anonymen Dry-Run der Installationsdokumentation ohne produktive Veröffentlichung durchführen.

### 5. Bewusster Veröffentlichungsschritt

1. Repository-Sichtbarkeit erst nach einem ausdrücklichen Go auf `public` setzen.
2. Öffentliche Ansicht, Quellcode-Archive, README, Lizenz und Community-Dateien anonym prüfen.
3. Erst danach den manuellen ersten Stable-Release starten.
4. GHCR-Paket, anonymen Image-Pull, Release-Artefakte und Installations-Smoke-Tests kontrollieren.

## Abbruch und Rollback

Bis zum Sichtbarkeitswechsel kann das neue Repository ohne öffentliche Auswirkungen verworfen und aus dem geprüften Snapshot neu aufgebaut werden. Nach der öffentlichen Freigabe gilt die veröffentlichte Historie als dauerhaft; Korrekturen erfolgen dann nachvollziehbar über neue Commits und Releases, nicht durch routinemäßige History-Rewrites.
