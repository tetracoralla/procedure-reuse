# Enable CI with GitHub Desktop (no new install)

Automation cannot push `.github/workflows/` with the current bot token.

## Once on branch `review/asset-delivery-methods`

1. Open this repo in **GitHub Desktop** (already enough).
2. Create folder `.github/workflows/` if missing.
3. Copy `docs/ci.github.yml` to `.github/workflows/ci.yml` (same contents).
4. Commit message example: `Enable GitHub Actions CI`.
5. Push the branch.

Actions will run on the next push/PR sync. No extra app or `gh` CLI required.
