<?php /** @var array<int, array<string, mixed>> $logs @var string|null $flash */ ?>
<div class="flex items-end justify-between gap-4">
  <h1 class="h-md">Build Log</h1>
  <a href="/admin/build-log/create" class="btn btn-primary btn-sm">+ Yeni yazı</a>
</div>
<?php if ($flash): ?><div class="notice mt-5" role="status"><?= e($flash) ?></div><?php endif; ?>

<div class="a-card mt-6 py-1">
  <?php foreach ($logs as $log): ?>
    <a href="/admin/build-log/<?= (int) $log['id'] ?>/edit" class="a-row">
      <div class="min-w-0 flex-1">
        <p class="truncate text-[15px] font-medium"><?= e($log['title']) ?></p>
        <p class="mt-1 truncate text-[12px] text-muted">
          <?= $log['published_at'] ? e(format_date($log['published_at'])) : 'Tarih yok' ?>
          <?= $log['project_title'] ? ' · ' . e($log['project_title']) : '' ?>
          · <?= (int) $log['reading_minutes'] ?> dk
        </p>
      </div>
      <span class="a-chip <?= $log['is_published'] ? 'a-chip-on' : '' ?>"><?= $log['is_published'] ? 'Yayında' : 'Taslak' ?></span>
    </a>
  <?php endforeach; ?>
  <?php if (!$logs): ?><p class="py-4 text-[14px] text-muted">Henüz yazı yok.</p><?php endif; ?>
</div>
