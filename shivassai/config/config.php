<?php

declare(strict_types=1);

/*
 * Base configuration. Do NOT put secrets here.
 * Override any value in config/config.local.php (git-ignored), e.g.:
 *
 *   <?php return ['app' => ['url' => 'https://shivassai.com', 'debug' => false]];
 */

$base = [
    'app' => [
        'name'     => 'shivassai',
        'url'      => 'http://localhost:8000', // canonical base URL, no trailing slash
        'env'      => 'production',
        'debug'    => false,
        'locale'   => 'tr',
        'timezone' => 'Europe/Istanbul',
    ],
    'paths' => [
        'root'     => dirname(__DIR__),
        'database' => dirname(__DIR__) . '/storage/database.sqlite',
        'uploads'  => dirname(__DIR__) . '/public/uploads',
        'storage'  => dirname(__DIR__) . '/storage',
        'backups'  => dirname(__DIR__) . '/storage/backups',
    ],
    'session' => [
        'name'     => 'shv_session',
        'lifetime' => 7200, // idle timeout in seconds
    ],
    'uploads' => [
        'max_image_bytes' => 8 * 1024 * 1024,
        'max_video_bytes' => 40 * 1024 * 1024,
    ],
    'security' => [
        'login_max_attempts'   => 5,
        'login_window_seconds' => 900,
        'contact_max_per_hour' => 5,
    ],
];

$localFile = __DIR__ . '/config.local.php';
if (is_file($localFile)) {
    $local = require $localFile;
    if (is_array($local)) {
        $base = array_replace_recursive($base, $local);
    }
}

return $base;
