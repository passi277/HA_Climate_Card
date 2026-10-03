# HA Modern Home Cards

Moderne Lovelace-Karten für Home Assistant im gemeinsamen Design – Ring-Regler, Glow,
weiche Farbübergänge und Animationen. Ein HACS-Download, mehrere Karten:

| Karte | Typ | Für |
| --- | --- | --- |
| **Modern Climate Card** | `custom:ha-climate-card` | Klimaanlagen und Heizungen/Thermostate |
| **Modern Light Card** | `custom:ha-light-card` | Lampen und Lichtgruppen (z.B. Hue-Räume) |
| **Modern Light Group** | `custom:ha-light-group-card` | frei zusammengestellte Lampen: Gruppe oben, Einzellampen darunter |
| **Modern Cover Card** | `custom:ha-cover-card` | Rollläden, Jalousien, Markisen – einzeln oder als HA-Gruppe |
| **Modern Cover Group** | `custom:ha-cover-group-card` | frei zusammengestellte Rollläden: alle oben, einzelne darunter |
| **Modern Switch & Time** | `custom:ha-switch-time-card` | Schalter + Uhrzeit (input_datetime): Wecker, Zeitschaltung, Sleeptimer |
| **Modern Media Card** | `custom:ha-media-card` | Harmony Hub (Aktivitäten, Fernbedienung) und Media-Player |
| **Modern Room Header** | `custom:ha-room-card` | Raum-Kopf mit Status-Chips und Hinweis „Fenster offen – Klima läuft“ |
| **Modern Status Card** | `custom:ha-status-card` | Batterien (automatisch je Bereich) und Tür-/Fensterkontakte |
| **Modern Vacuum Card** | `custom:ha-vacuum-card` | Saugroboter mit Karte, Raumauswahl und Raumreinigung |
| **Modern Presence Card** | `custom:ha-presence-card` | Personen mit Foto und Handy-Akku plus Haustür (Nuki Opener: Halten zum Öffnen, Ring to Open) |
| **Modern Alert Card** | `custom:ha-alert-card` | Hinweise, die nur erscheinen, wenn etwas los ist („Fenster offen – Marcel“) |
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
- **Weißton** (Kelvin-Regler) und **Farbe** (Farbton-Regler + Farbfelder), **Szenen/Effekte** (z.B. Hue Play Gradient, Govee) – lange Listen mit Suchfeld
- **LED-Segmente** als farbige Leiste und **Geräteschalter** (z.B. Govee „Gradient“), automatisch erkannt
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
| `lights_layout` | `rows` | `rows` = jede Lampe einzeln steuerbar (Regler, ⚙ Weißton/Farbe), `tiles` = kompakte Ein/Aus-Kacheln |
| `scenes` / `auto_scenes` | Hue-Szenen / `true` | Szenen-Chips |
| `segments` / `auto_segments` | `light.<name>_segment_NNN` / `true` | Segmente eines LED-Streifens |
| `shortcuts` / `auto_shortcuts` | Schalter/Buttons des Geräts / `true` | Geräteschalter (ohne technische Power-/Request-Entitäten) |
| `motion_sensor`, `illuminance_sensor` | – | Anzeige im Kopf |
| `show.lights/scenes/color/temperature/effects/segments/shortcuts` | `true` | Bereiche ein-/ausblenden |
| `expandable`, `start_expanded`, `animations` | `true`, `false`, `full` | wie bei der Klima-Karte |

### Govee (govee2mqtt)

Govee-Lampen und -Streifen funktionieren direkt: An/Aus, Helligkeit, Farbe, Weißton und die Govee-Szenen.

- **Szenen**: Die ~300 Govee-Szenen erscheinen als Liste mit **Suche** („fire“ → alle Fire-Varianten). „Kein Effekt“ beendet eine Szene, indem die aktuelle Farbe bzw. der Weißton erneut gesetzt wird.
- **Segmente**: `light.carport_segment_001…` werden zur Haupt-Lampe `light.carport` (auch `light.carport_2`) automatisch erkannt und als Leiste in ihrer Farbe gezeigt; Tippen öffnet die Details des Segments.
- **Schalter** wie `switch.carport_gradient_toggle` erscheinen als Button; Power-Switch und „Request … State“-Buttons werden ausgeblendet.
- Segmente und Schalter gibt es nur in der Home-Assistant-Instanz, in der govee2mqtt läuft. Wird die Lampe in ein anderes HA gespiegelt (z.B. per Remote Home-Assistant), dort die Karten ebenfalls über HACS installieren – oder die Segmente per `segments:` angeben, falls sie mitgespiegelt werden.

```yaml
type: custom:ha-light-card
entity: light.carport_2
# segments: [light.carport_segment_001, light.carport_segment_002]
# shortcuts: [switch.carport_gradient_toggle]
```

## Modern Light Group

Beliebige Lampen zu einer Karte zusammenstellen – auch ohne Lichtgruppe in Home Assistant und gemischt
(Hue, Govee, Zigbee, Ein/Aus-Steckdosen …).

- **Oben die Gruppe**: Status („3 von 5 an · 79 %“), alle ein/aus, leuchtender Helligkeitsregler für alle
  dimmbaren Lampen, „Farbe für alle“ (Weißtöne nur an Lampen mit Weißton, Farben nur an Farblampen)
- **Darunter jede Lampe** im Kompakt-Stil – automatisch nur mit dem, was sie kann:
  Helligkeitsregler nur bei dimmbaren Lampen, über ⚙ Weißton / Farbe / Effekte nur wenn unterstützt,
  reine Ein/Aus-Lampen nur mit Schalter, nicht verfügbare Lampen ausgegraut
- Tippen auf den Namen öffnet die Details der Lampe; Einzellampen lassen sich zuklappen

```yaml
type: custom:ha-light-group-card
title: Wohnzimmer
entities:
  - light.stehlampe
  - light.deckenlicht
  - entity: light.lichterkette
    name: Lichterkette
    icon: mdi:string-lights
# collapsed: true        # Einzellampen anfangs zugeklappt
# group_color: false     # „Farbe für alle“ ausblenden
# show_lights: false     # nur die Gruppenzeile
# scenes: [scene.gastezimmer_hell, scene.gastezimmer_nachtlicht]   # Szenen als Chips
```

## Modern Cover Card (Rollläden)

- **Fenster-Grafik**: Der Rollladen fährt sichtbar herunter, Licht fällt durch den offenen Teil – **ins Fenster tippen oder ziehen** stellt die Position ein
- **Auf / Stopp / Ab**, **Schnellwahl** (Zu, 25 %, 50 %, 75 %, Auf – frei einstellbar), Farbe wandert von kühlem Blaugrau (zu) zu warmem Tageslicht (offen)
- **Gleichmäßige Fahrt**: Echte Rollläden melden ihre Position meist erst am Ende – die Karte lässt den Panzer
  trotzdem flüssig zum Ziel gleiten (`travel_time`, Standard 20 s für ganz zu → ganz auf), Stopp hält ihn sanft an
- **Blick aus dem Fenster nach Sonnenstand** (`sun.sun`): tagsüber Sonne (wandert mit Höhe und Himmelsrichtung),
  Abend-/Morgenrot in der Dämmerung, nachts Mond und Sterne; optional Wolken, Regen, Schnee, Nebel aus `weather_entity`
- **Cover-Gruppen** (z.B. „Rollos Pascal“): alle Rollläden der Gruppe darunter als Kacheln nebeneinander
- **Lamellen** (Raffstore/Jalousie) nur, wenn unterstützt; **Fenster-/Türkontakte** als Hinweis
- Nur was das Gerät kann: ohne Positionsangabe nur Auf/Ab, ohne Stopp kein Stopp-Button
- `layout: compact` mit leuchtendem Positionsregler

```yaml
type: custom:ha-cover-card
entity: cover.rollos_pascal          # einzelner Rollladen oder Cover-Gruppe
contact_sensors: [binary_sensor.fenster_wohnzimmer]
# positions: [0, 30, 60, 100]       # eigene Schnellwahl (% offen)
# travel_time: 25                   # Fahrzeit ganz zu → ganz auf (s)
# weather_entity: weather.zuhause   # Wolken/Regen im Fenster
# show: { sky: false }              # neutraler Himmel statt Sonnenstand
# timer_switch: input_boolean.schalter_rolladen   # Rollo-Timer („Fährt um …“)
# timer_time: input_datetime.timer_rolladen
# layout: compact
```

### Modern Cover Group

Beliebige Rollläden in einer Karte: oben „Alle auf / Stopp / Alle zu“, gemeinsamer Positionsregler und Schnellwahl
(nur für Rollläden mit Position), darunter jeder Rollladen als **Kachel nebeneinander** – kleines Fenster mit Himmel
(ziehen stellt die Position ein), Name, Status und genau die Knöpfe, die er kann. So viele Kacheln pro Reihe, wie in
die Breite passen. Die Rollläden einer Cover-Gruppe in der Modern Cover Card erscheinen ebenso als Kacheln.

```yaml
type: custom:ha-cover-group-card
title: Erdgeschoss
entities:
  - cover.schreibtisch
  - cover.tv
  - cover.mario
# collapsed: true          # Einzelne anfangs zugeklappt
```

## Modern Switch & Time

Einfache Karte aus einem Schalter (`input_boolean`, `switch`, Automation …) und einem `input_datetime`:
Status „An · in 7:12 h“, großer Schalter, große Uhrzeit – antippen öffnet die Stunden-/Minuten-Auswahl
(−/+, gedrückt halten), bei `input_datetime` mit Datum zusätzlich der Tag (‹ Morgen, So., 04.10. ›).
Änderungen werden gesammelt und nach kurzer Pause als ein Befehl gesendet.

```yaml
type: custom:ha-switch-time-card
switch_entity: input_boolean.wecker
time_entity: input_datetime.weckzeit
# name: Wecker
# icon: mdi:alarm
# color: "#ffb300"        # Akzentfarbe
# minute_step: 1          # Standard 5
# show_remaining: false   # „in 7:12 h“ ausblenden
# switch_style: button    # nur Symbol + Text, Tippen schaltet (statt Kippschalter)
```

Was zur eingestellten Zeit passiert, regelt eine Automation (Auslöser „Zeit“ mit dem `input_datetime`,
Bedingung: Schalter an).

## Modern Media Card

Für **Harmony Hubs** (`remote.*`) und/oder **Media-Player** (`media_player.*`):

- **Aktivitäten** als Kacheln mit passendem Symbol (PlayStation, TV, PC, Lautsprecher …) und kurzen Namen
  („Smart TV wiedergeben“ → „Smart TV“); die laufende leuchtet, beim Start pulsiert die gewählte; Power = alles aus
- **Fernbedienung**: Steuerkreuz mit OK, Zurück/Home/Menü, Spulen/Play/Pause – gedrückt halten wiederholt.
  Befehle gehen per `remote.send_command` an das Gerät der laufenden Aktivität (z.B. „Smart TV“ → Fernseher)
- **Lautstärke**: am Media-Player als Regler, beim Harmony Hub als Lauter/Leiser/Stumm an Soundbar/AV-Receiver
  (automatisch erkannt), dazu Kanal ±
- **Läuft gerade** (mit `media_player`): Cover, Titel, Fortschritt, Zurück/Play-Pause/Weiter; **Quelle** wählbar
- Nur was die Geräte können; Geräte und Aktivitäten im Editor einstellbar

```yaml
type: custom:ha-media-card
entity: remote.harmony_hub_wohnzimmer
media_player: media_player.tv_wohnzimmer    # optional: Läuft gerade, Lautstärke, Quelle
# volume_device: Samsung 9.1.4              # sonst automatisch (Soundbar/AV-Receiver)
# control_device: Sony TV Wohnzimmer        # sonst Gerät der laufenden Aktivität
# activities:                               # Auswahl/Reihenfolge, eigene Namen/Symbole
#   - Smart TV wiedergeben
#   - name: Ps4
#     label: PlayStation
#     control_device: Philips AV-Switch
# commands: { select: OK }                  # abweichende Harmony-Befehlsnamen
# timer_switch: input_boolean.schalter_tv   # Sleeptimer wie bei der Klima-Karte
# timer_time: input_datetime.timer_tv
```

## Modern Room Header

Kopf einer Raumseite: großer Titel, darunter Status-Chips – nur die, die du einträgst:
Licht (an/aus, %, Lichtfarbe; Tippen schaltet), Fenster/Türen („Schreibtisch offen“ / „Fenster zu“),
Temperatur, Luftfeuchte (orange ab `humidity_warning`), Klima/Heizung (Sollwert in Modusfarbe),
TV/Harmony (laufende Aktivität), beliebige weitere Chips. Ist ein Fenster offen, während Klima oder Heizung
läuft, erscheint ein Hinweis mit Button „Klima aus“ (zweimal tippen zum Bestätigen).

```yaml
type: custom:ha-room-card
title: Pascal
icon: mdi:account
light: light.licht_mein_zimmer
contacts:
  - entity: binary_sensor.fenster_schreibtisch
    name: Schreibtisch
temperature: climate.heizung_mein_zimmer     # Sensor oder Klima-Entität
humidity: climate.heizung_mein_zimmer
climate: climate.klima_pascal
media: remote.harmony_schlafzimmer
trash: calendar.abfallkalender_mannheim   # Müllabfuhr: „Restmüll · morgen“
# trash_days: 1               # 0 = nur heute, 1 = heute + morgen (Standard)
# trash_today_until: "10:00"  # heutige Abholung danach ausblenden
# navigation_path: /dashboard-final/pascal   # Tippen auf den Titel öffnet die Seite
# chips: [switch.monitore]
```

### Raumkacheln (`layout: tile`)

Kompakte Kachel für Übersichtsseiten – drei nebeneinander (`grid_options: columns: 4`). Tippen öffnet die Raumseite,
**lange drücken schaltet das Licht**. Raumsymbol und Name stehen mittig, das Symbol leuchtet in der Lichtfarbe.
Kleine Symbole in den Ecken zeigen, was gerade los ist – oben links Licht an, oben rechts Fenster/Tür offen,
unten links Klima/Heizung (bzw. Feuchte zu hoch), unten rechts TV (bzw. Müllabfuhr heute/morgen). Darunter Temperatur/Feuchte
oder der Wert des ersten Chips (z.B. Saugroboter-Status).

```yaml
type: custom:ha-room-card
layout: tile
title: Wohnzimmer
icon: mdi:sofa
color: "#fb8c00"              # Farbe, wenn kein Licht an ist
navigation_path: /dashboard-final/wohnzimmer
light: light.lampe_wohnzimmer
temperature: sensor.wohnzimmer_temperatur
climate: climate.klima_wohnzimmer
contacts: [binary_sensor.fenster_wohnzimmer]
grid_options:
  columns: 4
```

## Modern Status Card

Batterien und Kontakte auf einen Blick: „Alle in Ordnung“ bzw. „Schwach: Heizkörperthermostat 8 %“,
aufklappbare Liste (schwächste zuerst, Ampelfarben, Batterietyp aus **Battery Notes** wie „2× AA“).
Mit `areas` werden die Batterien eines Bereichs automatisch gefunden (je Gerät ein Sensor, Raumname wird
aus den Namen entfernt). Tür-/Fensterkontakte als Zeilen „Offen/Zu“.

```yaml
type: custom:ha-status-card
areas: [mein_zimmer]
contacts:
  - entity: binary_sensor.turkontakt
    name: Tür
# threshold: 20                         # schwach unter 20 %
# navigation_path: /dashboard-final/batterie
shopping_list: true      # Einkaufsliste nach Batterietyp
# show_replaced: false   # „gewechselt vor …“ ausblenden
```

### Licht-Presets

`presets: default` zeigt in der Light Card bzw. Licht-Gruppe **Hell** (100 %/4000 K), **Warm** (70 %/2700 K)
und **Gemütlich** (25 %/2200 K) – das aktive leuchtet. Eigene: `presets: [{ name: Lesen, icon: mdi:book, brightness: 80, kelvin: 3500 }]`
(auch `rgb: [255, 0, 120]`).

## Modern Vacuum Card (Saugroboter)

- **Live-Karte** aus dem Kartenbild (z.B. Roborock Custom Map, `image.*`) – mit Roboter-Position, automatisch auf die
  Wohnung zugeschnitten
- **Räume direkt auf der Karte antippen** (Raumgrenzen über die Kalibrierpunkte) oder als Chips wählen →
  „2 Räume reinigen“, 1×/2×/3× – per `vacuum.send_command` `app_segment_clean`
- Status (Reinigt · Küche), Batterie, Fortschritt, Fehler; Start/Pause, Stopp, Station, Suchen (nur was der Roboter kann)
- Routinen-Buttons des Geräts (z.B. „Alles“, „Kanten Flur“), Saugstärke und Auswahlen wie Reinigungsmodus/Wisch-Intensität
- Wartung: Filter, Bürsten, Sensoren – fällige werden hervorgehoben

```yaml
type: custom:ha-vacuum-card
entity: vacuum.roborock_s8_maxv_ultra
# map: image.roborock_s8_maxv_ultra_wohnung_custom   # sonst automatisch
# maintenance_sensors:                              # Station (eigenes Gerät) in die Wartung
#   - sensor.roborock_s8_maxv_ultra_dock_schmutzfanger_verbleibend
# rooms:                                              # eigene Auswahl/Namen
#   - { id: 22, name: Pascal }
```

## Modern Presence Card (Personen & Haustür)

- **Personen** als Foto-Kacheln: Zuhause (grüner Punkt) / Unterwegs (Foto entsättigt) / Zone, „seit 2 Std“
- **Handy-Akku** automatisch über den Device-Tracker der Person (Companion App) – rot unter 20 %, ⚡ beim Laden
- **Haustür / Nuki Opener**: zum Öffnen **halten** (0,9 s, Fortschrittsring – kein versehentliches Öffnen), „Geöffnet“ als Rückmeldung;
  `open_confirm: tap` öffnet per Tippen
- **Ring to Open** an/aus (Opener: `lock.unlock` / `lock.lock`), beim Türschloss „Abschließen“
- **Klingel**: „Es klingelt!“ mit Animation, danach „Geklingelt · 3 Min“; Batterie-Warnung des Geräts – beides automatisch vom Schloss-Gerät

```yaml
type: custom:ha-presence-card
persons:
  - person.pascal
  - person.marcel
lock: lock.klingel
door_name: Klingel
# open_action: script.klingel_offnen   # statt lock.open ein Skript/Button
# open_confirm: tap                    # Standard: hold
# show_battery: false
```

## Modern Alert Card (Hinweise)

Erscheint **nur, wenn etwas los ist** – sonst ist die Karte samt Platz ausgeblendet (wie eine bedingte Karte).
Jeder aktive Hinweis ist eine farbige Zeile mit pulsierendem Symbol; Tippen öffnet die Details oder eine Seite.

- `contacts`: „Fenster offen – Marcel“, bei mehreren „Fenster/Türen offen – Küche · Marcel“
- `alerts`: beliebige Entitäten mit `state` / `state_not` / `above` / `below`, `severity` (info, warning, error, success)

```yaml
type: custom:ha-alert-card
contacts:
  - entity: binary_sensor.fenster_kuche
    name: Küche
  - entity: binary_sensor.fernster_marcel
    name: Marcel
alerts:
  - entity: vacuum.roborock_s8_maxv_ultra
    state: error
    severity: error
    title: Saugroboter hat ein Problem
    navigation_path: /dashboard-final/roborock
  - entity: sensor.bad_batterie
    below: 10
    title: Batterie Bad fast leer
# show_ok: true   # statt ausblenden „Alles in Ordnung“ zeigen
```

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
  lights, Hue scenes, white tone/color/effects, Govee segments and scene search, motion and illuminance
- `custom:ha-light-group-card` – any set of lights: group control on top, each light below showing only
  what it supports (brightness, white tone, color, effects or just on/off)
- `custom:ha-cover-card` – covers/shutters (single or group): draggable window graphic, up/stop/down, quick
  positions, tilt, group members, window contacts
- `custom:ha-cover-group-card` – any set of covers: all together on top, each cover below with only its supported controls
- `custom:ha-switch-time-card` – a switch plus an input_datetime (alarm, time switch, sleep timer) with an app-friendly time picker
- `custom:ha-media-card` – Harmony Hub activities and remote (commands routed to the right device) plus media player (now playing, volume, source)
- `custom:ha-room-card` – room header with status chips (incl. waste collection from a calendar) and a "window open – A/C running" warning; `layout: tile` = room tile for overview pages (tap navigates, long press toggles the light)
- `custom:ha-status-card` – batteries (per area, Battery Notes aware) and door/window contacts
- `custom:ha-vacuum-card` – robot vacuum with live map, tap rooms on the map for room cleaning, controls, modes, maintenance
- `custom:ha-presence-card` – people as photo tiles (home/away, phone battery and charging found automatically) plus front door: hold to open (Nuki Opener), Ring to Open, doorbell
- `custom:ha-alert-card` – alerts that only appear when something is going on (window open, vacuum error, low battery …), hidden otherwise
- `custom:ha-climate-overview-card` – all climate devices at a glance

Install via HACS as a custom repository of type **Dashboard**. All cards have a visual editor and are
available in German and English.

## Lizenz

MIT
