# __DISPLAY_NAME__ product model

## Status

Generated compose/Procedure scaffold, not a published catalog entry and not
`org.openadam.raster.verify`. Replace this file with current product facts
before removing `.openadam-scaffold`.

## Product

__SUMMARY_TEXT__

A developer or Agent supplies a technical slot spec and a delivery directory.
Present declared files are observed with `org.openadam.file.inspect@0.1.0`
(File Vitals JSONL `inspect`). Missing/extra aggregation is mechanical.
Domain comparison is `src/compare.mjs` (author-owned). The output is ordered
checks and a suite `pass` or `fail`.

## Human task

Answer: is this delivery set technically ready against the spec I already
wrote? The human owns the spec, the files, and whether a `fail` report is
acceptable. The product does not judge brand, copy, or aesthetics, and does
not generate missing sizes.

## Agent task

Call the CLI, Procedure JSONL adapter, or MCP tool with an explicit workspace
grant, a relative delivery root, and either an inline spec or a spec path
inside that grant. Present the ordered failed check ids.

## Carriers

- CLI: `src/cli.mjs`
- Procedure JSONL v0.2: `procedure/adapter.mjs` implementing `__PROCEDURE_ID__@0.1.0`
- MCP stdio: `src/mcp-server.mjs` tool `__OPERATION__`
- Skill: routing and presentation only

## Limits

- Slot set at most 32; File Vitals JSONL inspect sessions at most 16
- Observation formats: png, jpeg, gif, webp (byte identity, not extension)
- Alpha may be unknown; unknown is not present or absent
- Read-only; no writes, no generation, no Host catalog mutation

## Effects

`stateAccess: read`. MCP annotations are closed read-only.

## Recovery

Adapter or inspect process failures are `PROVIDER_FAILED` (retryable). Invalid
specs and path escapes are not retryable. A suite `fail` is a successful
report, not a carrier error. `CORE_NOT_IMPLEMENTED` means the author has not
replaced `src/compare.mjs`.
