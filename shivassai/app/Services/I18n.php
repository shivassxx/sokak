<?php

declare(strict_types=1);

namespace App\Services;

/**
 * Minimal translation layer. UI strings live in lang/{locale}.php as flat
 * dot-keyed arrays. Adding English = adding lang/en.php and switching locale.
 */
final class I18n
{
    private static string $locale = 'tr';
    private static string $fallback = 'tr';
    /** @var array<string, array<string, string>> */
    private static array $strings = [];
    private static string $dir = '';

    public static function init(string $locale, string $dir): void
    {
        self::$dir = $dir;
        self::setLocale($locale);
    }

    public static function setLocale(string $locale): void
    {
        $locale = preg_match('/^[a-z]{2}$/', $locale) ? $locale : self::$fallback;
        self::$locale = is_file(self::$dir . "/{$locale}.php") ? $locale : self::$fallback;
    }

    public static function locale(): string
    {
        return self::$locale;
    }

    /** @param array<string, string|int> $replace */
    public static function get(string $key, array $replace = []): string
    {
        $text = self::table(self::$locale)[$key] ?? self::table(self::$fallback)[$key] ?? $key;
        foreach ($replace as $name => $value) {
            $text = str_replace(':' . $name, (string) $value, $text);
        }
        return $text;
    }

    /** @return array<string, string> */
    private static function table(string $locale): array
    {
        if (!isset(self::$strings[$locale])) {
            $file = self::$dir . "/{$locale}.php";
            self::$strings[$locale] = is_file($file) ? (array) require $file : [];
        }
        return self::$strings[$locale];
    }
}
