<?php
/**
 * @var array<string, mixed> $project @var int|null $id @var array<string, string> $errors
 * @var string|null $flash @var array<int, array<string, mixed>> $library @var array<string, array<int, string>> $fields
 */
use App\Models\Project;
use App\Services\View;

$v = static fn (string $k): string => e($project[$k] ?? '');
$err = static fn (string $k): string => isset($errors[$k]) ? '<p class="field-error">' . e($errors[$k]) . '</p>' : '';
$metricsText = implode("\n", array_map(
    static fn (array $m): string => rtrim(implode(' | ', [$m['label'], $m['value'], $m['context'], $m['note']]), ' |'),
    $project['metrics'] ?? []
));
$mediaLabels = [
    'cover_image'  => ['Kapak görseli', 'JPG, PNG, WebP veya GIF. Önerilen 1600×900.'],
    'gif'          => ['GIF', 'Kartlarda kapak yerine gösterilir.'],
    'video'        => ['Video (MP4/WebM)', 'Kısa, sessiz döngü. Varsa her şeyin önüne geçer.'],
    'video_poster' => ['Video poster görseli', 'Video yüklenene kadar gösterilir.'],
];
?>
<div class="flex items-center justify-between gap-4">
  <div>
    <a href="/admin/projects" class="micro link-muted">← Projeler</a>
    <h1 class="h-md mt-2"><?= $id === null ? 'Yeni proje' : e($project['title']) ?></h1>
  </div>
  <?php if ($id !== null): ?>
    <a href="/projeler/<?= $v('slug') ?>" target="_blank" rel="noopener" class="btn btn-secondary btn-sm"><?= $project['is_published'] ? 'Görüntüle' : 'Önizle' ?> ↗</a>
  <?php endif; ?>
</div>

<?php if ($flash): ?><div class="notice mt-5" role="status"><?= e($flash) ?></div><?php endif; ?>
<?php if ($errors): ?><div class="notice mt-5" role="alert">Kaydedilmedi: lütfen işaretli alanları düzelt.</div><?php endif; ?>

<form method="post" action="<?= $id === null ? '/admin/projects' : '/admin/projects/' . $id ?>" enctype="multipart/form-data" class="mt-6 space-y-6" data-dirty-guard>
  <?= csrf_field() ?>

  <fieldset class="a-card space-y-5">
    <legend class="micro px-1">Temel bilgiler</legend>
    <div class="field">
      <label class="field-label" for="title">Başlık</label>
      <input class="input" id="title" name="title" required maxlength="120" value="<?= $v('title') ?>" data-slug-source>
      <?= $err('title') ?>
    </div>
    <div class="field">
      <label class="field-label" for="slug">Slug (adres)</label>
      <div class="flex items-center gap-2"><span class="whitespace-nowrap text-[13px] text-muted">/projeler/</span><input class="input" id="slug" name="slug" maxlength="120" value="<?= $v('slug') ?>" data-slug-target placeholder="otomatik"></div>
      <?= $err('slug') ?>
    </div>
    <div class="field">
      <label class="field-label" for="short_description">Kısa açıklama</label>
      <textarea class="input" id="short_description" name="short_description" rows="3" maxlength="300"><?= $v('short_description') ?></textarea>
    </div>
    <div class="grid gap-5 sm:grid-cols-3">
      <div class="field">
        <label class="field-label" for="category">Kategori</label>
        <select class="input" id="category" name="category">
          <?php foreach (project_categories() as $k => $label): ?><option value="<?= e($k) ?>"<?= ($project['category'] ?? '') === $k ? ' selected' : '' ?>><?= e($label) ?></option><?php endforeach; ?>
        </select>
      </div>
      <div class="field">
        <label class="field-label" for="status">Durum</label>
        <select class="input" id="status" name="status">
          <?php foreach (project_statuses() as $k => $label): ?><option value="<?= e($k) ?>"<?= ($project['status'] ?? '') === $k ? ' selected' : '' ?>><?= e($label) ?></option><?php endforeach; ?>
        </select>
      </div>
      <div class="field">
        <label class="field-label" for="created_on">Başlangıç tarihi</label>
        <input class="input" type="date" id="created_on" name="created_on" value="<?= $v('created_on') ?>">
      </div>
    </div>
  </fieldset>

  <fieldset class="a-card space-y-6">
    <legend class="micro px-1">Medya</legend>
    <?php foreach ($fields as $name => $kinds): ?>
      <?= View::partial('admin/partials/media-field', [
          'name' => $name, 'label' => $mediaLabels[$name][0], 'hint' => $mediaLabels[$name][1], 'value' => $project[$name] ?? null,
          'kinds' => $kinds, 'library' => $library, 'error' => $errors[$name] ?? null,
      ]) ?>
    <?php endforeach; ?>
    <label class="check"><input type="checkbox" name="video_autoplay" value="1"<?= !empty($project['video_autoplay']) ? ' checked' : '' ?>> Videoyu otomatik oynat (kapalıysa masaüstünde üzerine gelince oynar)</label>
  </fieldset>

  <fieldset class="a-card space-y-5">
    <legend class="micro px-1">Detaylar</legend>
    <div class="field">
      <label class="field-label" for="technologies">Teknolojiler (virgülle ayır)</label>
      <input class="input" id="technologies" name="technologies" value="<?= e(implode(', ', $project['technologies'] ?? [])) ?>" placeholder="Three.js, TypeScript">
    </div>
    <div class="field">
      <label class="field-label" for="ai_tools">Kullanılan AI araçları (virgülle ayır)</label>
      <input class="input" id="ai_tools" name="ai_tools" value="<?= $v('ai_tools') ?>" placeholder="Claude Code">
    </div>
    <div class="grid gap-5 sm:grid-cols-2">
      <div class="field">
        <label class="field-label" for="demo_url">Demo URL</label>
        <input class="input" type="url" id="demo_url" name="demo_url" value="<?= $v('demo_url') ?>" placeholder="https://" inputmode="url">
        <?= $err('demo_url') ?>
      </div>
      <div class="field">
        <label class="field-label" for="github_url">GitHub URL</label>
        <input class="input" type="url" id="github_url" name="github_url" value="<?= $v('github_url') ?>" placeholder="https://github.com/..." inputmode="url">
        <?= $err('github_url') ?>
      </div>
    </div>
    <div class="field" data-md-editor>
      <div class="flex items-center justify-between">
        <label class="field-label" for="description">Proje hakkında / geliştirme hikâyesi (Markdown)</label>
        <button type="button" class="pill min-h-[32px] text-[12px]" data-md-toggle>Önizle</button>
      </div>
      <textarea class="input min-h-[220px] font-mono text-[14px]" id="description" name="description" rows="10" data-md-source><?= $v('description') ?></textarea>
      <div class="prose-shv hidden rounded-2xl border border-line p-5" data-md-preview></div>
    </div>
  </fieldset>

  <fieldset class="a-card space-y-5">
    <legend class="micro px-1">Nasıl yaptım? (boş bırakılan bölümler gösterilmez)</legend>
    <?php foreach (Project::STORY as $field => $labelKey): ?>
      <div class="field">
        <label class="field-label" for="<?= e($field) ?>"><?= e(t($labelKey)) ?></label>
        <textarea class="input font-mono text-[14px]" id="<?= e($field) ?>" name="<?= e($field) ?>" rows="3"><?= $v($field) ?></textarea>
      </div>
    <?php endforeach; ?>
  </fieldset>

  <fieldset class="a-card space-y-3">
    <legend class="micro px-1">Build Metrics (sadece gerçek ölçümler)</legend>
    <p class="text-[13px] text-muted">Her satıra bir ölçüm: <code class="font-mono text-fg">Etiket | Değer | Bağlam | Not</code><br>Örn: <code class="font-mono">Bundle boyutu | 420 KB | gzip | v0.3 build</code></p>
    <textarea class="input font-mono text-[14px]" name="metrics" rows="4" placeholder="Etiket | Değer | Bağlam | Not"><?= e($metricsText) ?></textarea>
  </fieldset>

  <fieldset class="a-card space-y-3">
    <legend class="micro px-1">Yayın</legend>
    <label class="check"><input type="checkbox" name="is_published" value="1"<?= !empty($project['is_published']) ? ' checked' : '' ?>> Yayında (herkese açık)</label>
    <label class="check"><input type="checkbox" name="is_featured" value="1"<?= !empty($project['is_featured']) ? ' checked' : '' ?>> Ana sayfada öne çıkar</label>
    <div class="field pt-2">
      <label class="field-label" for="sort_order">Sıra</label>
      <input class="input w-32" type="number" id="sort_order" name="sort_order" value="<?= (int) ($project['sort_order'] ?? 0) ?>">
    </div>
  </fieldset>

  <div class="sticky bottom-[76px] z-20 flex gap-3 rounded-full border border-line-2 bg-[var(--nav-bg)] p-2 backdrop-blur-xl lg:bottom-4">
    <button type="submit" class="btn btn-primary flex-1">Kaydet</button>
    <a href="/admin/projects" class="btn btn-ghost">Vazgeç</a>
  </div>
</form>

<?php if ($id !== null): ?>
  <form method="post" action="/admin/projects/<?= $id ?>/delete" class="mt-10 border-t border-line pt-6" data-confirm="Bu proje kalıcı olarak silinsin mi?">
    <?= csrf_field() ?>
    <button type="submit" class="btn btn-secondary btn-sm">Projeyi sil</button>
  </form>
<?php endif; ?>
