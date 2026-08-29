# Zum Rossmann Store Tracker beitragen

Fehlerberichte, Ideen, Produkt-/DAN-Ergänzungen und Codebeiträge zum offiziellen Projekt sind willkommen. Das Projekt ist source-available, aber nicht Open Source; für Beiträge gelten deshalb zusätzlich die in diesem Dokument beschriebenen Grenzen.

## Der passende Weg

- **Fehler und konkrete Aufgaben:** GitHub Issue
- **Fragen und Ideen:** GitHub Discussions
- **Sicherheitslücken:** ausschließlich nach [`SECURITY.md`](SECURITY.md) vertraulich melden
- **Code- und Dokumentationsänderungen:** GitHub Fork und Pull Request

Ein öffentlicher Fork ist nur als technischer Arbeitsbereich für Beiträge zum offiziellen Projekt erlaubt. Eigene Releases, Pakete, Container-Images, Mirrors, gehostete Varianten oder sonstige eigenständige Veröffentlichungen sind nicht gestattet. Maßgeblich sind die Bedingungen in [`LICENSE.md`](LICENSE.md).

## Pull-Request-Ablauf

1. Vor größeren Änderungen zuerst ein Issue eröffnen oder eine bestehende Aufgabe abstimmen.
2. Den Fork und Branch auf die konkrete Änderung begrenzen.
3. Tests und relevante Dokumentation ergänzen.
4. `npm --prefix tracker test` und `node scripts/check-publication-hygiene.mjs` ausführen.
5. Im Pull-Request-Template sämtliche zutreffenden Prüfpunkte bestätigen.
6. Insbesondere dem [`Contributor Grant`](CONTRIBUTOR_LICENSE_AGREEMENT.md) ausdrücklich zustimmen.

Pull Requests können abgelehnt oder geschlossen werden, wenn sie unklar, nicht prüfbar, unnötig weit gefasst, rechtlich problematisch oder nicht mit dem Projektzweck vereinbar sind. Das Einreichen begründet keinen Anspruch auf Annahme, Veröffentlichung oder Support.

Bei Pull Requests von anderen Personen als dem Repository-Eigentümer prüft der Statuscheck **Contributor Grant**, ob die vorgegebene Zustimmungszeile im Pull-Request-Text ausdrücklich angekreuzt wurde. Dieser Check ist vor der öffentlichen Freigabe als erforderlicher Branch-Schutz zu konfigurieren. Eine fehlende oder veränderte Bestätigung gilt nicht als Zustimmung und verhindert die Annahme des Beitrags.

## Anforderungen an Beiträge

- Keine Zugangskontrollen, Client-Challenges oder technischen Schutzmaßnahmen umgehen.
- Rossmann-Abfragen nicht aggressiver oder häufiger gestalten als für die Funktion erforderlich.
- Keine Tokens, Chat-IDs, personenbezogenen Daten, lokalen Home-Pfade, Rechnernamen oder Entwicklungsdaten einchecken.
- Keine fremden Logos, Bilder, Texte oder Code ohne nachweislich passende Rechte übernehmen.
- Abhängigkeiten nur begründet ergänzen und deren Lizenz sowie Herkunft dokumentieren.
- Verhalten, Datenschutz und persistente Daten bestehender Installationen berücksichtigen.
- Tests müssen reproduzierbar sein und dürfen keine realen Konten oder produktiven Zugangsdaten benötigen.

## Review und Umgang

Beiträge werden sachlich nach Nutzen, Sicherheit, Wartbarkeit, rechtlicher Vertretbarkeit und Übereinstimmung mit dem Projektziel bewertet. Für die Zusammenarbeit gilt der [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md).
