<?php
$social = \App\Models\SocialLink::active();
$columns = [
    t('footer.product') => [
        ['/projeler', t('nav.projects')],
        ['/build-log', t('nav.buildlog')],
        ['/hakkimda', t('nav.about')],
    ],
    t('footer.resources') => array_values(array_filter([
        ($gh = array_values(array_filter($social, fn ($s) => $s['platform'] === 'github'))[0] ?? null) ? [$gh['href'], 'GitHub'] : null,
        ['/hakkimda#teknolojiler', t('footer.tech')],
        ['/build-log', t('footer.notes')],
    ])),
    t('footer.connect') => array_merge(
        array_map(fn ($s) => [$s['href'], $s['label']], $social),
        [['/iletisim', t('nav.contact')]]
    ),
    t('footer.legal') => [
        ['/gizlilik', t('footer.privacy')],
        ['/kvkk', t('footer.kvkk')],
        ['/cerezler', t('footer.cookies')],
    ],
];
?>
<footer class="border-t border-line bg-canvas">
  <div class="wrap pb-10 pt-20 md:pt-24">
    <div class="grid gap-14 lg:grid-cols-12">
      <div class="lg:col-span-5">
        <a href="/" class="inline-flex text-fg" aria-label="shivassai"><?= \App\Services\View::partial('partials/logo', ['size' => 30]) ?></a>
        <p class="body mt-6 max-w-[34ch]"><?= e(setting('footer_statement')) ?></p>
        <p class="micro mt-6 flex items-center gap-2">
          <span class="inline-block h-1.5 w-1.5 bg-accent" aria-hidden="true"></span>
          <?= e(setting('location', 'Türkiye')) ?>
        </p>
      </div>
      <nav class="grid grid-cols-2 gap-10 sm:grid-cols-4 lg:col-span-7" aria-label="Footer">
        <?php foreach ($columns as $title => $links): ?>
          <div>
            <p class="micro mb-5"><?= e($title) ?></p>
            <ul class="space-y-3 text-[14px]">
              <?php foreach ($links as [$href, $label]): ?>
                <?php $external = preg_match('#^https?://#', $href); ?>
                <li><a class="link-muted" href="<?= e($href) ?>"<?= $external ? ' rel="me noopener" target="_blank"' : '' ?>><?= e($label) ?></a></li>
              <?php endforeach; ?>
            </ul>
          </div>
        <?php endforeach; ?>
      </nav>
    </div>

    <div class="mt-20 flex flex-col gap-6 border-t border-line pt-8 md:flex-row md:items-center md:justify-between">
      <div class="flex flex-wrap items-center gap-x-6 gap-y-3">
        <span class="micro"><?= e(t('footer.languages')) ?></span>
        <span class="micro text-fg">TR</span>
        <span class="micro">EN · <?= e(t('footer.soon')) ?></span>
        <?= \App\Services\View::partial('partials/theme-switch') ?>
      </div>
      <p class="micro">© <?= date('Y') ?> shivassai · <?= e(t('footer.built')) ?></p>
    </div>
  </div>
</footer>
