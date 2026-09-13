# Asset delivery preflight review contract

Reconstruct the current product from `preflight.mjs`, `procedure/`, and
`src/mcp-server.mjs`. Do not treat Kit check status as semantic acceptance.

## Development regression

- Syntax-check the combinator, Procedure adapter, MCP carrier, and pack script.
- Run `node --test preflight.test.mjs` against the frozen fixtures: good pass,
  good-alt pass, wrong size/format/alpha/name, missing, extra, spec mutation.
- Run MCP tests that call `runPreflight` (not a stub). One valid delivery
  must report `status: pass`; empty arguments must be a protocol error.
- Reject `CORE_NOT_IMPLEMENTED` and scaffold markers.

## Procedure conformance

- Validate the draft Profile, Manifest, and result-boundary suite without
  writing them into the public `procedure-contracts` catalog.
- Run `repos/procedure-contracts/src/run-conformance.mjs` for the four
  result-boundary cases (good pass, missing slot fail, wrong size fail,
  spec height change fail).
- Stage bindings must name File Vitals `inspect` only.

## Package

- `openadam-dev check` then `openadam-dev pack` from this directory.
- The package command writes only to `OPENADAM_COMPONENT_STAGE`.
- The sealed `tar.gz` must contain the File Vitals JSONL adapter, the
  combinator, and the MCP carrier that imports it.
- Optional: `agent-host component preview --artifact` with `--standalone`
  and `--license-spdx Apache-2.0`. Do not `component import`.

## Safety and recovery

- Paths stay inside the explicit workspace or implementation grant.
- Unknown spec fields and aesthetic keys fail closed.
- Cancellation of Kit check/pack is Host/Kit-owned; this product does not
  daemonize or keep work after stdio close.

## Binding

Observation is `org.openadam.file.inspect@0.1.0`. Do not add a
`raster.verify` stage, Capability manifest, or claim.
