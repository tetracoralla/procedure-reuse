# Draft Procedure: `org.openadam.channel-cover.preflight@0.1.0`

Experimental, closed-world, read-only Procedure wrapping `src/preflight.mjs`
and author rules in `src/compare.mjs`. **Not** in the public catalog.
**Not** `brand-asset.prepare`. **Not** `raster.verify`.

## Identity

| Field | Value |
| --- | --- |
| id | `org.openadam.channel-cover.preflight` |
| version | `0.1.0` |
| lifecycle | `experimental` |
| family | Profile v0.5 / Manifest v0.5 / Suite v0.4 |
| adapter | `openadam.procedure-jsonl.v0.2` |
| claim | `result-boundary` only |

## Stages

`inspect-files` → `org.openadam.file.inspect@0.1.0` / `inspect`

Domain checks (namePattern, aspect, transparencyAllowed, mixed formats,
optional slots) stay in ordinary code.
