# Rossmann Store Tracker

**Inoffizieller Community-Tracker für Rossmann-Filialbestände**

Filialbestände bei Rossmann prüfen, Änderungen verfolgen und auf Wunsch per Telegram benachrichtigt werden – lokal, kostenlos und inoffiziell.

💬 **Community:** In der [WhatsApp-Community](https://chat.whatsapp.com/ELMb90gBK1cGDPbKX3eKZ1) könnt ihr euch zum Tracker austauschen und gegenseitig unterstützen.

> [!IMPORTANT]
> Angezeigte Werte sind Buchbestände und können vom tatsächlichen Regalbestand abweichen. Das Projekt ist unabhängig von der Dirk Rossmann GmbH und wird von ihr weder angeboten noch unterstützt.

## Welche Variante passt zu mir?

| Variante | Geeignet für | Einstieg |
| --- | --- | --- |
| **Docker-Tracker** | automatische Prüfungen, Bestandsverlauf und Telegram-Benachrichtigungen | [Schnellstart](#docker-tracker-schnellstart) |
| **Browser-Bookmarklet** | spontane Einzelprüfungen ohne dauerhaft laufenden Dienst | [Installation](#bookmarklet-installieren) |

## Funktionen

- mehrere Produkte und Rossmann-Filialen gleichzeitig überwachen
- Filialauswahl per PLZ-Suchgebiet oder konkreter Filial-ID
- Benachrichtigungen bei Restock, Ausverkauf und Bestandsänderungen
- Bestandsverlauf mit Einzelprodukt-Graph und filialweiter Übersicht echter Zu- und Abgänge
- Filter für Produkt, Filiale und Zeitraum
- lokale Weboberfläche für Einrichtung, Konfiguration, Status und Logs
- Telegram-Steuerung per Slash-Commands
- JSON- und XML-Verarbeitung sowie Browser-Fallback bei abgewiesenen Direktabfragen
- persistente Einstellungen und Bestände über Container-Neustarts hinweg

## Docker-Tracker: Schnellstart

Voraussetzung ist eine laufende Docker-Installation, beispielsweise Docker Desktop.

```bash
git clone https://github.com/DerFlash/rossmann-tracker.git
cd rossmann-tracker
docker compose up -d --build
docker compose logs -f tracker
```

Danach die Weboberfläche unter <http://127.0.0.1:8787> öffnen. Die geführte Ersteinrichtung verbindet Telegram, wählt Filialen und aktiviert Produkte. Eine `.env`- oder `config.json`-Datei ist für neue Installationen nicht erforderlich.

Der Dienst ist ausschließlich an `127.0.0.1` gebunden. Einstellungen, Zustand und Browserprofil werden lokal in `data/` und `browser-data/` gespeichert.

## Bookmarklet installieren

1. [`rossmann-dan-bookmarklet.html`](rossmann-dan-bookmarklet.html) herunterladen und lokal öffnen.
2. Den roten Button **Rossmann Store Tracker** in die Lesezeichen- oder Favoritenleiste ziehen.
3. Das Lesezeichen anklicken. Falls noch keine Rossmann-Seite geöffnet ist, leitet es zunächst dorthin weiter.

Nach einem Bookmarklet-Update muss das bisherige Lesezeichen ersetzt werden.

## Dokumentation

Weiterführende Informationen werden versioniert im Verzeichnis [`docs/`](docs/) gepflegt:

| Thema | Inhalt |
| --- | --- |
| [Docker-Tracker](docs/docker-tracker.md) | Installation, Aktualisierung und Betrieb |
| [Telegram](docs/telegram.md) | Kopplung, Befehle und Benachrichtigungslogik |
| [Bookmarklet](docs/bookmarklet.md) | Installation, Bedienung und lokale Speicherung |
| [Konfiguration und Daten](docs/configuration-and-data.md) | Einstellungen, Suchgebiete, Zustand und History |
| [Fehlerbehebung](docs/troubleshooting.md) | Diagnose, Debug-Dateien und bekannte Sonderfälle |
| [Produktkatalog und DANs](docs/product-catalog.md) | Katalogpflege, Eingabeformat und Produktstatus |
| [Versionen und Build-Metadaten](docs/releases.md) | Semantische Versionierung, reproduzierbare Installation und Release-Buildwerte |
| [Saubere Veröffentlichungsgrenze](docs/publication-boundary.md) | Übergang vom privaten Entwicklungsarchiv zum geprüften öffentlichen Repository |

## Projekt und Unterstützung

Mehr zum inoffiziellen und nichtkommerziellen Charakter des Projekts steht auf der Seite [Über den Rossmann Store Tracker](docs/about.md). Die geplanten Schritte bis zur öffentlichen Bereitstellung sind im [Veröffentlichungsfahrplan](ROADMAP.md) festgehalten.

Dieses rein private Hobbyprojekt wird kostenlos und nichtkommerziell bereitgestellt. Wenn es dir hilft, kannst du meine Arbeit freiwillig über [Ko-fi](https://ko-fi.com/derflash) unterstützen. Die Unterstützung ist ein optionales persönliches Dankeschön und **keine Spende im steuer- oder gemeinnützigkeitsrechtlichen Sinn**. Sie vermittelt weder Gegenleistung noch zusätzliche Funktionen, Nutzungsrechte oder bevorzugten Support.

## Lizenz und Mitarbeit

Der Rossmann Store Tracker ist **source-available und kein klassisches Open-Source-Projekt**. Die unveränderte offizielle Version darf nach PolyForm Strict 1.0.0 für nichtkommerzielle Zwecke verwendet werden; die zusätzliche Projekterlaubnis gestattet private, nichtkommerzielle Veränderungen ausschließlich für den eigenen Gebrauch. Eigenständige Veröffentlichungen, Releases, Pakete, Container-Images und gehostete Varianten durch Dritte werden nicht zusätzlich erlaubt. GitHubs Nutzungsbedingungen räumen bei öffentlichen Repositorys unabhängig davon Plattformrechte zum Ansehen und Forken innerhalb GitHubs ein; weitergehende Nutzung richtet sich nach [`LICENSE.md`](LICENSE.md).

Maßgeblich sind [`LICENSE.md`](LICENSE.md) und [`CONTRIBUTING.md`](CONTRIBUTING.md). Pull Requests erfordern die ausdrückliche Zustimmung zum [`Contributor Grant`](CONTRIBUTOR_LICENSE_AGREEMENT.md). Der dokumentierte [Best-Effort-Veröffentlichungscheck](docs/legal-review.md) ist keine Rechtsberatung oder externe juristische Freigabe und nennt die verbleibenden Risiken und offenen Freigabepunkte.

## Projektstruktur

```text
rossmann-dan-bookmarklet.html   Bookmarklet-Installer
products.json                  gemeinsamer Produkt- und DAN-Katalog
docker-compose.yml             lokaler Docker-Betrieb
tracker/
  public/index.html            Verwaltungsoberfläche
  src/                         Tracker, Telegram und Zustandslogik
  test/                        automatisierte Tests
```

## Entwicklung

Der Tracker benötigt Node.js 22 oder neuer.

```bash
cd tracker
npm ci
npm test
```

Vor einem Pull Request zusätzlich:

```bash
node ../scripts/check-publication-hygiene.mjs
```

## Technischer Hinweis

Die Bestandsprüfung verwendet Rossmanns Filialsuche im Kontext von `rossmann.de`:

```text
/storefinder/.rest/store?dan=<DAN>&q=<PLZ>
```

Das Projekt umgeht keine Zugangskontrolle oder Client-Challenge. Einzelne Rossmann-Abfragen haben mindestens 2 Sekunden Abstand plus Zufallsverzögerung; automatische Prüfungen laufen frühestens alle 5 Minuten und manuelle Prüfungen höchstens einmal pro Minute. Temporäre Fehler überschreiben keinen zuletzt bekannten Bestand. Bei Bestandsabfragen werden DAN, PLZ beziehungsweise Filialauswahl und die öffentliche IP-Adresse technisch an Rossmann übertragen; Telegram-Benachrichtigungen nutzen die Telegram Bot API. Details stehen unter [Konfiguration und Daten](docs/configuration-and-data.md) und [Telegram](docs/telegram.md).
