# __DISPLAY_NAME__ review contract

Reconstruct the current product from `src/preflight.mjs`, `src/compare.mjs`,
`procedure/`, and `src/mcp-server.mjs`. Do not treat Kit check status as
semantic acceptance.

## Development regression

- Syntax-check the combinator, Procedure adapter, MCP carrier, and pack script.
- Run `node --test src/preflight.test.mjs` against frozen fixtures after the
  author implements compareSlot: good pass, at least one bad class, and a spec
  mutation that flips pass to fail.
- Reject `CORE_NOT_IMPLEMENTED` and scaffold markers.

## Procedure conformance

- Validate the draft Profile, Manifest, and result-boundary suite without
  writing them into the public `procedure-contracts` catalog.
- Stage bindings must name File Vitals `inspect` only.

## Package

- `openadam-dev check` then `openadam-dev pack` from this directory.
- The package command writes only to `OPENADAM_COMPONENT_STAGE`.
- Do not `component import`.

## Binding

Observation is `org.openadam.file.inspect@0.1.0`. Do not add a
`raster.verify` stage, Capability manifest, or claim.
