<?php

declare(strict_types=1);

namespace App\Models;

use App\Services\Database;
use App\Services\Markdown;

final class BuildLog
{
    private const SELECT = 'SELECT b.*, p.title AS project_title, p.slug AS project_slug, p.is_published AS project_published
                              FROM build_logs b LEFT JOIN projects p ON p.id = b.project_id';

    /** @return array<int, array<string, mixed>> */
    public static function published(?int $limit = null, ?string $tag = null): array
    {
        // Compare against PHP's clock (app timezone), not SQLite's UTC clock.
        $params = [date('Y-m-d H:i:s')];
        $sql = self::SELECT . ' WHERE b.is_published = 1 AND (b.published_at IS NULL OR b.published_at <= ?)';
        if ($tag !== null) {
            $sql .= ' AND b.id IN (SELECT bt.build_log_id FROM build_log_tags bt JOIN tags t ON t.id = bt.tag_id WHERE t.slug = ?)';
            $params[] = $tag;
        }
        $sql .= ' ORDER BY b.published_at DESC, b.id DESC';
        if ($limit !== null) {
            $sql .= ' LIMIT ?';
            $params[] = $limit;
        }
        return self::withTags(Database::all($sql, $params));
    }

    /** @return array<int, array<string, mixed>> */
    public static function forProject(int $projectId): array
    {
        return self::withTags(Database::all(
            self::SELECT . ' WHERE b.is_published = 1 AND (b.published_at IS NULL OR b.published_at <= ?) AND b.project_id = ? ORDER BY b.published_at DESC, b.id DESC',
            [date('Y-m-d H:i:s'), $projectId]
        ));
    }

    /** @return array<int, array<string, mixed>> */
    public static function all(): array
    {
        return self::withTags(Database::all(self::SELECT . ' ORDER BY COALESCE(b.published_at, b.created_at) DESC, b.id DESC'));
    }

    /** @return array<string, mixed>|null */
    public static function find(int $id): ?array
    {
        $row = Database::one(self::SELECT . ' WHERE b.id = ?', [$id]);
        return $row === null ? null : self::withTags([$row])[0];
    }

    /** @return array<string, mixed>|null */
    public static function findBySlug(string $slug, bool $includeDrafts = false): ?array
    {
        $sql = self::SELECT . ' WHERE b.slug = ?' . ($includeDrafts ? '' : ' AND b.is_published = 1 AND (b.published_at IS NULL OR b.published_at <= ?)');
        $row = Database::one($sql, $includeDrafts ? [$slug] : [$slug, date('Y-m-d H:i:s')]);
        return $row === null ? null : self::withTags([$row])[0];
    }

    public static function count(): int
    {
        return (int) Database::value('SELECT COUNT(*) FROM build_logs');
    }

    public static function slugExists(string $slug, ?int $exceptId = null): bool
    {
        return (int) Database::value('SELECT COUNT(*) FROM build_logs WHERE slug = ? AND id != ?', [$slug, $exceptId ?? 0]) > 0;
    }

    /** @param array<string, mixed> $data @param array<int, string> $tags */
    public static function save(?int $id, array $data, array $tags): int
    {
        return (int) Database::transaction(function () use ($id, $data, $tags): int {
            $values = [$data['title'], $data['slug'], $data['excerpt'], $data['body'], $data['project_id'], $data['cover_image'], $data['published_at'], $data['is_published']];
            if ($id === null) {
                Database::run(
                    'INSERT INTO build_logs (title, slug, excerpt, body, project_id, cover_image, published_at, is_published) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                    $values
                );
                $id = Database::lastId();
            } else {
                Database::run(
                    "UPDATE build_logs SET title = ?, slug = ?, excerpt = ?, body = ?, project_id = ?, cover_image = ?, published_at = ?, is_published = ?, updated_at = datetime('now') WHERE id = ?",
                    [...$values, $id]
                );
            }

            Database::run('DELETE FROM build_log_tags WHERE build_log_id = ?', [$id]);
            foreach ($tags as $name) {
                $slug = slugify($name);
                if ($slug === '') {
                    continue;
                }
                Database::run('INSERT INTO tags (name, slug) VALUES (?, ?) ON CONFLICT(slug) DO NOTHING', [$name, $slug]);
                $tagId = (int) Database::value('SELECT id FROM tags WHERE slug = ?', [$slug]);
                Database::run('INSERT OR IGNORE INTO build_log_tags (build_log_id, tag_id) VALUES (?, ?)', [$id, $tagId]);
            }
            Database::run('DELETE FROM tags WHERE id NOT IN (SELECT tag_id FROM build_log_tags)');
            return $id;
        });
    }

    public static function delete(int $id): void
    {
        Database::run('DELETE FROM build_logs WHERE id = ?', [$id]);
        Database::run('DELETE FROM tags WHERE id NOT IN (SELECT tag_id FROM build_log_tags)');
    }

    /**
     * @param array<int, array<string, mixed>> $rows
     * @return array<int, array<string, mixed>>
     */
    private static function withTags(array $rows): array
    {
        if ($rows === []) {
            return [];
        }
        $ids = array_map(static fn (array $r): int => (int) $r['id'], $rows);
        $marks = implode(',', array_fill(0, count($ids), '?'));
        $tags = Database::all(
            "SELECT bt.build_log_id, t.name, t.slug FROM build_log_tags bt JOIN tags t ON t.id = bt.tag_id WHERE bt.build_log_id IN ({$marks}) ORDER BY t.name",
            $ids
        );
        foreach ($rows as &$row) {
            $lid = (int) $row['id'];
            $row['tags'] = array_values(array_filter($tags, static fn (array $t): bool => (int) $t['build_log_id'] === $lid));
            $row['reading_minutes'] = Markdown::readingMinutes((string) $row['body']);
        }
        unset($row);
        return $rows;
    }
}
