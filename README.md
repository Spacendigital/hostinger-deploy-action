# Hostinger Deploy Action

**Vercel-style deployment tracking for Hostinger.** Push to GitHub, get:
- ✅/❌ commit status checks with live site URL
- A **Production** environment in your GitHub **Environments** tab with full deployment history
- Real-time build logs (optional)

Same workflow experience as Vercel. No API keys, no third-party services. Just SSH and your Hostinger plan.

Works with Hostinger Cloud Startup, Cloud, and Business plans that support Node.js hosting with Git auto-deploy.

## Features

- **Zero configuration.** Auto-detects your site by scanning server directories and matching git remotes. No domain or path needed.
- **Commit status checks.** Every push creates a ✅ or ❌ on your commit with a link to the live site. Works in PRs too.
- **Environments tab.** Each deployment appears in your GitHub repository's **Environments** page, just like Vercel. Shows deployment history, timestamps, and links to the live site. Accessible from the right sidebar of your repo.
- **Doesn't touch your files.** The default mode (`ssh`) only reads. No `git pull`, no `npm install`, no build commands. Hostinger's built-in auto-deploy handles everything.
- **Optional build output.** Set `build-command: npm run build` to see real-time build logs in your action run.
- **SFTP fallback.** Supports file upload for shared hosting that doesn't have Git auto-deploy.

## Prerequisites

1. **Hostinger plan** with Node.js support (Cloud Startup, Cloud, or Business).
2. **Git auto-deploy** connected in hPanel for your site. Go to Settings, Git, and connect your GitHub repository.
3. **SSH Access** enabled:
   - Go to **hPanel** → **Website Dashboard** → **Advanced** → **SSH Access**
   - Click **Enable**
   - Note your SSH credentials (host, username, password)
4. **GitHub repository secrets** with your SSH credentials.

## Quick Start

### 1. Add secrets to your GitHub repository

Go to **Settings** → **Secrets and variables** → **Actions** → add these:

| Secret | Value |
|--------|-------|
| `HOSTINGER_HOST` | Your server IP or hostname |
| `HOSTINGER_USERNAME` | Your SSH username |
| `HOSTINGER_PASSWORD` | Your SSH password |
| `HOSTINGER_PORT` | SSH port (usually `65002`) |

### 2. Create a workflow file

`.github/workflows/deploy.yaml`:

```yaml
name: Deploy to Hostinger

on:
  push:
    branches: [main]

permissions:
  contents: read
  deployments: write

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: spacendigital/hostinger-deploy-action@v1
        with:
          host: ${{ secrets.HOSTINGER_HOST }}
          username: ${{ secrets.HOSTINGER_USERNAME }}
          password: ${{ secrets.HOSTINGER_PASSWORD }}
          port: ${{ secrets.HOSTINGER_PORT }}
```

### 3. Push to `main` and see the result

Every push creates a deployment check on your commit. Green checkmark ✅ with a link to your live site. Red cross ❌ if something went wrong.

## How Auto-Detection Works

The action connects via SSH and scans your server for the matching site:

1. **Scans** all directories under `~/domains/*/public_html/.builds/last-source/`
2. **Matches** each one against your current GitHub repository by checking `git remote get-url origin`
3. **Extracts** the domain from the matched path (e.g., `your-site.hostingersite.com`)
4. **Verifies** the `nodejs/` directory exists for that domain
5. **Reports** success with `https://{domain}` as the live URL

This works with temporary Hostinger domains, custom domains, and domain changes. The git remote doesn't change, so the match always succeeds.

If auto-detection fails (e.g., Git auto-deploy is not connected), provide the `domain` or `target-dir` input explicitly.

## Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `host` | ✅ | — | Server hostname or IP. Store as secret. |
| `username` | ✅ | — | SSH username. Store as secret. |
| `password` | — | — | SSH password. Store as secret. |
| `private-key` | — | — | SSH private key content (alternative to password). |
| `port` | — | `22` | SSH port. Store as secret. |
| `domain` | — | — | Your site domain (e.g., `kellshot.com`). Skips auto-detection. |
| `target-dir` | — | — | Full server path (e.g., `/home/user/domains/site.com/nodejs`). Alternative to `domain`. |
| `live-url` | — | — | Live site URL. Auto-detected from domain if omitted. |
| `deploy-mode` | — | `ssh` | `ssh` or `sftp`. |
| `build-command` | — | — | Build command (e.g., `npm run build`). Empty by default. Hostinger handles the build. |
| `install-command` | — | — | Install command (e.g., `npm ci`). Only used if `build-command` is set. |
| `environment` | — | `production` | GitHub deployment environment name. |
| `clean` | — | `false` | Delete remote files before upload (sftp only). |
| `source-dir` | — | `out` | Directory to upload (sftp only). |
| `token` | — | `${{ github.token }}` | GitHub token for deployment status. Usually not needed. |

## Advanced Usage

### Explicit domain (skip auto-detection)

```yaml
- uses: spacendigital/hostinger-deploy-action@v1
  with:
    host: ${{ secrets.HOSTINGER_HOST }}
    username: ${{ secrets.HOSTINGER_USERNAME }}
    password: ${{ secrets.HOSTINGER_PASSWORD }}
    port: ${{ secrets.HOSTINGER_PORT }}
    domain: kellshot.com
```

### With build output (see logs in action run)

```yaml
- uses: spacendigital/hostinger-deploy-action@v1
  with:
    host: ${{ secrets.HOSTINGER_HOST }}
    username: ${{ secrets.HOSTINGER_USERNAME }}
    password: ${{ secrets.HOSTINGER_PASSWORD }}
    port: ${{ secrets.HOSTINGER_PORT }}
    install-command: npm ci
    build-command: npm run build
```

### SFTP upload (shared hosting without Git auto-deploy)

```yaml
- uses: spacendigital/hostinger-deploy-action@v1
  with:
    host: ${{ secrets.HOSTINGER_HOST }}
    username: ${{ secrets.HOSTINGER_USERNAME }}
    password: ${{ secrets.HOSTINGER_PASSWORD }}
    target-dir: /public_html
    deploy-mode: sftp
    build-command: npm run build
    install-command: npm ci
```

## Security Best Practices

- **Store everything in secrets.** Host, username, password, and port should all be GitHub repository secrets. Only the workflow file is public if your repo is public.
- **Use SSH keys instead of passwords** if possible. Provide the private key content via `private-key` input (store as secret).
- **Minimum permissions.** The workflow only needs `contents: read` and `deployments: write`.

## Troubleshooting

| Problem | Likely Cause | Fix |
|---------|-------------|-----|
| `No matching git repo found` | Git auto-deploy not connected in hPanel | Connect your repo in Hostinger → Settings → Git, or provide `domain` input |
| `Could not auto-detect project directory` | SSH works but no matching site found | Provide `domain` input (your site's domain) |
| SSH connection timeout | Port blocked or SSH not enabled | Enable SSH in hPanel → Advanced → SSH Access |
| `Permission denied` | Wrong credentials | Verify host, username, password in secrets |
| Node.js 20 deprecation warning | GitHub is phasing out Node 20 | Add `env: { FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true }` to your workflow |

## How It Works

```
Push to main
    │
    ▼
GitHub Actions triggers workflow
    │
    ▼
Action connects via SSH (password or key)
    │
    ├── Scans ~/domains/*/public_html/.builds/last-source/ for matching git remote
    │
    ├── Detects site domain and extracts live URL
    │
    ├── (Optional) Runs install + build commands on the server
    │
    └── Creates ✅/❌ on commit with live URL via GitHub Deployments API
           │
           └── Populates the Environments tab in your repo sidebar
```

Every deployment is recorded in your repository's **Environments** page, accessible from the right sidebar. You can see at a glance when each deployment happened, what was deployed, and open the live site. This is the same experience Vercel provides.

No API tokens, no SSH config files, no hardcoded paths. The action reads your server state and never writes to it.

## Development

```bash
npm ci
npm run build
```

## License

MIT
