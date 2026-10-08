<?php

declare(strict_types=1);

namespace App\Models;

use App\Services\Database;

final class Media
{
    /** @var array<string, array<string, mixed>|null> */
    private static array $byPath = [];

    /** @param array<string, mixed> $data @return array<string, mixed> */
    public static function create(array $data): array
    {
        Database::run(
            'INSERT INTO media (path, variant_path, original_name, mime, kind, size, width, height) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [$data['path'], $data['variant_path'], $data['original_name'], $data['mime'], $data['kind'], $data['size'], $data['width'], $data['height']]
        );
        return (array) self::find(Database::lastId());
    }

    /** @return array<string, mixed>|null */
    public static function find(int $id): ?array
    {
        return Database::one('SELECT * FROM media WHERE id = ?', [$id]);
    }

    /** @return array<string, mixed>|null */
    public static function findByPath(?string $path): ?array
    {
        if ($path === null || $path === '') {
            return null;
        }
        if (!array_key_exists($path, self::$byPath)) {
            self::$byPath[$path] = Database::one('SELECT * FROM media WHERE path = ?', [$path]);
        }
        return self::$byPath[$path];
    }

    /** @return array<int, array<string, mixed>> */
    public static function all(?string $kind = null): array
    {
        if ($kind !== null) {
            return Database::all('SELECT * FROM media WHERE kind = ? ORDER BY id DESC', [$kind]);
        }
        return Database::all('SELECT * FROM media ORDER BY id DESC');
    }

    public static function count(): int
    {
        return (int) Database::value('SELECT COUNT(*) FROM media');
    }

    public static function delete(int $id): void
    {
        Database::run('DELETE FROM media WHERE id = ?', [$id]);
    }

    /** Whether a media path is used by any project or build log. */
    public static function isUsed(string $path): bool
    {
        return (int) Database::value(
            'SELECT (SELECT COUNT(*) FROM projects WHERE ? IN (cover_image, gif, video, video_poster))
                  + (SELECT COUNT(*) FROM build_logs WHERE cover_image = ?)',
            [$path, $path]
        ) > 0;
    }
}
