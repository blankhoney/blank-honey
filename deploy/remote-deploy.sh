#!/bin/sh
# Installed root-owned as /usr/local/sbin/blank-honey-deploy.
set -eu
umask 022
base=/srv/blank-honey
case "${1-}" in
  'deploy '*) revision=${1#deploy } ;;
  *) echo 'Expected deploy followed by a Git commit.' >&2; exit 2 ;;
esac
[ "$#" -eq 1 ] && [ "${#revision}" -eq 40 ] || exit 2
case "$revision" in *[!0-9a-f]*) exit 2 ;; esac
exec 9>"$base/deploy.lock"
flock -n 9 || { echo 'Deployment already running.' >&2; exit 1; }
cd "$base/app"
git fetch --depth=1 origin +refs/heads/main:refs/remotes/origin/main
[ "$(git rev-parse origin/main)" = "$revision" ] || { echo 'Commit is not current main.' >&2; exit 1; }
git reset --hard "$revision"
export STATE_DIR="$base/shared" BUILD_ENV_FILE="$base/shared/site.env"
release_id="$revision-$(date -u +%Y%m%dT%H%M%SZ)"
export WEB_IMAGE="blank-honey-web:$release_id" WORKER_IMAGE="blank-honey-worker:$release_id"
compose() {
  docker compose --project-name blank-honey --env-file "$STATE_DIR/site.env" -f compose.yaml -f deploy/production.compose.yaml "$@"
}
compose config --quiet
compose build --build-arg SITE_CONFIG_VERSION="$(date +%s)" web worker
release="$base/releases/$release_id"
umask 077
mkdir -p "$release"
compose config > "$release/compose.yaml"
printf '%s\n' "$revision" > "$release/revision"
previous=$(readlink -f "$base/current" 2>/dev/null || true)
rollback() {
  if [ -n "$previous" ] && [ -f "$previous/compose.yaml" ]; then
    docker compose --project-name blank-honey -f "$previous/compose.yaml" up -d --no-build
  fi
}
if ! compose up -d --no-build; then rollback; exit 1; fi
healthy=false
for attempt in $(seq 1 30); do
  if curl --max-time 5 --fail --silent http://127.0.0.1:18080/ >/dev/null &&
     curl --max-time 5 --fail --silent http://127.0.0.1:18080/api/probe >/dev/null &&
     [ "$(curl --max-time 5 --silent --output /dev/null --write-out '%{http_code}' http://127.0.0.1:18081/api/probe)" = 404 ]; then
    healthy=true
    break
  fi
  sleep 2
done
if [ "$healthy" != true ]; then
  rollback
  echo 'Health check failed; previous release restored when available.' >&2
  exit 1
fi
if [ -n "$previous" ] && [ "$previous" != "$release" ]; then ln -sfn "$previous" "$base/previous"; fi
ln -sfn "$release" "$base/current"
echo "Deployed $revision to the isolated stack."
