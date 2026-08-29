# Fehlerbehebung

## Status prüfen

~~~bash
docker compose ps
docker compose logs --tail=200 tracker
curl -s http://127.0.0.1:8787/api/health
~~~

Die Weboberfläche zeigt Build-Version, Laufstatus, letzte Ergebnisse und flüchtige Laufzeitlogs.

## Häufige Fälle

### Rossmann liefert eine Client-Challenge

Der direkte HTTP-Abruf ist nicht ausreichend. Chromium bleibt Bestandteil des Trackers und führt die von Rossmann ausgelieferte Client-Challenge im normalen Browserkontext aus. Schutzmechanismen werden nicht nachgebaut oder umgangen.

### Filialen oder Produkte fehlen

Ersteinrichtung beziehungsweise Einstellungen öffnen und prüfen, ob mindestens ein PLZ-Suchgebiet oder eine konkrete Filiale sowie ein Produkt aktiviert sind.

### Telegram reagiert nicht

- Bot-Verbindung in der Weboberfläche kontrollieren,
- Bot in Telegram mit **Start** aktivieren,
- Testnachricht senden,
- bei kompromittiertem Token diesen über BotFather widerrufen und neu koppeln.

### Chromium startet nicht

Container neu erstellen und auf ausreichend Shared Memory achten. Die mitgelieferte Compose-Datei setzt **shm_size: 1gb**.

## Debugdaten sicher behandeln

Bei Browserfehlern können **data/rossmann-debug.png** und **data/rossmann-debug.json** entstehen. Diese Dateien können Website-, Standort- oder Sitzungsinformationen enthalten.

Vor einem Fehlerbericht:

1. Token, Chat-ID, PLZ, Filialen, lokale Pfade und Cookies entfernen,
2. nur den kleinsten notwendigen Ausschnitt bereitstellen,
3. Sicherheitsprobleme ausschließlich über [Private Vulnerability Reporting](../SECURITY.md) melden.

Vollständige **data/**- oder **browser-data/**-Verzeichnisse niemals hochladen.

## Update schlägt fehl

Den fehlerhaften Container stoppen und nicht wiederholt neu starten. In der beim Release enthaltenen `UPDATE.md` zuerst den vorherigen unveränderlichen Image-Tag setzen. Reicht das nicht aus, aktuelle `data/`- und `browser-data/`-Verzeichnisse getrennt aufbewahren und beide Verzeichnisse gemeinsam aus dem unmittelbar vor dem Update erstellten Snapshot wiederherstellen.

Sicherungen nicht verändern oder über die einzige vorhandene Kopie schreiben. `manifest.json` nennt den zugehörigen Anwendungs-, Revisions- und Einstellungs-Schemastand.
