<?php

declare(strict_types=1);

/*
 * php scripts/test.php — dependency-free unit tests for security-critical helpers.
 * Exit code 0 = all passed.
 */

if (PHP_SAPI !== 'cli') {
    exit("CLI only.\n");
}

require dirname(__DIR__) . '/app/bootstrap.php';

use App\Services\Markdown;
use App\Services\Router;

$failed = 0;
$passed = 0;
function check(string $name, bool $ok): void
{
    global $failed, $passed;
    $ok ? $passed++ : $failed++;
    echo ($ok ? '  ok   ' : '  FAIL ') . $name . "\n";
}

// --- Markdown: XSS ---
$xss = [
    '<script>alert(1)</script>',
    '<img src=x onerror=alert(1)>',
    '[x](javascript:alert(1))',
    '[x](JaVaScRiPt:alert(1))',
    '[x](&#106;avascript:alert(1))',
    '[x](data:text/html;base64,PHNjcmlwdD4=)',
    '[x](//evil.com)',
    '![x](javascript:alert(1))',
    '![x](https://evil.com/a.png)',
    '[x](https://ok.com" onmouseover="alert(1))',
    '<iframe src="https://evil.com"></iframe>',
    '**<svg onload=alert(1)>**',
    "```\n</code><script>alert(1)</script>\n```",
    '`<script>`',
];
foreach ($xss as $input) {
    $html = Markdown::render($input);
    // Inspect only real tags; escaped text like "&lt;img onerror=...&gt;" is harmless.
    preg_match_all('/<[a-z][^>]*>/i', $html, $tags);
    $bad = preg_grep('/^<(script|iframe|svg|object|embed)\b|\son\w+\s*=|javascript:|data:|(href|src)="\/\//i', $tags[0]);
    check('markdown blocks: ' . str_replace("\n", ' ', $input), $bad === []);
}

// --- Markdown: features ---
check('heading', str_contains(Markdown::render('# Başlık'), '<h2 id="baslik">Başlık</h2>'));
check('bold/italic', Markdown::render('**a** *b*') === '<p><strong>a</strong> <em>b</em></p>');
check('safe link', str_contains(Markdown::render('[ok](https://example.com)'), '<a href="https://example.com" rel="nofollow noopener noreferrer">ok</a>'));
check('relative link', str_contains(Markdown::render('[p](/projeler)'), '<a href="/projeler">p</a>'));
check('local image', str_contains(Markdown::render('![a](/uploads/x.png)'), '<img src="/uploads/x.png" alt="a"'));
check('list', Markdown::render("- a\n- b") === '<ul><li>a</li><li>b</li></ul>');
check('ordered list', Markdown::render("1. a\n2. b") === '<ol><li>a</li><li>b</li></ol>');
check('code block escapes', str_contains(Markdown::render("```js\nif (a < b) {}\n```"), 'if (a &lt; b) {}'));
check('snake_case untouched', Markdown::render('my_var_name') === '<p>my_var_name</p>');
check('reading time >= 1', Markdown::readingMinutes('') === 1);

// --- Helpers ---
check('slugify tr', slugify('Saklambaç Neden Tarayıcıda Çalışmalı?') === 'saklambac-neden-tarayicida-calismali');
check('slugify İ', slugify('İSTOP Oyunu') === 'istop-oyunu');
check('clean_url rejects js', clean_url('javascript:alert(1)') === '');
check('clean_url accepts https', clean_url('https://github.com/x') === 'https://github.com/x');
check('escape', e('<a href="x">\'') === '&lt;a href=&quot;x&quot;&gt;&apos;');
check('split_list', split_list("a, b\nc,,a") === ['a', 'b', 'c']);

// --- Router ---
$r = new Router();
$r->get('/projeler/{slug:[a-z0-9-]+}', static fn (string $slug): string => 'p:' . $slug);
check('router param', $r->dispatch('GET', '/projeler/project-vanta?x=1') === 'p:project-vanta');
try {
    $r->dispatch('GET', '/projeler/../../etc');
    check('router rejects traversal', false);
} catch (\App\Services\HttpException $e) {
    check('router rejects traversal', $e->status === 404);
}
try {
    $r->dispatch('POST', '/projeler/a');
    check('router 405', false);
} catch (\App\Services\HttpException $e) {
    check('router 405', $e->status === 405);
}

echo "\n{$passed} passed, {$failed} failed\n";
exit($failed === 0 ? 0 : 1);
