<?php

declare(strict_types=1);

// PHP built-in dev server: serve existing static files directly, never PHP inside uploads.
if (PHP_SAPI === 'cli-server') {
    $path = (string) parse_url((string) $_SERVER['REQUEST_URI'], PHP_URL_PATH);
    if (preg_match('#^/uploads/.*\.(php\d?|phtml|phar|pht)$#i', $path)) {
        http_response_code(403);
        exit('Forbidden');
    }
    if ($path !== '/' && is_file(__DIR__ . $path)) {
        return false;
    }
}

require dirname(__DIR__) . '/app/bootstrap.php';

use App\Services\Config;
use App\Services\ErrorHandler;
use App\Services\HttpException;
use App\Services\Router;
use App\Services\SecurityHeaders;

SecurityHeaders::send();
ErrorHandler::register();

$router = new Router();
require APP_ROOT . '/routes/web.php';

try {
    $body = $router->dispatch((string) $_SERVER['REQUEST_METHOD'], (string) ($_SERVER['REQUEST_URI'] ?? '/'));
    echo $body;
} catch (HttpException $e) {
    echo ErrorHandler::renderHttp($e->status);
} catch (Throwable $e) {
    ErrorHandler::log($e);
    if (Config::get('app.debug')) {
        http_response_code(500);
        echo '<pre>' . e((string) $e) . '</pre>';
    } else {
        echo ErrorHandler::renderHttp(500);
    }
}
