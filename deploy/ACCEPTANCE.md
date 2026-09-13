# Server acceptance — 2026-09-13

- `node --import tsx --test tests/server.test.ts`: 2 tests passed. Covers private-field projection, source timestamp expiry, short cache, down versus query failure, host validation, origin rejection, unknown fields, query strings, payload size, global rate limit and bounded log rotation.
- `npm run check`: 0 errors, 0 warnings, 2 existing XMLValidator deprecation hints.
- `docker compose config --quiet` and `sh -n deploy/backup.sh`: passed.
- Real chain verified: node_exporter 1.12.1 → OTel 0.160.0 → Prometheus 3.14.0 → Node worker → Caddy 2.11.4. Public JSON returned one real local Docker host with `status=ok`; no fabricated remote hosts.
- Stopping node_exporter produced `offline`, `online=false`, null metric fields. Stopping Prometheus produced `unavailable`, `online=null`. Stopping OTel made the original sample expire and produced `unavailable`. All components were restarted; `ok` recovered.
- Main HTML: HTTP 200, `public, max-age=0, must-revalidate`. Built JS: HTTP 200, `public, max-age=31536000, immutable`. Probe GET: HTTP 200, `no-store`. Unknown main route: custom HTML, HTTP 404, `no-store` and security headers.
- Lab `/tools/json/`: HTTP 200 on port 8081. Lab `/api/probe`: HTTP 404. Main error POST with main origin: 202 and local JSONL entry. Same request with lab origin: 403.
- Only loopback ports 8080 and 8081 are published. All five services are running. The metrics network is internal.
- Docker's packaged Caddy executable carries a file capability. Removing that capability during image build allows `cap_drop: ALL` while serving unprivileged ports.
- Docker registry authorization initially timed out. Explicit image pulls succeeded; no checksum implementation was added.

The final frontend image rebuild passed, including BuildKit environment loading without overriding `SITE_URL` or `LAB_ORIGIN`. Browser acceptance on port 8080 confirmed live probe metrics, matching content/cohort dimensions, mobile graph fitting, and the isolated JSON tool on port 8081. Public deployment is deferred until the local construction milestone. A real restic repository is not configured; backups were syntax-checked but not executed.
