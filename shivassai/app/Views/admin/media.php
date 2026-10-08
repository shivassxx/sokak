<?php /** @var array<int, array<string, mixed>> $items @var string|null $kind @var string|null $flash @var string|null $error */ ?>
<h1 class="h-md">Medya</h1>
<?php if ($flash): ?><div class="notice mt-5" role="status"><?= e($flash) ?></div><?php endif; ?>
<?php if ($error): ?><div class="notice mt-5" role="alert"><?= e($error) ?></div><?php endif; ?>

<form method="post" action="/admin/media" enctype="multipart/form-data" class="a-card mt-6 space-y-4">
  <?= csrf_field() ?>
  <label class="flex min-h-[120px] cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-line-3 p-6 text-center text-muted hover:text-fg">
    <input type="file" name="files[]" multiple accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm" class="sr-only" data-file-input>
    <span class="text-[15px] text-fg" data-file-label>Dosya seç</span>
    <span class="text-[12px]">JPG, PNG, WebP, GIF (≤ <?= e(format_bytes((int) config('uploads.max_image_bytes'))) ?>) · MP4, WebM (≤ <?= e(format_bytes((int) config('uploads.max_video_bytes'))) ?>)</span>
  </label>
  <button type="submit" class="btn btn-primary w-full">Yükle</button>
</form>

<div class="mt-8 flex gap-2 overflow-x-auto">
  <?php foreach (['' => 'Tümü', 'image' => 'Görsel', 'gif' => 'GIF', 'video' => 'Video'] as $k => $label): ?>
    <a href="/admin/media<?= $k ? '?tur=' . $k : '' ?>" class="pill shrink-0 <?= ($kind ?? '') === $k ? 'is-active' : '' ?>"><?= e($label) ?></a>
  <?php endforeach; ?>
</div>

<ul class="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
  <?php foreach ($items as $m): ?>
    <li class="a-card flex flex-col gap-3 p-3">
      <div class="aspect-[4/3] overflow-hidden rounded-xl border border-line bg-canvas-2">
        <?php if ($m['kind'] === 'video'): ?>
          <video src="<?= e($m['path']) ?>" muted playsinline preload="metadata" class="h-full w-full object-cover"></video>
        <?php else: ?>
          <img src="<?= e($m['variant_path'] ?: $m['path']) ?>" alt="" loading="lazy" class="h-full w-full object-cover">
        <?php endif; ?>
      </div>
      <div class="min-w-0">
        <p class="truncate text-[13px]" title="<?= e($m['original_name']) ?>"><?= e($m['original_name']) ?></p>
        <p class="mt-1 text-[11px] text-muted"><?= e(strtoupper((string) $m['kind'])) ?> · <?= e(format_bytes((int) $m['size'])) ?><?= $m['width'] ? ' · ' . (int) $m['width'] . '×' . (int) $m['height'] : '' ?></p>
        <p class="text-[11px] text-muted"><?= e(format_date($m['created_at'])) ?></p>
      </div>
      <div class="mt-auto flex gap-2">
        <button type="button" class="btn btn-secondary btn-sm flex-1 px-2" data-copy="<?= e($m['path']) ?>">Yolu kopyala</button>
        <form method="post" action="/admin/media/<?= (int) $m['id'] ?>/delete" data-confirm="Dosya silinsin mi?">
          <?= csrf_field() ?>
          <button type="submit" class="icon-btn h-9 w-9 border border-line" aria-label="Sil">✕</button>
        </form>
      </div>
    </li>
  <?php endforeach; ?>
</ul>
<?php if (!$items): ?><p class="a-card mt-5 text-[14px] text-muted">Henüz dosya yok.</p><?php endif; ?>
