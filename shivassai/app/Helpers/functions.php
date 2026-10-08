<?php

declare(strict_types=1);

use App\Services\Config;
use App\Services\Csrf;
use App\Services\HttpException;
use App\Services\I18n;
use App\Services\SecurityHeaders;
use App\Services\View;

/** HTML-escape for text and attribute contexts. */
function e(mixed $value): string
{
    return htmlspecialchars((string) $value, ENT_QUOTES | ENT_SUBSTITUTE | ENT_HTML5, 'UTF-8');
}

/** @param array<string, string|int> $replace */
function t(string $key, array $replace = []): string
{
    return I18n::get($key, $replace);
}

function config(string $key, mixed $default = null): mixed
{
    return Config::get($key, $default);
}

function is_https(): bool
{
    return (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (($_SERVER['SERVER_PORT'] ?? null) == 443)
        || str_starts_with((string) Config::get('app.url', ''), 'https://') && PHP_SAPI !== 'cli-server';
}

function request_path(): string
{
    $path = (string) parse_url((string) ($_SERVER['REQUEST_URI'] ?? '/'), PHP_URL_PATH);
    return '/' . trim($path, '/');
}

function absolute_url(string $path): string
{
    if (preg_match('#^https?://#i', $path)) {
        return $path;
    }
    $path = '/' . ltrim($path, '/');
    return rtrim((string) Config::get('app.url'), '/') . ($path === '/' ? '/' : $path);
}

/** Static asset URL with a cache-busting version derived from the file mtime. */
function asset(string $path): string
{
    $path = '/assets/' . ltrim($path, '/');
    $file = APP_ROOT . '/public' . $path;
    return is_file($file) ? $path . '?v=' . substr(md5((string) filemtime($file)), 0, 8) : $path;
}

function nonce(): string
{
    return SecurityHeaders::nonce();
}

function csrf_token(): string
{
    return Csrf::token();
}

function csrf_field(): string
{
    return '<input type="hidden" name="_csrf" value="' . e(Csrf::token()) . '">';
}

function redirect(string $to, int $status = 303): never
{
    header('Location: ' . $to, true, $status);
    exit;
}

function abort(int $status): never
{
    throw new HttpException($status);
}

/** @param array<string, mixed> $data */
function view(string $template, array $data = [], ?string $layout = 'layouts/site'): string
{
    return View::render($template, $data, $layout);
}

function input(string $key, string $default = ''): string
{
    $value = $_POST[$key] ?? $_GET[$key] ?? $default;
    return is_string($value) ? trim($value) : $default;
}

function client_ip(): string
{
    return (string) ($_SERVER['REMOTE_ADDR'] ?? '0.0.0.0');
}

/** Turkish-aware slug: "Sokak Oyunları" -> "sokak-oyunlari" */
function slugify(string $text): string
{
    $map = ['ç' => 'c', 'Ç' => 'c', 'ğ' => 'g', 'Ğ' => 'g', 'ı' => 'i', 'İ' => 'i', 'ö' => 'o', 'Ö' => 'o', 'ş' => 's', 'Ş' => 's', 'ü' => 'u', 'Ü' => 'u', 'â' => 'a', 'Â' => 'a', 'î' => 'i', 'û' => 'u'];
    $text = strtr($text, $map);
    $text = mb_strtolower($text);
    $text = preg_replace('/[^a-z0-9]+/', '-', $text) ?? '';
    return trim($text, '-');
}

function format_date(?string $date, bool $short = false): string
{
    if ($date === null || $date === '') {
        return '';
    }
    $ts = strtotime($date);
    if ($ts === false) {
        return '';
    }
    $months = explode(',', t('date.months'));
    $month = $months[(int) date('n', $ts) - 1] ?? date('m', $ts);
    return $short ? $month . ' ' . date('Y', $ts) : date('j', $ts) . ' ' . $month . ' ' . date('Y', $ts);
}

function format_bytes(int $bytes): string
{
    $units = ['B', 'KB', 'MB', 'GB'];
    $i = 0;
    $value = (float) $bytes;
    while ($value >= 1024 && $i < count($units) - 1) {
        $value /= 1024;
        $i++;
    }
    return ($i === 0 ? (string) $bytes : number_format($value, 1, ',', '.')) . ' ' . $units[$i];
}

/** @return array<string, string> */
function project_categories(): array
{
    return [
        'oyun'       => t('category.oyun'),
        'web'        => t('category.web'),
        'yapay-zeka' => t('category.yapay-zeka'),
        'otomasyon'  => t('category.otomasyon'),
    ];
}

/** @return array<string, string> */
function project_statuses(): array
{
    return [
        'gelistiriliyor' => t('status.gelistiriliyor'),
        'yayinda'        => t('status.yayinda'),
        'arsiv'          => t('status.arsiv'),
    ];
}

function setting(string $key, string $default = ''): string
{
    return \App\Models\Setting::get($key, $default);
}

/** Split a comma/newline separated string into a clean list. @return array<int, string> */
function split_list(string $value): array
{
    $items = preg_split('/[,\n]+/u', $value) ?: [];
    return array_values(array_unique(array_filter(array_map('trim', $items), static fn (string $s): bool => $s !== '')));
}

/** Only allow http(s) URLs (or empty) for admin-entered links. */
function clean_url(string $url): string
{
    $url = trim($url);
    if ($url === '') {
        return '';
    }
    return filter_var($url, FILTER_VALIDATE_URL) && preg_match('#^https?://#i', $url) ? $url : '';
}
