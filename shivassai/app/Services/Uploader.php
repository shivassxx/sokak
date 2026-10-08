<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\Media;

/**
 * Validates and stores uploaded media. The browser-supplied filename and MIME
 * type are never trusted: the real type is detected with finfo, the extension is
 * derived from that type, and the stored name is random.
 */
final class Uploader
{
    /** detected MIME => [extension, kind] */
    public const ALLOWED = [
        'image/jpeg' => ['jpg', 'image'],
        'image/png'  => ['png', 'image'],
        'image/webp' => ['webp', 'image'],
        'image/gif'  => ['gif', 'gif'],
        'video/mp4'  => ['mp4', 'video'],
        'video/webm' => ['webm', 'video'],
    ];

    private const VARIANT_WIDTH = 960;

    /**
     * @param array<string, mixed> $file one entry of $_FILES
     * @return array<string, mixed> the stored media row
     * @throws \RuntimeException with a user-facing (Turkish) message
     */
    public static function store(array $file): array
    {
        if (!isset($file['error']) || is_array($file['error'])) {
            throw new \RuntimeException(t('upload.invalid'));
        }
        if ($file['error'] === UPLOAD_ERR_INI_SIZE || $file['error'] === UPLOAD_ERR_FORM_SIZE) {
            throw new \RuntimeException(t('upload.too_large'));
        }
        if ($file['error'] !== UPLOAD_ERR_OK || !is_uploaded_file((string) $file['tmp_name'])) {
            throw new \RuntimeException(t('upload.invalid'));
        }

        $tmp = (string) $file['tmp_name'];
        $mime = (string) (new \finfo(FILEINFO_MIME_TYPE))->file($tmp);
        if (!isset(self::ALLOWED[$mime])) {
            throw new \RuntimeException(t('upload.bad_type'));
        }
        [$ext, $kind] = self::ALLOWED[$mime];

        $originalExt = strtolower(pathinfo((string) ($file['name'] ?? ''), PATHINFO_EXTENSION));
        $extAliases = ['jpg' => ['jpg', 'jpeg'], 'png' => ['png'], 'webp' => ['webp'], 'gif' => ['gif'], 'mp4' => ['mp4', 'm4v'], 'webm' => ['webm']];
        if (!in_array($originalExt, $extAliases[$ext], true)) {
            throw new \RuntimeException(t('upload.bad_type'));
        }

        $size = (int) filesize($tmp);
        $max = $kind === 'video'
            ? (int) Config::get('uploads.max_video_bytes')
            : (int) Config::get('uploads.max_image_bytes');
        if ($size <= 0 || $size > $max) {
            throw new \RuntimeException(t('upload.too_large'));
        }

        $width = $height = null;
        if ($kind !== 'video') {
            $info = @getimagesize($tmp);
            if ($info === false) {
                throw new \RuntimeException(t('upload.bad_type'));
            }
            [$width, $height] = [(int) $info[0], (int) $info[1]];
        }

        $dir = rtrim((string) Config::get('paths.uploads'), '/') . '/' . date('Y/m');
        if (!is_dir($dir) && !mkdir($dir, 0755, true) && !is_dir($dir)) {
            throw new \RuntimeException(t('upload.failed'));
        }
        $name = bin2hex(random_bytes(12)) . '.' . $ext;
        $target = $dir . '/' . $name;
        if (!move_uploaded_file($tmp, $target)) {
            throw new \RuntimeException(t('upload.failed'));
        }
        @chmod($target, 0644);

        $relative = '/uploads/' . date('Y/m') . '/' . $name;
        $variant = $kind === 'image' && $width > self::VARIANT_WIDTH
            ? self::makeVariant($target, $mime, (int) $width, (int) $height)
            : null;

        $original = mb_substr(basename((string) ($file['name'] ?? $name)), 0, 160);
        return Media::create([
            'path'          => $relative,
            'variant_path'  => $variant !== null ? '/uploads/' . date('Y/m') . '/' . $variant : null,
            'original_name' => $original,
            'mime'          => $mime,
            'kind'          => $kind,
            'size'          => $size,
            'width'         => $width,
            'height'        => $height,
        ]);
    }

    /** Creates a smaller copy for responsive srcset. Returns the variant filename or null. */
    private static function makeVariant(string $path, string $mime, int $w, int $h): ?string
    {
        if (!function_exists('imagecreatetruecolor')) {
            return null;
        }
        $src = match ($mime) {
            'image/jpeg' => @imagecreatefromjpeg($path),
            'image/png'  => @imagecreatefrompng($path),
            'image/webp' => function_exists('imagecreatefromwebp') ? @imagecreatefromwebp($path) : false,
            default      => false,
        };
        if ($src === false) {
            return null;
        }
        $nw = self::VARIANT_WIDTH;
        $nh = (int) round($h * $nw / $w);
        $dst = imagecreatetruecolor($nw, $nh);
        imagealphablending($dst, false);
        imagesavealpha($dst, true);
        imagecopyresampled($dst, $src, 0, 0, 0, 0, $nw, $nh, $w, $h);

        $info = pathinfo($path);
        $variant = $info['filename'] . '-' . $nw . '.' . $info['extension'];
        $target = $info['dirname'] . '/' . $variant;
        $ok = match ($mime) {
            'image/jpeg' => imagejpeg($dst, $target, 82),
            'image/png'  => imagepng($dst, $target, 7),
            'image/webp' => imagewebp($dst, $target, 82),
            default      => false,
        };
        imagedestroy($src);
        imagedestroy($dst);
        return $ok ? $variant : null;
    }

    public static function delete(string $relativePath): void
    {
        $base = realpath((string) Config::get('paths.uploads'));
        $full = realpath(dirname(APP_ROOT . '/public' . $relativePath)) . '/' . basename($relativePath);
        // Only delete files that really live inside the uploads directory.
        if ($base !== false && str_starts_with($full, $base . '/') && is_file($full)) {
            @unlink($full);
        }
    }
}
