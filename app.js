// ===== Speicher =====

// localStorage merkt sich Text im Browser – auch nach dem Schließen.
// JSON verwandelt Listen/Objekte in Text (und zurück).

// Etikett vor jedem Namen: Alle Apps unter vctwkb2zb8-debug.github.io teilen sich
// denselben Speicher. Mit „gym-app-“ hat diese App eigene „Schubladen“.
const VORSILBE = "gym-app-";

// Holt etwas aus dem Speicher. Gibt "standard" zurück, wenn noch nichts da ist.
function laden(schluessel, standard) {
  const text = localStorage.getItem(VORSILBE + schluessel);
  if (text === null) {
    return standard;
  }
  return JSON.parse(text);
}

// Legt etwas unter einem Namen (schluessel) im Speicher ab.
function speichern(schluessel, wert) {
  localStorage.setItem(VORSILBE + schluessel, JSON.stringify(wert));
}


// ===== Datum =====

// Macht aus einem Datum den Text "JJJJ-MM-TT", z. B. "2026-10-16"
function datumAlsText(datum) {
  const jahr = datum.getFullYear();
  const monat = String(datum.getMonth() + 1).padStart(2, "0"); // Januar ist 0, darum +1
  const tag = String(datum.getDate()).padStart(2, "0");        // 7 wird zu "07"
  return jahr + "-" + monat + "-" + tag;
}

// Gibt das heutige Datum als Text zurück
function heute() {
  return datumAlsText(new Date());
}

// Rechnet Tage dazu oder ab: verschiebeTag("2026-10-16", -1) → "2026-10-15"
function verschiebeTag(datum, tage) {
  const tag = new Date(datum + "T00:00");
  tag.setDate(tag.getDate() + tage);
  return datumAlsText(tag);
}

// Zahl schön auf Deutsch: 7.5 → "7,5"
function deutscheZahl(zahl) {
  return String(zahl).replace(".", ",");
}

// Wochentag als Zahl: Montag = 0 … Sonntag = 6
function wochentag(datum) {
  return (new Date(datum + "T00:00").getDay() + 6) % 7; // getDay() zählt ab Sonntag = 0
}

// Der Montag der Woche, in der das Datum liegt
function montagVon(datum) {
  return verschiebeTag(datum, -wochentag(datum));
}

// Feine Linien-Symbole statt Emojis. Jedes ist ein kleiner SVG-Pfad (Zeichenanweisung)
// auf einem 24 × 24 großen Raster: M = Stift hinsetzen, l/L = Linie ziehen, z = schließen.
const SYMBOLE = {
  haken: "M5 12.5l4.5 4.5L19 7.5",
  kreuz: "M6 6l12 12M18 6L6 18",
  stift: "M4 20h4L19 9l-4-4L4 16z",
  hoch: "M6 15l6-6 6 6",
  runter: "M6 9l6 6 6-6"
};

// Baut ein Symbol als Element, z. B. symbol("haken")
function symbol(name) {
  const ns = "http://www.w3.org/2000/svg"; // SVG-Elemente brauchen diesen „Namensraum“
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("class", "symbol");
  svg.setAttribute("aria-hidden", "true");
  const pfad = document.createElementNS(ns, "path");
  pfad.setAttribute("d", SYMBOLE[name]);
  svg.append(pfad);
  return svg;
}


// ===== Gewählter Tag (Datumsleiste) =====
// Das Gym zeigt den „gewählten Tag“ – normalerweise heute.
// Mit ‹ und › kann man zurückblättern, um verpasste Trainings nachzutragen.
let gewaehlterTag = heute();

// Kurzer Name für die Leiste: "Heute", "Gestern" oder z. B. "Mi., 14. Okt."
function tagesName(datum) {
  if (datum === heute()) return "Heute";
  if (datum === verschiebeTag(heute(), -1)) return "Gestern";
  return new Date(datum + "T00:00").toLocaleDateString("de-DE", {
    weekday: "short", day: "numeric", month: "short"
  });
}

// Setzt den gewählten Tag und baut das Gym dafür neu auf
function waehleTag(datum) {
  if (datum > heute()) return; // nicht in die Zukunft
  if (datum !== gewaehlterTag) {
    gymAnsicht = null;          // neue Tagesauswahl: wieder die Einheit laut Reihenfolge
    gymEditId = null;
  }
  gewaehlterTag = datum;

  for (const anzeige of document.querySelectorAll(".tag-anzeige")) {
    anzeige.textContent = tagesName(datum);
  }
  for (const knopf of document.querySelectorAll(".tag-vor")) {
    knopf.disabled = datum === heute();
  }
  for (const hinweis of document.querySelectorAll(".frueherer-tag")) {
    hinweis.classList.toggle("versteckt", datum === heute());
  }

  zeigeGym();
}

// Knöpfe in allen Leisten verbinden
for (const knopf of document.querySelectorAll(".tag-zurueck")) {
  knopf.addEventListener("click", function () { waehleTag(verschiebeTag(gewaehlterTag, -1)); });
}
for (const knopf of document.querySelectorAll(".tag-vor")) {
  knopf.addEventListener("click", function () { waehleTag(verschiebeTag(gewaehlterTag, 1)); });
}
for (const knopf of document.querySelectorAll(".zu-heute")) {
  knopf.addEventListener("click", function () { waehleTag(heute()); });
}


// ===== Gym =====
// Der Trainingsplan ist am Anfang leer. Übungen legt man selbst an (Plan bearbeiten).
// In den Einstellungen wählt man den Split: 1 = Ganzkörper (nur A), 2 = A/B, 3 = A/B/C.
// Die Einheiten kommen der Reihe nach dran und wiederholen sich: A, B, C, A, B, C …
//
// Der PLAN liegt auf dem Handy unter "gym-plan":
//   gym-plan = { A: { name, untertitel, uebungen: [{ id, name, einheit, start }] }, B: …, C: … }
// Ein leerer Name heißt „Training A“ usw. Einheiten, die der Split gerade nicht nutzt,
// bleiben gespeichert (falls man später wieder von 2 auf 3 wechselt).
// "einheit" ist die Gewichtsart: "kg", "kg je Hand", "kg Scheiben gesamt", "nur Wdh." oder
// "nur abhaken" (z. B. Dehnen: kein Gewicht, nur ein Haken pro Training).
//
// Das TRAINING liegt unter "gym", ein Eintrag pro Tag:
//   { "2026-10-26": { einheit: "A", saetze: { beinpresse: [{ kg: 69, wdh: 10 }, { kg: 69, wdh: 10 }] },
//                     haken: { dehnen: true } } }
// Ein Satz zählt als gemacht, sobald er gespeichert ist (✓ getippt oder ein Wert geändert).

// Wie viele Sätze pro Übung, steht in den Einstellungen (gymSaetze)
const GYM_WDH_MIN = 6;               // darunter: Gewicht reduzieren
const GYM_WDH_ZIEL = 10;             // alle Sätze so viele: Gewicht erhöhen
const GYM_EINHEITEN = ["A", "B", "C"];   // alle möglichen Einheiten
const GYM_KG_ARTEN = ["kg", "kg je Hand", "kg Scheiben gesamt", "nur Wdh.", "nur abhaken"];

let gymBearbeiten = false;   // Plan-bearbeiten-Modus an?
let gymEditId = null;        // welche Übung gerade im Formular ist ("neu" = neue Übung)
let gymAnsicht = null;       // von Hand gewählte Einheit für den gerade offenen Tag (sonst null)

// Die Einheiten, die der gewählte Split gerade nutzt, z. B. ["A", "B"]
function aktiveEinheiten() {
  return GYM_EINHEITEN.slice(0, gymSplit());
}

// Der Plan: der gespeicherte, fehlende Einheiten kommen leer dazu
function ladeGymPlan() {
  const plan = laden("gym-plan", null) || {};
  for (const e of GYM_EINHEITEN) {
    if (!plan[e]) plan[e] = { name: "", untertitel: "", uebungen: [] };
  }
  return plan;
}

// Anzeigename einer Einheit: der selbst gewählte, sonst „Training A“ (bei 1 nur „Training“)
function gymName(plan, einheit) {
  const name = plan[einheit].name;
  if (name && name !== "Training") return name;
  return gymSplit() > 1 ? "Training " + einheit : "Training";
}

function speichereGymPlan(plan) {
  speichern("gym-plan", plan);
}

function gymNurWdh(uebung) {
  return uebung.einheit === "nur Wdh.";
}

// "2026-10-26" → "26.10."
function punktDatum(datum) {
  return datum.slice(8, 10) + "." + datum.slice(5, 7) + ".";
}

function gymSatzGemacht(satz) {
  return Boolean(satz && satz.wdh > 0);
}

// Wurde an diesem Tag mindestens ein Satz gemacht (oder etwas abgehakt)?
function gymTrainiert(datum) {
  const eintrag = laden("gym", {})[datum];
  if (!eintrag) return false;
  const satzGemacht = Object.values(eintrag.saetze || {}).some(function (saetze) {
    return saetze.some(gymSatzGemacht);
  });
  return satzGemacht || Object.keys(eintrag.haken || {}).length > 0;
}

// Welche Einheit ist laut Reihenfolge dran? Die nach dem letzten Training vor diesem Tag
// (A → B → C → A …). Gab es noch keins, oder war die letzte Einheit nicht mehr im Split, ist es A.
function gymVorschlag(datum) {
  const gym = laden("gym", {});
  const aktiv = aktiveEinheiten();
  const tage = Object.keys(gym).filter(function (d) { return d < datum && gymTrainiert(d); }).sort();
  if (tage.length === 0) return aktiv[0];
  const zuletzt = aktiv.indexOf(gym[tage[tage.length - 1]].einheit);
  return zuletzt === -1 ? aktiv[0] : aktiv[(zuletzt + 1) % aktiv.length];
}

// Die Einheit eines Tages: von Hand gewählt, sonst die gespeicherte, sonst der Vorschlag
function gymEinheit(datum) {
  if (datum === gewaehlterTag && gymAnsicht && aktiveEinheiten().includes(gymAnsicht)) return gymAnsicht;
  const eintrag = laden("gym", {})[datum];
  if (eintrag && aktiveEinheiten().includes(eintrag.einheit)) return eintrag.einheit;
  return gymVorschlag(datum);
}

// „Kraftwert“ eines Satzes: verbindet Gewicht und Wiederholungen zu einer Zahl,
// damit auch mehr Wiederholungen als Fortschritt zählen (Formel nach Epley).
function kraftwert(satz, nurWdh) {
  if (!satz || !(satz.wdh > 0)) return 0;
  if (nurWdh) return satz.wdh;
  if (!(satz.kg > 0)) return 0;
  return satz.kg * (1 + satz.wdh / 30);
}

// Bester Kraftwert einer Übung an einem Trainingstag
function besterWert(saetze, nurWdh) {
  return Math.max(0, ...(saetze || []).map(function (s) { return kraftwert(s, nurWdh); }));
}

// Das letzte Training VOR einem Datum, in dem diese Übung gemacht wurde: { datum, saetze } oder null
function letztesTraining(uebungId, vorDatum) {
  const gym = laden("gym", {});
  const daten = Object.keys(gym).filter(function (d) { return d < vorDatum; }).sort().reverse();
  for (const d of daten) {
    const saetze = (gym[d].saetze || {})[uebungId];
    if (saetze && saetze.some(gymSatzGemacht)) {
      return { datum: d, saetze: saetze };
    }
  }
  return null;
}

// "40,5" oder "40.5" → 40.5; leer → null
function leseZahl(text) {
  const zahl = parseFloat(String(text).replace(",", "."));
  return isNaN(zahl) ? null : zahl;
}

function satzText(satz, nurWdh) {
  if (!gymSatzGemacht(satz)) return "–";
  return nurWdh ? satz.wdh + " Wdh." : deutscheZahl(satz.kg) + " kg × " + satz.wdh;
}

// Merkt sich einen gemachten Satz für den gewählten Tag
function speichereSatz(uebungId, nr, kg, wdh) {
  const gym = laden("gym", {});
  const tag = gym[gewaehlterTag] || { saetze: {} };
  tag.einheit = gymEinheit(gewaehlterTag); // merkt sich, welche Einheit trainiert wurde
  tag.saetze = tag.saetze || {};
  tag.saetze[uebungId] = tag.saetze[uebungId] || [];
  tag.saetze[uebungId][nr] = { kg: kg, wdh: wdh };
  gym[gewaehlterTag] = tag;
  speichern("gym", gym);
}

// Nimmt einen Satz wieder zurück (✓ nochmal getippt)
function loescheSatz(uebungId, nr) {
  const gym = laden("gym", {});
  const tag = gym[gewaehlterTag];
  if (!tag || !tag.saetze || !tag.saetze[uebungId]) return;
  tag.saetze[uebungId][nr] = null;
  if (!tag.saetze[uebungId].some(gymSatzGemacht)) {
    delete tag.saetze[uebungId];
  }
  speichern("gym", gym);
}

// Was steht in einem noch nicht gemachten Satz-Feld? Die Werte vom letzten Training,
// sonst das Startgewicht aus dem Plan (ohne Wiederholungen).
function gymVorschlagWerte(uebung, vorher, nr) {
  if (vorher) {
    const gemachte = vorher.saetze.filter(gymSatzGemacht);
    const satz = gymSatzGemacht(vorher.saetze[nr]) ? vorher.saetze[nr] : gemachte[gemachte.length - 1];
    return { kg: satz.kg, wdh: satz.wdh };
  }
  return { kg: typeof uebung.start === "number" ? uebung.start : null, wdh: null };
}

// Hinweis fürs nächste Mal: "erhoehen", "reduzieren" oder null
function gymHinweisArt(vorher) {
  if (!vorher) return null;
  const saetze = vorher.saetze;
  if (gymSatzGemacht(saetze[0]) && saetze[0].wdh < GYM_WDH_MIN) return "reduzieren";
  const ersteSaetze = saetze.slice(0, gymSaetze());
  const geschafft = ersteSaetze.length >= gymSaetze() && ersteSaetze.every(function (s) {
    return gymSatzGemacht(s) && s.wdh >= GYM_WDH_ZIEL;
  });
  return geschafft ? "erhoehen" : null;
}


// --- Anzeige: Training des gewählten Tages ---

function zeigeGym() {
  const plan = ladeGymPlan();
  const einheit = gymEinheit(gewaehlterTag);
  const tag = laden("gym", {})[gewaehlterTag] || { saetze: {} };

  // Bearbeiten-Knopf („offen“ = Bearbeiten-Modus an, Aussehen im CSS)
  const bearbeitenKnopf = document.getElementById("gym-bearbeiten-knopf");
  bearbeitenKnopf.textContent = gymBearbeiten ? "Fertig" : "Plan bearbeiten";
  bearbeitenKnopf.classList.toggle("offen", gymBearbeiten);

  zeigeGymEinheiten(plan, einheit);

  const liste = document.getElementById("gym-uebungen");
  liste.innerHTML = "";
  const hinweis = document.getElementById("gym-hinweis");
  hinweis.textContent = "";

  if (gymBearbeiten) {
    zeigeGymBearbeiten(plan, einheit);
  } else if (plan[einheit].uebungen.length === 0) {
    hinweis.textContent = "Noch keine Übungen in „" + gymName(plan, einheit) +
      "“. Tippe auf „Plan bearbeiten“, um welche anzulegen.";
  } else {
    // Bei mehreren Einheiten sagen, was laut Reihenfolge dran ist
    if (gymSplit() > 1 && !gymTrainiert(gewaehlterTag)) {
      const vorschlag = gymVorschlag(gewaehlterTag);
      hinweis.textContent = vorschlag === einheit
        ? "Laut Reihenfolge ist das heute dran."
        : "Laut Reihenfolge wäre „" + gymName(plan, vorschlag) + "“ dran.";
    }
    zeigeGymUebungen(plan, einheit, tag);
  }
  zeigeGymFortschritt();
}

// Auswahl der Einheit (nur bei Split 2 oder 3): ein Knopf pro Einheit
function zeigeGymEinheiten(plan, einheit) {
  const leiste = document.getElementById("gym-einheiten");
  leiste.innerHTML = "";
  leiste.classList.toggle("versteckt", gymSplit() === 1);

  for (const e of aktiveEinheiten()) {
    const knopf = document.createElement("button");
    knopf.type = "button";
    knopf.textContent = gymName(plan, e);
    knopf.classList.toggle("aktiv", e === einheit);
    knopf.addEventListener("click", function () {
      gymAnsicht = e;
      gymEditId = null;
      zeigeGym();
    });
    leiste.append(knopf);
  }
}

function zeigeGymUebungen(plan, einheit, tag) {
  const liste = document.getElementById("gym-uebungen");

  for (const uebung of plan[einheit].uebungen) {
    // Übungen ohne Gewicht (z. B. Dehnen): nur ein Haken pro Training
    if (uebung.einheit === "nur abhaken") {
      liste.append(gymHakenKarte(uebung, tag));
      continue;
    }

    const vorher = letztesTraining(uebung.id, gewaehlterTag);

    const karte = document.createElement("div");
    karte.className = "gym-uebung";
    const titel = document.createElement("strong");
    titel.textContent = uebung.name;
    karte.append(titel);

    // Kleine graue Zeile, nur wenn nötig: „je Hand“, „Scheiben gesamt“, „nur Wdh.“
    if (uebung.einheit !== "kg") {
      const metaZeile = document.createElement("span");
      metaZeile.className = "gym-meta";
      metaZeile.textContent = uebung.einheit.replace(/^kg /, "");
      karte.append(metaZeile);
    }

    // Hinweis nach dem letzten Training
    const art = gymNurWdh(uebung) ? null : gymHinweisArt(vorher);
    if (art) {
      const tipp = document.createElement("span");
      tipp.className = "gym-tipp";
      tipp.textContent = art === "erhoehen"
        ? "Letztes Mal " + gymSaetze() + "× " + GYM_WDH_ZIEL + " geschafft → Gewicht erhöhen"
        : "Letztes Mal Satz 1 unter " + GYM_WDH_MIN + " Wdh. → Gewicht reduzieren";
      karte.append(tipp);
    }

    for (let nr = 0; nr < gymSaetze(); nr++) {
      karte.append(gymSatzZeile(uebung, nr, tag, vorher));
    }
    liste.append(karte);
  }
}

// Merkt sich einen Haken (z. B. Dehnen) für den gewählten Tag
function speichereHaken(uebungId, wert) {
  const gym = laden("gym", {});
  const tag = gym[gewaehlterTag] || { saetze: {} };
  tag.einheit = gymEinheit(gewaehlterTag);
  tag.haken = tag.haken || {};
  if (wert) {
    tag.haken[uebungId] = true;
  } else {
    delete tag.haken[uebungId];
  }
  gym[gewaehlterTag] = tag;
  speichern("gym", gym);
}

// Eine Übung zum Abhaken: Name links, ✓ rechts
function gymHakenKarte(uebung, tag) {
  let gemacht = Boolean((tag.haken || {})[uebung.id]);

  const karte = document.createElement("div");
  karte.className = "gym-uebung gym-haken-karte";
  const titel = document.createElement("strong");
  titel.textContent = uebung.name;
  const haken = document.createElement("button");
  haken.type = "button";
  haken.className = "gym-haken";
  haken.append(symbol("haken"));
  haken.title = "Gemacht";

  function aktualisiere() {
    karte.classList.toggle("gemacht", gemacht);
    haken.setAttribute("aria-pressed", gemacht ? "true" : "false");
  }
  haken.addEventListener("click", function () {
    gemacht = !gemacht;
    speichereHaken(uebung.id, gemacht);
    aktualisiere();
  });

  karte.append(titel, haken);
  aktualisiere();
  return karte;
}

// Eine Satz-Zeile: Nummer, kg, Wdh., ✓ und „Zuletzt“.
// Die Felder sind vorausgefüllt; der Satz zählt erst, wenn du ✓ tippst oder einen Wert änderst.
function gymSatzZeile(uebung, nr, tag, vorher) {
  const nurWdh = gymNurWdh(uebung);
  const gespeichert = ((tag.saetze || {})[uebung.id] || [])[nr];
  let gemacht = gymSatzGemacht(gespeichert);
  const werte = gemacht ? gespeichert : gymVorschlagWerte(uebung, vorher, nr);
  const alt = vorher ? vorher.saetze[nr] : null;

  const zeile = document.createElement("div");
  zeile.className = "gym-satz";
  const nummer = document.createElement("span");
  nummer.className = "gym-nummer";
  nummer.textContent = nr + 1;

  const feldBauen = function (platzhalter, modus, wert) {
    const eingabe = document.createElement("input");
    eingabe.type = "text"; // text + inputmode, damit das Komma auf dem iPhone klappt
    eingabe.inputMode = modus;
    eingabe.placeholder = platzhalter;
    eingabe.value = wert == null ? "" : deutscheZahl(wert);
    eingabe.addEventListener("input", beiAenderung);
    // Beim Antippen alles markieren, dann überschreibt die erste Ziffer den alten Wert
    eingabe.addEventListener("focus", function () { setTimeout(function () { eingabe.select(); }, 0); });
    return eingabe;
  };
  const kgFeld = nurWdh ? null : feldBauen("kg", "decimal", werte.kg);
  const wdhFeld = feldBauen("Wdh.", "numeric", werte.wdh);

  const haken = document.createElement("button");
  haken.type = "button";
  haken.className = "gym-haken";
  haken.append(symbol("haken"));
  haken.title = "Satz gemacht";
  haken.addEventListener("click", beiHaken);

  const letztes = document.createElement("span");
  letztes.className = "gym-letztes";

  zeile.append(nummer);
  if (kgFeld) zeile.append(kgFeld);
  zeile.append(wdhFeld, haken, letztes);

  // Aktuelle Werte aus den Feldern lesen
  function lies() {
    return { kg: kgFeld ? leseZahl(kgFeld.value) : null, wdh: leseZahl(wdhFeld.value) };
  }

  function istVollstaendig(w) {
    return w.wdh > 0 && (nurWdh || w.kg > 0);
  }

  // Aussehen an den Stand anpassen (gemacht = grün, sonst blasser Vorschlag)
  function aktualisiere() {
    zeile.classList.toggle("gemacht", gemacht);
    haken.setAttribute("aria-pressed", gemacht ? "true" : "false");
    for (const feld of [kgFeld, wdhFeld]) {
      if (feld) feld.classList.toggle("vorschlag", !gemacht);
    }
    let text = gymSatzGemacht(alt) ? "Zuletzt: " + satzText(alt, nurWdh) : "";
    const besser = gemacht && gymSatzGemacht(alt) && kraftwert(lies(), nurWdh) > kraftwert(alt, nurWdh);
    if (besser) text += " ↑";
    letztes.textContent = text;
    letztes.classList.toggle("besser", Boolean(besser));
    zeigeGymFortschritt();
  }

  // Wert getippt: vollständig → Satz gilt als gemacht; sonst (war gemacht) wieder zurücknehmen
  function beiAenderung() {
    const w = lies();
    if (istVollstaendig(w)) {
      speichereSatz(uebung.id, nr, w.kg, w.wdh);
      gemacht = true;
    } else if (gemacht) {
      loescheSatz(uebung.id, nr);
      gemacht = false;
    }
    aktualisiere();
  }

  // ✓: Satz bestätigen oder wieder zurücknehmen
  function beiHaken() {
    if (gemacht) {
      loescheSatz(uebung.id, nr);
      gemacht = false;
      aktualisiere();
      return;
    }
    const w = lies();
    if (!(w.wdh > 0)) { wdhFeld.focus(); return; }
    if (!nurWdh && !(w.kg > 0)) { kgFeld.focus(); return; }
    speichereSatz(uebung.id, nr, w.kg, w.wdh);
    gemacht = true;
    aktualisiere();
  }

  aktualisiere();
  return zeile;
}


// --- Plan bearbeiten (✏️ ▲ ▼ ✕ +) ---

function zeigeGymBearbeiten(plan, einheit) {
  const liste = document.getElementById("gym-uebungen");
  const uebungen = plan[einheit].uebungen;

  // Name der Einheit ändern, z. B. „Push“ oder „Beine“ (leer = „Training A“)
  const nameLabel = document.createElement("label");
  nameLabel.className = "gym-name-feld";
  const nameText = document.createElement("span");
  nameText.textContent = "Name dieser Einheit";
  const nameFeld = document.createElement("input");
  nameFeld.value = gymName(plan, einheit);
  nameFeld.addEventListener("change", function () {
    const neuerPlan = ladeGymPlan();
    neuerPlan[einheit].name = nameFeld.value.trim();
    speichereGymPlan(neuerPlan);
    zeigeGym();
  });
  nameLabel.append(nameText, nameFeld);
  liste.append(nameLabel);

  uebungen.forEach(function (uebung, i) {
    if (gymEditId === uebung.id) {
      liste.append(gymEditForm(einheit, uebung));
      return;
    }

    const zeile = document.createElement("div");
    zeile.className = "gym-edit-zeile";

    const knopf = function (symbolName, titel, aktion, gesperrt) {
      const k = document.createElement("button");
      k.type = "button";
      k.append(symbol(symbolName));
      k.title = titel;
      k.disabled = Boolean(gesperrt);
      k.addEventListener("click", aktion);
      return k;
    };
    const name = document.createElement("span");
    name.className = "gym-edit-name";
    name.textContent = uebung.name;

    zeile.append(
      knopf("hoch", "Nach oben", function () { verschiebeGymUebung(einheit, uebung.id, -1); }, i === 0),
      knopf("runter", "Nach unten", function () { verschiebeGymUebung(einheit, uebung.id, 1); }, i === uebungen.length - 1),
      name,
      knopf("stift", "Ändern", function () { gymEditId = uebung.id; zeigeGym(); }),
      knopf("kreuz", "Entfernen", function () { entferneGymUebung(einheit, uebung.id); })
    );
    liste.append(zeile);
  });

  if (gymEditId === "neu") {
    liste.append(gymEditForm(einheit, null));
  } else {
    const neuKnopf = document.createElement("button");
    neuKnopf.type = "button";
    neuKnopf.className = "nebenknopf plus-knopf";
    neuKnopf.textContent = "Übung hinzufügen";
    neuKnopf.addEventListener("click", function () { gymEditId = "neu"; zeigeGym(); });
    liste.append(neuKnopf);
  }
}

function verschiebeGymUebung(einheit, id, richtung) {
  const plan = ladeGymPlan();
  const liste = plan[einheit].uebungen;
  const i = liste.findIndex(function (u) { return u.id === id; });
  const j = i + richtung;
  if (i === -1 || j < 0 || j >= liste.length) return;
  const gemerkt = liste[i];
  liste[i] = liste[j];
  liste[j] = gemerkt;
  speichereGymPlan(plan);
  zeigeGym();
}

function entferneGymUebung(einheit, id) {
  const plan = ladeGymPlan();
  const uebung = plan[einheit].uebungen.find(function (u) { return u.id === id; });
  if (!confirm("„" + uebung.name + "“ aus dem Plan entfernen? Bisherige Einträge bleiben gespeichert.")) return;
  plan[einheit].uebungen = plan[einheit].uebungen.filter(function (u) { return u.id !== id; });
  speichereGymPlan(plan);
  zeigeGym();
}

// Formular für eine Übung. uebung = null → neue Übung anlegen
function gymEditForm(einheit, uebung) {
  const w = uebung || { name: "", einheit: "kg", typ: "iso", start: null, notiz: "" };
  const form = document.createElement("form");
  form.className = "gym-edit-form";

  const mitBeschriftung = function (text, element) {
    const label = document.createElement("label");
    const beschriftung = document.createElement("span");
    beschriftung.textContent = text;
    label.append(beschriftung, element);
    return label;
  };
  const eingabe = function (wert, platzhalter, modus) {
    const feld = document.createElement("input");
    feld.type = "text";
    if (modus) feld.inputMode = modus;
    feld.placeholder = platzhalter;
    feld.value = wert;
    return feld;
  };
  const auswahl = function (optionen, gewaehlt) {
    const feld = document.createElement("select");
    for (const wert in optionen) {
      const option = document.createElement("option");
      option.value = wert;
      option.textContent = optionen[wert];
      feld.append(option);
    }
    feld.value = gewaehlt;
    return feld;
  };
  const arten = {};
  for (const art of GYM_KG_ARTEN) arten[art] = art;

  const nameFeld = eingabe(w.name, "Name der Übung");
  nameFeld.required = true;
  const startFeld = eingabe(w.start == null ? "" : deutscheZahl(w.start), "z. B. 40", "decimal");
  const artFeld = auswahl(arten, w.einheit);

  const knoepfe = document.createElement("div");
  knoepfe.className = "gym-edit-knoepfe";
  const speichernKnopf = document.createElement("button");
  speichernKnopf.type = "submit";
  speichernKnopf.textContent = "Speichern";
  const abbrechenKnopf = document.createElement("button");
  abbrechenKnopf.type = "button";
  abbrechenKnopf.textContent = "Abbrechen";
  abbrechenKnopf.addEventListener("click", function () { gymEditId = null; zeigeGym(); });
  knoepfe.append(speichernKnopf, abbrechenKnopf);

  form.append(
    mitBeschriftung("Name", nameFeld),
    mitBeschriftung("Startgewicht (gilt bis zum ersten Training)", startFeld),
    mitBeschriftung("Gewichtsart", artFeld),
    knoepfe
  );

  form.addEventListener("submit", function (ereignis) {
    ereignis.preventDefault();
    const name = nameFeld.value.trim();
    if (name === "") return;
    const daten = {
      name: name,
      einheit: artFeld.value,
      start: leseZahl(startFeld.value)
    };
    const plan = ladeGymPlan();
    if (uebung) {
      Object.assign(plan[einheit].uebungen.find(function (u) { return u.id === uebung.id; }), daten);
    } else {
      plan[einheit].uebungen.push(Object.assign({ id: "u" + Date.now() }, daten)); // Date.now() = eindeutige Zahl
    }
    speichereGymPlan(plan);
    gymEditId = null;
    zeigeGym();
  });
  return form;
}

document.getElementById("gym-bearbeiten-knopf").addEventListener("click", function () {
  gymBearbeiten = !gymBearbeiten;
  gymEditId = null;
  zeigeGym();
});


// --- Fortschritt: Plan-Ring, Gesamtkurve, Linie pro Übung ---
// Für jede Übung: Kraftwert beim ersten Training = Startwert (0 %).
// Gesamtkurve: pro Trainingstag der Durchschnitt aller dort trainierten Übungen in % seit Start.

function gymFortschrittDaten() {
  const gym = laden("gym", {});
  const plan = ladeGymPlan();
  const verlauf = {};  // uebungId → [{ datum, wert }]
  const punkte = [];   // { datum, einheit, prozent }

  for (const datum of Object.keys(gym).sort()) {
    const tag = gym[datum];
    const prozente = [];
    let tagEinheit = null;
    for (const einheit of GYM_EINHEITEN) {
      for (const uebung of plan[einheit].uebungen) {
        const wert = besterWert((tag.saetze || {})[uebung.id], gymNurWdh(uebung));
        if (wert <= 0) continue;
        verlauf[uebung.id] = verlauf[uebung.id] || [];
        verlauf[uebung.id].push({ datum: datum, wert: wert });
        prozente.push((wert / verlauf[uebung.id][0].wert - 1) * 100);
        tagEinheit = tagEinheit || einheit;
      }
    }
    if (prozente.length > 0) {
      const schnitt = prozente.reduce(function (a, b) { return a + b; }, 0) / prozente.length;
      punkte.push({
        datum: datum,
        einheit: GYM_EINHEITEN.includes(tag.einheit) ? tag.einheit : tagEinheit,
        prozent: schnitt
      });
    }
  }
  return { verlauf: verlauf, punkte: punkte };
}

// Prozent schön: 12.34 → "+12 %", -3 → "−3 %"
function prozentText(p) {
  const r = Math.round(p);
  return (r > 0 ? "+" : r < 0 ? "−" : "±") + Math.abs(r) + " %";
}

const SVG_NS = "http://www.w3.org/2000/svg";

function svgElement(name, eigenschaften) {
  const element = document.createElementNS(SVG_NS, name);
  for (const schluessel in eigenschaften) element.setAttribute(schluessel, eigenschaften[schluessel]);
  return element;
}

// Der Plan-Ring: z. B. 5 von 12 Einheiten
function gymRing(anzahl, von) {
  const umfang = 2 * Math.PI * 40;
  const anteil = Math.min(anzahl, von) / von;
  const svg = svgElement("svg", { viewBox: "0 0 100 100", class: "gym-ring" });
  svg.append(
    svgElement("circle", { cx: 50, cy: 50, r: 40, class: "ring-spur" }),
    svgElement("circle", {
      cx: 50, cy: 50, r: 40, class: "ring-fuellung",
      "stroke-dasharray": umfang, "stroke-dashoffset": umfang * (1 - anteil),
      transform: "rotate(-90 50 50)"                   // Start oben statt rechts
    })
  );
  const zahl = svgElement("text", { x: 50, y: 56, class: "ring-zahl", "text-anchor": "middle" });
  zahl.textContent = anzahl + "/" + von;
  svg.append(zahl);
  return svg;
}

// Zeichnet die Gesamtkurve als SVG (selbst gezeichnet, ohne Bibliothek)
function gymKurve(punkte) {
  const breite = 320, hoehe = 140, rand = 28;
  const svg = svgElement("svg", { viewBox: "0 0 " + breite + " " + hoehe, class: "gym-kurve" });

  // y-Bereich: mindestens −5 % bis +5 %, damit eine flache Kurve nicht übertrieben wirkt
  const werte = punkte.map(function (p) { return p.prozent; });
  const oben = Math.max(5, ...werte), unten = Math.min(-5, ...werte);
  const x = function (i) {
    return punkte.length === 1 ? breite / 2 : rand + i * (breite - rand - 10) / (punkte.length - 1);
  };
  const y = function (p) { return 10 + (oben - p) / (oben - unten) * (hoehe - 30); };
  const text = function (inhalt, tx, ty) {
    const t = svgElement("text", { x: tx, y: ty, class: "achse" });
    t.textContent = inhalt;
    svg.append(t);
  };

  // Null-Linie = Startniveau, dazu Beschriftung oben und bei 0
  svg.append(svgElement("line", { x1: rand, y1: y(0), x2: breite - 4, y2: y(0), class: "nulllinie" }));
  text("0 %", 0, y(0) + 4);
  text(prozentText(oben), 0, y(oben) + 4);

  // Verbindungslinie und Punkte (Farbe je Einheit)
  svg.append(svgElement("polyline", {
    points: punkte.map(function (p, i) { return x(i) + "," + y(p.prozent); }).join(" "),
    class: "verlauf"
  }));
  punkte.forEach(function (p, i) {
    svg.append(svgElement("circle", { cx: x(i), cy: y(p.prozent), r: 4.5, class: "punkt " + p.einheit }));
  });

  // Datum unter erstem und letztem Punkt
  text(punktDatum(punkte[0].datum), x(0) - 14, hoehe - 4);
  if (punkte.length > 1) text(punktDatum(punkte[punkte.length - 1].datum), x(punkte.length - 1) - 30, hoehe - 4);
  return svg;
}

// Kleine Verlaufslinie einer Übung (ohne Achsen): werte = Kraftwerte pro Training
function gymLinie(werte) {
  const breite = 120, hoehe = 28;
  const svg = svgElement("svg", { viewBox: "0 0 " + breite + " " + hoehe, class: "gym-linie" });
  const kleinster = Math.min(...werte), groesster = Math.max(...werte);
  const x = function (i) { return werte.length === 1 ? breite / 2 : 6 + i * (breite - 12) / (werte.length - 1); };
  const y = function (w) { return groesster === kleinster ? hoehe / 2 : (hoehe - 5) - (w - kleinster) / (groesster - kleinster) * (hoehe - 10); };

  if (werte.length > 1) {
    svg.append(svgElement("polyline", {
      points: werte.map(function (w, i) { return x(i) + "," + y(w); }).join(" "),
      class: "linie"
    }));
  }
  svg.append(svgElement("circle", { cx: x(werte.length - 1), cy: y(werte[werte.length - 1]), r: 3, class: "linie-punkt" }));
  return svg;
}

function zeigeGymFortschritt() {
  const inhalt = document.getElementById("gym-fortschritt-inhalt");
  inhalt.innerHTML = "";
  const gym = laden("gym", {});
  const plan = ladeGymPlan();
  const daten = gymFortschrittDaten();

  // 1. Ring für die aktuelle Woche (Mo–So): x von <Ziel aus den Einstellungen> Einheiten
  const ziel = gymProWoche();
  const wochenStart = montagVon(heute());
  const wochenEnde = verschiebeTag(wochenStart, 6);
  const absolviert = Object.keys(gym).filter(function (d) {
    return d >= wochenStart && d <= wochenEnde && gymTrainiert(d);
  }).length;

  const ringZeile = document.createElement("div");
  ringZeile.className = "gym-ring-zeile";
  const ringText = document.createElement("div");
  const wocheText = document.createElement("strong");
  wocheText.textContent = "Diese Woche";
  const zeitraum = document.createElement("span");
  zeitraum.textContent = punktDatum(wochenStart) + " – " + punktDatum(wochenEnde);
  const zaehler = document.createElement("span");
  zaehler.textContent = absolviert + " von " + ziel + " Einheiten";
  // Alle Einheiten seit Beginn, ohne Begrenzung
  const gesamt = Object.keys(gym).filter(gymTrainiert).length;
  const gesamtZeile = document.createElement("span");
  gesamtZeile.textContent = "Insgesamt: " + gesamt + (gesamt === 1 ? " Einheit" : " Einheiten");
  ringText.append(wocheText, zeitraum, zaehler, gesamtZeile);
  ringZeile.append(gymRing(absolviert, ziel), ringText);
  inhalt.append(ringZeile);

  if (daten.punkte.length === 0) {
    const leer = document.createElement("p");
    leer.className = "hinweis";
    leer.textContent = "Sobald du Sätze mit dem Haken bestätigt hast, siehst du hier deinen Fortschritt.";
    inhalt.append(leer);
    return;
  }

  // 2. Gesamtkurve
  const kopf = document.createElement("p");
  kopf.append("Gesamt (Ø aller Übungen): ");
  const zahl = document.createElement("strong");
  zahl.textContent = prozentText(daten.punkte[daten.punkte.length - 1].prozent);
  kopf.append(zahl, " seit Start");
  inhalt.append(kopf, gymKurve(daten.punkte));

  // 3. Eine kleine Linie pro Übung
  for (const einheit of GYM_EINHEITEN) {
    const uebungen = plan[einheit].uebungen.filter(function (u) { return daten.verlauf[u.id]; });
    if (uebungen.length === 0) continue;
    const titel = document.createElement("h3");
    titel.textContent = gymName(plan, einheit);
    inhalt.append(titel);

    for (const uebung of uebungen) {
      const werte = daten.verlauf[uebung.id].map(function (v) { return v.wert; });
      const prozent = (werte[werte.length - 1] / werte[0] - 1) * 100;
      const zeile = document.createElement("div");
      zeile.className = "gym-fortschritt-zeile";
      const name = document.createElement("span");
      name.textContent = uebung.name;
      const wert = document.createElement("span");
      wert.className = "wert" + (prozent < 0 ? " minus" : "");
      wert.textContent = werte.length > 1 ? prozentText(prozent) : "neu";
      zeile.append(name, gymLinie(werte), wert);
      inhalt.append(zeile);
    }
  }
}


// ===== Einstellungen =====
// Gespeichert unter "einstellungen", z. B. { gymProWoche: 3, gymSplit: 2, gymSaetze: 3 }
// Was dort nicht steht, hat den Standardwert.

function ladeEinstellungen() {
  const e = laden("einstellungen", {});
  return {
    gymProWoche: e.gymProWoche || 2,
    gymSplit: [1, 2, 3].includes(e.gymSplit) ? e.gymSplit : 1,  // 1 = Ganzkörper, 2 = A/B, 3 = A/B/C
    gymSaetze: e.gymSaetze || 2
  };
}

function gymProWoche() {
  return ladeEinstellungen().gymProWoche;
}

function gymSaetze() {
  return ladeEinstellungen().gymSaetze;
}

function gymSplit() {
  return ladeEinstellungen().gymSplit;
}

function zeigeEinstellungen() {
  const e = ladeEinstellungen();
  document.getElementById("einstellungen-gym-ziel").value = e.gymProWoche;
  document.getElementById("einstellungen-gym-saetze").value = e.gymSaetze;

  // Split: Ganzkörper, 2er- oder 3er-Split
  const splitLeiste = document.getElementById("einstellungen-gym-split");
  splitLeiste.innerHTML = "";
  const splitNamen = { 1: "Ganzkörper", 2: "2er-Split", 3: "3er-Split" };
  for (const anzahl of [1, 2, 3]) {
    const knopf = document.createElement("button");
    knopf.type = "button";
    knopf.textContent = splitNamen[anzahl];
    knopf.classList.toggle("aktiv", anzahl === e.gymSplit);
    knopf.addEventListener("click", function () {
      const einst = ladeEinstellungen();
      einst.gymSplit = anzahl;
      speichern("einstellungen", einst);
      gymAnsicht = null;
      gymEditId = null;
      zeigeEinstellungen();
      zeigeGym();
    });
    splitLeiste.append(knopf);
  }
  document.getElementById("einstellungen-gym-split-hinweis").textContent = e.gymSplit === 1
    ? "Ein Training, das du immer wiederholst."
    : "Die Einheiten kommen der Reihe nach dran (" + GYM_EINHEITEN.slice(0, e.gymSplit).join(", ") +
      ", dann wieder von vorn). Nicht genutzte Einheiten bleiben gespeichert.";
}

document.getElementById("einstellungen-gym-ziel").addEventListener("change", function () {
  const ziel = Math.min(7, Math.max(1, Math.round(Number(this.value) || 2)));
  this.value = ziel;
  const e = ladeEinstellungen();
  e.gymProWoche = ziel;
  speichern("einstellungen", e);
  zeigeGymFortschritt();
});

document.getElementById("einstellungen-gym-saetze").addEventListener("change", function () {
  const saetze = Math.min(6, Math.max(1, Math.round(Number(this.value) || 2)));
  this.value = saetze;
  const e = ladeEinstellungen();
  e.gymSaetze = saetze;
  speichern("einstellungen", e);
  zeigeGym();
});

document.getElementById("einstellungen-knopf").addEventListener("click", function () {
  zeigeBereich("einstellungen");
});
document.getElementById("einstellungen-fertig").addEventListener("click", function () {
  zeigeBereich("gym");
});


// ===== Navigation =====

// Zeigt entweder das Gym oder die Einstellungen
function zeigeBereich(name) {
  for (const bereich of document.querySelectorAll("section")) {
    bereich.classList.toggle("versteckt", bereich.id !== name);
  }
  if (name === "einstellungen") {
    zeigeEinstellungen();
  }
  window.scrollTo(0, 0);
}

// Wenn die App wieder in den Vordergrund kommt (z. B. am nächsten Tag),
// wieder heute zeigen – sonst stünde noch der alte Tag da.
document.addEventListener("visibilitychange", function () {
  if (document.visibilityState === "visible") {
    waehleTag(heute());
  }
});

// Beim Start: Datumsleiste auf heute stellen und das Gym zeigen
waehleTag(heute());
zeigeBereich("gym");


// ===== Offline =====
// Den „Hausmeister“ (service-worker.js) anmelden, falls der Browser das kann
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("service-worker.js");
}
