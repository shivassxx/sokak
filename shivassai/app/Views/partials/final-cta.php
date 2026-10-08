<section class="relative overflow-hidden border-t border-line" aria-labelledby="final-cta">
  <div class="grid-texture pointer-events-none absolute inset-0 opacity-60 [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000,transparent)]" aria-hidden="true"></div>
  <div class="wrap relative py-[clamp(120px,16vw,220px)] text-center">
    <p class="micro normal-case reveal">~/shivassai <span class="text-faint">$</span> next</p>
    <h2 id="final-cta" class="display mx-auto mt-8 max-w-[14ch] text-balance reveal">
      <span class="dim"><?= e(t('final.title_1')) ?></span><br><?= e(t('final.title_2')) ?>
    </h2>
    <div class="mt-12 reveal">
      <?= \App\Services\View::partial('partials/cta-buttons', ['primary' => t('final.projects'), 'secondary' => t('final.contact')]) ?>
    </div>
  </div>
</section>
