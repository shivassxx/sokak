/* shivassai admin — small helpers for the mobile-first CMS. */
(function () {
  'use strict';
  var token = (document.querySelector('meta[name="csrf-token"]') || {}).content || '';

  // Confirm destructive actions.
  document.querySelectorAll('form[data-confirm]').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      if (!window.confirm(form.getAttribute('data-confirm'))) e.preventDefault();
    });
  });

  // Auto slug from title (until the slug is edited by hand).
  var source = document.querySelector('[data-slug-source]');
  var target = document.querySelector('[data-slug-target]');
  if (source && target) {
    var manual = target.value !== '';
    var map = { 'ç': 'c', 'ğ': 'g', 'ı': 'i', 'İ': 'i', 'ö': 'o', 'ş': 's', 'ü': 'u', 'â': 'a', 'î': 'i', 'û': 'u' };
    var slugify = function (s) {
      return s.replace(/[çğıİöşüâîû]/gi, function (c) { return map[c] || map[c.toLowerCase()] || c; })
        .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    };
    target.addEventListener('input', function () { manual = target.value !== ''; });
    source.addEventListener('input', function () { if (!manual) target.placeholder = slugify(source.value) || 'otomatik'; });
  }

  // Show selected file names + instant local preview.
  document.querySelectorAll('[data-file-input]').forEach(function (input) {
    input.addEventListener('change', function () {
      var label = input.parentElement.querySelector('[data-file-label]');
      var files = Array.prototype.slice.call(input.files || []);
      if (label) label.textContent = files.length ? files.map(function (f) { return f.name; }).join(', ') : 'Dosya seç';
      var field = input.closest('[data-media-field]');
      var preview = field && field.querySelector('[data-media-preview]');
      if (preview && files[0]) {
        var url = URL.createObjectURL(files[0]);
        var isVideo = files[0].type.indexOf('video/') === 0;
        var el = document.createElement(isVideo ? 'video' : 'img');
        el.src = url;
        el.className = 'h-full w-full object-cover';
        if (isVideo) { el.muted = true; el.playsInline = true; }
        preview.replaceChildren(el);
      }
    });
  });

  // Markdown preview (rendered + sanitized by the server).
  document.querySelectorAll('[data-md-editor]').forEach(function (box) {
    var btn = box.querySelector('[data-md-toggle]');
    var src = box.querySelector('[data-md-source]');
    var out = box.querySelector('[data-md-preview]');
    if (!btn || !src || !out) return;
    btn.addEventListener('click', function () {
      var showing = !out.classList.contains('hidden');
      if (showing) {
        out.classList.add('hidden'); src.classList.remove('hidden'); btn.textContent = 'Önizle';
        return;
      }
      var body = new FormData();
      body.append('_csrf', token);
      body.append('body', src.value);
      btn.textContent = '…';
      fetch('/admin/markdown-preview', { method: 'POST', body: body, credentials: 'same-origin' })
        .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
        .then(function (data) {
          out.innerHTML = data.html || '<p>—</p>'; // server output is escaped + whitelisted
          out.classList.remove('hidden'); src.classList.add('hidden'); btn.textContent = 'Düzenle';
        })
        .catch(function () { btn.textContent = 'Önizle'; alert('Önizleme alınamadı. Oturum süresi dolmuş olabilir.'); });
    });
  });

  // Copy media path.
  document.querySelectorAll('[data-copy]').forEach(function (b) {
    b.addEventListener('click', function () {
      var text = b.getAttribute('data-copy');
      var done = function () { var t = b.textContent; b.textContent = 'Kopyalandı ✓'; setTimeout(function () { b.textContent = t; }, 1400); };
      if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, function () { prompt('Yol:', text); });
      else prompt('Yol:', text);
    });
  });

  // Warn before leaving a form with unsaved changes.
  document.querySelectorAll('form[data-dirty-guard]').forEach(function (form) {
    var dirty = false;
    form.addEventListener('input', function () { dirty = true; });
    form.addEventListener('change', function () { dirty = true; });
    form.addEventListener('submit', function () { dirty = false; });
    window.addEventListener('beforeunload', function (e) { if (dirty) { e.preventDefault(); e.returnValue = ''; } });
  });
})();
