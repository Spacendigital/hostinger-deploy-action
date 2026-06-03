<div align="center">

# Hostinger Deploy Action

**Vercel-style deployment tracking for Hostinger**

[![Status: WIP](https://img.shields.io/badge/status-WIP-yellow?style=flat-square)](https://github.com/Spacendigital/hostinger-deploy-action)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)
[![GitHub release](https://img.shields.io/github/v/release/Spacendigital/hostinger-deploy-action?style=flat-square)](https://github.com/Spacendigital/hostinger-deploy-action/releases)

---

> **⚠️ WORK IN PROGRESS**
> 
> This action is not yet stable. APIs, inputs, and behavior may change without notice.
> Contributions and testing are welcome, but we don't recommend using this in production workflows yet.

</div>

## What is this?

A GitHub Action that connects to your Hostinger server via SSH, pulls the latest code, builds your app, and posts a commit status check — just like Vercel.

## Features

- **Commit status checks** — ✅/❌ on every push with a link to the live site
- **Environments tab** — deployment history in your repo sidebar (like Vercel)
- **Auto-detection** — scans your server and finds the right site by matching git remotes
- **Real build verification** — actually runs `npm ci && npm run build` on the server and reports the real result

## Quick Start

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

---

<div align="center">

**Built with ❤️ for the Hostinger community**

</div>
