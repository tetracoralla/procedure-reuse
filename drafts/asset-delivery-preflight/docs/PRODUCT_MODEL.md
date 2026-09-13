# Asset delivery preflight product model

## Status

Experimental draft of one closed, read-only product: suite preflight for a
caller-supplied asset-delivery slot spec. It is not a published catalog
entry, not `brand-asset.prepare`, and not `org.openadam.raster.verify`.

## Product

A developer or Agent gives a technical slot spec (id, path, name, format,
width, height, alpha, required) and a delivery directory. The product
observes each **present** declared file with the public Capability
`org.openadam.file.inspect@0.1.0` (File Vitals JSONL `inspect`) and then
compares name, signature format, pixel width, pixel height, and alpha, plus
missing required slots and extra undeclared files. The output is ordered
checks and a suite `pass` or `fail`.

Comparison is ordinary combinator code in `preflight.mjs`. File Vitals is
the observer only. This product does not implement or claim
`org.openadam.raster.verify@0.1.0`.

## Human task

Answer: is this small PNG (or JPEG/GIF/WebP) delivery set technically ready
against the spec I already wrote? The human owns the spec, the files, and
whether a `fail` report is acceptable.

## Agent task

Call the CLI, Procedure JSONL adapter, or MCP tool with an explicit workspace
grant, a relative delivery root, and either an inline spec or a spec path
inside that grant. Present the ordered failed check ids. Do not invent
aesthetic, brand, or quality judgments.

## Carriers

One combinator (`preflight.mjs`) is the product core. Current carriers:

- CLI: `preflight.mjs`
- Procedure JSONL v0.2: `procedure/adapter.mjs` implementing
  `org.openadam.asset-delivery.preflight@0.1.0`
- MCP stdio: `src/mcp-server.mjs` tool `asset_delivery_preflight`
- Skill: routing and presentation only

Every successful carrier call must preserve the same checks, suite status,
and observer identity as the combinator.

## Limits

- Slot set at most 32; File Vitals JSONL inspect sessions at most 16
- Formats: png, jpeg, gif, webp (byte identity, not extension)
- Alpha may be unknown; unknown is not present or absent
- ICO/ICNS are not supported identities
- Read-only; no writes, no generation, no Host catalog mutation

## Ambiguity

Refuse aesthetic fields. If File Vitals omits `has_alpha`, do not guess.
If the workspace grant is missing, fail closed.

## Effects

`stateAccess: read`. MCP annotations are closed read-only
(`readOnlyHint: true`, `openWorldHint: false`).

## Recovery

Adapter or inspect process failures are `PROVIDER_FAILED` (retryable).
Invalid specs and path escapes are not retryable. A suite `fail` is a
successful report, not a carrier error.
