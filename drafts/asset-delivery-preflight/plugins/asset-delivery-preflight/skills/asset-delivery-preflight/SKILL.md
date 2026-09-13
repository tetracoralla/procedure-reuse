---
name: asset-delivery-preflight
description: Use Asset delivery preflight when a caller already has a technical slot spec and a delivery directory and needs a read-only pass/fail against name, format, width, height, alpha, missing slots, and extra files. Observation is file.inspect (File Vitals). Do not use this for generating assets, brand marks, aesthetic review, or raster.verify.
---

# Asset delivery preflight

Route here only when the user wants a **technical** check of an existing
delivery set against a spec they already own.

## Call

Use tool `asset_delivery_preflight` once per delivery set:

- `root` is the delivery directory relative to the workspace grant
- exactly one of inline `spec` or `specPath` (also relative to the grant)
- slot fields are technical only: id, path, name, format, width, height, alpha, required

Do not loop the tool per file. The combinator inspects present slots internally.

## Ambiguity that needs a human

- which directory is the delivery set
- which spec file or slot list to use
- whether a suite `fail` is acceptable for this handoff

## Do not

- invent aesthetic, brand, or quality criteria
- treat File Vitals as `raster.verify`
- call `brand-asset.prepare` or generate missing sizes
- claim ICO/ICNS support
- treat omitted `has_alpha` as present or absent

## Stopping

A successful tool result with `status: fail` is the answer (ordered `failedIds`),
not a reason to retry the same call. Retry only on `PROVIDER_FAILED`.
