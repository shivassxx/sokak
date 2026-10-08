<?php
/** @var string $content @var string $section */
$section = $section ?? '';
$unread = \App\Models\ContactMessage::unreadCount();
$items = [
    'dashboard' => ['/admin', 'Panel', 'M3 10.5L10 4l7 6.5V17H3z'],
    'projects'  => ['/admin/projects', 'Projeler', 'M3 4h6v6H3zM11 4h6v6h-6zM3 12h6v5H3zM11 12h6v5h-6z'],
    'buildlog'  => ['/admin/build-log', 'Build Log', 'M4 4h12M4 8h12M4 12h8M4 16h6'],
    'media'     => ['/admin/media', 'Medya', 'M3 4h14v12H3zM3 13l4-4 4 4 2-2 4 4'],
    'settings'  => ['/admin/settings', 'Ayarlar', 'M10 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM10 2v3M10 15v3M2 10h3M15 10h3'],
];
$icon = static fn (string $d): string => '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="' . $d . '" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>';
?>
<!doctype html>
<html lang="tr" data-theme="dark" class="no-js">
<head><?= \App\Services\View::partial('partials/admin-head', ['meta' => $meta ?? []]) ?></head>
<body class="min-h-[100svh] bg-canvas">
  <div class="lg:flex">
    <!-- Desktop sidebar -->
    <aside class="sticky top-0 hidden h-[100svh] w-64 shrink-0 flex-col border-r border-line p-5 lg:flex">
      <a href="/admin" class="mb-8 px-2 pt-1 text-fg"><?= \App\Services\View::partial('partials/logo', ['size' => 22]) ?></a>
      <nav class="flex flex-col gap-1" aria-label="Yönetim">
        <?php foreach ($items as $key => [$href, $label, $d]): ?>
          <a href="<?= e($href) ?>" class="a-nav-link"<?= $section === $key ? ' aria-current="page"' : '' ?>><?= $icon($d) ?><?= e($label) ?></a>
        <?php endforeach; ?>
        <a href="/admin/messages" class="a-nav-link"<?= $section === 'messages' ? ' aria-current="page"' : '' ?>>
          <?= $icon('M3 5h14v10H3zM3 5l7 6 7-6') ?>Mesajlar<?php if ($unread): ?><span class="a-chip a-chip-on ml-auto"><?= $unread ?></span><?php endif; ?>
        </a>
      </nav>
      <div class="mt-auto space-y-4">
        <?= \App\Services\View::partial('partials/theme-switch') ?>
        <div class="flex items-center justify-between px-2">
          <a href="/" class="link-muted text-[13px]" target="_blank" rel="noopener">Siteyi aç ↗</a>
          <form method="post" action="/admin/logout"><?= csrf_field() ?><button class="link-muted text-[13px]" type="submit">Çıkış</button></form>
        </div>
      </div>
    </aside>

    <div class="min-w-0 flex-1">
      <!-- Mobile top bar -->
      <header class="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-[var(--nav-bg)] px-4 py-3 backdrop-blur-xl lg:hidden">
        <a href="/admin" class="text-fg" aria-label="Panel"><?= \App\Services\View::partial('partials/logo', ['size' => 22, 'wordmark' => false]) ?></a>
        <p class="text-[15px] font-medium"><?= e($meta['title'] ?? '') ?></p>
        <div class="flex items-center gap-1">
          <a href="/admin/messages" class="icon-btn relative" aria-label="Mesajlar">
            <?= $icon('M3 5h14v10H3zM3 5l7 6 7-6') ?>
            <?php if ($unread): ?><span class="absolute right-2 top-2 h-2 w-2 rounded-full bg-fg"></span><?php endif; ?>
          </a>
          <form method="post" action="/admin/logout"><?= csrf_field() ?><button class="icon-btn" type="submit" aria-label="Çıkış"><?= $icon('M8 4H4v12h4M12 6l4 4-4 4M16 10H8') ?></button></form>
        </div>
      </header>

      <main class="mx-auto w-full max-w-4xl px-4 pb-32 pt-6 md:px-8 lg:pb-16 lg:pt-10">
        <?= $content ?>
      </main>
    </div>
  </div>

  <!-- Mobile bottom tab bar: one-hand navigation -->
  <nav class="safe-bottom fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-[var(--nav-bg)] backdrop-blur-xl lg:hidden" aria-label="Yönetim">
    <?php foreach ($items as $key => [$href, $label, $d]): ?>
      <a href="<?= e($href) ?>" class="a-tab"<?= $section === $key ? ' aria-current="page"' : '' ?>><?= $icon($d) ?><?= e($label) ?></a>
    <?php endforeach; ?>
  </nav>
</body>
</html>
