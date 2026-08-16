#!/usr/bin/env bash
# Safe interim updater for the existing TrueNAS Custom Apps.
# The catalog app in truenas-app/ replaces this after all households migrate.

set -Eeuo pipefail

IMAGE="ghcr.io/johnrbrady/byb-budget:latest"
MIN_INSTANCES="${BYB_MIN_INSTANCES:-4}"
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }
trap 'die "deployment stopped at line $LINENO; inspect every instance before retrying"' ERR

command -v docker >/dev/null || die "docker is not installed"
docker info >/dev/null 2>&1 || die "docker is not available to this user"

mapfile -t CONTAINERS < <(
  docker ps --format '{{.ID}}' | while read -r id; do
    ref="$(docker inspect --format '{{.Config.Image}}' "$id")"
    case "$ref" in
      ghcr.io/johnrbrady/byb-budget:*) printf '%s\n' "$id" ;;
    esac
  done
)

(( ${#CONTAINERS[@]} >= MIN_INSTANCES )) || die "found ${#CONTAINERS[@]} running BYB instances; expected at least $MIN_INSTANCES"

declare -A PROJECT_CONFIGS=()
for id in "${CONTAINERS[@]}"; do
  project="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project" }}' "$id")"
  config="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project.config_files" }}' "$id")"
  [[ -n "$project" && "$project" != '<no value>' ]] || die "container $id has no Compose project label"
  [[ -n "$config" && "$config" != '<no value>' ]] || die "container $id has no Compose config-file label"
  [[ -f "$config" ]] || die "Compose file for $project does not exist: $config"
  PROJECT_CONFIGS["$project"]="$config"
done

(( ${#PROJECT_CONFIGS[@]} >= MIN_INSTANCES )) || die "found ${#PROJECT_CONFIGS[@]} unique BYB projects; expected at least $MIN_INSTANCES"

if [[ "${BYB_SKIP_BACKUP:-0}" != "1" ]]; then
  [[ -f "$SCRIPT_DIR/byb-backup.sh" ]] || die "byb-backup.sh is not beside this script; take a verified backup or rerun with BYB_SKIP_BACKUP=1 only if one was just checked"
  printf 'Taking and verifying a fresh four-household backup...\n'
  sh "$SCRIPT_DIR/byb-backup.sh" -d "${BYB_BACKUP_DIR:-/mnt/Zion/BYB_Backups}" -k "${BYB_BACKUP_KEEP:-14}"
fi

printf 'Pulling %s...\n' "$IMAGE"
docker pull "$IMAGE"
TARGET_IMAGE_ID="$(docker image inspect --format '{{.Id}}' "$IMAGE")"

for project in "${!PROJECT_CONFIGS[@]}"; do
  config="${PROJECT_CONFIGS[$project]}"
  printf 'Recreating %s from %s...\n' "$project" "$config"
  docker compose -p "$project" -f "$config" up -d --force-recreate --pull always
done

failures=0
for project in "${!PROJECT_CONFIGS[@]}"; do
  mapfile -t ids < <(docker ps --filter "label=com.docker.compose.project=$project" --format '{{.ID}}')
  if (( ${#ids[@]} != 1 )); then
    printf 'FAIL  %s has %s running containers (expected 1)\n' "$project" "${#ids[@]}" >&2
    failures=$((failures + 1))
    continue
  fi
  running_image="$(docker inspect --format '{{.Image}}' "${ids[0]}")"
  if [[ "$running_image" != "$TARGET_IMAGE_ID" ]]; then
    printf 'FAIL  %s is running %s, target is %s\n' "$project" "$running_image" "$TARGET_IMAGE_ID" >&2
    failures=$((failures + 1))
  else
    printf 'OK    %s is running %s\n' "$project" "$TARGET_IMAGE_ID"
  fi
done

(( failures == 0 )) || die "$failures instance(s) failed post-deploy verification"
printf 'DEPLOY-OK: %s BYB projects recreated and verified.\n' "${#PROJECT_CONFIGS[@]}"
