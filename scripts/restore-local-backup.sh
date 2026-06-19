#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKUP="${ROOT}/emergency_migration_backup.gz"
CONTAINER="${MONGO_CONTAINER:-lmstudio_host-mongodb-1}"
URI="${MONGO_RESTORE_URI:-mongodb://root:password@localhost:27017/?authSource=admin}"
FROM_NS="${MONGO_RESTORE_FROM_NS:-test.*}"
TO_NS="${MONGO_RESTORE_TO_NS:-freeappractice.*}"

if [[ ! -f "$BACKUP" ]]; then
  echo "Backup not found: $BACKUP" >&2
  exit 1
fi

echo "Restoring $BACKUP to $TO_NS via container $CONTAINER ..."
gunzip -c "$BACKUP" | docker exec -i "$CONTAINER" mongorestore \
  --uri="$URI" \
  --archive \
  --nsFrom="$FROM_NS" \
  --nsTo="$TO_NS" \
  --drop

echo "Restore complete."
