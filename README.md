# Wellness Content Studio – Marketing-Webseite

Eine ruhige, ästhetische One-Page-Webseite für Social-Media-Content & Videos für
**Wellness-Bars, Massagestudios und Spas** – mit eigenem **Admin-Panel**, in dem du
neue Arbeiten (Videos) einfach hochladen, sortieren und bearbeiten kannst.

## Aufbau der Webseite

| Bereich            | Inhalt                                                                 |
| ------------------ | ---------------------------------------------------------------------- |
| **Hero**           | Große Überschrift mit Wort-Animation, schwebende Video-Karten          |
| **Laufband**       | Endlos laufende Stichworte (Reels, Imagefilme, Massage …)              |
| **Leistungen**     | Reels & Kurzvideos · Imagefilm · Social-Media-Content                   |
| **Arbeiten**       | Video-Portfolio mit Filter, Hover-Vorschau und Vollbild-Player         |
| **Ablauf**         | Vier Schritte vom Kennenlernen bis zur Veröffentlichung                 |
| **Über mich**      | Kurzer Text und Eckdaten                                                |
| **Kontakt**        | Formular (Anfragen landen im Admin-Panel) und E-Mail-Adresse           |

Alle Animationen sind dezent und respektieren die Systemeinstellung „Bewegung reduzieren“.
Die Seite ist komplett responsiv (Handy, Tablet, Desktop).

## Admin-Panel (`/admin`)

- **Arbeiten:** Video per Drag & Drop hochladen, Titel/Kunde/Kategorie/Format eintragen.
  Ein Vorschaubild wird automatisch aus dem Video erzeugt (oder du lädst ein eigenes hoch).
  Reihenfolge per Ziehen oder ↑/↓ ändern, bearbeiten, löschen.
  „Im Hero-Bereich zeigen“ bringt ein Video in die schwebenden Karten ganz oben.
- **Anfragen:** Alle Nachrichten aus dem Kontaktformular, mit „Antworten“-Button.
- **Einstellungen:** Markenname, Slogan, E-Mail, Standort, Instagram- & TikTok-Link.

> **Tipp zu Videos:** Am besten als **MP4 (H.264)** exportieren, z. B. 1080×1920 für Reels.
> iPhone-Videos im HEVC-Format (.mov) spielen nicht in allen Browsern – in CapCut,
> Premiere oder der Fotos-App einfach als „Kompatibel/H.264“ exportieren.

## Lokal starten

Voraussetzung: [Node.js](https://nodejs.org) ab Version 18.

```bash
npm install
cp .env.example .env      # danach ADMIN_PASSWORD und SESSION_SECRET setzen
npm start
```

- Webseite: http://localhost:3000
- Admin: http://localhost:3000/admin

## Online stellen (Deployment)

Die Seite braucht einen Server mit **dauerhaftem Speicher** für die hochgeladenen Videos
(daher kein reines GitHub Pages). Gut geeignet sind z. B. **Railway**, **Render**,
**Fly.io** oder ein kleiner VPS (Hetzner, netcup …).

1. Repository mit dem Anbieter verbinden (oder das mitgelieferte `Dockerfile` nutzen).
2. Umgebungsvariablen setzen:
   - `ADMIN_PASSWORD` – dein Admin-Passwort
   - `SESSION_SECRET` – langer Zufallswert (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)
   - `NODE_ENV=production`
   - `DATA_DIR=/data`
3. Ein **Volume / Persistent Disk** unter `/data` einhängen – dort liegen Videos und Daten.
4. Eigene Domain verbinden, HTTPS aktivieren – fertig.

Mit Docker auf einem eigenen Server:

```bash
docker build -t wellness-studio .
docker run -d -p 3000:3000 -v studio-data:/data \
  -e ADMIN_PASSWORD=… -e SESSION_SECRET=… wellness-studio
```

## Texte anpassen

- Name, Slogan, E-Mail, Standort und Social-Links: im Admin unter **Einstellungen**.
- Alle übrigen Texte (Leistungen, Ablauf, Über mich): direkt in `public/index.html`.
- Farben & Schriften: oben in `public/css/style.css` (`:root`-Variablen).

## Projektstruktur

```
server.js              Express-Server, API, Uploads, Login
public/index.html      Die Webseite
public/css/style.css   Design & Animationen
public/js/main.js      Portfolio, Lightbox, Formular, Scroll-Effekte
public/admin/          Admin-Panel
data/                  (wird erzeugt) db.json + uploads/ – nicht im Git
```

## Backup

Alles, was du im Admin anlegst, liegt im Ordner `DATA_DIR` (`db.json` + `uploads/`).
Diesen Ordner regelmäßig sichern.
