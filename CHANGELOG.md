# Changelog

## 1.39.0 – Rezepte, Szenen, Schlafen, Klima 2.0, Energie-Woche
- Neue **Modern Recipe Card** (`custom:ha-recipe-card`) für Mealie: Essensplan der Woche (Mittag/Abend als Spalten), freie Plätze „Zufällig“ füllen oder per Suche, „Woche füllen“/„Lücken füllen“, Rezeptsuche mit Zeit, Tags und Sternen, Rezept mit Portionen-Umrechner, abhakbaren Zutaten und Schritten, „Heute/Morgen Abend einplanen“ und „fehlende Zutaten auf die Einkaufsliste“; Mealie-Integration wird automatisch gefunden
- Neue **Modern Scene Card** (`custom:ha-scene-card`): Szenen nach Raum (Hue-Räume automatisch oder eigene Gruppen), Symbol und Farbe aus dem Namen, zuletzt aktivierte Szene markiert, Lampen des Raums mit Helligkeit, „Raum aus“ und „Alles aus“
- Neue **Modern Sleep Card** (`custom:ha-sleep-card`): Schlafmodus je Person mit Nachthimmel, Sleep-Timer mit Countdown und ±15 min, Klima, Wecker und „Gute Nacht“ (Lampen + Medien aus, Schlafmodus an – mit Bestätigung)
- Neue **Modern Climate Rooms Card** (`custom:ha-climate-rooms-card`): alle Räume mit Ist/Soll, Luftfeuchte, Heizung inkl. nächstem Wechsel aus dem Wochenprogramm, Klimaanlage, Warnung bei offenem Fenster, ±0,5°, Boost und Heizung an/aus
- Neue **Modern Energy Week Card** (`custom:ha-energy-week-card`): Verbrauch dieser Woche gegen die Vorwoche (bis zum gleichen Wochentag), Kosten, Ø pro Tag, Spitzentag, Balken Mo–So, Anteil je Verbraucher (Tag antippen für die Aufteilung), auch als Monat; ohne Angabe aus den Energie-Einstellungen

## 1.38.0 – Termine & Gerätestatus
- Neue **Modern Agenda Card** (`custom:ha-agenda-card`): nächste Abholung je Mülltonne mit Farbe/Symbol und Countdown, Erinnerung „Heute Abend rausstellen“ am Vortag, Terminliste aus mehreren Kalendern nach Tagen gruppiert
- Neue **Modern Device Status Card** (`custom:ha-device-status-card`): nicht erreichbare Geräte nach Gerät/Integration, „seit …“, Filter, betroffene Entitäten, „Gerät öffnen“ und „Integration neu laden“
- Restmüll bekommt eine eigene Farbe und ein eigenes Symbol (auch in der Raumkarte)

## 1.37.0 – Aufklappen & Systemaktionen
- Weather Card: Werte, Stundenverlauf und Tagesvorschau lassen sich **auf- und zuklappen** („Details & Vorhersage“, zugeklappt mit Mini-Vorschau der nächsten Tage); der Zustand wird pro Wetter-Entität gemerkt, `collapsed: true` startet zugeklappt
- System Card: neue Aktionsleiste mit **„YAML prüfen“** (Ergebnis direkt in der Karte, Fehlertext bei ungültiger Konfiguration), **„Schnell neu laden“** (`homeassistant.reload_all`) und **„Neu starten“** (mit Rückfrage); abschaltbar mit `show_actions: false` / `show_restart: false`

## 1.36.0 – System & Wetter
- Neue **Modern System Card** (`custom:ha-system-card`): CPU/RAM/Speicher-Ringe, Dienste, alle verfügbaren Updates (sortiert, Versionssprung, Installieren mit Rückfrage, Core/Apps mit Backup, Fortschritt), Backup-Zustand (letztes/nächstes, überfällig, fehlgeschlagen), Neustart mit Rückfrage
- Neue **Modern Weather Card** (`custom:ha-weather-card`): animierter Himmel nach Sonnenstand und Wetter, Hinweis „Regen ab …“/Frost/Gewitter/trocken, Wind mit Richtungspfeil, UV, Luftdruck, Taupunkt, Stundenkurve mit Regenbalken, 7-Tage-Vorschau mit Temperaturbalken

## 1.35.0 – Hausakku
- Neue **Modern Home Battery Card** (`custom:ha-home-battery-card`), z.B. für die Anker Solarbank: Ladestand-Ring mit Wh/Kapazität, Lade-/Entladeleistung und Restzeit bis leer/voll, übersetzter Betriebszustand und Modus, animierter Energiefluss Solar → Akku → Haus, PV-Module mit Namen, Solar heute, Ersparnis heute/gesamt, CO₂, Verlauf von Ladestand und Solar, Warnungen (Fehlercode, Cloud offline, fast leer), Aktualisieren-Taste
- Entitäten werden über Gerät und übergeordnetes System (`via_device_id`) erkannt, visueller Editor
- Demo-Build: dynamische Symbolnamen brechen den Build nicht mehr ab

## 1.34.0 – KI-Timeline
- Neue **Modern LLM Vision Timeline** (`custom:ha-llm-timeline-card`): neuestes Ereignis groß mit Snapshot, Kategorie, Zeit und Kamera; Filter nach Personen, Fahrzeugen, Tieren, Paketen und Kameras; Zeitleiste nach Tagen mit Vorschaubildern; Detailansicht mit großem Bild, Beschreibung und „Kamera öffnen“
- Daten über `llmvision.get_events` (Bilder über `media_source`, signiert), Rückfall auf den Kalender; Kategorie aus Label oder Text (deutsch/englisch); „Keine Aktivität“ standardmäßig ausgeblendet; visueller Editor

## 1.33.0 – „Mähen“ mäht die Auswahl
- Mower Card: Sind Bereiche ausgewählt, wird die große grüne Taste zu **„Bereich“/„Bereiche“** und startet nur diese (mit Rückfrage „Sicher?“) – nicht mehr versehentlich den ganzen Rasen. Ohne Auswahl bleibt sie „Mähen“
- Meldet die Integration, dass mehrere Bereiche gleichzeitig nicht freigegeben sind (`multi_area_allowed: false`, z.B. `goat_mower` ohne Option „Experimentell“), ist der Start gesperrt und ein deutlicher Hinweis erklärt warum
- Lehnt die Integration das Bereichsmähen ab, steht der Grund rot in der Karte statt nur kurz als Meldung unten

## 1.32.0 – Starlink & Speedtest
- Neue **Modern Starlink Card** (`custom:ha-starlink-card`): Zustand der Schüssel (Verbunden mit Laufzeit, Getrennt, Verstaut, Ruhezustand, Sicht behindert), Leistung, Heizung, Live-Durchsatz, Ping und Paketverlust, Warnungen nur wenn aktiv, Datenmenge und Energie, Verstauen/Ruhezeiten/Neustart (mit Rückfrage)
- Externer **Speedtest** (`speedtestdotnet`) in derselben Karte: Download, Upload, Ping, Server und Alter der Messung, Verlauf der letzten 7 Tage und „Jetzt testen“ mit Fortschrittsanzeige
- Entitäten werden über die Geräte erkannt (deutsche und englische Namen), visueller Editor

## 1.31.1 – Einstellungen folgen der Auswahl
- Mower Card: Antippen eines Bereichs wählt ihn aus **und** zeigt seine Einstellungen; sie folgen immer dem zuletzt angetippten Bereich (abwählen springt zum vorherigen, × schließt alles). Gedrückt halten öffnet die Einstellungen weiterhin ohne Auswahl

## 1.31.0 – Bereiche einstellen, Vollbild
- Mower Card: **Bereich gedrückt halten** (auf der Karte oder in der Liste) öffnet seine Einstellungen – Mähhöhe und Geschwindigkeit mit −/+, Vermeidungsmodus als Auswahl (Entitäten mit Attribut `area_id`, z.B. `goat_mower`)
- **Vollbild-Karte** (Taste oben rechts): groß, mit Zoom per Zwei-Finger-Geste, Mausrad oder Lupe, verschieben per Ziehen; Bereiche lassen sich auch dort auswählen und einstellen
- Während des Mähens steht der Fortschritt am laufenden Bereich („Volleyball · 35 %“); bei mehreren ausgewählten Bereichen zeigen Nummern die Reihenfolge
- Der Mäher gleitet zwischen den Positionen und dreht sich weich, statt zu springen

## 1.30.1 – Läuft gerade am Fernseher
- Media Card: „Läuft gerade“ erscheint jetzt auch bei Fernsehern, die beim Schauen nur „an“ melden (z.B. Sony Bravia) – mit Titel, Sender, App oder Quelle und TV-Symbol; Abspieltasten nur, wenn der Player wirklich „spielt“/„pausiert“. Soundbars, die nur „an“ melden, zeigen weiterhin keinen Eintrag
- Pool Card: Countdown beim Rück-/Nachspülen startet nicht mehr mit veralteter Uhrzeit (zeigte kurz zu viel Restzeit)

## 1.30.0 – Neue Live-Karte
- Mower Card: Live-Karte neu gestaltet – dunkler Hintergrund mit feinem Raster, Rasenflächen mit Mähstreifen-Textur und Schatten, Bereiche farbig mit **Namen auf der Karte** (kleine Bereiche erst, wenn genug Platz ist oder sie ausgewählt sind), Station als Haus-Symbol
- Hindernisse (`obstacles`), Verbindungswege (`channels`) und die bereits gemähten Streifen (`trace.segments`) werden gezeichnet
- Laufender Auftrag mit wandernder Strichlinie; „Auswahl löschen“ als kleine ×-Taste

## 1.29.1 – Karte in Millimetern
- Mower Card: Live-Karten mit Koordinaten in Millimetern (ECOVACS GOAT A1600) zeigten einen riesigen weißen Rand über der Karte – die Linienbreite des Rasen-Umrisses war in Prozent angegeben und wurde dadurch ~160 px breit
- Die Kartenszene passt ihre Höhe an die Form des Gartens an (schmale, lange Gärten bis 340 px hoch statt winzig in 150 px)

## 1.29.0 – Bereiche antippen
- Mower Card: **Bereichsmähen** – Bereiche der Live-Karte (`areas` mit Umriss, z.B. ECOVACS GOAT A1600 über `goat_mower`) lassen sich auf der Karte oder in der Liste darunter antippen; Auswahl mit Name und m², Summe, „Auswahl löschen“ und „Ausgewählte Bereiche mähen“ (Rückfrage „Sicher? Mäher fährt los“, nur in der Station oder pausiert) über den Dienst `mow_areas` der Integration
- Der laufende Auftrag wird auf der Karte gestrichelt markiert (`job_area_ids`); mehrere Rasenflächen (`info.outlines`) werden gezeichnet
- „Auftrag beenden“ (`end_job`) wird als Stopp-Taste erkannt
- abschaltbar per `show.areas: false` bzw. im Editor

## 1.28.0 – Echte Fahrspur
- Mower Card: Live-Karte nutzt jetzt die erste Quelle mit echten Punkten – beim Ecovacs GOAT `position_history` (bisher wurde nur das dort leere `trace.path` gelesen, deshalb lief die Platzhalter-Animation)
- Die Fahrspur wird während des Laufs in der Karte gesammelt (die Integration liefert nur die letzten Punkte) und beim Andocken zurückgesetzt
- Position als Pfeil in Fahrtrichtung, Marker in Bildschirmgröße mit genug Rand
- Ohne Kartendaten fährt der Mäher nicht mehr eine erfundene Bahn, sondern steht mit pulsierendem Ring in der Mitte

## 1.27.0 – Live-Position
- Mower Card: fordert beim Mähen und Heimfahren den **Live-Positions-Stream** der Integration an (z.B. Ecovacs GOAT `request_live_position_stream`), solange die Karte sichtbar ist – die Live-Karte läuft dadurch flüssig mit; erneuert sich automatisch, stoppt beim Wegscrollen oder in der Station; „LIVE“-Abzeichen; abschaltbar per `live_stream: false` bzw. im Editor

## 1.26.0 – Mähroboter
- Neue **Modern Mower Card** für Mähroboter (`lawn_mower`, z.B. Ecovacs GOAT): animierter Rasen (fährt Bahnen beim Mähen, fährt zur Station, lädt in der Station) oder Live-Karte mit Umriss, Spur und Position, Zustand und Akku-Ring, WLAN, Fehlerbanner, Mähen/Weiter, Pause, Station und Stopp (mit Rückfrage), aktueller Lauf (Fortschritt, Fläche, Dauer), Statistik (Fläche gesamt, Stunden, Mähvorgänge), Wartung (Messer/Bürste mit Tausch-Hinweis, Firmware-Update) und Einstellungen (Mähmodus, Hindernisvermeidung, Regensensor, KI-Erkennung, Tierschutz mit Zeitfenster, Randmähen, sicherer Modus, Regenpause) – alles automatisch über das Gerät erkannt; visueller Editor

## 1.25.0 – Battery Notes am Gerät
- Status-Karte: Battery Notes wird jetzt auch erkannt, wenn Typ, letzter Wechsel und „Batterie ersetzt“ als **eigene Entitäten am Gerät** angelegt sind (Zuordnung über das Gerät, nicht über den Namen) – Batterietyp, „gewechselt vor …“ und Einkaufsliste erscheinen automatisch
- Status-Karte: **gedrückt halten** auf eine Batterie und dann tippen trägt den Batteriewechsel ein (Battery-Notes-Button, mit Bestätigung); ein normaler Tipp öffnet weiter die Details

## 1.24.0 – Musik für Govee
- Licht-Karte: neuer, optionaler Bereich **Musik** für Lampen mit Musik-Effekten (z.B. Govee „Music: …“): Chips je Modus mit deutschem Namen und Symbol, „Aus“, Equalizer-Anzeige und Musik-Pill, solange ein Modus läuft; die Modi erscheinen nicht mehr doppelt in der Effektliste; abschaltbar per `show.music` bzw. im Editor

## 1.23.0 – Auswahl
- Neue **Modern Select Card** für Dropdowns (input_select/select): Leiste mit gleitender Markierung, wischbare Chips, Kacheln, Liste oder kompaktes Dropdown; Symbole/Farben automatisch aus den Optionsnamen (je Option änderbar, ausblendbar, umbenennbar), Rückfrage für ausgewählte Optionen, mehrere Auswahlen in einer Karte; visueller Editor

## 1.22.0 – Kameras
- Neue **Modern Camera Card**: Livebild (wenn die Kamera streamt) oder Standbild mit „Neues Bild“, Akku/WLAN/Temperatur, Schwenk-Steuerkreuz, Linsen-Umschalter, Erkennung (Person, Fahrzeug, Tier, Bewegung), Licht, Sirene (mit Rückfrage), Erkennung an/aus, Tracking, Startposition, Patrouille, Positionen – alles automatisch über das Gerät erkannt (Reolink, Blink …)
- Neue **Modern Camera Group**: Raster mehrerer Kameras mit Bewegung, Akku-Warnung, Scharf/Unscharf, aufklappbarer Kamera, Erkennung je Kamera und Zustand (WLAN, Temperatur, Akku)

## 1.21.0 – Pool
- Neue **Modern Pool Card**: animiertes Becken (Wellen, Lichtreflexe, Strömung/Bläschen bei laufender Pumpe, Wasserfarbe nach Qualität) mit Temperatur und Pumpenknopf, Temperatur/pH/Redox mit Bereichsbalken und 48-h-Verlauf, Handlungshinweis, Filterlaufzeit-Ring mit Solar/Ersparnis/Energie/Kosten, Betriebsmodus, Ziel-Laufzeit direkt in der Karte, Pflege-Empfehlung (pH-Dosierung, Chlor, Laufzeit) und Wartung (Rückspülen/Nachspülen mit Countdown, „Rückgespült“ mit Rückfrage, Auto-Aus); visueller Editor

## 1.20.0 – Smart-Bereich
- Irrigation Card: im Smart-Modus erscheint ein Smart-Bereich (`smart:`) – Ausfall-Hinweis mit Grund, Jahreszeit, DWD-Warnstufe, ET₀, letzte Berechnung + Messpunkte, Plan für den nächsten Lauf, Wasserkonto je Zone (Balken; antippen: Fläche, mm/h, Pflanzenfaktor, 7-Tage-Verlauf), „Neu berechnen“, „Jetzt gießen“ und „Konten auf 0“ (mit Rückfrage), gemessener Durchfluss und Hinweistext

## 1.19.0 – Smart-Modus
- Irrigation Card: im Modus „Smart“ (`smart_mode`) ist die Laufzeit gesperrt; Chip und Einstellung zeigen den berechneten Vorschlag (`smart_duration`, z.B. Smart Irrigation) – aufgerundet, bei `smart_max` gekappt, unter `smart_min` „wird übersprungen“. Start nutzt den Vorschlag (bei Skripten als `dauer_min`)

## 1.18.0 – Laufzeit in der Karte
- Irrigation Card: Tippen auf die Laufzeit öffnet eine Einstellung direkt in der Karte – große Anzeige mit −/+ (unter 10 min minutenweise, darüber in 5er-Schritten), Schnellwahl (`durations`, Standard 5–60 min) und „Starten · X min“; Werte werden sofort im Helfer gespeichert

## 1.17.0 – Bewässerung: Verteiler
- Irrigation Card: Ventile hängen jetzt **parallel an einem Verteiler** unter dem Hauswasserwerk (Wasser fließt animiert in jeden offenen Strang)
- Neuer Strang **„Sonstiges“**: die Pumpe zieht Strom, aber kein Ventil ist offen (`show_other`, `other_threshold`)
- **Tippen aufs Ventil** öffnet/schließt nur das Ventil (ohne Timer/Skripte), lange drücken = Details
- Bei ausgeschalteter Pumpe lassen sich Ventile nicht von Hand öffnen oder starten (Schließen/Stoppen geht immer); `pump_on_start` entfällt

## 1.16.0 – Bewässerung
- Neue **Modern Irrigation Card** für Hauswasserwerk/Pumpe mit Ventilen: Zonen an einer animierten Wasserleitung (Wasser fließt bis zur offenen Zone), Restzeit mit Fortschrittsring, Durchfluss in L/min, Ventil-Akku, Laufzeit per −/+ bzw. Regler, Start/Pause/Stopp (über Timer + Ventil oder eigene Skripte), Modus-Leiste, Startzeit, „Alle nacheinander“, „Alles aus“, letzter Lauf; visueller Editor

## 1.15.0 – Zusammenfassung mit Monat, Jahr, Gesamt
- Energy Card: Die Zusammenfassung unten lässt sich per **Wischen** oder Pfeilen zwischen **Heute → Monat → Jahr → Gesamt** wechseln (Punkte zeigen den Zeitraum). Monat/Jahr/Gesamt kommen aus der Langzeitstatistik von Home Assistant (Tagesmittel der Leistungssensoren, `state_class: measurement`) plus heute – keine Energie-Sensoren nötig; „Gesamt“ zeigt, seit wann Daten vorliegen
- Werte stehen jetzt unter der Bezeichnung und brechen bei zwei Richtungen um – nichts läuft mehr über den Rand; große Werte in MWh

## 1.14.1 – Inaktive Verbraucher ausblenden
- Energy Card: Verbraucher mit 0 W oder „nicht verfügbar“ werden ausgeblendet, bis sie wieder etwas verbrauchen (`hide_inactive_consumers: false` zeigt immer alle, `display_zero: true` je Verbraucher hält einzelne sichtbar – z.B. zum Einschalten per langem Drücken)

## 1.14.0 – Energiefluss ausgebaut
- Energy Card: **beliebig viele Verbraucher-Kreise** – hängen an einer Sammelleitung unter dem Haus, je Verbraucher eine animierte Linie, mehrere Reihen (`consumer_columns`, Standard 4)
- **„Sonstiges“** = Hausverbrauch minus alle Verbraucher (`show_other: false` blendet es aus)
- **Tageswerte** („Heute“: Solar, Haus, Netz ↓/↑, Batterie +/−, je Verbraucher) – aus dem Leistungsverlauf seit Mitternacht berechnet, keine Energie-Sensoren nötig (`show_daily: false`)
- **Akku-Restzeit**: „noch 14 h“ / „voll 59 min“ mit `battery.capacity` (kWh oder Entität, z.B. Akku-Kapazität in Wh), optional `min_soc`
- **Verbraucher schalten**: `switch:` je Verbraucher – lange drücken schaltet den Stecker, kleines Symbol zeigt an/aus
- Lebendiger: Linien werden mit der Leistung dicker, Punkte mit Leuchtschweif, aktive Kreise pulsieren sanft
- **Kompakt** (`layout: compact`): eine Zeile mit Solar, Akku, Netz, Haus

## 1.13.1
- Energy Card: **Einzelverbraucher als Kreise am Haus** (oben/unten, mit eigener Flusslinie) – die ersten zwei aktiven in Konfigurationsreihenfolge (`display_zero: true` zeigt auch 0 W), weitere darunter als Liste („Weitere Verbraucher“, `show_individual_list: false` blendet sie aus)
- Energy Card: **ruhigere Animation** – Tempo nach Leistung in Watt (`max_expected_power`, Standard 2000 W) statt relativ zum größten Fluss; ein Punkt je Linie
- Layout in drei Spalten (Netz · Solar/Batterie · Haus/Verbraucher), Beschriftung über bzw. unter den Kreisen

## 1.13.0 – Energiefluss
- Neu: **Modern Energy Card** (`custom:ha-energy-card`) – animierter Energiefluss zwischen Solar, Batterie, Netz und Haus (Geschwindigkeit nach Leistung), Hausring nach Herkunft, Batterie-Ladestand als Ring, Autarkie, einzelne Verbraucher mit Balken; Konfiguration kompatibel zu power-flow-card-plus, visueller Editor

## 1.12.0 – Batterie-Einkaufsliste
- Status Card: **Einkaufsliste** (`shopping_list: true`) – schwache Batterien nach Typ gruppiert und summiert („2× AA – Heizkörperthermostat“), aus Battery Notes
- Status Card: „**gewechselt vor 12 Tagen**“ bzw. „gewechselt 08/2025“ je Batterie (Battery Notes, `show_replaced: false` blendet es aus)

## 1.11.2
- Schalter + Uhrzeit: auch **`time.*`-Entitäten** (z.B. Roborock „Bitte nicht stören Beginn“) – lesen und per `time.set_value` setzen
- Saugroboter: `maintenance_sensors` – weitere Verbrauchsteile, z.B. die der Station (Dock-Bürste, Schmutzfänger), erscheinen in der Wartung

## 1.11.1
- Licht-Gruppe: **Szenen** (`scenes: [scene.…]`) als Chips unter dem Gruppenregler – Raumname wird weggelassen („Gästezimmer Hell“ → „Hell“), auch im visuellen Editor

## 1.11.0 – Hinweise
- Neu: **Modern Alert Card** (`custom:ha-alert-card`) – erscheint nur, wenn etwas los ist: „Fenster offen – Marcel“ (Kontakte, Tür/Fenster erkannt), beliebige Hinweise per `state`/`state_not`/`above`/`below` mit Farbe nach `severity`, Tippen öffnet Details oder Seite; ohne Hinweis ausgeblendet (optional „Alles in Ordnung“), visueller Editor

## 1.10.1
- Raumkacheln: Raumsymbol und Name **mittig**, Info-Symbole in festen **Ecken** – oben links Licht, oben rechts Fenster/Tür, unten links Klima/Heizung bzw. Feuchte, unten rechts TV bzw. Müll (belegt → nächste freie Ecke)

## 1.10.0 – Raumkacheln & Müllabfuhr
- Raumkarte: **Raumkacheln** (`layout: tile`) für Übersichtsseiten – Tippen öffnet die Raumseite (`navigation_path`), lange drücken schaltet das Licht, Symbol leuchtet in der Lichtfarbe, kleine Symbole für Licht an / Fenster offen / Klima / TV / Feuchte / Müll, Temperatur darunter
- Raumkarte: **Müllabfuhr** (`trash: calendar.…`) – Chips wie „Restmüll · morgen“ mit Symbol und Farbe je Müllart (Rest, Papier, Bio, Gelber Sack, Glas …), heutige Abholung bis 10:00 (`trash_today_until`), Tage im Voraus (`trash_days`)
- Raumkarte: `navigation_path` macht auch den Titel der Kopfzeile antippbar, `color` für das Raumsymbol

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
