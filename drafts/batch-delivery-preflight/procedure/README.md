# Draft Procedure: `org.openadam.batch-delivery.preflight@0.1.0`

Experimental, closed-world, read-only Procedure wrapping `src/preflight.mjs`.
The adapter dispatches each campaign kit to an **existing** combinator
(`drafts/asset-delivery-preflight` or `drafts/channel-cover-preflight`) by
ordinary function import. **Not** in the public catalog. **Not**
`brand-asset.prepare`. **Not** `raster.verify`. **Not** Direct Runtime nesting.

## Identity

| Field | Value |
| --- | --- |
| id | `org.openadam.batch-delivery.preflight` |
| version | `0.1.0` |
| lifecycle | `experimental` |
| family | Profile v0.5 / Manifest v0.5 / Suite v0.4 |
| adapter | `openadam.procedure-jsonl.v0.2` |
| claim | `result-boundary` only |

## Stages

`inspect-files` → `org.openadam.file.inspect@0.1.0` / `inspect`

The portable stage names the observation Capability the lower methods already
use. Kit dispatch and aggregation stay in ordinary adapter code. Slot rules
are not reimplemented here.

Lower identities recorded on each kit:

- `org.openadam.asset-delivery.preflight@0.1.0`
- `org.openadam.channel-cover.preflight@0.1.0`
