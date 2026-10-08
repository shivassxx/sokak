<?php

declare(strict_types=1);

namespace App\Services;

/**
 * Small, safe Markdown renderer.
 *
 * Security model: ALL input text is HTML-escaped first; only a whitelist of
 * Markdown constructs is turned into tags afterwards. Raw HTML in the source
 * is therefore always shown as text. Link and image URLs are validated against
 * an allow-list of schemes (http, https, mailto, site-relative), so
 * `javascript:`, `data:` and protocol-relative URLs never reach an attribute.
 *
 * Supported: headings, paragraphs, **bold**, *italic*, ~~strike~~, `code`,
 * fenced code blocks, links, images (site-relative only), lists, blockquotes, hr.
 */
final class Markdown
{
    /** @var array<int, string> */
    private array $tokens = [];

    public static function render(string $source): string
    {
        return (new self())->renderBlocks($source);
    }

    /** Plain text excerpt (no markup) for meta descriptions / reading time. */
    public static function plain(string $source): string
    {
        $text = preg_replace('/```.*?```/s', ' ', $source) ?? $source;
        $text = preg_replace('/!\[[^\]]*\]\([^)]*\)/', ' ', $text) ?? $text;
        $text = preg_replace('/\[([^\]]+)\]\([^)]*\)/', '$1', $text) ?? $text;
        $text = preg_replace('/[#>*_`~\-]+/', ' ', $text) ?? $text;
        return trim(preg_replace('/\s+/u', ' ', $text) ?? $text);
    }

    public static function readingMinutes(string $source): int
    {
        $words = count(preg_split('/\s+/u', self::plain($source), -1, PREG_SPLIT_NO_EMPTY) ?: []);
        return max(1, (int) ceil($words / 200));
    }

    public static function safeUrl(string $url, bool $imageOnly = false): ?string
    {
        $url = trim(html_entity_decode($url, ENT_QUOTES | ENT_HTML5, 'UTF-8'));
        if ($url === '' || preg_match('/[\x00-\x20\x7f<>"\'`\\\\]/', $url)) {
            return null;
        }
        if (str_starts_with($url, '//')) {
            return null;
        }
        if (str_starts_with($url, '/') || str_starts_with($url, '#')) {
            return $url;
        }
        if ($imageOnly) {
            return null; // images must be hosted on this site (CSP: img-src 'self')
        }
        $scheme = strtolower((string) parse_url($url, PHP_URL_SCHEME));
        return in_array($scheme, ['http', 'https', 'mailto'], true) ? $url : null;
    }

    private function renderBlocks(string $source): string
    {
        $source = str_replace(["\r\n", "\r", "\0"], ["\n", "\n", ''], $source);
        $lines = explode("\n", $source);
        $html = [];
        $count = count($lines);
        $i = 0;

        while ($i < $count) {
            $line = $lines[$i];

            if (trim($line) === '') {
                $i++;
                continue;
            }

            // Fenced code block
            if (preg_match('/^\s*```\s*([\w+-]*)\s*$/', $line, $m)) {
                $code = [];
                $i++;
                while ($i < $count && !preg_match('/^\s*```\s*$/', $lines[$i])) {
                    $code[] = $lines[$i];
                    $i++;
                }
                $i++; // closing fence
                $lang = $m[1] !== '' ? ' class="language-' . e($m[1]) . '"' : '';
                $html[] = '<pre><code' . $lang . '>' . e(implode("\n", $code)) . '</code></pre>';
                continue;
            }

            // Heading
            if (preg_match('/^(#{1,6})\s+(.+?)\s*#*\s*$/', $line, $m)) {
                // h1 is reserved for the page title; shift markdown headings down one level.
                $level = min(6, strlen($m[1]) + 1);
                $id = slugify(self::plain($m[2]));
                $html[] = "<h{$level} id=\"" . e($id) . "\">" . $this->inline($m[2]) . "</h{$level}>";
                $i++;
                continue;
            }

            // Horizontal rule
            if (preg_match('/^\s*([-*_])(\s*\1){2,}\s*$/', $line)) {
                $html[] = '<hr>';
                $i++;
                continue;
            }

            // Blockquote
            if (preg_match('/^\s*>/', $line)) {
                $quote = [];
                while ($i < $count && preg_match('/^\s*>\s?(.*)$/', $lines[$i], $m)) {
                    $quote[] = $m[1];
                    $i++;
                }
                $html[] = '<blockquote>' . (new self())->renderBlocks(implode("\n", $quote)) . '</blockquote>';
                continue;
            }

            // Lists
            if (preg_match('/^\s*([-*+]|\d+[.)])\s+/', $line, $m)) {
                $ordered = ctype_digit(rtrim($m[1], '.)'));
                $pattern = $ordered ? '/^\s*\d+[.)]\s+(.*)$/' : '/^\s*[-*+]\s+(.*)$/';
                $items = [];
                while ($i < $count && preg_match($pattern, $lines[$i], $mm)) {
                    $item = $mm[1];
                    $i++;
                    // continuation lines (indented)
                    while ($i < $count && preg_match('/^\s{2,}(\S.*)$/', $lines[$i], $cont)
                        && !preg_match('/^\s*([-*+]|\d+[.)])\s+/', $lines[$i])) {
                        $item .= ' ' . $cont[1];
                        $i++;
                    }
                    $items[] = '<li>' . $this->inline($item) . '</li>';
                }
                $tag = $ordered ? 'ol' : 'ul';
                $html[] = "<{$tag}>" . implode('', $items) . "</{$tag}>";
                continue;
            }

            // Paragraph: consume until blank line or another block start
            $para = [];
            while ($i < $count && trim($lines[$i]) !== ''
                && !preg_match('/^(\s*```|#{1,6}\s|\s*>|\s*([-*+]|\d+[.)])\s+)/', $lines[$i])) {
                $para[] = $lines[$i];
                $i++;
            }
            if ($para === []) { // safety: never loop forever
                $para[] = $lines[$i];
                $i++;
            }
            $parts = array_map(fn (string $l): string => $this->inline(rtrim($l)) . (str_ends_with($l, '  ') ? '<br>' : ''), $para);
            $html[] = '<p>' . implode("\n", $parts) . '</p>';
        }

        return implode("\n", $html);
    }

    private function inline(string $text): string
    {
        $this->tokens = [];
        $text = e(str_replace("\x1A", '', $text));

        // Code spans first: their content must not be formatted further.
        $text = preg_replace_callback('/`([^`]+)`/', fn (array $m): string => $this->stash('<code>' . $m[1] . '</code>'), $text) ?? $text;

        // Images (site-relative only)
        $text = preg_replace_callback('/!\[([^\]]*)\]\(([^)\s]+)\)/', function (array $m): string {
            $url = self::safeUrl($m[2], true);
            if ($url === null) {
                return $m[1];
            }
            return $this->stash('<img src="' . e($url) . '" alt="' . $m[1] . '" loading="lazy" decoding="async">');
        }, $text) ?? $text;

        // Links
        $text = preg_replace_callback('/\[([^\]]+)\]\(([^)\s]+)\)/', function (array $m): string {
            $url = self::safeUrl($m[2]);
            $label = $this->emphasis($m[1]);
            if ($url === null) {
                return $label;
            }
            $external = preg_match('#^https?://#i', $url) === 1;
            $rel = $external ? ' rel="nofollow noopener noreferrer"' : '';
            return $this->stash('<a href="' . e($url) . '"' . $rel . '>' . $label . '</a>');
        }, $text) ?? $text;

        $text = $this->emphasis($text);

        // Restore stashed fragments
        return preg_replace_callback('/\x1A(\d+)\x1A/', fn (array $m): string => $this->tokens[(int) $m[1]] ?? '', $text) ?? $text;
    }

    private function emphasis(string $text): string
    {
        $rules = [
            '/\*\*(?=\S)(.+?)(?<=\S)\*\*/u'               => '<strong>$1</strong>',
            '/__(?=\S)(.+?)(?<=\S)__/u'                   => '<strong>$1</strong>',
            '/~~(?=\S)(.+?)(?<=\S)~~/u'                   => '<del>$1</del>',
            '/(?<![\*\w])\*(?=\S)(.+?)(?<=\S)\*(?!\*)/u'  => '<em>$1</em>',
            '/(?<![\w])_(?=\S)(.+?)(?<=\S)_(?![\w])/u'    => '<em>$1</em>',
        ];
        foreach ($rules as $pattern => $replacement) {
            $text = preg_replace($pattern, $replacement, $text) ?? $text;
        }
        return $text;
    }

    private function stash(string $html): string
    {
        $this->tokens[] = $html;
        return "\x1A" . (count($this->tokens) - 1) . "\x1A";
    }
}
