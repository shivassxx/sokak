<?php
/**
 * @var array<string, mixed> $project
 * @var array<int, array<string, mixed>> $logs
 * @var array<string, mixed>|null $next
 * @var bool $isPreview
 * @var string $bodyHtml
 */
use App\Models\Project;
use App\Services\Markdown;
use App\Services\View;

$story = [];
foreach (Project::STORY as $field => $labelKey) {
    if (trim((string) $project[$field]) !== '') {
        $story[] = [t($labelKey), Markdown::render((string) $project[$field])];
    }
}
$facts = array_filter([
    t('project.status')   => '<span class="status status-' . e($project['status']) . '">' . e(project_statuses()[$project['status']] ?? '') . '</span>',
    t('project.category') => e(project_categories()[$project['category']] ?? ''),
    t('project.created')  => $project['created_on'] ? e(format_date($project['created_on'])) : null,
    t('project.ai_tools') => $project['ai_tools_list'] ? e(implode(', ', $project['ai_tools_list'])) : null,
]);
// Show the GIF as an extra media object when a video is the primary media.
$extraGif = $project['video'] && $project['gif'] ? $project['gif'] : null;
?>
<?php if ($isPreview): ?>
  <div class="fixed inset-x-0 bottom-0 z-40 border-t border-line-2 bg-surface px-5 py-3 text-center text-[13px] text-fg"><?= e(t('project.preview')) ?></div>
<?php endif; ?>

<article>
  <header class="pb-12 pt-40 md:pt-48">
    <div class="wrap">
      <a href="/projeler" class="micro link-muted reveal">← <?= e(t('project.back')) ?></a>
      <h1 class="display mt-8 text-balance reveal"><?= e($project['title']) ?></h1>
      <div class="mt-10 grid gap-10 md:grid-cols-12">
        <p class="lead text-fg md:col-span-7 reveal" style="--d:80ms"><?= e($project['short_description']) ?></p>
        <div class="flex flex-wrap items-start gap-3 md:col-span-5 md:justify-end reveal" style="--d:160ms">
          <?php if ($project['demo_url']): ?><a href="<?= e($project['demo_url']) ?>" class="btn btn-primary" rel="noopener" target="_blank"><?= e(t('project.demo')) ?> <span class="arrow" aria-hidden="true">↗</span></a><?php endif; ?>
          <?php if ($project['github_url']): ?><a href="<?= e($project['github_url']) ?>" class="btn btn-secondary" rel="noopener" target="_blank"><?= e(t('project.github')) ?> <span class="arrow" aria-hidden="true">↗</span></a><?php endif; ?>
        </div>
      </div>
    </div>
  </header>

  <div class="wrap-wide reveal">
    <?= View::partial('partials/project-media', ['project' => $project, 'ratio' => 'ratio-video', 'eager' => true, 'sizes' => '100vw']) ?>
  </div>

  <section class="section-sm">
    <div class="wrap grid gap-14 lg:grid-cols-12">
      <aside class="lg:col-span-4">
        <dl class="lg:sticky lg:top-32">
          <?php foreach ($facts as $label => $value): ?>
            <div class="flex items-baseline justify-between gap-6 border-t border-line py-4">
              <dt class="micro"><?= e($label) ?></dt>
              <dd class="text-right text-[14px] text-fg"><?= $value ?></dd>
            </div>
          <?php endforeach; ?>
          <?php if ($project['technologies']): ?>
            <div class="border-y border-line py-4">
              <dt class="micro"><?= e(t('project.tech')) ?></dt>
              <dd class="mt-4 flex flex-wrap gap-2"><?php foreach ($project['technologies'] as $tech): ?><span class="tag"><?= e($tech) ?></span><?php endforeach; ?></dd>
            </div>
          <?php endif; ?>
        </dl>
      </aside>

      <div class="lg:col-span-7 lg:col-start-6">
        <?php if (trim((string) $project['description']) !== ''): ?>
          <h2 class="micro mb-6"><?= e(t('project.about')) ?></h2>
          <div class="prose-shv reveal"><?= $bodyHtml ?></div>
        <?php endif; ?>

        <?php if ($extraGif): ?>
          <div class="mt-14 reveal">
            <?= View::partial('partials/project-media', ['project' => ['title' => $project['title'], 'slug' => $project['slug'], 'gif' => $extraGif], 'ratio' => 'ratio-video']) ?>
          </div>
        <?php endif; ?>

        <section class="<?= trim((string) $project['description']) !== '' ? 'mt-20' : '' ?>" aria-labelledby="story-title">
          <h2 id="story-title" class="h-lg reveal"><?= e(t('project.story')) ?></h2>
          <?php if ($story !== []): ?>
            <ol class="mt-10">
              <?php foreach ($story as $i => [$label, $html]): ?>
                <li class="relative grid gap-4 border-t border-line py-8 md:grid-cols-[140px_1fr] reveal">
                  <div class="flex items-center gap-3 md:flex-col md:items-start">
                    <span class="micro tabular"><?= str_pad((string) ($i + 1), 2, '0', STR_PAD_LEFT) ?></span>
                    <h3 class="text-[15px] font-medium text-fg"><?= e($label) ?></h3>
                  </div>
                  <div class="prose-shv text-[16px]"><?= $html ?></div>
                </li>
              <?php endforeach; ?>
            </ol>
          <?php else: ?>
            <div class="terminal mt-8 p-6 reveal">
              <p><span class="p">~/projects/<?= e($project['slug']) ?></span></p>
              <p><span class="p">$</span> <span class="c">cat</span> STORY.md</p>
              <p class="mt-1"><?= e(t('project.no_story')) ?></p>
            </div>
          <?php endif; ?>
        </section>

        <?php if ($project['metrics']): ?>
          <section class="mt-20" aria-labelledby="pm-title">
            <h2 id="pm-title" class="micro mb-6"><?= e(t('project.metrics')) ?></h2>
            <div class="overflow-x-auto">
              <table class="hair-table min-w-[480px]">
                <thead><tr><th><?= e(t('metrics.metric')) ?></th><th><?= e(t('metrics.value')) ?></th><th><?= e(t('metrics.context')) ?></th></tr></thead>
                <tbody>
                  <?php foreach ($project['metrics'] as $m): ?>
                    <tr>
                      <td><?= e($m['label']) ?><?php if ($m['note'] !== ''): ?><span class="mt-1 block text-[12px] text-faint"><?= e($m['note']) ?></span><?php endif; ?></td>
                      <td class="v tabular"><?= e($m['value']) ?></td>
                      <td class="tabular"><?= e($m['context']) ?: '—' ?></td>
                    </tr>
                  <?php endforeach; ?>
                </tbody>
              </table>
            </div>
          </section>
        <?php endif; ?>

        <?php if ($logs): ?>
          <section class="mt-20" aria-labelledby="rel-title">
            <h2 id="rel-title" class="micro mb-2"><?= e(t('project.related')) ?></h2>
            <div class="border-b border-line">
              <?php foreach ($logs as $log): ?>
                <a href="/build-log/<?= e($log['slug']) ?>" class="group flex items-baseline justify-between gap-6 border-t border-line py-5">
                  <span class="text-[18px] tracking-[-0.015em]"><?= e($log['title']) ?></span>
                  <span class="micro shrink-0"><?= e(format_date($log['published_at'], true)) ?> <span class="ml-2 inline-block text-fg transition-transform group-hover:translate-x-1">→</span></span>
                </a>
              <?php endforeach; ?>
            </div>
          </section>
        <?php endif; ?>
      </div>
    </div>
  </section>
</article>

<?php if ($next): ?>
  <section class="border-t border-line">
    <a href="/projeler/<?= e($next['slug']) ?>" class="media-hover group block">
      <div class="wrap grid items-center gap-10 py-[clamp(72px,9vw,128px)] md:grid-cols-12">
        <div class="md:col-span-6">
          <p class="micro"><?= e(t('project.next')) ?></p>
          <p class="h-xl mt-5"><?= e($next['title']) ?> <span class="inline-block transition-transform duration-500 group-hover:translate-x-2" aria-hidden="true">→</span></p>
        </div>
        <div class="md:col-span-5 md:col-start-8">
          <?= View::partial('partials/project-media', ['project' => $next, 'ratio' => 'ratio-card', 'sizes' => '40vw']) ?>
        </div>
      </div>
    </a>
  </section>
<?php endif; ?>

<?= View::partial('partials/final-cta') ?>
