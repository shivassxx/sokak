<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Models\BuildLog;
use App\Models\Project;

final class SeoController
{
    public function sitemap(): string
    {
        $urls = [
            ['loc' => '/', 'priority' => '1.0'],
            ['loc' => '/projeler', 'priority' => '0.9'],
            ['loc' => '/build-log', 'priority' => '0.8'],
            ['loc' => '/hakkimda', 'priority' => '0.7'],
            ['loc' => '/iletisim', 'priority' => '0.5'],
        ];
        foreach (Project::published() as $p) {
            $urls[] = ['loc' => '/projeler/' . $p['slug'], 'priority' => '0.8', 'lastmod' => substr((string) $p['updated_at'], 0, 10)];
        }
        foreach (BuildLog::published() as $l) {
            $urls[] = ['loc' => '/build-log/' . $l['slug'], 'priority' => '0.6', 'lastmod' => substr((string) $l['updated_at'], 0, 10)];
        }

        header('Content-Type: application/xml; charset=utf-8');
        $xml = '<?xml version="1.0" encoding="UTF-8"?>' . "\n" . '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' . "\n";
        foreach ($urls as $u) {
            $xml .= '  <url><loc>' . e(absolute_url($u['loc'])) . '</loc>'
                . (isset($u['lastmod']) ? '<lastmod>' . e($u['lastmod']) . '</lastmod>' : '')
                . '<priority>' . $u['priority'] . '</priority></url>' . "\n";
        }
        return $xml . '</urlset>' . "\n";
    }

    public function robots(): string
    {
        header('Content-Type: text/plain; charset=utf-8');
        return "User-agent: *\nAllow: /\nDisallow: /admin\n\nSitemap: " . absolute_url('/sitemap.xml') . "\n";
    }
}
