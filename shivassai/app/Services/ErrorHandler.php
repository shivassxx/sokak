<?php

declare(strict_types=1);

namespace App\Services;

final class ErrorHandler
{
    public static function register(): void
    {
        error_reporting(E_ALL);
        ini_set('display_errors', Config::get('app.debug') ? '1' : '0');
        set_error_handler(static function (int $severity, string $message, string $file, int $line): bool {
            if (!(error_reporting() & $severity)) {
                return false;
            }
            throw new \ErrorException($message, 0, $severity, $file, $line);
        });
    }

    public static function log(\Throwable $e): void
    {
        $dir = (string) Config::get('paths.storage') . '/logs';
        if (is_dir($dir) && is_writable($dir)) {
            $line = sprintf("[%s] %s: %s in %s:%d\n", date('c'), $e::class, $e->getMessage(), $e->getFile(), $e->getLine());
            @file_put_contents($dir . '/app-' . date('Y-m') . '.log', $line, FILE_APPEND | LOCK_EX);
        } else {
            error_log($e->getMessage());
        }
    }

    public static function renderHttp(int $status): string
    {
        $status = in_array($status, [403, 404, 405, 419, 429, 500], true) ? $status : 500;
        http_response_code($status);
        try {
            $template = $status === 404 ? 'errors/404' : ($status === 500 ? 'errors/500' : 'errors/generic');
            return View::render($template, [
                'status' => $status,
                'meta'   => ['title' => t('error.' . $status . '.title'), 'robots' => 'noindex'],
            ]);
        } catch (\Throwable $inner) {
            // The layout itself may depend on the DB; fall back to a static page.
            self::log($inner);
            return '<!doctype html><meta charset="utf-8"><title>' . $status . '</title>'
                . '<body style="background:#0A0A0A;color:#fff;font-family:system-ui;display:grid;place-items:center;min-height:100vh;margin:0">'
                . '<div style="text-align:center"><p style="color:#8B8D91;letter-spacing:.12em;font-size:11px">HATA ' . $status . '</p>'
                . '<p style="font-size:28px">Bir şeyler ters gitti.</p><a style="color:#fff" href="/">Ana sayfa</a></div>';
        }
    }
}
