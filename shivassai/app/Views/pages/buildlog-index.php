<?php /** @var array<int, array<string, mixed>> $logs @var string|null $tagName */ ?>
<section class="pb-12 pt-40 md:pt-48">
  <div class="wrap grid gap-10 lg:grid-cols-12">
    <div class="lg:col-span-7">
      <p class="micro normal-case reveal">~/shivassai/build-log</p>
      <h1 class="display mt-6 reveal"><?= e(t('buildlog.page_title')) ?></h1>
    </div>
    <p class="lead max-w-[42ch] lg:col-span-5 lg:self-end reveal">
      <span class="text-fg"><?= e(t('buildlog.title_1')) ?></span> <?= e(t('buildlog.title_2')) ?>
    </p>
  </div>
</section>

<section class="pb-[clamp(96px,11vw,160px)]">
  <div class="wrap">
    <?php if ($tagName !== null): ?>
      <div class="mb-8 flex flex-wrap items-center gap-3">
        <span class="pill is-active"><?= e(t('buildlog.tag', ['tag' => $tagName])) ?></span>
        <a href="/build-log" class="link-muted text-[13px]"><?= e(t('buildlog.clear_filter')) ?></a>
      </div>
    <?php endif; ?>

    <?php if ($logs === []): ?>
      <div class="terminal max-w-2xl p-6 md:p-8">
        <p><span class="p">~/shivassai/build-log</span></p>
        <p><span class="p">$</span> <span class="c">ls</span></p>
        <p class="mt-2"><?= e(t('buildlog.empty')) ?></p>
      </div>
    <?php else: ?>
      <?php $first = array_shift($logs); ?>
      <article class="media-hover group relative mb-16 grid gap-10 lg:grid-cols-12 lg:items-end reveal">
        <?php if ($first['cover_image']): ?>
          <div class="lg:col-span-7">
            <?= \App\Services\View::partial('partials/project-media', ['project' => ['title' => $first['title'], 'slug' => $first['slug'], 'cover_image' => $first['cover_image']], 'ratio' => 'ratio-card', 'eager' => true]) ?>
          </div>
        <?php endif; ?>
        <div class="<?= $first['cover_image'] ? 'lg:col-span-5' : 'lg:col-span-9' ?>">
          <p class="micro"><?= e(format_date($first['published_at'])) ?> · <?= e(t('buildlog.minutes', ['n' => $first['reading_minutes']])) ?></p>
          <h2 class="h-lg mt-4 text-balance"><a href="/build-log/<?= e($first['slug']) ?>" class="after:absolute after:inset-0"><?= e($first['title']) ?></a></h2>
          <?php if ($first['excerpt']): ?><p class="lead mt-5"><?= e($first['excerpt']) ?></p><?php endif; ?>
          <div class="relative z-10 mt-6 flex flex-wrap gap-2">
            <?php foreach ($first['tags'] as $tag): ?><a class="tag hover:text-fg" href="/build-log?etiket=<?= e($tag['slug']) ?>">#<?= e($tag['name']) ?></a><?php endforeach; ?>
          </div>
        </div>
      </article>

      <?php if ($logs !== []): ?>
        <div class="border-b border-line">
          <?php foreach ($logs as $log): ?><?= \App\Services\View::partial('partials/log-row', ['log' => $log]) ?><?php endforeach; ?>
        </div>
      <?php endif; ?>
    <?php endif; ?>
  </div>
</section>
