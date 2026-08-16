#!/bin/sh
# byb-restore.sh — restore one BYB! Budget instance from a backup taken by
# byb-backup.sh.
#
# Usage:
#   sh byb-restore.sh -b BACKUP_RUN_DIR -i CONTAINER [-y]
#   sh byb-restore.sh -h
#
#   List what you can restore from:
#     ls -d /mnt/tank/byb-backups/*/ | tail
#     cat /mnt/tank/byb-backups/<run>/MANIFEST.txt
#
# Exit codes:
#   0  restored and verified
#   1  configuration error (bad arguments, backup or container not found)
#   2  the backup failed validation — nothing was touched
#   3  the restore was attempted and could not be verified
#
# Why this is a script and not just a documented sequence of docker commands:
# the ordering is not obvious and getting it wrong fails silently. server.js
# reads budget.json inside every request handler, so a restored file is live
# immediately with no restart — but /api/data guards writes with a dataVersion
# counter, and that counter is a plain integer, not a content hash. A browser
# still holding the SAME version number the backup was taken at passes the
# guard and overwrites the restore with its own in-memory state, bumping the
# counter as it goes. Stopping and starting the container does NOT prevent
# that. Emptying sessions.json does, because every such client is then answered
# 401 and its pending save is discarded. This script always does that step.
# See BACKUP.md for the measurements behind all of the above.

set -u
LC_ALL=C
export LC_ALL

CONTAINER_DATA_DIR="/data"
RESTORE_FILES="budget.json passwords.json"
NAME_FILTER="byb"

say() { printf '%s\n' "$*"; }
warn() { printf '%s\n' "$*" >&2; }
die() { dc=$1; shift; warn "byb-restore: FAILED — $*"; exit "$dc"; }

usage() {
  cat <<EOF
Usage: sh byb-restore.sh -b BACKUP_RUN_DIR -i CONTAINER [-y]

  -b DIR   a run directory written by byb-backup.sh, e.g.
           /mnt/tank/byb-backups/2026-08-16_030000
  -i NAME  the container to restore into, e.g. ix-byb-budget-byb-budget-1
  -y       do not ask for confirmation (required when stdin is not a terminal)
  -h       this help

Restores budget.json and passwords.json together — they are a matched pair —
and empties sessions.json so that no browser still holding the old data can
overwrite what was just restored.
EOF
}

# Same check byb-backup.sh uses, and deliberately kept identical: read the
# candidate bytes from stdin, prove they are a JSON object, then compare them
# byte-for-byte with a file inside the container. Duplicated rather than shared
# so that each script is a single file an operator can copy to the NAS on its
# own; if you change one, change its twin.
VERIFY_JS='
var fs = require("fs");
var other = process.argv[1];
var incoming, existing, data;
try { incoming = fs.readFileSync(0); }
catch (e) { process.stderr.write("cannot read the file: " + e.message); process.exit(3); }
if (incoming.length === 0) { process.stderr.write("file is zero bytes"); process.exit(4); }
try { data = JSON.parse(incoming.toString("utf8")); }
catch (e) { process.stderr.write("not valid JSON: " + e.message); process.exit(5); }
if (data === null || typeof data !== "object" || Array.isArray(data)) {
  process.stderr.write("valid JSON but not an object");
  process.exit(6);
}
var tx = Array.isArray(data.transactions) ? data.transactions.length : "-";
var summary = "bytes=" + incoming.length + " keys=" + Object.keys(data).length + " transactions=" + tx;
if (other) {
  try { existing = fs.readFileSync(other); }
  catch (e) { process.stderr.write("cannot read " + other + ": " + e.message); process.exit(7); }
  if (Buffer.compare(existing, incoming) !== 0) {
    process.stderr.write("the file in the container does not match the backup");
    process.exit(8);
  }
  summary = summary + " match=yes";
}
process.stdout.write(summary);
'

# ── Arguments ───────────────────────────────────────────────────────────────

BACKUP_DIR=""
INSTANCE=""
ASSUME_YES=0

while getopts "b:i:yh" opt; do
  case "$opt" in
    b) BACKUP_DIR=$OPTARG ;;
    i) INSTANCE=$OPTARG ;;
    y) ASSUME_YES=1 ;;
    h) usage; exit 0 ;;
    *) usage >&2; exit 1 ;;
  esac
done
shift $((OPTIND - 1))
[ $# -eq 0 ] || die 1 "unexpected argument: $1"

[ -n "$BACKUP_DIR" ] || { usage >&2; die 1 "-b (backup run directory) is required"; }
[ -n "$INSTANCE" ] || { usage >&2; die 1 "-i (container name) is required"; }

BACKUP_DIR=${BACKUP_DIR%/}
[ -d "$BACKUP_DIR" ] || die 1 "backup directory '$BACKUP_DIR' does not exist"

# Check the container before the backup contents: a mistyped instance name is
# far more usefully reported as "no such container" than as "that backup has
# nothing for it", which is true of any name you invent.
command -v docker >/dev/null 2>&1 || die 1 "docker is not on PATH"
docker inspect "$INSTANCE" >/dev/null 2>&1 || die 1 "no container named '$INSTANCE' exists on this host"

SOURCE_DIR="$BACKUP_DIR/$INSTANCE"
[ -d "$SOURCE_DIR" ] || die 1 "'$BACKUP_DIR' contains no backup for '$INSTANCE'. Available: $(ls "$BACKUP_DIR" 2>/dev/null | tr '\n' ' ')"

if [ ! -f "$BACKUP_DIR/BACKUP-OK" ]; then
  warn "byb-restore: WARNING — '$BACKUP_DIR' has no BACKUP-OK marker, so that run did not fully verify."
  warn "             The files for this instance are still checked below before anything is touched."
fi

# ── Validate the backup before touching the instance ────────────────────────
#
# Verification needs Node, and the only Node we are willing to assume is the
# one inside a BYB! container. Prefer the target; fall back to any other
# running instance so that a crashed container can still be restored.

VERIFIER=""
if [ "$(docker inspect -f '{{.State.Running}}' "$INSTANCE" 2>/dev/null)" = "true" ]; then
  VERIFIER=$INSTANCE
else
  VERIFIER=$(docker ps --filter "name=$NAME_FILTER" --format '{{.Names}}' 2>/dev/null | head -n 1)
fi
[ -n "$VERIFIER" ] || die 1 "no BYB! container is running, so the backup cannot be validated. Start any BYB! instance and re-run."

say "Backup to restore:  $SOURCE_DIR"
say "Into container:     $INSTANCE"
say "Validated using:    $VERIFIER"
say ""

for f in $RESTORE_FILES; do
  [ -f "$SOURCE_DIR/$f" ] || die 2 "the backup is missing $f. budget.json and passwords.json must be restored together — refusing to restore half an instance."
  [ -s "$SOURCE_DIR/$f" ] || die 2 "the backup's $f is zero bytes."
  out=$(docker exec -i "$VERIFIER" node -e "$VERIFY_JS" "" < "$SOURCE_DIR/$f" 2>&1)
  [ $? -eq 0 ] || die 2 "the backup's $f did not validate: $out. Nothing has been touched."
  say "  backup  $f  $out"
done

# Show what is being replaced, so the operator can see the trade before saying yes.
if [ "$(docker inspect -f '{{.State.Running}}' "$INSTANCE" 2>/dev/null)" = "true" ]; then
  for f in $RESTORE_FILES; do
    cur=$(docker exec "$INSTANCE" node -e '
      var fs = require("fs");
      try {
        var d = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
        var tx = Array.isArray(d.transactions) ? d.transactions.length : "-";
        process.stdout.write("keys=" + Object.keys(d).length + " transactions=" + tx +
          " dataVersion=" + (typeof d.dataVersion === "number" ? d.dataVersion : "-"));
      } catch (e) { process.stdout.write("unreadable or not JSON (" + e.message + ")"); }
    ' "$CONTAINER_DATA_DIR/$f" 2>&1)
    say "  current $f  $cur"
  done
fi

say ""
say "This will REPLACE budget.json and passwords.json in $INSTANCE, empty its"
say "sessions.json (everyone signs in again), and restart the container."

if [ "$ASSUME_YES" -ne 1 ]; then
  [ -t 0 ] || die 1 "stdin is not a terminal; pass -y if you really mean to restore without confirmation"
  printf 'Type RESTORE to continue: '
  read -r reply
  [ "$reply" = "RESTORE" ] || die 1 "not confirmed — nothing was touched"
fi

# ── Restore ─────────────────────────────────────────────────────────────────

WAS_RUNNING=$(docker inspect -f '{{.State.Running}}' "$INSTANCE" 2>/dev/null)

say ""
say "Stopping $INSTANCE..."
docker stop "$INSTANCE" >/dev/null 2>&1 || die 3 "could not stop '$INSTANCE'"

for f in $RESTORE_FILES; do
  out=$(docker cp "$SOURCE_DIR/$f" "$INSTANCE:$CONTAINER_DATA_DIR/$f" 2>&1)
  if [ $? -ne 0 ]; then
    docker start "$INSTANCE" >/dev/null 2>&1
    die 3 "could not copy $f into '$INSTANCE' — docker said: $out. The container has been started again; its data is whatever the failed copy left, so check it before using it."
  fi
  say "  restored $f"
done

# The step that makes the restore stick. Without it, a browser still holding
# the dataVersion this backup was taken at will pass the optimistic-concurrency
# guard and quietly overwrite everything restored above.
EMPTY_SESSIONS="${TMPDIR:-/tmp}/byb-restore-sessions.$$"
printf '{}\n' > "$EMPTY_SESSIONS" || die 3 "could not stage an empty sessions.json in ${TMPDIR:-/tmp}"
out=$(docker cp "$EMPTY_SESSIONS" "$INSTANCE:$CONTAINER_DATA_DIR/sessions.json" 2>&1)
cp_rc=$?
rm -f "$EMPTY_SESSIONS"
[ $cp_rc -eq 0 ] || { docker start "$INSTANCE" >/dev/null 2>&1; die 3 "could not empty sessions.json — docker said: $out. Every open browser can still overwrite the data just restored. Sign everyone out manually before anyone uses the app."; }
say "  emptied sessions.json (all sessions invalidated)"

if [ "$WAS_RUNNING" = "true" ]; then
  say "Starting $INSTANCE..."
  docker start "$INSTANCE" >/dev/null 2>&1 || die 3 "restored the files but could not start '$INSTANCE'"
else
  say "Starting $INSTANCE (it was not running before the restore)..."
  docker start "$INSTANCE" >/dev/null 2>&1 || die 3 "restored the files but could not start '$INSTANCE'"
fi

# ── Prove it ────────────────────────────────────────────────────────────────
#
# Wait for the container to be able to run node again, then compare what is now
# inside it against the backup, byte for byte.

attempt=1
while [ "$attempt" -le 15 ]; do
  docker exec "$INSTANCE" true >/dev/null 2>&1 && break
  attempt=$((attempt + 1))
  sleep 1
done

say ""
failed=0
for f in $RESTORE_FILES; do
  out=$(docker exec -i "$INSTANCE" node -e "$VERIFY_JS" "$CONTAINER_DATA_DIR/$f" < "$SOURCE_DIR/$f" 2>&1)
  if [ $? -eq 0 ]; then
    say "  verified $f in $INSTANCE  $out"
  else
    warn "  FAILED to verify $f in $INSTANCE: $out"
    failed=$((failed + 1))
  fi
done

[ "$failed" -eq 0 ] || die 3 "$failed file(s) in '$INSTANCE' do not match the backup. Do not let anyone use this instance until that is resolved."

say ""
say "byb-restore: OK — $INSTANCE restored from $BACKUP_DIR and verified byte-for-byte."
say "Everyone must sign in again. Tell them to fully close and reopen the app"
say "rather than keep using a tab that was open before the restore."
exit 0
