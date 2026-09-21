# Local deployment and private configuration

Run `mkdir -p logs && docker compose up -d --build` from the repository root. The site is available at http://localhost:8080 and the tool and experiment origin at http://localhost:8081. Only these two ports bind to the host, and only on loopback. Prometheus, OTel, node_exporter and the worker have no published ports. This is local acceptance configuration, not a public TLS deployment.

`hosts.json` starts empty. With an empty list the probe returns no hosts and no demo servers are manufactured. Add one entry per exporter target when you need the probe: a unique `publicId`, a public `displayName`, `regionLabel`, an IANA `timeZone`, and a private `instance` matching the OTel target. Do not put IP addresses or hostnames in public display fields. Swap zero means `not-configured`; missing data means `unavailable`. The worker uses raw load averages and clamps only percentages.

## Monitoring targets

The bundled stack scrapes its own containers over the internal network, so `otel.yaml` and `prometheus.yaml` point at the `node-exporter`, `otel` and `prometheus` services. CPU, memory and load describe the Docker Linux environment, not a remote server or the macOS host.

Point real monitoring at your own private configuration: copy `otel.yaml` outside the repository, update its `static_configs` targets to your exporters while retaining `job_name: node`, and mount that file over `/etc/otel.yaml`. Keep exporter ports on a private network or authenticated tunnel. For host-wide Linux filesystem metrics, follow node_exporter's documented host root mount and `--path.rootfs`; the local container demonstration intentionally does not mount the computer's root filesystem. Change deployment configuration, not frontend code, to add hosts.

The worker only permits fixed queries. `GET /api/probe` accepts no parameters. Each host returns the documented public fields with `ok`, `offline` or `unavailable`. Only a fresh `up=0` marks a host offline. OTel preserves original sample timestamps; samples over 25 seconds old do not become healthy through re-scraping. Missing individual metrics are null. Cache duration is five seconds.

## Private build and runtime configuration

Set `ALLOWED_ORIGIN` to the exact HTTPS site origin. Use `BUILD_ENV_FILE=.env docker compose up -d --build` to inject your build environment through a BuildKit secret; the default is `.env.example`. Set matching `SITE_URL` and `LAB_ORIGIN` in that file. The environment file is never copied into image layers.

Domains, credentials, host lists and monitoring targets belong in your own private configuration and must not be committed here. Use distinct hostnames for the site and the tool and experiment origin, separate cookies, and Caddy TLS site addresses behind your own edge proxy. Do not proxy internal services publicly. The local Caddy lab endpoint never proxies `/api/errors` or `/api/probe`.

## Local logs

`POST /api/errors` accepts only `{kind, code, path}` from the configured site origin. It rejects unknown fields, query strings, oversized bodies and more than 60 events per minute globally. It stores no IP address, user agent, stack trace or media URL. Site errors and probe status changes go to `logs/site.jsonl`; rotation keeps one previous file with each file limited to approximately 1 MiB. Docker component logs rotate at 5 MiB with two files. Caddy access logging is disabled. Build failures use `logs/build.jsonl`.

## No automated deployment

This repository ships no release pipeline and no deployment script. Passing scripts and tests only verify the generic code; they do not prove that any environment works. Build, publish and deploy from your own private setup.

## Third-party licenses

Licenses for bundled third-party assets are kept under `public/vendor/licenses/` and shipped with the artifact; they are not covered by this project's MIT license. Front-end effect sources and their licenses are listed in `src/client/effects/SOURCES.md`.

## Upstream references

- [Caddy error handling](https://caddyserver.com/docs/caddyfile/directives/handle_errors)
- [OTel Prometheus exporter timestamp and metric expiry settings](https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/exporter/prometheusexporter)
- [node_exporter Docker host collection](https://github.com/prometheus/node_exporter#docker)
- [Prometheus releases](https://prometheus.io/download/)
