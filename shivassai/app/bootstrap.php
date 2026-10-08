<?php

declare(strict_types=1);

use App\Services\Config;
use App\Services\I18n;

define('APP_ROOT', dirname(__DIR__));

// Composer autoload if present, otherwise a tiny PSR-4 loader (no dependencies required).
if (is_file(APP_ROOT . '/vendor/autoload.php')) {
    require APP_ROOT . '/vendor/autoload.php';
} else {
    spl_autoload_register(static function (string $class): void {
        if (!str_starts_with($class, 'App\\')) {
            return;
        }
        $file = APP_ROOT . '/app/' . str_replace('\\', '/', substr($class, 4)) . '.php';
        if (is_file($file)) {
            require $file;
        }
    });
}

require_once APP_ROOT . '/app/Helpers/functions.php';

Config::load(require APP_ROOT . '/config/config.php');
date_default_timezone_set((string) Config::get('app.timezone', 'UTC'));
mb_internal_encoding('UTF-8');
I18n::init((string) Config::get('app.locale', 'tr'), APP_ROOT . '/lang');
