# Compose / Procedure project scaffold

Developer Kit `init` currently ships only `node-mcp-provider`. This workspace
draft adds a **compose-procedure-preflight** template without modifying or
pushing the public Kit repository.

The template does the mechanical work: project skeleton, IO locations, File
Vitals `file.inspect` injection, CLI / Procedure JSONL / MCP carriers, check
and pack entry points, an empty fixture, and a thin Skill. The author (or
authoring Agent) owns spec fields, comparison rules, fixtures, failure
handling, and the final result.

Generated `src/compare.mjs` throws `CORE_NOT_IMPLEMENTED`. Missing/extra
already follow the spec file, so changing the spec changes execution even
before domain comparison exists. That is not a finished method.

## Init

From the workspace root, Node 22 on PATH (not `.tools/node`):

```bash
node drafts/devkit-compose-scaffold/src/cli.mjs init compose-procedure-preflight \
  --destination drafts/channel-cover-preflight \
  --id org.openadam.channel-cover-preflight \
  --package-name @openadam/channel-cover-preflight \
  --plugin channel-cover-preflight \
  --operation channel_cover_preflight \
  --procedure-id org.openadam.channel-cover.preflight \
  --name "Channel cover preflight" \
  --summary "Read-only preflight for channel-cover slots using file.inspect observations and combinator comparison." \
  --author "openAdam" \
  --license Apache-2.0 \
  --json
```

`--dry-run` prints the file list without writing.

## After init

See the generated `docs/AUTHORING.md`. Typical sequence:

1. Implement `src/spec.mjs` and `src/compare.mjs`
2. Write `specs/` and `fixtures/`
3. Replace tests and Procedure conformance cases
4. `node scripts/write-procedure-digests.mjs`
5. Replace Skill + legal files; delete `.openadam-scaffold`
6. `sh scripts/build-file-vitals.sh --all-drafts` (pinned File Vitals; see `docs/CLEAN_ENV.md`)
7. `node .deps/agent-tool-development-kit/src/cli.mjs check --root <project> --json`
8. `node .deps/agent-tool-development-kit/src/cli.mjs pack --root <project> --json`

Init does **not** import Kit internal source. Kit check/pack need
`sh scripts/fetch-deps.sh --kit` and Node 22. Kit source is not patched.
A future PR could add this template next to `templates/node-mcp-provider/`.
