<?php
// Nearly invisible contour/waveform lines for the hero background (deterministic, no JS).
$paths = [];
for ($i = 0; $i < 26; $i++) {
    $baseY = 40 + $i * 34;
    $amp = 18 + 26 * sin($i / 4.2);
    $d = '';
    for ($x = -20; $x <= 1620; $x += 20) {
        $y = $baseY
            + $amp * sin($x / 210 + $i * 0.35)
            + 14 * sin($x / 87 - $i * 0.6)
            + 40 * exp(-(($x - 1050) ** 2) / 90000) * cos($i / 3);
        $d .= ($d === '' ? 'M' : 'L') . $x . ' ' . round($y, 1);
    }
    $paths[] = $d;
}
?>
<svg class="hero-lines pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
  <g fill="none" stroke="currentColor" stroke-width="1">
    <?php foreach ($paths as $d): ?><path d="<?= $d ?>"/><?php endforeach; ?>
  </g>
</svg>
