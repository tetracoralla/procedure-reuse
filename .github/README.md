GitHub Actions workflow for this branch is `docs/ci.github.yml`.

Copy it to `.github/workflows/ci.yml` with a token that has the `workflow`
scope (`gh auth refresh -s workflow`), then push. Creating or updating
files under `.github/workflows/` is blocked for OAuth tokens that only
have `repo`.
