# Build Plan

## Phase 1 — MVP (current)
- [x] Create action skeleton (action.yml, package.json, tsconfig)
- [x] Implement SFTP upload of `out/` folder (static export)
- [x] Implement GitHub Deployments API calls
- [ ] Get it working end-to-end on spacend.ws
- [ ] Verify commit checks show ✅/❌ and Deployments tab populates

## Phase 2 — Polish and generalize
- [ ] Add SSH + PM2 support (VPS mode)
- [ ] Add FTP support (not just SFTP)
- [ ] Add clean option (delete before upload)
- [ ] Add --dry-run mode for testing
- [ ] Write comprehensive README with setup instructions
- [ ] Add example workflows for different scenarios

## Phase 3 — Publish to GitHub Marketplace
- [ ] Write LICENSE (MIT)
- [ ] Create a release with semantic versioning
- [ ] Submit to GitHub Actions Marketplace
- [ ] Document in README with badges, screenshots, quick-start

## Phase 4 — Marketing and monetization
- [ ] Post on dev.to, Reddit (r/nextjs, r/webdev), HN
- [ ] Approach Hostinger: propose official deploy Action → partnership
- [ ] Optional: paid SaaS layer (dashboard, rollback, preview URLs)
- [ ] Write cost comparison (Vercel vs Hostinger + self-hosted)
