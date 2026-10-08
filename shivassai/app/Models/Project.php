<?php

declare(strict_types=1);

namespace App\Models;

use App\Services\Database;

final class Project
{
    public const FIELDS = [
        'title', 'slug', 'short_description', 'description', 'category', 'status',
        'cover_image', 'gif', 'video', 'video_poster', 'video_autoplay', 'ai_tools',
        'demo_url', 'github_url', 'created_on',
        'story_idea', 'story_prototype', 'story_problem', 'story_solution', 'story_ai', 'story_result',
        'is_featured', 'is_published', 'sort_order',
    ];

    public const STORY = [
        'story_idea'      => 'story.idea',
        'story_prototype' => 'story.prototype',
        'story_problem'   => 'story.problem',
        'story_solution'  => 'story.solution',
        'story_ai'        => 'story.ai',
        'story_result'    => 'story.result',
    ];

    /** @return array<int, array<string, mixed>> */
    public static function published(): array
    {
        return self::withRelations(Database::all('SELECT * FROM projects WHERE is_published = 1 ORDER BY sort_order, id'));
    }

    /** @return array<int, array<string, mixed>> */
    public static function featured(int $limit = 3): array
    {
        return self::withRelations(Database::all(
            'SELECT * FROM projects WHERE is_published = 1 AND is_featured = 1 ORDER BY sort_order, id LIMIT ?',
            [$limit]
        ));
    }

    /** @return array<int, array<string, mixed>> */
    public static function all(): array
    {
        return self::withRelations(Database::all('SELECT * FROM projects ORDER BY sort_order, id'));
    }

    /** @return array<string, mixed>|null */
    public static function find(int $id): ?array
    {
        $row = Database::one('SELECT * FROM projects WHERE id = ?', [$id]);
        return $row === null ? null : self::withRelations([$row])[0];
    }

    /** @return array<string, mixed>|null */
    public static function findBySlug(string $slug, bool $includeDrafts = false): ?array
    {
        $sql = 'SELECT * FROM projects WHERE slug = ?' . ($includeDrafts ? '' : ' AND is_published = 1');
        $row = Database::one($sql, [$slug]);
        return $row === null ? null : self::withRelations([$row])[0];
    }

    /** @return array<int, array{id: int, title: string}> */
    public static function options(): array
    {
        return Database::all('SELECT id, title FROM projects ORDER BY sort_order, id');
    }

    /** @return array{total: int, featured: int, published: int} */
    public static function stats(): array
    {
        $row = Database::one('SELECT COUNT(*) AS total, COALESCE(SUM(is_featured), 0) AS featured, COALESCE(SUM(is_published), 0) AS published FROM projects');
        return ['total' => (int) $row['total'], 'featured' => (int) $row['featured'], 'published' => (int) $row['published']];
    }

    public static function slugExists(string $slug, ?int $exceptId = null): bool
    {
        return (int) Database::value('SELECT COUNT(*) FROM projects WHERE slug = ? AND id != ?', [$slug, $exceptId ?? 0]) > 0;
    }

    /**
     * @param array<string, mixed> $data
     * @param array<int, string> $technologies
     * @param array<int, array{label: string, value: string, context: string, note: string}> $metrics
     */
    public static function save(?int $id, array $data, array $technologies, array $metrics): int
    {
        return (int) Database::transaction(function () use ($id, $data, $technologies, $metrics): int {
            $values = array_map(static fn (string $f): mixed => $data[$f] ?? null, self::FIELDS);
            if ($id === null) {
                $cols = implode(', ', self::FIELDS);
                $marks = implode(', ', array_fill(0, count(self::FIELDS), '?'));
                Database::run("INSERT INTO projects ({$cols}) VALUES ({$marks})", $values);
                $id = Database::lastId();
            } else {
                $set = implode(', ', array_map(static fn (string $f): string => "{$f} = ?", self::FIELDS));
                Database::run("UPDATE projects SET {$set}, updated_at = datetime('now') WHERE id = ?", [...$values, $id]);
            }

            Database::run('DELETE FROM project_technologies WHERE project_id = ?', [$id]);
            foreach (array_values($technologies) as $i => $name) {
                Database::run('INSERT INTO project_technologies (project_id, name, sort_order) VALUES (?, ?, ?)', [$id, $name, $i]);
            }
            Database::run('DELETE FROM project_metrics WHERE project_id = ?', [$id]);
            foreach (array_values($metrics) as $i => $m) {
                Database::run(
                    'INSERT INTO project_metrics (project_id, label, value, context, note, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
                    [$id, $m['label'], $m['value'], $m['context'], $m['note'], $i]
                );
            }
            return $id;
        });
    }

    public static function delete(int $id): void
    {
        Database::run('DELETE FROM projects WHERE id = ?', [$id]);
    }

    public static function toggleFeatured(int $id): void
    {
        Database::run('UPDATE projects SET is_featured = 1 - is_featured WHERE id = ?', [$id]);
    }

    /** Swap sort position with the neighbour above/below. */
    public static function move(int $id, string $direction): void
    {
        $ids = array_map('intval', array_column(Database::all('SELECT id FROM projects ORDER BY sort_order, id'), 'id'));
        $pos = array_search($id, $ids, true);
        if ($pos === false) {
            return;
        }
        $swap = $direction === 'up' ? $pos - 1 : $pos + 1;
        if (!isset($ids[$swap])) {
            return;
        }
        [$ids[$pos], $ids[$swap]] = [$ids[$swap], $ids[$pos]];
        Database::transaction(static function () use ($ids): void {
            foreach ($ids as $i => $pid) {
                Database::run('UPDATE projects SET sort_order = ? WHERE id = ?', [$i + 1, $pid]);
            }
        });
    }

    public static function nextSortOrder(): int
    {
        return (int) Database::value('SELECT COALESCE(MAX(sort_order), 0) + 1 FROM projects');
    }

    /** @return array<int, array<string, mixed>> all metrics of published projects, joined with project title */
    public static function publishedMetrics(): array
    {
        return Database::all(
            'SELECT m.*, p.title AS project_title, p.slug AS project_slug
               FROM project_metrics m JOIN projects p ON p.id = m.project_id
              WHERE p.is_published = 1 ORDER BY p.sort_order, p.id, m.sort_order'
        );
    }

    /**
     * @param array<int, array<string, mixed>> $rows
     * @return array<int, array<string, mixed>>
     */
    private static function withRelations(array $rows): array
    {
        if ($rows === []) {
            return [];
        }
        $ids = array_map(static fn (array $r): int => (int) $r['id'], $rows);
        $marks = implode(',', array_fill(0, count($ids), '?'));
        $tech = Database::all("SELECT project_id, name FROM project_technologies WHERE project_id IN ({$marks}) ORDER BY sort_order", $ids);
        $metrics = Database::all("SELECT * FROM project_metrics WHERE project_id IN ({$marks}) ORDER BY sort_order", $ids);

        foreach ($rows as &$row) {
            $pid = (int) $row['id'];
            $row['technologies'] = array_values(array_map(
                static fn (array $t): string => (string) $t['name'],
                array_filter($tech, static fn (array $t): bool => (int) $t['project_id'] === $pid)
            ));
            $row['metrics'] = array_values(array_filter($metrics, static fn (array $m): bool => (int) $m['project_id'] === $pid));
            $row['ai_tools_list'] = split_list((string) $row['ai_tools']);
        }
        unset($row);
        return $rows;
    }
}
