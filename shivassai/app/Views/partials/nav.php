<?php
/** @var string $active */
$links = [
    'projects' => ['/projeler', t('nav.projects')],
    'buildlog' => ['/build-log', t('nav.buildlog')],
    'about'    => ['/hakkimda', t('nav.about')],
];
?>
<header class="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-4 md:pt-5" data-nav>
  <nav class="nav-pill pointer-events-auto w-full max-w-[640px] justify-between md:w-auto md:justify-start" aria-label="Ana menü">
    <a href="/" class="mr-2 flex items-center py-1 text-fg md:mr-5" aria-label="shivassai — <?= e(t('nav.home')) ?>">
      <?= \App\Services\View::partial('partials/logo', ['size' => 22]) ?>
    </a>

    <div class="hidden items-center md:flex">
      <?php foreach ($links as $key => [$href, $label]): ?>
        <a href="<?= e($href) ?>" class="nav-link"<?= $active === $key ? ' aria-current="page"' : '' ?>><?= e($label) ?></a>
      <?php endforeach; ?>
    </div>

    <div class="flex items-center gap-1 md:ml-3">
      <button type="button" class="icon-btn" data-theme-cycle aria-label="<?= e(t('theme.label')) ?>" title="<?= e(t('theme.label')) ?>">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="8" cy="8" r="6.25" stroke="currentColor" stroke-width="1.3"/><path d="M8 1.75a6.25 6.25 0 0 1 0 12.5z" fill="currentColor"/></svg>
      </button>
      <a href="/iletisim" class="btn btn-primary btn-sm hidden md:inline-flex"<?= $active === 'contact' ? ' aria-current="page"' : '' ?>><?= e(t('nav.contact')) ?></a>
      <button type="button" class="icon-btn md:hidden" data-menu-open aria-expanded="false" aria-controls="mobile-menu" aria-label="<?= e(t('nav.menu')) ?>">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true"><path d="M2 6.5h14M2 11.5h14" stroke="currentColor" stroke-width="1.4"/></svg>
      </button>
    </div>
  </nav>
</header>

<div id="mobile-menu" class="fixed inset-0 z-[55] flex flex-col bg-canvas md:hidden" hidden role="dialog" aria-modal="true" aria-label="<?= e(t('nav.menu')) ?>">
  <div class="flex items-center justify-between px-6 pt-6">
    <a href="/" class="text-fg"><?= \App\Services\View::partial('partials/logo', ['size' => 24]) ?></a>
    <button type="button" class="icon-btn border border-line-2" data-menu-close aria-label="<?= e(t('nav.close')) ?>">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 3l10 10M13 3L3 13" stroke="currentColor" stroke-width="1.4"/></svg>
    </button>
  </div>
  <div class="mt-auto px-6 pb-4">
    <p class="micro normal-case mb-6">~/shivassai</p>
    <ul class="space-y-1">
      <?php foreach ($links + ['contact' => ['/iletisim', t('nav.contact')]] as $key => [$href, $label]): ?>
        <li><a href="<?= e($href) ?>" class="block border-t border-line py-4 text-[40px] font-medium leading-none tracking-[-0.04em] <?= $active === $key ? 'text-fg' : 'text-muted' ?>"><?= e($label) ?></a></li>
      <?php endforeach; ?>
    </ul>
  </div>
  <div class="safe-bottom flex items-center justify-between border-t border-line px-6 py-5">
    <?= \App\Services\View::partial('partials/theme-switch') ?>
    <span class="micro">TR</span>
  </div>
</div>
