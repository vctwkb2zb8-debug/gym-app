// ===== Service Worker: der „Hausmeister“ im Hintergrund =====
// Er legt eine Kopie aller App-Dateien im Lager (Cache) des Geräts ab.
// Bei jeder Anfrage versucht er zuerst das Netz (damit du immer die neueste
// Version bekommst) und nimmt die Kopie aus dem Lager, wenn kein Netz da ist.
//
// Deine Einträge liegen NICHT hier, sondern im localStorage – der Service Worker
// kümmert sich nur um die Programm-Dateien.

// Name des Lagers. Bei neuen Dateien die Nummer erhöhen, dann räumt er das alte weg.
// Eigener Name „gym-app-…“, damit er nicht mit den Lagern anderer Apps verwechselt wird.
const LAGER = "gym-app-v1";

// Diese Dateien braucht die App, um offline zu laufen
const DATEIEN = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png"
];

// 1. Installieren: alle Dateien ins Lager legen
self.addEventListener("install", function (ereignis) {
  ereignis.waitUntil(
    caches.open(LAGER).then(function (lager) {
      return lager.addAll(DATEIEN);
    })
  );
  self.skipWaiting(); // neue Version sofort benutzen
});

// 2. Aktivieren: alte Lager von früheren Versionen wegräumen
// Nur eigene alte Lager („gym-app-…“) – die Lager anderer Apps bleiben in Ruhe.
self.addEventListener("activate", function (ereignis) {
  ereignis.waitUntil(
    caches.keys().then(function (namen) {
      return Promise.all(
        namen
          .filter(function (name) { return name.startsWith("gym-app-") && name !== LAGER; })
          .map(function (name) { return caches.delete(name); })
      );
    })
  );
  self.clients.claim(); // ab sofort für alle offenen Fenster zuständig
});

// 3. Jede Anfrage: erst Netz, sonst Lager
self.addEventListener("fetch", function (ereignis) {
  if (ereignis.request.method !== "GET") {
    return; // nur normale Abrufe behandeln
  }

  ereignis.respondWith(
    fetch(ereignis.request, { cache: "no-cache" })
      .then(function (antwort) {
        // Frische Kopie fürs nächste Mal ins Lager legen
        const kopie = antwort.clone();
        caches.open(LAGER).then(function (lager) {
          lager.put(ereignis.request, kopie);
        });
        return antwort;
      })
      .catch(function () {
        // Kein Netz → aus dem Lager holen
        return caches.match(ereignis.request, { ignoreSearch: true });
      })
  );
});
