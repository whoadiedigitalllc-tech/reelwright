# Launch plan: Reelwright web (internal tool)

| step | status | why |
| --- | --- | --- |
| landing page | skipped | the app opens straight to Projects; nobody to market to |
| pricing / Stripe | skipped | free, single user |
| store listing / `listing.py` | skipped | not in any store; installable as a web page |
| Product Hunt / HN | skipped | internal |

## What "launch" means here

1. Host `dist-web/` somewhere you can open (see deploy.md), or run it locally with `npm run web:preview`.
2. Open it in Chrome or Edge on the computer that edits videos and cut one real video end to end.
3. Note anything slow (first import loads the ~32 MB engine; long exports render in the tab) in `replica/web/bugs.md`.

## If it ever goes public

Same as desktop (../launch/launch-plan.md), plus: link the source to meet ffmpeg.wasm's GPL, and add the hosting security headers from backend.md.
