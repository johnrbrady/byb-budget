#!/bin/bash
# Run this on TrueNAS to pull the latest image and restart all instances.
# Usage: bash update-truenas.sh

set -e

IMAGE="ghcr.io/johnrbrady/byb-budget:latest"

echo "Pulling latest image..."
docker pull "$IMAGE"

echo "Restarting containers..."
for CONTAINER in ix-byb-budget-byb-budget-1 ix-byb-trinidad-byb-trinidad-1 ix-byb-tex-byb-tex-1; do
  if docker ps -q -f name="^${CONTAINER}$" | grep -q .; then
    docker restart "$CONTAINER"
    echo "  ✓ $CONTAINER restarted"
  else
    echo "  ⚠ $CONTAINER not running — skipping"
  fi
done

echo "Done."
