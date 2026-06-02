## Architecture

This is a JavaScript GitHub Action (`action.yml` → `runs.using: 'node20'` → `main: 'dist/index.js'`). The entry point `dist/index.js` is a bootstrap that installs runtime deps via `npm ci --production` if `node_modules` is missing, then loads `dist/main.js` which runs the deploy logic.

Three deploy modes controlled by `deploy-mode` input:
- `auto` (default) — build-only mode. Assumes Hostinger's Git integration auto-deploys. Just runs install + build + sets GitHub deployment status.
- `sftp` — uploads `source-dir` (default `out/`) via `ssh2-sftp-client`.
- `ftp` — reserved, not yet implemented.

## Build & Publish

- `npm run build` runs `tsc` only (no bundler). `src/` → `dist/`.
- `dist/` is tracked in git — it is what the runner executes.
- Tagging: `git tag -f v1 && git push -f origin v1`. The `v1` tag is force-moved to point at latest main. No GitHub Releases used.
- Prebuild script removes `dist/` before compile.

## Non-obvious gotchas

- **Deps install at runtime.** `src/index.ts` (bootstrap) runs `npm ci --production` in the action checkout dir before loading the main script. This means `node_modules/` must NOT be committed, but `package.json` and `package-lock.json` must be.
- **Native modules.** `ssh2-sftp-client` depends on `ssh2` which has native C++ addons. They are compiled for Linux on the runner during the bootstrap `npm ci`. This adds ~25s to each workflow run.
- **Inputs work via `INPUT_*` env vars.** `@actions/core` reads from `process.env['INPUT_LIVE-URL']`. This only works correctly with `runs.using: 'node20'` — composite actions break hyphenated input names.
- **`live-url` is optional.** When omitted, `environment_url` is not sent to the Deployments API. No link shown in the Deployments tab.
- **`clean` is parsed manually** (`core.getInput('clean')?.toLowerCase() === 'true'`). `getBooleanInput` is not used because it rejects empty defaults in composite action contexts.

## CI

`.github/workflows/test.yml` runs on push/PR to main: `npm ci` → `npm run build` → checks `dist/main.js` exists. No lint step, no typecheck step in CI (though tsc enforces types at build time).

## Evolution

The build plans in AGENTS.md should be reconciled by looking at `action.yml` inputs and `src/` modules. The current file has stale phase checklists. Replace them with whatever the actual next priorities are.

## Versioning convention

Consumers reference the action as `spacendigital/hostinger-deploy-action@v1`. The `v1` tag is a moving branch-tag pointing at latest main. Breaking changes would warrant a `v2` tag.
