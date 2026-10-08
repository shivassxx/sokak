<?php

declare(strict_types=1);

namespace App\Models;

use App\Services\Database;

final class SocialLink
{
    public const PLATFORMS = ['github' => 'GitHub', 'x' => 'X', 'email' => 'E-posta'];

    /** @return array<string, string> platform => url (all, including empty) */
    public static function map(): array
    {
        $rows = Database::all('SELECT platform, url FROM social_links ORDER BY sort_order');
        $map = array_fill_keys(array_keys(self::PLATFORMS), '');
        foreach ($rows as $row) {
            $map[(string) $row['platform']] = (string) $row['url'];
        }
        return $map;
    }

    /** Only links that are set, with a ready-to-use href. @return array<int, array{platform: string, label: string, href: string, display: string}> */
    public static function active(): array
    {
        $out = [];
        foreach (self::map() as $platform => $url) {
            if ($url === '' || !isset(self::PLATFORMS[$platform])) {
                continue;
            }
            $href = $platform === 'email' ? 'mailto:' . $url : $url;
            $display = $platform === 'email' ? $url : preg_replace('#^https?://(www\.)?#', '', rtrim($url, '/'));
            $out[] = ['platform' => $platform, 'label' => self::PLATFORMS[$platform], 'href' => $href, 'display' => (string) $display];
        }
        return $out;
    }

    public static function save(string $platform, string $url): void
    {
        Database::run(
            'INSERT INTO social_links (platform, url, sort_order) VALUES (?, ?, 0)
             ON CONFLICT(platform) DO UPDATE SET url = excluded.url',
            [$platform, $url]
        );
    }
}
