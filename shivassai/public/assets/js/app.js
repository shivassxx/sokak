/* shivassai — small progressive enhancements. No framework. */
(function () {
  'use strict';
  var doc = document.documentElement;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Theme: dark (default) / light / system ---------- */
  var media = window.matchMedia('(prefers-color-scheme: light)');
  function getPref() {
    try { return localStorage.getItem('theme') || 'dark'; } catch (e) { return 'dark'; }
  }
  function applyTheme(pref) {
    var resolved = pref === 'system' ? (media.matches ? 'light' : 'dark') : (pref === 'light' ? 'light' : 'dark');
    doc.setAttribute('data-theme', resolved);
    doc.setAttribute('data-theme-pref', pref);
    document.querySelectorAll('[data-theme-set]').forEach(function (b) {
      b.setAttribute('aria-pressed', b.getAttribute('data-theme-set') === pref ? 'true' : 'false');
    });
  }
  function setPref(pref) {
    try { localStorage.setItem('theme', pref); } catch (e) {}
    applyTheme(pref);
  }
  applyTheme(getPref());
  media.addEventListener && media.addEventListener('change', function () { if (getPref() === 'system') applyTheme('system'); });
  document.addEventListener('click', function (e) {
    var set = e.target.closest('[data-theme-set]');
    if (set) { setPref(set.getAttribute('data-theme-set')); return; }
    if (e.target.closest('[data-theme-cycle]')) {
      var order = ['dark', 'light', 'system'];
      setPref(order[(order.indexOf(getPref()) + 1) % order.length]);
    }
  });

  /* ---------- Mobile menu ---------- */
  var menu = document.getElementById('mobile-menu');
  var opener = document.querySelector('[data-menu-open]');
  function closeMenu() {
    if (!menu || menu.hidden) return;
    menu.hidden = true;
    document.body.style.overflow = '';
    opener && opener.setAttribute('aria-expanded', 'false');
    opener && opener.focus();
  }
  if (menu && opener) {
    opener.addEventListener('click', function () {
      menu.hidden = false;
      document.body.style.overflow = 'hidden';
      opener.setAttribute('aria-expanded', 'true');
      var first = menu.querySelector('[data-menu-close]');
      first && first.focus();
    });
    menu.querySelector('[data-menu-close]').addEventListener('click', closeMenu);
    menu.addEventListener('click', function (e) { if (e.target.closest('a')) closeMenu(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeMenu(); });
    window.matchMedia('(min-width: 768px)').addEventListener('change', function (m) { if (m.matches) closeMenu(); });
  }

  /* ---------- Reveal on scroll ---------- */
  var reveals = document.querySelectorAll('.reveal');
  if (reduceMotion || !('IntersectionObserver' in window)) {
    reveals.forEach(function (el) { el.classList.add('is-in'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { entry.target.classList.add('is-in'); io.unobserve(entry.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
    reveals.forEach(function (el) { io.observe(el); });
  }

  /* ---------- Lazy project videos ---------- */
  var videos = document.querySelectorAll('video[data-lazy-video]');
  function loadVideo(v) {
    if (v.dataset.loaded) return;
    v.querySelectorAll('source[data-src]').forEach(function (s) { s.src = s.dataset.src; });
    v.dataset.loaded = '1';
    v.load();
  }
  function wantsAutoplay(v) { return v.dataset.autoplay === '1' && !reduceMotion; }
  if ('IntersectionObserver' in window) {
    var vio = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var v = entry.target;
        if (entry.isIntersecting) {
          loadVideo(v);
          if (wantsAutoplay(v)) { var p = v.play(); p && p.catch(function () {}); }
        } else if (!v.paused) {
          v.pause();
        }
      });
    }, { rootMargin: '200px 0px' });
    videos.forEach(function (v) { vio.observe(v); });
  } else {
    videos.forEach(loadVideo);
  }
  // Hover-to-play on desktop for videos without autoplay.
  if (window.matchMedia('(hover: hover)').matches) {
    videos.forEach(function (v) {
      if (wantsAutoplay(v)) return;
      var host = v.closest('.media-hover') || v.parentElement;
      host.addEventListener('mouseenter', function () { loadVideo(v); var p = v.play(); p && p.catch(function () {}); });
      host.addEventListener('mouseleave', function () { v.pause(); });
    });
  }

  /* ---------- Accordion (enhances <details>) ---------- */
  document.querySelectorAll('details[data-accordion]').forEach(function (d) {
    var summary = d.querySelector('summary');
    var body = d.querySelector('.acc-body');
    if (!summary || !body || reduceMotion) return;
    summary.addEventListener('click', function (e) {
      e.preventDefault();
      if (d.dataset.animating) return;
      d.dataset.animating = '1';
      if (d.open) {
        var h = body.scrollHeight;
        body.style.height = h + 'px';
        requestAnimationFrame(function () {
          body.style.transition = 'height .35s cubic-bezier(.2,.7,.2,1), opacity .25s';
          body.style.height = '0px';
          body.style.opacity = '0';
        });
        body.addEventListener('transitionend', function done(ev) {
          if (ev.propertyName !== 'height') return;
          body.removeEventListener('transitionend', done);
          d.open = false;
          body.removeAttribute('style');
          delete d.dataset.animating;
        });
      } else {
        d.open = true;
        var target = body.scrollHeight;
        body.style.height = '0px';
        body.style.opacity = '0';
        requestAnimationFrame(function () {
          body.style.transition = 'height .4s cubic-bezier(.2,.7,.2,1), opacity .4s';
          body.style.height = target + 'px';
          body.style.opacity = '1';
        });
        body.addEventListener('transitionend', function done(ev) {
          if (ev.propertyName !== 'height') return;
          body.removeEventListener('transitionend', done);
          body.removeAttribute('style');
          delete d.dataset.animating;
        });
      }
    });
  });

  /* ---------- Project filters (no reload) ---------- */
  var filterForm = document.querySelector('[data-filters]');
  if (filterForm) {
    var wraps = document.querySelectorAll('[data-project-wrap]');
    var count = filterForm.querySelector('[data-filter-count]');
    var empty = document.querySelector('[data-filter-empty]');
    var statusSel = filterForm.querySelector('[data-filter-status]');
    var hidden = filterForm.querySelector('[data-filter-hidden]');
    if (hidden) hidden.remove(); // JS keeps category in state instead
    var state = {
      category: (filterForm.querySelector('[data-filter-category][aria-pressed="true"]') || {}).value || '',
      status: statusSel ? statusSel.value : ''
    };
    function render() {
      var n = 0;
      wraps.forEach(function (w) {
        var ok = (!state.category || w.dataset.category === state.category) && (!state.status || w.dataset.status === state.status);
        w.hidden = !ok;
        if (ok) { n++; w.classList.add('is-in'); }
      });
      filterForm.querySelectorAll('[data-filter-category]').forEach(function (b) {
        b.setAttribute('aria-pressed', b.value === state.category ? 'true' : 'false');
      });
      if (count) count.textContent = (count.dataset.template || ':n').replace(':n', n);
      if (empty) empty.hidden = n !== 0;
      var params = new URLSearchParams();
      if (state.category) params.set('kategori', state.category);
      if (state.status) params.set('durum', state.status);
      var qs = params.toString();
      history.replaceState(null, '', location.pathname + (qs ? '?' + qs : ''));
    }
    filterForm.addEventListener('click', function (e) {
      var b = e.target.closest('[data-filter-category]');
      if (!b) return;
      e.preventDefault();
      state.category = b.value;
      render();
    });
    statusSel && statusSel.addEventListener('change', function () { state.status = statusSel.value; render(); });
    filterForm.addEventListener('submit', function (e) { e.preventDefault(); render(); });
  }
})();
