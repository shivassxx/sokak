<?php

declare(strict_types=1);

namespace App\Controllers\Admin;

use App\Models\ContactMessage;
use App\Services\Auth;
use App\Services\Csrf;
use App\Services\Session;

final class MessageController
{
    public function index(): string
    {
        Auth::require();
        $messages = ContactMessage::all();
        ContactMessage::markAllRead();
        return view('admin/messages', [
            'messages' => $messages,
            'flash'    => Session::pullFlash('status'),
            'meta'     => ['title' => 'Mesajlar'],
            'section'  => 'messages',
        ], 'layouts/admin');
    }

    public function destroy(string $id): never
    {
        Auth::require();
        Csrf::check();
        ContactMessage::delete((int) $id);
        Session::flash('status', 'Mesaj silindi.');
        redirect('/admin/messages');
    }
}
