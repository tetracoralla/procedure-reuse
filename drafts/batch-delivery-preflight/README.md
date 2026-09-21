# Batch delivery preflight

**Did not write this method?** Start at [`HANDOFF.md`](HANDOFF.md). That page is the consumer entry (what it does, what to prepare, shortest command, how to read `failedKits`). This README is for authors.

Read-only **two-layer** technical preflight for a delivery campaign.

The campaign spec is a kit list. Each kit is dispatched to an existing
combinator:

| kind | lower method |
| --- | --- |
| `asset-delivery` | `drafts/asset-delivery-preflight` `runPreflight` |
| `channel-cover` | `drafts/channel-cover-preflight` `runPreflight` |

Slot rules (names, sizes, formats, alpha, aspect, missing/extra files) stay
in those modules. This project aggregates kit status and localizes failures
to **kit / slot / check**. Observation is still
`org.openadam.file.inspect@0.1.0`. **Not** `raster.verify`. **Not** Direct
Runtime nesting.

Kit roots and kit spec paths are resolved, then required to stay inside the
original campaign/workspace grant. A kit directory that is a symlink out of
that grant is rejected; the lower combinator never receives the escaped
realpath as a new File Vitals grant.

Packed `deps/` is the production binding. A broken packed module does not
silently load a sibling checkout. Authoring trees without `deps/` load the
sibling draft and report `method.resolvedPath` / `bindingMode`. An explicit
fallback from a broken packed module requires `OPENADAM_DRAFT_DEV_BINDINGS=1`.

```bash
scripts/build-file-vitals.sh
node src/cli.mjs --spec specs/good.json --root fixtures/good
node src/cli.mjs --spec specs/good.json --root fixtures/good --json
node --test src/preflight.test.mjs src/mcp-server.test.mjs src/procedure-adapter.test.mjs
scripts/run-procedure-conformance.sh
```

The default output is one human result plus localized failures. `--json`
returns the complete structured report; `--compact` keeps one-line JSON for
Agent and automation consumers.

From the workspace, Node 22 on PATH:

```bash
# Kit check/pack: clone the pinned Kit (docs/CLEAN_ENV.md), then:
node .deps/agent-tool-development-kit/src/cli.mjs check --root drafts/batch-delivery-preflight --json
node .deps/agent-tool-development-kit/src/cli.mjs pack --root drafts/batch-delivery-preflight --json
```

A good two-kit campaign passes. Dropping the covers directory fails with
`kitMissing` on kit `covers`. Pointing the icon kit at the 48×48 `icon-64`
fixture fails `width`/`height` on that slot. Dropping the icon kit from the
campaign list on those same files flips the batch back to pass.
