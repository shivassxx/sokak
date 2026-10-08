<?php
/**
 * Generated, deterministic technical artwork used until real project media is uploaded.
 * Clearly labelled ("görsel yakında") — never presented as a screenshot.
 * @var array<string, mixed> $project
 */
$slug = (string) $project['slug'];
$seed = crc32($slug);
$rand = static function () use (&$seed): float {
    $seed = ($seed * 1103515245 + 12345) & 0x7fffffff;
    return $seed / 0x7fffffff;
};
$variant = ['project-vanta' => 0, 'sokak-oyunlari' => 1, 'chronosbox' => 2][$slug] ?? crc32($slug . 'v') % 3;
$shapes = '';

if ($variant === 0) {
    // Rings + crosshair: scanning / searching
    $cx = 1050; $cy = 430;
    for ($r = 60; $r <= 900; $r += 56) {
        $shapes .= '<circle cx="' . $cx . '" cy="' . $cy . '" r="' . $r . '" />';
    }
    $shapes .= '<path d="M0 ' . $cy . 'H1600M' . $cx . ' 0V900" />';
    for ($i = 0; $i < 7; $i++) {
        $a = $rand() * M_PI * 2; $d = 120 + $rand() * 520;
        $x = round($cx + cos($a) * $d); $y = round($cy + sin($a) * $d * 0.8);
        $shapes .= '<rect x="' . ($x - 5) . '" y="' . ($y - 5) . '" width="10" height="10" class="solid" />';
        $shapes .= '<path d="M' . $cx . ' ' . $cy . 'L' . $x . ' ' . $y . '" class="thin" />';
    }
} elseif ($variant === 1) {
    // Street plan: blocks and alleys seen from above
    $y = 40;
    while ($y < 900) {
        $h = 70 + (int) ($rand() * 120);
        $x = 40;
        while ($x < 1600) {
            $w = 80 + (int) ($rand() * 220);
            if ($rand() > 0.12) {
                $shapes .= '<rect x="' . $x . '" y="' . $y . '" width="' . $w . '" height="' . $h . '" rx="6" />';
                if ($rand() > 0.7) {
                    $shapes .= '<rect x="' . ($x + 12) . '" y="' . ($y + 12) . '" width="' . max(10, $w - 24) . '" height="' . max(10, $h - 24) . '" rx="3" class="thin" />';
                }
            }
            $x += $w + 22 + (int) ($rand() * 18);
        }
        $y += $h + 22 + (int) ($rand() * 18);
    }
} else {
    // Cell field: a simulated world, density as dot size
    for ($y = 30; $y < 900; $y += 30) {
        for ($x = 30; $x < 1600; $x += 30) {
            $n = sin($x / 170 + $rand() * 0.6) * cos($y / 130) + sin(($x + $y) / 260);
            $r = max(0.0, min(5.0, ($n + 0.6) * 2.4));
            if ($r > 0.6) {
                $shapes .= '<circle cx="' . $x . '" cy="' . $y . '" r="' . round($r, 1) . '" class="solid" />';
            }
        }
    }
}
?>
<div class="media-fill grid-texture bg-canvas-2" role="img" aria-label="<?= e($project['title']) ?> — <?= e(t('media.sample')) ?>">
  <svg class="absolute inset-0 h-full w-full text-fg opacity-[.16]" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <style>.ph *{fill:none;stroke:currentColor;stroke-width:1.2}.ph .solid{fill:currentColor;stroke:none}.ph .thin{stroke-width:.6;stroke-dasharray:4 6}</style>
    <g class="ph"><?= $shapes ?></g>
  </svg>
  <div class="absolute inset-0 bg-gradient-to-t from-canvas-2 via-transparent to-transparent"></div>
  <div class="absolute left-5 top-5 right-5 flex items-start justify-between gap-4 md:left-7 md:top-6 md:right-7">
    <span class="micro normal-case">~/projects/<?= e($slug) ?></span>
    <span class="micro hidden sm:inline"><?= e(t('media.sample')) ?></span>
  </div>
  <div class="absolute bottom-5 left-5 right-5 md:bottom-7 md:left-7 md:right-7">
    <p class="font-mono text-[12px] text-muted"><span class="text-faint">$</span> build --project <?= e($slug) ?><span class="ml-1 inline-block h-3 w-1.5 translate-y-0.5 bg-accent" aria-hidden="true"></span></p>
  </div>
</div>
