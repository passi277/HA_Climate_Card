# Changelog

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
