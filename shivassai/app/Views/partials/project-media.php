<?php
/**
 * Project media object. Priority: video > GIF > cover image > generated placeholder.
 * Videos are lazy: the source is only attached when the element nears the viewport.
 *
 * @var array<string, mixed> $project
 * @var string|null $ratio  ratio-video | ratio-card | ratio-wide
 * @var bool|null $eager
 * @var string|null $sizes
 */
$ratio = $ratio ?? 'ratio-video';
$eager = $eager ?? false;
$sizes = $sizes ?? '(min-width: 1024px) 60vw, 100vw';
$title = (string) $project['title'];
$video = $project['video'] ?? null;
$gif = $project['gif'] ?? null;
$cover = $project['cover_image'] ?? null;
$poster = ($project['video_poster'] ?? null) ?: $cover;

$img = static function (string $path, string $alt, bool $eager, string $sizes): string {
    $m = \App\Models\Media::findByPath($path);
    $attrs = ' src="' . e($path) . '" alt="' . e($alt) . '"';
    if ($m !== null && $m['width']) {
        $attrs .= ' width="' . (int) $m['width'] . '" height="' . (int) $m['height'] . '"';
        if (!empty($m['variant_path'])) {
            $attrs .= ' srcset="' . e($m['variant_path']) . ' 960w, ' . e($path) . ' ' . (int) $m['width'] . 'w" sizes="' . e($sizes) . '"';
        }
    }
    $attrs .= $eager ? ' fetchpriority="high"' : ' loading="lazy"';
    return '<img' . $attrs . ' decoding="async">';
};
?>
<div class="media-frame <?= e($ratio) ?>">
  <?php if ($video): ?>
    <video muted loop playsinline preload="none" aria-label="<?= e($title) ?>"
      data-lazy-video data-autoplay="<?= (int) ($project['video_autoplay'] ?? 1) ?>"
      <?= $poster ? 'poster="' . e($poster) . '"' : '' ?>>
      <source data-src="<?= e($video) ?>" type="<?= str_ends_with((string) $video, '.webm') ? 'video/webm' : 'video/mp4' ?>">
    </video>
  <?php elseif ($gif): ?>
    <?= $img((string) $gif, $title, $eager, $sizes) ?>
  <?php elseif ($cover): ?>
    <?= $img((string) $cover, $title, $eager, $sizes) ?>
  <?php else: ?>
    <?= \App\Services\View::partial('partials/media-placeholder', ['project' => $project]) ?>
  <?php endif; ?>
</div>
