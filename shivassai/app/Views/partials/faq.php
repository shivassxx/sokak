<section class="section border-t border-line" aria-labelledby="faq-title">
  <div class="wrap grid gap-12 lg:grid-cols-12">
    <div class="lg:col-span-5">
      <p class="micro reveal"><?= e(t('faq.label')) ?></p>
      <h2 id="faq-title" class="h-lg mt-5 max-w-[12ch] text-balance reveal"><?= e(t('faq.title')) ?></h2>
    </div>
    <div class="lg:col-span-7">
      <?php for ($i = 1; $i <= 6; $i++): ?>
        <details class="acc-item reveal" data-accordion style="--d: <?= $i * 40 ?>ms">
          <summary>
            <span><?= e(t("faq.q{$i}")) ?></span>
            <svg class="acc-chevron" width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M3 5.25L7 9.25l4-4" stroke="currentColor" stroke-width="1.3"/></svg>
          </summary>
          <div class="acc-body"><p><?= e(t("faq.a{$i}")) ?></p></div>
        </details>
      <?php endfor; ?>
    </div>
  </div>
</section>
