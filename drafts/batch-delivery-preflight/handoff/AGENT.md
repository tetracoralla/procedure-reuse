# Agent entry (batch delivery preflight)

Use this only when the human already has a **technical** campaign spec and
existing files, and wants a read-only pass/fail for the whole batch.

This Skill/method is **not** installed in Agent Host in the default handoff.
Do not claim it was selected in a live session. Do not tell the user they
must invoke a Procedure. Do not invent MCP tools that are not in the current
tool list.

## Invoke

1. If tool `batch_delivery_preflight` is **already** in this session's tool
   list, call it **once** with `root` plus exactly one of `spec` or
   `specPath` (paths relative to the workspace grant).
2. Otherwise run the CLI from the project directory
   `drafts/batch-delivery-preflight/`:

```bash
node src/cli.mjs --spec <campaign.json> --root <campaign-dir> --compact
```

Read `HANDOFF.md` for trees, fields, and recovery. Do not loop per kit or
per file.

## Read the result

- `status: pass|fail` is the answer.
- `summary.failedKits` names kits. `summary.failedIds` names check ids.
- Failed checks include `kit`, `slot`, `id`, `expected`, `observed`.
- A successful call with `status: fail` is not an error. Do not retry the
  same call. Retry only on `PROVIDER_FAILED`.

## Ask a human when

- which directory is the campaign root
- which campaign JSON to use
- whether a `fail` is acceptable to ship
- which kit kinds belong in this campaign

## Do not

- generate, resize, or fill missing assets
- invent aesthetic, brand, or copy checks
- treat File Vitals as `raster.verify`
- copy icon/cover slot rules into a new script
- nest Direct Runtime
- put spec JSON or README files inside a kit root (`extra`)
- assume `specPath` is relative to `--root` (it is relative to the campaign JSON)
- assume Host import happened
