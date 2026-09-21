# Batch C usage log

Marker: `synthetic-authorized-substitute`  
Work directory: `/tmp/batch-c-northline` (copy of `reports/batch-c/task`)  
Node: `/usr/bin/node` v20.19.2 (PATH isolated from author `.tools`)  
Adapter: rebuilt 2026-09-13 from pinned File Vitals `53ed0ac` with `GOTOOLCHAIN=go1.26.6`

## Friction

| Item | Count | What happened |
| --- | ---: | --- |
| Follow-up questions to a human | 0 | Campaign root, spec, and fail-is-not-ship were in `ACCEPTANCE.md` + `HANDOFF.md` |
| Path / cwd changes | 2 | (1) HANDOFF still names `/workspace/openadam-procedure-reuse/` — that tree exists and is **not** this clone; stayed in `/workspace/procedure-reuse-staging`. (2) `node src/cli.mjs` from the repo root → `MODULE_NOT_FOUND`; `cd drafts/batch-delivery-preflight` as HANDOFF already says |
| Pass/fail misread | 0 | First drop `status: fail` was treated as the answer. Same command was not retried |
| Rework | 1 file | Replaced `board-wide.jpg` 180×64 with 180×60. Specs unchanged for that fix |

## Entry traps actually hit

1. Repo root + `node src/cli.mjs` → cannot find module.
2. Repo root + HANDOFF-style `handoff/tasks/...` relative paths → `ENOENT` (those paths are under the project directory).
3. HANDOFF “if `bin/capability-adapter` exists, skip rebuild” would have used leftover gitignored bins. CLEAN_ENV was followed instead: `scripts/fetch-deps.sh --file-vitals` + `scripts/build-file-vitals.sh --all-drafts`.
4. System Go is 1.24.4. CLEAN_ENV’s `GOTOOLCHAIN=auto` still reports 1.24.4; `GOTOOLCHAIN=go1.26.6` fetched the official toolchain from go.dev. Author `.tools/go` (also 1.26.6) was **not** used.

## Commands (after `cd drafts/batch-delivery-preflight`)

```bash
/usr/bin/node src/cli.mjs --spec /tmp/batch-c-northline/campaign.json --root /tmp/batch-c-northline/delivery --compact
# exit 1  fail  station-boards  height+aspect  180x64 vs 180x60 / 45:16 vs 3:1

/usr/bin/node src/cli.mjs --spec /tmp/batch-c-northline/campaign.json --root /tmp/batch-c-northline/delivery-fixed --compact
# exit 0  pass  59 checks

/usr/bin/node src/cli.mjs --spec /tmp/batch-c-northline/campaign-v2.json --root /tmp/batch-c-northline/delivery-fixed --compact
# exit 1  fail  app-tiles  missing tile-120.png

/usr/bin/node src/cli.mjs --spec /tmp/batch-c-northline/campaign-v2.json --root /tmp/batch-c-northline/delivery-v2 --compact
# exit 0  pass  67 checks
```
