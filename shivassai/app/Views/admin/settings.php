<?php
/**
 * @var array<string, string> $values @var array<string, string> $social
 * @var array<string, array<string, array{0: string, 1: string, 2: int}>> $fields
 * @var string|null $flash @var array<int, string> $errors
 */
?>
<h1 class="h-md">Ayarlar</h1>
<p class="mt-1 text-[14px] text-muted">Ana sayfa metinleri, Hakkımda sayfası ve sosyal bağlantılar.</p>
<?php if ($flash): ?><div class="notice mt-5" role="status"><?= e($flash) ?></div><?php endif; ?>
<?php foreach ($errors as $error): ?><div class="notice mt-3" role="alert"><?= e($error) ?></div><?php endforeach; ?>

<form method="post" action="/admin/settings" class="mt-6 space-y-6" data-dirty-guard>
  <?= csrf_field() ?>

  <?php foreach ($fields as $group => $items): ?>
    <fieldset class="a-card space-y-5">
      <legend class="micro px-1"><?= e($group) ?></legend>
      <?php foreach ($items as $key => [$label, $type, $max]): ?>
        <div class="field">
          <label class="field-label" for="s-<?= e($key) ?>"><?= e($label) ?></label>
          <?php if ($type === 'text'): ?>
            <input class="input" id="s-<?= e($key) ?>" name="<?= e($key) ?>" maxlength="<?= (int) $max ?>" value="<?= e($values[$key] ?? '') ?>">
          <?php else: ?>
            <textarea class="input <?= $type === 'markdown' ? 'font-mono text-[14px]' : '' ?>" id="s-<?= e($key) ?>" name="<?= e($key) ?>" rows="<?= $type === 'markdown' ? 6 : 4 ?>" maxlength="<?= (int) $max ?>"><?= e($values[$key] ?? '') ?></textarea>
          <?php endif; ?>
        </div>
      <?php endforeach; ?>
    </fieldset>
  <?php endforeach; ?>

  <fieldset class="a-card space-y-5">
    <legend class="micro px-1">Sosyal bağlantılar (boş olanlar sitede gösterilmez)</legend>
    <div class="field">
      <label class="field-label" for="social_github">GitHub URL</label>
      <input class="input" type="url" inputmode="url" id="social_github" name="social_github" value="<?= e($social['github'] ?? '') ?>" placeholder="https://github.com/kullanici">
    </div>
    <div class="field">
      <label class="field-label" for="social_x">X URL</label>
      <input class="input" type="url" inputmode="url" id="social_x" name="social_x" value="<?= e($social['x'] ?? '') ?>" placeholder="https://x.com/kullanici">
    </div>
    <div class="field">
      <label class="field-label" for="social_email">Herkese açık e-posta</label>
      <input class="input" type="email" inputmode="email" id="social_email" name="social_email" value="<?= e($social['email'] ?? '') ?>" placeholder="merhaba@shivassai.com">
    </div>
  </fieldset>

  <div class="sticky bottom-[76px] z-20 flex gap-3 rounded-full border border-line-2 bg-[var(--nav-bg)] p-2 backdrop-blur-xl lg:bottom-4">
    <button type="submit" class="btn btn-primary flex-1">Kaydet</button>
  </div>
</form>

<div class="a-card mt-8 lg:hidden">
  <p class="micro mb-3">Tema</p>
  <?= \App\Services\View::partial('partials/theme-switch') ?>
</div>
