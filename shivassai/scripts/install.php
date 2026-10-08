<?php

declare(strict_types=1);

/*
 * php scripts/install.php
 *
 * Creates the SQLite database, tables and indexes, required directories and
 * seeds initial settings + projects. Safe to run more than once: existing
 * content is never overwritten.
 */

if (PHP_SAPI !== 'cli') {
    exit("CLI only.\n");
}

require dirname(__DIR__) . '/app/bootstrap.php';

use App\Models\Project;
use App\Services\Config;
use App\Services\Database;

$dirs = [
    Config::get('paths.storage'),
    Config::get('paths.storage') . '/cache',
    Config::get('paths.storage') . '/logs',
    Config::get('paths.backups'),
    Config::get('paths.uploads'),
];
foreach ($dirs as $dir) {
    if (!is_dir((string) $dir)) {
        mkdir((string) $dir, 0755, true);
        echo "  + dizin: {$dir}\n";
    }
}

$dbFile = (string) Config::get('paths.database');
$fresh = !is_file($dbFile);
$pdo = Database::pdo();
@chmod($dbFile, 0640);

// Migrations
foreach (glob(APP_ROOT . '/database/migrations/*.sql') ?: [] as $file) {
    $name = basename($file);
    $applied = false;
    try {
        $applied = (bool) Database::value('SELECT 1 FROM migrations WHERE name = ?', [$name]);
    } catch (PDOException) {
        // migrations table does not exist yet
    }
    if ($applied) {
        continue;
    }
    $pdo->exec((string) file_get_contents($file));
    Database::run('INSERT INTO migrations (name) VALUES (?)', [$name]);
    echo "  + migration: {$name}\n";
}

$seed = require APP_ROOT . '/database/seeds/seed.php';

// Settings: insert missing keys only.
foreach ($seed['settings'] as $key => $value) {
    Database::run('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', [$key, $value]);
}
foreach ($seed['social_links'] as $link) {
    Database::run('INSERT OR IGNORE INTO social_links (platform, url, sort_order) VALUES (?, ?, ?)', [$link['platform'], $link['url'], $link['sort_order']]);
}

// Projects: only when the slug does not exist yet.
foreach ($seed['projects'] as $p) {
    if (Project::slugExists($p['slug'])) {
        continue;
    }
    $data = array_fill_keys(Project::FIELDS, '');
    $data = array_merge($data, [
        'title'             => $p['title'],
        'slug'              => $p['slug'],
        'short_description' => $p['short_description'],
        'category'          => $p['category'],
        'status'            => $p['status'],
        'cover_image'       => null,
        'gif'               => null,
        'video'             => null,
        'video_poster'      => null,
        'video_autoplay'    => 1,
        'created_on'        => null,
        'is_featured'       => $p['is_featured'],
        'is_published'      => 1,
        'sort_order'        => $p['sort_order'],
    ]);
    Project::save(null, $data, $p['technologies'], []);
    echo "  + proje: {$p['title']}\n";
}

// Sample build log drafts (unpublished, clearly marked).
foreach ($seed['build_logs'] as $log) {
    if ((int) Database::value('SELECT COUNT(*) FROM build_logs WHERE slug = ?', [$log['slug']]) > 0) {
        continue;
    }
    $projectId = $log['project'] ? Database::value('SELECT id FROM projects WHERE slug = ?', [$log['project']]) : null;
    Database::run(
        'INSERT INTO build_logs (title, slug, excerpt, body, project_id, is_published) VALUES (?, ?, ?, ?, ?, 0)',
        [
            $log['title'],
            $log['slug'],
            'ÖRNEK TASLAK — yayınlamadan önce düzenle.',
            "> **ÖRNEK TASLAK.** Bu yazı henüz yazılmadı. Yönetim panelinden içeriği yaz, sonra yayınla.\n",
            $projectId,
        ]
    );
    echo "  + taslak build log: {$log['title']}\n";
}

$admins = (int) Database::value('SELECT COUNT(*) FROM users');
echo $fresh ? "\nVeritabanı oluşturuldu: {$dbFile}\n" : "\nVeritabanı güncel: {$dbFile}\n";
if ($admins === 0) {
    echo "Sıradaki adım: php scripts/create-admin.php\n";
}
