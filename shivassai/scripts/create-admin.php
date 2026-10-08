<?php

declare(strict_types=1);

/*
 * php scripts/create-admin.php
 *
 * Interactively creates (or resets the password of) an administrator.
 * The password is never hardcoded or echoed to the terminal.
 */

if (PHP_SAPI !== 'cli') {
    exit("CLI only.\n");
}

require dirname(__DIR__) . '/app/bootstrap.php';

use App\Services\Database;

function prompt(string $label, bool $hidden = false): string
{
    echo $label;
    $tty = $hidden && DIRECTORY_SEPARATOR === '/' && stream_isatty(STDIN);
    if ($tty) {
        shell_exec('stty -echo');
    }
    $value = fgets(STDIN);
    if ($tty) {
        shell_exec('stty echo');
        echo "\n";
    }
    return $value === false ? '' : trim($value);
}

$username = prompt('Kullanıcı adı: ');
if (!preg_match('/^[a-zA-Z0-9_.-]{3,32}$/', $username)) {
    fwrite(STDERR, "Geçersiz kullanıcı adı (3-32 karakter: harf, rakam, _ . -)\n");
    exit(1);
}

$password = prompt('Şifre (en az 12 karakter): ', true);
if (mb_strlen($password) < 12) {
    fwrite(STDERR, "Şifre en az 12 karakter olmalı.\n");
    exit(1);
}
$confirm = prompt('Şifre (tekrar): ', true);
if (!hash_equals($password, $confirm)) {
    fwrite(STDERR, "Şifreler eşleşmiyor.\n");
    exit(1);
}

$hash = password_hash($password, PASSWORD_DEFAULT);
$exists = Database::value('SELECT id FROM users WHERE username = ?', [$username]);
if ($exists) {
    Database::run('UPDATE users SET password_hash = ? WHERE id = ?', [$hash, $exists]);
    echo "Şifre güncellendi: {$username}\n";
} else {
    Database::run('INSERT INTO users (username, password_hash) VALUES (?, ?)', [$username, $hash]);
    echo "Yönetici oluşturuldu: {$username}\n";
}
