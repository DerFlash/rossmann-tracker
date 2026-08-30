# Rossmann Store Tracker

**Inoffizieller Community-Tracker für Rossmann-Filialbestände**

Rossmann-Bestände einfach prüfen: **spontan per Browser-Check** oder **automatisch im Hintergrund mit Verlauf und Telegram-Benachrichtigungen**.

> [!TIP]
> **💬 WhatsApp-Community**
>
> Optionaler Community-Chat für Austausch und gegenseitige Hilfe zum Tracker: **[Jetzt beitreten →](https://chat.whatsapp.com/ELMb90gBK1cGDPbKX3eKZ1)**

> [!IMPORTANT]
> Angezeigte Werte sind Buchbestände und können vom tatsächlichen Regalbestand abweichen. Das Projekt ist unabhängig von der Dirk Rossmann GmbH und wird von ihr weder angeboten noch unterstützt.

## 🚀 Start hier

### ⚡ 1. Aktiver Bestands-Check – am einfachsten zum Ausprobieren

**Du willst jetzt kurz prüfen, ob ein Produkt in Rossmann-Filialen in deiner Nähe Bestand hat? Dann nimm diese Variante.**

Kein Docker, kein GitHub-Login und keine Kommandozeile: Ein kleines **Bookmarklet** wird einmal als Browser-Favorit gespeichert und öffnet danach den Bestands-Check direkt auf `rossmann.de`.

1. [`rossmann-dan-bookmarklet.html`](rossmann-dan-bookmarklet.html) herunterladen und öffnen.
2. Den roten Button **Rossmann Store Tracker** in die Favoriten-/Lesezeichenleiste ziehen.
3. Den neuen Favoriten anklicken, PLZ prüfen und **Bestand prüfen** wählen.

➡️ **[Bebilderte Schritt-für-Schritt-Anleitung zum aktiven Bestands-Check](docs/bookmarklet.md)**

### 🤖 2. Automatischer Tracker – überwacht für dich

**Du möchtest ausgewählte Produkte und Filialen regelmäßig überwachen und bei Änderungen benachrichtigt werden? Dann ist der Docker-Tracker die richtige Variante.**

Er läuft lokal auf deinem Rechner oder Server, speichert Bestandsverläufe und kann Restocks, Ausverkäufe und andere Änderungen per Telegram melden. Für die normale Installation brauchst du im Wesentlichen **Docker Desktop / Docker Compose**; Git und Node.js sind nicht erforderlich.

➡️ **[Bebilderte Installation und Ersteinrichtung des automatischen Trackers](docs/docker-tracker.md)**

### Welche Variante passt zu mir?

| Du möchtest … | Empfehlung |
| --- | --- |
| einmal schnell nach Bestand schauen | **⚡ Aktiver Bestands-Check** |
| ohne technische Einrichtung starten | **⚡ Aktiver Bestands-Check** |
| regelmäßig automatisch prüfen lassen | **🤖 Automatischer Tracker** |
| Bestandsänderungen und Verlauf sehen | **🤖 Automatischer Tracker** |
| Telegram-Benachrichtigungen erhalten | **🤖 Automatischer Tracker** |

## Funktionen

### Aktiver Bestands-Check

- spontane Bestandsprüfung direkt auf `rossmann.de`
- PLZ-Suchgebiet oder konkrete Filiale auswählen
- mehrere Produkte/DANs in einem Durchlauf prüfen
- PLZ, Produktliste und Filialauswahl lokal im Browser merken

### Automatischer Tracker

- mehrere Produkte und Rossmann-Filialen regelmäßig überwachen
- Benachrichtigungen bei Restock, Ausverkauf und Bestandsänderungen
- Bestandsverlauf mit Einzelprodukt-Graph und filialweiter Übersicht echter Zu- und Abgänge
- Filter für Produkt, Filiale und Zeitraum
- lokale Weboberfläche für Einrichtung, Konfiguration, Status und Logs
- Telegram-Steuerung per Slash-Commands
- persistente Einstellungen und Bestände über Container-Neustarts hinweg

## Dokumentation

Die ausführliche Dokumentation liegt versioniert unter [`docs/`](docs/). Für Einsteiger sind diese beiden Seiten der beste Start:

| Thema | Inhalt |
| --- | --- |
| [⚡ Aktiver Bestands-Check](docs/bookmarklet.md) | bebilderte Installation und erste Bestandsprüfung |
| [🤖 Automatischer Tracker](docs/docker-tracker.md) | bebilderte Docker-Installation und Ersteinrichtung |
| [Telegram](docs/telegram.md) | Kopplung, Befehle und Benachrichtigungslogik |
| [Konfiguration und Daten](docs/configuration-and-data.md) | Einstellungen, Suchgebiete, Zustand und History |
| [Fehlerbehebung](docs/troubleshooting.md) | Diagnose, Debug-Dateien und bekannte Sonderfälle |
| [Produktkatalog und DANs](docs/product-catalog.md) | Katalogpflege, Eingabeformat und Produktstatus |
| [Versionen und Build-Metadaten](docs/releases.md) | Semantische Versionierung, reproduzierbare Installation und Release-Buildwerte |
| [Saubere Veröffentlichungsgrenze](docs/publication-boundary.md) | Übergang vom privaten Entwicklungsarchiv zum geprüften öffentlichen Repository |

## Installation aus dem Quellcode

Die Installation aus dem Quellcode ist **nur für Entwicklung oder eigene lokale Builds** gedacht. Normale Nutzer sollten den oben beschriebenen Release-Weg verwenden.

```bash
git clone https://github.com/Level42-dev/rossmann-tracker.git
```

➡️ [Quellinstallation und technische Betriebsdetails](docs/docker-tracker.md#installation-aus-dem-quellcode)

## Projekt und Unterstützung

Mehr zum inoffiziellen und nichtkommerziellen Charakter des Projekts steht auf der Seite [Über den Rossmann Store Tracker](docs/about.md). Die geplanten Schritte bis zur öffentlichen Bereitstellung sind im [Veröffentlichungsfahrplan](ROADMAP.md) festgehalten.

Dieses rein private Hobbyprojekt wird kostenlos und nichtkommerziell bereitgestellt. Wenn es dir hilft, kannst du meine Arbeit freiwillig über [Ko-fi](https://ko-fi.com/derflash) unterstützen. Die Unterstützung ist ein optionales persönliches Dankeschön und **keine Spende im steuer- oder gemeinnützigkeitsrechtlichen Sinn**. Sie vermittelt weder Gegenleistung noch zusätzliche Funktionen, Nutzungsrechte oder bevorzugten Support.

## Lizenz und Mitarbeit

Der Rossmann Store Tracker ist **source-available und kein klassisches Open-Source-Projekt**. Die unveränderte offizielle Version darf nach PolyForm Strict 1.0.0 für nichtkommerzielle Zwecke verwendet werden; die zusätzliche Projekterlaubnis gestattet private, nichtkommerzielle Veränderungen ausschließlich für den eigenen Gebrauch. Eigenständige Veröffentlichungen, Releases, Pakete, Container-Images und gehostete Varianten durch Dritte werden nicht zusätzlich erlaubt. GitHubs Nutzungsbedingungen räumen bei öffentlichen Repositorys unabhängig davon Plattformrechte zum Ansehen und Forken innerhalb GitHubs ein; weitergehende Nutzung richtet sich nach [`LICENSE.md`](LICENSE.md).

Maßgeblich sind [`LICENSE.md`](LICENSE.md) und [`CONTRIBUTING.md`](CONTRIBUTING.md). Pull Requests erfordern die ausdrückliche Zustimmung zum [`Contributor Grant`](CONTRIBUTOR_LICENSE_AGREEMENT.md). Der dokumentierte [Best-Effort-Veröffentlichungscheck](docs/legal-review.md) ist keine Rechtsberatung oder externe juristische Freigabe und nennt die verbleibenden Risiken und offenen Freigabepunkte.

## Projektstruktur

```text
rossmann-dan-bookmarklet.html   Installer für den aktiven Bestands-Check
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
