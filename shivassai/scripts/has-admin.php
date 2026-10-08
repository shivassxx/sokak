<?php

declare(strict_types=1);

// Exit code 0 when at least one administrator exists, 1 otherwise (used by xampp-kurulum.bat).
if (PHP_SAPI !== 'cli') {
    exit("CLI only.\n");
}
require dirname(__DIR__) . '/app/bootstrap.php';
exit((int) App\Services\Database::value('SELECT COUNT(*) FROM users') > 0 ? 0 : 1);
