<div class="inline-flex rounded-full border border-line-2 p-1" role="group" aria-label="<?= e(t('theme.label')) ?>">
  <?php foreach (['dark' => t('theme.dark'), 'light' => t('theme.light'), 'system' => t('theme.system')] as $value => $label): ?>
    <button type="button" class="rounded-full px-3 py-1.5 text-[12px] text-muted transition-colors hover:text-fg aria-pressed:bg-surface-2 aria-pressed:text-fg" data-theme-set="<?= e($value) ?>" aria-pressed="false"><?= e($label) ?></button>
  <?php endforeach; ?>
</div>
