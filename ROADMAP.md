# Fahrplan: Rossmann Store Tracker

Stand: 28. August 2026

Dieser Fahrplan sammelt die strategischen Entscheidungen und die noch notwendigen Schritte für eine spätere öffentliche Bereitstellung. Er ist bewusst von der technischen Detaildokumentation in der README getrennt.

## Scope- und Entscheidungsprinzip

Der aktuelle funktionale Projektstand bildet die verbindliche Ausgangsbasis. Verhalten, Bedienung und technische Details bleiben grundsätzlich **as-is**, sofern dieser Fahrplan keine konkrete Änderung vorsieht.

Im Zuge der Veröffentlichung werden keine Funktionen vorsorglich neu entworfen. Änderungen erfolgen nur, wenn sie für Veröffentlichung, Sicherheit, Datenschutz, Lizenzierung, Portabilität, zuverlässige Releases oder einen bereits festgestellten Fehler notwendig sind. Übliche Implementierungsdetails werden innerhalb dieser Leitplanken pragmatisch entschieden und nicht einzeln vorab abgestimmt. Eine neue Nutzerentscheidung wird nur eingeholt, wenn mehrere Varianten das Produkt, die Rechte, die Daten oder den Betriebsaufwand wesentlich unterschiedlich beeinflussen.

## Leitbild

Der **Rossmann Store Tracker** soll als kostenloses, nichtkommerzielles und inoffizielles Community-Werkzeug veröffentlicht werden. Er hilft dabei, von Rossmann bereitgestellte Filialbestände anhand der DAN zu prüfen und Bestandsänderungen zu beobachten.

Das Projekt bleibt unabhängig von der Dirk Rossmann GmbH. Es gibt keine Garantie für die Richtigkeit der angezeigten Buchbestände, die tatsächliche Warenverfügbarkeit oder die dauerhafte Funktionsfähigkeit der verwendeten Rossmann-Schnittstellen.

## Festgelegte Grundentscheidungen

- **Projektname:** Rossmann Store Tracker
- **Untertitel:** Inoffizieller Community-Tracker für Rossmann-Filialbestände
- **Kurzbeschreibung:** Filialbestände bei Rossmann prüfen, Änderungen verfolgen und auf Wunsch per Telegram benachrichtigt werden – lokal, kostenlos und inoffiziell.
- **Charakter:** rein privates, inoffizielles und nichtkommerzielles Hobby- und Community-Projekt
- **Veröffentlichung:** offizielle Versionen werden ausschließlich durch den privaten [`Project Maintainer`](LICENSE.md#project-maintainer) veröffentlicht; unabhängige Veröffentlichungen oder Ableitungen außerhalb des in [`CONTRIBUTING.md`](CONTRIBUTING.md) und `LICENSE.md` vorgesehenen Beitragsprozesses sind nicht erlaubt
- **Rechte- und Lizenzgeber:** der in `LICENSE.md` definierte Project Maintainer ausschließlich als Privatperson
- **Nutzung:** kostenlos; private, nichtkommerzielle Nutzung und Anpassung sollen erlaubt sein
- **Mitarbeit:** Beiträge zum offiziellen Projekt sind ausdrücklich erwünscht und werden über Issues und Pull Requests eingebracht
- **Öffentliche Historie:** die bisherigen Entwicklungsrepositorys bleiben dauerhaft privat; veröffentlicht wird ein neu angelegtes Repository mit einem neutralen codefreien Root-Commit und genau einem vollständig geprüften Snapshot-Commit
- **Produktumfang:** der Tracker und der gemeinsame DAN-Katalog sind grundsätzlich für alle Rossmann-Produkte offen; Pokémon/TCG bleibt der anfängliche Katalogschwerpunkt
- **Dokumentation:** weiterführende Dokumentation wird versioniert unter `/docs` im Repository gepflegt; bestehende Wiki-Inhalte werden dorthin migriert
- **Plattformansatz:** portable Linux-Container über Docker Compose statt hostabhängiger Installation
- **Plattformunterstützung:** Docker Engine unter Linux sowie Docker Desktop unter macOS und Windows für `linux/amd64` und `linux/arm64`; offiziell unterstützt werden nur Kombinationen, die den jeweiligen Release-Smoke-Test bestanden haben, weitere Kombinationen gelten als Best Effort
- **Abfrageintervalle:** 15 Minuten Standardintervall, 5 Minuten technische Untergrenze sowie mindestens 2 Sekunden Pause plus zufällige Verzögerung zwischen einzelnen Rossmann-Abfragen; auch manuelle Prüfungen werden gegen schnelles Wiederholen begrenzt
- **Updatekanal:** die Anwendung berücksichtigt vorerst ausschließlich stabile Releases; ein auswählbarer Beta- oder Nightly-Kanal ist nicht vorgesehen
- **Updateverhalten:** die Anwendung erkennt neue stabile Versionen und weist darauf hin; die Aktualisierung selbst wird vom Nutzer manuell durchgeführt
- **Update-Datenschutz:** keinerlei Telemetrie; die Anwendung fragt höchstens einmal innerhalb von 24 Stunden die neueste stabile Version bei GitHub ab, speichert das Ergebnis lokal zwischen und übermittelt dabei weder DANs noch PLZ, Konfiguration oder Installationskennung; die Prüfung lässt sich deaktivieren
- **Release-Lebenszyklus:** öffentliche `v0.x`-Versionen können als manuell installierbare GitHub-Pre-Releases für freiwillige Tests erscheinen und werden von der stabilen Updateprüfung ignoriert; `v1.0.0` folgt erst nach erfüllten Freigabekriterien
- **Beitragsfreigabe:** ein kurzer Contributor Grant wird direkt in `CONTRIBUTING.md` aufgenommen und bei externen Pull Requests ausdrücklich per technisch geprüftem Pflichtfeld bestätigt; ein externer CLA-Dienst ist nicht vorgesehen
- **Release-Artefakte:** öffentlicher Quellcode, versionierte GitHub Releases und fertige Multi-Arch-Images über GHCR
- **Community-Kanäle:** GitHub Issues für Fehler und konkrete Aufgaben sowie GitHub Discussions für Fragen, Ideen und allgemeinen Austausch; keine persönliche Support-E-Mail
- **DAN-Beiträge:** neue Produkte können niedrigschwellig über ein strukturiertes Issue-Formular oder direkt per Pull Request vorgeschlagen werden; Format und Duplikate werden automatisiert geprüft, die Aufnahme erfolgt erst nach inhaltlicher Kontrolle
- **Ko-fi-Platzierung:** GitHub-Seitenleiste über `.github/FUNDING.yml`, ein kurzer Hinweis in der README und eine ausführlichere Erklärung auf der „Über“-Seite
- **Visueller Auftritt:** eigenständige, moderne und charaktervolle Gestaltung ohne Rossmann-Logo, Centaur, Typografie oder nachgeahmten offiziellen Markenauftritt
- **Kontakt zu Rossmann:** keine proaktive Kontaktaufnahme vor der Veröffentlichung; auf eventuelle Rückfragen oder Beanstandungen wird sachlich reagiert
- **Sicherheitsmeldungen:** vertraulich über GitHubs Private Vulnerability Reporting und dokumentiert in `SECURITY.md`; keine persönliche Support-E-Mail und keine zugesicherte Reaktionszeit
- **Finanzierung:** keine Bezahlversion, kein Abonnement und keine kostenpflichtigen Zusatzfunktionen
- **Unterstützung:** rein private, freiwillige Ko-fi-Unterstützung; sie vermittelt weder Gegenleistung noch zusätzliche Nutzungsrechte oder bevorzugten Support
- **Datenschutz:** Einstellungen, Bestände, Browserprofil und Telegram-Zugangsdaten bleiben beim selbst betriebenen Tracker lokal

## Produktaufteilung

### Bookmarklet

Die niedrigschwellige Variante für spontane manuelle Bestandsprüfungen direkt auf `rossmann.de`:

- keine dauerhaft laufende Installation
- keine zentrale Datenspeicherung
- kostenlos und frei zugänglich
- geeignet für gelegentliche Prüfungen

### Docker-Hintergrundtracker

Die erweiterte Variante für regelmäßige Prüfungen und Benachrichtigungen:

- lokaler, selbst betriebener Docker-Container
- geführte Ersteinrichtung
- Filial- und Produktauswahl
- Bestandsverlauf und Änderungsüberwachung
- Telegram-Benachrichtigungen und Steuerung
- keine zentral von uns betriebene Nutzerplattform

## Lizenz- und Beitragsmodell

Festgelegt ist ein **Source-available-Modell**, ausdrücklich kein klassisches Open Source.

Als Grundlage ist die **PolyForm Strict License 1.0.0** vorgesehen. Eine ergänzende, projektspezifische Erlaubnis soll folgende Rechte eindeutig einräumen:

- Ausführen der unveränderten offiziellen Version für nichtkommerzielle Zwecke entsprechend PolyForm Strict 1.0.0
- private Veränderungen für den eigenen Gebrauch
- öffentliche GitHub-Forks ausschließlich zur Vorbereitung eines Beitrags zum offiziellen Projekt
- Einreichung von Änderungen über Pull Requests

Nicht erlaubt sein sollen insbesondere:

- Veröffentlichung einer eigenständigen veränderten Version
- eigene Releases, Installationspakete oder Container-Images
- öffentliche Mirrors außerhalb des vorgesehenen Beitragsprozesses
- Betrieb einer abgewandelten Version als öffentlicher oder kommerzieller Dienst
- Nutzung von Projektname, Auftritt oder Dokumentation in einer Weise, die eine offizielle Variante oder Verbindung zu Rossmann suggeriert

Für Beiträge wird zusätzlich ein kurzer Contributor Grant direkt in `CONTRIBUTING.md` aufgenommen. Beitragende behalten das Urheberrecht an ihrem eigenen Code, räumen dem Project Maintainer aber die notwendigen dauerhaften Rechte ein, um angenommene Beiträge in offiziellen Versionen zu verwenden, zu verändern, zu veröffentlichen und im Rahmen des offiziellen Projekts neu zu lizenzieren. Die Zustimmung erfolgt bewusst durch das Einreichen des Pull Requests und eine verpflichtende Checkbox im Pull-Request-Template; ein externer CLA-Dienst ist nicht vorgesehen.

Der unveränderte PolyForm-Strict-Text und die getrennte projektspezifische Zusatzgenehmigung liegen in `LICENSE.md`. Der Contributor Grant ist separat dokumentiert und wird im Pull-Request-Template ausdrücklich bestätigt. Die interne Best-Effort-Prüfung und ihre Restrisiken sind in `docs/legal-review.md` festgehalten; sie ist keine Rechtsberatung oder externe juristische Freigabe. GitHubs Nutzungsbedingungen räumen bei öffentlichen Repositorys unabhängig von der Projektlizenz Plattformrechte zum Ansehen und Forken innerhalb GitHubs ein. Die zusätzliche Projekterlaubnis regelt weitergehende Änderungen und Verteilungen im Beitragsprozess und erlaubt keine eigenen Releases, Images oder unabhängigen Veröffentlichungen.

## Freiwillige Unterstützung über Ko-fi

Ko-fi dient ausschließlich als Möglichkeit, sich freiwillig für die Entwicklungsarbeit zu bedanken.

Die GitHub-Projektseite verwendet analog zu BinderPokedex eine `.github/FUNDING.yml` mit:

```yaml
ko_fi: derflash
```

Verwendete Kurzformulierung in der README:

> Dieses Projekt wird kostenlos und nichtkommerziell bereitgestellt. Wenn es dir hilft, kannst du meine Arbeit freiwillig über [Ko-fi](https://ko-fi.com/derflash) unterstützen. Die Unterstützung ist ein optionales persönliches Dankeschön und **keine Spende im steuer- oder gemeinnützigkeitsrechtlichen Sinn**. Sie vermittelt weder Gegenleistung noch zusätzliche Funktionen, Nutzungsrechte oder bevorzugten Support.

Verwendete ausführliche Formulierung auf der „Über“-Seite:

> Sämtliche Funktionen stehen unabhängig von einer finanziellen Unterstützung vollständig zur Verfügung. Wenn dir das Projekt hilft und du dich für die investierte Entwicklungsarbeit bedanken möchtest, kannst du mich freiwillig über [Ko-fi](https://ko-fi.com/derflash) unterstützen.
>
> Diese freiwillige Unterstützung ist ausschließlich als persönliches Dankeschön gedacht und **keine Spende im steuer- oder gemeinnützigkeitsrechtlichen Sinn**. Sie vermittelt weder Gegenleistung noch zusätzliche Funktionen, Nutzungsrechte, bevorzugten Support oder Einfluss auf die Priorisierung der weiteren Entwicklung. Fehlerberichte, Ideen und Beiträge zum offiziellen Projekt sind unabhängig davon jederzeit willkommen.

In der öffentlichen Kommunikation wird ausschließlich von **freiwilliger Unterstützung**, **persönlichem Dankeschön** oder **Trinkgeld** gesprochen. Ko-fi wird ausdrücklich nicht als Spende im steuer- oder gemeinnützigkeitsrechtlichen Sinn bezeichnet. Die Unterstützung vermittelt weder Gegenleistung noch Zusatzrechte, Zusatzfunktionen oder bevorzugten Support. Einnahmen werden unabhängig von ihrer Freiwilligkeit ordnungsgemäß dokumentiert und steuerlich eingeordnet.

## Veröffentlichungsfahrplan

### Priorität 0 – Veröffentlichungshygiene

- [x] alle eingecheckten Dateien und veröffentlichten Dokumentationsseiten auf personenbezogene oder installationsspezifische Inhalte prüfen; das private Archiv-Wiki wird nicht in das öffentliche Repository übernommen
- [x] lokale Benutzernamen wie `derflash` in Dateisystempfaden, absolute Home-Verzeichnisse und lokale Rechnernamen aus Anleitungen entfernen; absichtliche öffentliche Kontoangaben wie Repository-Owner und Ko-fi-Handle bleiben erhalten
- [x] persönliche PLZ-, Orts-, Filial- und Suchgebietsvorgaben aus auslieferbaren Standardwerten entfernen
- [x] reale persönliche Beispieldaten in Tests und Dokumentation durch neutrale beziehungsweise synthetische Werte ersetzen
- [x] Mailadressen, Tokens, Chat-IDs, API-Schlüssel, Debug-Ausgaben und sonstige Secrets automatisiert prüfen
- [x] sicherstellen, dass eine frische Installation keinerlei Daten der Entwicklungsinstallation übernimmt
- [x] Repository, Release-Artefakte, Docker-Build-Kontext und versionierte Dokumentation vor jedem öffentlichen Release erneut prüfen
- [x] die Themen der bisherigen Wiki-Dokumentation nach `/docs` überführen und anschließend nur noch versionierte Repository-Dokumentation pflegen
- [x] automatisierten Secret- und Veröffentlichungsdaten-Scan in CI ergänzen

### Priorität 0 – Saubere öffentliche Repository-Historie

Ein Force-Push im bestehenden Repository ist keine belastbare Veröffentlichungsgrenze: alte Commits können über bekannte SHAs, GitHub-Caches und insbesondere nicht überschreibbare Pull-Request-Refs erreichbar bleiben. Beim Umschalten des heutigen Repositorys würden außerdem bestehende Actions-Verläufe und Logs öffentlich. Deshalb wird das Entwicklungsrepository nicht öffentlich geschaltet.

- [x] Strategie festlegen: bestehendes Repository dauerhaft privat halten statt seine Historie nur kosmetisch umzuschreiben
- [x] sämtliche für den initialen Snapshot vorgesehenen Vorarbeiten und Reviews in den privaten Entwicklungsrepositorys abschließen
- [x] öffentliche Zielkennung `DerFlash/rossmann-tracker` in Code, Dokumentation, OCI-Metadaten und Release-Gates umstellen
- [x] finalen geprüften Arbeitsbaum ohne `.git`, lokale Daten, Caches oder Build-Artefakte exportieren
- [x] neues privates Zielrepository `DerFlash/rossmann-tracker` anlegen
- [x] neutralen Root-Commit ausschließlich mit `PUBLICATION_BASE.md` und ohne Projektcode erzeugen
- [x] vollständigen Export auf einem Kandidaten-Branch als Pull Request gegen den neutralen Root-Commit stellen
- [x] Kandidaten erneut auf Secrets, personenbezogene Werte, Lizenzen, Abhängigkeiten und Release-Artefakte prüfen
- [ ] CI, vollständigen Copilot-Diff-Review und manuellen Abschlussreview im neuen Repository erfolgreich abschließen
- [ ] Kandidaten per Squash als einzigen vollständigen Snapshot-Commit mergen
- [ ] sicherstellen, dass das neue Repository keine aus den Entwicklungsarchiven importierten Branches, Tags, Releases, Packages, PR-Refs, Actions-Läufe oder Caches enthält
- [ ] eigene PR- und Actions-Metadaten des neuen Repositorys vollständig auf veröffentlichbare Inhalte prüfen
- [x] bisherige Repositorys privat halten und nicht als öffentliches Projekt verlinken
- [ ] erst danach das neue Zielrepository öffentlich schalten

Der genaue Ablauf und die Abbruchgrenzen sind in [`docs/publication-boundary.md`](docs/publication-boundary.md) dokumentiert.

### Priorität 0 – GitHub Releases und Update-Infrastruktur

Ziel ist ein reproduzierbarer, versionierter Release-Prozess mit möglichst einfachen Updates. Die Anwendung erkennt neue stabile Releases und verweist auf den dokumentierten manuellen Aktualisierungsweg. Sie aktualisiert weder ihr eigenes Container-Image noch erhält sie direkten Zugriff auf den Docker-Socket des Hosts.

- [x] semantische Versionierung festlegen und vorerst ausschließlich den Updatekanal `stable` anbieten
- [x] aktuelle Version über Build-Metadaten in API und Weboberfläche anzeigen
- [x] Node-Abhängigkeiten mit Lockfile und `npm ci` reproduzierbar installieren
- [x] GitHub Action für Tests und Veröffentlichungshygiene einrichten
- [x] vollständigen Docker-Build für `linux/amd64` und `linux/arm64` in CI prüfen
- [x] GitHub Action für Release-Erstellung und abgesichertes GHCR-Publishing einrichten
- [ ] ersten Stable-Release-Workflow erfolgreich ausführen
- [ ] versionierte Images in der GitHub Container Registry veröffentlichen
- [ ] unveränderliche Versionstags und einen bewusst gepflegten `stable`-Tag bereitstellen
- [ ] Docker Compose vom lokalen Produktions-Build auf das veröffentlichte GHCR-Image umstellen
- [ ] Compose-Datei und notwendige Installationsdateien als leicht auffindbare Release-Artefakte anbieten
- [x] Weboberfläche über die GitHub-Releases-API auf eine neuere stabile Version prüfen lassen
- [x] Updateprüfung auf höchstens einen Abruf innerhalb von 24 Stunden begrenzen und das Ergebnis lokal zwischenspeichern
- [x] Updateprüfung in den Einstellungen vollständig deaktivierbar machen
- [x] sicherstellen, dass weder Telemetrie noch DANs, PLZ, Konfiguration oder Installationskennung übertragen werden
- [x] Updatehinweis mit Versionsnummer, Release Notes und Sicherheitsrelevanz anzeigen
- [x] sicheren manuellen Updateweg mit `docker compose pull` und anschließendem `docker compose up -d` anbieten
- [x] sicherstellen, dass Vorab-Releases nicht als reguläres Update angeboten werden
- [x] auf automatische Updates und einen Updatehelfer vorerst verzichten
- [x] dem Tracker-Container keinen Docker-Socket und keine weitreichenden Host-Rechte geben
- [x] persistente Daten, Einstellungen, History und Browserprofil bei Container-Ersetzung erhalten
- [x] Konfigurationsmigration, Vorabprüfung, Backup und dokumentierten Rollback pro Release sicherstellen
- [x] signierte Build-Provenienz für Release-Images vorbereiten
- [x] Release-Publishing durch geschütztes Environment, monotone Versionen und Fail-closed-Prüfungen absichern
- [x] Playwright-Basisimage für reproduzierbare Release-Builds per Digest fixieren
- [ ] SBOM und weitergehende Signierung der Release-Artefakte prüfen

### Phase 1 – Identität und Abgrenzung

- [x] Projektnamen in Oberfläche, README, Dokumentation und Paketmetadaten auf **Rossmann Store Tracker** umstellen
- [x] Repository-Slug auf `rossmann-store-tracker` umstellen
- [x] den festgelegten Untertitel „Inoffizieller Community-Tracker für Rossmann-Filialbestände“ durchgängig umsetzen
- [ ] die festgelegte Kurzbeschreibung in README, GitHub-Metadaten und Releases verwenden
- [x] klaren Hinweis auf fehlende Verbindung zur Dirk Rossmann GmbH prominent aufnehmen
- [x] keine Rossmann-Logos, den Centaur oder einen offiziellen Markenauftritt verwenden
- [ ] eine eigene visuelle Identität mit eigenständigen Farben, Formen, Typografie und Icon entwickeln

### Phase 2 – Lizenz und Mitarbeit

- [x] `LICENSE.md` mit unverändertem PolyForm Strict License 1.0.0 anlegen
- [x] getrennte projektspezifische Erlaubnis für private Veränderungen und Beiträge formulieren
- [x] `CONTRIBUTING.md` mit Issue-, Fork- und Pull-Request-Prozess erstellen
- [x] kurzen Contributor Grant separat dokumentieren und aus `CONTRIBUTING.md` verlinken
- [x] Pull-Request-Template mit verpflichtender Bestätigung des Contributor Grants ergänzen
- [x] Contributor-Grant-Statuscheck für externe Pull Requests ergänzen
- [x] den Statuscheck **Contributor Grant** vor der öffentlichen Freigabe als erforderlichen Branch-Schutz aktivieren
- [x] Verhaltens- und Sicherheitsregeln für Beiträge dokumentieren
- [x] direkte Drittkomponenten und deren weiterführende Lizenzhinweise dokumentieren
- [x] Lizenz-, Beitrags-, Marken-, Schnittstellen-, Datenschutz- und Haftungsfragen intern im vereinbarten Best-Effort-Umfang prüfen und Restrisiken in [`docs/legal-review.md`](docs/legal-review.md) dokumentieren; keine externe Rechtsfreigabe behaupten
- [x] Anbieterkennzeichnung ausdrücklich entscheiden: rein privates Hobbyprojekt mit privater Ko-fi-Unterstützung; keine Anbieterkennzeichnung vorgesehen

### Phase 3 – Veröffentlichungstauglichkeit

- [ ] geführte Ersteinrichtung vollständig fertigstellen und testen
- [x] sicherstellen, dass neue Installationen ohne persönliche PLZ, Filiale, Produkte oder Zugangsdaten starten
- [ ] Installations- und Aktualisierungsweg für technische und weniger technische Nutzer vereinfachen
- [x] Secrets, persistente Daten und Browserprofile zuverlässig vom Repository ausschließen
- [x] Standardintervall auf 15 Minuten und technische Untergrenze auf 5 Minuten festlegen
- [x] zwischen einzelnen Rossmann-Abfragen mindestens 2 Sekunden Pause plus zufällige Verzögerung erzwingen
- [x] manuelle Prüfungen durch Cooldown und Schutz vor parallelem beziehungsweise schnellem Wiederholen begrenzen
- [ ] Fehlerfälle, Datenverlust, Update und Wiederherstellung dokumentieren
- [x] portables Docker-Compose-Setup ohne hostabhängige Pfade oder Annahmen bereitstellen
- [ ] Release-Smoke-Tests für macOS Docker Desktop, natives Linux und Windows Docker Desktop definieren
- [ ] Unterstützung für `linux/amd64` und `linux/arm64` einschließlich Chromium-/Playwright-Basisimage verifizieren
- [ ] Supportmatrix pro Release aus den tatsächlich bestandenen Plattform-/Architektur-Kombinationen erzeugen; alle anderen Kombinationen als Best Effort kennzeichnen
- [ ] Mindestversionen für Docker Engine beziehungsweise Docker Desktop und Docker Compose festlegen
- [ ] GitHubs Private Vulnerability Reporting aktivieren
- [x] `SECURITY.md` mit vertraulichem Meldeweg, Best-Effort-Reaktion und Hinweis gegen öffentliche Meldungen sensibler Schwachstellen ergänzen

### Phase 4 – Öffentliche Beta

- [ ] versionierten `v0.x`-Pre-Release für freiwillige Tester erstellen und ausschließlich zur manuellen Installation anbieten
- [ ] Bookmarklet und Docker-Tracker getrennt und verständlich präsentieren
- [ ] bekannte Einschränkungen und funktionierende beziehungsweise problematische DANs dokumentieren
- [ ] strukturiertes GitHub-Issue-Formular für Produkt- und DAN-Vorschläge vorbereiten
- [ ] direkte Katalogbeiträge per Pull Request dokumentieren
- [ ] DAN-Format und Katalogduplikate in CI automatisiert validieren
- [ ] GitHub Discussions für Fragen, Ideen und Community-Austausch aktivieren und strukturieren
- [x] `.github/FUNDING.yml` mit `ko_fi: derflash` ergänzen
- [x] freiwilligen Ko-fi-Link mit den festgelegten Texten dezent in README und „Über“-Seite ergänzen
- [ ] Feedback zu Installation, Bedienung und Zuverlässigkeit sammeln

### Phase 5 – Stabilisierung

- [ ] Rückmeldungen aus der Beta priorisieren und abarbeiten
- [ ] Update-Kompatibilität bestehender lokaler Daten sicherstellen
- [ ] Releases und Änderungen nachvollziehbar dokumentieren
- [ ] Produkt-/DAN-Katalog über den kombinierten Issue-/Pull-Request-Prozess und nach inhaltlicher Kontrolle pflegen
- [ ] `v1.0.0` erst freigeben, wenn Plattform-Smoke-Tests, saubere Neuinstallation, Datenmigrationen, Rollback, Tests, Dokumentation und das dokumentierte Best-Effort-Freigabe-Gate abgeschlossen sind

## Technische und rechtliche Leitplanken

- Der Tracker verwendet nur die für den Filialfinder bereitgestellten Rossmann-Antworten.
- Zugangskontrollen und Client-Challenges werden nicht nachgebaut oder umgangen.
- Chromium bleibt erforderlich, solange Rossmann die Bestandsroute nur in einem echten Browserkontext zuverlässig beantwortet.
- Abfragen werden gedrosselt, dedupliziert und auf das für die gewählte Überwachung notwendige Maß begrenzt.
- Angezeigte Werte werden als Buchbestände gekennzeichnet und nicht als Reservierungs- oder Kaufzusage dargestellt.
- Vor einer wesentlichen Ausweitung des Nutzerkreises werden Namensnutzung, Schnittstellennutzung und Haftung erneut bewertet.
- Rossmann wird vor der Veröffentlichung nicht proaktiv kontaktiert; das Projekt kommuniziert seine Unabhängigkeit stattdessen eindeutig und reagiert bei einer späteren Kontaktaufnahme kooperativ.

## Vorerst nicht vorgesehen

- zentral gehosteter SaaS-Dienst
- kostenpflichtige Editionen oder Abonnements
- supporter-exklusive Funktionen
- Verkauf von Bestandsdaten
- Garantie, Support-Level oder Verfügbarkeitszusage
- Telemetrie oder eine zentrale Erfassung von DANs, PLZ, Einstellungen beziehungsweise Nutzungsverhalten
- automatisierter Kauf oder Reservierung von Produkten
- Selbstaktualisierung durch direkten Docker-Socket-Zugriff des Tracker-Containers
- automatischer Updatehelfer; vorerst gibt es ausschließlich Erkennung, Hinweis und einen dokumentierten manuellen Updateweg
- auswählbare Beta- oder Nightly-Updatekanäle

## Noch zu klären

- Restrisiken bei Namens- und Schnittstellennutzung bei Beanstandungen oder vor einer wesentlichen Ausweitung des Nutzerkreises neu bewerten
