# Telegram

Telegram ist der lokale Benachrichtigungs- und Steuerungskanal des Docker-Trackers. Verwendet wird ein eigener Bot des jeweiligen Betreibers; das Projekt stellt keinen zentralen Bot bereit.

## Bot verbinden

1. In Telegram **@BotFather** öffnen.
2. Mit **/newbot** einen Bot anlegen.
3. Den Bot-Token in der lokalen Weboberfläche eingeben.
4. Den dort angebotenen Bot-Link öffnen und in Telegram auf **Start** drücken.

Der Tracker übernimmt die Chat-ID aus diesem einmaligen Kopplungsvorgang. Token und Chat-ID werden ausschließlich lokal in **data/settings.json** gespeichert. Diese Datei darf nicht geteilt oder eingecheckt werden.

## Befehle

| Befehl | Zweck |
| --- | --- |
| /status | kompakter Tracker-Status |
| /results | letzte Einzelergebnisse |
| /logs [Anzahl] | letzte Logmeldungen |
| /check | manuellen Prüflauf starten |
| /pause, /resume | automatische Prüfungen pausieren oder fortsetzen |
| /settings | aktuelle Konfiguration anzeigen |
| /stores | aktive Suchgebiete und Filialen |
| /store_add &lt;PLZ&gt; | Suchgebiet oder Filiale auswählen |
| /store_remove | Suchgebiet oder Filiale entfernen |
| /products, /catalog | aktive Produkte oder Katalog anzeigen |
| /product_add, /product_remove | Produkte auswählen |
| /interval, /delay, /startup | Laufzeitparameter ändern |
| /notify | Benachrichtigungsregeln ändern |
| /baseline_reset | gespeicherten Ausgangsbestand zurücksetzen |
| /help | vollständige Befehlsübersicht |

Der Bot verarbeitet ausschließlich Nachrichten aus der gekoppelten Chat-ID. Bot-Token und Chat-ID lassen sich absichtlich nur in der lokalen Weboberfläche ändern.

Die lokale Speicherung verhindert keine Übertragung an Telegram: Nachrichten, Chat-ID, Anfragezeitpunkte und die öffentliche IP-Adresse des Betreibers fallen bei Aufrufen der Telegram Bot API technisch bei Telegram an. Jeder Betreiber verwendet einen eigenen Bot und entscheidet selbst über dessen Einsatz. Das Projekt betreibt keinen zentralen Bot und erhält diese Daten nicht.

## Token wechseln

In den Einstellungen **Neu verbinden** wählen und den neuen Token koppeln. Wenn ein Token versehentlich veröffentlicht wurde, muss er zuerst bei BotFather widerrufen und anschließend lokal ersetzt werden.
