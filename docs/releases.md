# Versionen und Build-Metadaten

Der Rossmann Store Tracker verwendet [Semantic Versioning](https://semver.org/). Die maßgebliche Quellversion steht in `tracker/package.json`; Git-Tags und spätere GitHub Releases tragen dieselbe Version mit vorangestelltem `v`.

Vorerst existiert ausschließlich der Releasekanal `stable`. Vorabversionen werden nicht als reguläres Update angeboten.

## Laufzeitinformationen

Der Tracker stellt seine Build-Metadaten ohne lokale Konfigurations- oder Nutzungsdaten über `/api/status` und `/api/health` bereit:

```json
{
  "build": {
    "version": "0.4.0",
    "revision": "development",
    "builtAt": null,
    "channel": "stable"
  }
}
```

Die Weboberfläche zeigt dieselben Angaben im Bereich „Tracker-Status“. Lokale Builds verwenden die Paketversion und die Kennzeichnung `development`.

## Reproduzierbare Abhängigkeiten

`tracker/package-lock.json` fixiert den vollständigen Node-Abhängigkeitsbaum. Entwicklung, CI und Container-Build verwenden deshalb `npm ci` statt einer frei auflösenden Installation.

```bash
cd tracker
npm ci
npm test
```

## Metadaten für Release-Builds

Ein Release-Build übergibt Version, vollständige Git-Revision und UTC-Buildzeit als Docker-Build-Argumente:

```bash
docker build \
  --build-arg APP_VERSION="$(node -p "require('./tracker/package.json').version")" \
  --build-arg APP_REVISION="$(git rev-parse HEAD)" \
  --build-arg APP_BUILD_DATE="$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  .
```

Gesetzte Build-Argumente werden zur Laufzeit validiert und zusätzlich als OCI-Image-Labels hinterlegt. Ohne Argumente verwendet die Anwendung weiterhin die Version aus `tracker/package.json` und kennzeichnet die Revision als `development`; die OCI-Labels für Version und Buildzeit bleiben dann leer. Der spätere Release-Workflow setzt alle drei Werte automatisch. Für einen lokalen Entwicklungs-Build sind sie nur notwendig, wenn auch dessen Image-Labels vollständig sein sollen.

## Multi-Arch-Prüfung

Die CI baut das vollständige Container-Image für `linux/amd64` und `linux/arm64`. Der ARM64-Build läuft dabei über QEMU. Beide Ergebnisse werden ausschließlich in den BuildKit-Cache exportiert: Ein Pull Request veröffentlicht weder ein Container-Image noch einen Tag oder ein Release.

Damit prüft jeder relevante Quellstand frühzeitig, ob das fest versionierte Playwright-Basisimage und sämtliche Dockerfile-Schritte beide vorgesehenen Architekturen unterstützen. Die Veröffentlichung in GHCR bleibt Aufgabe des getrennten Stable-Release-Workflows.

## Stable-Release-Workflow

Stable-Releases werden bewusst manuell über den GitHub-Actions-Workflow „Stable-Release“ gestartet. Der Workflow akzeptiert ausschließlich den aktuellen Stand von `main`; Pull Requests, normale Pushes und andere Branches können keine Pakete oder Releases veröffentlichen.

Vor dem ersten Lauf muss das Repository öffentlich sein. Zusätzlich wird in den Repository-Einstellungen ein Environment namens `stable-release` eingerichtet, auf `main` begrenzt und mit einer erforderlichen manuellen Freigabe durch DerFlash geschützt. Damit erhält erst der eigentliche Veröffentlichungsjob Schreib- und OIDC-Rechte; Tests und Vorprüfungen laufen ausschließlich lesend. Checkout speichert den GitHub-Schreib-Token nicht im Arbeitsverzeichnis.

Vor der Veröffentlichung muss die gewünschte Version in `tracker/package.json` und `tracker/package-lock.json` über einen regulären Pull Request angehoben werden. Der Release-Workflow führt anschließend erneut alle Tests und die Veröffentlichungshygiene aus und prüft, dass weder Git-Tag, GitHub Release noch versioniertes Container-Image bereits existieren.

Bei erfolgreicher Prüfung veröffentlicht der Workflow dasselbe Image für `linux/amd64` und `linux/arm64` unter:

```text
ghcr.io/derflash/rossmann-tracker:<version>
ghcr.io/derflash/rossmann-tracker:stable
```

Der konkrete Versionstag wird nicht wiederverwendet und muss strikt größer als alle bisherigen Stable-Releases sein. Das Image erhält zunächst die validierten Build-Metadaten und eine signierte GitHub-Attestation. Digest, beide Zielarchitekturen und die OCI-Metadaten werden geprüft. Erst wenn das Image außerdem ohne Anmeldung abrufbar ist, wird `stable` auf exakt dessen Digest weiterbewegt. Nach einer weiteren Registry-Prüfung erzeugt der Workflow das GitHub Release samt `docker-compose.yml`, `default.env.example` und `UPDATE.md`.

Bricht ein Lauf nach dem Push des Versionstags ab, kann derselbe Commit erneut gestartet werden. Ein bereits vorhandenes Image wird ausschließlich dann weiterverwendet, wenn Digest, Version, Revision, Buildzeit und beide Plattformen den erwarteten Release-Metadaten entsprechen. Netzwerk-, Authentifizierungs- und API-Fehler werden dabei nicht als „noch nicht vorhanden“ ausgelegt.

Das Zusammenführen des Workflows selbst veröffentlicht noch nichts. Sollte das erste GHCR-Paket trotz öffentlichem Repository zunächst privat angelegt werden, stoppt der Workflow vor `stable` und GitHub Release. Nach der einmaligen öffentlichen Freigabe des Pakets kann derselbe Workflow-Lauf gefahrlos neu gestartet werden.

## Installation und manuelles Update

Für normale Nutzer ist die Release-Installation vorgesehen. Die veröffentlichte Compose-Datei verwendet standardmäßig den Kanal `stable`; persistente Einstellungen, History und Browserprofil liegen lokal in `data/` und `browser-data/`.

### Erstinstallation unter macOS und Linux

```bash
mkdir -p rossmann-tracker
cd rossmann-tracker
curl -fL -o docker-compose.yml \
  https://github.com/DerFlash/rossmann-tracker/releases/latest/download/docker-compose.yml
docker compose up -d
```

### Erstinstallation unter Windows PowerShell

```powershell
New-Item -ItemType Directory -Force rossmann-tracker
Set-Location rossmann-tracker
Invoke-WebRequest -Uri "https://github.com/DerFlash/rossmann-tracker/releases/latest/download/docker-compose.yml" -OutFile "docker-compose.yml"
docker compose up -d
```

Compose lädt `ghcr.io/derflash/rossmann-tracker:stable` beim ersten Start automatisch. Ein separates `docker pull` ist nicht erforderlich. Die Weboberfläche ist danach unter <http://127.0.0.1:8787> erreichbar.

Die GHCR-Paketansicht kann zusätzlich einen von der Build-Attestation erzeugten Eintrag mit einem Namen wie `sha256-…` hervorheben. Dieser Eintrag dokumentiert die Build-Provenienz und ist kein unterstützter Laufzeittag. Für Installationen werden ausschließlich `stable` oder ein konkreter Versionstag wie `0.4.0` verwendet.

Wer eine Version unveränderlich festhalten möchte, lädt die optionale Release-Datei `default.env.example`, speichert sie als `.env` und setzt darin beispielsweise:

```text
ROSSMANN_TRACKER_IMAGE=ghcr.io/derflash/rossmann-tracker:0.4.0
```

Vor einem Update wird der laufende Tracker gestoppt und über den netzwerkisolierten Compose-Dienst `backup` gesichert. Er liest die persistenten Verzeichnisse nur lesend und schreibt einen atomar fertiggestellten Snapshot samt Version und Schemastand nach `backups/`. Erst nach erfolgreicher Sicherung wird das neue Image geladen:

```bash
docker compose config --quiet
docker compose stop tracker
docker compose run --rm backup
docker compose start tracker
docker compose pull
docker compose up -d
```

Die als Release-Artefakt angebotene `docker-compose.yml` verwendet das fertige GHCR-Image. Sie unterscheidet sich bewusst von der Root-Compose-Datei des Quellrepositorys, die mit `build: .` lokal baut. Beide Installationswege dürfen nicht vermischt werden. Jedes Release enthält zusätzlich `UPDATE.md` mit Vorprüfung, konsistenter Sicherung und Rollback.

Der Tracker erhält weder Zugriff auf den Docker-Socket noch die Möglichkeit, sich selbst zu aktualisieren. Gespeicherte Einstellungen tragen eine explizite Schemaversion; Daten aus einer unbekannten zukünftigen Version werden nicht stillschweigend mit einem älteren Container geöffnet.

## Updatehinweis in der Weboberfläche

Der Container prüft standardmäßig höchstens einmal innerhalb von 24 Stunden die öffentliche GitHub-API auf das neueste Stable-Release. Das Ergebnis liegt ausschließlich lokal in `data/update-check.json`; die Prüfung kann in den Einstellungen deaktiviert werden. GitHub-Entwürfe und Vorabversionen werden ignoriert.

Ist eine neuere semantische Version verfügbar, zeigt der Tracker Versionsnummer, Release Notes, eine aus den Release Notes abgeleitete Sicherheitskennzeichnung und den manuellen Aktualisierungsweg an. Er lädt kein Image selbst herunter, schreibt nicht auf den Docker-Socket und startet keine Container neu.

Die bereitgestellte Compose-Datei setzt Docker Compose 2.24 oder neuer voraus, weil die optionale `.env`-Datei über `env_file.required` beschrieben wird.
