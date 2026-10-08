<?php

declare(strict_types=1);

namespace App\Services;

final class Seo
{
    /**
     * Normalises page metadata with sensible defaults.
     *
     * @param array<string, mixed> $meta
     * @return array<string, string>
     */
    public static function build(array $meta): array
    {
        $site = (string) Config::get('app.name', 'shivassai');
        $title = (string) ($meta['title'] ?? '');
        $fullTitle = $title === '' ? $site . ' — ' . t('seo.tagline') : $title . ' — ' . $site;
        $description = self::clip((string) ($meta['description'] ?? t('seo.description')), 160);
        $path = (string) ($meta['path'] ?? request_path());
        $image = (string) ($meta['image'] ?? '/assets/img/og-default.png');

        return [
            'title'       => $fullTitle,
            'og_title'    => $title === '' ? $site : $title,
            'description' => $description,
            'canonical'   => absolute_url($path),
            'image'       => absolute_url($image),
            'type'        => (string) ($meta['type'] ?? 'website'),
            'robots'      => (string) ($meta['robots'] ?? 'index, follow'),
        ];
    }

    public static function clip(string $text, int $length): string
    {
        $text = trim(preg_replace('/\s+/u', ' ', $text) ?? $text);
        return mb_strlen($text) > $length ? rtrim(mb_substr($text, 0, $length - 1)) . '…' : $text;
    }
}
