# __DISPLAY_NAME__

__SUMMARY_TEXT__

Generated from the workspace **compose-procedure-preflight** scaffold (not the
Kit `node-mcp-provider` template). Observation is `org.openadam.file.inspect@0.1.0`
(File Vitals). Comparison is ordinary code in `src/compare.mjs` and is **not**
`raster.verify`.

While `.openadam-scaffold` exists this is unfinished. See `docs/AUTHORING.md`.

```bash
node src/cli.mjs --spec specs/example.json --root fixtures/empty --compact
# status=fail  failedIds=["missing"]   (spec already drives missing/extra)

# After implementing compareSlot, fixtures, and legal files:
scripts/build-file-vitals.sh
node --test src/preflight.test.mjs src/mcp-server.test.mjs
scripts/run-procedure-conformance.sh
# from workspace, Node 22 on PATH:
# From the procedure-reuse root after scripts/fetch-deps.sh --kit (docs/CLEAN_ENV.md):
node .deps/agent-tool-development-kit/src/cli.mjs check --root <this-project> --json
node .deps/agent-tool-development-kit/src/cli.mjs pack --root <this-project> --json
```

Do not push, publish, or `agent-host component import` from this scaffold.
