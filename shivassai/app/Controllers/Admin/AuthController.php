<?php

declare(strict_types=1);

namespace App\Controllers\Admin;

use App\Services\Auth;
use App\Services\Csrf;
use App\Services\RateLimiter;
use App\Services\Session;

final class AuthController
{
    public function showLogin(): string
    {
        if (Auth::check()) {
            redirect('/admin');
        }
        return view('admin/login', [
            'error'    => Session::pullFlash('error'),
            'username' => Session::pullFlash('username', ''),
            'meta'     => ['title' => 'Giriş', 'robots' => 'noindex, nofollow'],
        ], 'layouts/admin-bare');
    }

    public function login(): never
    {
        Csrf::check();
        $username = mb_substr(input('username'), 0, 64);
        $password = (string) ($_POST['password'] ?? '');

        $max = (int) config('security.login_max_attempts', 5);
        $window = (int) config('security.login_window_seconds', 900);
        $ipKey = 'login-ip:' . client_ip();
        $userKey = 'login-user:' . mb_strtolower($username);

        if (RateLimiter::tooMany($ipKey, $max, $window) || RateLimiter::tooMany($userKey, $max, $window)) {
            $wait = (int) ceil(max(RateLimiter::retryAfter($ipKey, $window), RateLimiter::retryAfter($userKey, $window)) / 60);
            Session::flash('error', "Çok fazla başarısız deneme. {$wait} dakika sonra tekrar dene.");
            redirect('/admin/login');
        }

        if ($username === '' || $password === '' || !Auth::attempt($username, $password)) {
            RateLimiter::hit($ipKey, $window);
            RateLimiter::hit($userKey, $window);
            Session::flash('error', 'Kullanıcı adı veya şifre hatalı.');
            Session::flash('username', $username);
            redirect('/admin/login');
        }

        RateLimiter::clear($userKey);
        redirect('/admin');
    }

    public function logout(): never
    {
        Csrf::check();
        Auth::logout();
        redirect('/admin/login');
    }
}
