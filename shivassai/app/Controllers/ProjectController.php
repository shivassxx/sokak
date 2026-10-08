<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Models\BuildLog;
use App\Models\Project;
use App\Services\Auth;
use App\Services\Markdown;

final class ProjectController
{
    public function index(): string
    {
        $category = input('kategori');
        $status = input('durum');
        $category = array_key_exists($category, project_categories()) ? $category : '';
        $status = array_key_exists($status, project_statuses()) ? $status : '';

        return view('pages/projects', [
            'projects' => Project::published(),
            'category' => $category,
            'status'   => $status,
            'meta'     => ['title' => t('projects.title'), 'description' => t('projects.desc'), 'path' => '/projeler'],
            'active'   => 'projects',
        ]);
    }

    public function show(string $slug): string
    {
        $preview = Auth::check();
        $project = Project::findBySlug($slug, $preview);
        if ($project === null) {
            abort(404);
        }

        $all = Project::published();
        $next = null;
        foreach ($all as $i => $p) {
            if ((int) $p['id'] === (int) $project['id']) {
                $next = $all[$i + 1] ?? ((int) $all[0]['id'] !== (int) $project['id'] ? $all[0] : null);
            }
        }

        $image = $project['video_poster'] ?: ($project['cover_image'] ?: null);

        return view('pages/project', [
            'project'   => $project,
            'logs'      => BuildLog::forProject((int) $project['id']),
            'next'      => $next,
            'isPreview' => !$project['is_published'],
            'bodyHtml'  => Markdown::render((string) $project['description']),
            'meta'      => [
                'title'       => (string) $project['title'],
                'description' => (string) $project['short_description'],
                'path'        => '/projeler/' . $project['slug'],
                'image'       => $image,
                'type'        => 'article',
                'robots'      => $project['is_published'] ? 'index, follow' : 'noindex',
            ],
            'active'    => 'projects',
        ]);
    }
}
