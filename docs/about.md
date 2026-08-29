# Über den Rossmann Store Tracker

Der **Rossmann Store Tracker** ist ein kostenloses, nichtkommerzielles und inoffizielles privates Hobby- und Community-Projekt. Er hilft dabei, die von Rossmann bereitgestellten Filialbestände anhand der internen Artikelnummer (DAN) zu prüfen, Veränderungen nachzuvollziehen und sich auf Wunsch per Telegram benachrichtigen zu lassen.

Das Projekt ist unabhängig von der Dirk Rossmann GmbH und wird von ihr weder angeboten noch unterstützt. Angezeigte Werte sind Buchbestände. Sie können vom tatsächlichen Regalbestand abweichen und stellen keine Reservierungs-, Verfügbarkeits- oder Kaufzusage dar.

Die Anwendung wird lokal als Docker-Container betrieben. Einstellungen, Bestandsverlauf, Browserprofil und Telegram-Zugangsdaten verbleiben auf dem eigenen System. Eine zentral betriebene Nutzerplattform oder Telemetrie ist nicht vorgesehen. Für ihre eigentliche Funktion kommuniziert die lokale Installation dennoch mit Rossmann, optional mit der Telegram Bot API und bei aktivierter Updateprüfung mit GitHub; die dabei entstehenden externen Datenflüsse sind unter [Konfiguration und Daten](configuration-and-data.md) dokumentiert.

## Mitarbeit

Fehlerberichte, Ideen und Beiträge zum offiziellen Projekt sind willkommen. Konkrete Fehler und Aufgaben werden über GitHub Issues koordiniert, allgemeine Fragen und Ideen über GitHub Discussions. Änderungen am offiziellen Projekt werden über Pull Requests eingebracht.

Ergänzend gibt es die freiwillige [WhatsApp-Community „Rossmann Store Tracker – Hilfe & Austausch“](https://chat.whatsapp.com/ELMb90gBK1cGDPbKX3eKZ1) für informelle gegenseitige Hilfe bei Einrichtung, Betrieb, DANs und Bestandsmeldungen. Sie wird über den externen Dienst WhatsApp/Meta bereitgestellt, ist optional, nicht Bestandteil der Anwendung und technisch nicht mit ihr verbunden; es gelten die Nutzungs- und Datenschutzbestimmungen von WhatsApp. Die Community ist kein garantierter oder offizieller Supportkanal. Nachvollziehbare technische Fehler gehören in die [GitHub Issues](https://github.com/DerFlash/rossmann-tracker/issues), allgemeine Fragen und Ideen in die [GitHub Discussions](https://github.com/DerFlash/rossmann-tracker/discussions).

Das Projekt ist **source-available und kein klassisches Open-Source-Projekt**. Die unveränderte offizielle Version darf nach PolyForm Strict 1.0.0 für nichtkommerzielle Zwecke verwendet werden; private, nichtkommerzielle Veränderungen sind durch die zusätzliche Projekterlaubnis ausschließlich für den eigenen Gebrauch erlaubt. Eigenständige Veröffentlichungen, Releases, Pakete und Container-Images durch Dritte werden nicht zusätzlich erlaubt. GitHub räumt bei öffentlichen Repositorys unabhängig davon eigene Plattformrechte zum Ansehen und Forken innerhalb des Dienstes ein.

Maßgeblich sind [`LICENSE.md`](../LICENSE.md), [`CONTRIBUTING.md`](../CONTRIBUTING.md) und der dort eingebundene [`Contributor Grant`](../CONTRIBUTOR_LICENSE_AGREEMENT.md). Der interne [Best-Effort-Veröffentlichungscheck](legal-review.md) ist keine Rechtsberatung oder externe juristische Freigabe.

## Freiwillige Unterstützung

Sämtliche Funktionen stehen unabhängig von einer finanziellen Unterstützung vollständig zur Verfügung. Wenn dir das Projekt hilft und du dich für die investierte Entwicklungsarbeit bedanken möchtest, kannst du mich freiwillig über [Ko-fi](https://ko-fi.com/derflash) unterstützen.

Diese freiwillige Unterstützung ist ausschließlich als persönliches Dankeschön gedacht und **keine Spende im steuer- oder gemeinnützigkeitsrechtlichen Sinn**. Sie vermittelt weder Gegenleistung noch zusätzliche Funktionen, Nutzungsrechte, bevorzugten Support oder Einfluss auf die Priorisierung der weiteren Entwicklung. Fehlerberichte, Ideen und Beiträge zum offiziellen Projekt sind unabhängig davon jederzeit willkommen.
