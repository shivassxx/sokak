<?php
/** @var array<int, array<string, mixed>> $projects @var string $category @var string $status */
$visible = array_filter($projects, static fn (array $p): bool =>
    ($category === '' || $p['category'] === $category) && ($status === '' || $p['status'] === $status));
?>
<section class="pb-10 pt-40 md:pt-48">
  <div class="wrap">
    <p class="micro normal-case reveal">~/shivassai/projeler</p>
    <h1 class="display mt-6 reveal"><?= e(t('projects.title')) ?></h1>
    <p class="lead mt-8 max-w-[46ch] reveal"><?= e(t('projects.lead')) ?></p>
  </div>
</section>

<section class="pb-[clamp(96px,11vw,160px)]" aria-label="<?= e(t('projects.title')) ?>">
  <div class="wrap">
    <form method="get" action="/projeler" class="sticky top-[84px] z-20 -mx-2 mb-12 flex flex-col gap-4 rounded-[22px] border border-line bg-[var(--nav-bg)] p-3 backdrop-blur-xl md:top-24 md:flex-row md:items-center md:justify-between" data-filters>
      <div class="flex gap-2 overflow-x-auto [scrollbar-width:none]" role="group" aria-label="<?= e(t('projects.filter_category')) ?>">
        <button type="submit" name="kategori" value="" class="pill shrink-0" data-filter-category="" aria-pressed="<?= $category === '' ? 'true' : 'false' ?>"><?= e(t('projects.filter_all')) ?></button>
        <?php foreach (project_categories() as $key => $label): ?>
          <button type="submit" name="kategori" value="<?= e($key) ?>" class="pill shrink-0" data-filter-category="<?= e($key) ?>" aria-pressed="<?= $category === $key ? 'true' : 'false' ?>"><?= e($label) ?></button>
        <?php endforeach; ?>
      </div>
      <div class="flex items-center justify-between gap-3 px-1 md:justify-end">
        <span class="micro tabular" data-filter-count data-template="<?= e(t('projects.count')) ?>" aria-live="polite"><?= e(t('projects.count', ['n' => count($visible)])) ?></span>
        <label class="sr-only" for="durum"><?= e(t('projects.filter_status')) ?></label>
        <select id="durum" name="durum" class="input min-h-[36px] w-auto rounded-full py-1.5 pl-4 text-[13px]" data-filter-status>
          <option value=""><?= e(t('projects.any_status')) ?></option>
          <?php foreach (project_statuses() as $key => $label): ?>
            <option value="<?= e($key) ?>"<?= $status === $key ? ' selected' : '' ?>><?= e($label) ?></option>
          <?php endforeach; ?>
        </select>
        <?php if ($category !== ''): ?><input type="hidden" name="kategori" value="<?= e($category) ?>" data-filter-hidden><?php endif; ?>
        <noscript><button type="submit" class="btn btn-secondary btn-sm">OK</button></noscript>
      </div>
    </form>

    <div class="grid gap-x-10 gap-y-20 md:grid-cols-2" data-project-grid>
      <?php foreach ($projects as $p): ?>
        <?php $show = ($category === '' || $p['category'] === $category) && ($status === '' || $p['status'] === $status); ?>
        <div class="reveal"<?= $show ? '' : ' hidden' ?> data-project-wrap data-category="<?= e($p['category']) ?>" data-status="<?= e($p['status']) ?>">
          <?= \App\Services\View::partial('partials/project-card', ['project' => $p]) ?>
        </div>
      <?php endforeach; ?>
    </div>
    <p class="body py-20 text-center" data-filter-empty<?= $visible === [] ? '' : ' hidden' ?>><?= e(t('projects.empty')) ?></p>
  </div>
</section>

<?= \App\Services\View::partial('partials/final-cta') ?>
