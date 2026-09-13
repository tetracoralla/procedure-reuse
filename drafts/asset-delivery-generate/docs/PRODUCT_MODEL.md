# Asset delivery generate product model

## Status

Experimental draft of one bounded write-then-check product: generate PNG
icon-pack slots from a single source PNG into a **new directory**, then run
the existing read-only `asset-delivery-preflight` combinator.

It is not a published catalog entry, not `org.openadam.brand-asset.prepare`,
and not `org.openadam.raster.prepare`. It does not bind unpublished
`asset-prep`.

## Product

A developer or Agent gives:

1. one source PNG
2. an asset-delivery technical slot spec (same shape the preflight already
   consumes: id, path, name, format, width, height, alpha, required)
3. an output directory that is not the source file

This product cover-crops and **downscales only** (upscale forbidden) to each
PNG slot, writes those files, leaves the source bytes unchanged, and then
calls `runPreflight` from `drafts/asset-delivery-preflight`. The suite
`pass` / `fail` after a successful generate is the existing preflight
result. A source that cannot satisfy a required slot (too small, missing
alpha, unsupported format) fails at **generate** and does not pretend to be
a preflight fail.

## Human task

Turn one master PNG into the named pixel sizes the delivery spec already
lists, then ask the existing preflight whether that new directory is
technically ready.

## Agent task

Call the CLI with `--source`, `--spec`, and `--out`. Read `stage` before
`status`. Do not invent brand marks, perspective, or aesthetic judgments.
Do not tell the user this is `raster.prepare` or `brand-asset.prepare`.

## Carriers

- CLI: `src/cli.mjs` (generate + preflight one-shot)
- Library: `src/generate.mjs`, `src/pipeline.mjs`

No MCP, no Procedure catalog identity, no Host import in this milestone.

## Limits

- Source: non-interlaced 8-bit RGB or RGBA PNG
- Output slots: PNG only
- Fit: center cover-crop, then premultiplied-alpha area-weighted box filter
- Codec: pngjs 7.0.0 (vendored); 8-bit non-interlaced RGB/RGBA only
- Upscale: forbidden
- Max dimension 4096; max 32 slots via the preflight spec parser;
  max PNG input 32 MiB
- Does not trim transparent padding, apply projective maps, or place a
  brand mark
- Default: exclusive-create at write time (`--overwrite` to replace)
- Source file, including symlink and hard-link aliases, is never overwritten
- Output-root and intermediate symlinks cannot expand the write set
- Write I/O errors report `output.written` / `output.partial`; this is not
  an OS sandbox

## Ambiguity

Refuse aesthetic spec fields (the preflight parser already does). If a slot
asks for `alpha=unknown`, fail generate: PNG output always has a known
alpha channel. If a slot is JPEG/GIF/WebP, fail generate (out of bounds).

## Effects

Generate writes only under `--out`. Preflight remains `stateAccess: read`
on that new directory.

## Recovery

- Generate domain fail (`stage: generate`): do not retry the same source
  against the same spec; change the source or the target sizes
- Preflight domain fail (`stage: preflight`): files were written; read
  failed check ids from the reused combinator
- Adapter / spec / usage errors are exit 2, not a domain fail
