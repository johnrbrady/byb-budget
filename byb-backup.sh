#!/bin/sh
# byb-backup.sh — back up every BYB! Budget instance running on this host.
#
# Each household's entire financial history is a single JSON file inside its
# container. This script copies budget.json and passwords.json out of every
# BYB! container, verifies what it wrote, keeps a rotating history, and fails
# loudly when it cannot prove the backup is good.
#
# Usage:
#   sh byb-backup.sh [-d DEST] [-k KEEP]     # take a backup
#   sh byb-backup.sh -c [-d DEST] [-a HOURS] # check the last run was recent
#   sh byb-backup.sh -h                      # help
#
# Exit codes:
#   0  every instance backed up and verified
#   1  configuration error (bad arguments, destination unusable, no docker)
#   2  no BYB! instances found — the fleet cannot legitimately be empty
#   3  one or more instances failed; the run is partial, not successful
#
# POSIX sh. No jq, no python, no GNU-only flags, no bashisms — the TrueNAS
# host's tooling is not something this script is willing to assume.

set -u
LC_ALL=C
export LC_ALL

# ── Configuration ───────────────────────────────────────────────────────────

# Substring matched against container names. Every instance is named
# ix-byb-<household>-byb-<household>-1, so a household added later is picked up
# with no edit to this script. That is the whole point: update-truenas.sh
# hard-coded three names, missed ix-byb-aleem, and nobody noticed for months.
NAME_FILTER="byb"

# Data lives here inside the container (BYB_DATA_DIR=/data in the Dockerfile).
CONTAINER_DATA_DIR="/data"

# sessions.json is deliberately absent: it holds bearer tokens, which are
# worthless in a backup and a liability if the backup is ever read by someone
# who should not have them. budget.json and passwords.json together are what a
# working instance needs — see BACKUP.md for why restoring one without the
# other is unsafe.
BACKUP_FILES="budget.json passwords.json"

DEFAULT_DEST="/mnt/tank/byb-backups"
DEFAULT_KEEP=14
DEFAULT_MAX_AGE_HOURS=36

# A copy can be torn: server.js writes with a plain fs.writeFileSync and no
# temp-file-and-rename, so a save landing mid-copy produces a truncated read.
# It can also simply change between the copy and the verify. Both are transient,
# so retry a few times before calling it a failure; a genuinely corrupt source
# file fails every attempt and is correctly reported.
MAX_ATTEMPTS=3
RETRY_DELAY_SECONDS=1

# Run directories are named by timestamp. This glob is also the retention
# safety net: nothing that fails to match it is ever a deletion candidate, so
# anything else the operator keeps in the destination is untouchable.
RUN_GLOB='[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]_[0-9][0-9][0-9][0-9][0-9][0-9]'

# Written into a completed run directory only when every file verified. It is
# what retention counts, so a failed run can never be mistaken for a good one.
OK_MARKER="BACKUP-OK"

# ── Verification ────────────────────────────────────────────────────────────
#
# Run inside the container with the container's own Node. The host may have no
# jq, no python3 and no node, and guessing wrong is how a backup script quietly
# stops verifying anything. The container is guaranteed to have Node because it
# is a Node Alpine image and it has to be running for us to copy out of it — and it
# is the exact runtime that will have to parse this file during a restore, so
# it is the right judge of whether the file is usable.
#
# The host's copy is piped in on stdin, so this checks the bytes that actually
# landed on disk, not the source we hoped we copied. It then re-reads the
# source inside the container and compares byte-for-byte, which is what turns
# "the copy ran" into "the copy is provably identical to the live file".
#
# Single-quoted for the shell, so the JS below uses double quotes only.
VERIFY_JS='
var fs = require("fs");
var src = process.argv[1];
var copy, orig, data;
try { copy = fs.readFileSync(0); }
catch (e) { process.stderr.write("cannot read the backup copy: " + e.message); process.exit(3); }
if (copy.length === 0) { process.stderr.write("backup copy is zero bytes"); process.exit(4); }
try { data = JSON.parse(copy.toString("utf8")); }
catch (e) { process.stderr.write("backup copy is not valid JSON: " + e.message); process.exit(5); }
if (data === null || typeof data !== "object" || Array.isArray(data)) {
  process.stderr.write("backup copy is valid JSON but not an object");
  process.exit(6);
}
try { orig = fs.readFileSync(src); }
catch (e) { process.stderr.write("cannot re-read the live file " + src + ": " + e.message); process.exit(7); }
if (Buffer.compare(orig, copy) !== 0) {
  process.stderr.write("backup copy does not match the live file (changed mid-copy, or torn read)");
  process.exit(8);
}
var tx = Array.isArray(data.transactions) ? data.transactions.length : "-";
var users = Array.isArray(data.users) ? data.users.length : "-";
process.stdout.write("bytes=" + copy.length + " keys=" + Object.keys(data).length +
  " transactions=" + tx + " users=" + users);
'

# ── Output helpers ──────────────────────────────────────────────────────────
#
# Successful progress goes to stdout, every problem goes to stderr. Configure
# the TrueNAS cron job to hide stdout but not stderr and a healthy run is
# silent while a failure emails you — see BACKUP.md.

say() { printf '%s\n' "$*"; }
warn() { printf '%s\n' "$*" >&2; }

die() {
  # die EXIT_CODE MESSAGE...
  db_code=$1
  shift
  warn "byb-backup: FAILED — $*"
  exit "$db_code"
}

usage() {
  cat <<EOF
Usage:
  sh byb-backup.sh [-d DEST] [-k KEEP]
  sh byb-backup.sh -c [-d DEST] [-a HOURS]
  sh byb-backup.sh -h

  -d DEST    where backups are written (default: $DEFAULT_DEST)
             must already exist; it is never created, so a typo cannot
             scatter backups across the wrong pool
  -k KEEP    how many verified runs to keep (default: $DEFAULT_KEEP)
  -c         check mode: confirm a verified run happened recently and exit
             non-zero if not. Schedule this separately to catch the backup
             having silently stopped running.
  -a HOURS   in check mode, how old the last verified run may be
             (default: $DEFAULT_MAX_AGE_HOURS)
  -h         this help

Environment (overridden by the flags above):
  BYB_BACKUP_DIR   same as -d
  BYB_BACKUP_KEEP  same as -k
EOF
}

# ── Argument parsing ────────────────────────────────────────────────────────

DEST=${BYB_BACKUP_DIR:-$DEFAULT_DEST}
KEEP=${BYB_BACKUP_KEEP:-$DEFAULT_KEEP}
MAX_AGE_HOURS=$DEFAULT_MAX_AGE_HOURS
CHECK_MODE=0

while getopts "d:k:a:ch" opt; do
  case "$opt" in
    d) DEST=$OPTARG ;;
    k) KEEP=$OPTARG ;;
    a) MAX_AGE_HOURS=$OPTARG ;;
    c) CHECK_MODE=1 ;;
    h) usage; exit 0 ;;
    *) usage >&2; exit 1 ;;
  esac
done
shift $((OPTIND - 1))
if [ $# -gt 0 ]; then
  warn "byb-backup: unexpected argument: $1"
  usage >&2
  exit 1
fi

# ── Configuration validation ────────────────────────────────────────────────

is_positive_int() {
  case "$1" in
    '' | *[!0-9]*) return 1 ;;
    *) [ "$1" -ge 1 ] ;;
  esac
}

is_positive_int "$KEEP" || die 1 "retention (-k) must be a whole number of runs, 1 or more; got '$KEEP'"
is_positive_int "$MAX_AGE_HOURS" || die 1 "max age (-a) must be a whole number of hours, 1 or more; got '$MAX_AGE_HOURS'"

DEST=${DEST%/}
[ -n "$DEST" ] || die 1 "destination (-d) is empty"

case "$DEST" in
  /*) ;;
  *) die 1 "destination must be an absolute path; got '$DEST'" ;;
esac

# The app's own storage is the one place a backup must never live: losing the
# pool would take the data and every copy of it at the same time.
case "$DEST/" in
  /mnt/.ix-apps/*)
    die 1 "destination '$DEST' is inside /mnt/.ix-apps — that is the app's own storage. Choose a path on a data pool."
    ;;
esac

# Never created. A missing destination almost always means the pool name is
# wrong, and silently creating it would put every backup somewhere nobody is
# watching — quite possibly the small boot pool.
[ -d "$DEST" ] || die 1 "destination '$DEST' does not exist. Create the dataset/directory first (this script will not create it, so a typo cannot land backups on the wrong pool)."
[ -w "$DEST" ] || die 1 "destination '$DEST' is not writable by $(id -un 2>/dev/null || echo 'this user')"

LAST_RUN_FILE="$DEST/last-run.txt"

# ── Check mode ──────────────────────────────────────────────────────────────
#
# The failure nobody notices is the backup that stopped running. Nothing is
# written and nothing errors, so silence looks exactly like success. This mode
# turns that silence into a non-zero exit.

if [ "$CHECK_MODE" -eq 1 ]; then
  [ -f "$LAST_RUN_FILE" ] || die 3 "no backup has ever recorded a result in '$LAST_RUN_FILE'. Either the backup has never run, or it is pointed at a different destination."

  cm_status=$(sed -n 's/^status=//p' "$LAST_RUN_FILE" 2>/dev/null)
  cm_finished=$(sed -n 's/^finished=//p' "$LAST_RUN_FILE" 2>/dev/null)
  cm_epoch=$(sed -n 's/^finished_epoch=//p' "$LAST_RUN_FILE" 2>/dev/null)

  [ "$cm_status" = "OK" ] || die 3 "the last backup run did not succeed (status=${cm_status:-unknown}, finished=${cm_finished:-unknown}). See '$LAST_RUN_FILE'."

  cm_now=$(date +%s 2>/dev/null)
  case "$cm_now$cm_epoch" in
    '' | *[!0-9]*)
      # No usable epoch on one side or the other. Say so rather than pretend
      # the age was checked.
      say "byb-backup: last run OK at ${cm_finished:-unknown}; age could not be checked on this host (no numeric epoch available)."
      exit 0
      ;;
  esac

  cm_age_hours=$(( (cm_now - cm_epoch) / 3600 ))
  if [ "$cm_age_hours" -gt "$MAX_AGE_HOURS" ]; then
    die 3 "the last successful backup finished ${cm_age_hours}h ago (${cm_finished:-unknown}), which is older than the ${MAX_AGE_HOURS}h limit. The scheduled job has most likely stopped running."
  fi
  say "byb-backup: OK — last verified backup finished ${cm_age_hours}h ago (${cm_finished:-unknown})."
  exit 0
fi

# ── Backup ──────────────────────────────────────────────────────────────────

command -v docker >/dev/null 2>&1 || die 1 "docker is not on PATH"

# Enumerate dynamically. Capturing stderr as well lets a docker daemon that is
# down be reported as a docker problem rather than as "no instances".
INSTANCES=$(docker ps --filter "name=$NAME_FILTER" --format '{{.Names}}' 2>&1)
if [ $? -ne 0 ]; then
  die 1 "could not list containers — docker said: $INSTANCES"
fi

# Containers that exist but are not running hold data this run did not protect.
# docker ps only lists running containers, so without this cross-check a stopped
# household would be skipped in silence.
ALL_INSTANCES=$(docker ps -a --filter "name=$NAME_FILTER" --format '{{.Names}}' 2>/dev/null)

# Zero matching containers is never a legitimate success. Four households run on
# this host; an empty list means docker is confused, the filter is wrong, or the
# whole fleet is down. Reporting "backed up 0 instances, all good" would be the
# same class of lie update-truenas.sh has been telling. The two causes get
# different messages because they send the operator to different places.
if [ -z "$INSTANCES" ]; then
  if [ -n "$ALL_INSTANCES" ]; then
    die 3 "$(printf '%s\n' "$ALL_INSTANCES" | wc -l | tr -d ' ') container(s) match '$NAME_FILTER' but none is running, so nothing was backed up. Start the instances, then re-run."
  fi
  die 2 "no containers match name filter '$NAME_FILTER' — not even stopped ones. Expected one per household. Nothing was backed up."
fi

RUN_ID=$(date +%Y-%m-%d_%H%M%S)
RUN_DIR="$DEST/$RUN_ID"
STARTED=$(date +"%Y-%m-%d %H:%M:%S %Z")

mkdir -p "$RUN_DIR" || die 1 "could not create run directory '$RUN_DIR'"

MANIFEST="$RUN_DIR/MANIFEST.txt"
FAILURES=""
OK_COUNT=0
FAIL_COUNT=0

{
  printf '%s\n' "BYB! Budget backup"
  printf '%s\n' "run_id=$RUN_ID"
  printf '%s\n' "started=$STARTED"
  printf '%s\n' "host=$(hostname 2>/dev/null || echo unknown)"
  printf '%s\n' "destination=$DEST"
  printf '%s\n' "retention_keep=$KEEP"
  printf '%s\n' "name_filter=$NAME_FILTER"
  printf '%s\n' ""
} > "$MANIFEST" || die 1 "could not write manifest '$MANIFEST'"

record() { printf '%s\n' "$*" >> "$MANIFEST"; }

# backup_one_file CONTAINER FILENAME
# Copies one file out, verifies it, and retries the pair a few times because a
# torn read is transient. Sets FILE_DETAIL; returns 0 on a verified copy.
backup_one_file() {
  bf_container=$1
  bf_name=$2
  bf_src="$CONTAINER_DATA_DIR/$bf_name"
  bf_dst="$RUN_DIR/$bf_container/$bf_name"
  bf_attempt=1

  while [ "$bf_attempt" -le "$MAX_ATTEMPTS" ]; do
    rm -f "$bf_dst"

    bf_out=$(docker cp "$bf_container:$bf_src" "$bf_dst" 2>&1)
    if [ $? -ne 0 ]; then
      FILE_DETAIL="could not copy $bf_src out of the container — docker said: $bf_out"
      # A missing or unreadable file will not fix itself on a retry.
      return 1
    fi

    if [ ! -s "$bf_dst" ]; then
      FILE_DETAIL="copied file is missing or zero bytes at $bf_dst"
    else
      bf_out=$(docker exec -i "$bf_container" node -e "$VERIFY_JS" "$bf_src" < "$bf_dst" 2>&1)
      if [ $? -eq 0 ]; then
        FILE_DETAIL="$bf_out"
        return 0
      fi
      FILE_DETAIL="verification failed: $bf_out"
    fi

    bf_attempt=$((bf_attempt + 1))
    [ "$bf_attempt" -le "$MAX_ATTEMPTS" ] && sleep "$RETRY_DELAY_SECONDS"
  done

  FILE_DETAIL="$FILE_DETAIL (after $MAX_ATTEMPTS attempts)"
  return 1
}

# Container names cannot contain whitespace, so splitting on newline is safe.
OLD_IFS=$IFS
IFS='
'

for instance in $INSTANCES; do
  IFS=$OLD_IFS
  record "instance=$instance"

  instance_ok=1
  if ! mkdir -p "$RUN_DIR/$instance"; then
    record "  FAILED  could not create $RUN_DIR/$instance"
    FAILURES="$FAILURES
  $instance: could not create its directory under $RUN_DIR"
    instance_ok=0
  else
    for fname in $BACKUP_FILES; do
      FILE_DETAIL=""
      if backup_one_file "$instance" "$fname"; then
        record "  OK      $fname  $FILE_DETAIL"
      else
        record "  FAILED  $fname  $FILE_DETAIL"
        FAILURES="$FAILURES
  $instance / $fname: $FILE_DETAIL"
        instance_ok=0
      fi
    done
  fi

  if [ "$instance_ok" -eq 1 ]; then
    OK_COUNT=$((OK_COUNT + 1))
    say "byb-backup: $instance — backed up and verified"
  else
    FAIL_COUNT=$((FAIL_COUNT + 1))
    warn "byb-backup: $instance — FAILED (see $MANIFEST)"
  fi
  record ""

  IFS='
'
done

IFS=$OLD_IFS

# Any container that exists but is not running was never enumerated above, so
# its household has no backup from this run. That is a partial run.
STOPPED_COUNT=0
OLD_IFS=$IFS
IFS='
'
for candidate in $ALL_INSTANCES; do
  IFS=$OLD_IFS
  case "
$INSTANCES
" in
    *"
$candidate
"*) ;;
    *)
      STOPPED_COUNT=$((STOPPED_COUNT + 1))
      record "instance=$candidate"
      record "  FAILED  container exists but is not running — not backed up"
      record ""
      FAILURES="$FAILURES
  $candidate: container exists but is not running, so its data was not backed up. Start it, or remove the container if the household has been retired."
      warn "byb-backup: $candidate — FAILED (not running; nothing was backed up for it)"
      ;;
  esac
  IFS='
'
done
IFS=$OLD_IFS

TOTAL_FAILURES=$((FAIL_COUNT + STOPPED_COUNT))

FINISHED=$(date +"%Y-%m-%d %H:%M:%S %Z")
FINISHED_EPOCH=$(date +%s 2>/dev/null)
case "$FINISHED_EPOCH" in
  '' | *[!0-9]*) FINISHED_EPOCH="" ;;
esac

if [ "$TOTAL_FAILURES" -eq 0 ]; then
  RUN_STATUS="OK"
else
  RUN_STATUS="FAILED"
fi

record "status=$RUN_STATUS"
record "instances_ok=$OK_COUNT"
record "instances_failed=$TOTAL_FAILURES"
record "finished=$FINISHED"

# ── Retention ───────────────────────────────────────────────────────────────
#
# Deleting old backups is the only destructive thing this script does, so the
# rule is deliberately one sentence:
#
#   Keep the newest KEEP run directories that carry a BACKUP-OK marker; delete
#   every timestamped run directory older than the oldest one kept.
#
# Three properties fall out of that, and they are the ones that matter:
#   * A good backup is only ever deleted when KEEP newer *verified* backups
#     exist. Fewer than KEEP verified runs present means nothing is deleted.
#   * A failed run leaves no marker, so it can never displace a good backup —
#     it is only ever cleaned up once it is older than the retained window.
#   * Anything not matching the timestamp pattern is not a candidate at all.
#
# And pruning is skipped entirely unless this run fully succeeded, so a bad
# night can never spend the history it failed to add to.

prune_old_runs() {
  # The shell sorts glob matches, and the timestamp format sorts chronologically
  # under LC_ALL=C, so both passes below walk oldest-to-newest in the same order.
  pr_ok_total=0
  for pr_dir in "$DEST"/$RUN_GLOB; do
    [ -d "$pr_dir" ] || continue
    [ -f "$pr_dir/$OK_MARKER" ] || continue
    pr_ok_total=$((pr_ok_total + 1))
  done

  if [ "$pr_ok_total" -le "$KEEP" ]; then
    say "byb-backup: retention — $pr_ok_total verified backup(s) present, keeping $KEEP; nothing to delete."
    return 0
  fi

  # The oldest verified run we intend to keep becomes the floor.
  pr_target=$((pr_ok_total - KEEP + 1))
  pr_index=0
  pr_floor=""
  for pr_dir in "$DEST"/$RUN_GLOB; do
    [ -d "$pr_dir" ] || continue
    [ -f "$pr_dir/$OK_MARKER" ] || continue
    pr_index=$((pr_index + 1))
    if [ "$pr_index" -eq "$pr_target" ]; then
      pr_floor=$pr_dir
      break
    fi
  done

  # Should be unreachable; refusing to delete is the right way to be wrong.
  [ -n "$pr_floor" ] || { warn "byb-backup: retention — could not identify the oldest backup to keep; deleted nothing."; return 1; }

  pr_deleted=0
  for pr_dir in "$DEST"/$RUN_GLOB; do
    [ -d "$pr_dir" ] || continue
    [ "$pr_dir" = "$pr_floor" ] && break    # reached the keep window
    [ "$pr_dir" = "$RUN_DIR" ] && continue  # never the run we just took
    if rm -rf "$pr_dir"; then
      say "byb-backup: retention — deleted $pr_dir"
      pr_deleted=$((pr_deleted + 1))
    else
      warn "byb-backup: retention — could not delete $pr_dir"
    fi
  done
  say "byb-backup: retention — kept the newest $KEEP verified backup(s), deleted $pr_deleted older run(s)."
}

if [ "$RUN_STATUS" = "OK" ]; then
  : > "$RUN_DIR/$OK_MARKER"
  prune_old_runs
else
  say "byb-backup: retention skipped — this run failed, so no older backup was deleted."
  record "retention=skipped (run failed)"
fi

# ── Result ──────────────────────────────────────────────────────────────────

LAST_RUN_TMP="$DEST/.last-run.$$"
if {
  printf '%s\n' "run_id=$RUN_ID"
  printf '%s\n' "status=$RUN_STATUS"
  printf '%s\n' "finished=$FINISHED"
  printf '%s\n' "finished_epoch=$FINISHED_EPOCH"
  printf '%s\n' "instances_ok=$OK_COUNT"
  printf '%s\n' "instances_failed=$TOTAL_FAILURES"
  printf '%s\n' "run_dir=$RUN_DIR"
} > "$LAST_RUN_TMP" 2>/dev/null && [ ! -d "$LAST_RUN_FILE" ] && mv "$LAST_RUN_TMP" "$LAST_RUN_FILE" 2>/dev/null; then
  LAST_RUN_WRITE_OK=1
else
  rm -f "$LAST_RUN_TMP" 2>/dev/null
  LAST_RUN_WRITE_OK=0
  warn "byb-backup: could not update '$LAST_RUN_FILE' (staleness checks will not see this run)"
fi

if [ "$TOTAL_FAILURES" -eq 0 ]; then
  [ "$LAST_RUN_WRITE_OK" -eq 1 ] || die 1 "the data backup verified, but '$LAST_RUN_FILE' could not be updated. The scheduled health check would be blind, so this run is not reported as successful."
  say "byb-backup: OK — $OK_COUNT instance(s) backed up and verified into $RUN_DIR"
  exit 0
fi

warn ""
warn "byb-backup: PARTIAL RUN — $OK_COUNT instance(s) succeeded, $TOTAL_FAILURES failed."
warn "Run directory: $RUN_DIR"
warn "Failures:$FAILURES"
warn ""
warn "This backup is NOT complete. Older backups were left alone."
exit 3
