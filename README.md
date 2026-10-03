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
- **Ausklappbar:** Auch im vollen Layout bleiben Regler, Modi, Lüfter und Schalter sichtbar; Lamellen, Voreinstellungen, Luftfeuchte, Sensoren und Verlauf liegen unter „Mehr“
- **Dropdown bei vielen Optionen:** z.B. die 12 Lamellen-Stellungen von Gree-Geräten (Schwelle einstellbar)
- **Schalter-Buttons:** Schalter und Buttons desselben Geräts werden automatisch übernommen (z.B. Gree: Frischluft, Leiser Modus, Bedienfeld-Beleuchtung, X-Fan) – oder eigene Schalter, Skripte und Szenen festlegen
- **Ist-Wert im Regler:** Ein Bogen mit Farbverlauf zeigt den Abstand zwischen Ist- und Zieltemperatur (warm → kühl beim Kühlen, kalt → warm beim Heizen), animiert solange die Anlage arbeitet
- **Externe Ist-Temperatur:** Raumsensor *oder* Thermostat (z.B. Homematic-Wandthermostat) eintragen – ohne Eintrag wird automatisch die Temperatur der Klimaanlage genutzt
- **Sleeptimer:** Klassisches Helfer-Muster (Schalter zum Scharfschalten + Uhrzeit) direkt in der Karte, inkl. Restzeit – passender Blueprint liegt bei
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
  shortcuts: true
expandable: true        # Details im vollen Layout ausklappbar
start_expanded: false
dropdown_threshold: 6   # ab 7 Optionen Dropdown statt Chips
auto_shortcuts: true    # Schalter des Geräts automatisch anzeigen
# shortcuts:            # optional: eigene Liste (ersetzt die automatische)
#   - switch.klima_frische_luft
#   - entity: script.klima_turbo_10_min
#     name: Turbo
#     icon: mdi:rocket-launch
temperature_sensor: climate.wandthermostat_wohnzimmer   # Sensor oder Thermostat; leer = Klimaanlage
use_sensor_for_current: true
timer_switch: input_boolean.sleeptimer_wohnzimmer
timer_time: input_datetime.sleeptimer_wohnzimmer
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
| `show.shortcuts` | bool | `true` | Schalter-Buttons |
| `expandable` | bool | `true` | Volles Layout: Details (Lamellen, Voreinstellungen, Luftfeuchte, Sensoren, Verlauf) unter „Mehr“ einklappen |
| `start_expanded` | bool | `false` | Details anfangs ausgeklappt |
| `dropdown_threshold` | number | `6` | Mehr Optionen als dieser Wert → Dropdown statt Chips (`0` = immer Chips) |
| `auto_shortcuts` | bool | `true` | Schalter/Buttons desselben Geräts automatisch als Buttons anzeigen |
| `shortcuts` | list | – | Eigene Buttons: Entity-IDs oder `{entity, name, icon}`; Schalter werden umgeschaltet, Skripte/Szenen gestartet, Buttons gedrückt. Rechtsklick/langes Drücken öffnet die Details |
| `temperature_sensor` | entity | – | Externe Ist-Temperatur: `sensor.*` oder Thermostat `climate.*` (dessen `current_temperature`/`current_humidity`). Leer = Werte der Klimaanlage |
| `use_sensor_for_current` | bool | `true` | Externen Wert als Ist-Temperatur nutzen (Regler, Kopf, Graph). `false` = nur als Sensor-Kachel |
| `show.timer` | bool | `true` | Sleeptimer-Zeile |
| `timer_switch` | entity | – | Schalter zum Scharfschalten des Sleeptimers (`input_boolean`/`switch`) |
| `timer_time` | entity | – | Ausschaltzeit (`input_datetime`, nur Uhrzeit oder Datum + Uhrzeit) |
| `humidity_sensor` | entity | – | Externer Luftfeuchte-Sensor |
| `outdoor_sensor` | entity | – | Außentemperatur |
| `power_sensor` | entity | – | Aktuelle Leistung (W) |
| `energy_sensor` | entity | – | Energieverbrauch (kWh) |
| `window_sensor` | entity | – | Fenster-/Türkontakt (`binary_sensor`), zeigt Warnung wenn offen |
| `graph_hours` | number | `24` | Zeitraum des Verlaufsgraphen in Stunden |

## Sleeptimer einrichten

Die Karte zeigt und bedient die Helfer, die eigentliche Abschaltung übernimmt eine Automation:

1. Unter **Einstellungen → Geräte & Dienste → Helfer** anlegen:
   einen **Schalter** (`input_boolean`) und **Datum und/oder Uhrzeit** (`input_datetime`, nur Uhrzeit)
2. Den mitgelieferten Blueprint importieren:
   [![Blueprint importieren](https://my.home-assistant.io/badges/blueprint_import.svg)](https://my.home-assistant.io/redirect/blueprint_import/?blueprint_url=https%3A%2F%2Fgithub.com%2Fpassi277%2FHA_Climate_Card%2Fblob%2Fmain%2Fblueprints%2Fautomation%2Fha_climate_card%2Fclimate_sleep_timer.yaml)
   und daraus eine Automation mit Klimaanlage, Schalter und Uhrzeit erstellen
   (optional: Timer nach dem Ausschalten automatisch entschärfen)
3. In der Karte `timer_switch` und `timer_time` eintragen

Bestehende eigene Sleeptimer-Automationen funktionieren genauso – die Karte braucht nur die beiden Helfer.

## Entwicklung

```bash
npm install
npm run watch      # baut dist/ha-climate-card.js bei Änderungen
npm run lint       # TypeScript-Prüfung
npm run build      # Produktions-Build
```

`demo/index.html` ist eine eigenständige Demo mit simuliertem Home Assistant – einfach
per Doppelklick im Browser öffnen (kein Server nötig). Sie wird bei `npm run build` aus
`demo/template.html` neu erzeugt. URL-Parameter: `?dark=1` für das dunkle Theme,
`?lang=en` für Englisch.

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
