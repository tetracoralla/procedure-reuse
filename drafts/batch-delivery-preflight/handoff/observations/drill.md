# Cold-reader drill log

Generated: 2026-09-12T16:24:47.983Z
Followed: `HANDOFF.md` shortest commands from `drafts/batch-delivery-preflight/`.
Host import: not performed.

## Environment

- process node: `/usr/bin/node` v20.19.2
- adapter present at start: true
- new pixel files: 17; sha256 overlap with author good fixtures: 0

## Tasks

- **kiosk-badge**: PASS — status=pass failedKits=[] failedIds=[]
- **docs-social-broken**: PASS — status=fail failedKits=["social"] failedIds=["height","aspect"]
- **docs-social-fixed**: PASS — status=pass failedKits=[] failedIds=[]

## Blockers

None after following HANDOFF.md (project directory, existing adapter, sibling drafts present).

## Manual edits

- replace-card-wide-jpeg: Replaced card-wide.jpg 176x100 with 176x99. Specs unchanged. Optional card-portrait still absent.

## Naive cwd

Short HANDOFF paths from workspace root: code=2 status=(no json)

```
ENOENT: no such file or directory, open '/workspace/openadam-procedure-reuse/handoff/tasks/kiosk-badge/campaign.json'
```

Workspace-root long paths: code=0 status=pass

