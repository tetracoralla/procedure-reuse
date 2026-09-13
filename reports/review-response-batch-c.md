# Review response — Batch C (real-task side, no Host install)

Date: 2026-09-13  
On branch: `review/asset-delivery-methods` (includes Batch A + B)  
This round: one delivery job with written acceptance; usage and light authoring from HANDOFF / CLEAN_ENV / README; a naive-script comparison.  
Not this round: a sixth method product, Host changes, format expansion, merge, visibility/history edits, a claim that an independent third party took the handoff.

**Marker:** `synthetic-authorized-substitute`

The program is **not** done. A green campaign on a synthetic pack is not M4 “independent handoff” and not a production store listing.

## 1. Task choice (honest)

No user-authorized real artwork pack was in this workspace or in the review materials. Batch C therefore did **not** ingest a brand zip.

Substitute: **Northline Transit rider-app v1 store listing** — a fictional municipal-agency pack with acceptance written as if release engineering will refuse upload until the checklist matches.

| Property | Value |
| --- | --- |
| Marker | `synthetic-authorized-substitute` |
| Why this shape | Two kit kinds the existing combinators already know (`asset-delivery` + `channel-cover`), new names and sizes, a JPEG slot, an alpha-present / alpha-absent mix |
| Not | `fixtures/good` renamed, not M4 `kiosk-badge` / `docs-social` copied |
| Uniqueness | 23 new image files; sha256 overlap with 120 other repo images = **0** (`reports/batch-c/observations/uniqueness.json`) |
| Acceptance | `reports/batch-c/task/ACCEPTANCE.md` |

Slots (v1):

| Kit | Kind | Files |
| --- | --- | --- |
| `app-tiles` | asset-delivery | `tile-20/40/80.png` 20/40/80, alpha present; `lockup.png` 180×36, alpha absent |
| `station-boards` | channel-cover | `board-square.png` 90×90 1:1; `board-wide.jpg` 180×60 3:1; `board-tall.png` 60×180 1:3; no transparency |

First drop is **supposed to fail**: `board-wide.jpg` is 180×64 (height + aspect). That is the required intentional fail.

This session was **directed** at the CLI/Skill entry. That is a handoff, not evidence that a live Agent Host session would have picked the Skill on its own.

## 2. Usage rehearsal (cold entry)

Materials read first: root `README.md`, `docs/CLEAN_ENV.md`, `drafts/batch-delivery-preflight/HANDOFF.md`, `handoff/AGENT.md`. MCP tool `batch_delivery_preflight` is **not** in this session; AGENT.md says use the CLI.

Work directory: **`/tmp/batch-c-northline`** (copy of `reports/batch-c/task`). In-tree fixtures were not used as `--root`.

PATH isolated to `/usr/local/bin:/usr/bin:/bin` so author `/workspace/openadam-procedure-reuse/.tools/node` is not selected. Node: **v20.19.2** `/usr/bin/node`.

### Adapter (CLEAN_ENV, not leftover bins)

HANDOFF says: if `bin/capability-adapter` exists, skip rebuild. Gitignored leftover binaries from 2026-09-12 were on disk. CLEAN_ENV was followed instead:

```bash
export GOTOOLCHAIN=go1.26.6   # system go is 1.24.4; auto still reports 1.24.4
sh scripts/fetch-deps.sh --file-vitals
sh scripts/build-file-vitals.sh --all-drafts
```

Pin: `tetracoralla/file-vitals` @ `53ed0ac412e1821bf068c87e4ff7aae899c49347`.  
Go: official `go1.26.6` toolchain from go.dev via `GOTOOLCHAIN`. Author `.tools/go` (also 1.26.6) was **not** used. Adapter mtime on this run: 2026-09-13 09:21.

### Friction log

| Item | Count | Notes |
| --- | ---: | --- |
| Follow-up questions to a human | **0** | Campaign root / which JSON / whether fail ships: written in ACCEPTANCE + HANDOFF |
| Path or cwd changes | **2** | (1) HANDOFF still prints `/workspace/openadam-procedure-reuse/` — that directory exists and is a **different** tree; this clone is `/workspace/procedure-reuse-staging`. (2) `node src/cli.mjs` from the repo root → `MODULE_NOT_FOUND`; `cd drafts/batch-delivery-preflight` as HANDOFF already says |
| Pass/fail misread | **0** | `status: fail` was the answer; the same command was not retried |
| Rework | **1 file** | `board-wide.jpg` 180×64 → 180×60. Specs unchanged for that fix |

Also hit (already documented, still true): HANDOFF-style `handoff/tasks/...` relative paths from the repo root → `ENOENT`. Extra `README.md` inside a kit root → `extra` (HANDOFF already forbids it; confirmed on a copy).

### Results (CLI)

From `drafts/batch-delivery-preflight`, absolute `--spec` / `--root` under `/tmp/batch-c-northline`:

| Run | Exit | `status` | `failedKits` | `failedIds` | Checks |
| --- | ---: | --- | --- | --- | ---: |
| `campaign.json` + `delivery` (180×64 JPEG) | 1 | fail | `["station-boards"]` | `["height","aspect"]` | 59 |
| same spec + `delivery-fixed` (180×60) | 0 | pass | `[]` | `[]` | 59 |
| kit-root `README.md` extra (copy) | 1 | fail | `["app-tiles"]` | `["extra"]` | — |

Failed row on the first drop (did not retry):

- kit `station-boards`, slot `board-wide`, `height` expected 60 observed 64
- same slot, `aspect` expected `3:1` observed `45:16`

App-tiles still passed on the failing campaign. Observer: `org.openadam.file.inspect@0.1.0`. Binding: `sibling-draft` (no packed `deps/` in this authoring tree). Inspect grant stayed at each kit root.

JSON: `reports/batch-c/observations/usage-fail.json`, `usage-pass.json`, `usage-extra.json`. Log: `reports/batch-c/observations/run-log.md`.

## 3. Authoring (light): spec change, not a sixth method

Scaffold `compose-procedure-preflight` would have emitted a **new** method shell (`CORE_NOT_IMPLEMENTED`, new Skill, new `agent-tool.json`). That is a sixth product. It was **not** used.

Change from the task addendum: store listing now requires `tile-120.png` 120×120, alpha present.

| File | Kind | Role |
| --- | --- | --- |
| `kits/app-tiles-v2.json` | domain spec | one extra slot |
| `campaign-v2.json` | domain spec | `specPath` → v2 kit spec |
| `delivery-v2/app-tiles/tile-120.png` | domain pixel | the new file |
| combinator / schema / Skill / MCP / `agent-tool.json` / procedure profile | mechanical | **0 files** |

Proof that the spec changes execution (same CLI, same observer):

| Spec | Root | Result |
| --- | --- | --- |
| v1 campaign | `delivery-fixed` (no tile-120) | pass, 59 checks |
| v2 campaign | **same** `delivery-fixed` | **fail**, `failedKits=["app-tiles"]`, `failedIds=["missing"]`, slot `tile-120` |
| v2 campaign | `delivery-v2` (file added) | pass, 67 checks |

Generate CLI, same 256×256 master, `--generate-only`:

| Spec | Written |
| --- | --- |
| `kits/app-tiles.json` | `tile-20`, `tile-40`, `tile-80`, `lockup` (4 files) |
| `kits/app-tiles-v2.json` | those four **plus** `tile-120.png` (5 files) |

v2 generate then preflight: `stage=preflight`, `status=pass`. Assembling generated v2 tiles with the station-board kit and running the **batch** CLI on `campaign-v2.json`: pass, 67 checks.

JPEG station boards are still outside generate (PNG only). That is M5’s bound, not expanded.

## 4. Naive alternative (same acceptance)

ImageMagick is **not** on PATH here. The alternative is `reports/batch-c/naive/check.py` (~170 lines): campaign JSON + kit specs, PNG IHDR, `ffprobe` for JPEG, missing/extra, aspect via gcd, alpha from PNG color type (JPEG assumed opaque).

On this pack it **matched** the combinator for fail / pass / missing-tile-120 / extra-README / assembled-generated.

| The short script can | The short script does not |
| --- | --- |
| Name, pixel size, PNG/JPEG signature, missing, extra, aspect | File Vitals `result.status` / integrity / error diagnostics (`corrupt` / `unsupported` / `partial`) |
| PNG color-type as a stand-in for alpha | Omitted `has_alpha` = unknown (IHDR always “knows”) |
| One campaign if you keep maintaining the script | Two-layer dispatch without copying slot rules; inspect grant per kit root; source-write bounds; generate-from-spec |
| Exit 0/1 | Usage vs domain (`exit 2`) and `failedIds` as a shared vocabulary you did not just invent |

Honest increment for **this** 7-file pack: a new Python checker is enough for the happy-path technical list. The method’s value is **not** “you cannot check width without 15 directories.” It is: do not rewrite that checker for the next campaign; keep observation on `file.inspect`; keep slot rules in the lower modules; keep generate tied to the same spec.

Overhead that this user task **did not need**: Procedure JSONL, MCP, sealed pack, Host import, scaffold, a new Skill. Those directories were already there from M1–M5; Batch C did not add them.

Relative to “just more folders”: **no** — for a team that already has the CLI, the extra work of this job was domain JSON + pixels. Relative to a one-off with no combinator: the naive script is cheaper **this once**, and becomes the thing you rewrite next time.

## 5. Completeness (still not “the program is done”)

| Milestone | After Batch C |
| --- | --- |
| M1 | Domain preflight prototype. Used here as the icon-kit lower method. Not a long-term production contract. |
| M2 | Second method via authoring path. Used here as the cover-kit lower method. Not a general authoring product. |
| M3 | Two-layer function reuse. The campaign CLI dispatched both lowers. Not Capability Provider registration / swappability / composition conformance. |
| M4 | Still a **handoff drill**. This round is a **new session** following HANDOFF + CLEAN_ENV, not an independent third-party human, and not Host Skill selection. |
| M5 | Still a **narrow PNG generate** slice. Used to show spec-v2 writes `tile-120`. No JPEG generate, no format expansion. |
| Batch A | Write bounds / grants / PNG / inspect status / bindings — not reopened. |
| Batch B | Clean-env pin + local verify path — used (fetch + official Go 1.26.6). GitHub Actions workflow file still cannot be created with this OAuth token (`workflow` scope missing). |
| Batch C | One synthetic pack with real-style acceptance, CLI usage, spec-delta authoring, naive comparison. **Not** a claim that authoring-and-reuse is complete. |

Not done, still:

- Independent third-party handoff
- Live Agent Host session choosing the Skill
- User-authorized real artwork
- Kit `check` / `pack` as part of this user task (not required to preflight)
- JPEG (or other) generate
- Merging drafts into Host

## 6. Files in this round

Added under `reports/batch-c/` (task specs, pixels, naive checker, observations). Report: this file. Completeness: root `README.md`, `HANDOFF.md` stale work-root, `reports/m4-handoff.md` note.

No new draft method. No Host patch. No merge.
