# Backend

This app has no backend. It is an offline, single-user desktop editor (see architecture.md).
The Electron main process is the "server": file storage, ffprobe, ffmpeg export, all over IPC.

| area | status | why |
| --- | --- | --- |
| auth | n/a | one OS user, local files; no accounts in scope (features.csv: skip) |
| database | n/a | one JSON document per project, atomic write + .bak (src/main/index.ts) |
| payments | n/a | own-business tool |
| email | n/a | nothing to send |
| jobs | n/a | export is a child process tied to the window |
| integrations | n/a | publishing to social platforms is skipped; export a file and upload manually |
| .env.example | n/a | no secrets or keys anywhere |

## Security checklist (the parts that apply)

- [x] secrets: none exist
- [x] input validated at the trust boundary: project ids checked against a UUID pattern before touching disk;
      filter-graph values coerced to finite numbers, colours checked against `#rrggbb`, text passed by file (no injection into ffmpeg)
- [x] ffmpeg/ffprobe spawned with an argument array, never through a shell
- [x] renderer locked down: contextIsolation, sandbox, no nodeIntegration, CSP, navigation and new windows blocked
- [x] `media://` serves only known media extensions, with range support
- [x] no user data in logs or URLs leaving the machine (nothing leaves the machine)
- [x] dependencies audited: production deps 0 vulnerabilities. Electron upgraded 33 -> 45.4.1 to clear runtime advisories.
      Remaining: esbuild (dev server only, not shipped) and electron-builder's app-builder-lib (build time only).
- [x] npm 11 install-script allowlist approved for electron, ffmpeg-static, esbuild (they download binaries)
- [ ] code signing for the Windows installer (only matters if it is shared beyond this machine; see deploy)
