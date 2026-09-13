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


## Production acceptance — 2026-09-13

- CI and deployment succeeded for accepted commit `7ca32a2f7539e7a67042af4c414bcea179ef5663` (CI run 34728997988, Deploy run 34729083870). Private build configuration, Giscus and both available radio sources were included. A timestamp build argument refreshes changed private configuration without adding a checksum mechanism.
- The original blog's source, private configuration, proxy route, durable files and database were backed up before cutover. Fifty published Markdown articles and 13 referenced images were migrated. The obsolete database-only article was a streamed not-found page and remains preserved in backup; comments and identities were not republished.
- The production deployment account accepts only the forced `deploy <commit>` command. An arbitrary shell command was rejected. The script fetches an explicit main refspec, uses readable public checkout permissions and private manifest permissions, and retains release-specific image tags and Compose manifests for rollback.
- The new stack runs on loopback ports 18080/18081. Only its frontend joins the existing TLS proxy network. The probe returns actual host metrics through node_exporter → OTel → Prometheus → Worker, including host-root disk usage and explicit absent-swap state.
- The graph has five nodes and five validated edges, including linked Unicode article identifiers. The probe is healthy and uses no-store responses. Independent lab HTTPS validates normally, serves its tool, and returns 404 for the main probe API.
- Main-domain cutover passed Caddy validation and reload. All 50 article URLs returned HTTP 200. All 100 old Chinese/English article URLs returned HTTP 301 to the correct destinations, including encoded Chinese slugs; both old language home pages redirect to the article index. The legacy matcher rewrites before redirecting through Caddy's URI placeholder so Unicode is encoded correctly.
- Both existing operations routes retained their original HTTP 401 responses. Other proxy sites were not changed. Only the previous blog application and its dedicated database were stopped after acceptance; their containers, data volumes and rollback backup remain available.
- Error ingestion accepted a main-origin verification event with HTTP 202 and rejected the lab origin with HTTP 403. The production event log contained only healthy probe transitions and that explicit verification event; no browser, playback or navigation errors were present. Logs were retained.
- The root-only encrypted restic repository has a daily systemd timer. Backup, repository check, selected-file restore and byte comparison passed. A separate ignored local copy of the encrypted repository and its recovery password provides a second-machine recovery copy. The final accepted feature release backup was refreshed after cutover, rechecked, restored for byte comparison, and copied to the private local archive.

The main task records browser screenshots and Lighthouse evidence separately. Current production rollback commands are documented in `docs/operations.md`.
