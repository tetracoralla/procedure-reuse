# Clean environment

Platform for the first-time path: **Linux x64 + Node 22**.

This file is the entry that does **not** use an author `bin/`, `.tools/`,
`repos/`, leftover `dist/`, or a previous session. Start from a git commit of
**this** repository.

## 1. Get this repository at a known commit

```bash
git clone https://github.com/tetracoralla/procedure-reuse.git
cd procedure-reuse
git checkout <commit>   # the SHA under review, or the PR branch
node -v                 # v22.x
```

Node 22 can come from https://nodejs.org/dist/ or `actions/setup-node`.
Do not require `.tools/node`.

## 2. Minimum checks (no Go, no File Vitals binary)

```bash
sh scripts/verify-clean.sh --node-only
```

That runs `node --test` on the key drafts. Cases that need the File Vitals
JSONL adapter **skip** unless the adapter is already on disk. Fake-adapter
tests, write-bound generate tests, PNG pixel tests, binding tests, and
compose-scaffold init still run.

Compose scaffold init no longer imports
`repos/agent-tool-development-kit/src/contracts.mjs`.

## 3. File Vitals (only when you need inspect)

Pinned source is in `deps/pins.json`:

- repo: `https://github.com/tetracoralla/file-vitals.git`
- commit: `53ed0ac412e1821bf068c87e4ff7aae899c49347`
- Go: **1.26.6+** from https://go.dev/dl/

```bash
sh scripts/fetch-deps.sh --file-vitals
# writes gitignored .deps/file-vitals at the pinned commit
# does not run scripts from that clone

sh scripts/build-file-vitals.sh --all-drafts
# uses FILE_VITALS_SRC or .deps/file-vitals
# builds cmd/finspect and cmd/capability-adapter only
# go build may download modules listed in that checkout's go.mod

export REQUIRE_FILE_VITALS=1
sh scripts/verify-clean.sh --with-file-vitals
```

Overrides:

- `FILE_VITALS_SRC` — existing checkout of the pinned commit
- `GO_BIN` — `go` binary (otherwise `go` on PATH; not `.tools/go` unless you set it)
- `GOTOOLCHAIN=auto` — official Go toolchain fetch of go1.26.6 from go.dev
- `FILE_VITALS_ADAPTER` — already-built JSONL adapter

Do not point these scripts at an unpublished tarball or an author-only path.

## 4. Sealed packs follow source

`dist/*.tar.gz` is gitignored. After you change a Skill, combinator, or
`package-component.mjs`, rebuild the pack before treating an archive as
evidence for the new source:

```bash
sh scripts/fetch-deps.sh --kit --file-vitals
# Node 22 + Kit npm ci inside .deps/agent-tool-development-kit
sh scripts/build-file-vitals.sh --all-drafts
node .deps/agent-tool-development-kit/src/cli.mjs pack --root drafts/asset-delivery-preflight --json
```

`scripts/verify-clean.sh` never reads `dist/` as a pass. If a leftover archive
is present it prints a note and continues.

## 5. Optional Kit / contract clones

Needed for `openadam-dev check` / `pack` and `procedure/check.mjs`, **not**
for the minimum `node --test` path.

```bash
sh scripts/fetch-deps.sh --kit --procedure-contracts --capability-contracts
```

Env: `OPENADAM_DEVKIT_ROOT`, `PROCEDURE_CONTRACTS_SRC`, `CAPABILITY_CONTRACTS_SRC`.

## CI

The workflow YAML is [`docs/ci.github.yml`](ci.github.yml) (Linux x64 + Node 22).
GitHub rejects creating `.github/workflows/*.yml` from an OAuth token that
lacks the `workflow` scope. With that scope (or from the Actions UI):

```bash
mkdir -p .github/workflows
cp docs/ci.github.yml .github/workflows/ci.yml
git add .github/workflows/ci.yml
git commit -m "Install GitHub Actions workflow."
git push origin review/asset-delivery-methods
```

Until then, the local equivalent is the commands below. When the workflow
file is on the default-allowed path it runs on push and pull_request:

- `node-tests` — `scripts/verify-clean.sh --node-only` on Node 22
- `file-vitals` — setup-go 1.26.6, fetch the pin, build, then
  `REQUIRE_FILE_VITALS=1 scripts/verify-clean.sh --with-file-vitals`

Results attach to the commit that produced the workflow run.
