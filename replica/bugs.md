# Bugs

| ID | sev | title | steps | expected | actual | evidence | status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| B01 | S3 | Editor has no main landmark or h1 | open any project, run axe | no violations | `landmark-one-main`, `page-has-heading-one` | e2e a11y('S02 empty') | fixed: `<main>` + sr-only h1 |
| B02 | S4 | Project card name doesn't include its visible duration | home with one project, run axe | no violations | `label-content-name-mismatch .project-open` | e2e a11y('S01 filled') | fixed: label includes duration |
| B03 | S3 | A .txt file imports as a "video" | Import -> pick notes.txt | error toast, nothing added | imported (ffprobe's tty demuxer reads text as video); preview then 403s | e2e F01-N2 | fixed: probe only accepts the served media extensions |
| B04 | S3 | Preview canvas tainted by cross-origin media | read canvas pixels while a clip shows | readable | `SecurityError: canvas has been tainted` | e2e preview check | fixed: CORS header on media:// + crossOrigin on elements |

Open S1: none.

## To check (not reproduced)

- Preview showed black behind text right after a split at 0:01 (S07.png). Likely the new clip's video element still loading when the screenshot fired. Watch for it when editing by hand.
- Many simultaneous 4K clips will stutter in preview (expected; proxies are a later feature).
- HEVC/ProRes sources: Chromium may not decode them, so the preview stays black while export still works.
