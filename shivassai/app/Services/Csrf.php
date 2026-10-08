<?php

declare(strict_types=1);

namespace App\Services;

final class Csrf
{
    public static function token(): string
    {
        Session::start();
        $token = Session::get('_csrf');
        if (!is_string($token) || strlen($token) !== 64) {
            $token = bin2hex(random_bytes(32));
            Session::set('_csrf', $token);
        }
        return $token;
    }

    public static function verify(?string $token): bool
    {
        Session::start();
        $expected = Session::get('_csrf');
        return is_string($expected) && is_string($token) && $token !== '' && hash_equals($expected, $token);
    }

    /** Aborts with 419 when the submitted token is invalid. */
    public static function check(): void
    {
        $token = $_POST['_csrf'] ?? ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? null);
        if (!self::verify(is_string($token) ? $token : null)) {
            throw new HttpException(419, 'CSRF token mismatch');
        }
    }
}
