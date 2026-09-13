# Channel cover preflight product model

## Status

Experimental draft of one closed, read-only product: suite preflight for a
caller-supplied channel-cover slot spec. It is not a published catalog
entry, not `brand-asset.prepare`, and not `org.openadam.raster.verify`.

## Product

A developer or Agent gives a technical channel-cover spec and a delivery
directory. Required slots are aspect-ratio covers (1x1, 16x9, 9x16) with
mixed PNG/JPEG, a family naming pattern, and a suite-level transparency
policy. An optional 4x5 slot may be absent. Present declared files are
observed with `org.openadam.file.inspect@0.1.0` (File Vitals JSONL
`inspect`). Comparison in `src/compare.mjs` checks namePattern, signature
format, width, height, reduced aspect, and transparency, plus missing
required slots and extra files.

This is a different method from asset-delivery-preflight (icon suite with
per-slot alpha and exact names). Observation is reused; rules and fixtures
are not copies.

## Human task

Answer: is this channel-cover set technically ready against the spec I
already wrote? The human owns the spec, the files, and whether a `fail`
report is acceptable. The product does not judge brand, copy, or looks, and
does not generate missing sizes.

## Agent task

Call the CLI, Procedure JSONL adapter, or MCP tool with an explicit workspace
grant, a relative delivery root, and either an inline spec or a spec path
inside that grant. Present the ordered failed check ids.

## Carriers

- CLI: `src/cli.mjs`
- Procedure JSONL v0.2: `procedure/adapter.mjs` implementing
  `org.openadam.channel-cover.preflight@0.1.0`
- MCP stdio: `src/mcp-server.mjs` tool `channel_cover_preflight`
- Skill: routing and presentation only

## Limits

- Slot set at most 32; File Vitals JSONL inspect sessions at most 16
- Formats: png, jpeg, gif, webp (byte identity, not extension)
- When transparency is forbidden, unknown alpha fails closed
- Read-only; no writes, no generation, no Host catalog mutation

## Effects

`stateAccess: read`. MCP annotations are closed read-only.

## Recovery

Adapter or inspect process failures are `PROVIDER_FAILED` (retryable). Invalid
specs and path escapes are not retryable. A suite `fail` is a successful
report, not a carrier error.
