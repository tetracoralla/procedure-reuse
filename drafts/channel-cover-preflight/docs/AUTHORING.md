# Authoring this compose preflight

The scaffold already created the mechanical shell. Do **not** copy a finished
sample directory and call that authoring. Change the method files so execution
changes.

## Mechanical (already generated)

- `lib/observe-file-inspect.mjs` — File Vitals JSONL `inspect` client
- `src/preflight.mjs` — list files, inspect present slots, missing/extra, call compare
- CLI / Procedure JSONL / MCP carriers
- `agent-tool.json`, pack/check scripts, thin Skill identity

## Author must replace

1. `src/spec.mjs` — domain spec fields (the JSON the combinator actually parses)
2. `src/compare.mjs` — `compareSlot` checks; remove `CORE_NOT_IMPLEMENTED`
3. `specs/` and `fixtures/` — real slot list and good/bad deliveries
4. `src/preflight.test.mjs` — good pass, bad classes, spec mutation
5. `procedure/profile.v0.1.json` summary/purpose, IO schemas if tightened, conformance cases
6. `scripts/write-procedure-digests.mjs` after profile/schema edits
7. Skill, LICENSE/NOTICE, package probe ids (`scaffold-*` must go)
8. Delete `.openadam-scaffold`

## Proof the method is live

Changing a spec field or a `compareSlot` rule on the same files must change
`status` or `failedIds`. Empty-directory missing-slot already works before
compareSlot exists; that is not enough to finish authoring.
