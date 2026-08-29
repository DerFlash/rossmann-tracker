# Produktkatalog und DANs

Der gemeinsame Katalog liegt in [products.json](../products.json). Er ist grundsätzlich für alle Rossmann-Produkte offen; Pokémon und TCG bilden lediglich den anfänglichen Schwerpunkt.

## Statusbereiche

| Bereich | Bedeutung |
| --- | --- |
| working | DAN wurde erfolgreich für Bestandsabfragen verwendet |
| request_error | DAN ist bekannt, liefert derzeit aber keinen verwertbaren Bestand |
| ean_only | bisher ist nur die EAN bekannt |

Ein Eintrag enthält **name** und – abhängig vom Status – **dan**, **ean** oder beides. DANs werden als sechsstellige Zeichenkette gespeichert, damit führende Nullen erhalten bleiben.

## Beiträge

Neue oder korrigierte Produkte können über ein strukturiertes GitHub-Issue oder einen Pull Request vorgeschlagen werden. Bitte angeben:

- eindeutiger Produktname,
- DAN, sofern bekannt,
- EAN, sofern bekannt,
- nachvollziehbare Quelle oder eigener geprüfter Rossmann-Abruf,
- bestehende ähnliche Einträge, um Duplikate zu vermeiden.

Vor der Aufnahme werden Format, Duplikate und tatsächliche Verwendbarkeit kontrolliert. Eine EAN darf nicht als DAN eingesetzt werden.

## Bookmarklet-Format

Für eine manuelle Liste akzeptiert das Bookmarklet pro Zeile:

~~~text
Produktname | 123456
123456
~~~

Persönliche Suchgebiete oder Filialen gehören nicht in den gemeinsamen Katalog.
