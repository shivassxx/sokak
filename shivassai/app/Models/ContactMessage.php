<?php

declare(strict_types=1);

namespace App\Models;

use App\Services\Database;

final class ContactMessage
{
    public static function create(string $name, string $email, string $message): void
    {
        Database::run('INSERT INTO contact_messages (name, email, message) VALUES (?, ?, ?)', [$name, $email, $message]);
    }

    /** @return array<int, array<string, mixed>> */
    public static function all(): array
    {
        return Database::all('SELECT * FROM contact_messages ORDER BY id DESC');
    }

    public static function unreadCount(): int
    {
        return (int) Database::value('SELECT COUNT(*) FROM contact_messages WHERE is_read = 0');
    }

    public static function markAllRead(): void
    {
        Database::run('UPDATE contact_messages SET is_read = 1 WHERE is_read = 0');
    }

    public static function delete(int $id): void
    {
        Database::run('DELETE FROM contact_messages WHERE id = ?', [$id]);
    }
}
