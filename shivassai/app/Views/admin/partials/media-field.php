<?php
/**
 * Media picker: choose from the library or upload a new file in place.
 * @var string $name @var string $label @var string|null $value @var array<int, string> $kinds
 * @var array<int, array<string, mixed>> $library @var string|null $error @var string|null $hint
 */
$options = array_filter($library, static fn (array $m): bool => in_array($m['kind'], $kinds, true));
$accept = implode(',', array_unique(array_merge(
    in_array('image', $kinds, true) ? ['image/jpeg', 'image/png', 'image/webp'] : [],
    in_array('gif', $kinds, true) ? ['image/gif'] : [],
    in_array('video', $kinds, true) ? ['video/mp4', 'video/webm'] : []
)));
$isVideo = $kinds === ['video'];
?>
<div class="field" data-media-field>
  <span class="field-label"><?= e($label) ?></span>
  <div class="flex gap-3">
    <div class="h-20 w-28 shrink-0 overflow-hidden rounded-xl border border-line bg-canvas-2" data-media-preview>
      <?php if ($value): ?>
        <?php if ($isVideo): ?><video src="<?= e($value) ?>" muted playsinline preload="metadata" class="h-full w-full object-cover"></video>
        <?php else: ?><img src="<?= e($value) ?>" alt="" class="h-full w-full object-cover"><?php endif; ?>
      <?php else: ?><span class="flex h-full items-center justify-center text-[11px] text-faint">boş</span><?php endif; ?>
    </div>
    <div class="min-w-0 flex-1 space-y-2">
      <select class="input min-h-[44px] py-2 text-[14px]" name="<?= e($name) ?>" aria-label="<?= e($label) ?> — kütüphaneden seç">
        <option value="">— Yok —</option>
        <?php foreach ($options as $m): ?>
          <option value="<?= e($m['path']) ?>"<?= $value === $m['path'] ? ' selected' : '' ?>><?= e($m['original_name'] ?: basename((string) $m['path'])) ?> · <?= e(format_bytes((int) $m['size'])) ?></option>
        <?php endforeach; ?>
      </select>
      <label class="flex min-h-[44px] cursor-pointer items-center justify-center rounded-2xl border border-dashed border-line-3 px-3 text-[13px] text-muted hover:text-fg">
        <input type="file" name="<?= e($name) ?>_file" accept="<?= e($accept) ?>" class="sr-only" data-file-input>
        <span data-file-label>↑ Yeni dosya yükle</span>
      </label>
    </div>
  </div>
  <?php if (!empty($hint)): ?><p class="text-[12px] text-muted"><?= e($hint) ?></p><?php endif; ?>
  <?php if (!empty($error)): ?><p class="field-error"><?= e($error) ?></p><?php endif; ?>
</div>
