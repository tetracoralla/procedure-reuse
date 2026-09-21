---
name: channel-cover-preflight
description: Use Channel cover preflight when a caller already has a technical channel-cover spec and a delivery directory and needs a read-only pass/fail against naming pattern, format, width, height, aspect ratio, transparency policy, missing required slots, and extra files. Observation is file.inspect (File Vitals). Do not use this for generating assets, brand marks, copy review, aesthetic review, or raster.verify.
---

# Channel cover preflight

Route here only when the user wants a **technical** check of an existing
channel-cover set against a spec they already own.

## Call

Use tool `channel_cover_preflight` once per delivery set:

- `root` is the delivery directory relative to the workspace grant
- exactly one of inline `spec` or `specPath` (also relative to the grant)
- spec fields are technical only: family `channel-cover`, naming.pattern,
  transparencyAllowed, and slots with id, path, aspect, format, width, height,
  required

Do not loop the tool per file. The combinator inspects present slots internally.

## Ambiguity that needs a human

- which directory is the delivery set
- which spec file or slot list to use
- whether a suite `fail` is acceptable for this handoff
- whether transparency is allowed for this channel

## Do not

- invent aesthetic, brand, or copy criteria
- treat File Vitals as `raster.verify`
- generate or resize missing cover sizes
- claim ICO/ICNS support
- treat omitted `has_alpha` as present or absent when transparency is forbidden

## Stopping

A successful tool result with `status: fail` is the answer (ordered `failedIds`),
not a reason to retry the same call. Retry only on `PROVIDER_FAILED`.
