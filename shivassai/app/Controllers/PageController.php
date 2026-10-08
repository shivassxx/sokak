<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Models\Project;

final class PageController
{
    public function about(): string
    {
        return view('pages/about', [
            'projects' => Project::published(),
            'meta'     => ['title' => t('aboutpage.title'), 'description' => t('aboutpage.desc'), 'path' => '/hakkimda'],
            'active'   => 'about',
        ]);
    }

    public function privacy(): string
    {
        return $this->legal('privacy', '/gizlilik');
    }

    public function kvkk(): string
    {
        return $this->legal('kvkk', '/kvkk');
    }

    public function cookies(): string
    {
        return $this->legal('cookies', '/cerezler');
    }

    private function legal(string $page, string $path): string
    {
        return view('pages/legal', [
            'page' => $page,
            'meta' => ['title' => t("legal.{$page}.title"), 'path' => $path],
        ]);
    }
}
