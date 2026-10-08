<?php
/** @var array<int, array<string, mixed>> $projects */
use App\Services\Markdown;

$sections = [
    ['kim', t('aboutpage.who'), Markdown::render(setting('about_bio'))],
    ['vibe-coding', t('aboutpage.vibe'), Markdown::render(setting('about_vibe'))],
    ['nasil', t('aboutpage.how'), Markdown::render(setting('about_process'))],
];
$tools = split_list(setting('about_tools'));
$tech = split_list(setting('about_technologies'));
?>
<section class="pb-16 pt-40 md:pt-48">
  <div class="wrap">
    <p class="micro normal-case reveal">~/shivassai/hakkimda</p>
    <h1 class="display mt-6 reveal"><span class="dim"><?= e(t('about.hello_1')) ?></span><br><?= e(t('about.hello_2')) ?></h1>
  </div>
</section>

<?php foreach ($sections as $i => [$id, $title, $html]): ?>
  <section id="<?= e($id) ?>" class="border-t border-line py-[clamp(64px,8vw,112px)]">
    <div class="wrap grid gap-8 lg:grid-cols-12">
      <div class="lg:col-span-4">
        <p class="micro tabular reveal">0<?= $i + 1 ?></p>
        <h2 class="h-md mt-4 reveal"><?= e($title) ?></h2>
      </div>
      <div class="prose-shv lg:col-span-7 lg:col-start-6 reveal"><?= $html ?></div>
    </div>
  </section>
<?php endforeach; ?>

<section id="araclar" class="border-t border-line py-[clamp(64px,8vw,112px)]">
  <div class="wrap grid gap-8 lg:grid-cols-12">
    <div class="lg:col-span-4">
      <p class="micro reveal">04</p>
      <h2 class="h-md mt-4 reveal"><?= e(t('aboutpage.tools')) ?></h2>
    </div>
    <ul class="lg:col-span-7 lg:col-start-6">
      <?php foreach ($tools as $tool): ?>
        <li class="flex items-baseline justify-between border-t border-line py-4 text-[22px] font-medium tracking-[-0.025em] reveal"><?= e($tool) ?><span class="micro">araç</span></li>
      <?php endforeach; ?>
    </ul>
  </div>
</section>

<section id="teknolojiler" class="border-t border-line py-[clamp(64px,8vw,112px)]">
  <div class="wrap grid gap-8 lg:grid-cols-12">
    <div class="lg:col-span-4">
      <p class="micro reveal">05</p>
      <h2 class="h-md mt-4 reveal"><?= e(t('aboutpage.tech')) ?></h2>
    </div>
    <ul class="flex flex-wrap gap-3 lg:col-span-7 lg:col-start-6 reveal">
      <?php foreach ($tech as $item): ?><li class="pill text-[15px] text-fg"><?= e($item) ?></li><?php endforeach; ?>
    </ul>
  </div>
</section>

<section id="simdi" class="border-t border-line py-[clamp(64px,8vw,112px)]">
  <div class="wrap grid gap-8 lg:grid-cols-12">
    <div class="lg:col-span-4">
      <p class="micro reveal">06</p>
      <h2 class="h-md mt-4 reveal"><?= e(t('aboutpage.focus')) ?></h2>
    </div>
    <div class="lg:col-span-7 lg:col-start-6">
      <div class="prose-shv reveal"><?= Markdown::render(setting('about_focus')) ?></div>
      <?php if ($projects): ?>
        <ul class="mt-8 border-b border-line">
          <?php foreach ($projects as $p): ?>
            <li><a href="/projeler/<?= e($p['slug']) ?>" class="group flex items-center justify-between gap-6 border-t border-line py-5">
              <span class="text-[18px] font-medium tracking-[-0.015em]"><?= e($p['title']) ?></span>
              <span class="flex items-center gap-4"><span class="status status-<?= e($p['status']) ?>"><?= e(project_statuses()[$p['status']] ?? '') ?></span><span class="transition-transform group-hover:translate-x-1" aria-hidden="true">→</span></span>
            </a></li>
          <?php endforeach; ?>
        </ul>
      <?php endif; ?>
    </div>
  </div>
</section>

<?= \App\Services\View::partial('partials/final-cta') ?>
