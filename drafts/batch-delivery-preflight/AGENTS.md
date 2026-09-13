# Batch delivery preflight repository contract

If you are consuming this method on new files, read `HANDOFF.md` first.
Authors: read `docs/PRODUCT_MODEL.md` and `docs/REVIEW_CONTRACT.md` before
changing the core, carriers, Skill, plugin, package, or public claims.

This repository owns one compose/Procedure product. Keep one product-specific
core (`src/preflight.mjs` + `src/lower.mjs` + `src/spec.mjs`) and make the
CLI, Procedure adapter, and MCP server thin carriers.

Do not invent a Capability. Observation is `org.openadam.file.inspect@0.1.0`.
Do not implement or claim `raster.verify`. Do not copy lower slot-comparison
rules into this tree. Do not add a planner, marketplace, approval workflow,
generation pipeline, or Direct Runtime nesting.

Run the project's declared checks plus `openadam-dev check --root .` before
reporting development completion. Do not commit, push, publish, or import into
a live Agent environment without explicit owner authorization.
