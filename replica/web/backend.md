# Backend (web)

Still no backend. The web build is static files. Everything runs in the visitor's browser, and nothing is sent anywhere.

| area | status | why |
| --- | --- | --- |
| auth, database server, payments, email, jobs | n/a | single user, files stay in the browser (see ../backend.md) |
| storage | IndexedDB in the browser | `src/web/api.ts`; persistence requested with `navigator.storage.persist()` |
| processing | ffmpeg.wasm in a Web Worker | no server-side rendering |
| .env.example | n/a | no secrets |

## Security checklist (web)

- [x] no secrets; nothing in the bundle that shouldn't be public
- [x] CSP in `src/web/index.html`: self only, plus `blob:` for media/workers and `'wasm-unsafe-eval'` for ffmpeg.wasm. No third-party origins
- [x] uploads: only the media extensions the app supports are accepted (same allowlist as desktop); files never leave the device
- [x] filter-graph inputs: same coercion as desktop (numbers, `#rrggbb` colours); text goes in as a rendered PNG, never as text in the graph
- [x] no user data in URLs or logs; no analytics
- [ ] hosting headers (set at deploy): `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, long cache on `/assets/*` (hashed names)
- [x] licence: @ffmpeg/core is GPL-2.0-or-later and is served to visitors. Fine for your own use; if you publish the site, link to the source (this repo, or ffmpeg.wasm's) to meet the GPL
