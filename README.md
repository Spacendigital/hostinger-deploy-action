# Hostinger Deploy Action

A GitHub Action to deploy Next.js apps to Hostinger via SFTP/SSH with Vercel-like commit status checks.

## Usage

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
          node-version-file: .nvmrc
      - uses: spacendigital/hostinger-deploy-action@v1
        with:
          host: ${{ secrets.HOSTINGER_HOST }}
          username: ${{ secrets.HOSTINGER_USERNAME }}
          password: ${{ secrets.HOSTINGER_PASSWORD }}
          target-dir: ${{ secrets.HOSTINGER_TARGET_DIR }}
          live-url: https://spacend.ws
```

## Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `host` | ✅ | — | Hostinger server hostname or IP |
| `username` | ✅ | — | SFTP/SSH username |
| `password` | — | — | SFTP/SSH password |
| `private-key` | — | — | SSH private key (alternative to password) |
| `target-dir` | ✅ | — | Remote directory (e.g. `/public_html`) |
| `live-url` | ✅ | — | Live site URL |
| `build-command` | — | `npm run build` | Build command |
| `install-command` | — | `npm ci` | Install command |
| `deploy-mode` | — | `sftp` | `sftp` or `ftp` |
| `clean` | — | `false` | Delete remote files before upload |
| `environment` | — | `production` | GitHub deployment environment |
| `source-dir` | — | `out` | Local directory to upload |

## Setup

1. Add these secrets in your GitHub repo (Settings → Secrets and variables → Actions):
   - `HOSTINGER_HOST`
   - `HOSTINGER_USERNAME`
   - `HOSTINGER_PASSWORD`
   - `HOSTINGER_TARGET_DIR`

2. Create `.github/workflows/deploy.yml` with the example above.

## Development

```bash
npm ci
npm run build
```

The compiled output goes to `dist/main.js`.
