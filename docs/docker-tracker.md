# Docker-Tracker

Der Docker-Teil des **Rossmann Store Trackers** prüft ausgewählte Rossmann-Produkte regelmäßig, speichert Bestandsänderungen lokal und kann über Telegram benachrichtigen.

## Voraussetzungen

- Docker Engine mit Docker Compose oder Docker Desktop
- Zugriff auf die lokale Weboberfläche
- ein eigener Telegram-Bot für Benachrichtigungen

Unterstützte Plattformen und Mindestversionen werden pro Release in den Release Notes genannt. Der Quellstand wird in CI für **linux/amd64** und **linux/arm64** gebaut.

## Installation aus dem Repository

~~~bash
git clone https://github.com/DerFlash/rossmann-tracker.git
cd rossmann-tracker
docker compose up -d --build
docker compose logs -f tracker
~~~

Die Weboberfläche ist anschließend unter <http://127.0.0.1:8787> erreichbar. Der Port ist absichtlich nur an die lokale Loopback-Adresse gebunden.

## Ersteinrichtung

Die Weboberfläche führt nacheinander durch:

1. eigenen Telegram-Bot verbinden,
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

## Manuelles Update einer Source-Installation

Wer das Repository geklont hat, verwendet die Root-Compose-Datei mit **build: .**. Diese Installation wird aus dem Quellstand aktualisiert:

~~~bash
git pull --ff-only
docker compose config --quiet
docker compose stop tracker
docker compose run --rm backup
docker compose up -d --build
~~~

## Manuelles Update einer Release-Installation

Die bei einem GitHub Release angebotene **docker-compose.yml** verwendet dagegen das veröffentlichte GHCR-Image. Die Compose-Datei und die optionale **.env.example** werden gemeinsam in einem eigenen Installationsverzeichnis gespeichert. Dort gilt:

~~~bash
docker compose config --quiet
docker compose stop tracker
docker compose run --rm backup
docker compose start tracker
docker compose pull
docker compose up -d
~~~

Persistente Verzeichnisse bleiben bei beiden Wegen erhalten. Der Tracker-Container läuft mit schreibgeschütztem Root-Dateisystem, ohne zusätzliche Linux-Capabilities und ohne Docker-Socket; beschreibbar bleiben nur die ausdrücklich eingebundenen Laufzeitverzeichnisse und temporärer Speicher. Die beiden Compose-Dateien dürfen nicht vermischt werden. Hinweise zu Versionstags, Rollback und Release-Artefakten stehen unter [Versionen und Releases](releases.md). Release-Installationen erhalten zusätzlich `UPDATE.md` mit dem vollständigen Vorprüfungs- und Rollbackablauf.

## Einmalige Namensumstellung

Private Entwicklungsinstallationen vor der Umbenennung verwendeten den festen Container-Namen **rossmann-dan-tracker**. Der öffentliche Name lautet **rossmann-store-tracker**. Falls Docker beim ersten Aktualisieren beide Container meldet, den alten Compose-Stand zuerst mit **docker compose down** beenden und danach den aktuellen Stand neu starten. Die eingebundenen Verzeichnisse **data/** und **browser-data/** werden dadurch nicht gelöscht.
