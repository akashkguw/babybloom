#!/bin/bash
# Pipeline loop — runs pipeline.sh every 60s
# Called by com.babybloom.pipeline LaunchAgent

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

while true; do
  bash "$SCRIPT_DIR/pipeline.sh"
  sleep 60
done
