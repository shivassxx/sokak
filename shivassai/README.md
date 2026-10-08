# shivassai.com

Personal portfolio + CMS of Çağrı — a vibe coder who builds software together with AI coding agents.
PHP 8.3 (no framework) · SQLite via PDO · Tailwind CSS · a little vanilla JS.

## Run locally

```bash
cd shivassai
php scripts/install.php          # creates storage/database.sqlite + seed content
php scripts/create-admin.php     # interactive: username + password
php -S 127.0.0.1:8000 -t public public/index.php
```

Open http://127.0.0.1:8000 — admin at http://127.0.0.1:8000/admin.

### Windows + XAMPP

1. Install XAMPP (PHP ≥ 8.2) to `C:\xampp`.
2. Put this `shivassai` folder at `C:\xampp\shivassai` (outside `htdocs`).
3. Double-click `xampp-kurulum.bat` — it enables PHP extensions, creates the DB and admin,
   and registers an Apache virtual host on port 8080 (`deploy/xampp/shivassai-vhost.conf` is the reference).
4. Restart Apache in the XAMPP Control Panel → http://localhost:8080

Rebuild CSS after template/style changes (Node needed only for this):

```bash
npm install && npm run build     # or: npm run watch
```

Tests: `php scripts/test.php` (Markdown XSS, helpers, router).
Backups: `php scripts/backup.php`. Production: see [DEPLOY.md](DEPLOY.md).

## Structure

```
app/
  Controllers/        public pages + Admin/ (auth, projects, build log, media, settings, messages)
  Models/             Project, BuildLog, Media, Setting, SocialLink, ContactMessage
  Services/           Router, Database (PDO), Session, Csrf, Auth, RateLimiter, Markdown,
                      Uploader, Seo, SecurityHeaders, I18n, View, ErrorHandler
  Helpers/functions.php
  Views/              layouts/, partials/, pages/, admin/, errors/
config/               config.php (+ config.local.php, git-ignored)
database/             migrations/*.sql, seeds/seed.php
lang/tr.php           UI strings (add lang/en.php for English)
public/               the ONLY web root: index.php, assets/, uploads/
resources/css/        Tailwind source + design tokens
routes/web.php        all routes
scripts/              install, create-admin, backup, test
storage/              database.sqlite, logs, backups (outside web root)
deploy/               Caddyfile, php-fpm pool
```

## Design system

Tokens live as CSS variables in `resources/css/app.css` (`--bg`, `--surface`, `--fg`, `--muted`,
`--line*`, `--accent`). Dark is default; light theme redefines the same tokens. The warm accent
(`#E6A23C`) is used only for the logo cursor and tiny brand details. Reusable components:
`.btn-primary/.btn-secondary`, `.pill`, `.tag`, `.status`, `.media-frame`, `.nav-pill`,
`.hair-table`, `.acc-item`, `.prose-shv`, `.terminal`, `.micro`, `.display*`, `.h-*`.

## Content rules

No invented facts: build metrics show only admin-entered values; empty social links are hidden;
projects without media show a generated, clearly labelled placeholder ("görsel yakında");
sample build-log drafts are unpublished and marked "ÖRNEK TASLAK".

## Security summary

Prepared statements everywhere · `htmlspecialchars` output escaping · escape-first Markdown
renderer with URL allow-list · CSRF on every state-changing form · login rate limiting (IP +
username) · contact form: CSRF + honeypot + min-time + rate limit + validation · `password_hash`
· session regeneration, HttpOnly/Secure/SameSite cookies · uploads validated by real MIME
(finfo) + extension + size, random names, no script execution · CSP with nonces, X-Frame-Options,
nosniff, Referrer-Policy, Permissions-Policy, HSTS · DB and config outside `public/`.
