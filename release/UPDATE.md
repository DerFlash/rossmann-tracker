# Sicher aktualisieren und zurückrollen

Diese Anleitung gilt für eine Release-Installation mit der gemeinsam angebotenen `docker-compose.yml`. Quellinstallationen mit `build: .` verwenden stattdessen den Ablauf in `docs/docker-tracker.md`.

## Vorprüfung und Sicherung

Im Installationsverzeichnis ausführen:

```bash
docker compose config --quiet
docker compose stop tracker
docker compose run --rm backup
docker compose start tracker
```

Der Sicherungsdienst besitzt keinen Netzwerkzugriff und bindet `data/` sowie `browser-data/` ausschließlich lesend ein. Eine vollständige Sicherung liegt danach unter `backups/<sicherungskennung>/` und enthält ein `manifest.json`. Schlägt die Sicherung fehl, den bisherigen Tracker mit `docker compose start tracker` wieder starten und nicht aktualisieren.

## Aktualisierung

Erst nach erfolgreicher Sicherung:

```bash
docker compose pull tracker
docker compose up -d tracker
docker compose ps
```

Der Status muss nach der Startphase `healthy` werden. Zusätzlich kann die lokale API geprüft werden:

```bash
curl -fsS http://127.0.0.1:8787/api/health
```

`data/`, `browser-data/` und `backups/` niemals veröffentlichen. Sie können Telegram-Zugangsdaten, Standortauswahl, Bestandsverlauf und Browser-Sitzungsdaten enthalten.

## Rollback auf das vorherige Image

In `.env` vorübergehend den letzten funktionierenden unveränderlichen Versionstag setzen:

```text
ROSSMANN_TRACKER_IMAGE=ghcr.io/level42-dev/rossmann-tracker:<vorherige-version>
```

Danach:

```bash
docker compose pull tracker
docker compose up -d tracker
```

Ist auch eine Rückkehr der lokalen Daten notwendig, den Tracker zuerst vollständig beenden. Die aktuellen Verzeichnisse nicht löschen, sondern beispielsweise in `data.failed` und `browser-data.failed` umbenennen. Anschließend `backups/<sicherungskennung>/data` und `backups/<sicherungskennung>/browser-data` als neue Verzeichnisse `data/` beziehungsweise `browser-data/` kopieren und den zuvor festgelegten Image-Tag starten.

Ein Backup niemals über die einzige vorhandene Kopie schreiben. Bei unklarem Zustand die fehlgeschlagene Installation gestoppt lassen und sowohl aktuelle Daten als auch Sicherung getrennt aufbewahren.
