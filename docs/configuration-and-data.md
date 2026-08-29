# Konfiguration und Daten

## Auslieferungszustand

**tracker/config.example.json** enthält ausschließlich neutrale technische Standardwerte. Persönliche PLZ, Filialen, Produkte und Telegram-Zugangsdaten sind leer und werden erst bei der lokalen Ersteinrichtung gespeichert.

## Lokale Dateien

| Pfad | Inhalt |
| --- | --- |
| data/settings.json | Konfiguration und Telegram-Zugangsdaten |
| data/state.json | letzter Bestand und Bestandsverlauf |
| data/telegram-offset.json | Telegram-Polling-Position |
| data/update-check.json | Zeitpunkt und öffentliche Metadaten der letzten Stable-Updateprüfung |
| browser-data/ | Chromium-Profil |

Temporäre Debugdateien können bei Browserfehlern ebenfalls unter **data/** entstehen. Alle genannten Pfade sind lokal, persistent und von Repository sowie Docker-Build-Kontext ausgeschlossen.

`settings.json` enthält eine explizite Schemaversion. Ältere unversionierte Einstellungen werden als ursprüngliches Format gelesen und beim nächsten Speichern in das aktuelle Format geschrieben. Ein älterer Tracker verweigert dagegen Einstellungen mit einer unbekannten zukünftigen Schemaversion, statt sie möglicherweise verlustbehaftet zu überschreiben.

Konsistente Sicherungen umfassen immer gemeinsam `data/` und `browser-data/`. Der optionale Compose-Dienst `backup` erstellt sie bei gestopptem Tracker unter `backups/<sicherungskennung>/` und ergänzt ein Manifest mit Anwendungs-, Revisions- und Schemastand. Alle drei Verzeichnisse sind vertrauliche lokale Laufzeitdaten und dürfen nicht veröffentlicht werden.

## Externe Verbindungen

Die Anwendung läuft lokal, benötigt für ihre Funktionen aber Verbindungen zu externen Diensten:

| Dienst | Übertragene beziehungsweise technisch anfallende Daten | Zweck |
| --- | --- | --- |
| Rossmann | gewählte DAN, PLZ beziehungsweise Filialbezug, Anfragezeitpunkt und öffentliche IP-Adresse des Betreibers | Filialbestand abrufen |
| Telegram Bot API | Bot-Nachrichten, Chat-ID, Anfragezeitpunkt und öffentliche IP-Adresse des Betreibers | optionale Kopplung, Steuerung und Benachrichtigung |
| GitHub API | Anfrage nach öffentlichen Stable-Release-Metadaten, Anfragezeitpunkt und öffentliche IP-Adresse des Betreibers | deaktivierbare Updateprüfung |

Der Tracker übermittelt keine zentrale Telemetrie und betreibt keinen eigenen Nutzerdienst. Jeder selbst hostende Betreiber entscheidet selbst über die Aktivierung und Nutzung der externen Dienste und ist für seine Zugangsdaten und lokale Installation verantwortlich.

## Updateprüfung

Die Updateprüfung ist standardmäßig aktiviert und kann in der Weboberfläche vollständig abgeschaltet werden. Sie fragt serverseitig höchstens einmal innerhalb von 24 Stunden das neueste stabile Release von `DerFlash/rossmann-tracker` über die GitHub-API ab. Fehlgeschlagene Versuche werden ebenfalls bis zum nächsten Prüfzeitpunkt zwischengespeichert.

Die Anfrage enthält keine DANs, PLZ, Konfiguration, Telegram-Daten oder Installationskennung. Vorabversionen, Entwürfe, ungültige Versionstags und Release-Links außerhalb des offiziellen Repositorys werden nicht angeboten.

## Filialauswahl

Ein Suchgebiet speichert eine fünfstellige PLZ und berücksichtigt die von Rossmann dafür gelieferten Filialen. Alternativ können konkrete Filial-IDs ausgewählt werden. Mehrere Suchgebiete und mehrere Einzelstandorte sind möglich.

## Abfragegrenzen

Das automatische Prüfintervall beträgt standardmäßig 15 Minuten und kann nicht unter 5 Minuten gesetzt werden. Zwischen aufeinanderfolgenden Anfragen an Rossmann hält der Tracker mindestens 2 Sekunden Abstand und ergänzt eine zufällige Zusatzpause mit mindestens 500 Millisekunden konfigurierter Spannweite. Das gilt zentral auch für Wiederholungsversuche, Browser-Fallbacks und Filialsuchen.

Manuelle Bestandsprüfungen können höchstens einmal pro Minute gestartet werden. Ein bereits laufender Prüflauf blockiert weitere manuelle Starts. Ältere gespeicherte Einstellungen unterhalb der neuen Mindestwerte werden beim Laden auf 5 Minuten beziehungsweise 2 Sekunden angehoben.

## Bestandsverlauf

Der Tracker speichert nur Änderungen eines Produkt-/Filial-Paars sowie den aktuellen Endpunkt. Die Weboberfläche kann einzelne Produktreihen oder tatsächliche Zu- und Abgänge einer Filiale für verschiedene Zeiträume anzeigen.

## Sicherung und Wiederherstellung

1. Container stoppen.
2. **data/** und **browser-data/** mit lokal geeigneten Zugriffsrechten sichern.
3. Nach der Wiederherstellung Container starten und Status, Telegram sowie einen manuellen Prüflauf kontrollieren.

Eine Sicherung kann Bot-Token, Chat-ID, Suchgebiete und Bestandsdaten enthalten. Sie darf nicht in Issues, Pull Requests, öffentliche Cloud-Ordner oder das Repository gelangen.
