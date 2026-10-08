# shivassai.com — Deployment Guide (Linux VDS + Caddy + PHP-FPM + SQLite)

This guide assumes a fresh **Ubuntu 24.04** VDS and a user with `sudo`. Commands are copy-paste ready.
Replace nothing unless noted — the domain is `shivassai.com`, the app lives in `/var/www/shivassai`.

---

## 1. Install PHP 8.3

Ubuntu 24.04 ships PHP 8.3:

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y php8.3-fpm php8.3-cli
php -v   # must show 8.3.x
```

(On Debian or older Ubuntu, add the `ppa:ondrej/php` repository first.)

## 2. Install required PHP extensions

```bash
sudo apt install -y php8.3-sqlite3 php8.3-mbstring php8.3-gd php8.3-xml php8.3-curl
php -m | grep -E 'pdo_sqlite|mbstring|gd|fileinfo'
```

`pdo_sqlite` (database), `mbstring` (Turkish text), `gd` (responsive image variants), `fileinfo` (upload type detection — built in).

## 3. Install Composer (optional)

The app has **no runtime Composer dependencies** — it ships its own autoloader. Composer is only
needed if you later add packages:

```bash
sudo apt install -y composer   # optional
```

## 4. Node/npm — only to rebuild CSS

The compiled CSS (`public/assets/css/app.css`) is committed. You only need Node if you change
templates/styles and want to rebuild **on the server** (usually you rebuild locally and push):

```bash
# optional
sudo apt install -y nodejs npm
cd /var/www/shivassai && npm ci && npm run build
```

## 5. Upload / clone the project

```bash
sudo apt install -y git sqlite3
sudo adduser --system --group --home /var/www/shivassai shivassai
sudo git clone <REPO_URL> /tmp/repo
sudo cp -r /tmp/repo/shivassai/. /var/www/shivassai/
sudo chown -R shivassai:shivassai /var/www/shivassai
```

(Or upload the `shivassai/` folder with `scp -r shivassai user@SERVER:/tmp/` and copy it the same way.)

## 6. Configure the environment

Secrets/config never live in `public/`. Create the local config:

```bash
cd /var/www/shivassai
sudo -u shivassai cp config/config.local.example.php config/config.local.php
sudo -u shivassai nano config/config.local.php
```

Make sure it contains:

```php
return ['app' => ['url' => 'https://shivassai.com', 'env' => 'production', 'debug' => false]];
```

`app.url` is used for canonical URLs, Open Graph and the sitemap.

## 7. Create the database

```bash
cd /var/www/shivassai
sudo -u shivassai php scripts/install.php
```

Creates `storage/database.sqlite` (outside the web root), all tables/indexes, default settings,
the three seed projects and three **unpublished sample drafts** for the build log. Safe to re-run.

## 8. Create the admin

```bash
sudo -u shivassai php scripts/create-admin.php
```

You will be asked for a username and a password (min. 12 characters, not shown while typing).
Running it again with the same username resets that password.

## 9. Permissions

```bash
cd /var/www/shivassai
sudo chown -R shivassai:shivassai .
sudo find . -type d -exec chmod 755 {} \;
sudo find . -type f -exec chmod 644 {} \;
sudo chmod 750 storage storage/backups
sudo chmod 640 storage/database.sqlite config/config.local.php
# Caddy must read static files in public/ (755/644 above is enough).
```

PHP runs as `shivassai`, so it can write `storage/` and `public/uploads/`. Nothing else needs to be writable.

## 10. Configure PHP-FPM

```bash
sudo cp /var/www/shivassai/deploy/php-fpm-pool.conf /etc/php/8.3/fpm/pool.d/shivassai.conf
sudo rm -f /etc/php/8.3/fpm/pool.d/www.conf   # optional: remove the default pool
sudo systemctl restart php8.3-fpm
ls -la /run/php/php8.3-fpm-shivassai.sock     # socket must exist
```

The pool limits uploads (40 MB), disables shell functions and sets secure session cookies.

## 11. Configure Caddy

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy

sudo cp /var/www/shivassai/deploy/Caddyfile /etc/caddy/Caddyfile
sudo mkdir -p /var/log/caddy && sudo chown caddy:caddy /var/log/caddy
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

What the Caddyfile does: serves only `public/`, sends everything else to `index.php` via PHP-FPM,
redirects `www.shivassai.com` → `shivassai.com`, blocks any script inside `/uploads`, blocks every
`.php` except `index.php`, compresses responses and sets long cache headers for assets.

## 12. Configure DNS

At your domain registrar / DNS provider, create:

| Type | Name | Value |
|---|---|---|
| A | `@` | your server IPv4 |
| A | `www` | your server IPv4 |
| AAAA | `@` / `www` | your server IPv6 (only if you have one) |

Wait until `dig +short shivassai.com` returns your IP.

## 13. Enable HTTPS

Nothing to do: Caddy obtains Let's Encrypt certificates automatically once DNS points to the server
and ports **80 and 443** are open:

```bash
sudo ufw allow OpenSSH && sudo ufw allow 80 && sudo ufw allow 443 && sudo ufw enable
sudo journalctl -u caddy -f   # watch certificate issuance
```

## 14. Test the website

- `https://shivassai.com` loads, `https://www.shivassai.com` redirects.
- `/projeler`, `/projeler/project-vanta`, `/build-log`, `/hakkimda`, `/iletisim` all return 200.
- `/robots.txt` and `/sitemap.xml` show `https://shivassai.com/...` URLs.
- `curl -I https://shivassai.com` shows `Content-Security-Policy`, `X-Frame-Options`, `Strict-Transport-Security`.
- `https://shivassai.com/../storage/database.sqlite` and `/config/config.php` → 404.

## 15. Test the admin

- Open `https://shivassai.com/admin` → redirected to the login.
- Log in, edit a project, save, open it publicly.
- 5 wrong passwords lock login for 15 minutes (by IP and by username).

## 16. Test uploads

- `/admin/media` → upload a JPG, a GIF and a short MP4.
- A renamed file (e.g. `script.php` → `image.png`) is rejected: the real type is detected server-side.
- Files are stored as random names under `public/uploads/YYYY/MM/`.
- `curl -I https://shivassai.com/uploads/anything.php` → 403.

## 17. Back up the SQLite database

```bash
cd /var/www/shivassai
sudo -u shivassai php scripts/backup.php          # keeps the newest 14
sudo -u shivassai php scripts/backup.php --keep=30
```

Creates `storage/backups/shivassai-YYYYmmdd-HHMMSS.tar.gz` with a consistent DB snapshot
(`VACUUM INTO`, safe while the site runs) and all uploads. Daily at 03:30 via cron:

```bash
sudo crontab -u shivassai -e
# add:
30 3 * * * cd /var/www/shivassai && php scripts/backup.php >> storage/logs/backup.log 2>&1
```

Copy backups off the server regularly, e.g. from your computer:
`scp user@SERVER:/var/www/shivassai/storage/backups/*.tar.gz ./`

**Restore:** stop PHP-FPM, extract the archive, put `database.sqlite` into `storage/` and the
`uploads/` folder into `public/`, fix ownership (`chown -R shivassai:shivassai`), start PHP-FPM.

## 18. Update the application

```bash
cd /tmp/repo && sudo git pull
sudo -u shivassai php /var/www/shivassai/scripts/backup.php
sudo rsync -a --delete \
  --exclude 'storage/' --exclude 'public/uploads/' --exclude 'config/config.local.php' \
  /tmp/repo/shivassai/ /var/www/shivassai/
sudo chown -R shivassai:shivassai /var/www/shivassai
sudo -u shivassai php /var/www/shivassai/scripts/install.php   # applies new migrations, never overwrites content
sudo systemctl reload php8.3-fpm
```

---

### Troubleshooting

| Symptom | Check |
|---|---|
| 502 Bad Gateway | `systemctl status php8.3-fpm`, socket path in Caddyfile matches the pool |
| 500 page | `storage/logs/app-YYYY-MM.log`, `storage/logs/php-error.log` |
| Upload fails silently | `upload_max_filesize` / `post_max_size` in the pool file |
| "Oturum süresi doldu" on forms | Cookies blocked, or `app.url` scheme differs from the real one |
| No certificate | DNS not propagated yet, or ports 80/443 closed |
