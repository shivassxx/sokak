<?php
/** @var string $content @var array<string, mixed> $meta */
$seo = \App\Services\Seo::build($meta ?? []);
$active = $active ?? '';
?>
<!doctype html>
<html lang="<?= e(\App\Services\I18n::locale()) ?>" data-theme="dark" class="no-js">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title><?= e($seo['title']) ?></title>
  <meta name="description" content="<?= e($seo['description']) ?>">
  <meta name="robots" content="<?= e($seo['robots']) ?>">
  <link rel="canonical" href="<?= e($seo['canonical']) ?>">

  <meta property="og:site_name" content="shivassai">
  <meta property="og:locale" content="tr_TR">
  <meta property="og:type" content="<?= e($seo['type']) ?>">
  <meta property="og:title" content="<?= e($seo['og_title']) ?>">
  <meta property="og:description" content="<?= e($seo['description']) ?>">
  <meta property="og:url" content="<?= e($seo['canonical']) ?>">
  <meta property="og:image" content="<?= e($seo['image']) ?>">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="<?= e($seo['og_title']) ?>">
  <meta name="twitter:description" content="<?= e($seo['description']) ?>">
  <meta name="twitter:image" content="<?= e($seo['image']) ?>">

  <meta name="theme-color" content="#0A0A0A" media="(prefers-color-scheme: dark)">
  <meta name="theme-color" content="#F5F5F3" media="(prefers-color-scheme: light)">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="icon" href="/favicon.ico" sizes="32x32">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">

  <script nonce="<?= e(nonce()) ?>">
    (function(){var d=document.documentElement;d.classList.remove('no-js');var p='dark';try{p=localStorage.getItem('theme')||'dark'}catch(e){}
    var r=p==='system'?(matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'):(p==='light'?'light':'dark');d.setAttribute('data-theme',r);d.setAttribute('data-theme-pref',p);})();
  </script>
  <link rel="preload" href="/assets/fonts/Geist-Variable.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="<?= e(asset('css/app.css')) ?>">
  <script src="<?= e(asset('js/app.js')) ?>" defer></script>
</head>
<body class="overflow-x-hidden">
  <a href="#main" class="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] btn btn-primary"><?= e(t('nav.skip')) ?></a>

  <?= \App\Services\View::partial('partials/nav', ['active' => $active]) ?>

  <main id="main">
    <?= $content ?>
  </main>

  <?= \App\Services\View::partial('partials/footer') ?>
</body>
</html>
