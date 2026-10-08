<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Models\BuildLog;
use App\Models\Project;

final class HomeController
{
    public function index(): string
    {
        return view('pages/home', [
            'featured' => Project::featured(3),
            'logs'     => BuildLog::published(3),
            'metrics'  => Project::publishedMetrics(),
            'meta'     => ['title' => '', 'path' => '/'],
            'navHome'  => true,
        ]);
    }
}
