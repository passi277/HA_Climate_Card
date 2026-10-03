# Changelog

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
