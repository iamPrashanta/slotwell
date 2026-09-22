# Deployment

Production runs on the shared `genlabs` server, the same way as the invoice generator: rsync from WSL, `npm ci` + build on the server, a systemd service behind Nginx. The server also hosts other sites and the GenLabs API — never touch those.

| Item | Value |
| --- | --- |
| Domain | `slotwell.app` (to be bought; see "Domain") |
| App folder | `/var/www/slotwell` |
| Service | `slotwell.service` (runs as `ubuntu`, group `www-data`) |
| Port | `127.0.0.1:3005` (check it's free: `ss -ltnp | grep 3005`) |
| Env file | `/var/www/slotwell/.env.production` (mode 600, server-only) |
| Database | `slotwell` owned by role `slotwell_user` on the existing PostgreSQL |

## Domain

Production domain: **`slotwell.app`** (not bought yet). `.app` domains are on the HSTS preload list, so browsers only ever load them over HTTPS — have the TLS certificate in place before pointing DNS at the server.

If the domain ever changes, update `APP_URL`, `BETTER_AUTH_URL`, `EMBED_ALLOWED_ORIGINS` (on the host site side), the Google OAuth client, Nginx, and prashanta.dev's `booking.url` + `frame-src`.

## One-time server setup (ask before running — it changes the shared server)

1. **Database** (as the postgres superuser):
   ```sql
   CREATE ROLE slotwell_user LOGIN PASSWORD '<strong password>';
   CREATE DATABASE slotwell OWNER slotwell_user;
   ```
2. **Folder:** `sudo mkdir -p /var/www/slotwell && sudo chown ubuntu:www-data /var/www/slotwell && chmod 755 /var/www/slotwell`
3. **Env:** create `/var/www/slotwell/.env.production` from `.env.example` with production values (`APP_URL=https://slotwell.app`, `BETTER_AUTH_URL=https://slotwell.app`, real SMTP, new `BETTER_AUTH_SECRET`), then `chmod 600`.
4. **systemd:** copy `deploy/slotwell.service` to `/etc/systemd/system/`, then `sudo systemctl daemon-reload && sudo systemctl enable slotwell.service`.
5. **Nginx + TLS:** copy `deploy/nginx-slotwell.conf` to `/etc/nginx/sites-available/slotwell`, symlink into `sites-enabled`, run `sudo nginx -t`, then reload Nginx (this affects every site on the server — pick a quiet time), then `sudo certbot --nginx -d slotwell.app -d www.slotwell.app`.
6. **DNS:** A/AAAA records for `slotwell.app` and `www` to the server.
7. **prashanta.dev redirect (optional):** `book.prashanta.dev` → `https://slotwell.app/iamprashanta` with a 301 in Nginx.

## Every deploy

Follow `.agents/skills/deploy-to-prod/SKILL.md`.
