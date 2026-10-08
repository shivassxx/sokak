<?php

declare(strict_types=1);

/*
 * php scripts/backup.php [--keep=14]
 *
 * Creates storage/backups/shivassai-YYYYmmdd-HHMMSS.tar.gz containing a
 * consistent copy of the SQLite database (VACUUM INTO) and the uploads folder.
 * Keeps the newest N backups (default 14).
 */

if (PHP_SAPI !== 'cli') {
    exit("CLI only.\n");
}

require dirname(__DIR__) . '/app/bootstrap.php';

use App\Services\Config;
use App\Services\Database;

$keep = 14;
foreach ($argv as $arg) {
    if (preg_match('/^--keep=(\d+)$/', $arg, $m)) {
        $keep = max(1, (int) $m[1]);
    }
}

$backupDir = (string) Config::get('paths.backups');
if (!is_dir($backupDir)) {
    mkdir($backupDir, 0750, true);
}

$stamp = date('Ymd-His');
$work = $backupDir . '/tmp-' . $stamp;
mkdir($work, 0750, true);

// 1. Consistent database snapshot, even while the site is running.
$dbCopy = $work . '/database.sqlite';
Database::run('VACUUM INTO ?', [$dbCopy]);

// 2. Archive database + uploads.
$archive = $backupDir . "/shivassai-{$stamp}.tar";
$tar = new PharData($archive);
$tar->addFile($dbCopy, 'database.sqlite');
$uploads = (string) Config::get('paths.uploads');
if (is_dir($uploads)) {
    $it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($uploads, FilesystemIterator::SKIP_DOTS));
    foreach ($it as $file) {
        /** @var SplFileInfo $file */
        if ($file->isFile() && $file->getFilename() !== '.htaccess') {
            $tar->addFile($file->getPathname(), 'uploads/' . substr($file->getPathname(), strlen($uploads) + 1));
        }
    }
}
$tar->compress(Phar::GZ);
unset($tar);
unlink($archive);
unlink($dbCopy);
rmdir($work);

$final = $archive . '.gz';
@chmod($final, 0640);
echo 'Yedek oluşturuldu: ' . $final . ' (' . format_bytes((int) filesize($final)) . ")\n";

// 3. Rotate old backups.
$all = glob($backupDir . '/shivassai-*.tar.gz') ?: [];
rsort($all);
foreach (array_slice($all, $keep) as $old) {
    unlink($old);
    echo 'Silindi (eski): ' . basename($old) . "\n";
}
