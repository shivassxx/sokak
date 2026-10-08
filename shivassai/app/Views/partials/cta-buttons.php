<?php
/** @var string|null $primary @var string|null $secondary @var string|null $align */
$primary = $primary ?? t('cta.projects');
$secondary = $secondary ?? t('cta.contact');
?>
<div class="flex flex-wrap items-center gap-3 <?= ($align ?? 'center') === 'center' ? 'justify-center' : '' ?>">
  <a href="/projeler" class="btn btn-primary"><?= e($primary) ?> <span class="arrow" aria-hidden="true">→</span></a>
  <a href="/iletisim" class="btn btn-secondary"><?= e($secondary) ?></a>
</div>
