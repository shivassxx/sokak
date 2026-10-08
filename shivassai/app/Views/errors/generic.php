<?php /** @var int $status */ ?>
<section class="flex min-h-[80svh] items-end">
  <div class="wrap pb-20 pt-40">
    <p class="micro">HTTP <?= (int) $status ?></p>
    <h1 class="h-xl mt-6"><?= e(t('error.' . $status . '.title')) ?></h1>
    <p class="body mt-6 max-w-[48ch]"><?= e(t('error.generic')) ?></p>
    <div class="mt-10 flex flex-wrap gap-3">
      <a href="/" class="btn btn-primary"><?= e(t('error.home')) ?></a>    </div>
  </div>
</section>
