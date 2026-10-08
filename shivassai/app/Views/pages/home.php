<?php
/**
 * @var array<int, array<string, mixed>> $featured
 * @var array<int, array<string, mixed>> $logs
 * @var array<int, array<string, mixed>> $metrics
 */
use App\Services\Markdown;
use App\Services\View;

$introParagraphs = array_values(array_filter(array_map('trim', preg_split('/\n\s*\n/', setting('intro_body')) ?: [])));
$stack = [
    ['Claude Code', t('stack.group.ai'),   'Fikirden koda: planlama, yazma, düzeltme.'],
    ['TypeScript',  t('stack.group.web'),  'Büyüyen kod tabanında güven.'],
    ['React',       t('stack.group.web'),  'Arayüzler ve oyun içi paneller.'],
    ['Three.js',    t('stack.group.3d'),   'Tarayıcıda 3D sahneler.'],
    ['WebGL',       t('stack.group.3d'),   'GPU’ya yakın çizim.'],
    ['Node.js',     t('stack.group.back'), 'Sunucular ve araçlar.'],
    ['PHP',         t('stack.group.back'), 'Bu site PHP ile çalışıyor.'],
    ['SQLite',      t('stack.group.back'), 'Dosya tabanlı, sade veri.'],
    ['API’ler',     t('stack.group.back'), 'Servisleri birbirine bağlamak.'],
    ['Git',         t('stack.group.flow'), 'Her adım kayıt altında.'],
];
$metricPlaceholders = ['metrics.build_time', 'metrics.bundle', 'metrics.load', 'metrics.fps', 'metrics.latency', 'metrics.players'];
?>

<!-- HERO -->
<section class="relative flex min-h-[100svh] flex-col overflow-hidden" aria-labelledby="hero-title">
  <?= View::partial('partials/contours') ?>
  <div class="wrap-wide relative flex flex-1 flex-col justify-end pb-10 pt-32 md:pb-12">
    <div class="flex items-end justify-between gap-6">
      <p class="micro reveal" lang="en"><?= e(t('hero.label')) ?></p>
      <p class="micro normal-case hidden reveal md:block">~/shivassai <span class="text-faint">$</span> status <span class="text-fg">building</span><span class="ml-1 inline-block h-2.5 w-1 translate-y-px bg-accent" aria-hidden="true"></span></p>
    </div>

    <h1 id="hero-title" class="display-xxl mt-6 -ml-[0.04em] select-none whitespace-nowrap reveal" style="--d:80ms">
      shivassai<span class="sr-only"> — <?= e(t('hero.sr')) ?></span>
    </h1>

    <div class="mt-12 grid gap-10 border-t border-line pt-8 md:mt-16 md:grid-cols-12 md:gap-6">
      <p class="h-lg md:col-span-7 reveal" style="--d:160ms">
        <span class="dim"><?= e(setting('hero_line_1')) ?></span><br><?= e(setting('hero_line_2')) ?>
      </p>
      <div class="flex items-start justify-between gap-8 md:col-span-5 md:flex-col md:items-end md:justify-between">
        <p class="body max-w-[38ch] md:text-right reveal" style="--d:240ms"><?= e(setting('hero_text')) ?></p>
        <a href="#intro" class="flex flex-col items-center gap-3 text-muted transition-colors hover:text-fg reveal" style="--d:320ms" aria-label="<?= e(t('hero.scroll')) ?>">
          <span class="micro"><?= e(t('hero.scroll')) ?></span>
          <span class="scroll-cue" aria-hidden="true"></span>
        </a>
      </div>
    </div>
  </div>
</section>

<!-- INTRO -->
<section id="intro" class="section" aria-labelledby="intro-title">
  <div class="wrap grid gap-12 lg:grid-cols-12">
    <div class="lg:col-span-5">
      <p class="micro reveal"><?= e(t('intro.label')) ?></p>
      <h2 id="intro-title" class="display mt-6 reveal">
        <span class="dim"><?= e(setting('intro_line_1')) ?></span><br><?= e(setting('intro_line_2')) ?>
      </h2>
    </div>
    <div class="space-y-6 lg:col-span-6 lg:col-start-7 lg:pt-14">
      <?php foreach ($introParagraphs as $i => $p): ?>
        <p class="<?= $i === 0 ? 'text-fg text-[clamp(20px,2vw,26px)] leading-[1.4] tracking-[-0.02em]' : 'lead' ?> text-pretty reveal" style="--d: <?= $i * 80 ?>ms"><?= e($p) ?></p>
      <?php endforeach; ?>
    </div>
  </div>
</section>

<!-- FEATURED PROJECTS -->
<section class="section border-t border-line pt-[clamp(72px,8vw,120px)]" aria-labelledby="featured-title">
  <div class="wrap">
    <div class="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
      <div>
        <p class="micro reveal"><?= e(t('featured.label')) ?></p>
        <h2 id="featured-title" class="h-xl mt-5 max-w-[14ch] reveal"><?= e(t('featured.title')) ?></h2>
      </div>
      <a href="/projeler" class="btn btn-secondary self-start md:self-auto reveal"><?= e(t('featured.all')) ?> <span class="arrow" aria-hidden="true">→</span></a>
    </div>
  </div>

  <div class="mt-16 space-y-[clamp(96px,11vw,160px)] md:mt-24">
    <?php foreach ($featured as $i => $p): ?>
      <?php $num = str_pad((string) ($i + 1), 2, '0', STR_PAD_LEFT); ?>
      <?php if ($i === 0): ?>
        <article class="media-hover group relative">
          <div class="wrap-wide reveal">
            <?= View::partial('partials/project-media', ['project' => $p, 'ratio' => 'ratio-video md:ratio-wide', 'sizes' => '100vw']) ?>
          </div>
          <div class="wrap mt-10 grid gap-8 md:grid-cols-12">
            <div class="md:col-span-5 reveal">
              <p class="micro"><?= $num ?> / <?= e(project_categories()[$p['category']] ?? '') ?></p>
              <h3 class="h-lg mt-4"><a href="/projeler/<?= e($p['slug']) ?>" class="after:absolute after:inset-0"><?= e($p['title']) ?></a></h3>
            </div>
            <p class="lead md:col-span-4 md:pt-9 reveal" style="--d:80ms"><?= e($p['short_description']) ?></p>
            <div class="flex flex-col gap-5 md:col-span-3 md:items-end md:pt-10 reveal" style="--d:160ms">
              <span class="status status-<?= e($p['status']) ?>"><?= e(project_statuses()[$p['status']] ?? '') ?></span>
              <div class="flex flex-wrap gap-2 md:justify-end"><?php foreach ($p['technologies'] as $tech): ?><span class="tag"><?= e($tech) ?></span><?php endforeach; ?></div>
              <span class="relative z-10 inline-flex items-center gap-2 text-[14px] text-fg"><?= e(t('projects.view')) ?> <span class="transition-transform duration-300 group-hover:translate-x-1" aria-hidden="true">→</span></span>
            </div>
          </div>
        </article>
      <?php else: ?>
        <?php $flip = $i % 2 === 0; ?>
        <article class="media-hover group relative">
          <div class="wrap grid items-center gap-10 lg:grid-cols-12 lg:gap-14">
            <div class="lg:col-span-7 <?= $flip ? 'lg:order-2' : '' ?> reveal">
              <?= View::partial('partials/project-media', ['project' => $p, 'ratio' => 'ratio-card', 'sizes' => '(min-width: 1024px) 58vw, 100vw']) ?>
            </div>
            <div class="lg:col-span-5 <?= $flip ? 'lg:order-1' : '' ?>">
              <p class="micro reveal"><?= $num ?> / <?= e(project_categories()[$p['category']] ?? '') ?></p>
              <h3 class="h-lg mt-4 reveal"><a href="/projeler/<?= e($p['slug']) ?>" class="after:absolute after:inset-0"><?= e($p['title']) ?></a></h3>
              <p class="lead mt-6 max-w-[42ch] reveal" style="--d:80ms"><?= e($p['short_description']) ?></p>
              <div class="mt-8 flex flex-wrap gap-2 reveal" style="--d:120ms"><?php foreach ($p['technologies'] as $tech): ?><span class="tag"><?= e($tech) ?></span><?php endforeach; ?></div>
              <div class="mt-10 flex items-center justify-between border-t border-line pt-5 reveal" style="--d:160ms">
                <span class="status status-<?= e($p['status']) ?>"><?= e(project_statuses()[$p['status']] ?? '') ?></span>
                <span class="inline-flex items-center gap-2 text-[14px]"><?= e(t('projects.view')) ?> <span class="transition-transform duration-300 group-hover:translate-x-1" aria-hidden="true">→</span></span>
              </div>
            </div>
          </div>
        </article>
      <?php endif; ?>
    <?php endforeach; ?>
  </div>
</section>

<!-- BUILD LOG -->
<section class="section border-t border-line bg-canvas-2" aria-labelledby="log-title">
  <div class="wrap">
    <div class="grid gap-10 lg:grid-cols-12">
      <div class="lg:col-span-7">
        <p class="micro reveal"><?= e(t('buildlog.label')) ?></p>
        <h2 id="log-title" class="h-xl mt-5 reveal"><span class="dim"><?= e(t('buildlog.title_1')) ?></span> <?= e(t('buildlog.title_2')) ?></h2>
      </div>
      <div class="flex items-end lg:col-span-5 lg:justify-end">
        <a href="/build-log" class="btn btn-secondary reveal"><?= e(t('buildlog.all')) ?> <span class="arrow" aria-hidden="true">→</span></a>
      </div>
    </div>

    <div class="mt-16 md:mt-20">
      <?php if ($logs !== []): ?>
        <div class="border-b border-line">
          <?php foreach ($logs as $log): ?><?= View::partial('partials/log-row', ['log' => $log]) ?><?php endforeach; ?>
        </div>
      <?php else: ?>
        <div class="terminal max-w-2xl p-6 md:p-8 reveal">
          <p><span class="p">~/shivassai/build-log</span></p>
          <p><span class="p">$</span> <span class="c">ls</span></p>
          <p class="mt-2"><?= e(t('buildlog.empty')) ?><span class="ml-1 inline-block h-3 w-1.5 translate-y-0.5 bg-muted" aria-hidden="true"></span></p>
        </div>
      <?php endif; ?>
    </div>
  </div>
</section>

<!-- HOW I BUILD -->
<section class="section" aria-labelledby="how-title">
  <div class="wrap">
    <div class="text-center">
      <p class="micro reveal"><?= e(t('how.label')) ?></p>
      <h2 id="how-title" class="display mx-auto mt-6 max-w-[12ch] reveal"><span class="dim"><?= e(t('how.title_1')) ?></span><br><?= e(t('how.title_2')) ?></h2>
    </div>

    <ol class="mt-20 grid gap-px overflow-hidden rounded-[20px] border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
      <?php for ($s = 1; $s <= 4; $s++): ?>
        <li class="flex min-h-[240px] flex-col justify-between bg-canvas p-7 reveal" style="--d: <?= $s * 60 ?>ms">
          <span class="micro tabular">0<?= $s ?></span>
          <div>
            <h3 class="h-md"><?= e(t("how.step{$s}.t")) ?></h3>
            <p class="body mt-3 text-[15px]"><?= e(t("how.step{$s}.d")) ?></p>
          </div>
        </li>
      <?php endfor; ?>
    </ol>

    <div class="terminal mx-auto mt-10 max-w-3xl overflow-x-auto p-6 md:p-7 reveal" aria-hidden="true">
      <p><span class="p">~/shivassai/projects</span></p>
      <p><span class="p">$</span> <span class="c">claude</span></p>
      <p><span class="p">&gt;</span> fikri anlatıyorum, planı birlikte çıkarıyoruz</p>
      <p><span class="p">const</span> <span class="c">idea</span> = <span class="c">"mahalle oyunları, tarayıcıda"</span>;</p>
      <p><span class="p">$</span> <span class="c">npm run dev</span> <span class="p">#</span> dene · kır · düzelt · tekrar</p>
    </div>
  </div>
</section>

<!-- TECH STACK -->
<section class="section border-t border-line" aria-labelledby="stack-title">
  <div class="wrap grid gap-12 lg:grid-cols-12">
    <div class="lg:col-span-4">
      <div class="lg:sticky lg:top-32">
        <p class="micro reveal"><?= e(t('stack.label')) ?></p>
        <h2 id="stack-title" class="h-lg mt-5 reveal"><?= e(t('stack.title')) ?></h2>
      </div>
    </div>
    <ul class="grid gap-x-12 border-b border-line lg:col-span-8 md:grid-cols-2">
      <?php foreach ($stack as $i => [$name, $group, $desc]): ?>
        <li class="stack-row reveal" style="--d: <?= ($i % 4) * 40 ?>ms">
          <div>
            <p class="text-[22px] font-medium tracking-[-0.025em]"><?= e($name) ?></p>
            <p class="stack-desc mt-1 text-[13px] text-muted"><?= e($desc) ?></p>
          </div>
          <span class="micro shrink-0"><?= e($group) ?></span>
        </li>
      <?php endforeach; ?>
    </ul>
  </div>
</section>

<!-- BUILD METRICS -->
<section class="section border-t border-line bg-canvas-2" aria-labelledby="metrics-title">
  <div class="wrap">
    <div class="grid gap-8 lg:grid-cols-12">
      <div class="lg:col-span-6">
        <p class="micro reveal"><?= e(t('metrics.label')) ?></p>
        <h2 id="metrics-title" class="h-lg mt-5 reveal"><?= e(t('metrics.title')) ?></h2>
      </div>
      <p class="body max-w-[44ch] lg:col-span-5 lg:col-start-8 lg:self-end reveal"><?= e(t('metrics.text')) ?></p>
    </div>

    <div class="mt-16 overflow-x-auto reveal">
      <?php if ($metrics !== []): ?>
        <table class="hair-table min-w-[620px]">
          <thead><tr><th><?= e(t('metrics.project')) ?></th><th><?= e(t('metrics.metric')) ?></th><th><?= e(t('metrics.value')) ?></th><th><?= e(t('metrics.context')) ?></th></tr></thead>
          <tbody>
            <?php foreach ($metrics as $m): ?>
              <tr>
                <td class="text-fg"><a class="link" href="/projeler/<?= e($m['project_slug']) ?>"><?= e($m['project_title']) ?></a></td>
                <td><?= e($m['label']) ?><?php if ($m['note'] !== ''): ?><span class="mt-1 block text-[12px] text-faint"><?= e($m['note']) ?></span><?php endif; ?></td>
                <td class="v tabular"><?= e($m['value']) ?></td>
                <td class="tabular"><?= e($m['context']) ?: '—' ?></td>
              </tr>
            <?php endforeach; ?>
          </tbody>
        </table>
      <?php else: ?>
        <table class="hair-table min-w-[560px]">
          <caption class="micro mb-6 text-left"><?= e(t('metrics.placeholder_note')) ?></caption>
          <thead><tr><th><?= e(t('metrics.metric')) ?></th><th><?= e(t('metrics.value')) ?></th><th><?= e(t('metrics.context')) ?></th></tr></thead>
          <tbody>
            <?php foreach ($metricPlaceholders as $key): ?>
              <tr><td class="text-fg"><?= e(t($key)) ?></td><td class="font-mono text-faint">— <?= e(t('metrics.pending')) ?></td><td>—</td></tr>
            <?php endforeach; ?>
          </tbody>
        </table>
      <?php endif; ?>
    </div>
  </div>
</section>

<!-- ABOUT -->
<section class="section" aria-labelledby="about-title">
  <div class="wrap grid gap-12 lg:grid-cols-12">
    <div class="lg:col-span-5">
      <p class="micro reveal"><?= e(t('about.label')) ?></p>
      <h2 id="about-title" class="display mt-6 reveal"><span class="dim"><?= e(t('about.hello_1')) ?></span><br><?= e(t('about.hello_2')) ?></h2>
    </div>
    <div class="lg:col-span-6 lg:col-start-7 lg:pt-14">
      <div class="prose-shv reveal"><?= Markdown::render(setting('about_bio')) ?></div>
      <div class="panel mt-10 p-6 reveal">
        <p class="micro"><?= e(t('aboutpage.focus')) ?></p>
        <div class="prose-shv mt-3 text-[16px] text-fg"><?= Markdown::render(setting('about_focus')) ?></div>
      </div>
      <a href="/hakkimda" class="btn btn-secondary mt-10 reveal"><?= e(t('about.more')) ?> <span class="arrow" aria-hidden="true">→</span></a>
    </div>
  </div>
</section>

<!-- CTA -->
<section class="border-y border-line bg-canvas-2" aria-labelledby="cta-title">
  <div class="wrap py-[clamp(96px,12vw,170px)] text-center">
    <h2 id="cta-title" class="h-xl mx-auto max-w-[16ch] reveal"><span class="dim"><?= e(t('cta.title_1')) ?></span><br><?= e(t('cta.title_2')) ?></h2>
    <p class="lead mx-auto mt-6 max-w-[40ch] reveal"><?= e(t('cta.text')) ?></p>
    <div class="mt-10 reveal"><?= View::partial('partials/cta-buttons') ?></div>
  </div>
</section>

<?= View::partial('partials/faq') ?>
<?= View::partial('partials/final-cta') ?>
