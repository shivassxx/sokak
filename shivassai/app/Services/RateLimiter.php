<?php

declare(strict_types=1);

namespace App\Services;

/**
 * Fixed-window rate limiter stored in SQLite. Keys are hashed so raw IPs are not stored.
 */
final class RateLimiter
{
    public static function tooMany(string $key, int $max, int $windowSeconds): bool
    {
        $row = self::row($key);
        if ($row === null || (int) $row['window_start'] + $windowSeconds < time()) {
            return false;
        }
        return (int) $row['hits'] >= $max;
    }

    public static function hit(string $key, int $windowSeconds): void
    {
        $hash = self::hash($key);
        $now = time();
        $row = self::row($key);
        if ($row === null || (int) $row['window_start'] + $windowSeconds < $now) {
            Database::run(
                'INSERT INTO rate_limits (key_hash, hits, window_start) VALUES (?, 1, ?)
                 ON CONFLICT(key_hash) DO UPDATE SET hits = 1, window_start = excluded.window_start',
                [$hash, $now]
            );
            return;
        }
        Database::run('UPDATE rate_limits SET hits = hits + 1 WHERE key_hash = ?', [$hash]);
    }

    public static function clear(string $key): void
    {
        Database::run('DELETE FROM rate_limits WHERE key_hash = ?', [self::hash($key)]);
    }

    public static function retryAfter(string $key, int $windowSeconds): int
    {
        $row = self::row($key);
        return $row === null ? 0 : max(0, (int) $row['window_start'] + $windowSeconds - time());
    }

    /** @return array<string, mixed>|null */
    private static function row(string $key): ?array
    {
        return Database::one('SELECT hits, window_start FROM rate_limits WHERE key_hash = ?', [self::hash($key)]);
    }

    private static function hash(string $key): string
    {
        return hash('sha256', $key);
    }
}
