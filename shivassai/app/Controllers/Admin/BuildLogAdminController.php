<?php

declare(strict_types=1);

namespace App\Controllers\Admin;

use App\Models\BuildLog;
use App\Models\Media;
use App\Models\Project;
use App\Services\Auth;
use App\Services\Csrf;
use App\Services\Markdown;
use App\Services\Session;
use App\Services\Uploader;

final class BuildLogAdminController
{
    public function index(): string
    {
        Auth::require();
        return view('admin/buildlog/index', [
            'logs'    => BuildLog::all(),
            'flash'   => Session::pullFlash('status'),
            'meta'    => ['title' => 'Build Log'],
            'section' => 'buildlog',
        ], 'layouts/admin');
    }

    public function create(): string
    {
        Auth::require();
        return $this->form([
            'title' => '', 'slug' => '', 'excerpt' => '', 'body' => '', 'project_id' => input('project'),
            'cover_image' => null, 'published_at' => date('Y-m-d\TH:i'), 'is_published' => 0, 'tags' => [],
        ], null, []);
    }

    public function store(): string
    {
        Auth::require();
        Csrf::check();
        return $this->persist(null);
    }

    public function edit(string $id): string
    {
        Auth::require();
        $log = BuildLog::find((int) $id) ?? abort(404);
        return $this->form($log, (int) $id, [], Session::pullFlash('status'));
    }

    public function update(string $id): string
    {
        Auth::require();
        Csrf::check();
        BuildLog::find((int) $id) ?? abort(404);
        return $this->persist((int) $id);
    }

    public function destroy(string $id): never
    {
        Auth::require();
        Csrf::check();
        BuildLog::delete((int) $id);
        Session::flash('status', 'Yazı silindi.');
        redirect('/admin/build-log');
    }

    /** Returns sanitized HTML for the live Markdown preview. */
    public function preview(): string
    {
        Auth::require();
        Csrf::check();
        header('Content-Type: application/json; charset=utf-8');
        return (string) json_encode(['html' => Markdown::render((string) ($_POST['body'] ?? ''))], JSON_UNESCAPED_UNICODE);
    }

    private function persist(?int $id): string
    {
        $errors = [];
        $data = [
            'title'        => mb_substr(input('title'), 0, 160),
            'slug'         => input('slug'),
            'excerpt'      => mb_substr(input('excerpt'), 0, 400),
            'body'         => (string) ($_POST['body'] ?? ''),
            'project_id'   => (int) input('project_id') ?: null,
            'cover_image'  => null,
            'published_at' => null,
            'is_published' => isset($_POST['is_published']) ? 1 : 0,
        ];

        if ($data['title'] === '') {
            $errors['title'] = 'Başlık gerekli.';
        }
        $data['slug'] = slugify($data['slug'] !== '' ? $data['slug'] : $data['title']);
        if ($data['slug'] === '') {
            $errors['slug'] = 'Geçerli bir slug gerekli.';
        } elseif (BuildLog::slugExists($data['slug'], $id)) {
            $errors['slug'] = 'Bu slug başka bir yazıda kullanılıyor.';
        }
        if ($data['project_id'] !== null && Project::find($data['project_id']) === null) {
            $data['project_id'] = null;
        }

        $published = input('published_at');
        $ts = $published !== '' ? strtotime($published) : false;
        $data['published_at'] = $ts !== false ? date('Y-m-d H:i:s', $ts) : ($data['is_published'] ? date('Y-m-d H:i:s') : null);

        $selected = input('cover_image');
        $file = $_FILES['cover_image_file'] ?? null;
        if (is_array($file) && ($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE) {
            try {
                $media = Uploader::store($file);
                if ($media['kind'] === 'video') {
                    $errors['cover_image'] = 'Kapak için görsel ya da GIF seç.';
                }
                $selected = (string) $media['path'];
            } catch (\RuntimeException $e) {
                $errors['cover_image'] = $e->getMessage();
                $selected = '';
            }
        }
        $media = Media::findByPath($selected);
        if ($media !== null && $media['kind'] !== 'video') {
            $data['cover_image'] = (string) $media['path'];
        }

        $tags = array_slice(array_map(static fn (string $s): string => mb_substr($s, 0, 40), split_list(input('tags'))), 0, 12);

        if ($errors !== []) {
            $view = $data + ['tags' => array_map(static fn (string $n): array => ['name' => $n], $tags)];
            $view['published_at'] = $published;
            return $this->form($view, $id, $errors);
        }

        $newId = BuildLog::save($id, $data, $tags);
        Session::flash('status', $id === null ? 'Yazı oluşturuldu.' : 'Değişiklikler kaydedildi.');
        redirect('/admin/build-log/' . $newId . '/edit');
    }

    /** @param array<string, mixed> $log @param array<string, string> $errors */
    private function form(array $log, ?int $id, array $errors, ?string $flash = null): string
    {
        if (!empty($log['published_at']) && !str_contains((string) $log['published_at'], 'T')) {
            $ts = strtotime((string) $log['published_at']);
            $log['published_at'] = $ts !== false ? date('Y-m-d\TH:i', $ts) : '';
        }
        return view('admin/buildlog/form', [
            'log'      => $log,
            'id'       => $id,
            'errors'   => $errors,
            'flash'    => $flash,
            'projects' => Project::options(),
            'library'  => array_values(array_filter(Media::all(), static fn (array $m): bool => $m['kind'] !== 'video')),
            'meta'     => ['title' => $id === null ? 'Yeni yazı' : 'Yazıyı düzenle'],
            'section'  => 'buildlog',
        ], 'layouts/admin');
    }
}
