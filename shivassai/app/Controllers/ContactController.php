<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Models\ContactMessage;
use App\Services\Csrf;
use App\Services\RateLimiter;
use App\Services\Session;

final class ContactController
{
    public function show(): string
    {
        Session::start();
        // Timestamp used to reject forms submitted faster than a human could.
        Session::set('contact_form_at', time());

        return view('pages/contact', [
            'errors' => Session::pullFlash('errors', []),
            'old'    => Session::pullFlash('old', []),
            'sent'   => Session::pullFlash('sent', false),
            'meta'   => ['title' => t('contact.title'), 'description' => t('contact.desc'), 'path' => '/iletisim'],
            'active' => 'contact',
        ]);
    }

    public function submit(): never
    {
        Session::start();
        $name = mb_substr(input('name'), 0, 200);
        $email = mb_substr(input('email'), 0, 200);
        $message = mb_substr(input('message'), 0, 5000);
        $old = ['name' => $name, 'email' => $email, 'message' => $message];

        if (!Csrf::verify(is_string($_POST['_csrf'] ?? null) ? $_POST['_csrf'] : null)) {
            $this->fail(['form' => t('contact.err.csrf')], $old);
        }

        // Honeypot: real visitors never see or fill this field. Pretend success for bots.
        $startedAt = (int) Session::get('contact_form_at', 0);
        if (input('website') !== '' || $startedAt === 0 || time() - $startedAt < 3) {
            Session::flash('sent', true);
            redirect('/iletisim#form');
        }

        $key = 'contact:' . client_ip();
        $max = (int) config('security.contact_max_per_hour', 5);
        if (RateLimiter::tooMany($key, $max, 3600)) {
            $this->fail(['form' => t('contact.err.rate')], $old);
        }

        $errors = [];
        $nameLen = mb_strlen($name);
        if ($nameLen < 2 || $nameLen > 80) {
            $errors['name'] = t('contact.err.name');
        }
        if (!filter_var($email, FILTER_VALIDATE_EMAIL) || mb_strlen($email) > 160) {
            $errors['email'] = t('contact.err.email');
        }
        $msgLen = mb_strlen($message);
        if ($msgLen < 10 || $msgLen > 4000) {
            $errors['message'] = t('contact.err.message');
        }
        if ($errors !== []) {
            $this->fail($errors, $old);
        }

        RateLimiter::hit($key, 3600);
        ContactMessage::create($name, $email, $message);
        Session::forget('contact_form_at');
        Session::flash('sent', true);
        redirect('/iletisim#form');
    }

    /** @param array<string, string> $errors @param array<string, string> $old */
    private function fail(array $errors, array $old): never
    {
        Session::flash('errors', $errors);
        Session::flash('old', $old);
        redirect('/iletisim#form');
    }
}
