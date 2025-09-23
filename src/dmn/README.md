# DMN Flowable Support

Diese Dateien implementieren Flowable-spezifische Unterstützung für DMN Decision Tables.

## Funktionen

### Flowable Autocomplete (`flowable-autocomplete.ts`)

Ein intelligentes Autocomplete-System für DMN Decision Table Zellen mit:

- **Automatisches Öffnen**: Bei Eingabe von relevanten Präfixen (`${co`, `==`, `!=`, `date`, etc.)
- **Manuelles Öffnen**: `Ctrl+Leertaste`
- **Navigation**: ↑/↓ Pfeiltasten, Enter/Tab für Auswahl, Esc zum Abbrechen
- **Tab-Stops**: Navigiere durch `[[…]]` Marker mit Tab/Shift+Tab

### Unterstützte Flowable/JUEL Ausdrücke

#### Collection Helpers
```javascript
${collection:anyOf(inVarCollection, '"a","b"')}     // Enthält einen der Werte
${collection:noneOf(inVarCollection, '"a","b"')}    // Enthält keinen der Werte
${collection:allOf(inVarCollection, '"a","b"')}     // Enthält alle Werte
${collection:notAllOf(inVarCollection, '"a","b"')}  // Enthält nicht alle Werte
```

#### Vergleichsoperatoren
```javascript
== "text"       // String-Gleichheit
!= "text"       // String-Ungleichheit
== 2            // Zahlen-Gleichheit
< 10, > 4       // Zahlenvergleiche
>= 5, <= 6      // Größer/Kleiner gleich
```

#### Datums-Funktionen
```javascript
date:toDate('2025-09-15')   // String zu Datum konvertieren
```

#### Boolean & Variablen
```javascript
== true, != false          // Boolean-Checks
${variableName}             // JUEL Variable
empty(variable)             // Leer-Check
!empty(variable)            // Nicht-leer-Check
```

## Verwendung

Das Autocomplete aktiviert sich automatisch beim Tippen relevanter Ausdrücke oder mit `Ctrl+Leertaste`. Nach der Einfügung navigierst du durch die `[[…]]` Platzhalter mit Tab/Shift+Tab.

## Konfiguration

Das Modul wird automatisch in DMN Decision Tables und Literal Expressions geladen. Die Standard-Expressionssprache ist auf `juel` gesetzt für optimale Flowable-Kompatibilität.