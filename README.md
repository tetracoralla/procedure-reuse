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

## Status

Experimental draft. Public Host catalogs were not updated. No Host import.
Binaries and sealed packs are rebuilt locally (see each draft README).

This tree does **not** claim the Procedure authoring-and-reuse program is
done. M4 is a handoff drill, not an independent third-party handoff. M5 is
a narrow PNG generate+preflight slice; write-boundary and image fixes from
review Batch A are in `reports/review-response-batch-a.md`.

## License

Apache License 2.0. See `LICENSE` and `NOTICE`.
