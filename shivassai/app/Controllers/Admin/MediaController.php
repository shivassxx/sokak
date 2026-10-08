<?php

declare(strict_types=1);

namespace App\Controllers\Admin;

use App\Models\Media;
use App\Services\Auth;
use App\Services\Csrf;
use App\Services\Session;
use App\Services\Uploader;

final class MediaController
{
    public function index(): string
    {
        Auth::require();
        $kind = input('tur');
        $kind = in_array($kind, ['image', 'gif', 'video'], true) ? $kind : null;
        return view('admin/media', [
            'items'   => Media::all($kind),
            'kind'    => $kind,
            'flash'   => Session::pullFlash('status'),
            'error'   => Session::pullFlash('error'),
            'meta'    => ['title' => 'Medya'],
            'section' => 'media',
        ], 'layouts/admin');
    }

    public function upload(): never
    {
        Auth::require();
        // An upload larger than post_max_size empties $_POST, including the CSRF token.
        if ($_POST === [] && (int) ($_SERVER['CONTENT_LENGTH'] ?? 0) > 0) {
            Session::flash('error', t('upload.too_large'));
            redirect('/admin/media');
        }
        Csrf::check();

        $files = $this->normalize($_FILES['files'] ?? null);
        $ok = 0;
        $errors = [];
        foreach ($files as $file) {
            try {
                Uploader::store($file);
                $ok++;
            } catch (\RuntimeException $e) {
                $errors[] = mb_substr(basename((string) $file['name']), 0, 60) . ': ' . $e->getMessage();
            }
        }
        if ($ok > 0) {
            Session::flash('status', "{$ok} dosya yüklendi.");
        }
        if ($errors !== []) {
            Session::flash('error', implode(' · ', $errors));
        }
        if ($ok === 0 && $errors === []) {
            Session::flash('error', 'Dosya seçilmedi.');
        }
        redirect('/admin/media');
    }

    public function destroy(string $id): never
    {
        Auth::require();
        Csrf::check();
        $media = Media::find((int) $id) ?? abort(404);
        if (Media::isUsed((string) $media['path'])) {
            Session::flash('error', 'Bu dosya bir projede ya da yazıda kullanılıyor. Önce oradan kaldır.');
            redirect('/admin/media');
        }
        Uploader::delete((string) $media['path']);
        if (!empty($media['variant_path'])) {
            Uploader::delete((string) $media['variant_path']);
        }
        Media::delete((int) $id);
        Session::flash('status', 'Dosya silindi.');
        redirect('/admin/media');
    }

    /** @return array<int, array<string, mixed>> */
    private function normalize(mixed $input): array
    {
        if (!is_array($input) || !isset($input['name'])) {
            return [];
        }
        if (!is_array($input['name'])) {
            return ($input['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE ? [] : [$input];
        }
        $out = [];
        foreach (array_keys($input['name']) as $i) {
            if (($input['error'][$i] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) {
                continue;
            }
            $out[] = [
                'name'     => $input['name'][$i],
                'type'     => $input['type'][$i] ?? '',
                'tmp_name' => $input['tmp_name'][$i],
                'error'    => $input['error'][$i],
                'size'     => $input['size'][$i] ?? 0,
            ];
        }
        return array_slice($out, 0, 20);
    }
}
