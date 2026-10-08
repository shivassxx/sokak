<?php
/**
 * @var array<string, mixed> $log @var int|null $id @var array<string, string> $errors @var string|null $flash
 * @var array<int, array<string, mixed>> $projects @var array<int, array<string, mixed>> $library
 */
$v = static fn (string $k): string => e($log[$k] ?? '');
$err = static fn (string $k): string => isset($errors[$k]) ? '<p class="field-error">' . e($errors[$k]) . '</p>' : '';
$tagString = implode(', ', array_map(static fn (array $t): string => (string) $t['name'], $log['tags'] ?? []));
?>
<div class="flex items-center justify-between gap-4">
  <div>
    <a href="/admin/build-log" class="micro link-muted">← Build Log</a>
    <h1 class="h-md mt-2"><?= $id === null ? 'Yeni yazı' : e($log['title']) ?></h1>
  </div>
  <?php if ($id !== null): ?>
    <a href="/build-log/<?= $v('slug') ?>" target="_blank" rel="noopener" class="btn btn-secondary btn-sm"><?= !empty($log['is_published']) ? 'Görüntüle' : 'Önizle' ?> ↗</a>
  <?php endif; ?>
</div>

<?php if ($flash): ?><div class="notice mt-5" role="status"><?= e($flash) ?></div><?php endif; ?>
<?php if ($errors): ?><div class="notice mt-5" role="alert">Kaydedilmedi: lütfen işaretli alanları düzelt.</div><?php endif; ?>

<form method="post" action="<?= $id === null ? '/admin/build-log' : '/admin/build-log/' . $id ?>" enctype="multipart/form-data" class="mt-6 space-y-6" data-dirty-guard>
  <?= csrf_field() ?>

  <fieldset class="a-card space-y-5">
    <legend class="micro px-1">Yazı</legend>
    <div class="field">
      <label class="field-label" for="title">Başlık</label>
      <input class="input" id="title" name="title" required maxlength="160" value="<?= $v('title') ?>" data-slug-source>
      <?= $err('title') ?>
    </div>
    <div class="field">
      <label class="field-label" for="slug">Slug</label>
      <div class="flex items-center gap-2"><span class="whitespace-nowrap text-[13px] text-muted">/build-log/</span><input class="input" id="slug" name="slug" maxlength="160" value="<?= $v('slug') ?>" data-slug-target placeholder="otomatik"></div>
      <?= $err('slug') ?>
    </div>
    <div class="field">
      <label class="field-label" for="excerpt">Özet</label>
      <textarea class="input" id="excerpt" name="excerpt" rows="2" maxlength="400"><?= $v('excerpt') ?></textarea>
    </div>
    <div class="field" data-md-editor>
      <div class="flex items-center justify-between gap-3">
        <label class="field-label" for="body">İçerik (Markdown)</label>
        <button type="button" class="pill min-h-[32px] text-[12px]" data-md-toggle>Önizle</button>
      </div>
      <textarea class="input min-h-[360px] font-mono text-[14px]" id="body" name="body" rows="16" data-md-source placeholder="## Başlık&#10;&#10;Metin, **kalın**, `kod`, [bağlantı](https://...)&#10;&#10;```ts&#10;const idea = '...';&#10;```"><?= $v('body') ?></textarea>
      <div class="prose-shv hidden min-h-[200px] rounded-2xl border border-line p-5" data-md-preview></div>
      <p class="text-[12px] text-muted">Desteklenen: başlıklar, kalın/italik, listeler, alıntı, kod blokları, bağlantılar, site içi görseller (<code class="font-mono">![açıklama](/uploads/...)</code>). HTML etiketleri metin olarak gösterilir.</p>
    </div>
  </fieldset>

  <fieldset class="a-card space-y-5">
    <legend class="micro px-1">Bağlam</legend>
    <div class="field">
      <label class="field-label" for="project_id">İlgili proje</label>
      <select class="input" id="project_id" name="project_id">
        <option value="">— Yok —</option>
        <?php foreach ($projects as $p): ?><option value="<?= (int) $p['id'] ?>"<?= (int) ($log['project_id'] ?? 0) === (int) $p['id'] ? ' selected' : '' ?>><?= e($p['title']) ?></option><?php endforeach; ?>
      </select>
    </div>
    <div class="field">
      <label class="field-label" for="tags">Etiketler (virgülle ayır)</label>
      <input class="input" id="tags" name="tags" value="<?= e($tagString) ?>" placeholder="multiplayer, three.js">
    </div>
    <?= \App\Services\View::partial('admin/partials/media-field', [
        'name' => 'cover_image', 'label' => 'Kapak görseli', 'hint' => null, 'value' => $log['cover_image'] ?? null,
        'kinds' => ['image', 'gif'], 'library' => $library, 'error' => $errors['cover_image'] ?? null,
    ]) ?>
  </fieldset>

  <fieldset class="a-card space-y-4">
    <legend class="micro px-1">Yayın</legend>
    <div class="field">
      <label class="field-label" for="published_at">Yayın tarihi</label>
      <input class="input" type="datetime-local" id="published_at" name="published_at" value="<?= $v('published_at') ?>">
      <p class="text-[12px] text-muted">İleri bir tarih seçersen yazı o zamana kadar görünmez.</p>
    </div>
    <label class="check"><input type="checkbox" name="is_published" value="1"<?= !empty($log['is_published']) ? ' checked' : '' ?>> Yayında</label>
  </fieldset>

  <div class="sticky bottom-[76px] z-20 flex gap-3 rounded-full border border-line-2 bg-[var(--nav-bg)] p-2 backdrop-blur-xl lg:bottom-4">
    <button type="submit" class="btn btn-primary flex-1">Kaydet</button>
    <a href="/admin/build-log" class="btn btn-ghost">Vazgeç</a>
  </div>
</form>

<?php if ($id !== null): ?>
  <form method="post" action="/admin/build-log/<?= $id ?>/delete" class="mt-10 border-t border-line pt-6" data-confirm="Bu yazı kalıcı olarak silinsin mi?">
    <?= csrf_field() ?>
    <button type="submit" class="btn btn-secondary btn-sm">Yazıyı sil</button>
  </form>
<?php endif; ?>
