#!/bin/bash

# Docker entrypoint script for waku-browser-tests
# Handles CLI arguments and converts them to environment variables

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --cluster-id=*)
      export WAKU_CLUSTER_ID="${1#*=}"
      echo "Setting WAKU_CLUSTER_ID=${WAKU_CLUSTER_ID}"
      shift
      ;;
    --shard=*)
      export WAKU_SHARD="${1#*=}"
      echo "Setting WAKU_SHARD=${WAKU_SHARD}"
      shift
      ;;
    *)
      # Unknown argument, keep it for the main command
      break
      ;;
  esac
done

# If no specific command is provided, use the default CMD
if [ $# -eq 0 ]; then
  set -- "npm" "run" "start:server"
fi

# Execute the main command
exec "$@"
