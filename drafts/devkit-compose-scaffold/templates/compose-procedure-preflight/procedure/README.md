# Draft Procedure: `__PROCEDURE_ID__@0.1.0`

Experimental, closed-world, read-only Procedure wrapping `src/preflight.mjs`.
**Not** in the public `procedure-contracts` catalog.
**Not** `brand-asset.prepare`. **Not** `raster.verify`.

Replace the profile summary, IO schemas, and conformance cases with the
product-specific method. After edits run `node scripts/write-procedure-digests.mjs`.

## Stages

One required stage: `inspect-files` → `org.openadam.file.inspect@0.1.0` / `inspect`.

The adapter schedules one inspect per present declared path. Missing required
paths skip inspect. Domain comparison is `src/compare.mjs`.
