# Channel cover preflight

If you want a **batch** (icon suite + cover suite) and did not write these
methods, start at
[`../batch-delivery-preflight/HANDOFF.md`](../batch-delivery-preflight/HANDOFF.md).
This directory is the lower single-suite cover method.

Read-only technical preflight for a **channel-cover** delivery set.

This project was created from the workspace compose-procedure-preflight
scaffold, then authored (spec schema, comparison rules, fixtures, Procedure
cases). It is not a copy of `drafts/asset-delivery-preflight/`.

Observation: `org.openadam.file.inspect@0.1.0` (File Vitals JSONL `inspect`).
Comparison: ordinary code in `src/compare.mjs`. **Not** `raster.verify`.
Does not generate missing sizes, and does not judge brand or copy.

Required slots: `cover-1x1` PNG 64×64, `cover-16x9` JPEG 160×90, `cover-9x16`
PNG 90×160, under `covers/`. Optional `cover-4x5` may be absent. Transparency
is forbidden unless the spec sets `transparencyAllowed: true`.

```bash
scripts/build-file-vitals.sh
python3 scripts/generate-fixtures.py
node src/cli.mjs --spec specs/good.json --root fixtures/good --compact
node --test src/preflight.test.mjs src/mcp-server.test.mjs
scripts/run-procedure-conformance.sh
```

From the workspace, Node 22 on PATH:

```bash
node repos/agent-tool-development-kit/src/cli.mjs check --root drafts/channel-cover-preflight --json
node repos/agent-tool-development-kit/src/cli.mjs pack --root drafts/channel-cover-preflight --json
```

Changing `specs/good-wrong-aspect.json` (16:9 → 4:3) on the same good files
flips pass to fail. That is the method, not decoration.
