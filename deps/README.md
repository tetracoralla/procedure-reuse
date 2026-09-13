# Pinned public dependencies

This repository does not vendor File Vitals, Developer Kit, or the contract
catalogs. A clean clone must fetch **only** the official GitHub repos at the
commits in `pins.json`.

Do not use an author `repos/` tree, `.tools/` toolchain, or a leftover `dist/`
as the source of those dependencies.

| Pin | Official source | When it is needed |
| --- | --- | --- |
| `fileVitals` | https://github.com/tetracoralla/file-vitals | Building `finspect` / `capability-adapter`; adapter-backed preflight tests |
| `agentToolDevelopmentKit` | https://github.com/tetracoralla/agent-tool-development-kit | `openadam-dev check` / `pack` only |
| `procedureContracts` | https://github.com/tetracoralla/procedure-contracts | `procedure/check.mjs` and digest rewrite |
| `capabilityContracts` | https://github.com/tetracoralla/capability-contracts | Procedure catalog reference check |

Fetch:

```bash
sh scripts/fetch-deps.sh --file-vitals
# or: sh scripts/fetch-deps.sh --all
```

That writes gitignored `.deps/<name>` at the pinned commit. It does not run
scripts from the cloned trees. `go build` of File Vitals may then download
modules listed in that checkout's `go.mod` via the Go module proxy.

Environment overrides (absolute paths to already-fetched checkouts):

- `FILE_VITALS_SRC`
- `OPENADAM_DEVKIT_ROOT`
- `PROCEDURE_CONTRACTS_SRC`
- `CAPABILITY_CONTRACTS_SRC`

See `docs/CLEAN_ENV.md`.
