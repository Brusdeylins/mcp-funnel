#!/bin/sh
set -e

# Ensure data directory exists
mkdir -p "${DATA_DIR:-/data}"

exec node dst/mcp-funnel.js "$@"
