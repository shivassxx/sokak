<?php

declare(strict_types=1);

namespace App\Controllers\Admin;

use App\Models\Media;
use App\Models\Project;
use App\Services\Auth;
use App\Services\Csrf;
use App\Services\Session;
use App\Services\Uploader;

final class ProjectAdminController
{
    /** form field => allowed media kinds */
    private const MEDIA_FIELDS = [
        'cover_image'  => ['image', 'gif'],
        'gif'          => ['gif'],
        'video'        => ['video'],
        'video_poster' => ['image'],
    ];

    public function index(): string
    {
        Auth::require();
        return view('admin/projects/index', [
            'projects' => Project::all(),
            'flash'    => Session::pullFlash('status'),
            'meta'     => ['title' => 'Projeler'],
            'section'  => 'projects',
        ], 'layouts/admin');
    }

    public function create(): string
    {
        Auth::require();
        $project = array_fill_keys(Project::FIELDS, '');
        $project = array_merge($project, [
            'category' => 'oyun', 'status' => 'gelistiriliyor', 'video_autoplay' => 1,
            'is_published' => 0, 'is_featured' => 0, 'sort_order' => Project::nextSortOrder(),
            'technologies' => [], 'metrics' => [],
        ]);
        return $this->form($project, null, []);
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
        $project = Project::find((int) $id) ?? abort(404);
        return $this->form($project, (int) $id, [], Session::pullFlash('status'));
    }

    public function update(string $id): string
    {
        Auth::require();
        Csrf::check();
        Project::find((int) $id) ?? abort(404);
        return $this->persist((int) $id);
    }

    public function destroy(string $id): never
    {
        Auth::require();
        Csrf::check();
        Project::delete((int) $id);
        Session::flash('status', 'Proje silindi.');
        redirect('/admin/projects');
    }

    public function feature(string $id): never
    {
        Auth::require();
        Csrf::check();
        Project::toggleFeatured((int) $id);
        redirect('/admin/projects');
    }

    public function move(string $id): never
    {
        Auth::require();
        Csrf::check();
        Project::move((int) $id, input('direction') === 'up' ? 'up' : 'down');
        redirect('/admin/projects#p' . (int) $id);
    }

    private function persist(?int $id): string
    {
        $errors = [];
        $data = [];
        foreach (Project::FIELDS as $field) {
            $data[$field] = input($field);
        }
        $data['description'] = (string) ($_POST['description'] ?? '');
        foreach (array_keys(Project::STORY) as $field) {
            $data[$field] = (string) ($_POST[$field] ?? '');
        }

        $data['title'] = mb_substr($data['title'], 0, 120);
        if ($data['title'] === '') {
            $errors['title'] = 'Başlık gerekli.';
        }
        $data['slug'] = slugify($data['slug'] !== '' ? $data['slug'] : $data['title']);
        if ($data['slug'] === '') {
            $errors['slug'] = 'Geçerli bir slug gerekli.';
        } elseif (Project::slugExists($data['slug'], $id)) {
            $errors['slug'] = 'Bu slug başka bir projede kullanılıyor.';
        }
        $data['short_description'] = mb_substr($data['short_description'], 0, 300);
        if (!array_key_exists($data['category'], project_categories())) {
            $data['category'] = 'oyun';
        }
        if (!array_key_exists($data['status'], project_statuses())) {
            $data['status'] = 'gelistiriliyor';
        }
        foreach (['demo_url', 'github_url'] as $f) {
            $raw = $data[$f];
            $data[$f] = clean_url($raw);
            if ($raw !== '' && $data[$f] === '') {
                $errors[$f] = 'Geçerli bir http(s) adresi gir.';
            }
        }
        $date = $data['created_on'];
        $data['created_on'] = preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) && strtotime($date) !== false ? $date : null;
        $data['ai_tools'] = implode(', ', split_list($data['ai_tools']));
        $data['video_autoplay'] = isset($_POST['video_autoplay']) ? 1 : 0;
        $data['is_featured'] = isset($_POST['is_featured']) ? 1 : 0;
        $data['is_published'] = isset($_POST['is_published']) ? 1 : 0;
        $data['sort_order'] = (int) $data['sort_order'];

        // Media: a new upload wins over the library selection.
        foreach (self::MEDIA_FIELDS as $field => $kinds) {
            $selected = $data[$field];
            $data[$field] = null;
            $file = $_FILES[$field . '_file'] ?? null;
            if (is_array($file) && ($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE) {
                try {
                    $media = Uploader::store($file);
                    if (!in_array($media['kind'], $kinds, true)) {
                        $errors[$field] = 'Bu alan için yanlış dosya türü.';
                    }
                    $selected = (string) $media['path'];
                } catch (\RuntimeException $e) {
                    $errors[$field] = $e->getMessage();
                    $selected = '';
                }
            }
            if ($selected !== '') {
                $media = Media::findByPath($selected);
                if ($media !== null && in_array($media['kind'], $kinds, true)) {
                    $data[$field] = (string) $media['path'];
                }
            }
        }

        $technologies = array_map(static fn (string $s): string => mb_substr($s, 0, 40), split_list(input('technologies')));
        $metrics = $this->parseMetrics((string) ($_POST['metrics'] ?? ''));

        if ($errors !== []) {
            return $this->form($data + ['id' => $id, 'technologies' => $technologies, 'metrics' => $metrics], $id, $errors);
        }

        $newId = Project::save($id, $data, $technologies, $metrics);
        Session::flash('status', $id === null ? 'Proje oluşturuldu.' : 'Değişiklikler kaydedildi.');
        redirect('/admin/projects/' . $newId . '/edit');
    }

    /** "Etiket | Değer | Bağlam | Not" per line. @return array<int, array{label: string, value: string, context: string, note: string}> */
    private function parseMetrics(string $raw): array
    {
        $out = [];
        foreach (preg_split('/\R/', $raw) ?: [] as $line) {
            $parts = array_map('trim', explode('|', $line));
            if (($parts[0] ?? '') === '' || ($parts[1] ?? '') === '') {
                continue;
            }
            $out[] = [
                'label'   => mb_substr($parts[0], 0, 60),
                'value'   => mb_substr($parts[1], 0, 60),
                'context' => mb_substr($parts[2] ?? '', 0, 80),
                'note'    => mb_substr($parts[3] ?? '', 0, 120),
            ];
        }
        return array_slice($out, 0, 20);
    }

    /** @param array<string, mixed> $project @param array<string, string> $errors */
    private function form(array $project, ?int $id, array $errors, ?string $flash = null): string
    {
        return view('admin/projects/form', [
            'project' => $project,
            'id'      => $id,
            'errors'  => $errors,
            'flash'   => $flash,
            'library' => Media::all(),
            'fields'  => self::MEDIA_FIELDS,
            'meta'    => ['title' => $id === null ? 'Yeni proje' : 'Projeyi düzenle'],
            'section' => 'projects',
        ], 'layouts/admin');
    }
}
