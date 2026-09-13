# Review response — Batch B (clean-environment reproducibility)

Date: 2026-09-13  
On branch: `review/asset-delivery-methods` (includes Batch A)  
Platform documented: Linux x64 + Node 22  
This round: Batch B only.  
Not this round: Batch C real-user Agent task (plan only), sixth method, Host merge, visibility/history changes, force-push.

The program is **not** done. A green `node --test` on a clone is not an independent handoff.

## What changed

### Author-layout dependencies

| Old | Now |
| --- | --- |
| `drafts/devkit-compose-scaffold/src/init.mjs` imported `../../../repos/agent-tool-development-kit/src/contracts.mjs` | Local `src/project-document.mjs` (Kit semantic subset). Init tests no longer need a Kit checkout. |
| `build-file-vitals.sh` used `$ROOT/repos/file-vitals` and `.tools/go` | `scripts/build-file-vitals.sh` uses `FILE_VITALS_SRC` / `.deps/file-vitals` at the pin in `deps/pins.json`. `go` on PATH or `GO_BIN`. Draft wrappers exec the root script. |
| `procedure/check.mjs` and digest scripts joined `repos/procedure-contracts` | `FILE_VITALS_SRC`, `PROCEDURE_CONTRACTS_SRC`, `CAPABILITY_CONTRACTS_SRC`, or `.deps/<name>` after `scripts/fetch-deps.sh` |

`scripts/fetch-deps.sh` clones **only** `https://github.com/tetracoralla/*` at the SHA in `deps/pins.json`. It does not run scripts from those clones.

File Vitals pin:

- repo: `https://github.com/tetracoralla/file-vitals.git`
- commit: `53ed0ac412e1821bf068c87e4ff7aae899c49347`
- provider: `io.github.tetracoralla.file-vitals@0.3.3`
- Go: 1.26.6+

### Clean entry

[`docs/CLEAN_ENV.md`](../docs/CLEAN_ENV.md) is the first-time path from a commit of this repo. Root [`README.md`](../README.md) points at it.

```bash
git clone https://github.com/tetracoralla/procedure-reuse.git
cd procedure-reuse
git checkout <commit>
sh scripts/verify-clean.sh --node-only
```

No author `bin/`, `.tools/`, `repos/`, or leftover `dist/` is required.

### Minimum CI

Workflow YAML: [`docs/ci.github.yml`](../docs/ci.github.yml) (intended path
`.github/workflows/ci.yml`).

- `on`: push to `main` / `review/**`, pull_request, `workflow_dispatch`
- `node-tests`: Node 22, `sh scripts/verify-clean.sh --node-only`
- `file-vitals`: setup-go 1.26.6, `fetch-deps.sh --file-vitals`, `build-file-vitals.sh --all-drafts`, `REQUIRE_FILE_VITALS=1 sh scripts/verify-clean.sh --with-file-vitals`

Adapter-backed tests **skip** without a binary; the File Vitals job fails if they skip (`REQUIRE_FILE_VITALS=1`).

### Pack vs source

`dist/` stays gitignored. Docs say: after Skill or combinator source changes, rebuild the sealed pack before treating an archive as evidence. `verify-clean.sh` never reads `dist/` as a pass.

## How to run (local equivalent of CI)

Node-only (this environment: Node v20.19.2, bins moved aside):

```bash
sh scripts/verify-clean.sh --node-only
```

Result: pass, with adapter cases skipped. Compose-scaffold init 6/6 without Kit.

With File Vitals:

```bash
sh scripts/fetch-deps.sh --file-vitals
sh scripts/build-file-vitals.sh --all-drafts   # needs Go 1.26.6+
REQUIRE_FILE_VITALS=1 sh scripts/verify-clean.sh --with-file-vitals
```

Local fetch of the pin succeeded (`53ed0ac412e1821bf068c87e4ff7aae899c49347`). This sandbox's system Go is 1.24.4, so the File Vitals **build** job is what CI `setup-go` 1.26.6 is for. Adapter-backed tests were also run here against already-built `bin/` copies (not CI evidence): generate 26/26, asset-delivery-preflight 25/25, channel-cover 21/21, batch 16+5.

## CI run

Pushed this commit to `origin/review/asset-delivery-methods`.

GitHub refused to store `.github/workflows/ci.yml` because the `gh` OAuth
token here has scopes `gist, read:org, repo` and **not** `workflow`. The
identical YAML is `docs/ci.github.yml`. To install and trigger:

```bash
gh auth refresh -s workflow
mkdir -p .github/workflows
cp docs/ci.github.yml .github/workflows/ci.yml
git add .github/workflows/ci.yml
git commit -m "Install GitHub Actions workflow."
git push origin review/asset-delivery-methods
# or: GitHub → Actions → New workflow, paste docs/ci.github.yml
```

Local equivalent of the two jobs:

```bash
sh scripts/verify-clean.sh --node-only
# file-vitals job:
sh scripts/fetch-deps.sh --file-vitals
sh scripts/build-file-vitals.sh --all-drafts   # Go 1.26.6+
REQUIRE_FILE_VITALS=1 sh scripts/verify-clean.sh --with-file-vitals
```

## Still missing (Batch C and later)

- **True Agent user task** (Batch C): pick one authorized delivery job; a new Agent uses CLI/Skill/public deps only; Host install is not a prerequisite. Record extra explanation, files touched, rework, quality vs naive scripts.
- Full `openadam-dev check` / `pack` still needs a Kit clone + Node 22 + a rebuilt adapter. Not part of the minimum `node --test` job.
- `procedure/check.mjs` still needs procedure-contracts + capability-contracts clones (pins provided; not in the Node-only job).
- No sixth method. No format expansion. No Host merge.

This PR still does not prove the whole authoring-and-reuse program.
