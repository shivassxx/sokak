<?php /** @var array<string, mixed> $log */ ?>
<article class="group relative grid gap-3 border-t border-line py-7 transition-[padding] duration-500 ease-soft md:grid-cols-12 md:items-baseline md:gap-6 md:hover:pl-3">
  <p class="micro tabular md:col-span-2"><?= e(format_date($log['published_at'] ?? null)) ?></p>
  <h3 class="h-sm text-balance md:col-span-6 md:text-[22px]">
    <a href="/build-log/<?= e($log['slug']) ?>" class="after:absolute after:inset-0"><?= e($log['title']) ?></a>
  </h3>
  <p class="micro md:col-span-2"><?= !empty($log['project_title']) && !empty($log['project_published']) ? e($log['project_title']) : '—' ?></p>
  <p class="micro flex items-center justify-between md:col-span-2 md:justify-end md:gap-4">
    <span><?= e(t('buildlog.minutes', ['n' => $log['reading_minutes']])) ?></span>
    <span class="text-fg transition-transform duration-300 group-hover:translate-x-1" aria-hidden="true">→</span>
  </p>
</article>
