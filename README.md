# Wellness Content Studio – Marketing-Webseite

Eine ruhige, ästhetische One-Page-Webseite für Social-Media-Content & Videos für
**Wellness-Bars, Massagestudios und Spas**.

Reines Frontend (HTML, CSS, JavaScript) – **kein Server, keine Datenbank, keine Kosten**.
Die Seite wird automatisch über **GitHub Pages** veröffentlicht.

## Aufbau der Webseite

| Bereich        | Inhalt                                                          |
| -------------- | --------------------------------------------------------------- |
| **Hero**       | Große Überschrift mit Wort-Animation, schwebende Video-Karten   |
| **Laufband**   | Endlos laufende Stichworte (Reels, Imagefilme, Massage …)       |
| **Leistungen** | Reels & Kurzvideos · Imagefilm · Social-Media-Content            |
| **Arbeiten**   | Video-Portfolio mit Filter, Hover-Vorschau und Vollbild-Player  |
| **Ablauf**     | Vier Schritte vom Kennenlernen bis zur Veröffentlichung          |
| **Über mich**  | Kurzer Text und Eckdaten                                         |
| **Kontakt**    | Formular (öffnet eine fertige E-Mail) und E-Mail-Adresse        |

Alle Animationen sind dezent und respektieren die Systemeinstellung „Bewegung reduzieren“.
Die Seite ist komplett responsiv (Handy, Tablet, Desktop).

## Neues Video hinzufügen (direkt auf github.com)

1. **Video hochladen:** Im Repository den Ordner `videos/` öffnen →
   **Add file → Upload files** → Video hineinziehen → **Commit changes**.
2. **Eintragen:** Die Datei `works.json` öffnen → Stift-Symbol (Bearbeiten) → Eintrag ergänzen:

   ```json
   [
     {
       "title": "Abendritual",
       "client": "Lotus Day Spa",
       "category": "Reels",
       "description": "Warmes Licht, Öl und langsame Hände.",
       "format": "portrait",
       "featured": true,
       "video": "videos/abendritual.mp4",
       "poster": "",
       "link": "https://instagram.com/reel/…"
     }
   ]
   ```

   → **Commit changes**. Nach ca. 1 Minute ist das Video online.

| Feld          | Bedeutung                                                                 |
| ------------- | ------------------------------------------------------------------------- |
| `title`       | Titel (Pflicht)                                                           |
| `video`       | Pfad zur Datei, z. B. `videos/name.mp4` (Pflicht)                         |
| `client`      | Kunde / Studio                                                            |
| `category`    | Frei wählbar, z. B. `Reels`, `Imagefilm`, `Social Media` – daraus entstehen die Filter |
| `format`      | `portrait` (9:16), `landscape` (16:9) oder `square` (1:1)                  |
| `featured`    | `true` = erscheint in den schwebenden Karten ganz oben                    |
| `poster`      | Optionales Vorschaubild, z. B. `videos/name.jpg` – sonst wird das erste Bild genutzt |
| `link`        | Optionaler Link zum Original (Instagram, TikTok …)                        |
| `description` | Kurzer Text, erscheint beim Öffnen des Videos                             |

Die Reihenfolge in `works.json` ist die Reihenfolge auf der Webseite.
Mehrere Einträge werden mit Komma getrennt: `[ {…}, {…} ]`.

> **Tipps zu Videos**
> - Als **MP4 (H.264)** exportieren, z. B. 1080×1920 für Reels. iPhone-Videos im HEVC-Format
>   spielen nicht in allen Browsern – in CapCut/Premiere als H.264 exportieren.
> - GitHub erlaubt **max. 100 MB pro Datei** (Web-Upload: 25 MB). Für die Webseite reichen
>   kurze Clips mit ca. 5–15 MB völlig – das lädt auch schneller.
> - Dateinamen ohne Leerzeichen und Umlaute, z. B. `hot-stone-massage.mp4`.

## Texte anpassen

Alles steht in `index.html` – einfach auf GitHub öffnen und bearbeiten:

- **Name** („Studio Lumen“) und **E-Mail** („hallo@example.com“) kommen mehrfach vor –
  alle Stellen ersetzen (auch `data-email` am Kontaktformular).
- Instagram-/TikTok-Links im Kontaktbereich.
- Leistungen, Ablauf, Über mich: die jeweiligen Texte direkt ändern.
- Farben & Schriften: oben in `css/style.css` (`:root`-Variablen).

## Kontaktformular

Standardmäßig öffnet das Formular beim Besucher eine fertig ausgefüllte E-Mail an dich.
Wenn Anfragen direkt ankommen sollen: kostenlos bei [formspree.io](https://formspree.io)
ein Formular anlegen und die URL in `index.html` bei `data-endpoint="…"` eintragen.

## Veröffentlichung (einmalig einrichten)

1. Auf GitHub: **Settings → Pages → Build and deployment → Source: „GitHub Actions“**.
2. Fertig – bei jeder Änderung auf `main` wird die Seite automatisch neu veröffentlicht
   (Tab **Actions** zeigt den Fortschritt).
3. Adresse: `https://<dein-github-name>.github.io/Marketing/`
   Eine eigene Domain kannst du unter **Settings → Pages → Custom domain** verbinden.

## Lokal ansehen

```bash
python3 -m http.server 8000
# dann http://localhost:8000 öffnen
```

(Direktes Doppelklicken auf `index.html` funktioniert nicht, weil `works.json` geladen wird.)

## Projektstruktur

```
index.html      Die Webseite (alle Texte)
works.json      Liste deiner Arbeiten
videos/         Deine Videos & Vorschaubilder
css/style.css   Design & Animationen
js/main.js      Portfolio, Lightbox, Formular, Scroll-Effekte
assets/         Favicon
```
