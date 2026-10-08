<?php /** @var string $content */ ?>
<!doctype html>
<html lang="tr" data-theme="dark" class="no-js">
<head><?= \App\Services\View::partial('partials/admin-head', ['meta' => $meta ?? []]) ?></head>
<body class="min-h-[100svh]">
  <?= $content ?>
</body>
</html>
