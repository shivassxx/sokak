<?php

declare(strict_types=1);

namespace App\Controllers\Admin;

use App\Models\BuildLog;
use App\Models\ContactMessage;
use App\Models\Media;
use App\Models\Project;
use App\Services\Auth;
use App\Services\Database;

final class DashboardController
{
    public function index(): string
    {
        Auth::require();

        $recent = Database::all(
            "SELECT 'project' AS type, id, title, updated_at, is_published FROM projects
             UNION ALL
             SELECT 'log' AS type, id, title, updated_at, is_published FROM build_logs
             ORDER BY updated_at DESC LIMIT 6"
        );

        return view('admin/dashboard', [
            'stats'    => Project::stats(),
            'logCount' => BuildLog::count(),
            'media'    => Media::count(),
            'unread'   => ContactMessage::unreadCount(),
            'recent'   => $recent,
            'meta'     => ['title' => 'Panel'],
            'section'  => 'dashboard',
        ], 'layouts/admin');
    }
}
