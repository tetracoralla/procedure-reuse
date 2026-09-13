# Draft Procedure: `org.openadam.asset-delivery.preflight@0.1.0`

Experimental, closed-world, read-only Procedure wrapping the step-3 combinator
`../preflight.mjs`. **Not** in the public `procedure-contracts` catalog.
**Not** `brand-asset.prepare`. **Not** `raster.verify`.

## Identity

| Field | Value |
| --- | --- |
| id | `org.openadam.asset-delivery.preflight` |
| version | `0.1.0` |
| lifecycle | `experimental` |
| family | Profile v0.5 / Manifest v0.5 / Suite v0.4 |
| adapter | `openadam.procedure-jsonl.v0.2` |
| claim | `result-boundary` only (composition-suite postponed) |

## Stages (honest)

The portable DAG cannot map-over-N files. One required stage:

`inspect-files` → `org.openadam.file.inspect@0.1.0` / `inspect`

The adapter schedules **one inspect per present declared path** (JSONL sessions
of at most 16). Missing required paths skip inspect and become `missing`
checks. Extra files are listed without inspect. Name / format / width / height
/ alpha / missing / extra comparison stays in ordinary code.

## Files

| Path | Role |
| --- | --- |
| `asset-delivery-preflight.v0.1.json` | Procedure Profile |
| `schemas/asset-delivery.preflight.v0.1.{input,output}.schema.json` | Portable IO |
| `implementation-manifest.json` | Binds adapter + File Vitals JSONL inspect |
| `adapter.mjs` | JSONL v0.2; calls `runPreflight` |
| `conformance.v0.1.json` | result-boundary cases |
| `check.mjs` | Validate draft files without publishing them |

## Run

From the workspace root, after File Vitals is built and Node 22+ is on PATH
(workspace toolchain: `.tools/node`):

```bash
drafts/asset-delivery-preflight/scripts/run-procedure-conformance.sh
```

Or, with Node 22:

```bash
node drafts/asset-delivery-preflight/procedure/check.mjs

node repos/procedure-contracts/src/run-conformance.mjs \
  --profile drafts/asset-delivery-preflight/procedure/asset-delivery-preflight.v0.1.json \
  --suite drafts/asset-delivery-preflight/procedure/conformance.v0.1.json \
  --manifest drafts/asset-delivery-preflight/procedure/implementation-manifest.json \
  --implementation-root drafts/asset-delivery-preflight
```

`OPENADAM_IMPLEMENTATION_ROOT` is set by the conformance runner to the draft
root so `fixtures/` and `specs/` resolve inside that grant.
