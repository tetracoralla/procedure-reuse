# Batch delivery preflight product model

## Status

Experimental draft of one closed, read-only product: campaign preflight for a
caller-supplied kit list. It is not a published catalog entry, not
`brand-asset.prepare`, and not `org.openadam.raster.verify`.

People and Agents who did not author this method start at `HANDOFF.md`.

## Product

A developer or Agent gives a technical campaign spec and a campaign directory.
Each kit names an existing lower method (`asset-delivery` or `channel-cover`),
a kit root, and a kit spec. The campaign combinator imports that method's
`runPreflight` and aggregates kit status. Present declared files inside a kit
are observed with `org.openadam.file.inspect@0.1.0` (File Vitals JSONL
`inspect`) **using that kit's root as the inspect grant**.

This is a two-layer method: the campaign orchestrates; the lower methods
compare slots. The campaign does not copy icon alpha policy, cover aspect
math, or naming-pattern rules.

## Human task

Answer: is this delivery campaign technically ready against the kit list I
already wrote? If not, which kit, which slot, and which check failed? The
human owns the list, the files, and whether a `fail` report is acceptable.

## Agent task

Call the CLI, Procedure JSONL adapter, or MCP tool with an explicit workspace
grant, a relative campaign root, and either an inline spec or a spec path
inside that grant. Present `failedKits` and the ordered failed checks.

## Carriers

- CLI: `src/cli.mjs`
- Procedure JSONL v0.2: `procedure/adapter.mjs` implementing
  `org.openadam.batch-delivery.preflight@0.1.0`
- MCP stdio: `src/mcp-server.mjs` tool `batch_delivery_preflight`
- Skill: routing and presentation only

## Limits

- At most 8 kits
- File Vitals JSONL inspect sessions at most 16 **per kit**, unchanged
- Inspect workspace grant is the kit root, not widened to the campaign root
- Read-only; no writes, no generation, no Host catalog mutation
- Ordinary function import of the lower combinators; no Direct Runtime nesting

## Effects

`stateAccess: read`. MCP annotations are closed read-only.

## Recovery

Adapter or inspect process failures are `PROVIDER_FAILED` (retryable). Invalid
specs and path escapes are not retryable. A suite `fail` is a successful
report, not a carrier error.
