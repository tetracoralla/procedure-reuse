---
name: batch-delivery-preflight
description: Use Batch delivery preflight when a caller already has a campaign kit list (icon/badge suite and/or channel-cover/poster suite) and needs a read-only pass/fail for the whole batch, including which kit failed and which lower check failed. Default invocation is the project CLI; the MCP tool exists only if already bound. Observation is file.inspect via the existing lower combinators. Do not use this for generating assets, brand marks, copy review, aesthetic review, Host import, or raster.verify.
---

# Batch delivery preflight

Route here only when the user wants a **technical** check of an existing
delivery campaign against a kit list they already own.

Outsiders: start at `HANDOFF.md` (same project). This Skill does not install
the method into Agent Host. If the tool is not in the current session, run
the CLI; do not pretend a Procedure was selected.

## Call

Prefer the CLI when Host import has not happened (this is the default
handoff):

```bash
cd drafts/batch-delivery-preflight
node src/cli.mjs --spec <campaign.json> --root <campaign-dir> --compact
```

Use MCP tool `batch_delivery_preflight` **only if that tool is already in
the current tool list**. Call it once per campaign:

- `root` is the campaign directory relative to the workspace grant
- exactly one of inline `spec` or `specPath` (also relative to the grant)
- campaign spec fields are technical only: family `batch-delivery` and kits
  with id, kind (`asset-delivery` or `channel-cover`), root, required, and
  exactly one of kit `spec` or `specPath`

Kit `root` is relative to the campaign directory. Kit `specPath` is relative
to the campaign JSON directory. Slot `path` is relative to the kit root.
Do not loop the tool per kit or per file.

Do not instruct the user that they must invoke this Procedure. If neither
the CLI tree nor the MCP tool is available, say so and stop.

## Ambiguity that needs a human

- which directory is the campaign root
- which campaign list to use
- whether a suite `fail` is acceptable for this handoff
- which kit kinds belong in this campaign

## Do not

- invent aesthetic, brand, or copy criteria
- treat File Vitals as `raster.verify`
- generate or resize missing assets
- reimplement icon or cover slot rules in this Skill
- nest Direct Runtime to call the lower methods
- expand the inspect workspace grant to the whole campaign when a kit root exists
- put undeclared files (README, specs) inside a kit root

## Stopping

A successful result with `status: fail` is the answer (`failedKits` plus
ordered checks with `kit` / `slot` / `id`), not a reason to retry the same
call. Retry only on `PROVIDER_FAILED`.
