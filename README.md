# HA Modern Home Cards

Moderne Lovelace-Karten für Home Assistant im gemeinsamen Design – Ring-Regler, Glow,
weiche Farbübergänge und Animationen. Ein HACS-Download, mehrere Karten:

| Karte | Typ | Für |
| --- | --- | --- |
| **Modern Climate Card** | `custom:ha-climate-card` | Klimaanlagen und Heizungen/Thermostate |
| **Modern Light Card** | `custom:ha-light-card` | Lampen und Lichtgruppen (z.B. Hue-Räume) |
| **Climate Overview** | `custom:ha-climate-overview-card` | alle Klimageräte auf einen Blick |

*Modern Lovelace cards for Home Assistant in one shared design – English summary below.*

<p align="center"><img src="docs/preview.gif" alt="Animierte Vorschau" width="360"></p>

| Hell | Dunkel |
| --- | --- |
| ![Vorschau hell](docs/preview-light.png) | ![Vorschau dunkel](docs/preview-dark.png) |

## Modern Climate Card – Funktionen

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
- **Tätigkeit auch ohne `hvac_action`:** Geräte wie Gree melden nicht, ob sie gerade kühlen – die Karte leitet es aus Ist-/Solltemperatur (optional Leistung) ab, inkl. Animationen und Laufzeit
- **Ziel-Prognose:** „Ziel in ca. 25 min“, geschätzt aus dem Temperaturverlauf; **Laufzeit heute** als Kachel
- **Status-Chips** im Kopf: Voreinstellung, aktive Schalter, Sleeptimer, Schnell-Timer
- **Deutsche Bezeichnungen** für Lüfter-, Lamellen- und Preset-Werte (z.B. Gree „Oben fest“, „Mittel-niedrig“)
- **Rückmeldung & Komfort:** Sync-Anzeige, Fehlermeldung bei fehlgeschlagenen Befehlen, Haptik in der HA-App, +/− gedrückt halten
- **Für Wandtablets:** `animations: reduced` oder `off`; Verlauf lädt erst beim Aufklappen
- **Smarte Hinweise:** „Lüften statt Kühlen/Heizen“, wenn es draußen deutlich kühler/wärmer ist, sowie Schimmelwarnung bei hoher Luftfeuchte (mit Taupunkt und Ein-Tipp-„Entfeuchten“)
- **Wetter heute:** Höchst-/Tiefsttemperatur, Regenwahrscheinlichkeit und Wettersymbol aus einer `weather`-Entität
- **Schnell-Timer:** „Ausschalten in 30 / 60 / 90 / 120 min“ mit Countdown (Timer-Helfer + Blueprint)
- **Luftstrom-Animation:** dezente Animation, Tempo nach Lüfterstufe, Pendeln nach Lamellenstellung
- **Übersichtskarte:** alle Klimaanlagen auf einen Blick mit Regler, Ein/Aus und „Alle aus“ (`custom:ha-climate-overview-card`)
- **Zusatzsensoren:** Raumtemperatur, Raumluftfeuchte, Außentemperatur, Leistung, Energie, Fenster-/Türkontakt
- **Fenster-Warnung**, wenn der Kontakt offen ist
- **Verlaufsgraph** (Ist- und Zieltemperatur, Heiz-/Kühlphasen als Farbbänder)
- **Visueller Editor** im Dashboard – kein YAML nötig
- **Deutsch & Englisch** (folgt der HA-Spracheinstellung; Modi werden über die HA-eigenen Übersetzungen der Integration angezeigt)
- Passt sich dem HA-Theme an (hell/dunkel), Tastaturbedienung am Regler

- **Heizungen & Thermostate:** automatisch erkanntes Heizungs-Profil (z.B. Homematic IP) mit Wochenprogramm-Leiste, „Nächster Wechsel“, Boost-Button, Ventilöffnung je Heizkörper, Batterie-Warnung, Abwesend-Modus und Wärmewellen-Animation

## Installation

### HACS (empfohlen)

1. HACS öffnen → oben rechts **⋮ → Benutzerdefinierte Repositories**
2. URL `https://github.com/passi277/HA-Modern-Home-Cards` mit Typ **Dashboard** hinzufügen
3. „HA Modern Home Cards“ suchen, installieren und den Browser neu laden

### Manuell

1. `dist/ha-modern-home-cards.js` nach `<config>/www/` kopieren
2. Unter **Einstellungen → Dashboards → ⋮ → Ressourcen** hinzufügen:
   URL `/local/ha-modern-home-cards.js`, Typ **JavaScript-Modul**

### Umstieg von „HA Climate Card“

Das Projekt hieß früher *HA Climate Card*. Alle Kartentypen bleiben gleich, deine Karten laufen weiter.
`dist/ha-climate-card.js` wird übergangsweise weiter mitgeliefert. Nach der Umbenennung des Repos:
in HACS das alte benutzerdefinierte Repository entfernen, das neue hinzufügen, installieren und die alte
Ressource `/hacsfiles/HA_Climate_Card/ha-climate-card.js` unter *Dashboards → Ressourcen* löschen.

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
countdown_timer: timer.klima_wohnzimmer
countdown_durations: [30, 60, 90, 120]
weather_entity: weather.zuhause
ventilation_delta: 3     # Lüften-Hinweis ab 3° Unterschied innen/außen
humidity_warning: 70     # Schimmelwarnung ab 70 % Luftfeuchte (0 = aus)
humidity_sensor: sensor.wohnzimmer_luftfeuchte
outdoor_sensor: sensor.aussentemperatur
power_sensor: sensor.klima_leistung
energy_sensor: sensor.klima_energie
contact_sensors:          # beliebig viele Fenster und Türen
  - binary_sensor.wohnzimmer_fenster
  - entity: binary_sensor.balkon
    name: Balkontür
    type: door              # optional, sonst aus device_class bzw. Name erkannt
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
| `show.timer` | bool | `true` | Sleeptimer- und Schnell-Timer-Zeile |
| `show.hints` | bool | `true` | Hinweise (Lüften, Schimmel) und Taupunkt-Kachel |
| `show.airflow` | bool | `true` | Luftstrom-Animation, solange das Gerät läuft |
| `device_type` | `auto` \| `ac` \| `heating` | `auto` | Darstellung als Klimaanlage oder Heizung; `auto` erkennt Thermostate (keine Lüfter/Lamellen, nur Heizen/Auto/Aus) |
| `valve_sensors` | list | automatisch | Ventilöffnung (%) der Heizkörper; ohne Angabe aus Gerät/Bereich übernommen |
| `battery_sensors` | list | automatisch | Batteriestand (%) der Thermostate; Warnung unter 20 % |
| `auto_heating_sensors` | bool | `true` | Ventil-/Batteriesensoren automatisch aus Gerät bzw. Bereich übernehmen |
| `away_temperature` | number | `17` | Temperatur für „Abwesend“ (Homematic `enable_away_mode_by_duration`) |
| `animations` | `full` \| `reduced` \| `off` | `full` | `reduced`: keine Daueranimationen (für ältere Wandtablets), `off`: zusätzlich keine Übergänge |
| `power_threshold` | number | `25` | Unter dieser Leistung (W, aus `power_sensor`) gilt das Gerät als im Leerlauf – für Geräte ohne `hvac_action` |
| `countdown_timer` | entity | – | Timer-Helfer (`timer.*`) für „Ausschalten in …“ |
| `countdown_durations` | list | `[30, 60, 90, 120]` | Schnell-Timer-Dauern in Minuten |
| `weather_entity` | entity | – | Wetter-Entität für die Vorhersage heute; dient auch als Außentemperatur, wenn kein `outdoor_sensor` gesetzt ist |
| `ventilation_delta` | number | `3` | Temperaturdifferenz innen/außen, ab der „Lüften statt Kühlen/Heizen“ erscheint |
| `humidity_warning` | number | `70` | Luftfeuchte (%), ab der die Schimmelwarnung erscheint (`0` = aus) |
| `timer_switch` | entity | – | Schalter zum Scharfschalten des Sleeptimers (`input_boolean`/`switch`) |
| `timer_time` | entity | – | Ausschaltzeit (`input_datetime`, nur Uhrzeit oder Datum + Uhrzeit) |
| `humidity_sensor` | entity | – | Externer Luftfeuchte-Sensor |
| `outdoor_sensor` | entity | – | Außentemperatur (`sensor.*` oder `weather.*`) |
| `power_sensor` | entity | – | Aktuelle Leistung (W) |
| `energy_sensor` | entity | – | Energieverbrauch (kWh) |
| `contact_sensors` | list | – | Beliebig viele Fenster-/Türkontakte (`binary_sensor`): Entity-IDs oder `{entity, name, type: window\|door}`. Offene werden im Kopf, als Hinweis und als Chip angezeigt |
| `window_sensor` | entity | – | Veraltet (ein einzelner Kontakt) – funktioniert weiter und wird im Editor automatisch in `contact_sensors` übernommen |
| `graph_hours` | number | `24` | Zeitraum des Verlaufsgraphen in Stunden |

## Modern Light Card

Licht im gleichen Design: Ring = Helligkeit, Glow und Ring leuchten in der echten Lichtfarbe.

- **Helligkeitsring** (nur am Ring bedienbar) mit −/+ (gedrückt halten), Kompakt-Variante als Farbverlauf-Regler
- **Lampen des Raums**: bei Lichtgruppen (z.B. Hue-Räume) automatisch, jede mit eigener Farbe, antippen schaltet, lange drücken öffnet Details
- **Szenen**: Hue-Szenen der Gruppe automatisch (doppelte zusammengefasst) oder eigene Liste
- **Weißton** (Kelvin-Regler) und **Farbe** (Farbton-Regler + Farbfelder), **Effekte** (z.B. Hue Play Gradient)
- **Bewegungsmelder** („Bewegung vor 4 min“) und **Helligkeitssensor** (lx) im Kopf
- Visueller Editor, Deutsch/Englisch, `animations`-Option

```yaml
type: custom:ha-light-card
entity: light.gaste_wc                  # Lampe oder Gruppe
motion_sensor: binary_sensor.bewegung_gaste_wc
illuminance_sensor: sensor.helligkeit_gaste_wc
layout: full                            # full | compact
# entities: [light.a, light.b]          # eigene Lampenliste statt Gruppe
# scenes: [scene.lesen, scene.hell]     # eigene Szenen statt Hue-Szenen
```

| Option | Standard | Beschreibung |
| --- | --- | --- |
| `entity` | – | `light.*` (Lampe oder Gruppe) |
| `layout` | `full` | `full` (Ring) oder `compact` (Regler) |
| `entities` / `auto_entities` | aus Gruppe / `true` | Lampen des Raums |
| `scenes` / `auto_scenes` | Hue-Szenen / `true` | Szenen-Chips |
| `motion_sensor`, `illuminance_sensor` | – | Anzeige im Kopf |
| `show.lights/scenes/color/temperature/effects` | `true` | Bereiche ein-/ausblenden |
| `expandable`, `start_expanded`, `animations` | `true`, `false`, `full` | wie bei der Klima-Karte |

## Heizungen (z.B. Homematic IP)

Thermostate werden automatisch erkannt. Die Karte zeigt dann statt Lüfter, Lamellen und Luftstrom:

- **Wochenprogramm** als Tagesleiste (aus `schedule_data`), Wochentag umschaltbar, aktuelles Profil (P1…) und „Nächster Wechsel 17:00 → 21°“ im Kopf
- **Boost-Button** neben −/+, **Ventilöffnung** je Heizkörper, **Batterie-Warnung**
- **Abwesend** für 1 Tag / 3 Tage / 1 Woche (nur mit der Integration *Homematic(IP) Local*)
- **Wärmewellen** statt Luftstrom, Tempo nach Ventilöffnung; die Tätigkeit wird bei Bedarf aus der Ventilöffnung abgeleitet

Empfohlene Einrichtung pro Raum:

```yaml
type: custom:ha-climate-card
entity: climate.heizung_group_mein_zimmer_int0000001   # Heizgruppe
temperature_sensor: climate.hmip_wth_2_000a98a9a4cb73   # Wandthermostat (Ist-Temp + Luftfeuchte)
contact_sensors:
  - binary_sensor.fenster_mein_zimmer
# valve_sensors / battery_sensors werden aus Gerät bzw. Bereich übernommen
```

Das Wochenprogramm selbst bearbeitest du weiterhin z.B. mit der *Homematic(IP) Local Climate Schedule Card*.

## Übersichtskarte

Alle Klimaanlagen in einer Karte – Ist-Temperatur, Status, Sollwert mit +/−, Ein/Aus pro Gerät und „Alle aus“:

```yaml
type: custom:ha-climate-overview-card
title: Klimaanlagen
entities:
  - climate.wohnzimmer
  - climate.schlafzimmer
  - entity: climate.marcel
    name: Marcel
show_all_off: true     # „Alle aus“-Button
show_controls: true    # Sollwert-Regler je Gerät
```

## Schnell-Timer einrichten

1. Helfer **Timer** (`timer.*`) anlegen
2. Blueprint importieren und Automation erstellen:
   [![Blueprint importieren](https://my.home-assistant.io/badges/blueprint_import.svg)](https://my.home-assistant.io/redirect/blueprint_import/?blueprint_url=https%3A%2F%2Fgithub.com%2Fpassi277%2FHA_Climate_Card%2Fblob%2Fmain%2Fblueprints%2Fautomation%2Fha_climate_card%2Fclimate_countdown_timer.yaml)
3. In der Karte `countdown_timer` eintragen – die Buttons starten den Timer, beim Ablauf schaltet die Automation aus

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

**HA Modern Home Cards** is a collection of Lovelace cards sharing one modern design (ring controls,
glow, smooth color transitions, animations), shipped as a single HACS download:

- `custom:ha-climate-card` – air conditioners and heating/thermostats: draggable dial, every `climate`
  feature, inferred activity for devices like Gree, weekly schedule/boost/valves for thermostats like
  Homematic IP, sensors, windows/doors, hints, timers, history graph
- `custom:ha-light-card` – lights and light groups: brightness ring glowing in the light's color, room
  lights, Hue scenes, white tone/color/effects, motion and illuminance
- `custom:ha-climate-overview-card` – all climate devices at a glance

Install via HACS as a custom repository of type **Dashboard**. All cards have a visual editor and are
available in German and English.

## Lizenz

MIT
