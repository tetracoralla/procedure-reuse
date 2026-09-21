# Batch C task materials

Marker: `synthetic-authorized-substitute`

Northline Transit rider-app v1 store listing is a **synthetic** pack with
real-style acceptance rules. It is not a user-authorized brand delivery
and not a rename of `fixtures/good` or the M4 handoff tasks.

Replay from a **new** work directory (do not treat in-tree `delivery/` as
the only allowed root):

```bash
# public pin, not author .tools (see docs/CLEAN_ENV.md)
export PATH="/usr/local/bin:/usr/bin:/bin"
export GOTOOLCHAIN=go1.26.6
sh scripts/fetch-deps.sh --file-vitals
sh scripts/build-file-vitals.sh --all-drafts

python3 reports/batch-c/task/write-pixels.py

WORKDIR=/tmp/batch-c-northline
rm -rf "$WORKDIR"
cp -a reports/batch-c/task "$WORKDIR"

cd drafts/batch-delivery-preflight
# first drop is supposed to fail (board-wide.jpg is 180x64)
/usr/bin/node src/cli.mjs \
  --spec "$WORKDIR/campaign.json" \
  --root "$WORKDIR/delivery" \
  --compact
# fixed JPEG → pass
/usr/bin/node src/cli.mjs \
  --spec "$WORKDIR/campaign.json" \
  --root "$WORKDIR/delivery-fixed" \
  --compact
```

Authoring: `campaign-v2.json` points at `kits/app-tiles-v2.json` (adds
`tile-120`). Same `delivery-fixed` must fail `missing`; `delivery-v2` passes.

Naive alternative: `python3 reports/batch-c/naive/check.py --spec … --root …`

The write-up is [`../review-response-batch-c.md`](../review-response-batch-c.md).
