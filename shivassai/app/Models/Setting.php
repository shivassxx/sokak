<?php

declare(strict_types=1);

namespace App\Models;

use App\Services\Database;

final class Setting
{
    /** @var array<string, string>|null */
    private static ?array $cache = null;

    public static function get(string $key, string $default = ''): string
    {
        self::$cache ??= self::all();
        return self::$cache[$key] ?? $default;
    }

    /** @return array<string, string> */
    public static function all(): array
    {
        $rows = Database::all('SELECT key, value FROM settings');
        return array_column($rows, 'value', 'key');
    }

    public static function set(string $key, string $value): void
    {
        Database::run(
            'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
            [$key, $value]
        );
        self::$cache = null;
    }
}
