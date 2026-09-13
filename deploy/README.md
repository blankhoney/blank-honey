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
