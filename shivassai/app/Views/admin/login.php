<?php /** @var string|null $error @var string $username */ ?>
<div class="relative flex min-h-[100svh] flex-col justify-center overflow-hidden px-5 py-12">
  <?= \App\Services\View::partial('partials/contours') ?>
  <div class="relative mx-auto w-full max-w-sm">
    <a href="/" class="text-fg"><?= \App\Services\View::partial('partials/logo', ['size' => 28]) ?></a>
    <h1 class="h-md mt-10">Yönetim paneli</h1>
    <p class="body mt-2 text-[14px]">Devam etmek için giriş yap.</p>

    <?php if ($error): ?><div class="notice mt-8" role="alert"><?= e($error) ?></div><?php endif; ?>

    <form method="post" action="/admin/login" class="mt-8 space-y-5">
      <?= csrf_field() ?>
      <div class="field">
        <label class="field-label" for="username">Kullanıcı adı</label>
        <input class="input" id="username" name="username" type="text" required autocomplete="username" autocapitalize="none" spellcheck="false" value="<?= e($username) ?>">
      </div>
      <div class="field">
        <label class="field-label" for="password">Şifre</label>
        <input class="input" id="password" name="password" type="password" required autocomplete="current-password">
      </div>
      <button type="submit" class="btn btn-primary w-full">Giriş yap</button>
    </form>
  </div>
</div>
