<?php

declare(strict_types=1);

namespace App\Controllers\Admin;

use App\Models\Setting;
use App\Models\SocialLink;
use App\Services\Auth;
use App\Services\Csrf;
use App\Services\Session;

final class SettingsController
{
    /** setting key => [label, type, max length] */
    public const FIELDS = [
        'Ana sayfa' => [
            'hero_line_1'  => ['Hero satır 1 (gri)', 'text', 80],
            'hero_line_2'  => ['Hero satır 2 (beyaz)', 'text', 80],
            'hero_text'    => ['Hero açıklama', 'textarea', 300],
            'intro_line_1' => ['Giriş başlık 1 (gri)', 'text', 40],
            'intro_line_2' => ['Giriş başlık 2 (beyaz)', 'text', 40],
            'intro_body'   => ['Giriş metni (paragraflar arasında boş satır)', 'textarea', 3000],
        ],
        'Hakkımda' => [
            'about_bio'          => ['Çağrı kim? (Markdown)', 'markdown', 6000],
            'about_vibe'         => ['Vibe coding nedir? (Markdown)', 'markdown', 6000],
            'about_process'      => ['Nasıl çalışıyorum? (Markdown)', 'markdown', 6000],
            'about_tools'        => ['Kullandığım araçlar (her satıra bir tane)', 'textarea', 1000],
            'about_technologies' => ['Teknolojiler (her satıra bir tane)', 'textarea', 1000],
            'about_focus'        => ['Şu anda ne üzerinde çalışıyorum? (Markdown)', 'markdown', 3000],
        ],
        'Genel' => [
            'location'         => ['Konum', 'text', 60],
            'footer_statement' => ['Footer cümlesi', 'text', 160],
        ],
    ];

    public function edit(): string
    {
        Auth::require();
        return view('admin/settings', [
            'values'  => Setting::all(),
            'social'  => SocialLink::map(),
            'fields'  => self::FIELDS,
            'flash'   => Session::pullFlash('status'),
            'errors'  => Session::pullFlash('errors', []),
            'meta'    => ['title' => 'Ayarlar'],
            'section' => 'settings',
        ], 'layouts/admin');
    }

    public function update(): never
    {
        Auth::require();
        Csrf::check();

        foreach (self::FIELDS as $group) {
            foreach ($group as $key => [, $type, $max]) {
                $raw = $type === 'text' ? input($key) : str_replace("\r\n", "\n", (string) ($_POST[$key] ?? ''));
                Setting::set($key, mb_substr($raw, 0, $max));
            }
        }

        $errors = [];
        foreach (array_keys(SocialLink::PLATFORMS) as $platform) {
            $raw = input('social_' . $platform);
            if ($platform === 'email') {
                $value = $raw === '' || filter_var($raw, FILTER_VALIDATE_EMAIL) ? $raw : '';
            } else {
                $value = clean_url($raw);
            }
            if ($raw !== '' && $value === '') {
                $errors[] = SocialLink::PLATFORMS[$platform] . ': geçersiz değer, kaydedilmedi.';
                continue;
            }
            SocialLink::save($platform, $value);
        }

        Session::flash('status', 'Ayarlar kaydedildi.');
        if ($errors !== []) {
            Session::flash('errors', $errors);
        }
        redirect('/admin/settings');
    }
}
