<?php

declare(strict_types=1);

/*
 * Used by xampp-kurulum.bat. Enables the PHP extensions this site needs in the
 * php.ini that belongs to THIS php.exe, then verifies them in a fresh process.
 *
 *   php scripts/xampp-enable-ext.php
 *
 * Exit code 0 = required extensions load. Prints diagnostics otherwise.
 */

if (PHP_SAPI !== 'cli') {
    exit("CLI only.\n");
}

$required = ['pdo_sqlite', 'mbstring', 'fileinfo'];
$optional = ['sqlite3', 'gd'];
$phpDir = dirname(PHP_BINARY);
$extDir = $phpDir . DIRECTORY_SEPARATOR . 'ext';

$ini = php_ini_loaded_file();
if ($ini === false) {
    $ini = $phpDir . DIRECTORY_SEPARATOR . 'php.ini';
    if (!is_file($ini)) {
        foreach (['php.ini-development', 'php.ini-production'] as $template) {
            if (is_file($phpDir . DIRECTORY_SEPARATOR . $template)) {
                copy($phpDir . DIRECTORY_SEPARATOR . $template, $ini);
                echo "       php.ini olusturuldu ({$template} kopyalandi)\n";
                break;
            }
        }
        if (!is_file($ini)) {
            file_put_contents($ini, "[PHP]\n");
            echo "       bos php.ini olusturuldu\n";
        }
    }
}
echo "       php.ini: {$ini}\n";

$content = (string) file_get_contents($ini);
if (!is_file($ini . '.shivassai.bak')) {
    copy($ini, $ini . '.shivassai.bak');
}
$eol = str_contains($content, "\r\n") ? "\r\n" : "\n";

// extension_dir must point to the ext folder next to php.exe
if (!preg_match('/^\s*extension_dir\s*=.+$/mi', $content) && is_dir($extDir)) {
    $content .= $eol . 'extension_dir="' . $extDir . '"' . $eol;
    echo "       extension_dir eklendi: {$extDir}\n";
}

foreach (array_merge($required, $optional) as $ext) {
    if (extension_loaded($ext)) {
        continue;
    }
    $dll = $extDir . DIRECTORY_SEPARATOR . 'php_' . $ext . '.dll';
    if (DIRECTORY_SEPARATOR === '\\' && !is_file($dll)) {
        echo "       [!] {$ext}: {$dll} dosyasi yok\n";
        continue;
    }
    $pattern = '/^[ \t]*;[ \t]*extension[ \t]*=[ \t]*"?(php_)?' . preg_quote($ext, '/') . '(\.dll|\.so)?"?[ \t]*(\r?)$/mi';
    if (preg_match($pattern, $content)) {
        $content = (string) preg_replace($pattern, 'extension=' . $ext . '${3}', $content, 1);
        echo "       acildi: {$ext}\n";
    } elseif (!preg_match('/^[ \t]*extension[ \t]*=[ \t]*"?(php_)?' . preg_quote($ext, '/') . '(\.dll|\.so)?"?[ \t]*\r?$/mi', $content)) {
        $content = rtrim($content) . $eol . 'extension=' . $ext . $eol;
        echo "       eklendi: {$ext}\n";
    }
}

if (@file_put_contents($ini, $content) === false) {
    echo "[HATA] php.ini yazilamadi: {$ini}\n";
    echo "       XAMPP klasorunde yazma izni yok olabilir. kurulum.bat'a sag tik -> Yonetici olarak calistir.\n";
    exit(1);
}

// Verify in a fresh PHP process that reads the updated php.ini
$check = escapeshellarg(PHP_BINARY) . ' -d display_startup_errors=1 -d display_errors=stderr -r '
    . escapeshellarg('echo implode(",", array_map("strtolower", get_loaded_extensions()));') . ' 2>&1';
$out = (string) shell_exec($check);
$loaded = array_map('trim', explode(',', strtolower((string) preg_replace('/^.*\n/s', '', trim($out)))));
$missing = array_values(array_filter($required, static fn (string $e): bool => !in_array($e, $loaded, true)));

if ($missing !== []) {
    echo "[HATA] Yuklenemeyen eklentiler: " . implode(', ', $missing) . "\n";
    echo "------ tani ------\n";
    echo "PHP: " . PHP_VERSION . ' (' . PHP_BINARY . ")\n";
    echo "extension_dir: " . ini_get('extension_dir') . "\n";
    echo trim($out) . "\n";
    echo "------------------\n";
    exit(1);
}
foreach ($optional as $ext) {
    if (!in_array($ext, $loaded, true)) {
        echo "       ({$ext} yok — zorunlu degil)\n";
    }
}
exit(0);
