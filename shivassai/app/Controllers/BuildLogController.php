<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Models\BuildLog;
use App\Services\Auth;
use App\Services\Database;
use App\Services\Markdown;

final class BuildLogController
{
    public function index(): string
    {
        $tag = input('etiket');
        $tag = preg_match('/^[a-z0-9-]{1,60}$/', $tag) ? $tag : null;
        $tagName = $tag !== null ? Database::value('SELECT name FROM tags WHERE slug = ?', [$tag]) : null;

        return view('pages/buildlog-index', [
            'logs'    => BuildLog::published(null, $tagName !== null ? $tag : null),
            'tagName' => $tagName,
            'meta'    => ['title' => t('buildlog.page_title'), 'description' => t('buildlog.page_desc'), 'path' => '/build-log'],
            'active'  => 'buildlog',
        ]);
    }

    public function show(string $slug): string
    {
        $log = BuildLog::findBySlug($slug, Auth::check());
        if ($log === null) {
            abort(404);
        }

        return view('pages/buildlog-show', [
            'log'       => $log,
            'bodyHtml'  => Markdown::render((string) $log['body']),
            'isPreview' => !$log['is_published'],
            'meta'      => [
                'title'       => (string) $log['title'],
                'description' => $log['excerpt'] !== '' ? (string) $log['excerpt'] : Markdown::plain((string) $log['body']),
                'path'        => '/build-log/' . $log['slug'],
                'image'       => $log['cover_image'] ?: null,
                'type'        => 'article',
                'robots'      => $log['is_published'] ? 'index, follow' : 'noindex',
            ],
            'active'    => 'buildlog',
        ]);
    }
}
