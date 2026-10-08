<section class="relative flex min-h-[86svh] items-end overflow-hidden">
  <?= \App\Services\View::partial('partials/contours') ?>
  <div class="wrap relative pb-20 pt-40">
    <p class="micro normal-case">~/shivassai <span class="text-faint">$</span> cd <?= e(mb_substr(request_path(), 0, 60)) ?></p>
    <p class="display-xxl mt-6 select-none" aria-hidden="true">404</p>
    <div class="mt-10 grid gap-8 border-t border-line pt-8 md:grid-cols-12">
      <h1 class="h-lg md:col-span-6"><?= e(t('error.404.title')) ?></h1>
      <div class="md:col-span-5 md:col-start-8">
        <p class="body"><?= e(t('error.404.text')) ?></p>
        <div class="mt-8"><a href="/" class="btn btn-primary"><?= e(t('error.home')) ?> <span class="arrow" aria-hidden="true">→</span></a></div>
      </div>
    </div>
  </div>
</section>
