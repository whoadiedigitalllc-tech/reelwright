# Deploy (web) — 2026-11-20

**Live:** https://whoadiedigitalllc-tech.github.io/reelwright/
**Repo (public):** https://github.com/whoadiedigitalllc-tech/reelwright
**How:** GitHub Actions (`.github/workflows/pages.yml`) runs unit tests, builds `dist-web`, and publishes to Pages on every push to `main`.

## Preflight (2026-11-19, local)

| check | result |
| --- | --- |
| typecheck | pass |
| unit (`npm test`) | 16/16 |
| web e2e (local build) | 4/4 |
| desktop e2e | 3/3 |
| parity | 93.0, must-haves 21/21 |
| brand sweep | clean |
| open S1/S2 | none |
| listing.py | n/a (not in a store) |

## Live check (2026-11-20)

`WEB_URL=https://whoadiedigitalllc-tech.github.io/reelwright/ npx playwright test --config playwright.web.config.ts`: 4/4. That covers import, edit, chroma key, export download, reload persistence, error toast, narrow notice, axe and no console errors.

## Not applicable

No database, env vars, Stripe, OAuth, email, or domain DNS. Projects stay in each visitor's browser.

## Known gaps

- No custom headers: GitHub Pages can't set `nosniff` or `Referrer-Policy`. The CSP is in a meta tag. Move to Netlify or Cloudflare (with the wasm split) if headers matter.
- Commit history author was rewritten to the GitHub noreply address before the first push.
- Licence: the site serves GPL ffmpeg.wasm, and the public repo is the source offer. No LICENSE file has been chosen for your own code yet.
- No monitoring or analytics (none needed for an internal tool).
- Workflow actions use Node 20 (deprecation warning). Bump to the v5 actions when they are released.

## Custom domain (later, optional)

Buy the domain yourself, then: CNAME `www` -> `whoadiedigitalllc-tech.github.io`, plus apex A records 185.199.108.153, .109.153, .110.153, .111.153. Set it in Settings -> Pages and tick "Enforce HTTPS".
