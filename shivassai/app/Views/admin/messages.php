<?php /** @var array<int, array<string, mixed>> $messages @var string|null $flash */ ?>
<h1 class="h-md">Mesajlar</h1>
<p class="mt-1 text-[14px] text-muted">İletişim formundan gelenler.</p>
<?php if ($flash): ?><div class="notice mt-5" role="status"><?= e($flash) ?></div><?php endif; ?>

<ul class="mt-6 space-y-3">
  <?php foreach ($messages as $m): ?>
    <li class="a-card">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <p class="text-[15px] font-medium"><?= e($m['name']) ?> <?php if (!$m['is_read']): ?><span class="a-chip a-chip-on ml-1">yeni</span><?php endif; ?></p>
          <a class="link-muted break-all text-[13px]" href="mailto:<?= e($m['email']) ?>"><?= e($m['email']) ?></a>
        </div>
        <span class="shrink-0 text-[12px] text-muted"><?= e(format_date($m['created_at'])) ?></span>
      </div>
      <p class="mt-4 whitespace-pre-line text-[15px] leading-relaxed text-muted"><?= e($m['message']) ?></p>
      <form method="post" action="/admin/messages/<?= (int) $m['id'] ?>/delete" class="mt-4" data-confirm="Mesaj silinsin mi?">
        <?= csrf_field() ?><button class="link-muted text-[13px]" type="submit">Sil</button>
      </form>
    </li>
  <?php endforeach; ?>
  <?php if (!$messages): ?><li class="a-card text-[14px] text-muted">Henüz mesaj yok.</li><?php endif; ?>
</ul>
