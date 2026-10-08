<?php
/** @var array{total:int,featured:int,published:int} $stats @var int $logCount @var int $media @var int $unread @var array<int, array<string, mixed>> $recent */
$cards = [
    ['Projeler', $stats['total'], $stats['published'] . ' yayında', '/admin/projects'],
    ['Öne çıkan', $stats['featured'], 'ana sayfada', '/admin/projects'],
    ['Build log', $logCount, 'yazı', '/admin/build-log'],
    ['Medya', $media, 'dosya', '/admin/media'],
];
?>
<div class="flex items-end justify-between gap-4">
  <div>
    <p class="micro normal-case">Merhaba, <?= e(\App\Services\Auth::username()) ?></p>
    <h1 class="h-md mt-2">Panel</h1>
  </div>
  <?php if ($unread): ?><a href="/admin/messages" class="pill">✉ <?= $unread ?> yeni mesaj</a><?php endif; ?>
</div>

<div class="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
  <?php foreach ($cards as [$label, $value, $hint, $href]): ?>
    <a href="<?= e($href) ?>" class="a-card transition-colors hover:border-line-3">
      <p class="micro"><?= e($label) ?></p>
      <p class="mt-3 text-[34px] font-medium leading-none tracking-[-0.04em] tabular"><?= (int) $value ?></p>
      <p class="mt-2 text-[12px] text-muted"><?= e($hint) ?></p>
    </a>
  <?php endforeach; ?>
</div>

<h2 class="micro mb-3 mt-10">Hızlı işlemler</h2>
<div class="grid gap-3 sm:grid-cols-3">
  <a href="/admin/projects/create" class="btn btn-primary w-full">+ Yeni proje</a>
  <a href="/admin/build-log/create" class="btn btn-secondary w-full">+ Yeni build log</a>
  <a href="/admin/media" class="btn btn-secondary w-full">↑ Medya yükle</a>
</div>

<h2 class="micro mb-3 mt-10">Son düzenlenenler</h2>
<div class="a-card py-1">
  <?php if (!$recent): ?><p class="py-4 text-[14px] text-muted">Henüz içerik yok.</p><?php endif; ?>
  <?php foreach ($recent as $r): ?>
    <?php $href = $r['type'] === 'project' ? '/admin/projects/' . (int) $r['id'] . '/edit' : '/admin/build-log/' . (int) $r['id'] . '/edit'; ?>
    <a href="<?= e($href) ?>" class="a-row">
      <span class="a-chip"><?= $r['type'] === 'project' ? 'Proje' : 'Log' ?></span>
      <span class="min-w-0 flex-1 truncate text-[15px]"><?= e($r['title']) ?></span>
      <span class="a-chip <?= $r['is_published'] ? 'a-chip-on' : '' ?>"><?= $r['is_published'] ? 'Yayında' : 'Taslak' ?></span>
    </a>
  <?php endforeach; ?>
</div>
