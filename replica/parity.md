# Parity report (2026-11-19)

**Verdict: shippable** for its own-business use. Must-haves 17/17, feature score 91.7, no open S1/S2 bugs.
Not yet "better than the original": that needs the fixes from /replica-entrepreneur.

## Scores

| measure | score | note |
| --- | --- | --- |
| feature parity | 91.7 | `parity.py replica/features.csv` |
| layout per screen | not measured | `replica/screens/` has no reference shots of the original. To run it, save CapCut screenshots (your own install, 1440x900) as S01/S02/S07/S09.png and run `imgdiff.py` against `replica/clone-screens/` |

Caveat: trim-by-drag and drag-reorder are marked `yes` from code and unit tests on the underlying ops. The pointer gestures themselves have not been clicked through by hand (test-plan.md, manual cases).

## Missing, in build order

1. [should] Crossfade / slide / wipe transitions (have fades + dip to black only)
2. [should] Rotation for text clips (drawtext can't rotate; would need rendering text to an image first)
3. [could] Colour adjust (brightness / contrast / saturation): `eq` filter in export + canvas `filter` in preview, small
4. [could] Crop
5. [could] Freeze frame
6. [could] Auto captions (local whisper.cpp)

## Behaviour differences (from recon notes, not a side-by-side session)

| flow | original | clone | fix or keep |
| --- | --- | --- | --- |
| F01 clicks | ~12 | 9 (New, Import, pick, tile, tile, Text tab, preset, Export, Choose file and export) + type | keep, fewer clicks |
| F01 add clip | drag to timeline | drag **or** click the tile (adds to the end of the main track) | keep |
| F01 split key | Ctrl+B | S | keep; consider also binding Ctrl+B for switchers |
| F04 transitions | tile dropped on a cut | select a clip, click a fade tile | keep (simpler); add crossfade later |
| F02 missing media | relink dialog | "Missing" badge + toast, no relink | fix later (relink action) |
| accounts / cloud | sign-in, cloud drafts | none, local files only | keep (out of scope) |

## Next

Parity is there for the must-haves, so the next step is /replica-entrepreneur.
