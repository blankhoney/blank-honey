#!/bin/sh
# Root-owned production backup; credentials stay outside the source checkout.
set -eu
umask 077
export RESTIC_REPOSITORY=/srv/blank-honey/restic
export RESTIC_PASSWORD_FILE=/root/.config/blank-honey/restic-password
exec 9>/srv/blank-honey/backup.lock
flock -n 9 || exit 0
set -- /srv/blank-honey/shared /srv/blank-honey/backups /srv/blank-honey/releases
for item in src/content src/assets examples deploy server; do
  if [ -d "/srv/blank-honey/app/$item" ]; then set -- "$@" "/srv/blank-honey/app/$item"; fi
done
restic backup "$@" --tag blank-honey
restic forget --tag blank-honey --keep-daily 7 --keep-weekly 4 --keep-monthly 6 --prune
