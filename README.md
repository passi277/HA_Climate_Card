# HA Climate Card

Eine moderne Lovelace-Karte für Klimaanlagen in Home Assistant – mit Drehregler, allen
`climate`-Funktionen, Zusatzsensoren, Fenster-Warnung und Temperaturverlauf.

*A modern Lovelace card for air conditioners in Home Assistant – English summary below.*

| Hell | Dunkel |
| --- | --- |
| ![Vorschau hell](docs/preview-light.png) | ![Vorschau dunkel](docs/preview-dark.png) |

## Funktionen

- **Zwei Layouts:** `full` (runder Drehregler, ziehbar) und `compact` (Kachel mit +/- und ausklappbaren Details)
- **Alle Klima-Funktionen** – werden automatisch anhand von `supported_features` ein-/ausgeblendet:
  - Betriebsmodi (Auto, Heizen/Kühlen, Heizen, Kühlen, Entfeuchten, Nur Lüfter, Aus) und Ein/Aus-Taste
  - Zieltemperatur einzeln **oder als Bereich** (`target_temp_low`/`target_temp_high`, zwei Regler)
  - Lüfterstufen, Lamellen vertikal **und horizontal**, Voreinstellungen (Eco, Boost, Sleep …)
  - Ziel-Luftfeuchte
  - Aktuelle Aktion (heizt/kühlt/Leerlauf) mit Farbe und Animation
- **Zusatzsensoren:** Raumtemperatur, Raumluftfeuchte, Außentemperatur, Leistung, Energie, Fenster-/Türkontakt
- **Fenster-Warnung**, wenn der Kontakt offen ist
- **Verlaufsgraph** (Ist- und Zieltemperatur, Heiz-/Kühlphasen als Farbbänder)
- **Visueller Editor** im Dashboard – kein YAML nötig
- **Deutsch & Englisch** (folgt der HA-Spracheinstellung; Modi werden über die HA-eigenen Übersetzungen der Integration angezeigt)
- Passt sich dem HA-Theme an (hell/dunkel), Tastaturbedienung am Regler

## Installation

### HACS (empfohlen)

1. HACS öffnen → oben rechts **⋮ → Benutzerdefinierte Repositories**
2. URL `https://github.com/passi277/HA_Climate_Card` mit Typ **Dashboard** hinzufügen
3. „HA Climate Card“ suchen, installieren und den Browser neu laden

### Manuell

1. `dist/ha-climate-card.js` nach `<config>/www/ha-climate-card.js` kopieren
2. Unter **Einstellungen → Dashboards → ⋮ → Ressourcen** hinzufügen:
   URL `/local/ha-climate-card.js`, Typ **JavaScript-Modul**

## Konfiguration

Am einfachsten über **Karte hinzufügen → HA Climate Card** im visuellen Editor. YAML-Beispiel:

```yaml
type: custom:ha-climate-card
entity: climate.wohnzimmer
name: Wohnzimmer
layout: full            # full | compact
show:
  modes: true
  fan: true
  swing: true
  presets: true
  humidity: true
  sensors: true
  graph: true
temperature_sensor: sensor.wohnzimmer_temperatur
use_sensor_for_current: false
humidity_sensor: sensor.wohnzimmer_luftfeuchte
outdoor_sensor: sensor.aussentemperatur
power_sensor: sensor.klima_leistung
energy_sensor: sensor.klima_energie
window_sensor: binary_sensor.wohnzimmer_fenster
graph_hours: 24
```

| Option | Typ | Standard | Beschreibung |
| --- | --- | --- | --- |
| `entity` | string | **erforderlich** | `climate.*`-Entität |
| `name` | string | Anzeigename | Eigener Titel |
| `icon` | string | automatisch | Eigenes Symbol im Kopf |
| `layout` | `full` \| `compact` | `full` | Drehregler oder kompakte Kachel |
| `show.modes` | bool | `true` | Betriebsmodi-Leiste |
| `show.fan` | bool | `true` | Lüfterstufen |
| `show.swing` | bool | `true` | Lamellen (vertikal + horizontal) |
| `show.presets` | bool | `true` | Voreinstellungen |
| `show.humidity` | bool | `true` | Ziel-Luftfeuchte |
| `show.sensors` | bool | `true` | Sensor-Kacheln |
| `show.graph` | bool | `false` | Verlaufsgraph |
| `temperature_sensor` | entity | – | Externer Raumtemperatur-Sensor |
| `use_sensor_for_current` | bool | `false` | Raumsensor statt `current_temperature` anzeigen (auch im Graph) |
| `humidity_sensor` | entity | – | Externer Luftfeuchte-Sensor |
| `outdoor_sensor` | entity | – | Außentemperatur |
| `power_sensor` | entity | – | Aktuelle Leistung (W) |
| `energy_sensor` | entity | – | Energieverbrauch (kWh) |
| `window_sensor` | entity | – | Fenster-/Türkontakt (`binary_sensor`), zeigt Warnung wenn offen |
| `graph_hours` | number | `24` | Zeitraum des Verlaufsgraphen in Stunden |

## Entwicklung

```bash
npm install
npm run watch      # baut dist/ha-climate-card.js bei Änderungen
npm run lint       # TypeScript-Prüfung
npm run build      # Produktions-Build
```

`demo/index.html` enthält eine Demo-Seite mit simuliertem Home Assistant
(`python3 -m http.server` im Repo-Root starten und `/demo/index.html` öffnen,
`?dark=1` für das dunkle Theme, `?lang=en` für Englisch).

Ein Release wird über GitHub Releases erstellt; der Workflow hängt
`ha-climate-card.js` automatisch an.

---

## English

**HA Climate Card** is a Lovelace card for air conditioners: a draggable round dial (or a
compact tile), every `climate` feature (HVAC modes, single or range target temperature, fan,
vertical & horizontal swing, presets, target humidity), extra sensors (room temperature/humidity,
outdoor, power, energy, window contact with warning), a temperature history graph and a visual
editor. Install it via HACS as a custom repository of type **Dashboard**, then add
`type: custom:ha-climate-card` with your `entity`. All options are listed in the table above.
The UI is available in German and English and follows your Home Assistant language.

## Lizenz

MIT
