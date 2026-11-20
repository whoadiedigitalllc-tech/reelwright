# Launch plan: Reelwright (internal tool)

Reelwright is for the user's own business (recon scope), so most of the public-launch steps don't apply yet.

| step | status | why |
| --- | --- | --- |
| landing.md + landing page | skipped | nobody to market to; nothing is sold |
| pricing.md + Stripe products | skipped | free, single user; "every feature free" is fix 1 |
| listing.json + `listing.py` | skipped | not going to the App Store, Play or Microsoft Store |
| screenshots, privacy labels, review notes | skipped | same |
| waitlist, Product Hunt / HN post | skipped | same |

## What "launch" means here

1. Build the installer: `npm run dist` → `dist/Reelwright Setup 0.1.0.exe` (see /replica-deploy).
2. Install it on the machine(s) that edit the business's videos.
3. First real job: cut one actual video end to end (F01) and note anything slow or missing in `replica/bugs.md`.
4. Run the manual cases in `replica/test-plan.md` during that job (drag-trim, drag-reorder, overlay overlap, missing media).
5. After two weeks of real use, rerun `/replica-diff` and pick the next build items from `fixes.md` (chroma key, proxies).

## If it ever goes public

Rerun /replica-launch with these inputs ready: trademark checks from `brand.md`, a made logo, code signing, and a privacy
policy (easy: no data leaves the machine). Lead the landing hero with angle A from `fixes.md`. Never use the original's name.
