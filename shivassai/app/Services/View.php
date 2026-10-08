<?php

declare(strict_types=1);

namespace App\Services;

final class View
{
    /** @param array<string, mixed> $data */
    public static function render(string $template, array $data = [], ?string $layout = 'layouts/site'): string
    {
        $content = self::partial($template, $data);
        if ($layout === null) {
            return $content;
        }
        return self::partial($layout, $data + ['content' => $content]);
    }

    /** @param array<string, mixed> $data */
    public static function partial(string $template, array $data = []): string
    {
        $file = APP_ROOT . '/app/Views/' . $template . '.php';
        if (!preg_match('#^[a-z0-9/_-]+$#', $template) || !is_file($file)) {
            throw new \RuntimeException("View not found: {$template}");
        }
        extract($data, EXTR_SKIP);
        ob_start();
        try {
            require $file;
        } catch (\Throwable $e) {
            ob_end_clean();
            throw $e;
        }
        return (string) ob_get_clean();
    }
}
