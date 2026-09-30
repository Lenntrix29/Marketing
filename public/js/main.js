(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  $('#year').textContent = new Date().getFullYear();

  // ---------- Überschrift Wort für Wort ----------
  $$('[data-split]').forEach((el) => {
    let i = 0;
    const splitNode = (node) => {
      [...node.childNodes].forEach((child) => {
        if (child.nodeType === Node.TEXT_NODE) {
          const frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) return frag.append(' ');
            const word = document.createElement('span');
            word.className = 'word';
            word.innerHTML = `<span style="--i:${i++}"></span>`;
            word.firstChild.textContent = part;
            frag.append(word);
          });
          child.replaceWith(frag);
        } else if (child.nodeType === Node.ELEMENT_NODE) {
          splitNode(child);
        }
      });
    };
    splitNode(el);
  });
  requestAnimationFrame(() => requestAnimationFrame(() => document.body.classList.add('is-loaded')));

  // ---------- Navigation ----------
  const nav = $('#nav');
  const toggle = $('#navToggle');
  const onScroll = () => nav.classList.toggle('is-scrolled', window.scrollY > 30);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const setMenu = (open) => {
    nav.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Menü schließen' : 'Menü öffnen');
    document.body.style.overflow = open ? 'hidden' : '';
  };
  toggle.addEventListener('click', () => setMenu(!nav.classList.contains('is-open')));
  $$('#navLinks a').forEach((a) => a.addEventListener('click', () => setMenu(false)));

  // ---------- Scroll-Reveal ----------
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        revealObserver.unobserve(entry.target);
      });
    },
    { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
  );
  const observeReveal = (root = document) => $$('.reveal, .step', root).forEach((el) => revealObserver.observe(el));
  observeReveal();

  // ---------- Social Links ----------
  const social = $('#socialLinks');
  [['instagram', 'Instagram'], ['tiktok', 'TikTok']].forEach(([key, label]) => {
    const url = social.dataset[key];
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener';
    a.textContent = `${label} ↗`;
    social.append(a);
  });

  // ---------- Arbeiten ----------
  const worksEl = $('#works');
  const filtersEl = $('#filters');
  let works = [];

  const createMedia = (work, { autoplay = false } = {}) => {
    const frag = document.createDocumentFragment();
    if (work.poster && !autoplay) {
      const img = document.createElement('img');
      img.src = work.poster;
      img.alt = '';
      img.loading = 'lazy';
      frag.append(img);
    }
    if (work.video) {
      const video = document.createElement('video');
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.preload = work.poster ? 'none' : 'metadata';
      // #t=0.1 zeigt ein Standbild, falls kein Vorschaubild existiert
      video.src = work.poster ? work.video : `${work.video}#t=0.1`;
      if (work.poster) video.poster = work.poster;
      if (autoplay && !reducedMotion) {
        video.autoplay = true;
        video.preload = 'auto';
      }
      frag.prepend(video);
    }
    return frag;
  };

  const renderHeroStack = () => {
    const picks = [...works.filter((w) => w.featured), ...works.filter((w) => !w.featured)].slice(0, 3);
    const cards = $$('.hero__card');
    picks.forEach((work, i) => {
      cards[i].replaceChildren(createMedia(work, { autoplay: true }));
      const v = $('video', cards[i]);
      if (v && !reducedMotion) v.play().catch(() => {});
    });
  };

  const renderFilters = () => {
    const used = [...new Set(works.map((w) => w.category))];
    if (used.length < 2) return;
    used.forEach((cat) => {
      const b = document.createElement('button');
      b.className = 'filter';
      b.dataset.filter = cat;
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', 'false');
      b.textContent = cat;
      filtersEl.append(b);
    });
  };

  const renderWorks = () => {
    $('#worksEmpty').hidden = works.length > 0;
    filtersEl.hidden = works.length === 0;

    works.forEach((work, i) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = `work work--${work.format} reveal`;
      card.style.setProperty('--d', `${(i % 4) * 0.08}s`);
      card.dataset.category = work.category;
      card.setAttribute('aria-label', `Video ansehen: ${work.title}`);
      card.innerHTML = `
        <div class="work__media">
          <span class="work__badge"></span>
          <span class="work__play" aria-hidden="true"></span>
        </div>
        <div class="work__info">
          <h3 class="work__title"></h3>
          <p class="work__client"></p>
        </div>`;
      const media = $('.work__media', card);
      media.prepend(createMedia(work));
      $('.work__badge', card).textContent = work.category;
      $('.work__title', card).textContent = work.title;
      $('.work__client', card).textContent = work.client;
      if (!work.client) $('.work__client', card).remove();

      // Vorschau beim Hovern (nur Desktop)
      const video = $('video', card);
      const img = $('img', card);
      if (video && window.matchMedia('(hover: hover)').matches && !reducedMotion) {
        card.addEventListener('mouseenter', () => {
          video.preload = 'auto';
          video.play().then(() => img?.classList.add('is-hidden')).catch(() => {});
        });
        card.addEventListener('mouseleave', () => {
          video.pause();
          img?.classList.remove('is-hidden');
        });
      }

      card.addEventListener('click', () => openLightbox(work));
      worksEl.append(card);
    });
    observeReveal(worksEl);
  };

  filtersEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.filter');
    if (!btn) return;
    $$('.filter', filtersEl).forEach((b) => {
      b.classList.toggle('is-active', b === btn);
      b.setAttribute('aria-selected', String(b === btn));
    });
    const f = btn.dataset.filter;
    $$('.work', worksEl).forEach((card) => {
      card.classList.toggle('is-filtered', f !== 'all' && card.dataset.category !== f);
    });
  });

  fetch('/api/works')
    .then((r) => r.json())
    .then((data) => {
      works = data;
      renderHeroStack();
      renderFilters();
      renderWorks();
    })
    .catch(() => {
      $('#worksEmpty').hidden = false;
    });

  // ---------- Lightbox ----------
  const lightbox = $('#lightbox');
  const lbVideo = $('#lightboxVideo');
  let lastFocus = null;

  function openLightbox(work) {
    lastFocus = document.activeElement;
    lbVideo.src = work.video;
    lbVideo.poster = work.poster || '';
    $('#lightboxCategory').textContent = work.category;
    $('#lightboxTitle').textContent = work.title;
    $('#lightboxClient').textContent = work.client;
    $('#lightboxDesc').textContent = work.description;
    const link = $('#lightboxLink');
    link.hidden = !work.link;
    link.href = work.link || '#';
    lightbox.hidden = false;
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => lightbox.classList.add('is-open'));
    lbVideo.play().catch(() => {});
    $('#lightboxClose').focus();
  }

  function closeLightbox() {
    lightbox.classList.remove('is-open');
    lbVideo.pause();
    document.body.style.overflow = '';
    setTimeout(() => {
      lightbox.hidden = true;
      lbVideo.removeAttribute('src');
      lbVideo.load();
    }, 400);
    lastFocus?.focus();
  }

  $('#lightboxClose').addEventListener('click', closeLightbox);
  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) closeLightbox();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!lightbox.hidden) closeLightbox();
    else if (nav.classList.contains('is-open')) setMenu(false);
  });

  // ---------- Kontaktformular ----------
  const form = $('#contactForm');
  const status = $('#formStatus');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    if (!data.name.trim() || !data.email.trim() || !data.message.trim()) {
      status.textContent = 'Bitte fülle Name, E-Mail und Nachricht aus.';
      return;
    }
    const btn = $('button[type=submit]', form);
    btn.disabled = true;
    status.textContent = 'Wird gesendet …';
    try {
      const res = await fetch('/api/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      form.reset();
      status.textContent = 'Danke! Ich melde mich in Kürze bei dir. ✦';
    } catch (err) {
      status.textContent = err.message || 'Da ist etwas schiefgelaufen. Schreib mir gern direkt per E-Mail.';
    } finally {
      btn.disabled = false;
    }
  });
})();
