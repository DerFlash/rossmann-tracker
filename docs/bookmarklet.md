# Bookmarklet

Das Bookmarklet ermöglicht spontane Bestandsprüfungen direkt auf **rossmann.de**, ohne einen dauerhaft laufenden Container.

## Installation

1. [rossmann-dan-bookmarklet.html](../rossmann-dan-bookmarklet.html) herunterladen und lokal öffnen.
2. Den Button **Rossmann Store Tracker** in die Lesezeichen- oder Favoritenleiste ziehen.
3. Das Lesezeichen auf einer Rossmann-Seite anklicken.

Wird es außerhalb von **rossmann.de** gestartet, öffnet es zunächst die Rossmann-Seite. Dort muss das Lesezeichen erneut angeklickt werden. Nach einem Update wird das alte Lesezeichen durch das neu erzeugte ersetzt.

## Bedienung

- eine fünfstellige PLZ eingeben,
- optional konkrete Filialen aus den Rossmann-Treffern auswählen,
- Produkte im Format **Name | DAN** oder nur als DAN eintragen,
- **Bestand prüfen** starten.

Ohne konkrete Filialauswahl werden alle von Rossmann für die PLZ gelieferten Treffer ausgewertet.

## Lokale Speicherung

PLZ, Produktliste und Filialauswahl liegen ausschließlich im Local Storage des Browsers. Das Bookmarklet sendet diese Angaben nur an die Rossmann-Filialsuche, die für die angeforderte Bestandsprüfung benötigt wird.

Browserdaten können über die Website-Einstellungen des Browsers gelöscht werden. Das Bookmarklet besitzt keine Verbindung zur Docker-Installation und übernimmt deren Konfiguration nicht.
