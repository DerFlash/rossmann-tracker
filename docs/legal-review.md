# Best-Effort-Prüfung vor der Veröffentlichung

Dieses Dokument hält die interne Best-Effort-Prüfung des Rossmann Store Trackers vor der Veröffentlichung fest. Sie ist **keine Rechtsberatung, keine externe juristische Prüfung und keine Rechtsfreigabe**. Eine für IT-, Urheber-, Marken- oder Wettbewerbsrecht qualifizierte Stelle wurde nicht beauftragt. Verbleibende Unsicherheiten und die daraus abgeleiteten Betriebsregeln werden deshalb ausdrücklich dokumentiert.

## Projekt und festgelegtes Modell

- Rechte- und Lizenzgeber ist der private Projektverantwortliche hinter dem offiziellen GitHub-Repository, in den Lizenz- und Beitragsunterlagen als Project Maintainer bezeichnet.
- Das Projekt wird kostenlos, nichtkommerziell und source-available bereitgestellt; es ist kein klassisches Open-Source-Projekt.
- Die unveränderte offizielle Version darf entsprechend PolyForm Strict 1.0.0 für nichtkommerzielle Zwecke verwendet werden.
- Die zusätzliche Erlaubnis gestattet private, nichtkommerzielle Veränderungen ausschließlich für den eigenen Gebrauch.
- Unabhängige veränderte Veröffentlichungen, Releases, Images, Installationspakete, Mirrors oder gehostete Dienste werden nicht zusätzlich erlaubt.
- Beiträge erfolgen über GitHub Issues und Pull Requests; Beitragende behalten ihr Urheberrecht und erteilen den dokumentierten Contributor Grant.
- Ko-fi bleibt als freiwillige Unterstützung beziehungsweise persönliches Dankeschön sichtbar. Es handelt sich nicht um eine Spende im steuer- oder gemeinnützigkeitsrechtlichen Sinn und die Unterstützung vermittelt weder Gegenleistung noch Zusatzrechte, Zusatzfunktionen oder bevorzugten Support.

## Geprüfte Unterlagen

Die Best-Effort-Prüfung umfasste insbesondere:

1. [`LICENSE.md`](../LICENSE.md) einschließlich PolyForm Strict 1.0.0 und der zusätzlichen Projekterlaubnis
2. [`CONTRIBUTOR_LICENSE_AGREEMENT.md`](../CONTRIBUTOR_LICENSE_AGREEMENT.md), [`CONTRIBUTING.md`](../CONTRIBUTING.md) und das Pull-Request-Template
3. [`README.md`](../README.md), [`about.md`](about.md), [`configuration-and-data.md`](configuration-and-data.md) und [`telegram.md`](telegram.md)
4. [`SECURITY.md`](../SECURITY.md), [`THIRD_PARTY_NOTICES.md`](../THIRD_PARTY_NOTICES.md) und die Release-Dokumentation
5. die technischen Abfragegrenzen, Datenflüsse und die Veröffentlichungsgrenze des Repositorys

## Ergebnis und verbleibende Risiken

### Lizenz und GitHub-Forks

PolyForm Strict erlaubt die unveränderte Software für nichtkommerzielle Zwecke und untersagt ohne zusätzliche Erlaubnis Verteilung sowie Änderungen. Die projektspezifische Erlaubnis erweitert dies um private Änderungen und den Beitragsweg.

Bei einem öffentlichen Repository räumen die GitHub-Nutzungsbedingungen anderen GitHub-Nutzern unabhängig davon Plattformrechte zum Ansehen und Forken innerhalb des GitHub-Dienstes ein. Diese Rechte werden nicht als durch die Projektlizenz entziehbar dargestellt. Die zusätzlichen Projektbedingungen regeln insbesondere weitergehende Änderungen, Verteilungen, Releases, Images und unabhängige Veröffentlichungen.

### Projektname und Marke

„Rossmann“ wird ausschließlich verwendet, um den Gegenstand des Trackers zu benennen. Das Projekt verwendet kein Rossmann-Logo, keinen Centaur und keinen nachgeahmten offiziellen Markenauftritt. README und Projektdokumentation kennzeichnen das Projekt prominent als inoffiziell, unabhängig und nicht unterstützt. Ein verbleibendes Marken- oder Irreführungsrisiko kann ohne externe Prüfung nicht ausgeschlossen werden.

### Rossmann-Abfragen und Datenbankinhalte

Die Anwendung verwendet die Filialbestandsroute im normalen Browserkontext, umgeht keine Zugangskontrollen und beschränkt Abfragen technisch. Rossmanns `robots.txt` schließt Query-URLs grundsätzlich vom Crawling aus. Das ist nicht mit einer ausdrücklichen Genehmigung gleichzusetzen und wird als relevantes Signal des Betreibers behandelt.

Daraus folgen diese Betriebsregeln:

- keine Behauptung einer Autorisierung oder Unterstützung durch Rossmann;
- keine Massenabfragen, keine Katalog-Komplettabzüge und keine Umgehung von Schutzmaßnahmen;
- nur nutzergewählte DANs und Standorte abfragen;
- zentrale Mindestabstände, Jitter, Polling-Untergrenze und manuellen Cooldown beibehalten;
- bei einer Beanstandung oder technischen Sperre durch Rossmann nicht eskalieren, sondern Abfragen stoppen und den Betrieb neu bewerten.

Der gemeinsame DAN-Katalog bleibt auf einzeln geprüfte, zweckbezogene Produktzuordnungen beschränkt. Eine systematische Übernahme wesentlicher fremder Datenbankbestände ist nicht vorgesehen.

### Datenschutz und externe Dienste

Der Tracker betreibt keine zentrale Nutzerplattform und keine Telemetrie. Lokale Speicherung bedeutet jedoch nicht, dass sämtliche Verarbeitung offline erfolgt:

- DAN, PLZ beziehungsweise Filialauswahl und die öffentliche IP-Adresse des Betreibers gelangen bei Bestandsabfragen technisch an Rossmann.
- Bot-Nachrichten, Chat-ID und die öffentliche IP-Adresse des Betreibers werden bei der Nutzung der Telegram Bot API an Telegram übertragen; Bot-Token und Chat-ID bleiben zusätzlich lokal gespeichert.
- Die deaktivierbare Updateprüfung ruft höchstens einmal innerhalb von 24 Stunden öffentliche Release-Metadaten bei GitHub ab und übermittelt keine DANs, PLZ, Telegram-Daten oder Installationskennung.

Jeder selbst hostende Betreiber entscheidet selbst über die Nutzung dieser externen Dienste und ist für seinen Bot, seine Zugangsdaten, seine lokale Installation und die Beachtung der für ihn geltenden Vorgaben verantwortlich.

### Haftung und Bestandsangaben

Bestände werden als unverbindliche Buchbestände gekennzeichnet und sind keine Reservierungs-, Verfügbarkeits- oder Kaufzusage. Der Haftungsausschluss der PolyForm Strict License gilt nur, soweit das anwendbare Recht dies zulässt; zwingende gesetzliche Haftung bleibt unberührt.

### Beiträge

Der Contributor Grant enthält Erklärungen zu eigener Berechtigung, Beschäftigung, Auftragsarbeit und KI-Unterstützung. Checkbox und Statuscheck verbessern die Nachweisbarkeit, ersetzen aber keine Identitäts- oder Vertretungsmachtprüfung. Bei erkennbar minderjährigen Beitragenden oder zweifelhafter Berechtigung wird vor Annahme eine zusätzliche Bestätigung verlangt oder der Beitrag nicht übernommen.

### Ko-fi und Anbieterkennzeichnung

Ko-fi wird ausschließlich als freiwillige Unterstützung beziehungsweise persönliches Dankeschön bezeichnet. Die Zahlung ist optional, keine steuerbegünstigte Spende und vermittelt weder Gegenleistung noch Einfluss auf das Projekt.

Der Project Maintainer hat ausdrücklich festgelegt, dass der Rossmann Store Tracker ein rein privates Hobbyprojekt bleibt. Ko-fi ist eine persönliche, freiwillige Unterstützung ohne Gegenleistung.

Ob ein öffentliches kostenloses Hobbyprojekt mit freiwilligem Ko-fi-Link dennoch als geschäftsmäßiger digitaler Dienst mit Pflicht zur Anbieterkennzeichnung einzuordnen wäre, wird durch diese Best-Effort-Prüfung nicht abschließend geklärt. Der Project Maintainer hat sich auf Grundlage des rein privaten, nichtkommerziellen und gegenleistungslosen Modells gegen eine Anbieterkennzeichnung entschieden. Ändern sich diese Tatsachen – insbesondere durch Bezahlfunktionen, Gegenleistungen oder einen kommerziellen Betrieb –, muss die Entscheidung vor der Änderung neu bewertet werden.

## Herangezogene Primärquellen

- [PolyForm Strict License 1.0.0](https://polyformproject.org/licenses/strict/1.0.0/)
- [GitHub Terms of Service, D.5 – License Grant to Other Users](https://docs.github.com/en/site-policy/github-terms/github-terms-of-service#5-license-grant-to-other-users)
- [§ 23 MarkenG – Benutzung zur Identifizierung oder zum Verweis](https://www.gesetze-im-internet.de/markeng/__23.html)
- [§ 5 DDG – Allgemeine Informationspflichten](https://www.gesetze-im-internet.de/ddg/__5.html)
- [Rossmann robots.txt](https://www.rossmann.de/de/robots.txt)

## Freigabe-Gate

- [x] Gewünschtes Lizenz- und Beitragsmodell technisch und dokumentarisch abgeglichen.
- [x] Markenabgrenzung, Schnittstellennutzung, Datenflüsse, Haftung und Ko-fi im Best-Effort-Verfahren bewertet.
- [x] Es wird keine externe juristische Prüfung oder Rechtsfreigabe behauptet.
- [x] Verbleibende Risiken und Betriebsregeln sind dokumentiert.
- [x] Anbieterkennzeichnung ausdrücklich entschieden: rein privates Hobbyprojekt; keine Anbieterkennzeichnung vorgesehen.
- [ ] Sämtliche finalen Best-Effort-Dokumentationsänderungen auf dem vorgesehenen Veröffentlichungsstand geprüft und gemergt.
- [ ] Finalen technischen Veröffentlichungs- und Secret-Audit auf dem vorgesehenen `main`-Stand ausführen.
- [ ] Öffentliche Freigabe danach ausdrücklich durch den Project Maintainer bestätigen.

Der erste Stable-Release und die Veröffentlichung eines GHCR-Images bleiben vom Public-Go getrennte Schritte.
