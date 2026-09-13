# Review response — Batch A (correctness and bounds)

Date: 2026-09-13  
Fixed on: `0ea5124` (`review/asset-delivery-methods`)  
Node: v20.19.2  
This round: A1–A5 plus completion re-label only.  
Not this round: Batch B (clean-env CI), Batch C (real user task), a sixth method, Host merge, visibility/history changes.

The program is **not** done. M4 is a handoff drill. M5 is a narrow PNG slice.

## A1 — Generator write bounds

**Where:** `drafts/asset-delivery-generate/src/generate.mjs` (+ pipeline)

**Old wrong (reproduced in tests before calling the fixed writer):**

| Case | 0ea5124 behavior |
| --- | --- |
| Directory alias of the source dir + `--overwrite` | `dest === sourcePath` is string equality after `resolve`. `alias/master.png` ≠ `real/master.png`, so the source inode was overwritten. |
| Dangling dest symlink, default no-overwrite | `access()` follows links and treats a dangling link as missing; `writeFile` then creates the target **outside** `--out`. |
| Second-slot I/O error | Sequential `writeFile`; first output stayed with no `partial` / `written` on the failure. |

**Fix:**

- Source protection is realpath + `{dev,ino}` (symlinks and hard links).
- Output walk uses `lstat`. Intermediate symlinks that resolve outside the canonical `--out` are `PATH_FORBIDDEN`.
- Dest that is a symlink is never followed. Default mode: treat it as existing (`OUTPUT_EXISTS`, exclusive `O_EXCL\|O_NOFOLLOW`). `--overwrite`: unlink the link, then create a regular file inside `--out`.
- Default no-overwrite is exclusive-create at write time, not only a prior `access()`.
- Chosen partial semantics: **report remaining writes**. Spec-stage failures still write nothing. Mid-write I/O failures set `output.partial` and `output.written`. This is not all-or-nothing and not an OS sandbox.

**New green:** `node --test src/generate.test.mjs src/png.test.mjs` — 26/26.

**Not covered:** TOCTOU against a privileged swap of a path component after `lstat`; bind-mount aliases that do not share inode; cancellation; concurrent writers; Windows junctions.

## A2 — Batch grant must not expand

**Where:** `drafts/batch-delivery-preflight/src/preflight.mjs`, `src/mcp-server.mjs`

**Old wrong:** After MCP/`--workspace-root` checked the campaign root, each kit used a lexical `isOutside` check, then `realpath(kitRoot)` was passed to the lower combinator as a **new** File Vitals grant. A kit directory that was a symlink to a folder outside the original grant expanded the child grant. Reviewer excerpt: `nested-kit-grant-expands-outside-parent`.

**Fix:**

- Campaign root must realpath-inside the workspace grant.
- Kit root is resolved from the **canonical** campaign root; every symlink on that path, and the final realpath, must stay inside the campaign grant.
- Kit `specPath` is the same against the campaign spec directory.
- Lower `runPreflight` receives `workspaceRoot = inspectRoot` only after that inspect root is proven inside the original grant (inherit/tighten, never an escaped realpath).
- MCP maps grant-escape errors to `PATH_FORBIDDEN`.

**New green:** kit symlink outside grant is rejected from `runPreflight` and from MCP `tools/call`. Existing two-kit CLI/MCP cases still pass.

**Not covered:** TOCTOU replacement of a kit directory between `stat` and `realpath`; a symlink that leaves the grant and returns (final realpath inside); concurrent path swaps. Static containment is not an OS sandbox.

## A3 — Image correctness

**Where:** `drafts/asset-delivery-generate/src/png.mjs`

**Old wrong (algorithm excerpt, same numbers as `targeted_results.json`):**

- Opaque red + fully transparent blue, 2×1 → 1×1: independent RGBA mean `[128,0,128,128]` (hidden blue tint). Premultiplied box: `[255,0,0,128]`.
- Black-white-black 3×1 → 2×1: `[0,0,0, 128,128,128]` (pixel-count, not area). Area-weighted: `[85,85,85, 85,85,85]`.
- `inflateSync` without `maxOutputLength`: compressed ~1 KiB could allocate 1 MiB before a length check.

**Fix (mature codec, not a larger handwritten decoder):**

- Decode/encode: vendored **pngjs 7.0.0** (`third_party/pngjs`, MIT).
- Downscale: premultiplied-alpha, area-weighted box filter in this module (product rule: cover-crop, no upscale).
- Admission before pngjs: signature, IHDR 8-bit RGB/RGBA non-interlaced, max dimension 4096, max pixels, max input 32 MiB, inflated-raster budget.
- Support is **not** expanded: palette, grayscale, 16-bit, interlaced, APNG, JPEG still fail at generate.

**New green:** pixel tests for both reviewer cases; RGB/RGBA roundtrip; oversize/palette/interlace rejection; inflate allocation demonstration kept as Node zlib evidence (pngjs is no longer the inflater we call).

**Not covered:** non-integer scale golden images beyond 3→2 and 2→1; color-managed / 16-bit / gamma; comparing pngjs bytes to ImageMagick; a hard `maxOutputLength` inside pngjs itself (we bound IHDR and input size instead).

## A4 — Preflight path and observation status

**Where:** `drafts/asset-delivery-preflight/preflight.mjs`; shared logic in `drafts/channel-cover-preflight/` (`src/preflight.mjs`, `lib/observe-file-inspect.mjs`)

**Old wrong:**

- Files were listed relative to `--root`, but inspect requests used the same relative path with `workspaceRoot` as the File Vitals grant. When `root` was a subdirectory of `workspaceRoot`, a same-named file at the grant root was inspected instead of the delivery file.
- `compareSlot` treated envelope `ok:false` only. `result.status` `corrupt` / `unsupported` / `partial`, `integrity`, and error diagnostics never entered the suite conclusion, so a matching width/height on a corrupt observation could still be overall `pass`.

**Fix:**

- Inspect path = delivery file relative to the inspect grant (`delivery/icon-16.png` when the grant is a parent). Delivery root must sit inside the grant.
- New checks per present slot:
  - `inspectStatus`: `ok` and `partial` pass this check; `corrupt`, `unsupported`, missing status fail (cannot silently pass).
  - `inspectIntegrity`: fail if `readable === false` or `parseable === false` (omitted `parseable` is allowed).
  - `inspectDiagnostic`: fail on `severity: "error"` diagnostics.
- `partial` is not always fail and not always pass: usable fields can still pass the suite; missing width still fails `width`.

**New green:** parent-grant same-name fixture (real File Vitals); fake-adapter cases for corrupt / unsupported / partial-usable / partial-missing-width / unreadable / error diagnostic. Channel-cover same-name cover test.

**Not covered:** File Vitals on this adapter often reports truncated PNG as `ok`+`parseable` (so corrupt is tested with a fake inspect adapter); warning-level diagnostics are ignored; `result.status` `error` is not in the portable inspect enum we saw.

## A5 — Binding failure must not silently swap implementations

**Where:** `drafts/batch-delivery-preflight/src/lower.mjs` (generate `lower.mjs` reports its only sibling path)

**Old wrong:** `importFirst` caught **any** error from a present packed `deps/` module, then loaded the sibling draft. The report still named the hardcoded `org.openadam.*@0.1.0` identity.

**Fix:**

- Packed `deps/` present + load failure → **fail**. No sibling swap.
- Packed absent (authoring tree) → sibling draft, `bindingMode: "sibling-draft"`.
- Explicit fallback from a *broken* packed module: `OPENADAM_DRAFT_DEV_BINDINGS=1` (`bindingMode: "dev-fallback"`, `packedError` set).
- Every kit `method` includes `resolvedPath` and `bindingMode` matching the module that actually loaded.

**New green:** `src/lower.test.mjs` 5/5; CLI good campaign reports `sibling-draft` and the sibling `preflight.mjs` path.

**Not covered:** hashing packed bytes into the identity string; a global router; generate-draft packed `deps/` (that draft is not a Kit payload).

## Completion re-label

| Milestone | Was easy to read as | Now |
| --- | --- | --- |
| M4 | Independent handoff done | **Handoff drill.** Cold reader was an implementation-side script, not a third party or a new Agent session. |
| M5 | Generate/reuse story complete | **Narrow PNG slice.** Write bounds and image correctness are fixed first; no format expansion, no Host merge. |

Updated: `reports/m4-handoff.md`, `reports/m5-generate-versions.md`, root `README.md`, `drafts/batch-delivery-preflight/HANDOFF.md`.

This PR still does not prove the whole authoring-and-reuse program.

## Tests run

```text
drafts/asset-delivery-generate     node --test src/generate.test.mjs src/png.test.mjs     26/26
drafts/asset-delivery-preflight    node --test preflight.test.mjs src/mcp-server.test.mjs  25/25
drafts/batch-delivery-preflight    node --test src/preflight.test.mjs src/mcp-server.test.mjs src/lower.test.mjs  21/21
drafts/channel-cover-preflight     node --test src/preflight.test.mjs src/mcp-server.test.mjs  21/21
```

Adapters used locally are gitignored `bin/capability-adapter` copies (not part of the commit). pngjs is vendored under `drafts/asset-delivery-generate/third_party/pngjs`.

## Next (not done)

- **Batch B:** clean-environment CI from this SHA; pin File Vitals / adapter build; stop assuming author `bin/` / `.tools`.
- **Batch C:** one authorized real delivery task with a new Agent, CLI/Skill only; do not require Host install.
- Do not add a sixth method. Do not merge the draft tree into Agent Host.
