#!/bin/sh
set -eu

project_dir=$(CDPATH='' cd -- "$(dirname -- "$0")/.." && pwd)

# Per-launch overrides leave the user's model, provider and global config intact.
exec codex --cd "$project_dir" \
  -c 'model_auto_compact_token_limit=64000' \
  -c 'tool_output_token_limit=4000' \
  "$@"
