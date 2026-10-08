<?php

declare(strict_types=1);

namespace App\Services;

final class Auth
{
    public static function attempt(string $username, string $password): bool
    {
        $user = Database::one('SELECT id, username, password_hash FROM users WHERE username = ?', [$username]);
        // Verify against a dummy hash when the user does not exist to keep timing similar.
        $hash = $user['password_hash'] ?? '$2y$10$4Qk15S9IFrORLE4.NgYlhuNyrQtqWpzG.3z9HHXQjZdt3L/L6Ow8m';
        if (!password_verify($password, (string) $hash) || $user === null) {
            return false;
        }
        if (password_needs_rehash((string) $hash, PASSWORD_DEFAULT)) {
            Database::run('UPDATE users SET password_hash = ? WHERE id = ?', [password_hash($password, PASSWORD_DEFAULT), $user['id']]);
        }
        Session::regenerate();
        Session::set('user_id', (int) $user['id']);
        Session::set('username', (string) $user['username']);
        Database::run('UPDATE users SET last_login_at = ? WHERE id = ?', [date('c'), $user['id']]);
        return true;
    }

    public static function check(): bool
    {
        Session::start();
        return is_int(Session::get('user_id'));
    }

    public static function username(): string
    {
        return (string) Session::get('username', '');
    }

    public static function logout(): void
    {
        Session::start();
        Session::destroy();
    }

    /** Redirects to the login page when not authenticated. */
    public static function require(): void
    {
        if (!self::check()) {
            redirect('/admin/login');
        }
    }
}
