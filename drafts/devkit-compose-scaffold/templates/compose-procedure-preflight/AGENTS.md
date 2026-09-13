# __DISPLAY_NAME__ repository contract

Read `docs/PRODUCT_MODEL.md`, `docs/REVIEW_CONTRACT.md`, and `docs/AUTHORING.md`
before changing the core, carriers, Skill, plugin, package, or public claims.

This repository owns one compose/Procedure product. Keep one product-specific
core (`src/preflight.mjs` + author `src/compare.mjs` + `src/spec.mjs`) and make
the CLI, Procedure adapter, and MCP server thin carriers.

Do not invent a Capability. Observation is `org.openadam.file.inspect@0.1.0`.
Do not implement or claim `raster.verify`. Do not add a planner, marketplace,
approval workflow, or generation pipeline.

The generated scaffold is not a completed product while `.openadam-scaffold`,
`CORE_NOT_IMPLEMENTED`, or scaffold-only routing remains.

Run the project's declared checks plus `openadam-dev check --root .` before
reporting development completion. Do not commit, push, publish, or import into
a live Agent environment without explicit owner authorization.
