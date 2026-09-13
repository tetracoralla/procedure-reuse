# Batch delivery preflight review contract

Reconstruct the current product from `src/preflight.mjs`, `src/lower.mjs`,
`src/spec.mjs`, `procedure/`, and `src/mcp-server.mjs`. Do not treat Kit check
status as semantic acceptance.

## Development regression

- Syntax-check the combinator, Procedure adapter, MCP carrier, and pack script.
- Run `node --test src/preflight.test.mjs` against the frozen fixtures: good
  campaign pass, missing kit, wrong size in one kit, campaign-list change,
  lower spec mutation, per-kit inspect grant, no copied slot rules.
- Run MCP tests that call `runPreflight`. One valid campaign must report
  `status: pass`; empty arguments must be a protocol error.
- Reject `CORE_NOT_IMPLEMENTED`.

## Procedure conformance

- Validate the draft Profile, Manifest, and result-boundary suite without
  writing them into the public `procedure-contracts` catalog.
- Run `repos/procedure-contracts/src/run-conformance.mjs` for the
  result-boundary cases (good pass, missing kit, wrong size, list change,
  lower spec height change).
- Stage bindings must name File Vitals `inspect` only.

## Package

- `openadam-dev check` then `openadam-dev pack` from this directory.
- The package command writes only to `OPENADAM_COMPONENT_STAGE` and stages
  the lower combinator modules under `deps/` so packed runtime still imports
  them instead of copying slot rules.
- Optional: `agent-host component preview --artifact` with `--standalone`.
  Do not `component import`.

## Binding

Observation is `org.openadam.file.inspect@0.1.0`. Do not add a
`raster.verify` stage, Capability manifest, or claim. Do not nest Direct
Runtime to call the lower Procedures.
