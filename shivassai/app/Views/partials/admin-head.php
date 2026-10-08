<?php /** @var array<string, mixed> $meta */ ?>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow">
<meta name="csrf-token" content="<?= e(csrf_token()) ?>">
<title><?= e(($meta['title'] ?? 'Panel') . ' — shivassai admin') ?></title>
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<meta name="theme-color" content="#0A0A0A">
<script nonce="<?= e(nonce()) ?>">
  (function(){var d=document.documentElement;d.classList.remove('no-js');var p='dark';try{p=localStorage.getItem('theme')||'dark'}catch(e){}
  var r=p==='system'?(matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'):(p==='light'?'light':'dark');d.setAttribute('data-theme',r);d.setAttribute('data-theme-pref',p);})();
</script>
<link rel="stylesheet" href="<?= e(asset('css/app.css')) ?>">
<script src="<?= e(asset('js/app.js')) ?>" defer></script>
<script src="<?= e(asset('js/admin.js')) ?>" defer></script>
