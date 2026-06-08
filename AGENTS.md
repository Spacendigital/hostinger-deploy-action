## Architecture

JavaScript GitHub Action (`action.yml` → `runs.using: 'node20'` → `main: 'dist/index.js'`).

Bootstrap (`src/index.ts`) runs `npm ci --production` at runtime if `node_modules/` is missing, then loads `dist/main.js`. This means `node_modules/` must NOT be committed, but `package.json` + `package-lock.json` must be.

Two deploy modes (`deploy-mode` input):
- `ssh` (default) — SSHes in via `sshpass`, runs `git pull && npm ci && npm run build`, reports via GitHub Deployments API
- `sftp` — uploads `source-dir` (default `out/`) via `ssh2-sftp-client`

## Build & Publish

- `npm run build` runs `tsc` only (no bundler). `src/` → `dist/`.
- `prebuild` script removes `dist/` first.
- `dist/` is tracked in git — it is what the runner executes.
- Tagging: `git tag -f v1 && git push -f origin v1`. The `v1` tag is a moving branch-tag on latest main. No GitHub Releases.

## CI

`.github/workflows/test.yml`: `npm ci` → `npm run build` → checks `dist/main.js` exists. No lint or typecheck step, but `tsc` enforces types at build time.

## Hostinger server layout

```
~/domains/{domain}/
  public_html/.builds/last-source/  ← git repo (has remote origin)
  nodejs/                            ← deployed app (package.json, .next/, server.js)
```

Auto-detection (`findMatchingDir` in `ssh-deploy.ts`): scans `*/public_html/.builds/last-source` for `.git`, checks `git remote get-url origin` against `owner/repo`, extracts domain from path.

## Non-obvious gotchas

- **Deps install at runtime.** Each workflow run compiles native `ssh2` C++ addons on the runner. Adds ~20s to every run.
- **Inputs via `INPUT_*` env vars.** `@actions/core` reads `process.env['INPUT_LIVE-URL']`. Only works with `runs.using: 'node20'` — composite actions break hyphenated names.
- **`token` default is `${{ github.token }}`.** Must resolve for Deployments API calls. Without it, action silently skips deployment status with a warning.
- **`clean` is parsed manually** (`core.getInput('clean')?.toLowerCase() === 'true'`). `getBooleanInput` rejects empty defaults.
- **`domain` input preferred over `target-dir`.** Constructs `/home/{user}/domains/{domain}/nodejs` automatically.
- **SSH timeouts configured in `sshArgs()`:** `ConnectTimeout=15, ServerAliveInterval=10, ServerAliveCountMax=3`. Git remote lookup wrapped in `timeout 10`.
- **`sshpass` installed at runtime** via `apt-get` if password auth is used. Only on first `ensureSshpass()` call per runner.
- **`findMatchingDir` uses glob scan** over all `*/public_html/.builds/last-source` dirs. If the scan hangs, SSH connection is likely the issue (not the command itself).

## Stale context

The old `auto` and `ftp` deploy modes were removed. `build-command` and `install-command` now default to `npm run build` and `npm ci` (always runs on server). The action does NOT poll for Hostinger's own build completion — it runs its own build and reports that result.
