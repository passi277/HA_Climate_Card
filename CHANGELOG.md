# Changelog

## 1.9.0 – Personen & Haustür
- Neu: **Modern Presence Card** (`custom:ha-presence-card`) – Personen als Foto-Kacheln (Zuhause/Unterwegs/Zone, seit wann), Handy-Akku und Laden automatisch über den Device-Tracker, Haustür/Nuki Opener mit „Halten zum Öffnen“ (Fortschrittsring), Ring to Open, Klingel-Anzeige und Batterie-Warnung, visueller Editor

## 1.8.0 – Saugroboter
- Neu: **Modern Vacuum Card** (`custom:ha-vacuum-card`) – Live-Karte (zugeschnitten), Räume auf der Karte oder als Chips wählen, Raumreinigung mit Durchgängen (`app_segment_clean`), Status/Batterie/Fortschritt/Fehler, Start/Pause/Stopp/Station/Suchen, Routinen-Buttons, Saugstärke und Modi vom Gerät, Wartung, visueller Editor

## 1.7.5
- Rollladen-Karte und Rollladen-Gruppe: **Rollo-Timer** (`timer_switch` + `timer_time`) – „Fährt um 06:30 · in 12:59 h“, Uhrzeit per Stunden-/Minuten-Auswahl, im Editor unter „Rollo-Timer“
- Sleeptimer-Zeile: Symbol einstellbar (intern)

## 1.7.4
- Medienkarte: Fernbedienung ließ sich in Home Assistant nicht einklappen, wenn in der Konfiguration kein `layout` stand – jedes erneute `setConfig` von HA klappte sie wieder auf. Behoben

## 1.7.3
- Medienkarte: **Sleeptimer** (`timer_switch` + `timer_time`, wie bei der Klima-Karte) für TV/Harmony
- Medienkarte: Fernbedienung samt Umschalter auch bei ausgeschaltetem Hub (Harmony sendet Befehle trotzdem an die Geräte); Umschalter robuster

## 1.7.2
- Schalter + Uhrzeit: `switch_style: button` – nur Symbol und Text, Tippen auf die Zeile schaltet (lange drücken = Details); an = Symbol leuchtet in der Akzentfarbe, Karte mit farbigem Rand

## 1.7.1
- Light Card: Lampen einer Gruppe sind jetzt **einzeln steuerbar** – je Lampe Ein/Aus, leuchtender Helligkeitsregler und über ⚙ Weißton/Farbe/Effekt (nur was die Lampe kann). `lights_layout: tiles` zeigt wie bisher kompakte Ein/Aus-Kacheln
- Lampenzeile als gemeinsame Komponente für Light Card und Licht-Gruppe

## 1.7.0 – Raum, Status, Presets
- Neu: **Modern Room Header** (`custom:ha-room-card`) – Titel mit Status-Chips (Licht, Fenster/Türen, Temperatur, Feuchte, Klima/Heizung, TV/Harmony, eigene) und Hinweis „Fenster offen – Klima läuft“ mit bestätigtem „Klima aus“
- Neu: **Modern Status Card** (`custom:ha-status-card`) – Batterien automatisch je Bereich (Battery Notes inkl. Batterietyp), Ampel-Liste, Tür-/Fensterkontakte, optional Navigation
- Light Card und Licht-Gruppe: **Presets** (`presets: default` = Hell/Warm/Gemütlich oder eigene), aktives Preset wird erkannt
- Türkontakte mit `device_class: window` werden am Namen als Tür erkannt

## 1.6.1
- Medienkarte: Umschalter „Fernbedienung“ sitzt direkt unter der Lautstärke und klappt alles darunter ein/aus (Kanal, Steuerkreuz, Tasten); der Zustand wird pro Gerät im Browser gemerkt
- Quelle steht über der Lautstärke; Symbol für Aktivitäten wie „Klimaanlage“ und „Licht“

## 1.6.0 – Medien
- Neu: **Modern Media Card** (`custom:ha-media-card`) – Harmony-Hub-Aktivitäten als Kacheln, Fernbedienung (Steuerkreuz, Zurück/Home/Menü, Spulen/Play/Pause, Lautstärke/Kanal) mit automatischer Geräte-Zuordnung, Media-Player mit „Läuft gerade“, Lautstärkeregler und Quelle, Kompakt-Layout, visueller Editor

## 1.5.0 – Schalter + Uhrzeit
- Neu: **Modern Switch & Time** (`custom:ha-switch-time-card`) – Schalter und `input_datetime` in einer Karte: Status mit Restzeit, große Uhrzeit, Stunden-/Minuten-Auswahl (auch Datum), Farbe und Minutenschritte wählbar, visueller Editor
- Zeitauswahl als gemeinsame Komponente (auch im Sleeptimer); schnelles Tippen/Halten zählt sofort weiter

## 1.4.2
- Rollladen-Gruppe und Gruppen-Mitglieder: Kacheln **nebeneinander** statt Zeilen untereinander – je Rollladen ein kleines Fenster mit Himmel (ziehen stellt die Position ein), Name, Status und Auf/Stopp/Ab; so viele pro Reihe, wie in die Breite passen
- Rollladen-Gruppe: Himmel nach Sonnenstand und Wetter auch in den Kacheln (`show_sky`, `weather_entity`)

## 1.4.1
- Rollläden fahren flüssig: Panzer bzw. Regler gleiten gleichmäßig zum Ziel, auch wenn das Gerät die Position erst am Ende meldet (`travel_time`); Stopp hält sanft an; keine ruckelnden Lamellen mehr
- Blick aus dem Fenster nach Sonnenstand (`sun.sun`): Sonne nach Höhe/Himmelsrichtung, Abendrot, Mond und Sterne bei Nacht; optional Wetter (`weather_entity`); Akzentfarbe nachts Mondlicht

## 1.4.0 – Rollläden
- Neu: **Modern Cover Card** (`custom:ha-cover-card`) – Fenster-Grafik zum Tippen/Ziehen, Auf/Stopp/Ab, Schnellwahl, Lamellen, Rollläden einer Cover-Gruppe, Fenster-/Türkontakte, Kompakt-Layout, visueller Editor
- Neu: **Modern Cover Group** (`custom:ha-cover-group-card`) – Rollläden frei zusammenstellen; oben alle gemeinsam, darunter jeder einzeln mit genau seinen Funktionen
- Fahrt-Animation (laufende Lamellen, Richtungspfeil) nur während der Bewegung

## 1.3.2
- Editor zeigt nur zum Gerät passende Optionen: Heizungen ohne Lüfter, Lamellen und Leistungsschwelle („Wärmewellen-Animation“ statt „Luftstrom“), Lüfter/Lamellen/Voreinstellungen/Ziel-Luftfeuchte nur bei unterstützten Funktionen; Hinweis „Erkannt: Heizung / Klimaanlage“
- Light-Editor: Farbe, Weißton, Effekte, Lampenliste und Segmente nur, wenn die Lampe bzw. Gruppe sie unterstützt

## 1.3.1
- Lichtregler: Glow, Lauflicht und Skala spielen nur noch kurz nach einer Änderung (heller → Lauflicht nach rechts, dunkler → nach links, neue Farbe → Aufleuchten) statt dauerhaft

## 1.3.0 – Licht-Gruppe
- Neu: **Modern Light Group** (`custom:ha-light-group-card`) – Lampen frei zusammenstellen; oben Gruppe (alle ein/aus, Helligkeit für alle dimmbaren, „Farbe für alle“), darunter jede Lampe mit genau ihren Funktionen (Helligkeit, Weißton, Farbe, Effekte, nur Ein/Aus), visueller Editor
- Kompakte Lichtkarte: Helligkeitsregler als leuchtender Füllbalken mit Glow, Lauflicht, pulsierender Skala und Knopf-Halo – wie der Drehring

## 1.2.1 – Govee
- Light Card: **LED-Segmente** (govee2mqtt `light.<name>_segment_NNN`, automatisch erkannt) als farbige Leiste, Tippen öffnet Details
- Light Card: **Geräteschalter** (z.B. Govee „Gradient“) automatisch aus dem Gerät, ohne technische Power-/Request-Entitäten
- Auswahllisten mit vielen Einträgen (z.B. ~300 Govee-Szenen) haben ein **Suchfeld**
- Effekte: leerer Eintrag / `off` / `None` = „Kein Effekt“; bei Govee beendet „Kein Effekt“ die Szene durch erneutes Setzen der Farbe
- Editor: Segmente, Geräteschalter

## 1.2.0 – HA Modern Home Cards
- Projekt heißt jetzt **HA Modern Home Cards** (eine Kartensammlung, ein Bundle `ha-modern-home-cards.js`; `ha-climate-card.js` wird übergangsweise weiter mitgeliefert, Kartentypen unverändert)
- Neu: **Modern Light Card** (`custom:ha-light-card`) – Helligkeitsring mit Glow in Lichtfarbe, Lampen der Gruppe, Hue-Szenen, Weißton/Farbe/Effekte, Bewegung & Helligkeit, Kompakt-Variante, visueller Editor
- Regler: Füllmodus für Helligkeit

## 1.1.0
- Heizungs-Profil (automatisch erkannt, `device_type`): Wochenprogramm-Zeitleiste mit Tagesauswahl und „Nächster Wechsel“, Boost-Button, Ventilöffnung je Heizkörper (`valve_sensors`, automatisch aus Gerät/Bereich), Batterie-Warnung (`battery_sensors`), Abwesend-Modus für Homematic(IP) Local, Wärmewellen-Animation, verständliche Modusnamen
- Tätigkeit kann aus der Ventilöffnung abgeleitet werden
- Übersichtskarte: Boost-Button für Heizungen

## 1.0.2
- Sleeptimer: eigene Zeitauswahl (Stunde/Minute mit +/−, gedrückt halten, Schnellwahl „in 30 min / 1 h / 2 h“) – das native Zeitfeld ließ sich in der HA-App nicht bedienen
- Entfeuchten: Verlauf zeigt die Luftfeuchte (Raumsensor, Thermostat oder Gerät) statt der Temperatur; keine Temperatur-Prognose in diesem Modus

## 1.0.1
- Außentemperatur nur noch aus echten Temperatursensoren oder Wetter-Entitäten (vorher wurde z.B. ein Zähler-Sensor „Wetter“ mit Wert „2“ angezeigt); Editor filtert entsprechend
- Kartenversion wird unten im Editor angezeigt
- Regler reagiert nur noch auf Berührungen am Ring – Tippen in die Mitte oder neben den Bogen verstellt nichts mehr; Wischen über die Mitte scrollt die Seite
- Beliebig viele Fenster- und Türkontakte (`contact_sensors`), Türen werden erkannt (device_class oder Name), Hinweis „Tür offen“ / „2 Fenster/Türen offen“, Chip-Reihe aller Kontakte

## 1.0.0

Erste Veröffentlichung.

### Karte `custom:ha-climate-card`
- Layouts `full` (Drehregler) und `compact` (Kachel mit Skala), Details ausklappbar
- Alle `climate`-Funktionen: Modi, Ein/Aus, Sollwert oder Bereich, Lüfter, Lamellen vertikal/horizontal, Presets, Ziel-Luftfeuchte
- Regler mit Verlaufsbogen Ist → Ziel, leuchtender Skala, Neon-Glow und Lauflicht
- Tätigkeit wird für Geräte ohne `hvac_action` (z.B. Gree) abgeleitet
- Externe Ist-Temperatur (Sensor oder Thermostat), Luftfeuchte, Außen, Leistung, Energie, Fensterkontakt
- Hinweise: Lüften statt Kühlen/Heizen, Schimmelwarnung mit Taupunkt und „Entfeuchten“
- Wetter heute, Ziel-Prognose, Laufzeit heute, Status-Chips
- Sleeptimer (Schalter + Uhrzeit) und Schnell-Timer (Timer-Helfer) inkl. Blueprints
- Schalter-Buttons, automatisch aus dem Gerät (z.B. Gree Frischluft, Leise, Licht, X-Fan)
- Verlaufsgraph, Luftstrom-Animation, Haptik, Fehler-Rückmeldung, +/− gedrückt halten
- Visueller Editor, Deutsch und Englisch, Hell/Dunkel, `animations`-Option

### Karte `custom:ha-climate-overview-card`
- Alle Klimaanlagen auf einen Blick mit Regler, Ein/Aus und „Alle aus“
