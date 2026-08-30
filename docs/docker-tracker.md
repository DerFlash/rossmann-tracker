# Docker-Tracker

Der Docker-Teil des **Rossmann Store Trackers** prüft ausgewählte Rossmann-Produkte regelmäßig, speichert Bestandsänderungen lokal und kann über Telegram benachrichtigen.

## Voraussetzungen

- Docker Engine mit Docker Compose 2.24 oder neuer oder eine aktuelle Version von Docker Desktop
- Zugriff auf die lokale Weboberfläche
- optional ein eigener Telegram-Bot für Benachrichtigungen

Das veröffentlichte Image unterstützt **linux/amd64** und **linux/arm64**. Weitere Mindestversionen werden pro Release in den Release Notes genannt.

## Empfohlene Installation aus dem Release

Die Release-Compose-Datei startet das fertig gebaute öffentliche Image aus der GitHub Container Registry. Git, Node.js, ein lokaler Build und ein GitHub-Login sind dafür nicht erforderlich.

### macOS und Linux

~~~bash
mkdir -p rossmann-tracker
cd rossmann-tracker
curl -fL -o docker-compose.yml \
  https://github.com/Level42-dev/rossmann-tracker/releases/latest/download/docker-compose.yml
docker compose up -d
~~~

### Windows PowerShell

~~~powershell
New-Item -ItemType Directory -Force rossmann-tracker
Set-Location rossmann-tracker
Invoke-WebRequest -Uri "https://github.com/Level42-dev/rossmann-tracker/releases/latest/download/docker-compose.yml" -OutFile "docker-compose.yml"
docker compose up -d
~~~

Compose lädt `ghcr.io/level42-dev/rossmann-tracker:stable` beim ersten Start automatisch. Ein vorheriges `docker pull` ist nicht notwendig. Die Weboberfläche ist anschließend unter <http://127.0.0.1:8787> erreichbar; der Port ist absichtlich nur an die lokale Loopback-Adresse gebunden.

## Installation aus dem Quellcode

Wer den aktuellen Quellstand lokal bauen oder am Projekt entwickeln möchte, verwendet die Root-Compose-Datei des Repositorys:

~~~bash
git clone https://github.com/Level42-dev/rossmann-tracker.git
cd rossmann-tracker
docker compose up -d --build
docker compose logs -f tracker
~~~

Diese Variante baut das Image lokal über `build: .`. Sie ist nicht der empfohlene Installationsweg für normale Nutzer und darf nicht mit der Release-Compose-Datei vermischt werden.

## Ersteinrichtung

Die Weboberfläche führt nacheinander durch:

1. auf Wunsch einen eigenen Telegram-Bot verbinden,
2. PLZ-Suchgebiet oder konkrete Filialen auswählen,
3. mindestens ein Katalogprodukt aktivieren.

Eine frische Installation enthält keine persönliche PLZ, Filiale, Produktauswahl, Chat-ID oder Zugangsdaten.

## Persistente Daten

Die Compose-Datei bindet zwei lokale Verzeichnisse ein:

- **data/**: Einstellungen, Telegram-Kopplung, letzter Zustand und Bestandsverlauf
- **browser-data/**: lokales Chromium-Profil für Rossmanns Client-Challenge

Beide Verzeichnisse sind von Git und vom Docker-Build-Kontext ausgeschlossen. Vor einer Sicherung sollte der Container gestoppt werden. Die Dateien dürfen nicht veröffentlicht oder einem Fehlerbericht ungeprüft beigefügt werden.

Die Compose-Dateien enthalten dafür einen nur bei Bedarf gestarteten Sicherungsdienst. Er besitzt keinen Netzwerkzugriff, liest `data/` und `browser-data/` nur lesend und schreibt einen vollständigen Snapshot mit Manifest nach `backups/`:

~~~bash
docker compose stop tracker
docker compose run --rm backup
docker compose start tracker
~~~

Schlägt der Sicherungslauf fehl, darf das Update nicht fortgesetzt werden. `backups/` ist ebenfalls von Git und Docker-Builds ausgeschlossen und muss wie die beiden Quelldatenverzeichnisse vertraulich behandelt werden.

## Betrieb

~~~bash
docker compose ps
docker compose logs -f tracker
docker compose restart tracker
~~~

Der Container benötigt keinen Docker-Socket und keine weitreichenden Host-Rechte. Einstellungen werden über die lokale Weboberfläche geändert.

## Manuelles Update einer Release-Installation

Die empfohlene Release-Installation verwendet das veröffentlichte GHCR-Image. Vor dem Update wird der laufende Tracker konsistent gesichert:

~~~bash
docker compose config --quiet
docker compose stop tracker
docker compose run --rm backup
docker compose start tracker
docker compose pull
docker compose up -d
~~~

Das Release enthält zusätzlich `UPDATE.md` mit dem vollständigen Vorprüfungs- und Rollbackablauf. Die optionale Datei `default.env.example` kann als Vorlage heruntergeladen und bei Bedarf als `.env` gespeichert werden.

## Manuelles Update einer Quellinstallation

Wer das Repository geklont hat, verwendet die Root-Compose-Datei mit **build: .**. Diese Installation wird aus dem Quellstand aktualisiert:

~~~bash
git pull --ff-only
docker compose config --quiet
docker compose stop tracker
docker compose run --rm backup
docker compose up -d --build
~~~

Persistente Verzeichnisse bleiben bei beiden Wegen erhalten. Der Tracker-Container läuft mit schreibgeschütztem Root-Dateisystem, ohne zusätzliche Linux-Capabilities und ohne Docker-Socket; beschreibbar bleiben nur die ausdrücklich eingebundenen Laufzeitverzeichnisse und temporärer Speicher. Die beiden Compose-Dateien dürfen nicht vermischt werden. Hinweise zu Versionstags, Rollback und Release-Artefakten stehen unter [Versionen und Releases](releases.md).

## Einmalige Namensumstellung

Private Entwicklungsinstallationen vor der Umbenennung verwendeten den festen Container-Namen **rossmann-dan-tracker**. Der öffentliche Name lautet **rossmann-store-tracker**. Falls Docker beim ersten Aktualisieren beide Container meldet, den alten Compose-Stand zuerst mit **docker compose down** beenden und danach den aktuellen Stand neu starten. Die eingebundenen Verzeichnisse **data/** und **browser-data/** werden dadurch nicht gelöscht.
