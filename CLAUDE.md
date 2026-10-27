# Gym-App – Lernprojekt von Lars

Ableger der Tages-App (Unterapp `familie/` „Mein Tag“, Stand 27.10.2026): nur noch der **Gym-Fortschritt**.
Die Tages-App selbst bleibt unverändert, hier wird eigenständig weitergebaut.

## Was die App kann
- **Gym**: Datumsleiste (‹ Heute ›) zum Nachtragen, Einheiten A/B/C je nach Split (der Reihe nach, manuell umstellbar),
  pro Übung N Sätze (einstellbar) mit kg und Wdh. (vorausgefüllt vom letzten Training, zählt erst nach ✓ oder Änderung),
  Hinweise „Gewicht erhöhen/reduzieren“, Plan bearbeiten (▲ ▼ ändern ✕ +, Gewichtsart kg / je Hand / Scheiben gesamt / nur Wdh. / nur abhaken).
- **Fortschritt**: Wochen-Ring (x von Wochenziel), „Insgesamt: N Einheiten“, Gesamtkurve (Ø aller Übungen in %, Kraftwert nach Epley `kg × (1 + wdh/30)`), kleine Linie pro Übung.
- **Pausen-Timer**: startet nach jedem ✓, Leiste unten, vibriert am Ende (rechnet mit der End-Uhrzeit, stimmt also auch nach Sperren des Handys).
- **Verlauf**: frühere Trainings (ohne heute), neuestes zuerst, aufklappbar, „Diesen Tag öffnen“ springt zum Nachtragen hin.
- **Einstellungen** (Zahnrad): Split (Ganzkörper / 2er / 3er), Trainings pro Woche, Sätze pro Übung (1–6, Standard 2), Pause in Sekunden (0 = aus, Standard 90).

Speicher (localStorage, Vorsilbe `gym-app-`, weil alle Seiten unter `vctwkb2zb8-debug.github.io` denselben Speicher teilen):
`gym-plan`, `gym`, `einstellungen`.

## Lernmodus (wichtigste Regel!)
Lars lernt programmieren. Claude baut die App **mit** ihm, nicht **für** ihn.
- Jeden Schritt kurz und einfach erklären (Deutsch, neue Begriffe einmal erklären).
- Kleine Teile lässt Claude Lars **selbst schreiben** – mit klarer Aufgabe und Hinweis, wo der Code hingehört.
- Danach Lars' Code prüfen: erst loben, dann Fehler erklären und Lars selbst korrigieren lassen.
- Kleine Schritte und Commits. Nach jedem Schritt: im Browser zeigen, testen, committen.
- **Erklär-Stil:** Jede Antwort beginnt mit einem kurzen Kasten „💡 Worum geht's?“ (2–4 Sätze, Alltagsvergleiche). Antworten kurz halten.
- Code einfach und gut lesbar, Kommentare auf Deutsch.

## Technische Regeln
- Reines HTML, CSS, JavaScript – kein Framework, kein Build-Schritt, keine npm-Pakete, keine CDNs.
- Läuft komplett offline (Service Worker, Lager `gym-app-…`), Daten **nur lokal auf dem Gerät**, keine `fetch`-Aufrufe nach außen.
- Der Code ist **öffentlich** auf GitHub (Repo `gym-app`). Darum niemals persönliche Inhalte ins Repo: keine Gewichte, keine Trainingsdaten, keine Testdaten aus echten Daten.
- Lokal testen über `http://localhost:8001` (siehe `.claude/launch.json`) – nie Testdaten auf der Live-Adresse anlegen.
- Commits als `343493141+vctwkb2zb8-debug@users.noreply.github.com`, Commit-Nachrichten auf Deutsch, kurz und klar.
- Datum immer als lokales Datum `JJJJ-MM-TT`.
