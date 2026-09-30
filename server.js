'use strict';

const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Konfiguration
// ---------------------------------------------------------------------------
loadDotEnv(path.join(__dirname, '.env'));

const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(__dirname, 'data'));
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const MAX_UPLOAD_MB = Number(process.env.MAX_UPLOAD_MB) || 500;
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 Tage
const IS_PROD = process.env.NODE_ENV === 'production';

if (!ADMIN_PASSWORD) {
  console.warn('\n⚠  ADMIN_PASSWORD ist nicht gesetzt – das Admin-Panel ist gesperrt, bis du es in .env setzt.\n');
}
if (!process.env.SESSION_SECRET) {
  console.warn('⚠  SESSION_SECRET ist nicht gesetzt – Logins gelten nur bis zum nächsten Neustart.');
}

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const CATEGORIES = ['Reels', 'Imagefilm', 'Fotografie', 'Social Media'];

const DEFAULT_SETTINGS = {
  brandName: 'Studio Lumen',
  tagline: 'Content, der sich anfühlt wie ein tiefer Atemzug.',
  email: 'hallo@example.com',
  instagram: '',
  tiktok: '',
  location: 'Deutschland',
};

// ---------------------------------------------------------------------------
// Datenhaltung (JSON-Datei, atomar geschrieben)
// ---------------------------------------------------------------------------
function readDb() {
  try {
    const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    return {
      works: Array.isArray(db.works) ? db.works : [],
      inquiries: Array.isArray(db.inquiries) ? db.inquiries : [],
      settings: { ...DEFAULT_SETTINGS, ...(db.settings || {}) },
    };
  } catch {
    return { works: [], inquiries: [], settings: { ...DEFAULT_SETTINGS } };
  }
}

function writeDb(db) {
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DB_FILE);
}

function publicWork(w) {
  return {
    id: w.id,
    title: w.title,
    client: w.client,
    category: w.category,
    description: w.description,
    format: w.format,
    featured: w.featured,
    video: w.video ? `/media/${w.video}` : null,
    poster: w.poster ? `/media/${w.poster}` : null,
    link: w.link || '',
  };
}

// ---------------------------------------------------------------------------
// Sessions (signiertes Cookie, keine externe Abhängigkeit)
// ---------------------------------------------------------------------------
function sign(value) {
  return crypto.createHmac('sha256', SESSION_SECRET).update(value).digest('base64url');
}

function createSessionToken() {
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + SESSION_TTL_MS })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

function isValidSession(token) {
  if (!token || typeof token !== 'string') return false;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return false;
  const expected = sign(payload);
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    return false;
  }
  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString()).exp > Date.now();
  } catch {
    return false;
  }
}

function parseCookies(header = '') {
  return Object.fromEntries(
    header
      .split(';')
      .map((c) => c.trim().split('='))
      .filter(([k, v]) => k && v)
      .map(([k, v]) => [k, decodeURIComponent(v)])
  );
}

function passwordMatches(input) {
  if (!ADMIN_PASSWORD || typeof input !== 'string') return false;
  const a = crypto.createHash('sha256').update(input).digest();
  const b = crypto.createHash('sha256').update(ADMIN_PASSWORD).digest();
  return crypto.timingSafeEqual(a, b);
}

function requireAdmin(req, res, next) {
  if (isValidSession(parseCookies(req.headers.cookie).session)) return next();
  res.status(401).json({ error: 'Nicht angemeldet.' });
}

// Einfaches In-Memory-Rate-Limit
function rateLimit({ windowMs, max }) {
  const hits = new Map();
  return (req, res, next) => {
    const now = Date.now();
    const key = req.ip;
    const entry = hits.get(key) || { count: 0, reset: now + windowMs };
    if (now > entry.reset) Object.assign(entry, { count: 0, reset: now + windowMs });
    entry.count += 1;
    hits.set(key, entry);
    if (entry.count > max) {
      return res.status(429).json({ error: 'Zu viele Versuche. Bitte später erneut probieren.' });
    }
    next();
  };
}

// ---------------------------------------------------------------------------
// Uploads
// ---------------------------------------------------------------------------
const VIDEO_EXT = new Set(['.mp4', '.webm', '.mov', '.m4v']);
const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif']);

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${Date.now().toString(36)}-${crypto.randomBytes(6).toString('hex')}${ext}`);
    },
  }),
  limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024, files: 2 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    // Manche Browser senden bei .mov & Co. keinen passenden MIME-Typ – daher zählt vor allem die Endung.
    const genericType = !file.mimetype || file.mimetype === 'application/octet-stream';
    const isVideo = VIDEO_EXT.has(ext) && (genericType || file.mimetype.startsWith('video/'));
    const isImage = IMAGE_EXT.has(ext) && (genericType || file.mimetype.startsWith('image/'));
    if ((file.fieldname === 'video' && isVideo) || (file.fieldname === 'poster' && isImage)) return cb(null, true);
    cb(new Error(`Dateityp nicht erlaubt: ${file.originalname}`));
  },
});

const workUpload = upload.fields([
  { name: 'video', maxCount: 1 },
  { name: 'poster', maxCount: 1 },
]);

function removeMedia(filename) {
  if (!filename) return;
  const file = path.join(UPLOAD_DIR, path.basename(filename));
  fs.rm(file, { force: true }, () => {});
}

function cleanText(value, max = 500) {
  return String(value ?? '').trim().slice(0, max);
}

function cleanUrl(value) {
  const url = cleanText(value, 500);
  return /^https?:\/\//i.test(url) ? url : '';
}

function workFieldsFromBody(body) {
  return {
    title: cleanText(body.title, 120),
    client: cleanText(body.client, 120),
    category: CATEGORIES.includes(body.category) ? body.category : CATEGORIES[0],
    description: cleanText(body.description, 600),
    format: body.format === 'landscape' ? 'landscape' : body.format === 'square' ? 'square' : 'portrait',
    featured: body.featured === 'true' || body.featured === 'on' || body.featured === true,
    link: cleanUrl(body.link),
  };
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------
const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  next();
});

app.use(express.json({ limit: '100kb' }));

// --- Öffentliche API --------------------------------------------------------
app.get('/api/works', (req, res) => {
  res.json(readDb().works.map(publicWork));
});

app.get('/api/categories', (req, res) => res.json(CATEGORIES));

app.post('/api/inquiries', rateLimit({ windowMs: 60 * 60 * 1000, max: 5 }), (req, res) => {
  const { name, email, studio, message, website } = req.body || {};
  if (website) return res.json({ ok: true }); // Honeypot für Bots
  if (!cleanText(name) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanText(email)) || !cleanText(message)) {
    return res.status(400).json({ error: 'Bitte Name, gültige E-Mail und Nachricht angeben.' });
  }
  const db = readDb();
  db.inquiries.unshift({
    id: crypto.randomUUID(),
    name: cleanText(name, 120),
    email: cleanText(email, 200),
    studio: cleanText(studio, 160),
    message: cleanText(message, 3000),
    createdAt: new Date().toISOString(),
    read: false,
  });
  writeDb(db);
  res.json({ ok: true });
});

// --- Auth -------------------------------------------------------------------
const cookieFlags = `HttpOnly; SameSite=Strict; Path=/${IS_PROD ? '; Secure' : ''}`;

app.post('/api/login', rateLimit({ windowMs: 15 * 60 * 1000, max: 10 }), (req, res) => {
  if (!ADMIN_PASSWORD) {
    return res.status(503).json({ error: 'ADMIN_PASSWORD ist auf dem Server nicht gesetzt.' });
  }
  if (!passwordMatches(req.body?.password)) {
    return res.status(401).json({ error: 'Falsches Passwort.' });
  }
  res.setHeader('Set-Cookie', `session=${createSessionToken()}; Max-Age=${SESSION_TTL_MS / 1000}; ${cookieFlags}`);
  res.json({ ok: true });
});

app.post('/api/logout', (req, res) => {
  res.setHeader('Set-Cookie', `session=; Max-Age=0; ${cookieFlags}`);
  res.json({ ok: true });
});

app.get('/api/me', (req, res) => {
  res.json({ authenticated: isValidSession(parseCookies(req.headers.cookie).session) });
});

// --- Admin-API --------------------------------------------------------------
const admin = express.Router();
admin.use(requireAdmin);

admin.post('/works', (req, res, next) => {
  workUpload(req, res, (err) => {
    if (err) return next(err);
    const video = req.files?.video?.[0];
    const poster = req.files?.poster?.[0];
    const fields = workFieldsFromBody(req.body);

    if (!fields.title || !video) {
      removeMedia(video?.filename);
      removeMedia(poster?.filename);
      return res.status(400).json({ error: 'Titel und Video sind Pflicht.' });
    }

    const db = readDb();
    const work = {
      id: crypto.randomUUID(),
      ...fields,
      video: video.filename,
      poster: poster?.filename || null,
      createdAt: new Date().toISOString(),
    };
    db.works.unshift(work);
    writeDb(db);
    res.status(201).json(publicWork(work));
  });
});

admin.put('/works/:id', (req, res, next) => {
  workUpload(req, res, (err) => {
    if (err) return next(err);
    const db = readDb();
    const work = db.works.find((w) => w.id === req.params.id);
    const video = req.files?.video?.[0];
    const poster = req.files?.poster?.[0];

    if (!work) {
      removeMedia(video?.filename);
      removeMedia(poster?.filename);
      return res.status(404).json({ error: 'Werk nicht gefunden.' });
    }

    const fields = workFieldsFromBody(req.body);
    if (!fields.title) {
      removeMedia(video?.filename);
      removeMedia(poster?.filename);
      return res.status(400).json({ error: 'Titel ist Pflicht.' });
    }
    Object.assign(work, fields);

    if (video) {
      removeMedia(work.video);
      work.video = video.filename;
    }
    if (poster) {
      removeMedia(work.poster);
      work.poster = poster.filename;
    }
    writeDb(db);
    res.json(publicWork(work));
  });
});

admin.delete('/works/:id', (req, res) => {
  const db = readDb();
  const index = db.works.findIndex((w) => w.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Werk nicht gefunden.' });
  const [work] = db.works.splice(index, 1);
  removeMedia(work.video);
  removeMedia(work.poster);
  writeDb(db);
  res.json({ ok: true });
});

admin.put('/order', (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids : null;
  if (!ids) return res.status(400).json({ error: 'ids fehlt.' });
  const db = readDb();
  const byId = new Map(db.works.map((w) => [w.id, w]));
  const ordered = ids.map((id) => byId.get(id)).filter(Boolean);
  const rest = db.works.filter((w) => !ids.includes(w.id));
  db.works = [...ordered, ...rest];
  writeDb(db);
  res.json({ ok: true });
});

admin.get('/inquiries', (req, res) => res.json(readDb().inquiries));

admin.put('/inquiries/:id/read', (req, res) => {
  const db = readDb();
  const inquiry = db.inquiries.find((i) => i.id === req.params.id);
  if (!inquiry) return res.status(404).json({ error: 'Anfrage nicht gefunden.' });
  inquiry.read = req.body?.read !== false;
  writeDb(db);
  res.json({ ok: true });
});

admin.delete('/inquiries/:id', (req, res) => {
  const db = readDb();
  db.inquiries = db.inquiries.filter((i) => i.id !== req.params.id);
  writeDb(db);
  res.json({ ok: true });
});

admin.get('/settings', (req, res) => res.json(readDb().settings));

admin.put('/settings', (req, res) => {
  const db = readDb();
  const body = req.body || {};
  db.settings = {
    brandName: cleanText(body.brandName, 60) || DEFAULT_SETTINGS.brandName,
    tagline: cleanText(body.tagline, 160) || DEFAULT_SETTINGS.tagline,
    email: cleanText(body.email, 200),
    instagram: cleanUrl(body.instagram),
    tiktok: cleanUrl(body.tiktok),
    location: cleanText(body.location, 80),
  };
  writeDb(db);
  res.json(db.settings);
});

app.use('/api/admin', admin);

// --- Medien & Seiten --------------------------------------------------------
app.use('/media', express.static(UPLOAD_DIR, { maxAge: '30d', immutable: true }));

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const indexTemplate = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf8');

function renderIndex(req, res) {
  const { settings } = readDb();
  const html = indexTemplate.replace(/\{\{(\w+)\}\}/g, (match, key) =>
    key in settings ? escapeHtml(settings[key]) : match
  );
  res.type('html').send(html);
}

app.get(['/', '/index.html'], renderIndex);

app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin', 'index.html')));
app.use(express.static(path.join(__dirname, 'public'), { maxAge: IS_PROD ? '1h' : 0 }));

app.use('/api', (req, res) => res.status(404).json({ error: 'Nicht gefunden.' }));
app.use((req, res) => res.redirect('/'));

// Fehlerbehandlung (z. B. Upload zu groß / falscher Dateityp)
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const message =
    err.code === 'LIMIT_FILE_SIZE' ? `Datei ist zu groß (max. ${MAX_UPLOAD_MB} MB).` : err.message || 'Serverfehler.';
  res.status(err.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ error: message });
});

app.listen(PORT, () => {
  console.log(`✦ Server läuft auf http://localhost:${PORT}  (Admin: http://localhost:${PORT}/admin)`);
});

// ---------------------------------------------------------------------------
// Minimaler .env-Loader (keine Abhängigkeit nötig)
// ---------------------------------------------------------------------------
function loadDotEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!match || line.trim().startsWith('#')) continue;
    const [, key, raw] = match;
    if (process.env[key] === undefined) process.env[key] = raw.replace(/^(['"])(.*)\1$/, '$2');
  }
}
