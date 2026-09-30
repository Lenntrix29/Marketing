(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  // ---------- Helfer ----------
  async function api(url, options = {}) {
    const res = await fetch(url, {
      ...options,
      headers: options.body && !(options.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {},
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 && url !== '/api/login') showLogin();
    if (!res.ok) throw new Error(data.error || 'Es ist ein Fehler aufgetreten.');
    return data;
  }

  let toastTimer;
  function toast(text) {
    const el = $('#toast');
    el.textContent = text;
    el.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('is-visible'), 2800);
  }

  function setMsg(el, text, isError = false) {
    el.textContent = text;
    el.classList.toggle('is-error', isError);
  }

  // ---------- Login ----------
  function showLogin() {
    $('#appView').hidden = true;
    $('#loginView').hidden = false;
    $('#loginForm input').focus();
  }

  function showApp() {
    $('#loginView').hidden = true;
    $('#appView').hidden = false;
    loadCategories();
    loadWorks();
    loadInquiries();
    loadSettings();
  }

  $('#loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = $('#loginMsg');
    try {
      await api('/api/login', { method: 'POST', body: JSON.stringify({ password: e.target.password.value }) });
      e.target.reset();
      setMsg(msg, '');
      showApp();
    } catch (err) {
      setMsg(msg, err.message, true);
    }
  });

  $('#logoutBtn').addEventListener('click', async () => {
    await api('/api/logout', { method: 'POST' }).catch(() => {});
    showLogin();
  });

  // ---------- Tabs ----------
  $$('.tab').forEach((tab) =>
    tab.addEventListener('click', () => {
      $$('.tab').forEach((t) => t.classList.toggle('is-active', t === tab));
      $$('.view').forEach((v) => (v.hidden = v.id !== `view-${tab.dataset.tab}`));
    })
  );

  // ---------- Arbeiten ----------
  const form = $('#workForm');
  const drop = $('#videoDrop');
  const videoInput = $('input[name=video]', drop);
  const preview = $('.drop__preview', drop);
  let works = [];
  let editingId = null;
  let autoPoster = null;

  async function loadCategories() {
    const cats = await api('/api/categories');
    $('#categorySelect').innerHTML = '';
    cats.forEach((c) => $('#categorySelect').append(new Option(c, c)));
  }

  // Video-Auswahl & Drag-and-Drop
  function handleVideoFile(file) {
    if (!file) return;
    if (!file.type.startsWith('video/')) {
      toast('Bitte eine Videodatei wählen.');
      return;
    }
    const dt = new DataTransfer();
    dt.items.add(file);
    videoInput.files = dt.files;
    preview.src = URL.createObjectURL(file);
    preview.hidden = false;
    drop.classList.add('has-file');
    if (!form.title.value) form.title.value = file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ');
    generatePoster(file).then((blob) => (autoPoster = blob));
    detectFormat(file);
  }

  videoInput.addEventListener('change', () => handleVideoFile(videoInput.files[0]));
  ['dragenter', 'dragover'].forEach((ev) =>
    drop.addEventListener(ev, (e) => {
      e.preventDefault();
      drop.classList.add('is-over');
    })
  );
  ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, () => drop.classList.remove('is-over')));
  drop.addEventListener('drop', (e) => {
    e.preventDefault();
    handleVideoFile(e.dataTransfer.files[0]);
  });

  // Erzeugt ein Vorschaubild aus dem Video (Standbild nach ~1 Sekunde)
  function generatePoster(file) {
    return new Promise((resolve) => {
      const v = document.createElement('video');
      v.muted = true;
      v.playsInline = true;
      v.preload = 'auto';
      v.src = URL.createObjectURL(file);
      const done = (blob) => {
        URL.revokeObjectURL(v.src);
        resolve(blob);
      };
      v.addEventListener('error', () => done(null));
      v.addEventListener('loadedmetadata', () => {
        v.currentTime = Math.min(1, (v.duration || 2) / 3);
      });
      v.addEventListener('seeked', () => {
        try {
          const scale = Math.min(1, 1080 / Math.max(v.videoWidth, v.videoHeight));
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(v.videoWidth * scale);
          canvas.height = Math.round(v.videoHeight * scale);
          canvas.getContext('2d').drawImage(v, 0, 0, canvas.width, canvas.height);
          canvas.toBlob((blob) => done(blob), 'image/jpeg', 0.85);
        } catch {
          done(null);
        }
      }, { once: true });
      setTimeout(() => done(null), 15000);
    });
  }

  // Format automatisch anhand der Videogröße vorschlagen
  function detectFormat(file) {
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.src = URL.createObjectURL(file);
    v.addEventListener('loadedmetadata', () => {
      const ratio = v.videoWidth / v.videoHeight;
      form.format.value = ratio > 1.2 ? 'landscape' : ratio < 0.85 ? 'portrait' : 'square';
      URL.revokeObjectURL(v.src);
    });
  }

  function resetForm() {
    form.reset();
    editingId = null;
    autoPoster = null;
    preview.removeAttribute('src');
    preview.hidden = true;
    drop.classList.remove('has-file');
    $('#formTitle').textContent = 'Neue Arbeit hochladen';
    $('#submitBtn').textContent = 'Hochladen';
    $('#cancelEdit').hidden = true;
    $$('.item').forEach((i) => i.classList.remove('is-editing'));
  }

  $('#cancelEdit').addEventListener('click', () => {
    resetForm();
    setMsg($('#workMsg'), '');
  });

  function upload(url, method, formData) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const bar = $('#progress');
      bar.hidden = false;
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) $('span', bar).style.width = `${(e.loaded / e.total) * 100}%`;
      });
      xhr.addEventListener('load', () => {
        bar.hidden = true;
        $('span', bar).style.width = '0';
        let data = {};
        try { data = JSON.parse(xhr.responseText); } catch {}
        if (xhr.status === 401) showLogin();
        xhr.status < 300 ? resolve(data) : reject(new Error(data.error || 'Upload fehlgeschlagen.'));
      });
      xhr.addEventListener('error', () => {
        bar.hidden = true;
        reject(new Error('Netzwerkfehler beim Upload.'));
      });
      xhr.open(method, url);
      xhr.send(formData);
    });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = $('#workMsg');
    if (!form.title.value.trim()) return setMsg(msg, 'Bitte einen Titel angeben.', true);
    if (!editingId && !videoInput.files.length) return setMsg(msg, 'Bitte ein Video auswählen.', true);

    const fd = new FormData();
    ['title', 'client', 'category', 'format', 'description', 'link'].forEach((k) => fd.append(k, form[k].value));
    fd.append('featured', form.featured.checked ? 'true' : 'false');
    if (videoInput.files[0]) fd.append('video', videoInput.files[0]);
    if (form.poster.files[0]) fd.append('poster', form.poster.files[0]);
    else if (autoPoster && videoInput.files[0]) fd.append('poster', autoPoster, 'poster.jpg');

    const btn = $('#submitBtn');
    btn.disabled = true;
    setMsg(msg, editingId ? 'Wird gespeichert …' : 'Wird hochgeladen …');
    try {
      await upload(editingId ? `/api/admin/works/${editingId}` : '/api/admin/works', editingId ? 'PUT' : 'POST', fd);
      toast(editingId ? 'Änderungen gespeichert ✦' : 'Arbeit veröffentlicht ✦');
      setMsg(msg, '');
      resetForm();
      loadWorks();
    } catch (err) {
      setMsg(msg, err.message, true);
    } finally {
      btn.disabled = false;
    }
  });

  async function loadWorks() {
    works = await api('/api/works');
    renderWorks();
  }

  function renderWorks() {
    const list = $('#worksList');
    list.innerHTML = '';
    $('#worksEmpty').hidden = works.length > 0;
    $('#worksCount').textContent = works.length ? `(${works.length})` : '';

    works.forEach((w, index) => {
      const li = document.createElement('li');
      li.className = 'item';
      li.draggable = true;
      li.dataset.id = w.id;
      if (w.id === editingId) li.classList.add('is-editing');
      li.innerHTML = `
        <span class="item__handle" title="Ziehen zum Sortieren">⋮⋮</span>
        <div class="item__thumb"></div>
        <div>
          <p class="item__title"></p>
          <p class="item__meta"></p>
        </div>
        <div class="item__actions">
          <button class="icon-btn" data-act="up" title="Nach oben" ${index === 0 ? 'disabled' : ''}>↑</button>
          <button class="icon-btn" data-act="down" title="Nach unten" ${index === works.length - 1 ? 'disabled' : ''}>↓</button>
          <button class="icon-btn" data-act="edit" title="Bearbeiten">✎</button>
          <button class="icon-btn icon-btn--danger" data-act="delete" title="Löschen">✕</button>
        </div>`;
      const thumb = $('.item__thumb', li);
      if (w.poster) {
        const img = new Image();
        img.src = w.poster;
        img.alt = '';
        img.loading = 'lazy';
        thumb.append(img);
      } else if (w.video) {
        const v = document.createElement('video');
        v.src = `${w.video}#t=0.1`;
        v.muted = true;
        v.preload = 'metadata';
        thumb.append(v);
      }
      $('.item__title', li).textContent = w.title;
      $('.item__meta', li).innerHTML = `${w.featured ? '<span class="star">★ Hero · </span>' : ''}`;
      $('.item__meta', li).append(`${w.category}${w.client ? ' · ' + w.client : ''}`);
      list.append(li);
    });
  }

  $('#worksList').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const id = btn.closest('.item').dataset.id;
    const work = works.find((w) => w.id === id);
    const index = works.indexOf(work);

    if (btn.dataset.act === 'up' || btn.dataset.act === 'down') {
      const to = index + (btn.dataset.act === 'up' ? -1 : 1);
      works.splice(to, 0, works.splice(index, 1)[0]);
      renderWorks();
      saveOrder();
    }

    if (btn.dataset.act === 'edit') {
      resetForm();
      editingId = id;
      ['title', 'client', 'category', 'format', 'description', 'link'].forEach((k) => (form[k].value = work[k] || ''));
      form.featured.checked = !!work.featured;
      preview.src = work.video;
      preview.hidden = false;
      drop.classList.add('has-file');
      $('#formTitle').textContent = 'Arbeit bearbeiten';
      $('#submitBtn').textContent = 'Speichern';
      $('#cancelEdit').hidden = false;
      btn.closest('.item').classList.add('is-editing');
      form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    if (btn.dataset.act === 'delete') {
      if (!confirm(`„${work.title}“ wirklich löschen? Das Video wird dauerhaft entfernt.`)) return;
      try {
        await api(`/api/admin/works/${id}`, { method: 'DELETE' });
        if (editingId === id) resetForm();
        toast('Gelöscht');
        loadWorks();
      } catch (err) {
        toast(err.message);
      }
    }
  });

  // Sortieren per Drag-and-Drop
  let dragged = null;
  const list = $('#worksList');
  list.addEventListener('dragstart', (e) => {
    dragged = e.target.closest('.item');
    dragged?.classList.add('is-dragging');
    e.dataTransfer.effectAllowed = 'move';
  });
  list.addEventListener('dragover', (e) => {
    e.preventDefault();
    const over = e.target.closest('.item');
    if (!dragged || !over || over === dragged) return;
    const rect = over.getBoundingClientRect();
    const after = e.clientY > rect.top + rect.height / 2;
    over[after ? 'after' : 'before'](dragged);
  });
  list.addEventListener('dragend', () => {
    if (!dragged) return;
    dragged.classList.remove('is-dragging');
    dragged = null;
    const ids = $$('.item', list).map((li) => li.dataset.id);
    works.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
    renderWorks();
    saveOrder();
  });

  async function saveOrder() {
    try {
      await api('/api/admin/order', { method: 'PUT', body: JSON.stringify({ ids: works.map((w) => w.id) }) });
      toast('Reihenfolge gespeichert');
    } catch (err) {
      toast(err.message);
    }
  }

  // ---------- Anfragen ----------
  let inquiries = [];

  async function loadInquiries() {
    inquiries = await api('/api/admin/inquiries');
    renderInquiries();
  }

  function renderInquiries() {
    const listEl = $('#inquiriesList');
    listEl.innerHTML = '';
    $('#inquiriesEmpty').hidden = inquiries.length > 0;
    const unread = inquiries.filter((i) => !i.read).length;
    $('#unreadBadge').hidden = unread === 0;
    $('#unreadBadge').textContent = unread;

    inquiries.forEach((q) => {
      const li = document.createElement('li');
      li.className = `inquiry${q.read ? '' : ' is-unread'}`;
      li.innerHTML = `
        <div class="inquiry__head"><span class="inquiry__name"></span><span class="inquiry__date"></span></div>
        <p class="inquiry__meta"><a class="inquiry__email"></a><span class="inquiry__studio"></span></p>
        <p class="inquiry__msg"></p>
        <div class="inquiry__actions">
          <a class="link inquiry__reply">Antworten</a>
          <button class="link" data-act="toggle">${q.read ? 'Als ungelesen markieren' : 'Als gelesen markieren'}</button>
          <button class="link" data-act="delete">Löschen</button>
        </div>`;
      $('.inquiry__name', li).textContent = q.name;
      $('.inquiry__date', li).textContent = new Date(q.createdAt).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' });
      $('.inquiry__email', li).textContent = q.email;
      $('.inquiry__email', li).href = `mailto:${q.email}`;
      $('.inquiry__studio', li).textContent = q.studio ? ` · ${q.studio}` : '';
      $('.inquiry__msg', li).textContent = q.message;
      $('.inquiry__reply', li).href = `mailto:${q.email}?subject=${encodeURIComponent('Deine Anfrage')}`;

      li.addEventListener('click', async (e) => {
        const act = e.target.closest('[data-act]')?.dataset.act;
        if (!act) return;
        if (act === 'delete' && !confirm('Anfrage löschen?')) return;
        try {
          if (act === 'toggle') await api(`/api/admin/inquiries/${q.id}/read`, { method: 'PUT', body: JSON.stringify({ read: !q.read }) });
          if (act === 'delete') await api(`/api/admin/inquiries/${q.id}`, { method: 'DELETE' });
          loadInquiries();
        } catch (err) {
          toast(err.message);
        }
      });
      listEl.append(li);
    });
  }

  // ---------- Einstellungen ----------
  const settingsForm = $('#settingsForm');

  async function loadSettings() {
    const s = await api('/api/admin/settings');
    Object.entries(s).forEach(([k, v]) => {
      if (settingsForm[k]) settingsForm[k].value = v;
    });
  }

  settingsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await api('/api/admin/settings', {
        method: 'PUT',
        body: JSON.stringify(Object.fromEntries(new FormData(settingsForm))),
      });
      setMsg($('#settingsMsg'), '');
      toast('Einstellungen gespeichert ✦');
      loadSettings();
    } catch (err) {
      setMsg($('#settingsMsg'), err.message, true);
    }
  });

  // ---------- Start ----------
  api('/api/me').then(({ authenticated }) => (authenticated ? showApp() : showLogin())).catch(showLogin);
})();
