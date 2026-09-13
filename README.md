# procedure-reuse

Apache License 2.0. **This is not Agent Host.** It does not change
[`agent-host-suite`](https://github.com/tetracoralla/agent-host-suite).

These drafts implement one product slice of the Procedure authoring-and-reuse
program: make a real method, author a second one, reuse two layers, hand it
off, then generate versions and preflight again.

## What reviewers should look at

| Path | Role |
| --- | --- |
| `PLAN_BRIEF.md` | Program constraints |
| `reports/` | Milestone records (inventory → generate) |
| `drafts/asset-delivery-preflight/` | Icon-pack preflight (`file.inspect` + ordinary compare) |
| `drafts/channel-cover-preflight/` | Second method via authoring path |
| `drafts/devkit-compose-scaffold/` | Compose-procedure scaffold (Kit repo not patched) |
| `drafts/batch-delivery-preflight/` | Two-layer batch preflight |
| `drafts/asset-delivery-generate/` | Bounded generate + re-preflight |
| `drafts/batch-delivery-preflight/HANDOFF.md` | Cold-reader entry |

Observation uses public File Vitals (`org.openadam.file.inspect@0.1.0`).
Suite checks stay in ordinary code. This does **not** implement
`org.openadam.raster.verify`.

## Clean environment

From a clone of **this** repository on **Linux x64 + Node 22**, without
author `bin/`, `.tools/`, `repos/`, or leftover `dist/`:

```bash
sh scripts/verify-clean.sh --node-only
```

File Vitals is a public pin (`deps/pins.json`). Fetch and build only when
you need inspect:

```bash
sh scripts/fetch-deps.sh --file-vitals
sh scripts/build-file-vitals.sh --all-drafts
sh scripts/verify-clean.sh --with-file-vitals
```

CI workflow YAML: [`docs/ci.github.yml`](docs/ci.github.yml) (copy to
`.github/workflows/ci.yml` with a token that has the `workflow` scope;
see `docs/CLEAN_ENV.md`). Node tests required; File Vitals job builds the
pinned Go adapter.

After Skill or combinator source changes, rebuild the sealed pack before
treating `dist/*.tar.gz` as evidence. Packs are gitignored and are not
inherited from an older tree.

## Status

Experimental draft. Public Host catalogs were not updated. No Host import.
Binaries and sealed packs are rebuilt locally (see each draft README).

This tree does **not** claim the Procedure authoring-and-reuse program is
done. M4 is a handoff drill, not an independent third-party handoff. M5 is
a narrow PNG generate+preflight slice; write-boundary and image fixes from
review Batch A are in `reports/review-response-batch-a.md`. Clean-environment
reproducibility (Batch B) is in `reports/review-response-batch-b.md`.

## License

Apache License 2.0. See `LICENSE` and `NOTICE`.
