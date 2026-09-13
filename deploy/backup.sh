#!/bin/sh
set -eu
: "${RESTIC_REPOSITORY:?Set the private backup repository}"
: "${RESTIC_PASSWORD_FILE:?Set the private password file}"
cd "$(dirname "$0")/.."
set -- deploy server logs src/config.ts src/content src/assets examples
for item in .env .private lab; do
  if [ -e "$item" ]; then set -- "$@" "$item"; fi
done
restic backup "$@" --tag personal-site
restic forget --tag personal-site --keep-daily 7 --keep-weekly 4 --keep-monthly 6 --prune
