<?php
/**
 * shivassai mark: a squared "S" whose top stroke is still being "typed" —
 * the warm accent block is the cursor finishing the line (human + AI building together).
 * @var int|null $size
 * @var bool|null $wordmark
 */
$size = $size ?? 24;
$wordmark = $wordmark ?? true;
?>
<span class="inline-flex items-center gap-2.5">
  <svg class="logo-mark" width="<?= (int) $size ?>" height="<?= (int) $size ?>" viewBox="0 0 32 32" fill="none" aria-hidden="true" focusable="false">
    <path d="M19 8.5H12.5a3.5 3.5 0 0 0-3.5 3.5v.5a3.5 3.5 0 0 0 3.5 3.5h7a3.5 3.5 0 0 1 3.5 3.5v.5a3.5 3.5 0 0 1-3.5 3.5H9" stroke="currentColor" stroke-width="2.6"/>
    <rect x="21" y="7.2" width="2.6" height="2.6" fill="var(--accent)"/>
  </svg>
  <?php if ($wordmark): ?>
    <span class="wordmark" style="font-size: <?= round($size * 0.74, 1) ?>px">shivassai</span>
  <?php endif; ?>
</span>
