#!/bin/bash

# Docker entrypoint script for waku-browser-tests
# Handles CLI arguments and converts them to environment variables
# Supports reading discovered addresses from /etc/addrs/addrs.env (10k sim pattern)
echo "docker-entrypoint.sh"
echo "Using address: $addrs1"
export WAKU_LIGHTPUSH_NODE="$addrs1"

# Check if address file exists and source it
# if [ -f "/etc/addrs/addrs.env" ]; then
#   echo "Sourcing discovered addresses from /etc/addrs/addrs.env"
#   source /etc/addrs/addrs.env
#   if [ -n "$addrs1" ]; then
#     export WAKU_LIGHTPUSH_NODE="$addrs1"
#     echo "Using discovered lightpush node: $WAKU_LIGHTPUSH_NODE"
#   else
#     echo "addrs1 already set. Using $addrs1"
#   fi
# fi

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
    --lightpushnode=*)
      export WAKU_LIGHTPUSH_NODE="${1#*=}"
      echo "Setting WAKU_LIGHTPUSH_NODE=${WAKU_LIGHTPUSH_NODE}"
      shift
      ;;
    --enr-bootstrap=*)
      export WAKU_ENR_BOOTSTRAP="${1#*=}"
      echo "Setting WAKU_ENR_BOOTSTRAP=${WAKU_ENR_BOOTSTRAP}"
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
