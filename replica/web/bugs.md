# Bugs (web)

| ID | sev | title | steps | expected | actual | evidence | status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| W01 | S4 | Narrow notice used role=alert on `<main>` | 390px window, run axe | no violations | `aria-allowed-role main`, `landmark-one-main` | e2e S11 | fixed: alert moved to an inner div |

Open S1/S2: none.

## To check (not reproduced)

- The desktop "black preview right after a split" item didn't show up on the web (S02.png shows the frame at 0:01). Likely load timing, as suspected.
- Browsers other than Chromium: IndexedDB Blob storage and `OffscreenCanvas` are supported in current Firefox and Safari, but not tested.
- Safari: `<input>` cancel events and WORKERFS behaviour unverified.
