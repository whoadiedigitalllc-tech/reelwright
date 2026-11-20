# Fixes and angle

Sample: 397 rows from 2 sources, collected 2026-11-19.
- App Store (US) customer-reviews RSS for CapCut (id 1500855883): 300 reviews, 2026-11-06 to 2026-11-18. Ratings: 114×1, 34×2, 44×3, 40×4, 68×5. These are reviews of the **mobile** app.
- Hacker News comments mentioning "capcut" (Algolia API): 98.
- Not collected: Google Play, G2/Capterra/Trustpilot, Reddit (needs API keys), CapCut's own board. So "2 sources" is the ceiling on every theme below.

Links: Apple has no per-review URLs. App Store rows link to the app's reviews page, with Apple's review id as the `#review-` fragment.
Counts below are keyword matches I checked by reading the hits; `feedback.md` has the tool's raw theme table (its "Teams" theme is mostly "support team" and is ignored here).

## 1. What they hate

1. **Basics moved behind a paywall / Pro.** Price and paywalls: 47 reviews, 2 sources, avg 2.1★. "used to be free" style: 8 reviews (App Store only).
   - "Basic tools and simple features that used to be free and essential to my workflow are suddenly locked behind a Pro subscription." (1★) https://apps.apple.com/us/app/capcut-photo-video-editor/id1500855883?see-all=reviews#review-14769921547
   - "Everything is paywalled now it seems." (1★) https://apps.apple.com/us/app/capcut-photo-video-editor/id1500855883?see-all=reviews#review-14801626455
2. **Bugs, lag and crashes.** Tool theme: 32 reviews, 2 sources, avg 1.9★. Slow/lag/crash wording: 14 (App Store).
   - "App lags but wants you to pay for extra features." (1★) https://apps.apple.com/us/app/capcut-photo-video-editor/id1500855883?see-all=reviews#review-14798704957
3. **Locked at export.** 3 reviews, 1 source (thin), but the clearest single complaint:
   - "it waits until the exact moment of export to reveal that the project is locked and cannot be exported unless the user pays or subscribes." (1★) https://apps.apple.com/us/app/capcut-photo-video-editor/id1500855883?see-all=reviews#review-14781610810
4. **Billing / cancelling.** 11 reviews, 2 sources, avg 1.4★. Not relevant (no billing here).
5. **Watermark even when paying.** 2 App Store reviews (thin).
   - "I signed up for $9.99 a month option and everything produced still came with a CapCut watermark." (1★) https://apps.apple.com/us/app/capcut-photo-video-editor/id1500855883?see-all=reviews#review-14771983165

## 2. What is missing

1. **Chroma key / green screen removed or paywalled.** 8 reviews, 1 source (thin: App Store only), avg 1.6★.
   - "Bring back chroma key.. WHY IS IT GONE." (1★) https://apps.apple.com/us/app/capcut-photo-video-editor/id1500855883?see-all=reviews#review-14801370030
   - "Green screen removal button disappeared" (1★) https://apps.apple.com/us/app/capcut-photo-video-editor/id1500855883?see-all=reviews#review-14787680719
2. **Work lost after reinstall/glitch.** 2 App Store reviews (thin).
   - "I deleted the app and redownloaded it. All of my work undone." (1★) https://apps.apple.com/us/app/capcut-photo-video-editor/id1500855883?see-all=reviews#review-14763935960

## 3. What is unsolved

- **People who want a plain editor without accounts, AI upsells or a feed.** Supported by the "redesign/AI made it worse" theme: 17 reviews, 1 source (thin).
  - "The new update and all of the Ai usage sucks and needs to stop." (1★) https://apps.apple.com/us/app/capcut-photo-video-editor/id1500855883?see-all=reviews#review-14770916323

## Fix plan

| # | fix | size | skill | status | evidence |
| --- | --- | --- | --- | --- | --- |
| 1 | Every feature free; no Pro tier, watermark or export lock | S | - | **done** (by design) | paywall 47/2 sources; export lock 3; watermark 2 |
| 2 | Work can't be lost: local project files, autosave, atomic write + .bak | S | - | **done** | lost work 2 (thin) |
| 3 | No account, network, ads or notifications | S | - | **done** | AI/redesign 17 (thin); ads 9/2 sources |
| 4 | Chroma key (ffmpeg `colorkey` in export; same formula in preview, CPU pass) | M | /replica-build | **done** | 8 reviews (thin) |
| 5 | Stay fast on big files: proxy previews for 4K/HEVC | M | /replica-build | not started | lag/crash 14; bugs 32/2 sources |
| 6 | Keep the e2e suite green before every release | S | /replica-test | **done** (in place) | bugs 32/2 sources |

## Angle

```
A) For creators fed up with basic tools moving behind a paywall,
   {{app}} is a desktop editor where every feature is free and nothing is locked at export.
   Evidence: price and paywalls, 47 reviews across 2 sources.

B) For people who lost edits to an app's glitch or reinstall,
   {{app}} keeps every project as a plain file on your own disk, autosaved with a backup.
   Evidence: lost work, 2 reviews (thin).

C) For editors who want a tool, not an AI feed,
   {{app}} is a focused, offline editor with no account and no upsells.
   Evidence: redesign/AI made it worse, 17 reviews, 1 source (thin).
```

**Recommended: A, with C as the voice.** It has the strongest evidence, and it's already true of the build.
This app is for your own business, so the angle matters mostly for its name and tone (replica-brand).
