<?php /** @var array<string, mixed> $project @var int|null $index */ ?>
<article class="media-hover group relative flex flex-col"
  data-project data-category="<?= e($project['category']) ?>" data-status="<?= e($project['status']) ?>">
  <?= \App\Services\View::partial('partials/project-media', ['project' => $project, 'ratio' => 'ratio-card', 'sizes' => '(min-width: 1024px) 45vw, 100vw']) ?>
  <div class="mt-6 flex items-start justify-between gap-6">
    <div>
      <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span class="status status-<?= e($project['status']) ?>"><?= e(project_statuses()[$project['status']] ?? '') ?></span>
        <span class="micro"><?= e(project_categories()[$project['category']] ?? '') ?></span>
        <?php if (!empty($project['is_featured'])): ?><span class="micro">★ <?= e(t('projects.featured')) ?></span><?php endif; ?>
      </div>
      <h3 class="h-md mt-4">
        <a href="/projeler/<?= e($project['slug']) ?>" class="after:absolute after:inset-0"><?= e($project['title']) ?></a>
      </h3>
      <p class="body mt-3 max-w-[52ch]"><?= e($project['short_description']) ?></p>
    </div>
    <span class="mt-10 hidden shrink-0 text-xl transition-transform duration-300 group-hover:translate-x-1 sm:block" aria-hidden="true">→</span>
  </div>
  <div class="mt-5 flex flex-wrap items-center gap-2">
    <?php foreach ($project['technologies'] as $tech): ?><span class="tag"><?= e($tech) ?></span><?php endforeach; ?>
    <?php if (!empty($project['created_on'])): ?><span class="micro ml-auto tabular"><?= e(format_date($project['created_on'], true)) ?></span><?php endif; ?>
  </div>
</article>
