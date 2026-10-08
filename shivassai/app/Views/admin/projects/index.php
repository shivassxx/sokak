<?php /** @var array<int, array<string, mixed>> $projects @var string|null $flash */ ?>
<div class="flex items-end justify-between gap-4">
  <h1 class="h-md">Projeler</h1>
  <a href="/admin/projects/create" class="btn btn-primary btn-sm">+ Yeni</a>
</div>
<?php if ($flash): ?><div class="notice mt-5" role="status"><?= e($flash) ?></div><?php endif; ?>

<ul class="mt-6 space-y-3">
  <?php foreach ($projects as $i => $p): ?>
    <li id="p<?= (int) $p['id'] ?>" class="a-card flex items-center gap-3 p-3 md:p-4">
      <div class="flex flex-col gap-1">
        <form method="post" action="/admin/projects/<?= (int) $p['id'] ?>/move"><?= csrf_field() ?><input type="hidden" name="direction" value="up">
          <button class="icon-btn h-9 w-9 border border-line disabled:opacity-30" type="submit" aria-label="Yukarı taşı" <?= $i === 0 ? 'disabled' : '' ?>>↑</button></form>
        <form method="post" action="/admin/projects/<?= (int) $p['id'] ?>/move"><?= csrf_field() ?><input type="hidden" name="direction" value="down">
          <button class="icon-btn h-9 w-9 border border-line disabled:opacity-30" type="submit" aria-label="Aşağı taşı" <?= $i === count($projects) - 1 ? 'disabled' : '' ?>>↓</button></form>
      </div>
      <a href="/admin/projects/<?= (int) $p['id'] ?>/edit" class="min-w-0 flex-1 py-1">
        <p class="truncate text-[16px] font-medium"><?= e($p['title']) ?></p>
        <p class="mt-1 truncate text-[12px] text-muted">/<?= e($p['slug']) ?> · <?= e(project_categories()[$p['category']] ?? '') ?> · <?= e(project_statuses()[$p['status']] ?? '') ?></p>
        <div class="mt-2 flex flex-wrap gap-1.5">
          <span class="a-chip <?= $p['is_published'] ? 'a-chip-on' : '' ?>"><?= $p['is_published'] ? 'Yayında' : 'Taslak' ?></span>
          <?php if ($p['video'] || $p['gif'] || $p['cover_image']): ?><span class="a-chip">medya ✓</span><?php else: ?><span class="a-chip">medya yok</span><?php endif; ?>
        </div>
      </a>
      <form method="post" action="/admin/projects/<?= (int) $p['id'] ?>/feature"><?= csrf_field() ?>
        <button type="submit" class="icon-btn h-11 w-11 border <?= $p['is_featured'] ? 'border-line-3 text-fg' : 'border-line' ?>" aria-pressed="<?= $p['is_featured'] ? 'true' : 'false' ?>" aria-label="Öne çıkar" title="Öne çıkar"><?= $p['is_featured'] ? '★' : '☆' ?></button>
      </form>
    </li>
  <?php endforeach; ?>
  <?php if (!$projects): ?><li class="a-card text-[14px] text-muted">Henüz proje yok.</li><?php endif; ?>
</ul>
<p class="mt-4 text-[12px] text-muted">↑↓ sıralamayı değiştirir · ★ ana sayfada öne çıkarır (ilk 3 öne çıkan gösterilir).</p>
