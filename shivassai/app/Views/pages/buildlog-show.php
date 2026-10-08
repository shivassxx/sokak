<?php /** @var array<string, mixed> $log @var string $bodyHtml @var bool $isPreview */ ?>
<?php if ($isPreview): ?>
  <div class="fixed inset-x-0 bottom-0 z-40 border-t border-line-2 bg-surface px-5 py-3 text-center text-[13px] text-fg"><?= e(t('project.preview')) ?></div>
<?php endif; ?>
<article>
  <header class="pb-12 pt-40 md:pt-48">
    <div class="wrap max-w-[1040px]">
      <a href="/build-log" class="micro link-muted">← <?= e(t('buildlog.back')) ?></a>
      <p class="micro mt-10 flex flex-wrap gap-x-3 gap-y-1">
        <span><?= e(format_date($log['published_at'])) ?></span><span class="text-faint">/</span>
        <span><?= e(t('buildlog.minutes', ['n' => $log['reading_minutes']])) ?></span>
        <?php if (!empty($log['project_title']) && !empty($log['project_published'])): ?>
          <span class="text-faint">/</span><a class="link-muted" href="/projeler/<?= e($log['project_slug']) ?>"><?= e($log['project_title']) ?></a>
        <?php endif; ?>
      </p>
      <h1 class="h-xl mt-6 text-balance"><?= e($log['title']) ?></h1>
      <?php if ($log['excerpt']): ?><p class="lead mt-8 max-w-[52ch]"><?= e($log['excerpt']) ?></p><?php endif; ?>
    </div>
  </header>

  <?php if ($log['cover_image']): ?>
    <div class="wrap max-w-[1240px]">
      <?= \App\Services\View::partial('partials/project-media', ['project' => ['title' => $log['title'], 'slug' => $log['slug'], 'cover_image' => $log['cover_image']], 'ratio' => 'ratio-video', 'eager' => true, 'sizes' => '100vw']) ?>
    </div>
  <?php endif; ?>

  <div class="wrap max-w-[1040px] py-16 md:py-20">
    <div class="prose-shv mx-auto"><?= $bodyHtml ?></div>

    <footer class="mx-auto mt-16 max-w-[68ch] border-t border-line pt-8">
      <?php if ($log['tags']): ?>
        <div class="flex flex-wrap gap-2">
          <?php foreach ($log['tags'] as $tag): ?><a class="tag hover:text-fg" href="/build-log?etiket=<?= e($tag['slug']) ?>">#<?= e($tag['name']) ?></a><?php endforeach; ?>
        </div>
      <?php endif; ?>
      <?php if (!empty($log['project_title']) && !empty($log['project_published'])): ?>
        <a href="/projeler/<?= e($log['project_slug']) ?>" class="group mt-8 flex items-center justify-between border-y border-line py-6">
          <span><span class="micro block"><?= e(t('buildlog.related_project')) ?></span><span class="h-sm mt-2 block"><?= e($log['project_title']) ?></span></span>
          <span class="text-xl transition-transform group-hover:translate-x-1" aria-hidden="true">→</span>
        </a>
      <?php endif; ?>
    </footer>
  </div>
</article>
<?= \App\Services\View::partial('partials/final-cta') ?>
