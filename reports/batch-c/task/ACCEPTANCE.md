# Northline Transit rider-app v1 — store listing pack

**Marker:** `synthetic-authorized-substitute`

This is **not** a user-supplied, rights-cleared brand pack. No authorized
real artwork was available for Batch C. The files and names below are
**synthetic**, invented for this review. Acceptance is written the way a
real store-listing handoff would be written: exact names, real bytes,
exact pixels, alpha policy, no extras, whole-campaign pass/fail.

Do not treat the “Northline Transit” name, colors, or layout as a real
agency’s assets.

## Who hands what to whom

Release engineering will not upload the rider-app listing until this pack
matches the store checklist. Design delivers two kits in one campaign
directory. A reader who was not on the authoring team runs a technical
preflight and reports pass or fail.

This check does **not** judge look, copy, or brand. It does **not**
generate missing artwork.

## Campaign layout

```text
northline-transit-v1/
  app-tiles/                 ← kit root (asset-delivery)
    tile-20.png
    tile-40.png
    tile-80.png
    lockup.png
  station-boards/            ← kit root (channel-cover)
    board-square.png
    board-wide.jpg
    board-tall.png
```

Undeclared files inside a kit root (README, spec JSON, scratch exports)
are extra files and fail the kit.

## Kit A — `app-tiles` (kind `asset-delivery`)

Home-screen tiles plus an opaque store-header lockup.

| Slot id   | Path          | Format | Size     | Alpha    | Required |
| --------- | ------------- | ------ | -------- | -------- | -------- |
| tile-20   | tile-20.png   | png    | 20×20    | present  | yes      |
| tile-40   | tile-40.png   | png    | 40×40    | present  | yes      |
| tile-80   | tile-80.png   | png    | 80×80    | present  | yes      |
| lockup    | lockup.png    | png    | 180×36   | absent   | yes      |

Alpha policy is the File Vitals `image.has_alpha` policy used by
`asset-delivery-preflight`. Omitted `has_alpha` is **unknown**, not present
and not absent.

## Kit B — `station-boards` (kind `channel-cover`)

Digital station screens. No transparency. Basename must match
`^board-(square|wide|tall)\.(png|jpe?g)$`.

| Slot id       | Path              | Format | Size    | Aspect | Required |
| ------------- | ----------------- | ------ | ------- | ------ | -------- |
| board-square  | board-square.png  | png    | 90×90   | 1:1    | yes      |
| board-wide    | board-wide.jpg    | jpeg   | 180×60  | 3:1    | yes      |
| board-tall    | board-tall.png    | png    | 60×180  | 1:3    | yes      |

## Whole-campaign rule

The campaign passes only when every required kit passes. A kit fails if
any of: missing directory (required), missing slot, extra file, name /
namePattern, format (bytes, not extension), width, height, aspect, alpha /
transparency, or a File Vitals inspect status/integrity/error diagnostic
that the combinator treats as not deliverable.

Exit codes of the batch CLI (from `HANDOFF.md`): `0` pass, `1` domain fail
(the report is the answer; do not retry the same command), `2` usage /
spec / adapter error.

## First delivery (intentional defect)

The first drop of `board-wide.jpg` is 180×64 (designer export used a 16:9
adjacent height by mistake). Expected: campaign **fail**,
`failedKits=["station-boards"]`, `failedIds` include `height` and
`aspect`. App-tiles must still pass. Fix is replacing that one JPEG with
180×60. Specs do not change.

## Policy addendum (authoring, not first usage)

Store listing later requires a 120×120 tablet tile `tile-120.png`
(alpha present). That is a **spec** change. The same passing files must
then fail `missing` on `tile-120` until the extra file exists.

## Not in scope

- Aesthetic / brand / copy review
- ICO / ICNS
- Generating JPEG station boards
- Installing Agent Host
- Claiming this pack is a real third-party delivery
