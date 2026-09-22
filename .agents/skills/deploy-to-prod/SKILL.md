---
name: deploy-to-prod
description: >-
  Use when the user asks to deploy Slotwell to production, rsync it, or update the live scheduler.
---

# Deploy Slotwell to production

The server (`genlabs`) is shared: it also hosts prashanta.dev, invoice.prashanta.dev, moodover.in and the GenLabs web-app/API.
Only ever touch `/var/www/slotwell` and `slotwell.service`. Never reload/restart Nginx, change other sites, or delete files
on the server as part of a deploy. First-time setup is in `docs/DEPLOYMENT.md` and needs the user's go-ahead.

## 0. Pre-flight (on the laptop)
Stop and tell the user if any of these fail.
```powershell
cd D:\Code\slotwell
git status --short          # must print nothing
npm run check               # typecheck + lint + tests
```

## 1. Preview the sync (dry run)
The list must not contain `.env*`, `.temp/`, `*_credentials.txt` or `node_modules`.
```powershell
wsl -d Ubuntu-24.04 -e bash -c "rsync -avzn --chmod=D755,F644 --exclude='.git' --exclude='node_modules' --exclude='.next' --exclude='.env*' --exclude='.temp' --exclude='.agents' --exclude='*_credentials.txt' --exclude='*.tsbuildinfo' --exclude='compose.yml' /mnt/d/Code/slotwell/ genlabs:/var/www/slotwell/"
```

## 2. Sync
Same command without `n`. Keep `--chmod` (files from `/mnt/d` otherwise arrive world-writable). No `--delete`.

## 3. Migrate (only if `server/migrations` changed — ask first), install, build, restart
```powershell
wsl -d Ubuntu-24.04 -e bash -c "ssh genlabs 'set -e; cd /var/www/slotwell && npm ci && node --env-file=.env.production server/migrate.mjs && npm run build && sudo systemctl restart slotwell.service && sleep 3 && systemctl is-active slotwell.service'"
```
Drop the `migrate.mjs` step when no schema changed. On failure show the output and `journalctl -u slotwell.service -n 50`; don't retry blindly.

## 4. Verify
```powershell
curl.exe -s -o NUL -w "%{http_code}`n" https://slotwell.app/
curl.exe -s -w "`n" https://slotwell.app/api/health
```
Expect `200` and `{"status":"ok"}`. Report the result and the deployed commit (`git log --oneline -1`).
