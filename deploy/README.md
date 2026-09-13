# Local deployment and private configuration

Run `mkdir -p logs && docker compose up -d --build` from the repository root. The site is available at http://localhost:8080 and experiments at http://localhost:8081. Only these two ports bind to the host, and only on loopback. Prometheus, OTel, node_exporter and the worker have no published ports. This is local acceptance configuration, not a public TLS deployment.

The single host in `hosts.json` is a real local Docker container environment. CPU, memory and load describe the Docker Linux environment, not a remote server or the macOS host. No extra demo servers are manufactured. Swap zero means `not-configured`; missing data means `unavailable`. The worker uses raw load averages and clamps only percentages.

## Production hosts

Copy `hosts.json` to `.private/hosts.json`, replace the list with the actual four or five machines, then bind that file at `/app/deploy/hosts.json` in the worker. Each entry needs a unique `publicId`, public `displayName`, `regionLabel`, IANA `timeZone`, and private `instance` matching the OTel target. Do not put IP addresses or hostnames in public display fields.

Copy `otel.yaml` to `.private/otel.yaml` and update its `static_configs` targets to the actual exporters, retaining `job_name: node`. Mount that file over `/etc/otel.yaml`. Keep exporter ports on a private network or authenticated tunnel. For host-wide Linux filesystem metrics, follow node_exporter's documented host root mount and `--path.rootfs`; the local container demonstration intentionally does not mount the computer's root filesystem. Change deployment configuration, not frontend code, to add hosts.

The worker only permits fixed queries. `GET /api/probe` accepts no parameters. Each host returns the documented public fields with `ok`, `offline` or `unavailable`. Only a fresh `up=0` marks a host offline. OTel preserves original sample timestamps; samples over 25 seconds old do not become healthy through re-scraping. Missing individual metrics are null. Cache duration is five seconds.

Set `ALLOWED_ORIGIN` to the exact HTTPS site origin in production. Use `BUILD_ENV_FILE=.env docker compose up -d --build` to inject the private build environment through a BuildKit secret; the default is `.env.example`. Set matching `SITE_URL` and `LAB_ORIGIN` in that file. The environment file is never copied into image layers. Use distinct hostnames for the production site and lab, separate cookies, and Caddy TLS site addresses behind Cloudflare. Do not proxy internal services publicly. The local Caddy lab endpoint never proxies `/api/errors` or `/api/probe`.

## Local logs and backups

`POST /api/errors` accepts only `{kind, code, path}` from the configured site origin. It rejects unknown fields, query strings, oversized bodies and more than 60 events per minute globally. It stores no IP address, user agent, stack trace or media URL. Site errors and probe status changes go to `logs/site.jsonl`; rotation keeps one previous file with each file limited to approximately 1 MiB. Docker component logs rotate at 5 MiB with two files. Caddy access logging is disabled. Build failures use `logs/build.jsonl`.

Run `deploy/backup.sh` with private `RESTIC_REPOSITORY` and `RESTIC_PASSWORD_FILE` environment variables. The backup includes private configuration, deploy configuration, server code, source lab HTML and local logs. It excludes rebuildable site output, node_modules and Prometheus history. Restore into a separate directory first with `restic restore latest --target /path/to/restore`, then validate configuration before replacing a live deployment.

## Upstream references

- [Caddy error handling](https://caddyserver.com/docs/caddyfile/directives/handle_errors)
- [OTel Prometheus exporter timestamp and metric expiry settings](https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/exporter/prometheusexporter)
- [node_exporter Docker host collection](https://github.com/prometheus/node_exporter#docker)
- [Prometheus releases](https://prometheus.io/download/)

## Production release workflow

`production.compose.yaml` overlays the local stack with loopback ports 18080/18081, private host and Collector files, a read-only Linux host root for node_exporter, and a shared TLS proxy network. Only the frontend joins that proxy network. Set `STATE_DIR`, `EDGE_NETWORK`, `WEB_IMAGE` and `WORKER_IMAGE`; keep real values in private deployment state. Five container memory limits total 768 MiB.

The production host keeps source in `/srv/blank-honey/app`, private configuration and logs in `shared`, and release manifests in `releases/<commit>-<UTC time>`. Install `remote-deploy.sh` root-owned at `/usr/local/sbin/blank-honey-deploy`. A dedicated SSH account uses a separate deploy key with `restrict` and a forced command that passes only `SSH_ORIGINAL_COMMAND` to this script through its single sudoers allowance. The script accepts exactly `deploy <40-character Git commit>`, requires that commit to equal fetched `origin/main`, serializes execution with `flock`, and never reads a caller-provided path or command.

Builds complete before the isolated stack is updated. Each successful release retains a resolved Compose manifest and tagged images. A failed activation or health check restores the preceding manifest when available. To roll back manually, run `docker compose --project-name blank-honey -f /srv/blank-honey/previous/compose.yaml up -d --no-build`; do not remove image tags or volumes needed by retained releases. The old site's proxy fragment, source, private environment, durable files and database dump are backed up separately before the first cutover. Restoring that proxy fragment returns traffic to the still-running old site without a database restore.

The deployment script does not edit the edge proxy. The first main-domain cutover remains a separate step after the new service is accepted. A DNS-configurable, independent lab origin must point to the lab listener; production never publishes lab content on the main origin.


The production backup service uses `remote-backup.sh`, with root-only repository and password paths outside the checkout. `blank-honey-backup.timer` runs daily with a randomized delay. Retention keeps seven daily, four weekly and six monthly snapshots. Backups include private shared configuration, local logs, release manifests, the original site's rollback backup, and source content/assets. A copy of the encrypted repository and its separately stored recovery password can be downloaded to a private local directory for recovery if the server is lost. Run `restic check` and restore a selected file into a separate directory before relying on a backup. This local copy must be refreshed after material content changes; the daily timer itself writes only to the server repository.
