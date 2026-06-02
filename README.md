# Hostinger Deploy Action

A GitHub Action to deploy Next.js apps to Hostinger with Vercel-like commit status checks.

Supports three modes:
- **auto** (default) — for Hostinger Cloud Startup with Git auto-deploy. Builds on GitHub Actions, sets ✅/❌ on commits.
- **sftp** — for shared hosting. Uploads the `out/` folder via SFTP.
- **ftp** — for shared hosting. Uploads via FTP.

## Usage (Cloud Startup — auto mode)

```yaml
name: Deploy to Hostinger

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: .node-version
      - uses: spacendigital/hostinger-deploy-action@v1
        with:
          live-url: https://spacend.ws
```

The Action runs the build and creates a deployment record. Hostinger's Git integration picks up the pushed commit and deploys automatically.

## Usage (Shared hosting — sftp mode)

```yaml
- uses: spacendigital/hostinger-deploy-action@v1
  with:
    host: ${{ secrets.HOSTINGER_HOST }}
    username: ${{ secrets.HOSTINGER_USERNAME }}
    password: ${{ secrets.HOSTINGER_PASSWORD }}
    target-dir: ${{ secrets.HOSTINGER_TARGET_DIR }}
    live-url: https://spacend.ws
    deploy-mode: sftp
```

## Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `live-url` | ✅ | — | Live site URL |
| `host` | sftp/ftp | — | Server hostname or IP |
| `username` | sftp/ftp | — | SFTP/SSH username |
| `password` | — | — | SFTP/SSH password |
| `private-key` | — | — | SSH private key |
| `target-dir` | sftp/ftp | — | Remote directory (e.g. `/public_html`) |
| `build-command` | — | `npm run build` | Build command |
| `install-command` | — | `npm ci` | Install command |
| `deploy-mode` | — | `auto` | `auto`, `sftp`, or `ftp` |
| `clean` | — | `false` | Delete remote files before upload |
| `environment` | — | `production` | GitHub deployment environment |
| `source-dir` | — | `out` | Local directory to upload |

## How it works

1. **Install** — `npm ci` (or your install command)
2. **Build** — `npm run build` (catches errors early)
3. **Deploy** — either via Git auto-deploy (Hostinger handles it) or file upload (SFTP/FTP)
4. **Status** — creates ✅/❌ on commits via GitHub Deployments API

## Development

```bash
npm ci
npm run build
```
